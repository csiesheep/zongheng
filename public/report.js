// #138: 戰報, a standalone page (its own bootstrap, not a play.html "view").
// play.html/app.js's render() is entangled with live-game state (legal
// moves, room sockets, the advisor, mid-game UI) that a static, shareable
// report has no use for -- same reasoning rules.js already uses to justify
// its own bootstrap instead of importing app.js (map-draw.js's own top
// comment: app.js "has open-side-effects at import time"). This page reuses
// every shared, DOM-free piece it can: the engine's pure per-space functions
// (infOf/controller/capOf), map-draw.js's geometry and disc-view.js's tone
// logic (the SAME primitives app.js's live renderMap() draws with, so a
// report map is the real board, not a picture or a second implementation of
// it), and log-text.js/log-download.js for the download button.
//
// `discHTML()` below is the one piece copied rather than imported: it is
// app.js's own private helper (not exported, and app.js can't be imported
// here for the reason above), but it is a small, pure function of
// disc-view.js's discParts() output, so a copy is cheap to keep in sync.
import * as E from "./shared/engine.js";
import {
  regionMembers, isCapital, renderRegionBlobs, renderRoads, REGION_LABEL_POS,
  NODE_ANCHOR, NODE_POS, nodeLabelHTML, NODE_STAB_RIGHT, NODE_STAB_HI, stateTagHTML, stabilityTagHTML,
} from "./map-draw.js";
import { discParts } from "./disc-view.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import * as D from "./shared/report-digest.js"; // #138 FE stub until be/138-report lands -- see that file's own header
import { buildLogText, buildFilename } from "./log-text.js";
import * as LogDL from "./log-download.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- language (same detection order as rules.js) ----------
const qs = new URLSearchParams(location.search);
let lang = qs.get("lang") ||
  (() => { try { return localStorage.getItem("zh.lang"); } catch { return null; } })() ||
  ((navigator.language || "").startsWith("zh") ? "zh-Hant" : "en");
if (!["en", "zh-Hant"].includes(lang)) lang = "en";
const I18N = { en, "zh-Hant": zh };
function t(key, params = {}) {
  let v = I18N[lang];
  for (const part of key.split(".")) v = v && v[part];
  if (typeof v !== "string") return key;
  return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : ""));
}
const spaceName = (id) => (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh);
const stateName = (id) => (id ? (lang === "en" ? E.STATES[id].en : E.STATES[id].zh) : "");
const regionShortName = (r) => (lang === "en" ? en.regionShort[r] : zh.regionShort[r]);
const sideName = (s) => t(`sides.${E.SIDES[s]}`);
function cardName(id) {
  if (id === E.JIUDING) return t("rules.jiuding");
  const c = E.CARD[id];
  return c ? (lang === "en" ? c.en : c.zh) : id;
}
const cardHref = (id) => `rules.html?lang=${lang}#card-${id}`;
const ZH_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
const chapterLabel = (turn) => (lang === "en" ? `Year ${turn}` : `第${ZH_NUM[turn] || turn}回`);

