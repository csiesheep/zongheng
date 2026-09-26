// #115 (orchestrator's addition), BE. Owner: 「說客有問題,沒有選擇另一張對手陣營的
// 牌一起出」. 說客's text: 「與手中另一張對手陣營的牌同時打出(共占 1 個行動回合):
// 該牌事件不觸發,使用該牌的行動點。」 The engine played the pair -- its ops were
// spent, both cards went to the discard pile -- but the `play` entry said only
// `card: "shuoke"`, so the log and the opponent's reveal showed 說客 alone and the
// paired card was never seen. A paired play must name its pair.
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
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((x) => x !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((x) => x !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((x) => x !== card);
  st.hands[side].push(card);
}

for (const [side, pair] of [[E.CHU, "simacuo"], [E.QIN, "suqin"]]) {
  test(`說客 paired with ${pair}: the play entry names the pair, the pair's ops are spent, no event, both discarded`, () => {
    const st = firstAction(9);
    st.actor = side; st.phasing = side;
    give(st, side, "shuoke"); give(st, side, pair);
    const ops = E.opsOf(st, side, pair);
    const points = B.greedyPlacement(st, side, ops);
    const seq = st.logSeq;
    const s = E.apply(st, { type: "play", side, card: "shuoke", pair, use: "place", points });
    const L = s.log.filter((l) => l.i > seq);
    const play = L.find((l) => l.type === "play");
    assert.equal(play.card, "shuoke");
    assert.equal(play.pair, pair, "the play entry names the paired card");
    const place = L.find((l) => l.type === "place");
    assert.ok(place && place.spent <= ops && place.spent > 1, `the pair's ${ops} ops are spent, not 說客's 1`);
    // The pair's event would add the OTHER side's influence (司馬錯伐蜀: 秦 in 巴蜀;
    // 蘇秦合縱: 楚 in the five capitals). A placement only adds the player's own.
    const theirs = (x) => E.SPACES.reduce((n, sp) => n + E.infOf(x, sp.id)[1 - side], 0);
    assert.equal(theirs(s), theirs(st), "the pair's event does not fire");
    assert.ok(!L.some((l) => l.type === "event"), "no event is logged");
    assert.ok(s.discard.includes("shuoke") && s.discard.includes(pair), "both cards go to the discard pile");
  });
}

test("說客 played alone keeps a play entry with no pair", () => {
  const st = firstAction(9);
  const side = st.actor;
  give(st, side, "shuoke");
  const seq = st.logSeq;
  const s = E.apply(st, { type: "play", side, card: "shuoke", use: "place", points: B.greedyPlacement(st, side, 1) });
  const play = s.log.filter((l) => l.i > seq).find((l) => l.type === "play");
  assert.equal(play.card, "shuoke");
  assert.equal(play.pair, undefined);
});
