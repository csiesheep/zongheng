// #79: draws the opponent's-move reveal -- the card panel (①), the
// step-by-step playback on the map (②), the persistent chip (③) and its
// bottom sheet (④). Self-contained like advisor-ui.js/tutorial-ui.js/
// card-view.js: reads the two i18n modules and shared/engine.js itself, and
// takes only a small context bundle from app.js's own render() -- never a
// DOM handle back into app.js. app.js calls sync() once per render() (never
// during a spectator view or the tutorial), onAction() at the top of
// humanAct(), and reset() whenever a game starts, resumes or a room's first
// view arrives (resetVoicingState()).
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";
import { opponentMoves } from "./oppmove.js";

const I18N = { en, "zh-Hant": zh };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function t(lang, key, p = {}) {
  return String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en) ?? key)
    .replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));
}
const cardZh = (id) => (id === E.JIUDING ? "九鼎" : E.CARD[id].zh);
const cardEn = (id) => (id === E.JIUDING ? "The Nine Cauldrons" : E.CARD[id].en);
const cardTextZh = (id) => (id === E.JIUDING ? "4 點行動點,全部用在三晉或周視為 5;只能放置、征伐、遊說;用後蓋著交給對手。" : E.CARD[id].text);
const cardTextEn = (id) => (id === E.JIUDING ? "4 ops; 5 if all of it lands in the Three Jin or Zhou. Then it passes face down." : CARD_EN[id] ?? E.CARD[id].text);
const cardName = (id, lang) => (lang === "en" ? cardEn(id) : cardZh(id));
const cardText = (id, lang) => (lang === "en" ? cardTextEn(id) : cardTextZh(id));
const spaceName = (id, lang) => (id && E.SPACE[id] ? (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh) : "");
const stateName = (id, lang) => (id && E.STATES[id] ? (lang === "en" ? E.STATES[id].en : E.STATES[id].zh) : "");
const sideName = (s, lang) => t(lang, `sides.${E.SIDES[s]}`);
const opsOf = (id) => (id === E.JIUDING ? 4 : E.CARD[id].ops);
const cardSideOf = (id) => (id === E.JIUDING ? null : E.CARD[id].side);
const mandateTxt = (m, lang) => (m > 0 ? `${t(lang, "sides.qin")} +${m}` : m < 0 ? `${t(lang, "sides.chu")} +${-m}` : "0");

const CARD_MS = 1500, STEP_MS = 600;
const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ---------- module state ----------
let revealedSeq = null; // the log seq this module has already turned into a reveal (or a chip); null until (re)initialized
let phase = "idle";     // idle | card | steps | steps-static
let queue = [];         // moves still waiting to play, oldest first
let move = null;        // the move currently on screen (card/steps phases)
let beats = [];         // flattened per-tick items for the current move's steps phase
let beatIndex = -1;
let timer = null;
let chip = null;        // { move } for the persistent ③ chip, or null
let sheetOpen = false;
let sheetSeq = null;    // which move (by .seq) the open sheet is showing
let ctx = { view: null, me: 0, lang: "zh-Hant", mapTargeting: false, acted: false };

function lastLogSeq(log) { return Array.isArray(log) && log.length ? log[log.length - 1].i : 0; }

// ---------- DOM (built once, lazily; a fixed-position layer, never a child
// of #map -- so nothing here can ever change #map's own box, #68's rule). ----------
let dom = null;
function ensureDom() {
  if (dom) return dom;
  const root = document.createElement("div");
  root.id = "oppReveal";
  root.innerHTML =
    `<div id="oppDim" class="opp-dim" hidden></div>` +
    `<div id="oppCard" class="opp-card" hidden></div>` +
    `<div id="oppRings" class="opp-rings" hidden></div>` +
    `<div id="oppTicker" class="opp-ticker" hidden></div>` +
    `<button type="button" id="oppChip" class="opp-chip no-tap-sound" hidden></button>`;
  document.body.appendChild(root);
  const scrim = document.createElement("div"); scrim.id = "oppScrim"; scrim.className = "opp-scrim"; scrim.hidden = true;
  const sheet = document.createElement("div"); sheet.id = "oppSheet"; sheet.className = "opp-sheet"; sheet.hidden = true;
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);
  dom = {
    dim: root.querySelector("#oppDim"), card: root.querySelector("#oppCard"),
    rings: root.querySelector("#oppRings"), ticker: root.querySelector("#oppTicker"),
    chip: root.querySelector("#oppChip"), scrim, sheet,
  };
  dom.dim.addEventListener("click", skip);
  dom.card.addEventListener("click", skip);
  dom.ticker.addEventListener("click", skip);
  dom.chip.addEventListener("click", () => openSheet(null));
  scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && sheetOpen) closeSheet(); });
  return dom;
}
function mapEl() { return document.getElementById("map"); }
function spaceEl(id) { return id ? document.querySelector(`.node[data-space="${id}"]`) : null; }
function statEl(name) { return document.querySelector(`[data-stat="${name}"]`); }
function rectOf(el) { return el ? el.getBoundingClientRect() : null; }

