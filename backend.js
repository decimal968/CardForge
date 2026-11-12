// Card Forge backend (v0.5). Plain ESM, no build step. `spindle` is a host global.

const DEFAULT_INTERVIEW_PROMPT = `You are Card Forge, a collaborative designer of roleplay character cards.
Talk naturally with the user about the character they want. After each message, respond with one to three focused questions or concrete suggestions about whatever is still undecided: identity, appearance, personality and flaws, speech style, backstory, relationship to {{user}}, setting and scenario, the opening message, content boundaries.
Do not ask everything at once. Do not write the whole card unless asked; short draft snippets of single parts are fine when they help. Use {{char}} and {{user}} for names.
The user may attach images (reference art, screenshots) or text files (notes, an existing bio). Treat them as source material: say briefly what you see or read, and fold the useful details into your questions.
When the character feels complete, say so and suggest pressing "Finalize card".
End every reply with one last line in exactly this format, with nothing after it:
Suggestions: first option | second option | third option
Give 2 or 3 short follow-ups (under 12 words each) written from the user's point of view, which the user could tap to send as their next message, for example: Give her a dry sense of humor.`;

const CARD_SCHEMA = `Output ONLY one JSON object, no commentary and no code fences, with exactly these keys:
name, description, personality, scenario, first_mes, mes_example, alternate_greetings (array of strings), system_prompt, post_history_instructions, creator_notes, tags (array of strings), lorebook (array of objects, each with comment, keys (array of strings) and content).`;

const DEFAULT_FINALIZE_PROMPT = `Using the conversation below, write the final character card.
${CARD_SCHEMA}
Writing guidelines:
- Use {{char}} and {{user}} instead of names where natural. Use only what the conversation supports; leave unknown fields as empty strings or empty arrays rather than inventing details.
- description: detailed prose covering appearance, background and behavior.
- personality: focus on contradictions, drives and defense mechanisms rather than a list of adjectives.
- scenario: the situation and the relationship at the start.
- first_mes: a vivid in-character opening that sets the scene with sensory detail. Never describe {{user}}'s reactions, movements, thoughts or dialogue. End on an open hook that leaves the initiative with {{user}}.
- alternate_greetings: only if the conversation asked for them or they clearly help; give different starting situations, not rewordings of the same scene, at most 3.
- mes_example: two or three <START> blocks with "{{user}}:" and "{{char}}:" lines showing contrast (one casual, one tense or vulnerable), including how {{char}} reacts to interruptions, teasing or silence, with distinctive speech habits and physical tells.
- lorebook: 0 to 8 concise entries, only for world details worth injecting when mentioned (locations, factions, key people, artifacts, world rules). Each has a clear title as comment, 2 to 6 specific trigger keys (proper nouns, titles or uncommon terms, never common words like "eyes" or "magic") and standalone content. Return an empty array if the conversation covered none.`;

const IMPORT_PROMPT = `Convert the text below into a character card, keeping its facts and wording as much as possible and adding nothing that is not there.
${CARD_SCHEMA}
Use {{char}} and {{user}} instead of names where natural. Leave fields the text does not cover as empty strings or empty arrays.`;

// Built-in style presets (always available next to Finalize).
const BUILTIN_PRESETS = [
  { id: "builtin:prose", name: "Natural prose", text: "Write description and personality as flowing natural prose paragraphs, with no bullet lists or tag lists. Prefer concrete behavior and psychology over adjectives." },
  { id: "builtin:markdown", name: "Markdown sections", text: "Format description with markdown headers (### Physical Traits, ### Personality, ### Background, ### Motivations, ### Speech and Mannerisms) and short bullet points under each header, so different traits stay clearly separated." },
  { id: "builtin:wpp", name: "W++ / AliChat", text: 'Format description and personality in compact W++ / AliChat pseudocode, for example [Character("Name"){ Species("human") Mind("cynical" + "dry humor") Likes("rain") }]. Keep first_mes, scenario and mes_example as normal prose.' },
  { id: "builtin:concise", name: "Concise (token-efficient)", text: "Be token-efficient: description under about 400 words, personality under 80 words, mes_example a single short <START> block, and no filler." },
  { id: "builtin:slowburn", name: "Slow-burn drama", text: "Tone: slow-burn emotional drama. Emphasize guarded emotions, subtext, restraint and gradual trust; first_mes should start in a quiet, charged situation rather than a dramatic event." },
];
const findPreset = (cfg, id) => BUILTIN_PRESETS.find((p) => p.id === id) || (cfg.presets || []).find((p) => p.id === id);

const editInterviewNote = (card) => `\n\nYou are revising an EXISTING character card, not creating a new one. The current card:\n${JSON.stringify(card, null, 2)}\nHelp the user decide what to change or improve; suggest concrete improvements when useful and keep edits consistent with the existing card. Do not rewrite the whole card unless asked.`;
const editFinalizeNote = (card, saved) => `\n\nThis is an EXISTING card being revised. Current card:\n${JSON.stringify(card, null, 2)}\nOutput the COMPLETE updated card with the same keys. Keep every field the conversation did not change exactly as it is. ${saved ? 'Always return "lorebook": [].' : "Return the complete lorebook: keep the existing entries and apply any changes."}`;

const DRAFT_PATH = "draft.json";
const SETTINGS_PATH = "settings.json";
const drafts = new Map();
const settingsCache = new Map();
const aborts = new Map(); // userId -> Set<AbortController>
const busy = new Set();
const seq = new Map();
const kinds = new Map();
const IDLE_MS = Number(globalThis.__cardforgeIdleMs) || 120000;  // no output from the model
const TOTAL_MS = Number(globalThis.__cardforgeTotalMs) || 300000; // non-streaming call limit
function track(userId) {
  const ac = new AbortController();
  if (!aborts.has(userId)) aborts.set(userId, new Set());
  aborts.get(userId).add(ac);
  return { ac, release: () => aborts.get(userId)?.delete(ac) };
}
const abortAll = (userId) => { for (const ac of aborts.get(userId) || []) ac.abort(); };
function markBusy(userId, kind) {
  busy.add(userId); kinds.set(userId, kind); seq.set(userId, (seq.get(userId) || 0) + 1);
  send({ type: "busy", value: true, kind }, userId);
}
const cancelled = (err) => !!err?.cancelled;

