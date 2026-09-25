// #115, BE. An event that places N points in a region (稷下學宮 3 in the East,
// 吳起變法 2 in the South, 胡服騎射 2 in the North) asked for exactly N picks
// with the cap checked per pick, so once the region had less than N points
// of room left there was NO legal answer: the pending could never be answered
// and the game froze -- for the owner's event and for the enemy's play alike.
// Rulebook 四、細則: 「「放 X 點」超過上限時多的消失。」 The points that fit land,
// the rest vanish; so an answer that fills the room must be accepted, and the
// region ends exactly at the cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

// An engine-built game at its first action round.
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
// Fill `region` with Chu influence to the cap, then take `room` points back out of `at`.
function saturate(st, region, at, room) {
  for (const s of E.SPACES) if (s.region === region) E.place(st, E.CHU, s.id, 99);
  E.remove(st, E.CHU, at, room);
}
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((c) => c !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((c) => c !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((c) => c !== card);
  st.hands[side].push(card);
  st.actor = side; st.phasing = side;
}
const chuIn = (st, region) => E.SPACES.filter((s) => s.region === region).reduce((n, s) => n + E.infOf(st, s.id)[E.CHU], 0);

const CASES = [
  { card: "jixia", region: "east", at: "xue", n: 3 },
  { card: "wuqi", region: "south", at: "huaisi", n: 2 },
  { card: "hufu", region: "north", at: "zhongshan", n: 2 },
];
for (const { card, region, at, n } of CASES) {
  for (const who of ["owner", "enemy"]) {
    test(`${card} (${n} in ${region}) with 1 point of room, played by the ${who}: the point that fits lands, the game goes on`, () => {
      const st = firstAction(11);
      saturate(st, region, at, 1);
      const player = who === "owner" ? E.CHU : E.QIN;
      give(st, player, card);
      const before = chuIn(st, region);
      const action = who === "owner" ? { type: "play", side: player, card, use: "event" } : { type: "play", side: player, card, use: "place", order: "eventFirst" };
      let s = E.apply(st, action);
      assert.ok(s.pending && s.pending.tag === "event" && s.pending.card === card, "the event asks where to place");
      assert.equal(s.pending.who, E.CHU, "the event's owner places");
      let answered;
      assert.doesNotThrow(() => { answered = E.apply(s, { type: "choose", side: E.CHU, choice: [at] }); }, `filling the one point of room in ${at} must be a legal answer`);
      assert.equal(E.infOf(answered, at)[E.CHU], E.capOf(answered, at), `${at} ends at the cap`);
      assert.equal(chuIn(answered, region), before + 1, "exactly one point landed; the rest vanished");
      // The bot, answering for the owner, must also find a legal answer.
      const botChoice = B.answer(s, s.pending, E.CHU, E.makeRng(1));
      assert.doesNotThrow(() => E.apply(s, { type: "choose", side: E.CHU, choice: botChoice }), "the bot's answer is legal");
    });
  }
}
