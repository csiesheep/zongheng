// Bot-vs-bot harness. Plays whole games with both seats as bots, each seat
// deciding from its own view, and reports per rules cell how the games end.
// This is how the rulebook's open numbers get decided: by counts, not feel.
//
//   node tests/sim.js 200                       # normal vs normal, base rules
//   node tests/sim.js 200 seals=5 cap=3         # one cell
//   node tests/sim.js 200 qin=hard chu=normal   # levels
//   node tests/sim.js 200 --cells [--jobs=4]    # every cell in child processes, with retries
//   node tests/sim.js 1000 --only=nn/control,nn/ts --out=f.txt [--resume]   # resumable batch
//   node tests/sim.js --report=f.txt.state.json # markdown table with 95% intervals (#104)
//
// Cells run as child processes because Node 24 on the development machine
// dies with an access violation a few percent of the time on long runs.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

// #104: every real place action is watched through `E.probe.place`, which the
// engine calls once per `placePoints` before the first point. The probe is on
// only around the game's own `E.apply` (never while a bot thinks), and the dry
// run `validateOps` makes first is skipped by its emptied log. Per action it
// records the spaces eligible at the start under both reach rules, measured
// here from influence and control, not from the engine's `canPlaceAt`:
//   chained  - a point outside today's start set (own influence, or control next door)
//   beyondTs - a point outside the TS start set (own influence here or next door)
// `probeMiss` counts games where the watched actions and the logged "place"
// entries disagree in number, or a logged entry is not the one a watched call
// produced (its log number), so a probe that stops seeing placements, or sees
// the dry run instead of the real one, shows up.
function startSets(st, side) {
  const ctl = new Set(), ts = new Set();
  for (const sp of E.SPACES) {
    const own = E.infOf(st, sp.id)[side] > 0;
    if (own || sp.adj.some((a) => E.controller(st, a) === side)) ctl.add(sp.id);
    if (own || sp.adj.some((a) => E.infOf(st, a)[side] > 0)) ts.add(sp.id);
  }
  return { ctl, ts };
}
export function playGame(seed, { qin = "normal", chu = "normal", options = {} } = {}) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  const scores = [];
  let seen = 0;
  const pl = { places: 0, placedPts: 0, chained: 0, chainedPts: 0, beyondTs: 0, beyondTsPts: 0, logged: 0, unmatched: 0 };
  const seqs = new Set(); // the log number each watched placement will get
  const watch = (s, side, points) => {
    if (!s.log.length) return;
    seqs.add((s.logSeq || 0) + 1);
    const { ctl, ts } = startSets(s, side);
    const outC = points.filter((id) => !ctl.has(id)).length, outT = points.filter((id) => !ts.has(id)).length;
    pl.places++; pl.placedPts += points.length;
    if (outC) { pl.chained++; pl.chainedPts += outC; }
    if (outT) { pl.beyondTs++; pl.beyondTsPts += outT; }
  };
  // #121: the reform track. Box 6 (稱帝) reach turn per side from the "reform"
  // log entries; every card play from the "play" entries, kept by log number
  // and re-read while still in the log, because an event-first enemy card
  // writes its real ops use back into its entry only when the ops are chosen.
  const rf = { reach6: [0, 0], advances: [0, 0] };
  const plays = new Map();
  for (let steps = 0; st.winner == null; steps++) {
    if (steps > 6000) throw new Error(`seed ${seed}: no end after ${steps} actions`);
    const who = E.mustAct(st);
    const side = who[rng.int(who.length)];
    const a = B.decide(E.view(st, side), side, side === E.QIN ? qin : chu, rng);
    if (!a) throw new Error(`seed ${seed}: no action for ${side} at turn ${st.turn}`);
    E.probe.place = watch;
    try { st = E.apply(st, a); } finally { E.probe.place = null; }
    for (const l of st.log) if (l.i > seen && l.type === "score") scores.push(l);
    for (const l of st.log) if (l.i > seen && l.type === "place") { pl.logged++; if (!seqs.has(l.i)) pl.unmatched++; }
    for (const l of st.log) {
      if (l.type === "play" && (l.i > seen || plays.has(l.i))) plays.set(l.i, { side: l.side, card: l.card, pair: l.pair, use: l.use });
      if (l.i > seen && l.type === "reform") { rf.advances[l.side]++; if (l.box === 6) rf.reach6[l.side] = l.t; }
    }
    seen = st.logSeq || seen;
  }
  const byUse = {};
  const reformUses = [0, 0];
  for (const p of plays.values()) {
    const ops = p.card === E.JIUDING ? 4 : E.CARD[p.pair || p.card].ops;
    const u = byUse[p.use] || (byUse[p.use] = { n: 0, ops: 0 });
    u.n++; u.ops += ops;
    if (p.use === "reform") reformUses[p.side]++;
  }
  const first6 = st.reformFirst[6] ?? -1;
  // Appended to the row in EMP_ROW order.
  const emp = [rf.reach6[0], rf.reach6[1], first6, st.reform[0], st.reform[1], reformUses[0], reformUses[1],
    rf.advances[0] + rf.advances[1] - reformUses[0] - reformUses[1],
    ...EMP_USES.flatMap((u) => [byUse[u]?.n || 0, byUse[u]?.ops || 0])];
  return { st, scores, pl, emp };
}
// #121: per-game reform columns, appended after ROW. Reach turns are 0 when the
// side never reached box 6; first6 is -1 when nobody did. Ops are face values
// (九鼎 4; 說客's pair: the paired card's), both sides together.
export const EMP_USES = ["event", "place", "campaign", "lobby", "reform", "bog"];
export const EMP_ROW = ["q6turn", "c6turn", "first6", "qBox", "cBox", "qReformUses", "cReformUses", "eventAdvances",
  ...EMP_USES.flatMap((u) => [`n_${u}`, `ops_${u}`])];

