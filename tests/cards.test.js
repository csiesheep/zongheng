// The cards whose effects have a shape worth pinning down: multi-step
// choices, the other side choosing, random draws, cards changing hands.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";

const { QIN, CHU } = E;

function atAction(hands = [[], []], patch = {}) {
  let st = E.createGame(11);
  st = E.apply(st, { type: "choose", side: QIN, choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["song", "song", "huaisi", "chencai"] });
  st.draw = st.draw.concat(st.hands[0], st.hands[1]).filter((c) => !hands.flat().includes(c));
  st.hands = [hands[0].slice(), hands[1].slice()];
  Object.assign(st, { phase: "action", round: 1, actor: QIN, phasing: QIN, plan: [], pending: null, headline: [null, null] }, patch);
  return st;
}
const inf = (st, id) => E.infOf(st, id);
const setInf = (st, id, q, c) => { st.inf[id] = [q, c]; };
const play = (st, side, card, extra = {}) => E.apply(st, { type: "play", side, card, use: "event", ...extra });
const choose = (st, side, choice) => E.apply(st, { type: "choose", side, choice });

test("張儀連橫 strips one point from up to three capitals that hold Chu", () => {
  const st = atAction([["zhangyi", "hexi"], ["mozhe"]]);
  setInf(st, "xinzheng", 0, 2); setInf(st, "linzi", 0, 1);
  let a = play(st, QIN, "zhangyi");
  assert.equal(a.pending.kind, "points"); assert.equal(a.pending.n, 2); assert.equal(a.pending.min, 2);
  assert.deepEqual(a.pending.options.slice().sort(), ["linzi", "xinzheng"]);
  assert.throws(() => choose(a, QIN, ["xinzheng", "xinzheng"]), /repeats/);
  a = choose(a, QIN, ["xinzheng", "linzi"]);
  assert.deepEqual([inf(a, "xinzheng"), inf(a, "linzi")], [[0, 1], [0, 0]]);
  assert.equal(a.actor, CHU);
});

test("質子交換 and 疫癘: the player picks first, then the other side picks", () => {
  const st = atAction([["zhizi", "hexi"], ["mozhe"]]);
  setInf(st, "shangdang", 0, 2); // Chu, adjacent to Qin's spaces
  let a = play(st, QIN, "zhizi");
  assert.equal(a.pending.who, QIN);
  a = choose(a, QIN, ["shangdang"]);
  assert.equal(a.pending.who, CHU);
  assert.ok(a.pending.options.includes("yiyang"));
  a = choose(a, CHU, ["yiyang"]);
  assert.deepEqual([inf(a, "shangdang"), inf(a, "yiyang")], [[0, 1], [1, 0]]);
  assert.equal(a.pending, null); assert.equal(a.actor, CHU);
  const st2 = atAction([["yili", "hexi"], ["mozhe"]]);
  let b = play(st2, QIN, "yili");
  assert.deepEqual(b.pending.options.slice().sort(), E.controlled(st2, CHU).sort());
  b = choose(b, QIN, ["song"]);
  b = choose(b, CHU, ["hedong"]);
  assert.deepEqual([inf(b, "song"), inf(b, "hedong")], [[0, 0], [0, 0]]);
});

test("徙民實邊 lifts four of your own points and puts them anywhere, two per space at most", () => {
  const st = atAction([["ximin", "hexi"], ["mozhe"]]);
  let a = play(st, QIN, "ximin");
  assert.equal(a.pending.n, 4);
  assert.throws(() => choose(a, QIN, ["yiqu", "yiqu", "guanzhong", "guanzhong"]), /not that many/);
  a = choose(a, QIN, ["guanzhong", "guanzhong", "yiyang", "hedong"]);
  assert.deepEqual(inf(a, "guanzhong"), [2, 0]);
  assert.equal(a.pending.n, 4); assert.equal(a.pending.maxPer, 2);
  assert.throws(() => choose(a, QIN, ["linzi", "linzi", "linzi", "ji"]), /more than 2/);
  a = choose(a, QIN, ["linzi", "linzi", "ji", "ji"]);
  assert.deepEqual([inf(a, "linzi"), inf(a, "ji")], [[2, 0], [2, 0]]);
});

