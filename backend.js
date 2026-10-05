// Card Forge backend. Plain ESM, no build step. `spindle` is a host global.

const INTERVIEW_PROMPT = `You are Card Forge, a collaborative designer of roleplay character cards.
Talk naturally with the user about the character they want. After each message, respond with one to three focused questions or concrete suggestions about whatever is still undecided: identity, appearance, personality and flaws, speech style, backstory, relationship to {{user}}, setting and scenario, the opening message, content boundaries.
Do not ask everything at once. Do not write the whole card unless asked; short draft snippets of single parts are fine when they help. Use {{char}} and {{user}} for names.
When the character feels complete, say so and suggest pressing "Finalize card".`;

const FINALIZE_PROMPT = `Using the conversation below, write the final character card.
Output ONLY one JSON object, no commentary and no code fences, with exactly these keys:
name, description, personality, scenario, first_mes, mes_example, alternate_greetings (array of strings), system_prompt, post_history_instructions, creator_notes, tags (array of strings).
Rules: use {{char}} and {{user}} instead of names where natural. description is detailed prose covering appearance, background and behavior. first_mes is an in-character opening that never speaks or acts for {{user}}. mes_example uses <START> separators and "{{user}}:" / "{{char}}:" lines. Use only what the conversation supports; leave unknown fields as empty strings or empty arrays rather than inventing details.`;

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

// GUESS: the exact request shape of generate.raw. If generation fails, this is
// the one function to fix.
async function generateText(messages, userId) {
  const res = await spindle.generate.raw({ messages, userId });
  const text = extractText(res).trim();
  if (!text) throw new Error("empty response from the model");
  return text;
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

async function handleSend(content, userId) {
  const text = str(content).trim();
  if (!text || busy.has(userId)) return;
  busy.add(userId);
  const d = await loadDraft(userId);
  d.messages.push({ role: "user", content: text });
  send({ type: "busy", value: true }, userId);
  await pushState(userId);
  try {
    const reply = await generateText([{ role: "system", content: INTERVIEW_PROMPT }, ...d.messages], userId);
    d.messages.push({ role: "assistant", content: reply });
    await saveDraft(userId);
  } catch (err) {
    log("error", `send failed: ${err.message}`);
    send({ type: "error", message: `Generation failed: ${err.message}` }, userId);
  } finally {
    busy.delete(userId);
    send({ type: "busy", value: false }, userId);
    await pushState(userId);
  }
}

async function handleFinalize(userId) {
  if (busy.has(userId)) return;
  const d = await loadDraft(userId);
  if (d.messages.length === 0) {
    send({ type: "error", message: "Talk about your character first, then finalize." }, userId);
    return;
  }
  busy.add(userId);
  send({ type: "busy", value: true }, userId);
  try {
    const transcript = d.messages.map((m) => `${m.role === "user" ? "USER" : "DESIGNER"}: ${m.content}`).join("\n\n");
    const raw = await generateText(
      [{ role: "system", content: FINALIZE_PROMPT }, { role: "user", content: transcript }],
      userId,
    );
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

// GUESS: characters.create may not exist on every host. If it is missing or
// fails, the frontend downloads a Character Card V2 JSON instead.
async function handleSaveCard(card, userId) {
  const dto = normalizeCard(card);
  const d = await loadDraft(userId);
  d.card = dto;
  await saveDraft(userId);
  if (typeof spindle.characters?.create !== "function") {
    send({ type: "save_unavailable", reason: "this Lumiverse build has no characters.create" }, userId);
    return;
  }
  try {
    const made = await spindle.characters.create(dto, userId);
    send({ type: "saved", id: made?.id ?? null, name: dto.name }, userId);
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
      case "send": await handleSend(raw.content, userId); return;
      case "finalize": await handleFinalize(userId); return;
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
