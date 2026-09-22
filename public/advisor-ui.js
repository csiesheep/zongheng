// The advisor's UI (issue #18): a top-bar switch, a suggestion banner, and
// gold decorations on whichever card / use / target #17's own
// `advise(view, side)` names. Everything here is self-contained -- app.js
// only mounts the switch once and calls `decorate(view, meta)` -- so this
// file owns every DOM node it creates and never touches anything app.js
// built (it only reads it, by position: the hand's card order, the sheet's
// fixed use-button order, E.SPACES' order).
//
// orchestrator's 2nd-round review (round 1 was `position: fixed`, floating
// over the map / hand / sheet with a colour scheme meant for a dark
// background, sitting on light ones): the banner is now ALWAYS a normal
// flow element, moved between a small set of real slots that already exist
// in app.js's own layout (never floating, never absolutely positioned), so
// it can never sit on top of anything and its own solid dark background
// always has the contrast it needs.
//
// Two promises this file makes, matching #17's own:
//   - it never calls `advise()` when the switch is off, when this isn't a
//     solo game, when the table isn't the visible view, or when the game is
//     over -- the switch's own visibility follows the same "am I looking at
//     a solo table" gate, independent of on/off.
//   - it never rebuilds its own elements on click. The switch and the
//     banner are each created once; every later update only moves the SAME
//     node between slots, or changes text/attributes/classes on it.
//     Colouring never uses a transition (owner: colours are static).
import { advise } from "./shared/advisor.js";
import * as E from "./shared/engine.js";

const STORE_KEY = "zh.advisor";
const USE_ORDER_FULL = ["event", "place", "campaign", "lobby", "reform"];
const USE_ORDER_JIUDING = ["place", "campaign", "lobby"];
const ORDER_KEYS = ["opsFirst", "eventFirst"];
// owner (#18): the teaching mode never shows the switch. #15 hasn't landed
// yet, so its exact state shape isn't known here -- ?tutorial is the signal
// the brief names explicitly (orchestrator: swap for Tut.active() once #15
// lands and this rebases past it).
let TUTORIAL = false;
try { TUTORIAL = new URLSearchParams(location.search).has("tutorial"); } catch {}

let enabled = false;
try { enabled = localStorage.getItem(STORE_KEY) === "1"; } catch {}
function persist() { try { localStorage.setItem(STORE_KEY, enabled ? "1" : "0"); } catch {} }

let toggle = null; // { root, label, track, dot } -- built once by mountAdvisorToggle
let banner = null; // { root, title, why } -- built once, lazily, by ensureBanner
let lastCtx = null; // the most recent {view, meta, switchVisible}, so the switch's own click can redecorate
let gen = 0; // invalidates a scheduled advise() the moment the position moves on
let lastScrolledCard;
const cache = { fp: null, adv: null, hasResult: false };

// A fingerprint of everything advise()'s answer can depend on, EXCLUDING the
// player's own in-progress UI picks (which card sheet is open, which target
// is tentatively chosen) -- those change on almost every click, and none of
// them change what the best move is, so recomputing on every one of them
// would be wasted work and would flash "thinking" for no reason.
function fingerprint(view, side) {
  const hand = view && view.hands ? view.hands[side] : null;
  return [view?.turn, view?.round, view?.actor, view?.phasing, view?.phase, side,
    view?.logSeq || 0, view?.pending ? 1 : 0, hand ? hand.join(",") : "-",
    view?.winner].join("|");
}

export function mountAdvisorToggle(host) {
  if (!host || toggle || !host.appendChild) return;
  const root = document.createElement("button");
  root.type = "button";
  root.className = "adv-toggle";
  root.hidden = true;
  root.setAttribute("aria-pressed", String(enabled));
  const label = document.createElement("span");
  label.className = "adv-toggle-label";
  const track = document.createElement("span");
  track.className = "adv-toggle-track";
  track.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "adv-toggle-dot";
  track.appendChild(dot);
  root.append(label, track);
  root.addEventListener("click", () => {
    enabled = !enabled;
    persist();
    syncToggleUI(lastCtx && lastCtx.meta);
    if (lastCtx) applyDecorations(lastCtx.view, lastCtx.meta, true, lastCtx.switchVisible);
  });
  host.appendChild(root);
  toggle = { root, label, track, dot };
  if (enabled) toggle.root.classList.add("on");
}

function syncToggleUI(meta) {
  if (!toggle) return;
  toggle.root.setAttribute("aria-pressed", String(enabled));
  toggle.root.classList.toggle("on", enabled);
  if (meta && meta.t) {
    toggle.label.textContent = meta.t("advisor.name");
    toggle.root.setAttribute("aria-label", meta.t(enabled ? "advisor.on" : "advisor.off"));
  }
}

