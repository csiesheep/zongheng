// The 72 cards, straight from the rulebook's table (section 五). Each record
// carries the deck (`era`), the owner (`side`: 0 Qin, 1 Chu, null neutral),
// printed ops, whether the event removes the card (`remove`), the year for the
// rules page, and `effect(st, side, ch, step)`: `side` is the event's owner
// (the player for a neutral card), `ch` the choices made so far. An effect
// that needs a decision returns a spec; the engine parks it in `pending`,
// and re-runs the effect with the choice appended once it is made, so stage
// k of an effect runs exactly when `ch.length === k`.
import * as E from "./engine.js";

const Q = 0, C = 1;
const CAPITALS = ["xinzheng", "daliang", "handan", "linzi", "ji"];
const opp = (s) => 1 - s;
const ids = (...regions) => E.SPACES.filter((s) => regions.includes(s.region)).map((s) => s.id);
const all = () => E.SPACES.map((s) => s.id);
const withEnemy = (st, side, list) => list.filter((id) => E.infOf(st, id)[opp(side)] > 0);
const withRoom = (st, side, list) => list.filter((id) => E.infOf(st, id)[side] < E.capOf(st, id));
// Campaign targets for an event: enemy influence, not protected, not locked unless the card ignores locks.
const targets = (st, side, list, ignoreLocks = false) =>
  withEnemy(st, side, list).filter((id) => !E.isProtected(st, id) && (ignoreLocks || !E.campaignLocked(st, id)));
const pick = (side, options, extra = {}) => ({ kind: "points", who: side, n: 1, min: options.length ? 1 : 0, distinct: true, options, ...extra });
const pts = (side, n, options, extra = {}) => ({ kind: "points", who: side, n, min: Math.min(n, options.length ? n : 0), side, options, ...extra });
const placeAll = (st, side, points, n = 1) => { for (const id of points) E.place(st, side, id, n); };
function freeCampaign(st, side, ch, list, ops, { noTire = false, ignoreLocks = false } = {}) {
  if (!ch.length) return pick(side, targets(st, side, list, ignoreLocks));
  const [t] = ch[0];
  if (t) E.campaign(st, side, t, ops, { noTire, pusher: st.phasing });
  return null;
}
function dropHanguPass(st) {
  E.removeEffect(st, (e) => e.card === "hangu");
  const i = st.discard.indexOf("hangu");
  if (i >= 0) { st.discard.splice(i, 1); st.removed.push("hangu"); }
}
function randomEnemyCard(st, side) {
  const h = st.hands[opp(side)].filter((c) => !CARD[c].scoring);
  if (!h.length) return null;
  const rng = E.makeRng(0); rng.setState(st.rngState);
  const c = h[rng.int(h.length)];
  st.rngState = rng.getState();
  return c;
}
const scoring = (id, num, zh, en, region, era) => ({ id, num, zh, en, era, side: null, ops: 0, remove: false, scoring: region, text: `${zh}:結算${zh.slice(0, 2)}。`, effect: () => null });

