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
import { mountAdvisorToggle, decorate as decorateAdvisor } from "./advisor-ui.js";

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
// The map's own region tag needs a SHORT name ("West", not "the West") so it
// fits its little pill; zh's board name is already short enough to reuse.
const regionShortName = (r) => (lang === "en" ? t("regionShort." + r) : E.REGIONS[r].zh);
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
  $("lobbyChatIn").placeholder = t("lobby.say");
  renderSetup();
  if (game.st) { render(); if (game.st.winner != null) renderOver(); }
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));
// The advisor's own switch (issue #18): mounted once here; its own
// visibility (solo table only) and everything it draws live in
// advisor-ui.js, driven by the decorateAdvisor() call at render()'s tail.
mountAdvisorToggle($("advisorSlot"));

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
  // Desktop-only (see desktop.css, #7): which backdrop/frame the page-card
  // shell gets follows the active view. Mobile never reads this attribute.
  document.body.dataset.view = view;
  paintBody(view);
  // The table is a fixed one-screen layout (header -> mandate -> map ->
  // stat line -> prompt -> hand): it never scrolls, on 375x667 or 390x844,
  // by giving #table the rest of the viewport height via flex and letting
  // the map (the one flexible piece) shrink first.
  document.body.classList.toggle("table-lock", view === "table");
}
// The landing is its own page. Going back never loses anything: the solo game
// is saved on every move, and a room keeps this tab's seat (the bot covers it
// after the grace period until the tab returns).
const toLanding = () => { location.href = "./"; };
$("btnBack").onclick = toLanding;
$("btnHome").onclick = toLanding;
$("btnAgain").onclick = () => (game.room ? show("lobby") : show("setup"));
$("btnBoard").onclick = () => { show("table"); render(); };
// Swap sides from the result screen: in a room this is the same request the
// lobby's own Swap button sends (the host's ask; the server is the judge of
// whether it is allowed). Solo has no server to ask, so it just reopens setup
// pre-picked to the other side.
$("btnSwap").onclick = () => {
  if (game.room) { send({ type: "swap" }); show("lobby"); }
  else { setup.side = E.SIDES[1 - game.me]; store.set("zh.side", setup.side); renderSetup(); show("setup"); }
};

