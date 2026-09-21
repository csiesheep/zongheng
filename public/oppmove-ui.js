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

// ---------- public API (filled in by later edits) ----------
export function sync(view, info) {}
export function onAction() {}
export function reset() {}
export function disable() {}