const log = (level, msg) => spindle.log[level](`[cardforge] ${msg}`);
const send = (msg, userId) => spindle.sendToFrontend(msg, userId);
const str = (v) => (typeof v === "string" ? v : "");
const strList = (v) => (Array.isArray(v) ? v.map(str).map((s) => s.trim()).filter(Boolean) : []);
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const can = (p) => (spindle.permissions?.has ? spindle.permissions.has(p) : true);

// ---------- storage ----------
const ctxs = new Map(); // userId -> { index, d }
const newId = () => Math.random().toString(36).slice(2, 9);
const blankDraft = () => ({ messages: [], card: null, editing: null });

async function readJson(path, userId, fallback = null) {
  try { return await spindle.userStorage.getJson(path, { fallback, userId }); } catch { return fallback; }
}
async function writeJson(path, value, userId) {
  try { await spindle.userStorage.setJson(path, value, { userId }); }
  catch (err) { log("warn", `write ${path} failed: ${err.message}`); }
}
function draftTitle(d) {
  if (d.editing?.name) return (d.editing.id ? "Revise: " : "Import: ") + d.editing.name;
  if (d.card?.name) return d.card.name;
  const first = d.messages.find((m) => m.role === "user");
  return first ? (first.content || first.attachments?.[0]?.name || "Attachment").replace(/\s+/g, " ").slice(0, 36) : "New card";
}
async function loadCtx(userId) {
  if (ctxs.has(userId)) return ctxs.get(userId);
  let index = await readJson("index.json", userId);
  let d = null;
  if (index && Array.isArray(index.items) && index.current) {
    d = await readJson(`draft-${index.current}.json`, userId);
  }
  if (!d || !Array.isArray(d.messages)) {
    // first run (or migration from the single-draft versions)
    const legacy = await readJson("draft.json", userId);
    d = legacy && Array.isArray(legacy.messages) ? legacy : blankDraft();
    const id = newId();
    d._id = id;
    index = { current: id, items: [{ id, title: draftTitle(d), updated: Date.now() }] };
    await writeJson(`draft-${id}.json`, d, userId);
    await writeJson("index.json", index, userId);
  }
  d.editing = d.editing || null;
  d._id = index.current;
  const st = { index, d };
  ctxs.set(userId, st);
  return st;
}
async function loadDraft(userId) { return (await loadCtx(userId)).d; }
async function saveDraft(userId) {
  const { index, d } = await loadCtx(userId);
  await writeJson(`draft-${d._id}.json`, d, userId);
  const it = index.items.find((x) => x.id === d._id);
  if (it) { it.title = draftTitle(d); it.updated = Date.now(); }
  await writeJson("index.json", index, userId);
}
async function createDraft(userId, init) {
  const st = await loadCtx(userId);
  await saveDraft(userId);
  const d = { ...blankDraft(), ...(init || {}) };
  d._id = newId();
  st.index.items.unshift({ id: d._id, title: draftTitle(d), updated: Date.now() });
  st.index.current = d._id;
  st.d = d;
  await saveDraft(userId);
  return d;
}
async function switchDraft(id, userId) {
  const st = await loadCtx(userId);
  if (id === st.d._id || !st.index.items.some((x) => x.id === id)) return;
  await saveDraft(userId);
  const d = await readJson(`draft-${id}.json`, userId);
  if (!d || !Array.isArray(d.messages)) {
    st.index.items = st.index.items.filter((x) => x.id !== id);
    await writeJson("index.json", st.index, userId);
    return;
  }
  d.editing = d.editing || null;
  d._id = id;
  st.d = d;
  st.index.current = id;
  await writeJson("index.json", st.index, userId);
}
async function deleteDraft(id, userId) {
  const st = await loadCtx(userId);
  st.index.items = st.index.items.filter((x) => x.id !== id);
  const target = id === st.d._id ? st.d : await readJson(`draft-${id}.json`, userId);
  if (target && Array.isArray(target.messages)) await dropAttachments(attIds(target.messages), userId);
  try { await spindle.userStorage.delete(`draft-${id}.json`, { userId }); } catch {}
  if (id === st.d._id) {
    if (st.index.items.length) {
      const next = st.index.items[0].id;
      const d = (await readJson(`draft-${next}.json`, userId)) || blankDraft();
      d.editing = d.editing || null; d._id = next; st.d = d; st.index.current = next;
    } else {
      const d = blankDraft(); d._id = newId(); st.d = d; st.index.current = d._id;
      st.index.items = [{ id: d._id, title: "New card", updated: Date.now() }];
      await writeJson(`draft-${d._id}.json`, d, userId);
    }
  }
  await writeJson("index.json", st.index, userId);
}