// ---------- turning one move's logged steps into playback beats ----------
// One beat per space for a `place` step (the design plays each space its own
// 0.6s beat), one beat per other step type. `named` collects every space a
// beat already accounts for, so the trailing "event changed this too" beat
// (#41's own marks, never logged as a placement) doesn't repeat them.
function flattenBeats(mv, view, c) {
  const lang = c.lang, out = [];
  const named = new Set();
  for (const st of mv.steps) {
    if (st.type === "place" && Array.isArray(st.spaces)) {
      for (const [id, n] of st.spaces) {
        named.add(id);
        out.push({ kind: "ring", spaceId: id, n, side: mv.side, text: t(lang, "oppmove.tickerPlace", { side: sideName(mv.side, lang), space: spaceName(id, lang), n }) });
      }
    } else if (st.type === "campaign") {
      if (st.target) named.add(st.target);
      out.push({ kind: "ring", spaceId: st.target, n: st.placed || null, side: mv.side, text: t(lang, "oppmove.tickerCampaign", { side: sideName(mv.side, lang), target: spaceName(st.target, lang), removed: st.removed, placed: st.placed }) });
    } else if (st.type === "lobby") {
      if (st.target) named.add(st.target);
      out.push({ kind: "ring", spaceId: st.target, n: null, side: mv.side, text: t(lang, "oppmove.tickerLobby", { side: sideName(mv.side, lang), target: spaceName(st.target, lang), removed: st.removed }) });
    } else if (st.type === "reform") {
      out.push({ kind: "stat", stat: "reform", text: t(lang, "oppmove.tickerReform", { side: sideName(st.side, lang), box: st.box }) });
    } else if (st.type === "vp") {
      out.push({ kind: "stat", stat: "mandate", text: t(lang, "oppmove.tickerMandate", { value: mandateTxt(st.mandate, lang) }) });
    } else if (st.type === "tire") {
      out.push({ kind: "stat", stat: "weariness", text: t(lang, "oppmove.tickerTire", { to: t(lang, "weariness." + st.to) }) });
    } else if (st.type === "seal") {
      out.push({ kind: "stat", stat: "seals", text: t(lang, "oppmove.tickerSeal", { state: stateName(st.state, lang) }) });
    } else if (st.type === "unseal") {
      out.push({ kind: "stat", stat: "seals", text: t(lang, "oppmove.tickerUnseal", { state: stateName(st.state, lang) }) });
    } else if (st.type === "mie" || st.type === "restore") {
      const cap = st.state && E.STATES[st.state] ? E.STATES[st.state].capital : null;
      if (cap) named.add(cap);
      const key = st.type === "mie" ? "oppmove.tickerMie" : "oppmove.tickerRestore";
      out.push({ kind: "ring", spaceId: cap, side: st.type === "mie" ? E.QIN : E.CHU, text: t(lang, key, { state: stateName(st.state, lang) }) });
    } else if (st.type === "jiuding") {
      out.push({ kind: "stat", stat: "jiuding", text: t(lang, "oppmove.tickerJiuding", { side: sideName(st.to, lang) }) });
    }
  }
  const marks = c.lastMoveMarks || {};
  const extra = Object.keys(marks).filter((id) => !named.has(id));
  if (extra.length) out.push({ kind: "final", spaces: extra, text: t(lang, "oppmove.tickerFinal") });
  return out;
}

// ---------- public API (filled in by later edits) ----------
export function sync(view, info) {}
export function onAction() {}
export function reset() {}
export function disable() {}
