// #79/#87: draws the opponent's-move reveal -- the card panel (①) and the
// step-by-step playback on the map (②). #85's corner thumbnail/preview and
// its ④ sheet are gone (#87: nothing opened the sheet once the thumbnail
// was removed). Self-contained like advisor-ui.js/tutorial-ui.js/
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
const cardTextZh = (id) => (id === E.JIUDING ? "4 點行動點,全部用在三晉或周視為 5;只能扶植、奇襲、遊說;用後蓋著交給對手。" : E.CARD[id].text);
const cardTextEn = (id) => (id === E.JIUDING ? "4 ops; 5 if all of it lands in the Three Jin or Zhou. Then it passes face down." : CARD_EN[id] ?? E.CARD[id].text);
const cardName = (id, lang) => (lang === "en" ? cardEn(id) : cardZh(id));
const cardText = (id, lang) => (lang === "en" ? cardTextEn(id) : cardTextZh(id));
const spaceName = (id, lang) => (id && E.SPACE[id] ? (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh) : "");
const stateName = (id, lang) => (id && E.STATES[id] ? (lang === "en" ? E.STATES[id].en : E.STATES[id].zh) : "");
const regionName = (r, lang) => (r && E.REGIONS[r] ? (lang === "en" ? E.REGIONS[r].en : E.REGIONS[r].zh) : "");
const sideName = (s, lang) => t(lang, `sides.${E.SIDES[s]}`);
const opsOf = (id) => (id === E.JIUDING ? 4 : E.CARD[id].ops);
// #82: the printed ops (opsOf, above) are what the CARD says -- not what the
// move actually spent. The Nine Cauldrons is 4, or 5 when every point lands
// in the Three Jin or Zhou; 商鞅變法's +1 (or any other ops modifier) can
// change any card's own spend the same way. The move's own log steps carry
// the true number: a `campaign`/`lobby` step's `ops`, or a `place` step's
// `spent`. Fall back to the printed ops only when the move has no ops step
// at all (a play for event, or a headline).
function actualOpsOf(mv) {
  for (const st of mv.steps) {
    if ((st.type === "campaign" || st.type === "lobby") && typeof st.ops === "number") return st.ops;
    if (st.type === "place" && typeof st.spent === "number") return st.spent;
  }
  return opsOf(mv.card);
}
const cardSideOf = (id) => (id === E.JIUDING ? null : E.CARD[id].side);
const cardScoring = (id) => id !== E.JIUDING && !!E.CARD[id].scoring;
// #120: a beat's ticker note can name a card too (the event played, an
// effect starting/ending, a discard) -- same clickable look as the log
// panel's own .log-card-link (style.css, shared), opening the SAME
// openPeek() in app.js. This module never reaches into app.js for it (the
// file-header rule above: only a context bundle in, never a DOM handle
// back) -- app.js hands it a callback once via setOpenPeek(), and onTap()
// below calls it when the tap actually landed on one of these buttons
// instead of treating it as "skip the reveal".
let openPeekCb = null;
export function setOpenPeek(fn) { openPeekCb = fn; }
function cardLinkHtml(id, side, lang) {
  const label = esc(cardName(id, lang));
  const sideAttr = side != null ? ` data-side="${side}"` : "";
  return `<button type="button" class="log-card-link opp-ticker-card no-tap-sound" data-card="${id}"${sideAttr}>${label}</button>`;
}
// Same splice as log-view.js's tCard(): walk the template's `{param}`
// placeholders, swap the one named `cardParam` for a real button, esc()
// every other one (defense in depth -- these are all our own i18n/engine
// strings, never player text).
function noteHtml(lang, key, params, cardParam, cardId, cardSide) {
  const raw = String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en) ?? key);
  return raw.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === cardParam) return cardLinkHtml(cardId, cardSide, lang);
    return esc(params[k] ?? `{${k}}`);
  });
}
// The mandate's own resulting total (v.mandate's own sign convention: +Qin).
const mandateTotalTxt = (m, lang) => (m > 0 ? `${t(lang, "sides.qin")} +${m}` : m < 0 ? `${t(lang, "sides.chu")} +${-m}` : "0");