const blankSettings = () => ({
  connectionId: null, interviewPrompt: "", finalizePrompt: "", styleNotes: "", temperature: null, maxTokens: null,
  reasoningMode: "inherit", reasoningEffort: "medium", presets: [], activePreset: "",
  presetId: "", presetBlockIds: null,
});
async function loadSettings(userId) {
  if (settingsCache.has(userId)) return settingsCache.get(userId);
  let s = null;
  try { s = await spindle.userStorage.getJson(SETTINGS_PATH, { fallback: null, userId }); } catch {}
  s = { ...blankSettings(), ...(s && typeof s === "object" ? s : {}) };
  settingsCache.set(userId, s);
  return s;
}
function sanitizeSettings(x) {
  x = x && typeof x === "object" ? x : {};
  const clean = (v, def) => (str(v).trim() === def.trim() ? "" : str(v));
  const modes = ["inherit", "off", "custom"], efforts = ["auto", "low", "medium", "high", "max"];
  return {
    connectionId: str(x.connectionId) || null,
    interviewPrompt: clean(x.interviewPrompt, DEFAULT_INTERVIEW_PROMPT),
    finalizePrompt: clean(x.finalizePrompt, DEFAULT_FINALIZE_PROMPT),
    styleNotes: str(x.styleNotes),
    temperature: numOrNull(x.temperature),
    maxTokens: numOrNull(x.maxTokens) ? Math.round(x.maxTokens) : null,
    reasoningMode: modes.includes(x.reasoningMode) ? x.reasoningMode : "inherit",
    reasoningEffort: efforts.includes(x.reasoningEffort) ? x.reasoningEffort : "medium",
    presets: Array.isArray(x.presets)
      ? x.presets.slice(0, 20).map((p) => ({ id: str(p?.id) || newId(), name: str(p?.name).trim() || "Preset", text: str(p?.text) })).filter((p) => p.text.trim())
      : [],
    activePreset: str(x.activePreset),
    presetId: str(x.presetId),
    presetBlockIds: Array.isArray(x.presetBlockIds) ? x.presetBlockIds.map(str).filter(Boolean) : null,
  };
}
async function pushSettings(userId) {
  const s = await loadSettings(userId);
  let connections = [];
  try {
    const list = await spindle.connections.list(userId);
    connections = list.map((c) => ({ id: c.id, name: c.name, provider: c.provider, model: c.model ?? "", is_default: !!c.is_default }));
  } catch (err) { log("warn", `connections.list failed: ${err.message}`); }
  let presetOptions = [];
  if (can("presets")) {
    try {
      const { data } = await spindle.presets.list({ limit: 200, userId });
      presetOptions = data.map((p) => ({ id: p.id, name: p.name, isDefault: presetIsDefault(p) }));
    } catch (err) { log("warn", `presets.list failed: ${err.message}`); }
  }
  send({
    type: "settings", presetOptions, presetPermission: can("presets"),
    settings: { ...s, interviewPrompt: s.interviewPrompt.trim() || DEFAULT_INTERVIEW_PROMPT, finalizePrompt: s.finalizePrompt.trim() || DEFAULT_FINALIZE_PROMPT },
    defaults: { interviewPrompt: DEFAULT_INTERVIEW_PROMPT, finalizePrompt: DEFAULT_FINALIZE_PROMPT },
    connections,
  }, userId);
}

// ---------- Lumiverse preset (optional style/rules guidance) ----------
const PRESET_CAP = 12000;
const presetIsDefault = (p) => Object.entries(p?.metadata || {}).some(([k, v]) => /default/i.test(k) && v === true);
const usableBlock = (b) => !!b && !b.marker && str(b.content).trim().length > 0;

async function resolvePreset(presetId, userId) {
  if (!presetId) return { none: true };
  if (!can("presets")) return { error: "Grant the Presets permission to Card Forge in the Extensions panel." };
  let id = presetId;
  if (id === "auto") {
    const { data } = await spindle.presets.list({ limit: 200, userId });
    const p = data.find(presetIsDefault);
    if (!p) return { error: "I can't see which preset is your default. Pick one from the list instead." };
    id = p.id;
  }
  const preset = await spindle.presets.get(id, userId);
  if (!preset) return { error: "That preset no longer exists." };
  return { preset };
}
const defaultSelection = (blocks) => blocks.filter((b) => b.enabled).map((b) => b.id);
async function handleListPresetBlocks(presetId, userId) {
  presetId = str(presetId);
  try {
    const r = await resolvePreset(presetId, userId);
    if (r.none) { send({ type: "preset_blocks", presetId, blocks: [], selected: [], note: "" }, userId); return; }
    if (r.error) { send({ type: "preset_blocks", presetId, blocks: [], selected: [], note: r.error }, userId); return; }
    const all = (await spindle.presets.blocks.list(r.preset.id, userId)).filter(usableBlock);
    const s = await loadSettings(userId);
    const selected = s.presetId === presetId && Array.isArray(s.presetBlockIds) ? s.presetBlockIds.filter((id) => all.some((b) => b.id === id)) : defaultSelection(all);
    send({
      type: "preset_blocks", presetId, name: r.preset.name, selected,
      blocks: all.map((b) => ({ id: b.id, name: str(b.name) || "(unnamed)", role: b.role, enabled: !!b.enabled, chars: str(b.content).length, preview: str(b.content).replace(/\s+/g, " ").slice(0, 150) })),
      note: all.length ? "" : "This preset has no text blocks I can use.",
    }, userId);
  } catch (err) {
    send({ type: "preset_blocks", presetId, blocks: [], selected: [], note: `Could not read the preset: ${err.message}` }, userId);
  }
}
function joinBlocks(blocks) {
  let t = blocks.map((b) => `### ${str(b.name) || "Block"}\n${str(b.content).trim()}`).join("\n\n");
  if (t.length > PRESET_CAP) t = t.slice(0, PRESET_CAP);
  return t;
}
async function handlePreviewPreset(presetId, blockIds, userId) {
  try {
    const r = await resolvePreset(str(presetId), userId);
    if (!r.preset) { send({ type: "preset_preview", tokens: 0, chars: 0 }, userId); return; }
    const ids = new Set(Array.isArray(blockIds) ? blockIds : []);
    const all = (await spindle.presets.blocks.list(r.preset.id, userId)).filter(usableBlock);
    const text = joinBlocks(all.filter((b) => ids.has(b.id)));
    let tokens = Math.ceil(text.length / 4), approximate = true;
    try { const c = await spindle.tokens.countText(text, { userId }); tokens = c.total_tokens; approximate = !!c.approximate; } catch {}
    send({ type: "preset_preview", tokens, approximate, chars: text.length, capped: text.length >= PRESET_CAP }, userId);
  } catch (err) {
    send({ type: "preset_preview", tokens: 0, chars: 0 }, userId);
  }
}
async function presetText(userId) {
  try {
    const s = await loadSettings(userId);
    if (!s.presetId) return "";
    const r = await resolvePreset(s.presetId, userId);
    if (!r.preset) return "";
    const all = (await spindle.presets.blocks.list(r.preset.id, userId)).filter(usableBlock);
    const ids = Array.isArray(s.presetBlockIds) ? new Set(s.presetBlockIds) : new Set(defaultSelection(all));
    return joinBlocks(all.filter((b) => ids.has(b.id)));
  } catch (err) { log("warn", `preset read failed: ${err.message}`); return ""; }
}
const guidanceFor = (t, kind) => (t
  ? `\n\n## Roleplay preset\n${kind === "chat"
    ? "Follow these roleplay rules and style, as you would in a normal chat:"
    : "The user's own roleplay preset follows. Use it as guidance for tone, prose style and content rules in everything you write. Ignore anything about chat turns, reply length or formatting of replies, and ignore template macros."}\n\n${t}`
  : "");

