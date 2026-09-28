// #137: JSON export (the be/137-export contract) -> the .txt layout in the
// approved mockup (C:/Users/sheep/code/_orch_keep/logdl_ui/D_textfile.png).
// The turn-by-turn body is built from log-view.js's own renderRows() -- the
// SAME function the log panel draws with -- so the file and the panel can
// never disagree about what a move/headline/chip says. Only the header, the
// section dividers and the post-game "終局公開" block are this file's own
// copy (public/i18n/*.js's `logText`), because the panel has no equivalent
// of a document header or a full-hand reveal.
//
// DOM-free (no `document`, no import of app.js) so it can run in a Node
// script too (the mockup's own out3/logtext.mjs did this exact thing by
// hand; this file is the real, wired-up version of it), same rule
// log-view.js and oppmove.js already follow.
import * as E from "./shared/engine.js";
import { renderRows } from "./log-view.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";

const I18N = { en, "zh-Hant": zh };
function t(lang, key, p = {}) {
  const raw = key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en);
  return String(raw ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));
}
const sideName = (s, lang) => t(lang, `sides.${E.SIDES[s]}`);
const cardName = (id, lang) => (id === E.JIUDING ? (lang === "en" ? "The Nine Cauldrons" : "九鼎") : lang === "en" ? E.CARD[id].en : E.CARD[id].zh);
const sep = (lang) => (lang === "en" ? ", " : "、");
const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

// ---------- turn-by-turn body, from the panel's own HTML ----------
// renderRows() returns one flat string of sibling `<div class="log...">`
// blocks (no nested <div>s inside any of them -- log-view.js keeps every
// row's markup to spans/buttons/b, checked by hand against its source).
// Marking each opening <div> by its class (before stripping tags) is what
// lets a header/round/over row be told apart from a plain move row once
// everything else has been turned into plain text below.
function markDivs(html) {
  return html
    .replace(/<div class="([^"]*)"[^>]*>/g, (_, cls) => {
      if (/\blogsec-head\b/.test(cls)) return "\n\u0001H";
      if (/\blogsec-turn\b/.test(cls)) return "\n\u0001T";
      if (/\blogsec-round\b/.test(cls)) return "\n\u0001R";
      if (/\blogrow-over\b/.test(cls)) return "\n\u0001O";
      if (/\blogrow-say\b/.test(cls)) return "\n\u0001S"; // never emitted (no chat is passed in), kept for safety
      return "\n";
    })
    .replace(/<\/div>/g, "");
}
function bodyLines(log, lang) {
  const { html } = renderRows(log, { lang, filter: "all" }); // no chat/botLine: the export's own `log` never carries chat
  let marked = markDivs(html);
  // One chip per line, indented -- chipsHtml() (log-view.js) joins chip
  // spans with no separator of its own (it relies on CSS for the visual
  // gap), so plain tag-stripping alone would run adjacent chips together.
  marked = marked.replace(/<span class="logchip[^"]*">/g, "\n    ");
  marked = marked.replace(/<button[^>]*class="[^"]*logrow-thumb[^"]*"[^>]*>[\s\S]*?<\/button>/g, "");
  marked = marked.replace(/<br\s*\/?>/g, "\n");
  marked = decodeEntities(marked.replace(/<[^>]+>/g, ""));
  const out = [];
  for (const raw of marked.split("\n")) {
    const indented = raw.startsWith("    ");
    const text = raw.trim();
    if (!text) continue;
    if (text[0] === "\u0001") {
      const mark = text[1], rest = text.slice(2).trim();
      if (mark === "S") continue;
      if (mark === "H" || mark === "T") { out.push(""); out.push(`── ${rest} ──`); }
      else if (mark === "O") { out.push(""); out.push(rest); }
      else out.push(rest); // "R" (行動 N)
      continue;
    }
    out.push(indented ? `    ${text}` : text);
  }
  return out;
}

