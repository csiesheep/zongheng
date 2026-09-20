// The rules page, built from the same data the engine plays by, so the card
// table can never drift from the deck. Prose is plain on purpose.
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";
import {
  DESIGN_W, DESIGN_H, NODE_POS, regionMembers, isCapital,
  renderRegionBlobs, renderRoads, REGION_LABEL_POS, NODE_ANCHOR, nodeLabelHTML,
  stabilityTagHTML, NODE_STAB_RIGHT, NODE_STAB_HI,
} from "./map-draw.js";
import { renderCardView } from "./card-view.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let lang = (new URLSearchParams(location.search).get("lang") || (() => { try { return localStorage.getItem("zh.lang"); } catch { return null; } })() || ((navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));
if (!["en", "zh-Hant"].includes(lang)) lang = "en";
const spaceName = (id) => (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh);
// Same regionShort table app.js's map uses (see its own comment on this
// function) — zh's used to fall back to E.REGIONS[r].zh, which is why the
// owner's "regionShort.zhou: 周室→周" (#26 追加(2)) needed this read fixed
// too, not just the i18n key: the old fallback would have kept showing
// "周室" here no matter what regionShort.zhou said.
const regionShortName = (r) => (lang === "en" ? en.regionShort[r] : zh.regionShort[r]);

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
    boardText: "26 個據點,分五個記分區(三晉、西土、南方、東方、北疆)與周。五個「國」畫在區域之內,各有一個國都:韓(新鄭)、魏(大梁)、趙(邯鄲)、齊(臨淄)、燕(薊)。★ 為要衝,共八個。每據點有安定值 2 到 4。",
    mapAlt: "地圖:26 個據點分屬五個記分區與周,每個據點旁的小方籤標著它的安定值,★ 是要衝,方形圓盤是國都。",
    mapLegend: "★ 要衝　▢ 國都　籤上的數字 = 安定值　色塊 = 記分區",
    control: "影響力與控制",
    controlText: "控制 = 我方影響力 ≥ 對方影響力 + 安定值。任一方在任一據點最多安定值 + 2 點,多的消失。",
    uses: "一張牌的五種用法",
    usesRows: [["事件", "照牌面做。用行動點打出對手陣營的牌時,對手的事件仍然觸發,你決定事件先或行動點先。"], ["放置", "每 1 點行動點放 1 點影響力,只能放在已有自己影響力的據點,或與自己控制的據點相鄰處;目標由對手控制時每點花 2,逐點判定。"], ["征伐", "花 X 點對一個有對手影響力的據點:先移除對手 min(X, 其影響力),剩下的放為自己的(不受相鄰限制)。目標是要衝則疲敝軌前進 1。受疲敝封鎖。"], ["遊說", "局勢 = 我方控制的相鄰據點數 − 對方控制的相鄰據點數。移除對手 min(X, 局勢) 點。不動疲敝、不受封鎖。"], ["變法", "棄掉行動點 ≥ 門檻的牌,變法軌前進 1;每回合 1 次(到第 2 格後 2 次)。"]],
    tracks: "疲敝軌與變法軌",
    weariness: "疲敝軌:承平 5 → 兵連 4 → 禍結 3 → 民困 2 → 土崩 1。要衝征伐推 1;每回合結算回復 1。封鎖(只限征伐):兵連以下不可征伐本土(西土、南方);禍結以下再加上三晉與周;民困時任何要衝都不可。推到土崩者立刻敗北,推進者是正在行動的玩家。",
    reformText: "變法軌 6 格,先到者得分,解鎖是重點:",
    reformRows: E.REFORM.map((r) => [String(r.box), r.zh, String(r.ops), `${r.first} / ${r.second}`, { null: "無", twice: "每回合可推進變法 2 次", campaign: "每回合一次,一次征伐 +1", peek: "標題階段對手先亮牌", discard: "回合結算時可棄 1 張牌而不觸發事件", emperor: "到達時疲敝軌後退 1" }[r.perk]]),
    reformHead: ["格", "名稱", "門檻", "先到 / 後到", "解鎖"],
    special: "九鼎、洛邑、滅與相印",
    specialText: "九鼎:4 點行動點,全部用在三晉或周視為 5;只能放置、征伐、遊說;用後蓋著交給對手,對方下回合起可用;開局由楚持有。洛邑:每回合結算時控制者天命 +1,直到「秦滅周」。滅:秦控制某國全部據點時放滅國標記,得天命(韓魏燕 2、趙齊 3,每國一次),楚控制該國國都時解除。相印:楚控制某國國都、且在該處的影響力達到上限(安定值 + 2)時放相印標記,天命 +1(每國一次),秦控制該國都時解除。",
    turn: "回合",
    turnEras: "8 回合:變法期 1 到 3(手牌 8,行動 6 次)、縱橫期 4 到 6、兼併期 7 到 8(手牌 9,行動 7 次)。每回合依下列四步進行:",
    turnSteps: [
      ["補牌", "補到手牌上限;牌庫抽完時把棄牌堆(不含已移除的牌)洗成新牌庫。第 4、7 回合補牌前先把該期牌庫洗入抽牌堆。"],
      ["標題階段", "雙方各從手牌選一張牌蓋下(可蓋記分卡,不可蓋九鼎),同時翻開;行動點高者的事件先結算,同點秦先。標題牌的事件一定發生,就算是對手陣營的牌。變法軌第 4 格「行縣制」解鎖後,對手先亮牌。"],
      ["行動回合", "秦、楚輪流,各打 6 或 7 次,每次打 1 張牌(或九鼎)。"],
      ["結算", "手上仍有記分卡者敗北;疲敝軌後退 1 格;控制洛邑者天命 +1;本回合效果結束;已解鎖「明法令」者可棄 1 張非記分卡,事件不觸發。"],
    ],
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
    mapAlt: "A map of the 26 spaces across five scoring regions and Zhou; a small tag beside each space's disc carries its stability number, a star marks a battleground, and a square disc marks a state capital.",
    mapLegend: "★ battleground　▢ capital　the tag's number = stability　colour = scoring region",
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
    turnEras: "8 turns: the Reform era, turns 1 to 3 (hand 8, 6 actions), the Alliance era, 4 to 6, and the Conquest era, 7 and 8 (hand 9, 7 actions). Every turn runs through four steps:",
    turnSteps: [
      ["Refill", "Draw up to the hand limit; when the deck runs out, reshuffle the discards (minus any removed cards) into a new deck. Before the refill on turns 4 and 7, that era's deck is shuffled in first."],
      ["Headline", "Both sides pick one card from hand and lay it face down (a scoring card may be picked, the Nine Cauldrons may not), then reveal together. The higher-ops card's event resolves first, Qin first on a tie. A headline's event always happens, even for the other side's card. Once reform reaches box 4, the opponent reveals first."],
      ["Action rounds", "Qin and Chu alternate, each playing one card (or the Cauldrons) per turn, 6 or 7 times."],
      ["End of turn", "Holding a scoring card loses; weariness recovers one box; Luoyi's controller gains 1 Mandate; this turn's effects expire; whoever unlocked box 5 may discard one non-scoring card without its event."],
    ],
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