const STEP_MS = 600, REDUCED_MS = 1500;
const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ---------- module state ----------
let revealedSeq = null; // the log seq this module has already turned into a reveal; null until (re)initialized
let phase = "idle";     // idle | card | steps | steps-static
let queue = [];         // moves still waiting for their own tap, oldest first
let move = null;        // the move currently on screen (card/steps phases)
let beats = [];         // flattened per-tick items for the current move's steps phase
let beatIndex = -1;
let timer = null;
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
    `<div id="oppCard" class="opp-card" hidden tabindex="0" role="button"></div>` +
    `<div id="oppRings" class="opp-rings" hidden></div>` +
    `<div id="oppTicker" class="opp-ticker" hidden></div>`;
  document.body.appendChild(root);
  dom = {
    dim: root.querySelector("#oppDim"), card: root.querySelector("#oppCard"),
    rings: root.querySelector("#oppRings"), ticker: root.querySelector("#oppTicker"),
  };
  dom.dim.addEventListener("click", onTap);
  dom.card.addEventListener("click", onTap);
  dom.ticker.addEventListener("click", onTap);
  dom.card.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onTap(); }
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && phase !== "idle") onEscape(); });
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
      // engine.js's vp(st, side, n): `side` is who the CALL credits the swing
      // to, but `n` can be negative (scoreRegion() always calls vp(st, QIN,
      // qin.total - chu.total)) -- the side that actually GAINED mandate is
      // `side` only when n>=0, the other side when n<0. Showing `side` and a
      // bare "+{n}" for a negative n read as the wrong side gaining (round 2
      // fix 3, the checker's own report).
      const gainer = st.n >= 0 ? st.side : 1 - st.side;
      let text = t(lang, "oppmove.tickerMandate", { side: sideName(gainer, lang), n: Math.abs(st.n) });
      if (st.mandate != null) text += t(lang, "oppmove.tickerMandateArrow", { to: mandateTotalTxt(st.mandate, lang) });
      out.push({ kind: "stat", stat: "mandate", text });
    } else if (st.type === "score") {
      const q = st.qin && st.qin.total, c = st.chu && st.chu.total;
      out.push({ kind: "stat", stat: "mandate", text: t(lang, "oppmove.tickerScore", { region: regionName(st.region, lang), q, c }) });
    } else if (st.type === "tire") {
      out.push({ kind: "stat", stat: "weariness", text: t(lang, "oppmove.tickerTire", { to: t(lang, "weariness." + st.to) }) });
    } else if (st.type === "seal") {
      out.push({ kind: "stat", stat: "seals", text: t(lang, "oppmove.tickerSeal", { state: stateName(st.state, lang) }) });
    } else if (st.type === "unseal") {
      out.push({ kind: "stat", stat: "seals", text: t(lang, "oppmove.tickerUnseal", { state: stateName(st.state, lang) }) });
    } else if (st.type === "mie" || st.type === "restore") {
      // The brief groups mie with the other gold-glow status effects (a glow
      // on the 滅/mie column, not a map ring) -- the capital's own disc still
      // visibly changes underneath, but that's #41's mark, folded in here so
      // the trailing "event changed this too" beat below doesn't repeat it.
      const cap = st.state && E.STATES[st.state] ? E.STATES[st.state].capital : null;
      if (cap) named.add(cap);
      const key = st.type === "mie" ? "oppmove.tickerMie" : "oppmove.tickerRestore";
      out.push({ kind: "stat", stat: "mie", text: t(lang, key, { state: stateName(st.state, lang) }) });
    } else if (st.type === "jiuding") {
      out.push({ kind: "stat", stat: "jiuding", text: t(lang, "oppmove.tickerJiuding", { side: sideName(st.to, lang) }) });
    } else if (st.type === "event") {
      // #115: the event gets a beat of its own, so the reveal says it happened.
      out.push({ kind: "note", text: t(lang, "oppmove.tickerEvent", { side: sideName(st.side, lang), card: cardName(st.card, lang) }), html: noteHtml(lang, "oppmove.tickerEvent", { side: sideName(st.side, lang) }, "card", st.card, st.side) });
    } else if (st.type === "eventEnd") {
      if (!st.effect) {
        out.push({ kind: "note", text: t(lang, "oppmove.tickerEventNone", { side: sideName(st.side, lang), card: cardName(st.card, lang), why: t(lang, `logPanel.eventWhy.${st.why}`) }), html: noteHtml(lang, "oppmove.tickerEventNone", { side: sideName(st.side, lang), why: t(lang, `logPanel.eventWhy.${st.why}`) }, "card", st.card, st.side) });
        continue;
      }
      const signed = (d) => (d > 0 ? `+${d}` : `−${-d}`);
      for (const s of st.chose || []) out.push({ kind: "note", text: t(lang, "logPanel.chipChose", { side: sideName(s, lang) }) });
      for (const [id, dq, dc] of st.inf || []) {
        named.add(id);
        for (const [s, d] of [[E.QIN, dq], [E.CHU, dc]]) {
          if (d) out.push({ kind: "ring", spaceId: id, n: d > 0 ? d : null, side: s, text: t(lang, "logPanel.chipInf", { space: spaceName(id, lang), side: sideName(s, lang), d: signed(d) }) });
        }
      }
      for (const c of (st.fx && st.fx.add) || []) out.push({ kind: "note", text: t(lang, "logPanel.chipEffectOn", { card: cardName(c, lang) }), html: noteHtml(lang, "logPanel.chipEffectOn", {}, "card", c, cardSideOf(c)) });
      for (const c of (st.fx && st.fx.rm) || []) out.push({ kind: "note", text: t(lang, "logPanel.chipEffectOff", { card: cardName(c, lang) }), html: noteHtml(lang, "logPanel.chipEffectOff", {}, "card", c, cardSideOf(c)) });
      (st.hands || []).forEach((d, s) => { if (d) out.push({ kind: "note", text: t(lang, "logPanel.chipDraw", { side: sideName(s, lang), d: signed(d) }) }); });
      if (st.recover) out.push({ kind: "stat", stat: "weariness", text: t(lang, "logPanel.chipTire", { to: t(lang, "weariness." + st.recover) }) });
    } else if (st.type === "discard") {
      out.push({ kind: "note", text: t(lang, "logPanel.chipDiscard", { side: sideName(st.side, lang), card: cardName(st.card, lang) }), html: noteHtml(lang, "logPanel.chipDiscard", { side: sideName(st.side, lang) }, "card", st.card, st.side) });
    }
  }
  const marks = c.lastMoveMarks || {};
  const extra = Object.keys(marks).filter((id) => !named.has(id));
  if (extra.length) out.push({ kind: "final", spaces: extra, text: t(lang, "oppmove.tickerFinal") });
  return out;
}

