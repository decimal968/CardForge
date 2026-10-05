// Card Forge frontend (v0.6). Plain ESM, no build step.
// Lives in a Lumiverse sidebar tab (floating panel fallback). Styled with Lumiverse theme variables.

const ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l1-4 8-8 3 3-8 8z"/><path d="M11 6l3 3"/><path d="M15 14v4M13 16h4"/></svg>';

const SECTIONS = [
  ["Basics", [["name", "Name", 1], ["tags", "Tags (comma-separated)", 1]]],
  ["Character", [["description", "Description", 7], ["personality", "Personality", 4]]],
  ["Scenario and messages", [["scenario", "Scenario", 4], ["first_mes", "First message", 7],
    ["alternate_greetings", "Alternate greetings (separate with a line containing ---)", 4], ["mes_example", "Example dialogue", 7]]],
  ["Lorebook", [["lorebook", "Lorebook entries. Per entry: title on the first line, a line starting with Keys: (comma-separated triggers), then the content. Separate entries with a line containing ---", 8]]],
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
header{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)}
.top{display:flex;align-items:center;gap:8px}
.title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.title b{font-size:15px;letter-spacing:.2px}
.chip{align-self:flex-start;font-size:11px;padding:1px 8px;border-radius:999px;background:var(--pri-t);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.nav button{min-width:0;padding:5px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
main{display:flex;flex-direction:column;flex:1;min-height:0}
button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--border);background:var(--fill);border-radius:calc(var(--r) - 2px);padding:6px 11px}
button:hover:not(:disabled){border-color:var(--pri)}
button:disabled{opacity:.45;cursor:default}
button.ghost{background:transparent;padding:5px 8px;font-size:13px}
button.primary{background:var(--pri);border-color:var(--pri);color:var(--pri-c);font-weight:600}
button.stop,button.danger{background:var(--danger);border-color:var(--danger);color:#fff;font-weight:600}
button.mini{font-size:11.5px;padding:0 8px;background:transparent;color:var(--dim)}
button.mini:hover:not(:disabled){color:var(--text)}
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
.cta{display:flex;gap:8px}.cta button{flex:1}.cta select{flex:0 0 38%}
.composer{display:flex;gap:8px;align-items:flex-end}
.composer textarea{resize:none;min-height:42px;max-height:150px}
.composer button{min-height:42px;min-width:64px}
.pane{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.foot{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--border)}.foot button{flex:1}
.fw{display:flex;flex-direction:column;gap:4px}
.fh{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:12px}
.fh .fl{flex:1;min-width:0}.fh .tk{color:var(--dim);font-size:11.5px;white-space:nowrap}
.rw{display:flex;gap:6px;align-items:center}.rw input{flex:1}
label.f{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}
details.sec{border:1px solid var(--border);border-radius:var(--r);background:var(--fill)}
details.sec>summary{cursor:pointer;padding:9px 12px;font-weight:600;user-select:none}
details.sec>.body{padding:2px 12px 12px;display:flex;flex-direction:column;gap:10px}
h2{margin:6px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim)}
.list{display:flex;flex-direction:column;gap:6px}
.item{display:flex;gap:6px;align-items:stretch}
.item .main{flex:1;text-align:left;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.item .main small{color:var(--dim)}
.item .main.cur{border-color:var(--pri);background:var(--pri-t)}
.item .main span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.note{color:var(--dim);font-size:12.5px}
.total{font-size:12.5px;color:var(--muted);padding:2px 2px}
.preset{border:1px solid var(--border);border-radius:var(--r);padding:10px;display:flex;flex-direction:column;gap:8px}
.toast{position:absolute;left:12px;right:12px;bottom:76px;padding:9px 12px;border-radius:calc(var(--r) - 2px);background:var(--elev);border:1px solid var(--pri);box-shadow:0 6px 24px #0006;font-size:13px;z-index:5}
.toast.bad{border-color:var(--danger)}
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const md = (s) => esc(s || "")
  .replace(/`([^`\n]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const fmtDate = (ts) => { try { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

const loreToText = (arr) => (arr || []).map((e) => `${e.comment || "Entry"}\nKeys: ${(e.keys || []).join(", ")}\n${e.content || ""}`).join("\n---\n");
const textToLore = (t) => t.split(/\n-{3,}\n/).map((blk) => {
  const lines = blk.trim().split("\n");
  const comment = (lines.shift() || "").trim();
  let keys = [];
  if (lines.length && /^keys:/i.test(lines[0])) keys = lines.shift().replace(/^keys:/i, "").split(",").map((s) => s.trim()).filter(Boolean);
  return { comment, keys, content: lines.join("\n").trim() };
}).filter((e) => e.content);

// Character cards embedded in PNG files (tEXt chunk "chara" or "ccv3", base64 JSON).
function pngCardJson(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf);
  if (u[0] !== 0x89 || u[1] !== 0x50) return null;
  const latin = new TextDecoder("latin1");
  const found = {};
  let p = 8;
  while (p + 8 <= u.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]);
    if (type === "tEXt") {
      const data = u.subarray(p + 8, p + 8 + len), z = data.indexOf(0);
      if (z > 0) found[latin.decode(data.subarray(0, z))] = latin.decode(data.subarray(z + 1));
    }
    if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = found.ccv3 || found.chara;
  if (!raw) return null;
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
const unwrapCard = (j) => (j && typeof j === "object" && j.data && typeof j.data === "object" ? j.data : j);

const SCREENS = ["chat", "pick", "set", "card", "drafts", "import", "hist", "test"];

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
      <div class="top"><div class="title"><b>Card Forge</b><span class="chip" id="chip" hidden></span></div>
        <button class="ghost" id="close" ${docked ? "hidden" : ""}>Close</button></div>
      <div class="nav"><button class="ghost" id="drafts">Drafts</button><button class="ghost" id="pick">Characters</button><button class="ghost" id="imp">Import</button>
        <button class="ghost" id="hist" hidden>History</button><button class="ghost" id="gear">Settings</button><button class="ghost" id="new">New</button></div>
    </header>
    <main id="chat">
      <div class="log" id="log"></div>
      <div class="err" id="err" hidden></div>
      <div class="dock">
        <div class="cta"><select id="preset" hidden></select><button id="finalize">Finalize card</button><button id="opencard" hidden>Open card</button></div>
        <div class="composer"><textarea id="input" rows="1" placeholder="Describe your idea..."></textarea><button class="primary" id="send">Send</button></div>
      </div>
    </main>
    <main id="pickview" hidden><div class="pane"><h2>Revise an existing character</h2><input id="q" placeholder="Search characters..."><div class="list" id="plist"></div></div>
      <div class="foot"><button id="pickback">Back</button></div></main>
    <main id="draftsview" hidden><div class="pane"><h2>Your drafts</h2><div class="list" id="dlist"></div></div>
      <div class="foot"><button id="draftsback">Back</button><button class="primary" id="draftnew">New draft</button></div></main>
    <main id="importview" hidden><div class="pane"><h2>Import a card</h2>
      <div class="note">Upload a card file (.png or .json), or paste a character description. The card opens in the editor, and you can keep refining it by chatting.</div>
      <input type="file" id="file" accept=".json,.png,.txt,.md,application/json,image/png,text/plain">
      <h2>Or paste text</h2><textarea id="paste" rows="9" placeholder="Paste a character description, bio, or notes..."></textarea></div>
      <div class="foot"><button id="impback">Back</button><button class="primary" id="impgo">Convert text to card</button></div></main>
    <main id="histview" hidden><div class="pane"><h2>Previous versions</h2><div class="note">Each update saves the version it replaced. Restoring also saves the current version first.</div><div class="list" id="hlist"></div></div>
      <div class="foot"><button id="histback">Back</button></div></main>
    <main id="setview" hidden><div class="pane" id="setfields"></div>
      <div class="foot"><button id="setback">Cancel</button><button id="setreset">Reset prompts</button><button class="primary" id="setsave">Save</button></div></main>
    <main id="cardview" hidden><div class="pane" id="fields"></div>
      <div class="foot"><button id="back">Chat</button><button id="testbtn">Test</button><button id="dl">Download</button><button class="primary" id="save">Save</button></div></main>
    <main id="testview" hidden><div class="log" id="tlog"></div>
      <div class="dock"><div class="composer"><textarea id="tin" rows="1" placeholder="Say something to the character..."></textarea><button class="primary" id="tsend">Send</button></div></div>
      <div class="foot"><button id="tback">Back to card</button><button id="trestart">Restart test</button></div></main>
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
      screen = "chat", cfg = null, errorText = "", characters = null, drafts = [], currentDraft = "", presets = [], activePreset = "",
      backups = null, testMsgs = [], testBusy = false, testLive = { text: "", reasoning: "" }, tokenTimer = 0;
  const thinkOpen = {}, prevVals = {}, fieldBusy = {};

  const mkBtn = (label, fn, cls) => { const b = el("button", cls || "", label); b.onclick = fn; return b; };
  const send = (m) => ctx.sendToBackend(m);

  function toast(text, bad) {
    root.querySelector(".toast")?.remove();
    const t = el("div", "toast" + (bad ? " bad" : ""), text);
    $("app").appendChild(t);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.remove(), 7000);
  }

  function show(name) {
    screen = name;
    for (const s of SCREENS) $(s === "chat" ? "chat" : s + "view").hidden = s !== name;
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
  function copyText(t) { try { navigator.clipboard.writeText(t).then(() => toast("Copied.")); } catch { toast("Copy failed.", true); } }

  function renderChat() {
    const log = $("log");
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    const prev = log.scrollTop;
    log.textContent = "";
    const typing = busy && (busyKind === "reply" || busyKind === "finalize");
    if (!messages.length && !typing) {
      const h = el("div", "hint");
      h.appendChild(el("b", "", editing ? (editing.imported ? `Imported "${editing.name}"` : `Revising "${editing.name}"`) : "Describe your character"));
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
          acts.appendChild(mkBtn("Edit", () => { $("input").value = m.content; send({ type: "truncate", index: i }); $("input").focus(); }));
          if (last) acts.appendChild(mkBtn("Retry", () => send({ type: "retry" })));
        } else {
          acts.appendChild(mkBtn("Copy", () => copyText(m.content)));
          if (last) {
            if (m.swipes > 1) {
              const p = mkBtn("<", () => send({ type: "swipe", dir: -1 })); p.disabled = m.swipe <= 0;
              const n = mkBtn(">", () => send({ type: "swipe", dir: 1 })); n.disabled = m.swipe >= m.swipes - 1;
              acts.append(p, el("span", "sw", `${m.swipe + 1}/${m.swipes}`), n);
            }
            acts.appendChild(mkBtn("New version", () => send({ type: "retry" })));
          }
        }
        acts.appendChild(mkBtn(last && m.role === "assistant" && m.swipes > 1 ? "Delete version" : "Delete", () => send({ type: "delete_message", index: i })));
        row.appendChild(acts);
      }
      log.appendChild(row);
    });
    if (typing) {
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

    const sb = $("send");
    if (busy) { sb.textContent = "Stop"; sb.className = "stop"; sb.disabled = busyKind !== "reply"; }
    else { sb.textContent = "Send"; sb.className = "primary"; sb.disabled = false; }
    $("finalize").textContent = editing ? "Generate updated card" : "Finalize card";
    $("finalize").disabled = busy || messages.length === 0;
    $("opencard").hidden = !card || busy;
    $("chip").hidden = !editing;
    $("chip").textContent = editing ? `${editing.imported ? "Imported" : "Editing"}: ${editing.name}` : "";
    $("hist").hidden = !(editing && editing.id);
    $("impgo").disabled = busy;

    const ps = $("preset");
    ps.hidden = !presets.length;
    ps.textContent = "";
    ps.appendChild(Object.assign(el("option", "", "No style preset"), { value: "" }));
    for (const p of presets) ps.appendChild(Object.assign(el("option", "", p.name), { value: p.id }));
    ps.value = presets.some((p) => p.id === activePreset) ? activePreset : "";
  }

  // ---------- card editor ----------
  const autosize = (t) => { t.style.height = "auto"; if (t.scrollHeight > 0) t.style.height = Math.min(t.scrollHeight + 2, 420) + "px"; };

  function readStrings() {
    const out = {};
    for (const e of root.querySelectorAll("[data-key]")) out[e.dataset.key] = e.value;
    return out;
  }
  function readCard() {
    const out = {};
    for (const [k, v] of Object.entries(readStrings())) {
      out[k] = k === "alternate_greetings" ? v.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean)
        : k === "lorebook" ? textToLore(v) : k === "tags" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
    }
    if (!("lorebook" in out)) out.lorebook = [];
    return out;
  }
  function scheduleTokens() {
    clearTimeout(tokenTimer);
    tokenTimer = setTimeout(() => { if (screen === "card") send({ type: "count_tokens", texts: readStrings() }); }, 700);
  }

  function renderCard() {
    const box = $("fields");
    box.textContent = "";
    const tot = el("div", "total", "Counting tokens...");
    tot.id = "total";
    box.appendChild(tot);
    for (const [title, fields] of SECTIONS) {
      if (title === "Lorebook" && editing?.id) continue;
      const sec = el("details", "sec");
      sec.open = title !== "Advanced";
      sec.appendChild(el("summary", "", title));
      const body = el("div", "body");
      for (const [key, label, rows] of fields) {
        const w = el("div", "fw");
        const head = el("div", "fh");
        head.appendChild(el("span", "fl", label));
        const tk = el("span", "tk"); tk.dataset.k = key;
        head.appendChild(tk);
        const input = rows === 1 ? document.createElement("input") : document.createElement("textarea");
        if (rows > 1) { input.rows = rows; }
        input.dataset.key = key;
        const v = card?.[key];
        input.value = key === "alternate_greetings" ? (v || []).join("\n---\n") : key === "lorebook" ? loreToText(v) : key === "tags" ? (v || []).join(", ") : v || "";
        input.addEventListener("input", () => { if (rows > 1) autosize(input); scheduleTokens(); });
        let rwEl = null;
        if (key !== "name") {
          const rw = el("div", "rw"); rw.hidden = true;
          const ri = document.createElement("input"); ri.placeholder = "How should this change?";
          const rb = mkBtn("Rewrite", () => { rw.hidden = !rw.hidden; if (!rw.hidden) ri.focus(); }, "mini");
          const ub = mkBtn("Undo", () => { if (!(key in prevVals)) return; input.value = prevVals[key]; delete prevVals[key]; ub.hidden = true; if (rows > 1) autosize(input); scheduleTokens(); }, "mini");
          ub.hidden = !(key in prevVals); ub.dataset.undo = key;
          head.append(ub, rb);
          const go = mkBtn("Go", () => {
            const ins = ri.value.trim();
            if (!ins || fieldBusy[key]) return;
            send({ type: "rewrite_field", key, instruction: ins, values: readStrings() });
            ri.value = ""; rw.hidden = true;
          }, "primary");
          ri.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); go.click(); } });
          rw.append(ri, go);
          rwEl = rw;
        }
        w.appendChild(head);
        w.appendChild(input);
        if (rwEl) w.appendChild(rwEl);
        body.appendChild(w);
      }
      sec.appendChild(body);
      box.appendChild(sec);
    }
    if (editing?.id) box.appendChild(el("div", "note", "Lorebook changes aren't applied when revising an existing character. Edit its lorebook in Lumiverse."));
    $("save").textContent = editing?.id ? "Update" : "Save";
    requestAnimationFrame(() => box.querySelectorAll("textarea[data-key]").forEach(autosize));
    scheduleTokens();
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

  // ---------- lists: characters, drafts, history ----------
  function renderPicker() {
    const list = $("plist");
    list.textContent = "";
    if (characters === null) { list.appendChild(el("div", "note", "Loading characters...")); return; }
    const q = $("q").value.trim().toLowerCase();
    const shown = characters.filter((c) => c.name.toLowerCase().includes(q));
    if (!shown.length) list.appendChild(el("div", "note", characters.length ? "No matches." : "No characters found."));
    for (const c of shown.slice(0, 200)) {
      const b = mkBtn(c.name, () => { send({ type: "edit_character", id: c.id }); show("chat"); });
      b.style.textAlign = "left"; b.style.padding = "10px 12px";
      list.appendChild(b);
    }
  }
  function renderDrafts() {
    const list = $("dlist");
    list.textContent = "";
    const items = [...drafts].sort((a, b) => b.updated - a.updated);
    for (const d of items) {
      const row = el("div", "item");
      const main = el("button", "main" + (d.id === currentDraft ? " cur" : ""));
      main.appendChild(el("span", "", d.title || "New card"));
      main.appendChild(el("small", "", (d.id === currentDraft ? "Open now · " : "") + fmtDate(d.updated)));
      main.onclick = () => { if (d.id !== currentDraft) send({ type: "switch_draft", id: d.id }); show("chat"); };
      const del = mkBtn("Delete", () => { send({ type: "delete_draft", id: d.id }); }, "ghost");
      row.append(main, del);
      list.appendChild(row);
    }
    if (!items.length) list.appendChild(el("div", "note", "No drafts yet."));
  }
  function renderHistory() {
    const list = $("hlist");
    list.textContent = "";
    if (backups === null) { list.appendChild(el("div", "note", "Loading...")); return; }
    if (!backups.length) { list.appendChild(el("div", "note", "No previous versions yet. One is saved each time you update this character.")); return; }
    for (const b of backups) {
      const row = el("div", "item");
      const main = el("div", "main"); main.style.border = "1px solid var(--border)"; main.style.borderRadius = "10px";
      main.appendChild(el("span", "", b.name || "(unnamed)")); main.appendChild(el("small", "", fmtDate(b.ts)));
      row.append(main, mkBtn("Restore", () => send({ type: "restore_backup", charId: editing.id, ts: b.ts }), "primary"));
      list.appendChild(row);
    }
  }

  // ---------- test chat ----------
  function renderTest() {
    const log = $("tlog");
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    log.textContent = "";
    if (!testMsgs.length && !testBusy) log.appendChild(Object.assign(el("div", "hint"), { textContent: "Say something to see how the character responds." }));
    testMsgs.forEach((m, i) => {
      const row = el("div", "row " + m.role);
      if (m.reasoning) row.appendChild(thinkBlock("t" + i, m.reasoning, false));
      const b = el("div", "bubble " + m.role); b.innerHTML = md(m.content); row.appendChild(b);
      if (!testBusy && m.role === "assistant" && i === testMsgs.length - 1 && i > 0) {
        const acts = el("div", "acts");
        acts.appendChild(mkBtn("Regenerate", () => { testMsgs.pop(); testRun(); }));
        row.appendChild(acts);
      }
      log.appendChild(row);
    });
    if (testBusy) {
      const row = el("div", "row assistant");
      if (testLive.reasoning) row.appendChild(thinkBlock("tlive", testLive.reasoning, !testLive.text));
      const b = el("div", "bubble assistant");
      if (testLive.text) b.innerHTML = md(testLive.text); else { b.textContent = testLive.reasoning ? "Thinking" : "Writing"; b.classList.add("dots"); }
      row.appendChild(b); log.appendChild(row);
    }
    log.scrollTop = near ? log.scrollHeight : log.scrollTop;
    const s = $("tsend");
    s.textContent = testBusy ? "Stop" : "Send"; s.className = testBusy ? "stop" : "primary";
  }
  function testRun() {
    testBusy = true; testLive = { text: "", reasoning: "" }; renderTest();
    send({ type: "test_send", card: testCard, messages: testMsgs.map((m) => ({ role: m.role, content: m.content })) });
  }
  let testCard = null;
  function testStart() {
    testCard = readCard();
    const sub = (t) => (t || "").replaceAll("{{char}}", testCard.name || "Character").replaceAll("{{user}}", "User");
    testMsgs = testCard.first_mes ? [{ role: "assistant", content: sub(testCard.first_mes), reasoning: "" }] : [];
    testBusy = false; renderTest(); show("test");
  }
  function testSend() {
    if (testBusy) { send({ type: "stop" }); return; }
    const t = $("tin").value.trim();
    if (!t) return;
    $("tin").value = ""; $("tin").style.height = "";
    testMsgs.push({ role: "user", content: t, reasoning: "" });
    testRun();
  }

  // ---------- settings ----------
  const field = (label, input) => { const w = el("label", "f", label); w.appendChild(input); return w; };
  const REASON = [["inherit", "Use my connection's setting"], ["off", "Off"], ["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["max", "Max"]];

  function presetBlock(p) {
    const box = el("div", "preset"); box.dataset.preset = p.id || "";
    const name = document.createElement("input"); name.placeholder = "Preset name (e.g. Short and punchy)"; name.value = p.name || ""; name.dataset.pn = "1";
    const text = document.createElement("textarea"); text.rows = 4; text.placeholder = "Style instructions added to the card-writing prompt"; text.value = p.text || ""; text.dataset.pt = "1";
    box.append(name, text, mkBtn("Delete preset", () => box.remove(), "ghost"));
    return box;
  }
  function renderSettings() {
    const box = $("setfields");
    box.textContent = "";
    if (!cfg) { box.appendChild(el("div", "note", "Loading...")); return; }
    const s = cfg.settings;
    box.appendChild(el("h2", "", "Generation"));
    const sel = document.createElement("select"); sel.id = "s_conn";
    sel.appendChild(Object.assign(el("option", "", "Active / default connection"), { value: "" }));
    for (const c of cfg.connections) sel.appendChild(Object.assign(el("option", "", `${c.name}${c.model ? " (" + c.model + ")" : ""}${c.is_default ? " [default]" : ""}`), { value: c.id }));
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
    box.appendChild(field("Extra card requirements, always applied (language, length, POV...)", ta("s_style", s.styleNotes, 3)));
    box.appendChild(el("h2", "", "Style presets"));
    box.appendChild(el("div", "note", "Named style notes you can pick next to the Finalize button."));
    const pbox = el("div", "list"); pbox.id = "s_presets";
    for (const p of s.presets || []) pbox.appendChild(presetBlock(p));
    box.appendChild(pbox);
    box.appendChild(mkBtn("Add preset", () => pbox.appendChild(presetBlock({ id: "", name: "", text: "" }))));
  }
  function readSettings() {
    const n = (id) => { const v = $(id).value.trim(); return v === "" ? null : Number(v); };
    const r = $("s_reason").value;
    const presetsOut = [...root.querySelectorAll("[data-preset]")].map((b) => ({
      id: b.dataset.preset, name: b.querySelector("[data-pn]").value, text: b.querySelector("[data-pt]").value }));
    return { connectionId: $("s_conn").value || null, temperature: n("s_temp"), maxTokens: n("s_max"),
      reasoningMode: r === "inherit" ? "inherit" : r === "off" ? "off" : "custom", reasoningEffort: r === "inherit" || r === "off" ? "medium" : r,
      interviewPrompt: $("s_int").value, finalizePrompt: $("s_fin").value, styleNotes: $("s_style").value,
      presets: presetsOut, activePreset };
  }

  // ---------- import ----------
  async function importFile(file) {
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".png") || file.type === "image/png") {
        const j = pngCardJson(await file.arrayBuffer());
        if (!j) { toast("No character data found in that PNG.", true); return; }
        send({ type: "import_card", card: unwrapCard(j) });
      } else {
        const text = await file.text();
        let j = null;
        if (name.endsWith(".json") || text.trim().startsWith("{")) { try { j = JSON.parse(text); } catch {} }
        if (j) send({ type: "import_card", card: unwrapCard(j) });
        else send({ type: "import_text", text });
      }
    } catch (err) { toast(`Could not read the file: ${err.message}`, true); }
    $("file").value = "";
  }

  // ---------- wiring ----------
  function sendInput() {
    if (busy) { if (busyKind === "reply") send({ type: "stop" }); return; }
    const text = $("input").value.trim();
    if (!text) return;
    $("input").value = ""; $("input").style.height = "";
    send({ type: "send", content: text });
  }
  const grow = (t, max) => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, max) + "px"; };

  if (!docked) {
    fab.onclick = () => { host.style.display = "block"; fab.style.display = "none"; };
    $("close").onclick = () => { host.style.display = "none"; fab.style.display = ""; };
  }
  const coarse = matchMedia("(pointer: coarse)").matches;
  $("send").onclick = sendInput;
  $("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !coarse) { e.preventDefault(); sendInput(); } });
  $("input").addEventListener("input", () => grow($("input"), 150));
  $("tsend").onclick = testSend;
  $("tin").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !coarse) { e.preventDefault(); testSend(); } });
  $("tin").addEventListener("input", () => grow($("tin"), 120));
  $("tback").onclick = () => show("card");
  $("trestart").onclick = () => { if (!testBusy) testStart(); };
  $("testbtn").onclick = testStart;
  $("preset").onchange = () => { activePreset = $("preset").value; };
  $("finalize").onclick = () => send({ type: "finalize", presetId: $("preset").value });
  $("opencard").onclick = () => { renderCard(); show("card"); };
  $("new").onclick = () => { errorText = ""; show("chat"); send({ type: "new_draft" }); toast("Started a new draft. Your other drafts are under Drafts."); };
  $("drafts").onclick = () => { renderDrafts(); show("drafts"); send({ type: "list_drafts" }); };
  $("draftsback").onclick = () => show("chat");
  $("draftnew").onclick = () => { errorText = ""; show("chat"); send({ type: "new_draft" }); };
  $("pick").onclick = () => { characters = null; $("q").value = ""; renderPicker(); show("pick"); send({ type: "list_characters" }); };
  $("q").addEventListener("input", renderPicker);
  $("pickback").onclick = () => show("chat");
  $("imp").onclick = () => show("import");
  $("impback").onclick = () => show("chat");
  $("file").onchange = () => { const f = $("file").files[0]; if (f) importFile(f); };
  $("impgo").onclick = () => { const t = $("paste").value.trim(); if (!t) { toast("Paste some text first.", true); return; } send({ type: "import_text", text: t }); toast("Converting text into a card..."); };
  $("hist").onclick = () => { if (!editing?.id) return; backups = null; renderHistory(); show("hist"); send({ type: "list_backups", charId: editing.id }); };
  $("histback").onclick = () => show("chat");
  $("gear").onclick = () => { renderSettings(); show("set"); send({ type: "get_settings" }); };
  $("setback").onclick = () => show("chat");
  $("setreset").onclick = () => { if (cfg) { $("s_int").value = cfg.defaults.interviewPrompt; $("s_fin").value = cfg.defaults.finalizePrompt; toast("Prompts reset. Press Save to keep that."); } };
  $("setsave").onclick = () => { if (cfg) send({ type: "save_settings", settings: readSettings() }); };
  $("back").onclick = () => show("chat");
  $("dl").onclick = () => downloadV2(readCard());
  $("save").onclick = () => send({ type: "save_card", card: readCard() });

  const off = ctx.onBackendMessage((msg) => {
    switch (msg?.type) {
      case "state":
        messages = msg.messages || []; card = msg.card || null; editing = msg.editing || null;
        drafts = msg.drafts || drafts; currentDraft = msg.currentDraft || currentDraft; presets = msg.presets || []; activePreset = msg.activePreset || "";
        renderChat(); if (screen === "drafts") renderDrafts(); break;
      case "busy": busy = !!msg.value; busyKind = msg.kind || ""; if (busy) { errorText = ""; live = { text: "", reasoning: "" }; } renderChat(); break;
      case "stream": live = { text: msg.content || "", reasoning: msg.reasoning || "" }; renderChat(); break;
      case "characters": characters = msg.list || []; if (screen === "pick") renderPicker(); break;
      case "backups": backups = msg.list || []; if (screen === "hist") renderHistory(); break;
      case "restored": toast(`Restored "${msg.name || "character"}" to the earlier version.`); break;
      case "settings": cfg = msg; if (screen === "set") renderSettings(); break;
      case "settings_saved": toast("Settings saved."); show("chat"); break;
      case "card": card = msg.card; renderCard(); show("card"); renderChat(); break;
      case "tokens": {
        let total = 0;
        for (const [k, n] of Object.entries(msg.counts || {})) {
          total += n;
          const s = root.querySelector(`.tk[data-k="${k}"]`);
          if (s) s.textContent = n ? `${msg.approximate ? "~" : ""}${n} tok` : "";
        }
        const t = root.getElementById("total");
        if (t) t.textContent = `Total: ${msg.approximate ? "about " : ""}${total} tokens (counts include every field)`;
        break;
      }
      case "field_busy": {
        fieldBusy[msg.key] = !!msg.value;
        const inp = root.querySelector(`[data-key="${msg.key}"]`);
        if (inp) { inp.disabled = !!msg.value; if (msg.value) inp.dataset.old = inp.value; }
        break;
      }
      case "field": {
        const inp = root.querySelector(`[data-key="${msg.key}"]`);
        if (inp) {
          prevVals[msg.key] = inp.dataset.old ?? inp.value;
          inp.value = msg.value;
          if (inp.tagName === "TEXTAREA") autosize(inp);
          const u = root.querySelector(`[data-undo="${msg.key}"]`); if (u) u.hidden = false;
          scheduleTokens();
        }
        break;
      }
      case "test_stream": testLive = { text: msg.content || "", reasoning: msg.reasoning || "" }; renderTest(); break;
      case "test_done": testBusy = false; if (msg.content) testMsgs.push({ role: "assistant", content: msg.content, reasoning: msg.reasoning || "" }); renderTest(); break;
      case "test_error": testBusy = false; renderTest(); toast(msg.message, true); break;
      case "error": errorText = msg.message; if (screen !== "chat") toast(msg.message, true); renderChat(); break;
      case "saved":
        toast(`${msg.updated ? "Updated" : "Saved"} "${msg.name || "character"}"${msg.lorebook ? ` with ${msg.lorebook} lorebook entries` : ""}.${msg.note ? " " + msg.note : ""}`, !!msg.note && !!msg.noteBad || (!msg.updated && !!msg.note));
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
        b.onclick = () => { send({ type: "edit_character", id: st.characterId }); show("chat"); tab.activate(); };
        w.appendChild(b); edTab.root.appendChild(w);
      };
      offEd = ctx.ui.characterEditor.onChange(drawEd);
      drawEd();
    }
  } catch (err) { console.warn("[cardforge] character editor tab unavailable", err); }

  show("chat");
  renderChat();
  send({ type: "ready" });

  return () => {
    off(); try { offEd?.(); } catch {} try { edTab?.destroy(); } catch {} try { tab?.destroy(); } catch {}
    host.remove(); fab?.remove();
  };
}
