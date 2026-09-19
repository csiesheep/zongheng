// The deep sweep for the advisor, kept OUT of `npm test` on purpose: it plays
// whole bot-vs-bot games and asks the advisor at every single decision point,
// which is minutes of saturated CPU. `npm test` carries the short version
// (tests/advisor.test.js, 20 seeded games at four sampled points each); this
// is what you run when you want the long answer.
//
//   node tests/advisor-long.js                 # seeds 1..10, normal bots
//   node tests/advisor-long.js 50              # seeds 1..50
//   node tests/advisor-long.js 50 --resume     # pick up where it stopped
//   node tests/advisor-long.js 20 --level=hard # drive with hard bots (slow)
//
// Run ONE of these at a time. Progress lands in `__orch_advisor_long.json`
// after every game (untracked), so a machine that reboots loses one game, and
// `--resume` carries on. It also prints which reason keys actually came up,
// which is the number to quote when someone asks whether a key is reachable.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { advise } from "../public/shared/advisor.js";

const PROGRESS = new URL("../__orch_advisor_long.json", import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, "");
const args = process.argv.slice(2);
const games = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const level = (args.find((a) => a.startsWith("--level=")) ?? "--level=normal").slice(8);
const resume = args.includes("--resume");

let state = { done: 0, checks: 0, keys: {}, uses: {}, fails: [], ms: 0 };
if (resume && existsSync(PROGRESS)) {
  state = JSON.parse(readFileSync(PROGRESS, "utf8"));
  console.log(`resuming after seed ${state.done} (${state.checks} advices checked so far)`);
}

const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
function check(st, side, k) {
  const v = E.view(st, side);
  const adv = advise(v, side, E.makeRng(k));
  const want = B.decide(v, side, "hard", E.makeRng(k));
  if (want == null) {
    if (adv != null) state.fails.push(`${k}: advice with no hard move`);
    return;
  }
  state.checks++;
  if (JSON.stringify(adv?.action) !== JSON.stringify(want)) {
    state.fails.push(`${k}: advice ${JSON.stringify(adv?.action)} != hard ${JSON.stringify(want)}`);
    return;
  }
  try { E.apply(st, adv.action); } catch (e) { state.fails.push(`${k}: engine refused: ${e.message}`); }
  if (adv.card != null && adv.card !== E.JIUDING && !st.hands[side].includes(adv.card)) {
    state.fails.push(`${k}: ${adv.card} not in hand`);
  }
  for (const t of adv.targets) if (!E.SPACE[t]) state.fails.push(`${k}: ${t} is not a space`);
  bump(state.keys, adv.reason.key);
  bump(state.uses, String(adv.use));
}

const t0 = Date.now();
for (let seed = state.done + 1; seed <= games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed);
  for (let steps = 0; st.winner == null && steps < 6000; steps++) {
    const who = E.mustAct(st);
    if (!who.length) break;
    const side = who[rng.int(who.length)];
    check(st, side, seed * 10000 + steps);
    const a = B.decide(E.view(st, side), side, level, rng);
    if (!a) break;
    st = E.apply(st, a);
  }
  state.done = seed;
  state.ms = (state.ms || 0) + 0;
  writeFileSync(PROGRESS, JSON.stringify(state));
  console.log(`seed ${seed}: ${state.checks} advices, ${state.fails.length} failures, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.log(`\nchecked ${state.checks} advices over ${state.done} games (${level} bots driving), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log("reason keys:", JSON.stringify(state.keys));
console.log("uses:", JSON.stringify(state.uses));
if (state.fails.length) {
  console.log(`\n${state.fails.length} FAILURES`);
  for (const f of state.fails.slice(0, 20)) console.log("  " + f);
  process.exitCode = 1;
} else {
  console.log("no failures");
}
