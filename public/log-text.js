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
const spaceName = (id, lang) => (id && E.SPACE[id] ? (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh) : "");
const sep = (lang) => (lang === "en" ? ", " : "、");
const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
// #137 (orchestrator, owner: the sample said 09-28 while the owner's local
// date was 09-27 Pacific): `exportedAt` is an ISO UTC instant (the
// contract's own wording); the header/filename want the CALENDAR date the
// player is actually looking at it on, so this reads it back with the
// runtime's own local getFullYear/getMonth/getDate -- the browser's tz in
// the browser, the machine's tz in Node (both "local", never UTC), never a
// plain string slice of the ISO text (which is UTC by construction).
function localDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || "").slice(0, 10);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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

// ---------- #137 (orchestrator, owner's read-through): three fixes to lines
// that only make sense as a chip pill next to its move's colour/side badge --
// none of this touches log-view.js (the panel keeps its own short chips;
// these three are enrichments this file alone needs once the chips are
// flattened to plain text with no visual context left to lean on). ----------

// 1) 遊說's dice rolls: the panel's own chip is deliberately short ("第{k}
// 次:{loserOrTie}", logPanel.chipRealign) -- fine net to a coloured row, not
// enough on paper. The raw `realign` log entry (public/shared/engine.js's
// realignAttempt) carries `roll`/`mod` indexed by [QIN, CHU] regardless of
// who is lobbying, so the actual math is rebuilt here and slotted in in the
// exact spot bodyLines() already put the terse line, matched by ORDER (the
// same order groupLog/chipsForSteps already visited them in), not by text
// pattern -- text patterns differ subtly between an in-move chip and an
// orphaned line's `log.realign` template, but the queue order is exact.
function realignDetailText(e, lang) {
  const a = e.side, b = E.other(a);
  const totalA = e.roll[a] + e.mod[a], totalB = e.roll[b] + e.mod[b];
  const sumA = `${e.roll[a]}+${e.mod[a]}=${totalA}`, sumB = `${e.roll[b]}+${e.mod[b]}=${totalB}`;
  const result = e.lose == null ? t(lang, "logText.realignTie") : `${sideName(e.lose, lang)} −${e.n}`;
  return t(lang, "logText.realignRoll", { k: e.k, sideA: sideName(a, lang), sumA, sideB: sideName(b, lang), sumB, result });
}
function enrichRealignLines(lines, log, lang) {
  const queue = (log || []).filter((e) => e.type === "realign");
  if (!queue.length) return lines;
  const re = lang === "en" ? /^(\s*)Attempt\s+\d+:/ : /^(\s*)第\s*\d+\s*次[:：]/;
  let qi = 0;
  return lines.map((line) => {
    if (qi >= queue.length) return line;
    const m = re.exec(line);
    if (!m) return line;
    return m[1] + realignDetailText(queue[qi++], lang);
  });
}

// 2) A bare "{side}的事件:{card}" chip used to sit next to its own row's
// colour badge; on paper it reads as a stray header. Fold the immediately-
// following "{side}選擇" chip (chipChose) in as a parenthetical, and fold
// every other same-indent chip up to the next boundary (a blank line, a new
// event marker, or a differently-indented line -- i.e. the next move/round/
// turn) into the same line, comma/頓號-joined -- one line per event instead
// of a scattered run only a coloured chip strip could have explained.
function foldEventChips(lines, lang) {
  const eventRe = lang === "en" ? /^(.+)'s event: (.+)$/ : /^(.+)的事件:(.+)$/;
  const choseRe = lang === "en" ? /^chosen by (.+)$/ : /^(.+)選擇$/;
  const boundaryRe = lang === "en" ? /^Attempt\s+\d+:/ : /^第\s*\d+\s*次[:：]/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = /^(\s*)/.exec(line)[1];
    const body = line.slice(indent.length);
    if (!eventRe.test(body)) { out.push(line); continue; }
    let head = body, chooser = null;
    const parts = [];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      const indent2 = /^(\s*)/.exec(l)[1];
      const body2 = l.slice(indent2.length);
      if (indent2 !== indent || !body2 || eventRe.test(body2) || boundaryRe.test(body2)) break;
      const cm = choseRe.exec(body2);
      if (cm) { chooser = cm[1]; j++; continue; }
      parts.push(body2);
      j++;
    }
    if (chooser) head = lang === "en" ? `${head} (chosen by ${chooser})` : `${head}(${chooser}選擇)`;
    if (parts.length) head = `${head}:${parts.join(sep(lang))}`;
    out.push(indent + head);
    i = j - 1;
  }
  return out;
}

