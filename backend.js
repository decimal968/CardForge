// Card Forge backend (v0.5). Plain ESM, no build step. `spindle` is a host global.

const DEFAULT_INTERVIEW_PROMPT = `You are Card Forge, a collaborative designer of roleplay character cards.
Talk naturally with the user about the character they want. After each message, respond with one to three focused questions or concrete suggestions about whatever is still undecided: identity, appearance, personality and flaws, speech style, backstory, relationship to {{user}}, setting and scenario, the opening message, content boundaries.
Do not ask everything at once. Do not write the whole card unless asked; short draft snippets of single parts are fine when they help. Use {{char}} and {{user}} for names.
When the character feels complete, say so and suggest pressing "Finalize card".`;

const DEFAULT_FINALIZE_PROMPT = `Using the conversation below, write the final character card.
Output ONLY one JSON object, no commentary and no code fences, with exactly these keys:
name, description, personality, scenario, first_mes, mes_example, alternate_greetings (array of strings), system_prompt, post_history_instructions, creator_notes, tags (array of strings), lorebook (array of objects, each with comment, keys (array of strings) and content).
Rules: lorebook holds world details worth injecting only when mentioned (locations, factions, key people, world rules): 0 to 12 concise entries with 2 to 6 trigger keywords each, or an empty array if the conversation covered none. Use {{char}} and {{user}} instead of names where natural. description is detailed prose covering appearance, background and behavior. first_mes is an in-character opening that never speaks or acts for {{user}}. mes_example uses <START> separators and "{{user}}:" / "{{char}}:" lines. Use only what the conversation supports; leave unknown fields as empty strings or empty arrays rather than inventing details.`;

const editInterviewNote = (card) => `\n\nYou are revising an EXISTING character card, not creating a new one. The current card:\n${JSON.stringify(card, null, 2)}\nHelp the user decide what to change or improve; suggest concrete improvements when useful and keep edits consistent with the existing card. Do not rewrite the whole card unless asked.`;
const editFinalizeNote = (card) => `\n\nThis is an EXISTING card being revised. Current card:\n${JSON.stringify(card, null, 2)}\nOutput the COMPLETE updated card with the same keys. Keep every field the conversation did not change exactly as it is. Always return "lorebook": [].`;

const DRAFT_PATH = "draft.json";
const SETTINGS_PATH = "settings.json";
const drafts = new Map();
const settingsCache = new Map();
const aborts = new Map();
const busy = new Set();

const log = (level, msg) => spindle.log[level](`[cardforge] ${msg}`);
const send = (msg, userId) => spindle.sendToFrontend(msg, userId);
const str = (v) => (typeof v === "string" ? v : "");
const strList = (v) => (Array.isArray(v) ? v.map(str).map((s) => s.trim()).filter(Boolean) : []);
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const can = (p) => (spindle.permissions?.has ? spindle.permissions.has(p) : true);

// ---------- storage ----------
async function loadDraft(userId) {
  if (drafts.has(userId)) return drafts.get(userId);
  let d = null;
  try { d = await spindle.userStorage.getJson(DRAFT_PATH, { fallback: null, userId }); } catch {}
  if (!d || !Array.isArray(d.messages)) d = { messages: [], card: null, editing: null };
  d.editing = d.editing || null;
  drafts.set(userId, d);
  return d;
}
async function saveDraft(userId) {
  try { await spindle.userStorage.setJson(DRAFT_PATH, drafts.get(userId), { userId }); }
  catch (err) { log("warn", `draft save failed: ${err.message}`); }
}

const blankSettings = () => ({
  connectionId: null, interviewPrompt: "", finalizePrompt: "", styleNotes: "", temperature: null, maxTokens: null,
  reasoningMode: "inherit", reasoningEffort: "medium",
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
  };
}
async function pushSettings(userId) {
  const s = await loadSettings(userId);
  let connections = [];
  try {
    const list = await spindle.connections.list(userId);
    connections = list.map((c) => ({ id: c.id, name: c.name, provider: c.provider, model: c.model ?? "", is_default: !!c.is_default }));
  } catch (err) { log("warn", `connections.list failed: ${err.message}`); }
  send({
    type: "settings",
    settings: { ...s, interviewPrompt: s.interviewPrompt.trim() || DEFAULT_INTERVIEW_PROMPT, finalizePrompt: s.finalizePrompt.trim() || DEFAULT_FINALIZE_PROMPT },
    defaults: { interviewPrompt: DEFAULT_INTERVIEW_PROMPT, finalizePrompt: DEFAULT_FINALIZE_PROMPT },
    connections,
  }, userId);
}

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

async function generateText(messages, userId) {
  const s = await loadSettings(userId);
  let res;
  try { res = await spindle.generate.quiet(buildReq(messages, s, userId), userId); }
  catch (err) { throw new Error(`${err?.message || err} [connection=${s.connectionId ? "chosen" : "active/default"}]`); }
  const text = extractText(res).trim();
  if (!text) throw new Error(`empty response from the model [result type: ${typeof res}]`);
  return text;
}