// ---------- generation ----------
function extractText(res) {
  if (typeof res === "string") return res;
  if (!res) return "";
  if (typeof res.content === "string") return res.content;
  if (typeof res.text === "string") return res.text;
  if (typeof res.choices?.[0]?.message?.content === "string") return res.choices[0].message.content;
  return "";
}

function buildReq(messages, s, userId, signal) {
  const parameters = { max_tokens: s.maxTokens || 8000 };
  if (s.temperature !== null) parameters.temperature = s.temperature;
  const req = { messages, parameters, userId };
  if (signal) req.signal = signal;
  if (s.connectionId) req.connection_id = s.connectionId;
  if (s.reasoningMode === "off") req.reasoning = { source: "off" };
  else if (s.reasoningMode === "custom") req.reasoning = { source: "custom", apiReasoning: true, effort: s.reasoningEffort };
  return req;
}

// Rejects on abort (cancelled) or timeout, even if the host ignores the signal.
function raceAbort(promise, signal, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("The model took too long to respond. Try again or choose a different connection."), { timeout: true })), ms);
    const onAbort = () => reject(Object.assign(new Error("Cancelled."), { cancelled: true }));
    if (signal) {
      if (signal.aborted) { clearTimeout(timer); return onAbort(); }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    promise.then(resolve, reject).finally(() => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); });
  });
}

async function generateText(messages, userId, signal) {
  const s = await loadSettings(userId);
  let res;
  try {
    res = await raceAbort(spindle.generate.quiet(buildReq(messages, s, userId, signal), userId), signal, TOTAL_MS);
  } catch (err) {
    if (err.cancelled || err.timeout) throw err;
    throw new Error(`${err?.message || err} [connection=${s.connectionId ? "chosen" : "active/default"}]`);
  }
  const text = extractText(res).trim();
  if (!text) throw new Error(`empty response from the model [result type: ${typeof res}]`);
  return text;
}

// Streams via quietStream; collects reasoning separately. Cancellable, with an idle
// watchdog. Falls back to a normal call if streaming fails before any output.
async function streamText(messages, userId, signal, onPartial) {
  const s = await loadSettings(userId);
  const inner = new AbortController();
  let timedOut = false, userAbort = false, timer;
  const onAbort = () => { userAbort = true; inner.abort(); };
  signal.addEventListener("abort", onAbort, { once: true });
  const stopped = new Promise((res) => inner.signal.addEventListener("abort", res, { once: true }));
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; inner.abort(); }, IDLE_MS); };
  let text = "", reasoning = "", last = 0;
  try {
    if (signal.aborted) onAbort();
    arm();
    const it = spindle.generate.quietStream(buildReq(messages, s, userId, inner.signal), userId)[Symbol.asyncIterator]();
    while (!inner.signal.aborted) {
      const r = await Promise.race([it.next(), stopped.then(() => ({ stopped: true }))]);
      if (r.stopped) { try { it.return?.(); } catch {} break; }
      if (r.done) break;
      arm();
      const chunk = r.value;
      if (chunk.type === "token" && chunk.token) text += chunk.token;
      else if (chunk.type === "reasoning" && chunk.token) reasoning += chunk.token;
      else if (chunk.type === "done") {
        if (!text && chunk.content) text = chunk.content;
        if (!reasoning && chunk.reasoning) reasoning = chunk.reasoning;
      }
      const now = Date.now();
      if (now - last > 120) { last = now; onPartial(text, reasoning); }
    }
  } catch (err) {
    if (!userAbort && !timedOut) {
      if (!text && !reasoning) {
        clearTimeout(timer);
        return { text: await generateText(messages, userId, signal), reasoning: "", aborted: false };
      }
      throw err;
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
  if (timedOut) throw new Error("The model stopped responding (no output for 2 minutes). Try again or choose a different connection.");
  if (userAbort) return { text: text.trim(), reasoning: reasoning.trim(), aborted: true };
  onPartial(text, reasoning);
  return { text: text.trim(), reasoning: reasoning.trim(), aborted: false };
}

// ---------- cards ----------
function normalizeCard(c) {
  c = c && typeof c === "object" ? c : {};
  return {
    name: str(c.name), description: str(c.description), personality: str(c.personality),
    scenario: str(c.scenario), first_mes: str(c.first_mes), mes_example: str(c.mes_example),
    alternate_greetings: strList(c.alternate_greetings), system_prompt: str(c.system_prompt),
    post_history_instructions: str(c.post_history_instructions), creator_notes: str(c.creator_notes),
    tags: strList(c.tags),
    lorebook: Array.isArray(c.lorebook)
      ? c.lorebook.map((e) => ({ comment: str(e?.comment), keys: strList(e?.keys), content: str(e?.content) })).filter((e) => e.content.trim())
      : [],
  };
}
function parseCardJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("the model did not return a card");
  return normalizeCard(JSON.parse(text.slice(a, b + 1)));
}
const pickCardFields = (c) => {
  const n = normalizeCard(c);
  delete n.lorebook;
  return n;
};