// Shared by ①'s use line: what a move's own use line says. An event (or a
// headline, which renderCard skips outright since it has nothing but the
// event line) never shows ops -- round 2 fix 4, the checker's own report
// that "用來事件 · 2 點" reads like a place/campaign use that happens to be
// called "event", and a scoring card has no numeric ops worth stating at
// all ("0 點" would be actively wrong).
function useLineFor(mv, lang) {
  if (mv.use === "event") return cardScoring(mv.card) ? t(lang, "oppmove.useScoringEvent") : t(lang, "oppmove.useEvent");
  // #115: event first, the engine writes the use the ops really went to back
  // into the play entry once they are spent -- often after this move was
  // taken off the log -- so read it live from the view on every paint.
  const log = ctx.view && Array.isArray(ctx.view.log) ? ctx.view.log : [];
  const live = log.find((l) => l.i === mv.seq && l.type === "play");
  const use = live && live.use ? live.use : mv.use;
  return t(lang, "oppmove.useOps", { use: t(lang, `useNames.${use}`), ops: actualOpsOf(mv) });
}
// ---------- ① the card panel ----------
// The Nine Cauldrons (its `play` entry names card "jiuding", #81) is action
// points only -- it has
// no event, unlike a genuine neutral/enemy card played for ops, so it gets
// no event line at all, never the "its event also happens" wording.
// 說客's pair (#115): opponentMoves() keeps no pair, so read it from the
// move's own `play` entry in the view's log.
function pairOf(mv) {
  const log = ctx.view && Array.isArray(ctx.view.log) ? ctx.view.log : [];
  const e = log.find((l) => l.i === mv.seq && l.type === "play");
  return e && e.pair && E.CARD[e.pair] ? e.pair : null;
}
function eventLineFor(mv, lang) {
  if (mv.card === "jiuding") return "";
  const pair = pairOf(mv);
  if (pair) return t(lang, "logPanel.pairWith", { side: sideName(cardSideOf(pair), lang), card: cardName(pair, lang) });
  const owner = cardSideOf(mv.card);
  const text = cardText(mv.card, lang);
  if (mv.use === "headline") return t(lang, "oppmove.eventHeadline", { text });
  if (mv.use === "event") return t(lang, "oppmove.eventTheirs", { text });
  if (owner == null) return t(lang, "oppmove.eventNeutral", { text });
  if (owner === ctx.me) return t(lang, "oppmove.eventMine", { side: sideName(ctx.me, lang), text });
  return ""; // their own card, spent for ops -- no event fires, nothing to say
}
function renderCard() {
  const d = ensureDom(), lang = ctx.lang;
  const side = move.side, card = move.card, use = move.use;
  const sideCls = side === E.QIN ? "q" : "c";
  const useLine = use === "headline" ? "" : `<div class="opp-useops">${esc(useLineFor(move, lang))}</div>`;
  const eventLine = eventLineFor(move, lang);
  d.dim.className = "opp-dim"; // full dim, not ②'s invisible full-map catcher
  const mr = rectOf(mapEl());
  if (mr) {
    d.dim.style.cssText = `left:${mr.left}px;top:${mr.top}px;width:${mr.width}px;height:${Math.round(mr.height * 0.72)}px`;
    d.card.style.cssText = `left:${mr.left + 8}px;top:${mr.top + 8}px;width:${mr.width - 16}px`;
  }
  d.card.className = `opp-card side-${sideCls}`;
  // 說客 with its pair: both faces, side by side, a little smaller (#115).
  const pair = pairOf(move);
  const art = (id, small) => `<img class="opp-card-art"${small ? ' style="width:62px;height:83px"' : ""} src="art/cards/${id}.jpg" alt="${esc(cardName(id, lang))}" onerror="this.style.visibility='hidden'">`;
  const arts = pair ? `<div style="display:flex;flex-direction:column;gap:6px;flex:none">${art(card, true)}${art(pair, true)}</div>` : art(card, false);
  d.card.innerHTML =
    arts +
    `<div class="opp-card-body">` +
      `<span class="opp-card-tag">${esc(t(lang, "oppmove.playedTag", { side: sideName(side, lang) }))}</span>` +
      `<div class="opp-card-name"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(cardName(card, lang))}</div>` +
      useLine +
      (eventLine ? `<div class="opp-card-event"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(eventLine)}</div>` : "") +
    `</div>` +
    `<div class="opp-card-hint">${esc(t(lang, "oppmove.tapHint"))}</div>`;
  d.card.focus();
}