// 3) "{target}:己方失去{n}" (logPanel.chipLobbyLost, the dice-遊說's own
// loss to the mover's own side) reads fine beside a coloured row that
// already says whose move it is; alone on paper "己方" ("its own side") has
// nothing left to point at. Substituted with the mover's actual side name,
// tracked from the last-seen move's own head line ("{side} 打出 …" /
// "{side} plays …", moveRowHtml's own wording).
function fixOwnSideLines(lines, lang) {
  const moveHeadRe = lang === "en" ? /^(Qin|Chu) plays / : /^(秦|楚) 打出 /;
  const lostRe = lang === "en" ? /^(.+): loses (\d+) of its own$/ : /^(.+):己方失去\s*(\d+)$/;
  let side = null;
  return lines.map((line) => {
    const indent = /^(\s*)/.exec(line)[1];
    const body = line.slice(indent.length);
    const mh = moveHeadRe.exec(body);
    if (mh) { side = mh[1] === "Qin" || mh[1] === "秦" ? E.QIN : E.CHU; return line; }
    const m = lostRe.exec(body);
    if (!m || side == null) return line;
    const sideWord = sideName(side, lang);
    return indent + (lang === "en" ? `${m[1]}: ${sideWord} loses ${m[2]}` : `${m[1]}:${sideWord}失去${m[2]}`);
  });
}

// 4) A bare "{loser}敗" (logPanel.chipOver) after the last move of the turn
// is #127's own "this move/headline ended the game" marker -- true even
// when the actual reason has nothing to do with that move (a turn-end
// homeFall check runs after every move/score of the turn, not attached to
// any one of them; chipsForSteps has no branch for its own `capitalCheck`
// log entries, which is why they never reached the panel's chips at all,
// swallowed into whichever move happened to be logged last). Only touches
// it when the game's own recorded reason is "homeFall" -- every other
// reason's chipOver already sits right next to the card/event that caused
// it, and needs no help.
function insertHomeFallDetail(lines, json) {
  if (!json.result || json.result.reason !== "homeFall") return lines;
  const lang = json.lang;
  const loser = E.other(json.result.winner);
  // Only the LOSER's own fallen capital explains this result -- if the
  // other side's capital also fell the same turn (both at once, decided by
  // the Mandate tie-break), that entry isn't why this loss reads the way it
  // does, so it's left out rather than reported alongside a mismatched line.
  const fallen = (json.log || []).filter((e) => e.type === "capitalCheck" && e.result === "fallen" && e.whose === loser);
  if (!fallen.length) return lines;
  const loserWord = lang === "en" ? `${sideName(loser, lang)} loses` : `${sideName(loser, lang)}敗`;
  let idx = -1;
  for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].trim() === loserWord) { idx = i; break; } }
  if (idx === -1) return lines; // defensive: couldn't find the exact chip text, leave the lines untouched rather than guess
  const indent = /^(\s*)/.exec(lines[idx])[1];
  // homeFallLine already ends in "…→ {side}敗"/"…loses" -- REPLACE the bare
  // chip line with it (not insert-before-and-keep), or the loss would be
  // named twice in a row.
  const out = lines.slice();
  out.splice(idx, 1, ...fallen.map((e) => indent + t(lang, "logText.homeFallLine", { capital: spaceName(e.capital, lang), side: sideName(e.whose, lang) })));
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
  const date = localDate(json.exportedAt);
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
  let body = bodyLines(json.log, json.lang);
  body = enrichRealignLines(body, json.log, json.lang);
  // fixOwnSideLines needs each "己方失去N" chip on its own whole line (it
  // anchors the regex to the full line) -- run it before foldEventChips
  // could ever fuse such a chip into a longer joined line.
  body = fixOwnSideLines(body, json.lang);
  body = foldEventChips(body, json.lang);
  body = insertHomeFallDetail(body, json);
  const lines = [...headerLines(json), "", ...body, ...finalLines(json)];
  // Collapse any run of blank lines the header/section joins above may have
  // produced (e.g. a game that ends on the very first logged row) down to one.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- file names: 縱橫_<date>_<result or 第N回合>.txt/.json ----------
const slug = (s, lang) => (lang === "en" ? String(s).replace(/[^A-Za-z0-9]+/g, "") : String(s));
export function buildFilename(json, ext) {
  const { lang } = json;
  const date = localDate(json.exportedAt);
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