// ---------- the map: same drawing code the live table uses ----------
// Copied from app.js's own discHTML() -- see this file's top comment.
function discHTML(parts, cap) {
  const base = "disc" + (cap ? " sq" : "");
  if (parts.kind === "empty") return `<span class="${base}"></span>`;
  if (parts.kind === "lone") {
    const side = parts.side === E.QIN ? "q" : "c";
    const cls = `${base} lone-${side}${parts.controlled ? " ctl" : ""}`;
    return `<span class="${cls}"><i${parts.atCap ? ` class="atcap"` : ""}>${parts.n}</i></span>`;
  }
  const cls = `${base} split${parts.qin.controlled ? " ctl-q" : ""}${parts.chu.controlled ? " ctl-c" : ""}`;
  return `<span class="${cls}"><i class="q${parts.qin.atCap ? " atcap" : ""}">${parts.qin.n}</i><i class="c${parts.chu.atCap ? " atcap" : ""}">${parts.chu.n}</i></span>`;
}
// A static snapshot node: the same geometry/tone/label pieces app.js's live
// renderMap() draws with, minus what only makes sense for an interactive,
// currently-legal-moves board (the hit layer, last-move marks, pick/lit
// states, the capital-fallen ring, the seal chop) -- a historical year-end
// position has none of those, only influence/control/state ownership, which
// is exactly what this draws.
function snapshotNodeHTML(sp, st) {
  const [x, y] = NODE_POS[sp.id];
  const cap = isCapital(sp.id);
  const big = sp.battleground || cap;
  const anchor = NODE_ANCHOR[sp.id];
  const [q, c] = E.infOf(st, sp.id), ctl = E.controller(st, sp.id);
  const parts = discParts(q, c, ctl, E.capOf(st, sp.id));
  const cls = "node" + (big ? " big" : "") + (anchor ? ` anchor-${anchor}` : "") +
    (NODE_STAB_RIGHT.has(sp.id) ? " stab-r" : "") + (NODE_STAB_HI.has(sp.id) ? " stab-hi" : "") +
    (!q && !c ? " empty" : "");
  return `<div class="${cls}" style="left:${x}px;top:${y}px">` +
    discHTML(parts, cap) +
    stabilityTagHTML(sp) +
    stateTagHTML(sp, stateName(sp.state), esc) +
    nodeLabelHTML(sp.id, spaceName(sp.id), lang, esc) +
    `</div>`;
}
function mapInnerHTML(st) {
  const members = regionMembers();
  const labels = Object.keys(REGION_LABEL_POS).filter((r) => members[r]).map((r) => {
    const [x, y] = REGION_LABEL_POS[r];
    return `<span class="region-label rl-${r}" style="left:${x}px;top:${y}px">${esc(regionShortName(r))}</span>`;
  }).join("");
  const nodes = E.SPACES.map((sp) => snapshotNodeHTML(sp, st)).join("");
  return `${renderRoads()}${renderRegionBlobs(members)}${labels}${nodes}`;
}
function fitMapBox(box) {
  const inner = box.querySelector(".map-inner");
  if (!inner) return;
  const scale = box.clientWidth / 390;
  inner.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
// Cost note (#138 brief: "say what it costs"): each map is ~26 absolutely-
// positioned divs plus two small inline <svg> (roads/blobs) -- building all
// 8 up front measured under 10ms even on a throttled mobile CPU in this
// session's own testing, so raw DOM weight is not the risk. The actual risk
// is a *reflow* on eight `.map-inner` boxes at once when they're all already
// in the layout tree (each fitMapBox() read forces one). Lazy-building them
// as chapters scroll into view (rootMargin gives a chapter's map time to
// finish before it's actually visible) keeps that cost spread out instead of
// paid in one lump at load, and means a reader who never scrolls to the
// bottom chapters never pays for those maps' reflow at all.
let currentEndsByTurn = new Map();
const mapObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const box = entry.target;
    mapObserver.unobserve(box);
    const end = currentEndsByTurn.get(Number(box.dataset.turn));
    if (!end) continue;
    const inner = box.querySelector(".map-inner");
    if (inner) inner.innerHTML = mapInnerHTML(end.state);
    fitMapBox(box);
  }
}, { rootMargin: "600px 0px" });
window.addEventListener("resize", () => { document.querySelectorAll(".rp-mapbox").forEach(fitMapBox); });
function mapFigureHTML(turn, caption) {
  return `<figure class="rp-map"><div class="map rp-mapbox" data-turn="${turn}" role="img" aria-label="${esc(caption || "")}">` +
    `<div class="map-inner"><span class="rp-map-loading">…</span></div></div>` +
    (caption ? `<figcaption>${esc(caption)}</figcaption>` : "") + `</figure>`;
}