function ensureBanner() {
  if (banner) return;
  const root = document.createElement("div");
  root.id = "advisorBanner";
  root.className = "advisor-banner";
  root.hidden = true;
  const title = document.createElement("div");
  title.className = "advisor-banner-title";
  const why = document.createElement("div");
  why.className = "advisor-banner-why";
  root.append(title, why);
  banner = { root, title, why };
}
function setSlot(cls) {
  banner.root.classList.remove("adv-slot-hand", "adv-slot-prompt", "adv-slot-text", "adv-slot-sheet", "adv-slot-desktop", "adv-slot-pinned");
  banner.root.classList.add(cls);
}
// Moves the SAME banner node into whichever real slot app.js's own layout
// wants it in right now, and applies the matching size class -- this must
// still run BEFORE app.js's layoutTable() (see the call site in render()),
// since layoutTable() reads whichever slot is now holding it (the "sheet"
// slot is inside #sheet's own budget; the "text" slot is pinned ahead of
// #promptScroll, inside #lowerBlock's own fixed height) when it decides
// whether #lowerBlock's give-way stages need to fire.
//
// #68 (owner: "地圖大小應固定", widened by a 2nd report on the same issue):
// this used to hide the banner outright, or replace the prompt's own text
// with it, whenever a short viewport ran out of room -- both were really
// about protecting the MAP's own budget, which no longer exists once the
// map stopped reading anything from #prompt/#sheet/#hand. #lowerBlock is a
// fixed height now regardless, so there is no more "no room, drop the
// advice" case on the phone column to route around.
//
// Slots, in the order this checks them:
//   - sheet:   a genuine full-screen card page (`.sheet.overlay`,
//              style.css) -- #prompt sits behind that overlay, so this is
//              the only slot that's actually visible; becomes the sheet's
//              own last flow child, below whatever's already there (owner:
//              "sheet 裡... 的 flow").
//   - desktop: >=1024px, browsing the hand with no overlay open -- becomes
//              the hand's own grid's first row (spanning every column), so
//              the cards flow into the rows below it, still inside the
//              sidebar; falls back to the prompt-takeover slot if that
//              would push the hand past the frame's own bottom edge.
//   - text:    the phone column, EVERY other state (browsing the hand,
//              target picking, placement, a pending choice) -- pinned as
//              #prompt's own first flow child, ahead of #promptScroll (see
//              app.js's play.html/layoutTable()), so it's visible
//              alongside whatever #promptScroll or the sheet below it is
//              doing, never hidden or swapped out for it.
function placeBanner(meta) {
  const table = document.getElementById("table");
  const hand = document.getElementById("hand");
  const sheet = document.getElementById("sheet");
  const prompt = document.getElementById("prompt");
  const promptText = document.getElementById("promptText");
  if (!table) return;
  const takeOverPrompt = () => {
    // #97 (orchestrator's ruling, FE hand-in sent back): app.js's setPrompt()
    // always puts the always-on scoring-card warning (`.prompt-warn`) first
    // in #promptText, independent of the advisor -- this desktop-only
    // fallback used to hide #promptText outright the moment the advisor's
    // own banner had no room in the hand, which is exactly the state where a
    // desktop player with the advisor ON could lose to an unplayed scoring
    // card without ever seeing why. Only the ordinary "your turn" sentence
    // ever needed to make room for the banner -- when a warning is present,
    // #promptText stays up (its warning line first, same DOM order as
    // always) and the banner still follows right after it, unchanged.
    if (promptText) promptText.hidden = !promptText.querySelector(".prompt-warn");
    prompt.appendChild(banner.root);
    setSlot("adv-slot-prompt");
  };
  // #68 (cross-boundary edit, orchestrator's ruling on the owner's 2nd #68
  // report -- FE peer, flagged to this file's own owner at handoff): the
  // phone column's #prompt is no longer a plain-text row layoutTable()
  // measures whole -- it's #lowerBlock's own fixed-height text area (see
  // app.js), a pinned banner slot ahead of the scrollable #promptScroll
  // (the prompt sentence + news + #fallbackBanner). The banner parks here
  // in EVERY phone state that has one, including target picking, placement
  // and a pending choice -- it no longer replaces #promptText the way
  // takeOverPrompt() (desktop-only now, above) still does; "the prompt and
  // news scroll under it, the advice does not" is exactly what pinning it
  // ahead of #promptScroll (a sibling, not a wrapper) gets for free.
  const pinInPrompt = () => {
    if (promptText) promptText.hidden = false;
    const promptScroll = document.getElementById("promptScroll");
    prompt.insertBefore(banner.root, promptScroll || prompt.firstChild);
    setSlot("adv-slot-text");
  };
  // #24 round 4: app.js's setPrompt() (round 2) always parks a hidden
  // .sheet-title as #sheet's first child now, even while just browsing the
  // hand -- sheet.children.length is never really 0 any more, so this used
  // to see "content" that isn't actually visible (style.css collapses a
  // sheet whose only children are all [hidden] the same way it always
  // collapsed a truly empty one) and routed the banner into the sheet slot
  // regardless, instead of falling through to the hand/prompt slots below
  // and letting THEIR own overflow check decide. Only a real, visible
  // child counts as content here now.
  const sheetHasContent = !!(sheet && !sheet.hidden && [...sheet.children].some((c) => !c.hidden));
  // #29: the full card page now splits into a fixed head + a scrollable
  // .sheet-mid + a pinned footer (see sheetMid() in app.js) — appending the
  // banner straight into #sheet would land it AFTER the pinned footer
  // (#sheet's last child), below Cancel/Confirm instead of "below the uses"
  // (the owner's own words, #29 addendum). Route into .sheet-mid whenever
  // it exists; only the compact chip (no .sheet-mid) still gets #sheet
  // itself, same as before.
  const sheetContentTarget = sheet ? sheet.querySelector(":scope > .sheet-mid") || sheet : sheet;
  // #74 (owner, iPhone screenshot, carried over from #71 point 5): parking
  // the banner inside .sheet-mid meant it scrolled away with the rest of
  // the card's own content -- the owner's own third line (a real
  // suggestion, not decoration) got cut flush by the scroll edge, with
  // nothing telling the player the area even scrolled. The banner must be
  // ALWAYS fully visible on the full card page now, so it moves to
  // .sheet-pinned (sheetPinned() in app.js: the fixed, non-scrolling
  // sibling of .sheet-mid, already holding the five-use grid / order row /
  // hint, directly above the Cancel/Confirm footer) as ITS first child,
  // whenever that element exists. .sheet-pinned only exists on the full
  // card page (never for the compact chip, a pending choice's own sheet, or
  // the headline phase, none of which build one) -- those states fall
  // through to the pre-#74 .sheet-mid/#sheet routing below, unchanged.
  const sheetPinnedEl = sheet ? sheet.querySelector(":scope > .sheet-pinned") : null;
  // #46: when the open card has a history block, the owner's own order
  // (picture/names, rules text, the advice strip, THEN the history) puts
  // the banner right before it rather than after — insertBefore instead of
  // a plain appendChild, so this holds regardless of which gets built
  // first (app.js always builds the history synchronously; this file's own
  // real-answer text can arrive later, via the setTimeout in
  // applyDecorations, and re-run this same placement) or how many times
  // the banner moves between slots. Only reached now when .sheet-pinned
  // doesn't exist (see #74's comment above) -- a history block never
  // shares a parent with .sheet-pinned's own use grid.
  // Returns which slot class was actually used, so the caller can apply the
  // matching CSS (advisor.css) without re-deriving the same check.
  const appendToSheetContent = () => {
    if (sheetPinnedEl) {
      sheetPinnedEl.insertBefore(banner.root, sheetPinnedEl.firstChild);
      return "adv-slot-pinned";
    }
    const history = sheetContentTarget.querySelector(":scope > .sheet-history");
    if (history) sheetContentTarget.insertBefore(banner.root, history);
    else sheetContentTarget.appendChild(banner.root);
    return "adv-slot-sheet";
  };
  const desktop = window.innerWidth >= 1024;
  if (desktop) {
    if (sheetHasContent) {
      if (promptText) promptText.hidden = false;
      setSlot(appendToSheetContent());
      return;
    }
    if (hand) {
      if (promptText) promptText.hidden = false;
      hand.insertBefore(banner.root, hand.firstChild);
      setSlot("adv-slot-desktop");
      // #hand's OWN box on the desktop grid is a fixed `1fr` grid row --
      // its getBoundingClientRect() doesn't grow with content, so the
      // thing to check is whether the actual last card now paints past
      // whatever sits right after the hand (#sideFoot, or #chatForm in a
      // room), since `.hand{overflow:visible}` lets it spill there
      // instead of clipping or scrolling (the owner's ruling: the sidebar
      // must never scroll).
      const last = hand.lastElementChild;
      const contentBottom = last ? last.getBoundingClientRect().bottom : hand.getBoundingClientRect().bottom;
      const sideFoot = document.getElementById("sideFoot"), chatForm = document.getElementById("chatForm");
      const nextTop = sideFoot && !sideFoot.hidden ? sideFoot.getBoundingClientRect().top
        : chatForm && !chatForm.hidden ? chatForm.getBoundingClientRect().top
        : table.getBoundingClientRect().bottom;
      if (contentBottom > nextTop - 2) { hand.removeChild(banner.root); takeOverPrompt(); }
      return;
    }
    takeOverPrompt();
    return;
  }
  // Phone column. #68: the only state where #prompt truly isn't on screen
  // is a genuine full-screen card page (`.sheet.overlay`, position:fixed;
  // inset:0, style.css) -- #prompt sits behind that overlay, so the banner
  // has to go inside the overlay's own content to be seen at all. Every
  // other sheetHasContent state (#24's mini target-picking chip, a pending
  // choice's Confirm/Cancel row) is a normal flow row alongside #prompt,
  // not a takeover, so it now pins into the prompt like everything else --
  // there is no more "no room" fallback to route around: #promptScroll
  // scrolls, #lowerBlock's own give-way (app.js's layoutTable()) handles
  // the rest, and the banner is never part of either negotiation.
  // #68 dropped the old table-overflow fallback here on its own incoming
  // side: a genuine `.sheet.overlay` is `position: fixed`, detached from
  // #table's box entirely, and #lowerBlock's own fixed height (#68) means
  // nothing above ever needs to fall back out of it any more either. #74's
  // own routing (appendToSheetContent(), just below) still decides WHERE
  // inside the overlay the banner lands -- .sheet-pinned's first child when
  // that element exists (the full card page), .sheet-mid/#sheet otherwise
  // (the compact chip, a pending choice's own sheet) -- but never needs its
  // own overflow check either way.
  if (sheetHasContent && sheet.classList.contains("overlay")) {
    if (promptText) promptText.hidden = false;
    setSlot(appendToSheetContent());
    return;
  }
  pinInPrompt();
}

