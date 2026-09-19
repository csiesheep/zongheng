// The game page (play.html): setup, lobby, table and result, picked by the
// query string the landing page (index.html, landing.js) sends here:
// ?play a new solo game, ?resume the saved one, ?create=1 a new room,
// ?room=ABCD a room to join or return to. The bar's return link goes back to
// the landing at any time: a solo game is saved in this browser, a room seat
// is kept for this tab. Solo mode runs the engine and the bot right here;
// rooms reuse the same renderers on the view the Durable Object sends.
//
// Plain on purpose: the look is to be redesigned; this is the play flow.
import * as E from "./shared/engine.js";
import * as B from "./shared/bots.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";

const LANGS = { en, "zh-Hant": zh };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ---------- language and names ----------
let lang = "en", S = en;
const t = (key, p = {}) => String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), S) ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));
const sideName = (s) => t(`sides.${E.SIDES[s]}`);
const spaceName = (id) => (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh);
const regionName = (r) => (lang === "en" ? E.REGIONS[r].en : E.REGIONS[r].zh);
const stateName = (s) => (lang === "en" ? E.STATES[s].en : E.STATES[s].zh);
const cardName = (id) => (id === E.JIUDING ? (lang === "en" ? "The Nine Cauldrons" : "九鼎") : lang === "en" ? E.CARD[id].en : E.CARD[id].zh);
const cardText = (id) => (id === E.JIUDING ? (lang === "en" ? "4 ops; 5 if all of it lands in the Three Jin or Zhou. Then it passes face down." : "4 點;全部用在三晉或周室視為 5。用後蓋著交給對手。") : lang === "en" ? CARD_EN[id] ?? E.CARD[id].text : E.CARD[id].text);
const sep = () => (lang === "en" ? ", " : "、");
const mandateText = (m) => (m > 0 ? `${sideName(0)} +${m}` : m < 0 ? `${sideName(1)} +${-m}` : "0");
const list = (ids, f) => ids.map(f).join(sep());

function setLang(l) {
  lang = LANGS[l] ? l : "en";
  S = LANGS[lang];
  store.set("zh.lang", lang);
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "Zongheng 縱橫" : "縱橫 Zongheng";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  $("chatIn").placeholder = t("lobby.say");
  renderSetup();
  if (game.st) { render(); if (game.st.winner != null) renderOver(); }
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));

// ---------- views ----------
// The page's whole colour follows the side: the setup screen re-skins by
// whichever side is picked (Qin black, Chu lacquer red, Random parchment);
// once seated, the table and result screens follow the seat instead.
function paintBody(view) {
  document.body.classList.remove("setup-qin", "setup-chu", "setup-random", "side-qin", "side-chu");
  if (view === "setup") document.body.classList.add("setup-" + setup.side);
  else if ((view === "table" || view === "over") && !game.spectator) document.body.classList.add(game.me === 0 ? "side-qin" : "side-chu");
}
function show(view) {
  for (const v of ["setup", "lobby", "table", "over"]) $(v).hidden = v !== view;
  window.scrollTo(0, 0);
  paintBody(view);
}
// The landing is its own page. Going back never loses anything: the solo game
// is saved on every move, and a room keeps this tab's seat (the bot covers it
// after the grace period until the tab returns).
const toLanding = () => { location.href = "./"; };
$("btnBack").onclick = toLanding;
$("btnHome").onclick = toLanding;
$("btnAgain").onclick = () => (game.room ? show("lobby") : show("setup"));
$("btnBoard").onclick = () => { show("table"); render(); };

// ---------- setup ----------
const setup = { side: store.get("zh.side", "chu"), level: store.get("zh.level", "normal") };
function seg(el, items, value, onPick) {
  el.innerHTML = "";
  for (const [v, label] of items) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.setAttribute("aria-pressed", String(v === value));
    b.onclick = () => onPick(v);
    el.appendChild(b);
  }
}
// A picture tile per side (art/ui/qin.jpg, chu.jpg), plus a plain "random"
// tile — the selected one gets a thick border and full opacity, the way the
// C2 setup mockups (C2_SetupQin/Setup/SetupRandom) show all three at once.
function renderSideTiles() {
  const el = $("sideTiles"); el.innerHTML = "";
  const pick = (v) => { setup.side = v; store.set("zh.side", v); renderSetup(); };
  for (const v of ["qin", "chu", "random"]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = `tile ${v}`; b.setAttribute("aria-pressed", String(setup.side === v));
    const glyph = v === "qin" ? "秦" : v === "chu" ? "楚" : "?";
    const tname = v === "random" ? t("setup.random") : t(`sides.${v}`);
    const tag = v === "random" ? t("setup.randomTag") : t(`side.${v}.headline`);
    b.innerHTML = (v !== "random" ? `<img src="art/ui/${v}.jpg" alt="">` : "") +
      `<span class="tile-info"><span class="tg" lang="zh-Hant">${esc(glyph)}</span><span class="tname">${esc(tname)}</span><span class="ttag">${esc(tag)}</span></span>`;
    b.onclick = () => pick(v);
    el.appendChild(b);
  }
}
function renderSetup() {
  renderSideTiles();
  seg($("segLevel"), [["easy", t("setup.easy")], ["normal", t("setup.normal")], ["hard", t("setup.hard")]], setup.level, (v) => { setup.level = v; store.set("zh.level", v); renderSetup(); });
  $("setupDesc").textContent = t(`setup.desc.${setup.side}`);
  if (!$("setup").hidden) paintBody("setup");
}
$("setupName").value = store.get("zh.name", "");
$("setupName").addEventListener("input", () => store.set("zh.name", $("setupName").value.trim()));
$("btnStart").onclick = startSolo;