// ---------- ② the steps ----------
// The same #oppDim element as ①, now invisible and covering the full map
// (not just its upper 72%) -- a tap anywhere on the map still skips.
function positionMapCatcher() {
  const d = ensureDom();
  d.dim.className = "opp-dim opp-dim-clear";
  const mr = rectOf(mapEl());
  if (mr) d.dim.style.cssText = `left:${mr.left}px;top:${mr.top}px;width:${mr.width}px;height:${mr.height}px`;
}
// `index` (round 2 fix 2, the checker's own report): the ticker used to
// carry a literal "②" glyph inside every beat's own text, which read as
// step "2" for every step including the first. The ticker takes the same
// 1-based number for a single, unambiguous count.
function renderBeat(beat, index) {
  const d = ensureDom();
  d.rings.innerHTML = "";
  if (beat.kind === "ring" && beat.spaceId) {
    const r = rectOf(spaceEl(beat.spaceId));
    if (r) {
      const ring = document.createElement("div");
      ring.className = `opp-ring side-${(beat.side === E.QIN ? "q" : "c")}`;
      ring.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
      if (beat.n) ring.innerHTML = `<span class="opp-ring-badge">+${beat.n}</span>`;
      d.rings.appendChild(ring);
    }
  } else if (beat.kind === "final" && Array.isArray(beat.spaces)) {
    for (const id of beat.spaces) {
      const r = rectOf(spaceEl(id));
      if (!r) continue;
      const ring = document.createElement("div");
      ring.className = "opp-ring opp-ring-gold";
      ring.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
      d.rings.appendChild(ring);
    }
  } else if (beat.kind === "stat" && beat.stat) {
    const r = rectOf(statEl(beat.stat));
    if (r) {
      const glow = document.createElement("div");
      glow.className = "opp-glow";
      glow.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      d.rings.appendChild(glow);
    }
  }
  const mr = rectOf(mapEl());
  if (mr) d.ticker.style.cssText = `left:${mr.left + 8}px;top:${mr.bottom - 38}px;width:${mr.width - 16}px`;
  // #120: beat.html (only set on a note that names a card) carries a real
  // <button> -- innerHTML for that case, plain textContent otherwise (every
  // other beat's `text` is a translated string with no markup in it).
  if (beat.html) d.ticker.innerHTML = `${index + 1}. ${beat.html}`;
  else d.ticker.textContent = `${index + 1}. ${beat.text}`;
}
function renderStepsStatic() {
  // prefers-reduced-motion: every beat's ring/glow shown at once, no ticker cycling.
  const d = ensureDom();
  d.rings.innerHTML = "";
  beats.forEach((beat, i) => {
    const prevInner = d.rings.innerHTML;
    renderBeat(beat, i);
    d.rings.innerHTML = prevInner + d.rings.innerHTML;
  });
  if (!beats.length) { d.ticker.textContent = ""; return; }
  const last = beats[beats.length - 1];
  if (last.html) d.ticker.innerHTML = `${beats.length}. ${last.html}`;
  else d.ticker.textContent = `${beats.length}. ${last.text}`;
}