// ---------- setup ----------
const setup = { side: store.get("zh.side", "chu"), level: store.get("zh.level", "normal") };
// Builds the buttons once and reuses them on every later call (same item
// count/order): only aria-pressed, label text and the click handler are
// updated in place, so repeated calls (a pick, a language switch) never
// touch the DOM nodes — no rebuild flicker (#20). Item count changing would
// still fall back to a full rebuild, but every caller today always passes
// the same three (easy/normal/hard) options.
function seg(el, items, value, onPick) {
  if (el.childElementCount !== items.length) el.innerHTML = "";
  items.forEach(([v, label], i) => {
    let b = el.children[i];
    if (!b) { b = document.createElement("button"); b.type = "button"; el.appendChild(b); }
    if (b.textContent !== label) b.textContent = label;
    b.setAttribute("aria-pressed", String(v === value));
    b.onclick = () => onPick(v);
  });
}
// A picture tile per side (art/ui/qin.jpg, chu.jpg), plus a plain "random"
// tile — the selected one gets a thick border and full opacity, the way the
// C2 setup mockups (C2_SetupQin/Setup/SetupRandom) show all three at once.
// Built once; later calls (a pick, a language switch) only update
// aria-pressed and text nodes in place — the <img> is never re-created, so
// it never re-decodes and never flickers (#20).
const SIDE_TILES = ["qin", "chu", "random"];
function renderSideTiles() {
  const el = $("sideTiles");
  const pick = (v) => { setup.side = v; store.set("zh.side", v); renderSetup(); };
  if (el.childElementCount !== SIDE_TILES.length) {
    el.innerHTML = "";
    for (const v of SIDE_TILES) {
      const b = document.createElement("button");
      b.type = "button"; b.className = `tile ${v}`;
      if (v !== "random") {
        const img = document.createElement("img");
        img.src = `art/ui/${v}.jpg`; img.alt = "";
        b.appendChild(img);
      }
      const info = document.createElement("span"); info.className = "tile-info";
      const tg = document.createElement("span"); tg.className = "tg"; tg.lang = "zh-Hant";
      const tname = document.createElement("span"); tname.className = "tname";
      const ttag = document.createElement("span"); ttag.className = "ttag";
      info.append(tg, tname, ttag);
      b.appendChild(info);
      b.onclick = () => pick(v);
      el.appendChild(b);
    }
  }
  SIDE_TILES.forEach((v, i) => {
    const b = el.children[i];
    b.setAttribute("aria-pressed", String(setup.side === v));
    const glyph = v === "qin" ? "秦" : v === "chu" ? "楚" : "?";
    const tname = v === "random" ? t("setup.random") : t(`sides.${v}`);
    const tag = v === "random" ? t("setup.randomTag") : t(`side.${v}.headline`);
    // textContent's setter unconditionally replaces the text node (a
    // childList mutation) even when the string is unchanged, so guard each
    // one — a side/level pick never changes another tile's text, and only
    // a language switch should touch these (#20).
    const tg = b.querySelector(".tg"), tn = b.querySelector(".tname"), tt = b.querySelector(".ttag");
    if (tg.textContent !== glyph) tg.textContent = glyph;
    if (tn.textContent !== tname) tn.textContent = tname;
    if (tt.textContent !== tag) tt.textContent = tag;
  });
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
  game.lastView = v; // layoutTable() re-renders the hand off this if it flips full<->chip
  $("barMid").textContent = `${t("tracks.turn")} ${v.turn} · ${game.spectator ? "" : sideName(game.me)}`;
  renderTopBar(v);
  if (game.spectator) {
    setSheetOpen(false);
    renderMap({ ...v, winner: 0 }); // nothing lit
    renderStatLine(v);
    $("promptText").textContent = ""; $("sheet").innerHTML = ""; $("hand").innerHTML = "";
    renderLog(v);
    fitMap(); // after every sibling has its final flex size, so the map's own box is final too
    decorateAdvisor(v, { solo: false, side: game.me });
    return;
  }
  // Computed before renderMap so a scoring card selected this same render
  // already lights up its region, not one render-cycle late.
  scoreHighlight = game.ui.card != null && game.ui.card !== E.JIUDING && E.CARD[game.ui.card].scoring ? E.CARD[game.ui.card].scoring : null;
  renderMap(v);
  renderStatLine(v);
  renderPromptAndSheet(v); // sets #sheet's className outright, so setSheetOpen must come after this, not before
  renderHand(v);
  renderLog(v);
  // The card sheet covers the whole screen while you're just looking at a
  // card or confirming something that doesn't need the map (like the
  // C2_Card* mockups) — but once a use needs the map (place/campaign/lobby
  // target picking), it shrinks back to a strip so the map stays tappable,
  // matching C2_Place/C2_Campaign.
  setSheetOpen(wantsCardOverlay(v));
  layoutTable(); // the map's real box depends on the hand's, so both are sized together, then fitMap() scales the map's content
  // The advisor's own decoration pass (issue #18): everything it draws lives
  // in advisor-ui.js, which no-ops (and calls advise() zero times) unless
  // solo is true and its own switch is on.
  decorateAdvisor(v, {
    solo: !game.room && !game.spectator, side: game.me, uiCard: game.ui.card,
    t, spaceName, stateName, regionName, cardName, sep,
  });
}
// The map's scale is the viewport-width ratio (DESIGN_W is the mockup's own
// canvas width) UNLESS that would leave no room at all for a shown hand, in
// which case scale gives up only down to FLOOR_SCALE — the scale at which
// the disc/name/tap-target minimums are still met (30/34px design discs ->
// 28/32px drawn). A real 375-390px-wide phone never needs the floor; only a
// short one (e.g. 390x669 with iOS Chrome's toolbars up) does. Below the
// floor, it's the hand's card ART that concedes further (see CARD_H below),
// never the map — a fixed short viewport (no scrolling allowed) has to put
// the shortfall somewhere, and the map's drawn spec is the one thing that
// must never move.
const DESIGN_DISC = 30, DESIGN_BIG_DISC = 34; // keep in sync with .node .disc / .node.big .disc in style.css
const MIN_DISC = 28, MIN_BIG_DISC = 32; // the owner's C2 touch/legibility floor at any width
const FLOOR_SCALE = Math.max(MIN_DISC / DESIGN_DISC, MIN_BIG_DISC / DESIGN_BIG_DISC) * 1.01; // +1% safety margin over the exact minimum
const CARD_H = 176, HAND_GUTTER = 31; // 96x176 card + the C2_Game hand row's own headroom (207 total)
// Below CARD_FULL_MIN the full card's own art has shrunk too far to read —
// the hand switches to a fixed-height chip row instead (round 5) rather than
// keep shrinking a "half-squashed" card. CHIP_GUTTER is the chip row's own
// headroom, same idea as HAND_GUTTER above but smaller (a chip has no image
// to letterbox around).
const CARD_FULL_MIN = 120, CHIP_H = 56, CHIP_GUTTER = 16;
// >=1024px (desktop.css's own breakpoint, #7): #table stops being the single
// flex column the code below sizes and becomes a two-column CSS grid (map |
// a fixed 390px sidebar) — a grid item's `flex` shorthand and #table's own
// row-gap math (both below) simply don't apply to that layout, and the map
// no longer competes with the hand for height (they're in separate grid
// columns) so it never needs to shrink for the hand's sake. So the map's
// scale here is a plain letterbox fit (min of the width- and height-ratio)
// against #map's own real box — whatever CSS grid actually gave it — rather
// than the mobile function's width-priority, shrink-for-the-hand logic.
const isDesktopTable = () => window.innerWidth >= 1024;
function layoutTableDesktop() {
  // A short mobile viewport can leave body.table-overflow set (#5, round 5:
  // "even a chip row doesn't fit, let the page scroll") — that class
  // combines with .table-lock at a HIGHER specificity than this file's own
  // body.table-lock rule, so it must be cleared explicitly here rather than
  // relying on desktop.css to out-specify it.
  document.body.classList.remove("table-overflow");
  const map = $("map");
  const availW = map.clientWidth, availH = map.clientHeight;
  if (!availW || !availH) return;
  const hand = $("hand");
  hand.hidden = hand.children.length === 0;
  // A plain resize (crossing 1024px, e.g. a tablet rotation) calls
  // layoutTable() but NOT render()/renderHand() — so a hand left in "chip"
  // mode from a short mobile viewport (see renderHand's own isDesktopTable
  // default, which only takes effect on the NEXT full render) needs fixing
  // right here too, the same way the mobile branch below fixes a full<->chip
  // flip: re-render off game.lastView, the last state renderHand actually
  // rendered from.
  if (hand.dataset.mode !== "full" && game.lastView) renderHand(game.lastView, "full");
  fitMap(Math.min(availW / DESIGN_W, availH / DESIGN_H));
}
function layoutTable() {
  const table = $("table");
  if (table.hidden) return;
  if (isDesktopTable()) { layoutTableDesktop(); return; }
  // table.clientWidth includes #table's own left/right padding, but a child
  // like .map only gets the content width inside that padding — use the
  // map's own rendered width so `scale` matches what actually gets drawn.
  const availW = $("map").clientWidth || table.clientWidth, availH = table.clientHeight;
  if (!availW || !availH) return;
  const widthScale = availW / DESIGN_W;
  const chrome = ["topbar", "statline", "prompt", "sheet"].reduce((sum, id) => sum + $(id).getBoundingClientRect().height, 0);
  // #table's own top/bottom padding, plus one flex column gap per boundary
  // between its VISIBLE children (a hidden/empty row like #sheet or #chatForm
  // takes no box and no gap) — measured, not guessed, so a wrong constant
  // here can't eat into the hand's real 96x176 card height.
  const tcs = getComputedStyle(table);
  const hand = $("hand");
  // A phase with nothing to hold in hand (placement, campaign/lobby target
  // picking, scoring) gets zero hand row, not a blank 200px+ strip under the
  // map — the map takes back every pixel the hand isn't using.
  const hasHand = hand.children.length > 0;
  hand.hidden = !hasHand;
  const visibleKids = [...table.children].filter((c) => getComputedStyle(c).display !== "none").length;
  const gapsAndPadding = parseFloat(tcs.paddingTop) + parseFloat(tcs.paddingBottom) + Math.max(0, visibleKids - 1) * parseFloat(tcs.rowGap || 0);
  const spaceForMapAndHand = availH - chrome - gapsAndPadding;
  // The tallest scale that still leaves `wanted` px for the hand — never
  // below FLOOR_SCALE (the map's own spec), never above widthScale (that
  // would overflow sideways).
  const configFor = (wanted) => {
    const s = Math.min(widthScale, Math.max(FLOOR_SCALE, (spaceForMapAndHand - wanted) / DESIGN_H));
    const mh = Math.round(DESIGN_H * s);
    return { scale: s, mapH: mh, handH: Math.max(0, Math.min(wanted, spaceForMapAndHand - mh)) };
  };
  let scale, mapH, handH, mode = "full", overflow = false;
  if (!hasHand) {
    scale = widthScale; mapH = Math.round(DESIGN_H * scale); handH = 0;
  } else {
    const full = configFor(CARD_H + HAND_GUTTER); // 207: 96x176 card + its own headroom
    if (full.handH - HAND_GUTTER >= CARD_FULL_MIN) {
      ({ scale, mapH, handH } = full);
    } else {
      const chip = configFor(CHIP_H + CHIP_GUTTER); // 72: a fixed 56px chip row
      mode = "chip";
      if (chip.handH >= CHIP_H + CHIP_GUTTER - 2) {
        ({ scale, mapH, handH } = chip);
      } else {
        // Even a chip row doesn't fit alongside the map's floor spec (e.g.
        // 375x553) — give both their true minimum and let the PAGE scroll
        // instead of squeezing either below spec (owner's round 5, #3).
        scale = FLOOR_SCALE; mapH = Math.round(DESIGN_H * scale); handH = CHIP_H + CHIP_GUTTER; overflow = true;
      }
    }
  }
  document.body.classList.toggle("table-overflow", overflow);
  // Re-render the hand only when its mode actually changes — a fixed-size
  // chip/card doesn't need re-measuring after a plain resize.
  if (hasHand && hand.dataset.mode !== mode) { hand.dataset.mode = mode; if (game.lastView) renderHand(game.lastView, mode); }
  hand.style.flex = `0 0 ${handH}px`;
  document.documentElement.style.setProperty("--card-h", Math.max(CARD_FULL_MIN, handH - HAND_GUTTER) + "px");
  // Any height neither the map's floor nor the hand's want needed goes back
  // to the map instead of sitting blank below it (skipped in overflow mode:
  // both are already pinned to their true minimum there).
  const mapFinalH = overflow ? mapH : Math.max(mapH, spaceForMapAndHand - handH);
  $("map").style.flex = `0 0 ${mapFinalH}px`;
  fitMap(scale);
}
function setSheetOpen(open) {
  $("sheet").classList.toggle("overlay", open);
  document.body.classList.toggle("sheet-open", open);
}
function wantsCardOverlay(v) {
  if (v.winner != null) return false;
  const ui = game.ui;
  const L = E.legal(v, game.me);
  if (L.kind === "wait" || L.kind === "pending") return false;
  if (L.kind === "headline") return !!ui.card;
  if (L.bog && L.bog.length) return !!ui.card;
  if (!ui.card) return false;
  if (!ui.use) return true; // browsing the card, choosing a use
  if (ui.use === "event" || ui.use === "reform") return true; // no map needed
  if (ui.use === "place") {
    const info = cardInfo(L, ui.card);
    return !!(info && info.enemy && ui.order === "eventFirst" && !ui.pair); // the pre-order step, before tapping the map
  }
  return false; // campaign/lobby target picking, or place once ops are known: the map is in play
}

