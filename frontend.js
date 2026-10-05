// Card Forge frontend (v0.5). Plain ESM, no build step.
// Lives in a Lumiverse sidebar tab (floating panel fallback). Styled with Lumiverse theme variables.

const ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l1-4 8-8 3 3-8 8z"/><path d="M11 6l3 3"/><path d="M15 14v4M13 16h4"/></svg>';

const SECTIONS = [
  ["Basics", [["name", "Name", 1], ["tags", "Tags (comma-separated)", 1]]],
  ["Character", [["description", "Description", 7], ["personality", "Personality", 4]]],
  ["Scenario and messages", [["scenario", "Scenario", 4], ["first_mes", "First message", 7],
    ["alternate_greetings", "Alternate greetings (separate with a line containing ---)", 4], ["mes_example", "Example dialogue", 7]]],
  ["Lorebook", [["lorebook", "One entry per block: title on the first line, a line starting with Keys: (comma-separated triggers), then the content. Separate entries with a line containing ---", 8]]],
  ["Advanced", [["system_prompt", "System prompt", 3], ["post_history_instructions", "Post-history instructions", 3], ["creator_notes", "Creator notes", 3]]],
];

const CSS = `
:host{all:initial;display:block;height:100%;
  --bg:var(--lumiverse-bg,#13161b);--elev:var(--lumiverse-bg-elevated,#1a1f26);--text:var(--lumiverse-text,#e8ecef);
  --muted:var(--lumiverse-text-muted,#a9b3bb);--dim:var(--lumiverse-text-dim,#7f8a93);--border:var(--lumiverse-border,rgba(255,255,255,.12));
  --pri:var(--lumiverse-primary,#7d8cf8);--pri-t:var(--lumiverse-primary-020,rgba(125,140,248,.2));--pri-c:var(--lumiverse-primary-contrast,#fff);
  --fill:var(--lumiverse-fill-subtle,rgba(255,255,255,.05));--danger:var(--lumiverse-danger,#e5636d);--r:var(--lumiverse-radius,12px);
  font-family:var(--lumiverse-font-family,system-ui,sans-serif);font-size:14px;line-height:1.5;color:var(--text)}
*{box-sizing:border-box}
[hidden]{display:none!important}
.app{display:flex;flex-direction:column;height:100%;min-height:440px;position:relative}
header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.title{flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px}
.title b{font-size:15px;letter-spacing:.2px}
.chip{align-self:flex-start;font-size:11px;padding:1px 8px;border-radius:999px;background:var(--pri-t);color:var(--text);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
main{display:flex;flex-direction:column;flex:1;min-height:0}
button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--border);background:var(--fill);border-radius:calc(var(--r) - 2px);padding:6px 11px}
button:hover:not(:disabled){border-color:var(--pri)}
button:disabled{opacity:.45;cursor:default}
button.ghost{background:transparent;padding:5px 10px;font-size:13px}
button.primary{background:var(--pri);border-color:var(--pri);color:var(--pri-c);font-weight:600}
button.stop{background:var(--danger);border-color:var(--danger);color:#fff;font-weight:600}
textarea,input,select{width:100%;font:inherit;color:var(--text);background:var(--fill);border:1px solid var(--border);border-radius:calc(var(--r) - 2px);padding:8px 10px;outline:none}
textarea{resize:vertical}
textarea:focus,input:focus,select:focus{border-color:var(--pri)}
select option{background:var(--elev);color:var(--text)}
.log{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:14px}
.hint{margin:auto;max-width:300px;text-align:center;color:var(--dim)}
.hint b{display:block;color:var(--muted);margin-bottom:6px;font-size:15px}
.row{display:flex;flex-direction:column;gap:5px;max-width:92%}
.row.user{align-self:flex-end;align-items:flex-end}.row.assistant{align-self:flex-start;align-items:flex-start}
.bubble{padding:9px 13px;border-radius:var(--r);white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}
.bubble.user{background:var(--pri-t);border:1px solid var(--pri)}
.bubble.assistant{background:var(--fill);border:1px solid var(--border)}
.bubble code{font-family:var(--lumiverse-font-mono,monospace);font-size:12.5px;background:var(--fill);padding:1px 5px;border-radius:5px}
.bubble em{color:var(--lumiverse-prose-italic,var(--muted))}
.dots::after{content:"...";animation:b 1s steps(4) infinite}
@keyframes b{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
details.think{font-size:12.5px;color:var(--muted);max-width:100%}
details.think summary{cursor:pointer;user-select:none;color:var(--dim)}
details.think .tt{margin-top:4px;padding:7px 10px;border-left:2px solid var(--border);white-space:pre-wrap;max-height:240px;overflow:auto}
.acts{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.acts button{font-size:12px;padding:1px 8px;background:transparent;color:var(--dim);border-color:transparent}
.acts button:hover:not(:disabled){color:var(--text);border-color:var(--border)}
.acts .sw{font-size:12px;color:var(--dim);min-width:34px;text-align:center}
.err{margin:0 12px 8px;padding:9px 12px;border-radius:calc(var(--r) - 2px);background:color-mix(in srgb,var(--danger) 18%,transparent);border:1px solid var(--danger);font-size:13px;user-select:text;white-space:pre-wrap;word-break:break-word}
.dock{padding:8px 12px 12px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px}
.cta{display:flex;gap:8px}.cta button{flex:1}
.composer{display:flex;gap:8px;align-items:flex-end}
.composer textarea{resize:none;min-height:42px;max-height:150px}
.composer button{min-height:42px;min-width:64px}
.pane{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.foot{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--border)}.foot button{flex:1}
label.f{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}
details.sec{border:1px solid var(--border);border-radius:var(--r);background:var(--fill)}
details.sec>summary{cursor:pointer;padding:9px 12px;font-weight:600;user-select:none}
details.sec>.body{padding:2px 12px 12px;display:flex;flex-direction:column;gap:10px}
h2{margin:6px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim)}
.list{display:flex;flex-direction:column;gap:6px}
.list button{text-align:left;padding:10px 12px}
.note{color:var(--dim);font-size:12.5px}
.toast{position:absolute;left:12px;right:12px;bottom:76px;padding:9px 12px;border-radius:calc(var(--r) - 2px);background:var(--elev);border:1px solid var(--pri);box-shadow:0 6px 24px #0006;font-size:13px;z-index:5}
.toast.bad{border-color:var(--danger)}
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const md = (s) => esc(s || "")
  .replace(/`([^`\n]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

const loreToText = (arr) => (arr || []).map((e) => `${e.comment || "Entry"}\nKeys: ${(e.keys || []).join(", ")}\n${e.content || ""}`).join("\n---\n");
const textToLore = (t) => t.split(/\n-{3,}\n/).map((blk) => {
  const lines = blk.trim().split("\n");
  const comment = (lines.shift() || "").trim();
  let keys = [];
  if (lines.length && /^keys:/i.test(lines[0])) keys = lines.shift().replace(/^keys:/i, "").split(",").map((s) => s.trim()).filter(Boolean);
  return { comment, keys, content: lines.join("\n").trim() };
}).filter((e) => e.content);

export function setup(ctx) {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });

  let tab = null;
  try {
    if (typeof ctx.ui?.registerDrawerTab === "function") {
      tab = ctx.ui.registerDrawerTab({
        id: "forge", title: "Card Forge", shortName: "Forge", description: "Build or revise a character card by chatting",
        keywords: ["character", "card", "builder", "lorebook"], headerTitle: "Card Forge", iconSvg: ICON,
      });
    }
  } catch (err) { console.warn("[cardforge] drawer tab unavailable, using floating panel", err); tab = null; }
  const docked = !!tab;

  root.innerHTML = `<style>${CSS}</style>
  <div class="app" id="app">
    <header>
      <div class="title"><b>Card Forge</b><span class="chip" id="chip" hidden></span></div>
      <button class="ghost" id="pick">Characters</button><button class="ghost" id="gear">Settings</button><button class="ghost" id="new">New</button>
      <button class="ghost" id="close" ${docked ? "hidden" : ""}>Close</button>
    </header>
    <main id="chat">
      <div class="log" id="log"></div>
      <div class="err" id="err" hidden></div>
      <div class="dock">
        <div class="cta"><button id="finalize">Finalize card</button><button id="opencard" hidden>Open last card</button></div>
        <div class="composer"><textarea id="input" rows="1" placeholder="Describe your idea..."></textarea><button class="primary" id="send">Send</button></div>
      </div>
    </main>
    <main id="pickview" hidden>
      <div class="pane"><h2>Revise an existing character</h2><input id="q" placeholder="Search characters..."><div class="list" id="plist"></div></div>
      <div class="foot"><button id="pickback">Back</button></div>
    </main>
    <main id="setview" hidden>
      <div class="pane" id="setfields"></div>
      <div class="foot"><button id="setback">Cancel</button><button id="setreset">Reset prompts</button><button class="primary" id="setsave">Save</button></div>
    </main>
    <main id="cardview" hidden>
      <div class="pane" id="fields"></div>
      <div class="foot"><button id="back">Chat</button><button id="dl">Download</button><button class="primary" id="save">Save card</button></div>
    </main>
  </div>`;

  let fab = null;
  if (docked) { tab.root.style.height = "100%"; tab.root.appendChild(host); }
  else {
    host.style.cssText = "position:fixed;right:0;bottom:0;width:min(440px,100vw);height:min(680px,100dvh);z-index:2147483001;display:none;background:var(--lumiverse-bg,#13161b);border:1px solid var(--lumiverse-border,#333);border-radius:14px 14px 0 0;overflow:hidden";
    fab = document.createElement("button");
    fab.textContent = "Card Forge";
    fab.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483000;padding:10px 14px;border-radius:999px;cursor:pointer";
    document.body.append(host, fab);
  }
  const $ = (id) => root.getElementById(id);

  let messages = [], busy = false, busyKind = "", live = { text: "", reasoning: "" }, card = null, editing = null,
      screen = "chat", cfg = null, errorText = "", characters = null;
  const thinkOpen = {};

  function toast(text, bad) {
    root.querySelector(".toast")?.remove();
    const t = el("div", "toast" + (bad ? " bad" : ""), text);
    $("app").appendChild(t);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.remove(), 7000);
  }

  function show(name) {
    screen = name;
    $("chat").hidden = name !== "chat";
    $("pickview").hidden = name !== "pick";
    $("setview").hidden = name !== "set";
    $("cardview").hidden = name !== "card";
  }

  // ---------- chat ----------
  function thinkBlock(key, text, open) {
    const d = el("details", "think");
    d.open = key in thinkOpen ? thinkOpen[key] : open;
    d.appendChild(el("summary", "", "Thinking"));
    d.appendChild(el("div", "tt", text));
    d.addEventListener("toggle", () => { thinkOpen[key] = d.open; });
    return d;
  }

  function copyText(t) {
    try { navigator.clipboard.writeText(t).then(() => toast("Copied.")); } catch { toast("Copy failed.", true); }
  }

  function renderChat() {
    const log = $("log");
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    const prev = log.scrollTop;
    log.textContent = "";
    if (!messages.length && !busy) {
      const h = el("div", "hint");
      h.appendChild(el("b", "", editing ? `Revising "${editing.name}"` : "Describe your character"));
      h.appendChild(document.createTextNode(editing
        ? "Tell me what to change, or ask for ideas to improve it. When you're done, generate the updated card."
        : "Even one sentence is enough. I'll ask questions until it's ready, then you can finalize the card."));
      log.appendChild(h);
    }
    messages.forEach((m, i) => {
      const last = i === messages.length - 1;
      const row = el("div", "row " + m.role);
      if (m.role === "assistant" && m.reasoning) row.appendChild(thinkBlock("m" + i, m.reasoning, false));
      const b = el("div", "bubble " + m.role);
      b.innerHTML = md(m.content);
      row.appendChild(b);
      if (!busy) {
        const acts = el("div", "acts");
        if (m.role === "user") {
          acts.appendChild(mkBtn("Edit", () => { $("input").value = m.content; ctx.sendToBackend({ type: "truncate", index: i }); $("input").focus(); }));
          if (last) acts.appendChild(mkBtn("Retry", () => ctx.sendToBackend({ type: "retry" })));
        } else {
          acts.appendChild(mkBtn("Copy", () => copyText(m.content)));
          if (last) {
            if (m.swipes > 1) {
              const prevB = mkBtn("<", () => ctx.sendToBackend({ type: "swipe", dir: -1 })); prevB.disabled = m.swipe <= 0;
              const nextB = mkBtn(">", () => ctx.sendToBackend({ type: "swipe", dir: 1 })); nextB.disabled = m.swipe >= m.swipes - 1;
              acts.append(prevB, el("span", "sw", `${m.swipe + 1}/${m.swipes}`), nextB);
            }
            acts.appendChild(mkBtn("New version", () => ctx.sendToBackend({ type: "retry" })));
          }
        }
        row.appendChild(acts);
      }
      log.appendChild(row);
    });
    if (busy) {
      const row = el("div", "row assistant");
      if (busyKind === "reply" && live.reasoning) row.appendChild(thinkBlock("live", live.reasoning, !live.text));
      const b = el("div", "bubble assistant");
      if (busyKind === "finalize") { b.textContent = "Writing the card"; b.classList.add("dots"); }
      else if (live.text) b.innerHTML = md(live.text);
      else { b.textContent = live.reasoning ? "Thinking" : "Writing"; b.classList.add("dots"); }
      row.appendChild(b);
      log.appendChild(row);
    }
    log.scrollTop = near ? log.scrollHeight : prev;

    const err = $("err");
    err.hidden = !errorText || busy;
    err.textContent = errorText;

    const send = $("send");
    if (busy) { send.textContent = "Stop"; send.className = "stop"; send.disabled = busyKind !== "reply"; }
    else { send.textContent = "Send"; send.className = "primary"; send.disabled = false; }
    $("finalize").textContent = editing ? "Generate updated card" : "Finalize card";
    $("finalize").disabled = busy || messages.length === 0;
    $("opencard").hidden = !card || busy;
    $("chip").hidden = !editing;
    $("chip").textContent = editing ? `Editing: ${editing.name}` : "";
  }

  function mkBtn(label, fn) { const b = el("button", "", label); b.onclick = fn; return b; }

  // ---------- card editor ----------
  function autosize(t) { t.style.height = "auto"; if (t.scrollHeight > 0) t.style.height = Math.min(t.scrollHeight + 2, 420) + "px"; }

  function renderCard() {
    const box = $("fields");
    box.textContent = "";
    for (const [title, fields] of SECTIONS) {
      if (title === "Lorebook" && editing) continue;
      const sec = el("details", "sec");
      sec.open = title !== "Advanced";
      sec.appendChild(el("summary", "", title));
      const body = el("div", "body");
      for (const [key, label, rows] of fields) {
        const w = el("label", "f", label);
        const input = rows === 1 ? document.createElement("input") : document.createElement("textarea");
        if (rows > 1) { input.rows = rows; input.addEventListener("input", () => autosize(input)); }
        input.dataset.key = key;
        const v = card?.[key];
        input.value = key === "alternate_greetings" ? (v || []).join("\n---\n") : key === "lorebook" ? loreToText(v) : key === "tags" ? (v || []).join(", ") : v || "";
        w.appendChild(input);
        body.appendChild(w);
      }
      sec.appendChild(body);
      box.appendChild(sec);
    }
    if (editing) box.appendChild(el("div", "note", "Lorebook changes aren't applied when revising an existing character. Edit its lorebook in Lumiverse."));
    $("save").textContent = editing ? "Update character" : "Save card";
    requestAnimationFrame(() => box.querySelectorAll("textarea").forEach(autosize));
  }

  function readCard() {
    const out = {};
    for (const e of root.querySelectorAll("[data-key]")) {
      const k = e.dataset.key, v = e.value;
      out[k] = k === "alternate_greetings" ? v.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean)
        : k === "lorebook" ? textToLore(v) : k === "tags" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
    }
    if (!("lorebook" in out)) out.lorebook = [];
    return out;
  }

  function downloadV2(c) {
    const { lorebook, ...rest } = c;
    const data = { ...rest, extensions: {}, character_version: "1.0", creator: "" };
    if (lorebook && lorebook.length) {
      data.character_book = {
        name: `${c.name || "Character"} Lorebook`, description: "", scan_depth: 4, token_budget: 512, recursive_scanning: false, extensions: {},
        entries: lorebook.map((e, i) => ({ id: i, keys: e.keys, secondary_keys: [], content: e.content, comment: e.comment, enabled: true,
          insertion_order: i, case_sensitive: false, constant: false, selective: false, position: "before_char", priority: 10, extensions: {} })),
      };
    }
    const json = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `${(c.name || "character").replace(/[^\w-]+/g, "_")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- character picker ----------
  function renderPicker() {
    const list = $("plist");
    list.textContent = "";
    if (characters === null) { list.appendChild(el("div", "note", "Loading characters...")); return; }
    const q = $("q").value.trim().toLowerCase();
    const shown = characters.filter((c) => c.name.toLowerCase().includes(q));
    if (!shown.length) list.appendChild(el("div", "note", characters.length ? "No matches." : "No characters found."));
    for (const c of shown.slice(0, 200)) {
      list.appendChild(mkBtn(c.name, () => { ctx.sendToBackend({ type: "edit_character", id: c.id }); show("chat"); }));
    }
  }

  // ---------- settings ----------
  const field = (label, input) => { const w = el("label", "f", label); w.appendChild(input); return w; };
  const REASON = [["inherit", "Use my connection's setting"], ["off", "Off"], ["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["max", "Max"]];

  function renderSettings() {
    const box = $("setfields");
    box.textContent = "";
    if (!cfg) { box.appendChild(el("div", "note", "Loading...")); return; }
    const s = cfg.settings;
    box.appendChild(el("h2", "", "Generation"));
    const sel = document.createElement("select"); sel.id = "s_conn";
    sel.appendChild(Object.assign(el("option", "", "Active / default connection"), { value: "" }));
    for (const c of cfg.connections) {
      sel.appendChild(Object.assign(el("option", "", `${c.name}${c.model ? " (" + c.model + ")" : ""}${c.is_default ? " [default]" : ""}`), { value: c.id }));
    }
    sel.value = s.connectionId || "";
    box.appendChild(field("Connection profile", sel));
    const rs = document.createElement("select"); rs.id = "s_reason";
    for (const [v, l] of REASON) rs.appendChild(Object.assign(el("option", "", l), { value: v }));
    rs.value = s.reasoningMode === "inherit" ? "inherit" : s.reasoningMode === "off" ? "off" : s.reasoningEffort;
    box.appendChild(field("Thinking / reasoning", rs));
    const num = (id, val, ph, step) => { const i = document.createElement("input"); Object.assign(i, { id, type: "number", step, placeholder: ph, value: val ?? "" }); return i; };
    box.appendChild(field("Temperature (blank = preset default)", num("s_temp", s.temperature, "e.g. 0.9", "0.05")));
    box.appendChild(field("Max response tokens (blank = 8000)", num("s_max", s.maxTokens, "e.g. 8000", "1")));
    box.appendChild(el("h2", "", "Prompts"));
    const ta = (id, val, rows) => { const t = document.createElement("textarea"); Object.assign(t, { id, rows, value: val || "" }); return t; };
    box.appendChild(field("Interviewer prompt (how the chat assistant behaves)", ta("s_int", s.interviewPrompt, 9)));
    box.appendChild(field("Card-writing prompt (used on Finalize)", ta("s_fin", s.finalizePrompt, 9)));
    box.appendChild(field("Extra card requirements (language, length, POV, format...)", ta("s_style", s.styleNotes, 4)));
  }

  function readSettings() {
    const n = (id) => { const v = $(id).value.trim(); return v === "" ? null : Number(v); };
    const r = $("s_reason").value;
    return { connectionId: $("s_conn").value || null, temperature: n("s_temp"), maxTokens: n("s_max"),
      reasoningMode: r === "inherit" ? "inherit" : r === "off" ? "off" : "custom", reasoningEffort: r === "inherit" || r === "off" ? "medium" : r,
      interviewPrompt: $("s_int").value, finalizePrompt: $("s_fin").value, styleNotes: $("s_style").value };
  }

  // ---------- actions ----------
  function sendInput() {
    if (busy) { if (busyKind === "reply") ctx.sendToBackend({ type: "stop" }); return; }
    const text = $("input").value.trim();
    if (!text) return;
    $("input").value = ""; $("input").style.height = "";
    ctx.sendToBackend({ type: "send", content: text });
  }

  async function confirmNew() {
    const msg = "The current conversation and draft will be cleared.";
    if (typeof ctx.ui?.showConfirm === "function") {
      try { return (await ctx.ui.showConfirm({ title: "Start a new card?", message: msg, variant: "warning", confirmLabel: "Clear" })).confirmed; } catch {}
    }
    return confirm("Start a new card? " + msg);
  }

  if (!docked) {
    fab.onclick = () => { host.style.display = "block"; fab.style.display = "none"; };
    $("close").onclick = () => { host.style.display = "none"; fab.style.display = ""; };
  }
  $("send").onclick = sendInput;
  const coarse = matchMedia("(pointer: coarse)").matches;
  $("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !coarse) { e.preventDefault(); sendInput(); } });
  $("input").addEventListener("input", () => { const t = $("input"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 150) + "px"; });
  $("finalize").onclick = () => ctx.sendToBackend({ type: "finalize" });
  $("opencard").onclick = () => { renderCard(); show("card"); };
  $("new").onclick = async () => { if (await confirmNew()) { card = null; errorText = ""; show("chat"); ctx.sendToBackend({ type: "reset" }); } };
  $("pick").onclick = () => { characters = null; $("q").value = ""; renderPicker(); show("pick"); ctx.sendToBackend({ type: "list_characters" }); };
  $("q").addEventListener("input", renderPicker);
  $("pickback").onclick = () => show("chat");
  $("gear").onclick = () => { renderSettings(); show("set"); ctx.sendToBackend({ type: "get_settings" }); };
  $("setback").onclick = () => show("chat");
  $("setreset").onclick = () => { if (cfg) { $("s_int").value = cfg.defaults.interviewPrompt; $("s_fin").value = cfg.defaults.finalizePrompt; toast("Prompts reset. Press Save to keep that."); } };
  $("setsave").onclick = () => { if (cfg) ctx.sendToBackend({ type: "save_settings", settings: readSettings() }); };
  $("back").onclick = () => show("chat");
  $("dl").onclick = () => downloadV2(readCard());
  $("save").onclick = () => ctx.sendToBackend({ type: "save_card", card: readCard() });

  const off = ctx.onBackendMessage((msg) => {
    switch (msg?.type) {
      case "state": messages = msg.messages || []; card = msg.card || null; editing = msg.editing || null; renderChat(); break;
      case "busy": busy = !!msg.value; busyKind = msg.kind || ""; if (busy) { errorText = ""; live = { text: "", reasoning: "" }; } renderChat(); break;
      case "stream": live = { text: msg.content || "", reasoning: msg.reasoning || "" }; renderChat(); break;
      case "characters": characters = msg.list || []; if (screen === "pick") renderPicker(); break;
      case "settings": cfg = msg; if (screen === "set") renderSettings(); break;
      case "settings_saved": toast("Settings saved."); show("chat"); break;
      case "card": card = msg.card; renderCard(); show("card"); renderChat(); break;
      case "error": errorText = msg.message; if (screen !== "chat") toast(msg.message, true); renderChat(); break;
      case "saved":
        toast(`${msg.updated ? "Updated" : "Saved"} "${msg.name || "character"}"${msg.lorebook ? ` with ${msg.lorebook} lorebook entries` : ""}.${msg.note ? " " + msg.note : ""}`, !!msg.note);
        break;
      case "save_unavailable":
        toast(`Couldn't save directly (${msg.reason}). Downloaded a card file instead; import it in Lumiverse.`, true);
        downloadV2(readCard());
        break;
    }
  });

  // Button inside the native character editor to revise that character here.
  let edTab = null, offEd = null;
  try {
    if (docked && typeof ctx.ui?.registerCharacterEditorTab === "function") {
      edTab = ctx.ui.registerCharacterEditorTab({ id: "forge-edit", title: "Card Forge" });
      const drawEd = () => {
        edTab.root.replaceChildren();
        const st = ctx.ui.characterEditor.getState();
        if (!st.open || !st.characterId) return;
        const w = el("div"); w.style.cssText = "padding:14px;display:flex;flex-direction:column;gap:10px;color:var(--lumiverse-text)";
        w.appendChild(el("div", "", "Revise this character by chatting with Card Forge. Save any changes in the editor first."));
        const b = el("button", "", "Improve with Card Forge");
        b.style.cssText = "padding:9px 12px;border-radius:10px;cursor:pointer;border:1px solid var(--lumiverse-primary);background:var(--lumiverse-primary);color:var(--lumiverse-primary-contrast,#fff);font-weight:600";
        b.onclick = () => { ctx.sendToBackend({ type: "edit_character", id: st.characterId }); show("chat"); tab.activate(); };
        w.appendChild(b); edTab.root.appendChild(w);
      };
      offEd = ctx.ui.characterEditor.onChange(drawEd);
      drawEd();
    }
  } catch (err) { console.warn("[cardforge] character editor tab unavailable", err); }

  show("chat");
  renderChat();
  ctx.sendToBackend({ type: "ready" });

  return () => {
    off(); try { offEd?.(); } catch {} try { edTab?.destroy(); } catch {} try { tab?.destroy(); } catch {}
    host.remove(); fab?.remove();
  };
}