function joinNames(ids, meta) {
  const seen = [];
  for (const id of ids) if (!seen.includes(id)) seen.push(id);
  return seen.map((id) => meta.spaceName(id)).join(meta.sep());
}
// The one id->name mapping the copy needs (#18: "space/state/region 是 id,
// 要換成該語言的名字;card 同理"). Every other param (n, need, total,
// weariness) is already the number/string the copy reads out.
function fmtParams(params, meta) {
  const out = {};
  for (const k in params) {
    const v = params[k];
    if (v == null) continue;
    if (k === "space") out.space = meta.spaceName(v);
    else if (k === "state") out.state = meta.stateName(v);
    else if (k === "region") out.region = meta.regionName(v);
    else if (k === "card") out.card = meta.cardName(v);
    else out[k] = v;
  }
  return out;
}
// How many of `ids` the player has already placed themselves (their own
// tentative picks this decision, not yet confirmed) -- subtracted out so a
// spot the player already satisfied stops glowing and its badge counts
// down, instead of staying lit at the original suggestion's count forever
// (owner, round 2: "已經放滿的據點金圈和 +n 徽章要跟著更新").
function remainingCounts(ids, meta) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  for (const id of (meta && meta.pickedSpaces) || []) if (counts[id]) counts[id]--;
  for (const id of Object.keys(counts)) if (counts[id] <= 0) delete counts[id];
  return counts;
}
// #69 addendum (owner, iPhone screenshot: 「選牌沒有軍師提示」, round 8
// action 7/7, the end-of-round discard): the four verbs the copy needs for
// a pending "card" pick, keyed off the SAME signals renderPending() (app.js)
// already used to build the buttons -- pending.tag ("endDiscard" set
// straight by engine.js, or "event" for every cards.js card pick, which
// also carries pending.card, the event driving it) and pending.showHand
// (true for exactly one of the five, 細作/xizuo #67, which points at the
// OPPONENT's hand -- the owner's own word for that one is 選 "choose", not
// 棄 "discard", the other four's verb).
function cardPickVerb(pending) {
  if (pending.showHand) return "choose"; // xizuo (#67): a card FROM the opponent's hand
  if (pending.card === "lvbuwei") return "retrieve"; // #54: FROM the discard pile TO the hand, not out of it
  return "discard"; // engine.js's own endDiscard, hanfei (#58), chunshenjun (#62): all discard from the player's own hand
}
// `choice` is `adv.action.choice` itself -- an array for a "card" pending
// (`[id]`, or `[]` for a skip; shared/advisor.js's targetsOf() already
// documents this shape), read directly rather than through `adv.targets`
// (always [] here: targetsOf() filters a "card" choice down to board-space
// ids, and a card id is never one).
function cardPickTitle(pending, choice, meta) {
  if (!choice.length) return meta.t("advisor.suggestPick.skip");
  return meta.t(`advisor.suggestPick.${cardPickVerb(pending)}`, { card: meta.cardName(choice[0]) });
}
// An "option" pending's own `choice` is the chosen option's id (a plain
// string -- shared/advisor.js's targetsOf() falls through its `typeof c ===
// "object"` check for exactly this shape, straight to `return []`, same
// reason a "card" pick's own targets are always empty). `pending.options`
// (view.pending, the SAME array renderPending() drew its buttons from)
// carries each one's own display label -- cards.js builds those directly
// (e.g. `E.REGIONS[r].zh`), not through this file's `meta`, so a label
// already shown on the button in the wrong UI language is a pre-existing
// gap in that data, not introduced here (flagged to the orchestrator, not
// fixed in this file: cards.js is BE's).
function optionPickTitle(pending, choice, meta) {
  const opt = (pending.options || []).find((o) => o.id === choice);
  return opt ? meta.t("advisor.suggestPick.option", { option: opt.label }) : null;
}
// The banner's one title line already says card+use+target together
// (advisor.suggestCard.<use>, e.g. "Campaign in {space} with {card}") --
// there is no separate "step 2" text, only a separate VISUAL location (the
// card sheet's own gold ring) for it.
function bannerTitle(adv, meta, view) {
  const { t, cardName } = meta;
  if (adv.action.type === "headline") return t("advisor.suggestHeadline", { card: cardName(adv.card) });
  if (adv.action.type === "choose") {
    // #52 addendum: found while verifying the new gold mark below, not
    // asked for by the issue, but left alone it contradicts the very thing
    // #52 marks -- a PENDING "ops" choice's own move can be campaign/lobby,
    // not just place (choice = { use, target } -- see decoratePending()),
    // yet suggestSetup's line always says "Place {n} in {space}" no matter
    // which. Playing Hangu Pass event-first and choosing Campaign, the
    // banner used to say "Place 1 influence in Daliang" while the button it
    // gold-rings says Campaign and the map ring is Daliang's -- the same
    // suggestion, described two contradictory ways on one screen.
    // advisor.suggestUse.<use> (en.js/zh-Hant.js: written for #17/#18,
    // never wired to anything until now) already has the right words for a
    // use with no card name -- read straight off adv.action.choice.use, the
    // same field decoratePending() reads to pick the button.
    const choice = adv.action.choice;
    const opsUse = choice && typeof choice === "object" && !Array.isArray(choice) ? choice.use : null;
    const counts = remainingCounts(adv.targets, meta);
    const ids = Object.keys(counts);
    if (!ids.length) {
      // #69 addendum: a "card" or "option" pending choice names no map
      // space at all (never did, never will -- see targetsOf() in
      // shared/advisor.js), so this used to always return null here and
      // fall all the way back to the banner's bare name ("軍師"/"Advisor",
      // setBannerText() below) -- a title that names nothing. view.pending
      // (the SAME object renderPending() drew its own buttons from) says
      // which of the two shapes `choice` is in.
      const pk = view && view.pending ? view.pending.kind : null;
      if (pk === "card" && Array.isArray(choice)) return cardPickTitle(view.pending, choice, meta);
      if (pk === "option") return optionPickTitle(view.pending, choice, meta);
      return null; // a fully-placed setup pick, or a shape not covered above
    }
    if (opsUse && opsUse !== "place") {
      return ids.map((id) => t(`advisor.suggestUse.${opsUse}`, { space: meta.spaceName(id) })).join(" ");
    }
    // Each line is already its own full sentence ("Place {n} ... in
    // {space}."), so multiple spaces are joined with a space, not the
    // language's list separator (which would double up the punctuation).
    return ids.map((id) => t("advisor.suggestSetup", { n: counts[id], space: meta.spaceName(id) })).join(" ");
  }
  if (adv.card == null) return null;
  const use = adv.use || "event";
  const remaining = Object.keys(remainingCounts(adv.targets, meta));
  const space = remaining.length ? joinNames(remaining, meta) : "";
  // #60: an opponent's card played "event first" has no target chosen yet
  // (the placement follows the event, once it's known what it did) --
  // `space` is "" then, and suggestCard.place/campaign/lobby all read
  // "... in {space}.", so the banner said "Place with Hangu Pass in .".
  // Each of those three (the only ones with a {space} in their own
  // template) gets a target-less sibling key instead of leaving the
  // dangling "in ."/"在"; event/reform/score never had a {space} to begin
  // with, so they're untouched.
  const noTarget = !space && (use === "place" || use === "campaign" || use === "lobby");
  let s = t(`advisor.suggestCard.${noTarget ? use + "NoTarget" : use}`, { card: cardName(adv.card), space });
  if (adv.order) s += " " + t(`advisor.suggestOrder.${adv.order}`);
  return s;
}

