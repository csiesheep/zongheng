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
  banner.root.classList.remove("adv-slot-hand", "adv-slot-prompt", "adv-slot-sheet", "adv-slot-desktop");
  banner.root.classList.add(cls);
}
// Moves the SAME banner node into whichever real slot app.js's own layout
// has room for right now, and applies the matching size class -- this must
// run BEFORE app.js's layoutTable() (see the call site in render()), since
// layoutTable() measures #prompt/#sheet's rendered height (which now
// includes the banner, when it's parked inside one of them) and, for the
// one truly new row this adds, reads a class list that includes
// "advisorBanner" for exactly that reason.
//
// Slots, in the order this checks them:
//   - sheet:   #sheet has real content -- the full-screen "browsing a
//              card" header, the mini chip + preview while a target is
//              being picked, OR the opening placement / any other pending
//              choice (renderPending renders its Confirm/Cancel row into
//              #sheet too) -- the banner becomes the sheet's own last flow
//              child, below whatever's already there (owner: "sheet 裡...
//              的 flow").
//   - desktop: >=1024px, browsing the hand with no sheet open -- becomes
//              the hand's own grid's first row (spanning every column), so
//              the cards flow into the rows below it, still inside the
//              sidebar; falls back to the prompt slot if that would push
//              the hand past the frame's own bottom edge.
//   - hand:    the phone column, browsing the hand with no sheet open -- a
//              plain flow row directly above #hand, inside #table, counted
//              in layoutTable()'s own "chrome" sum.
//   - prompt:  the fallback for both phone slots above, when there truly
//              is no room: #5's "chip" mode (the map already at its floor
//              scale, no headroom above the hand) is the owner's own named
//              case, but a real bug found while testing this round showed
//              the SAME squeeze during the opening placement (#sheet's own
//              Confirm/Cancel row + the banner outgrew #table's fixed box
//              and were silently clipped by its `overflow: hidden`, with
//              no scrollbar anywhere to reveal it) -- so rather than
//              special-case just the hand's chip mode, this measures
//              #table's own scrollHeight against its clientHeight AFTER
//              trying the sheet/hand slot and falls back whenever that
//              doesn't fit, whichever slot triggered it. The banner
//              replaces the prompt's OWN text in this slot (hidden while
//              it's active; Log/Rules stay) instead of adding a row.
function placeBanner(meta) {
  const table = document.getElementById("table");
  const hand = document.getElementById("hand");
  const sheet = document.getElementById("sheet");
  const prompt = document.getElementById("prompt");
  const promptText = document.getElementById("promptText");
  if (!table) return;
  const takeOverPrompt = () => {
    if (promptText) promptText.hidden = true;
    prompt.appendChild(banner.root);
    setSlot("adv-slot-prompt");
  };
  const overflowsTable = () => table.scrollHeight > table.clientHeight + 1;
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
  const desktop = window.innerWidth >= 1024;
  if (desktop) {
    if (sheetHasContent) {
      if (promptText) promptText.hidden = false;
      sheet.appendChild(banner.root);
      setSlot("adv-slot-sheet");
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
  // Phone column.
  if (sheetHasContent) {
    if (promptText) promptText.hidden = false;
    sheet.appendChild(banner.root);
    setSlot("adv-slot-sheet");
    if (overflowsTable()) { sheet.removeChild(banner.root); takeOverPrompt(); }
    return;
  }
  if (hand && hand.dataset.mode === "chip") { takeOverPrompt(); return; }
  if (promptText) promptText.hidden = false;
  if (hand) table.insertBefore(banner.root, hand);
  else table.appendChild(banner.root); // defensive fallback; #sheet or #hand cover every real state today
  setSlot("adv-slot-hand");
  if (overflowsTable()) { banner.root.remove(); takeOverPrompt(); }
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
// The banner's one title line already says card+use+target together
// (advisor.suggestCard.<use>, e.g. "Campaign in {space} with {card}") --
// there is no separate "step 2" text, only a separate VISUAL location (the
// card sheet's own gold ring) for it.
function bannerTitle(adv, meta) {
  const { t, cardName } = meta;
  if (adv.action.type === "headline") return t("advisor.suggestHeadline", { card: cardName(adv.card) });
  if (adv.action.type === "choose") {
    const counts = remainingCounts(adv.targets, meta);
    const ids = Object.keys(counts);
    if (!ids.length) return null; // a card/option pending choice names no space, or it's already fully placed
    // Each line is already its own full sentence ("Place {n} ... in
    // {space}."), so multiple spaces are joined with a space, not the
    // language's list separator (which would double up the punctuation).
    return ids.map((id) => t("advisor.suggestSetup", { n: counts[id], space: meta.spaceName(id) })).join(" ");
  }
  if (adv.card == null) return null;
  const use = adv.use || "event";
  const remaining = Object.keys(remainingCounts(adv.targets, meta));
  const space = remaining.length ? joinNames(remaining, meta) : "";
  let s = t(`advisor.suggestCard.${use}`, { card: cardName(adv.card), space });
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
  sheet.querySelectorAll(".sheet-grid button, .rowb.order button").forEach((b) => b.classList.remove("adv-pick"));
  if (!adv || !meta || meta.uiCard !== adv.card) return; // the open sheet isn't for the suggested card
  if (adv.use) {
    const grid = sheet.querySelector(".sheet-grid");
    if (grid) {
      const order = adv.card === E.JIUDING ? USE_ORDER_JIUDING : USE_ORDER_FULL;
      const idx = order.indexOf(adv.use);
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
function setBannerText(adv, meta, real) {
  if (!real) { banner.title.textContent = meta.t("advisor.thinking"); banner.why.textContent = ""; return; }
  if (!adv) return; // caller hides the banner itself in this case
  const title = bannerTitle(adv, meta) ?? meta.t("advisor.name");
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
  if (banner.root.classList.contains("adv-slot-prompt") && banner.why.scrollHeight > banner.why.clientHeight + 1) {
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
    if (cache.adv) setBannerText(cache.adv, meta, true);
    placeBanner(meta);
    if (!cache.adv) { banner.root.hidden = true; decorateHand(null, view, meta); decorateSheet(null, meta); decorateMap(null, meta); return; }
    banner.root.hidden = false;
    clampPromptWhy();
    decorateHand(cache.adv, view, meta);
    decorateSheet(cache.adv, meta);
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
    if (!adv) { banner.root.hidden = true; decorateHand(null, view, meta); decorateSheet(null, meta); decorateMap(null, meta); return; }
    setBannerText(adv, meta, true);
    placeBanner(meta); // the real text may be a different length -- re-measure/re-place now that it's known
    banner.root.hidden = false;
    clampPromptWhy();
    decorateHand(adv, view, meta);
    decorateSheet(adv, meta);
    decorateMap(adv, meta);
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
