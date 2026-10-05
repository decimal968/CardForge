// Card Forge backend. Plain ESM, no build step. `spindle` is a host global.

const DEFAULT_INTERVIEW_PROMPT = `You are Card Forge, a collaborative designer of roleplay character cards.
Talk naturally with the user about the character they want. After each message, respond with one to three focused questions or concrete suggestions about whatever is still undecided: identity, appearance, personality and flaws, speech style, backstory, relationship to {{user}}, setting and scenario, the opening message, content boundaries.
Do not ask everything at once. Do not write the whole card unless asked; short draft snippets of single parts are fine when they help. Use {{char}} and {{user}} for names.
When the character feels complete, say so and suggest pressing "Finalize card".`;

const DEFAULT_FINALIZE_PROMPT = `Using the conversation below, write the final character card.
Output ONLY one JSON object, no commentary and no code fences, with exactly these keys:
name, description, personality, scenario, first_mes, mes_example, alternate_greetings (array of strings), system_prompt, post_history_instructions, creator_notes, tags (array of strings), lorebook (array of objects, each with comment, keys (array of strings) and content).
Rules: lorebook holds world details worth injecting only when mentioned (locations, factions, key people, world rules): 0 to 12 concise entries with 2 to 6 trigger keywords each, or an empty array if the conversation covered none. use {{char}} and {{user}} instead of names where natural. description is detailed prose covering appearance, background and behavior. first_mes is an in-character opening that never speaks or acts for {{user}}. mes_example uses <START> separators and "{{user}}:" / "{{char}}:" lines. Use only what the conversation supports; leave unknown fields as empty strings or empty arrays rather than inventing details.`;

const DRAFT_PATH = "draft.json";
const drafts = new Map();

const log = (level, msg) => spindle.log[level](`[cardforge] ${msg}`);
const send = (msg, userId) => spindle.sendToFrontend(msg, userId);

async function loadDraft(userId) {
  if (drafts.has(userId)) return drafts.get(userId);
  let d = null;
  try { d = await spindle.userStorage.getJson(DRAFT_PATH, { fallback: null, userId }); } catch {}
  if (!d || !Array.isArray(d.messages)) d = { messages: [], card: null };
  drafts.set(userId, d);
  return d;
}

async function saveDraft(userId) {
  try { await spindle.userStorage.setJson(DRAFT_PATH, drafts.get(userId), { userId }); }
  catch (err) { log("warn", `draft save failed: ${err.message}`); }
}

function extractText(res) {
  if (typeof res === "string") return res;
  if (!res) return "";
  if (typeof res.content === "string") return res.content;
  if (typeof res.text === "string") return res.text;
  if (typeof res.message?.content === "string") return res.message.content;
  if (typeof res.choices?.[0]?.message?.content === "string") return res.choices[0].message.content;
  if (Array.isArray(res.content)) return res.content.map((p) => p?.text ?? "").join("");
  return "";
}

const SETTINGS_PATH = "settings.json";
const settingsCache = new Map();
const blankSettings = () => ({
  connectionId: null, interviewPrompt: "", finalizePrompt: "", styleNotes: "", temperature: null, maxTokens: null,
});

async function loadSettings(userId) {
  if (settingsCache.has(userId)) return settingsCache.get(userId);
  let s = null;
  try { s = await spindle.userStorage.getJson(SETTINGS_PATH, { fallback: null, userId }); } catch {}
  s = { ...blankSettings(), ...(s && typeof s === "object" ? s : {}) };
  settingsCache.set(userId, s);
  return s;
}

const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function sanitizeSettings(x) {
  x = x && typeof x === "object" ? x : {};
  const clean = (v, def) => (str(v).trim() === def.trim() ? "" : str(v));
  return {
    connectionId: str(x.connectionId) || null,
    interviewPrompt: clean(x.interviewPrompt, DEFAULT_INTERVIEW_PROMPT),
    finalizePrompt: clean(x.finalizePrompt, DEFAULT_FINALIZE_PROMPT),
    styleNotes: str(x.styleNotes),
    temperature: numOrNull(x.temperature),
    maxTokens: numOrNull(x.maxTokens) ? Math.round(x.maxTokens) : null,
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
    settings: {
      ...s,
      interviewPrompt: s.interviewPrompt.trim() || DEFAULT_INTERVIEW_PROMPT,
      finalizePrompt: s.finalizePrompt.trim() || DEFAULT_FINALIZE_PROMPT,
    },
    defaults: { interviewPrompt: DEFAULT_INTERVIEW_PROMPT, finalizePrompt: DEFAULT_FINALIZE_PROMPT },
    connections,
  }, userId);
}

// Uses spindle.generate.quiet (documented: the host resolves provider, model and
// preset from the connection profile). connection_id picks a specific profile;
// without it the user's active connection is used.
function buildParams(s) {
  const parameters = { max_tokens: s.maxTokens || 8000 };
  if (s.temperature !== null) parameters.temperature = s.temperature;
  return parameters;
}

