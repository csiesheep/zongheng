// The rules page, built from the same data the engine plays by, so the card
// table can never drift from the deck. Prose is plain on purpose.
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";
import {
  DESIGN_W, DESIGN_H, NODE_POS, regionMembers, isCapital,
  renderRegionBlobs, renderRoads, REGION_LABEL_POS, NODE_ANCHOR, nodeLabelHTML,
  stabilityTagHTML, NODE_STAB_RIGHT, NODE_STAB_HI, stateTagHTML,
} from "./map-draw.js";
import { renderCardView, cardHeader } from "./card-view.js";
import { discParts } from "./disc-view.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let lang = (new URLSearchParams(location.search).get("lang") || (() => { try { return localStorage.getItem("zh.lang"); } catch { return null; } })() || ((navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));
if (!["en", "zh-Hant"].includes(lang)) lang = "en";
const spaceName = (id) => (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh);
const stateName = (id) => (id ? (lang === "en" ? E.STATES[id].en : E.STATES[id].zh) : ""); // #95: state tag title/aria
// Same regionShort table app.js's map uses (see its own comment on this
// function) — zh's used to fall back to E.REGIONS[r].zh, which is why the
// owner's "regionShort.zhou: 周室→周" (#26 追加(2)) needed this read fixed
// too, not just the i18n key: the old fallback would have kept showing
// "周室" here no matter what regionShort.zhou said.
const regionShortName = (r) => (lang === "en" ? en.regionShort[r] : zh.regionShort[r]);

// #99 item 6: the back link used to always go to "./" (the landing), even
// when the page was opened from a running game via play.html's own
// #rulesLink (target="_blank"). play.html's link now adds ?from=play; that's
// the only reliable signal (its `rel="noopener"` means window.opener is
// null in this tab, per spec — so it can't be used here despite being the
// first thing that comes to mind). window.opener is still checked as a
// belt-and-suspenders fallback in case some other caller ever opens this
// page without noopener.
let fromGame;
try { fromGame = new URLSearchParams(location.search).get("from") === "play" || !!window.opener; } catch { fromGame = false; }

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
    mapAlt: "地圖:26 個據點分屬五個記分區與周,每個據點旁的小方籤標著它的安定值,★ 是要衝,方形圓盤是國都;屬於五國之一的 14 個據點,還帶著一個彩色小方籤,籤上一字標著所屬國(韓、魏、趙、齊、燕)。",
    mapLegend: "★ 要衝　▢ 國都　籤上的數字 = 安定值　色塊 = 記分區　小方籤:所屬國(韓 魏 趙 齊 燕)",
    control: "影響力與控制",
    controlText: "控制 = 我方影響力 ≥ 對方影響力 + 安定值。任一方在任一據點最多安定值 + 2 點,多的消失。",
    uses: "一張牌的五種用法",
    usesRows: [["事件", "照牌面做。用行動點打出對手陣營的牌時,對手的事件仍然觸發,你決定事件先或行動點先。"], ["放置", "每 1 點行動點放 1 點影響力,只能放在已有自己影響力的據點,或與自己控制的據點相鄰處;目標由對手控制時每點花 2,逐點判定。"], ["征伐", "花 X 點對一個有對手影響力的據點:先移除對手 min(X, 其影響力),剩下的放為自己的(不受相鄰限制)。目標是要衝則疲敝軌前進 1。受疲敝封鎖。"], ["遊說", "局勢 = 我方控制的相鄰據點數 − 對方控制的相鄰據點數。移除對手 min(X, 局勢) 點。不動疲敝、不受封鎖。"], ["變法", "棄掉行動點 ≥ 門檻的牌,變法軌前進 1;每回合 1 次(到第 2 格後 2 次)。"]],
    tracks: "疲敝軌與變法軌",
    weariness: "疲敝軌:承平 5 → 兵連 4 → 禍結 3 → 民困 2 → 土崩 1。要衝征伐推 1;每回合結算回復 1。封鎖(只限征伐):兵連以下不可征伐本土(西土、南方);禍結以下再加上三晉與周;民困時任何要衝都不可。推到土崩者立刻敗北,推進者是正在行動的玩家。",
    reformText: "變法軌 6 格,先到者得分,解鎖是重點:",
    reformRows: E.REFORM.map((r) => [String(r.box), r.zh, String(r.ops), `${r.first} / ${r.second}`, { null: "無", twice: "每回合可推進變法 2 次", campaign: "每回合一次,一次征伐 +1", peek: "標題階段對手先亮牌", discard: "回合結算時可棄 1 張牌而不觸發事件", emperor: "到達時疲敝軌後退 1" }[r.perk]]),
    reformHead: ["格", "名稱", "門檻", "先到 / 後到", "解鎖"],
    special: "九鼎與洛邑",
    // #91: 滅/相印 的完整規則與例子移到新分節「滅國與相印」(mieSectionHTML);
    // 這裡只留九鼎與洛邑本身的一句話摘要,例子見下方 specialExtrasHTML()。
    specialText: "九鼎:4 點行動點,全部用在三晉或周視為 5;只能放置、征伐、遊說;用後蓋著交給對手,對方下回合起可用;開局由楚持有。洛邑:每回合結算時控制者天命 +1,直到「秦滅周」。",
    mie: "滅國與相印",
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
    mapAlt: "A map of the 26 spaces across five scoring regions and Zhou; a small tag beside each space's disc carries its stability number, a star marks a battleground, and a square disc marks a state capital. The 14 spaces belonging to one of the five states also carry a small coloured square tag naming that state (Han, Wei, Zhao, Qi, Yan).",
    mapLegend: "★ battleground　▢ capital　the tag's number = stability　colour = scoring region　small square tag = the state it belongs to (Han/Wei/Zhao/Qi/Yan)",
    control: "Influence and control",
    controlText: "Control = your influence ≥ theirs + stability. Nobody holds more than stability + 2 in a space; the excess is lost.",
    uses: "A card's five uses",
    usesRows: [["Event", "Do what it says. When you spend an enemy card for ops its event happens too; you choose event first or ops first."], ["Place", "1 op per point, where you already have influence or next to a space you control; 2 per point into a space the enemy controls, re-priced point by point."], ["Campaign", "Spend X ops on a space with enemy influence: remove up to X of theirs, place the rest of yours (no adjacency needed). A battleground tires the realm by one. Locked by weariness."], ["Lobby", "Edge = your controlled neighbours minus theirs. Remove min(X, edge) enemy points. Never tires, never locked."], ["Reform", "Discard a card of at least the threshold to climb one box; once a turn (twice from box 2)."]],
    tracks: "Weariness and reform",
    weariness: "Weariness: Peace 5 → War 4 → Strife 3 → Misery 2 → Collapse 1. A battleground campaign costs 1; the realm recovers 1 at the end of each turn. Locks (campaigns only): at War or below no campaigns in the homes (West, South); at Strife or below none in the Three Jin or Zhou either; at Misery none in any battleground. Pushing to Collapse loses at once; the pusher is whoever is acting.",
    reformText: "The reform track has six boxes; the first to arrive scores, and the unlocks are the point:",
    reformRows: E.REFORM.map((r) => [String(r.box), r.zh, String(r.ops), `${r.first} / ${r.second}`, { null: "none", twice: "two reform advances a turn", campaign: "once a turn, one campaign gets +1 op", peek: "the other side reveals its headline first", discard: "at the turn's end, discard one card without its event", emperor: "weariness recovers one box on arrival" }[r.perk]]),
    reformHead: ["Box", "Name", "Ops needed", "First / second", "Unlock"],
    special: "The Nine Cauldrons and Luoyi",
    // #91: destruction/seals' full rules and examples moved to the new
    // "Destruction & Seals" section (mieSectionHTML); this stays a one-line
    // summary of the Cauldrons and Luoyi themselves — examples in
    // specialExtrasHTML() below.
    specialText: "The Nine Cauldrons: 4 ops, 5 if all of it lands in the Three Jin or Zhou; place, campaign or lobby only; then it passes face down and the other side may use it from the next turn; Chu holds it at the start. Luoyi: its controller gains 1 Mandate at the end of each turn, until Qin Ends the Zhou.",
    mie: "Destruction & Seals",
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