// ---------- attachments (images and text files) ----------
const pendingAtt = new Map(); // userId -> Map(id -> meta) uploaded but not sent yet
const MAX_PENDING = 6;
const attPath = (id) => `att-${id}.json`;
const pendingFor = (userId) => { if (!pendingAtt.has(userId)) pendingAtt.set(userId, new Map()); return pendingAtt.get(userId); };
const attIds = (msgs) => msgs.flatMap((m) => (m.attachments || []).map((a) => a.id));
async function dropAttachments(ids, userId) {
  for (const id of ids) { try { await spindle.userStorage.delete(attPath(id), { userId }); } catch {} }
}
async function handleAttach(raw, userId) {
  const id = str(raw.id) || newId();
  try {
    const pend = pendingFor(userId);
    if (!pend.has(id) && pend.size >= MAX_PENDING) throw new Error(`You can attach up to ${MAX_PENDING} files per message.`);
    const kind = raw.kind === "image" ? "image" : "text";
    const name = str(raw.name).slice(0, 120) || "file";
    let rec, meta;
    if (kind === "image") {
      const data = str(raw.data);
      if (!data) throw new Error("That image could not be read.");
      if (data.length > 1500000) throw new Error("That image is too large even after shrinking it. Try a smaller one.");
      rec = { mime: str(raw.mime) || "image/jpeg", data };
      meta = { id, kind, name, mime: rec.mime, thumb: str(raw.thumb).slice(0, 40000) };
    } else {
      const text = str(raw.text).slice(0, 60000);
      if (!text.trim()) throw new Error("That file is empty.");
      rec = { text };
      meta = { id, kind, name, chars: text.length, truncated: !!raw.truncated || str(raw.text).length > 60000 };
    }
    await spindle.userStorage.setJson(attPath(id), rec, { userId });
    pend.set(id, meta);
    send({ type: "attached", id }, userId);
  } catch (err) {
    send({ type: "attach_error", id, message: err.message }, userId);
  }
}
async function handleDetach(id, userId) {
  id = str(id);
  if (pendingFor(userId).delete(id)) await dropAttachments([id], userId);
}
async function clearPending(userId) {
  const pend = pendingFor(userId);
  const ids = [...pend.keys()];
  pend.clear();
  await dropAttachments(ids, userId);
}
// Content for one message as the model should see it: a string, or parts when images are attached.
async function llmContent(m, userId) {
  const atts = m.attachments || [];
  if (!atts.length) return m.content;
  const texts = [], images = [];
  for (const a of atts) {
    const f = await readJson(attPath(a.id), userId);
    if (!f) continue;
    if (a.kind === "text") texts.push(`[Attached file: ${a.name}]\n${f.text}\n[End of file]`);
    else images.push({ type: "image", data: f.data, mime_type: f.mime });
  }
  const lead = m.content || (images.length || texts.length ? "(See the attached material.)" : "");
  const text = [lead, ...texts].filter(Boolean).join("\n\n");
  return images.length ? [{ type: "text", text }, ...images] : text;
}
const hasImages = (msgs) => msgs.some((m) => (m.attachments || []).some((a) => a.kind === "image"));

// ---------- messages / swipes ----------
function ensureSwipes(m) {
  if (!Array.isArray(m.swipes) || !m.swipes.length) { m.swipes = [{ content: m.content, reasoning: m.reasoning || "" }]; m.swipe = 0; }
  return m;
}
const view = (d) => d.messages.map((m) => ({
  role: m.role, content: m.content, reasoning: m.reasoning || "",
  swipe: m.swipe || 0, swipes: Array.isArray(m.swipes) ? m.swipes.length : 1,
  attachments: m.attachments || [],
}));
async function pushState(userId) {
  const { index, d } = await loadCtx(userId);
  const s = await loadSettings(userId);
  send({
    type: "state", messages: view(d), card: d.card,
    editing: d.editing ? { id: d.editing.id || null, name: d.editing.name, imported: !d.editing.id } : null,
    drafts: index.items, currentDraft: d._id,
    presets: [...BUILTIN_PRESETS, ...(s.presets || [])].map((p) => ({ id: p.id, name: p.name })), activePreset: s.activePreset || "",
    busy: busy.has(userId), busyKind: busy.has(userId) ? kinds.get(userId) || "" : "",
  }, userId);
}

async function runReply(userId, { swipe = false } = {}) {
  const d = await loadDraft(userId);
  const { ac, release } = track(userId);
  markBusy(userId, "reply");
  try {
    const cfg = await loadSettings(userId);
    let sys = cfg.interviewPrompt.trim() || DEFAULT_INTERVIEW_PROMPT;
    if (d.editing) sys += editInterviewNote(d.editing.base);
    sys += guidanceFor(await presetText(userId));
    const src = swipe ? d.messages.slice(0, -1) : d.messages;
    const history = [];
    for (const m of src) history.push({ role: m.role, content: await llmContent(m, userId) });
    const { text, reasoning, aborted } = await streamText(
      [{ role: "system", content: sys }, ...history], userId, ac.signal,
      (t, r) => send({ type: "stream", content: t, reasoning: r }, userId),
    );
    if (!text && !aborted) throw new Error("empty response from the model");
    if (text) {
      if (swipe && d.messages.length && d.messages[d.messages.length - 1].role === "assistant") {
        const m = ensureSwipes(d.messages[d.messages.length - 1]);
        m.swipes.push({ content: text, reasoning });
        m.swipe = m.swipes.length - 1; m.content = text; m.reasoning = reasoning;
      } else {
        d.messages.push({ role: "assistant", content: text, reasoning, swipes: [{ content: text, reasoning }], swipe: 0 });
      }
    }
    await saveDraft(userId);
  } catch (err) {
    log("error", `reply failed: ${err.message}`);
    if (!cancelled(err)) {
      const hint = hasImages(d.messages) ? "\n\nIf your model can't read images, delete the message with the image (or use Edit) and try again." : "";
      send({ type: "error", message: `Generation failed: ${err.message}${hint}` }, userId);
    }
  } finally {
    release();
    busy.delete(userId);
    send({ type: "busy", value: false }, userId);
    await pushState(userId);
  }
}