function decorateHand(adv, view, meta) {
  const hand = document.getElementById("hand");
  if (!hand) return;
  const cards = hand.querySelectorAll(".card");
  cards.forEach((c) => c.classList.remove("adv-pick"));
  if (!adv || adv.card == null || !meta) return;
  const list = view && view.hands ? view.hands[meta.side] || [] : [];
  let idx = list.indexOf(adv.card);
  if (idx < 0 && adv.card === E.JIUDING) idx = list.length; // the Nine Cauldrons tile is appended after the hand, when present
  const el = idx >= 0 ? cards[idx] : null;
  if (!el) return;
  el.classList.add("adv-pick");
  if (lastScrolledCard !== adv.card) {
    lastScrolledCard = adv.card;
    scrollWithin(hand, el);
  }
}
// Only the hand's own horizontal scrollbar moves -- never `scrollIntoView`,
// which can also walk up and move the PAGE's own scroll position (real bug
// found while testing: a suggested card just past the fold moved
// document.documentElement's scrollTop, which fought #table's own
// no-scroll lock on a short viewport).
function scrollWithin(container, el) {
  try {
    const cr = container.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (er.left < cr.left) container.scrollLeft -= (cr.left - er.left) + 8;
    else if (er.right > cr.right) container.scrollLeft += (er.right - cr.right) + 8;
  } catch {}
}
function decorateSheet(adv, meta) {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;
  // #60: the headline phase's own confirm button (footer(), app.js) has no
  // ".sheet-grid" -- that grid only exists in the action phase's own
  // five-use card page -- so it needs its own selector cleared/marked here,
  // by the stable [data-use="headline"] hook footer() now gives it, same
  // idea as the [data-use] hooks decoratePending() below already reads.
  sheet.querySelectorAll(".sheet-grid button, .rowb.order button, [data-use='headline']").forEach((b) => b.classList.remove("adv-pick"));
  if (!adv || !meta || meta.uiCard !== adv.card) return; // the open sheet isn't for the suggested card
  if (adv.use === "headline") {
    const b = sheet.querySelector("[data-use='headline']");
    if (b) b.classList.add("adv-pick");
  }
  if (adv.use) {
    const grid = sheet.querySelector(".sheet-grid");
    if (grid) {
      const order = adv.card === E.JIUDING ? USE_ORDER_JIUDING : USE_ORDER_FULL;
      // #56: useOf() in shared/advisor.js deliberately answers "score" for a
      // scoring card (the banner's sentence and reason key on that string) --
      // but a scoring card's page still renders the same five-button grid as
      // any other card (app.js's own loop is unconditional), with only 事件
      // usable, so the button to gold-ring here is the same one "event" ever
      // marks. Translate only at this lookup, not at the source.
      const idx = order.indexOf(adv.use === "score" ? "event" : adv.use);
      const btns = grid.querySelectorAll("button");
      if (idx >= 0 && btns[idx]) btns[idx].classList.add("adv-pick");
    }
  }
  if (adv.order) {
    const row = sheet.querySelector(".rowb.order");
    if (row) {
      const idx = ORDER_KEYS.indexOf(adv.order);
      const btns = row.querySelectorAll("button");
      if (idx >= 0 && btns[idx]) btns[idx].classList.add("adv-pick");
    }
  }
}
// #52: a PENDING choice (`renderPending()` in app.js -- kind "ops"/"option"/
// "card"/"points") has no card page open and `advise()`'s own `card`/`use`
// come back null for it (a pending choice is not a "use" -- see `useOf()`
// in shared/advisor.js, deliberately unchanged: the brief says to comment,
// not to touch it). The move itself still sits in `adv.action = { type:
// "choose", choice }`, so this reads `choice` directly instead, and
// `view.pending.kind` (the SAME object `renderPending()` was drawn from,
// still on the view) to know which shape `choice` is in -- never inferred
// from the shape alone, since a card pick's `choice` (`[id]`) and a points
// pick's `choice` (`[id, id, ...]`) are both plain arrays.
//   ops:    choice = { use, points } | { use, target } -> mark [data-use]
//   option: choice = the option's id                   -> mark [data-option]
//   card:   choice = [id] (or [] when skippable)        -> mark [data-card]
//   points: choice = an array of space ids -- the map already marks these
//           through targetsOf()/decorateMap(); nothing to do to a button
//           here (renderPending's Confirm/Cancel row names no single space).
// renderPending() gives each hooked button a stable data-* attribute (its
// own comment there) instead of this file finding buttons by position, per
// the brief.
function decoratePending(adv, view) {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;
  // #60: `[data-use="headline"]` (footer()'s own confirm button, app.js) is
  // decorateSheet()'s hook, not this function's -- decoratePending() runs
  // right after it on every render() (see applyDecorations() above) and
  // used to blanket-clear every `[data-use].adv-pick` regardless of value,
  // wiping the headline mark decorateSheet() had just set a moment earlier
  // even outside a pending choice. Excluded here instead of renaming the
  // attribute, since "headline" never collides with an actual ops `use`
  // value (place/campaign/lobby/reform) this function marks below.
  sheet.querySelectorAll("[data-use]:not([data-use='headline']).adv-pick, [data-option].adv-pick, [data-card].adv-pick, [data-skip].adv-pick")
    .forEach((b) => b.classList.remove("adv-pick"));
  if (!adv || !adv.action || adv.action.type !== "choose") return;
  if (!view || !view.pending) return; // the suggestion is stale the moment the pending choice is gone
  const kind = view.pending.kind;
  const choice = adv.action.choice;
  if (kind === "ops" && choice && choice.use) {
    const b = sheet.querySelector(`[data-use="${choice.use}"]`);
    if (b) b.classList.add("adv-pick");
  } else if (kind === "option" && choice != null) {
    const b = sheet.querySelector(`[data-option="${choice}"]`);
    if (b) b.classList.add("adv-pick");
  } else if (kind === "card" && Array.isArray(choice) && choice.length === 1) {
    const b = sheet.querySelector(`[data-card="${choice[0]}"]`);
    if (b) b.classList.add("adv-pick");
  } else if (kind === "card" && Array.isArray(choice) && !choice.length) {
    // #69 addendum: advise()'s own answer for a skip (empty choice) used to
    // mark nothing at all -- app.js's renderPending() now gives the Skip
    // button the same kind of stable hook the card buttons already had
    // ([data-skip], next to their own [data-card]).
    const b = sheet.querySelector("[data-skip]");
    if (b) b.classList.add("adv-pick");
  }
}
function decorateMap(adv, meta) {
  const mapInner = document.getElementById("mapInner");
  if (!mapInner) return;
  const nodes = mapInner.querySelectorAll(".node");
  nodes.forEach((n) => {
    n.classList.remove("adv-target");
    const b = n.querySelector(".adv-badge");
    if (b) b.remove();
  });
  if (!adv || !adv.targets || !adv.targets.length) return;
  // #93: a card-play suggestion (adv.card set -- a play, the Cauldrons, or a
  // headline) must not ring the map until the player has that card open --
  // same gate decorateSheet() already uses above. Advice not tied to a card
  // (a pending ops/option/card/points choice, the opening placement) has no
  // adv.card at all and keeps marking immediately, as before.
  if (adv.card != null && (!meta || meta.uiCard !== adv.card)) return;
  const counts = remainingCounts(adv.targets, meta);
  E.SPACES.forEach((sp, i) => {
    const n = counts[sp.id];
    if (!n) return;
    const el = nodes[i];
    if (!el) return;
    el.classList.add("adv-target");
    if (n > 1) {
      const badge = document.createElement("span");
      badge.className = "adv-badge";
      badge.textContent = "+" + n;
      el.appendChild(badge);
    }
  });
}

