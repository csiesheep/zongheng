// The advisor's UI (issue #18): a top-bar switch, a suggestion banner above
// the hand, and gold decorations on whichever card / use / target #17's
// `advise(view, side)` names. Everything here is self-contained -- app.js
// only mounts the switch once and calls `decorate(view, meta)` at the tail
// of its own render() -- so this file owns every DOM node it creates and
// never touches anything app.js built (it only reads it, by position: the
// hand's card order, the sheet's fixed use-button order, E.SPACES' order).
//
// Two promises this file makes, matching #17's own:
//   - it never calls `advise()` when the switch is off, when this isn't a
//     solo game, when the table isn't the visible view, or when the game is
//     over -- the switch's own visibility follows the same "am I looking at
//     a solo table" gate, independent of on/off.
//   - it never rebuilds its own elements on click. The switch and the
//     banner are each created once; every later update only changes
//     text/attributes/classes on those same nodes. Coloring never uses a
//     transition (owner: colours are static, not animated).
import { advise } from "./shared/advisor.js";
import * as E from "./shared/engine.js";

const STORE_KEY = "zh.advisor";
const USE_ORDER_FULL = ["event", "place", "campaign", "lobby", "reform"];
const USE_ORDER_JIUDING = ["place", "campaign", "lobby"];
const ORDER_KEYS = ["opsFirst", "eventFirst"];
// owner (#18): the teaching mode never shows the switch. #15 hasn't landed
// yet, so its exact state shape isn't known here -- ?tutorial is the signal
// the brief names explicitly, and it's read once at load (this page is
// reloaded on any real navigation, so a stale read isn't a risk).
let TUTORIAL = false;
try { TUTORIAL = new URLSearchParams(location.search).has("tutorial"); } catch {}

let enabled = false;
try { enabled = localStorage.getItem(STORE_KEY) === "1"; } catch {}
function persist() { try { localStorage.setItem(STORE_KEY, enabled ? "1" : "0"); } catch {} }