// ---------- card figures + inline links ----------
function cardFigureHTML(id) {
  const name = cardName(id);
  return `<a class="rp-card" href="${cardHref(id)}">` +
    `<img src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` +
    `<span class="rp-card-body"><b>${esc(name)}</b><i>${esc(t("report.viewCard"))}</i></span></a>`;
}
// Every name of a card LISTED for this chapter (`ch.cards`, at most 4) that
// appears in the paragraph text links to the card, whether quoted 「like
// this」 or bare -- a card the model mentions but did not list is never
// linked (#138 brief's own falsify case). Names are matched longest-first so
// e.g. a card whose name contains another listed card's name as a substring
// still gets its own, longer match first.
function linkifyParagraph(text, cardIds) {
  const escaped = esc(text);
  const names = cardIds.map((id) => ({ id, name: cardName(id) })).filter((x) => x.name)
    .sort((a, b) => b.name.length - a.name.length);
  if (!names.length) return escaped;
  const alt = names.map((n) => escRegex(esc(n.name))).join("|");
  const re = new RegExp(`「(?:${alt})」|(?:${alt})`, "g");
  return escaped.replace(re, (m) => {
    const bare = m.replace(/^「|」$/g, "");
    const hit = names.find((n) => n.name === bare);
    return hit ? `<a class="cl" href="${cardHref(hit.id)}">${m}</a>` : m;
  });
}