// #40: section chips (sticky nav) — one entry per h2 rendered by
// textSectionsHTML(), in the exact order they appear there. "top" isn't a
// section; it's the fixed last chip that scrolls back to the very top of
// the page (mobile-only — #44's desktop rail has no such chip).
const NAV_SECTIONS = ["ends", "board", "control", "uses", "tracks", "special", "turn", "scoring", "cards"];
// #44 review item 2: the desktop rail lists the 規則 tab's own sections only
// — "cards" isn't one of them there (the 72 cards are the OTHER tab, not a
// heading inside this column at all: textSectionsHTML()'s own withCards:
// false for the desktop text column means #sec-cards doesn't exist while
// this tab is showing), so leaving it in the rail gave the scroll-spy a
// section it could never actually reach — the last real heading (記分/
// Scoring) could be scrolled to the top of the page and the mark still sat
// on the second-to-last section, because the loop's threshold could never
// be satisfied for a heading (#sec-cards) that was never rendered.
const RAIL_SECTIONS = NAV_SECTIONS.filter((key) => key !== "cards");

// #40: card search + era/side filters. Plain module state (not DOM, not
// reset by render()) so a language switch or reopening a card from the
// list never loses what the reader had typed or picked. #44: this is the
// ONE set of filter state serving both the mobile row of chips and the
// desktop rail's vertical lists — neither layout keeps its own copy.
let filterEra = "all";
let filterSide = "all";
let filterSearch = "";
// #44: which of the two desktop tabs is showing (meaningless below 1024px,
// where the page has no tabs at all — #40's single column is the only
// layout there, unconditionally).
let activeTab = "rules";

