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
import { fallbackFor } from "./shared/fallback.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";
import { mountAdvisorToggle, decorate as decorateAdvisor } from "./advisor-ui.js";
import * as Tut from "./tutorial-ui.js";
import { renderCardView, historyBox } from "./card-view.js";
import { sanitizeGaLocation } from "./ga-safe-location.js";
import { buildRoomShareUrl, readAndConsume } from "./room-url.js";
import {
  DESIGN_W, DESIGN_H, NODE_POS, nodeCenter, regionMembers, isCapital,
  renderRegionBlobs, renderRoads, REGION_LABEL_POS,
  NODE_BREAK_EN, NODE_SMALL_EN, NODE_ANCHOR, nodeLabelHTML, stabilityTagHTML,
  NODE_STAB_RIGHT, NODE_STAB_HI, NODE_PILL_POS, SEAL_MARK_POS, stateTagHTML,
} from "./map-draw.js";
import { sealProgress } from "./seal-progress.js"; // #89: 相印 progress marks on the capitals
import { computeLastMoveMarks } from "./lastmove.js";
import * as OppUI from "./oppmove-ui.js"; // #79: the opponent's-move reveal (card panel/steps/chip/sheet)
// #120: oppmove-ui.js never gets a DOM handle back into this file (its own
// header rule) -- it names its ticker's own card-naming beats with a
// .opp-ticker-card button and calls this callback, set once, when a tap
// lands on one, so those buttons open the SAME read-only peek as every
// other card name in the log/news (openPeek(), defined further down --
// function declarations are hoisted, so this call site runs fine even
// though it textually comes first).
OppUI.setOpenPeek((id, side) => openPeek(id, side));
import * as LogView from "./log-view.js"; // #88: the log panel's own rows/chips and its tap-to-flash overlay
import { discParts } from "./disc-view.js";
import * as Audio from "./audio.js";
import * as Cues from "./audio-cues.js";
import { mountAudioButton } from "./audio-switch.js";

// #62 part 2, item D: explicit (not just relying on audio.js's own default)
// -- this is the page that actually plays every one of these twelve, unlike
// the landing (landing.js sets its own single-cue list). Same list as
// before this issue; see audio.js's own comment on setWarmCues() for the
// ordering requirement (before the first gesture).
Audio.setWarmCues([
  "sfx.ui.tap", "sfx.map.place", "sfx.map.confirm", "sfx.card.pick", "sfx.card.commit",
  "sfx.card.reveal", "sfx.card.event.qin", "sfx.card.event.chu", "sfx.card.event.neutral",
  "sfx.map.opponent", "sfx.turn.new", "sfx.ui.error",
]);

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
// fits its little pill. Both languages' short forms live in i18n/*'s own
// regionShort table (zh's used to just reuse E.REGIONS[r].zh directly, since
// every region's board name was already short enough — true again as of
// #26 追加(2) except Zhou, whose full board name "周室" was too easy to
// confuse with 三晉 at a glance on a real phone; regionShort.zhou is now
// "周" and this reads it like every other region already did in English).
const regionShortName = (r) => t("regionShort." + r);
// #103: the setup prompt names the regions the engine actually allows for
// the free placement being asked (SETUP.qin.freeIn / SETUP.chu.freeIn) --
// joins their short names the way each language would say "A or B".
const orJoin = (arr) => (lang === "en"
  ? arr.length <= 2 ? arr.join(" or ") : arr.slice(0, -1).join(", ") + ", or " + arr[arr.length - 1]
  : arr.join("或"));
const stateName = (s) => (lang === "en" ? E.STATES[s].en : E.STATES[s].zh);
const cardName = (id) => (id === E.JIUDING ? (lang === "en" ? "The Nine Cauldrons" : "九鼎") : lang === "en" ? E.CARD[id].en : E.CARD[id].zh);
// #29: the card sheet shows BOTH languages' card text at once regardless of
// the UI's own language (the same convention cardName already keeps for
// bilingual names) — cardText() is the old single-language reader, still
// used by nothing else once renderPromptAndSheet moved to the pair below.
const cardTextZh = (id) => (id === E.JIUDING ? "4 點;全部用在三晉或周室視為 5。用後蓋著交給對手。" : E.CARD[id].text);
const cardTextEn = (id) => (id === E.JIUDING ? "4 ops; 5 if all of it lands in the Three Jin or Zhou. Then it passes face down." : CARD_EN[id] ?? E.CARD[id].text);
const sep = () => (lang === "en" ? ", " : "、");
const mandateText = (m) => (m > 0 ? `${sideName(0)} +${m}` : m < 0 ? `${sideName(1)} +${-m}` : "0");
const list = (ids, f) => ids.map(f).join(sep());

// #30: the header's back link is "‹ Name" as one i18n string (nav.back) —
// fine while it's plain text, but the top-bar giveaway order now needs to
// drop everything after the chevron on its own (① the advisor switch's
// label goes first, ② this is the last resort) without a second i18n key
// for just the chevron. Splitting nav.back's own text in JS (chevron, then
// whatever follows the first run of whitespace) keeps it to the one string
// i18n already has in both languages ("‹ 縱橫" / "‹ Zongheng") instead of
// adding a key neither translator has been asked for.
function renderBackLink() {
  const full = t("nav.back");
  $("backLink").querySelector(".back-label").textContent = full.replace(/^\S+\s*/, "");
  syncBackLabel();
}
// #62 part 2, item 3 (owner's ruling): once the bar is tight enough to drop
// the back link's own word (bar-tighter, see layoutBar()), "‹ Zongheng"/
// "‹ 縱橫" read aloud by itself is a decorative chevron plus a proper noun,
// not a clear "this goes home" -- nav.home ("Home"/"回首頁") replaces the
// aria-label/title only in that squeezed state; the full text (visible AND
// spoken) is unchanged otherwise. Re-run from layoutBar() every time it
// re-decides bar-tighter, not just from renderBackLink()'s own language
// switch, since the squeeze can flip on a resize with no language change.
function syncBackLabel() {
  const tightened = document.querySelector(".bar")?.classList.contains("bar-tighter");
  const label = tightened ? t("nav.home") : t("nav.back");
  $("backLink").setAttribute("aria-label", label);
  $("backLink").title = label;
}
function setLang(l) {
  lang = LANGS[l] ? l : "en";
  S = LANGS[lang];
  store.set("zh.lang", lang);
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "Zongheng 縱橫" : "縱橫 Zongheng";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  renderBackLink();
  audioBtn.sync();
  $("chatIn").placeholder = t("lobby.say");
  $("lobbyChatIn").placeholder = t("lobby.say");
  renderSetup();
  if (game.st) { render(); if (game.st.winner != null) renderOver(); }
  layoutBar(); // #62 part 2: keeps the back link's squeezed-vs-full aria-label/title in sync even on a view with no game.st yet (setup/lobby)
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));
// The advisor's own switch (issue #18): mounted once here; its own
// visibility (solo table only) and everything it draws live in
// advisor-ui.js, driven by the decorateAdvisor() call at render()'s tail.
mountAdvisorToggle($("advisorSlot"));
// #62 part 2 (owner's revision): the one sound button, in the bar's first
// row, before 紀錄 -- present on every view this page has (setup/lobby/
// table/over all share this one <header>), no table-lock needed.
const audioBtn = mountAudioButton($("audioBtnSlot"), t);