// ---------- overall visibility ----------
// The single place that decides what's on screen: card panel+dim during ①,
// rings+ticker during ② (the map playback), or nothing at all (winner
// decided / the player is picking a map target / this render is disabled
// outright -- tutorial, spectator).
function paint() {
  const d = ensureDom();
  const inCard = phase === "card";
  const inSteps = phase === "steps" || phase === "steps-static";
  d.dim.hidden = !(inCard || inSteps); // ②: still present (invisible) so a tap anywhere on the map skips (the brief's own rule)
  d.card.hidden = !inCard;
  d.rings.hidden = !inSteps;
  d.ticker.hidden = !inSteps;
  if (inCard) renderCard();
  else if (inSteps) positionMapCatcher();
}

// ---------- the tap-driven playback (#87: ① waits for its own tap, no
// timer; ② still autoplays its 0.6s beats but a tap/Escape skips to the
// end; each queued move gets its own card wait in turn). ----------
function startNext() {
  move = queue.shift();
  beats = flattenBeats(move, ctx.view, ctx);
  beatIndex = -1;
  phase = "card";
  clearTimeout(timer);
  paint();
}
// A tap (or Enter/Space on the focused panel) while ① is up: start ②.
function continueFromCard() {
  if (reduceMotion()) {
    phase = "steps-static";
    renderStepsStatic();
    paint();
    timer = setTimeout(finishMove, REDUCED_MS);
    return;
  }
  phase = "steps";
  nextBeat();
}
function nextBeat() {
  beatIndex++;
  if (beatIndex >= beats.length) { finishMove(); return; }
  renderBeat(beats[beatIndex], beatIndex);
  paint();
  timer = setTimeout(nextBeat, STEP_MS);
}
function finishMove() {
  clearTimeout(timer);
  move = null; beats = []; beatIndex = -1;
  if (queue.length) { startNext(); return; } // the next queued move waits for its own tap
  phase = "idle";
  paint();
}
// A tap on the dim/card/ticker (dom's own click listeners, wired in
// ensureDom()): during ① it continues into ②; during ② it skips straight
// to the end (finishMove, which then opens the next queued move's own ①).
// #120: EXCEPT a tap that actually landed on one of the ticker's own
// .opp-ticker-card buttons -- that opens the read-only peek instead (via
// the callback app.js registered with setOpenPeek()) and does not also
// skip the reveal; the ticker keeps cycling underneath the peek, same as
// any other read-only overlay opened mid-animation.
function onTap(ev) {
  const link = ev && ev.target && ev.target.closest ? ev.target.closest(".opp-ticker-card") : null;
  if (link) {
    if (openPeekCb) openPeekCb(link.dataset.card, link.dataset.side != null ? Number(link.dataset.side) : null);
    return;
  }
  if (phase === "card") continueFromCard();
  else if (phase === "steps" || phase === "steps-static") finishMove();
}
// Escape: the stronger "get me out of this step" -- skips the current
// phase outright (no steps at all from ①, or straight to the end from ②).
function onEscape() {
  if (phase === "card" || phase === "steps" || phase === "steps-static") finishMove();
}