export function simulate({ games = 100, seed = 1, qin = "normal", chu = "normal", options = {} } = {}) {
  const t0 = Date.now();
  const out = { games, qin, chu, options, qinWins: 0, ends: {}, turns: 0, mandate: 0, absMandate: 0, mie: 0, seals: 0, regions: {}, errors: [],
    places: 0, placedPts: 0, chained: 0, chainedPts: 0, beyondTs: 0, beyondTsPts: 0, probeMiss: 0, stuck: 0, rows: [] };
  for (let g = 0; g < games; g++) {
    let res;
    try { res = playGame(seed + g, { qin, chu, options }); } catch (e) {
      out.errors.push(`${seed + g}: ${e.message}`);
      if (/no end after|no action for/.test(e.message)) out.stuck++;
      continue;
    }
    const { st, scores, pl, emp } = res;
    for (const k of ["places", "placedPts", "chained", "chainedPts", "beyondTs", "beyondTsPts"]) out[k] += pl[k];
    if (pl.logged !== pl.places || pl.unmatched) out.probeMiss++;
    if (st.winner === E.QIN) out.qinWins++;
    out.ends[st.reason] = (out.ends[st.reason] || 0) + 1;
    out.turns += st.turn; out.mandate += st.mandate; out.absMandate += Math.abs(st.mandate);
    out.mie += Object.keys(st.mieVp).length; out.seals += Object.keys(st.sealVp).length;
    // One row per game (ROW names the columns), so `--report` can give intervals,
    // distributions and the outlying seeds, not only the means.
    out.rows.push([seed + g, st.winner === E.QIN ? 1 : 0, st.reason, st.turn, st.mandate, Object.keys(st.mieVp).length, Object.keys(st.sealVp).length,
      pl.places, pl.placedPts, pl.chained, pl.chainedPts, pl.beyondTs, ...emp]);
    for (const l of scores) {
      const r = out.regions[l.region] || (out.regions[l.region] = { n: 0, net: 0, q: 0, c: 0 });
      r.n++; r.net += l.qin.total - l.chu.total; r.q += l.qin.total; r.c += l.chu.total;
    }
  }
  out.played = games - out.errors.length;
  out.ms = Date.now() - t0;
  return out;
}