// Sets the banner's own text: the real title/why for a resolved answer, or
// the neutral "thinking" placeholder while one is still pending. Kept
// separate from placement/measurement (below) because the ORDER matters:
// on a cache hit, the real (accurately-sized) text must be in place BEFORE
// placeBanner() measures anything, so a long multi-target sentence is
// measured at its true size, not the short placeholder's.
function setBannerText(adv, meta, real, view) {
  if (!real) { banner.title.textContent = meta.t("advisor.thinking"); banner.why.textContent = ""; return; }
  if (!adv) return; // caller hides the banner itself in this case
  const title = bannerTitle(adv, meta, view) ?? meta.t("advisor.name");
  const why = meta.t(`advisor.reasons.${adv.reason.key}`, fmtParams(adv.reason.params, meta));
  banner.title.textContent = title;
  banner.why.textContent = why;
}
// The prompt slot's own CSS clamps the reason to 2 lines -- but a clamp
// alone would silently cut it off mid-sentence, which the owner (round 2)
// explicitly ruled out ("放不下就只留標題那一句,不要用省略號切句子").
// So if it doesn't fit whole, drop it entirely rather than show a clipped
// fragment; the title alone is still the full suggestion. Must run AFTER
// placeBanner() -- it reads the slot class placeBanner() just set.
function clampPromptWhy() {
  if ((banner.root.classList.contains("adv-slot-prompt") || banner.root.classList.contains("adv-slot-text"))
    && banner.why.scrollHeight > banner.why.clientHeight + 1) {
    banner.why.textContent = "";
  }
}
function clearAll() {
  cache.fp = null;
  cache.hasResult = false;
  // #24 clean-up: with the switch off (or any other inactive case this
  // covers -- spectator, room, tutorial, game over), the banner used to
  // stay in the DOM as a hidden 0x0 node carrying whatever text it last
  // showed -- detach it outright; placeBanner() re-appends the SAME node
  // (never rebuilt, per this file's own promise) the next time it's active.
  if (banner) {
    banner.root.hidden = true;
    if (banner.root.parentElement) banner.root.remove();
  }
  // Real bug found while testing (round 3): the prompt-takeover slot hides
  // #promptText while it's in use -- if the switch is turned off (or a
  // spectator/room view is reached) while that slot was active, nothing
  // else ever un-hides it again, permanently breaking the game's own
  // prompt text. With the advisor off, the table must look and behave
  // exactly as if this feature did not exist (the original brief's own
  // words) -- so this restores it every time, whether or not it was ever
  // hidden.
  const promptText = document.getElementById("promptText");
  if (promptText) promptText.hidden = false;
  decorateHand(null, null, null);
  decorateSheet(null, null);
  decoratePending(null, null);
  decorateMap(null, null);
}