// ---------- the solo game ----------
const game = { st: null, me: 0, level: "normal", rng: null, ui: null, botLine: "", botName: "", room: false, spectator: false };
// Per-tab: the reconnect token, so two tabs in one browser are two players.
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
const freshUi = (card = null) => ({ card, use: null, order: "opsFirst", pair: null, points: [], target: null, picks: [], opsUse: null, err: "" });

function startSolo() {
  game.room = false; game.spectator = false;
  game.me = setup.side === "random" ? (Math.random() < 0.5 ? 0 : 1) : setup.side === "qin" ? 0 : 1;
  game.level = setup.level;
  game.st = E.createGame(E.randomSeed(), {});
  game.rng = E.makeRng(E.randomSeed());
  game.ui = freshUi();
  game.botLine = ""; game.seenLog = 0;
  game.botName = S.names[E.SIDES[1 - game.me]][0];
  game.auto = new URLSearchParams(location.search).has("auto");
  $("logBody").hidden = true;
  show("table"); render(); botLoop();
}
// A solo game is kept in this browser so a reload, or a phone that drops the
// tab, does not lose an hour of play.
const SAVE = "zh.solo";
function saveSolo() {
  if (game.room || !game.st) return;
  if (game.st.winner != null) { try { localStorage.removeItem(SAVE); } catch {} return; }
  store.set(SAVE, JSON.stringify({ st: game.st, me: game.me, level: game.level, rng: game.rng.getState(), seenLog: game.seenLog || 0 }));
}
function loadSolo() {
  try { const s = JSON.parse(store.get(SAVE, "null")); return s && s.st && s.st.winner == null ? s : null; } catch { return null; }
}
function resumeSolo() {
  const s = loadSolo();
  if (!s) return;
  Object.assign(game, { room: false, spectator: false, st: s.st, me: s.me, level: s.level, rng: E.makeRng(0), ui: freshUi(), botLine: "", seenLog: s.seenLog, auto: false });
  game.rng.setState(s.rng);
  game.botName = S.names[E.SIDES[1 - game.me]][0];
  show("table"); render(); botLoop();
}
function humanAct(action) {
  if (game.spectator) return;
  // Everything logged after this point is "what happened since you last acted".
  game.seenLog = game.st.logSeq || 0;
  if (game.room) { send({ type: "act", action }); game.ui = freshUi(); render(); return; }
  try { game.st = E.apply(game.st, { ...action, side: game.me }); }
  catch (e) { game.ui.err = e.message; render(); return; }
  game.ui = freshUi();
  saveSolo();
  render();
  botLoop();
}
let botTimer = 0;
function botLoop() {
  clearTimeout(botTimer);
  if (game.room) return;
  const st = game.st;
  if (st.winner != null) { saveSolo(); renderOver(); return; }
  // `?auto` (a development aid) lets the bot play the human seat too, so a
  // whole game can be watched in the client.
  const need = E.mustAct(st);
  const bot = need.includes(1 - game.me) ? 1 - game.me : game.auto && need.includes(game.me) ? game.me : null;
  if (bot == null) return;
  botTimer = setTimeout(() => {
    const a = B.decide(E.view(game.st, bot), bot, game.level, game.rng);
    if (!a) return;
    try { game.st = E.apply(game.st, a); } catch (e) { console.error(e); return; }
    if (bot !== game.me) game.botLine = describeAction(a);
    saveSolo();
    render();
    botLoop();
  }, game.auto ? 120 : 700);
}
function describeAction(a) {
  if (a.type === "headline") return `${game.botName}: ${t("prompt.headline")}`;
  if (a.type === "choose") return `${game.botName}: …`;
  return `${game.botName}: ${cardName(a.card)} · ${t(`useNames.${a.use || "event"}`)}${a.pair ? ` + ${cardName(a.pair)}` : ""}`;
}

// ---------- rendering ----------
function render() {
  // The whole page's accent (buttons, pressed hand card, the block below the
  // map) follows whichever court you sit in; paintBody() sets this once the
  // seat is known (see show()). A spectator gets the neutral default.
  if (!$("table").hidden) paintBody("table");
  // In a room the state on hand is already this seat's view.
  const v = game.room ? game.st : E.view(game.st, game.me);
  $("barMid").textContent = `${t("tracks.turn")} ${v.turn} · ${game.spectator ? "" : sideName(game.me)}`;
  renderTracks(v);
  if (game.spectator) {
    renderMap({ ...v, winner: 0 }); // nothing lit
    $("prompt").textContent = ""; $("sheet").innerHTML = ""; $("hand").innerHTML = "";
    renderLog(v);
    return;
  }
  renderMap(v);
  renderPromptAndSheet(v);
  renderHand(v);
  renderLog(v);
}