async function generateText(messages, userId) {
  const s = await loadSettings(userId);
  const parameters = buildParams(s);
  const req = { messages, parameters, userId };
  if (s.connectionId) req.connection_id = s.connectionId;
  let res;
  try {
    res = await spindle.generate.quiet(req, userId);
  } catch (err) {
    const sent = `connection=${s.connectionId ? "chosen" : "active/default"}`;
    throw new Error(`${err?.message || err} [${sent}]`);
  }
  const text = extractText(res).trim();
  if (!text) throw new Error(`empty response from the model [result type: ${typeof res}]`);
  return text;
}


const aborts = new Map();

// Streams a reply (documented quietStream). Falls back to a normal call if
// streaming fails before any token arrives.
async function streamText(messages, userId, signal, onPartial) {
  const s = await loadSettings(userId);
  const req = { messages, parameters: buildParams(s), userId, signal };
  if (s.connectionId) req.connection_id = s.connectionId;
  let acc = "", last = 0;
  try {
    for await (const chunk of spindle.generate.quietStream(req, userId)) {
      if (chunk.type === "token" && chunk.token) {
        acc += chunk.token;
        const now = Date.now();
        if (now - last > 120) { last = now; onPartial(acc); }
      } else if (chunk.type === "done" && !acc && chunk.content) acc = chunk.content;
    }
  } catch (err) {
    if (signal.aborted) return { text: acc.trim(), aborted: true };
    if (!acc) return { text: await generateText(messages, userId), aborted: false };
    throw err;
  }
  onPartial(acc);
  return { text: acc.trim(), aborted: false };
}

const str = (v) => (typeof v === "string" ? v : "");
const strList = (v) => (Array.isArray(v) ? v.map(str).map((s) => s.trim()).filter(Boolean) : []);

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

async function pushState(userId) {
  const d = await loadDraft(userId);
  send({ type: "state", messages: d.messages, card: d.card }, userId);
}

const busy = new Set();

async function runReply(userId) {
  const d = await loadDraft(userId);
  const ac = new AbortController();
  aborts.set(userId, ac);
  busy.add(userId);
  send({ type: "busy", value: true, kind: "reply" }, userId);
  try {
    const cfg = await loadSettings(userId);
    const sys = cfg.interviewPrompt.trim() || DEFAULT_INTERVIEW_PROMPT;
    const { text, aborted } = await streamText(
      [{ role: "system", content: sys }, ...d.messages], userId, ac.signal,
      (t) => send({ type: "stream", content: t }, userId),
    );
    if (!text && !aborted) throw new Error("empty response from the model");
    if (text) d.messages.push({ role: "assistant", content: text });
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

// Retry after a failure (last message is the user's) or regenerate the last reply.
async function handleRetry(userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  if (d.messages.length && d.messages[d.messages.length - 1].role === "assistant") d.messages.pop();
  if (!d.messages.length) return;
  await saveDraft(userId);
  await runReply(userId);
}

// Edit: drop the message at `index` and everything after it; the frontend
// puts its text back in the input box.
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
    if (cfg.styleNotes.trim()) sys += `\n\nAdditional requirements from the user (follow these):\n${cfg.styleNotes.trim()}`;
    const raw = await generateText([{ role: "system", content: sys }, { role: "user", content: transcript }], userId);
    d.card = parseCardJson(raw);
    await saveDraft(userId);
    send({ type: "card", card: d.card }, userId);
  } catch (err) {
    log("error", `finalize failed: ${err.message}`);
    send({ type: "error", message: `Could not build the card: ${err.message}` }, userId);
  } finally {
    busy.delete(userId);
    send({ type: "busy", value: false }, userId);
  }
}

// characters.create is documented (permission: characters). If it ever fails,
// the frontend downloads a Character Card V2 JSON instead.
async function handleSaveCard(card, userId) {
  const dto = normalizeCard(card);
  const d = await loadDraft(userId);
  d.card = dto;
  await saveDraft(userId);
  if (typeof spindle.characters?.create !== "function") {
    send({ type: "save_unavailable", reason: "this Lumiverse build has no characters.create" }, userId);
    return;
  }
  const can = (p) => (spindle.permissions?.has ? spindle.permissions.has(p) : true);
  const { lorebook, ...fields } = dto;
  let bookId = null, note = "";
  if (lorebook.length) {
    if (!can("world_books")) {
      note = "Lorebook not saved: grant the World Books permission to Card Forge in the Extensions panel.";
    } else {
      try {
        const book = await spindle.world_books.create(
          { name: `${dto.name || "Character"} Lorebook`, description: "Generated by Card Forge" }, userId);
        for (const e of lorebook) {
          await spindle.world_books.entries.create(book.id, {
            key: e.keys, content: e.content, comment: e.comment, position: 0, selective: false, constant: false,
          }, userId);
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
    send({ type: "saved", id: made?.id ?? null, name: dto.name, lorebook: bookId ? lorebook.length : 0, note }, userId);
  } catch (err) {
    log("error", `characters.create failed: ${err.message}`);
    send({ type: "save_unavailable", reason: err.message }, userId);
  }
}

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
      case "finalize": await handleFinalize(userId); return;
      case "retry": await handleRetry(userId); return;
      case "stop": aborts.get(userId)?.abort(); return;
      case "truncate": await handleTruncate(raw.index, userId); return;
      case "save_card": await handleSaveCard(raw.card, userId); return;
      case "reset": {
        drafts.set(userId, { messages: [], card: null });
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