async function handleSend(content, attachmentIds, userId) {
  const text = str(content).trim();
  if (busy.has(userId)) return;
  const pend = pendingFor(userId);
  const ids = Array.isArray(attachmentIds) ? attachmentIds.map(str) : [];
  const atts = ids.map((id) => pend.get(id)).filter(Boolean);
  if (!text && !atts.length) return;
  for (const a of atts) pend.delete(a.id);
  const d = await loadDraft(userId);
  d.messages.push({ role: "user", content: text, ...(atts.length ? { attachments: atts } : {}) });
  await saveDraft(userId);
  await pushState(userId);
  await runReply(userId);
}
// Retry (last message is the user's) or add a new swipe to the last reply.
async function handleRetry(userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  const last = d.messages[d.messages.length - 1];
  if (!last) return;
  await runReply(userId, { swipe: last.role === "assistant" });
}
async function handleSwipe(dir, userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  const m = d.messages[d.messages.length - 1];
  if (!m || m.role !== "assistant") return;
  ensureSwipes(m);
  const idx = Math.max(0, Math.min(m.swipes.length - 1, (m.swipe || 0) + (dir < 0 ? -1 : 1)));
  m.swipe = idx; m.content = m.swipes[idx].content; m.reasoning = m.swipes[idx].reasoning || "";
  await saveDraft(userId);
  await pushState(userId);
}
async function handleTruncate(index, userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  if (!Number.isInteger(index) || index < 0 || index >= d.messages.length) return;
  const removed = d.messages.slice(index);
  d.messages = d.messages.slice(0, index);
  const keep = removed[0]?.role === "user" ? (removed[0].attachments || []) : [];
  const keepIds = new Set(keep.map((a) => a.id));
  await dropAttachments(attIds(removed).filter((id) => !keepIds.has(id)), userId);
  if (keep.length) {
    const pend = pendingFor(userId);
    for (const a of keep) pend.set(a.id, a);
    send({ type: "attach_restore", items: keep }, userId);
  }
  await saveDraft(userId);
  await pushState(userId);
}
async function handleDeleteMessage(index, userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  if (!Number.isInteger(index) || index < 0 || index >= d.messages.length) return;
  const m = d.messages[index];
  const lastIdx = index === d.messages.length - 1;
  if (m.role === "assistant" && lastIdx && Array.isArray(m.swipes) && m.swipes.length > 1) {
    // remove only the version being viewed
    m.swipes.splice(m.swipe || 0, 1);
    m.swipe = Math.min(m.swipe || 0, m.swipes.length - 1);
    m.content = m.swipes[m.swipe].content; m.reasoning = m.swipes[m.swipe].reasoning || "";
  } else {
    const [gone] = d.messages.splice(index, 1);
    await dropAttachments(attIds([gone]), userId);
  }
  await saveDraft(userId);
  await pushState(userId);
}

async function handleFinalize(userId, presetId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  if (d.messages.length === 0) {
    send({ type: "error", message: "Talk about your character first, then finalize." }, userId);
    return;
  }
  const { ac, release } = track(userId);
  markBusy(userId, "finalize");
  try {
    const images = [];
    const lines = [];
    for (const m of d.messages) {
      let line = `${m.role === "user" ? "USER" : "DESIGNER"}: ${m.content || ""}`;
      for (const a of m.attachments || []) {
        const f = await readJson(attPath(a.id), userId);
        if (!f) continue;
        if (a.kind === "text") line += `\n[Attached file: ${a.name}]\n${f.text.slice(0, 20000)}\n[End of file]`;
        else { line += `\n[Attached image: ${a.name}]`; if (images.length < 6) images.push({ type: "image", data: f.data, mime_type: f.mime }); }
      }
      lines.push(line);
    }
    const transcript = lines.join("\n\n");
    const userContent = images.length ? [{ type: "text", text: transcript + "\n\n(The attached images listed above follow, in order.)" }, ...images] : transcript;
    const cfg = await loadSettings(userId);
    let sys = cfg.finalizePrompt.trim() || DEFAULT_FINALIZE_PROMPT;
    if (d.editing) sys += editFinalizeNote(d.editing.base, !!d.editing.id);
    if (cfg.styleNotes.trim()) sys += `\n\nAdditional requirements from the user (follow these):\n${cfg.styleNotes.trim()}`;
    const preset = findPreset(cfg, presetId);
    if (preset) sys += `\n\nStyle preset "${preset.name}" (follow this):\n${preset.text.trim()}`;
    sys += guidanceFor(await presetText(userId));
    if ((cfg.activePreset || "") !== (preset?.id || "")) {
      cfg.activePreset = preset?.id || "";
      await writeJson(SETTINGS_PATH, cfg, userId);
    }
    const { text, aborted } = await streamText(
      [{ role: "system", content: sys }, { role: "user", content: userContent }], userId, ac.signal,
      (t, r) => send({ type: "stream", content: t, reasoning: r }, userId),
    );
    if (aborted) {
      send({ type: "notice", message: "Stopped. No card was made." }, userId);
    } else {
      if (!text) throw new Error("empty response from the model");
      const card = parseCardJson(text);
      if (d.editing) { if (d.editing.id) card.lorebook = []; if (!card.name) card.name = d.editing.name; }
      d.card = card;
      await saveDraft(userId);
      send({ type: "card", card }, userId);
    }
  } catch (err) {
    log("error", `finalize failed: ${err.message}`);
    if (cancelled(err)) send({ type: "notice", message: "Stopped. No card was made." }, userId);
    else send({ type: "error", message: `Could not build the card: ${err.message}` }, userId);
  } finally {
    release();
    busy.delete(userId);
    send({ type: "busy", value: false }, userId);
  }
}

// ---------- saving ----------
async function handleSaveCard(card, userId) {
  const dto = normalizeCard(card);
  const d = await loadDraft(userId);
  d.card = dto;
  await saveDraft(userId);
  const { lorebook, ...fields } = dto;

  if (d.editing?.id) {
    try {
      let note = "";
      try {
        const old = await spindle.characters.get(d.editing.id, userId);
        if (old) { await pushBackup(d.editing.id, old, userId); note = "Previous version saved; use History to restore it."; }
      } catch (err) { log("warn", `backup failed: ${err.message}`); note = "Warning: could not back up the previous version."; }
      await spindle.characters.update(d.editing.id, fields, userId);
      send({ type: "saved", id: d.editing.id, name: dto.name, updated: true, lorebook: 0, note, noteBad: note.startsWith("Warning") }, userId);
    } catch (err) {
      log("error", `characters.update failed: ${err.message}`);
      send({ type: "save_unavailable", reason: err.message }, userId);
    }
    return;
  }

  if (typeof spindle.characters?.create !== "function") {
    send({ type: "save_unavailable", reason: "this Lumiverse build has no characters.create" }, userId);
    return;
  }
  let bookId = null, note = "";
  if (lorebook.length) {
    if (!can("world_books")) {
      note = "Lorebook not saved: grant the World Books permission to Card Forge in the Extensions panel.";
    } else {
      try {
        const book = await spindle.world_books.create({ name: `${dto.name || "Character"} Lorebook`, description: "Generated by Card Forge" }, userId);
        for (const e of lorebook) {
          await spindle.world_books.entries.create(book.id, { key: e.keys, content: e.content, comment: e.comment, position: 0, selective: false, constant: false }, userId);
        }
        bookId = book.id;
      } catch (err) {
        log("error", `lorebook create failed: ${err.message}`);
        note = `Lorebook not saved: ${err.message}`;
      }
    }
  }
  try {
    const made = await spindle.characters.create({ ...fields, ...(bookId ? { world_book_ids: [bookId] } : {}) }, userId);
    send({ type: "saved", id: made?.id ?? null, name: dto.name, updated: false, lorebook: bookId ? lorebook.length : 0, note }, userId);
  } catch (err) {
    log("error", `characters.create failed: ${err.message}`);
    send({ type: "save_unavailable", reason: err.message }, userId);
  }
}