// #91: illustrated figures for "a card's five uses" and the new 滅國/相印
// section, plus the owner's follow-up on 九鼎/洛邑. Every number is computed
// HERE, at page load, by calling the real engine (public/shared/engine.js) —
// never typed by hand — so the page can't drift from the rules. `discHTML`
// below is a faithful copy of app.js's own function of the same name (app.js
// has import-time side effects that wire up the whole play page, so rules.js
// can never import it directly — see this file's own top note on why
// map-draw.js is shared but app.js is not); everything else here is new.
const { QIN, CHU } = E;
function discHTML(parts, cap) {
  const base = "disc" + (cap ? " sq" : "");
  if (parts.kind === "empty") return `<span class="${base}"></span>`;
  if (parts.kind === "lone") {
    const side = parts.side === QIN ? "q" : "c";
    const cls = `${base} lone-${side}${parts.controlled ? " ctl" : ""}`;
    return `<span class="${cls}"><i>${parts.n}</i></span>`;
  }
  const cls = `${base} split${parts.qin.controlled ? " ctl-q" : ""}${parts.chu.controlled ? " ctl-c" : ""}`;
  return `<span class="${cls}"><i class="q">${parts.qin.n}</i><i class="c">${parts.chu.n}</i></span>`;
}
// #90 landed on origin/main while this branch was in progress (style.css's
// `.node .seal-chop`, app.js's own markup): the exact same class and inner
// span, reused byte for byte — no separate figure-only copy needed.
function sealChopHTML(sealed) {
  return sealed ? `<span class="seal-chop" aria-hidden="true"><span lang="zh-Hant">印</span></span>` : "";
}
// A cropped slice of the real map: only `ids`, their own roads (both ends in
// `ids`) and region tint (region blobs, restricted to the members that are
// also in `ids`) — same geometry/scale/markup the full map and the game
// table use (map-draw.js, discHTML above), just windowed to a bounding box
// around `ids` (in DESIGN_W/DESIGN_H design px) instead of the whole board.
// `st` is the already-computed engine state for this half of the pair (the
// "before" or "after" clone); `capNote`, when given, is the id of a state
// whose destroyed/sealed plate this crop should carry (滅國/相印 figures).
function figCropBBox(ids, pad = 34) {
  const xs = ids.map((id) => NODE_POS[id][0]), ys = ids.map((id) => NODE_POS[id][1]);
  const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad);
  const x1 = Math.min(DESIGN_W, Math.max(...xs) + pad), y1 = Math.min(DESIGN_H, Math.max(...ys) + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function figRoadsHTML(ids) {
  const set = new Set(ids), seen = new Set();
  let svg = `<svg class="roads" viewBox="0 0 ${DESIGN_W} ${DESIGN_H}">`;
  for (const sp of E.SPACES) {
    if (!set.has(sp.id)) continue;
    for (const nb of sp.adj) {
      if (!set.has(nb)) continue;
      const key = [sp.id, nb].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const [x1, y1] = NODE_POS[sp.id], [x2, y2] = NODE_POS[nb];
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
    }
  }
  return svg + `</svg>`;
}
function figCropHTML(st, ids, lang0 = lang) {
  const box = figCropBBox(ids);
  const members = {};
  for (const [r, list] of Object.entries(regionMembers())) { const f = list.filter((id) => ids.includes(id)); if (f.length) members[r] = f; }
  const nodes = ids.map((id) => {
    const sp = E.SPACE[id];
    const [x, y] = NODE_POS[id];
    const cap = isCapital(id);
    const [q, c] = E.infOf(st, id), ctl = E.controller(st, id);
    const seal = cap && sp.state && st.seals[sp.state];
    const mie = sp.state && st.mie[sp.state];
    const cls = "node" + (sp.battleground || cap ? " big" : "");
    const name = lang0 === "en" ? sp.en : sp.zh;
    return `<div class="${cls}" style="left:${x}px;top:${y}px">` +
      discHTML(discParts(q, c, ctl), cap) + sealChopHTML(seal) +
      stabilityTagHTML(sp) + nodeLabelHTML(id, name, lang0, esc) +
      (mie ? `<span class="fig-mie-plate">${esc(lang0 === "en" ? "Destroyed" : "滅")}</span>` : "") +
      `</div>`;
  }).join("");
  return `<div class="fig-crop" data-x="${box.x}" data-y="${box.y}" data-w="${box.w}" data-h="${box.h}">` +
    `<div class="fig-crop-inner" style="width:${DESIGN_W}px;height:${DESIGN_H}px">${figRoadsHTML(ids)}${renderRegionBlobs(members)}${nodes}</div></div>`;
}
// Same scale rule as fitRulesMap() (main map), applied to every `.fig-crop`
// on the page: scale = box.clientWidth / its own cropped width (data-w), so
// a crop this wide always renders true-size discs/text regardless of how
// many design px its own bounding box happens to cover.
function fitFigureCrops() {
  document.querySelectorAll(".fig-crop").forEach((box) => {
    const inner = box.querySelector(".fig-crop-inner");
    if (!inner) return;
    const x = +box.dataset.x, y = +box.dataset.y, w = +box.dataset.w, h = +box.dataset.h;
    const scale = box.clientWidth / w;
    box.style.aspectRatio = `${w} / ${h}`;
    inner.style.transform = `translate(${-x * scale}px, ${-y * scale}px) scale(${scale})`;
  });
}
window.addEventListener("resize", fitFigureCrops);

// #40: section chips (sticky nav) — one entry per h2 rendered by
// textSectionsHTML(), in the exact order they appear there. "top" isn't a
// section; it's the fixed last chip that scrolls back to the very top of
// the page (mobile-only — #44's desktop rail has no such chip).
const NAV_SECTIONS = ["ends", "board", "control", "uses", "tracks", "special", "mie", "turn", "scoring", "cards"];
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

// #91: every before/after pair for "a card's five uses" and the new 滅國/
//相印 (+ 九鼎/洛邑) sections, computed once at module load by calling the
// real engine — `E.createGame` for the board, then the same pure functions
// the table itself plays through (`E.campaign`, `E.lobby`, `E.placePoints`,
// `E.reformAdvance`, `E.checkMarkers`, a card's own `effect`) on a state
// whose `inf`/`weariness`/`reform` fields are set directly first, exactly as
// the brief's own bullet allows ("set inf, seals, mie, weariness and reform
// as needed"). No number below is typed twice: `before` and `after` are both
// read back off the real state after the call, in the report and in the
// page.
const base = () => E.createGame(1);
const EX = {};
// 2. 放置: 秦 controls 函谷關 (hangu, ctl via 3>=0+3); 洛邑 (luoyi) is
// 楚-controlled (3>=0+3) and adjacent to hangu, so placing there costs 2/pt
// (E.placeCost). 3 ops: 宜陽 (adjacent to hangu, empty, cost 1) + 洛邑 (cost 2).
{
  const b = base(); b.inf.hangu = [3, 0]; b.inf.luoyi = [0, 3];
  const a = E.clone(b); const spent = E.placePoints(a, QIN, ["yiyang", "luoyi"], 3);
  EX.place = { ids: ["hangu", "yiyang", "luoyi"], before: b, after: a, spent };
}
// 3. 征伐: 秦 campaigns 大梁 (★battleground, wei) with 3 ops; 楚 has 2 there.
{
  const b = base(); b.inf.daliang = [0, 2];
  const a = E.clone(b); const res = E.campaign(a, QIN, "daliang", 3);
  EX.campaign = { ids: ["handan", "daliang", "song"], before: b, after: a, res };
}
// 4. 遊說: 秦 controls 河東/中山 (2 neighbours of 邯鄲, one from 魏 one from
// 趙 — NOT both of 魏's own two spaces, which would accidentally trigger
// 滅國 as a side effect of E.lobby's own E.checkMarkers call, caught while
// screenshot-checking this branch: the first draft used 河東+大梁, 魏's
// only two spaces, and a stray "滅"/Destroyed plate showed up on this
// example's own crop), 楚 controls 上黨 (1 neighbour, 趙);
// edge = E.edge(st, QIN, "handan") = 2 - 1 = 1. 2 ops.
{
  const b = base(); b.inf.hedong = [2, 0]; b.inf.zhongshan = [2, 0]; b.inf.shangdang = [0, 2]; b.inf.handan = [0, 1];
  const e = E.edge(b, QIN, "handan");
  const a = E.clone(b); const removed = E.lobby(a, QIN, "handan", 2);
  EX.lobby = { ids: ["hedong", "shangdang", "zhongshan", "handan"], before: b, after: a, edge: e, removed };
}
// 1. 事件: 商鞅變法 (shangyang)'s own effect(st) — reformAdvance(Qin,1) plus
// a +1-ops-all-Qin-cards effect for the turn (E.CARD.shangyang.effect).
{
  const b = base(); const a = E.clone(b); E.CARD.shangyang.effect(a);
  EX.event = { before: b, after: a };
}
// 5. 變法: 收復河西 (hexi, ops 2) meets REFORM[0].ops (2) — discard, advance.
{
  const b = base(); b.hands[QIN].push("hexi");
  const threshold = E.reformThreshold(b, QIN);
  const a = E.clone(b); E.discardCard(a, QIN, "hexi", { noEvent: true }); E.reformAdvance(a, QIN, 1);
  EX.reform = { before: b, after: a, threshold };
}
// 6. 滅韓: 秦 already controls 宜陽; campaigns 新鄭 with 4 ops (楚 has 2) —
// both 韓 spaces (E.STATES.han via E.spacesOfState) end Qin-controlled, so
// E.campaign's own E.checkMarkers() call marks 滅 and scores E.STATES.han.vp.
{
  const b = base(); b.inf.yiyang = [2, 0]; b.inf.xinzheng = [0, 2];
  const a = E.clone(b); const res = E.campaign(a, QIN, "xinzheng", 4);
  EX.mieHan = { ids: ["yiyang", "xinzheng"], before: b, after: a, res };
}
// 7. 趙 still missing 代: 上黨/邯鄲/中山 Qin-controlled, 代 Chu-controlled —
// one static crop, no action; E.checkMarkers confirms st.mie.zhao stays unset.
{
  const st = base(); st.inf.shangdang = [2, 0]; st.inf.handan = [2, 0]; st.inf.zhongshan = [2, 0]; st.inf.dai = [0, 3];
  E.checkMarkers(st);
  EX.zhaoMissing = { ids: ["shangdang", "handan", "zhongshan", "dai"], st };
}
// 8. 相印 three capitals: 新鄭 (cap 4, 楚 4 → sealed), 大梁 (cap 4, 楚 3 →
// 差 1), 臨淄 (cap 5, 楚 4 → 差 1). E.capOf/E.checkMarkers, nothing hand-typed.
{
  EX.seals = ["xinzheng", "daliang", "linzi"].map((id, i) => {
    const st = base(); st.inf[id] = [0, [4, 3, 4][i]];
    E.checkMarkers(st);
    return { id, st, cap: E.capOf(st, id), inf: st.inf[id][CHU] };
  });
}
// 9. 失印/復國: checkMarkers' own two lines —
// "if (st.seals[id] && capCtl === QIN) delete st.seals[id]" and
// "if (st.mie[id] && capCtl === CHU) delete st.mie[id]" — both key off
// controlling the CAPITAL, nothing else. (a) 秦 removes some 楚 influence
// from a sealed 新鄭 (楚 4 → 3) without taking control (still 楚, stability
// 2): capCtl stays CHU, so the seal stays — the owner's own report (臨淄:
// 楚 2, cap 5, nobody in control) is the same rule one step further (capCtl
// is neither QIN nor CHU there, so neither line fires; 相印 is unaffected by
// influence alone, only by who holds the capital). (b) 秦 then takes control
// outright (6 ops): capCtl becomes QIN, the seal is removed.
{
  const b = base(); b.inf.xinzheng = [0, 4]; E.checkMarkers(b);
  const a = E.clone(b); const res = E.campaign(a, QIN, "xinzheng", 1);
  EX.sealKeep = { ids: ["xinzheng"], before: b, after: a, res };
  const c = E.clone(b); const res2 = E.campaign(c, QIN, "xinzheng", 6);
  EX.unseal = { ids: ["xinzheng"], before: b, after: c, res: res2 };
}
// 10. 九鼎: engine.js's own condition (doOps, the JIUDING branches) —
// "if (card === JIUDING && choice.points.every(inZhou)) ops += 1" for
// place (campaign/lobby check inZhou(choice.target) the same way) — 4 base
// ops, +1 (=5) only when every point lands in 三晉 or 周. (a) 4 points, all
// in 三晉/周: 5 ops spent. (b) one point (函谷關/hangu) outside: stays 4.
{
  const idsA = ["yiyang", "hedong", "shangdang", "luoyi"];
  const b = base(); for (const id of idsA) b.inf[id] = [0, 1];
  const a = E.clone(b); const spentA = E.placePoints(a, CHU, [...idsA, "luoyi"], 5);
  EX.jiudingA = { ids: idsA, before: b, after: a, spent: spentA };
  const idsB = ["yiyang", "hedong", "shangdang", "hangu"];
  const b2 = base(); for (const id of idsB) b2.inf[id] = [0, 1];
  const a2 = E.clone(b2); const spentB = E.placePoints(a2, CHU, idsB, 4);
  EX.jiudingB = { ids: idsB, before: b2, after: a2, spent: spentB };
}
// 11. 洛邑: controller (E.controller) gains E.options.luoyi Mandate at
// turn-end (the same read `endTurnChecks` makes); 秦滅周 (E.CARD.miezhou)
// ends it (st.luoyiYields = false) and hands Qin the Nine Cauldrons.
{
  const b = base(); b.inf.luoyi = [3, 0];
  const a = E.clone(b); const ctl = E.controller(a, "luoyi"); if (ctl != null) E.vp(a, ctl, a.options.luoyi);
  EX.luoyi = { ids: ["luoyi", "hangu", "yiyang", "xinzheng"], before: b, after: a };
  const c = E.clone(b); E.CARD.miezhou.effect(c);
  EX.miezhou = { luoyiYields: c.luoyiYields, jiudingHolder: c.jiuding.holder, mandate: c.mandate };
}
// The hand-off itself: exec()'s own "jiudingPass" case (engine.js) sets
// `st.jiuding = { holder: other(step.side), faceDown: true }` once a side
// finishes using it — mirrored here with E.other rather than a hard-coded
// side, off `E.createGame`'s own starting holder (Chu).
EX.jiudingPass = { before: { holder: CHU, faceDown: false }, after: { holder: E.other(CHU), faceDown: true } };

// #91: small building blocks the figures below share. `spName` mirrors this
// file's own spaceName() but takes an explicit language (the figures are
// built for whichever language render() is currently drawing, same `lang`
// module var either way).
const spName = (id, l) => (l === "en" ? E.SPACE[id].en : E.SPACE[id].zh);
const stName = (id, l) => (l === "en" ? E.STATES[id].en : E.STATES[id].zh);
// A before/after pair of crops with an arrow label between them (stacked on
// the phone, side by side from 1024px — rules-desktop.css), optionally
// carrying a small strip (weariness/reform/mandate) under the after crop.
function figPairHTML(ids, before, after, beforeCap, afterCap, arrow, afterExtra = "") {
  return `<div class="fig"><div class="fig-pair">` +
    `<div class="fig-half">${figCropHTML(before, ids)}<p class="fig-cap">${beforeCap}</p></div>` +
    `<div class="fig-arrow" aria-hidden="true"><span>${esc(arrow)}</span></div>` +
    `<div class="fig-half">${figCropHTML(after, ids)}<p class="fig-cap">${afterCap}</p>${afterExtra}</div>` +
    `</div></div>`;
}
function figSingleHTML(ids, st, cap) {
  return `<div class="fig"><div class="fig-half fig-solo">${figCropHTML(st, ids)}<p class="fig-cap">${cap}</p></div></div>`;
}
function figRowHTML(items) {
  return `<div class="fig"><div class="fig-row">${items.map(({ ids, st, cap }) =>
    `<div class="fig-half">${figCropHTML(st, ids)}<p class="fig-cap">${cap}</p></div>`).join("")}</div></div>`;
}
// A card face (cardHeader() from card-view.js, the same art/badge/name
// markup used everywhere else a card is shown) in a detached container, for
// the 事件/變法/九鼎 figures that need a card rather than a map crop.
function cardFigureHTML(id, l) {
  const div = document.createElement("div"); div.className = "fig-card";
  cardHeader(div, id, l);
  return div.outerHTML;
}
// Weariness: five boxes, 承平(5) down to 土崩(1), the current one lit. Names
// come from NAV[l].weariness (the same i18n table app.js's status line
// reads), not E.WEARINESS_NAMES (Chinese only, engine-internal) — a bug
// caught in this branch's own English screenshot check (the strip showed
// 承平/兵連/... under lang=en until this fix).
function wearinessStripHTML(w, l) {
  const names = NAV[l].weariness;
  const boxes = [5, 4, 3, 2, 1].map((n) => `<span class="fig-strip-box${n === w ? " on" : ""}">${esc(names[n])}</span>`).join("");
  return `<div class="fig-strip fig-weariness">${boxes}</div>`;
}
// Reform: six boxes, the side's own current box (0..6) lit.
function reformStripHTML(box, l) {
  const boxes = E.REFORM.map((r) => `<span class="fig-strip-box${r.box === box ? " on" : ""}">${r.box}</span>`).join("");
  return `<div class="fig-strip fig-reform">${boxes}</div>`;
}
// A plain "+N"/"−N" tick, used for both the mandate move and the lobby
// edge's per-neighbour ticks.
const tick = (n) => `<span class="fig-tick ${n >= 0 ? "up" : "dn"}">${n >= 0 ? "+" : ""}${n}</span>`;
// orchestrator's #91 fix: a bare "2/0" q/c pair reads as noise to anyone who
// hasn't memorised which side is first — every caption now spells out
// "秦 2"/"Qin 2", drops a side that is 0 instead of printing it, and shows
// both ("秦 1 楚 3"/"Qin 1 Chu 3") only when both sides actually have
// influence there. A space with nobody at all reads as a bare "0".
function infWords(st, id, l) {
  const [q, c] = (st.inf && st.inf[id]) || [0, 0];
  const qw = l === "en" ? "Qin" : "秦", cw = l === "en" ? "Chu" : "楚";
  const parts = [];
  if (q > 0) parts.push(`${qw} ${q}`);
  if (c > 0) parts.push(`${cw} ${c}`);
  return parts.length ? parts.join(" ") : "0";
}

// #91: one worked example per use, right under the summary table (uses table
// keeps every number from the summary text unchanged — these are additions,
// not replacements). `l` is the current language; every string here is
// picked per-language, no mixed-language line.
function usesExamplesHTML(l) {
  const zh = l !== "en";
  const T5 = zh
    ? { arrowE: "商鞅變法", capE1: `變法軌:秦 0`, capE2: `變法軌:秦 1(本回合秦所有牌 +1 行動點)`,
        noteE: "沒有事件先/事件後的差別要考慮:標題牌的事件一定發生,就算是對手陣營的牌,見上表「事件」列。",
        arrowP: "秦 放置 3", capP1: `宜陽 ${infWords(EX.place.before, "yiyang", l)} · 洛邑 ${infWords(EX.place.before, "luoyi", l)}`,
        capP2: `宜陽 +1(1 點,鄰函谷關)· 洛邑 +1(2 點,楚控制)`,
        arrowC: "秦 征伐 3", capC1: `大梁:${infWords(EX.campaign.before, "daliang", l)}`, capC2: `大梁:${infWords(EX.campaign.after, "daliang", l)}(移除 min(3,2)=2,剩 1 點落地)`,
        arrowL: "楚 遊說 2", capL1: `邯鄲:${infWords(EX.lobby.before, "handan", l)}`, capL2: `邯鄲:${infWords(EX.lobby.after, "handan", l)}`,
        edgeCap: `局勢 = 2 − 1 = 1,移除 min(2, 1) = 1`,
        arrowR: "秦 變法", capR1: `變法軌:秦 0`, capR2: `變法軌:秦 1(門檻 ${EX.reform.threshold} 點,棄牌 收復河西 2 點)`,
        noteR: "沒有事件觸發。" }
    : { arrowE: "Shang Yang's Reforms", capE1: `Reform track: Qin 0`, capE2: `Reform track: Qin 1 (+1 op on every Qin card this turn)`,
        noteE: "No event-first/ops-first choice to make here: a headline's event always happens, even for the other side's card — see the Event row above.",
        arrowP: "Qin places, 3 ops", capP1: `Yiyang ${infWords(EX.place.before, "yiyang", l)} · Luoyi ${infWords(EX.place.before, "luoyi", l)}`,
        capP2: `Yiyang +1 (1 op, next to Hangu Pass) · Luoyi +1 (2 ops, Chu-controlled)`,
        arrowC: "Qin campaigns, 3 ops", capC1: `Daliang: ${infWords(EX.campaign.before, "daliang", l)}`, capC2: `Daliang: ${infWords(EX.campaign.after, "daliang", l)} (removes min(3,2)=2, 1 left to place)`,
        arrowL: "Chu lobbies, 2 ops", capL1: `Handan: ${infWords(EX.lobby.before, "handan", l)}`, capL2: `Handan: ${infWords(EX.lobby.after, "handan", l)}`,
        edgeCap: `Edge = 2 − 1 = 1, removes min(2, 1) = 1`,
        arrowR: "Qin reforms", capR1: `Reform track: Qin 0`, capR2: `Reform track: Qin 1 (needs ${EX.reform.threshold} ops, discards Retaking Hexi's 2)`,
        noteR: "No event happens." };
  const eventFig = `<div class="fig"><div class="fig-pair">` +
    `<div class="fig-half">${cardFigureHTML("shangyang", l)}<p class="fig-cap">${esc(T5.capE1)}</p></div>` +
    `<div class="fig-arrow" aria-hidden="true"><span>${esc(T5.arrowE)}</span></div>` +
    `<div class="fig-half">${cardFigureHTML("shangyang", l)}<p class="fig-cap">${esc(T5.capE2)}</p>${reformStripHTML(1, l)}</div>` +
    `</div><p class="fig-note">${esc(T5.noteE)}</p></div>`;
  const placeFig = figPairHTML(EX.place.ids, EX.place.before, EX.place.after, esc(T5.capP1), esc(T5.capP2), T5.arrowP);
  const campaignFig = figPairHTML(EX.campaign.ids, EX.campaign.before, EX.campaign.after, esc(T5.capC1), esc(T5.capC2), T5.arrowC,
    wearinessStripHTML(EX.campaign.after.weariness, l));
  const edgeTicks = `<p class="fig-edge">${esc(T5.edgeCap)}</p>`;
  const lobbyFig = figPairHTML(EX.lobby.ids, EX.lobby.before, EX.lobby.after, esc(T5.capL1), esc(T5.capL2), T5.arrowL, edgeTicks);
  const reformFig = `<div class="fig"><div class="fig-pair">` +
    `<div class="fig-half">${cardFigureHTML("hexi", l)}<p class="fig-cap">${esc(T5.capR1)}</p></div>` +
    `<div class="fig-arrow" aria-hidden="true"><span>${esc(T5.arrowR)}</span></div>` +
    `<div class="fig-half">${cardFigureHTML("hexi", l)}<p class="fig-cap">${esc(T5.capR2)}</p>${reformStripHTML(1, l)}</div>` +
    `</div><p class="fig-note">${esc(T5.noteR)}</p></div>`;
  return eventFig + placeFig + campaignFig + lobbyFig + reformFig;
}

// #91 (owner, #91 issue): the state-space list under 滅國與相印's plain
// rules — read straight off E.STATES/E.spacesOfState, never a hand-copied
// list, so it can't drift from the board data the figures themselves use.
function stateSpacesHTML(l) {
  const zh = l !== "en";
  const rows = Object.entries(E.STATES).map(([id, s]) => {
    const spaces = E.spacesOfState(id).map((sp) => spName(sp, l) + (sp === s.capital ? (zh ? "（國都）" : " (capital)") : "")).join(zh ? "、" : ", ");
    return `<li><b>${esc(stName(id, l))}</b> ${spaces}</li>`;
  });
  return `<ul class="mie-states">${rows.join("")}</ul>`;
}
// #91: the new 滅國與相印 section — plain rules, the state list, four
// examples (6-9) and the comparison table (orchestrator's own #89 table).
function mieSectionHTML(l) {
  const zh = l !== "en";
  const rulesP = zh
    ? [`<b>滅國(秦):</b> 控制某國<b>全部</b>據點,不只國都。秦得該國天命一次(韓、魏、燕 2,趙、齊 3)。`,
       `<b>復國:</b> 楚拿回國都時解除滅國,可再滅一次,但第二次不再得分。秦同時滅三國即勝。`,
       `<b>相印(楚):</b> 控制某國<b>國都</b>且影響力達到上限(安定值 + 2)。每國一次,天命 +1。秦拿下該國都即解除。楚同時持四國相印即勝。`,
       `相印一旦取得,楚的影響力被削減、甚至掉到沒有人控制,也不會失去——只有<b>秦控制該國都</b>才會失印;滅國/復國同理,只有<b>楚控制該國都</b>才會復國,丟掉國都以外的據點不會復國。`]
    : [`<b>Destruction (Qin):</b> control <b>every</b> space of a state, not just its capital. Qin scores that state's value once (2 for Han, Wei, Yan; 3 for Zhao, Qi).`,
       `<b>Restoration:</b> Chu retaking the capital lifts the destroyed mark; it can be destroyed again, but scores nothing the second time. Qin wins on three destroyed at once.`,
       `<b>Seals (Chu):</b> control a state's <b>capital</b> with influence there at the cap (stability + 2). Once per state, +1 Mandate. Qin taking that capital removes it. Chu wins on four seals at once.`,
       `Once held, a seal survives Chu's influence there dropping, even to where nobody controls the capital — only <b>Qin controlling that capital</b> removes it. The same is true the other way for destruction/restoration: only <b>Chu controlling the capital</b> restores it; losing any other space does not.`];
  const p = rulesP.map((t) => `<p>${t}</p>`).join("");
  const han = "han", zhao = "zhao";
  const mieHanCap1 = zh ? `宜陽 ${infWords(EX.mieHan.before, "yiyang", l)} · 新鄭 ${infWords(EX.mieHan.before, "xinzheng", l)}` : `Yiyang ${infWords(EX.mieHan.before, "yiyang", l)} · Xinzheng ${infWords(EX.mieHan.before, "xinzheng", l)}`;
  const mieHanCap2 = zh ? `${stName(han, l)} · 滅,天命 秦 +${E.STATES.han.vp}（${EX.mieHan.before.mandate} → ${EX.mieHan.after.mandate}）` : `${stName(han, l)} · Destroyed, Mandate Qin +${E.STATES.han.vp} (${EX.mieHan.before.mandate} → ${EX.mieHan.after.mandate})`;
  const ex6 = figPairHTML(EX.mieHan.ids, EX.mieHan.before, EX.mieHan.after, esc(mieHanCap1), esc(mieHanCap2), zh ? "秦 征伐 新鄭,4 點" : "Qin campaigns Xinzheng, 4 ops");
  const zhaoCap = zh ? `${stName(zhao, l)}還差${spName("dai", l)}` : `${stName(zhao, l)} still needs ${spName("dai", l)}`;
  const ex7 = figSingleHTML(EX.zhaoMissing.ids, EX.zhaoMissing.st, esc(zhaoCap));
  const ex8 = figRowHTML(EX.seals.map((s) => ({
    ids: [s.id], st: s.st,
    cap: esc(`${spName(s.id, l)}: ${zh ? "楚" : "Chu"} ${s.inf}, ${zh ? "上限" : "cap"} ${s.cap}` + (s.inf < s.cap ? (zh ? `,差 ${s.cap - s.inf}` : `, short ${s.cap - s.inf}`) : (zh ? "（已得相印）" : " (sealed)"))),
  })));
  const sealBeforeCap = zh ? `新鄭:楚 ${EX.sealKeep.before.inf.xinzheng[1]}（已得相印）` : `Xinzheng: Chu ${EX.sealKeep.before.inf.xinzheng[1]} (sealed)`;
  const sealKeepCap = zh ? `新鄭:楚 ${EX.sealKeep.after.inf.xinzheng[1]},仍是楚控制——相印仍在` : `Xinzheng: Chu ${EX.sealKeep.after.inf.xinzheng[1]}, still Chu-controlled — the seal stays`;
  const ex9a = figPairHTML(EX.sealKeep.ids, EX.sealKeep.before, EX.sealKeep.after, esc(sealBeforeCap), esc(sealKeepCap), zh ? "秦 征伐 新鄭,1 點" : "Qin campaigns Xinzheng, 1 op");
  const unsealCap1 = zh ? `新鄭:楚 ${EX.unseal.before.inf.xinzheng[1]}（已得相印）` : `Xinzheng: Chu ${EX.unseal.before.inf.xinzheng[1]} (sealed)`;
  const unsealCap2 = zh ? `新鄭:秦 ${EX.unseal.after.inf.xinzheng[0]},秦控制——相印解除` : `Xinzheng: Qin ${EX.unseal.after.inf.xinzheng[0]}, Qin controls — the seal is removed`;
  const ex9b = figPairHTML(EX.unseal.ids, EX.unseal.before, EX.unseal.after, esc(unsealCap1), esc(unsealCap2), zh ? "秦 征伐 新鄭,6 點" : "Qin campaigns Xinzheng, 6 ops");
  const ex9 = ex9a + ex9b;
  const cmpHead = zh ? ["", "秦 滅國", "楚 相印"] : ["", "Qin destruction", "Chu seals"];
  const cmpRows = zh
    ? [["要佔", "全國每個據點", "國都一處"], ["要多少", "控制即可", "影響力堆到上限（安定值 +2）"], ["得分", "天命 +2 或 +3，每國一次", "天命 +1，每國一次"], ["被奪回", "楚拿回國都", "秦拿下國都"], ["勝利", "三國同滅", "四國同時相印"]]
    : [["Must hold", "every space of the state", "just the capital"], ["How much", "control is enough", "influence stacked to the cap (stability + 2)"], ["Score", "+2 or +3 Mandate, once per state", "+1 Mandate, once per state"], ["Lost when", "Chu retakes the capital", "Qin takes the capital"], ["Win", "three destroyed at once", "four seals at once"]];
  return p + stateSpacesHTML(l) + ex6 + ex7 + ex8 + ex9 + table(cmpHead, cmpRows.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]));
}

