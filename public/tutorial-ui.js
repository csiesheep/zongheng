// The tutorial's picture: the coach panel, the spotlight, the opening card
// and the completion page. The script and the gate are public/shared/tutorial.js
// (BE's, #13); the words are the writer's, in i18n's tutorial.* (#14). This
// file only decides what lights up, what the coach says, and which tap does
// what — it never reaches into the engine except through the shared script's
// own functions (createTutorial/applyStep/submit/factsOf/replayTo/allows).
//
// app.js hands this module control (Tut.start), asks it to decorate every
// render (Tut.decorate), and asks it before committing an action
// (Tut.allowsAction) — see the three call points named in issue #15. Nothing
// else in app.js knows a lesson exists.
import * as E from "./shared/engine.js";
import { createTutorial, STEPS, applyStep, factsOf, replayTo, allows } from "./shared/tutorial.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import * as Audio from "./audio.js"; // #66 (S5, FE, cross-boundary -- flagged at handover): sfx.tut.step

const QIN = E.QIN;
// Issue #31: tutorial.css's own rules that dim/spotlight existing table
// elements (the hand's cards, etc.) are scoped to this class so a lesson's
// look never leaks into a normal game. Added the moment a lesson starts;
// removed on every way out. Every "out" path today is a full navigation
// (skipOut/skipToDone's own href, the done page's "與電腦對弈" link) which
// resets the whole document anyway, but the class is still added/removed
// explicitly rather than relied on implicitly, since a future in-page exit
// (no reload) would otherwise silently reintroduce this same bug.
const TUT_BODY_CLASS = "tut-on";
const SEEN_KEY = "zh.tutorialSeen";
export function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch {} }
export function seen() { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } }

let ctx = null;      // hooks from app.js (see start())
let on = false;      // is a tutorial session live
let stepIdx = 0;
let expanded = true; // coach panel's text expanded/collapsed — starts open (owner: the coach's words ARE the lesson)
let advanceTimer = 0;
// The authoritative "what's legitimate right now" sets restrictMap()/
// restrictHand() just computed — installGuard()'s capture-phase listener
// reads these (not each button's own .disabled/.onclick, which a
// falsification probe can tamper with via devtools) so a forced click can
// never reach app.js's own default handler. null means "leave the map/hand
// alone" (restrictMap's own convention — see its `allowed == null` return).
let mapAllowed = null;   // Set of space ids, or null
let handAllowedIdx = -1; // index into the hand array, or -1 (no card wanted)

export function active() { return on; }
// app.js's topbar (#barMid) shows this instead of "Turn N · side" while a
// tutorial is running (owner: "教學 · 第 n / 10 課", not the turn count).
export function barText() { return ctx.t("tutorial.topbar", { n: stepIdx + 1, total: STEPS.length }); }

// ---------- which action each lesson presets, and which the player must still do ----------
// event/scoring deliberately leave one gesture for the player (choosing the
// use, or tapping the card) — see the "do" hints in i18n's tutorial.steps.
function presetFor(step) {
  if (step.expect.kind !== "action") return null;
  const a = step.expect.action;
  if (step.id === "scoring") return { card: null, use: a.use, order: a.order ?? null };
  if (step.id === "event") return { card: a.card, use: null, order: null };
  return { card: a.card, use: a.use ?? null, order: a.order ?? null };
}
function applyPreset(step) {
  const p = presetFor(step);
  const ui = ctx.freshUi(p && p.card ? p.card : null);
  if (p && p.use) ui.use = p.use;
  if (p && p.order) ui.order = p.order;
  ctx.game.ui = ui;
}

// ---------- entering a lesson ----------
function enterStep(i) {
  stepIdx = i;
  expanded = true; // owner: switching lessons always comes back open
  applyPreset(STEPS[i]);
  ctx.show("table");
  ctx.render();
}

export function start(hooks) {
  ctx = hooks;
  on = true;
  document.body.classList.add(TUT_BODY_CLASS);
  markSeen();
  stepIdx = 0;
  ctx.game.room = false;
  ctx.game.spectator = false;
  ctx.game.st = createTutorial();
  ctx.game.me = QIN;
  ctx.game.ui = ctx.freshUi();
  ctx.show("table");
  ctx.render();
  showIntro();
  installGuard();
  installResizeReposition();
}

// A plain window resize only calls app.js's own layoutTable() (its
// listener, near renderMap() below) — never a full render()/Tut.decorate()
// — so the coach panel's pinCoach()-computed top/bottom pixels went stale
// after any resize that isn't also a lesson change (issue #15 review round
// 3, item 3's second half: "layoutTable() 之後要重新定位"). Installed once;
// a no-op whenever a tutorial isn't running.
let resizeInstalled = false;
function installResizeReposition() {
  if (resizeInstalled) return;
  resizeInstalled = true;
  window.addEventListener("resize", () => { if (on && ctx.$("tutCoach")) { pinCoach(); checkOverflow(); } });
}

