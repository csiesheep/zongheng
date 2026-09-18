// Bot-vs-bot harness. Plays whole games with both seats as bots, each seat
// deciding from its own view, and reports per rules cell how the games end.
// This is how the rulebook's open numbers get decided: by counts, not feel.
//
//   node tests/sim.js 200                       # normal vs normal, base rules
//   node tests/sim.js 200 seals=5 cap=3         # one cell
//   node tests/sim.js 200 qin=hard chu=normal   # levels
//   node tests/sim.js 200 --cells [--jobs=4]    # every cell in child processes, with retries
//
// Cells run as child processes because Node 24 on the development machine
// dies with an access violation a few percent of the time on long runs.
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

export function playGame(seed, { qin = "normal", chu = "normal", options = {} } = {}) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  const scores = [];
  let seen = 0;
  for (let steps = 0; st.winner == null; steps++) {
    if (steps > 6000) throw new Error(`seed ${seed}: no end after ${steps} actions`);
    const who = E.mustAct(st);
    const side = who[rng.int(who.length)];
    const a = B.decide(E.view(st, side), side, side === E.QIN ? qin : chu, rng);
    if (!a) throw new Error(`seed ${seed}: no action for ${side} at turn ${st.turn}`);
    st = E.apply(st, a);
    for (const l of st.log) if (l.i > seen && l.type === "score") scores.push(l);
    seen = st.logSeq || seen;
  }
  return { st, scores };
}

export function simulate({ games = 100, seed = 1, qin = "normal", chu = "normal", options = {} } = {}) {
  const t0 = Date.now();
  const out = { games, qin, chu, options, qinWins: 0, ends: {}, turns: 0, mandate: 0, absMandate: 0, mie: 0, seals: 0, regions: {}, errors: [] };
  for (let g = 0; g < games; g++) {
    let res;
    try { res = playGame(seed + g, { qin, chu, options }); } catch (e) { out.errors.push(`${seed + g}: ${e.message}`); continue; }
    const { st, scores } = res;
    if (st.winner === E.QIN) out.qinWins++;
    out.ends[st.reason] = (out.ends[st.reason] || 0) + 1;
    out.turns += st.turn; out.mandate += st.mandate; out.absMandate += Math.abs(st.mandate);
    out.mie += Object.keys(st.mieVp).length; out.seals += Object.keys(st.sealVp).length;
    for (const l of scores) {
      const r = out.regions[l.region] || (out.regions[l.region] = { n: 0, net: 0, q: 0, c: 0 });
      r.n++; r.net += l.qin.total - l.chu.total; r.q += l.qin.total; r.c += l.chu.total;
    }
  }
  out.played = games - out.errors.length;
  out.ms = Date.now() - t0;
  return out;
}

const ENDS = ["unification", "alliance", "mandate", "collapse", "scoring", "scoringBoth", "final", "tie"];
const SHORT = { unification: "一統", alliance: "合縱", mandate: "天命", collapse: "土崩", scoring: "記分", scoringBoth: "記分2", final: "終局", tie: "平手" };
function line(name, r) {
  const n = r.played || 1;
  const ends = ENDS.filter((e) => r.ends[e]).map((e) => `${SHORT[e]} ${(100 * r.ends[e] / n).toFixed(0)}%`).join(" ");
  const regions = Object.entries(r.regions).map(([k, v]) => `${k} ${(v.n / n).toFixed(1)}x ${(v.q / v.n).toFixed(1)}:${(v.c / v.n).toFixed(1)}`).join(" ");
  return `${name.padEnd(22)} n=${r.played}  Qin ${(100 * r.qinWins / n).toFixed(0).padStart(3)}%  turn ${(r.turns / n).toFixed(1)}  mandate ${(r.mandate / n) >= 0 ? "+" : ""}${(r.mandate / n).toFixed(1)}  滅 ${(r.mie / n).toFixed(2)} 相印 ${(r.seals / n).toFixed(2)}  ${(r.ms / n / 1000).toFixed(1)}s/game${r.errors.length ? `  ERRORS ${r.errors.length}` : ""}\n${"".padEnd(22)} ${ends}\n${"".padEnd(22)} ${regions}`;
}

