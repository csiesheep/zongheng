// #88 (design A 逐手卷軸): renders the log panel's own content -- turn/round
// headers, one row per move with its result chips, headline/other rows, and
// the room's chat/bot lines -- and works out what a tapped move should
// flash on the map. groupLog() (oppmove.js, DOM-free) does the grouping;
// this file turns that into HTML strings and a small flash overlay of its
// own. Self-contained like oppmove-ui.js (reads the two i18n modules and
// shared/engine.js directly) but deliberately independent of it: #87 owns
// oppmove-ui.js/oppmove.css, so this never imports either -- the ring/glow
// look below is its own small CSS block in style.css, just matching #79's.
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import { groupLog } from "./oppmove.js";

const I18N = { en, "zh-Hant": zh };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function t(lang, key, p = {}) {
  return String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en) ?? key)
    .replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));
}
const sideName = (s, lang) => t(lang, `sides.${E.SIDES[s]}`);
const cardName = (id, lang) => (id === E.JIUDING ? (lang === "en" ? "The Nine Cauldrons" : "九鼎") : lang === "en" ? E.CARD[id].en : E.CARD[id].zh);
const spaceName = (id, lang) => (id && E.SPACE[id] ? (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh) : "");
const stateName = (id, lang) => (id && E.STATES[id] ? (lang === "en" ? E.STATES[id].en : E.STATES[id].zh) : "");
const regionName = (r, lang) => (r && E.REGIONS[r] ? (lang === "en" ? E.REGIONS[r].en : E.REGIONS[r].zh) : "");
const useLabel = (use, lang) => t(lang, `useNames.${use}`);
// #120: every card name in the panel opens the same read-only peek the
// thumbnail already does (openPeek(cardId, side) in app.js) -- this module
// never calls it directly (no DOM handle back into app.js, same rule as
// oppmove-ui.js), it just marks up a <button class="log-card-link"> with
// the id/side in data-* attributes; app.js's own #logLines click delegate
// (below the thumb check) reads them and calls openPeek(). `.log-card-link`
// is the existing style the prompt-area news strip already uses for a card
// name (app.js's cardLinkButton()) -- reused here rather than invented
// fresh, so "looks tappable" means the same gold underline everywhere.
function cardLinkHtml(id, side, lang) {
  const label = cardName(id, lang);
  const sideAttr = side != null ? ` data-side="${side}"` : "";
  return `<button type="button" class="log-card-link no-tap-sound" data-card="${id}"${sideAttr}>${label}</button>`;
}
// Same idea as app.js's logLineNodes(): walk an i18n template's own
// `{param}` placeholders, and for the one named in `cardParam` splice in
// cardLinkHtml() instead of the plain interpolated string. Every other
// placeholder still goes through esc() -- these strings are built from our
// own i18n tables and engine ids (never player text), but esc() costs
// nothing and keeps this safe if that ever changes.
function tCardMulti(lang, key, params, cardParams) {
  const raw = String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en) ?? key);
  return raw.replace(/\{(\w+)\}/g, (_, k) => {
    const ref = cardParams && cardParams[k];
    if (ref) return cardLinkHtml(ref.id, ref.side, lang);
    return esc(params[k] ?? `{${k}}`);
  });
}
function tCard(lang, key, params, cardParam, cardId, cardSide) {
  return tCardMulti(lang, key, params, { [cardParam]: { id: cardId, side: cardSide } });
}
// #82's rule (actualOpsOf), copied rather than imported -- oppmove.js is
// DOM-free but has no such helper of its own, and this module must not
// reach into oppmove-ui.js (#87's file) to borrow it.
function actualOpsOf(mv) {
  for (const st of mv.steps) {
    if ((st.type === "campaign" || st.type === "lobby") && typeof st.ops === "number") return st.ops;
    if (st.type === "place" && typeof st.spent === "number") return st.spent;
  }
  return mv.card === E.JIUDING ? 4 : E.CARD[mv.card].ops;
}