// Above the map: just the turn and the Mandate tug-of-war bar (C2_Game's
// header + mandate strip, condensed — the seat portrait row is #6's).
function renderTopBar(v) {
  const pos = Math.max(2, Math.min(98, 50 - (v.mandate / E.MANDATE_TO_WIN) * 50));
  const phase = v.phase === "setup" ? "" : ` · ${t("tracks.round")} ${v.round}${t("tracks.of")}${v.rounds}`;
  $("topbar").innerHTML =
    `<div class="tb-turn"><b>${t("tracks.turn")} ${v.turn}</b>${v.era ? " · " + t("eras." + v.era) : ""}${phase}</div>` +
    `<div class="mandate"><span class="mid"></span><span class="dot" style="left:${pos}%"></span></div>` +
    `<div class="tb-mandate">${t("tracks.mandate")} <b>${mandateText(v.mandate)}</b></div>`;
}
// Below the map: one condensed row (C2_Game's 5-column stat strip) —
// weariness, reform, seals, destroyed, cauldrons. Per-state detail and
// hand counts stay in the log instead of taking permanent screen space.
function renderStatLine(v) {
  const seals = Object.keys(v.seals).length, mie = Object.keys(v.mie).length;
  const col = (label, val) => `<div><span class="sl-label">${esc(label)}</span><span class="sl-val">${val}</span></div>`;
  $("statline").innerHTML =
    col(t("tracks.weariness"), esc(t("weariness." + v.weariness))) +
    col(t("tracks.reform"), `${v.reform[0]} · ${v.reform[1]}`) +
    col(t("tracks.seals"), `${seals} / 4`) +
    col(t("tracks.mie"), `${mie} / 3`) +
    col(t("tracks.jiuding"), esc(sideName(v.jiuding.holder)) + (v.jiuding.faceDown ? ` (${esc(t("tracks.faceDown"))})` : ""));
}