function table(head, rows, cls = []) {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${cls[i] || ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
// #35: each row is a real <button> (>=44px tall, keyboard-focusable) that
// opens the card's detail page — see openCardDetail()/the click-delegation
// listener near the bottom of this file. data-card carries the id; the
// row's own look (background/border/text colour by side) is untouched.
// #40: filterEra/filterSide are one of "all"/"reform"/"alliance"/"conquest"
// and "all"/"qin"/"chu"/"neutral"/"scoring"; era/filterSideKey carry the
// same values per-card so cardRow can stamp them as data-* for
// applyCardFilters() to read straight off the DOM (no parallel JS index to
// keep in sync with the rendered rows). era === "" (the Nine Cauldrons: it
// isn't any one era) only ever matches the "all" era filter.
// #44: the same button also becomes the desktop grid's compact tile —
// rules-desktop.css restyles it (44x58 art, a 12px badge, the name, the
// year — nothing else: review item 3 was clear that the card's own rules
// text and its second-language line belong in the panel, not the tile) —
// rather than a second list, so this one function still is the only place a
// card row/tile is built. `year`, on its own (review item 3 again: the
// mobile row folds it into `text` — see cardList() below — but the tile
// hides `text` outright, so the year needs its own element to still show up
// there), sits inside .cr-head, right after the name, so the tile's one
// visible text line is the two of them together — hidden at mobile by
// rules.css's own default (.cr-year{display:none}), same as it always was
// before this element existed at all.
function cardRow(side, id, zhName, enLine, badge, text, era, filterSideKey, searchName, year = "") {
  const enName = enLine.split(" · ")[0];
  return `<button type="button" class="cardrow side-${side}" data-card="${esc(id)}" data-era="${esc(era)}" data-side="${esc(filterSideKey)}" data-name="${esc(searchName.toLowerCase())}">` +
    `<img src="art/cards/${id}.jpg" width="60" height="80" loading="lazy" alt="${esc(zhName.replace(/ \*$/, ""))} ${esc(enName)}">` +
    `<div class="cr-body">` +
    `<span class="cr-head">` +
    `<span class="cr-badge">${badge}</span>` +
    `<span class="cr-zh" lang="zh-Hant">${zhName}</span>` +
    `<span class="cr-year">${year}</span>` +
    `<span class="cr-en">${esc(enLine)}</span>` +
    `</span>` +
    `<span class="cr-text">${text}</span>` +
    `</div>` +
    `<span class="cr-chevron" aria-hidden="true">›</span>` +
    `</button>`;
}
// One row per card, art on the left, background/badge/name colour keyed to
// the card's owner — the same three tones the card sheet uses (楚 #4f0e0a,
// 秦 var(--bg), 中立與記分 #f7f3e8; see rules.css). Read straight off
// shared/cards.js so a rules edit and the deck can never drift apart. The
// 72nd card, the Nine Cauldrons, isn't in CARDS (it's the engine's special
// st.jiuding card, dealt with separately by every rule that touches it), so
// its row is built by hand from NAV's rules.* strings and its ops read live
// off E.opsOf — never a hand-copied "4".
// #40: era/side filter chip values, in the order the row draws them.
const ERA_FILTER_KEYS = ["all", "reform", "alliance", "conquest"];
const SIDE_FILTER_KEYS = ["all", "qin", "chu", "neutral", "scoring"];
const filterSideKeyOf = (c) => (c.scoring ? "scoring" : c.side === 0 ? "qin" : c.side === 1 ? "chu" : "neutral");

// #44: how many of the 72 cards fall under each era/side filter value —
// read live off E.CARDS + the Nine Cauldrons' own hand-built row (never a
// hand-typed 27/24/20/23/23/21/5), so the desktop rail's counts can never
// drift from the actual list the way a copied number could.
function eraCounts() {
  const counts = { all: E.CARDS.length + 1, reform: 0, alliance: 0, conquest: 0 };
  for (const c of E.CARDS) if (c.era) counts[c.era]++;
  return counts;
}
function sideCounts() {
  const counts = { all: 0, qin: 0, chu: 0, neutral: 0, scoring: 0 };
  for (const c of E.CARDS) counts[filterSideKeyOf(c)]++;
  counts.neutral++; // the Nine Cauldrons: always 中立/Neutral, see cardList() below
  counts.all = E.CARDS.length + 1;
  return counts;
}

// #44: opts.withFilters === false skips the search box + era/side chip row
// this normally opens with — the desktop cards tab draws its own rail
// version of those (cardFiltersDesktopHTML() below) instead, so embedding
// this one too would duplicate #cardSearch/#eraFilterRow/#sideFilterRow
// (both layouts are never in the DOM at the same time, but each render()
// call must still only ever produce ONE of each id). Every other caller
// (mobile) omits opts, which keeps this byte-for-byte what #40 built.
function cardList(S, N, cardEn, opts = {}) {
  const rows = E.CARDS.map((c) => {
    const side = c.scoring ? "s" : c.side === 0 ? "q" : c.side === 1 ? "c" : "n";
    const zhName = `${esc(c.zh)}${c.remove ? " *" : ""}`;
    const text = c.scoring
      ? (lang === "en" ? `Scores ${E.REGIONS[c.scoring].en}.` : `結算${E.REGIONS[c.scoring].zh}。`)
      : esc(lang === "en" ? cardEn[c.id] ?? c.text : c.text);
    const year = c.year ? ` <small>(${lang === "en" ? "" : "前"}${c.year}${lang === "en" ? " BC" : ""})</small>` : "";
    const enLine = `${c.en} · ${S.era[c.era]} · ${c.scoring ? S.scoringCard : S.side[c.side]}`;
    return cardRow(side, c.id, zhName, enLine, c.scoring ? "–" : c.ops, text + year, c.era, filterSideKeyOf(c), `${c.zh} ${c.en}`, year);
  });
  // Name is bilingual regardless of the active language, same as every
  // other card row (names are the exception to the no-mixing rule); the
  // description follows the current language like the other cards' text.
  const jiudingOps = E.opsOf({ effects: [] }, E.QIN, E.JIUDING);
  const jiudingEnLine = `${en.rules.jiuding} · ${S.side[null]}`;
  // #40: the Cauldrons aren't tied to one era (usable from the start, all
  // the way through the game), so they only ever show under the "all" era
  // filter — never under 變法期/縱橫期/兼併期 specifically (era: "" never
  // equals any of those three) — orchestrator's call on #40. Side-wise
  // they're plain 中立, same as every other non-Qin/Chu/scoring card.
  rows.push(cardRow("n", "jiuding", esc(zh.rules.jiuding), jiudingEnLine, jiudingOps, esc(N.rules.jiudingText), "", "neutral", `${zh.rules.jiuding} ${en.rules.jiuding}`));
  const filters = opts.withFilters === false ? "" : cardFiltersHTML();
  return `${filters}<div class="cardlist" id="cardListWrap">${rows.join("")}</div><p class="card-empty" id="cardEmpty" hidden>${esc(N.rules.empty)}</p>`;
}

// #40: search box + era/side filter chip rows, drawn from the live
// filterEra/filterSide/filterSearch module state so a language switch keeps
// whatever the reader had picked or typed (render() rebuilds this markup on
// every call, this just keeps it in sync instead of resetting it). Reads
// NAV[lang] directly (not a parameter) — applyCardFilters()/render() both
// need the exact same strings and the former runs outside render()'s own
// S/N locals (from a delegated event listener). Mobile's own horizontal
// chip row — #44's desktop rail draws a different-looking (vertical, with
// counts) version of the same filters, see cardFiltersDesktopHTML() below.
function cardFiltersHTML() {
  const N = NAV[lang];
  const eraChips = ERA_FILTER_KEYS.map((k) => `<button type="button" class="chip filter-chip${filterEra === k ? " active" : ""}" data-filter="era" data-value="${k}">${esc(N.rules.eraFilter[k])}</button>`).join("");
  const sideChips = SIDE_FILTER_KEYS.map((k) => `<button type="button" class="chip filter-chip${filterSide === k ? " active" : ""}" data-filter="side" data-value="${k}">${esc(N.rules.sideFilter[k])}</button>`).join("");
  return `<div class="card-filters">` +
    `<input type="search" id="cardSearch" class="card-search" placeholder="${esc(N.rules.search)}" value="${esc(filterSearch)}" aria-label="${esc(N.rules.search)}">` +
    `<div class="chip-row filter-row" id="eraFilterRow">${eraChips}</div>` +
    `<div class="chip-row filter-row" id="sideFilterRow">${sideChips}</div>` +
    `<p class="card-count" id="cardCount"></p>` +
    `</div>`;
}

// #44: the desktop cards tab's own rail — same #cardSearch/#eraFilterRow/
// #sideFilterRow ids as cardFiltersHTML() above (never in the DOM at the
// same time as that one, so no collision) so applyCardFilters()'s own
// lookups and the delegated click/input listeners work unchanged for
// either layout. Adds the fixed per-option counts (eraCounts()/
// sideCounts()) the mobile chips never show; #cardCount (the live "N
// cards" label) moves here too, ahead of the grid instead of above it.
function cardFiltersDesktopHTML(N) {
  const eraN = eraCounts(), sideN = sideCounts();
  const eraItems = ERA_FILTER_KEYS.map((k) => `<button type="button" class="chip filter-chip d-filter-item${filterEra === k ? " active" : ""}" data-filter="era" data-value="${k}">` +
    `<span>${esc(N.rules.eraFilter[k])}</span><span class="d-filter-count">${eraN[k]}</span></button>`).join("");
  const sideItems = SIDE_FILTER_KEYS.map((k) => `<button type="button" class="chip filter-chip d-filter-item${filterSide === k ? " active" : ""}" data-filter="side" data-value="${k}">` +
    `<span>${esc(N.rules.sideFilter[k])}</span><span class="d-filter-count">${sideN[k]}</span></button>`).join("");
  return `<input type="search" id="cardSearch" class="card-search" placeholder="${esc(N.rules.search)}" value="${esc(filterSearch)}" aria-label="${esc(N.rules.search)}">` +
    `<div class="d-filter-list" id="eraFilterRow">${eraItems}</div>` +
    `<div class="d-filter-list" id="sideFilterRow">${sideItems}</div>` +
    `<p class="card-count" id="cardCount"></p>`;
}

// #40: re-applies filterEra/filterSide/filterSearch to the already-rendered
// 72 rows by toggling `hidden` (not a re-render — render() rebuilds the
// #cardSearch input too, which would drop keystroke focus/cursor while
// typing). Called after render() and after every filter/search change.
// #44: also marks whichever row is the desktop panel's currently open card
// (.chosen — rules-desktop.css draws its 2px gold border), the one bit of
// desktop-only visual state this function needs to carry since it's the
// one place already walking every row.
function applyCardFilters() {
  const wrap = $("cardListWrap");
  if (!wrap) return;
  const needle = filterSearch.trim().toLowerCase();
  let shown = 0;
  wrap.querySelectorAll(".cardrow").forEach((row) => {
    const match = (filterEra === "all" || row.dataset.era === filterEra) &&
      (filterSide === "all" || row.dataset.side === filterSide) &&
      (!needle || row.dataset.name.includes(needle));
    row.hidden = !match;
    if (match) shown++;
    row.classList.toggle("chosen", row.dataset.card === openCardId);
  });
  const N = NAV[lang];
  const labelParts = [];
  if (filterEra !== "all") labelParts.push(N.rules.eraFilter[filterEra]);
  if (filterSide !== "all") labelParts.push(N.rules.sideFilter[filterSide]);
  if (needle) labelParts.push(`“${filterSearch.trim()}”`);
  const label = labelParts.length ? labelParts.join(lang === "en" ? " + " : "・") : N.rules.eraFilter.all;
  const countEl = $("cardCount");
  if (countEl) countEl.textContent = `${label} · ${N.rules.count.replace("{n}", String(shown))}`;
  const emptyEl = $("cardEmpty");
  if (emptyEl) emptyEl.hidden = shown !== 0;
}

// The board section's map: an empty board (no influence, nobody in
// control) drawn from the exact same geometry the game table uses
// (map-draw.js) — roads, region blobs, region labels and the 26 discs, at
// the table's own pixel sizes (30/34px discs, 12-13px names), each disc's
// stability shown by the same corner tag the table draws (stabilityTagHTML,
// owner's "A 數字籤" design, #26). Static and unclickable: role="img" + a
// bilingual aria-label stand in for the missing hit layer, and there is no
// #hitLayer at all. #44: on desktop this is the ONE map in the DOM — pinned
// in its own column rather than repeated inline in the board section (see
// textSectionsHTML()'s own inlineMap option) — same function either way.
function ruleNodeHTML(sp) {
  const [x, y] = NODE_POS[sp.id];
  const cap = isCapital(sp.id);
  const big = sp.battleground || cap;
  const anchor = NODE_ANCHOR[sp.id];
  const cls = "node empty" + (big ? " big" : "") + (anchor ? ` anchor-${anchor}` : "") +
    (NODE_STAB_RIGHT.has(sp.id) ? " stab-r" : "") + (NODE_STAB_HI.has(sp.id) ? " stab-hi" : "");
  return `<div class="${cls}" style="left:${x}px;top:${y}px">` +
    `<span class="disc${cap ? " sq" : ""}"></span>` +
    stabilityTagHTML(sp) +
    nodeLabelHTML(sp.id, spaceName(sp.id), lang, esc) +
    `</div>`;
}
function mapSectionHTML(S) {
  const members = regionMembers();
  const labels = Object.keys(REGION_LABEL_POS).filter((r) => members[r]).map((r) => {
    const [x, y] = REGION_LABEL_POS[r];
    return `<span class="region-label rl-${r}" style="left:${x}px;top:${y}px">${esc(regionShortName(r))}</span>`;
  }).join("");
  const nodes = E.SPACES.map(ruleNodeHTML).join("");
  return `<div class="map rules-map" id="rulesMap" role="img" aria-label="${esc(S.mapAlt)}">` +
    `<div class="map-inner" id="rulesMapInner">${renderRoads()}${renderRegionBlobs(members)}${labels}${nodes}</div>` +
    `</div><p class="rules-map-legend">${esc(S.mapLegend)}</p>`;
}
// #rulesMapInner is a fixed DESIGN_W x DESIGN_H canvas (same one the table
// uses), scaled by the viewport-width ratio only — see fitMap() in app.js,
// which this mirrors exactly so a phone renders true-size discs/text.
// .rules-map itself gets its height from aspect-ratio in rules.css, so this
// only has to size and scale the canvas inside it, not the box. #44: reused
// unchanged for the desktop pinned map (400px, or narrower — rules-
// desktop.css's own minmax floor) — it already reads the box's own
// clientWidth rather than a hard-coded 390, so a narrower desktop frame
// just fits it smaller, no separate code path needed.
function fitRulesMap() {
  const box = $("rulesMap"), inner = $("rulesMapInner");
  if (!box || !inner) return;
  const scale = box.clientWidth / DESIGN_W;
  inner.style.width = DESIGN_W + "px";
  inner.style.height = DESIGN_H + "px";
  inner.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener("resize", fitRulesMap);

// #40: the sticky section-nav row (chips) that sits right under the page's
// header bar, one chip per h2 render() draws (NAV_SECTIONS, same order),
// plus a fixed last chip back to the top. Built fresh on every render() so
// its labels track the active language; which chip is "active" is driven
// separately, by scroll position (updateActiveNavChip()), not rebuilt here.
// Mobile-only from #44 on: not shown at all >=1024px (rules-desktop.css),
// where railHTML()/updateActiveRail() below play the same role instead.
function rulesNavHTML(S) {
  const N = NAV[lang];
  const chips = NAV_SECTIONS.map((key) => `<button type="button" class="chip nav-chip" data-sec="${key}">${esc(N.rules.nav[key])}</button>`).join("");
  return `<nav class="rules-nav" id="rulesNav" aria-label="${esc(S.title)}">` +
    `<div class="rules-nav-scroll" id="rulesNavScroll">${chips}` +
    `<button type="button" class="chip nav-chip nav-chip-top" data-sec="top">${esc(N.rules.nav.top)}</button>` +
    `</div></nav>`;
}
// #44: the desktop rail's own vertical list — RAIL_SECTIONS (the mobile
// chips' own NAV_SECTIONS, minus "cards": see that constant's own note), no
// "Top ↑" (the rail itself never scrolls out of view, so there's nothing to
// return to it from).
function railHTML(N) {
  return RAIL_SECTIONS.map((key) => `<button type="button" class="d-rail-item" data-sec="${key}">${esc(N.rules.nav[key])}</button>`).join("");
}

// #40: scrolls so `key`'s h2 clears the sticky bar+chips, using each
// heading's live getBoundingClientRect() rather than a cached offsetTop
// (map/table sizes shift with viewport width, so absolute offsets would go
// stale) — see the file's own note on why this reads off a `scroll`
// listener instead of IntersectionObserver for the reverse direction
// (highlighting the current chip, below). Mobile scrolls <html>/<body>;
// >=1024px `.page-card` is its own scroll box (desktop.css) — same
// breakpoint positionDetailOverlay() already uses.
function isDesktopScroller() { return matchMedia("(min-width: 1024px)").matches; }
// The same breathing room scrollSectionIntoView() leaves below the sticky
// chips is also how far a heading is allowed to sit and still count as "in
// view" for updateActiveNavChip() below — a smaller spy threshold would
// mean tapping a chip scrolls to a spot its own scroll-spy doesn't yet
// recognise as that section (measured while building this: every tap
// highlighted the PREVIOUS chip instead of the one just tapped).
const SECTION_GAP = 10;
// nav.offsetHeight (its own height), not getBoundingClientRect().bottom: at
// rest (page unscrolled) the nav hasn't reached its `position: sticky` point
// yet, so its on-screen bottom edge still includes the header bar sitting
// above it — using that pre-scroll bottom as the target undershot every
// first tap (measured while building this: the destination heading landed
// ~70px, the bar's own height, below where it should). Once actually
// scrolled the sticky nav's top is pinned at 0, so its bottom is exactly
// its own height — the only value that's right both before and after.
function scrollSectionIntoView(key) {
  const el = $("sec-" + key);
  const nav = $("rulesNav");
  if (!el || !nav) return;
  const delta = el.getBoundingClientRect().top - nav.offsetHeight - SECTION_GAP;
  if (isDesktopScroller()) { const card = $("pageCard"); if (card) card.scrollTop += delta; }
  else window.scrollBy(0, delta);
}
function scrollRulesToTop() {
  if (isDesktopScroller()) { const card = $("pageCard"); if (card) card.scrollTop = 0; }
  else window.scrollTo(0, 0);
}
// Nudges the row's own scrollLeft (a synchronous property write) just far
// enough that `chip` clears both edges — not Element.scrollIntoView(),
// which measurably never moved this row in the pane this ships to (no
// requestAnimationFrame; see updateActiveNavChip()'s own note). Used both
// for the section chip the reader just tapped and, since it's the one chip
// updateActiveNavChip() never marks active, for "Top ↑" itself.
function scrollChipIntoView(chip) {
  const scroller = $("rulesNavScroll");
  if (!scroller || !chip) return;
  const contRect = scroller.getBoundingClientRect(), chipRect = chip.getBoundingClientRect();
  if (chipRect.left < contRect.left) scroller.scrollLeft -= (contRect.left - chipRect.left + 14);
  else if (chipRect.right > contRect.right) scroller.scrollLeft += (chipRect.right - contRect.right + 14);
}
// #40: which chip is gold — read straight off the headings' current
// on-screen position every time this runs (a `scroll` listener, cheap
// enough at nine headings) instead of an IntersectionObserver, whose
// callback the harness this ships to may never fire at all (see the file
// top note / issue #40). The last heading whose top has crossed above the
// chips' own bottom edge is the section in view.
function updateActiveNavChip() {
  const nav = $("rulesNav"), scroller = $("rulesNavScroll");
  if (!nav || !scroller) return;
  const threshold = Math.max(nav.getBoundingClientRect().bottom, nav.offsetHeight) + SECTION_GAP + 2;
  let activeKey = NAV_SECTIONS[0];
  for (const key of NAV_SECTIONS) {
    const el = $("sec-" + key);
    if (el && el.getBoundingClientRect().top <= threshold) activeKey = key;
  }
  scroller.querySelectorAll(".nav-chip").forEach((btn) => btn.classList.toggle("active", btn.dataset.sec === activeKey));
  scrollChipIntoView(scroller.querySelector(`.nav-chip[data-sec="${activeKey}"]`));
}
window.addEventListener("scroll", updateActiveNavChip, { passive: true });
$("pageCard")?.addEventListener("scroll", updateActiveNavChip, { passive: true });

// #44: the desktop rail's own scroll-to and scroll-spy — a separate small
// pair of functions rather than generalising the mobile ones above: the
// rail is a vertical, always-visible list (no horizontal scroll-into-view,
// no "Top ↑" chip), so sharing code would mean threading a layout-mode flag
// through scrollChipIntoView() for no real saving. Both no-op off the
// rules tab / off desktop, so wiring them unconditionally (below) is safe.
function scrollToSectionDesktop(key) {
  const el = $("sec-" + key), card = $("pageCard");
  if (!el || !card) return;
  const barH = document.querySelector(".bar")?.getBoundingClientRect().height || 0;
  card.scrollTop += el.getBoundingClientRect().top - barH - SECTION_GAP;
}
// Review item 2 (#44): two bugs in one function. (1) it walked NAV_SECTIONS,
// which includes "cards" — a section that doesn't exist in this tab's own
// text column at all (see RAIL_SECTIONS' own note), so the loop's threshold
// could never be satisfied for it and the LAST real heading (記分/Scoring)
// could never win even scrolled all the way to the very top of the page.
// (2) the threshold sat right under the bar (~barH + 12px), so a heading
// only counted as "in view" once it had scrolled almost all the way past
// the top — measured to mismatch the reader's own sense of "what section am
// I reading", which sits closer to a third of the way down the viewport.
// Fixed rule, tested against both of the review's own failing cases: the
// marked section is the last heading whose top has crossed above a third of
// `.page-card`'s own height; AND, once scrolled to the very bottom (nothing
// left below to bring any further heading up to that line), it's simply the
// last section — the one true edge case the crossing rule alone can't
// reach if the last section's own content is shorter than that third.
function updateActiveRail() {
  if (!isDesktopScroller() || activeTab !== "rules") return;
  const rail = $("dRail"), card = $("pageCard");
  if (!rail || !card) return;
  const atBottom = card.scrollHeight - card.scrollTop - card.clientHeight < 2;
  let activeKey;
  if (atBottom) {
    activeKey = RAIL_SECTIONS[RAIL_SECTIONS.length - 1];
  } else {
    const threshold = card.clientHeight / 3;
    activeKey = RAIL_SECTIONS[0];
    for (const key of RAIL_SECTIONS) {
      const el = $("sec-" + key);
      if (el && el.getBoundingClientRect().top <= threshold) activeKey = key;
    }
  }
  rail.querySelectorAll(".d-rail-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.sec === activeKey));
}
$("pageCard")?.addEventListener("scroll", updateActiveRail, { passive: true });

// #44: scrolls the desktop grid's chosen tile into view inside `.page-card`
// (instant — no smooth-scroll behaviour to wait on, same reasoning as the
// rest of this file re: the harness this ships to). No-ops off desktop.
function scrollTileIntoView(id) {
  if (!isDesktopScroller()) return;
  const btn = document.querySelector(`#cardListWrap .cardrow[data-card="${id}"]`);
  const scroller = $("pageCard");
  if (!btn || !scroller) return;
  const r = btn.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
  const barH = document.querySelector(".bar")?.getBoundingClientRect().height || 0;
  if (r.top < sr.top + barH || r.bottom > sr.bottom) scroller.scrollTop += r.top - sr.top - barH - 16;
}

// #44: the text content shared by the mobile column and the desktop rules
// tab's own middle column — every h2/table/list #40 already built, byte for
// byte. `opts.inlineMap` (mobile: true) repeats the board's map right after
// its own paragraph, same as #26 always did; `opts.withCards` (mobile: true)
// appends the 72-card section at the end. Desktop passes both false: the
// map is pinned in its own column instead (mapSectionHTML(), called once
// either way — never twice in the same render()), and the cards live in the
// other tab entirely, not in this column at all.
function textSectionsHTML(S, opts = {}) {
  const regionRows = E.SCORED_REGIONS.map((r) => { const R = E.REGIONS[r]; return [esc(lang === "en" ? R.en : R.zh), R.presence, R.domination, R.control, E.spacesOf(r).filter((id) => E.SPACE[id].battleground).length]; });
  return `<h1>${esc(S.title)}</h1><p>${esc(S.intro)}</p>` +
    `<h2 id="sec-ends">${esc(S.ends)}</h2>${table([], S.endsRows.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}` +
    `<h2 id="sec-board">${esc(S.board)}</h2><p>${esc(S.boardText)}</p>${opts.inlineMap ? mapSectionHTML(S) : ""}` +
    `<h2 id="sec-control">${esc(S.control)}</h2><p>${esc(S.controlText)}</p>` +
    `<h2 id="sec-uses">${esc(S.uses)}</h2>${table([], S.usesRows.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}` +
    `<h2 id="sec-tracks">${esc(S.tracks)}</h2><p>${esc(S.weariness)}</p><p>${esc(S.reformText)}</p>${table(S.reformHead, S.reformRows.map((r) => r.map(esc)))}` +
    `<h2 id="sec-special">${esc(S.special)}</h2><p>${esc(S.specialText)}</p>` +
    `<h2 id="sec-turn">${esc(S.turn)}</h2><p>${esc(S.turnEras)}</p><ol class="turn-steps">${S.turnSteps.map(([t, b]) => `<li><b>${esc(t)}:</b> ${esc(b)}</li>`).join("")}</ol>` +
    `<h2 id="sec-scoring">${esc(S.scoring)}</h2><p>${esc(S.scoringText)}</p>${table(S.scoringHead, regionRows)}` +
    (opts.withCards ? `<h2 id="sec-cards">${esc(S.cards)}</h2><p>${esc(S.remove)}</p>${cardList(S, NAV[lang], CARD_EN)}` : "");
}

// #44: the desktop 規則 tab — rail (left) + text (middle, no inline map, no
// cards section) + the map pinned (right). Three real sibling divs so the
// grid's default stretch-alignment gives the rail/map columns the tall
// box .d-sticky needs (see rules-desktop.css's own note).
function rulesTabDesktopHTML(S, N) {
  return `<div class="d-tab-grid d-rules-grid">` +
    `<div class="d-col d-rail-col"><nav class="d-sticky d-rail" id="dRail" aria-label="${esc(S.title)}">${railHTML(N)}</nav></div>` +
    `<div class="d-col d-text-col">${textSectionsHTML(S, { inlineMap: false, withCards: false })}</div>` +
    `<div class="d-col d-map-col"><div class="d-sticky d-map-pinned">${mapSectionHTML(S)}</div></div>` +
    `</div>`;
}
// #44: the desktop 七十二張牌 tab — rail (search + counted era/side lists)
// + the grid (cardList(), withFilters:false — the rail already drew its
// own version of the search box/filters) + the chosen card, drawn by
// card-view.js's renderCardView() (#dCardPanel, filled in by renderDetail()
// right after this markup lands, same as the mobile overlay/#35).
function cardsTabDesktopHTML(S, N, cardEn) {
  return `<div class="d-tab-grid d-cards-grid">` +
    `<div class="d-col d-rail-col"><div class="d-sticky d-cards-rail" id="dCardsRail">${cardFiltersDesktopHTML(N)}</div></div>` +
    `<div class="d-col d-grid-col">${cardList(S, N, cardEn, { withFilters: false })}</div>` +
    // renderCardView() below overwrites its container's own className
    // wholesale (it's shared with the table's read-only peek, which has no
    // reason to know about this wrapper) — #dCardPanel has to stay a plain
    // ancestor, one level up, so its own "d-sticky d-card-panel" classes
    // (rules-desktop.css's scoping for the overlay-position override) never
    // get wiped by that assignment.
    `<div class="d-col d-panel-col"><div class="d-sticky d-card-panel" id="dCardPanel"><div id="dCardPanelInner"></div></div></div>` +
    `</div>`;
}

function updateTabsUI(N) {
  const tR = $("tabRules"), tC = $("tabCards");
  if (!tR || !tC) return;
  tR.textContent = N.rules.tabs.rules; tC.textContent = N.rules.tabs.cards;
  tR.classList.toggle("active", activeTab === "rules"); tC.classList.toggle("active", activeTab === "cards");
  tR.setAttribute("aria-pressed", String(activeTab === "rules")); tC.setAttribute("aria-pressed", String(activeTab === "cards"));
}

function render() {
  const S = T[lang];
  const N = NAV[lang];
  document.documentElement.lang = lang;
  $("backLink").textContent = N.nav.back;
  $("barMid").textContent = N.landing.rulesLink;
  $("langBtn").textContent = N.nav.lang;
  $("credit").textContent = S.credit;
  updateTabsUI(N);
  // Read fresh every render(): the bar's own height can change with the
  // language (line-wrapped labels) or the viewport, and rules-desktop.css's
  // sticky rail/map/panel (top/max-height) key off this var too.
  const barH = document.querySelector(".bar")?.getBoundingClientRect().height || 0;
  document.documentElement.style.setProperty("--bar-h", barH + "px");
  if (isDesktopScroller()) {
    $("rulesBody").innerHTML = activeTab === "cards" ? cardsTabDesktopHTML(S, N, CARD_EN) : rulesTabDesktopHTML(S, N);
  } else {
    $("rulesBody").innerHTML = rulesNavHTML(S) + textSectionsHTML(S, { inlineMap: true, withCards: true });
  }
  fitRulesMap();
  applyCardFilters(); // #40: reapply the reader's search/era/side filters onto the freshly-drawn rows
  if (isDesktopScroller()) updateActiveRail();
  else updateActiveNavChip(); // #40: re-highlight the section chip for wherever the reader already was
  renderDetail(); // #35/#44: re-draw the open card's detail (overlay or desktop panel) in the new language/layout
}
$("langBtn").onclick = () => { lang = lang === "en" ? "zh-Hant" : "en"; try { localStorage.setItem("zh.lang", lang); } catch {} render(); };

// #44: the two-tab pill switch — static buttons in rules.html (like
// #langBtn), wired once here rather than rebuilt every render().
function switchTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;
  // One history entry for the tab switch itself (so a single Back leaves
  // it); every card chosen afterwards inside the cards tab replaces this
  // same entry instead of stacking its own (see openCardDetail() below).
  const hash = tab === "cards" ? (openCardId ? "#card-" + openCardId : "#cards") : "";
  history.pushState(null, "", location.pathname + location.search + hash);
  render();
}
$("tabRules")?.addEventListener("click", () => switchTab("rules"));
$("tabCards")?.addEventListener("click", () => switchTab("cards"));

// #35: the card detail page, opened by tapping a row in the 72-card table
// (cardRow()/cardList() above) — drawn by the same card-view.js module the
// table's own read-only peek sheet (#34) uses, so a rules-page detail and a
// table peek can never drift apart. #cardDetail is a sibling of #rulesBody
// (never touched by render()'s innerHTML replace above) so it survives a
// language switch and every re-render.
const CARD_IDS = new Set([...E.CARDS.map((c) => c.id), E.JIUDING]);
let openCardId = null;
// True only while the CURRENTLY open card was reached by loading the page
// with its hash already in the address bar (no click happened this
// session) — in that one case there is no history entry of ours to pop, so
// Close must clear the hash outright instead of calling history.back()
// (which could leave the site: #35's own falsifiable case). #44: desktop's
// card panel has no Close button, so this flag only ever matters below
// 1024px, same as before this issue.
let cameFromHash = false;

function refreshDetailLock(open) {
  document.body.classList.toggle("sheet-open", open);
  if (open) {
    const barH = document.querySelector(".bar")?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--bar-h", barH + "px");
  }
}
// >=1024px, `.page-card` is the thing that scrolls the (long) rules content
// (desktop.css) — a CSS-only `position: absolute` overlay would have that
// same `.page-card` as its containing block and scroll away with the text
// underneath it instead of staying put (measured while building this: the
// overlay landed thousands of px off screen after scrolling the list first).
// Pinning it with `position: fixed` and an inline rect taken fresh off
// `.page-card`'s own box — which doesn't move just because ITS content
// scrolls — sidesteps that without touching the existing scroll behaviour
// at all. Below 1024px `.page-card` is `display: contents` (no box of its
// own) and the mobile `.sheet.overlay` CSS (fixed, full window below the
// bar) already does the right thing untouched, so this clears any inline
// override back to that. #44: only ever called for the MOBILE overlay now
// (renderDetail() below never calls this on desktop, where #cardDetail
// doesn't even get filled in — the card lives in #dCardPanel instead).
function positionDetailOverlay() {
  const el = $("cardDetail");
  if (el.hidden) return;
  if (window.matchMedia("(min-width: 1024px)").matches) {
    const r = $("pageCard").getBoundingClientRect();
    Object.assign(el.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", right: "auto", bottom: "auto" });
  } else {
    Object.assign(el.style, { position: "", left: "", top: "", width: "", height: "", right: "", bottom: "" });
  }
}
window.addEventListener("resize", positionDetailOverlay);
// #44: on desktop this fills #dCardPanel (inside the cards tab, if that's
// the tab showing) instead of the mobile overlay — same renderCardView()
// call either way, so the history/source text can never drift between the
// two. Off desktop this is exactly #35/#40's own function, untouched.
function renderDetail() {
  if (isDesktopScroller()) {
    const panel = $("dCardPanelInner");
    if (!panel) return; // the 規則 tab is showing: no cards panel mounted at all
    if (!openCardId) { panel.className = ""; panel.innerHTML = `<p class="d-card-hint">${esc(NAV[lang].rules.pickHint)}</p>`; return; }
    renderCardView(panel, openCardId, lang, {});
    return;
  }
  const el = $("cardDetail");
  if (!openCardId) { el.hidden = true; el.innerHTML = ""; refreshDetailLock(false); return; }
  el.hidden = false;
  refreshDetailLock(true);
  renderCardView(el, openCardId, lang, { onClose: closeCardDetail });
  positionDetailOverlay();
}
// #44: on desktop, choosing a card always switches to the cards tab (tiles
// only ever appear there) and replaces the address (never stacks a history
// entry per card — switchTab() above already pushed the one entry for
// entering the tab itself). `fromHash` (a deep link/initial load) never
// touches history at all, same rule as mobile.
function openCardDetail(id, fromHash = false) {
  if (!CARD_IDS.has(id)) return;
  openCardId = id;
  cameFromHash = fromHash;
  if (isDesktopScroller()) {
    const enteringTab = activeTab !== "cards";
    activeTab = "cards";
    render();
    scrollTileIntoView(id);
    if (!fromHash) {
      if (enteringTab) history.pushState(null, "", "#card-" + id);
      else history.replaceState(null, "", "#card-" + id);
    }
    return;
  }
  renderDetail();
  if (!fromHash) location.hash = "#card-" + id;
}
function closeCardDetail() {
  if (cameFromHash) {
    openCardId = null; cameFromHash = false;
    renderDetail();
    history.replaceState(null, "", location.pathname + location.search);
  } else if (location.hash.startsWith("#card-")) {
    history.back(); // triggers the hashchange listener below, which closes it
  } else {
    openCardId = null;
    renderDetail();
  }
}
// #40 (found while testing the new side filter, not part of its brief —
// noted in the hand-in): this pattern excluded "_", so opening one of the
// five scoring cards (ids like score_jin) via openCardDetail()'s own
// location.hash write immediately failed this same regex on the very
// hashchange that write triggers, closing the sheet right back — a
// pre-existing bug in this file, unrelated to card-view.js/the table.
// #44: desktop additionally recognises a bare "#cards" (the tab, nothing
// chosen yet) and otherwise falls back to the 規則 tab — but only when
// isDesktopScroller() is true; below 1024px this is exactly #40's own
// listener, untouched, so mobile's Back/hash behaviour cannot have changed.
window.addEventListener("hashchange", () => {
  const m = /^#card-([a-z0-9_]+)$/.exec(location.hash);
  if (isDesktopScroller()) {
    if (m && CARD_IDS.has(m[1])) { openCardId = m[1]; cameFromHash = true; activeTab = "cards"; render(); scrollTileIntoView(m[1]); }
    else if (location.hash === "#cards") { activeTab = "cards"; openCardId = null; render(); }
    else { activeTab = "rules"; openCardId = null; render(); }
    return;
  }
  if (m && CARD_IDS.has(m[1])) { openCardId = m[1]; cameFromHash = false; renderDetail(); }
  else if (openCardId) { openCardId = null; renderDetail(); }
});
{
  const el = document.createElement("section");
  el.id = "cardDetail";
  el.hidden = true;
  $("rules").appendChild(el);
}
// One delegated listener on the table's own container, rather than one per
// row: cardList() rebuilds all 72 rows on every render() (language switch),
// so a per-row listener would need re-attaching every time too. #40 folds
// the section-nav chips and the era/side filter chips into the same
// listener for the same reason (both are also rebuilt by every render()).
// #44 folds in the desktop rail's section items too (.d-rail-item), which
// are rebuilt on every render() same as everything else here.
$("rulesBody").addEventListener("click", (ev) => {
  const cardBtn = ev.target.closest(".cardrow[data-card]");
  if (cardBtn) { openCardDetail(cardBtn.dataset.card); return; }
  const navBtn = ev.target.closest(".nav-chip[data-sec]");
  if (navBtn) {
    if (navBtn.dataset.sec === "top") scrollRulesToTop();
    else scrollSectionIntoView(navBtn.dataset.sec);
    updateActiveNavChip(); // don't wait on a `scroll` event that may not fire (see file-top note)
    scrollChipIntoView(navBtn); // "Top ↑" itself: the one chip updateActiveNavChip() never marks active
    return;
  }
  const railBtn = ev.target.closest(".d-rail-item[data-sec]");
  if (railBtn) {
    scrollToSectionDesktop(railBtn.dataset.sec);
    updateActiveRail(); // same reasoning as updateActiveNavChip() above: don't wait on `scroll`
    return;
  }
  const filterBtn = ev.target.closest(".filter-chip[data-filter]");
  if (filterBtn) {
    if (filterBtn.dataset.filter === "era") filterEra = filterBtn.dataset.value;
    else filterSide = filterBtn.dataset.value;
    filterBtn.parentElement.querySelectorAll(".filter-chip").forEach((b) => b.classList.toggle("active", b === filterBtn));
    applyCardFilters();
  }
});
// #40: search-as-you-type. Delegated (not re-attached per render()) and
// kept to applyCardFilters() only — never render() — so typing doesn't lose
// the input's own focus/cursor position on every keystroke.
$("rulesBody").addEventListener("input", (ev) => {
  if (ev.target.id === "cardSearch") { filterSearch = ev.target.value; applyCardFilters(); }
});

// #44: a full render() re-layouts the page (mobile column vs. the desktop
// tabs are different DOM entirely), so crossing the 1024px breakpoint has
// to trigger one — cheap enough (it's already what a language switch does)
// and only fires on the actual crossing, not every tick. Wired to BOTH
// matchMedia's own "change" event AND a plain `window.resize` listener,
// deduped by wasDesktop: measured while building this, this pane's own
// devtools-style viewport override changes window.innerWidth and
// matchMedia().matches correctly but fires NEITHER event at all, so anyone
// relying on only one of the two here could pass a fresh-load check at
// every size and still show a stale layout after a LIVE resize in whatever
// harness actually drives one of them. fitRulesMap()/positionDetailOverlay
// () (each already has its own `resize` listener) keep handling
// in-breakpoint resizes (e.g. the map's own narrower-desktop shrink)
// without a full rebuild.
let wasDesktop = isDesktopScroller();
function onBreakpointChange() {
  const now = isDesktopScroller();
  if (now !== wasDesktop) { wasDesktop = now; render(); }
}
matchMedia("(min-width: 1024px)").addEventListener("change", onBreakpointChange);
window.addEventListener("resize", onBreakpointChange);

// #44: the initial hash is read BEFORE the first render() (not after, the
// way #35 originally did it for the mobile-only overlay) so that on
// desktop the very first paint already has the right tab/card — building
// the rules tab and then immediately throwing it away for the cards tab
// would be wasted work and, worse, briefly wrong DOM for anything checking
// synchronously. "#card-<id>" opens that card (and, on desktop, its tab);
// a bare "#cards" opens the tab with nothing chosen; anything else leaves
// the 規則 tab as the default, same as before this issue.
{
  const m = /^#card-([a-z0-9_]+)$/.exec(location.hash);
  if (m && CARD_IDS.has(m[1])) {
    openCardId = m[1]; cameFromHash = true;
    if (isDesktopScroller()) activeTab = "cards";
  } else if (location.hash === "#cards" && isDesktopScroller()) {
    activeTab = "cards";
  }
}
render();
if (isDesktopScroller() && openCardId) scrollTileIntoView(openCardId);