export const FILTER_KEY = "zh.logFilter";
export function loadFilter() { try { return localStorage.getItem(FILTER_KEY) || "all"; } catch { return "all"; } }
export function saveFilter(f) { try { localStorage.setItem(FILTER_KEY, f); } catch {} }
export function hasChat(chat, botLine) { return (Array.isArray(chat) && chat.length > 0) || !!botLine; }

// ---------- chips: one per result, gold for a status change (#88 brief) ----------
function chipsForSteps(steps, moverSide, lang) {
  const chips = [];
  for (const st of steps || []) {
    if (st.type === "place" && Array.isArray(st.spaces)) {
      for (const [id, n] of st.spaces) chips.push({ text: t(lang, "logPanel.chipPlace", { space: spaceName(id, lang), n }), gold: false });
    } else if (st.type === "campaign" || st.type === "lobby") {
      if (st.removed) chips.push({ text: t(lang, "logPanel.chipRemove", { target: spaceName(st.target, lang), side: sideName(1 - moverSide, lang), n: st.removed }), gold: false });
      if (st.placed) chips.push({ text: t(lang, "logPanel.chipPlace", { space: spaceName(st.target, lang), n: st.placed }), gold: false });
    } else if (st.type === "reform") {
      chips.push({ text: t(lang, "logPanel.chipReform", { box: st.box }), gold: true });
    } else if (st.type === "vp") {
      const gainer = st.n >= 0 ? st.side : 1 - st.side;
      chips.push({ text: t(lang, "oppmove.tickerMandate", { side: sideName(gainer, lang), n: Math.abs(st.n) }), gold: true });
    } else if (st.type === "score") {
      chips.push({ text: t(lang, "oppmove.tickerScore", { region: regionName(st.region, lang), q: st.qin && st.qin.total, c: st.chu && st.chu.total }), gold: true });
    } else if (st.type === "tire") {
      chips.push({ text: t(lang, "logPanel.chipTire", { to: t(lang, "weariness." + st.to) }), gold: true });
    } else if (st.type === "seal") {
      chips.push({ text: t(lang, "oppmove.tickerSeal", { state: stateName(st.state, lang) }), gold: true });
    } else if (st.type === "unseal") {
      chips.push({ text: t(lang, "oppmove.tickerUnseal", { state: stateName(st.state, lang) }), gold: true });
    } else if (st.type === "mie") {
      chips.push({ text: t(lang, "oppmove.tickerMie", { state: stateName(st.state, lang) }), gold: true });
    } else if (st.type === "restore") {
      chips.push({ text: t(lang, "oppmove.tickerRestore", { state: stateName(st.state, lang) }), gold: true });
    } else if (st.type === "jiuding") {
      chips.push({ text: t(lang, "oppmove.tickerJiuding", { side: sideName(st.to, lang) }), gold: true });
    } else if (st.type === "discard" || st.type === "bog") {
      chips.push({ text: tCard(lang, "logPanel.chipDiscard", { side: sideName(st.side, lang) }, "card", st.card, st.side), gold: false });
    } else if (st.type === "opsLost") {
      chips.push({ text: t(lang, "logPanel.chipOpsLost", { side: sideName(st.side, lang), ops: st.ops }), gold: false });
    } else if (st.type === "event") {
      chips.push({ text: tCard(lang, "logPanel.chipEvent", { side: sideName(st.side, lang) }, "card", st.card, st.side), gold: true });
    } else if (st.type === "eventEnd") {
      chips.push(...eventEndChips(st, lang));
    }
  }
  return chips;
}
// #115: what an event did, from its `eventEnd` entry -- or, when it did
// nothing, that it did nothing and why. Mandate, weariness lost, reform,
// seals and discards have entries of their own (the chips above).
const signed = (d) => (d > 0 ? `+${d}` : `−${-d}`);
function eventEndChips(st, lang) {
  if (!st.effect) return [{ text: t(lang, "logPanel.chipEventNone", { why: t(lang, `logPanel.eventWhy.${st.why}`) }), gold: false }];
  const out = [];
  for (const s of st.chose || []) out.push({ text: t(lang, "logPanel.chipChose", { side: sideName(s, lang) }), gold: false });
  for (const [id, dq, dc] of st.inf || []) {
    if (dq) out.push({ text: t(lang, "logPanel.chipInf", { space: spaceName(id, lang), side: sideName(E.QIN, lang), d: signed(dq) }), gold: false });
    if (dc) out.push({ text: t(lang, "logPanel.chipInf", { space: spaceName(id, lang), side: sideName(E.CHU, lang), d: signed(dc) }), gold: false });
  }
  for (const c of (st.fx && st.fx.add) || []) out.push({ text: tCard(lang, "logPanel.chipEffectOn", {}, "card", c, E.CARD[c] ? E.CARD[c].side : null), gold: true });
  for (const c of (st.fx && st.fx.rm) || []) out.push({ text: tCard(lang, "logPanel.chipEffectOff", {}, "card", c, E.CARD[c] ? E.CARD[c].side : null), gold: true });
  (st.hands || []).forEach((d, s) => { if (d) out.push({ text: t(lang, "logPanel.chipDraw", { side: sideName(s, lang), d: signed(d) }), gold: false }); });
  if (st.recover) out.push({ text: t(lang, "logPanel.chipTire", { to: t(lang, "weariness." + st.recover) }), gold: true });
  return out;
}