function renderTracks(v) {
  const w = v.weariness;
  const boxes = [5, 4, 3, 2, 1].map((k) => `<span class="box${k <= 2 ? " bad" : ""}${k === w ? " on" : ""}">${t("weariness." + k)}</span>`).join("");
  const reformBoxes = (side) => [1, 2, 3, 4, 5, 6].map((k) => `<span class="box${k <= v.reform[side] ? " on" : ""}">${k}</span>`).join("");
  const seals = Object.keys(v.seals).map(stateName).join(" ") || "–";
  const mie = Object.keys(v.mie).map(stateName).join(" ") || "–";
  const pos = Math.max(2, Math.min(98, 50 - (v.mandate / E.MANDATE_TO_WIN) * 50));
  const phase = v.phase === "setup" ? "" : ` · ${t("tracks.round")} ${v.round}${t("tracks.of")}${v.rounds}`;
  $("tracks").innerHTML =
    `<div class="wide"><b>${t("tracks.turn")} ${v.turn}</b> · ${v.era ? t("eras." + v.era) : ""}${phase}</div>` +
    `<div class="wide">${t("tracks.mandate")} <b>${mandateText(v.mandate)}</b><div class="mandate"><span class="mid"></span><span class="dot" style="left:${pos}%"></span></div></div>` +
    `<div class="wide">${t("tracks.weariness")} <span class="boxes">${boxes}</span></div>` +
    `<div class="q">${sideName(0)} ${t("tracks.reform")} <span class="boxes">${reformBoxes(0)}</span></div>` +
    `<div class="c">${sideName(1)} ${t("tracks.reform")} <span class="boxes">${reformBoxes(1)}</span></div>` +
    `<div class="q">${t("tracks.mie")}: ${mie} · ${v.handCounts[0]} ♠</div>` +
    `<div class="c">${t("tracks.seals")}: ${seals} · ${v.handCounts[1]} ♠</div>` +
    // Per state: how many of its spaces Qin controls, and who holds the capital.
    `<div class="wide states">${Object.entries(E.STATES).map(([id, s]) => {
      const sp = E.spacesOfState(id), qc = sp.filter((x) => E.controller(v, x) === 0).length, cap = E.controller(v, s.capital);
      return `<span class="${v.mie[id] ? "q" : v.seals[id] ? "c" : ""}">${stateName(id)} ${qc}/${sp.length}${cap === 1 ? " ◎" + sideName(1) : cap === 0 ? " ◎" + sideName(0) : ""}</span>`;
    }).join(" ")}</div>` +
    `<div class="wide">${t("tracks.jiuding")}: ${sideName(v.jiuding.holder)}${v.jiuding.faceDown ? ` (${t("tracks.faceDown")})` : ""}</div>`;
}

const REGION_BOX = { north: [60, 0, 298, 70], west: [0, 72, 104, 278], jin: [108, 72, 142, 160], zhou: [108, 236, 50, 34], east: [254, 72, 104, 160], south: [108, 274, 250, 76] };
const NODE_POS = {
  dai: [70, 26], zhongshan: [150, 26], ji: [230, 26], liaodong: [306, 26],
  yiqu: [6, 84], hangu: [54, 116], guanzhong: [6, 150], hanzhong: [6, 220], bashu: [54, 252],
  hedong: [114, 80], handan: [196, 80], shangdang: [155, 118], yiyang: [114, 156], daliang: [196, 156], xinzheng: [155, 196],
  luoyi: [110, 238], linzi: [262, 80], jimo: [308, 114], ju: [262, 148], xue: [308, 182], song: [262, 196],
  qianzhong: [112, 312], chencai: [170, 280], ying: [170, 314], huaisi: [240, 280], wuyue: [300, 314],
};