// ---------- views ----------
// The page's whole colour follows the side: the setup screen re-skins by
// whichever side is picked (Qin black, Chu lacquer red, Random parchment);
// once seated, the table and result screens follow the seat instead.
function paintBody(view) {
  document.body.classList.remove("setup-qin", "setup-chu", "setup-random", "side-qin", "side-chu");
  if (view === "setup") document.body.classList.add("setup-" + setup.side);
  else if ((view === "table" || view === "over") && !game.spectator) document.body.classList.add(game.me === 0 ? "side-qin" : "side-chu");
}
// #111: the funnel GA needs (landing -> setup -> table -> end) is invisible
// to a default pageview install, since this whole app is one document that
// never navigates once play.html has loaded. Fire one custom event per
// funnel step, on the view actually changing (not on every show() call for
// a view already showing -- botLoop() and friends call show("table") again
// mid-game). No room code, name or save contents in the payload: just which
// screen. "over" is named "end" to match the brief's own funnel names.
const VIEW_EVENT = { setup: "view_setup", table: "view_table", over: "view_end" };
function trackView(view) {
  const name = VIEW_EVENT[view];
  if (!name || typeof gtag !== "function") return;
  // document.title is always one of the two fixed "Zongheng 縱橫"/"縱橫
  // Zongheng" strings (see setLang() above) -- never a room code or a
  // player's name -- so it needs no sanitizing, just stating here.
  gtag("event", name, { page_location: sanitizeGaLocation(location.href), page_title: document.title });
}
function show(view) {
  for (const v of ["setup", "lobby", "table", "over"]) $(v).hidden = v !== view;
  window.scrollTo(0, 0);
  const prevView = document.body.dataset.view;
  // Desktop-only (see desktop.css, #7): which backdrop/frame the page-card
  // shell gets follows the active view. Mobile never reads this attribute.
  document.body.dataset.view = view;
  if (view !== prevView) trackView(view);
  paintBody(view);
  // The table is a fixed one-screen layout (header -> mandate -> map ->
  // stat line -> prompt -> hand): it never scrolls, on 375x667 or 390x844,
  // by giving #table the rest of the viewport height via flex and letting
  // the map (the one flexible piece) shrink first.
  document.body.classList.toggle("table-lock", view === "table");
  updateSceneMusic();
  updateUnderlay(); // #64: leaving the table (or never having been on it) is always "no tension layer"
}
// #62: the one scene cue playing right now, recomputed on every view
// transition (show(), above) AND on every table render (era/winner can
// change mid-table without a view transition -- see render()'s own call at
// its tail). sceneFor() itself has no idea about missing cues -- that
// decision is entirely audio.js's setScene() now (item B's static table for
// bgm.setup, plus the `fallbackCue` given here for the tutorial, since its
// own substitute needs the seat, which setScene()'s static table can't
// carry). #62 part 2, item E: this used to peek at Audio.getManifest()
// itself and decide "missing" from a snapshot that could still be null
// before the very first fetch resolved -- if that first guess landed on the
// fallback, nothing ever re-asked once the real file arrived. Always ask
// for what sceneFor() actually says (`bgm.tutorial` while touring) and let
// setScene() resolve missing-vs-not AFTER it has genuinely awaited the
// manifest, every single call.
function updateSceneMusic() {
  const view = document.body.dataset.view;
  const tutorial = Tut.active();
  // st.era is null until turn 1 actually starts (createGame() leaves it null
  // through the opening setup placement, engine.js's own `turn: 0, era:
  // null`) -- the table is already showing by then, so default to reform
  // (the era the game is about to enter) rather than asking for a
  // "bgm.table.null.<seat>" cue that can never exist.
  const era = (game.st && game.st.era) || "reform";
  const winner = game.st ? game.st.winner : null;
  const me = game.spectator ? null : game.me;
  const cue = Cues.sceneFor({ page: view, era, me, winner, tutorial });
  if (tutorial) Audio.setScene(cue, { fallbackCue: `bgm.table.reform.${E.SIDES[game.me]}`, fallbackGainMul: 0.6 });
  else Audio.setScene(cue);
}
// #64: the low heartbeat layer under the table music, wholly separate from
// the scene above -- on the table only, never in the tutorial, and null the
// moment the game is over (tensionFor() itself already says false once
// `v.winner` is set, so the ending's own piece plays alone, per the issue).
// `v` is either the full state or a per-seat view of it -- both carry the
// public fields dangerFlags() reads (seals/mie/mandate/weariness/turn/
// options/winner) -- so a spectator's own `v` drives this exactly the same
// way a player's does: a spectator hears it too, per the issue. Called with
// no `v` from show() itself (every OTHER page, and the instant before a
// table render has even happened): document.body.dataset.view isn't
// "table" there, so it short-circuits before ever touching `v`.
function updateUnderlay(v) {
  const view = document.body.dataset.view;
  if (Tut.active() || view !== "table") { Audio.setUnderlay(null); return; }
  Audio.setUnderlay(Cues.tensionFor(v) ? "bgm.tension" : null);
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
// A picture tile per side (art/ui/qin.jpg, chu.jpg), plus a split tiger/
// phoenix "random" tile — the selected one gets a thick border and full
// opacity, the way the C2 setup mockups (C2_SetupQin/Setup/SetupRandom)
// show all three at once. Built once; later calls (a pick, a language
// switch) only update aria-pressed and text nodes in place — the <img> is
// never re-created, so it never re-decodes and never flickers (#20).
// #42: a side tile says its side once — the glyph plus the stance — and
// drops the small repeated name under it (only the random tile still
// carries a .tname line). In English, which can't read the glyph, the
// stance line itself carries the name too ("Qin · the Horizontal").
const SIDE_TILES = ["qin", "chu", "random"];
function renderSideTiles() {
  const el = $("sideTiles");
  const pick = (v) => { setup.side = v; store.set("zh.side", v); renderSetup(); };
  if (el.childElementCount !== SIDE_TILES.length) {
    el.innerHTML = "";
    for (const v of SIDE_TILES) {
      const b = document.createElement("button");
      b.type = "button"; b.className = `tile ${v}`;
      if (v === "random") {
        const half = (side, cls) => { const img = document.createElement("img"); img.className = `tile-half ${cls}`; img.src = `art/ui/${side}.jpg`; img.alt = ""; return img; };
        const seam = document.createElement("span"); seam.className = "tile-seam";
        const q = document.createElement("span"); q.className = "tile-q"; q.textContent = "?";
        b.append(half("qin", "tile-half-l"), half("chu", "tile-half-r"), seam, q);
      } else {
        const img = document.createElement("img");
        img.src = `art/ui/${v}.jpg`; img.alt = "";
        b.appendChild(img);
      }
      const info = document.createElement("span"); info.className = "tile-info";
      if (v === "random") {
        const tname = document.createElement("span"); tname.className = "tname";
        info.appendChild(tname);
      } else {
        const tg = document.createElement("span"); tg.className = "tg"; tg.lang = "zh-Hant";
        info.appendChild(tg);
      }
      const ttag = document.createElement("span"); ttag.className = "ttag";
      info.appendChild(ttag);
      b.appendChild(info);
      b.onclick = () => pick(v);
      el.appendChild(b);
    }
  }
  SIDE_TILES.forEach((v, i) => {
    const b = el.children[i];
    b.setAttribute("aria-pressed", String(setup.side === v));
    const tag = v === "random" ? t("setup.randomTag")
      : lang === "en" ? `${t(`sides.${v}`)} · ${t(`side.${v}.headline`)}`
      : t(`side.${v}.headline`);
    // textContent's setter unconditionally replaces the text node (a
    // childList mutation) even when the string is unchanged, so guard each
    // one — a side/level pick never changes another tile's text, and only
    // a language switch should touch these (#20).
    const tt = b.querySelector(".ttag");
    if (tt.textContent !== tag) tt.textContent = tag;
    if (v === "random") {
      const tn = b.querySelector(".tname");
      const tname = t("setup.random");
      if (tn.textContent !== tname) tn.textContent = tname;
    } else {
      const tg = b.querySelector(".tg");
      const glyph = v === "qin" ? "秦" : "楚";
      if (tg.textContent !== glyph) tg.textContent = glyph;
    }
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
// #97: startSolo() used to overwrite `zh.solo` the instant Start was pressed
// -- silently, even with an unfinished game still in it. loadSolo()/
// resumeSolo()/startSolo() itself are all defined further down (function
// declarations, hoisted -- safe to call from here regardless of order).
$("btnStart").onclick = () => {
  const saved = loadSolo();
  if (saved) { showSoloConfirm(saved); return; }
  startSolo();
};

// ---------- the solo game ----------
// `peek` (#34): the read-only card sheet's own state — { card, side } for
// the card someone tapped in the log/news, or null. Deliberately its own
// top-level field, never inside `game.ui` (which humanAct/Cancel/headline
// reject/etc. all wholesale-replace with freshUi()) — a peek must survive
// every one of those resets untouched, since it doesn't represent anything
// about the player's own turn.
const game = { st: null, me: 0, level: "normal", rng: null, ui: null, botLine: "", botName: "", room: false, spectator: false, peek: null };
// #53 round 2 (orchestrator's review): `botLine` alone never reached the table
// itself, only the closed log panel / a desktop-only sidebar strip -- so on
// the phone neither a replaced move nor a genuinely stuck game said anything
// where the player was actually looking. Two more fields, both client-side,
// both cleared the moment they stop being current:
// `fallbackNote` -- the sentence for a replaced move, shown as the newest
//   line of the news strip under the prompt (renderLog() below) until the
//   player's own next action or the next bot line, whichever first.
// `stuck` -- true once a bot turn found no accepted move at all, even from
//   the fallback net; renderPromptAndSheet()'s "wait" branch reads it to
//   show the stuck sentence instead of "Waiting for {name}..." -- the exact
//   text `game.botLine` already carries in that case, on the same seat's
//   screen, not merely logged for later.
game.fallbackNote = "";
game.stuck = false;
// #41: the last-move mark on the map -- { [spaceId]: {delta} | {destroyed} }
// for every space whose influence/control/destroyed-state changed in the
// last resolved action, plus a one-shot flag so the pulse plays exactly
// once (see computeLastMoveMarks/render/clearLastMoveMarks below). Kept on
// `game`, not local to render(), because a tap must be able to clear it
// (clearLastMoveMarks) without going through a full render() itself.
game.lastMoveMarks = {};
game.lastMoveFresh = false;
// #62 part 2, item A: the danger flags heard as of the last render (so
// sfx.warn fires only on a flag's FIRST appearance, never every render
// while it's still true) and the prompt's own legal.kind as of the last
// render (so sfx.turn.yours fires only on the wait -> your-decision edge,
// never on every render while it's already your decision).
game.lastDangerFlags = [];
game.lastLegalKind = null;
// #62 part 2 fix 3: every place voicing keeps state ACROSS renders has to be
// cleared wherever a game genuinely starts or resumes (startSolo/resumeSolo,
// and connect()'s first "view" for a room), not left to the log index
// happening to go backwards -- a fresh solo game replacing one that ended
// at, say, log index 5 starts its own index back near 0, so that still
// resets correctly on its own; but a RESUMED game or a room's own log can
// start well above 0, and without this, entries already in it (or a
// mid-sequence rate/last-second) would be treated as "new" or "still
// ticking" the moment the first render/interval tick runs. A function
// declaration (hoisted) so it can be called from startSolo() etc., which
// are defined earlier in this file than placeTapSpace/placeTapStreak/
// lastClockS themselves (all still fine: this body only runs once called,
// long after the whole module's top-level `let`s have initialized).
function resetVoicingState() {
  game.lastView = null;
  game.lastDangerFlags = [];
  game.lastLegalKind = null;
  placeTapSpace = null; placeTapStreak = 0;
  lastClockS = null;
  OppUI.reset(); // #79: a new/resumed game, or a room's first view, has nothing "new" to reveal yet
}
// Per-tab: the reconnect token, so two tabs in one browser are two players.
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
// #71 (owner, iPhone screenshot): an opponent's card used to open with
// order already defaulted to "opsFirst" -- pressed before the player ever
// decided, so Confirm could go through and the advisor's suggestion ring
// couldn't be told apart from a real press. `order` now starts unchosen;
// every reader below treats null as "not decided yet", never as opsFirst.
// #92: `historyOpen` lives here (not a module-level flag) so a brand-new
// card page (freshUi(id) — see the "Card"/看牌 toggle below) always opens
// collapsed, while re-renders of the SAME card page (the advisor's text
// arriving, a language switch) keep whatever the player already chose —
// nothing here resets it except a genuinely fresh freshUi() call.
// #100: `useWarn`/`useWarnPulse` back the "pick a use first" warning (see
// flashUseWarning() below) -- both false on every fresh card/reset, same as
// `err`.
// #117: `noPair` is 說客's own explicit "don't pair" choice -- a THIRD state
// alongside `pair` (chosen enemy card) and both null (undecided), never
// folded into `pair` itself (a sentinel string there would reach
// `E.opsOf(game.st, game.me, game.ui.pair)` a few lines down and blow up on
// a non-card id). Only ever true for 說客; every other card leaves it false
// and never reads it.
const freshUi = (card = null) => ({ card, use: null, order: null, pair: null, noPair: false, points: [], target: null, picks: [], opsUse: null, err: "", historyOpen: false, useWarn: false, useWarnPulse: false });

function startSolo() {
  game.room = false; game.spectator = false;
  game.me = setup.side === "random" ? (Math.random() < 0.5 ? 0 : 1) : setup.side === "qin" ? 0 : 1;
  game.level = setup.level;
  game.st = E.createGame(E.randomSeed(), {});
  game.rng = E.makeRng(E.randomSeed());
  game.ui = freshUi();
  game.botLine = ""; game.seenLog = 0;
  game.fallbackNote = ""; game.stuck = false;
  game.botName = S.names[E.SIDES[1 - game.me]][0];
  game.auto = new URLSearchParams(location.search).has("auto");
  resetVoicingState(); // #62 part 2 fix 3
  setLogOpen(false);
  show("table"); render(); botLoop();
}
// A solo game is kept in this browser so a reload, or a phone that drops the
// tab, does not lose an hour of play.
const SAVE = "zh.solo";
function saveSolo() {
  if (game.room || !game.st || Tut.active()) return; // tutorial never reads/writes zh.solo (#15)
  if (game.st.winner != null) { try { localStorage.removeItem(SAVE); } catch {} return; }
  store.set(SAVE, JSON.stringify({ st: game.st, me: game.me, level: game.level, rng: game.rng.getState(), seenLog: game.seenLog || 0 }));
}
function loadSolo() {
  try { const s = JSON.parse(store.get(SAVE, "null")); return s && s.st && s.st.winner == null ? s : null; } catch { return null; }
}
function resumeSolo() {
  const s = loadSolo();
  if (!s) return;
  Object.assign(game, { room: false, spectator: false, st: s.st, me: s.me, level: s.level, rng: E.makeRng(0), ui: freshUi(), botLine: "", fallbackNote: "", stuck: false, seenLog: s.seenLog, auto: false });
  game.rng.setState(s.rng);
  game.botName = S.names[E.SIDES[1 - game.me]][0];
  resetVoicingState(); // #62 part 2 fix 3: nothing from the resumed log/state is "new" this render
  show("table"); render(); botLoop();
}
// #97: pressing Start on the setup screen while a save exists used to
// overwrite it without asking. This is the page's own sheet/modal (not
// window.confirm), built once and reused -- style.css's .confirm-backdrop/
// .confirm-sheet give it the same parchment-on-scrim look the rest of the
// page uses for an overlay, rather than a bare OS dialog.
function ensureSoloConfirm() {
  let el = $("soloConfirm");
  if (el) return el;
  el = document.createElement("div");
  el.id = "soloConfirm";
  el.className = "confirm-backdrop";
  el.hidden = true;
  el.innerHTML = `<div class="confirm-sheet" role="dialog" aria-modal="true">
    <p class="confirm-text" id="soloConfirmText"></p>
    <div class="confirm-actions">
      <button type="button" id="soloConfirmResume" class="primary"></button>
      <button type="button" id="soloConfirmNew"></button>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", (e) => { if (e.target === el) hideSoloConfirm(); });
  return el;
}
function hideSoloConfirm() { const el = $("soloConfirm"); if (el) el.hidden = true; }
function showSoloConfirm(saved) {
  const el = ensureSoloConfirm();
  $("soloConfirmText").textContent = t("setup.overwriteWarn", { n: saved.st.turn });
  const resumeBtn = $("soloConfirmResume"), newBtn = $("soloConfirmNew");
  resumeBtn.textContent = t("buttons.resumeSolo");
  newBtn.textContent = t("buttons.newGame");
  resumeBtn.onclick = () => { hideSoloConfirm(); resumeSolo(); };
  newBtn.onclick = () => { hideSoloConfirm(); startSolo(); };
  el.hidden = false;
}
function humanAct(action) {
  if (game.spectator) return;
  OppUI.onAction(); // #79: a real action ends the reveal/chip at once, before anything else runs
  // The tutorial's gate (#15): refuses anything but the current lesson's own
  // move, legal or not, so a script step is the only thing that can land.
  if (Tut.active() && !Tut.allowsAction(action)) { game.ui.err = t("tutorial.wrong"); render(); return; }
  // Everything logged after this point is "what happened since you last acted".
  game.seenLog = game.st.logSeq || 0;
  if (game.room) { send({ type: "act", action }); game.ui = freshUi(); render(); return; }
  try { game.st = E.apply(game.st, { ...action, side: game.me }); }
  catch (e) { game.ui.err = e.message; render(); return; }
  game.ui = freshUi();
  game.fallbackNote = ""; // the player just acted: a replaced bot move is no longer news
  saveSolo();
  render();
  if (Tut.active()) Tut.afterAction(); else botLoop();
}
let botTimer = 0;
function botLoop() {
  clearTimeout(botTimer);
  if (game.room || Tut.active()) return;
  const st = game.st;
  if (st.winner != null) { saveSolo(); renderOver(); return; }
  // `?auto` (a development aid) lets the bot play the human seat too, so a
  // whole game can be watched in the client.
  const need = E.mustAct(st);
  const bot = need.includes(1 - game.me) ? 1 - game.me : game.auto && need.includes(game.me) ? game.me : null;
  if (bot == null) return;
  botTimer = setTimeout(() => {
    const a = B.decide(E.view(game.st, bot), bot, game.level, game.rng);
    let applied = null;
    if (a) { try { applied = E.apply(game.st, a); } catch (e) { console.error(e); } }
    if (applied) {
      game.st = applied;
      game.stuck = false;
      if (bot !== game.me) { game.botLine = describeAction(a); game.fallbackNote = ""; }
      saveSolo();
      render();
      botLoop();
      return;
    }
    // The bot returned nothing, or the engine refused it (logged above when
    // it threw). Either way the table cannot just sit there: fall back to
    // the engine's own safety net (#53 part 1) so the game keeps moving, and
    // say so where the player can see it -- this is a client-side notice,
    // not the room's own log (that one is #53 part 1's `describe()`, and it
    // is not ours to write into). `fallbackNote` (round 2) is what actually
    // reaches the table: renderLog() below writes it into #fallbackBanner,
    // a sibling of #promptText the player sees without opening 記錄, on the
    // phone or on desktop alike (#53 part 2 gave it that own home; it is no
    // longer folded into the news strip under the prompt) -- `botLine` alone
    // only ever reached the closed log panel / desktop sidebar foot.
    const fb = fallbackFor(game.st, bot);
    if (fb) {
      game.st = fb.state;
      game.stuck = false;
      if (bot !== game.me) { game.botLine = t("sys.fallback", { action: actionText(fb.action) }); game.fallbackNote = game.botLine; }
      saveSolo();
      render();
      botLoop();
      return;
    }
    // No candidate the engine accepts either: the game is genuinely stuck
    // (e.g. #55). Show it plainly rather than freezing on nothing, and stop
    // the loop -- do not touch game.st, so the existing save (bot still to
    // act) resumes straight back into this same branch and shows the same
    // line again, instead of silently repeating the dead end. `game.stuck`
    // (round 2) is what makes it land ON the prompt itself, in place of
    // "Waiting for {name}..." -- see renderPromptAndSheet()'s "wait" branch.
    // The player's own way out from here is the header's back link (#backLink,
    // play.html): always present, never hidden by this state.
    game.stuck = true;
    if (bot !== game.me) game.botLine = t("sys.stuck");
    saveSolo();
    render();
  }, game.auto ? 120 : 700);
}
function actionText(a) {
  // #60: `prompt.headline` is the instruction shown to the PLAYER during
  // their own headline phase ("Commit one card face down..."); actionText()
  // feeds both describeAction() ("{botName}: {actionText}", the sidebar
  // foot / log panel line for what the bot just did) and sys.fallback's
  // {action} -- reusing prompt.headline there made both read as if the
  // instruction itself were the bot's move. `prompt.headlineDone` is a
  // short phrase (no subject, matching this function's other branches,
  // which never name the actor) that names WHAT HAPPENED instead; the
  // card stays secret either way (headline() never took a card arg here).
  if (a.type === "headline") return t("prompt.headlineDone");
  if (a.type === "choose") return "…";
  return `${cardName(a.card)} · ${t(`useNames.${a.use || "event"}`)}${a.pair ? ` + ${cardName(a.pair)}` : ""}`;
}
function describeAction(a) {
  return `${game.botName}: ${actionText(a)}`;
}

// ---------- rendering ----------
// #30: the table's own header row is now [‹ Name] …… [Log][Advisor][Rules]
// [lang], one line, 48px on a touch device / 40px once desktop.css's
// >=1024px rule takes over (body[data-view="table"] .bar, style.css +
// desktop.css) -- #barMid's old "Turn N · Side" text is GONE from ordinary
// play (render() below no longer writes it; the next line already repeats
// it), so it no longer needs a squeeze priority of its own there. #barMid
// still holds two things this function must never squeeze away: the
// tutorial's "Lesson n/10" (its only home, and the advisor switch never
// shows during a tutorial so there's always room), and a room's live
// per-turn countdown clock (the setInterval near the bottom of this file) --
// for that second one only, if the row still doesn't fit, hiding it is the
// first thing to give way, same as it always was.
// When #barMid isn't enough (or has nothing in it), two more steps, applied
// by measuring after each one and only taking the next if still over
// budget -- guessing a width breakpoint would depend on the current
// language's string lengths, which is exactly what grew `.bar` past its
// budget in the first place (#24). #101 (owner's sweep, en 390/375/320):
// style.css's own letter-spacing/gap/padding trims for the table bar are
// meant to close the gap on their own at 390 and 375 -- neither step below
// should even fire there. At 320, one step is still expected, and it must
// be the back link's, not the advisor switch's: a bare chevron is still a
// findable "go back", but an unlabelled switch with no visible name isn't
// findable at all (#101's own wording) -- so the order flipped from #30's
// original (advisor label first, back label last):
//   1. drop everything after the back link's chevron (.bar-tighter)
//   2. drop the advisor switch's own label, keep just its track (.bar-tight)
// Overflow shows up two different ways depending on what's left to give:
// while #barMid (or an un-shrunk label) still has room to wrap, the ROW
// grows taller (its own children stack, .bar's height passes budget); once
// nothing left CAN wrap (every remaining child is a real button/link that
// refuses to shrink below min-content), the row instead just bleeds past
// the viewport's right edge at the SAME height (`flex-wrap` was never set,
// so nothing forces a second line) -- caught #30 round 1 at 360px English
// with the advisor on: .bar stayed 48px while #langBtn's own right edge
// sat past `innerWidth`. Checking both keeps this from only firing on the
// first kind.
function barOverflowing(bar, budget) {
  if (bar.getBoundingClientRect().height > budget + 1) return true;
  const right = bar.getBoundingClientRect().right;
  for (const k of bar.children) if (k.getBoundingClientRect().right > right + 0.5) return true;
  return false;
}
function layoutBar() {
  const bar = document.querySelector(".bar"), mid = $("barMid");
  if (!bar || !mid) return;
  const tut = Tut.active();
  // #101 (orchestrator, #97's own confirm-dialog screenshot): every
  // NON-table view (setup/lobby/over/rules) keeps the original 54px bar
  // (44px button + 10px top padding + 0 bottom -- style.css's own comment
  // on body[data-view="table"] .bar, and desktop.css only ever overrides
  // the TABLE view's bar height, never this one -- every other view stays
  // the mobile 390-wide column even on desktop, per that file's own header
  // comment). The budget used to be a flat 48/40 regardless of view, so
  // barOverflowing()'s own height check (bar taller than budget+1) was
  // true here BEFORE this function ever looked at a single child's width --
  // setup's bar always measured 54px, always over a 48px budget, so the
  // back link lost its label on every load, at any width, in either
  // language, four items or not. Only the table view (`table-lock`, set
  // together with `data-view="table"` by show()) ever actually gets the
  // shorter bar this function was written for.
  const tableBar = document.body.classList.contains("table-lock");
  const desktop = window.matchMedia("(min-width: 1024px)").matches;
  const budget = tableBar ? (desktop ? 40 : 48) : 54;
  mid.hidden = false;
  bar.classList.remove("bar-tight", "bar-tighter");
  if (!tut && mid.textContent && barOverflowing(bar, budget)) mid.hidden = true;
  if (barOverflowing(bar, budget)) bar.classList.add("bar-tighter");
  if (barOverflowing(bar, budget)) bar.classList.add("bar-tight");
  syncBackLabel(); // #62 part 2: aria-label/title follow whichever squeeze stage this just landed on
}
let lastUiErr = ""; // #62: sfx.ui.error fires once per NEW error text, not once per render while it's showing
function render() {
  // #62: every game.ui.err assignment (humanAct's catch, the tutorial's own
  // wrong-tap message, a room's rejected action) calls render() right after
  // -- so this one place catches all of them, including the table's own
  // "tap a lit place" message, without touching any of those call sites.
  if (game.ui && game.ui.err && game.ui.err !== lastUiErr) Audio.play("sfx.ui.error");
  lastUiErr = (game.ui && game.ui.err) || "";
  // #34: redraw the read-only peek sheet from `game.peek` on every render —
  // never from `v` or anything else render() computes below, so a language
  // toggle (setLang() calls render() when a game is on) keeps an open
  // peek's text in sync without this touching game.ui or any other state a
  // peek must leave untouched. A no-op render (game.peek still null) just
  // re-confirms #peekSheet stays hidden.
  renderPeek();
  // The whole page's accent (buttons, pressed hand card, the block below the
  // map) follows whichever court you sit in; paintBody() sets this once the
  // seat is known (see show()). A spectator gets the neutral default.
  if (!$("table").hidden) paintBody("table");
  // In a room the state on hand is already this seat's view.
  const prevView = game.lastView; // #41: the view from just before this action, read BEFORE it's overwritten below
  const v = game.room ? game.st : E.view(game.st, game.me);
  game.lastView = v; // layoutTable() re-renders the hand off this if it flips full<->chip
  updateLastMoveMarks(prevView, v); // #41 — renderMap()/decorateAdvisor() below read game.lastMoveMarks off this
  // #62 part 2, item A + fix 1: one combined decision, one combined
  // playBatch() call, covering both the spectator and the player branches
  // below (a spectator never gets `yours` -- game.spectator gates it here,
  // not by omission further down). `yours` is a pure function of `v`/seat,
  // so it's safe to decide before the branch split even though the ORIGINAL
  // prompt text it corresponds to isn't drawn until renderPromptAndSheet()
  // runs, later, in the non-spectator branch only.
  const audioMe = game.spectator ? null : game.me;
  const boardCues = voiceBoardAudio(prevView, v, audioMe);
  const yours = !game.spectator && v.winner == null && yoursFires(v, game.me);
  const voiced = boardCues.cues.slice();
  // S5: the horn (sfx.turn.headline, part of a `turn` entry's own three
  // cues) already IS the call to act -- sfx.turn.yours is only for the
  // ordinary wait -> your-decision edge that happens WITHOUT a fresh turn
  // bell (the opponent/bot just finished their action round, and now it's
  // this seat's turn to answer, mid-turn).
  if (yours && !boardCues.hasOver && !boardCues.hasTurn) {
    if (voiced.length) voiced.push("sfx.turn.yours"); // end of the batch, same 180ms spacing
    else Audio.play("sfx.turn.yours"); // no batch this render: plays at once, as before
  }
  if (voiced.length) Audio.playBatch(voiced);
  // #30 (owner, iPhone repro): "Turn N · Side" duplicated the topbar's own
  // "Turn N · Era · Action X/Y" line right below it — dropped from ordinary
  // play; the tutorial's "Lesson n/10" is #barMid's only remaining content
  // here (a room's countdown clock writes its own text on top of this from
  // its own setInterval, independently of render()).
  $("barMid").textContent = Tut.active() ? Tut.barText() : "";
  layoutBar();
  renderTopBar(v);
  if (game.spectator) {
    setSheetOpen(false);
    renderMap({ ...v, winner: 0 }); // nothing lit
    game.lastMoveFresh = false; // #41: the pulse (if any) has now been drawn once — see updateLastMoveMarks()
    renderStatLine(v);
    $("promptText").textContent = ""; $("sheet").innerHTML = ""; $("hand").innerHTML = "";
    renderLog(v);
    fitMap(); // after every sibling has its final flex size, so the map's own box is final too
    decorateAdvisor(v, { solo: false, side: game.me });
    updateSceneMusic(); // a spectator's era/winner can still change the scene
    updateUnderlay(v); // #64: a spectator hears the tension layer too
    OppUI.disable(); // #79: never for a spectator
    return;
  }
  // Computed before renderMap so a scoring card selected this same render
  // already lights up its region, not one render-cycle late.
  scoreHighlight = game.ui.card != null && game.ui.card !== E.JIUDING && E.CARD[game.ui.card].scoring ? E.CARD[game.ui.card].scoring : null;
  renderMap(v);
  game.lastMoveFresh = false; // #41: same reason as the spectator branch above
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
  // The advisor's own decoration pass (issue #18): everything it draws lives
  // in advisor-ui.js, which no-ops (and calls advise() zero times) unless
  // solo is true and its own switch is on. Called BEFORE layoutTable() (not
  // after, as issue #18 first landed it): the owner's ruling (orchestrator's
  // 2nd-round review) is that the suggestion banner is a normal flow row,
  // not a floating overlay, so its own box has to exist at whatever size
  // it's going to be before layoutTable() can measure the chrome it leaves
  // for the map/hand — see the "advisorBanner" id added to that sum below.
  decorateAdvisor(v, {
    solo: !game.room && !game.spectator && !Tut.active(), side: game.me, uiCard: game.ui.card,
    pickedSpaces: (game.ui.picks && game.ui.picks.length ? game.ui.picks : game.ui.points) || [],
    t, spaceName, stateName, regionName, cardName, sep,
    // Round 1 review (#39, item 3 — a pre-existing defect, not new here):
    // a genuinely new position's real advice text arrives async (advise()
    // itself can take real time — see advisor-ui.js's own setTimeout), so
    // THIS render's layoutTable() call below still measures the banner at
    // its short synchronous placeholder size. On English, advisor on, that
    // placeholder-vs-real gap was enough to leave the sheet/hand 11px below
    // a screen layoutTable() had already decided didn't need to scroll —
    // fixed on the NEXT render only, because by then the answer is cached
    // and arrives synchronously. advisor-ui.js calls this back once the
    // real text (and the banner's real height) is actually in the DOM, so
    // this same render's layout gets corrected without waiting for another
    // click; layoutTable() itself already avoids rebuilding the hand/sheet
    // except an actual chip<->full mode flip (unchanged, existing rule).
    layoutTable,
  });
  layoutTable(); // the map's real box depends on the hand's, so both are sized together, then fitMap() scales the map's content
  Tut.decorate(); // no-op unless a tutorial is running (#15)
  updateSceneMusic(); // era change (turn 4/7) or the game ending can happen mid-table, without a show() transition
  updateUnderlay(v); // #64: same reasoning -- a new danger flag or the game ending can land mid-table too
  // #79: never during the tutorial (the coach drives the tutorial) -- called
  // last, after layoutTable()/fitMap(), so the map/statline/mandate rects it
  // reads (via data-space/data-stat) are this render's real, final ones.
  if (Tut.active()) OppUI.disable();
  else OppUI.sync(v, { me: game.me, lang, mapTargeting: game.ui.card != null && !wantsCardOverlay(v), acted: game.ui.card != null, lastMoveMarks: game.lastMoveMarks });
}
// The map's scale is the viewport-width ratio (DESIGN_W is the mockup's own
// canvas width) UNLESS that would leave no room at all for a shown hand, in
// which case scale gives up only down to FLOOR_SCALE. A real 375-390px-wide
// phone never needs the floor; only a short one (e.g. 390x669 with iOS
// Chrome's toolbars up) does. Below the floor, it's the hand's card ART that
// concedes further (see CARD_H below), never the map — a fixed short
// viewport (no scrolling allowed) has to put the shortfall somewhere, and
// the map's drawn spec is the one thing that must never move.
//
// #39 round 2 review (owner's own ruling): FLOOR_SCALE used to be set by
// disc/name legibility (30/34px design discs -> a 28/32px drawn floor) — the
// owner's call this round is that the HIT BUTTON size (see HIT_SIZE below)
// is the one binding floor, not disc legibility, and moved it down to
// exactly MIN_HIT (40px) to free the ~40px of slack (390x669/375x667) that
// parts 2-4's own chrome growth (mandate bar, statline, pills) needed and
// didn't have. The disc/name themselves shrink a little further below their
// old 28/32px floor at this new scale — accepted, per that ruling, since
// nothing about them is a tap target.
const HIT_SIZE = 47; // design px — see its own fuller comment at renderMap() below
const MIN_HIT = 40; // round 2's own floor: never below this real css px
const FLOOR_SCALE = MIN_HIT / HIT_SIZE;
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
  // #80: a resize from phone width to desktop width without a reload can
  // leave #lowerBlock carrying the mobile branch's own inline
  // `style.flex` (below, this file) — harmless once desktop.css makes
  // #lowerBlock `display: contents` (box-model properties don't apply to
  // a contents box), but cleared here too so no stale inline style
  // survives on the element itself.
  $("lowerBlock").style.flex = "";
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
// #68 (owner: "地圖大小應固定"): the map used to recompute its scale from
// whatever height #prompt/#sheet/#advisorBanner happened to render at —
// which meant a one-line vs two-line advice sentence, a longer news strip,
// a phase with no hand, or a pending choice all changed the map's own box.
// The fix keeps the OLD idea (map first, then a give-way cascade for
// whatever's left) but flips what's fixed and what's negotiable: the map's
// scale now depends only on the viewport (availW/availH) and the two rows
// that never change shape from one render to the next — #topbar and
// #statline (their real heights are still measured live, since a language
// switch can change them, but nothing else render-to-render does) — MINUS
// LOWER_BLOCK_H, a constant, not a measurement. Everything that used to
// compete with the map for height (#prompt/#advisorBanner/#sheet/#hand) now
// lives inside #lowerBlock (play.html), whose own CSS height layoutTable()
// pins to that same constant every pass, and negotiates ONLY among
// themselves for whatever fits inside it — never touching map/mapH again.
//
// LOWER_BLOCK_H was picked (not measured) against the orchestrator's table
// walk at 390x669 zh / 375x667 en, advisor on and off — see the #68 issue
// thread for the full numbers. It is the largest value that still leaves
// the map its FLOOR_SCALE spec at 390x669 zh (the tighter of the two
// required viewports: table.clientHeight − topbar − statline − gaps ≈ 520,
// FLOOR_SCALE's own mapH ≈ 347, leaving ≈172); 375x667 en reuses the same
// constant rather than a second one (the brief's own "one size per
// viewport" is about the MAP, not this budget, and a second magic number
// tuned to a slightly different English wrap would drift out of sync the
// next time either language's copy changes).
//
// This is enough for every state the walk exercises EXCEPT one real,
// reported gap: a "spend leftover ops — which use?" pending choice (or a
// campaign/lobby target already picked) that also needs BOTH a use/target
// button row and its own Confirm/Cancel row — 2× a real 44px tap target,
// plus the compact sheet's own title and note — measured 11-38px over
// budget in that exact combination (worse in English: longer button labels
// wrap where the 2-character Chinese ones don't). #lowerBlock's own
// give-way (below) already folds the hand and the prompt/news scroll away
// first; there is nothing left to fold for THIS combination without either
// clipping a 44px button (refused, same as the map's own floor) or cutting
// the advisor's sentence (refused per the owner's 2nd #68 report) — so it
// falls through to the pre-#68 table-overflow scroll fallback, same
// escape hatch every short-viewport case before #68 already had. Reported
// to the orchestrator rather than silently widening LOWER_BLOCK_H further:
// every extra px here comes straight out of the map's own floor spec
// (see mapOverflow below), which would turn this from "two rare states
// scroll a little" into "every state scrolls a little."
const LOWER_BLOCK_H = 172;
function layoutTable() {
  const table = $("table");
  if (table.hidden) return;
  if (isDesktopTable()) { layoutTableDesktop(); return; }
  // A short mobile viewport can leave body.table-overflow set from the
  // PREVIOUS pass — in that mode #table is content-sized (flex: none), so
  // measuring table.clientHeight while it's still set sees a taller box
  // than the real viewport gives, decides everything fits, drops the class,
  // and locks the page; the very next pass measures the true (shorter)
  // height and sets it right back. #24 (diagnosed by a side session):
  // clear it before every measurement, same as layoutTableDesktop() above
  // already does — the tail of this function re-decides it fresh either way.
  document.body.classList.remove("table-overflow");
  // table.clientWidth includes #table's own left/right padding, but a child
  // like .map only gets the content width inside that padding — use the
  // map's own rendered width so `scale` matches what actually gets drawn.
  const availW = $("map").clientWidth || table.clientWidth;
  if (!availW) return;
  const availH = table.clientHeight;
  if (!availH) return;
  const widthScale = availW / DESIGN_W;
  const lowerBlock = $("lowerBlock"), sheetEl = $("sheet"), promptEl = $("prompt"), promptScroll = $("promptScroll"), hand = $("hand");
  // A phase with nothing to hold in hand (placement, campaign/lobby target
  // picking, scoring) still gets the SAME hand row as any other state (#68:
  // "an empty hand row is just empty" — the map already stopped reading
  // #hand's height above; this keeps #lowerBlock's own internal accounting
  // just as fixed, so nothing else quietly grows into an empty hand's
  // pixels either).
  const hasHand = hand.children.length > 0;
  hand.hidden = false;
  // #24 ruling, widened by #54: while the map is actively in play
  // (campaign/lobby target picking, placing points — including an event's
  // forced placement, which can land here with a real hand still showing)
  // OR any other pending choice is up (an opponent's card resolved its
  // event and is waiting for "怎麼用?", a forced card/option pick), the give-
  // way cascade below may fold the hand, then the prompt's scrollable part,
  // one step at a time — #68 narrows WHY: not to free height for the map
  // (nothing downstream of #lowerBlock does that any more) but to fit that
  // state's real content inside #lowerBlock's own fixed LOWER_BLOCK_H.
  // `game.givesWay` is set by renderPending()/renderPromptAndSheet() — see
  // #54's own comment there — and is the ONLY reader of that flag.
  const mapActive = !!game.givesWay;
  const sheetTitle = sheetEl.querySelector(".sheet-title");
  // #33: a tutorial lesson's decorate() (tutorial-ui.js) hides #prompt right
  // after render() writes into it — the coach panel is the only copy of the
  // question while a lesson is running. decorate() itself calls back into
  // this function (updateCoach() -> layoutTable()) to redo the lower-block
  // budget, and unconditionally un-hiding #prompt here undid that hide on
  // every such pass (measured: 390x669, lesson 1, #prompt 636-660 visible
  // reading "輪到你,選一張牌。" underneath the coach panel). Tutorial state
  // (body.tut-on, set for the whole run — tutorial-ui.js) decides this
  // instead of a blanket "always show".
  const tutOn = document.body.classList.contains("tut-on");
  promptEl.hidden = tutOn;
  promptScroll.hidden = false;
  sheetEl.classList.remove("sheet-compact");
  if (sheetTitle) sheetTitle.hidden = true;

  // 1) The map: a pure function of the viewport and the two rows above it
  // (topbar/statline, live-measured but state-invariant) minus the lower
  // block's own fixed budget — never of #prompt/#advisorBanner/#sheet/#hand,
  // which all live below it and are sized in step 2, entirely separately.
  const topbarH = $("topbar").getBoundingClientRect().height;
  const statlineH = $("statline").getBoundingClientRect().height;
  const tcs = getComputedStyle(table);
  const visibleKids = [...table.children].filter((c) => getComputedStyle(c).display !== "none").length;
  const gapsAndPadding = parseFloat(tcs.paddingTop) + parseFloat(tcs.paddingBottom) + Math.max(0, visibleKids - 1) * parseFloat(tcs.rowGap || 0);
  const spaceForMapAndLower = availH - topbarH - statlineH - gapsAndPadding;
  const spaceForMap = spaceForMapAndLower - LOWER_BLOCK_H;
  // Never below FLOOR_SCALE (the map's own spec), never above widthScale
  // (that would overflow sideways) — same floor/width clamp #68 inherited
  // from the old budget, just against a fixed target instead of a measured
  // one.
  const scale = Math.min(widthScale, Math.max(FLOOR_SCALE, spaceForMap / DESIGN_H));
  const mapH = Math.round(DESIGN_H * scale);
  // #68 point 3: a viewport that can't give the map its FLOOR_SCALE spec
  // alongside this fixed lower block (375x553 is the known case) keeps the
  // pre-#68 scroll fallback rather than shrink the map, or the lower block,
  // below their own specs. Same sub-pixel tolerance the old code carried
  // (#24 round 3) for a near-exact fit's rounding.
  const mapOverflow = mapH > spaceForMap + 1;
  $("map").style.flex = `0 0 ${mapH}px`;
  fitMap(scale);
  lowerBlock.style.flex = `0 0 ${LOWER_BLOCK_H}px`;

  // 2) Everything that varies negotiates INSIDE the lower block's own fixed
  // height — #promptScroll (flex:1, min-height:0) already shrinks and
  // scrolls on its own for any ordinary overflow; the give-way stages below
  // only fire once even THAT isn't enough (mapActive states, where the
  // sheet's own compact/pending rows can still outgrow the budget).
  //
  // #prompt's own flex-shrink (flex:1 1 auto) could otherwise squeeze it
  // BELOW the advisor banner's own natural height — a flex item's automatic
  // minimum size (the "don't shrink below your content" default) resolves
  // to 0 the moment its `overflow` isn't `visible` (CSS Flexbox's own
  // carve-out), and #prompt's overflow:hidden (style.css) is exactly that,
  // so nothing stopped it from silently CLIPPING the banner instead of
  // surfacing as real #lowerBlock overflow for the give-way stages below to
  // react to (found while testing #68: a real setup-placement state
  // clipped ~34px off a 2-line advice sentence with fits() still reporting
  // "fine"). An explicit min-height (not "auto") isn't subject to that
  // carve-out, so this pins one to the banner's real rendered height each
  // pass, before fits() ever reads #lowerBlock's own scrollHeight.
  //
  // #109: with the advisor OFF (no banner), this used to fall through to a
  // flat "0px" floor — the same overflow:hidden carve-out above then let a
  // sheet-heavy state's flex-shrink squeeze #prompt to literally
  // clientHeight:0, taking the whole prompt line (and #97's always-on
  // scoring warning, spliced in as the FIRST line of #promptText — see
  // renderPromptAndSheet()) with it. Two lines of #prompt's own text
  // (line-height/padding read live off its computed style, not hardcoded,
  // so a font-size change stays in sync) is enough room for that first
  // line to actually paint before anything below it has to scroll; #prompt
  // remains flex:1 1 auto so it still grows past this floor whenever the
  // budget allows, and lowerOverflow's existing table-overflow fallback
  // (below) still catches the rare state where even this floor doesn't fit.
  const advBanner = document.getElementById("advisorBanner");
  const bannerShown = advBanner && !advBanner.hidden && advBanner.parentElement === promptEl;
  const promptCS = getComputedStyle(promptEl);
  const promptPad = parseFloat(promptCS.paddingTop) + parseFloat(promptCS.paddingBottom);
  promptEl.style.minHeight = bannerShown
    ? Math.ceil(advBanner.getBoundingClientRect().height + promptPad) + "px"
    : Math.ceil((parseFloat(promptCS.lineHeight) || 18) * 2 + promptPad) + "px";
  const fits = () => lowerBlock.scrollHeight <= LOWER_BLOCK_H + 1;
  if (mapActive && !hand.hidden && !fits()) {
    // Stage 1: the hand row gives way first — its cards (if it holds any)
    // aren't needed while the map itself is what's being tapped (target
    // picking, placing points, a pending choice — every one of these is
    // answered through the sheet's own buttons, never by tapping a card in
    // the hand). Fires even with an EMPTY hand (hasHand false: the very
    // first pending choice of a game, before any card is drawn) — that
    // doesn't conflict with "the hand row keeps its place... whether or
    // not there are cards" (#68's own rule for the ordinary, non-give-way
    // case): there is nothing to hide either way, so reclaiming its row
    // here costs strictly nothing, the same reasoning Stage 1 already
    // applied to a real, populated hand.
    hand.hidden = true;
  }
  if (mapActive && !fits()) {
    // Stage 2: the sheet's own use/order rows collapse to a mini chip +
    // preview + Cancel/Confirm (the sheet-compact rule, style.css), and the
    // prompt's SCROLLABLE part (promptScroll: the prompt sentence + news +
    // #fallbackBanner) gives way with it — never the advisor's banner
    // above it (orchestrator's ruling on the owner's 2nd #68 report: the
    // advice stays visible in every state that has one, including this
    // one; it just loses the prompt/news scrolling under it, not the other
    // way around).
    promptScroll.hidden = true;
    sheetEl.classList.add("sheet-compact");
    // #24 round 2, fix #2: the prompt row was carrying the ONLY copy of
    // whatever question is on screen in some states (an event's forced
    // "Pick 1 (1 left)", a pending choice) — the sheet's own preview note
    // doesn't always restate it. Reveal the parked copy the moment the
    // prompt itself gives way, so a question is never silently dropped.
    if (sheetTitle) sheetTitle.hidden = false;
  }
  // Still overflowing even at the deepest give-way (e.g. a viewport too
  // short for even the compact sheet + fixed hand row): fall through to
  // table-overflow scroll rather than clip anything invisible and
  // unreachable (#5's own rule), same escape hatch as before — just judged
  // against the lower block's own fixed height now, not a map-derived one.
  const lowerOverflow = !fits();
  // #lowerBlock's own `overflow: hidden` (style.css) is only a paint-safety
  // net for the ordinary case where LOWER_BLOCK_H really was enough — once
  // the deepest give-way STILL doesn't fit, keeping the fixed flex-basis
  // from above would just clip the excess silently instead of letting
  // table-overflow's own #table relaxation (body.table-lock.table-overflow,
  // style.css) do its job. Let #lowerBlock size to its real (taller)
  // content instead, same as #table itself does, so the fallback actually
  // scrolls to reveal everything rather than cutting it off at exactly
  // LOWER_BLOCK_H.
  if (lowerOverflow) lowerBlock.style.flex = "none";
  document.body.classList.toggle("table-overflow", mapOverflow || lowerOverflow);
  // #68: the soft fade at #promptScroll's bottom edge only paints while
  // there's real overflow to hint at.
  promptScroll.classList.toggle("has-more", !promptScroll.hidden && promptScroll.scrollHeight > promptScroll.clientHeight + 1);
  // #68: the phone hand is always the fixed-height chip row now, never the
  // 96x176 card. Before #68, the hand's own mode (full vs chip) was decided
  // by whatever the map's budget had left over once the prompt/sheet took
  // their share — the exact same per-render negotiation that let a longer
  // advice or news strip change the map's size also flipped the hand
  // between the two. At 390x669/375x667 the equilibrium that negotiation
  // used to find for an ordinary state was chip mode anyway (a 390x669
  // "action hand" state, measured on main before this branch: map 360,
  // chip handH ~72 — the full card's own ~207px never actually fit
  // alongside a floor-or-taller map on these viewports); #68 just makes
  // that the fixed, deliberate choice instead of an emergent one. #7's
  // desktop grid is untouched (isDesktopTable()'s own default in
  // renderHand() keeps it "full" there; layoutTableDesktop() never reads
  // hand.dataset.mode at all).
  if (hasHand && !hand.hidden && hand.dataset.mode !== "chip") { hand.dataset.mode = "chip"; if (game.lastView) renderHand(game.lastView, "chip"); }
}
// Whether the whole table is locked into the full-screen-overlay layout
// (page scroll off, --bar-h set) — shared by the real card sheet (#29) and
// the read-only peek sheet (#34), since either one alone must lock the
// background the same way, and closing one while the other is still open
// must leave the lock in place. #29 item 1 (owner: "頂列留著,牌頁從頂列下面
// 開始,不要蓋住 .bar"): .bar's own height isn't a constant (the advisor
// switch, a long turn/mandate line, can widen it — layoutBar()'s own 55px
// give-way rule), so this measures it fresh every time either overlay
// opens rather than hardcoding a guess; style.css's .sheet.overlay reads
// the same `--bar-h` back as its own `top`.
function refreshSheetLock() {
  const open = $("sheet").classList.contains("overlay") || !!game.peek;
  document.body.classList.toggle("sheet-open", open);
  if (open) {
    const barH = document.querySelector(".bar")?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--bar-h", barH + "px");
  }
}
function setSheetOpen(open) {
  $("sheet").classList.toggle("overlay", open);
  refreshSheetLock();
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
  const info = cardInfo(L, ui.card);
  // #71: an opponent's card played for place/campaign/lobby has no order
  // chosen yet -- keep the full-screen overlay (map stays inactive) until
  // the player picks 先行動點/先事件, same as before any use is picked.
  if (info && info.enemy && !ui.pair && ui.order == null) return true;
  if (ui.use === "place") {
    return !!(info && info.enemy && ui.order === "eventFirst" && !ui.pair); // the pre-order step, before tapping the map
  }
  return false; // campaign/lobby target picking, or place once ops are known: the map is in play
}

// Above the map: the turn line and the Mandate tug-of-war bar (C2_Game's
// header + mandate strip, condensed — the seat portrait row is #6's).
// #39 part 2 / #48: a real tug bar. The marker moves toward the LEADER's
// end (owner's spec); #48 fixed the fill to match that reading -- filling
// each side's own colour from the edge to the marker made the LEADER's
// colour shrink as its lead grew (the marker eats into its own half). The
// fill now runs only between the middle and the marker, in the leader's
// colour, growing as the lead grows: Qin's paper tone leftward from the
// middle when Qin leads, Chu's disc red rightward when Chu leads, no fill
// at 0. A gold diamond marker, 秦/楚 at the two ends (the same hardcoded
// glyphs overGlyphChar() already uses on the result screen -- not
// sideName(), which is localized and reads as a whole word in English, not
// the single glyph the design canvas draws at each end regardless of
// language). role="img" carries the bar's own spoken value since none of
// its children are real text a screen reader should read individually.
function renderTopBar(v) {
  const pos = Math.max(2, Math.min(98, 50 - (v.mandate / E.MANDATE_TO_WIN) * 50));
  const phase = v.phase === "setup" ? "" : ` · ${t("tracks.round")} ${v.round}${t("tracks.of")}${v.rounds}`;
  const m = v.mandate;
  const leadColor = m > 0 ? "var(--qin-text)" : m < 0 ? "var(--chu-gold)" : "var(--text)";
  const fillLeft = m > 0 ? pos : 50;
  const fillWidth = m > 0 ? 50 - pos : m < 0 ? pos - 50 : 0;
  // orchestrator's ruling (#48): the colour lives in CSS (.lead-qin/.lead-chu
  // pick --qin-text / --chu-fill), not as a literal here -- app.js only says
  // which side is leading.
  const fillClass = m > 0 ? " lead-qin" : m < 0 ? " lead-chu" : "";
  const spoken = `${t("tracks.mandate")} ${mandateText(m)}`;
  $("topbar").innerHTML =
    `<div class="tb-turn"><b>${t("tracks.turn")} ${v.turn}</b>${v.era ? " · " + t("eras." + v.era) : ""}${phase} · ` +
      `<span class="tb-mandate-label">${esc(t("tracks.mandate"))}</span> <b class="tb-mandate-val" style="color:${leadColor}">${esc(mandateText(m))}</b></div>` +
    `<div class="mandate" role="img" aria-label="${esc(spoken)}" data-stat="mandate">` +
      `<span class="m-end m-end-qin" aria-hidden="true">${overGlyphChar(E.QIN)}</span>` +
      `<span class="m-track">` +
        `<span class="m-fill${fillClass}" style="left:${fillLeft}%;width:${fillWidth}%"></span>` +
        `<span class="m-mid"></span>` +
        `<span class="m-marker" style="left:${pos}%"></span>` +
      `</span>` +
      `<span class="m-end m-end-chu" aria-hidden="true">${overGlyphChar(E.CHU)}</span>` +
    `</div>`;
}
// Below the map: one condensed row (C2_Game's 5-column stat strip) —
// weariness, reform, seals, destroyed, cauldrons. Per-state detail and
// hand counts stay in the log instead of taking permanent screen space.
function renderStatLine(v) {
  const seals = Object.keys(v.seals).length, mie = Object.keys(v.mie).length;
  // `stat` (#79): a data-stat hook so oppmove-ui.js can find this column's
  // real on-screen rect for a gold glow -- no other reader of this markup.
  const col = (label, val, stat) => `<div data-stat="${stat}"><span class="sl-label">${esc(label)}</span><span class="sl-val">${val}</span></div>`;
  $("statline").innerHTML =
    col(t("tracks.weariness"), esc(t("weariness." + v.weariness)), "weariness") +
    col(t("tracks.reform"), `${v.reform[0]} · ${v.reform[1]}`, "reform") +
    col(t("tracks.seals"), `${seals} / 4`, "seals") +
    col(t("tracks.mie"), `${mie} / 3`, "mie") +
    col(t("tracks.jiuding"), esc(sideName(v.jiuding.holder)) + (v.jiuding.faceDown ? ` (${esc(t("tracks.faceDown"))})` : ""), "jiuding");
}

// DESIGN_W/H, NODE_POS/nodeCenter, regionMembers(), isCapital(),
// renderRoads()/renderRegionBlobs(), REGION_LABEL_POS, NODE_BREAK_EN/
// NODE_SMALL_EN/NODE_ANCHOR and nodeLabelHTML() now live in map-draw.js
// (shared with rules.js — see the import at the top of this file); nothing
// about how the table draws the map changed, only where the definitions are.

// While a scoring card is open in the sheet, its region lights up on the
// map and the rest fade — set by renderPromptAndSheet, read by renderMap.
let scoreHighlight = null;

// What tapping the map does right now: the lit spaces, the picks so far, the cost badges.
// #49: every mode below also reports `side` (E.QIN/E.CHU) — the badge and the
// picked ring (renderMap) colour themselves for that side, the same rule
// last-move tags use (#41). It is always the ACTING side (`me`/`game.me` —
// E.legal() only ever returns a "pending" whose `who` equals the side asked,
// see engine.js's legal()/ask(), so `me` and a pending's own `who`/`side`
// fields never disagree here). That is exactly right for placement and for
// campaign/lobby target picks (the issue's own "whose side" rule). It is
// ALSO what a handful of "points" picks use even though they pick a target
// on the OPPONENT's spaces for a later E.remove() there (cards.js: mozhe,
// ganmao, the jingxiang/baiqi/changping-south chain, yili's first two
// choices) — those keep the acting side's colour, not the side that will
// actually lose the point, because the "points" pending object carries no
// place/remove intent for app.js to read (only ask()/pts() attach an
// explicit `side`, and it is always equal to `who` there too). Flagged for
// the orchestrator/owner in the #49 handover, not solved here.
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
// #62 part 2, item A: sfx.map.place's rising pitch for repeated taps on the
// SAME space -- 1, 1.06, 1.12 … reset to 1 on another space (the `id`
// mismatch below) OR on a new action (an EMPTY points/picks array can only
// mean a sequence just started, so it always resets regardless of which
// space -- covers "confirmed one placement, started the next" the same
// space id happened to repeat into, which the `id`-alone check couldn't
// tell from a genuine repeat within the same sequence).
let placeTapSpace = null, placeTapStreak = 0;
function placeTapSound(arr, id) {
  if (arr.length === 0 || id !== placeTapSpace) { placeTapSpace = id; placeTapStreak = 0; }
  Audio.play("sfx.map.place", { rate: 1 + placeTapStreak * 0.06, isPress: true }); // #66 S5 follow-up
  placeTapStreak++;
}
function currentMode(v) {
  const none = { lit: new Set(), picked: {}, costs: null, side: E.QIN, onTap() {} };
  const me = game.me, ui = game.ui;
  if (v.winner != null) return none;
  const L = E.legal(v, me);
  // #107: the lit set comes from the engine (E.placeTargets), not from a second
  // copy of the reach rule here. `v` is the state at the START of this place
  // action and `points` what has been tapped but not confirmed -- under the
  // "ts" rule the eligible set is fixed at `v`, so a point that wins control
  // must NOT open its neighbours mid-action. The old loop re-read the reach
  // rule on the trial board per point, which lit spaces Confirm then refused
  // ("place: ji is not reachable"); a probe over 20 games found 841 such
  // lit-but-illegal spaces across 654 mid-action states, up to 5 at once.
  const placing = (ops, points) => {
    const { lit, costs } = E.placeTargets(v, me, ops, points);
    const picked = {}; for (const id of points) picked[id] = (picked[id] || 0) + 1;
    return { lit, picked, costs, side: me, onTap: (id) => { placeTapSound(points, id); points.push(id); render(); } };
  };
  if (L.kind === "pending") {
    const p = L.pending;
    if (p.kind === "points") {
      const counts = {}; for (const id of ui.picks) counts[id] = (counts[id] || 0) + 1;
      const lit = new Set(ui.picks.length < p.n ? p.options.filter((id) => roomFor(p, v, id, counts) > 0) : []);
      return { lit, picked: counts, costs: null, side: me, onTap: (id) => { placeTapSound(ui.picks, id); ui.picks.push(id); render(); } };
    }
    if (p.kind === "ops" && ui.opsUse === "place") return placing(p.ops, ui.points);
    if (p.kind === "ops" && (ui.opsUse === "campaign" || ui.opsUse === "lobby")) {
      const ids = ui.opsUse === "campaign" ? p.options.campaignTargets : p.options.lobbyTargets.map((x) => x.id);
      return { lit: new Set(ids), picked: ui.target ? { [ui.target]: 1 } : {}, costs: null, side: me, onTap: (id) => { ui.target = id; render(); } };
    }
    return none;
  }
  if (L.kind !== "action" || !ui.card) return none;
  // #100 (owner, UX audit item 4): a card is open but no use is chosen yet.
  // `lit` is empty, so every hit button would normally be a real `disabled`
  // one (renderMap()'s own `hb.disabled = !lit`) -- and a real `disabled`
  // button never dispatches a click at all, the same reason Confirm needed
  // `aria-disabled` instead of `disabled` in renderPromptAndSheet()'s own
  // `!ui.use` branch. `warnTap: true` tells renderMap() to leave these
  // particular hit buttons enabled (still invisible, still unlit -- `.hit`
  // carries no look of its own either way, see style.css) so the tap can
  // reach flashUseWarning() instead of being swallowed by the disabled
  // attribute. Every OTHER reason the map can't be tapped right now --
  // waiting, a pending choice, an unchosen order -- keeps `none`'s real
  // no-op and the real `disabled` state; this brief only asked about the
  // "browsing a card, no use yet" case.
  if (!ui.use) return { ...none, warnTap: true, onTap: () => flashUseWarning() };
  const info = cardInfo(L, ui.card);
  if (!info) return none;
  // #71: no order chosen yet on an opponent's card -- no map tap (place,
  // campaign or lobby) until the player picks one.
  if (info.enemy && !ui.pair && ui.order == null) return none;
  if (ui.use === "place" && !(info.enemy && ui.order === "eventFirst")) return placing(info.ops, ui.points);
  if (ui.use === "campaign" || ui.use === "lobby") {
    const u = info.uses[ui.use];
    const ids = u ? (ui.use === "campaign" ? u.targets : u.targets.map((x) => x.id)) : [];
    return { lit: new Set(ids), picked: ui.target ? { [ui.target]: 1 } : {}, costs: null, side: me, onTap: (id) => { ui.target = id; render(); } };
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

// The last-move mark's own tag text — "+2" / "−2" (U+2212, a true minus,
// not a hyphen) for an influence swing, or the localized destroyed/restored
// word for a capital whose state's mie flag just flipped. Kept in app.js
// (not lastmove.js, round 1 review) because it needs t()/i18n — computing
// the marks themselves stays a pure diff of two views with no i18n/DOM
// dependency, importable on its own; see lastmove.js's own comment.
function lastMoveTagText(mark) {
  if (!mark) return null;
  if (mark.destroyed != null) return t(mark.destroyed ? "lastMove.destroyed" : "lastMove.restored");
  const d = mark.delta;
  return d ? (d > 0 ? `+${d}` : `−${-d}`) : null;
}
// The tag's own background colour (round 1 review, item 2): the side whose
// count actually changed, the same black/red the disc's own two numbers
// already use (style.css's `.disc i.q`/`.disc i.c`) — so a bare "+2" also
// says WHOSE +2 it is, without a second glance at the disc. A destroyed/
// restored mark has no side (it's the state's capital, not a count) and
// keeps the frame's own bronze.
function lastMoveTagClass(mark) {
  if (!mark || mark.destroyed != null) return "";
  return mark.side === E.QIN ? " side-q" : " side-c";
}
// #41: the log's own running index (engine.js's log(), `st.logSeq`) of the
// latest entry in `view`, or 0 for an empty/missing log — used only to tell
// whether a new action resolved between two renders, never read as text.
function lastLogI(view) {
  const log = view && view.log;
  return log && log.length ? log[log.length - 1].i : 0;
}
// Decides whether THIS render() call is the one right after a new action
// resolved, and if so recomputes game.lastMoveMarks from the two views —
// otherwise leaves whatever is already there untouched (including "cleared
// by a tap", see clearLastMoveMarks() below: a UI-only re-render, like a
// language toggle or picking a card, must not resurrect a cleared mark).
function updateLastMoveMarks(prevView, v) {
  // #41 round 2 review (orchestrator): the tutorial dims the map and lights
  // ONE scripted target per step (tutorial-ui.js's own spotlight) — none of
  // its ten lessons explains the brackets, so they must not appear at all
  // while it's running, not just "not fight" the spotlight visually. Same
  // gate decorateAdvisor() already uses to stay out of the tutorial
  // (render()'s own `solo: !game.room && !game.spectator && !Tut.active()`
  // call below). Checked first and unconditionally — not folded into the
  // "did a new action resolve" branches below — because marks left over
  // from a solo game already on screen when the tutorial starts must be
  // cleared too, not just suppressed for the tutorial's OWN actions.
  if (Tut.active()) {
    game.lastMoveMarks = {};
    game.lastMoveFresh = false;
    return;
  }
  const prevI = lastLogI(prevView), curI = lastLogI(v);
  if (prevView && curI > prevI) {
    game.lastMoveMarks = computeLastMoveMarks(prevView, v);
    game.lastMoveFresh = true; // this render's renderMap() gets the one-shot pulse class
  } else if (!prevView || curI < prevI) {
    // First render of a game, or the log's index just went backwards (a
    // new game replaced the old one under this tab) — nothing to diff yet.
    game.lastMoveMarks = {};
    game.lastMoveFresh = false;
  }
}
// #62 part 2, item A: cuesForLog/controlCues/dangerFlags, wired the same
// way updateLastMoveMarks() above already diffs "two views one render
// apart" -- same prevI/curI reset rule, so it inherits the same three
// guarantees for free: nothing voiced on the very first render of a page
// (a `?resume` or a room's first `view` message both land with
// `game.lastView` still undefined -- "nothing from the existing log on
// resume or a reconnect", the issue's own rule), nothing voiced when a new
// game replaces an old one under the same tab (index goes backwards), and
// a same-state re-render (language toggle, picking a card) voices nothing
// because curI === prevI skips the "new entries" branch entirely. The
// tutorial is excluded outright: its log entries are the scripted lesson's
// own bookkeeping, not organic play (the issue: "nothing at all during the
// tutorial's scripted steps unless it is the player's own tap" -- taps get
// their own sounds at the tap site, not through this log diff).
// Returns { cues, hasOver } instead of playing directly -- render() (below)
// still owns the one actual playBatch() call, so it can append sfx.turn.yours
// to the END of this same batch (the orchestrator's ruling: the reminder
// must not land ahead of or in the middle of the cues a bot's move just
// produced) rather than firing it as its own separate, earlier sound.
// `hasOver` is read straight off the fresh log entries (not the cue string):
// a game-ending batch never gets the reminder appended, win or lose.
function voiceBoardAudio(prevView, v, me) {
  if (Tut.active()) return { cues: [], hasOver: false, hasTurn: false };
  const prevI = lastLogI(prevView), curI = lastLogI(v);
  const reset = !prevView || curI < prevI;
  const cues = [];
  let hasOver = false, hasTurn = false;
  if (!reset && curI > prevI) {
    const fresh = v.log.filter((l) => l.i > prevI);
    hasOver = fresh.some((l) => l.type === "over");
    // S5: a `turn` entry's own cues already include the horn calling the
    // headline phase (sfx.turn.headline) -- that IS the call to act, so
    // render() below skips appending sfx.turn.yours to a batch built from
    // this. Read off the raw entries, not the cue string: a turn's cues
    // could in principle be trimmed by the four-cue cap in a busy batch,
    // but the rule is about the ENTRY happening, not about which of its
    // sounds survived the cut.
    hasTurn = fresh.some((l) => l.type === "turn");
    cues.push(...Cues.cuesForLog(fresh, { me }), ...Cues.controlCues(prevView, v, me));
  }
  // dangerFlags reads the state directly (not a diff of the log), so it's
  // computed on every non-reset render regardless of whether a new action
  // just resolved -- sfx.warn is for a flag's first APPEARANCE, which
  // dangerFlags(v) alone can't tell from "still true since last render"
  // without game.lastDangerFlags to compare against.
  const flags = Cues.dangerFlags(v);
  if (!reset && flags.some((f) => !game.lastDangerFlags.includes(f))) cues.push("sfx.warn");
  game.lastDangerFlags = flags;
  return { cues, hasOver, hasTurn };
}
// #62 part 2 fix 1 (orchestrator, from a played turn's own cue list: a
// bot's move produced sfx.map.campaign 4ms after sfx.turn.yours had already
// fired on its own): the wait -> your-decision reminder used to play
// immediately from inside renderPromptAndSheet(), landing ahead of (or
// inside) the very batch the SAME render's log diff just queued. Detected
// here instead (same game.lastLegalKind bookkeeping, moved out of
// renderPromptAndSheet so there is exactly one place that updates it), and
// combined with `cues` by the caller (render(), below) per the rule: append
// to the end of a non-empty batch (same 180ms spacing as every other cue in
// it), play alone at once when the batch is empty, never play at all when
// the batch ends the game.
function yoursFires(v, me) {
  if (Tut.active()) return false; // scripted; game.lastLegalKind is left untouched for whenever the tutorial ends
  const kind = E.legal(v, me).kind;
  const fires = game.lastLegalKind === "wait" && kind !== "wait";
  game.lastLegalKind = kind;
  return fires;
}
// Removes the last-move mark from the map WITHOUT a render(): the owner's
// iPhone lost taps to nodes rebuilt under the finger once before (see the
// map/hand notes elsewhere in this file), and render() rebuilds every node
// in #mapInner from scratch every time — so "the viewer's next tap clears
// it" only touches the few elements the marks themselves added, never
// re-renders the map, the hand or the sheet.
function clearLastMoveMarks() {
  if (!Object.keys(game.lastMoveMarks).length) return;
  game.lastMoveMarks = {};
  game.lastMoveFresh = false;
  const mapInner = $("mapInner");
  if (!mapInner) return;
  mapInner.querySelectorAll(".node.lastmove").forEach((n) => {
    n.classList.remove("lastmove", "lastmove-pulse");
    const tag = n.querySelector(".lastmove-tag");
    if (tag) tag.remove();
    n.querySelectorAll(".lastmove-frame, .lastmove-frame2").forEach((f) => f.remove());
  });
}
// Touch targets are a physical requirement, not a design one: they must
// stay >=44x44 real px no matter how much the map's own art is scaled down
// on a narrow phone. So each city is two elements — a VISUAL node (disc +
// label, lives inside #mapInner) and a separate, invisible HIT button
// (lives in #hitLayer). #7/#32: the two used to live in different coordinate
// systems — #mapInner is a fixed DESIGN_W x DESIGN_H canvas, scaled and
// centred inside #map by fitMap(); #hitLayer's buttons were positioned by
// percentage of #map's OWN box, which only matches #mapInner's box when
// #map's aspect ratio happens to equal DESIGN_W:DESIGN_H — never true on
// desktop, and untrue on a squashed/stretched phone viewport too. Fixed by
// giving #hitLayer the exact same box as #mapInner (fitMap() now sizes and
// transforms both identically) and positioning each hit button in the same
// DESIGN_W/DESIGN_H px coordinates as its node, so a button is always
// centred on its own disc and scales with it. HIT_SIZE (declared above,
// alongside FLOOR_SCALE, which is now derived FROM it — #39 round 2) is
// 47 design px, chosen so the rendered button is exactly MIN_HIT (40 real
// css px) at the floor scale; on desktop's larger scale it only grows,
// same as the disc it covers.
// #51: turns the DOM-free discParts() shape (disc-view.js) into the disc's
// own class list and inner markup -- the only place that knows what a part
// LOOKS like. Tone itself is CSS (style.css's .lone-q/.lone-c/.split/
// .ctl/.ctl-q/.ctl-c, --qin-inf/--chu-inf); this only says which classes and
// how many numerals. Numerals stay `<i>` elements (the sweep's `.disc i`
// selector, #49's hand-over item 4) whether there are one or two.
function discHTML(parts, cap) {
  const base = "disc" + (cap ? " sq" : "");
  if (parts.kind === "empty") return `<span class="${base}"></span>`;
  if (parts.kind === "lone") {
    const side = parts.side === E.QIN ? "q" : "c";
    const cls = `${base} lone-${side}${parts.controlled ? " ctl" : ""}`;
    return `<span class="${cls}"><i>${parts.n}</i></span>`;
  }
  const cls = `${base} split${parts.qin.controlled ? " ctl-q" : ""}${parts.chu.controlled ? " ctl-c" : ""}`;
  return `<span class="${cls}"><i class="q">${parts.qin.n}</i><i class="c">${parts.chu.n}</i></span>`;
}
function renderMap(v) {
  const el = $("mapInner");
  const hitEl = $("hitLayer");
  hitEl.innerHTML = "";
  const members = regionMembers();
  el.innerHTML = renderRoads() + renderRegionBlobs(members, scoreHighlight);
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
  const seals = sealProgress(v); // #89: { capital, chuControls, have, need, sealed } per state, read once per render
  for (const sp of E.SPACES) {
    const [x, y] = NODE_POS[sp.id], [q, c] = E.infOf(v, sp.id), ctl = E.controller(v, sp.id);
    const cap = isCapital(sp.id);
    const big = sp.battleground || cap;
    const empty = !q && !c;
    const anchor = NODE_ANCHOR[sp.id];
    const lit = mode.lit.has(sp.id), picked = mode.picked[sp.id];
    // #49: while picking, the badge/ring follow the ACTING side's colour
    // (mode.side — see currentMode() above), the same class names the
    // last-move tag uses for its own side (lastMoveTagClass below).
    const pickSide = picked ? (mode.side === E.QIN ? " pick-q" : " pick-c") : "";
    // #41: the last-move mark — a frame around the disc plus a small tag
    // near its upper right, for every space computeLastMoveMarks() (called
    // from render(), once per action) flagged. `mv` is undefined for every
    // other space; `game.lastMoveFresh` is true for exactly the one
    // renderMap() call right after a new action resolved, so the pulse
    // plays once and not again on some later, unrelated re-render (a
    // language toggle, a card selection) that redraws the same marks.
    const mv = game.lastMoveMarks[sp.id];
    const mvTag = lastMoveTagText(mv);
    // #51: the disc's own shape (empty/lone/split) and tone classes come from
    // discParts() (disc-view.js), not from a node-level ctlq/ctlc class --
    // the owner's V2 滿盤 decision drops the outer black/red control ring
    // this used to draw (.node.ctlq/.ctlc .disc, style.css), so control now
    // only shows as the disc's OWN tone (dark = controlled), computed below.
    const parts = discParts(q, c, ctl);
    // #90 round 2: the sealed 「印」 mark (design A 朱印角章, owner's pick),
    // only for a capital (sp.state names the state a capital belongs to;
    // seal-progress.js keys its output by that same state id). sp.state is
    // null for every non-capital space so this stays undefined there.
    const seal = cap && sp.state ? seals[sp.state] : null;
    // SEAL_MARK_POS gives {dx,dy} pixels (the mark's own centre off the
    // node's centre), applied as an inline transform — the CSS rule's own
    // rotate(-9deg) has to be repeated here since an inline `transform`
    // replaces the stylesheet's one rather than adding to it (map-draw.js's
    // own comment on SEAL_MARK_POS has the corner math).
    const sp89 = SEAL_MARK_POS[sp.id];
    const sealStyle = sp89 ? ` style="transform:translate(calc(-50% + ${sp89.dx}px), calc(-50% + ${sp89.dy}px)) rotate(-9deg)"` : "";
    const sealMarkHTML = seal && seal.sealed
      ? `<span class="seal-chop"${sealStyle} aria-hidden="true"><span lang="zh-Hant">印</span></span>`
      : "";
    const vis = document.createElement("div");
    vis.className = "node" + (big ? " big" : "") + (empty ? " empty" : "") + (anchor ? ` anchor-${anchor}` : "") +
      (NODE_STAB_RIGHT.has(sp.id) ? " stab-r" : "") + (NODE_STAB_HI.has(sp.id) ? " stab-hi" : "") +
      (lit ? " lit" : "") + (picked ? " picked" : "") + pickSide +
      (mv ? " lastmove" : "") + (mv && game.lastMoveFresh ? " lastmove-pulse" : "") +
      " pill-" + (NODE_PILL_POS[sp.id] || "tr");
    vis.style.cssText = `left:${x}px;top:${y}px`;
    vis.dataset.space = sp.id; // #79: oppmove-ui.js finds a space's real on-screen rect by this, never by re-deriving fitMap()'s own transform
    // #41 round 1 review (item 1): the mark reads as two viewfinder-style
    // corner brackets (.lastmove-frame/-frame2, each contributing two
    // opposite corners via its own ::before/::after — see style.css)
    // instead of an outline on the disc itself, so it can't be mistaken
    // for a control ring or the advisor's suggestion ring at a glance.
    // Both are inert decoration (pointer-events:none, sized/positioned in
    // style.css to track the disc exactly) — present only when `mv` is set.
    vis.innerHTML = discHTML(parts, cap) +
      (mv ? `<span class="lastmove-frame" aria-hidden="true"></span><span class="lastmove-frame2" aria-hidden="true"></span>` : "") +
      stabilityTagHTML(sp) +
      (picked ? `<span class="badge">+${picked}</span>` : "") +
      (mode.costs && mode.costs[sp.id] === 2 ? `<span class="cost">2</span>` : "") +
      (mvTag ? `<span class="lastmove-tag${lastMoveTagClass(mv)}" aria-hidden="true">${esc(mvTag)}</span>` : "") +
      sealMarkHTML +
      stateTagHTML(sp, sp.state ? stateName(sp.state) : "", esc) +
      nodeLabelHTML(sp.id, spaceName(sp.id), lang, esc);
    el.appendChild(vis);
    const hb = document.createElement("button");
    hb.type = "button";
    hb.className = "hit";
    hb.style.cssText = `left:${x}px;top:${y}px`;
    // #100: `mode.warnTap` (currentMode()'s own `!ui.use` case) keeps every
    // hit button real-clickable even while none are lit, so the tap reaches
    // `mode.onTap` (flashUseWarning()) instead of being swallowed by a real
    // `disabled` attribute -- `.hit` has no visual state of its own either
    // way (style.css), so nothing on screen changes.
    hb.disabled = !lit && !mode.warnTap;
    // #51: the outer control ring is gone -- tone (dark vs grey/pink) is now
    // the ONLY visual sign of who controls a space, so the accessible name
    // spells out both counts and the controller instead of leaving it to be
    // read off a colour. spaceName/sp.stability were already here; hitInf/
    // controls are new (public/i18n/*.js).
    hb.title = t("map.hitTitle", { space: spaceName(sp.id), stability: sp.stability }) +
      (empty ? "" : ` · ${t("map.hitInf", { qin: q, chu: c })}` + (ctl != null ? ` · ${t("map.controls", { side: sideName(ctl) })}` : ""));
    hb.onclick = () => mode.onTap(sp.id);
    hitEl.appendChild(hb);
  }
  // layoutTable() (the caller's caller) sizes and scales the map once every
  // sibling has its final height — see fitMap().
}
// #89: tapping the statline's 相印/Seals value shows a one-line explanation
// of the rule in the prompt area (the map marks show the per-state progress
// already; this is the one line for "why does it read 2/4"). One delegated
// listener (renderStatLine() rebuilds the column's innerHTML every render,
// so a per-element handler would be lost) targeting data-stat="seals" — the
// same hook oppmove-ui.js reads for its own, unrelated purpose (a gold glow
// rect), so this only adds a click, never touches that.
$("statline").addEventListener("click", (e) => {
  if (e.target.closest('[data-stat="seals"]')) $("promptText").textContent = t("map.sealHelp");
});
// The design canvas (DESIGN_W x DESIGN_H) is the C2_Game mockup's own
// dimensions, scaled by the viewport WIDTH ratio only — never shrunk further
// for a lack of height, so a real phone always renders the map at (at
// least) true size: 30/34px discs, 13px city names, 44x44 tap targets.
function fitMap(scale) {
  // #hitLayer gets the exact same box + transform as #mapInner (see the
  // #7/#32 note above renderMap()) so both live in the same coordinate
  // system: DESIGN_W x DESIGN_H, centred in #map, scaled together.
  for (const el of [$("mapInner"), $("hitLayer")]) {
    el.style.width = DESIGN_W + "px";
    el.style.height = DESIGN_H + "px";
    el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}
window.addEventListener("resize", () => { if (!$("table").hidden && game.st) { layoutBar(); layoutTable(); } });
// #41: "the viewer's next tap on the table" clears the last-move mark —
// #table wraps the map, the prompt/sheet and the hand (play.html), so one
// capturing listener here covers "a tap on the map, the hand or a button"
// in one place. Capturing (not bubbling) so it fires even on a `.hit`
// button that's `disabled` (a disabled button never dispatches a bubbling
// click at all) and even when the SAME tap goes on to resolve a new
// action — in that case updateLastMoveMarks() overwrites game.lastMoveMarks
// a moment later in the render() that action triggers, so clearing first
// here is harmless. clearLastMoveMarks() itself never renders anything.
$("table").addEventListener("pointerdown", clearLastMoveMarks, true);

function btn(parent, label, onClick, cls = "", pressed = null, disabled = false) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label; b.className = cls; b.disabled = disabled;
  if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
  b.onclick = onClick;
  parent.appendChild(b);
  return b;
}
function row(parent, cls = "rowb") { const d = document.createElement("div"); d.className = cls; parent.appendChild(d); return d; }
function note(parent, text, cls = "") { const d = document.createElement("div"); d.className = cls ? `note ${cls}` : "note"; d.textContent = text; parent.appendChild(d); }
// #100 (owner, UX audit item 4, two auditors read the advisor's gold ring as
// a selection): a Confirm tap or a map tap with no use chosen yet used to do
// nothing at all -- the footer's Confirm already looked disabled and every
// map hit button was a real `disabled` one too (renderMap()'s `hb.disabled`,
// `lit` empty while `ui.use` is unset) -- so neither tap told the player why.
// `useWarnPulse` is one-shot: renderPromptAndSheet()'s own `!ui.use` branch
// reads it once (to add the row's `.use-shake` class to a freshly built
// element -- the CSS animation plays on mount, no restart trick needed) and
// clears it in the SAME render, so a later, unrelated render (this is still
// local `game.ui` state, but nothing rules out a bot/room update landing
// mid-deliberation) doesn't replay the shake. `useWarn` is the persisting
// line under the row -- it only clears when a real use is picked (useBtn()'s
// own onclick below) or the sheet resets (freshUi(), same as `err`).
// Guarded to the exact state the brief describes (a card open, no use yet)
// so this can't fire from a stray call once a use IS picked.
function flashUseWarning() {
  if (!game.ui.card || game.ui.use) return;
  game.ui.useWarnPulse = true;
  game.ui.useWarn = true;
  render();
}
// #68 round 2 (orchestrator's ruling): the same explanatory line note()
// puts in the SHEET, but for the compact (map-active/pending) states whose
// sheet budget is already tight at 390x669/375x667 — a target's own
// preview ("新鄭: 移除…"), a pending "place" sub-state's placement count.
// These are read-only detail, not a control, so they cost nothing to move
// into #promptScroll (already the scrollable, give-way-first area) instead
// of the sheet's own fixed-cap row. Appended directly to #promptText, so
// it must run AFTER whichever setPrompt() call is going to stick for this
// pass — see setPrompt()'s own compactHint parameter for the one case
// (an enemy card's order/pair summary) that needs to run BEFORE a later
// setPrompt() overwrites #promptText outright.
function appendPromptNote(text) {
  const p = $("promptText");
  if (p) p.insertAdjacentHTML("beforeend", `<div class="prompt-note">${esc(text)}</div>`);
}
// Card names are the one place bilingual text is wanted regardless of the
// page's language (see TEAM.md's language-mixing exception list).
const cardZh = (id) => (id === E.JIUDING ? "九鼎" : E.CARD[id].zh);
const cardEn = (id) => (id === E.JIUDING ? "The Nine Cauldrons" : E.CARD[id].en);
const opsLabel = (id) => (id === E.JIUDING ? "4" : E.CARD[id].scoring ? "S" : String(E.CARD[id].ops));
// #97: a scoring card left in hand when the turn ends loses outright
// (rulebook) -- the advisor already says so in its own reasons, but only
// while it's on. These two are the plain arithmetic behind an ALWAYS-ON
// warning, independent of the advisor: how many scoring cards this side is
// holding right now, and how many more times this side still gets to act
// before the turn ends. `left` mirrors shared/bots.js's own `left` (its
// scoringPain term) -- same formula, re-derived here rather than imported
// since bots.js is BE's file: QIN acts first each round, then CHU, and
// `round` only increments after CHU's half, so a side already past its own
// half of the CURRENT round has one fewer action left in it than a side
// still waiting for its half.
const scoringCardsInHand = (v, side) => (v.hands[side] || []).filter((id) => id !== E.JIUDING && E.CARD[id].scoring).length;
const actionsLeftThisTurn = (v, side) => {
  if (v.phase !== "action" || v.winner != null) return null;
  return v.rounds - v.round + ((v.actor === E.QIN || side === E.CHU) ? 1 : 0);
};
// The warning sentence itself, or "" when it doesn't apply -- shared by the
// prompt area (above the hand) and, when a card page is open, that card's
// own pinned area (renderPromptAndSheet, below), so the two never drift.
function scoringWarnText(v, side) {
  const m = scoringCardsInHand(v, side);
  if (!m) return "";
  const left = actionsLeftThisTurn(v, side);
  if (left == null || left > m) return "";
  // #102 item 3: {n} actions and {m} scoring cards each pluralize on their
  // OWN count (either can be 1 while the other isn't) -- prompt.scoringWarn
  // is now { action: {one,other}, card: {one,other}, verb: {one,other},
  // full } in both i18n files (see their own comments), not a single "(s)"
  // template. Round 2: the "play them" pronoun pluralizes on the SAME {m}
  // count as `card` (one scoring card in hand needs "play IT", not "them").
  const action = t(`prompt.scoringWarn.action.${left === 1 ? "one" : "other"}`, { n: left });
  const card = t(`prompt.scoringWarn.card.${m === 1 ? "one" : "other"}`, { m });
  const verb = t(`prompt.scoringWarn.verb.${m === 1 ? "one" : "other"}`);
  return t("prompt.scoringWarn.full", { action, card, verb });
}
// #29: the "uses.*" table already carries both languages (one entry per
// i18n file) — the five-use grid on the full card page shows BOTH at once,
// same bilingual convention as card names, so it reads the raw imported
// modules directly instead of going through t()/S (which only ever holds
// the CURRENT ui language).
const useZh = (u) => zh.uses[u];
const useEn = (u) => en.uses[u];

// The full card sheet's own scrollable middle — #29's C2_Card* mockups pin
// [Cancel]/[Confirm] at the very bottom no matter how long the card's own
// text runs; everything between the fixed image+name header and that
// footer lives in this one flex:1 child instead (style.css's .sheet-mid),
// so IT scrolls internally on a short viewport while the header and footer
// never move. Callers append the text box / scoring panel / use grid /
// order row / hint line into the div this returns, not into `sh` directly.
function sheetMid(sh) {
  const d = document.createElement("div"); d.className = "sheet-mid"; sh.appendChild(d); return d;
}
// #46 (owner: "看手牌沒有卡牌歷史" + a player must never scroll to reach a
// button): a fixed (non-scrolling) sibling of sheetMid(), between the
// scrollable text/history and the pinned Cancel/Confirm footer. The use
// grid, an enemy card's order row, 說客's pairing row and the one-line hint
// all move here instead of into `mid` — mid now only holds the card's own
// variable-length content (text box, a scoring tally, the advisor's
// suggestion banner, the history), so growing that content can never push
// a button below the fold; only present while the full card (not the
// compact chip) is on screen, same gate as sheetMid() itself.
function sheetPinned(sh) {
  const d = document.createElement("div"); d.className = "sheet-pinned"; sh.appendChild(d); return d;
}
// The full card sheet's fixed header: art, ops badge, the name (#46: one
// language only — the owner's ruling reversed #29's always-both-languages
// design), era/number/year — the same on every card, only the surrounding
// colour (sheet-q/c/n/s, set by the caller) tells its owner apart. Text-only
// (see cardTextBox below); always appended straight to `sh`, never into the
// scrollable sheetMid(), so it never scrolls out of view either.
function cardHeader(sh, id) {
  const meta = id === E.JIUDING ? null : E.CARD[id];
  const info = meta ? `${t("eras." + meta.era)}${meta.num ? ` · No. ${meta.num}` : ""}${meta.year ? ` · ${lang === "en" ? meta.year + " BC" : "前" + meta.year + "年"}` : ""}` : "";
  // The round badge reads the scoring region's own "計" in zh (issue #29's
  // design: a scoring card's badge is not the hand tile's plain "S") — a
  // header-only override, opsLabel() itself (shared with the hand tile) is
  // untouched. #46: "計" is Chinese-only, so en falls back to the same "S"
  // the hand tile already uses, matching the one-language ruling.
  const badge = meta && meta.scoring ? (lang === "en" ? "S" : "計") : opsLabel(id);
  const name = lang === "en" ? cardEn(id) : cardZh(id);
  const head = document.createElement("div"); head.className = "sheet-head";
  head.innerHTML =
    `<img class="sheet-img" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` +
    `<div class="sheet-meta"><span class="sheet-badge">${esc(badge)}</span>` +
    `<div class="sheet-name"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(name)}</div>` +
    (info ? `<div class="sheet-info">${esc(info)}</div>` : "") + `</div>`;
  sh.appendChild(head);
}
// The card-text box (#46: one language only, was bilingual per #29 until
// the owner's ruling reversed that) — appended wherever the caller's own
// scrollable middle is (sheetMid()'s div for the full browsing/event/
// reform/pre-order states, `sh` directly for the short headline/bog
// confirmations, which have no other content to share a scroll region
// with).
function cardTextBox(parent, id) {
  const box = document.createElement("div"); box.className = "sheet-textbox";
  const text = lang === "en" ? cardTextEn(id) : cardTextZh(id);
  box.innerHTML = `<p class="sheet-text"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(text)}</p>`;
  parent.appendChild(box);
}
// The mini chip used instead of the full card header while the map is in
// play (placing points, picking a campaign/lobby target) — C2_Place and
// C2_Campaign show a small strip here, not the full art+text sheet, so the
// map stays the point. #94: "Card"/看牌 used to swap in the full header in
// place (chipExpanded), with its own "收起"/Collapse button to swap back --
// replaced by the read-only peek overlay (openPeek(), #34/#35), the same
// page the log's card links open, so this chip no longer has an expanded
// state of its own at all (see wantsCardOverlay/mapActive in
// renderPromptAndSheet). `game.peek` is its own top-level state, untouched
// by `game.ui`, so opening/closing it never disturbs the use/order/pair/
// points already chosen underneath.
// Returns the chip's own row (`.sheet-chip`) so a caller that needs to put
// Cancel/Confirm on the SAME row (#68 round 2: the campaign/lobby
// target-picked state, to close the last few px at 390x669/375x667) can
// append onto it directly, instead of the row footer() would otherwise
// build on its own.
function cardChip(sh, id) {
  const wrap = document.createElement("div"); wrap.className = "sheet-chip";
  const name = lang === "en" ? cardEn(id) : cardZh(id);
  // #46: one language only, same ruling as the full card page — the chip's
  // own aria-label carries the other one (below), same convention as the
  // hand tile's tile().
  wrap.innerHTML = `<span class="ops ${cardSide(id)}">${esc(opsLabel(id))}</span>` +
    `<span class="chip-nm"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(name)}</span>`;
  wrap.setAttribute("aria-label", `${cardZh(id)} / ${cardEn(id)}`);
  const expand = document.createElement("button");
  expand.type = "button"; expand.className = "chip-expand"; expand.textContent = t("buttons.expand");
  // #94: no `side` — this card is still in the acting player's own hand,
  // not "played" yet, so the peek shows no "{side} played this" note (that
  // note is openPeek()'s own opt-in, only built when a side is given).
  expand.onclick = (ev) => { ev.stopPropagation(); openPeek(id); };
  wrap.appendChild(expand);
  sh.appendChild(wrap);
  return wrap;
}
// The acting seat's own confirm phrase (#29's design: "令尹曰可" for a Chu
// court, "制曰可" for Qin's — the SEATED player's own turn of phrase, not
// the open card's owner; C2_CardEnemy confirms with the Chu viewer's own
// "令尹曰可" even though the open card is Qin's Bai Qi), used by the full
// card page's own Confirm button (browsing/event/reform/place-pre-order) —
// everywhere else (headline, bog, the compact place/campaign/lobby
// footers) keeps its own plain label. #46 (owner: one language only): in
// zh this still pairs the court's own word with 確認, exactly as before —
// both are Chinese, so nothing was ever mixed there; in en the court's
// word is dropped outright rather than shown alongside English, leaving
// just "Confirm".
function confirmPhrase() {
  if (lang === "en") return `<span class="confirm-en">${esc(t("buttons.confirm"))}</span>`;
  const chu = game.me === E.CHU;
  const zhWord = chu ? "令尹曰可" : "制曰可";
  return `<span lang="zh-Hant" class="confirm-zh">${esc(zhWord)}</span><span class="confirm-en">${esc(t("buttons.confirm"))}</span>`;
}
// A Cancel + Confirm footer pair, used everywhere a card sheet asks for a
// final commit (event/reform, place, campaign/lobby). `richHTML` marks the
// full card page's own Confirm (confirmPhrase() above) — every other caller
// keeps passing a plain translated label, unescaped changes here.
// #60: `confirmDataUse` gives the confirm button a stable `[data-use]` hook
// (the same idea #52 used for the five-use grid) instead of leaving
// decorateSheet() to find it by position or text -- this footer is shared
// by every confirm/cancel row (place/campaign/lobby/bog/headline), so the
// attribute is only ever set when a caller actually passes one (today,
// only the headline commit button below).
// #62 part 2, item A: `sound`, when given, plays before `onConfirm` runs AND
// marks the confirm button `no-tap-sound` (the generic sfx.ui.tap listener,
// below, skips it) -- "one press, one sound", never both the generic tap
// and this button's own more specific one. Only the callers that actually
// have a more specific sound (蓋下's sfx.card.commit, a map confirm's
// sfx.map.confirm) pass it; every other footer() confirm (event/reform,
// the plain "bog" discard) is untouched and keeps the generic tap.
// #68 round 2: `into`, when given, appends Cancel/Confirm onto THAT row
// (e.g. the compact chip's own `.sheet-chip`) instead of building a new
// `.sheet-footer` row of their own — closes the last few px of the
// campaign/lobby target-picked state at 390x669/375x667 (an entire row +
// its gap, on top of the target preview's own move into #promptScroll).
function footer(sh, confirmLabel, onConfirm, confirmDisabled, onCancel, richHTML, confirmDataUse, sound, into) {
  const r = into || row(sh, "sheet-footer");
  btn(r, t("buttons.cancel"), onCancel || (() => { game.ui = freshUi(); render(); }));
  let c;
  const confirm = sound ? () => { Audio.play(sound, { isPress: true }); onConfirm(); } : onConfirm; // #66 S5 follow-up
  if (richHTML) {
    c = document.createElement("button");
    c.type = "button"; c.className = "primary"; c.disabled = !!confirmDisabled; c.innerHTML = confirmLabel;
    c.onclick = confirm;
    r.appendChild(c);
  } else {
    c = btn(r, confirmLabel, confirm, "primary", null, confirmDisabled);
  }
  if (confirmDataUse) c.dataset.use = confirmDataUse;
  if (sound) c.classList.add("no-tap-sound");
  return r;
}
// The five-use grid's own button: one label, in the interface language
// (#46 — was two lines stacked, zh over en, per #29's original bilingual
// design; the owner's ruling reversed that for every card face). Still a
// plain <button>, so decorateSheet()'s ".sheet-grid button" selector and
// tutorial.css's own hiding rule need no change.
function useBtn(parent, use, onClick, pressed, disabled) {
  const b = document.createElement("button");
  b.type = "button"; b.disabled = disabled;
  b.setAttribute("aria-pressed", String(pressed));
  if (lang === "zh-Hant") b.lang = "zh-Hant";
  b.textContent = lang === "en" ? useEn(use) : useZh(use);
  b.onclick = onClick;
  parent.appendChild(b);
  return b;
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
  // Whether a short viewport may fold the hand/prompt/sheet away (#24, widened
  // by #54): true while the map is actively in play (picking a campaign/lobby
  // target, placing points, including an event's forced placement) OR any
  // pending choice (renderPending() below sets it unconditionally — see its
  // own comment) is up. Set false here and overridden by whichever branch
  // below actually needs it; layoutTable() reads this flag to decide whether
  // a short viewport may give way (hand -> prompt -> sheet) instead of
  // overflowing.
  game.givesWay = false;
  // The sheet's own background follows the selected card's owner, like the
  // card-sheet mockups (a Chu card opens on lacquer red, Qin on black,
  // neutral/scoring on parchment).
  sh.className = "sheet" + (game.ui.card != null ? " sheet-" + cardSide(game.ui.card) : "");
  const me = game.me, ui = game.ui;
  const err = ui.err ? `<div class="err">${esc(ui.err)}</div>` : "";
  // #97: always on, independent of the advisor -- see scoringWarnText()'s own
  // comment. `warnText` is the plain sentence (reused below for the pinned
  // copy on a card page); `roundWarn` is the same thing pre-wrapped for
  // setPrompt() to splice in first, ahead of whatever the state's own prompt
  // says, same as the mockup's vermilion warning line.
  const warnText = scoringWarnText(v, me);
  const roundWarn = warnText ? `<div class="prompt-warn">${esc(warnText)}</div>` : "";
  // #92: `ui.historyOpen` is the persisted choice for THIS card page (reset
  // only by freshUi() — see its own comment); this hands historyBox() a
  // fresh { open, onToggle } each render so a click there writes straight
  // back to it without this function needing its own re-render.
  const histState = () => ({ open: ui.historyOpen, onToggle: (v) => { ui.historyOpen = v; } });
  // #24 round 2 (orchestrator's fix #2): every setPrompt() call also parks
  // the same text as a hidden first line inside the sheet — layoutTable()
  // reveals it only when it actually hides #prompt on a short viewport, so
  // an instruction never just vanishes (e.g. an event's forced "Pick 1 (1
  // left)" used to leave the sheet with nothing but Confirm/Cancel and no
  // question). Never both visible at once: #prompt showing is the normal
  // case, this is only the fallback layoutTable() reaches for.
  // #68 round 2: an enemy card's order/pair summary (below) is decided
  // BEFORE this function knows which branch (place/campaign/lobby/event/
  // reform) will actually call setPrompt() last — queuing its text here and
  // having setPrompt() itself append it (once, whichever call turns out to
  // be the final one) is simpler than threading it through every branch.
  let compactHint = "";
  const setPrompt = (html) => {
    // #97: roundWarn goes first, ahead of the state's own sentence -- "put it
    // first in the text area" -- and lands inside #promptText itself (the
    // scrolling part of #prompt), never a separate pinned banner.
    p.innerHTML = roundWarn + html + err;
    if (compactHint) p.insertAdjacentHTML("beforeend", `<div class="prompt-note">${esc(compactHint)}</div>`);
    let titleEl = sh.querySelector(".sheet-title");
    if (!titleEl) { titleEl = document.createElement("div"); titleEl.className = "sheet-title"; titleEl.hidden = true; sh.insertBefore(titleEl, sh.firstChild); }
    // #110: roundWarn used to share the compact form's single nowrap/ellipsis
    // line with the state's own sentence (`html`) -- a scoring warning that
    // can lose the game must never be the part that gets clipped, so it's no
    // longer inside the same clipped box. `html`+`err` (the give-way-first
    // half, same clipping style.css already applied to the whole title for
    // the enemy order/pair summary case) move into their own `.sheet-rest`
    // wrapper; roundWarn stays a direct child of `.sheet-title` so the
    // compact-form CSS can let it wrap onto its own line(s) instead.
    titleEl.innerHTML = roundWarn + (html || err ? `<div class="sheet-rest">${html}${err}</div>` : "");
  };
  if (v.winner != null) {
    setPrompt(`${t("prompt.over")} <b>${esc(t("over.winner", { side: sideName(v.winner) }))}</b> · ${esc(t("over.reasons." + v.reason))}`);
    btn(sh, t("buttons.result"), () => renderOver(), "primary");
    return;
  }
  const L = E.legal(v, me);
  // #62 part 2 fix 1: sfx.turn.yours itself now decided and played from
  // render() (yoursFires(), combined with voiceBoardAudio()'s own batch) --
  // this used to play it right here, immediately, which could land ahead of
  // or inside the very batch the same render's log diff was about to queue.
  // #53 round 2: a genuinely stuck game (no accepted move, not even the
  // fallback's) said so only in the closed log panel -- the prompt itself,
  // where "Waiting for..." lives, kept telling the player to keep waiting
  // forever. `game.stuck` (set in botLoop() above) overrides it here, on
  // the phone and on desktop alike, including right after a `?resume`.
  if (L.kind === "wait") { setPrompt(game.stuck && game.botLine ? esc(game.botLine) : t("prompt.wait", { name: game.botName })); return; }
  if (L.kind === "pending") { renderPending(v, L.pending, setPrompt, sh); return; }
  if (L.kind === "headline") {
    setPrompt(t("prompt.headline"));
    if (ui.card) {
      cardHeader(sh, ui.card);
      const mid = sheetMid(sh);
      cardTextBox(mid, ui.card);
      if (ui.card !== E.JIUDING && E.CARD[ui.card].scoring) scoringPanel(mid, v, E.CARD[ui.card].scoring);
      // #46: the headline phase has no use buttons, so the history has the
      // most room here of any state — added straight into `mid`, after
      // whatever the advisor's own banner will be inserted before (see
      // placeBanner()'s insertBefore(.sheet-history) in advisor-ui.js).
      if (!Tut.active()) historyBox(mid, ui.card, lang, histState());
      footer(sh, t("buttons.headline"), () => humanAct({ type: "headline", card: ui.card }), false, () => { game.ui = freshUi(); render(); }, false, "headline", "sfx.card.commit");
    }
    return;
  }
  // An action round.
  if (L.bog && L.bog.length && !ui.card) { setPrompt(t("uses.bog")); return; }
  if (!ui.card) { setPrompt(t("prompt.yourAction")); return; }
  if (L.bog && L.bog.length) {
    setPrompt(t("uses.bog"));
    cardHeader(sh, ui.card);
    const bogMid = sheetMid(sh);
    cardTextBox(bogMid, ui.card);
    if (!Tut.active()) historyBox(bogMid, ui.card, lang, histState());
    footer(sh, t("buttons.confirm"), () => humanAct({ type: "play", card: ui.card, use: "bog" }), false);
    return;
  }
  const info = cardInfo(L, ui.card);
  if (!info) { setPrompt(t("prompt.yourAction")); return; }
  // While the map is in play (placing points, picking a campaign/lobby
  // target) the sheet shrinks to a mini chip so the map stays visible and
  // tappable (C2_Place/C2_Campaign). #94: "Card"/看牌 used to swap the full
  // card in in place (chipExpanded); it now opens the read-only peek overlay
  // instead (cardChip(), below), so the chip itself has no expanded state to
  // track any more.
  // #71: an opponent's card with no order chosen yet never counts as
  // map-active -- Confirm stays disabled and the map stays untappable until
  // the player picks 先行動點/先事件 (choosing the use and the order may
  // happen in either order; this only gates the map once a use IS picked).
  const orderPending = info.enemy && !ui.pair && ui.order == null;
  const mapActive = !orderPending && (ui.use === "campaign" || ui.use === "lobby" || (ui.use === "place" && !(info.enemy && ui.order === "eventFirst" && !ui.pair)));
  game.givesWay = mapActive;
  // #24 round 2, fix #3: whenever the CHIP is shown (map active) the
  // order/pair choice is already made — the interactive rows move to
  // whenever the FULL card is on screen instead (browsing it before any use
  // is picked, or the place pre-order step), so they're always reachable
  // rather than landing exactly in the state that gets compacted away.
  // #94: "Card"/看牌 no longer swaps the full card in (it opens the peek
  // overlay instead), so `showFullCard` is simply "map isn't active".
  const showFullCard = !mapActive;
  // #29: the full card page's own scrollable middle — everything from the
  // text box down to the hint line goes in here (`mid`), never `sh`
  // directly, so [Cancel]/[Confirm] (appended to `sh` after this, see the
  // footer() calls below) stay pinned at the bottom of the overlay no
  // matter how long the card's own text or the enemy order row runs. Only
  // set when the full card is actually shown; the compact chip path
  // (mapActive) keeps its old flat, unwrapped layout.
  // #117: 說客's own pairing decision -- `hasPairOptions` is the engine's own
  // list (shared/engine.js's `actionsFor`, `uses.pair`) of enemy cards in
  // this side's hand; empty means there's nothing to choose between.
  // `pairPending` is true only while a decision is genuinely outstanding
  // (options exist, and neither a pair nor "不搭配" has been chosen yet).
  // Computed once, here, ahead of both the explanation note (right below,
  // in `mid`) and the pairing buttons/use-grid gating further down (in
  // `pinned`) so the two always agree on the same decision.
  const hasPairOptions = ui.card === "shuoke" && info.uses.pair && info.uses.pair.length > 0;
  const pairPending = hasPairOptions && ui.pair == null && !ui.noPair;
  let mid = null, pinned = null, chipRow = null;
  if (!showFullCard) {
    chipRow = cardChip(sh, ui.card);
  } else {
    cardHeader(sh, ui.card);
    mid = sheetMid(sh);
    cardTextBox(mid, ui.card);
    // #117: reads right after the card's own text, ahead of the history
    // section -- not tacked on at the very end of `mid` (round 1 of this
    // fix put it there, past a long history entry, easy to miss).
    if (ui.card === "shuoke") {
      note(mid, t(hasPairOptions ? "sheet.shuoke.explain" : "sheet.shuoke.noEnemy", { enemy: sideName(E.other(me)) }));
    }
  }
  const target = showFullCard ? mid : sh;
  if (ui.card !== E.JIUDING && E.CARD[ui.card].scoring) scoringPanel(target, v, E.CARD[ui.card].scoring);
  // #46: the history goes in `mid` too (the last thing in the scrolling
  // part — the advisor's own banner, when it's on, gets inserted just
  // before it instead of after, see advisor-ui.js), never in the tutorial
  // (the coach panel needs the room) and never for the compact chip (no
  // `mid` at all there).
  if (showFullCard && !Tut.active()) historyBox(mid, ui.card, lang, histState());
  // #46 (owner: a player must never scroll to reach a button): the use
  // grid, the enemy order row, 說客's pairing and the hint below all move
  // to `pinned` — a fixed sibling of `mid`, not `mid` itself — so growing
  // the card's own text/history can never push one of them past the fold.
  // The compact chip has no `mid`/`pinned` split at all; its own rows still
  // go straight onto `sh`, already fully on screen there (unchanged).
  pinned = showFullCard ? sheetPinned(sh) : sh;
  // #97: the same warning, restated in this card's own pinned area (fixed,
  // never scrolls) so it's still the last thing seen right before Cancel/
  // Confirm even when this ISN'T the scoring card itself -- opening any
  // other card while the turn's actions are running out must not make the
  // warning disappear. First child of `pinned`, ahead of the use grid.
  if (showFullCard && warnText) note(pinned, warnText, "warn");
  // #117 (owner: 說客 was "a lone, unexplained button" with the wrong hint
  // and an advisor that never mentioned it): make pairing the first thing a
  // player sees on 說客's own page (its explanation now sits right after the
  // card text, above), and gate the use grid + Confirm behind an actual
  // decision (pair with a named card, or explicitly "不搭配") instead of
  // silently defaulting to "alone" the moment a use is tapped.
  if (showFullCard && hasPairOptions) {
    const r = row(pinned, "rowb sheet-pair-row");
    for (const c of info.uses.pair) {
      const kind = cardSide(c);
      const b = document.createElement("button");
      b.type = "button"; b.className = "sheet-pair-card";
      b.setAttribute("aria-pressed", String(ui.pair === c));
      b.dataset.pair = c;
      b.innerHTML = `<span class="ops ${kind}">${esc(opsLabel(c))}</span><span class="nm">${esc(cardName(c))}</span>`;
      b.onclick = () => { ui.pair = ui.pair === c ? null : c; ui.noPair = false; ui.points = []; ui.target = null; render(); };
      r.appendChild(b);
    }
    const noneBtn = btn(r, t("sheet.shuoke.none"), () => { ui.noPair = !ui.noPair; if (ui.noPair) ui.pair = null; ui.points = []; ui.target = null; render(); }, "", ui.noPair);
    noneBtn.dataset.pair = "none";
  }
  const uses = row(pinned, "rowb sheet-grid");
  // #117: 說客's own event use is always dead weight -- `effect()` is empty
  // (shared/cards.js), so playing it alone (or paired: pairing already
  // spends the OTHER card's ops, never an event) never does anything. Kept
  // visible rather than hidden (the brief's own wording), just disabled,
  // same look every other illegal use already has.
  const usable = (u) => (u === "event" ? (ui.card === "shuoke" ? false : info.uses.event) : u === "reform" ? info.uses.reform : !!info.uses[u]);
  for (const u of ["event", "place", "campaign", "lobby", "reform"]) {
    if (ui.card === E.JIUDING && (u === "event" || u === "reform")) continue;
    const illegal = !usable(u);
    // #117: while the pair choice is undecided, a legal use button must
    // still be a real, clickable button (a true `disabled` one would eat
    // the tap) -- `aria-disabled` gives it the identical greyed look
    // (#100's own trick, same CSS rule) while the click still reaches
    // flashUseWarning() instead of picking a use out from under the pending
    // decision.
    const b = useBtn(uses, u, () => {
      if (illegal) return;
      if (pairPending) { flashUseWarning(); return; }
      ui.use = u; ui.points = []; ui.target = null; ui.err = ""; ui.useWarn = false; ui.useWarnPulse = false; render();
    }, ui.use === u, illegal);
    if (!illegal && pairPending) b.setAttribute("aria-disabled", "true");
  }
  if (ui.card === "shuoke" && showFullCard) {
    // 事件 is disabled above for every 說客 page, paired or not -- this is
    // the reason, not just a greyed button with no explanation. `mid`, not
    // `pinned`, same 320x568 budget reasoning as the explain/noEnemy note
    // above -- it's prose, not a control.
    note(mid, t("sheet.shuoke.eventReason"));
  }
  // #24 round 2, fix #3 (owner): "their card"'s ops-first/event-first order
  // and 說客's pairing used to only render once a map-needing use was
  // already picked — exactly the state that #24's own give-way compacts
  // away on a short screen, making them unreachable there. They're real
  // rules choices, not decoration, so they can't just disappear: now shown
  // on the full card (below the five uses, still defaulting to opsFirst /
  // no pair from freshUi()) as soon as the card opens, chosen BEFORE a use
  // is picked. The compact chip instead gets a one-line summary of
  // whatever was already chosen; "Card"/看牌 (now always visible, fix #1)
  // is how you get back to change it.
  // Once a campaign/lobby target is actually picked, its own preview note
  // (further down) already restates the state the player cares about right
  // now — stacking the order/pair summary on top of THAT, too, was enough
  // extra height on its own to blow the 390x669/375x667 budget on an enemy
  // card (round 2 testing). The order/pair choice itself doesn't change
  // once a target's chosen; "Card"/看牌 still reaches it either way.
  const targetPreviewComing = !showFullCard && (ui.use === "campaign" || ui.use === "lobby") && ui.target;
  if (info.enemy) {
    if (showFullCard) {
      const r = row(pinned, "rowb order");
      for (const o of ["opsFirst", "eventFirst"]) btn(r, t(`uses.${o}`), () => { ui.order = o; ui.points = []; render(); }, "", ui.order === o);
      // #71: nothing pressed yet -- tell the player to choose, replacing the
      // static "對手的牌…" hint (sheet.hint.enemy, still rendered further
      // down) only while no order is picked.
      if (ui.order == null && !ui.pair) note(pinned, t("sheet.chooseOrder"));
    } else if (!targetPreviewComing) {
      // The compact chip only ever shows once the map is active, which now
      // requires an order to already be chosen (see `orderPending` above),
      // so `ui.order` is never null here.
      // #68 round 2: queued into compactHint, not the sheet — setPrompt()
      // (called further down by whichever branch actually returns) appends
      // it to #promptScroll instead, one less row #sheet has to reserve at
      // 390x669/375x667.
      compactHint = t(`advisor.suggestOrder.${ui.order}`);
    }
  }
  // #117: the pairing choice itself is now rendered above the use grid (see
  // `pairPending`/`hasPairOptions` above) -- the full card page needs no
  // second copy of it here. The compact chip only ever shows once the map is
  // active, and `mapActive` requires `ui.use` to already be place/campaign/
  // lobby -- the use grid's own onClick (above) refuses to set `ui.use` at
  // all while `pairPending` is true, so by the time the chip can show, a
  // pair decision is already made (same reasoning as `orderPending`, just
  // enforced at the button instead of folded into the `mapActive` formula).
  // It still gets its one-line pair summary, same as before.
  if (ui.card === "shuoke" && ui.pair && !showFullCard && !targetPreviewComing) {
    const pairHint = `${t("uses.pair")} ${cardName(ui.pair)} (${E.opsOf(game.st, me, ui.pair)})`;
    compactHint = compactHint ? `${compactHint} ${pairHint}` : pairHint;
  }
  // #29's design: one line naming what KIND of card this is for the player
  // right now — own event, a shared neutral card, the other side's card
  // (whose event still fires), a scoring card, or (#117) 說客 specifically,
  // whose "neutral card, event or ops" line was simply wrong for it. Only on
  // the full card page (the `sheet.hint.*` copy assumes the reader can
  // already see the use grid/order row above it); the compact chip already
  // has its own target-preview notes doing the same job in less space. #46:
  // moved into `pinned` along with the rest of this row — it's part of the
  // "always reachable" chrome, not the scrolling card text.
  if (showFullCard) {
    const meta = ui.card === E.JIUDING ? null : E.CARD[ui.card];
    const kind = ui.card === "shuoke" ? "shuoke" : meta && meta.scoring ? "score" : info.enemy ? "enemy" : meta && meta.side != null ? "own" : "neutral";
    note(pinned, t("sheet.hint." + kind, { enemy: sideName(E.other(me)) }));
  }
  const base = { type: "play", card: ui.card, use: ui.use };
  if (ui.pair) base.pair = ui.pair;
  if (info.enemy && !ui.pair) base.order = ui.order;
  // #24 round 2, fix #4 (owner): the full card page had no way to back out
  // before picking a use at all — the sheet is a full-screen overlay here
  // (wantsCardOverlay), so the hand underneath isn't tappable either. A
  // permanent Cancel, same reset every other Cancel on this sheet falls
  // back to. #29: Confirm sits right beside it now too (disabled until a
  // use that doesn't need the map is actually picked), rather than Cancel
  // standing alone.
  const cancelToFresh = () => { game.ui = freshUi(); render(); };
  if (!ui.use) {
    setPrompt("");
    // #100: Confirm stays a REAL button (not `disabled`) so it can still
    // receive the tap -- `aria-disabled` gives it the identical look
    // (style.css's `button[aria-disabled="true"]`) and tells a screen reader
    // the same "unavailable" story `disabled` would have, while the click
    // still reaches flashUseWarning() instead of vanishing.
    const r = footer(sh, confirmPhrase(), () => flashUseWarning(), false, cancelToFresh, true);
    const cbtn = r.querySelector(".primary");
    if (cbtn) cbtn.setAttribute("aria-disabled", "true");
    if (ui.useWarnPulse) { uses.classList.add("use-shake"); ui.useWarnPulse = false; }
    // #97 landed `note()`'s own `cls` param and the page's one warning look
    // (`.sheet .note.warn`, style.css) for the scoring-card warning above --
    // reused here instead of a second, bespoke warning class, so the two
    // warnings can never drift into two different looks.
    if (ui.useWarn) note(pinned, t("sheet.pickUseFirst"), "warn");
    return;
  }
  if (ui.use === "event" || ui.use === "reform") {
    setPrompt("");
    footer(sh, confirmPhrase(), () => humanAct(base), false, cancelToFresh, true);
    return;
  }
  // #71: place/campaign/lobby on an opponent's card both need an order
  // before Confirm can fire or the map can be tapped -- same message, same
  // disabled Confirm, for either use.
  if (info.enemy && !ui.pair && ui.order == null) {
    setPrompt(t("sheet.chooseOrder"));
    footer(sh, confirmPhrase(), () => {}, true, cancelToFresh, true);
    return;
  }
  if (ui.use === "place") {
    if (info.enemy && ui.order === "eventFirst" && !ui.pair) {
      setPrompt(t("uses.eventFirst"));
      footer(sh, confirmPhrase(), () => humanAct(base), false, cancelToFresh, true);
      return;
    }
    const { spent } = placementTrial(v, me, ui.points);
    setPrompt(t("prompt.place", { ops: info.ops, left: info.ops - spent }));
    // #94: this used to pass its own onCancel (`() => { ui.points = []; render(); }`),
    // which only dropped any points placed so far and re-rendered the SAME
    // placing state -- with 0 points placed (the common case, since this is
    // the very first render of a fresh "place" pick) that was a dead no-op:
    // same sheet, same prompt, the card still picked. Every other Cancel on
    // this sheet (event/reform, the pre-order state, campaign/lobby) already
    // falls through to footer()'s own default (`cancelToFresh`, i.e.
    // `game.ui = freshUi()`) by passing `undefined` here -- this is the one
    // spot that didn't, for every card's "place" use, not just the Cauldrons.
    footer(sh, t("buttons.done"), () => humanAct({ ...base, points: ui.points }), ui.points.length === 0, cancelToFresh, false, "place", "sfx.map.confirm");
    return;
  }
  // campaign or lobby
  setPrompt(t(`prompt.${ui.use}`, { ops: info.ops }));
  if (ui.target) {
    const trial = E.clone(v); trial.log = [];
    let text;
    if (ui.use === "campaign") { const r = E.campaign(trial, me, ui.target, info.ops); text = t("preview.campaign", { removed: r.removed, placed: r.placed, w: t("weariness." + trial.weariness) }); }
    else { const e = E.edge(v, me, ui.target); text = t("preview.lobby", { edge: e, n: Math.min(info.ops, e) }); }
    // #68 round 2 (orchestrator's ruling): the target's own preview used to
    // be a `note(sh, ...)` row — the exact "explanatory note" the ruling
    // asks to move into #promptScroll instead, so #sheet only has to
    // reserve the chip + the Cancel/Confirm footer. #24 round 3's own
    // `.sheet-title` removal (right below, now gone) existed only to avoid
    // restating the SAME text twice on screen; now that the preview lives
    // in #promptScroll instead of #sheet, the parked sheet-title is no
    // longer redundant with it — keeping it is what lets Stage 2's give-way
    // still show SOMETHING if #promptScroll itself has to hide.
    appendPromptNote(`${spaceName(ui.target)}: ${text}`);
    // #68 round 2: the compact chip gets the SHORT Cancel/Confirm labels,
    // appended onto its own row (`chipRow`) instead of a rich "Confirm ·
    // Campaign · Xinzheng" button on a second row — the target and use are
    // already named by the sheet-title above and the preview note just
    // moved into #promptScroll, so the long label was pure repetition once
    // those two existed. The full card page (showFullCard) is untouched:
    // still its own richHTML confirm, still its own row.
    if (showFullCard) {
      footer(sh, `${t("buttons.confirm")} · ${t(`uses.${ui.use}`)} · ${spaceName(ui.target)}`, () => humanAct({ ...base, target: ui.target }), false, undefined, false, ui.use, "sfx.map.confirm");
    } else {
      footer(sh, t("buttons.confirm"), () => humanAct({ ...base, target: ui.target }), false, undefined, false, ui.use, "sfx.map.confirm", chipRow);
    }
  } else {
    // #24 round 2, fix #1 (owner): before a target is tapped, this branch
    // used to render nothing at all past the chip — 0 visible buttons, no
    // way back. A lone Cancel (the chip's own "Card"/看牌 is always there
    // too, fix #1) is enough; there's no target yet to Confirm.
    // #68 round 2: onto `chipRow` when compact, same reasoning as the
    // target-picked branch above — a lone Cancel on its OWN row measured
    // 19px over #lowerBlock's own budget at 375x667 en (longer button
    // labels than zh) even after every other trim in this state.
    btn(showFullCard ? sh : chipRow, t("buttons.cancel"), cancelToFresh);
  }
}

// #62 part 2, item A: same "one press, one sound" wrapping footer() does
// for its own confirm button (above), for the three renderPending() map
// confirms that use the plain btn() helper instead of footer() (the
// points/setup confirm and the two "ops" pending confirms) -- plays
// `sound` before `onClick`, and marks the button so the generic sfx.ui.tap
// listener (below) skips it.
function btnSound(parent, label, onClick, sound, cls = "primary", pressed = null, disabled = false) {
  const b = btn(parent, label, () => { Audio.play(sound, { isPress: true }); onClick(); }, cls, pressed, disabled); // #66 S5 follow-up
  b.classList.add("no-tap-sound");
  return b;
}
function renderPending(v, p, setPrompt, sh) {
  const ui = game.ui;
  // #54: every pending kind (points/card/option/ops) answers entirely
  // through the sheet's own buttons — never by tapping a card in the hand
  // — so a short viewport may always fold the hand (then the prompt row,
  // then compact the sheet) away here, the same #24 give-way layoutTable()
  // already applies while the map is active. Unconditional (not per-kind):
  // #54 was exactly the "ops" kind's own pre-use-pick moment, which used to
  // leave this false (the map itself isn't tapped until AFTER a use is
  // picked) and cut the hand row off at 390x669/375x667 with the advisor
  // off. "points" was already unconditionally true before this widening —
  // it's still the map in play there too (points are placed by tapping
  // spaces), even for an event's forced placement, which can land here
  // while the player still holds a real hand (#24's "待放置" defect: the
  // hand row stayed up and pushed Confirm off a short screen).
  game.givesWay = true;
  if (p.kind === "points") {
    const key = p.tag === "setup" ? (p.min === v.options.comp && v.turn === 0 && game.me === 1 && !p.options.includes("ying") ? "setupBonus" : "setup") : p.min < p.n ? "pointsMin" : "points";
    // #103: "setup" (the two sides' free-placement prompts) names the
    // regions the engine allows -- derived from p.options's own spaces
    // (SETUP.qin.freeIn / SETUP.chu.freeIn) rather than hard-coded per side,
    // so it stays right if SETUP ever changes. "setupBonus" keeps its own
    // text (#103: that step is right already -- only spaces Chu already
    // holds, not a region list).
    const regions = key === "setup" ? orJoin([...new Set(p.options.map((id) => E.SPACE[id].region))].map(regionShortName)) : "";
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t(`prompt.${key}`, { n: p.n, left: p.n - ui.picks.length, regions })}`);
    const r = row(sh);
    btnSound(r, t("buttons.confirm"), () => humanAct({ type: "choose", choice: ui.picks }), "sfx.map.confirm", "primary", null, ui.picks.length < p.min);
    btn(r, t("buttons.cancel"), () => { ui.picks = []; render(); }, "", null, ui.picks.length === 0);
    return;
  }
  if (p.kind === "card") {
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t(p.min === 0 ? "prompt.cardOptional" : "prompt.card")}`);
    const r = row(sh);
    // #52: a stable hook for advisor-ui.js's decoratePending() to find the
    // suggested card by id, instead of by position -- the same id `answer()`
    // (shared/bots.js) puts in the "choose" action's own choice array.
    for (const c of p.options) { const b = btn(r, `${cardName(c)} (${E.CARD[c].ops})`, () => humanAct({ type: "choose", choice: [c] })); b.dataset.card = c; }
    // #69 addendum: same idea as the [data-card] hook just above, for the
    // one button that names no card -- advise()'s own answer for a skip is
    // `choice: []` (shared/advisor.js's targetsOf()), which decoratePending()
    // (advisor-ui.js) couldn't previously mark at all (its own check was
    // `choice.length === 1`, never true for an empty array).
    if (p.min === 0) { const b = btn(r, t("buttons.skip"), () => humanAct({ type: "choose", choice: [] })); b.dataset.skip = "1"; }
    return;
  }
  if (p.kind === "option") {
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t("prompt.option")}`);
    const r = row(sh);
    // #52: same hook, keyed by the option's own id.
    for (const o of p.options) { const b = btn(r, o.label, () => humanAct({ type: "choose", choice: o.id })); b.dataset.option = o.id; }
    return;
  }
  if (p.kind === "ops") {
    setPrompt(`${p.card ? `<b>${esc(cardName(p.card))}</b> · ` : ""}${t("prompt.ops", { ops: p.ops })}`);
    // #54: this used to only set the top-of-function `game.givesWay` while a
    // use was already picked (once a use is picked, the map is in play the
    // same way it is for a normal card: place taps spaces, campaign/lobby
    // picks a target) — before that, the "怎麼用?" use-buttons state left it
    // false, and a real hangu-style play (an opponent's card, event first,
    // ops left over) measured the hand row cut off 24-25px at 390x669/
    // 375x667 with the advisor off (the log strip's news line pushes the
    // sheet down just enough). The use-buttons are answered from the sheet
    // exactly like every other pending kind, so `game.givesWay = true` at
    // the top of this function already covers this state too — nothing
    // else to set here.
    const r = row(sh);
    // #52: same hook, keyed by the use id ("place"/"campaign"/"lobby") --
    // advise()'s own action for a pending "ops" choice is
    // `{ type: "choose", choice: { use, points } | { use, target } }`
    // (shared/advisor.js's useOf() names a pending choice "not a use", so
    // there is no adv.use/adv.card to read here; decoratePending() reads
    // adv.action.choice.use directly instead).
    for (const u of p.allowed) { const b = btn(r, t(`uses.${u}`), () => { ui.opsUse = u; ui.points = []; ui.target = null; render(); }, "", ui.opsUse === u); b.dataset.use = u; }
    if (ui.opsUse === "place") {
      const { spent } = placementTrial(v, game.me, ui.points);
      // #68 round 2 (orchestrator's ruling): the placement count used to be
      // its own `note(sh, ...)` row, moved into #promptScroll instead (same
      // reasoning as the campaign/lobby target preview above); Done/Cancel
      // used to be a second `.rowb` under it -- appended into the SAME row
      // `r` as the use buttons instead (up to 3 uses + 2 actions, ~70px
      // each, fits 375px in one flex-wrap row), so this state reserves one
      // sheet row instead of a title + two. Together these are what close
      // the 11-38px gap measured at 390x669 zh / 375x667 en for this exact
      // state (the orchestrator's own 2nd-round numbers).
      appendPromptNote(t("prompt.place", { ops: p.ops, left: p.ops - spent }));
      btnSound(r, t("buttons.done"), () => humanAct({ type: "choose", choice: { use: "place", points: ui.points } }), "sfx.map.confirm", "primary", null, ui.points.length === 0);
      btn(r, t("buttons.cancel"), () => { ui.points = []; render(); });
    } else if (ui.opsUse && ui.target) {
      btnSound(sh, `${t("buttons.confirm")} · ${t(`uses.${ui.opsUse}`)} · ${spaceName(ui.target)}`, () => humanAct({ type: "choose", choice: { use: ui.opsUse, target: ui.target } }), "sfx.map.confirm", "primary");
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
    // #97: always on, independent of the advisor -- a scoring card sitting
    // in hand at the turn's end loses outright, so every one wears the tag
    // the moment it's dealt, not only once the round is actually tight (that
    // narrower condition is the separate prompt-area/pinned-area line, above).
    const mustPlay = id !== E.JIUDING && !!E.CARD[id].scoring;
    const b = document.createElement("button");
    b.type = "button"; b.className = `card ${chip ? "chip " : ""}${mustPlay ? "must-play " : ""}${cls}`.trim();
    b.setAttribute("aria-pressed", String(ui.card === id));
    // #39 part 1: the hand shows the interface language only (CSS hides the
    // other .nm-zh/.nm-en span off :root[lang]) -- the other language stays
    // reachable here as the button's own aria-label, and on the full card
    // page (renderCardView/cardHeader, untouched) which still shows both.
    b.setAttribute("aria-label", `${cardZh(id)} / ${cardEn(id)}${mustPlay ? " · " + t("hand.mustPlay") : ""}`);
    const ci = `<span class="ci"><span class="ops ${kind}">${esc(opsLabel(id))}</span><span class="nm"><span class="nm-zh" lang="zh-Hant">${esc(cardZh(id))}</span><span class="nm-en">${esc(cardEn(id))}</span></span></span>`;
    const badge = mustPlay ? `<span class="must-badge" title="${esc(t("hand.mustPlayTitle"))}">${esc(t("hand.mustPlay"))}</span>` : "";
    b.innerHTML = (chip ? ci : `<img class="cardimg" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` + ci) + badge;
    b.disabled = !canPick;
    b.onclick = () => {
      const opening = ui.card !== id; // #62 part 2: "a hand card opens" -- not closing it back down (tapping the same open card again)
      game.ui = freshUi(ui.card === id ? null : id);
      if (opening) Audio.play("sfx.card.pick", { isPress: true }); // #66 S5 follow-up
      render();
    };
    el.appendChild(b);
  };
  for (const id of hand) tile(id);
  if (v.phase === "action" && E.jiudingUsable(v, me)) tile(E.JIUDING, "jiuding");
  // #83: the sidebar hand used to switch between two fixed card sizes with
  // a JS-toggled `.hand-many` class (3 columns up to 6 cards, 4 columns from
  // 7 up). desktop.css now sizes the grid itself with `repeat(auto-fill,
  // minmax(...))` off the sidebar's own width — the CSS reflows the column
  // count on its own as cards are added/removed, so there is no longer a
  // count threshold for this file to track.
}