// What a tapped row flashes on the map: spaces in step order (numbered), or
// the relevant stat column(s) when the move never touched a space at all.
function targetsForSteps(steps) {
  const spaces = [];
  const stats = [];
  const addStat = (s) => { if (!stats.includes(s)) stats.push(s); };
  for (const st of steps || []) {
    if (st.type === "place" && Array.isArray(st.spaces)) for (const [id] of st.spaces) spaces.push(id);
    else if ((st.type === "campaign" || st.type === "lobby") && st.target) spaces.push(st.target);
    else if (st.type === "eventEnd" && Array.isArray(st.inf)) for (const [id] of st.inf) { if (!spaces.includes(id)) spaces.push(id); }
    else if (st.type === "reform") addStat("reform");
    else if (st.type === "vp" || st.type === "score") addStat("mandate");
    else if (st.type === "tire") addStat("weariness");
    else if (st.type === "seal" || st.type === "unseal") addStat("seals");
    else if (st.type === "mie" || st.type === "restore") addStat("mie");
    else if (st.type === "jiuding") addStat("jiuding");
  }
  return { spaces, stats };
}

// ---------- rows: every string here comes from our own i18n tables, never
// from a player, so (unlike chat/bot lines below) none of it needs esc(). ----------
function chipsHtml(chips) {
  if (!chips.length) return "";
  return `<span class="logrow-chips">${chips.map((c) => `<span class="logchip${c.gold ? " gold" : ""}">${c.text}</span>`).join("")}</span>`;
}
function setupRowHtml(row, lang) {
  const sideCls = row.side === E.CHU ? "c" : "q";
  const sep = lang === "en" ? ", " : "、";
  const txt = (row.spaces || []).map(([id, n]) => `${spaceName(id, lang)} +${n}`).join(sep);
  return `<div class="logrow logrow-setup side-${sideCls}"><b class="logrow-side side-${sideCls}">${sideName(row.side, lang)}</b> ${txt}</div>`;
}
// `pair`: 說客's paired card, from the move's own `play` entry (#115).
function moveRowHtml(row, lang, pair) {
  const sideCls = row.side === E.CHU ? "c" : "q";
  const verb = lang === "en" ? "plays" : "打出";
  const use = row.use === "event" ? t(lang, "useNames.event") : `${useLabel(row.use, lang)} ${actualOpsOf(row)}`;
  const pairTxt = pair && E.CARD[pair] ? ` <span class="logrow-card">${tCard(lang, "logPanel.pairWith", { side: sideName(E.CARD[pair].side, lang) }, "card", pair, E.CARD[pair].side)}</span>` : "";
  const head = `<b class="logrow-side side-${sideCls}">${sideName(row.side, lang)}</b> ${verb} <span class="logrow-card">${cardLinkHtml(row.card, row.side, lang)}</span>${pairTxt} <span class="logrow-use">· ${use}</span>`;
  const chips = chipsForSteps(row.steps, row.side, lang);
  return (
    `<div class="logrow side-${sideCls}" data-seq="${row.seq}">` +
      `<button type="button" class="logrow-thumb no-tap-sound" data-card="${row.card}" data-side="${row.side}" aria-label="${cardName(row.card, lang)}">` +
        `<img src="art/cards/${row.card}.jpg" alt="" onerror="this.style.visibility='hidden'"></button>` +
      `<span class="logrow-body"><span class="logrow-head">${head}</span>${chipsHtml(chips)}</span>` +
    `</div>`
  );
}
function headlineRowHtml(row, lang) {
  const [qin, chu] = row.cards || [];
  let line;
  if (qin != null && chu != null) {
    line = tCardMulti(lang, "logPanel.headlineLine", { qinSide: sideName(E.QIN, lang), chuSide: sideName(E.CHU, lang) }, { qinCard: { id: qin, side: E.QIN }, chuCard: { id: chu, side: E.CHU } });
  } else if (qin != null || chu != null) {
    const side = qin != null ? E.QIN : E.CHU;
    const id = qin != null ? qin : chu;
    line = `${sideName(side, lang)} ${cardLinkHtml(id, side, lang)}`;
  } else {
    line = t(lang, "log.headlineNone");
  }
  const first = row.first != null ? ` <span class="logrow-use">${t(lang, "logPanel.headlineFirst", { first: sideName(row.first, lang) })}</span>` : "";
  const chips = chipsForSteps(row.steps, row.first != null ? row.first : E.QIN, lang);
  return `<div class="logrow logrow-headline" data-seq="${row.seq}"><span class="logrow-body"><span class="logrow-head">${line}${first}</span>${chipsHtml(chips)}</span></div>`;
}
// Anything logged outside a move (endTurn, era shuffle, turn-end scoring,
// a skipped headline phase, ...): the same quiet chip style, reusing the
// engine's own full-sentence log.* templates (fmtLog()'s own table in
// app.js) rather than a second parallel set of short strings for a case
// the brief never asked to shorten.
function otherRowHtml(row, lang) {
  const e = row.entry || {};
  const key = `log.${e.type}`;
  const P = {
    side: e.side != null ? sideName(e.side, lang) : "", turn: e.turn, era: e.era ? t(lang, "eras." + e.era) : "",
    weariness: e.weariness ? t(lang, "weariness." + e.weariness) : "", to: e.to ? t(lang, "weariness." + e.to) : "",
    region: e.region ? regionName(e.region, lang) : "", state: e.state ? stateName(e.state, lang) : "",
    card: e.card ? cardName(e.card, lang) : "", ops: e.ops, box: e.box,
  };
  // #120: this table's own templates (log.play/log.discard/log.bog/
  // log.headlineOne) can name a card too -- same tCard() splice as every
  // other card-naming row, gated on e.card so the vast majority (turn/era/
  // reform/skip, none of which carry one) is untouched.
  let text;
  try { text = e.card ? tCard(lang, key, P, "card", e.card, e.side != null ? e.side : null) : t(lang, key, P); } catch { text = ""; }
  if (text === key || !text) return "";
  return `<div class="logrow logrow-other">${text}</div>`;
}
// The room's chat / the bot's remarks arrive as ready-made "{name}: {text}"
// strings (app.js already builds them that way for the old flat list) --
// untrusted player text, so both parts go through esc().
function sayRowHtml(raw) {
  const idx = raw.indexOf(": ");
  if (idx > 0 && idx < 24) {
    return `<div class="logrow logrow-say"><b class="logrow-sayname">${esc(raw.slice(0, idx))}</b> <i class="logrow-saytext">${esc(raw.slice(idx + 2))}</i></div>`;
  }
  return `<div class="logrow logrow-say"><i class="logrow-saytext">${esc(raw)}</i></div>`;
}