// ---------- editing existing characters ----------
async function handleListCharacters(userId) {
  try {
    const res = await spindle.characters.list({ limit: 1000, userId });
    const list = (res?.data || []).map((c) => ({ id: c.id, name: str(c.name) || "(unnamed)" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    send({ type: "characters", list }, userId);
  } catch (err) {
    send({ type: "error", message: `Could not list characters: ${err.message}` }, userId);
  }
}
async function handleEditCharacter(id, userId) {
  if (busy.has(userId)) return;
  try {
    const c = await spindle.characters.get(id, userId);
    if (!c) throw new Error("character not found");
    const base = pickCardFields(c);
    base.name = base.name || str(c.name);
    await createDraft(userId, { editing: { id, name: base.name, base } });
    await pushState(userId);
  } catch (err) {
    send({ type: "error", message: `Could not load character: ${err.message}` }, userId);
  }
}

// ---------- backups (undo for revisions) ----------
const backupPath = (id) => `backup-${id}.json`;
async function pushBackup(charId, character, userId) {
  const list = (await readJson(backupPath(charId), userId, [])) || [];
  list.unshift({ ts: Date.now(), name: str(character.name), card: pickCardFields(character) });
  await writeJson(backupPath(charId), list.slice(0, 8), userId);
}
async function handleListBackups(charId, userId) {
  const list = (await readJson(backupPath(charId), userId, [])) || [];
  send({ type: "backups", charId, list: list.map((x) => ({ ts: x.ts, name: x.name })) }, userId);
}
async function handleRestoreBackup(charId, ts, userId) {
  try {
    const list = (await readJson(backupPath(charId), userId, [])) || [];
    const item = list.find((x) => x.ts === ts);
    if (!item) throw new Error("that backup no longer exists");
    const cur = await spindle.characters.get(charId, userId);
    if (cur) await pushBackup(charId, cur, userId); // restoring is itself undoable
    await spindle.characters.update(charId, item.card, userId);
    const d = await loadDraft(userId);
    if (d.editing?.id === charId) { d.editing.base = item.card; d.editing.name = item.card.name || d.editing.name; await saveDraft(userId); }
    send({ type: "restored", name: item.card.name }, userId);
    await handleListBackups(charId, userId);
    await pushState(userId);
  } catch (err) {
    send({ type: "error", message: `Restore failed: ${err.message}` }, userId);
  }
}

// ---------- rewrite a single field ----------
const FIELD_HINTS = {
  alternate_greetings: "Separate greetings with a line containing only ---.",
  lorebook: "Format per entry: title on the first line, then a line 'Keys: a, b, c', then the content; entries separated by a line containing only ---.",
  tags: "Comma-separated tags on one line.",
};
const stripFences = (t) => t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
async function handleRewriteField(key, instruction, values, userId) {
  key = str(key);
  const ins = str(instruction).trim();
  if (!key || !ins) return;
  values = values && typeof values === "object" ? values : {};
  send({ type: "field_busy", key, value: true }, userId);
  const { ac, release } = track(userId);
  try {
    const rest = {};
    for (const [k, v] of Object.entries(values)) if (k !== key) rest[k] = str(v);
    const sys = `You are editing ONE field ("${key}") of a roleplay character card. Rewrite only that field according to the user's instruction and keep it consistent with the rest of the card. Keep {{char}} and {{user}} placeholders. ${FIELD_HINTS[key] || ""} Return ONLY the new text of the field in the same format as the current text: no commentary, no label, no code fences.`;
    const user = `Rest of the card:\n${JSON.stringify(rest, null, 2)}\n\nCurrent "${key}":\n${str(values[key]) || "(empty)"}\n\nInstruction: ${ins}`;
    const out = stripFences(await generateText([{ role: "system", content: sys }, { role: "user", content: user }], userId, ac.signal));
    send({ type: "field", key, value: out }, userId);
  } catch (err) {
    log("error", `rewrite failed: ${err.message}`);
    if (!cancelled(err)) send({ type: "error", message: `Rewrite failed: ${err.message}` }, userId);
  } finally {
    release();
    send({ type: "field_busy", key, value: false }, userId);
  }
}

// ---------- test chat with the finished card ----------
function characterSystem(card) {
  card = card || {};
  const name = str(card.name) || "Character";
  const sub = (t) => str(t).replaceAll("{{char}}", name).replaceAll("{{user}}", "User").replaceAll("<START>", "---");
  const parts = [`You are roleplaying as ${name}. Stay fully in character and write only ${name}'s dialogue, actions and narration. Never speak or act for User.`];
  if (card.system_prompt) parts.push(sub(card.system_prompt));
  if (card.description) parts.push(`## Description\n${sub(card.description)}`);
  if (card.personality) parts.push(`## Personality\n${sub(card.personality)}`);
  if (card.scenario) parts.push(`## Scenario\n${sub(card.scenario)}`);
  if (card.mes_example) parts.push(`## Example dialogue\n${sub(card.mes_example)}`);
  if (card.post_history_instructions) parts.push(sub(card.post_history_instructions));
  return parts.join("\n\n");
}
async function handleTestSend(card, messages, userId) {
  if (busy.has(userId)) return;
  const history = Array.isArray(messages) ? messages.filter((m) => m && (m.role === "user" || m.role === "assistant")).map((m) => ({ role: m.role, content: str(m.content) })) : [];
  if (!history.length) return;
  const { ac, release } = track(userId);
  busy.add(userId); kinds.set(userId, "test"); seq.set(userId, (seq.get(userId) || 0) + 1);
  try {
    const { text, reasoning, aborted } = await streamText(
      [{ role: "system", content: characterSystem(card) + guidanceFor(await presetText(userId), "chat") }, ...history], userId, ac.signal,
      (t, r) => send({ type: "test_stream", content: t, reasoning: r }, userId),
    );
    if (!text && !aborted) throw new Error("empty response from the model");
    send({ type: "test_done", content: text, reasoning }, userId);
  } catch (err) {
    log("error", `test chat failed: ${err.message}`);
    if (cancelled(err)) send({ type: "test_done", content: "", reasoning: "" }, userId);
    else send({ type: "test_error", message: `Test chat failed: ${err.message}` }, userId);
  } finally {
    release();
    busy.delete(userId);
  }
}

// ---------- import ----------
function cardFromImport(c) {
  c = c && typeof c === "object" ? c : {};
  const book = c.character_book?.entries || c.lorebook;
  const lore = Array.isArray(book)
    ? book.map((e) => ({ comment: str(e?.comment || e?.name), keys: strList(e?.keys || e?.key), content: str(e?.content) })).filter((e) => e.content.trim())
    : [];
  return normalizeCard({ ...c, lorebook: lore });
}
async function startImportedDraft(card, userId) {
  const n = cardFromImport(card);
  await createDraft(userId, { card: n, editing: { id: null, name: n.name || "Imported card", base: n } });
  await pushState(userId);
  send({ type: "card", card: n }, userId);
}
async function handleImportText(text, userId) {
  text = str(text).trim().slice(0, 60000);
  if (!text || busy.has(userId)) return;
  const { ac, release } = track(userId);
  markBusy(userId, "import");
  try {
    const raw = await generateText([{ role: "system", content: IMPORT_PROMPT }, { role: "user", content: text }], userId, ac.signal);
    await startImportedDraft(parseCardJson(raw), userId);
  } catch (err) {
    log("error", `import failed: ${err.message}`);
    if (cancelled(err)) send({ type: "notice", message: "Stopped. Nothing was imported." }, userId);
    else send({ type: "error", message: `Import failed: ${err.message}` }, userId);
  } finally {
    release();
    busy.delete(userId);
    send({ type: "busy", value: false }, userId);
  }
}

// ---------- token counts ----------
async function handleCountTokens(texts, userId) {
  texts = texts && typeof texts === "object" ? texts : {};
  const s = await loadSettings(userId);
  const opts = { userId };
  if (s.connectionId) {
    try { const c = await spindle.connections.get(s.connectionId, userId); if (c?.model) opts.model = c.model; } catch {}
  }
  const counts = {};
  let approximate = false;
  await Promise.all(Object.entries(texts).map(async ([k, v]) => {
    const t = str(v);
    if (!t) { counts[k] = 0; return; }
    try {
      const r = await spindle.tokens.countText(t, opts);
      counts[k] = r.total_tokens;
      if (r.approximate) approximate = true;
    } catch {
      counts[k] = Math.ceil(t.length / 4);
      approximate = true;
    }
  }));
  send({ type: "tokens", counts, approximate }, userId);
}

// ---------- routing ----------
spindle.onFrontendMessage(async (raw, userId) => {
  if (!userId) return;
  try {
    switch (raw?.type) {
      case "ready": await clearPending(userId); await pushState(userId); return;
      case "get_settings": await pushSettings(userId); return;
      case "save_settings": {
        const s = sanitizeSettings(raw.settings);
        settingsCache.set(userId, s);
        try { await spindle.userStorage.setJson(SETTINGS_PATH, s, { userId }); }
        catch (err) { log("warn", `settings save failed: ${err.message}`); }
        send({ type: "settings_saved" }, userId);
        return;
      }
      case "send": await handleSend(raw.content, raw.attachmentIds, userId); return;
      case "attach": await handleAttach(raw, userId); return;
      case "detach": await handleDetach(raw.id, userId); return;
      case "retry": await handleRetry(userId); return;
      case "swipe": await handleSwipe(raw.dir, userId); return;
      case "stop": {
        abortAll(userId);
        const n = seq.get(userId);
        setTimeout(() => {
          if (busy.has(userId) && seq.get(userId) === n) { // host ignored the cancel: release the UI anyway
            busy.delete(userId);
            send({ type: "busy", value: false }, userId);
            pushState(userId).catch(() => {});
          }
        }, 4000);
        return;
      }
      case "truncate": await handleTruncate(raw.index, userId); return;
      case "finalize": await handleFinalize(userId, str(raw.presetId)); return;
      case "delete_message": await handleDeleteMessage(raw.index, userId); return;
      case "rewrite_field": await handleRewriteField(raw.key, raw.instruction, raw.values, userId); return;
      case "test_send": await handleTestSend(raw.card, raw.messages, userId); return;
      case "import_card": if (!busy.has(userId)) await startImportedDraft(raw.card, userId); return;
      case "import_text": await handleImportText(raw.text, userId); return;
      case "list_preset_blocks": await handleListPresetBlocks(raw.presetId, userId); return;
      case "preview_preset": await handlePreviewPreset(raw.presetId, raw.blockIds, userId); return;
      case "count_tokens": await handleCountTokens(raw.texts, userId); return;
      case "list_backups": await handleListBackups(str(raw.charId), userId); return;
      case "restore_backup": await handleRestoreBackup(str(raw.charId), raw.ts, userId); return;
      case "list_drafts": await pushState(userId); return;
      case "new_draft":
        if (busy.has(userId)) { send({ type: "error", message: "Wait for the current reply to finish first." }, userId); return; }
        await createDraft(userId); await pushState(userId); return;
      case "switch_draft":
        if (busy.has(userId)) { send({ type: "error", message: "Wait for the current reply to finish first." }, userId); return; }
        await switchDraft(str(raw.id), userId); await pushState(userId); return;
      case "delete_draft":
        if (busy.has(userId)) { send({ type: "error", message: "Wait for the current reply to finish first." }, userId); return; }
        await deleteDraft(str(raw.id), userId); await pushState(userId); return;
      case "save_card": await handleSaveCard(raw.card, userId); return;
      case "list_characters": await handleListCharacters(userId); return;
      case "edit_character": await handleEditCharacter(str(raw.id), userId); return;
      case "reset": await createDraft(userId); await pushState(userId); return;
      default: log("warn", `unknown message type ${raw?.type}`);
    }
  } catch (err) {
    log("error", `handler error: ${err.message}`);
    send({ type: "error", message: err.message }, userId);
  }
});

log("info", "backend ready");