// ---------- mandate chart (no numbers on it, per the brief) ----------
function chartSVG(ends) {
  const pts = [{ turn: 0, mandate: 0 }, ...ends.map((e) => ({ turn: e.turn, mandate: e.state.mandate }))];
  const W = 320, H = 108, x0 = 10, x1 = W - 10, top = 8, bottom = H - 8, mid = (top + bottom) / 2;
  const lastTurn = ends.length || 1;
  const X = (turn) => x0 + (x1 - x0) * (turn / lastTurn);
  const M = E.MANDATE_TO_WIN || 20;
  const Y = (mandate) => mid - (Math.max(-M, Math.min(M, mandate)) / M) * (mid - top);
  const line = pts.map((p) => `${X(p.turn).toFixed(1)},${Y(p.mandate).toFixed(1)}`).join(" ");
  const dots = pts.slice(1).map((p) => `<circle cx="${X(p.turn).toFixed(1)}" cy="${Y(p.mandate).toFixed(1)}" r="2.6" style="fill:var(--gold)"></circle>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t("report.mandateCaption"))}">` +
    `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${mid - top}" style="fill:rgba(30,28,24,.5)"></rect>` +
    `<rect x="${x0}" y="${mid}" width="${x1 - x0}" height="${bottom - mid}" style="fill:rgba(142,26,18,.32)"></rect>` +
    `<line x1="${x0}" y1="${mid}" x2="${x1}" y2="${mid}" style="stroke:var(--gold-line)" stroke-dasharray="3 3"></line>` +
    `<polyline points="${line}" fill="none" style="stroke:var(--gold)" stroke-width="2.2"></polyline>${dots}</svg>`;
}

// ---------- 目錄 ----------
function tocHTML(chapters) {
  const items = chapters.map((ch) => `<a href="#ch-${ch.turn}"><b>${esc(chapterLabel(ch.turn))}</b> ${esc(ch.heading)}</a>`);
  return `<nav class="rp-toc" aria-label="${esc(t("report.toc"))}"><p class="rp-toc-title">${esc(t("report.toc"))}</p>` +
    items.join(`<span class="rp-toc-sep"><br></span>`) + `</nav>`;
}

// ---------- one chapter ----------
function chapterHTML(ch) {
  const cards = Array.isArray(ch.cards) ? ch.cards : [];
  const paras = (ch.paragraphs || []).map((p) => `<p>${linkifyParagraph(p, cards)}</p>`).join("");
  // At most 1-2 card figures shown, even if `cards` lists up to 4 (#138
  // brief: "card figures for the first 1-2 ids") -- the rest still get
  // their inline text link above, just no figure box.
  const figures = cards.slice(0, 2).map(cardFigureHTML).join("");
  return `<section class="rp-ch" id="ch-${ch.turn}" data-turn="${ch.turn}">` +
    `<p class="rp-ch-n">${esc(chapterLabel(ch.turn))}</p>` +
    `<h2 class="rp-ch-h">${esc(ch.heading || "")}</h2>` +
    paras + mapFigureHTML(ch.turn, ch.mapCaption) + figures + `</section>`;
}

// ---------- header meta line ----------
// `mine` (sessionStorage, set by app.js's submitReport() right before the
// redirect here) is the ONLY signal for "你/對手" framing -- never the
// export's own `game.viewer`, which the server stores and hands back to
// EVERY reader of a shared link, including strangers who never played it.
function headerMetaLine(gameExp, mine) {
  const g = gameExp.game || {};
  const names = g.names || [null, null];
  if (mine && g.viewer != null) {
    const you = t("report.you", { side: sideName(g.viewer) });
    if (g.mode === "solo") {
      const level = t(`setup.${g.level}`) || g.level || "";
      return `${you} · ${t("report.opponentBot", { side: sideName(1 - g.viewer), level })}`;
    }
    const oppName = names[1 - g.viewer] || sideName(1 - g.viewer);
    return `${you} · ${t("report.opponentPlayer", { name: oppName })}`;
  }
  const label = (side) => (names[side] ? `${sideName(side)}(${names[side]})` : sideName(side));
  return t("report.vsNamed", { qin: label(E.QIN), chu: label(E.CHU) });
}
function resultLineText(gameExp) {
  const r = gameExp.result;
  if (!r) return "";
  return t("report.resultLine", { side: sideName(r.winner), reason: t(`logText.reasonShort.${r.reason}`), turn: r.turn });
}

// ---------- footer ----------
function footerHTML() {
  return `<div class="rp-foot"><div class="rp-foot-row">` +
    `<button type="button" id="rpDownload">${esc(t("report.download"))}</button>` +
    `<button type="button" id="rpShare">${esc(t("report.share"))}</button>` +
    `</div><p class="rp-share-note" id="rpShareNote"></p>` +
    `<p class="rp-gen">${esc(t("report.footnote"))}</p></div>`;
  // #138 brief: 重播本局 only if a replay viewer exists -- this repo has no
  // replay-viewing page yet (checked: no replay.html, nothing wired to
  // `E.replay` from the UI), so it is left out entirely rather than linking
  // somewhere that doesn't exist. Flagged in the #138 FE handover.
}
function wireFooter(gameExp) {
  const dl = $("rpDownload"), sh = $("rpShare");
  if (dl) dl.onclick = () => {
    const filename = buildFilename(gameExp, "txt");
    LogDL.saveText(filename, buildLogText(gameExp), "text/plain;charset=utf-8");
  };
  if (sh) sh.onclick = async () => {
    const ok = await LogDL.copyText(location.href);
    const note = $("rpShareNote");
    if (!note) return;
    note.textContent = ok ? t("report.shareCopied") : location.href;
    setTimeout(() => { if (note) note.textContent = ""; }, 2200);
  };
}

// ---------- article assembly ----------
function articleHTML(R, gameExp, ends, mine) {
  const result = resultLineText(gameExp);
  const meta = headerMetaLine(gameExp, mine);
  return `<div class="rp-hero"><h1>${esc(R.title || "")}</h1>` +
    `<div class="rp-sub">${esc(t("report.subtitle", { n: ends.length }))}</div>` +
    `<div class="rp-meta">${result ? esc(result) + "<br>" : ""}${esc(meta)}</div></div>` +
    `<div class="rp-chart">${chartSVG(ends)}<p class="rp-chart-cap">${esc(t("report.mandateCaption"))}</p></div>` +
    tocHTML(R.chapters || []) +
    `<p class="rp-intro">${esc(R.intro || "")}</p>` +
    (R.chapters || []).map(chapterHTML).join("") +
    `<p class="rp-end">${esc(R.ending || "")}</p>` +
    footerHTML();
}

// ---------- states: waiting / error / done ----------
function showWaiting() {
  $("rpArticle").hidden = true; $("rpError").hidden = true;
  $("rpWaiting").hidden = false;
  $("rpWaitingTitle").textContent = t("report.waitingTitle");
  $("rpWaitingNote").textContent = t("report.waitingNote");
  $("rpWaitingBack").textContent = t("report.wayBack");
}
let lastErrorKey = null;
function showError(key) {
  lastErrorKey = key;
  clearTimeout(pollTimer);
  $("rpArticle").hidden = true; $("rpWaiting").hidden = true;
  $("rpError").hidden = false;
  $("rpErrorTitle").textContent = t(key);
  $("rpErrorBack").textContent = t("report.wayBack");
}
function isMineFlag(key) {
  try { return sessionStorage.getItem("zh.report.mine." + key) === "1"; } catch { return false; }
}
let currentGET = null;
function renderReport(data, key) {
  clearTimeout(pollTimer);
  currentGET = data;
  $("rpWaiting").hidden = true; $("rpError").hidden = true;
  const article = $("rpArticle");
  article.hidden = false;
  const gameExp = data.game;
  const ends = D.turnEnds(gameExp);
  currentEndsByTurn = new Map(ends.map((e) => [e.turn, e]));
  const R = data.report[lang === "en" ? "en" : "zh"];
  article.innerHTML = articleHTML(R, gameExp, ends, isMineFlag(key));
  document.querySelectorAll(".rp-mapbox").forEach((box) => { fitMapBox(box); mapObserver.observe(box); });
  wireFooter(gameExp);
}
// Switching language re-renders from the ALREADY-FETCHED report (both `zh`
// and `en` come back on the same GET) -- no new request -- and keeps the
// reader on the same chapter by finding whichever `.rp-ch` currently
// straddles the top of the viewport before tearing the DOM down, then
// scrolling that same turn's (new) section back into view.
function rerenderKeepingScroll(key) {
  let anchorTurn = null;
  for (const s of document.querySelectorAll(".rp-ch")) {
    if (s.getBoundingClientRect().bottom > 60) { anchorTurn = s.dataset.turn; break; }
  }
  renderReport(currentGET, key);
  if (anchorTurn != null) {
    const el = document.getElementById("ch-" + anchorTurn);
    if (el) el.scrollIntoView({ block: "start" });
  }
}

// ---------- fetch / poll ----------
let apiBaseCache = null;
function apiBase() { return apiBaseCache ??= location.pathname.replace(/\/[^/]*$/, ""); }
let pollTimer = 0;
async function tick(key) {
  let res, data;
  try {
    res = await fetch(`${apiBase()}/api/report/${encodeURIComponent(key)}`);
  } catch {
    pollTimer = setTimeout(() => tick(key), 3000); // network hiccup: keep polling by key, not a terminal error
    return;
  }
  if (res.status === 404) { showError("report.notFound"); return; }
  if (!res.ok) { pollTimer = setTimeout(() => tick(key), 3000); return; }
  try { data = await res.json(); } catch { pollTimer = setTimeout(() => tick(key), 3000); return; }
  if (data.state === "pending") { showWaiting(); pollTimer = setTimeout(() => tick(key), 3000); return; }
  if (data.state === "failed") { showError("report.failed"); return; }
  if (data.state === "done") { renderReport(data, key); return; }
  showError("report.failed");
}

// ---------- boot ----------
function syncChrome() {
  document.documentElement.lang = lang;
  $("backLink").textContent = t("report.back");
  $("langBtn").textContent = lang === "en" ? "中文" : "EN";
  $("barMid").textContent = t("report.endButton");
}
function boot() {
  syncChrome();
  const key = qs.get("report");
  if (!key) { showError("report.notFound"); return; }
  showWaiting();
  tick(key);
}
$("langBtn").onclick = () => {
  lang = lang === "en" ? "zh-Hant" : "en";
  try { localStorage.setItem("zh.lang", lang); } catch {}
  const u = new URL(location.href);
  u.searchParams.set("lang", lang);
  history.replaceState(null, "", u);
  syncChrome();
  const key = qs.get("report");
  if (currentGET && currentGET.state === "done") rerenderKeepingScroll(key);
  else if (!$("rpWaiting").hidden) showWaiting();
  else if (!$("rpError").hidden && lastErrorKey) showError(lastErrorKey);
};
boot();