const ENDS = ["unification", "alliance", "mandate", "collapse", "scoring", "scoringBoth", "final", "tie", "emperor"];
const SHORT = { unification: "一統", alliance: "合縱", mandate: "天命", collapse: "土崩", scoring: "記分", scoringBoth: "記分2", final: "終局", tie: "平手", emperor: "稱帝" };
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
  ["round1Rules", { options: { westBonus: false, yue: "lasting" } }],
  ["westBonus", { options: { westBonus: true, yue: "lasting" } }],
  ["noYue", { options: { westBonus: false, yue: "none" } }],
  ["westBonus+noYue", { options: { westBonus: true, yue: "none" } }],
  ["westBonus+comp1", { options: { westBonus: true, yue: "lasting", comp: 1 } }],
  ["cap+wuguo", { options: { sealAt: "cap", wuguo: "nonbg" } }],
  ["cap+hangu3+wuguo", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg" } }],
  ["s5+hangu3+wuguo", { options: { seals: 5, hangu: 3, wuguo: "nonbg" } }],
  ["cap+hangu3+wuguo+comp0", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg", comp: 0 } }],
  ["cap+hangu3+wuguo+comp1", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg", comp: 1 } }],
  ["qin=hard", { qin: "hard" }],
  ["chu=hard", { chu: "hard" }],
  ["qin=easy", { qin: "easy" }],
  ["chu=easy", { chu: "easy" }],
  // #104: placement reach, today's rule against Twilight Struggle 6.1 (option B).
  ["nn/control", { options: { reach: "control" } }],
  ["nn/ts", { options: { reach: "ts" } }],
  ["hh/control", { qin: "hard", chu: "hard", options: { reach: "control" } }],
  ["hh/ts", { qin: "hard", chu: "hard", options: { reach: "ts" } }],
  ["hqnc/control", { qin: "hard", chu: "normal", options: { reach: "control" } }],
  ["hqnc/ts", { qin: "hard", chu: "normal", options: { reach: "ts" } }],
  ["nqhc/control", { qin: "normal", chu: "hard", options: { reach: "control" } }],
  ["nqhc/ts", { qin: "normal", chu: "hard", options: { reach: "ts" } }],
  // #121: what reaching reform box 6 (稱帝) first is worth. emp/<lvl>/vp is today's rule.
  ...["nn", "hh"].flatMap((lv) => E.EMPEROR.map((v) => [`emp/${lv}/${v}`, { qin: lv === "nn" ? "normal" : "hard", chu: lv === "nn" ? "normal" : "hard", options: { emperor: v } }])),
];

function parseArgs(argv) {
  const cfg = { games: 100, seed: 1, qin: "normal", chu: "normal", options: {}, cells: false, only: null, json: false, jobs: 4 };
  for (const a of argv) {
    if (a === "--cells") cfg.cells = true;
    else if (a.startsWith("--only=")) { cfg.cells = true; cfg.only = a.slice(7).split(","); }
    else if (a === "--json") cfg.json = true;
    else if (a.startsWith("--out=")) cfg.out = a.slice(6);
    else if (a === "--resume") cfg.resume = true;
    else if (a.startsWith("--chunk=")) cfg.chunk = Math.max(1, Number(a.slice(8)) || 10);
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
    catch { one = { games: 1, played: 0, qinWins: 0, ends: {}, turns: 0, mandate: 0, absMandate: 0, mie: 0, seals: 0, regions: {}, errors: [`${seed + i}: child crashed`], ms: 0, ...Object.fromEntries(SUMS.map((k) => [k, 0])) }; }
    total = merge(total, one);
  }
  return total;
}

export const ROW = ["seed", "qinWin", "reason", "turn", "mandate", "mie", "seals", "places", "placedPts", "chained", "chainedPts", "beyondTs"];
const SUMS = ["places", "placedPts", "chained", "chainedPts", "beyondTs", "beyondTsPts", "probeMiss", "stuck"];
function merge(a, b) {
  if (!a) return b;
  const out = { ...a, rows: (a.rows || []).concat(b.rows || []),qinWins: a.qinWins + b.qinWins, turns: a.turns + b.turns, mandate: a.mandate + b.mandate, absMandate: a.absMandate + b.absMandate,
    mie: a.mie + b.mie, seals: a.seals + b.seals, played: a.played + b.played,
    ...Object.fromEntries(SUMS.map((k) => [k, (a[k] || 0) + (b[k] || 0)])), games: a.games + b.games, ms: a.ms + b.ms, errors: a.errors.concat(b.errors), ends: { ...a.ends }, regions: { ...a.regions } };
  for (const [k, v] of Object.entries(b.ends)) out.ends[k] = (out.ends[k] || 0) + v;
  for (const [k, v] of Object.entries(b.regions)) {
    const r = out.regions[k] ? { ...out.regions[k] } : { n: 0, net: 0, q: 0, c: 0 };
    r.n += v.n; r.net += v.net; r.q += v.q; r.c += v.c; out.regions[k] = r;
  }
  return out;
}

// Each cell runs as several short child processes (CHUNK games each, seeds
// in sequence), so a crash costs a couple of minutes and a retry, not the cell.
async function runCells(cfg) {
  const CHUNK = cfg.chunk || 10; // games per child process (`--chunk=5`)
  const cells = CELLS.filter(([name]) => !cfg.only || cfg.only.includes(name));
  const queue = [];
  for (const [name, cell] of cells) {
    for (let start = 0; start < cfg.games; start += CHUNK) {
      const n = Math.min(CHUNK, cfg.games - start);
      queue.push({ name, args: [String(n), `seed=${cfg.seed + start}`, `qin=${cell.qin || cfg.qin}`, `chu=${cell.chu || cfg.chu}`, ...Object.entries({ ...cfg.options, ...(cell.options || {}) }).map(([k, v]) => `${k}=${v}`)] });
    }
  }
  // With `--out`, the running totals are kept in `<out>.state.json` after every
  // chunk, and `--resume` picks up from it: the parent is Node too, and dies
  // at random like its children.
  const statePath = cfg.out ? cfg.out + ".state.json" : null;
  let state = {};
  if (statePath && cfg.resume && existsSync(statePath)) { try { state = JSON.parse(readFileSync(statePath, "utf8")); } catch { state = {}; } }
  const results = new Map(), pending = new Map(cells.map(([name]) => [name, Math.ceil(cfg.games / CHUNK)]));
  for (const [name] of cells) {
    const s0 = state[name];
    if (!s0) { state[name] = { done: [], result: null, printed: false }; continue; }
    results.set(name, s0.result);
    pending.set(name, pending.get(name) - s0.done.length);
  }
  // A chunk is done when every one of its seeds lies in a finished range, so a
  // batch can be resumed with a different chunk size without counting a game twice.
  const covered = (name) => {
    const seeds = new Set();
    for (const d of state[name].done) { const [s0, n0] = String(d).split(":").map(Number); for (let k = 0; k < (n0 || 10); k++) seeds.add(s0 + k); }
    return seeds;
  };
  const coveredBy = Object.fromEntries(cells.map(([name]) => [name, covered(name)]));
  for (let i = queue.length - 1; i >= 0; i--) {
    const start = Number(queue[i].args.find((a) => a.startsWith("seed=")).slice(5)), n = Number(queue[i].args[0]);
    let all = true;
    for (let k = 0; k < n; k++) if (!coveredBy[queue[i].name].has(start + k)) { all = false; break; }
    if (all) queue.splice(i, 1);
  }
  for (const [name] of cells) pending.set(name, queue.filter((q) => q.name === name).length);
  for (const q of queue) state[q.name].printed = false; // more games to add: print again when they are in
  const worker = async () => {
    while (queue.length) {
      const { name, args } = queue.shift();
      // Await first, read after: reading the running total before the await
      // lets two workers overwrite each other's chunks.
      let chunk;
      try { chunk = await runChild(args); } catch { chunk = await runOneByOne(args); }
      results.set(name, merge(results.get(name), chunk));
      pending.set(name, pending.get(name) - 1);
      state[name].done.push(`${args.find((a) => a.startsWith("seed=")).slice(5)}:${args[0]}`);
      state[name].result = results.get(name);
      if (statePath) writeFileSync(statePath, JSON.stringify(state));
      // `--out=file` keeps what is finished on disk: a long batch outlives the shell that started it.
      if (cfg.out) appendFileSync(cfg.out, `# ${new Date().toISOString()} ${name} ${results.get(name).played}/${cfg.games}\n`);
      if (pending.get(name) === 0 && !state[name].printed) {
        state[name].printed = true;
        if (statePath) writeFileSync(statePath, JSON.stringify(state));
        const text = line(name, results.get(name));
        console.log(text);
        if (cfg.out) appendFileSync(cfg.out, text + "\n");
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, cfg.jobs) }, worker));
  if (cfg.out) appendFileSync(cfg.out, "# done\n");
}

// ---------- report (#104) ----------
//   node tests/sim.js --report=a.state.json,b.state.json > table.md
// Reads the `--out` state files and prints a markdown table per cell with 95%
// intervals (Wilson for rates, normal for means), then, for every pair of
// cells named `<x>/control` and `<x>/ts`, the difference ts − control with its
// 95% interval; a difference whose interval leaves out 0 is marked **.
const Z = 1.96;
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + Z * Z / n, c = (p + Z * Z / (2 * n)) / d, h = (Z / d) * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n));
  return [c - h, c + h];
}
function meanCi(xs) {
  const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / (n || 1);
  const v = n > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0;
  return { m, v, n, h: Z * Math.sqrt(v / (n || 1)) };
}
function quant(xs, q) { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; }
const REASONS = ["mandate", "unification", "alliance", "collapse", "scoring", "scoringBoth", "final", "tie"];
const REASON_ZH = { mandate: "天命", unification: "滅國(一統)", alliance: "相印(合縱)", collapse: "土崩", scoring: "記分", scoringBoth: "記分2", final: "終局(回合上限)", tie: "平手" };
function cellStats(r) {
  const rows = (r.rows || []).map((x) => Object.fromEntries(ROW.map((k, i) => [k, x[i]])));
  const n = rows.length, col = (k) => rows.map((x) => x[k]);
  const places = col("places"), pts = col("placedPts");
  const perAction = rows.filter((x) => x.places).map((x) => x.placedPts / x.places);
  return {
    n, rows, errors: r.errors.length, stuck: r.stuck || 0, probeMiss: r.probeMiss || 0,
    win: { k: rows.filter((x) => x.qinWin).length },
    ends: Object.fromEntries(REASONS.map((e) => [e, rows.filter((x) => x.reason === e).length])),
    turn: meanCi(col("turn")), mandate: meanCi(col("mandate")), mie: meanCi(col("mie")), seals: meanCi(col("seals")),
    places: meanCi(places), ptsPerAction: { m: pts.reduce((a, b) => a + b, 0) / (places.reduce((a, b) => a + b, 0) || 1) },
    perGamePtsPerAction: meanCi(perAction),
    chainedShare: { k: rows.reduce((a, x) => a + x.chained, 0), n: places.reduce((a, b) => a + b, 0) },
    chainedPts: rows.reduce((a, x) => a + x.chainedPts, 0), totalPts: pts.reduce((a, b) => a + b, 0),
    beyondTs: rows.reduce((a, x) => a + x.beyondTs, 0),
    gamesWithChain: rows.filter((x) => x.chained > 0).length,
  };
}
const pc = (x) => (100 * x).toFixed(1);
const ci = (lo, hi) => `[${pc(lo)}, ${pc(hi)}]`;
const f2 = (x) => (x >= 0 ? "+" : "") + x.toFixed(2);
function report(files) {
  const cells = {};
  for (const f of files) {
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [name, v] of Object.entries(st)) if (v.result) cells[name] = { ...cellStats(v.result), games: v.result.games, done: v.done.length, file: f };
  }
  const out = [];
  const names = CELLS.map(([n]) => n).filter((n) => cells[n]);
  out.push("| cell | n | Qin win % [95%] | errors / stuck | avg turn [95%] | avg final mandate [95%] | 滅 / game | 相印 / game | place actions / game | points / action | place actions with a point outside the control start set, % (under control: chaining) | points outside the TS start set |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of names) {
    const c = cells[name], [lo, hi] = wilson(c.win.k, c.n);
    out.push(`| ${name} | ${c.n} | ${pc(c.win.k / c.n)} ${ci(lo, hi)} | ${c.errors} / ${c.stuck} | ${c.turn.m.toFixed(2)} ±${c.turn.h.toFixed(2)} | ${f2(c.mandate.m)} ±${c.mandate.h.toFixed(2)} | ${c.mie.m.toFixed(2)} ±${c.mie.h.toFixed(2)} | ${c.seals.m.toFixed(2)} ±${c.seals.h.toFixed(2)} | ${c.places.m.toFixed(2)} ±${c.places.h.toFixed(2)} | ${c.ptsPerAction.m.toFixed(2)} | ${pc(c.chainedShare.k / (c.chainedShare.n || 1))} (${c.chainedShare.k}/${c.chainedShare.n}; ${c.gamesWithChain} games) | ${c.beyondTs} |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%]:", "");
  out.push(`| cell | ${REASONS.map((e) => REASON_ZH[e]).join(" | ")} |`);
  out.push(`|---|${REASONS.map(() => "---").join("|")}|`);
  for (const name of names) {
    const c = cells[name];
    out.push(`| ${name} | ${REASONS.map((e) => { const [lo, hi] = wilson(c.ends[e], c.n); return c.ends[e] ? `${pc(c.ends[e] / c.n)} ${ci(lo, hi)}` : "0"; }).join(" | ")} |`);
  }
  out.push("", "Distributions (per game): end turn histogram; final mandate and place actions as min / p5 / p25 / median / p75 / p95 / max; the outlying seeds.", "");
  for (const name of names) {
    const c = cells[name];
    const turns = {}; for (const x of c.rows) turns[x.turn] = (turns[x.turn] || 0) + 1;
    const q = (k) => [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1].map((p) => quant(c.rows.map((x) => x[k]), p)).join(" / ");
    const byMandate = c.rows.slice().sort((a, b) => a.mandate - b.mandate);
    const byPlaces = c.rows.slice().sort((a, b) => b.places - a.places);
    out.push(`- **${name}**: turn ${Object.entries(turns).map(([t, k]) => `${t}:${k}`).join(" ")}; mandate ${q("mandate")}; place actions ${q("places")}; ` +
      `lowest mandate seeds ${byMandate.slice(0, 3).map((x) => `${x.seed}(${x.mandate},${x.reason})`).join(" ")}, highest ${byMandate.slice(-3).map((x) => `${x.seed}(${x.mandate},${x.reason})`).join(" ")}; most place actions ${byPlaces.slice(0, 3).map((x) => `${x.seed}(${x.places})`).join(" ")}` +
      `${c.probeMiss ? `; PROBE MISSED IN ${c.probeMiss} GAMES` : ""}`);
  }
  const pairs = names.filter((n) => n.endsWith("/control") && cells[n.replace(/control$/, "ts")]);
  if (pairs.length) {
    out.push("", "Difference ts − control [95%]; ** = the interval leaves out 0:", "");
    out.push(`| pair | Qin win pp | turn | final mandate | 滅 | 相印 | place actions | points / action (per-game mean) | ${REASONS.map((e) => REASON_ZH[e] + " pp").join(" | ")} |`);
    out.push(`|---|---|---|---|---|---|---|---|${REASONS.map(() => "---").join("|")}|`);
    const dp = (k1, n1, k2, n2) => {
      const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
      return `${d - h > 0 || d + h < 0 ? "**" : ""}${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]${d - h > 0 || d + h < 0 ? "**" : ""}`;
    };
    const dm = (a, b) => {
      const d = b.m - a.m, h = Z * Math.sqrt(a.v / a.n + b.v / b.n);
      const sig = d - h > 0 || d + h < 0;
      return `${sig ? "**" : ""}${f2(d)} [${f2(d - h)}, ${f2(d + h)}]${sig ? "**" : ""}`;
    };
    for (const n of pairs) {
      const a = cells[n], b = cells[n.replace(/control$/, "ts")];
      out.push(`| ${n.replace(/\/control$/, "")} | ${dp(a.win.k, a.n, b.win.k, b.n)} | ${dm(a.turn, b.turn)} | ${dm(a.mandate, b.mandate)} | ${dm(a.mie, b.mie)} | ${dm(a.seals, b.seals)} | ${dm(a.places, b.places)} | ${dm(a.perGamePtsPerAction, b.perGamePtsPerAction)} | ${REASONS.map((e) => dp(a.ends[e], a.n, b.ends[e], b.n)).join(" | ")} |`);
    }
  }
  return out.join("\n");
}

// ---------- report (#121) ----------
//   node tests/sim.js --report-emperor=f.txt.state.json > table.md
// The reform track per `emp/<lvl>/<value>` cell, and every value against
// `emp/<lvl>/vp` (today's rule) on the same seeds; ** = the 95% interval of the
// difference leaves out 0.
const EMP_REASONS = ["emperor", "mandate", "unification", "alliance", "collapse", "scoring", "scoringBoth", "final", "tie"];
// A file given as `path@label` names its cells `<cell>@<label>` (the same cell
// run on another build, e.g. `@unaware-bot`); they are listed after the cell
// and compared with the plain `vp` of their level.
function reportEmperor(files) {
  const cells = {};
  for (const spec of files) {
    const [f, label] = spec.split("@");
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [cell, v] of Object.entries(st)) {
      const name = label ? `${cell}@${label}` : cell;
      if (!v.result || !name.startsWith("emp/")) continue;
      const cols = [...ROW, ...EMP_ROW];
      const rows = v.result.rows.map((x) => Object.fromEntries(cols.map((k, i) => [k, x[i]])));
      for (const x of rows) {
        x.reached = x.first6 >= 0 ? 1 : 0;
        x.firstTurn = x.first6 === 0 ? x.q6turn : x.first6 === 1 ? x.c6turn : 0;
        x.firstWon = x.first6 < 0 ? null : (x.first6 === 0) === (x.qinWin === 1) ? 1 : 0;
        x.uses = x.qReformUses + x.cReformUses;
        const opsAll = EMP_USES.filter((u) => u !== "event" && u !== "bog").reduce((a, u) => a + x[`ops_${u}`], 0);
        x.reformShare = opsAll ? x.ops_reform / opsAll : 0;
      }
      cells[name] = { rows, n: rows.length, errors: v.result.errors.length, stuck: v.result.stuck || 0 };
    }
  }
  const order = CELLS.map(([n]) => n).flatMap((n) => Object.keys(cells).filter((k) => k === n || k.startsWith(n + "@")));
  const vpOf = (n) => n.split("@")[0].replace(/[^/]+$/, "vp");
  const out = [];
  const rate =(k, n) => { const [lo, hi] = wilson(k, n); return n ? `${pc(k / n)} ${ci(lo, hi)}` : "–"; };
  const cnt = (rows, f) => rows.filter(f).length;
  const mean = (rows, k) => meanCi(rows.map((x) => x[k]));
  const mci = (m) => `${m.m.toFixed(2)} ±${m.h.toFixed(2)}`;
  out.push("| cell | n | errors / stuck | Qin win % [95%] | avg end turn | box 6 reached by anyone, % [95%] | games that lasted to turn 7: box 6 reached, % (k/n) | by Qin % | by Chu % | first there: Qin / Chu | first-there side won, % [95%] (of games reached) |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n, errors, stuck } = cells[name];
    const reached = rows.filter((x) => x.reached);
    out.push(`| ${name} | ${n} | ${errors} / ${stuck} | ${rate(cnt(rows, (x) => x.qinWin), n)} | ${mci(mean(rows, "turn"))} | ${rate(reached.length, n)} | ${(() => { const late = rows.filter((x) => x.turn >= 7); const k = cnt(late, (x) => x.reached); return `${pc(k / (late.length || 1))} (${k}/${late.length})`; })()} | ${pc(cnt(rows, (x) => x.q6turn > 0) / n)} | ${pc(cnt(rows, (x) => x.c6turn > 0) / n)} | ${cnt(rows, (x) => x.first6 === 0)} / ${cnt(rows, (x) => x.first6 === 1)} | ${rate(cnt(reached, (x) => x.firstWon), reached.length)} (${cnt(reached, (x) => x.firstWon)}/${reached.length}) |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%]:", "");
  out.push(`| cell | ${EMP_REASONS.map((e) => REASON_ZH[e] || "稱帝").join(" | ")} |`);
  out.push(`|---|${EMP_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const { rows, n } = cells[name];
    out.push(`| ${name} | ${EMP_REASONS.map((e) => { const k = cnt(rows, (x) => x.reason === e); return k ? rate(k, n) : "0"; }).join(" | ")} |`);
  }
  out.push("", "Is it a reform race? Per game, both sides together [95%]; ops are face values; 'reform share' = ops discarded to reform ÷ ops spent on place + campaign + lobby + reform.", "");
  out.push("| cell | reform uses / game | Qin uses | Chu uses | advances by event | final box Qin | final box Chu | ops: place | ops: campaign | ops: lobby | ops: reform | reform share of ops, % |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name];
    out.push(`| ${name} | ${mci(mean(rows, "uses"))} | ${mean(rows, "qReformUses").m.toFixed(2)} | ${mean(rows, "cReformUses").m.toFixed(2)} | ${mean(rows, "eventAdvances").m.toFixed(2)} | ${mci(mean(rows, "qBox"))} | ${mci(mean(rows, "cBox"))} | ${mean(rows, "ops_place").m.toFixed(1)} | ${mean(rows, "ops_campaign").m.toFixed(1)} | ${mean(rows, "ops_lobby").m.toFixed(1)} | ${mci(mean(rows, "ops_reform"))} | ${pc(mean(rows, "reformShare").m)} |`);
  }
  out.push("", "Distributions: turn the first side reached box 6 (turn:games); final box per side (box:games, 0…6); end turn (turn:games); the highest reform-use games.", "");
  const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] || 0) + 1; return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" "); };
  for (const name of order) {
    const { rows } = cells[name];
    const top = rows.slice().sort((a, b) => b.uses - a.uses).slice(0, 3);
    out.push(`- **${name}**: first reach turn ${hist(rows.filter((x) => x.reached).map((x) => x.firstTurn)) || "none"}; final box Qin ${hist(rows.map((x) => x.qBox))}, Chu ${hist(rows.map((x) => x.cBox))}; end turn ${hist(rows.map((x) => x.turn))}; most reform uses ${top.map((x) => `seed ${x.seed} (${x.uses}, ${x.reason})`).join(", ")}`);
  }
  const pairs = order.filter((n) => n !== vpOf(n) && cells[vpOf(n)]);
  if (pairs.length) {
    out.push("", "Difference from `vp` at the same level [95%]; ** = the interval leaves out 0:", "");
    out.push("| cell − vp | Qin win pp | end turn | box 6 reached pp | first-there won pp | reform uses / game | reform share pp | 天命 end pp | 相印 end pp | 終局 end pp |");
    out.push("|---|---|---|---|---|---|---|---|---|---|");
    const star = (d, h, s) => (d - h > 0 || d + h < 0 ? `**${s}**` : s);
    const dp = (k1, n1, k2, n2) => {
      if (!n1 || !n2) return "–";
      const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
      return star(d, h, `${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]`);
    };
    const dm = (a, b, k, scale = 1) => {
      const A = meanCi(a.map((x) => x[k])), Bm = meanCi(b.map((x) => x[k]));
      const d = (Bm.m - A.m) * scale, h = Z * Math.sqrt(A.v / A.n + Bm.v / Bm.n) * scale;
      return star(d, h, `${f2(d)} [${f2(d - h)}, ${f2(d + h)}]`);
    };
    for (const name of pairs) {
      const a = cells[vpOf(name)].rows, b = cells[name].rows;
      const ra = a.filter((x) => x.reached), rb = b.filter((x) => x.reached);
      const e = (rows, r) => cnt(rows, (x) => x.reason === r);
      out.push(`| ${name} | ${dp(cnt(a, (x) => x.qinWin), a.length, cnt(b, (x) => x.qinWin), b.length)} | ${dm(a, b, "turn")} | ${dp(ra.length, a.length, rb.length, b.length)} | ${dp(cnt(ra, (x) => x.firstWon), ra.length, cnt(rb, (x) => x.firstWon), rb.length)} | ${dm(a, b, "uses")} | ${dm(a, b, "reformShare", 100)} | ${dp(e(a, "mandate"), a.length, e(b, "mandate"), b.length)} | ${dp(e(a, "alliance"), a.length, e(b, "alliance"), b.length)} | ${dp(e(a, "final"), a.length, e(b, "final"), b.length)} |`);
    }
  }
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rep = process.argv.find((a) => a.startsWith("--report="));
  if (rep) { console.log(report(rep.slice(9).split(","))); process.exit(0); }
  const repE = process.argv.find((a) => a.startsWith("--report-emperor="));
  if (repE) { console.log(reportEmperor(repE.slice(17).split(","))); process.exit(0); }
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.cells) await runCells(cfg);
  else {
    const r = simulate(cfg);
    if (cfg.json) console.log(JSON.stringify(r));
    else { console.log(line(`${cfg.qin} vs ${cfg.chu} ${JSON.stringify(cfg.options)}`, r)); for (const e of r.errors) console.log("  " + e); }
  }
}