// Streams via quietStream; collects reasoning separately. Falls back to a normal
// call if streaming fails before any token arrives.
async function streamText(messages, userId, signal, onPartial) {
  const s = await loadSettings(userId);
  const req = buildReq(messages, s, userId, signal);
  let text = "", reasoning = "", last = 0;
  try {
    for await (const chunk of spindle.generate.quietStream(req, userId)) {
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
    if (signal.aborted) return { text: text.trim(), reasoning: reasoning.trim(), aborted: true };
    if (!text && !reasoning) return { text: await generateText(messages, userId), reasoning: "", aborted: false };
    throw err;
  }
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

// ---------- messages / swipes ----------
function ensureSwipes(m) {
  if (!Array.isArray(m.swipes) || !m.swipes.length) { m.swipes = [{ content: m.content, reasoning: m.reasoning || "" }]; m.swipe = 0; }
  return m;
}
const view = (d) => d.messages.map((m) => ({
  role: m.role, content: m.content, reasoning: m.reasoning || "",
  swipe: m.swipe || 0, swipes: Array.isArray(m.swipes) ? m.swipes.length : 1,
}));
async function pushState(userId) {
  const d = await loadDraft(userId);
  send({ type: "state", messages: view(d), card: d.card, editing: d.editing ? { id: d.editing.id, name: d.editing.name } : null }, userId);
}

async function runReply(userId, { swipe = false } = {}) {
  const d = await loadDraft(userId);
  const ac = new AbortController();
  aborts.set(userId, ac);
  busy.add(userId);
  send({ type: "busy", value: true, kind: "reply" }, userId);
  try {
    const cfg = await loadSettings(userId);
    let sys = cfg.interviewPrompt.trim() || DEFAULT_INTERVIEW_PROMPT;
    if (d.editing) sys += editInterviewNote(d.editing.base);
    const history = (swipe ? d.messages.slice(0, -1) : d.messages).map((m) => ({ role: m.role, content: m.content }));
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
    send({ type: "error", message: `Generation failed: ${err.message}` }, userId);
  } finally {
    aborts.delete(userId);
    busy.delete(userId);
    send({ type: "busy", value: false }, userId);
    await pushState(userId);
  }
}

async function handleSend(content, userId) {
  const text = str(content).trim();
  if (!text || busy.has(userId)) return;
  const d = await loadDraft(userId);
  d.messages.push({ role: "user", content: text });
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
  d.messages = d.messages.slice(0, index);
  await saveDraft(userId);
  await pushState(userId);
}

async function handleFinalize(userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  if (d.messages.length === 0) {
    send({ type: "error", message: "Talk about your character first, then finalize." }, userId);
    return;
  }
  busy.add(userId);
  send({ type: "busy", value: true, kind: "finalize" }, userId);
  try {
    const transcript = d.messages.map((m) => `${m.role === "user" ? "USER" : "DESIGNER"}: ${m.content}`).join("\n\n");
    const cfg = await loadSettings(userId);
    let sys = cfg.finalizePrompt.trim() || DEFAULT_FINALIZE_PROMPT;
    if (d.editing) sys += editFinalizeNote(d.editing.base);
    if (cfg.styleNotes.trim()) sys += `\n\nAdditional requirements from the user (follow these):\n${cfg.styleNotes.trim()}`;
    const raw = await generateText([{ role: "system", content: sys }, { role: "user", content: transcript }], userId);
    const card = parseCardJson(raw);
    if (d.editing) { card.lorebook = []; if (!card.name) card.name = d.editing.name; }
    d.card = card;
    await saveDraft(userId);
    send({ type: "card", card }, userId);
  } catch (err) {
    log("error", `finalize failed: ${err.message}`);
    send({ type: "error", message: `Could not build the card: ${err.message}` }, userId);
  } finally {
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

  if (d.editing) {
    try {
      await spindle.characters.update(d.editing.id, fields, userId);
      send({ type: "saved", id: d.editing.id, name: dto.name, updated: true, lorebook: 0, note: "" }, userId);
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
    drafts.set(userId, { messages: [], card: null, editing: { id, name: base.name, base } });
    await saveDraft(userId);
    await pushState(userId);
  } catch (err) {
    send({ type: "error", message: `Could not load character: ${err.message}` }, userId);
  }
}

// ---------- routing ----------
spindle.onFrontendMessage(async (raw, userId) => {
  if (!userId) return;
  try {
    switch (raw?.type) {
      case "ready": await pushState(userId); return;
      case "get_settings": await pushSettings(userId); return;
      case "save_settings": {
        const s = sanitizeSettings(raw.settings);
        settingsCache.set(userId, s);
        try { await spindle.userStorage.setJson(SETTINGS_PATH, s, { userId }); }
        catch (err) { log("warn", `settings save failed: ${err.message}`); }
        send({ type: "settings_saved" }, userId);
        return;
      }
      case "send": await handleSend(raw.content, userId); return;
      case "retry": await handleRetry(userId); return;
      case "swipe": await handleSwipe(raw.dir, userId); return;
      case "stop": aborts.get(userId)?.abort(); return;
      case "truncate": await handleTruncate(raw.index, userId); return;
      case "finalize": await handleFinalize(userId); return;
      case "save_card": await handleSaveCard(raw.card, userId); return;
      case "list_characters": await handleListCharacters(userId); return;
      case "edit_character": await handleEditCharacter(str(raw.id), userId); return;
      case "reset": {
        drafts.set(userId, { messages: [], card: null, editing: null });
        await saveDraft(userId);
        await pushState(userId);
        return;
      }
      default: log("warn", `unknown message type ${raw?.type}`);
    }
  } catch (err) {
    log("error", `handler error: ${err.message}`);
    send({ type: "error", message: err.message }, userId);
  }
});

log("info", "backend ready");