// Only the FINAL Done/Confirm of an "action"-kind lesson is checked against
// the script by allowsAction() — restrictMap()/restrictHand()'s `disabled`
// is what stops every tap along the way from reaching the wrong space or
// card, and a disabled button ignores both a real click and `.click()`, so
// a real player can never reach any of this. But a button force-enabled via
// devtools and then clicked still reaches app.js's own default handler,
// which happily sets ui.card or pushes ui.points with nothing downstream to
// reject it until the very end — for a "tap"-kind lesson (map/control/hand)
// there is no "downstream" at all, and for a "points"-quota lesson (place/
// enemyCard) one bad tap poisons ui.points for good, since the finished
// array can never again equal the script's exact list (a falsification
// probe for issue #15 review's item 9 found both). This capture-phase
// listener is the backstop: it runs before any bubble-phase handler
// app.js's own renderMap()/renderHand() attached to the button itself, so
// it can stop the click even if `disabled` was tampered with — checked
// against mapAllowed/handAllowedIdx (restrictMap/restrictHand's own
// authoritative sets), never the clicked button's own possibly-tampered
// attributes. Installed once; a no-op outside a tutorial (`on` is false) or
// wherever restrictMap/restrictHand left their set at null/-1 (a lesson
// where that surface plays no part at all).
let guardInstalled = false;
function installGuard() {
  if (guardInstalled) return;
  guardInstalled = true;
  ctx.$("hitLayer").addEventListener("click", (ev) => {
    if (!on || mapAllowed == null) return;
    const btn = ev.target.closest("button");
    const i = btn ? [...ctx.$("hitLayer").children].indexOf(btn) : -1;
    if (i < 0 || !mapAllowed.has(E.SPACES[i].id)) { ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
  ctx.$("hand").addEventListener("click", (ev) => {
    if (!on || handAllowedIdx < 0) return;
    const btn = ev.target.closest("button");
    const i = btn ? [...ctx.$("hand").children].indexOf(btn) : -1;
    if (i !== handAllowedIdx) { ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
}

// ---------- the gate: called by app.js's humanAct before E.apply ----------
export function allowsAction(action) {
  if (!on) return true;
  const step = STEPS[stepIdx];
  if (!step || step.expect.kind !== "action") return false;
  return allows(step, { ...action, side: QIN });
}

// Called by app.js instead of botLoop() once the player's own move has
// already landed on game.st (E.apply already ran with the gated action).
export function afterAction() {
  if (!on) return;
  const step = STEPS[stepIdx];
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    for (const action of step.then) ctx.game.st = E.apply(ctx.game.st, action);
    // #66 (S5): "a tutorial lesson is completed", not on the tutorial's OWN
    // final ending screen (showDone() below, the completion page) -- so the
    // sound plays on every advance to a NEXT lesson, never on the branch
    // that ends the whole tutorial instead.
    if (stepIdx + 1 >= STEPS.length) { on = true; showDone(); }
    else { Audio.play("sfx.tut.step"); enterStep(stepIdx + 1); }
  }, 650);
}

function goBack() {
  if (stepIdx === 0) return;
  const target = stepIdx - 1;
  ctx.game.st = replayTo(target);
  enterStep(target);
}
function skipOut() { document.body.classList.remove(TUT_BODY_CLASS); location.href = "./"; } // intro card's "not now" only — back to landing
function skipToDone() { showDone(); } // coach panel's "skip the tutorial" (issue #15 review): straight to the completion page, not landing
function tapAdvance() {
  if (stepIdx + 1 >= STEPS.length) { showDone(); return; } // the tutorial's own ending screen: no sfx.tut.step (#66 S5)
  Audio.play("sfx.tut.step");
  enterStep(stepIdx + 1);
}

// ---------- helpers: matching DOM order to data order (no new app.js hooks needed) ----------
const spaceIndex = (id) => E.SPACES.findIndex((s) => s.id === id);
function countsOf(arr) {
  const c = {};
  for (const id of arr) c[id] = (c[id] || 0) + 1;
  return c;
}
// The one space (of a multi-point action) still short of its quota, in the
// script's own point order — forces the player's taps into the same order
// the engine sees, so the assembled points array matches step.expect.action
// exactly (tutorial.js's allows() compares arrays, not multisets).
function nextQuotaTarget(need, have) {
  for (const id of Object.keys(need)) if ((have[id] || 0) < need[id]) return id;
  return null;
}

// ---------- decorate(): called at the end of every app.js render() ----------
export function decorate() {
  if (!on) return;
  const step = STEPS[stepIdx];
  const ui = ctx.game.ui;
  const $ = ctx.$;

  // Self-heal: a Cancel button inside the real sheet resets game.ui to blank
  // (app.js's own default). Put the lesson's preset straight back so the
  // player is never left with nothing lit and no way forward.
  const preset = presetFor(step);
  if (preset) {
    if (preset.card && ui.card !== preset.card) { applyPreset(step); return ctx.render(); }
    if (preset.use && ui.use !== preset.use) { ui.use = preset.use; return ctx.render(); }
    if (preset.order && ui.order !== preset.order) { ui.order = preset.order; return ctx.render(); }
  }

  // The real prompt row (whose "your turn" text app.js just wrote into it)
  // is replaced end to end by the coach panel.
  $("prompt").hidden = true;

  // If the PREVIOUS decorate() left body.table-overflow on, style.css's own
  // rule for it switches #table from a fixed, viewport-driven flex column
  // (flex:1 1 auto, overflow:hidden) to one sized to its own content
  // (flex:none, height:auto) — table.clientHeight then just tracks
  // scrollHeight and always reads "fits", which is circular. updateCoach()
  // below calls app.js's layoutTable() a second time (after restrictSheet()
  // has simplified the sheet), and THAT call reads table.clientHeight for
  // its own budget — force the constrained mode back on first so it always
  // measures against the real viewport, never against last cycle's own
  // conclusion (found on a real device sim: 375x553, English, the "hand"
  // lesson — the lit card landed 40px below the fold with no scrollbar to
  // reach it, because the previous lesson had left this class set).
  document.body.classList.remove("table-overflow");

  restrictMap(step, ui);
  restrictHand(step, ui);
  restrictSheet(step, ui);
  buildCoach();
  updateCoach(step); // calls app.js's layoutTable(), which can flip the hand full<->chip and rebuild it from scratch (#5/#18) — see the re-call below
  // Found testing 375x553, English, lesson 3 ("hand"): every card in hand
  // came back enabled, because updateCoach()'s own layoutTable() call
  // switched the hand from "full" to "chip" mode right after restrictHand()
  // ran, and app.js's renderHand() rebuilds #hand's children from scratch on
  // a mode switch — a fresh, unrestricted button for every card, with none
  // of restrictHand()'s disabled/tut-lit/onclick work still attached. Redo
  // it against whatever #hand actually holds now.
  restrictHand(step, ui);
  pinCoach();
  checkOverflow();
  // pinCoach()'s synchronous measurement right after updateCoach() sometimes
  // reads the panel's own height a frame too early — found testing 375x553,
  // English, lesson 1: the very first decorate() (still running behind the
  // intro card) sized the just-built panel correctly, but the SECOND
  // decorate() (fired synchronously when "Start" is clicked, moments later)
  // read a height that undercounted the still-settling layout, so
  // bottomHits/topHits both came back false even though the rendered panel
  // visibly covered the target — no "Got it" ever appeared, and a real tap
  // there would have hit the panel, not the map. landing.js's own
  // syncDesktopSeamNextFrame hits the same class of bug with two rAFs, but
  // rAF never runs at all in a backgrounded tab (confirmed while testing
  // this very fix: document.visibilityState stayed "hidden" throughout, and
  // the scheduled rAFs simply never fired) — a plain double setTimeout
  // reaches the same "let layout settle, then re-measure" outcome without
  // that dependency (still a macrotask, so it queues after the current
  // paint either way on a visible tab). Run after every decorate(), not
  // just the panel's first build, since it's this SECOND call (on lesson
  // entry) that needs correcting, not the first. Guarded on `on` and on the
  // step not having changed since — a lesson change (or leaving the
  // tutorial) before the timer fires would otherwise re-pin a panel for the
  // wrong step.
  const atStep = stepIdx;
  setTimeout(() => setTimeout(() => { if (on && stepIdx === atStep) { pinCoach(); checkOverflow(); } }, 0), 0);
}

// ---------- map restriction ----------
function restrictMap(step, ui) {
  const hitEl = ctx.$("hitLayer");
  const nodes = ctx.$("mapInner").querySelectorAll(".node");
  let allowed = null; // null = leave app.js's own lighting alone; a Set() = force-restrict
  let onAdvanceSpace = null;
  if (step.expect.kind === "tap" && step.expect.space) {
    allowed = new Set([step.expect.space]);
    onAdvanceSpace = step.expect.space;
  } else if (step.expect.kind === "action") {
    const a = step.expect.action;
    if (a.target) allowed = new Set([a.target]);
    else if (a.points) {
      const need = countsOf(a.points), have = countsOf(ui.points || []);
      const t = nextQuotaTarget(need, have);
      allowed = t ? new Set([t]) : new Set();
      // app.js's own Done button only checks ui.points.length === 0 — it
      // would let the player confirm after the FIRST of two taps at the
      // same space. Force it back off until every space in the script's
      // own points array has its exact count.
      const doneBtn = [...ctx.$("sheet").querySelectorAll(".sheet-footer button")].find((b) => !b.textContent.includes(ctx.t("buttons.cancel")));
      if (doneBtn && t) doneBtn.disabled = true;
    } else allowed = new Set(); // event/scoring: map plays no part
  }
  // Dim the map only for lessons where it plays no part at all (event/scoring
  // pick a use or a hand card, never a space).
  ctx.$("map").classList.toggle("tut-dim", allowed != null && allowed.size === 0 &&
    step.expect.kind === "action" && !step.expect.action.target && !step.expect.action.points);
  mapAllowed = allowed; // installGuard()'s capture listener reads this
  if (allowed == null) return;
  [...hitEl.children].forEach((hb, i) => {
    const sp = E.SPACES[i];
    const ok = allowed.has(sp.id);
    hb.disabled = !ok;
    // Only SET .onclick when this is the tap-kind lesson's own target —
    // never touch it otherwise. app.js's renderMap() (which runs earlier in
    // the same render(), right before Tut.decorate()) clears and rebuilds
    // #hitLayer from scratch every time, giving every button, including
    // this one, a fresh `hb.onclick = () => mode.onTap(sp.id)` — that is
    // the real handler an action-kind lesson's placement/campaign/lobby tap
    // needs to keep. An earlier version of this line unconditionally reset
    // .onclick to null on every non-target button on the theory that
    // buttons were reused across renders; they aren't (this file was
    // wrong), and doing so silently deleted app.js's own click handler on
    // every hit button for every action-kind lesson (place/campaign/lobby/
    // enemyCard/destroy) — caught by extending the falsification probe to
    // actually complete a place lesson afterward, not just check "did nothing
    // change" on the wrong tap itself.
    if (onAdvanceSpace && sp.id === onAdvanceSpace) hb.onclick = () => tapAdvance();
  });
  nodes.forEach((n, i) => {
    const sp = E.SPACES[i];
    const isTarget = allowed.has(sp.id);
    n.classList.toggle("tut-lit", isTarget);
    // app.js's own renderMap() sets .lit (a much fainter dashed outline,
    // style.css) on every space currentMode() considers reachable — for a
    // target-based use like campaign that can be several spaces at once,
    // and it stayed on the WRONG ones even after restricting the map,
    // visually competing with .tut-lit's own ring on the real target
    // (issue #15 review round 3, item 4 — a screenshot showed the outline
    // on the wrong city, not the taught one). Strip it from anything that
    // isn't this lesson's own target; the target itself keeps whichever
    // the engine already gave it (redundant with tut-lit, harmless).
    if (!isTarget) n.classList.remove("lit");
  });
}

// ---------- hand restriction ----------
// Only "hand" and "scoring" ask the player to tap the hand itself (every
// other action-kind lesson has its card preset already) — everywhere else
// the row is emptied outright, not just hidden: layoutTable() decides the
// map's height from hand.children.length, so a hidden-but-populated row
// would still keep the map squeezed for a card nobody can tap.
function restrictHand(step, ui) {
  const handEl = ctx.$("hand");
  const wantsHandTap = (step.expect.kind === "tap" && step.expect.card) ||
    (step.expect.kind === "action" && presetFor(step) && presetFor(step).card == null);
  if (!wantsHandTap) { handEl.innerHTML = ""; handEl.hidden = true; handAllowedIdx = -1; return; }
  const hand = ctx.game.st.hands[QIN] || [];
  const targetCard = step.expect.kind === "tap" ? step.expect.card : step.expect.action.card;
  handAllowedIdx = hand.indexOf(targetCard); // installGuard()'s capture listener reads this
  [...handEl.children].forEach((b, i) => {
    const isTarget = hand[i] === targetCard;
    b.disabled = !isTarget;
    b.classList.toggle("tut-lit", isTarget);
    // Only SET .onclick for a "tap"-kind lesson's own target card, same
    // reasoning as restrictMap() above: app.js's renderHand() (just ran)
    // already gave every card a fresh `b.onclick = () => { game.ui =
    // freshUi(...); render(); }` — for the "scoring" lesson (an
    // ACTION-kind lesson that also wants a hand tap), THAT is the handler
    // that must fire when the scoring card is tapped, so it must be left
    // alone rather than nulled out.
    if (step.expect.kind === "tap" && isTarget) b.onclick = () => tapAdvance();
  });
}

// ---------- sheet restriction: which use/order buttons stay live ----------
function restrictSheet(step, ui) {
  const sh = ctx.$("sheet");
  if (step.expect.kind !== "action") { sh.classList.remove("tut-sheet-simple"); return; }
  const wantUse = step.expect.action.use;
  const useOrder = ["event", "place", "campaign", "lobby", "reform"];
  const grid = sh.querySelector(".sheet-grid");
  if (grid) {
    [...grid.children].forEach((b, i) => { if (useOrder[i] !== wantUse) b.disabled = true; });
  }
  const wantOrder = step.expect.action.order;
  const orderRow = sh.querySelector(".rowb.order");
  if (orderRow && wantOrder) {
    const order = ["opsFirst", "eventFirst"];
    [...orderRow.children].forEach((b, i) => { if (order[i] !== wantOrder) b.disabled = true; });
  }
  // Owner's ruling on issue #15 review round 3, item 1: the use row, the
  // order row and the chip's "expand" toggle are all preset already (the
  // step already chose the card's use and, where it has one, its order) —
  // in every lesson but "event" (the one lesson that leaves the use for the
  // player to pick), those rows are pure clutter, and on a short phone that
  // clutter was tall enough to push Confirm/Done off the bottom of a
  // #table locked to overflow:hidden — a dead end the player could not
  // scroll past. tutorial.css hides them under this one class.
  // (step.expect.action.use is the FINAL submitted use, always set — even
  // for "event", whose actual final use IS "event". presetFor()'s own .use
  // is what tells apart "already chosen for the player" from "the player
  // still has to pick it": null only for the "event" lesson.)
  const preset = presetFor(step);
  sh.classList.toggle("tut-sheet-simple", !!(preset && preset.use != null));
}

// ---------- facts -> the writer's placeholders ----------
// tutorial.js hands back spaceZh/spaceEn, cardZh/cardEn, stateZh/stateEn —
// the writer's strings use the bare {space}/{card}/{state} name, in
// whichever language the page is in right now (issue #15's parameter table).
// {to} in the campaign lesson is a special case: the writer's line names the
// weariness track's LAST box (Collapse), not facts.to (which is a mandate
// delta used by the preview line, per the orchestrator's own note); {n} in
// the lobby lesson is the card's ops (facts.ops), not facts.n (the actual
// removed count, which the game's own preview line already shows).
function localizeParams(step, facts) {
  const en = ctx.getLang() === "en";
  const p = { ...facts };
  if (facts.spaceZh !== undefined) p.space = en ? facts.spaceEn : facts.spaceZh;
  if (facts.cardZh !== undefined) p.card = en ? facts.cardEn : facts.cardZh;
  if (facts.stateZh !== undefined) p.state = en ? facts.stateEn : facts.stateZh;
  if (step.id === "campaign") p.to = ctx.t("weariness.1"); // the track's last box
  if (step.id === "lobby") p.n = facts.ops;
  return p;
}

// ---------- coach panel: built once, updated in place (owner: no rebuild flicker) ----------
function buildCoach() {
  if (ctx.$("tutCoach")) return;
  const el = document.createElement("section");
  el.id = "tutCoach";
  el.className = "tut-coach";
  el.innerHTML =
    `<div class="tut-top">` +
    `<span class="tut-dots" id="tutDots"></span>` +
    `<button type="button" class="tut-skip" id="tutSkipBtn"></button>` +
    `</div>` +
    `<button type="button" class="tut-head" id="tutHeadBtn">` +
    `<span class="tut-h-zh" lang="zh-Hant" id="tutHZh"></span>` +
    `<span class="tut-h-en" id="tutHEn"></span>` +
    `<span class="tut-chevron" id="tutChevron" aria-hidden="true">&#9662;</span>` +
    `</button>` +
    `<p class="tut-text" id="tutTextP" hidden></p>` +
    `<div class="tut-do" id="tutDo"></div>` +
    `<button type="button" class="tut-gotit tut-btn-primary" id="tutGotItBtn" hidden></button>` +
    `<div class="tut-actions"><button type="button" class="tut-back" id="tutBackBtn"></button></div>`;
  const dotsWrap = el.querySelector("#tutDots");
  for (let i = 0; i < STEPS.length; i++) {
    const d = document.createElement("span");
    d.className = "tut-dot";
    dotsWrap.appendChild(d);
  }
  // Mounted as #table's own last child (not #map's): on a phone (<1024px)
  // tutorial.css makes it float, position:absolute, over the map's box
  // (pinCoach() below computes its top/bottom in pixels to match #map's own
  // rect within #table, since the two no longer share a box); it can never
  // push the "Back"/"Skip" row off screen because it never takes a row of
  // its own (issue #15 review, item 1). On desktop (>=1024px, #7's frame)
  // it instead becomes a normal grid child in the sidebar's own "prompt"
  // grid-area (which is empty during a tutorial — see $("prompt").hidden
  // above) rather than floating over the map (the orchestrator's desktop
  // note on this same issue): tutorial.css's @media(min-width:1024px)
  // block resets position back to static for that.
  ctx.$("table").insertAdjacentElement("beforeend", el);
  el.querySelector("#tutSkipBtn").onclick = skipToDone;
  el.querySelector("#tutBackBtn").onclick = goBack;
  el.querySelector("#tutHeadBtn").onclick = () => setExpanded(!expanded);
  el.querySelector("#tutGotItBtn").onclick = () => setExpanded(false);
}
// Toggles the prose and repositions/resizes the panel off the back of it —
// used by the header tap, the "Got it" button (see pinCoach() below), and
// enterStep()'s own reset. Kept as one path so every caller gets the same
// layoutTable()+pinCoach() follow-through (issue #15 review round 4: the
// header's own toggle used to skip pinCoach() entirely, so re-expanding a
// lesson that covers its target left the panel sitting over it with no way
// to tell — pinCoach() now runs every time and decides for itself whether
// the Got it button needs to reappear).
function setExpanded(v) {
  expanded = v;
  const el = ctx.$("tutCoach");
  if (!el) return;
  el.querySelector("#tutTextP").hidden = !expanded;
  el.querySelector("#tutChevron").innerHTML = expanded ? "&#9652;" : "&#9662;";
  ctx.layoutTable();
  pinCoach();
  checkOverflow();
}
function updateCoach(step) {
  const t = ctx.t;
  const el = ctx.$("tutCoach");
  const dots = el.querySelectorAll(".tut-dot");
  // Each call sets BOTH classes explicitly — classList.toggle(name, force)
  // returns a boolean, and the previous `a || b` short-circuited on a true
  // "done" and never touched "current", so a dot that was ever current kept
  // that class forever once it became done (issue #15 review, item 3).
  dots.forEach((d, i) => { d.classList.toggle("done", i < stepIdx); d.classList.toggle("current", i === stepIdx); });
  const skip = el.querySelector("#tutSkipBtn");
  if (skip.textContent !== t("tutorial.skip")) skip.textContent = t("tutorial.skip");
  const facts = localizeParams(step, factsOf(ctx.game.st, stepIdx));
  const isEn = ctx.getLang() === "en";
  const zh = zhTitle(step.id), en = t(`tutorial.steps.${step.id}.title`);
  const hZh = el.querySelector("#tutHZh"), hEn = el.querySelector("#tutHEn");
  if (hZh.textContent !== zh) hZh.textContent = zh;
  // Dual title (big zh + small en) only makes sense when the UI itself is
  // English — a zh-Hant UI showing "地圖 地圖" twice was the bug (issue #15
  // review, item 4). In zh-Hant, the big zh title is the only title.
  hEn.hidden = !isEn;
  if (isEn && hEn.textContent !== en) hEn.textContent = en;
  const text = t(`tutorial.steps.${step.id}.text`, facts);
  const p = el.querySelector("#tutTextP");
  if (p.textContent !== text) p.textContent = text;
  p.hidden = !expanded;
  el.querySelector("#tutChevron").innerHTML = expanded ? "&#9652;" : "&#9662;";
  const gotIt = el.querySelector("#tutGotItBtn");
  const gotItLabel = t("tutorial.gotIt");
  if (gotIt.textContent !== gotItLabel) gotIt.textContent = gotItLabel;
  const doText = `${t("tutorial.stepOf", { n: stepIdx + 1, total: STEPS.length })} · ${t(`tutorial.steps.${step.id}.do`, facts)}`;
  const doEl = el.querySelector("#tutDo");
  if (doEl.textContent !== doText) doEl.textContent = doText;
  const back = el.querySelector("#tutBackBtn");
  const backLabel = t("tutorial.back");
  if (back.textContent !== backLabel) back.textContent = backLabel;
  back.disabled = stepIdx === 0;
  ctx.layoutTable();
}
// The coach card always shows the lesson's zh title alongside whichever
// language the player is in (matching the card-name convention elsewhere,
// see TEAM.md's language-mixing exception) — read straight off the zh
// module rather than through ctx.t, which always renders the CURRENT
// language, not necessarily zh.
// ---------- keep the floating panel off whatever it's teaching ----------
// Phone (<1024px): the panel floats over the map, pinned to its bottom edge
// by default (matches the design's Tut_Card); if pinning it there would
// cover the lit space (issue #15 review round 3, item 3 — a screenshot
// showed the city's NAME, not just its disc, sitting under the panel: a
// half-check on which map half the target sits in isn't enough, since the
// panel's own real height decides how far up it reaches) it flips to the
// map's top edge instead, using each candidate position's REAL rect against
// the target's REAL rect (node disc + its label span, which is a sibling
// box positioned outside the disc's own 44x44 box — see .node .nm in
// style.css — so the node's own getBoundingClientRect() alone misses it).
// Since the panel is a child of #table, not #map, its top/bottom are pixel
// offsets within #table's own box (tutorial.css's default position:absolute
// carries neither). Called from decorate() (after layoutTable() already
// ran) AND from a resize listener (installGuard() below) — a plain resize
// only calls app.js's own layoutTable(), never Tut.decorate(), so without
// that listener the panel's position went stale after any layout change
// that isn't a lesson change (round 3 review, item 3's second half).
// Desktop (>=1024px, #7's frame): tutorial.css puts it in the sidebar's own
// grid cell instead (orchestrator's note on issue #15) — no inline
// position needed, so any leftover phone-mode offsets are cleared.
function targetRect() {
  const lit = ctx.$("mapInner").querySelector(".node.tut-lit");
  if (!lit) return null;
  const r = lit.getBoundingClientRect();
  const label = lit.querySelector(".nm");
  if (!label) return r;
  const lr = label.getBoundingClientRect();
  return {
    top: Math.min(r.top, lr.top), bottom: Math.max(r.bottom, lr.bottom),
    left: Math.min(r.left, lr.left), right: Math.max(r.right, lr.right),
  };
}
function overlaps(a, b) { return !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right); }
// Owner's ruling, issue #15 review round 4: the coach's prose starts open
// on EVERY lesson (never auto-collapsed) — collapsing only ever happens
// because the player tapped "Got it", never automatically. That button
// itself only appears when the fully-expanded panel, at whichever edge it
// would otherwise pin to, still covers the taught target — a lesson whose
// panel never reaches the target keeps the text open with no button at all.
// Round 5's ruling (issue #15 review): the EXPANDED panel is allowed to sit
// over the target — nobody is expected to tap while still reading the
// lesson — so the edge is chosen against the COLLAPSED ("Got it" already
// tapped) height, the one state the player actually has to act in. Only
// when EVEN the collapsed panel covers the target at both edges (owner
// named 375x553 as the one case this should ever happen) does this fall
// back to flow mode. Both heights are measured for real via the DOM (toggle
// #tutTextP's hidden, read the box, put it back) instead of guessed, since a
// wrong guess here is exactly what round 4's single-measurement version got
// wrong — it read whatever state the panel happened to already be in.
// The "Got it" button's own visibility is decided by THIS function's caller,
// from a coverage check that itself needs a clean height to test against —
// so both measurements are taken with it force-hidden, not however the
// PREVIOUS lesson's pinCoach() call happened to leave it. Without this, a
// lesson entered right after one that needed "Got it" measured its own
// collapsed height ~50px too tall (the leftover visible button, not yet
// updated for the new step), wrongly concluding neither edge clears the
// target and falling into flow mode — found testing English 390x669's
// "lobby" lesson, entered right after "campaign" (issue #15 review round 5).
function measuredHeight(el, hideText) {
  const p = el.querySelector("#tutTextP");
  const gotIt = el.querySelector("#tutGotItBtn");
  const wasP = p.hidden, wasGotIt = gotIt.hidden;
  p.hidden = hideText;
  gotIt.hidden = true;
  const h = el.getBoundingClientRect().height;
  p.hidden = wasP;
  gotIt.hidden = wasGotIt;
  return h;
}
function pinCoach() {
  const el = ctx.$("tutCoach");
  if (!el) return;
  const gotItBtn = el.querySelector("#tutGotItBtn");
  if (window.matchMedia("(min-width: 1024px)").matches) {
    el.style.top = ""; el.style.bottom = "";
    el.classList.remove("tut-pin-flow", "tut-pin-top", "tut-pin-bottom");
    gotItBtn.hidden = true;
    return;
  }
  const tableRect = ctx.$("table").getBoundingClientRect();
  const mapRect = ctx.$("map").getBoundingClientRect();
  const target = targetRect();
  const collapsedH = measuredHeight(el, true);
  const expandedH = measuredHeight(el, false);
  const rectAt = (edge, h) => edge === "bottom"
    ? { top: mapRect.bottom - h - 8, bottom: mapRect.bottom - 8, left: mapRect.left, right: mapRect.right }
    : { top: mapRect.top + 8, bottom: mapRect.top + 8 + h, left: mapRect.left, right: mapRect.right };
  const covers = (edge, h) => !!target && overlaps(rectAt(edge, h), target);
  const fits = (r) => r.top >= 0 && r.bottom <= window.innerHeight;
  // Prefer bottom (matches the design's Tut_Card); flip to top only when
  // bottom fails collapsed and top doesn't. Neither clearing collapsed is
  // the genuine "nowhere works" case — flow mode.
  let edge = !covers("bottom", collapsedH) ? "bottom" : !covers("top", collapsedH) ? "top" : null;
  const flow = edge == null;
  el.classList.toggle("tut-pin-flow", flow);
  if (flow) {
    el.style.top = ""; el.style.bottom = "";
    el.classList.remove("tut-pin-top", "tut-pin-bottom");
    gotItBtn.hidden = true; // flow mode never covers the map, so there's nothing to dismiss
    return;
  }
  // The chosen edge clears the target once collapsed, but must also land
  // fully inside the viewport at whichever height it's showing RIGHT NOW
  // (issue #15 review round 5, item 1) — try the other edge if this one
  // would spill off screen and the other one wouldn't.
  const h = expanded ? expandedH : collapsedH;
  if (!fits(rectAt(edge, h))) {
    const other = edge === "bottom" ? "top" : "bottom";
    if (fits(rectAt(other, h))) edge = other;
  }
  const needsGotIt = expanded && covers(edge, expandedH);
  gotItBtn.hidden = !needsGotIt;
  el.classList.toggle("tut-pin-top", edge === "top");
  el.classList.toggle("tut-pin-bottom", edge === "bottom");
  if (edge === "top") { el.style.bottom = ""; el.style.top = `${Math.round(mapRect.top - tableRect.top) + 8}px`; }
  else { el.style.top = ""; el.style.bottom = `${Math.round(tableRect.bottom - mapRect.bottom) + 8}px`; }
}

// ---------- last-resort escape hatch: let the page scroll rather than clip ----------
// Simplifying the sheet (restrictSheet's tut-sheet-simple) is the real fix
// for issue #15 review round 3, item 1, but a pathologically small phone
// (owner named 375x553) can still be too short even for the simplified
// sheet plus the map's own floor height — app.js's own layoutTable() never
// sets body.table-overflow for a lesson with an empty hand (the "no hand"
// branch just takes the full width-scaled map height regardless of what's
// left), so #table's own overflow:hidden would swallow the excess
// invisibly instead of letting the page scroll to it. Measured, not
// guessed: if #table's content is taller than its own box after layout,
// add the same escape class #5 already uses for the mobile hand-vs-map
// squeeze (style.css already knows how to render it).
function checkOverflow() {
  const table = ctx.$("table");
  if (window.matchMedia("(min-width: 1024px)").matches) return; // desktop's frame has its own fixed aspect ratio, unrelated escape hatch
  // table.clientHeight is only a fixed, viewport-driven number while
  // body.table-overflow is OFF (style.css's rule for that class switches
  // #table from flex:1/overflow:hidden to flex:none/height:auto, so once
  // it's on, clientHeight just tracks scrollHeight and always reads "no
  // overflow"). A tutorial lesson calls layoutTable() twice per decorate()
  // (render()'s own tail call, then again after restrictSheet() has
  // simplified the sheet) — if the class was left on from the previous
  // lesson, the SECOND call would measure against that already-collapsed
  // clientHeight and undersize the map/hand. Force the constrained mode
  // back on before measuring so every check starts from the same fixed
  // reference frame regardless of what the last render left behind.
  document.body.classList.remove("table-overflow");
  const overflowing = table.scrollHeight > table.clientHeight + 1;
  document.body.classList.toggle("table-overflow", overflowing);
}
function zhTitle(id) { return (zh.tutorial.steps[id] || {}).title || ""; }
function currentS() { return ctx.getLang() === "en" ? en : zh; }

// ---------- intro card ----------
let elIntro = null;
function buildIntro() {
  elIntro = document.createElement("div");
  elIntro.className = "tut-overlay";
  elIntro.innerHTML =
    `<div class="tut-modal">` +
    `<span class="tut-kicker" id="tutIKicker"></span>` +
    `<h1 class="tut-modal-title" id="tutITitle"></h1>` +
    `<p class="tut-modal-sub" id="tutISub"></p>` +
    `<p class="tut-modal-text" id="tutIText"></p>` +
    `<div class="tut-modal-row">` +
    `<button type="button" class="tut-btn-ghost" id="tutINotNow"></button>` +
    `<button type="button" class="tut-btn-primary" id="tutIStart"></button>` +
    `</div></div>`;
  document.body.appendChild(elIntro);
  elIntro.querySelector("#tutINotNow").onclick = skipOut;
  elIntro.querySelector("#tutIStart").onclick = () => { elIntro.hidden = true; enterStep(0); };
}
function showIntro() {
  if (!elIntro) buildIntro();
  const t = ctx.t;
  elIntro.hidden = false;
  elIntro.querySelector("#tutIKicker").textContent = t("tutorial.intro.kicker");
  elIntro.querySelector("#tutITitle").textContent = t("tutorial.intro.title");
  const sub = t("tutorial.intro.sub");
  elIntro.querySelector("#tutISub").hidden = !sub;
  elIntro.querySelector("#tutISub").textContent = sub;
  elIntro.querySelector("#tutIText").textContent = t("tutorial.intro.text");
  elIntro.querySelector("#tutINotNow").textContent = t("tutorial.intro.notNow");
  elIntro.querySelector("#tutIStart").textContent = t("tutorial.intro.start");
}

// ---------- done page ----------
let elDone = null;
function buildDone() {
  elDone = document.createElement("div");
  elDone.className = "tut-overlay tut-done";
  // Same picture as the real win/lose page (#6's C2_Over): art + gradient +
  // big title over the image, then the six ends-of-game and the buttons
  // below (issue #15 review, item 6 — this was plain text on black before).
  // The tutorial only ever ends with Qin destroying Han, so the art is
  // always win_qin.jpg, never chosen at runtime like the real page's.
  elDone.innerHTML =
    `<div class="tut-done-inner">` +
    `<div class="tut-done-art">` +
    `<img class="tut-done-img" id="tutDImg" src="art/ui/win_qin.jpg" alt="">` +
    `<div class="tut-done-shade" aria-hidden="true"></div>` +
    `<h1 class="tut-done-h1">` +
    `<span class="tut-done-title" id="tutDTitle"></span>` +
    `<span class="tut-done-sub" id="tutDSub"></span>` +
    `</h1>` +
    `</div>` +
    `<div class="tut-done-body">` +
    `<p class="tut-done-lead" id="tutDLead"></p>` +
    `<ul class="tut-done-ends" id="tutDEnds"></ul>` +
    `<p class="tut-done-also" id="tutDAlso"></p>` +
    `</div>` +
    `<div class="tut-done-actions">` +
    `<a class="tut-btn-primary" id="tutDPlay" href="play.html?play&side=qin&level=easy"></a>` +
    `<div class="tut-done-row">` +
    `<button type="button" class="tut-btn-ghost" id="tutDReplay"></button>` +
    `<a class="tut-btn-ghost" id="tutDRules" href="rules.html" target="_blank" rel="noopener"></a>` +
    `<a class="tut-btn-ghost" id="tutDHome" href="./"></a>` +
    `</div></div></div>`;
  document.body.appendChild(elDone);
  elDone.querySelector("#tutDReplay").onclick = () => { elDone.hidden = true; ctx.game.st = createTutorial(); enterStep(0); };
  // "與電腦對弈" / "Play now" — a real navigation (href) into a normal game,
  // which reloads the page anyway, but drop the class explicitly first
  // (issue #31) rather than lean on the reload to do it.
  elDone.querySelector("#tutDPlay").addEventListener("click", () => document.body.classList.remove(TUT_BODY_CLASS));
}
function showDone() {
  if (!elDone) buildDone();
  const t = ctx.t;
  const en = ctx.getLang() === "en";
  const raw = factsOf(replayTo(STEPS.length - 1), STEPS.length - 1); // 韓's names, for the title
  const facts = { ...raw, state: en ? raw.stateEn : raw.stateZh };
  elDone.hidden = false;
  elDone.querySelector("#tutDTitle").textContent = t("tutorial.done.title", facts);
  elDone.querySelector("#tutDSub").textContent = t("tutorial.done.sub", facts);
  elDone.querySelector("#tutDLead").textContent = t("tutorial.done.lead");
  // t() coerces everything to a string, which would join the array with
  // commas — read the ends list straight off the current language module.
  const ends = currentS().tutorial.done.ends;
  const ul = elDone.querySelector("#tutDEnds");
  const arr = Array.isArray(ends) ? ends : [];
  ul.innerHTML = arr.map((e) => `<li>${ctx.esc(e)}</li>`).join("");
  elDone.querySelector("#tutDAlso").textContent = t("tutorial.done.also");
  elDone.querySelector("#tutDPlay").textContent = t("tutorial.done.play");
  elDone.querySelector("#tutDReplay").textContent = t("tutorial.done.replay");
  elDone.querySelector("#tutDRules").textContent = t("tutorial.done.rules");
  elDone.querySelector("#tutDHome").textContent = t("tutorial.done.home");
}
