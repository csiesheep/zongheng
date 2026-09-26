// #119, BE. 荊軻刺秦王 (jingke, 63, Chu, 2 ops). Rulebook card table:
//   「秦本回合剩餘所有牌行動點 −1(最低 1);楚須棄掉手中行動點最高的牌,事件不觸發。」
// owner 裁決(#119):「其他照牌文字面改」 -- read literally: when Qin plays this
// Chu card for ops with the EVENT FIRST, the event resolves before the card's
// own ops are spent, so this card is one of Qin's remaining plays this turn
// and its ops are 2 − 1 (minimum 1). Ops first, the ops are spent before the
// event: no change. Chu playing it as its own event: no change.
// Rulebook 四、細則: 「持續效果同時存在時全部疊加,行動點最低為 1(逐客令、荊軻)。」
// 商鞅變法 +1 (「本回合秦所有牌行動點 +1」) and 逐客令 −1 stack with it.
//
// Expected ops are read off the card table (荊軻 2, 長平之戰 4, 連橫使節 1) and
// the texts above, not off `opsOf`.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

function firstAction(seed) {
  let st = E.createGame(seed);
  const rng = E.makeRng(seed);
  for (let g = 0; g < 50 && (st.phase !== "action" || st.pending); g++) {
    const who = E.mustAct(st)[0];
    st = E.apply(st, B.decide(E.view(st, who), who, "easy", rng));
  }
  assert.equal(st.phase, "action");
  return st;
}
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((c) => c !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((c) => c !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((c) => c !== card);
  st.hands[side].push(card);
}
function setup(seat, lasting = []) {
  const st = firstAction(3);
  for (const e of lasting) E.addEffect(st, e);
  give(st, seat, "jingke");
  give(st, E.QIN, "changping"); // 4 ops: one of Qin's remaining cards
  give(st, E.QIN, "envoy"); // 1 op: the minimum
  st.actor = seat; st.phasing = seat;
  return st;
}
const SHANGYANG = { card: "shangyang", side: E.QIN, kind: "opsAll", target: E.QIN, delta: 1, until: "turn" };
const ZHUKELING = { card: "zhukeling", side: E.CHU, kind: "opsAll", target: E.QIN, delta: -1, until: "turn" };

const EVENT_FIRST = [
  { name: "no other lasting effect: 2 − 1 = 1", lasting: [], ops: 1, changping: 3 },
  { name: "商鞅變法 in play: 2 + 1 − 1 = 2", lasting: [SHANGYANG], ops: 2, changping: 4 },
  { name: "逐客令 in play: 2 − 1 − 1, minimum 1", lasting: [ZHUKELING], ops: 1, changping: 2 },
];
for (const c of EVENT_FIRST) {
  test(`jingke played by Qin for ops, event first -- ${c.name}`, () => {
    const st = setup(E.QIN, c.lasting);
    const s = E.apply(st, { type: "play", side: E.QIN, card: "jingke", use: "place", order: "eventFirst" });
    assert.ok(s.pending && s.pending.tag === "ops" && s.pending.card === "jingke", "after the event, Qin is asked for the card's ops");
    assert.equal(s.pending.ops, c.ops, "this card's own ops, read after its event");
    assert.equal(E.opsOf(s, E.QIN, "changping"), c.changping, "長平之戰 (4) this turn");
    assert.equal(E.opsOf(s, E.QIN, "envoy"), 1, "連橫使節 (1) stays at the minimum 1");
    // The answer is held to those ops: one more point than the ops is refused; the bot's answer is legal.
    const place = E.opsOptions(s, E.QIN).placeOptions.filter((o) => o.cost === 1 && E.capOf(s, o.id) - E.infOf(s, o.id)[E.QIN] >= 3).map((o) => o.id);
    assert.ok(place.length, "a space to place in");
    const over = Array(c.ops + 1).fill(place[0]);
    assert.throws(() => E.apply(s, { type: "choose", side: E.QIN, choice: { use: "place", points: over } }), "ops + 1 points refused");
    const botChoice = B.answer(s, s.pending, E.QIN, E.makeRng(1));
    assert.doesNotThrow(() => E.apply(s, { type: "choose", side: E.QIN, choice: botChoice }), "the bot's answer is legal");
  });
}

test("jingke played by Qin for ops, ops first: the 2 ops are spent before the event, unchanged", () => {
  const st = setup(E.QIN);
  const place = E.opsOptions(st, E.QIN).placeOptions.filter((o) => o.cost === 1 && E.capOf(st, o.id) - E.infOf(st, o.id)[E.QIN] >= 2).map((o) => o.id);
  assert.ok(place.length, "a space to place in");
  let s;
  assert.doesNotThrow(() => { s = E.apply(st, { type: "play", side: E.QIN, card: "jingke", use: "place", order: "opsFirst", points: [place[0], place[0]] }); }, "2 points for 2 ops");
  const placed = s.log.filter((l) => l.type === "place" && l.side === E.QIN).pop();
  assert.equal(placed.spent, 2, "2 ops spent");
  assert.equal(E.opsOf(s, E.QIN, "changping"), 3, "the rest of Qin's cards: 4 − 1");
  assert.equal(E.opsOf(s, E.QIN, "envoy"), 1, "minimum 1");
});

test("jingke played by Chu as its event: Qin's remaining cards −1 (minimum 1), unchanged", () => {
  const st = setup(E.CHU);
  const s = E.apply(st, { type: "play", side: E.CHU, card: "jingke", use: "event" });
  assert.equal(E.opsOf(s, E.QIN, "changping"), 3, "4 − 1");
  assert.equal(E.opsOf(s, E.QIN, "envoy"), 1, "minimum 1");
});
