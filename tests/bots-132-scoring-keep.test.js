// #132: at Chu's last action of a turn (Qin acts first in a round, so it is
// the last action before the turn-end check) a Chu holding a scoring card it
// can play must play it. The rulebook's turn-end check (engine endTurnChecks):
// a side still holding a scoring card loses; both holding one is a Chu win.
// So from Chu's seat, with Qin's hand hidden:
//   Qin holds none -> keeping loses by 記分, playing it goes on;
//   Qin holds one  -> keeping wins (記分2), and playing it wins too (Qin alone
//                     is left holding one).
// Playing the card is never worse, and keeping it is a loss in the only world
// where the choice matters. The bot used to fill Qin's hand with ONE guess; a
// guess holding a scoring card made every move look like a win, and the bot
// then kept its own card about as often as that guess came up.
//
// The position below is a real one for that: turn 1 (reform era), round 6 of
// 6, Chu to act with 西土記分 and two ordinary cards, Qin holding two ordinary
// cards (hidden from Chu). 三晉記分 and 南方記分 are both unseen, so a guess
// of Qin's two cards holds one of them about 18 % of the time.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { advise } from "../public/shared/advisor.js";

const { QIN, CHU, CARD } = E;
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

function lastChuAction() {
  let st = E.createGame(11);
  st = E.apply(st, { type: "choose", side: QIN, choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["song", "song", "huaisi", "chencai"] });
  const hands = [["hexi", "keqing"], ["score_west", "mozhe", "wuqi"]];
  st.draw = st.draw.concat(st.hands[0], st.hands[1]).filter((c) => !hands.flat().includes(c));
  st.hands = hands.map((h) => h.slice());
  Object.assign(st, { phase: "action", turn: 1, round: 6, rounds: 6, actor: CHU, phasing: CHU, plan: [], pending: null, headline: [null, null] });
  return st;
}

test("#132 the position is what it claims: Chu's last action, 西土記分 playable, Qin's hand hidden and free of scoring cards", () => {
  const st = lastChuAction();
  const L = E.legal(st, CHU);
  assert.equal(L.kind, "action");
  assert.ok(L.cards.some((c) => c.id === "score_west"), "西土記分 is a legal play");
  assert.ok(!st.hands[QIN].some((c) => CARD[c].scoring), "Qin truly holds no scoring card");
  const v = E.view(st, CHU);
  assert.ok(!Array.isArray(v.hands[QIN]), "Chu does not see Qin's hand");
  // Keeping it really is a loss by 記分 here: any non-scoring play ends the turn with Chu holding it.
  const keep = E.apply(st, { type: "play", side: CHU, card: "mozhe", use: "event" });
  assert.equal(keep.winner, QIN);
  assert.equal(keep.reason, "scoring");
  // Alive: the guess of Qin's hand the bot works from does hold a scoring card
  // for some seeds -- otherwise the tests below could not go red on the old bot.
  const guessed = SEEDS.filter((s) => B.determinize(v, CHU, E.makeRng(s)).hands[QIN].some((c) => CARD[c].scoring));
  assert.ok(guessed.length > 0, "no guess of Qin's hand held a scoring card: the position cannot tell");
});

for (const level of ["normal", "hard"]) {
  test(`#132 ${level} bot: at its last action of the turn Chu plays its scoring card, whatever it guesses of Qin's hand`, () => {
    const st = lastChuAction();
    const kept = [];
    for (const s of SEEDS) {
      const a = B.decide(E.view(st, CHU), CHU, level, E.makeRng(s));
      const after = E.apply(st, a);
      if (after.winner === QIN && after.reason === "scoring") kept.push(`seed ${s}: ${a.use}:${a.card}`);
    }
    assert.deepEqual(kept, [], `kept 西土記分 and lost by 記分 in ${kept.length}/${SEEDS.length}`);
  });
}

test("#132 advisor: it never advises Chu to keep the scoring card at its last action", () => {
  const st = lastChuAction();
  const bad = [];
  for (const s of SEEDS) {
    const adv = advise(E.view(st, CHU), CHU, E.makeRng(s));
    if (adv.card !== "score_west") bad.push(`seed ${s}: ${adv.use}:${adv.card} (${adv.reason.key})`);
  }
  assert.deepEqual(bad, [], `advised keeping 西土記分 in ${bad.length}/${SEEDS.length}`);
});