// ---------- the whole panel ----------
// filter: "all" | "0" (Qin) | "1" (Chu) | "chat". Structural rows (turn/
// setup headers) always show under a side filter so the sections a match
// falls under still make sense; "chat" shows only the room chat/bot lines.
export function renderRows(log, opts) {
  const { lang, filter = "all", chat = [], botLine } = opts || {};
  const rows = groupLog(log);
  const out = [];
  // groupLog's move rows carry no pair; read it from the `play` entry itself.
  const pairOf = new Map();
  for (const e of Array.isArray(log) ? log : []) if (e && e.type === "play" && e.pair) pairOf.set(e.i, e.pair);
  if (filter !== "chat") {
    const wantSide = filter === "0" ? E.QIN : filter === "1" ? E.CHU : null;
    let round = null, sawSetupHead = false;
    for (const row of rows) {
      if (row.kind === "setup") {
        if (wantSide != null && row.side !== wantSide) continue;
        if (!sawSetupHead) { out.push(`<div class="logsec-head">${t(lang, "logPanel.setupHeader")}</div>`); sawSetupHead = true; }
        out.push(setupRowHtml(row, lang));
      } else if (row.kind === "turn") {
        out.push(`<div class="logsec-turn">${t(lang, "logPanel.turnHeader", { turn: row.turn, era: t(lang, "eras." + row.era) })}</div>`);
        round = null; sawSetupHead = false;
      } else if (row.kind === "headline") {
        out.push(headlineRowHtml(row, lang));
      } else if (row.kind === "move") {
        if (wantSide != null && row.side !== wantSide) continue;
        if (row.round != null && row.round !== round) { out.push(`<div class="logsec-round">${t(lang, "logPanel.round", { round: row.round })}</div>`); round = row.round; }
        out.push(moveRowHtml(row, lang, pairOf.get(row.seq)));
      } else if (row.kind === "other") {
        const html = otherRowHtml(row, lang);
        if (html) out.push(html);
      }
    }
  }
  if (filter === "all" || filter === "chat") {
    for (const line of chat) out.push(sayRowHtml(line));
    if (botLine) out.push(sayRowHtml(botLine));
  }
  return { html: out.join(""), rows };
}

