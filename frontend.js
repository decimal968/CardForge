// Card Forge frontend. Plain ESM, no build step.
// Mounts in a Lumiverse sidebar (drawer) tab; falls back to a floating panel if tabs are unavailable.

const FIELDS = [
  ["name", "Name", 1],
  ["description", "Description", 8],
  ["personality", "Personality", 4],
  ["scenario", "Scenario", 4],
  ["first_mes", "First message", 8],
  ["mes_example", "Example dialogue", 8],
  ["alternate_greetings", "Alternate greetings (separate with a line containing ---)", 5],
  ["lorebook", "Lorebook entries. Per entry: title on the first line, then a line starting with Keys: (comma-separated triggers), then the content. Separate entries with a line containing ---", 10],
  ["system_prompt", "System prompt", 3],
  ["post_history_instructions", "Post-history instructions", 3],
  ["creator_notes", "Creator notes", 3],
  ["tags", "Tags (comma-separated)", 1],
];

const CSS = `
:host{all:initial;display:block;height:100%}
*{box-sizing:border-box}
.fab{position:fixed;right:14px;bottom:14px;z-index:2147483000;border:1px solid #3a4a52;background:#12171b;color:#dfe9e6;
  font:600 13px system-ui,sans-serif;padding:10px 14px;border-radius:999px;cursor:pointer;box-shadow:0 4px 18px #0007}
.panel{position:fixed;right:0;bottom:0;z-index:2147483001;width:min(440px,100vw);height:min(680px,100dvh);display:none;flex-direction:column;
  background:#12171b;color:#dfe9e6;border:1px solid #2a363c;border-radius:14px 14px 0 0;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 40px #000a}
.panel.open{display:flex}
.panel.docked{position:static;display:flex;width:100%;height:100%;min-height:460px;border:0;border-radius:0;box-shadow:none}
@media(max-width:520px){.panel:not(.docked){border-radius:0;border:0}}
header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2a363c}
header h1{flex:1;margin:0;font:600 15px Georgia,serif;letter-spacing:.2px}
button{font:inherit;color:inherit;background:#1d262c;border:1px solid #33434b;border-radius:8px;padding:6px 11px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
button.primary{background:#2f6f64;border-color:#3f8b7d;color:#fff}
button.stop{background:#6b2a30;border-color:#8c3a42;color:#fff}
.log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:90%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}
.msg.user{align-self:flex-end;background:#244a44}
.msg.assistant{align-self:flex-start;background:#1b2329;font-family:Georgia,serif}
.hint{color:#8ea3a0;text-align:center;margin:auto;padding:0 20px}
.bar{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #2a363c;align-items:flex-end}
textarea,input,select{width:100%;background:#0c1013;color:inherit;border:1px solid #33434b;border-radius:8px;padding:8px;font:inherit;resize:vertical}
.bar textarea{resize:none;min-height:42px;max-height:140px}
.foot{display:flex;gap:8px;padding:0 12px 10px}
.foot button{flex:1}
.card{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.card label{display:flex;flex-direction:column;gap:4px;color:#9fb4b0;font-size:12px}
.tools{display:flex;gap:6px;margin-top:-6px}.tools.user{align-self:flex-end}.tools.assistant{align-self:flex-start}
.tools button{font-size:12px;padding:2px 9px;background:transparent;color:#8ea3a0;border-color:#2a363c}
.errbox{background:#3a1f22;color:#f0b9bd;border-radius:10px;padding:9px 12px;font-size:13px;user-select:text;white-space:pre-wrap;word-break:break-word}
.toast{margin:0 12px 8px;padding:8px 10px;border-radius:8px;background:#2b2a1a;color:#efe3a4;font-size:13px;display:none}
.toast.show{display:block}.toast.err{background:#3a1f22;color:#f0b9bd}
`;

const ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l1-4 8-8 3 3-8 8z"/><path d="M11 6l3 3"/><path d="M15 14v4M13 16h4"/></svg>';

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
        id: "forge", title: "Card Forge", shortName: "Forge",
        description: "Build a character card by chatting", keywords: ["character", "card", "builder", "lorebook"],
        headerTitle: "Card Forge", iconSvg: ICON,
      });
    }
  } catch (err) { console.warn("[cardforge] drawer tab unavailable, using floating panel", err); tab = null; }
  const docked = !!tab;

  root.innerHTML = `<style>${CSS}</style>
    ${docked ? "" : '<button class="fab" id="fab">Card Forge</button>'}
    <section class="panel ${docked ? "docked" : ""}" id="panel">
      <header><h1>Card Forge</h1><button id="gear">Settings</button><button id="new">New</button>${docked ? "" : '<button id="close">Close</button>'}</header>
      <div id="chat" style="display:contents">
        <div class="log" id="log"></div>
        <div class="toast" id="toast1"></div>
        <div class="bar"><textarea id="input" rows="1" placeholder="Describe your character idea..."></textarea><button class="primary" id="send">Send</button></div>
        <div class="foot"><button id="finalize">Finalize card</button></div>
      </div>
      <div id="setview" style="display:none;flex:1;min-height:0;flex-direction:column">
        <div class="card" id="setfields"></div>
        <div class="toast" id="toast3"></div>
        <div class="foot"><button id="setback">Cancel</button><button id="setreset">Reset prompts</button><button class="primary" id="setsave">Save</button></div>
      </div>
      <div id="cardview" style="display:none;flex:1;min-height:0;flex-direction:column">
        <div class="card" id="fields"></div>
        <div class="toast" id="toast2"></div>
        <div class="foot"><button id="back">Back to chat</button><button id="dl">Download JSON</button><button class="primary" id="save">Save to Lumiverse</button></div>
      </div>
    </section>`;
  if (docked) { tab.root.style.height = "100%"; tab.root.appendChild(host); } else document.body.appendChild(host);
  const $ = (id) => root.getElementById(id);

  let messages = [], busy = false, busyKind = "", partial = "", card = null, view = "chat", cfg = null, errorText = "";

  function toast(text, err) {
    for (const id of ["toast1", "toast2", "toast3"]) { const t = $(id); t.textContent = text; t.className = "toast show" + (err ? " err" : ""); }
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { ["toast1", "toast2", "toast3"].forEach((id) => { $(id).className = "toast"; }); }, 8000);
  }

  function mkBtn(label, fn) { const bt = document.createElement("button"); bt.textContent = label; bt.onclick = fn; return bt; }

  function renderChat() {
    const log = $("log");
    log.textContent = "";
    if (messages.length === 0 && !errorText && !busy) {
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = "Tell me your character idea, even a single sentence. I'll ask questions until it's ready, then press Finalize card.";
      log.appendChild(h);
    }
    messages.forEach((m, i) => {
      const d = document.createElement("div");
      d.className = "msg " + m.role;
      d.textContent = m.content;
      log.appendChild(d);
      if (busy) return;
      const last = i === messages.length - 1;
      const row = document.createElement("div");
      row.className = "tools " + m.role;
      if (m.role === "user") {
        row.appendChild(mkBtn("Edit", () => { $("input").value = m.content; ctx.sendToBackend({ type: "truncate", index: i }); $("input").focus(); }));
        if (last) row.appendChild(mkBtn("Retry", () => ctx.sendToBackend({ type: "retry" })));
      } else if (last) {
        row.appendChild(mkBtn("Regenerate", () => ctx.sendToBackend({ type: "retry" })));
      }
      if (row.childNodes.length) log.appendChild(row);
    });
    if (busy) {
      const d = document.createElement("div");
      d.className = "msg assistant";
      d.textContent = busyKind === "finalize" ? "Writing the card..." : partial || "...";
      log.appendChild(d);
    } else if (errorText) {
      const d = document.createElement("div");
      d.className = "errbox";
      d.textContent = errorText;
      log.appendChild(d);
    }
    log.scrollTop = log.scrollHeight;
    const send = $("send");
    if (busy) {
      send.textContent = "Stop"; send.className = "stop"; send.disabled = busyKind !== "reply";
    } else { send.textContent = "Send"; send.className = "primary"; send.disabled = false; }
    $("finalize").disabled = busy || messages.length === 0;
  }

  function renderCard() {
    const box = $("fields");
    box.textContent = "";
    for (const [key, label, rows] of FIELDS) {
      const wrap = document.createElement("label");
      wrap.textContent = label;
      const el = rows === 1 ? document.createElement("input") : document.createElement("textarea");
      if (rows > 1) el.rows = rows;
      el.dataset.key = key;
      const v = card?.[key];
      el.value = key === "alternate_greetings" ? (v || []).join("\n---\n") : key === "lorebook" ? loreToText(v) : key === "tags" ? (v || []).join(", ") : v || "";
      wrap.appendChild(el);
      box.appendChild(wrap);
    }
  }

  function readCard() {
    const out = {};
    for (const el of root.querySelectorAll("[data-key]")) {
      const k = el.dataset.key, v = el.value;
      out[k] = k === "alternate_greetings" ? v.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean)
        : k === "lorebook" ? textToLore(v)
        : k === "tags" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
    }
    return out;
  }

  function field(label, el) { const w = document.createElement("label"); w.textContent = label; w.appendChild(el); return w; }

  function renderSettings() {
    const box = $("setfields");
    box.textContent = "";
    if (!cfg) { box.textContent = "Loading..."; return; }
    const s = cfg.settings;
    const sel = document.createElement("select");
    sel.id = "s_conn";
    const def = document.createElement("option");
    def.value = ""; def.textContent = "Active / default connection";
    sel.appendChild(def);
    for (const c of cfg.connections) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.name}${c.model ? " (" + c.model + ")" : ""}${c.is_default ? " [default]" : ""}`;
      sel.appendChild(o);
    }
    sel.value = s.connectionId || "";
    box.appendChild(field("Connection profile", sel));
    const num = (id, val, ph, step) => { const i = document.createElement("input"); i.id = id; i.type = "number"; i.step = step; i.placeholder = ph; i.value = val ?? ""; return i; };
    box.appendChild(field("Temperature (blank = preset default)", num("s_temp", s.temperature, "e.g. 0.9", "0.05")));
    box.appendChild(field("Max response tokens (blank = 8000)", num("s_max", s.maxTokens, "e.g. 8000", "1")));
    const ta = (id, val, rows) => { const t = document.createElement("textarea"); t.id = id; t.rows = rows; t.value = val || ""; return t; };
    box.appendChild(field("Interviewer prompt (how the chat assistant behaves)", ta("s_int", s.interviewPrompt, 10)));
    box.appendChild(field("Card-writing prompt (used when you press Finalize)", ta("s_fin", s.finalizePrompt, 10)));
    box.appendChild(field("Extra card requirements (added to the card-writing prompt: language, length, POV, format...)", ta("s_style", s.styleNotes, 4)));
  }

  function readSettings() {
    const n = (id) => { const v = $(id).value.trim(); return v === "" ? null : Number(v); };
    return { connectionId: $("s_conn").value || null, temperature: n("s_temp"), maxTokens: n("s_max"),
      interviewPrompt: $("s_int").value, finalizePrompt: $("s_fin").value, styleNotes: $("s_style").value };
  }

  function setView(v) {
    view = v;
    $("chat").style.display = v === "chat" ? "contents" : "none";
    $("cardview").style.display = v === "card" ? "flex" : "none";
    $("setview").style.display = v === "settings" ? "flex" : "none";
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

  function sendInput() {
    if (busy) { if (busyKind === "reply") ctx.sendToBackend({ type: "stop" }); return; }
    const text = $("input").value.trim();
    if (!text) return;
    $("input").value = "";
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
    $("fab").onclick = () => { $("panel").classList.add("open"); $("fab").style.display = "none"; };
    $("close").onclick = () => { $("panel").classList.remove("open"); $("fab").style.display = ""; };
  }
  $("send").onclick = sendInput;
  $("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendInput(); } });
  $("finalize").onclick = () => ctx.sendToBackend({ type: "finalize" });
  $("new").onclick = async () => { if (await confirmNew()) { card = null; setView("chat"); ctx.sendToBackend({ type: "reset" }); } };
  $("back").onclick = () => setView("chat");
  $("gear").onclick = () => { setView("settings"); renderSettings(); ctx.sendToBackend({ type: "get_settings" }); };
  $("setback").onclick = () => setView("chat");
  $("setreset").onclick = () => {
    if (!cfg) return;
    $("s_int").value = cfg.defaults.interviewPrompt; $("s_fin").value = cfg.defaults.finalizePrompt;
    toast("Prompts reset to defaults. Press Save to keep that.");
  };
  $("setsave").onclick = () => { if (cfg) ctx.sendToBackend({ type: "save_settings", settings: readSettings() }); };
  $("dl").onclick = () => downloadV2(readCard());
  $("save").onclick = () => ctx.sendToBackend({ type: "save_card", card: readCard() });

  const off = ctx.onBackendMessage((msg) => {
    switch (msg?.type) {
      case "state": messages = msg.messages || []; card = msg.card || card; renderChat(); break;
      case "busy": busy = !!msg.value; busyKind = msg.kind || ""; if (busy) { errorText = ""; partial = ""; } renderChat(); break;
      case "stream": partial = msg.content || ""; renderChat(); break;
      case "settings": cfg = msg; if (view === "settings") renderSettings(); break;
      case "settings_saved": toast("Settings saved."); setView("chat"); break;
      case "card": card = msg.card; renderCard(); setView("card"); break;
      case "error": errorText = msg.message; if (view !== "chat") toast(msg.message, true); renderChat(); break;
      case "saved": toast(`Saved "${msg.name || "character"}" to Lumiverse${msg.lorebook ? ` with ${msg.lorebook} lorebook entries` : ""}.${msg.note ? " " + msg.note : ""}`, !!msg.note); break;
      case "save_unavailable":
        toast(`Couldn't save directly (${msg.reason}). Downloaded a card file instead; import it in Lumiverse.`, true);
        downloadV2(readCard());
        break;
    }
  });
  renderChat();
  ctx.sendToBackend({ type: "ready" });

  return () => { off(); try { tab?.destroy(); } catch {} host.remove(); };
}
