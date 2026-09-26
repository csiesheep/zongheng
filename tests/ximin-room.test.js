// #119, BE. 徙民實邊 (ximin, 51, neutral). Rulebook card table:
//   「打出者移除自己 4 點影響力,重新分配到任意據點,每據點最多 2 點,不受相鄰限制。」
// owner 裁決(#119):「5 修」 -- the freeze #115 fixed for 稷下學宮 / 吳起變法 /
// 胡服騎射 must not survive here. The second stage asked for exactly as many
// points as were removed, with the cap checked per pick and 2 per space at
// most; with less room than that on the whole map there was NO legal answer
// and the game froze.
// Rulebook 四、細則: 「「放 X 點」超過上限時多的消失。」 So the points that fit
// land and the rest vanish: an answer that fills all the room must be legal.
//
// Room, from the text and the cap rule (三、影響力與控制: cap = S + 2), not
// from the engine: a space holding the player at the cap everywhere has room
// only where the removed points came from, and at most 2 per space.
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
const total = (st, side) => E.SPACES.reduce((n, s) => n + E.infOf(st, s.id)[side], 0);

// `removeFrom`: the stage-1 answer (the player's own points, one id per point).
// `room`: how many can come back -- per space min(2, points removed there),
// since every other space is at the cap.
const CASES = [
  { name: "4 removed from one space (hedong, cap 4): 2 can come back", removeFrom: ["hedong", "hedong", "hedong", "hedong"], back: ["hedong", "hedong"], room: 2 },
  { name: "3 from one space, 1 from another: 3 can come back", removeFrom: ["linzi", "linzi", "linzi", "xue"], back: ["linzi", "linzi", "xue"], room: 3 },
];
for (const c of CASES) {
  for (const player of [E.QIN, E.CHU]) {
    test(`ximin, played by ${player === E.QIN ? "Qin" : "Chu"}, the player at the cap everywhere: ${c.name}; the game goes on`, () => {
      const st = firstAction(5);
      for (const s of E.SPACES) st.inf[s.id] = player === E.QIN ? [E.capOf(st, s.id), 0] : [0, E.capOf(st, s.id)];
      give(st, player, "ximin");
      const before = total(st, player);
      let s = E.apply(st, { type: "play", side: player, card: "ximin", use: "event" });
      assert.ok(s.pending && s.pending.tag === "event" && s.pending.card === "ximin", "stage 1 asks what to remove");
      assert.equal(s.pending.who, player, "the player chooses");
      s = E.apply(s, { type: "choose", side: player, choice: c.removeFrom });
      assert.ok(s.pending && s.pending.tag === "event" && s.pending.card === "ximin", "stage 2 asks where to put them");
      const stage2 = s;
      let done;
      assert.doesNotThrow(() => { done = E.apply(s, { type: "choose", side: player, choice: c.back }); }, "filling all the room there is must be a legal answer");
      assert.equal(total(done, player), before - 4 + c.room, `4 removed, ${c.room} came back, the rest vanished`);
      for (const id of new Set(c.removeFrom)) assert.equal(E.infOf(done, id)[player], E.capOf(done, id) - c.removeFrom.filter((x) => x === id).length + c.back.filter((x) => x === id).length, `${id} after`);
      assert.ok(!done.pending || done.pending.card !== "ximin", "the event is over");
      // The bot, answering for the player, must find a legal answer too.
      const botChoice = B.answer(stage2, stage2.pending, player, E.makeRng(1));
      assert.doesNotThrow(() => E.apply(stage2, { type: "choose", side: player, choice: botChoice }), "the bot's answer is legal");
    });
  }
}
// With room to spare nothing changes: all 4 must come back (the minimum is not lowered for its own sake).
test("ximin with room to spare: all 4 removed points must be placed again", () => {
  const st = firstAction(5);
  give(st, E.QIN, "ximin");
  const mine = E.SPACES.filter((sp) => E.infOf(st, sp.id)[E.QIN] > 0).map((sp) => sp.id);
  const pickFour = [];
  for (const id of mine) for (let i = 0; i < E.infOf(st, id)[E.QIN] && pickFour.length < 4; i++) pickFour.push(id);
  let s = E.apply(st, { type: "play", side: E.QIN, card: "ximin", use: "event" });
  s = E.apply(s, { type: "choose", side: E.QIN, choice: pickFour });
  const empty = E.SPACES.filter((sp) => E.infOf(s, sp.id)[E.QIN] === 0 && E.infOf(s, sp.id)[E.CHU] === 0).map((sp) => sp.id).slice(0, 3);
  assert.throws(() => E.apply(s, { type: "choose", side: E.QIN, choice: empty }), /wrong count/, "3 of 4 with room for 4 is refused");
});