// What tapping the map does right now: the lit spaces, the picks so far, the cost badges.
function placementTrial(v, side, points) {
  const trial = E.clone(v); trial.log = [];
  let spent = 0;
  for (const id of points) { spent += E.placeCost(trial, side, id); E.place(trial, side, id, 1); }
  return { trial, spent };
}
function roomFor(p, v, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(v, id) - E.infOf(v, id)[p.side]);
  return r - (counts[id] || 0);
}
function currentMode(v) {
  const none = { lit: new Set(), picked: {}, costs: null, onTap() {} };
  const me = game.me, ui = game.ui;
  if (v.winner != null) return none;
  const L = E.legal(v, me);
  const placing = (ops, points) => {
    const { trial, spent } = placementTrial(v, me, points);
    const left = ops - spent;
    const lit = new Set(), costs = {};
    for (const sp of E.SPACES) {
      const cost = E.placeCost(trial, me, sp.id);
      if (cost <= left && E.canPlaceAt(trial, me, sp.id) && E.infOf(trial, sp.id)[me] < E.capOf(trial, sp.id)) { lit.add(sp.id); costs[sp.id] = cost; }
    }
    const picked = {}; for (const id of points) picked[id] = (picked[id] || 0) + 1;
    return { lit, picked, costs, onTap: (id) => { points.push(id); render(); } };
  };
  if (L.kind === "pending") {
    const p = L.pending;
    if (p.kind === "points") {
      const counts = {}; for (const id of ui.picks) counts[id] = (counts[id] || 0) + 1;
      const lit = new Set(ui.picks.length < p.n ? p.options.filter((id) => roomFor(p, v, id, counts) > 0) : []);
      return { lit, picked: counts, costs: null, onTap: (id) => { ui.picks.push(id); render(); } };
    }
    if (p.kind === "ops" && ui.opsUse === "place") return placing(p.ops, ui.points);
    if (p.kind === "ops" && (ui.opsUse === "campaign" || ui.opsUse === "lobby")) {
      const ids = ui.opsUse === "campaign" ? p.options.campaignTargets : p.options.lobbyTargets.map((x) => x.id);
      return { lit: new Set(ids), picked: ui.target ? { [ui.target]: 1 } : {}, costs: null, onTap: (id) => { ui.target = id; render(); } };
    }
    return none;
  }
  if (L.kind !== "action" || !ui.card || !ui.use) return none;
  const info = cardInfo(L, ui.card);
  if (!info) return none;
  if (ui.use === "place" && !(info.enemy && ui.order === "eventFirst")) return placing(info.ops, ui.points);
  if (ui.use === "campaign" || ui.use === "lobby") {
    const u = info.uses[ui.use];
    const ids = u ? (ui.use === "campaign" ? u.targets : u.targets.map((x) => x.id)) : [];
    return { lit: new Set(ids), picked: ui.target ? { [ui.target]: 1 } : {}, costs: null, onTap: (id) => { ui.target = id; render(); } };
  }
  return none;
}
// Which colour a card belongs to: Qin (q), Chu (c), neutral (n) or a scoring
// card (s). Used to tint both the hand tile and the sheet panel below it.
function cardSide(id) {
  if (id === E.JIUDING) return "n";
  const c = E.CARD[id];
  return c.scoring ? "s" : c.side === 0 ? "q" : c.side === 1 ? "c" : "n";
}
function cardInfo(L, card) {
  if (card === E.JIUDING) return L.jiuding ? { id: card, ops: 4, enemy: false, uses: { place: L.jiuding.place, campaign: L.jiuding.campaign, lobby: L.jiuding.lobby } } : null;
  const c = L.cards.find((x) => x.id === card);
  if (!c) return null;
  const ops = game.ui.pair ? E.opsOf(game.st, game.me, game.ui.pair) : c.ops;
  return { id: card, ops, enemy: !!c.uses.enemy, uses: c.uses };
}

function renderMap(v) {
  const el = $("map"); el.innerHTML = "";
  for (const [r, [x, y, w, h]] of Object.entries(REGION_BOX)) {
    const d = document.createElement("div");
    d.className = `region region-${r}` + (E.REGIONS[r].home ? " home" : "");
    d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    d.innerHTML = `<span>${esc(regionName(r))}</span>`;
    el.appendChild(d);
  }
  const mode = currentMode(v);
  for (const sp of E.SPACES) {
    const [x, y] = NODE_POS[sp.id], [q, c] = E.infOf(v, sp.id), ctl = E.controller(v, sp.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "node" + (ctl === 0 ? " ctlq" : ctl === 1 ? " ctlc" : "") + (mode.lit.has(sp.id) ? " lit" : "") + (mode.picked[sp.id] ? " picked" : "");
    b.style.cssText = `left:${x}px;top:${y}px`;
    const cap = sp.state && E.STATES[sp.state].capital === sp.id;
    b.innerHTML = `<span class="nm${cap ? " cap" : ""}">${sp.battleground ? "★" : ""}${esc(spaceName(sp.id))}</span>` +
      `<span class="cnt">${q ? `<i class="q">${q}</i>` : ""}${c ? `<i class="c">${c}</i>` : ""}</span>` +
      (mode.picked[sp.id] ? `<span class="badge">+${mode.picked[sp.id]}</span>` : "") +
      (mode.costs && mode.costs[sp.id] === 2 ? `<span class="cost">2</span>` : "");
    b.disabled = !mode.lit.has(sp.id);
    b.title = `${spaceName(sp.id)} · ${sp.stability}`;
    b.onclick = () => mode.onTap(sp.id);
    el.appendChild(b);
  }
}

function btn(parent, label, onClick, cls = "", pressed = null, disabled = false) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label; b.className = cls; b.disabled = disabled;
  if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
  b.onclick = onClick;
  parent.appendChild(b);
  return b;
}
function row(parent, cls = "rowb") { const d = document.createElement("div"); d.className = cls; parent.appendChild(d); return d; }
function note(parent, text) { const d = document.createElement("div"); d.className = "note"; d.textContent = text; parent.appendChild(d); }
// Card names are the one place bilingual text is wanted regardless of the
// page's language (see TEAM.md's language-mixing exception list).
const cardZh = (id) => (id === E.JIUDING ? "九鼎" : E.CARD[id].zh);
const cardEn = (id) => (id === E.JIUDING ? "The Nine Cauldrons" : E.CARD[id].en);
const opsLabel = (id) => (id === E.JIUDING ? "4" : E.CARD[id].scoring ? "S" : String(E.CARD[id].ops));