test("天狗食日 discards a random enemy card; if it was the player's own event it fires", () => {
  const st = atAction([["tiangou", "hexi"], ["shangyang", "score_jin"]]);
  const a = play(st, QIN, "tiangou");
  assert.deepEqual(a.hands[CHU], ["score_jin"], "never a scoring card");
  assert.equal(a.reform[QIN], 1, "商鞅 fired for Qin");
  assert.ok(a.removed.includes("shangyang"));
  const st2 = atAction([["tiangou", "hexi"], ["wuqi"]]);
  const b = play(st2, QIN, "tiangou");
  assert.ok(b.discard.includes("wuqi"), "a Chu card is just discarded");
  assert.equal(b.reform[CHU], 0);
});

test("商旅通賈 takes a random enemy card and lets you spend its ops now, no event", () => {
  const st = atAction([["shanglv", "hexi"], ["maling"]]);
  let a = play(st, QIN, "shanglv");
  assert.equal(a.pending.kind, "ops"); assert.equal(a.pending.ops, 3); assert.equal(a.pending.who, QIN);
  assert.deepEqual(a.hands[CHU], []);
  a = choose(a, QIN, { use: "place", points: ["shangdang", "shangdang", "shangdang"] });
  assert.deepEqual(inf(a, "shangdang"), [3, 0]);
  assert.ok(a.discard.includes("maling") && a.discard.includes("shanglv"));
  assert.equal(a.actor, CHU);
});

test("奪將 takes the enemy's biggest card and goes to their hand instead of the discard", () => {
  const st = atAction([["duojiang", "hexi"], ["maling", "mozhe", "score_jin"]]);
  const a = play(st, QIN, "duojiang");
  assert.deepEqual(a.hands[QIN].slice().sort(), ["hexi", "maling"]);
  assert.deepEqual(a.hands[CHU].slice().sort(), ["duojiang", "mozhe", "score_jin"]);
  assert.ok(!a.discard.includes("duojiang"));
});

test("反間 removes a Chu lasting effect or two points in 邯鄲", () => {
  const st = atAction([["fanjian", "hexi"], ["mozhe"]]);
  E.addEffect(st, { card: "lianpo", side: CHU, kind: "campaign", who: QIN, delta: -1, regions: ["jin", "north"], until: "game" });
  setInf(st, "handan", 0, 3);
  let a = play(st, QIN, "fanjian");
  assert.equal(a.pending.kind, "option");
  assert.deepEqual(a.pending.options.map((o) => o.id), ["effect:0", "handan"]);
  const b = choose(a, QIN, "effect:0");
  assert.equal(b.effects.length, 0); assert.deepEqual(inf(b, "handan"), [0, 3]);
  const c = choose(a, QIN, "handan");
  assert.equal(c.effects.length, 1); assert.deepEqual(inf(c, "handan"), [0, 1]);
});

test("齊滅宋 clears 宋 and hands it to whoever holds 臨淄; 稱西帝 pays by the battleground count", () => {
  const st = atAction([["qimiesong", "xidi", "hexi"], ["mozhe", "mozhe"]]);
  setInf(st, "song", 1, 3); setInf(st, "linzi", 3, 0);
  let a = play(st, QIN, "qimiesong");
  assert.deepEqual(inf(a, "song"), [2, 0]);
  a.actor = QIN; a.plan = [];
  setInf(a, "guanzhong", 4, 0); // Qin: guanzhong, song = 2 battlegrounds; Chu: ying = 1
  const m = a.mandate;
  a = play(a, QIN, "xidi");
  assert.equal(a.mandate, m + 3);
});