// ---------- header ----------
const SEALS_ZH = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const sealsWord = (n, lang) => (lang === "en" ? String(n) : SEALS_ZH[n] || String(n));
function rulesWords(game, lang) {
  const o = game.options || {};
  const parts = [o.lobby === "realign-own" ? t(lang, "logText.ruleLobbyDice") : t(lang, "logText.ruleLobbyLocal")];
  if (o.homeFall && o.homeFall !== "none") parts.push(t(lang, "logText.ruleHomeFall"));
  if (o.seals) parts.push(t(lang, "logText.ruleSeals", { n: sealsWord(o.seals, lang) }));
  const em = o.emperor;
  if (em === "win") parts.push(t(lang, "logText.ruleEmperorWin"));
  else if (em === "win-late") parts.push(t(lang, "logText.ruleEmperorWinLate", { n: 5 }));
  else if (em === "win-lead") parts.push(t(lang, "logText.ruleEmperorWinLead"));
  else parts.push(t(lang, "logText.ruleEmperorVp"));
  return parts.join(" · ");
}
function opponentLine(json) {
  const { lang, game } = json;
  const names = game.names || ["", ""];
  const who = game.viewer != null ? t(lang, "logText.you", { side: sideName(game.viewer, lang) }) : t(lang, "logText.spectating");
  if (game.mode === "solo") {
    const level = t(lang, `setup.${game.level}`) || game.level || "";
    return `${t(lang, "logText.vsComputer", { level })} · ${who}`;
  }
  if (game.viewer != null) return `${t(lang, "logText.vsRoom", { name: names[1 - game.viewer] || "" })} · ${who}`;
  return `${t(lang, "logText.vsRoomBoth", { a: names[0] || "", b: names[1] || "" })} · ${who}`;
}
function resultLine(json) {
  const { lang, result } = json;
  if (!result) return null;
  // `result.mandate`'s sign is QIN-positive/CHU-negative (the engine's own
  // convention, e.g. app.js's mandateText()) -- mandateSide already reads
  // that sign to say WHICH side it favours, so the number after it is
  // always a plain "+N" (never "+-N" nor a bare "N"), same as mandateText().
  const mandateSide = result.mandate >= 0 ? sideName(E.QIN, lang) : sideName(E.CHU, lang);
  return t(lang, "logText.resultLine", {
    winner: sideName(result.winner, lang), reason: t(lang, `logText.reasonShort.${result.reason}`),
    turn: result.turn, mandateSide, mandate: `+${Math.abs(result.mandate)}`,
  });
}
function headerLines(json) {
  const { lang } = json;
  const date = String(json.exportedAt || "").slice(0, 10);
  const lines = [t(lang, "logText.title"), `${date} ${opponentLine(json)}`, t(lang, "logText.rules", { rules: rulesWords(json.game, lang) })];
  const rl = resultLine(json);
  lines.push(rl ? t(lang, "logText.result", { result: rl }) : t(lang, "logText.ongoing", { turn: lastTurn(json.log) }));
  return lines;
}
function lastTurn(log) {
  let max = 0;
  for (const e of log || []) if (typeof e.t === "number" && e.t > max) max = e.t;
  return max;
}

// ---------- 終局公開 (only once `final` is present) ----------
function finalLines(json) {
  if (!json.final) return [];
  const { lang, final } = json;
  const out = ["", `── ${t(lang, "logText.finalHeader")} ──`];
  for (let side = 0; side < 2; side++) {
    const cards = (final.hands && final.hands[side] || []).map((id) => cardName(id, lang)).join(sep(lang));
    out.push(t(lang, "logText.finalHands", { side: sideName(side, lang), cards: cards || "—" }));
  }
  const draw = (final.draw || []).map((id) => cardName(id, lang)).join(sep(lang));
  out.push(t(lang, "logText.finalDraw", { cards: draw || "—" }));
  // #137 (orchestrator, be/137-replay): `final.actions` (every applied
  // action, in order) is what makes an exact replay possible from this
  // file's own JSON sibling -- the .txt never prints the actions themselves
  // (that's what the .json is for), just says so, and only once they're
  // actually there to replay from.
  if (Array.isArray(final.actions) && final.actions.length) out.push(t(lang, "logText.replayable"));
  return out;
}

// The full .txt file, as one string. `json` is exactly what E.exportGame()
// (or this branch's stub, see log-download.js) builds from the contract in
// issue #137.
export function buildLogText(json) {
  const lines = [...headerLines(json), "", ...bodyLines(json.log, json.lang), ...finalLines(json)];
  // Collapse any run of blank lines the header/section joins above may have
  // produced (e.g. a game that ends on the very first logged row) down to one.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- file names: 縱橫_<date>_<result or 第N回合>.txt/.json ----------
const slug = (s, lang) => (lang === "en" ? String(s).replace(/[^A-Za-z0-9]+/g, "") : String(s));
export function buildFilename(json, ext) {
  const { lang } = json;
  const date = String(json.exportedAt || "").slice(0, 10);
  const prefix = lang === "en" ? "Zongheng" : "縱橫";
  let tag;
  if (json.result) {
    const winner = slug(sideName(json.result.winner, lang), lang);
    const reason = slug(t(lang, `logText.reasonShort.${json.result.reason}`), lang);
    tag = lang === "en" ? `${winner}Wins-${reason}` : `${winner}勝-${reason}`;
  } else {
    const turn = lastTurn(json.log);
    tag = lang === "en" ? `Turn${turn}` : `第${turn}回合`;
  }
  return `${prefix}_${date}_${tag}.${ext}`;
}
