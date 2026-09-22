// The board's geometry and empty-map drawing, shared by the game table
// (app.js) and the rules page (rules.js) so there is exactly one place that
// says where a city sits. app.js has open-side-effects at import time (it
// wires up the whole play page), so rules.js can never import it directly —
// this module has none: every export here is a constant or a pure function
// of its arguments plus the engine's static board data (E.SPACES / E.SPACE
// / E.STATES never change at runtime).
//
// What is NOT here on purpose: anything that reads live game state
// (influence, control, the current hand/mode) or mutable UI state
// (scoreHighlight, the current language). Those stay in app.js; callers
// pass in whatever of that they need (see renderRegionBlobs's `highlight`
// and nodeLabelHTML's `name`/`lang`/`esc`).
import * as E from "./shared/engine.js";

// A fixed design canvas, scaled to fit whatever box the caller's layout
// gives the map — laid out generously enough that a 13px bold English city
// name (the widest label on the board, e.g. "Guanzhong") never overlaps its
// neighbour once max-width/ellipsis caps it (see .node .nm in style.css).
// NODE_POS is each city's centre, not a corner, so nodeCenter() is trivial.
// The design canvas is the C2_Game mockup's own size (390x408).
export const DESIGN_W = 390, DESIGN_H = 408;
// dai/zhongshan moved right 2026-09-21 (#85, owner on a real phone: 「地圖上
// 把代,跟中山往右移一點」) -- the map's top-left corner (x 0-56, y 0-60 in
// these same design units, map-corner.test.js) now hosts the opponent's-move
// thumbnail (#85/oppmove-ui.js), so no city's disc+badge footprint may reach
// into it. Kept evenly spaced with 薊/ji at the top row's own unchanged
// right end: dai/zhongshan/ji sit 74 design units apart each, same spacing
// dai used to keep from ji's old position, ji itself untouched.
export const NODE_POS = {
  dai: [96, 26], zhongshan: [170, 24], ji: [244, 24], liaodong: [307, 34],
  yiqu: [36, 86], hedong: [136, 82], handan: [234, 80], linzi: [332, 88],
  hangu: [96, 136], shangdang: [186, 130], jimo: [342, 138],
  guanzhong: [50, 182], yiyang: [140, 176], daliang: [244, 168], ju: [312, 172],
  luoyi: [140, 228], xue: [338, 220],
  hanzhong: [36, 252], xinzheng: [196, 244], song: [282, 244],
  bashu: [66, 306],
  qianzhong: [102, 360], chencai: [168, 336], ying: [220, 388], huaisi: [280, 342], wuyue: [340, 378],
};
export const nodeCenter = (id) => NODE_POS[id];
// Region membership comes straight from the board data (E.SPACE[id].region),
// never a hand-copied list — a probe that patches a space's region should
// see the blob move with it.
export function regionMembers() {
  const by = {};
  for (const sp of E.SPACES) (by[sp.region] ??= []).push(sp.id);
  return by;
}
// A space is a capital if its state's `capital` field names it — read
// straight off the board data, same rule as regionMembers().
export function isCapital(id) {
  const sp = E.SPACE[id];
  return !!(sp.state && E.STATES[sp.state].capital === id);
}