// The same cheap pre-checks advise() itself opens with (#17): mirrored here
// so a state where advise() is certain to answer null (the bot's own turn,
// a spectator-shaped view) never inserts the "thinking" placeholder at all
// -- without this, every single bot move would flash the banner into its
// slot and back out a moment later, since applyDecorations only learns
// advise()'s real answer after the yield below.
function couldAdvise(view, side) {
  if (!view || view.winner != null) return false;
  if (!Array.isArray(view.hands?.[side])) return false;
  const kind = E.legal(view, side)?.kind;
  return kind === "action" || kind === "headline" || kind === "pending";
}
function applyDecorations(view, meta, force, switchVisible) {
  const active = switchVisible && enabled && couldAdvise(view, meta.side);
  if (!active) { clearAll(); return; }
  ensureBanner();
  const fp = fingerprint(view, meta.side);
  const cacheHit = !force && cache.fp === fp && cache.hasResult;
  if (cacheHit) {
    // Already know the real answer for this exact position (the player
    // clicked something that doesn't change what the best move is) -- fill
    // in the real text BEFORE placing/measuring, so placeBanner()'s own
    // overflow check and app.js's layoutTable() both see the banner's
    // true final size, not a placeholder's.
    if (cache.adv) setBannerText(cache.adv, meta, true, view);
    placeBanner(meta);
    if (!cache.adv) { banner.root.hidden = true; decorateHand(null, view, meta); decorateSheet(null, meta); decoratePending(null, view); decorateMap(null, meta); return; }
    banner.root.hidden = false;
    clampPromptWhy();
    decorateHand(cache.adv, view, meta);
    decorateSheet(cache.adv, meta);
    decoratePending(cache.adv, view);
    decorateMap(cache.adv, meta);
    return;
  }
  // A neutral placeholder, synchronously, so the slot this is about to
  // move into already has real content the instant layoutTable() (or, for
  // the sheet slot, the sheet's own rendered height) measures it -- no
  // reflow later when the real title/why text replaces it. This DOES mean
  // a genuinely new, long suggestion is measured at the placeholder's
  // (shorter) size on this one frame; the very next render (almost always
  // the next click) re-measures at the real size via the cache-hit branch
  // above.
  setBannerText(null, meta, false);
  placeBanner(meta);
  banner.root.hidden = false;
  cache.fp = fp;
  cache.hasResult = false;
  decorateHand(null, view, meta);
  decorateSheet(null, meta);
  decoratePending(null, view);
  decorateMap(null, meta);
  // advise() is synchronous and can take real time on a midgame position
  // (#17's own budget: comfortably under 3s, but not instant) -- yielding
  // once here at least lets "thinking" paint before that runs, and the gen
  // check throws the answer away if the position has already moved on.
  const myGen = ++gen;
  setTimeout(() => {
    if (myGen !== gen) return;
    let adv = null;
    try { adv = advise(view, meta.side); } catch { adv = null; }
    if (myGen !== gen) return;
    cache.adv = adv;
    cache.hasResult = true;
    if (!adv) {
      banner.root.hidden = true;
      decorateHand(null, view, meta); decorateSheet(null, meta); decoratePending(null, view); decorateMap(null, meta);
      // #39 item 3: the placeholder banner (a normal flow row) had a real
      // height when THIS render's layoutTable() ran; hiding it outright
      // changes the chrome sum layoutTable() already measured, same as the
      // real-text case below.
      meta.layoutTable && meta.layoutTable();
      return;
    }
    setBannerText(adv, meta, true, view);
    placeBanner(meta); // the real text may be a different length -- re-measure/re-place now that it's known
    banner.root.hidden = false;
    clampPromptWhy();
    decorateHand(adv, view, meta);
    decorateSheet(adv, meta);
    decoratePending(adv, view);
    decorateMap(adv, meta);
    // #39 item 3 (round 1 review — a pre-existing defect, not new to this
    // issue): advise() answers async, so the render that just ran measured
    // the banner at its short synchronous placeholder size, not the real
    // text's. Re-running layoutTable() now, with the banner's real final
    // height already in the DOM, corrects the same render's map/hand split
    // instead of leaving it wrong until the NEXT click re-measures it
    // (measured: English, advisor on, first render of "setup placement"
    // and "action hand" left the sheet/hand 11px past a screen that
    // couldn't scroll). layoutTable() itself never rebuilds the hand or
    // sheet except on an actual chip<->full mode flip (its own existing
    // rule, untouched) -- nothing here risks losing a tap mid-render.
    meta.layoutTable && meta.layoutTable();
  }, 0);
}

// The one call app.js makes, now BEFORE its own layoutTable() (see the call
// site): meta carries exactly what this file can't read out of app.js's own
// closures -- { side, solo, uiCard, pickedSpaces, t, spaceName, stateName,
// regionName, cardName, sep }.
export function decorate(view, meta) {
  const tableEl = document.getElementById("table");
  const tableShown = !!tableEl && !tableEl.hidden;
  const switchVisible = !!(meta && meta.solo) && !TUTORIAL && tableShown;
  lastCtx = { view, meta, switchVisible };
  if (toggle) {
    toggle.root.hidden = !switchVisible;
    syncToggleUI(meta);
  }
  // Orchestrator's #24 addendum (owner, 2026-09-19): Rules stays put in the
  // header's top-right, [Advisor toggle] [Rules] [Lang] -- #18 used to move
  // it into the prompt row (#rulesLinkAlt, now removed) when the switch was
  // showing on a phone; the header row gives way on its OWN axis instead
  // (see relegateBarMid() below), so this file no longer touches it at all.
  if (meta) applyDecorations(view, meta, false, switchVisible);
  else clearAll();
}