// The full card sheet: art, ops badge, both names, era/number/year, and the
// card's own text — the same on every card, only the surrounding colour
// (sheet-q/c/n/s, set by the caller) tells its owner apart.
function cardHeader(sh, id) {
  const meta = id === E.JIUDING ? null : E.CARD[id];
  const info = meta ? `${t("eras." + meta.era)}${meta.num ? ` · No. ${meta.num}` : ""}${meta.year ? ` · ${lang === "en" ? meta.year + " BC" : "前" + meta.year + "年"}` : ""}` : "";
  const head = document.createElement("div"); head.className = "sheet-head";
  head.innerHTML =
    `<img class="sheet-img" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` +
    `<div class="sheet-meta"><span class="sheet-badge">${esc(opsLabel(id))}</span>` +
    `<div class="sheet-name-zh" lang="zh-Hant">${esc(cardZh(id))}</div>` +
    `<div class="sheet-name-en">${esc(cardEn(id))}</div>` +
    (info ? `<div class="sheet-info">${esc(info)}</div>` : "") + `</div>`;
  sh.appendChild(head);
  const text = document.createElement("div"); text.className = "sheet-text"; text.textContent = cardText(id);
  sh.appendChild(text);
}
// A Cancel + Confirm footer pair, used everywhere a card sheet asks for a
// final commit (event/reform, place, campaign/lobby).
function footer(sh, confirmLabel, onConfirm, confirmDisabled, onCancel) {
  const r = row(sh, "sheet-footer");
  btn(r, t("buttons.cancel"), onCancel || (() => { game.ui = freshUi(); render(); }));
  btn(r, confirmLabel, onConfirm, "primary", null, confirmDisabled);
  return r;
}

function renderPromptAndSheet(v) {
  const p = $("prompt"), sh = $("sheet");
  sh.innerHTML = "";
  // The sheet's own background follows the selected card's owner, like the
  // card-sheet mockups (a Chu card opens on lacquer red, Qin on black,
  // neutral/scoring on parchment).
  sh.className = "sheet" + (game.ui.card != null ? " sheet-" + cardSide(game.ui.card) : "");
  const me = game.me, ui = game.ui;
  const err = ui.err ? `<div class="err">${esc(ui.err)}</div>` : "";
  const setPrompt = (html) => { p.innerHTML = html + err; };
  if (v.winner != null) {
    setPrompt(`${t("prompt.over")} <b>${esc(t("over.winner", { side: sideName(v.winner) }))}</b> · ${esc(t("over.reasons." + v.reason))}`);
    btn(sh, t("buttons.result"), () => renderOver(), "primary");
    return;
  }
  const L = E.legal(v, me);
  if (L.kind === "wait") { setPrompt(t("prompt.wait", { name: game.botName })); return; }
  if (L.kind === "pending") { renderPending(v, L.pending, setPrompt, sh); return; }
  if (L.kind === "headline") {
    setPrompt(t("prompt.headline"));
    if (ui.card) {
      cardHeader(sh, ui.card);
      footer(sh, t("buttons.headline"), () => humanAct({ type: "headline", card: ui.card }), false, () => { game.ui = freshUi(); render(); });
    }
    return;
  }
  // An action round.
  if (L.bog && L.bog.length && !ui.card) { setPrompt(t("uses.bog")); return; }
  if (!ui.card) { setPrompt(t("prompt.yourAction")); return; }
  if (L.bog && L.bog.length) {
    setPrompt(t("uses.bog"));
    cardHeader(sh, ui.card);
    footer(sh, t("buttons.confirm"), () => humanAct({ type: "play", card: ui.card, use: "bog" }), false);
    return;
  }
  const info = cardInfo(L, ui.card);
  if (!info) { setPrompt(t("prompt.yourAction")); return; }
  cardHeader(sh, ui.card);
  const uses = row(sh, "rowb sheet-grid");
  const usable = (u) => (u === "event" ? info.uses.event : u === "reform" ? info.uses.reform : !!info.uses[u]);
  for (const u of ["event", "place", "campaign", "lobby", "reform"]) {
    if (ui.card === E.JIUDING && (u === "event" || u === "reform")) continue;
    btn(uses, t(`uses.${u}`), () => { ui.use = u; ui.points = []; ui.target = null; ui.err = ""; render(); }, "", ui.use === u, !usable(u));
  }
  if (info.enemy && ui.use && ui.use !== "event" && ui.use !== "reform") {
    const r = row(sh, "rowb order");
    for (const o of ["opsFirst", "eventFirst"]) btn(r, t(`uses.${o}`), () => { ui.order = o; ui.points = []; render(); }, "", ui.order === o);
    note(sh, t("preview.enemyEvent"));
  }
  if (ui.card === "shuoke" && info.uses.pair && info.uses.pair.length && ui.use && ui.use !== "event" && ui.use !== "reform") {
    const r = row(sh);
    note(sh, t("uses.pair"));
    for (const c of info.uses.pair) btn(r, `${cardName(c)} (${E.opsOf(game.st, me, c)})`, () => { ui.pair = ui.pair === c ? null : c; ui.points = []; render(); }, "", ui.pair === c);
  }
  const base = { type: "play", card: ui.card, use: ui.use };
  if (ui.pair) base.pair = ui.pair;
  if (info.enemy && !ui.pair) base.order = ui.order;
  if (!ui.use) { setPrompt(""); return; }
  if (ui.use === "event" || ui.use === "reform") {
    setPrompt("");
    footer(sh, `${t("buttons.confirm")} · ${t(`uses.${ui.use}`)}`, () => humanAct(base), false);
    return;
  }
  if (ui.use === "place") {
    if (info.enemy && ui.order === "eventFirst" && !ui.pair) {
      setPrompt(t("uses.eventFirst"));
      footer(sh, t("buttons.confirm"), () => humanAct(base), false);
      return;
    }
    const { spent } = placementTrial(v, me, ui.points);
    setPrompt(t("prompt.place", { ops: info.ops, left: info.ops - spent }));
    footer(sh, t("buttons.done"), () => humanAct({ ...base, points: ui.points }), ui.points.length === 0, () => { ui.points = []; render(); });
    return;
  }
  // campaign or lobby
  setPrompt(t(`prompt.${ui.use}`, { ops: info.ops }));
  if (ui.target) {
    const trial = E.clone(v); trial.log = [];
    let text;
    if (ui.use === "campaign") { const r = E.campaign(trial, me, ui.target, info.ops); text = t("preview.campaign", { removed: r.removed, placed: r.placed, w: t("weariness." + trial.weariness) }); }
    else { const e = E.edge(v, me, ui.target); text = t("preview.lobby", { edge: e, n: Math.min(info.ops, e) }); }
    note(sh, `${spaceName(ui.target)}: ${text}`);
    footer(sh, `${t("buttons.confirm")} · ${t(`uses.${ui.use}`)} · ${spaceName(ui.target)}`, () => humanAct({ ...base, target: ui.target }), false);
  }
}