// A fixed design canvas, scaled to fit whatever box the flex layout gives
// the map (see fitMap()) — laid out generously enough that a 13px bold
// English city name (the widest label on the board, e.g. "Guanzhong") never
// overlaps its neighbour once max-width/ellipsis caps it (see .node .nm).
// NODE_POS is each city's centre, not a corner, so nodeCenter() is trivial.
// Width kept close to the map's real on-screen width (so fitMap()'s scale
// stays near 1 and the 30/34px disc spec actually renders that size); the
// height has plenty of room to spread rows out and avoid overlap instead.
// The design canvas is the C2_Game mockup's own size (390x408) — fitMap()
// scales it by the viewport-width ratio ONLY (never shrinks it further for
// lack of height), so a real phone renders discs/text at true size. Every
// city fits inside this exact box; NODE_ANCHOR moves crowded ones' labels
// off to a side instead of needing more room.
const DESIGN_W = 390, DESIGN_H = 408;
const NODE_POS = {
  dai: [64, 26], zhongshan: [148, 24], ji: [244, 24], liaodong: [307, 34],
  yiqu: [36, 86], hedong: [136, 82], handan: [234, 80], linzi: [332, 88],
  hangu: [96, 136], shangdang: [186, 130], jimo: [342, 138],
  guanzhong: [50, 182], yiyang: [140, 176], daliang: [244, 168], ju: [312, 172],
  luoyi: [140, 228], xue: [338, 220],
  hanzhong: [36, 252], xinzheng: [196, 244], song: [282, 244],
  bashu: [66, 306],
  qianzhong: [102, 360], chencai: [168, 336], ying: [220, 388], huaisi: [280, 342], wuyue: [340, 378],
};
const nodeCenter = (id) => NODE_POS[id];
// Region membership comes straight from the board data (E.SPACE[id].region),
// never a hand-copied list — a probe that patches a space's region should
// see the blob move with it.
function regionMembers() {
  const by = {};
  for (const sp of E.SPACES) (by[sp.region] ??= []).push(sp.id);
  return by;
}
// While a scoring card is open in the sheet, its region lights up on the
// map and the rest fade — set by renderPromptAndSheet, read by renderMap.
let scoreHighlight = null;

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

