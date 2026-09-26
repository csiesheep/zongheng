// #115, BE. 張儀欺楚 (zhangyi2): 「移除楚在任一國都 2 點影響力;若楚因此失去相印,
// 秦天命 +1。」 Rulebook 三、滅國與相印: a 相印 「標記持續到秦控制該國國都為止」,
// and 四、細則 「國都被秦控制時楚的相印立刻移除,即使原因是事件」. So Chu loses the
// seal -- and Qin gains the +1 -- only when Qin CONTROLS the capital after the
// removal. The card gave the +1 whenever Chu merely stopped controlling it: the
// capital went uncontrolled, Chu kept the seal, and Qin still scored.
// Expected values below are from those two sentences, not from the card's code.
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
  return st;
}
function setInf(st, id, q, c) { st.inf[id] = [q, c]; }
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((x) => x !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((x) => x !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((x) => x !== card);
  st.hands[side].push(card);
  st.actor = side; st.phasing = side;
}
// 新鄭 (xinzheng), stability 2, cap 4. 宜陽 emptied so no 滅 can muddy the mandate.
function sealed(q, c) {
  const st = firstAction(5);
  setInf(st, "yiyang", 0, 0);
  setInf(st, "xinzheng", 1, 4);
  E.checkMarkers(st);
  assert.ok(st.seals.han, "setup: Chu holds Han's seal (capital controlled at the cap)");
  setInf(st, "xinzheng", q, c); // the seal stays until Qin controls the capital
  E.checkMarkers(st);
  assert.ok(st.seals.han, `setup: the seal survives at 秦 ${q} / 楚 ${c}`);
  return st;
}
function playZhangyi2(st, player) {
  give(st, player, "zhangyi2");
  const action = player === E.QIN ? { type: "play", side: player, card: "zhangyi2", use: "event" } : { type: "play", side: player, card: "zhangyi2", use: "place", order: "eventFirst" };
  let s = E.apply(st, action);
  assert.equal(s.pending?.card, "zhangyi2");
  s = E.apply(s, { type: "choose", side: E.QIN, choice: ["xinzheng"] });
  return s;
}

for (const player of [E.QIN, E.CHU]) {
  const who = player === E.QIN ? "Qin's own event" : "Chu's play for ops";
  test(`張儀欺楚, ${who}: the capital goes uncontrolled, Chu keeps the seal, no +1`, () => {
    const st = sealed(1, 4); // Chu controls (4 >= 1 + 2); after -2: 秦 1 / 楚 2, nobody controls
    const m0 = st.mandate;
    const s = playZhangyi2(st, player);
    assert.deepEqual(E.infOf(s, "xinzheng"), [1, 2]);
    assert.equal(E.controller(s, "xinzheng"), null);
    assert.ok(s.seals.han, "Chu still holds the seal");
    assert.equal(s.mandate, m0, "no seal lost, so no +1");
  });
  test(`張儀欺楚, ${who}: Qin controls the capital afterwards, the seal goes, +1`, () => {
    const st = sealed(3, 2); // nobody controls; after -2: 秦 3 / 楚 0, Qin controls (3 >= 0 + 2)
    const m0 = st.mandate;
    const s = playZhangyi2(st, player);
    assert.equal(E.controller(s, "xinzheng"), E.QIN);
    assert.ok(!s.seals.han, "the seal is gone");
    assert.equal(s.mandate, m0 + 1, "seal lost: 秦天命 +1");
  });
}