function renderPending(v, p, setPrompt, sh) {
  const ui = game.ui;
  if (p.kind === "points") {
    const key = p.tag === "setup" ? (p.min === v.options.comp && v.turn === 0 && game.me === 1 && !p.options.includes("ying") ? "setupBonus" : "setup") : p.min < p.n ? "pointsMin" : "points";
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t(`prompt.${key}`, { n: p.n, left: p.n - ui.picks.length })}`);
    const r = row(sh);
    btn(r, t("buttons.confirm"), () => humanAct({ type: "choose", choice: ui.picks }), "primary", null, ui.picks.length < p.min);
    btn(r, t("buttons.cancel"), () => { ui.picks = []; render(); }, "", null, ui.picks.length === 0);
    return;
  }
  if (p.kind === "card") {
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t(p.min === 0 ? "prompt.cardOptional" : "prompt.card")}`);
    const r = row(sh);
    for (const c of p.options) btn(r, `${cardName(c)} (${E.CARD[c].ops})`, () => humanAct({ type: "choose", choice: [c] }));
    if (p.min === 0) btn(r, t("buttons.skip"), () => humanAct({ type: "choose", choice: [] }));
    return;
  }
  if (p.kind === "option") {
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t("prompt.option")}`);
    const r = row(sh);
    for (const o of p.options) btn(r, o.label, () => humanAct({ type: "choose", choice: o.id }));
    return;
  }
  if (p.kind === "ops") {
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t("prompt.ops", { ops: p.ops })}`);
    const r = row(sh);
    for (const u of p.allowed) btn(r, t(`uses.${u}`), () => { ui.opsUse = u; ui.points = []; ui.target = null; render(); }, "", ui.opsUse === u);
    if (ui.opsUse === "place") {
      const { spent } = placementTrial(v, game.me, ui.points);
      note(sh, t("prompt.place", { ops: p.ops, left: p.ops - spent }));
      const r2 = row(sh);
      btn(r2, t("buttons.done"), () => humanAct({ type: "choose", choice: { use: "place", points: ui.points } }), "primary", null, ui.points.length === 0);
      btn(r2, t("buttons.cancel"), () => { ui.points = []; render(); });
    } else if (ui.opsUse && ui.target) {
      btn(sh, `${t("buttons.confirm")} · ${t(`uses.${ui.opsUse}`)} · ${spaceName(ui.target)}`, () => humanAct({ type: "choose", choice: { use: ui.opsUse, target: ui.target } }), "primary");
    }
  }
}

function renderHand(v) {
  const el = $("hand"); el.innerHTML = "";
  const me = game.me, ui = game.ui;
  const hand = v.hands[me] || [];
  const canPick = v.winner == null && (E.legal(v, me).kind === "action" || E.legal(v, me).kind === "headline");
  // Image on top, circular ops badge + both names below — the same shape
  // for Qin, Chu, neutral and scoring cards; only colour tells them apart.
  const tile = (id, cls = "") => {
    const kind = cardSide(id);
    const b = document.createElement("button");
    b.type = "button"; b.className = `card ${cls}`;
    b.setAttribute("aria-pressed", String(ui.card === id));
    b.innerHTML = `<img class="cardimg" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` +
      `<span class="ci"><span class="ops ${kind}">${esc(opsLabel(id))}</span><span class="nm"><span class="nm-zh" lang="zh-Hant">${esc(cardZh(id))}</span><span class="nm-en">${esc(cardEn(id))}</span></span></span>`;
    b.disabled = !canPick;
    b.onclick = () => { game.ui = freshUi(ui.card === id ? null : id); render(); };
    el.appendChild(b);
  };
  for (const id of hand) tile(id);
  if (v.phase === "action" && E.jiudingUsable(v, me)) tile(E.JIUDING, "jiuding");
}