let toggle = null; // { root, label, track, dot } -- built once by mountAdvisorToggle
let banner = null; // { root, title, why } -- built once, lazily, by ensureBanner
let ro = null; // ResizeObserver, repositions the banner without a fresh decorate() call
let lastCtx = null; // the most recent {view, meta}, so the switch's own click can redecorate
let gen = 0; // invalidates a scheduled advise() the moment the position moves on
let lastScrolledCard = undefined;
const cache = { fp: null, adv: null };

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
    if (lastCtx) applyDecorations(lastCtx.view, lastCtx.meta, true);
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
  document.body.appendChild(root);
  banner = { root, title, why };
  try {
    ro = new ResizeObserver(() => { if (banner && !banner.root.hidden) positionBanner(); });
    const hand = document.getElementById("hand");
    if (hand) ro.observe(hand);
    const table = document.getElementById("table");
    if (table) ro.observe(table);
  } catch { /* ResizeObserver missing: the next decorate() still repositions it */ }
}
// A fixed overlay, anchored to the hand's own current box, so it never takes
// part in #table's own flex/grid height math (mobile's layoutTable() sums a
// FIXED list of ids for "chrome"; the desktop grid, #7, has fixed grid areas
// -- neither is mine to extend) and never needs the hand row to make room
// for it. Clamped to never rise above the table's own top edge (a very short
// phone) and capped to the hand's own width (390px on desktop's sidebar).
function positionBanner() {
  if (!banner) return;
  const hand = document.getElementById("hand");
  const table = document.getElementById("table");
  if (!hand || !table) return;
  const hr = hand.getBoundingClientRect();
  const tr = table.getBoundingClientRect();
  const width = Math.min(390, Math.max(200, hr.width || tr.width || 320));
  banner.root.style.width = width + "px";
  banner.root.style.left = Math.max(tr.left, hr.left) + "px";
  const h = banner.root.offsetHeight || 54;
  let top = hr.top - h - 6;
  const minTop = tr.top + 4;
  if (top < minTop) top = minTop;
  banner.root.style.top = top + "px";
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
// The banner's one title line already says card+use+target together
// (advisor.suggestCard.<use>, e.g. "Campaign in {space} with {card}") --
// there is no separate "step 2" text, only a separate VISUAL location (the
// card sheet's own gold ring) for it.
function bannerTitle(adv, meta) {
  const { t, cardName } = meta;
  if (adv.action.type === "headline") return t("advisor.suggestHeadline", { card: cardName(adv.card) });
  if (adv.action.type === "choose") {
    if (!adv.targets.length) return null; // a card/option pending choice names no space
    const counts = {};
    for (const id of adv.targets) counts[id] = (counts[id] || 0) + 1;
    const ids = Object.keys(counts);
    return ids.map((id) => t("advisor.suggestSetup", { n: counts[id], space: meta.spaceName(id) })).join(meta.sep());
  }
  if (adv.card == null) return null;
  const use = adv.use || "event";
  const space = adv.targets.length ? joinNames(adv.targets, meta) : "";
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
    try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch {}
  }
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
function decorateMap(adv) {
  const mapInner = document.getElementById("mapInner");
  if (!mapInner) return;
  const nodes = mapInner.querySelectorAll(".node");
  nodes.forEach((n) => {
    n.classList.remove("adv-target");
    const b = n.querySelector(".adv-badge");
    if (b) b.remove();
  });
  if (!adv || !adv.targets || !adv.targets.length) return;
  const counts = {};
  for (const id of adv.targets) counts[id] = (counts[id] || 0) + 1;
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

function paint(adv, view, meta) {
  ensureBanner();
  if (!adv) {
    banner.root.hidden = true;
    decorateHand(null, view, meta);
    decorateSheet(null, meta);
    decorateMap(null);
    return;
  }
  const title = bannerTitle(adv, meta) ?? meta.t("advisor.name");
  const why = meta.t(`advisor.reasons.${adv.reason.key}`, fmtParams(adv.reason.params, meta));
  banner.title.textContent = title;
  banner.why.textContent = why;
  banner.root.hidden = false;
  positionBanner();
  decorateHand(adv, view, meta);
  decorateSheet(adv, meta);
  decorateMap(adv);
}
function showThinking(meta) {
  ensureBanner();
  banner.title.textContent = meta.t("advisor.thinking");
  banner.why.textContent = "";
  banner.root.hidden = false;
  positionBanner();
}
function clearAll() {
  cache.fp = null;
  cache.adv = null;
  if (banner) banner.root.hidden = true;
  decorateHand(null, null, null);
  decorateSheet(null, null);
  decorateMap(null);
}

function applyDecorations(view, meta, force, switchVisible) {
  const active = switchVisible && enabled && view && view.winner == null;
  if (!active) { clearAll(); return; }
  const fp = fingerprint(view, meta.side);
  if (!force && cache.fp === fp) { paint(cache.adv, view, meta); return; }
  cache.fp = fp;
  const myGen = ++gen;
  showThinking(meta);
  // advise() is synchronous and can take real time on a midgame position
  // (#17's own budget: comfortably under 3s, but not instant) -- yielding
  // once here at least lets "thinking" paint before that runs, and the gen
  // check throws the answer away if the position has already moved on.
  setTimeout(() => {
    if (myGen !== gen) return;
    let adv = null;
    try { adv = advise(view, meta.side); } catch { adv = null; }
    if (myGen !== gen) return;
    cache.adv = adv;
    paint(adv, view, meta);
  }, 0);
}

function relegateRulesLink(switchVisible) {
  const narrow = window.innerWidth < 1024; // >=1024px is #7's desktop frame, which has room to spare
  const relegate = switchVisible && narrow;
  const rl = document.getElementById("rulesLink");
  const alt = document.getElementById("rulesLinkAlt");
  if (rl) rl.hidden = relegate;
  if (alt) alt.hidden = !relegate;
}

// The one call app.js makes at the tail of its own render(): meta carries
// exactly what this file can't read out of app.js's own closures --
// { side, solo, uiCard, t, spaceName, stateName, regionName, cardName, sep }.
export function decorate(view, meta) {
  const tableEl = document.getElementById("table");
  const tableShown = !!tableEl && !tableEl.hidden;
  const switchVisible = !!(meta && meta.solo) && !TUTORIAL && tableShown;
  lastCtx = { view, meta };
  if (toggle) {
    toggle.root.hidden = !switchVisible;
    syncToggleUI(meta);
  }
  relegateRulesLink(switchVisible);
  if (meta) applyDecorations(view, meta, false, switchVisible);
  else clearAll();
}