export const CARDS = [
  // The two homes score in the same era: the centre and both homes early,
  // the periphery from the alliance era (engine option `scoringSplit`).
  scoring("score_jin", 1, "三晉記分", "Three Jin scoring", "jin", "reform"),
  scoring("score_west", 2, "西土記分", "West scoring", "west", "reform"),
  scoring("score_south", 3, "南方記分", "South scoring", "south", "reform"),
  scoring("score_east", 4, "東方記分", "East scoring", "east", "alliance"),
  scoring("score_north", 5, "北疆記分", "North scoring", "north", "alliance"),

  // ---------- 變法期・秦 ----------
  { id: "shangyang", num: 6, zh: "商鞅變法", en: "Shang Yang's Reforms", era: "reform", side: Q, ops: 3, remove: true, year: 356,
    text: "變法軌前進 1;本回合秦所有牌行動點 +1。",
    effect(st) { E.reformAdvance(st, Q, 1); E.addEffect(st, { card: "shangyang", side: Q, kind: "opsAll", target: Q, delta: 1, until: "turn" }); } },
  { id: "ximu", num: 7, zh: "徙木立信", en: "Moving the Pole", era: "reform", side: Q, ops: 1, remove: true, year: 356,
    text: "變法軌前進 1。", effect(st) { E.reformAdvance(st, Q, 1); } },
  { id: "hexi", num: 8, zh: "收復河西", en: "Retaking Hexi", era: "reform", side: Q, ops: 2, remove: true, year: 330,
    text: "秦在河東放 2;若秦因此控制河東,再移除楚在大梁 1。",
    effect(st) { E.place(st, Q, "hedong", 2); if (E.controller(st, "hedong") === Q) E.remove(st, C, "daliang", 1); } },
  { id: "zhangyi", num: 9, zh: "張儀連橫", en: "Zhang Yi's Horizontal", era: "reform", side: Q, ops: 3, remove: true, year: 328,
    text: "移除楚在最多 3 個國都各 1 點影響力。",
    effect(st, side, ch) {
      const opts = withEnemy(st, Q, CAPITALS);
      if (!ch.length) return { kind: "points", who: Q, n: Math.min(3, opts.length), min: Math.min(3, opts.length), distinct: true, options: opts };
      for (const id of ch[0]) E.remove(st, C, id, 1);
    } },
  { id: "simacuo", num: 10, zh: "司馬錯伐蜀", en: "Sima Cuo Takes Shu", era: "reform", side: Q, ops: 3, remove: true, year: 316,
    text: "秦在巴蜀放 3;若秦控制漢中,改放 4。",
    effect(st) { E.place(st, Q, "bashu", E.controller(st, "hanzhong") === Q ? 4 : 3); } },
  { id: "hangu", num: 11, zh: "函谷關天險", en: "Hangu Pass", era: "reform", side: Q, ops: 2, remove: false,
    text: "持續:楚對西土征伐行動點 −2。「五國伐秦」或「合縱攻秦」事件觸發時移除本牌。",
    effect(st) { E.removeEffect(st, (e) => e.card === "hangu"); E.addEffect(st, { card: "hangu", side: Q, kind: "campaign", who: C, delta: -2, regions: ["west"], until: "game" }); } },
  { id: "keqing", num: 12, zh: "客卿制度", en: "Guest Ministers", era: "reform", side: Q, ops: 2, remove: false,
    text: "秦在任一據點放 2,不受相鄰限制。",
    effect(st, side, ch) { if (!ch.length) return pick(Q, withRoom(st, Q, all())); if (ch[0][0]) E.place(st, Q, ch[0][0], 2); } },
  { id: "envoy", num: 13, zh: "連橫使節", en: "Horizontal Envoy", era: "reform", side: Q, ops: 1, remove: false,
    text: "移除楚在任一據點 1 點影響力。",
    effect(st, side, ch) { if (!ch.length) return pick(Q, withEnemy(st, Q, all())); if (ch[0][0]) E.remove(st, C, ch[0][0], 1); } },

  // ---------- 變法期・楚 ----------
  { id: "wuqi", num: 14, zh: "吳起變法", en: "Wu Qi's Reforms", era: "reform", side: C, ops: 2, remove: true, year: 386,
    text: "變法軌前進 1;楚在南方放 2。",
    effect(st, side, ch) { if (!ch.length) { E.reformAdvance(st, C, 1); return pts(C, 2, withRoom(st, C, ids("south"))); } placeAll(st, C, ch[0]); } },
  { id: "suqin", num: 15, zh: "蘇秦合縱", en: "Su Qin's Vertical", era: "reform", side: C, ops: 4, remove: true, year: 333,
    text: "楚在五個國都各放 1 點影響力,不受相鄰限制。", effect(st) { placeAll(st, C, CAPITALS); } },
  { id: "weiwei", num: 16, zh: "圍魏救趙", en: "Besiege Wei to Save Zhao", era: "reform", side: C, ops: 2, remove: true, year: 354,
    text: "移除秦在大梁 2 點影響力;楚在邯鄲放 1。", effect(st) { E.remove(st, Q, "daliang", 2); E.place(st, C, "handan", 1); } },
  { id: "maling", num: 17, zh: "馬陵之戰", en: "Battle of Maling", era: "reform", side: C, ops: 3, remove: true, year: 341,
    text: "移除秦在三晉任一據點的全部影響力(至多 3 點)。",
    effect(st, side, ch) { if (!ch.length) return pick(C, withEnemy(st, C, ids("jin"))); if (ch[0][0]) E.remove(st, Q, ch[0][0], 3); } },
  { id: "jixia", num: 18, zh: "稷下學宮", en: "Jixia Academy", era: "reform", side: C, ops: 2, remove: true,
    text: "楚在東方放 3(可分散)。",
    effect(st, side, ch) { if (!ch.length) return pts(C, 3, withRoom(st, C, ids("east"))); placeAll(st, C, ch[0]); } },
  { id: "wuguo", num: 19, zh: "五國伐秦", en: "Five States Attack Qin", era: "reform", side: C, ops: 3, remove: true, year: 318,
    text: "楚對西土任一據點發動免費征伐,行動點 +1,不受疲敝限制;移除「函谷關天險」。",
    // Option `wuguo: "nonbg"` keeps the 318 BC coalition outside 關中, as it was.
    effect(st, side, ch) { dropHanguPass(st); return freeCampaign(st, C, ch, ids("west").filter((id) => st.options.wuguo !== "nonbg" || !E.SPACE[id].battleground), 3 + 1, { ignoreLocks: true }); } },
  { id: "mozhe", num: 20, zh: "墨者守城", en: "Mohist Defenders", era: "reform", side: C, ops: 1, remove: false,
    text: "指定 1 個據點,本回合內不可對其征伐或遊說。",
    effect(st, side, ch) { if (!ch.length) return pick(C, all()); E.addEffect(st, { card: "mozhe", side: C, kind: "protect", space: ch[0][0], until: "turn" }); } },
  { id: "chumieyue", num: 21, zh: "楚滅越", en: "Chu Conquers Yue", era: "reform", side: C, ops: 2, remove: true, year: 306,
    text: "楚在吳越放 2;此後南方記分時楚 +1。",
    effect(st) { E.place(st, C, "wuyue", 2); E.addEffect(st, { card: "chumieyue", side: C, kind: "score", region: "south", who: C, delta: 1, until: "game" }); } },

  // ---------- 變法期・中立 ----------
  { id: "youshui", num: 22, zh: "縱橫家遊說", en: "The Persuaders", era: "reform", side: null, ops: 2, remove: false,
    text: "打出者對任一據點遊說,行動點 2,局勢至少視為 2。",
    effect(st, side, ch) {
      if (!ch.length) return pick(side, withEnemy(st, side, all()).filter((id) => !E.isProtected(st, id)));
      const [t] = ch[0]; if (!t) return;
      const removed = E.remove(st, opp(side), t, Math.min(2, Math.max(2, E.edge(st, side, t))));
      E.log(st, { type: "lobby", side, target: t, ops: 2, removed });
    } },
  { id: "zhizi", num: 23, zh: "質子交換", en: "Exchange of Hostages", era: "reform", side: null, ops: 1, remove: false,
    text: "雙方各移除對手 1 點影響力,打出者先選。",
    effect(st, side, ch) {
      if (ch.length === 0) return pick(side, withEnemy(st, side, all()));
      if (ch.length === 1) return pick(opp(side), withEnemy(st, opp(side), all()));
      if (ch[0][0]) E.remove(st, opp(side), ch[0][0], 1);
      if (ch[1][0]) E.remove(st, side, ch[1][0], 1);
    } },
  { id: "shuoke", num: 24, zh: "說客", en: "The Lobbyist", era: "reform", side: null, ops: 1, remove: false,
    text: "與手中另一張對手陣營的牌同時打出(共占 1 個行動回合):該牌事件不觸發,使用該牌的行動點。",
    effect() { /* the pairing is handled by play(); alone it does nothing */ } },
  { id: "huanghe", num: 25, zh: "黃河決口", en: "The Yellow River Breaks", era: "reform", side: null, ops: 2, remove: false,
    text: "三晉每個據點雙方各移除 1;疲敝軌後退 1。",
    effect(st) { for (const id of ids("jin")) { E.remove(st, Q, id, 1); E.remove(st, C, id, 1); } E.recover(st, 1); } },
  { id: "tiangou", num: 26, zh: "天狗食日", en: "The Dog Eats the Sun", era: "reform", side: null, ops: 1, remove: false,
    text: "對手隨機棄 1 張牌(記分卡除外);若是打出者陣營的事件,該事件觸發。",
    effect(st, side) {
      const c = randomEnemyCard(st, side); if (!c) return;
      const h = st.hands[opp(side)]; h.splice(h.indexOf(c), 1);
      if (CARD[c].side === side) st.plan.splice(1, 0, { do: "event", card: c, side, by: st.phasing, choices: [] }, { do: "finishCard", card: c, side, triggered: true });
      else st.discard.push(c);
    } },
  { id: "yetie", num: 27, zh: "冶鐵與弩機", en: "Iron and Crossbows", era: "reform", side: null, ops: 2, remove: false,
    text: "持續至回合結束:打出者征伐行動點 +1。",
    effect(st, side) { E.addEffect(st, { card: "yetie", side, kind: "campaign", who: side, delta: 1, regions: null, until: "turn" }); } },
  { id: "zhouzuo", num: 28, zh: "周天子賜胙", en: "The Zhou King's Gift", era: "reform", side: null, ops: 1, remove: false,
    text: "打出者在洛邑放 2。", effect(st, side) { E.place(st, side, "luoyi", 2); } },
  { id: "daji", num: 29, zh: "大饑", en: "Famine", era: "reform", side: null, ops: 2, remove: false,
    text: "選 1 區,雙方各在自己控制的每個據點移除 1。",
    effect(st, side, ch) {
      if (!ch.length) return { kind: "option", who: side, options: E.SCORED_REGIONS.map((r) => ({ id: r, label: E.REGIONS[r].zh })) };
      for (const id of ids(ch[0])) { const c = E.controller(st, id); if (c != null) E.remove(st, c, id, 1); }
    } },

  // ---------- 縱橫期・秦 ----------
  { id: "zhangyi2", num: 30, zh: "張儀欺楚", en: "Zhang Yi Dupes Chu", era: "alliance", side: Q, ops: 2, remove: true, year: 313,
    text: "移除楚在任一國都 2 點影響力;若楚因此失去相印,秦天命 +1。",
    effect(st, side, ch) {
      if (!ch.length) return pick(Q, withEnemy(st, Q, CAPITALS));
      const [t] = ch[0]; if (!t) return;
      const state = E.SPACE[t].state, had = !!st.seals[state];
      E.remove(st, C, t, 2);
      if (had && E.controller(st, t) !== C) E.vp(st, Q, 1);
    } },
  { id: "yiyang", num: 31, zh: "宜陽之戰", en: "Battle of Yiyang", era: "alliance", side: Q, ops: 2, remove: true, year: 307,
    text: "秦對三晉任一據點發動免費征伐,不推進疲敝。",
    effect(st, side, ch) { return freeCampaign(st, Q, ch, ids("jin"), 2, { noTire: true }); } },
  { id: "huaiwang", num: 32, zh: "楚懷王入秦", en: "King Huai Enters Qin", era: "alliance", side: Q, ops: 2, remove: true, year: 299,
    text: "移除楚在南方(郢除外)任一據點的全部影響力;疲敝軌前進 1。",
    effect(st, side, ch) {
      if (!ch.length) return pick(Q, withEnemy(st, Q, ids("south").filter((id) => id !== "ying")));
      if (ch[0][0]) E.remove(st, C, ch[0][0], 99);
      E.tire(st, 1, st.phasing);
    } },
  { id: "baiqi", num: 33, zh: "白起", en: "Bai Qi", era: "alliance", side: Q, ops: 3, remove: true, year: 293,
    text: "持續:秦對三晉、南方征伐行動點 +1。",
    effect(st) { E.addEffect(st, { card: "baiqi", side: Q, kind: "campaign", who: Q, delta: 1, regions: ["jin", "south"], until: "game" }); } },
  { id: "yueyi", num: 34, zh: "樂毅伐齊", en: "Yue Yi Invades Qi", era: "alliance", side: Q, ops: 3, remove: true, year: 284,
    text: "移除楚在東方每個據點各 2。", effect(st) { for (const id of ids("east")) E.remove(st, C, id, 2); } },
  { id: "poying", num: 35, zh: "白起破郢", en: "Bai Qi Sacks Ying", era: "alliance", side: Q, ops: 3, remove: true, year: 278,
    text: "移除楚在郢 2;秦在黔中或陳蔡放 2。",
    effect(st, side, ch) { if (!ch.length) { E.remove(st, C, "ying", 2); return pick(Q, ["qianzhong", "chencai"]); } E.place(st, Q, ch[0][0], 2); } },
  { id: "yuanjiao", num: 36, zh: "遠交近攻", en: "Befriend the Far, Attack the Near", era: "alliance", side: Q, ops: 3, remove: true, year: 270,
    text: "秦在東方或北疆任一據點放 2(不受相鄰限制),並在三晉任一據點放 2。",
    effect(st, side, ch) {
      if (ch.length === 0) return pick(Q, withRoom(st, Q, ids("east", "north")));
      if (ch.length === 1) { if (ch[0][0]) E.place(st, Q, ch[0][0], 2); return pick(Q, withRoom(st, Q, ids("jin"))); }
      if (ch[1][0]) E.place(st, Q, ch[1][0], 2);
    } },
  { id: "xidi", num: 37, zh: "稱西帝", en: "Emperor of the West", era: "alliance", side: Q, ops: 2, remove: true, year: 288,
    text: "若秦控制的要衝數 > 楚,秦天命 +3;否則秦天命 −1。",
    effect(st) {
      const n = (s) => E.BATTLEGROUNDS.filter((id) => E.controller(st, id) === s).length;
      if (n(Q) > n(C)) E.vp(st, Q, 3); else E.vp(st, C, 1);
    } },

  // ---------- 縱橫期・楚 ----------
  { id: "hufu", num: 38, zh: "胡服騎射", en: "Nomad Dress and Mounted Archery", era: "alliance", side: C, ops: 3, remove: true, year: 307,
    text: "楚在北疆放 2、邯鄲放 2;變法軌前進 1。",
    effect(st, side, ch) { if (!ch.length) return pts(C, 2, withRoom(st, C, ids("north"))); placeAll(st, C, ch[0]); E.place(st, C, "handan", 2); E.reformAdvance(st, C, 1); } },
  { id: "mengchang", num: 39, zh: "孟嘗君", en: "Lord Mengchang", era: "alliance", side: C, ops: 2, remove: false,
    text: "楚抽 1 張;若楚控制薛,改抽 2 張。", effect(st) { E.draw(st, C, E.controller(st, "xue") === C ? 2 : 1, { nonScoring: true }); } },
  { id: "hezong", num: 40, zh: "合縱攻秦", en: "The Alliance Attacks Qin", era: "alliance", side: C, ops: 4, remove: true, year: 296,
    text: "楚對西土任一據點發動免費征伐,行動點 +2,不受疲敝限制;移除「函谷關天險」。",
    effect(st, side, ch) { dropHanguPass(st); return freeCampaign(st, C, ch, ids("west"), 4 + 2, { ignoreLocks: true }); } },
  { id: "tiandan", num: 41, zh: "田單復國", en: "Tian Dan Restores Qi", era: "alliance", side: C, ops: 3, remove: true, year: 279,
    text: "移除秦在臨淄 2;楚在即墨、莒各放 2;若齊已滅,移除滅國標記。",
    effect(st) { E.remove(st, Q, "linzi", 2); E.place(st, C, "jimo", 2); E.place(st, C, "ju", 2); delete st.mie.qi; } },
  { id: "wanbi", num: 42, zh: "完璧歸趙", en: "The Jade Returns to Zhao", era: "alliance", side: C, ops: 1, remove: true, year: 283,
    text: "查看秦的手牌。", effect(st) { st.revealed[C] = true; } },
  { id: "yuyu", num: 43, zh: "閼與之戰", en: "Battle of Yuyu", era: "alliance", side: C, ops: 2, remove: true, year: 269,
    text: "楚對三晉或西土任一據點發動免費征伐,不推進疲敝。",
    effect(st, side, ch) { return freeCampaign(st, C, ch, ids("jin", "west"), 2, { noTire: true }); } },
  { id: "quyuan", num: 44, zh: "屈原", en: "Qu Yuan", era: "alliance", side: C, ops: 1, remove: true, year: 278,
    text: "楚在三晉任一國都放 2。",
    effect(st, side, ch) { if (!ch.length) return pick(C, withRoom(st, C, ["xinzheng", "daliang", "handan"])); if (ch[0][0]) E.place(st, C, ch[0][0], 2); } },
  { id: "huangjintai", num: 45, zh: "黃金臺", en: "The Golden Terrace", era: "alliance", side: C, ops: 2, remove: true, year: 311,
    text: "楚在薊放 2;楚抽 1 張。", effect(st) { E.place(st, C, "ji", 2); E.draw(st, C, 1, { nonScoring: true }); } },

  // ---------- 縱橫期・中立 ----------
  { id: "qimiesong", num: 46, zh: "齊滅宋", en: "Qi Swallows Song", era: "alliance", side: null, ops: 2, remove: true, year: 286,
    text: "移除宋的全部影響力;控制臨淄者在宋放 2(無人控制則打出者放)。",
    effect(st, side) { st.inf.song = [0, 0]; E.place(st, E.controller(st, "linzi") ?? side, "song", 2); } },
  { id: "shanglv", num: 47, zh: "商旅通賈", en: "Merchant Caravans", era: "alliance", side: null, ops: 2, remove: false,
    text: "從對手手牌隨機抽 1 張(記分卡除外),可立即使用其行動點(事件不觸發),然後棄掉。",
    effect(st, side) {
      const c = randomEnemyCard(st, side); if (!c) return;
      const h = st.hands[opp(side)]; h.splice(h.indexOf(c), 1);
      st.plan.splice(1, 0, { do: "ops", side, card: c, ops: E.opsOf(st, side, c), payload: null, choices: [] }, { do: "finishCard", card: c, side, triggered: false });
    } },
  { id: "mianchi", num: 48, zh: "澠池之會", en: "The Meeting at Mianchi", era: "alliance", side: null, ops: 2, remove: false, year: 279,
    text: "疲敝軌後退 1;持續至回合結束:雙方征伐行動點 −1。",
    effect(st, side) { E.recover(st, 1); E.addEffect(st, { card: "mianchi", side, kind: "campaign", who: "both", delta: -1, regions: null, until: "turn" }); } },
  { id: "yili", num: 49, zh: "疫癘", en: "Pestilence", era: "alliance", side: null, ops: 1, remove: false,
    text: "雙方各在對手控制的 1 個據點移除 2,打出者先選。",
    effect(st, side, ch) {
      if (ch.length === 0) return pick(side, E.controlled(st, opp(side)));
      if (ch.length === 1) return pick(opp(side), E.controlled(st, side));
      if (ch[0][0]) E.remove(st, opp(side), ch[0][0], 2);
      if (ch[1][0]) E.remove(st, side, ch[1][0], 2);
    } },
  { id: "changcheng", num: 50, zh: "修長城", en: "Building the Long Wall", era: "alliance", side: null, ops: 2, remove: false,
    text: "選 1 區,持續至回合結束:對手在該區征伐行動點 −1。",
    effect(st, side, ch) {
      if (!ch.length) return { kind: "option", who: side, options: E.SCORED_REGIONS.map((r) => ({ id: r, label: E.REGIONS[r].zh })) };
      E.addEffect(st, { card: "changcheng", side, kind: "campaign", who: opp(side), delta: -1, regions: [ch[0]], until: "turn" });
    } },
  { id: "ximin", num: 51, zh: "徙民實邊", en: "Settling the Frontier", era: "alliance", side: null, ops: 3, remove: false,
    text: "打出者移除自己 4 點影響力,重新分配到任意據點,每據點最多 2 點,不受相鄰限制。",
    effect(st, side, ch) {
      const mine = E.SPACES.filter((s) => E.infOf(st, s.id)[side] > 0).map((s) => s.id);
      const total = mine.reduce((n, id) => n + E.infOf(st, id)[side], 0);
      const k = Math.min(4, total);
      if (ch.length === 0) return { kind: "points", who: side, n: k, min: k, options: mine, maxOf: Object.fromEntries(mine.map((id) => [id, E.infOf(st, id)[side]])) };
      if (ch.length === 1) { for (const id of ch[0]) E.remove(st, side, id, 1); return { kind: "points", who: side, side, n: ch[0].length, min: ch[0].length, maxPer: 2, options: withRoom(st, side, all()) }; }
      placeAll(st, side, ch[1]);
    } },

  // ---------- 兼併期・秦 ----------
  { id: "changping", num: 52, zh: "長平之戰", en: "Battle of Changping", era: "conquest", side: Q, ops: 4, remove: true, year: 260,
    text: "秦對三晉任一據點發動征伐,行動點 4 +3;疲敝軌額外前進 1。",
    effect(st, side, ch) { const need = freeCampaign(st, Q, ch, ids("jin"), 4 + 3); if (need) return need; E.tire(st, 1, st.phasing); } },
  { id: "miezhou", num: 53, zh: "秦滅周", en: "Qin Ends the Zhou", era: "conquest", side: Q, ops: 2, remove: true, year: 256,
    text: "若秦控制洛邑,秦天命 +3;洛邑此後不再產生天命;九鼎立即交給秦,正面朝上。",
    effect(st) { if (E.controller(st, "luoyi") === Q) E.vp(st, Q, 3); st.luoyiYields = false; st.jiuding = { holder: Q, faceDown: false }; } },
  { id: "lvbuwei", num: 54, zh: "呂不韋", en: "Lü Buwei", era: "conquest", side: Q, ops: 2, remove: true, year: 250,
    text: "秦從棄牌堆取回 1 張非記分卡到手上。",
    effect(st, side, ch) {
      const opts = st.discard.filter((c) => !CARD[c].scoring);
      if (!ch.length) return { kind: "card", who: Q, n: 1, min: opts.length ? 1 : 0, options: opts };
      const [c] = ch[0]; if (!c) return;
      st.discard.splice(st.discard.indexOf(c), 1); st.hands[Q].push(c);
    } },
  { id: "zhengguoqu", num: 55, zh: "鄭國渠", en: "The Zhengguo Canal", era: "conquest", side: Q, ops: 2, remove: true, year: 246,
    text: "變法軌前進 2。", effect(st) { E.reformAdvance(st, Q, 2); } },
  { id: "fanjian", num: 56, zh: "反間", en: "Sowing Discord", era: "conquest", side: Q, ops: 2, remove: true, year: 260,
    text: "移除 1 個楚方持續效果(如「廉頗與李牧」);或移除楚在邯鄲 2 點影響力。",
    effect(st, side, ch) {
      if (!ch.length) {
        const opts = st.effects.map((e, i) => ({ e, i })).filter((x) => x.e.side === C).map((x) => ({ id: `effect:${x.i}`, label: CARD[x.e.card].zh }));
        opts.push({ id: "handan", label: "移除楚在邯鄲 2" });
        return { kind: "option", who: Q, options: opts };
      }
      if (ch[0] === "handan") E.remove(st, C, "handan", 2);
      else { const i = Number(ch[0].split(":")[1]); st.effects.splice(i, 1); }
    } },
  { id: "wangjian", num: 57, zh: "王翦滅楚", en: "Wang Jian Conquers Chu", era: "conquest", side: Q, ops: 4, remove: true, year: 223,
    text: "秦對南方任一據點發動征伐,行動點 4 +2,不受疲敝限制;疲敝軌額外前進 1。",
    effect(st, side, ch) { const need = freeCampaign(st, Q, ch, ids("south"), 4 + 2, { ignoreLocks: true }); if (need) return need; E.tire(st, 1, st.phasing); } },
  { id: "hanfei", num: 58, zh: "韓非入秦", en: "Han Fei Comes to Qin", era: "conquest", side: Q, ops: 1, remove: true, year: 233,
    text: "變法軌前進 1;秦可棄掉手中 1 張楚方牌,事件不觸發。",
    effect(st, side, ch) {
      if (!ch.length) { E.reformAdvance(st, Q, 1); return { kind: "card", who: Q, n: 1, min: 0, options: st.hands[Q].filter((c) => CARD[c].side === C) }; }
      if (ch[0][0]) E.discardCard(st, Q, ch[0][0]);
    } },

  // ---------- 兼併期・楚 ----------
  { id: "xinlingjun", num: 59, zh: "信陵君竊符救趙", en: "Lord Xinling Steals the Tally", era: "conquest", side: C, ops: 4, remove: true, year: 257,
    text: "移除秦在邯鄲的全部影響力;楚在邯鄲放 2。", effect(st) { E.remove(st, Q, "handan", 99); E.place(st, C, "handan", 2); } },
  { id: "maosui", num: 60, zh: "毛遂自薦", en: "Mao Sui Volunteers", era: "conquest", side: C, ops: 1, remove: true, year: 257,
    text: "楚在南方任一據點放 2;楚抽 1 張。",
    effect(st, side, ch) { if (!ch.length) return pick(C, withRoom(st, C, ids("south"))); if (ch[0][0]) E.place(st, C, ch[0][0], 2); E.draw(st, C, 1, { nonScoring: true }); } },
  { id: "lianpo", num: 61, zh: "廉頗與李牧", en: "Lian Po and Li Mu", era: "conquest", side: C, ops: 3, remove: true, year: 260,
    text: "持續:秦對三晉、北疆征伐行動點 −1。可被「反間」移除。",
    effect(st) { E.addEffect(st, { card: "lianpo", side: C, kind: "campaign", who: Q, delta: -1, regions: ["jin", "north"], until: "game" }); } },
  { id: "chunshenjun", num: 62, zh: "春申君", en: "Lord Chunshen", era: "conquest", side: C, ops: 2, remove: false,
    text: "楚抽 2 張,然後棄 1 張(不可棄記分卡)。",
    effect(st, side, ch) {
      if (!ch.length) { E.draw(st, C, 2, { nonScoring: true }); const opts = st.hands[C].filter((c) => !CARD[c].scoring); return { kind: "card", who: C, n: 1, min: opts.length ? 1 : 0, options: opts }; }
      if (ch[0][0]) E.discardCard(st, C, ch[0][0]);
    } },
  { id: "jingke", num: 63, zh: "荊軻刺秦王", en: "Jing Ke's Attempt", era: "conquest", side: C, ops: 2, remove: true, year: 227,
    text: "秦本回合剩餘所有牌行動點 −1(最低 1);楚須棄掉手中行動點最高的牌,事件不觸發。",
    effect(st) {
      E.addEffect(st, { card: "jingke", side: C, kind: "opsAll", target: Q, delta: -1, until: "turn" });
      const h = st.hands[C]; if (!h.length) return;
      const top = h.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
      E.discardCard(st, C, top);
    } },
  { id: "liuguo", num: 64, zh: "六國會盟", en: "The Six-State Covenant", era: "conquest", side: C, ops: 3, remove: true, year: 241,
    text: "楚在三晉、東方、北疆各選 1 個據點,各放 2。",
    effect(st, side, ch) {
      const regions = ["jin", "east", "north"];
      if (ch.length < 3) { if (ch.length) { const [p] = ch[ch.length - 1]; if (p) E.place(st, C, p, 2); } return pick(C, withRoom(st, C, ids(regions[ch.length]))); }
      const [p] = ch[2]; if (p) E.place(st, C, p, 2);
    } },
  { id: "lixin", num: 65, zh: "李信伐楚敗績", en: "Li Xin's Defeat", era: "conquest", side: C, ops: 2, remove: true, year: 225,
    text: "移除秦在南方每個據點各 1;疲敝軌後退 1。",
    effect(st) { for (const id of ids("south")) E.remove(st, Q, id, 1); E.recover(st, 1); } },

  // ---------- 兼併期・中立 ----------
  { id: "duojiang", num: 66, zh: "奪將", en: "Poaching a General", era: "conquest", side: null, ops: 2, remove: false,
    text: "取走對手手中行動點最高的牌(九鼎除外),並將本牌交給對手。",
    effect(st, side) {
      const h = st.hands[opp(side)];
      if (h.length) {
        const top = h.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
        if (CARD[top].ops > 0) { h.splice(h.indexOf(top), 1); st.hands[side].push(top); }
      }
      st.hands[opp(side)].push("duojiang");
    } },
  { id: "xizuo", num: 67, zh: "細作", en: "The Spy", era: "conquest", side: null, ops: 1, remove: false,
    text: "對手展示手牌;打出者指定 1 張,對手下一個行動回合必須打出該牌,用法自選。",
    effect(st, side, ch) {
      if (!ch.length) return { kind: "card", who: side, n: 1, min: st.hands[opp(side)].length ? 1 : 0, options: st.hands[opp(side)].slice(), showHand: true };
      if (ch[0][0]) st.forced[opp(side)] = ch[0][0];
    } },
  { id: "zhukeling", num: 68, zh: "逐客令", en: "Expulsion of Foreigners", era: "conquest", side: null, ops: 3, remove: false, year: 237,
    text: "持續至回合結束:對手所有牌行動點 −1(最低 1)。",
    effect(st, side) { E.addEffect(st, { card: "zhukeling", side, kind: "opsAll", target: opp(side), delta: -1, until: "turn" }); } },
  { id: "dunbing", num: 69, zh: "頓兵堅城", en: "Bogged Before the Walls", era: "conquest", side: null, ops: 3, remove: false,
    text: "持續:對手在其下一個行動回合開始時,須棄掉 1 張行動點 ≥ 2 的牌(事件不觸發)作為該次行動,然後本效果解除;若無可棄之牌,正常行動,效果延到下一個行動回合。",
    effect(st, side) { E.removeEffect(st, (e) => e.kind === "bog" && e.who === opp(side)); E.addEffect(st, { card: "dunbing", side, kind: "bog", who: opp(side), until: "game" }); } },
  { id: "mibing", num: 70, zh: "弭兵之議", en: "A Proposal to Lay Down Arms", era: "conquest", side: null, ops: 3, remove: false,
    text: "疲敝軌後退 2;持續至回合結束:雙方征伐行動點 −1。",
    effect(st, side) { E.recover(st, 2); E.addEffect(st, { card: "mibing", side, kind: "campaign", who: "both", delta: -1, regions: null, until: "turn" }); } },
  { id: "jianbing", num: 71, zh: "兼併小邦", en: "Swallowing the Small States", era: "conquest", side: null, ops: 2, remove: false,
    text: "打出者對任一非要衝據點發動免費征伐,不推進疲敝、不受疲敝限制。",
    effect(st, side, ch) { return freeCampaign(st, side, ch, all().filter((id) => !E.SPACE[id].battleground), 2, { noTire: true, ignoreLocks: true }); } },
];

export const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const ERA_DECKS = {
  reform: CARDS.filter((c) => c.era === "reform").map((c) => c.id),
  alliance: CARDS.filter((c) => c.era === "alliance").map((c) => c.id),
  conquest: CARDS.filter((c) => c.era === "conquest").map((c) => c.id),
};