function fmtLog(l) {
  const P = { side: l.side != null ? sideName(l.side) : "", turn: l.turn, era: l.era ? t("eras." + l.era) : "", box: l.box, ops: l.ops, removed: l.removed, placed: l.placed, mandate: l.mandate != null ? mandateText(l.mandate) : "", weariness: l.weariness ? t("weariness." + l.weariness) : "", to: l.to ? t("weariness." + l.to) : "" };
  if (l.points) P.spaces = list(l.points, spaceName);
  if (l.target) P.target = spaceName(l.target);
  if (l.card) P.card = cardName(l.card);
  if (l.use) P.use = t("useNames." + l.use);
  if (l.region) P.region = regionName(l.region);
  if (l.state) P.state = stateName(l.state);
  if (l.type === "score") { P.q = l.qin.total; P.c = l.chu.total; }
  if (l.type === "headline") { P.qin = cardName(l.cards[0]); P.chu = cardName(l.cards[1]); P.first = sideName(l.first); }
  if (l.type === "jiuding") P.side = sideName(l.to);
  if (l.type === "over") { P.side = sideName(l.winner); P.reason = t("over.reasons." + l.reason); }
  if (l.type === "vp") P.side = sideName(l.side);
  const key = `log.${l.type}`;
  const s = t(key, P);
  return s === key ? "" : s;
}
function renderLog(v) {
  const body = $("logBody");
  $("logToggle").textContent = `${t("buttons.log")} (${body.hidden ? t("buttons.show") : t("buttons.hide")})`;
  const lines = v.log.slice(-60).map(fmtLog).filter(Boolean).reverse();
  $("chatForm").hidden = !game.room || game.spectator;
  const said = game.room ? room.chat.slice(-8).reverse().map((s) => `<div class="say">${esc(s)}</div>`).join("") : "";
  body.innerHTML = said + (game.botLine ? `<div class="bot">${esc(game.botLine)}</div>` : "") + lines.map((s) => `<div>${esc(s)}</div>`).join("");
  // Under the prompt: what happened since this seat last acted.
  const NEWS = new Set(["headline", "play", "place", "campaign", "lobby", "score", "tire", "seal", "unseal", "mie", "restore", "reform", "jiuding", "bog", "skip", "era", "turn"]);
  const news = v.log.filter((l) => l.i > (game.seenLog || 0) && NEWS.has(l.type)).map(fmtLog).filter(Boolean).slice(-7);
  $("prompt").insertAdjacentHTML("beforeend", news.length ? `<div class="news">${news.map((s) => `<div>${esc(s)}</div>`).join("")}</div>` : "");
}
$("chatForm").onsubmit = (ev) => {
  ev.preventDefault();
  const text = $("chatIn").value.trim();
  if (text) send({ type: "chat", text });
  $("chatIn").value = "";
};
$("logToggle").onclick = () => { $("logBody").hidden = !$("logBody").hidden; if (game.st) renderLog(E.view(game.st, game.me)); };

function renderOver() {
  const st = game.st;
  $("overTitle").textContent = t("over.winner", { side: sideName(st.winner) });
  $("overReason").textContent = t("over.reasons." + st.reason);
  $("overMandate").textContent = `${t("over.mandate")}: ${mandateText(st.mandate)}`;
  show("over");
}