// ---------- tap-a-row flash: its own fixed overlay, never a child of #map
// (#68's rule), styled in style.css to match #79's ring/glow (.log-ring*,
// .logstat-flash) without touching oppmove.css at all. ----------
function spaceEl(id) { return id ? document.querySelector(`.node[data-space="${id}"]`) : null; }
function statEl(name) { return document.querySelector(`[data-stat="${name}"]`); }
function rectOf(el) { return el ? el.getBoundingClientRect() : null; }
let ringsEl = null;
function ensureRings() {
  if (ringsEl) return ringsEl;
  ringsEl = document.createElement("div");
  ringsEl.id = "logRings";
  ringsEl.className = "log-rings";
  ringsEl.hidden = true;
  document.body.appendChild(ringsEl);
  return ringsEl;
}
export function clearFlash() {
  const root = ensureRings();
  root.hidden = true;
  root.innerHTML = "";
  document.querySelectorAll(".logstat-flash").forEach((el) => el.classList.remove("logstat-flash"));
}
// `row` is one of groupLog()'s own "move"/"headline" rows (never null once
// a tappable row exists); `side` picks the ring colour for a move (a
// headline has no single side, so it defaults to gold, same as the status
// glow below).
export function flashRow(row) {
  clearFlash();
  if (!row) return;
  const { spaces, stats } = targetsForSteps(row.steps);
  const sideCls = row.kind === "move" ? (row.side === E.CHU ? "c" : "q") : "gold";
  const root = ensureRings();
  let shown = false;
  spaces.forEach((id, i) => {
    const r = rectOf(spaceEl(id));
    if (!r) return;
    shown = true;
    const ring = document.createElement("div");
    ring.className = sideCls === "gold" ? "log-ring log-ring-gold" : `log-ring side-${sideCls}`;
    ring.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
    ring.innerHTML = `<span class="log-ring-badge">${i + 1}</span>`;
    root.appendChild(ring);
  });
  if (!shown) {
    for (const name of stats) { const el = statEl(name); if (el) { el.classList.add("logstat-flash"); shown = true; } }
  }
  root.hidden = !shown;
}