// The region blobs: a soft, borderless tint that hugs the roads between a
// region's own cities (no bounding box), one colour per region, membership
// read live from E.SPACE[id].region. Scoring a region (a scoring card open
// in the sheet) brightens it and fades the rest.
function renderRegionBlobs(members) {
  const within = (ids) => {
    const pairs = [];
    for (const id of ids) for (const nb of E.SPACE[id].adj) if (ids.includes(nb) && id < nb) pairs.push([id, nb]);
    return pairs;
  };
  let svg = `<svg class="region-blobs" viewBox="0 0 ${DESIGN_W} ${DESIGN_H}">`;
  for (const [r, ids] of Object.entries(members)) {
    const cls = "blob-" + r + (scoreHighlight ? (scoreHighlight === r ? " active" : " faded") : "");
    svg += `<g class="blob ${cls}">`;
    for (const [a, b] of within(ids)) {
      const [x1, y1] = nodeCenter(a), [x2, y2] = nodeCenter(b);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="46" stroke-linecap="round"></line>`;
    }
    for (const id of ids) { const [x, y] = nodeCenter(id); svg += `<circle cx="${x}" cy="${y}" r="28"></circle>`; }
    svg += `</g>`;
  }
  svg += `</svg>`;
  return svg;
}
function renderRoads() {
  const seen = new Set();
  let svg = `<svg class="roads" viewBox="0 0 ${DESIGN_W} ${DESIGN_H}">`;
  for (const sp of E.SPACES) for (const nb of sp.adj) {
    const key = [sp.id, nb].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const [x1, y1] = nodeCenter(sp.id), [x2, y2] = nodeCenter(nb);
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
  }
  return svg + `</svg>`;
}
// Hand-picked so the tag sits in open water, never over a city or another
// tag (owner: per-region position is fine, membership must stay data-driven
// — and it is, via regionMembers()). One colour per region, matching its blob.
const REGION_LABEL_POS = {
  north: [282, 66], west: [30, 152], jin: [176, 202], zhou: [184, 162], east: [340, 274], south: [235, 306],
};
// No ellipsis anywhere on the map (owner). Long English names that have a
// natural break (a space or hyphen) go on two lines; the rest just render
// smaller (11px vs 13px) — both explicitly OK'd. Chinese names are always
// short enough for one line at the default size. A handful of cities anchor
// their label off a side instead of straight below, by hand, because the
// default spot collides with a neighbour once the real (untruncated) width
// is on screen — this is a label position, not a change to who's in a
// region, so it's fine per the same rule as REGION_LABEL_POS.
const NODE_BREAK_EN = { hangu: ["Hangu", "Pass"], bashu: ["Ba-", "Shu"], chencai: ["Chen-", "Cai"], huaisi: ["Huai-", "Si"], wuyue: ["Wu-", "Yue"] };
const NODE_SMALL_EN = new Set(["zhongshan", "liaodong", "shangdang", "guanzhong", "daliang", "hanzhong", "xinzheng", "qianzhong"]);
const NODE_ANCHOR = { bashu: "right", shangdang: "right", ying: "top", wuyue: "top", yiyang: "left", linzi: "left", ji: "left", liaodong: "right", hangu: "right" };
function nodeLabelHTML(id) {
  const star = E.SPACE[id].battleground ? "★" : "";
  if (lang === "en" && NODE_BREAK_EN[id]) {
    const [l1, l2] = NODE_BREAK_EN[id];
    return `<span class="nm two-line">${star}${esc(l1)}<br>${esc(l2)}</span>`;
  }
  const small = lang === "en" && NODE_SMALL_EN.has(id);
  return `<span class="nm${small ? " sm" : ""}">${star}${esc(spaceName(id))}</span>`;
}
// Touch targets are a physical requirement, not a design one: they must
// stay >=44x44 real px no matter how much the map's own art is scaled down
// on a narrow phone. So each city is two elements — a VISUAL node (disc +
// label, lives inside #mapInner and is scaled with everything else) and a
// separate, invisible HIT button (lives in #hitLayer, a plain overlay that
// is never transformed, positioned by percentage so it tracks the visual
// disc at any scale while staying a true 44x44 css px in size).
function renderMap(v) {
  const el = $("mapInner");
  const hitEl = $("hitLayer");
  hitEl.innerHTML = "";
  const members = regionMembers();
  el.innerHTML = renderRoads() + renderRegionBlobs(members);
  for (const r of Object.keys(REGION_LABEL_POS)) {
    if (!members[r]) continue;
    const [x, y] = REGION_LABEL_POS[r];
    const lbl = document.createElement("span");
    lbl.className = `region-label rl-${r}` + (scoreHighlight && scoreHighlight !== r ? " faded" : "");
    lbl.style.cssText = `left:${x}px; top:${y}px`;
    lbl.textContent = regionShortName(r);
    el.appendChild(lbl);
  }
  const mode = currentMode(v);
  for (const sp of E.SPACES) {
    const [x, y] = NODE_POS[sp.id], [q, c] = E.infOf(v, sp.id), ctl = E.controller(v, sp.id);
    const cap = sp.state && E.STATES[sp.state].capital === sp.id;
    const big = sp.battleground || cap;
    const empty = !q && !c;
    const anchor = NODE_ANCHOR[sp.id];
    const lit = mode.lit.has(sp.id), picked = mode.picked[sp.id];
    const vis = document.createElement("div");
    vis.className = "node" + (big ? " big" : "") + (empty ? " empty" : "") + (anchor ? ` anchor-${anchor}` : "") +
      (ctl === 0 ? " ctlq" : ctl === 1 ? " ctlc" : "") + (lit ? " lit" : "") + (picked ? " picked" : "");
    vis.style.cssText = `left:${x}px;top:${y}px`;
    vis.innerHTML = `<span class="disc${cap ? " sq" : ""}">${empty ? "" : `<i class="q">${q || ""}</i><i class="c">${c || ""}</i>`}</span>` +
      (picked ? `<span class="badge">+${picked}</span>` : "") +
      (mode.costs && mode.costs[sp.id] === 2 ? `<span class="cost">2</span>` : "") +
      nodeLabelHTML(sp.id);
    el.appendChild(vis);
    const hb = document.createElement("button");
    hb.type = "button";
    hb.className = "hit";
    hb.style.cssText = `left:${(x / DESIGN_W * 100).toFixed(3)}%;top:${(y / DESIGN_H * 100).toFixed(3)}%`;
    hb.disabled = !lit;
    hb.title = `${spaceName(sp.id)} · ${sp.stability}`;
    hb.onclick = () => mode.onTap(sp.id);
    hitEl.appendChild(hb);
  }
  // layoutTable() (the caller's caller) sizes and scales the map once every
  // sibling has its final height — see fitMap().
}
// The design canvas (DESIGN_W x DESIGN_H) is the C2_Game mockup's own
// dimensions, scaled by the viewport WIDTH ratio only — never shrunk further
// for a lack of height, so a real phone always renders the map at (at
// least) true size: 30/34px discs, 13px city names, 44x44 tap targets.
function fitMap(scale) {
  const inner = $("mapInner");
  inner.style.width = DESIGN_W + "px";
  inner.style.height = DESIGN_H + "px";
  inner.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener("resize", () => { if (!$("table").hidden && game.st) layoutTable(); });

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
// The mini chip used instead of the full card header while the map is in
// play (placing points, picking a campaign/lobby target) — C2_Place and
// C2_Campaign show a small strip here, not the full art+text sheet, so the
// map stays the point. "Expand" swaps in the full header without leaving
// this mode (see wantsCardOverlay/mapActive in renderPromptAndSheet).
function cardChip(sh, id) {
  const wrap = document.createElement("div"); wrap.className = "sheet-chip";
  wrap.innerHTML = `<span class="ops ${cardSide(id)}">${esc(opsLabel(id))}</span>` +
    `<span class="chip-nm"><span class="nm-zh" lang="zh-Hant">${esc(cardZh(id))}</span><span class="nm-en">${esc(cardEn(id))}</span></span>`;
  const expand = document.createElement("button");
  expand.type = "button"; expand.className = "chip-expand"; expand.textContent = t("buttons.expand");
  expand.onclick = () => { game.ui.chipExpanded = true; render(); };
  wrap.appendChild(expand);
  sh.appendChild(wrap);
}
// A Cancel + Confirm footer pair, used everywhere a card sheet asks for a
// final commit (event/reform, place, campaign/lobby).
function footer(sh, confirmLabel, onConfirm, confirmDisabled, onCancel) {
  const r = row(sh, "sheet-footer");
  btn(r, t("buttons.cancel"), onCancel || (() => { game.ui = freshUi(); render(); }));
  btn(r, confirmLabel, onConfirm, "primary", null, confirmDisabled);
  return r;
}

// A scoring card's sheet gets the region's actual tally (E.regionTally),
// not a guess: spaces held, battlegrounds, the level it reaches, the
// battleground bonus, and the total each side would score right now.
function scoringPanel(sh, v, region) {
  const [q, c] = E.regionTally(v, region);
  const wrap = document.createElement("div"); wrap.className = "score-panel";
  const row1 = (side, r) => `<div class="srow ${side === 0 ? "q" : "c"}"><b>${esc(sideName(side))}</b>` +
    `<span>${r.spaces}/${E.spacesOf(region).length} · ${r.bg} ★</span>` +
    `<span class="lvl">${esc(t("scoringLevel." + r.level))}</span>` +
    `<span class="tot">${r.base}${r.bonus ? ` + ${r.bonus}` : ""} = <b>${r.total}</b></span></div>`;
  wrap.innerHTML = row1(0, q) + row1(1, c);
  sh.appendChild(wrap);
}
function renderPromptAndSheet(v) {
  const p = $("promptText"), sh = $("sheet");
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
      if (ui.card !== E.JIUDING && E.CARD[ui.card].scoring) scoringPanel(sh, v, E.CARD[ui.card].scoring);
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
  // While the map is in play (placing points, picking a campaign/lobby
  // target) the sheet shrinks to a mini chip so the map stays visible and
  // tappable (C2_Place/C2_Campaign) — "Expand" swaps in the full card.
  const mapActive = ui.use === "campaign" || ui.use === "lobby" || (ui.use === "place" && !(info.enemy && ui.order === "eventFirst" && !ui.pair));
  if (mapActive && !ui.chipExpanded) {
    cardChip(sh, ui.card);
  } else {
    cardHeader(sh, ui.card);
    if (mapActive) btn(sh, t("buttons.collapse"), () => { ui.chipExpanded = false; render(); }, "small");
  }
  if (ui.card !== E.JIUDING && E.CARD[ui.card].scoring) scoringPanel(sh, v, E.CARD[ui.card].scoring);
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

// mode: "full" (96x176, image + both names) or "chip" (a fixed 56px row —
// round badge + both names, no image) — picked by layoutTable() from how
// much height is actually available, never guessed here. A card's own
// colour/side styling (.card:has(.ops.q) etc. in style.css) applies to both
// shapes, so only the .chip modifier class and the markup inside differ.
function renderHand(v, mode) {
  const el = $("hand");
  // >=1024px (#7) is always "full": the short-viewport chip mode (#5, round
  // 5) exists only because a phone can run out of height for a real card —
  // the desktop sidebar never does (the map doesn't compete with the hand
  // for height there; see layoutTableDesktop()). Without this, resizing
  // from a short mobile viewport (dataset.mode left over as "chip") up past
  // 1024px would render chip-styled cards into the desktop sidebar instead
  // of the real 96x176/77x141 cards desktop.css expects.
  mode = mode || (isDesktopTable() ? "full" : el.dataset.mode) || "full";
  el.dataset.mode = mode;
  el.innerHTML = "";
  const me = game.me, ui = game.ui;
  const hand = v.hands[me] || [];
  const canPick = v.winner == null && (E.legal(v, me).kind === "action" || E.legal(v, me).kind === "headline");
  const chip = mode === "chip";
  const tile = (id, cls = "") => {
    const kind = cardSide(id);
    const b = document.createElement("button");
    b.type = "button"; b.className = `card ${chip ? "chip " : ""}${cls}`.trim();
    b.setAttribute("aria-pressed", String(ui.card === id));
    const ci = `<span class="ci"><span class="ops ${kind}">${esc(opsLabel(id))}</span><span class="nm"><span class="nm-zh" lang="zh-Hant">${esc(cardZh(id))}</span><span class="nm-en">${esc(cardEn(id))}</span></span></span>`;
    b.innerHTML = chip ? ci : `<img class="cardimg" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` + ci;
    b.disabled = !canPick;
    b.onclick = () => { game.ui = freshUi(ui.card === id ? null : id); render(); };
    el.appendChild(b);
  };
  for (const id of hand) tile(id);
  if (v.phase === "action" && E.jiudingUsable(v, me)) tile(E.JIUDING, "jiuding");
  // Desktop-only (see desktop.css, #7): the sidebar hand is a fixed grid,
  // 3 columns up to 6 cards, 4 columns (cards at ~0.8x) from 7 up (the
  // 9-card hand from turn 7 on, plus the Nine Cauldrons). No effect on
  // mobile's own horizontal-scroll .hand, which never reads this class.
  el.classList.toggle("hand-many", el.children.length > 6);
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
  $("promptText").insertAdjacentHTML("beforeend", news.length ? `<div class="news">${news.map((s) => `<div>${esc(s)}</div>`).join("")}</div>` : "");
  // Desktop-only (see desktop.css, #7): the sidebar's bottom strip condenses
  // to the single latest line (the bot's own move if it just went, else the
  // newest log entry) plus a button that opens the same #logBody panel as
  // #logToggle. Harmless on mobile: #sideFoot is display:none there.
  const latest = game.botLine || lines[0] || "";
  $("sideFootText").textContent = latest;
  $("sideFootBtn").textContent = t("buttons.logChat");
}
$("chatForm").onsubmit = (ev) => {
  ev.preventDefault();
  const text = $("chatIn").value.trim();
  if (text) send({ type: "chat", text });
  $("chatIn").value = "";
};
$("logToggle").onclick = () => { $("logBody").hidden = !$("logBody").hidden; if (game.st) renderLog(E.view(game.st, game.me)); };
$("sideFootBtn").onclick = () => { $("logBody").hidden = !$("logBody").hidden; if (game.st) renderLog(game.room ? game.st : E.view(game.st, game.me)); };

// The result screen's whole colour follows the WINNER, not your own seat
// (owner, 2026-09-19: "for win page, the background should be the winner's
// nation background") — #over.winner-qin/winner-chu carry that in
// screens.css, set here rather than through paintBody (which still colours
// the header/buttons by your own seat, unchanged for the table).
const overGlyphChar = (side) => (side === E.QIN ? "秦" : "楚");
function renderOver() {
  const st = game.st;
  const winner = st.winner;
  const lost = !game.spectator && game.me !== winner;
  const p = { winner: sideName(winner), loser: sideName(1 - winner) };
  $("overImg").src = `art/ui/win_${E.SIDES[winner]}.jpg`;
  $("overImg").style.filter = lost ? "grayscale(.85) brightness(.7)" : "";
  $("overGlyph").textContent = overGlyphChar(winner);
  $("overGlyph").classList.toggle("glyph-chu", winner === E.CHU);
  $("overGlyph").classList.toggle("glyph-qin", winner === E.QIN);
  $("overReasonTitle").textContent = t(`over.reasons.${st.reason}.title`, p);
  $("overLine").textContent = t(`over.reasons.${st.reason}.${lost ? "lose" : "win"}`, p);
  $("overBody").textContent = t(`over.reasons.${st.reason}.body`, p);
  $("overStatTurnLabel").textContent = t("tracks.turn");
  $("overStatTurn").textContent = st.turn;
  $("overStatSealsLabel").textContent = t("tracks.seals");
  $("overStatSeals").textContent = `${Object.keys(st.seals).length}${t("tracks.of")}${st.options.seals}`;
  $("overStatMieLabel").textContent = t("tracks.mie");
  $("overStatMie").textContent = `${Object.keys(st.mie).length}${t("tracks.of")}${st.options.mie}`;
  $("overStatMandateLabel").textContent = t("over.mandate");
  $("overStatMandate").textContent = mandateText(st.mandate);
  // #over.winner-chu/winner-qin (set here by #6) is also what desktop.css
  // (#7) keys its full-viewport winner-territory backdrop off — see
  // `body:has(#over.winner-chu:not([hidden]))` there. No separate
  // win-qin/win-chu body class needed.
  $("over").classList.toggle("winner-chu", winner === E.CHU);
  $("over").classList.toggle("winner-qin", winner === E.QIN);
  $("over").setAttribute("aria-label", t("over.winner", { side: sideName(winner) }));
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
  Object.assign(room, { ws, code: params.room || null, me: null, seats: [], settings: null, phase: null, fatal: false, chat: [] });
  game.room = true; game.spectator = false; game.st = null; game.ui = freshUi();
  $("lobbyGate").hidden = true; $("lobbyRoom").hidden = false;
  $("lobbyErr").hidden = true; $("lobbyHint").textContent = t("lobby.connecting"); $("lobbyCode").textContent = room.code || ""; $("lobbySeats").innerHTML = ""; $("lobbyActions").innerHTML = ""; $("lobbyChat").innerHTML = "";
  show("lobby");
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } onRoomMsg(m); };
  ws.onclose = () => { if (room.ws === ws) { room.ws = null; if (!room.fatal) { $("lobbyErr").textContent = t("lobby.closed"); $("lobbyErr").hidden = false; } } };
}
// `src/room.js` reads the seat's name off the WebSocket's own connect URL
// (see its `name = clean(url.searchParams.get("name"))`) — there is no later
// "rename" message, so the seat is taken the instant the socket opens. A
// multiplayer room with no saved name (landing's own name field was removed,
// #12) must ask first: pendingRoom holds the create/join params until the
// gate's form is confirmed, and only then does `connect` ever run.
let pendingRoom = null;
function maybeConnect(params) {
  if (store.get("zh.name", "").trim()) { connect(params); return; }
  pendingRoom = params;
  $("lobbyName").value = "";
  $("lobbyRoom").hidden = true;
  $("lobbyGate").hidden = false;
  show("lobby");
}
$("lobbyGateForm").onsubmit = (ev) => {
  ev.preventDefault();
  const name = $("lobbyName").value.trim();
  if (!name) { $("lobbyName").focus(); return; }
  store.set("zh.name", name);
  const params = pendingRoom; pendingRoom = null;
  connect(params || {});
};
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
      renderLobbyChat();
      break;
    case "log":
      room.chat = m.entries.map((e) => (e.sys ? e.text : `${room.seats[e.seat]?.name ?? ""}: ${e.text}`)).slice(-50);
      renderLobbyChat();
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
// The lobby's own chat: `room.chat` is the same running log `renderLog`
// (the table's, #5's) reads from — this just reads that same array while
// you are still in the lobby, in this file's own small element.
function renderLobbyChat() {
  const el = $("lobbyChat");
  el.innerHTML = room.chat.map((line) => `<div>${esc(line)}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}
let lobbyCopyTimer = 0;
$("lobbyCopy").onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${room.code}`;
  try { await navigator.clipboard.writeText(url); } catch { return; }
  const btn = $("lobbyCopy");
  const original = btn.textContent;
  btn.textContent = t("lobby.copied");
  clearTimeout(lobbyCopyTimer);
  lobbyCopyTimer = setTimeout(() => { btn.textContent = original; }, 1500);
};
$("lobbyChatForm").onsubmit = (ev) => {
  ev.preventDefault();
  const text = $("lobbyChatIn").value.trim();
  if (text) send({ type: "chat", text });
  $("lobbyChatIn").value = "";
};
// Seats and actions update the existing DOM nodes in place, keyed by seat
// idx / action id, instead of `innerHTML = ""` + rebuild — a room message
// arrives on every chat line, ready toggle and settings change, and tearing
// the buttons down each time flashed and dropped :hover/:focus (orchestrator,
// #6 follow-up; same reasoning as #20's fix to `seg()`, which this still
// calls unchanged for the level segmented control).
// A seat card carries its own colour by SIDE, not by "is this you" — the
// definitive lobby art (owner, C2_Lobby) is Qin-black-bronze / Chu-red-gold
// regardless of who is sitting there, matching the same two colours the
// result screen already uses per side. The host-only bot toggle lives
// *inside* the relevant seat's row (empty seat -> Add bot, bot seat ->
// Remove bot), not in the button stack below, per the same definitive
// layout — that stack, in the fix before this one, still stacked
// start/removeBot/swap/leave into ~224px and pushed the level control and
// chat off a 390x669 screen.
function renderLobbySeats() {
  const el = $("lobbySeats");
  const seen = new Set();
  const emptySide = room.seats.length ? 1 - room.seats[0].side : 1;
  const rows = room.seats.length >= 2 ? room.seats : [...room.seats, { idx: "empty", side: emptySide, empty: true }];
  for (const s of rows) {
    seen.add(String(s.idx));
    let d = el.querySelector(`[data-idx="${s.idx}"]`);
    if (!d) { d = document.createElement("div"); d.dataset.idx = s.idx; d.innerHTML = `<div class="seat-info"></div>`; el.appendChild(d); }
    const cls = "seat " + (s.side === E.QIN ? "q" : "c") + (s.empty ? " empty" : !s.connected ? " away" : "");
    if (d.className !== cls) d.className = cls;
    let html;
    if (s.empty) {
      html = `<div class="sd">${overGlyphChar(s.side)}</div><div class="who">${esc(t("lobby.empty"))}</div>`;
    } else {
      const tags = [s.side === room.me ? t("lobby.you") : "", s.idx === 0 ? t("lobby.host") : "", s.ai ? t("lobby.bot") : "", !s.connected && !s.ai ? t("lobby.away") : ""].filter(Boolean).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
      html = `<div class="sd">${overGlyphChar(s.side)}</div><div class="who">${esc(s.name)}${tags}</div><span class="status">${s.ready || s.idx === 0 ? t("lobby.ready") : t("lobby.notReady")}</span>`;
    }
    const info = d.querySelector(".seat-info");
    if (info.innerHTML !== html) info.innerHTML = html;
    let seatBtn = d.querySelector(".seat-btn");
    const wantBtn = room.isHost && room.phase !== "over" && (s.empty || (s.ai && s.idx !== 0));
    if (wantBtn) {
      const label = s.empty ? t("lobby.addBot") : t("lobby.removeBot");
      const onClick = s.empty ? () => send({ type: "addBot" }) : () => send({ type: "removeBot" });
      if (!seatBtn) seatBtn = btn(d, label, onClick, "seat-btn");
      else { if (seatBtn.textContent !== label) seatBtn.textContent = label; seatBtn.onclick = onClick; }
    } else if (seatBtn) seatBtn.remove();
  }
  el.querySelectorAll("[data-idx]").forEach((d) => { if (!seen.has(d.dataset.idx)) d.remove(); });
}
// Shared in-place sync for a row of keyed buttons — same reasoning as the
// seats above, just factored out since both the pinned primary action
// (#lobbyActions: Start/Ready/Rematch, one button) and the paired secondary
// row (#lobbySecondary: Swap + Leave, or just Leave) need it.
function syncButtons(container, desired) {
  const seen = new Set();
  for (const [key, label, onClick, cls, disabled] of desired) {
    seen.add(key);
    let b = container.querySelector(`[data-key="${key}"]`);
    if (!b) { b = btn(container, label, onClick, cls, null, disabled); b.dataset.key = key; }
    else {
      if (b.textContent !== label) b.textContent = label;
      b.onclick = onClick;
      if (b.className !== cls) b.className = cls;
      if (b.disabled !== disabled) b.disabled = disabled;
    }
  }
  let node = container.firstElementChild;
  for (const [key] of desired) {
    if (!node || node.dataset.key !== key) { const want = container.querySelector(`[data-key="${key}"]`); container.insertBefore(want, node); node = want; }
    node = node.nextElementSibling;
  }
  container.querySelectorAll("[data-key]").forEach((b) => { if (!seen.has(b.dataset.key)) b.remove(); });
}
function renderLobbyActions() {
  let primary = null;
  const secondary = [];
  if (room.phase === "over") {
    if (room.isHost) primary = ["rematch", t("lobby.rematch"), () => send({ type: "rematch" }), "primary", false];
  } else if (room.isHost) {
    const full = room.seats.length >= 2;
    primary = ["start", t("lobby.start"), () => send({ type: "start" }), "primary", !full];
    secondary.push(["swap", t("lobby.swap"), () => send({ type: "swap" }), "", false]);
  } else if (!game.spectator) {
    const me = room.seats.find((s) => s.side === room.me);
    primary = ["ready", me?.ready ? t("lobby.notReady") : t("lobby.ready"), () => send({ type: "ready", ready: !me?.ready }), "primary", false];
  }
  secondary.push(["leave", t("lobby.leave"), () => { send({ type: "leave" }); leaveRoom(); toLanding(); }, "", false]);
  syncButtons($("lobbyActions"), primary ? [primary] : []);
  syncButtons($("lobbySecondary"), secondary);
}
function renderLobby() {
  $("lobbyCode").textContent = room.code || "";
  $("lobbyHint").textContent = room.isHost ? t("lobby.hint") : t("lobby.waiting");
  renderLobbyChat();
  renderLobbySeats();
  // The bot-strength control only matters when a bot could actually be
  // seated (there's one now, or a seat is still open for one) — with two
  // human players it's dead space, and on a short phone every row of dead
  // space is a row that pushes Start below the fold (owner, C2_Lobby retry).
  const hasBot = room.seats.some((s) => s.ai), full = room.seats.length >= 2;
  const showLevel = room.isHost && room.phase !== "over" && (hasBot || !full);
  $("lobbyLevelField").hidden = !showLevel;
  if (showLevel) seg($("lobbyLevel"), [["easy", t("setup.easy")], ["normal", t("setup.normal")], ["hard", t("setup.hard")]], room.settings?.level || "normal", (v) => { if (room.isHost) send({ type: "settings", level: v }); });
  renderLobbyActions();
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
else if (params.get("create") === "1") maybeConnect({ create: "1" });
else if (params.get("room")) { const code = params.get("room").toUpperCase(); maybeConnect({ room: code, token: sess.get("zh.token." + code) || "" }); }
else {
  // The landing's Qin/Chu/Random taps preselect a side and land here; the
  // level (bot strength) is still picked on this screen.
  const side = params.get("side");
  if (side === "qin" || side === "chu" || side === "random") { setup.side = side; store.set("zh.side", side); }
  renderSetup();
  show("setup");
}