// ---------- rooms: a socket to the Durable Object ----------
const room = { ws: null, code: null, me: null, token: null, seats: [], settings: null, phase: null, deadline: 0, gen: 0, isHost: false, fatal: false, chat: [] };
function wsUrl(params) {
  const base = location.pathname.replace(/\/[^/]*$/, "");
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${base}/ws?${new URLSearchParams(params)}`;
}
function send(msg) { if (room.ws && room.ws.readyState === 1) room.ws.send(JSON.stringify(msg)); }
function connect(params) {
  if (room.ws) { try { room.ws.close(); } catch {} }
  const name = store.get("zh.name", "").trim() || t("setup.defaultName");
  const ws = new WebSocket(wsUrl({ ...params, name, lang }));
  Object.assign(room, { ws, code: params.room || null, me: null, seats: [], settings: null, phase: null, fatal: false });
  game.room = true; game.spectator = false; game.st = null; game.ui = freshUi();
  $("lobbyErr").hidden = true; $("lobbyHint").textContent = t("lobby.connecting"); $("lobbyCode").textContent = room.code || ""; $("lobbySeats").innerHTML = ""; $("lobbyActions").innerHTML = "";
  show("lobby");
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } onRoomMsg(m); };
  ws.onclose = () => { if (room.ws === ws) { room.ws = null; if (!room.fatal) { $("lobbyErr").textContent = t("lobby.closed"); $("lobbyErr").hidden = false; } } };
}
function leaveRoom() {
  if (room.ws) { try { room.ws.close(); } catch {} }
  room.ws = null; game.room = false; game.st = null;
  try { sessionStorage.removeItem("zh.lastRoom"); } catch {}
}
function onRoomMsg(m) {
  switch (m.type) {
    case "joined":
      room.code = m.code; room.me = m.side; room.token = m.token;
      if (m.token) { sess.set("zh.token." + m.code, m.token); sess.set("zh.lastRoom", m.code); }
      game.spectator = m.side == null; game.me = m.side ?? 0;
      history.replaceState(null, "", `?room=${m.code}`);
      break;
    case "lobby":
      room.phase = m.phase; room.seats = m.seats; room.settings = m.settings;
      room.isHost = m.seats.some((s) => s.idx === 0 && s.side === room.me);
      if (m.phase === "lobby") { game.st = null; renderLobby(); show("lobby"); }
      else if (m.phase === "over") renderLobby();
      break;
    case "view":
      if (m.view == null) { game.st = null; renderLobby(); show("lobby"); break; }
      room.deadline = m.deadline; room.gen = m.gen;
      game.st = m.view; game.me = m.me ?? game.me;
      game.botName = m.names ? m.names[E.SIDES[1 - game.me]] : "";
      if (!game.ui) game.ui = freshUi();
      if ($("table").hidden && $("over").hidden) show("table");
      render();
      if (game.st.winner != null) renderOver();
      break;
    case "say":
      room.chat.push(m.sys ? m.text : `${room.seats[m.seat]?.name ?? ""}: ${m.text}`);
      if (room.chat.length > 50) room.chat.shift();
      if (!m.sys) $("logBody").hidden = false;
      if (game.st) renderLog(game.st);
      break;
    case "log":
      room.chat = m.entries.map((e) => (e.sys ? e.text : `${room.seats[e.seat]?.name ?? ""}: ${e.text}`)).slice(-50);
      break;
    case "error":
      if (m.fatal) {
        room.fatal = true;
        try { sessionStorage.removeItem("zh.lastRoom"); } catch {}
        $("lobbyErr").textContent = t("errors." + m.key); $("lobbyErr").hidden = false; show("lobby");
      }
      else if (game.st) { game.ui.err = m.key ? t("errors." + m.key) : m.message; render(); }
      break;
    default: break;
  }
}
function renderLobby() {
  $("lobbyCode").textContent = room.code || "";
  $("lobbyHint").textContent = room.isHost ? t("lobby.hint") : t("lobby.waiting");
  const el = $("lobbySeats"); el.innerHTML = "";
  for (const s of room.seats) {
    const d = document.createElement("div");
    d.className = "seat" + (!s.connected ? " away" : "");
    const tags = [s.side === room.me ? t("lobby.you") : "", s.idx === 0 ? t("lobby.host") : "", s.ai ? t("lobby.bot") : "", !s.connected && !s.ai ? t("lobby.away") : ""].filter(Boolean).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
    d.innerHTML = `<div class="sd ${s.side === 0 ? "q" : "c"}">${esc(sideName(s.side))}</div><div class="who">${esc(s.name)}${tags}</div><span>${s.ready || s.idx === 0 ? t("lobby.ready") : t("lobby.notReady")}</span>`;
    el.appendChild(d);
  }
  seg($("lobbyLevel"), [["easy", t("setup.easy")], ["normal", t("setup.normal")], ["hard", t("setup.hard")]], room.settings?.level || "normal", (v) => { if (room.isHost) send({ type: "settings", level: v }); });
  const a = $("lobbyActions"); a.innerHTML = "";
  if (room.phase === "over") {
    if (room.isHost) btn(a, t("lobby.rematch"), () => send({ type: "rematch" }), "primary");
  } else if (room.isHost) {
    const hasBot = room.seats.some((s) => s.ai), full = room.seats.length >= 2;
    btn(a, t("lobby.start"), () => send({ type: "start" }), "primary", null, !full);
    if (hasBot) btn(a, t("lobby.removeBot"), () => send({ type: "removeBot" }));
    else if (!full) btn(a, t("lobby.addBot"), () => send({ type: "addBot" }));
    btn(a, t("lobby.swap"), () => send({ type: "swap" }));
  } else if (!game.spectator) {
    const me = room.seats.find((s) => s.side === room.me);
    btn(a, me?.ready ? t("lobby.notReady") : t("lobby.ready"), () => send({ type: "ready", ready: !me?.ready }), "primary");
  }
  btn(a, t("lobby.leave"), () => { send({ type: "leave" }); leaveRoom(); toLanding(); });
}
setInterval(() => {
  if (!game.room || !game.st || game.st.winner != null || !room.deadline) return;
  const s = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
  $("barMid").textContent = `${t("tracks.turn")} ${game.st.turn} · ${game.spectator ? "" : sideName(game.me)} · ${t("lobby.clock", { s })}`;
}, 1000);

// ---------- boot ----------
const params = new URLSearchParams(location.search);
setLang(params.get("lang") || store.get("zh.lang", (navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));
if (params.has("resume") && loadSolo()) resumeSolo();
else if (params.get("create") === "1") connect({ create: "1" });
else if (params.get("room")) { const code = params.get("room").toUpperCase(); connect({ room: code, token: sess.get("zh.token." + code) || "" }); }
else {
  // The landing's Qin/Chu/Random taps preselect a side and land here; the
  // level (bot strength) is still picked on this screen.
  const side = params.get("side");
  if (side === "qin" || side === "chu" || side === "random") { setup.side = side; store.set("zh.side", side); }
  renderSetup();
  show("setup");
}
