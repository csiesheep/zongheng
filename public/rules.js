// The rules page, built from the same data the engine plays by, so the card
// table can never drift from the deck. Prose is plain on purpose.
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let lang = (new URLSearchParams(location.search).get("lang") || (() => { try { return localStorage.getItem("zh.lang"); } catch { return null; } })() || ((navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));
if (!["en", "zh-Hant"].includes(lang)) lang = "en";

// The header (Back / centre label / language button) reads the same nav.*
// and landing.rulesLink strings play.html and landing.js use, so it stays
// one voice with the rest of the app instead of forking its own copy.
const NAV = { "zh-Hant": zh, en };

const T = {
  "zh-Hant": {
    title: "縱橫",
    intro: "兩人對弈,8 回合,約一小時。秦走連橫,逐一吞併六國;楚走合縱,把六國綁在一起。每回合雙方各蓋一張標題牌,再輪流行動 6 或 7 次。",
    ends: "六種結束方式",
    endsRows: [["一統", "秦同時滅掉五國(韓、魏、趙、齊、燕)之中的三國:控制該國全部據點即為滅。"], ["合縱", "楚同時持有四國相印:控制該國國都,而且在那裡的影響力達到上限(安定值 + 2)。"], ["天命", "天命軌到達任一方 20。"], ["土崩", "把疲敝軌推到土崩的人立刻敗北,包括打出對手陣營的牌時觸發的對手事件。"], ["記分卡", "回合結束時手上還有記分卡的人敗北。"], ["終局", "第 8 回合結束後五區各結算一次,天命領先者勝;平手楚勝。"]],
    board: "棋盤",
    boardText: "26 個據點,分五個記分區(三晉、西土、南方、東方、北疆)與周室。五個「國」畫在區域之內,各有一個國都:韓(新鄭)、魏(大梁)、趙(邯鄲)、齊(臨淄)、燕(薊)。★ 為要衝,共八個。每據點有安定值 2 到 4。",
    control: "影響力與控制",
    controlText: "控制 = 我方影響力 ≥ 對方影響力 + 安定值。任一方在任一據點最多安定值 + 2 點,多的消失。",
    uses: "一張牌的五種用法",
    usesRows: [["事件", "照牌面做。用行動點打出對手陣營的牌時,對手的事件仍然觸發,你決定事件先或行動點先。"], ["放置", "每 1 點行動點放 1 點影響力,只能放在已有自己影響力的據點,或與自己控制的據點相鄰處;目標由對手控制時每點花 2,逐點判定。"], ["征伐", "花 X 點對一個有對手影響力的據點:先移除對手 min(X, 其影響力),剩下的放為自己的(不受相鄰限制)。目標是要衝則疲敝軌前進 1。受疲敝封鎖。"], ["遊說", "局勢 = 我方控制的相鄰據點數 − 對方控制的相鄰據點數。移除對手 min(X, 局勢) 點。不動疲敝、不受封鎖。"], ["變法", "棄掉行動點 ≥ 門檻的牌,變法軌前進 1;每回合 1 次(到第 2 格後 2 次)。"]],
    tracks: "疲敝軌與變法軌",
    weariness: "疲敝軌:承平 5 → 兵連 4 → 禍結 3 → 民困 2 → 土崩 1。要衝征伐推 1;每回合結算回復 1。封鎖(只限征伐):兵連以下不可征伐本土(西土、南方);禍結以下再加上三晉與周室;民困時任何要衝都不可。推到土崩者立刻敗北,推進者是正在行動的玩家。",
    reformText: "變法軌 6 格,先到者得分,解鎖是重點:",
    reformRows: E.REFORM.map((r) => [String(r.box), r.zh, String(r.ops), `${r.first} / ${r.second}`, { null: "無", twice: "每回合可推進變法 2 次", campaign: "每回合一次,一次征伐 +1", peek: "標題階段對手先亮牌", discard: "回合結算時可棄 1 張牌而不觸發事件", emperor: "到達時疲敝軌後退 1" }[r.perk]]),
    reformHead: ["格", "名稱", "門檻", "先到 / 後到", "解鎖"],
    special: "九鼎、洛邑、滅與相印",
    specialText: "九鼎:4 點行動點,全部用在三晉或周室視為 5;只能放置、征伐、遊說;用後蓋著交給對手,對方下回合起可用;開局由楚持有。洛邑:每回合結算時控制者天命 +1,直到「秦滅周」。滅:秦控制某國全部據點時放滅國標記,得天命(韓魏燕 2、趙齊 3,每國一次),楚控制該國國都時解除。相印:楚控制某國國都、且在該處的影響力達到上限(安定值 + 2)時放相印標記,天命 +1(每國一次),秦控制該國都時解除。",
    turn: "回合",
    turnText: "8 回合:變法期 1 到 3(手牌 8,行動 6 次)、縱橫期 4 到 6、兼併期 7 到 8(手牌 9,行動 7 次)。補牌 → 標題(各蓋一張同時翻開,行動點高者先結算,同點秦先,事件一定觸發)→ 行動回合 → 結算(記分卡判負、疲敝回復、洛邑天命、本回合效果結束)。第 4、7 回合補牌前把該期牌庫洗入。",
    scoring: "記分",
    scoringText: "記分卡結算該區,兩邊各算,差額記入天命。存在:控制 ≥ 1 據點;優勢:控制據點數與要衝數都多於對手;獨佔:控制全區。另加該區每個要衝 +1。",
    scoringHead: ["區", "存在", "優勢", "獨佔", "要衝"],
    cards: "七十二張牌",
    cardsHead: ["#", "名稱", "期", "陣營", "點", "效果"],
    era: { reform: "變法期", alliance: "縱橫期", conquest: "兼併期" },
    side: { 0: "秦", 1: "楚", null: "中立" },
    scoringCard: "記分卡",
    remove: "* 事件觸發後移除。",
    credit: "同人、免費。靈感來自《冷戰熱鬥》的卡驅動設計;與 GMT Games 無關。",
  },
  en: {
    title: "Zongheng",
    intro: "Two players, 8 turns, about an hour. Qin plays the Horizontal, picking the states off one by one; Chu plays the Vertical, holding the alliance together. Each turn both headline a card, then alternate 6 or 7 actions.",
    ends: "Six ways a game ends",
    endsRows: [["Unification", "Qin holds three of the five states (韓 Han, 魏 Wei, 趙 Zhao, 齊 Qi, 燕 Yan) at once: a state is destroyed when Qin controls every one of its spaces."], ["Alliance", "Chu holds the seals of four states at once: a seal needs control of the capital with Chu's influence there at the cap (stability + 2)."], ["Mandate", "The Mandate track reaches 20 for either side."], ["Collapse", "Whoever pushes weariness to the last box loses, even through the other side's event played for ops."], ["Scoring card", "A scoring card still in hand when the turn ends loses."], ["Final scoring", "After turn 8 every region scores once; the Mandate leader wins, a tie goes to Chu."]],
    board: "The map",
    boardText: "26 spaces in five scoring regions (Three Jin, West, South, East, North) and Zhou. Five states sit inside the regions, each with a capital: Han (Xinzheng), Wei (Daliang), Zhao (Handan), Qi (Linzi), Yan (Ji). ★ marks the eight battlegrounds. Each space has a stability of 2 to 4.",
    control: "Influence and control",
    controlText: "Control = your influence ≥ theirs + stability. Nobody holds more than stability + 2 in a space; the excess is lost.",
    uses: "A card's five uses",
    usesRows: [["Event", "Do what it says. When you spend an enemy card for ops its event happens too; you choose event first or ops first."], ["Place", "1 op per point, where you already have influence or next to a space you control; 2 per point into a space the enemy controls, re-priced point by point."], ["Campaign", "Spend X ops on a space with enemy influence: remove up to X of theirs, place the rest of yours (no adjacency needed). A battleground tires the realm by one. Locked by weariness."], ["Lobby", "Edge = your controlled neighbours minus theirs. Remove min(X, edge) enemy points. Never tires, never locked."], ["Reform", "Discard a card of at least the threshold to climb one box; once a turn (twice from box 2)."]],
    tracks: "Weariness and reform",
    weariness: "Weariness: Peace 5 → War 4 → Strife 3 → Misery 2 → Collapse 1. A battleground campaign costs 1; the realm recovers 1 at the end of each turn. Locks (campaigns only): at War or below no campaigns in the homes (West, South); at Strife or below none in the Three Jin or Zhou either; at Misery none in any battleground. Pushing to Collapse loses at once; the pusher is whoever is acting.",
    reformText: "The reform track has six boxes; the first to arrive scores, and the unlocks are the point:",
    reformRows: E.REFORM.map((r) => [String(r.box), r.zh, String(r.ops), `${r.first} / ${r.second}`, { null: "none", twice: "two reform advances a turn", campaign: "once a turn, one campaign gets +1 op", peek: "the other side reveals its headline first", discard: "at the turn's end, discard one card without its event", emperor: "weariness recovers one box on arrival" }[r.perk]]),
    reformHead: ["Box", "Name", "Ops needed", "First / second", "Unlock"],
    special: "The Nine Cauldrons, Luoyi, destruction and seals",
    specialText: "The Nine Cauldrons: 4 ops, 5 if all of it lands in the Three Jin or Zhou; place, campaign or lobby only; then it passes face down and the other side may use it from the next turn; Chu holds it at the start. Luoyi: its controller gains 1 Mandate at the end of each turn, until Qin Ends the Zhou. Destruction: when Qin controls every space of a state it is marked destroyed and Qin scores (2 for Han, Wei, Yan; 3 for Zhao, Qi; once per state); Chu controlling the capital restores it. Seals: when Chu controls a capital with its influence there at the cap (stability + 2) it holds that state's seal and scores 1 (once per state); Qin controlling the capital removes it.",
    turn: "The turn",
    turnText: "8 turns: the Reform era, turns 1 to 3 (hand 8, 6 actions), the Alliance era, 4 to 6, and the Conquest era, 7 and 8 (hand 9, 7 actions). Refill → headline (both commit one card, reveal together, higher ops first, Qin first on ties, events always happen) → action rounds → end of turn (a held scoring card loses, weariness recovers 1, Luoyi pays, this turn's effects expire). Before the refill of turns 4 and 7 the era's deck is shuffled in.",
    scoring: "Scoring",
    scoringText: "A scoring card scores its region for both sides; the difference moves the Mandate. Presence: control at least one space. Domination: more spaces and more battlegrounds than the other side. Control: every space. Plus 1 per battleground controlled.",
    scoringHead: ["Region", "Presence", "Domination", "Control", "Battlegrounds"],
    cards: "The 72 cards",
    cardsHead: ["#", "Card", "Era", "Side", "Ops", "Effect"],
    era: { reform: "Reform", alliance: "Alliance", conquest: "Conquest" },
    side: { 0: "Qin", 1: "Chu", null: "Neutral" },
    scoringCard: "Scoring card",
    remove: "* removed from the game after its event.",
    credit: "A free fan project. Inspired by the card-driven design of Twilight Struggle; not affiliated with GMT Games.",
  },
};

function table(head, rows, cls = []) {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${cls[i] || ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function cardRow(side, id, zhName, enLine, badge, text) {
  const enName = enLine.split(" · ")[0];
  return `<div class="cardrow side-${side}">` +
    `<img src="art/cards/${id}.jpg" width="60" height="80" loading="lazy" alt="${esc(zhName.replace(/ \*$/, ""))} ${esc(enName)}">` +
    `<div class="cr-body">` +
    `<span class="cr-head">` +
    `<span class="cr-badge">${badge}</span>` +
    `<span class="cr-zh" lang="zh-Hant">${zhName}</span>` +
    `<span class="cr-en">${esc(enLine)}</span>` +
    `</span>` +
    `<span class="cr-text">${text}</span>` +
    `</div></div>`;
}
// One row per card, art on the left, background/badge/name colour keyed to
// the card's owner — the same three tones the card sheet uses (楚 #4f0e0a,
// 秦 var(--bg), 中立與記分 #f7f3e8; see rules.css). Read straight off
// shared/cards.js so a rules edit and the deck can never drift apart. The
// 72nd card, the Nine Cauldrons, isn't in CARDS (it's the engine's special
// st.jiuding card, dealt with separately by every rule that touches it), so
// its row is built by hand from NAV's rules.* strings and its ops read live
// off E.opsOf — never a hand-copied "4".
function cardList(S, N, cardEn) {
  const rows = E.CARDS.map((c) => {
    const side = c.scoring ? "s" : c.side === 0 ? "q" : c.side === 1 ? "c" : "n";
    const zhName = `${esc(c.zh)}${c.remove ? " *" : ""}`;
    const text = c.scoring
      ? (lang === "en" ? `Scores ${E.REGIONS[c.scoring].en}.` : `結算${E.REGIONS[c.scoring].zh}。`)
      : esc(lang === "en" ? cardEn[c.id] ?? c.text : c.text);
    const year = c.year ? ` <small>(${lang === "en" ? "" : "前"}${c.year}${lang === "en" ? " BC" : ""})</small>` : "";
    const enLine = `${c.en} · ${S.era[c.era]} · ${c.scoring ? S.scoringCard : S.side[c.side]}`;
    return cardRow(side, c.id, zhName, enLine, c.scoring ? "–" : c.ops, text + year);
  });
  // Name is bilingual regardless of the active language, same as every
  // other card row (names are the exception to the no-mixing rule); the
  // description follows the current language like the other cards' text.
  const jiudingOps = E.opsOf({ effects: [] }, E.QIN, E.JIUDING);
  const jiudingEnLine = `${en.rules.jiuding} · ${S.side[null]}`;
  rows.push(cardRow("n", "jiuding", esc(zh.rules.jiuding), jiudingEnLine, jiudingOps, esc(N.rules.jiudingText)));
  return `<div class="cardlist">${rows.join("")}</div>`;
}
function render() {
  const S = T[lang];
  const N = NAV[lang];
  document.documentElement.lang = lang;
  $("backLink").textContent = N.nav.back;
  $("barMid").textContent = N.landing.rulesLink;
  $("langBtn").textContent = N.nav.lang;
  $("credit").textContent = S.credit;
  const regionRows = E.SCORED_REGIONS.map((r) => { const R = E.REGIONS[r]; return [esc(lang === "en" ? R.en : R.zh), R.presence, R.domination, R.control, E.spacesOf(r).filter((id) => E.SPACE[id].battleground).length]; });
  $("rules").innerHTML =
    `<h1>${esc(S.title)}</h1><p>${esc(S.intro)}</p>` +
    `<h2>${esc(S.ends)}</h2>${table([], S.endsRows.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}` +
    `<h2>${esc(S.board)}</h2><p>${esc(S.boardText)}</p>` +
    `<h2>${esc(S.control)}</h2><p>${esc(S.controlText)}</p>` +
    `<h2>${esc(S.uses)}</h2>${table([], S.usesRows.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}` +
    `<h2>${esc(S.tracks)}</h2><p>${esc(S.weariness)}</p><p>${esc(S.reformText)}</p>${table(S.reformHead, S.reformRows.map((r) => r.map(esc)))}` +
    `<h2>${esc(S.special)}</h2><p>${esc(S.specialText)}</p>` +
    `<h2>${esc(S.turn)}</h2><p>${esc(S.turnText)}</p>` +
    `<h2>${esc(S.scoring)}</h2><p>${esc(S.scoringText)}</p>${table(S.scoringHead, regionRows)}` +
    `<h2>${esc(S.cards)}</h2><p>${esc(S.remove)}</p>${cardList(S, N, CARD_EN)}`;
}
$("langBtn").onclick = () => { lang = lang === "en" ? "zh-Hant" : "en"; try { localStorage.setItem("zh.lang", lang); } catch {} render(); };
render();
