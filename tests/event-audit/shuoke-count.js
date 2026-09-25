// #115 (orchestrator's addition): how do the bots play 說客 (shuoke)?
//
//   node tests/event-audit/shuoke-count.js [games=100] [level=normal] [seed=1]
//
// Plays whole bot-vs-bot games (both seats at `level`) and counts every
// 說客 the bots commit, by the ACTION they sent -- not by the log, which on
// main 2f4e5f0 does not name the pair:
//   paired        - played with an enemy card (the pair's ops, no event)
//   aloneOps      - played alone for its own 1 op (place / campaign / lobby)
//   aloneEvent    - played alone as its event: its effect is empty, a dead play
//   headline      - put up as a headline: also a dead event
// plus, for each dead play, whether the bot had an enemy card in hand and
// how many other legal plays it had (so "it had no choice" is visible).
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const [games = 100, level = "normal", seed0 = 1] = process.argv.slice(2).map((x, i) => (i === 1 ? x : Number(x)));
const out = { games: 0, level, errors: 0, paired: 0, aloneOps: 0, aloneEvent: 0, headline: 0, deadWithEnemyInHand: 0, deadWithOtherPlays: 0, deadOnlyPlay: 0 };
for (let g = 0; g < games; g++) {
  const seed = seed0 + g;
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed);
  try {
    for (let steps = 0; st.winner == null && steps < 6000; steps++) {
      const who = E.mustAct(st);
      if (!who.length) break;
      const side = who[rng.int(who.length)];
      const a = B.decide(E.view(st, side), side, level, rng);
      if (!a) break;
      if (a.card === "shuoke") {
        if (a.type === "headline") out.headline++;
        else if (a.pair) out.paired++;
        else if (a.use === "event") {
          out.aloneEvent++;
          const L = E.legal(st, side);
          const enemyInHand = st.hands[side].some((c) => E.CARD[c].side === 1 - side);
          if (enemyInHand) out.deadWithEnemyInHand++;
          const others = L.kind === "action" ? L.cards.filter((c) => c.id !== "shuoke").length + (L.jiuding ? 1 : 0) + (L.cards.find((c) => c.id === "shuoke")?.uses.place || L.cards.find((c) => c.id === "shuoke")?.uses.campaign || L.cards.find((c) => c.id === "shuoke")?.uses.lobby ? 1 : 0) : 0;
          if (others > 0) out.deadWithOtherPlays++; else out.deadOnlyPlay++;
        } else if (a.type === "play") out.aloneOps++;
      }
      st = E.apply(st, a);
    }
    out.games++;
  } catch (e) { out.errors++; }
}
console.log(JSON.stringify(out));