// #58: a headline can now come in with one or both cards missing (a side
// whose deal ran dry commits nothing — orchestrator's ruling on #57, found
// while reviewing it, not yet seen in a browser when #58 was filed). The
// two-card line stays exactly `log.headline`; a third fewer-cards case each
// gets its own key so the string tables can hold a naturally-worded line
// per case instead of a `cardName(null)` throw. `headlineLogKey` is the one
// place that decides which of the three a given entry is, shared by
// fmtLog() and logLineNodes() below so they never disagree.
function headlineLogKey(l) {
  if (l.type !== "headline") return `log.${l.type}`;
  const [qin, chu] = l.cards;
  if (qin != null && chu != null) return "log.headline";
  if (qin != null || chu != null) return "log.headlineOne";
  return "log.headlineNone";
}
// The i18n substitution table for one log entry — split out of fmtLog()
// below so logLineNodes() (#34) can build the same line as real DOM nodes
// (a clickable button in a card-name's own slot) without re-deriving P a
// second time from `l`.
function logParams(l) {
  const P = { side: l.side != null ? sideName(l.side) : "", turn: l.turn, era: l.era ? t("eras." + l.era) : "", box: l.box, ops: l.ops, removed: l.removed, placed: l.placed, mandate: l.mandate != null ? mandateText(l.mandate) : "", weariness: l.weariness ? t("weariness." + l.weariness) : "", to: l.to ? t("weariness." + l.to) : "" };
  if (l.points) P.spaces = list(l.points, spaceName);
  if (l.target) P.target = spaceName(l.target);
  if (l.card) P.card = cardName(l.card);
  if (l.use) P.use = t("useNames." + l.use);
  if (l.region) P.region = regionName(l.region);
  if (l.state) P.state = stateName(l.state);
  if (l.type === "score") { P.q = l.qin.total; P.c = l.chu.total; }
  if (l.type === "headline") {
    const [qin, chu] = l.cards;
    if (qin != null && chu != null) { P.qin = cardName(qin); P.chu = cardName(chu); P.first = sideName(l.first); }
    else if (qin != null || chu != null) {
      // Exactly one side committed: `l.first` is that side already (engine.js
      // resolveHeadlines() -- `order` is just the one side that played), so
      // it doubles as both "who committed" and "who goes first" here, same
      // as the two-card case above.
      const side = qin != null ? E.QIN : E.CHU;
      P.side = sideName(side);
      P.card = cardName(qin != null ? qin : chu);
      P.other = sideName(side === E.QIN ? E.CHU : E.QIN);
    }
    // Both null (l.first is also null): log.headlineNone names no side and
    // no card, so P needs nothing extra.
  }
  if (l.type === "jiuding") P.side = sideName(l.to);
  if (l.type === "over") { P.side = sideName(l.winner); P.reason = t("over.reasons." + l.reason); }
  if (l.type === "vp") P.side = sideName(l.side);
  return P;
}
function fmtLog(l) {
  const key = headlineLogKey(l);
  // #58: render() calls this for the last 60 log entries on every frame, so
  // one entry whose shape a future engine change doesn't match (a card id
  // logParams()/t() can't resolve) must cost this one line, not the table —
  // same "unknown log shape" already renders as "" (see logCardRefs()'s own
  // note below), a throw here used to instead kill fmtLog() for every OTHER
  // entry in the same render because the .filter() call in renderLog() never
  // got past this one.
  try {
    const s = t(key, logParams(l));
    return s === key ? "" : s;
  } catch (e) {
    // #60: silent for the player (one blank line, not the table -- #58),
    // but a shape logParams()/t() can't resolve is still a real bug a
    // developer should hear about. Once per bad entry is enough; this must
    // never itself throw (a broken console in some embedder, say).
    try { console.error(`fmtLog: log entry type "${l && l.type}" failed`, e); } catch {}
    return "";
  }
}
// Which of logParams()'s placeholder keys are card ids, for a given log
// entry (#34) — same log types and field names as logParams() above, kept
// beside it instead of re-derived from `l` a second time. Only ever covers
// a placeholder the entry's own template already carries: a covered
// headline pick or a face-down Nine Cauldrons pass has no {card}/{qin}/
// {chu} at all in log.headline/log.jiuding above, so "only names already
// public" falls out of the existing log data rather than needing a filter
// here.
function logCardRefs(l) {
  const refs = {};
  if ((l.type === "play" || l.type === "discard" || l.type === "bog") && l.card != null) refs.card = { id: l.card, side: l.side };
  if (l.type === "headline") {
    // #58: a missing card gets no ref at all -- no pill, nothing for
    // logLineNodes()'s wholeLine case below to open a peek sheet on. The
    // one-card case's template (log.headlineOne) only ever names {card}
    // (the side that DID commit is plain text, same as {other}), so the key
    // here matches that placeholder, not {qin}/{chu} from the two-card case.
    const [qin, chu] = l.cards;
    if (qin != null && chu != null) { refs.qin = { id: qin, side: E.QIN }; refs.chu = { id: chu, side: E.CHU }; }
    else if (qin != null || chu != null) refs.card = { id: qin != null ? qin : chu, side: qin != null ? E.QIN : E.CHU };
  }
  return refs;
}
// Same line as fmtLog(l), but as a real DOM element instead of one string:
// literal text is always a plain text node (never innerHTML — a player's
// own arbitrary setup name reaching {side} this way can never be mistaken
// for markup), and each placeholder logCardRefs() names opens the
// read-only peek sheet (#34) instead of just naming the card, whenever
// `clickable`. `clickable` is false during a tutorial (owner: card names
// still show, they just can't be tapped) — no click handler is ever
// created there, so there's nothing for a tampered DOM to bypass, the same
// way installGuard() in tutorial-ui.js reasons about the map/hand. Returns
// null exactly where fmtLog(l) would have returned "" (no template for
// this type).
//
// #34 round 2 (orchestrator's ruling, be5df4b's own .log-card-link padding
// + negative margin trick let one line's hit area bleed onto its
// NEIGHBOUR'S text — measured: "客卿制度"'s own glyphs, centre and lower
// half, resolved to "張儀連橫"'s button instead, one line down. A line
// naming exactly one card becomes the whole row as ONE <button> instead:
// its hit area is just its own line's normal box, which by ordinary block
// layout can never reach past that box into a sibling's — no padding
// trick, so nothing to bleed. log.headline is the one template with TWO
// names in one line; there a single row-button can't work (it would open
// one card no matter which name was tapped), so that line stays a plain
// row with two inline .log-card-link buttons — separated by the
// template's own "and"/"、", never enlarged past their own text metrics,
// so neither one can encroach on the other or on the row above/below.
// `pill` (#39 part 4, corrected by round 1 review — every card name in
// the news strip, not just its latest line): the main log panel never
// passes it, so it "keeps its text links" per the owner's spec unchanged.
// Only changes each card name's own styling class; the wholeLine/two-name
// shape below (round 2's own fix) is untouched either way, so the pill
// never becomes a second nested button.
function logLineNodes(l, clickable, pill) {
  const raw = headlineLogKey(l).split(".").reduce((o, k) => (o ? o[k] : undefined), S);
  if (typeof raw !== "string") return null;
  // #58: same reasoning as fmtLog()'s own try/catch above -- this builds real
  // DOM nodes for the news strip and the log panel on every render(), so one
  // entry a future shape doesn't match must fall out as "no line" (null),
  // never throw partway through and leave the caller's loop with whatever it
  // had already appended.
  try {
    const P = logParams(l);
    const refs = logCardRefs(l);
    const wholeLine = clickable && Object.keys(refs).length === 1;
    const root = document.createElement(wholeLine ? "button" : "div");
    if (wholeLine) {
      root.type = "button";
      root.className = "log-line-link no-tap-sound"; // #66: opens the peek with sfx.ui.open, not the generic tap
      const [ref] = Object.values(refs);
      root.onclick = (ev) => { ev.stopPropagation(); openPeek(ref.id, ref.side); };
    }
    const re = /\{(\w+)\}/g;
    let last = 0, m;
    while ((m = re.exec(raw))) {
      if (m.index > last) root.appendChild(document.createTextNode(raw.slice(last, m.index)));
      const k = m[1], ref = refs[k];
      if (ref && wholeLine) {
        // The card's own name still reads as a link inside the row-button —
        // a plain <span>, not a nested button (buttons can't nest); the
        // <button> ancestor is what actually answers the click.
        const span = document.createElement("span");
        span.className = "log-card-name" + (pill ? " pill" : "");
        span.textContent = cardName(ref.id);
        root.appendChild(span);
      } else if (ref && clickable) {
        root.appendChild(cardLinkButton(ref.id, ref.side, pill));
      } else {
        root.appendChild(document.createTextNode(k in P ? String(P[k]) : `{${k}}`));
      }
      last = re.lastIndex;
    }
    if (last < raw.length) root.appendChild(document.createTextNode(raw.slice(last)));
    return root;
  } catch (e) {
    // #60: same reasoning as fmtLog()'s own catch above.
    try { console.error(`logLineNodes: log entry type "${l && l.type}" failed`, e); } catch {}
    return null;
  }
}
// A card name inside a two-name log line (only log.headline), as a
// clickable link-styled button that opens the read-only peek sheet (#34).
// Never padded or margined past its own text metrics (round 2's fix — see
// logLineNodes() above): the ONLY thing that keeps this from bleeding into
// its neighbour is that its box is exactly its own glyphs, nothing more.
// `side` is credited in the peek's own "{side} played this" hint line —
// here always the card's own headline seat (E.QIN/E.CHU).
function cardLinkButton(id, side, pill) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "log-card-link" + (pill ? " pill" : "") + " no-tap-sound"; // #66: opens the peek with sfx.ui.open, not the generic tap
  b.textContent = cardName(id);
  b.onclick = (ev) => { ev.stopPropagation(); openPeek(id, side); };
  return b;
}
// #34: a read-only look at a card already named in the log/news. Its own
// top-level state (`game.peek`, declared with `game` above), never
// `game.ui` — humanAct/Cancel/headline-reject/etc. all wholesale-replace
// `game.ui` with freshUi(), and a peek must survive every one of those
// resets untouched since it isn't part of the acting player's own turn.
// #35: drawn by the shared card-view.js module (renderCardView) instead of
// this file's own cardHeader()/sheetMid()/cardTextBox() — the same module
// the rules page's card detail view uses, so the peek sheet picked up the
// history section (below the card text) for free. The interactive full card
// page (renderPromptAndSheet, below) still draws itself with this file's own
// cardHeader/cardTextBox/sheetMid: it has no room for history at 669px and
// the owner never asked for it there.
// #66: sfx.ui.open/close for the read-only peek -- both the news strip's and
// the log panel's own card links (logLineNodes()/cardLinkButton() below,
// both marked .no-tap-sound so the generic sfx.ui.tap listener never doubles
// up with this) and this module's own Close button (card-view.js's own
// button, marked .no-tap-sound there for the same reason -- see that file).
// #94: `side` is optional — the log/news links always pass one (who played
// the card, for the "{side} played this" note below); the compact chip's
// "Card"/看牌 button opens the SAME peek for a card still in the acting
// player's own hand, with no side and so no such note.
// #92: `historyOpen` starts false on every fresh peek (this object is
// rebuilt on each openPeek() call, unlike game.ui which a click can mutate
// in place across many re-renders of the SAME open peek — see renderPeek()
// below); that covers the log/news peek AND (per #94) 看牌's own peek alike,
// since they all now go through this one function.
function openPeek(cardId, side = null) {
  game.peek = { card: cardId, side, historyOpen: false };
  Audio.play("sfx.ui.open");
  renderPeek();
}
function closePeek() {
  game.peek = null;
  Audio.play("sfx.ui.close");
  renderPeek();
}
function renderPeek() {
  const el = $("peekSheet");
  const open = !!game.peek;
  el.hidden = !open;
  refreshSheetLock();
  if (!open) { el.innerHTML = ""; el.className = "sheet overlay peek-sheet"; return; }
  const peek = game.peek;
  const note = peek.side != null ? t("sheet.hint.played", { side: sideName(peek.side) }) : undefined;
  renderCardView(el, peek.card, lang, {
    note,
    onClose: closePeek,
    // #92: same { open, onToggle } contract as app.js's own histState()
    // above, backed by game.peek (not game.ui) so a peek's open/closed
    // choice survives every render() call while it's up without touching
    // the acting player's own card-page state at all.
    historyState: { open: peek.historyOpen, onToggle: (v) => { peek.historyOpen = v; } },
  });
}
// #peekSheet itself is built here rather than added to play.html (owned by
// no single file in this issue's own list) — #29's existing `.sheet`/
// `.sheet.overlay`/`.sheet-q/c/n/s` classes (style.css) already give it the
// mobile full-screen overlay and the desktop sidebar placement for free;
// only its own stacking order and single-button footer need CSS at all
// (style.css's #peekSheet/.peek-footer). Appended once, straight into
// #table beside #sheet, before anything can call renderPeek().
{
  const el = document.createElement("section");
  el.id = "peekSheet";
  el.className = "sheet overlay peek-sheet";
  el.hidden = true;
  $("table").appendChild(el);
}
function renderLog(v) {
  syncLogToggleLabel();
  // #27: the title in the panel's own sticky header (not the #logToggle
  // label above, which stays as-is) names what's actually inside it — the
  // room's chat is mixed into the same feed there, so it says so.
  $("logTitle").textContent = game.room ? t("buttons.logChat") : t("buttons.log");
  // #34: card names in the log/news are clickable everywhere except during
  // a tutorial (owner: they still show, they just can't open anything) —
  // Tut.active() is the same switch installGuard() in tutorial-ui.js reads
  // for the map/hand, so this stays in sync with that gate rather than
  // keeping a second one.
  const clickable = !Tut.active();
  $("chatForm").hidden = !game.room || game.spectator;
  // #88: design A 逐手卷軸 -- one row per move (with its result chips),
  // chronological, plus the room's chat and the bot's remarks. See
  // renderLogPanel() below for the scroll-position/filter/tap-to-flash work
  // that has to happen around this innerHTML swap.
  renderLogPanel(v);
  // #53 round 2: on screen without opening 紀錄 -- a sibling of #promptText
  // (see play.html), so the advisor taking over the prompt slot cannot hide
  // it. Cleared by botLoop() (a real bot line replaces it) or humanAct()
  // (the player's own next action), never here.
  const fbEl = $("fallbackBanner");
  if (fbEl) { fbEl.hidden = !game.fallbackNote; fbEl.textContent = game.fallbackNote || ""; }
  // Under the prompt: what happened since this seat last acted.
  const NEWS = new Set(["headline", "play", "place", "campaign", "lobby", "score", "tire", "seal", "unseal", "mie", "restore", "reform", "jiuding", "bog", "skip", "era", "turn"]);
  const newsEntries = v.log.filter((l) => l.i > (game.seenLog || 0) && NEWS.has(l.type) && !!fmtLog(l)).slice(-7);
  // #30: renderLog() is also called directly by #logToggle/#sideFootBtn
  // (opening/closing the panel doesn't need a full render()), which never
  // resets #promptText the way render()'s own setPrompt() does — so a plain
  // beforeend append here used to leave one more copy of this block behind
  // every single time the log panel was opened or closed. Removing any
  // existing one first makes renderLog() idempotent regardless of who calls
  // it or how many times.
  const oldNews = $("promptText").querySelector(".news");
  if (oldNews) oldNews.remove();
  if (newsEntries.length) {
    const newsDiv = document.createElement("div");
    newsDiv.className = "news";
    // #39 part 4, round 1 review (owner's own ruling: "my spec was wrong,
    // not your code"): pilling only the newest line left every OTHER
    // card-naming line as a plain 15px text link — in real play the
    // newest line is rarely a card name at all (a score/reform/turn line
    // almost always follows a play/headline a moment later), so pills
    // barely ever showed. Every card name visible in the strip is a pill
    // now, on whichever line it's on — newest first (unchanged from part
    // 4's own ordering; not itself part of this correction, just kept).
    $("promptText").appendChild(newsDiv);
    newsEntries.slice().reverse().forEach((l) => {
      const node = logLineNodes(l, clickable, true);
      if (node) newsDiv.appendChild(node);
    });
    // #68 (owner: "地圖大小應固定"): this used to prune the OLDEST line
    // (.news's last child, newest-first order) by asking layoutTable() for
    // table-overflow and repeating until it cleared — the same negotiation
    // that let a longer news strip shrink the map. #lowerBlock's own
    // #promptScroll is a fixed-height, self-scrolling box now (style.css):
    // there is nothing left to negotiate, so every line renderLog() itself
    // already kept (newsEntries, sliced to the newest 7 above) just stays in
    // the DOM, newest first, and scrolls with the rest of #promptScroll if
    // it doesn't fit. .news's own CSS max-height (style.css) is still a
    // paint-only safety net, same as before.
  }
  // #promptScroll's fixed height, #hand's fixed row and #sheet's own cap can
  // all still be affected by how many news lines just landed — one more
  // pass so the fade/give-way state layoutTable() computes reflects the DOM
  // this render actually ended up with, not the one before renderLog() ran.
  layoutTable();
}
// ---------- #88: the log panel's own content, filter and tap-to-flash ----------
// `logRows` is whatever renderLogPanel() last drew, keyed by seq so the
// click delegate below can turn a tapped row's data-seq back into the
// groupLog() row log-view.js already built it from (never recomputed on
// every tap). `logJustOpened` makes the very next render scroll to the
// newest entry regardless of where the panel happened to be scrolled
// before it opened; after that, renderLogPanel() only follows the bottom
// if the player was already there (the brief's own rule).
let logRows = [];
let logFilter = LogView.loadFilter();
let logJustOpened = false;
let activeLogSeq = null;
function isLogAtBottom() {
  const el = $("logBody");
  return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}
