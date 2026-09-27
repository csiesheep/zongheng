// Records the replay fixtures the guards read (orchestrator-owned). Run on the build whose RULES the fixtures pin:
//   node tests/fixtures/record-replays.mjs
// It plays bot games and keeps, for each, the seed, the exact starting state (options included, as a save holds it),
// every action in order,
// and a sha256 of the final state. A replay (tests/defaults-130.test.js, tests/log-cap.test.js) feeds the same
// actions to the engine of a later build and must reach the same bytes. That pins the engine's rules for a saved
// game whatever the bots do now: a bot change can no longer break these guards, only a rule change can.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const hash = (st) => createHash("sha256").update(JSON.stringify(st)).digest("hex").slice(0, 16);

function record(seed, level, steps = 6000) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, {});
  const start = E.clone(st), options = E.clone(st.options);
  const actions = [];
  for (let k = 0; st.winner == null && k < steps; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const a = level === "easy" ? B.randomAction(st, side, rng) : B.decide(E.view(st, side), side, level, rng);
    actions.push(a);
    st = E.apply(st, a);
  }
  if (st.winner == null) throw new Error(`seed ${seed} ${level}: no end`);
  return { seed, level, options, start, actions, hash: hash(st), logSeq: st.logSeq, turn: st.turn, reason: st.reason };
}

const build = execSync("git rev-parse --short HEAD").toString().trim();
const games = [];
for (const seed of [1, 2, 3, 4, 5]) games.push(record(seed, "easy"));
for (const seed of [7, 8]) games.push(record(seed, "normal"));
games.push(record(7, "hard"));
// The long game for #128's log guard: normal seed 81, the longest of seeds 1-125 on 1d73cc4 (416 entries; seed 62,
// the old pick, now ends at 262).
const long = record(81, "normal");
long.use = "long";
games.push(long);
for (const g of games) console.log(g.level, g.seed, g.actions.length, "actions", g.logSeq, "entries", "turn", g.turn, g.reason, g.hash);
writeFileSync(new URL("./replays.json", import.meta.url), JSON.stringify({ build, recorded: new Date().toISOString(), games }));
console.log("wrote tests/fixtures/replays.json from", build);