// #91 (owner's follow-up on #91): 九鼎 and 洛邑 get the same figure treatment
// inside the renamed "special" section (10: the 4-vs-5-ops rule and the
// face-down hand-off; 11: Luoyi's turn-end Mandate and the note on 秦滅周
// ending it).
function specialExtrasHTML(l) {
  const zh = l !== "en";
  const capA1 = EX.jiudingA.ids.map((id) => `${spName(id, l)} ${infWords(EX.jiudingA.before, id, l)}`).join(" · ");
  const capA2 = zh ? `全部落在三晉／周,5 點：${EX.jiudingA.ids.map((id) => `${spName(id, l)} +${EX.jiudingA.after.inf[id][1] - EX.jiudingA.before.inf[id][1]}`).join("、")}` : `all in the Three Jin/Zhou, 5 ops: ${EX.jiudingA.ids.map((id) => `${spName(id, l)} +${EX.jiudingA.after.inf[id][1] - EX.jiudingA.before.inf[id][1]}`).join(", ")}`;
  const exA = figPairHTML(EX.jiudingA.ids, EX.jiudingA.before, EX.jiudingA.after, esc(capA1), esc(capA2), zh ? "楚 九鼎（4→5）" : "Chu, the Cauldrons (4→5)");
  const capB1 = EX.jiudingB.ids.map((id) => `${spName(id, l)} ${infWords(EX.jiudingB.before, id, l)}`).join(" · ");
  const capB2 = zh ? `${spName("hangu", l)}在三晉／周之外,仍是 4 點：${EX.jiudingB.ids.map((id) => `${spName(id, l)} +1`).join("、")}` : `${spName("hangu", l)} is outside the Three Jin/Zhou, still 4 ops: ${EX.jiudingB.ids.map((id) => `${spName(id, l)} +1`).join(", ")}`;
  const exB = figPairHTML(EX.jiudingB.ids, EX.jiudingB.before, EX.jiudingB.after, esc(capB1), esc(capB2), zh ? "楚 九鼎（仍 4）" : "Chu, the Cauldrons (still 4)");
  const condNote = zh
    ? `<p class="fig-note">引擎的判定(engine.js doOps):放置要「全部」落點在三晉或周才 +1 點;征伐、遊說只看目標本身是否在三晉或周(<code>choice.points.every(inZhou)</code> / <code>inZhou(choice.target)</code>)。</p>`
    : `<p class="fig-note">The engine's own condition (engine.js's doOps): placing needs EVERY point in the Three Jin or Zhou for the +1; a campaign or lobby only checks the target itself (<code>choice.points.every(inZhou)</code> / <code>inZhou(choice.target)</code>).</p>`;
  const passCap1 = zh ? "楚持有,可用" : "Chu holds it, usable";
  const passCap2 = zh ? "蓋著交給秦,下回合起可用" : "passes face down to Qin, usable from next turn";
  const passFig = `<div class="fig"><div class="fig-pair">` +
    `<div class="fig-half">${cardFigureHTML("jiuding", l)}<p class="fig-cap">${esc(passCap1)}</p></div>` +
    `<div class="fig-arrow" aria-hidden="true"><span>${zh ? "用畢" : "after use"}</span></div>` +
    `<div class="fig-half">${cardFigureHTML("jiuding", l)}<p class="fig-cap">${esc(passCap2)}</p></div>` +
    `</div></div>`;
  const luoyiCap1 = zh ? `洛邑:秦控制,天命 ${EX.luoyi.before.mandate}` : `Luoyi: Qin controls, Mandate ${EX.luoyi.before.mandate}`;
  const luoyiCap2 = zh ? `回合結束,天命 秦 +1 → ${EX.luoyi.after.mandate}` : `end of turn, Mandate Qin +1 → ${EX.luoyi.after.mandate}`;
  const luoyiFig = figPairHTML(EX.luoyi.ids, EX.luoyi.before, EX.luoyi.after, esc(luoyiCap1), esc(luoyiCap2), zh ? "結算" : "end of turn");
  const miezhouNote = zh
    ? `<p class="fig-note">秦滅周(<code>miezhou</code>)打出後,洛邑不再給天命(<code>st.luoyiYields=false</code>);若當時秦控制洛邑,另得天命 +3,並立刻取得九鼎(不蓋著)。</p>`
    : `<p class="fig-note">Once Qin Ends the Zhou (<code>miezhou</code>) is played, Luoyi stops yielding Mandate (<code>st.luoyiYields=false</code>); if Qin controlled Luoyi at that moment it also scores +3, and takes the Nine Cauldrons at once (not face down).</p>`;
  return exA + exB + condNote + passFig + luoyiFig + miezhouNote;
}

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
// #47 (owner's ruling: a card shows ONE language, on every surface —
// card-view.js/app.js's own pages are #46, this file's two LISTS are this
// issue): `.cr-name` (this row's/tile's one visible name — before this
// issue the row's own `.cr-zh` was always Chinese and only the tile had a
// language-aware name, `.cr-tile-name`; now both use this one element,
// carrying whichever language the interface is currently in) and
// `.cr-meta` (this row's own second visible line at mobile — the ERA and
// SIDE in the interface language; before this issue it was "English name ·
// era · side", the only place the other language leaked into a visible
// row) replace `.cr-zh`/`.cr-en`. The OTHER language never enters the
// visible DOM at all now — it still lives in `data-name` (so the search
// keeps matching either name) and in the picture's own `alt` (not visible
// text) — both untouched by this issue, per its own table.
function cardRow(side, id, zhName, enLine, badge, text, era, filterSideKey, searchName, year = "") {
  const enName = enLine.split(" · ")[0];
  const meta = enLine.split(" · ").slice(1).join(" · "); // "era · side", already in the interface language (S.era/S.side)
  // #47 round 1: the "* removed from the game after its event" mark lived
  // on `zhName` alone (cardList()'s own `${esc(c.zh)}${c.remove?" *":""}`)
  // — fine while the row always showed the Chinese name, but English mode
  // (no longer showing `zhName` at all, #47) lost the mark outright. `zhName
  // `'s own trailing " *" is the one place `remove` already reaches this
  // function (no new parameter needed) — read it back off there and mirror
  // it onto whichever name is actually shown, so the mark rides along with
  // the name rather than only ever living on the Chinese one.
  const removed = / \*$/.test(zhName);
  const enNameShown = removed ? `${enName} *` : enName;
  const name = lang === "en" ? esc(enNameShown) : zhName;
  return `<button type="button" class="cardrow side-${side}" data-card="${esc(id)}" data-era="${esc(era)}" data-side="${esc(filterSideKey)}" data-name="${esc(searchName.toLowerCase())}">` +
    `<img src="art/cards/${id}.jpg" width="60" height="80" loading="lazy" alt="${esc(zhName.replace(/ \*$/, ""))} ${esc(enName)}">` +
    `<div class="cr-body">` +
    `<span class="cr-head">` +
    `<span class="cr-badge">${badge}</span>` +
    `<span class="cr-name"${lang === "en" ? "" : ' lang="zh-Hant"'}>${name}</span>` +
    `<span class="cr-year">${year}</span>` +
    `<span class="cr-meta">${esc(meta)}</span>` +
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
    // #45 round 1 / #47 item 4: the desktop tile's own line 2 is never empty
    // (the design never shows the name alone) — the year when there is one,
    // otherwise a scoring card falls back to its own era and every other
    // undated card falls back to N.rules.undated. Deliberately its OWN
    // string, not `year` above (which still only ever feeds the mobile
    // row's inline `text + year`, brackets and all, untouched): on its own
    // line the brackets are noise (owner, #47) — "前 356 年" / "356 BC",
    // the design board's own form, not "(前356)" / "(356 BC)".
    const tileYear = c.year ? (lang === "en" ? `${c.year} BC` : `前 ${c.year} 年`) : "";
    const tileLine2 = tileYear || (c.scoring ? esc(S.era[c.era]) : esc(N.rules.undated));
    return cardRow(side, c.id, zhName, enLine, c.scoring ? "–" : c.ops, text + year, c.era, filterSideKeyOf(c), `${c.zh} ${c.en}`, tileLine2);
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
  // #45 round 1: the Cauldrons' own tile line 2 — "every era" (N.rules.
  // everyEra), not a specific one, matching the same era==="" special case
  // noted above (never any of 變法期/縱橫期/兼併期 specifically).
  rows.push(cardRow("n", "jiuding", esc(zh.rules.jiuding), jiudingEnLine, jiudingOps, esc(N.rules.jiudingText), "", "neutral", `${zh.rules.jiuding} ${en.rules.jiuding}`, esc(N.rules.everyEra)));
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
    stateTagHTML(sp, stateName(sp.state), esc) +
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
// Review item 2 (#44), round 1: two bugs in one function. (1) it walked
// NAV_SECTIONS, which includes "cards" — a section that doesn't exist in
// this tab's own text column at all (see RAIL_SECTIONS' own note), so the
// loop's threshold could never be satisfied for it and the LAST real
// heading (記分/Scoring) could never win even scrolled all the way to the
// very top of the page. (2) the threshold sat right under the bar
// (~barH + 12px), so a heading only counted as "in view" once it had
// scrolled almost all the way past the top.
//
// Round 1's fix for (2) — a third of `.page-card`'s own height (266px at
// 800) — traded that bug for a new one, round 2's own report: any section
// SHORTER than that (measured: 棋盤 170px, 影響力與控制 142px) loses its own
// mark the instant its heading reaches the top, because the NEXT heading is
// already above the line too. Round 2's own rule instead: the marked
// section is the last heading at or above the bar's own bottom + 100px —
// comfortably under the shortest section's own height, so a short section
// gets its full turn at the top before the next one can outrank it. The
// bottom-of-scroll override stays (round 1's own fix, still needed: it's
// the one case no top-of-heading threshold can reach on its own, when the
// last section's own content is shorter than the threshold).
function updateActiveRail() {
  if (!isDesktopScroller() || activeTab !== "rules") return;
  const rail = $("dRail"), card = $("pageCard");
  if (!rail || !card) return;
  const atBottom = card.scrollHeight - card.scrollTop - card.clientHeight < 2;
  let activeKey;
  if (atBottom) {
    activeKey = RAIL_SECTIONS[RAIL_SECTIONS.length - 1];
  } else {
    const barH = document.querySelector(".bar")?.getBoundingClientRect().height || 0;
    const threshold = barH + 100;
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
    `<h2 id="sec-uses">${esc(S.uses)}</h2>${table([], S.usesRows.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}${usesExamplesHTML(lang)}` +
    `<h2 id="sec-tracks">${esc(S.tracks)}</h2><p>${esc(S.weariness)}</p><p>${esc(S.reformText)}</p>${table(S.reformHead, S.reformRows.map((r) => r.map(esc)))}` +
    `<h2 id="sec-special">${esc(S.special)}</h2><p>${esc(S.specialText)}</p>${specialExtrasHTML(lang)}` +
    `<h2 id="sec-mie">${esc(S.mie)}</h2>${mieSectionHTML(lang)}` +
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
  $("backLink").textContent = fromGame ? N.nav.backGame : N.nav.back;
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
  fitFigureCrops();
  applyCardFilters(); // #40: reapply the reader's search/era/side filters onto the freshly-drawn rows
  if (isDesktopScroller()) updateActiveRail();
  else updateActiveNavChip(); // #40: re-highlight the section chip for wherever the reader already was
  renderDetail(); // #35/#44: re-draw the open card's detail (overlay or desktop panel) in the new language/layout
}
$("langBtn").onclick = () => { lang = lang === "en" ? "zh-Hant" : "en"; try { localStorage.setItem("zh.lang", lang); } catch {} render(); };

// #99 item 6: opened from the game -> close this tab and return focus to
// play.html; opened any other way -> the plain href="./" already on the
// element does its normal thing, untouched. iOS Chrome (and some other
// browsers) refuse window.close() on a tab they don't consider
// script-opened (a plain <a target="_blank"> click counts as user
// navigation, not window.open()) and simply leave the tab as-is — silently,
// no error, no rejected promise to catch — so the only way to detect the
// refusal is to check, one tick later, whether we're still here.
if (fromGame) {
  const backLink = $("backLink");
  backLink.href = "play.html?resume";
  backLink.addEventListener("click", (ev) => {
    ev.preventDefault();
    window.close();
    setTimeout(() => { location.href = "play.html?resume"; }, 50);
  });
}

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
// #96 (regression from #92, owner: 「卡牌,史實顯示有錯,可縮起展開,預設縮起」):
// the rules page's own card detail — both the mobile overlay and the
// desktop #dCardPanel, same renderCardView() call either way — never passed
// a history state at all, so historyBox() (card-view.js) fell back to its
// always-open, pre-#92 shape here. That shape turned out to render with the
// wrong colour on this page (see card-view.js's own #96 comment) as well as
// never collapsing, so this page now gets the same collapsible state app.js
// keeps per open card: a plain module-level flag, reset (not carried over)
// whenever a DIFFERENT card becomes `openCardId` — same rule as app.js's
// freshUi()'s own `historyOpen: false`, just without a whole fresh object
// since this page has no other per-card UI state to reset alongside it.
let historyOpenId = null;
let historyOpen = false;
function cardHistoryState() {
  if (historyOpenId !== openCardId) { historyOpenId = openCardId; historyOpen = false; }
  return { open: historyOpen, onToggle: (v) => { historyOpen = v; } };
}

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
    renderCardView(panel, openCardId, lang, { historyState: cardHistoryState() });
    return;
  }
  const el = $("cardDetail");
  if (!openCardId) { el.hidden = true; el.innerHTML = ""; refreshDetailLock(false); return; }
  el.hidden = false;
  refreshDetailLock(true);
  renderCardView(el, openCardId, lang, { onClose: closeCardDetail, historyState: cardHistoryState() });
  positionDetailOverlay();
}
// Review item 4 (#44): a pick used to call the full render() every time —
// measured at 40 childList mutations and a brand-new #cardListWrap per
// click, so the button the reader's own click landed on was never the node
// that ended up wearing .chosen a moment later. A pick now only ever does
// the three things the review named: fill the panel (renderDetail()), move
// .chosen from the old tile to the new one, replaceState. render() (the
// whole DOM rebuild) is reserved for the one real structural change a pick
// can also cause — entering the cards tab in the first place, e.g. straight
// from a hash on a cold load, or from the 規則 tab's own filters/rail
// having never mounted #cardListWrap at all.
function selectCardTile(id) {
  const prev = openCardId;
  openCardId = id;
  if (prev && prev !== id) document.querySelector(`#cardListWrap .cardrow[data-card="${prev}"]`)?.classList.remove("chosen");
  document.querySelector(`#cardListWrap .cardrow[data-card="${id}"]`)?.classList.add("chosen");
  renderDetail();
}
// #44: on desktop, choosing a card always switches to the cards tab (tiles
// only ever appear there) and replaces the address (never stacks a history
// entry per card — switchTab() above already pushed the one entry for
// entering the tab itself). `fromHash` (a deep link/initial load) never
// touches history at all, same rule as mobile.
function openCardDetail(id, fromHash = false) {
  if (!CARD_IDS.has(id)) return;
  cameFromHash = fromHash;
  if (isDesktopScroller()) {
    const enteringTab = activeTab !== "cards";
    if (enteringTab) { activeTab = "cards"; openCardId = id; render(); }
    else selectCardTile(id);
    scrollTileIntoView(id);
    if (!fromHash) {
      if (enteringTab) history.pushState(null, "", "#card-" + id);
      else history.replaceState(null, "", "#card-" + id);
    }
    return;
  }
  openCardId = id;
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
    if (m && CARD_IDS.has(m[1])) {
      cameFromHash = true;
      if (activeTab !== "cards") { activeTab = "cards"; openCardId = m[1]; render(); }
      else selectCardTile(m[1]); // review item 4: no full render() for a plain selection change
      scrollTileIntoView(m[1]);
    } else if (location.hash === "#cards") {
      if (activeTab !== "cards" || openCardId) { activeTab = "cards"; openCardId = null; render(); }
    } else if (activeTab !== "rules" || openCardId) {
      activeTab = "rules"; openCardId = null; render();
    }
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
