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
export const NODE_POS = {
  dai: [64, 26], zhongshan: [148, 24], ji: [244, 24], liaodong: [307, 34],
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
// #41: the last-move tag (a small "+2"/"−1"/destroyed-word badge) defaults
// to the disc's upper-right corner, the one corner none of the other three
// per-node decorations above ever use — free on all 26 nodes except where
// the CITY NAME itself reaches into it: an anchor-top name (centred right
// above the disc — ying, wuyue) or an anchor-right name (starts flush
// against the disc's own right edge, vertically centred — every node whose
// own NODE_ANCHOR is "right": bashu, shangdang, liaodong, hangu) both run
// close enough to the upper-right corner at the map's floor scale (#39) to
// collide with a tag there once real text is measured, not eyeballed —
// checked by rendering all 26 spaces with a mark at once, at 390x669 floor
// scale, in BOTH languages (English names are the wider case: catching
// "Ba-Shu" needed the English pass, plain "巴蜀" alone would have missed
// it). The other 22 (including anchor-left, whose name moves to the
// OPPOSITE side, and every plain below-the-disc name) leave it clear.
// These six flip the tag to the upper-left instead — the same corner
// .cost (setup/opening-placement's own transient badge) uses, which is
// never on screen at the same time as a last-move tag (cost only shows
// while a target is still being chosen, before an action has resolved).
export const NODE_LASTMOVE_LEFT = new Set(["ying", "wuyue", "bashu", "shangdang", "liaodong", "hangu"]);
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