export const CELLS = [
  ["base", {}],
  ["cap=3", { options: { cap: 3 } }],
  ["seals=5", { options: { seals: 5 } }],
  ["sealAt=cap", { options: { sealAt: "cap" } }],
  ["mie=2", { options: { mie: 2 } }],
  ["comp=0", { options: { comp: 0 } }],
  ["comp=4", { options: { comp: 4 } }],
  ["homeLock=3", { options: { homeLock: 3 } }],
  ["luoyi=0.5", { options: { luoyi: 0.5 } }],
  ["turns=9", { options: { turns: 9 } }],
  ["scoringSplit=v2", { options: { scoringSplit: "v2" } }],
  ["cap+comp0", { options: { sealAt: "cap", comp: 0 } }],
  ["cap+tieQin", { options: { sealAt: "cap", tie: "qin" } }],
  ["cap+seals5", { options: { sealAt: "cap", seals: 5 } }],
  ["cap+hangu3", { options: { sealAt: "cap", hangu: 3 } }],
  ["cap+hangu3+comp0", { options: { sealAt: "cap", hangu: 3, comp: 0 } }],
  ["hangu3", { options: { hangu: 3 } }],
  ["westBonus", { options: { westBonus: true } }],
  ["westBonus+comp1", { options: { westBonus: true, comp: 1 } }],
  ["cap+wuguo", { options: { sealAt: "cap", wuguo: "nonbg" } }],
  ["cap+hangu3+wuguo", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg" } }],
  ["s5+hangu3+wuguo", { options: { seals: 5, hangu: 3, wuguo: "nonbg" } }],
  ["cap+hangu3+wuguo+comp0", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg", comp: 0 } }],
  ["cap+hangu3+wuguo+comp1", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg", comp: 1 } }],
  ["qin=hard", { qin: "hard" }],
  ["chu=hard", { chu: "hard" }],
  ["qin=easy", { qin: "easy" }],
  ["chu=easy", { chu: "easy" }],
];

function parseArgs(argv) {
  const cfg = { games: 100, seed: 1, qin: "normal", chu: "normal", options: {}, cells: false, only: null, json: false, jobs: 4 };
  for (const a of argv) {
    if (a === "--cells") cfg.cells = true;
    else if (a.startsWith("--only=")) { cfg.cells = true; cfg.only = a.slice(7).split(","); }
    else if (a === "--json") cfg.json = true;
    else if (a.startsWith("--out=")) cfg.out = a.slice(6);
    else if (a.startsWith("--jobs=")) cfg.jobs = Number(a.slice(7));
    else if (/^\d+$/.test(a)) cfg.games = Number(a);
    else if (a.includes("=")) {
      const [k, v] = a.split("=");
      if (k === "qin" || k === "chu") cfg[k] = v;
      else if (k === "seed") cfg.seed = Number(v);
      else cfg.options[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return cfg;
}

// SIM_NODE_FLAGS="--single-threaded-gc" node tests/sim.js … passes V8 flags to the children.
const NODE_FLAGS = (process.env.SIM_NODE_FLAGS || "").split(" ").filter(Boolean);
function runChild(args, tries = 5) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...NODE_FLAGS, fileURLToPath(import.meta.url), ...args, "--json"], { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.on("close", (code) => {
      if (code === 0) { try { return resolve(JSON.parse(out)); } catch (e) { /* fall through */ } }
      if (tries > 1) return resolve(runChild(args, tries - 1));
      reject(new Error(`child failed: ${args.join(" ")}`));
    });
  });
}

// A chunk that dies every time is replayed one game at a time; the games that
// still kill Node are recorded as errors instead of ending the batch.
async function runOneByOne(args) {
  const n = Number(args[0]), seed = Number(args.find((a) => a.startsWith("seed=")).slice(5));
  const rest = args.slice(1).filter((a) => !a.startsWith("seed="));
  let total = null;
  for (let i = 0; i < n; i++) {
    let one;
    try { one = await runChild(["1", `seed=${seed + i}`, ...rest], 2); }
    catch { one = { games: 1, played: 0, qinWins: 0, ends: {}, turns: 0, mandate: 0, absMandate: 0, mie: 0, seals: 0, regions: {}, errors: [`${seed + i}: child crashed`], ms: 0 }; }
    total = merge(total, one);
  }
  return total;
}

function merge(a, b) {
  if (!a) return b;
  const out = { ...a, qinWins: a.qinWins + b.qinWins, turns: a.turns + b.turns, mandate: a.mandate + b.mandate, absMandate: a.absMandate + b.absMandate,
    mie: a.mie + b.mie, seals: a.seals + b.seals, played: a.played + b.played, games: a.games + b.games, ms: a.ms + b.ms, errors: a.errors.concat(b.errors), ends: { ...a.ends }, regions: { ...a.regions } };
  for (const [k, v] of Object.entries(b.ends)) out.ends[k] = (out.ends[k] || 0) + v;
  for (const [k, v] of Object.entries(b.regions)) {
    const r = out.regions[k] ? { ...out.regions[k] } : { n: 0, net: 0, q: 0, c: 0 };
    r.n += v.n; r.net += v.net; r.q += v.q; r.c += v.c; out.regions[k] = r;
  }
  return out;
}

// Each cell runs as several short child processes (CHUNK games each, seeds
// in sequence), so a crash costs a couple of minutes and a retry, not the cell.
const CHUNK = 10;
async function runCells(cfg) {
  const cells = CELLS.filter(([name]) => !cfg.only || cfg.only.includes(name));
  const queue = [];
  for (const [name, cell] of cells) {
    for (let start = 0; start < cfg.games; start += CHUNK) {
      const n = Math.min(CHUNK, cfg.games - start);
      queue.push({ name, args: [String(n), `seed=${cfg.seed + start}`, `qin=${cell.qin || cfg.qin}`, `chu=${cell.chu || cfg.chu}`, ...Object.entries({ ...cfg.options, ...(cell.options || {}) }).map(([k, v]) => `${k}=${v}`)] });
    }
  }
  const results = new Map(), pending = new Map(cells.map(([name]) => [name, Math.ceil(cfg.games / CHUNK)]));
  const worker = async () => {
    while (queue.length) {
      const { name, args } = queue.shift();
      // Await first, read after: reading the running total before the await
      // lets two workers overwrite each other's chunks.
      let chunk;
      try { chunk = await runChild(args); } catch { chunk = await runOneByOne(args); }
      results.set(name, merge(results.get(name), chunk));
      pending.set(name, pending.get(name) - 1);
      // `--out=file` keeps what is finished on disk: a long batch outlives the shell that started it.
      if (cfg.out) appendFileSync(cfg.out, `# ${new Date().toISOString()} ${name} ${results.get(name).played}/${cfg.games}\n`);
      if (pending.get(name) === 0) {
        const text = line(name, results.get(name));
        console.log(text);
        if (cfg.out) appendFileSync(cfg.out, text + "\n");
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, cfg.jobs) }, worker));
  if (cfg.out) appendFileSync(cfg.out, "# done\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.cells) await runCells(cfg);
  else {
    const r = simulate(cfg);
    if (cfg.json) console.log(JSON.stringify(r));
    else { console.log(line(`${cfg.qin} vs ${cfg.chu} ${JSON.stringify(cfg.options)}`, r)); for (const e of r.errors) console.log("  " + e); }
  }
}