test("長平之戰 campaigns with seven ops and tires the realm twice", () => {
  const st = atAction([["changping", "hexi"], ["mozhe"]]);
  setInf(st, "shangdang", 0, 4);
  let a = play(st, QIN, "changping");
  assert.deepEqual(a.pending.options, ["shangdang"]);
  a = choose(a, QIN, ["shangdang"]);
  assert.deepEqual(inf(a, "shangdang"), [3, 0]);
  assert.equal(a.weariness, 3);
});

test("五國伐秦 ignores the home lock, drops 函谷關天險 out of the game, and its campaign is not tired", () => {
  const st = atAction([["hexi"], ["wuguo", "mozhe"]], { actor: CHU, phasing: CHU, weariness: 4 });
  E.addEffect(st, { card: "hangu", side: QIN, kind: "campaign", who: CHU, delta: -2, regions: ["west"], until: "game" });
  st.discard.push("hangu");
  let a = play(st, CHU, "wuguo");
  assert.ok(a.pending.options.includes("hangu"), "the pass is a target although 兵連 locks the home");
  a = choose(a, CHU, ["hangu"]);
  assert.deepEqual(inf(a, "hangu"), [0, 1], "3 +1, the −2 is gone with the card: remove 3, place 1");
  assert.ok(!play(st, CHU, "wuguo").pending.options.includes("guanzhong"), "關中 is never offered: the coalition of 318 BC stopped at the pass");
  assert.equal(a.weariness, 4, "函谷關 is not a battleground");
  assert.ok(a.removed.includes("hangu") && !a.discard.includes("hangu"));
  assert.equal(a.effects.length, 0);
});

test("荊軻 taxes Qin's ops for the turn and costs Chu its best card; 逐客令 floors at 1", () => {
  const st = atAction([["shangyang", "ximu"], ["jingke", "suqin", "mozhe"]], { actor: CHU, phasing: CHU });
  let a = play(st, CHU, "jingke");
  assert.ok(a.discard.includes("suqin"));
  assert.equal(E.opsOf(a, QIN, "shangyang"), 2);
  assert.equal(E.opsOf(a, QIN, "ximu"), 1);
  assert.equal(E.opsOf(a, CHU, "mozhe"), 1);
});

test("every card has English text, and no English text is left without a card", async () => {
  const { default: CARD_EN } = await import("../public/i18n/cards.en.js");
  for (const c of E.CARDS) assert.ok(CARD_EN[c.id] && CARD_EN[c.id].length > 5, `${c.id} has no English text`);
  for (const id of Object.keys(CARD_EN)) assert.ok(E.CARD[id], `${id} is not a card`);
});

test("every card can be played as its event from a fresh hand without throwing", () => {
  for (const card of E.CARDS) {
    if (card.scoring) continue;
    const side = card.side ?? QIN;
    const st = atAction(side === QIN ? [[card.id, "hexi"], ["mozhe"]] : [["hexi"], [card.id, "mozhe"]], { actor: side, phasing: side });
    setInf(st, "shangdang", 1, 1); setInf(st, "linzi", 1, 2); setInf(st, "handan", 2, 1);
    let a = play(st, side, card.id);
    for (let guard = 0; a.pending && guard < 6; guard++) {
      const p = a.pending;
      const choice = p.kind === "option" ? p.options[0].id
        : p.kind === "ops" ? { use: p.allowed[0], points: p.allowed[0] === "place" ? [p.options.placeOptions[0].id] : undefined, target: p.allowed[0] === "campaign" ? p.options.campaignTargets[0] : p.allowed[0] === "lobby" ? p.options.lobbyTargets[0].id : undefined }
        : p.options.slice(0, p.min ?? p.n ?? 1);
      a = choose(a, p.who, choice);
    }
    assert.equal(a.pending, null, `${card.id} left a pending choice`);
  }
});
