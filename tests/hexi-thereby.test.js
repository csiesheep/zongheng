// #119, BE. 收復河西 (hexi, 08). Rulebook card table:
//   「秦在河東放 2;若秦因此控制河東,再移除楚在大梁 1。」
// owner 裁決(#119):「5 修，其他照牌文字面改」 -- 「因此」 read literally: the
// removal in 大梁 happens only when the 2 placed in 河東 are what gave Qin
// control there. Qin already controlling 河東 before the event gets the 2
// points and nothing in 大梁; Qin still short of control afterwards gets
// nothing in 大梁 either.
//
// Expectations are read off the text and the control rule (rulebook 三、影響力與控制:
// control = own influence >= enemy influence + stability; 河東 stability 2),
// not off the engine.
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
  st.actor = side; st.phasing = side;
}
// The board around the event: 河東 [Qin, Chu], 大梁 Chu 3 (Qin 0), so a removal shows as 3 -> 2.
function board(hedong) {
  const st = firstAction(7);
  st.inf.hedong = hedong.slice();
  st.inf.daliang = [0, 3];
  return st;
}
// Play hexi: by Qin as its own event, or by Chu for ops with the event first
// (the event's outcome must not depend on who played it).
function playHexi(st, by) {
  give(st, by, "hexi");
  const action = by === E.QIN ? { type: "play", side: by, card: "hexi", use: "event" } : { type: "play", side: by, card: "hexi", use: "place", order: "eventFirst" };
  return E.apply(st, action);
}

const CASES = [
  // [河東 before, Qin controls before?, Qin controls after?, 大梁 Chu after]
  { name: "Qin already controls 河東 (2 vs 0): the 2 land, 大梁 untouched", hedong: [2, 0], after: [4, 0], daliang: 3 },
  { name: "Qin gains control of 河東 by the 2 (0 vs 0 -> 2 vs 0): 大梁 loses 1", hedong: [0, 0], after: [2, 0], daliang: 2 },
  { name: "Qin gains control of 河東 by the 2 (1 vs 1 -> 3 vs 1): 大梁 loses 1", hedong: [1, 1], after: [3, 1], daliang: 2 },
  { name: "Qin still short of control after the 2 (0 vs 2 -> 2 vs 2): 大梁 untouched", hedong: [0, 2], after: [2, 2], daliang: 3 },
];
for (const c of CASES) {
  for (const by of [E.QIN, E.CHU]) {
    test(`hexi, played by ${by === E.QIN ? "Qin as its event" : "Chu for ops, event first"}: ${c.name}`, () => {
      const s = playHexi(board(c.hedong), by);
      assert.deepEqual(E.infOf(s, "hedong"), c.after, "河東 after the 2");
      assert.equal(E.infOf(s, "daliang")[E.CHU], c.daliang, "Chu in 大梁");
    });
  }
}