// The region blobs: a soft, borderless tint that hugs the roads between a
// region's own cities (no bounding box), one colour per region, membership
// read live from E.SPACE[id].region. `highlight`, when set, brightens that
// region and fades the rest (the caller owns when that applies — app.js
// while a scoring card is open in the sheet; rules.js never passes one).
export function renderRegionBlobs(members, highlight = null) {
  const within = (ids) => {
    const pairs = [];
    for (const id of ids) for (const nb of E.SPACE[id].adj) if (ids.includes(nb) && id < nb) pairs.push([id, nb]);
    return pairs;
  };
  let svg = `<svg class="region-blobs" viewBox="0 0 ${DESIGN_W} ${DESIGN_H}">`;
  for (const [r, ids] of Object.entries(members)) {
    const cls = "blob-" + r + (highlight ? (highlight === r ? " active" : " faded") : "");
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
export function renderRoads() {
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
// north nudged 2026-09-19 for the stability tag (#26) — its old spot started
// overlapping Liaodong's new tag.
// jin/zhou swapped the same day (#26 追加(2), owner on a real phone: "周跟
// 三晉是不是寫反了?") — the old values had "Three Jin" sitting on Zhou's
// only space (Luoyi) and "Zhou" sitting in the middle of the Three Jin
// cluster. The new spots were found by measuring, not eyeballing: jin sits
// inside the convex hull of the Three Jin's six spaces (yiyang/xinzheng/
// hedong/daliang/shangdang/handan) at the nearest collision-free point to
// their centroid; zhou sits at the nearest collision-free point to Luoyi
// that's still closer to Luoyi than to any Three Jin space.
export const REGION_LABEL_POS = {
  north: [320, 60], west: [30, 152], jin: [200, 216], zhou: [140, 280], east: [340, 274], south: [235, 306],
};
// No ellipsis anywhere on the map (owner). Long English names that have a
// natural break (a space or hyphen) go on two lines; the rest just render
// smaller (11px vs 13px) — both explicitly OK'd. Chinese names are always
// short enough for one line at the default size. A handful of cities anchor
// their label off a side instead of straight below, by hand, because the
// default spot collides with a neighbour once the real (untruncated) width
// is on screen — this is a label position, not a change to who's in a
// region, so it's fine per the same rule as REGION_LABEL_POS.
export const NODE_BREAK_EN = { hangu: ["Hangu", "Pass"], bashu: ["Ba-", "Shu"], chencai: ["Chen-", "Cai"], huaisi: ["Huai-", "Si"], wuyue: ["Wu-", "Yue"] };
export const NODE_SMALL_EN = new Set(["zhongshan", "liaodong", "shangdang", "guanzhong", "daliang", "hanzhong", "xinzheng", "qianzhong"]);
// jimo: "left" added 2026-09-19 for the stability tag (#26) — Jimo's default
// (name straight below) put its bottom-left stab tag inside Ju's disc; every
// other anchor tried for this pair just moved the same collision onto a
// different neighbour (measured, not guessed — see the issue's commit
// message), anchor-left was the only one of the four with zero overlap.
export const NODE_ANCHOR = { bashu: "right", shangdang: "right", ying: "top", wuyue: "top", yiyang: "left", linzi: "left", ji: "left", liaodong: "right", hangu: "right", jimo: "left" };
// Two more hand-picked exceptions for the stability tag alone (#26b, owner
// on a real phone), same "adjustable, measured not guessed" rule as
// NODE_ANCHOR — neither changes a node's NAME position, only which corner
// its .stab (and, for NODE_STAB_RIGHT, its .adv-badge) uses:
// - NODE_STAB_RIGHT: Shangdang's tag, at the default bottom-left every
//   other non-anchor-left node uses, still landed on Hangu Pass's name
//   (which reaches toward it from the west) no matter how far it was
//   raised — every anchor combination tried on either node just moved the
//   same overlap onto a different neighbour. Swapping Shangdang's tag (and
//   its matching adv-badge) to bottom-right clears it; see style.css's
//   .stab-r for both rules.
export const NODE_STAB_RIGHT = new Set(["shangdang"]);
// - NODE_STAB_HI: Ying's disc sits close enough to the map's own bottom
//   edge (y=388 of DESIGN_H=408) that the default -2px .stab still ran 4px
//   past it — clipped by the map's own overflow:hidden on both the table
//   and the rules page. A second, bigger lift (style.css's .stab-hi) only
//   for nodes this close to an edge; Wuyue (y=378) was checked and already
//   clears at the default -2px, so it's not in this set.
export const NODE_STAB_HI = new Set(["ying"]);
// #49: NODE_PILL_POS places the small pill that sits near a disc's corner —
// #41's last-move tag AND #49's own placement badge, one visual language
// sharing one position rule — through a class (app.js: "pill-" +
// (NODE_PILL_POS[id] || "tr")) that both `.badge` and `.lastmove-tag` style
// off in style.css. Default "tr" (top-right) applies to every id not
// listed; the other positions are "tl" (top-left), "trl" (top-right, 5px
// lower — clears the map's own top edge for a top-row space without
// leaving the corner), "t"/"b" (centred above/below the disc) and "r"/"l"
// (beside the disc, outside it, vertically centred).
//
// A space's position must have ZERO overlaps against: the disc's own
// digits, the coming single-side disc's centred digit, every space's name/
// stability tag/cost tag, every region label, every other pill, and the
// map's own edge — AND it must not sit closer to a NEIGHBOUR's disc than
// to its own + 6px (a pill has to read as belonging to its own city, not
// whichever one it happens to be nearest). Checked at 390x669 zh, 375x667
// en and 1280x800 zh together — a position clean at one size is not
// necessarily clean at another.
//
// One space has no clean position in that set at every size: ★郢/Ying's
// "r" still clips Huai-Si's name by 1.9x9.7px at 375x667 en, the
// least-bad of the five candidates — orchestrator's ruling (#49): keep it,
// a sliver under a pill a tap clears is accepted.
export const NODE_PILL_POS = {
  guanzhong: "l", hangu: "tl", bashu: "l", yiqu: "tl",
  xinzheng: "r", hedong: "r", shangdang: "b",
  luoyi: "tl", linzi: "r", jimo: "tl", song: "tl",
  ying: "r", wuyue: "r",
  ji: "trl", zhongshan: "r", dai: "r",
};
// #90 round 2: the sealed-capital chop's own position table (design A 朱印
// 角章, owner's pick off the three redesigns on canvas Seal_A_Chop.dc.html;
// generator C:/Users/sheep/code/_orch_keep/sealdesign.py's chop()) — only
// the five capitals ever carry this mark. Each entry is a {dx, dy} PIXEL
// offset of the chop's own CENTRE from the node's centre (app.js turns it
// into an inline transform on the mark itself, alongside the chop's own
// -9deg tilt).
// The default lands the chop's centre at the capital disc's own lower-right
// corner, overlapping it slightly like a stamp: a capital's disc is 34px
// (.node.big .disc), so half its width is 17; chop() computes the corner as
// (half - 2, half - 3) off the disc's own top-left, which is (dx, dy) =
// (15, 14) off the disc's CENTRE once converted to the centre-relative frame
// app.js/SEAL_MARK_POS both use (matches the generator's own (13.5, 12.5) on
// its 31px approximation of the disc, scaled up to this board's real 34px).
// Never the top edge (+N/cost badges) or the lower-left (the stability box)
// — the brief's own two exclusions — which leaves the lower-right as the
// only legal corner. All five capitals (including ji, the tightest spot on
// the board — boxed in by liaodong/zhongshan and the map's own top edge)
// check clean at that same plain lower-right offset, so every entry below
// is identical; this is still a per-capital table (not a single constant)
// because the brief expects one and a future capital-specific exception
// stays a one-line change here instead of a new code path.
// Checked with an exhaustive getBoundingClientRect overlap sweep — every
// .seal-chop against every disc/.hit/.stab/.nm/region-label/badge/
// lastmove-tag/other .seal-chop under #map (own node's own elements
// excluded — the chop overlapping its own disc/hit is the point) — at
// 390x669 zh, 375x667 en and 1280x800 zh+en, in two states: the owner's own
// repro (seals han/zhao) and all five capitals sealed at once. Zero hits
// anywhere.
export const SEAL_MARK_POS = {
  xinzheng: { dx: 15, dy: 14 }, handan: { dx: 15, dy: 14 }, daliang: { dx: 15, dy: 14 },
  linzi: { dx: 15, dy: 14 }, ji: { dx: 15, dy: 14 },
};
// #95: the state tag (design A 國字小籤, owner's pick off canvas
// State_A_Tags, generator C:/Users/sheep/code/_orch_keep/statedesign.py's
// tags()) — a small square on each of the 14 state spaces naming which of
// the five states it belongs to. Today's map colours are the SCORING
// REGIONS, not the states, and a state's own spaces don't all sit in one
// region (中山/dai are Zhao's but sit in the north region) — destroying a
// state needs every one of its spaces, so the player has to be able to tell
// which spaces those are without opening a card. One colour per STATE, not
// per region:
export const STATE_TAG_COLOR = { han: "#2f7f6a", wei: "#b0801f", zhao: "#6a4c9c", qi: "#2d6ea3", yan: "#8a5a3c" };
// STATE_TAG_POS: per-space {dx, dy} PIXEL offset of the tag's own centre off
// the node's centre — same convention SEAL_MARK_POS above already uses, so
// app.js/rules.js apply it the same way (an inline transform, since the tag
// is a fixed 13x13 square that must not scale/rotate with anything else).
// Checked with an exhaustive getBoundingClientRect overlap sweep — every
// .state-tag against every disc/.hit/.stab/.nm/region-label/badge/
// lastmove-tag/seal-chop/other .state-tag under #map (own node's own
// elements excluded) — at 390x669 zh, 375x667 en and 1280x800, in four
// states: an ordinary position, a placement in progress (+N badges show),
// right after the bot's move (last-move tags show), and all five capitals
// sealed. Zero hits in every one. The design's own upper-right starting
// spot collides with the badge/last-move pill on every space (both default
// to that corner, NODE_PILL_POS above) and with the seal chop's lower-right
// on a capital, so each entry here was picked against this space's own
// anchor/pill/stab corner, not copied from the mockup.
// Round 2 (orchestrator, #95): the corner-offset table above put every tag
// PARTLY ON its own disc (a diagonal offset only clears a CIRCLE by
// sqrt(2), never a plain bounding-box overlap check, which is how the
// owner's "never covers the numbers" rule is actually measured) — five of
// them sat on their own influence numerals. A state tag is a label, not a
// stamp (unlike the seal chop, which is deliberately designed to overlap
// its own disc's corner) — every entry below is a PURE axis offset (one of
// dx/dy is 0) of at least discHalf + 6.5 (the tag's own half-width) + a few
// px margin, which is the only offset shape that clears a disc's full
// bounding SQUARE with zero overlap regardless of whether the disc itself
// is round or (on a capital) squared — a diagonal offset of the same
// magnitude would still read as overlapping under that test. Each
// direction is picked against this space's own NODE_ANCHOR/NODE_PILL_POS/
// NODE_STAB_RIGHT/isCapital (which corner the name/pill/stab/seal already
// use), then confirmed with the same exhaustive sweep as before, now with
// two more required-zero columns: this tag's own disc (plain rect
// intersection, not circle-aware — matches how the collision was
// measured) and this tag's own influence numeral (a Range on the digit
// text node, not the half-disc span). ji (the tightest spot on the board,
// boxed in by liaodong/zhongshan and the map's own top edge, #90's own
// comment) can't go "up" at all despite that being its only fully-free
// side — dy far enough negative to clear its own disc's bounding square
// runs the tag off the map's own top edge (checked against #map's real
// getBoundingClientRect, not just against other marks); "right" clears
// its own disc on the x-axis alone instead and stays fully on screen.
export const STATE_TAG_POS = {
  yiyang: { dx: 23, dy: 0 }, xinzheng: { dx: -25, dy: 0 },
  hedong: { dx: -23, dy: 0 }, daliang: { dx: 25, dy: 0 },
  shangdang: { dx: 0, dy: -25 }, handan: { dx: 0, dy: -26 },
  zhongshan: { dx: -23, dy: 0 }, dai: { dx: -23, dy: 0 },
  linzi: { dx: 25, dy: 0 }, jimo: { dx: 23, dy: 0 }, ju: { dx: -23, dy: 0 }, xue: { dx: 23, dy: 0 },
  ji: { dx: 25, dy: 0 }, liaodong: { dx: -23, dy: 0 },
};
// Decorative like stabilityTagHTML()/the seal chop's own inner text — the
// state is already named for assistive tech through `title`, so the glyph
// itself is aria-hidden. `name` is the caller's own state name (app.js/
// rules.js: E.STATES[id].en or .zh off the current language), `esc` its own
// HTML escaper. The glyph is always the Chinese character regardless of UI
// language (the seal chop is always 印, never "Seal" — it's a mark).
export function stateTagHTML(sp, name, esc) {
  if (!sp.state) return "";
  const pos = STATE_TAG_POS[sp.id];
  if (!pos) return "";
  const style = `transform:translate(calc(-50% + ${pos.dx}px), calc(-50% + ${pos.dy}px));` +
    `background:${STATE_TAG_COLOR[sp.state]}`;
  return `<span class="state-tag" style="${style}" title="${esc(name)}" role="img" aria-label="${esc(name)}">` +
    `<span aria-hidden="true" lang="zh-Hant">${esc(E.STATES[sp.state].zh)}</span></span>`;
}
// `name` is the already-resolved display name (the caller's own spaceName()
// — app.js and rules.js each have their own, reading the same E.SPACE[id]
// but keyed to their own current language); `esc` is the caller's own HTML
// escaper. Only the English break/small rules and the battleground star are
// decided here, off the id and `lang`.
// The stability tag: a small square badge in the disc's corner carrying
// E.SPACE[id].stability, drawn identically on the table and the rules page
// (owner design "A 數字籤", #26) — see .node .stab in style.css for its
// look and the anchor-left corner swap. Decorative, so aria-hidden; the
// number is also read out through whatever the caller uses for the tap
// target's accessible name (app.js: the hit button's title/aria-label).
export function stabilityTagHTML(sp) {
  return `<span class="stab" aria-hidden="true">${sp.stability}</span>`;
}
export function nodeLabelHTML(id, name, lang, esc) {
  const star = E.SPACE[id].battleground ? "★" : "";
  if (lang === "en" && NODE_BREAK_EN[id]) {
    const [l1, l2] = NODE_BREAK_EN[id];
    return `<span class="nm two-line">${star}${esc(l1)}<br>${esc(l2)}</span>`;
  }
  const small = lang === "en" && NODE_SMALL_EN.has(id);
  return `<span class="nm${small ? " sm" : ""}">${star}${esc(name)}</span>`;
}