// ---------- public API ----------
// Called once per render(), never for a spectator view or the tutorial (the
// coach drives the tutorial, per the brief). `info`: { me, lang, mapTargeting,
// acted, lastMoveMarks } -- acted is true once the player has picked a card
// (or anything else has moved game.ui off its fresh/neutral shape), which
// ends the sequence immediately and never blocks further input (the brief's
// own rule); mapTargeting is true while the map itself has live hit targets.
export function sync(view, info) {
  ctx = { view, me: info.me, lang: info.lang, mapTargeting: info.mapTargeting, lastMoveMarks: info.lastMoveMarks };
  if (!view) { disable(); return; }
  const log = Array.isArray(view.log) ? view.log : [];
  const nowSeq = lastLogSeq(log);
  if (revealedSeq == null) { revealedSeq = nowSeq; paint(); return; } // first sync after (re)init: nothing "new" yet
  if (info.acted && phase !== "idle") { clearReveal(); paint(); return; }
  if (phase === "idle" && !info.acted) {
    const fresh = opponentMoves(log, revealedSeq, info.me);
    revealedSeq = nowSeq; // a batch is only ever offered once, whether or not it was non-empty
    if (fresh.length && view.winner == null) { queue = fresh; startNext(); return; }
  }
  paint();
}
function clearReveal() {
  clearTimeout(timer);
  phase = "idle"; move = null; queue = []; beats = []; beatIndex = -1;
}
// The player committed a real action (humanAct()): the reveal (card wait or
// steps in progress, plus anything still queued) closes at once -- never
// blocks the hand or the top bar. No paint() here: onAction() runs at the
// top of humanAct(), before the actual action lands, and the render() that
// follows immediately after will call sync() and paint the cleared state.
export function onAction() { clearReveal(); }
// A new game started, a solo game resumed, or a room's first view arrived:
// nothing already in the log is "new" (the brief's own resume note) --
// re-baseline the watermark instead of replaying a backlog.
export function reset() {
  clearTimeout(timer);
  revealedSeq = null;
  phase = "idle"; move = null; queue = []; beats = []; beatIndex = -1;
  if (dom) paint();
}
// A spectator view, or the tutorial running: hide everything, touch nothing
// else (so returning to the real game afterwards can pick up cleanly).
export function disable() {
  clearTimeout(timer);
  phase = "idle"; move = null; queue = []; beats = []; beatIndex = -1;
  if (!dom) return;
  dom.dim.hidden = true; dom.card.hidden = true; dom.rings.hidden = true; dom.ticker.hidden = true;
}