function syncLogFilters(chatAvailable) {
  if (logFilter === "chat" && !chatAvailable) { logFilter = "all"; LogView.saveFilter(logFilter); }
  $("logFilters").querySelectorAll(".logf").forEach((b) => {
    const f = b.dataset.filter;
    if (f === "chat") b.hidden = !chatAvailable;
    b.classList.toggle("active", f === logFilter);
    b.setAttribute("aria-pressed", String(f === logFilter));
  });
}
function renderLogPanel(v) {
  const chat = game.room ? room.chat.slice(-8) : [];
  const botLine = game.botLine || "";
  syncLogFilters(LogView.hasChat(chat, botLine));
  const wasAtBottom = logJustOpened || isLogAtBottom();
  const { html, rows } = LogView.renderRows(v.log, { lang, filter: logFilter, chat, botLine });
  $("logLines").innerHTML = html;
  logRows = rows;
  if (activeLogSeq != null) {
    const el = $("logLines").querySelector(`.logrow[data-seq="${activeLogSeq}"]`);
    if (el) el.classList.add("active");
  }
  if (wasAtBottom) $("logBody").scrollTop = $("logBody").scrollHeight;
  logJustOpened = false;
}
$("logFilters").querySelectorAll(".logf").forEach((b) => {
  b.onclick = () => {
    logFilter = b.dataset.filter;
    LogView.saveFilter(logFilter);
    Audio.play("sfx.ui.tap");
    if (game.st) renderLog(E.view(game.st, game.me));
  };
});
const desktopLayout = () => { try { return matchMedia("(min-width: 1024px)").matches; } catch { return false; } };
// A tap on a move/headline row (log-view.js's own .logrow[data-seq]): flash
// its spaces (or stat column) on the map, and on the phone shrink the panel
// to its lower third so the map stays visible above it (the design's own
// frame ②) -- desktop already shows the map beside the sidebar, so it just
// flashes. The card thumbnail is its own nested button (never the row's own
// click, so tapping it can't also trigger a flash) and opens the existing
// read-only peek sheet (#34), same as a card name in the old flat log.
// #120: every other card name log-view.js marks up (.log-card-link, in the
// row text, a headline's two cards, 說客's pair, and #115's event chips) is
// the SAME kind of nested button -- checked right after the thumb, before
// the row-flash fallback below, so it never also flashes/actives the row.
$("logLines").addEventListener("click", (ev) => {
  const thumb = ev.target.closest(".logrow-thumb");
  if (thumb) { ev.stopPropagation(); openPeek(thumb.dataset.card, Number(thumb.dataset.side)); return; }
  const link = ev.target.closest(".log-card-link");
  if (link) { ev.stopPropagation(); openPeek(link.dataset.card, link.dataset.side != null ? Number(link.dataset.side) : null); return; }
  const rowEl = ev.target.closest(".logrow[data-seq]");
  if (!rowEl) return;
  const seq = Number(rowEl.dataset.seq);
  const row = logRows.find((r) => r.seq === seq);
  if (!row) return;
  activeLogSeq = seq;
  $("logLines").querySelectorAll(".logrow.active").forEach((n) => n.classList.remove("active"));
  rowEl.classList.add("active");
  LogView.flashRow(row);
  if (!desktopLayout()) $("logBody").classList.add("logbody-shrunk");
});
$("chatForm").onsubmit = (ev) => {
  ev.preventDefault();
  const text = $("chatIn").value.trim();
  if (text) send({ type: "chat", text });
  $("chatIn").value = "";
};
// #logToggle's own state names open/closed; every path that opens or closes
// the panel must keep it in sync, or it goes stale until the next render
// (#27 follow-up: closing from the header's own button or the scrim left it
// reading "(Hide)" while the panel was shut). #83: the desktop footer
// (#sideFoot/#sideFootBtn) that used to also open this panel is gone —
// #logToggle already opened the same #logBody, chat included (renderLog's
// #chatForm.hidden only ever reads game.room/game.spectator, never which
// button opened the panel), so removing it needed no new behavior here.
// #30: now that this button lives in the top bar next to Advisor/Rules/lang
// instead of the prompt row, its own label is always just "Log"/"紀錄" (no
// "(Show)"/"(Hide)" suffix, which never fit the bar's other three-word
// labels) — open/closed is carried by aria-expanded instead, same as any
// other disclosure control.
function syncLogToggleLabel() {
  const hidden = $("logBody").hidden;
  $("logToggle").textContent = t("buttons.log");
  $("logToggle").setAttribute("aria-expanded", String(!hidden));
}
// #27: the panel used to be the only way to close itself (#logToggle in the
// prompt row), and once the log grew past a few lines it covered its own
// toggle button along with the whole prompt row and hand underneath — no way
// left to close it or play a card except reloading. It now closes itself
// from three places: its own sticky-header close button, a full-viewport
// scrim behind it, and (unchanged) #logToggle. Every one of those paths
// runs through here so #logToggle's own label never goes stale.
function setLogOpen(open) {
  $("logBody").hidden = !open;
  $("logScrim").hidden = !open;
  syncLogToggleLabel();
  // #88: opening always jumps to the newest entry (the brief's own rule);
  // closing drops the shrink-to-lower-third state and clears whatever the
  // last tapped row was flashing on the map, so the next open starts clean.
  if (open) { logJustOpened = true; }
  else { $("logBody").classList.remove("logbody-shrunk"); activeLogSeq = null; LogView.clearFlash(); }
}
// #66: sfx.ui.open/close on the log panel's own user-driven opens/closes
// only -- NOT setLogOpen(false)'s other caller (a fresh game's initial
// reset, before the panel has ever been shown to anyone). Each of these four
// controls is marked .no-tap-sound in play.html so the generic sfx.ui.tap
// listener never doubles up with the more specific sound played here.
$("logClose").onclick = () => { setLogOpen(false); Audio.play("sfx.ui.close"); };
$("logScrim").onclick = () => { setLogOpen(false); Audio.play("sfx.ui.close"); };
$("logToggle").onclick = () => {
  const opening = $("logBody").hidden;
  setLogOpen(opening);
  Audio.play(opening ? "sfx.ui.open" : "sfx.ui.close");
  if (game.st) renderLog(E.view(game.st, game.me));
};
// The result screen's whole colour follows the WINNER, not your own seat
// (owner, 2026-09-19: "for win page, the background should be the winner's
// nation background") — #over.winner-qin/winner-chu carry that in
// screens.css, set here rather than through paintBody (which still colours
// the header/buttons by your own seat, unchanged for the table).
// #50 "B 燼": the LOSER gets a different page instead — their own emblem
// broken in the ash/fire (art/ui/lose_qin.jpg / lose_chu.jpg), no filter, no
// big glyph, on their own (dark, unglamorous) ground — #over.loser-qin/
// loser-chu instead of winner-qin/winner-chu. The winner and the spectator
// still see exactly what they saw before this issue.
const overGlyphChar = (side) => (side === E.QIN ? "秦" : "楚");
function renderOver() {
  const st = game.st;
  const winner = st.winner;
  const lost = !game.spectator && game.me !== winner;
  const loserSide = lost ? game.me : null;
  const p = { winner: sideName(winner), loser: sideName(1 - winner) };
  // #113: a spectator never reads "you" -- lost/win decide a SEATED player's
  // wording only (and still drive the art/glyph/colour below, unchanged: a
  // spectator sees exactly the winner's page, per the issue). The line of
  // text itself gets a third variant, `watch`, added to both i18n files
  // rather than reused from win/lose (see #113's own comment there).
  const outcome = lost ? "lose" : game.spectator ? "watch" : "win";
  $("overImg").src = lost ? `art/ui/lose_${E.SIDES[loserSide]}.jpg` : `art/ui/win_${E.SIDES[winner]}.jpg`;
  // Neither page uses the greyscale filter any more: it existed only because
  // the loser used to see the WINNER's own picture, unweathered, and needed
  // muting; the loser's own broken-emblem picture is already sombre.
  $("overImg").style.filter = "";
  // #overGlyph is the winner's big 秦/楚 seal — meaningless (and wrong) on
  // the loser's page, so it is hidden via the `hidden` attribute (removes it
  // from the accessibility tree too), not left empty.
  $("overGlyph").hidden = lost;
  if (!lost) {
    $("overGlyph").textContent = overGlyphChar(winner);
    $("overGlyph").classList.toggle("glyph-chu", winner === E.CHU);
    $("overGlyph").classList.toggle("glyph-qin", winner === E.QIN);
  }
  $("overReasonTitle").textContent = t(`over.reasons.${st.reason}.title`, p);
  $("overLine").textContent = t(`over.reasons.${st.reason}.${outcome}`, p);
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
  // win-qin/win-chu body class needed. #50: the loser gets loser-qin/
  // loser-chu instead (by their OWN seat, not the winner's), same idea,
  // desktop.css keys its own plain-ground backdrop off those too.
  $("over").classList.toggle("winner-chu", !lost && winner === E.CHU);
  $("over").classList.toggle("winner-qin", !lost && winner === E.QIN);
  $("over").classList.toggle("loser-chu", loserSide === E.CHU);
  $("over").classList.toggle("loser-qin", loserSide === E.QIN);
  // aria-label is unchanged by #50 — it always names the WINNER ("X 獲勝"),
  // win or lose.
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
  resetVoicingState(); // #62 part 2 fix 3: this connection's first "view" must not voice whatever it already contains
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
// #66 (S5): the room's "say" system lines are server-rendered TEXT with no
// structured key -- src/room.js's this.t(key, {name}) fills in the exact
// same public/i18n `sys.*` templates this client ships (both files, not
// src/, which stays untouched), in the room's OWN language (`room.settings.
// lang`, shared by every seat regardless of each viewer's own display
// language) -- so matching `m.text` back against those templates (escaped,
// `{name}` loosened to a wildcard) recovers which system event a line is.
// Never exercised: rooms need the Worker, absent from this sandbox (see the
// handover) -- read straight off src/room.js's own this.say() call sites.
function sysMatches(text, key) {
  for (const table of [en.sys, zh.sys]) {
    const tpl = table && table[key];
    if (!tpl) continue;
    const pattern = "^" + tpl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\{name\\}", "[\\s\\S]*") + "$";
    if (new RegExp(pattern).test(text)) return true;
  }
  return false;
}
function onRoomMsg(m) {
  switch (m.type) {
    case "joined":
      room.code = m.code; room.me = m.side; room.token = m.token;
      if (m.token) { sess.set("zh.token." + m.code, m.token); sess.set("zh.lastRoom", m.code); }
      game.spectator = m.side == null; game.me = m.side ?? 0;
      // #111: this used to rewrite the address bar to show the code here,
      // via the History API -- GA4's Enhanced Measurement fires its own
      // automatic page_view off any history change, reading location.href
      // itself, so that call was sending the code to Google no matter what
      // our own gtag() calls did. The code lives in room.code (state) and
      // sessionStorage's zh.lastRoom (so a refresh still finds the room);
      // the address bar keeps whatever clean URL it already had.
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
      if (!m.sys) setLogOpen(true);
      if (game.st) renderLog(game.st);
      renderLobbyChat();
      // #66 (S5): a chat line from someone else -- `m.seat` is an INDEX into
      // `room.seats` (same as the name lookup two lines up), while
      // `room.me` is a SIDE (0/1) from the "joined" message, so "my own
      // line" is `room.seats[m.seat]?.side === room.me`, not `m.seat ===
      // room.me` (those are different domains and can disagree once seats
      // reorder). sys.joined can never be OUR OWN join: src/room.js's own
      // join handler (read, not touched) calls this.say() BEFORE
      // ctx.acceptWebSocket() registers the new socket, so the joining
      // client's own connection is never in that broadcast's audience --
      // every sys.joined a client receives is already "another" seat.
      if (m.sys) {
        if (sysMatches(m.text, "joined")) Audio.play("sfx.room.join");
        else if (sysMatches(m.text, "left") || sysMatches(m.text, "leftGame")) Audio.play("sfx.room.leave");
        else if (sysMatches(m.text, "timeout")) Audio.play("sfx.turn.timeout");
        else if (sysMatches(m.text, "dealt")) Audio.play("sfx.room.start"); // the lobby turning into the table
      } else if (room.seats[m.seat]?.side !== room.me) {
        Audio.play("sfx.room.chat");
      }
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
  // #111: built from room.code (state), never from the address bar -- the
  // address bar no longer carries the code at all, on purpose.
  const url = buildRoomShareUrl(location.origin, location.pathname, room.code);
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
// #62 part 2, item A + fix 2: the room clock's own tick/last-second sounds.
// The visible countdown text (unchanged, below) is for every seat and a
// spectator alike, but the SOUND is only for a seated player whose OWN
// decision the clock is actually running against -- a spectator has no
// clock to feel pressured by, and a seated player hears nothing during the
// OPPONENT's turn (the orchestrator's own checker read the guard and caught
// both: originally only `!room.deadline` etc., nothing about the seat or
// whose turn it is). `lastClockS` (not just "did the interval fire") so a
// fresh deadline starting at s=10 always plays even if the PREVIOUS
// deadline also happened to end at s=10, and so this fires once per
// distinct second even if the 1000ms interval drifts a little. Reset to
// null whenever there's no active deadline OR the sound-gate above doesn't
// hold, so the next real "my own clock" deadline starts clean.
let lastClockS = null;
setInterval(() => {
  if (!game.room || !game.st || game.st.winner != null || !room.deadline) { lastClockS = null; return; }
  const s = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
  $("barMid").textContent = `${t("tracks.turn")} ${game.st.turn} · ${game.spectator ? "" : sideName(game.me)} · ${t("lobby.clock", { s })}`;
  layoutBar();
  const myClock = !game.spectator && E.mustAct(game.st).includes(game.me);
  if (!myClock) { lastClockS = null; return; }
  if (s !== lastClockS) {
    if (s >= 4 && s <= 10) Audio.play("sfx.turn.clock.tick");
    else if (s >= 1 && s <= 3) Audio.play("sfx.turn.clock.last");
    lastClockS = s;
  }
}, 1000);

// #62: sfx.ui.tap on every button/link-button press EXCEPT the map's hit
// buttons (#hitLayer -- placing/campaigning/lobbying get their own sfx.map.*
// cues), the hand cards (sfx.card.pick/commit), and anything footer()/
// btnSound() marked `.no-tap-sound` (蓋下 and every map confirm: "one press,
// one sound", never the generic tap doubled with a more specific one).
// Capture phase so it still fires when a handler underneath calls
// stopPropagation.
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("button, a");
  if (!el || el.closest("#hitLayer") || el.closest(".hand") || el.closest(".no-tap-sound")) return;
  Audio.play("sfx.ui.tap", { isPress: true }); // #66 S5 follow-up: a Confirm's own batch waits on this
}, true);

// ---------- boot ----------
const params = new URLSearchParams(location.search);
setLang(params.get("lang") || store.get("zh.lang", (navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));
if (params.has("tutorial")) {
  // Hand the whole page over to the tutorial (#15): it owns game.st/game.ui
  // from here, app.js only renders what it's told and asks before acting.
  Tut.start({ E, t, game, freshUi, render, show, layoutTable, $, esc, getLang: () => lang });
} else if (params.has("resume") && loadSolo()) resumeSolo();
else if (params.get("create") === "1") maybeConnect({ create: "1" });
else {
  // #111: a room's code never lives in the URL any more (this page's own
  // inline <head> script already moved a shared link's ?room=CODE into
  // sessionStorage's zh.joinRoom and cleaned the address bar, before this
  // module -- or the GA tag -- ever loaded; see room-url.js). zh.joinRoom
  // is read once here and forgotten, so leaving and coming back to this
  // page some other way doesn't silently rejoin. zh.lastRoom (set once a
  // "joined" message actually confirms the seat, in onRoomMsg above) is
  // what makes a mid-room refresh land back in the same room.
  let linkRoom = null;
  try { linkRoom = readAndConsume(sessionStorage, "zh.joinRoom"); } catch {}
  const resumeRoom = linkRoom || sess.get("zh.lastRoom");
  if (resumeRoom) {
    const code = resumeRoom.toUpperCase();
    maybeConnect({ room: code, token: sess.get("zh.token." + code) || "" });
  } else {
    // The landing's Qin/Chu/Random taps preselect a side and land here;
    // the level (bot strength) is still picked on this screen.
    const side = params.get("side");
    if (side === "qin" || side === "chu" || side === "random") { setup.side = side; store.set("zh.side", side); }
    renderSetup();
    show("setup");
  }
}
// #24 round 2, fix #5: the very first paint into the table view can land
// before the webfonts finish loading — a fallback font's metrics measured
// .bar at 64px (not 54) on a real English 390-wide phone, one whole
// give-way stage too tall, until the NEXT render() (any click) re-measured
// with the real font and fixed itself. Re-running layoutBar() catches that
// first frame without waiting for a click. Three independent triggers,
// belt-and-suspenders: document.fonts.ready is the direct signal, but this
// session's own dev sandbox has no route to fonts.googleapis.com at all —
// it resolves "ready" immediately over a font that never actually loads,
// so it alone couldn't be verified end to end here. window's own "load"
// and a couple of short delayed re-checks cover a real device regardless
// of exactly which resource the race was against.
try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layoutBar()); } catch {}
window.addEventListener("load", () => layoutBar());
setTimeout(() => layoutBar(), 300);
setTimeout(() => layoutBar(), 1200);
