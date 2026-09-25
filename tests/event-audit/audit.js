// #115: does an enemy card played for its ops still fire its event?
//
//   node tests/event-audit/audit.js [seeds=12] [--md=tests/event-audit/115.md] [--json=out.json]
//
// For every card with a side (23 Qin, 23 Chu), in states the ENGINE built
// (bot games, both eras the card exists in, turns 1-8, both seats), the side
// that does NOT own the card plays it for ops -- place / campaign / lobby,
// whichever is legal -- in both orders (opsFirst / eventFirst). Every choice
// the play asks for is answered by the bot's own `answer` (the event's
// choices by whoever the engine asks). The same card is then played as its
// OWNER's own event on the board the enemy's event saw: that is the baseline.
//
// The instrument is this file's own, not the engine's: each sided card's
// `effect` is wrapped, so a run knows whether the effect was ever called,
// whether it ran to the end, what every call asked for, and the state right
// before the first call. Its diff (`diffStates`) reads the raw state fields,
// never the engine's log, so an engine that logged an event it did not run --
// or ran one it did not log -- cannot fool it. The engine's own `event` /
// `eventEnd` log entries (#115) are checked AGAINST this instrument, not used
// by it.
//
// The one hand-made edit to an engine-built state: the audited card is moved
// into the player's hand (from wherever it was) and a pending 細作 / 頓兵堅城
// obligation of that player is lifted, so the play is legal. The baseline
// also sets the actor to the owner. Nothing on the board is touched.
import { writeFileSync } from "node:fs";
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const { QIN, CHU, CARD, CARDS } = E;
const args = process.argv.slice(2);
const SEEDS = Number(args.find((a) => /^\d+$/.test(a)) ?? 12);
const MD = (args.find((a) => a.startsWith("--md=")) || "").slice(5) || null;
const JSONOUT = (args.find((a) => a.startsWith("--json=")) || "").slice(7) || null;
const ERA_FROM = { reform: 1, alliance: 4, conquest: 7 };
const SIDED = CARDS.filter((c) => c.side === QIN || c.side === CHU);
if (SIDED.length !== 46 || SIDED.filter((c) => c.side === QIN).length !== 23) throw new Error(`expected 23 + 23 sided cards, got ${SIDED.length}`);

// ---------- the instrument ----------
const REC = { on: false, card: null, calls: [], pre: null, post: null, preSeq: null, phasing: null };
function resetRec(card) { Object.assign(REC, { on: true, card, calls: [], pre: null, post: null, preSeq: null, phasing: null }); }
const ORIGINAL = {};
for (const c of SIDED) {
  ORIGINAL[c.id] = c.effect;
  c.effect = function (st, side, ch, step) {
    const watching = REC.on && REC.card === c.id;
    if (watching && REC.pre == null) { REC.pre = E.clone(st); REC.preSeq = st.logSeq; REC.phasing = st.phasing; }
    const need = ORIGINAL[c.id].call(this, st, side, ch, step);
    if (watching) {
      REC.calls.push({ ch: ch.length, side, need: need ? { kind: need.kind, who: need.who, n: need.n, min: need.min, options: need.options ? need.options.length : 0 } : null });
      if (!need) { REC.post = E.clone(st); E.checkMarkers(REC.post); }
    }
    return need;
  };
}
// Bots think by playing the event out on copies: never record those.
function quiet(fn) { const on = REC.on; REC.on = false; try { return fn(); } finally { REC.on = on; } }

const multiset = (arr) => { const m = {}; for (const x of arr || []) m[x] = (m[x] || 0) + 1; return m; };
function msDiff(a, b) { // what b has more / fewer of than a
  const A = multiset(a), Bm = multiset(b), plus = [], minus = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(Bm)])) {
    const d = (Bm[k] || 0) - (A[k] || 0);
    for (let i = 0; i < d; i++) plus.push(k);
    for (let i = 0; i < -d; i++) minus.push(k);
  }
  return { plus, minus };
}
// Every field an event can move. Hands are compared by content.
function diffStates(a, b) {
  const out = [];
  for (const sp of E.SPACES) {
    const x = a.inf[sp.id] || [0, 0], y = b.inf[sp.id] || [0, 0];
    for (const s of [QIN, CHU]) if (x[s] !== y[s]) out.push(`inf:${sp.id}:${E.SIDES[s]}${y[s] - x[s] > 0 ? "+" : ""}${y[s] - x[s]}`);
  }
  for (const k of ["mandate", "weariness", "luoyiYields", "winner"]) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k}:${JSON.stringify(a[k])}->${JSON.stringify(b[k])}`);
  for (const s of [QIN, CHU]) if (a.reform[s] !== b.reform[s]) out.push(`reform:${E.SIDES[s]}:${a.reform[s]}->${b.reform[s]}`);
  for (const k of ["seals", "mie"]) { const d = msDiff(Object.keys(a[k]), Object.keys(b[k])); for (const x of d.plus) out.push(`${k}+${x}`); for (const x of d.minus) out.push(`${k}-${x}`); }
  const fx = msDiff(a.effects.map((e) => JSON.stringify(e)), b.effects.map((e) => JSON.stringify(e)));
  for (const x of fx.plus) out.push(`effect+${JSON.parse(x).card}`);
  for (const x of fx.minus) out.push(`effect-${JSON.parse(x).card}`);
  for (const s of [QIN, CHU]) { const d = msDiff(a.hands[s], b.hands[s]); for (const x of d.plus) out.push(`hand:${E.SIDES[s]}+${x}`); for (const x of d.minus) out.push(`hand:${E.SIDES[s]}-${x}`); }
  for (const k of ["discard", "removed"]) { const d = msDiff(a[k], b[k]); for (const x of d.plus) out.push(`${k}+${x}`); for (const x of d.minus) out.push(`${k}-${x}`); }
  if (JSON.stringify(a.jiuding) !== JSON.stringify(b.jiuding)) out.push(`jiuding:${JSON.stringify(b.jiuding)}`);
  if (JSON.stringify(a.revealed) !== JSON.stringify(b.revealed)) out.push(`revealed:${JSON.stringify(b.revealed)}`);
  if (JSON.stringify(a.forced) !== JSON.stringify(b.forced)) out.push(`forced:${JSON.stringify(b.forced)}`);
  return out;
}

// ---------- states the engine built ----------
function collectStates(nSeeds) {
  const states = [];
  for (let seed = 1; seed <= nSeeds; seed++) {
    const level = seed % 2 ? "easy" : "normal";
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed);
    const want = {}; // `${turn}:${actor}` -> the round to snapshot at
    for (let steps = 0; st.winner == null && steps < 6000; steps++) {
      if (st.phase === "action" && !st.pending && !st.plan.length) {
        const key = `${st.turn}:${st.actor}`;
        if (want[key] == null) want[key] = 1 + rng.int(Math.max(1, st.rounds - 1));
        if (st.round === want[key]) { states.push({ seed, level, st: E.clone(st) }); want[key] = -1; }
      }
      const who = E.mustAct(st);
      if (!who.length) break;
      const side = who[rng.int(who.length)];
      const a = B.decide(E.view(st, side), side, level, rng);
      if (!a) break;
      st = E.apply(st, a);
    }
  }
  return states;
}

// Take the card out of wherever it is and put it in `side`'s hand.
function giveCard(st, side, id) {
  for (const s of [QIN, CHU]) st.hands[s] = st.hands[s].filter((c) => c !== id);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((c) => c !== id);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((c) => c !== id);
  if (st.headline) st.headline = st.headline.map((h) => (h === id ? null : h));
  st.hands[side].push(id);
  st.forced[side] = null;
  st.effects = st.effects.filter((e) => !(e.kind === "bog" && e.who === side));
}

// Deterministic ops payloads: the bot's greedy placement, the first target.
function opsPayload(st, side, card, use) {
  const o = E.opsOptions(st, side);
  const ops = E.opsOf(st, side, card);
  if (use === "place") { const points = quiet(() => B.greedyPlacement(st, side, ops)); return points.length ? { use, points } : null; }
  if (use === "campaign") return o.campaignTargets.length ? { use, target: o.campaignTargets[0] } : null;
  if (use === "lobby") return o.lobbyTargets.length ? { use, target: o.lobbyTargets[0].id } : null;
  return null;
}

// Play one action, answer everything it asks, until nothing is pending.
// `script`: the event's choices to give, in order (the baseline replays the
// enemy run's, so a difference in outcome is the engine's, not the bot's mood).
function playOut(st, action, card, script = null) {
  const rng = E.makeRng(115);
  const asked = [];
  let k = 0;
  let s;
  try { s = E.apply(st, action); } catch (e) { return { error: `play: ${e.message}` }; }
  for (let guard = 0; s.pending && s.winner == null && guard < 30; guard++) {
    const p = s.pending;
    if (p.tag === "event" && p.card === card) asked.push({ who: p.who, kind: p.kind, options: (p.options || []).length });
    let choice;
    if (script && p.tag === "event" && p.card === card && k < script.length) choice = script[k++];
    else if (p.kind === "ops") choice = opsPayload(s, p.who, p.card, p.allowed[0]) || quiet(() => B.answer(s, p, p.who, rng));
    else choice = quiet(() => B.answer(s, p, p.who, rng));
    try { s = E.apply(s, { type: "choose", side: p.who, choice }); } catch (e) {
      return { error: `choose ${p.kind}/${p.tag} by ${E.SIDES[p.who]}: ${e.message}`, stuckPending: p, asked, s };
    }
    if (p.tag === "event" && p.card === card) asked[asked.length - 1].chose = choice;
  }
  if (s.pending && s.winner == null) return { error: "pending never settled", asked, s };
  return { s, asked };
}

function runOne(base, card, player, use, order) {
  const st = E.clone(base);
  giveCard(st, player, card);
  if (!st.hands[player].includes(card)) return null;
  const o = E.opsOptions(st, player);
  const legalUse = use === "place" ? o.placeOptions.length : use === "campaign" ? o.campaignTargets.length : o.lobbyTargets.length;
  if (!legalUse) return null;
  let action = { type: "play", side: player, card, use, order };
  if (order === "opsFirst") {
    const pay = opsPayload(st, player, card, use);
    if (!pay) return null;
    action = { ...action, ...pay };
  }
  resetRec(card);
  const res = playOut(st, action, card);
  REC.on = false;
  const r = { card, player, use, order, seed: base.seed, turn: st.turn, asked: res.asked || [], error: res.error || null };
  r.called = REC.calls.length > 0;
  r.completed = REC.post != null;
  r.emptyChoice = REC.calls.some((c) => c.need && (c.need.options === 0 || c.need.n === 0));
  r.phasing = REC.phasing;
  r.diff = REC.pre && REC.post ? diffStates(REC.pre, REC.post) : null;
  r.pre = REC.pre;
  r.preSeq = REC.preSeq;
  const fin = res.s;
  r.over = fin ? fin.winner != null : false;
  if (fin) {
    // order of ops vs event in the log: an ops entry of this player after the play entry
    const playE = [...fin.log].reverse().find((l) => l.type === "play" && l.card === card && l.side === player);
    const opsE = playE && fin.log.find((l) => l.i > playE.i && ["place", "campaign", "lobby", "opsLost"].includes(l.type) && l.side === player);
    r.opsSeq = opsE ? opsE.i : null;
    r.opsBeforeEvent = opsE && REC.preSeq != null ? opsE.i <= REC.preSeq : null;
    // tire entries during the event: who pushed?
    r.tireBy = fin.log.filter((l) => l.type === "tire" && REC.preSeq != null && l.i > REC.preSeq && (!opsE || opsE.i < REC.preSeq || l.i < opsE.i)).map((l) => l.by);
    // the engine's own log entries for this event (#115), checked against the instrument
    r.logStart = fin.log.filter((l) => l.type === "event" && l.card === card && l.i > (playE ? playE.i : 0)).length;
    const end = fin.log.find((l) => l.type === "eventEnd" && l.card === card && l.i > (playE ? playE.i : 0));
    r.logEnd = end ? { effect: end.effect, why: end.why ?? null, side: end.side, by: end.by } : null;
    r.cardEnd = fin.removed.includes(card) ? "removed" : fin.discard.includes(card) ? "discard" : fin.hands[QIN].includes(card) || fin.hands[CHU].includes(card) ? "hand" : "game over";
  }
  return r;
}

// The owner's own event play, on the board the enemy's event saw.
function baseline(pre, card, owner, script) {
  const st = E.clone(pre);
  st.plan = []; st.pending = null; st.phase = "action"; st.actor = owner; st.phasing = owner; st.winner = null;
  giveCard(st, owner, card);
  resetRec(card);
  const res = playOut(st, { type: "play", side: owner, card, use: "event" }, card, script);
  REC.on = false;
  return { error: res.error || null, asked: res.asked || [], diff: REC.pre && REC.post ? diffStates(REC.pre, REC.post) : null, called: REC.calls.length > 0, completed: REC.post != null, emptyChoice: REC.calls.some((c) => c.need && (c.need.options === 0 || c.need.n === 0)) };
}

// The two plays whose text says the event does NOT fire: 變法 (rulebook 三:
// 「棄掉一張行動點 ≥ 門檻的牌(事件不觸發)」) and 說客's pair (its own text).
function runSilent(base, card, player, kind) {
  const st = E.clone(base);
  giveCard(st, player, card);
  let action;
  if (kind === "reform") {
    if (E.reformUsesLeft(st, player) <= 0 || CARD[card].ops < E.reformThreshold(st, player)) return null;
    action = { type: "play", side: player, card, use: "reform" };
  } else {
    giveCard(st, player, "shuoke");
    const pay = opsPayload(st, player, card, "place") || opsPayload(st, player, card, "campaign") || opsPayload(st, player, card, "lobby");
    if (!pay) return null;
    action = { type: "play", side: player, card: "shuoke", pair: card, ...pay };
  }
  resetRec(card);
  const res = playOut(st, action, card);
  REC.on = false;
  return { kind, fired: REC.calls.length > 0, error: res.error || null };
}

// A diff minus what legitimately differs between the two plays: the card
// itself moving, and the hand it left (the enemy's in one, the owner's in the other).
const comparable = (d) => (d || []).filter((x) => !/^(hand|discard|removed)[:+-]/.test(x) || !x.endsWith(REC_CARD));
let REC_CARD = "";

// ---------- main ----------
const t0 = Date.now();
const states = collectStates(SEEDS);
const coverage = {};
for (const s of states) coverage[s.st.turn] = (coverage[s.st.turn] || 0) + 1;
const rows = [], silent = [];
for (const c of SIDED) {
  const player = 1 - c.side;
  for (const base of states) {
    if (base.st.actor !== player || base.st.turn < ERA_FROM[c.era]) continue;
    for (const use of ["place", "campaign", "lobby"]) for (const order of ["opsFirst", "eventFirst"]) {
      const r = runOne({ ...base.st, seed: base.seed }, c.id, player, use, order);
      if (!r) continue;
      if (r.pre && !r.over) {
        const b = baseline(r.pre, c.id, c.side, r.asked.map((a) => a.chose));
        REC_CARD = c.id;
        const same = JSON.stringify(comparable(r.diff).sort()) === JSON.stringify(comparable(b.diff).sort());
        r.baseline = { error: b.error, same, diff: b.diff, askedWho: b.asked.map((a) => a.who), emptyChoice: b.emptyChoice, completed: b.completed };
      }
      delete r.pre;
      rows.push(r);
    }
    for (const kind of ["reform", "pair"]) {
      const x = runSilent(base.st, c.id, player, kind);
      if (x) silent.push({ card: c.id, ...x });
    }
  }
}

// ---------- the table ----------
function reasonOf(r) {
  if (!r.called) return r.over ? "game over before the event" : "NOT CALLED";
  if (!r.completed) return r.over ? "game over during the event" : "DID NOT FINISH";
  if (r.diff && r.diff.length) return null;
  return r.emptyChoice ? "no legal target" : "no change";
}
const byCard = {};
for (const r of rows) {
  const k = r.card;
  const b = byCard[k] || (byCard[k] = { card: k, runs: 0, fired: { opsFirst: 0, eventFirst: 0 }, none: { opsFirst: 0, eventFirst: 0 }, notFired: { opsFirst: 0, eventFirst: 0 }, reasons: {}, baseSame: 0, baseDiff: 0, baseDiffEx: [], askedWho: {}, errors: [], logMismatch: 0, logMismatchEx: [], orderBad: 0, tireBy: {}, cardEnd: {} });
  b.runs++;
  const why = reasonOf(r);
  if (!r.called || !r.completed) b.notFired[r.order]++;
  else if (why) b.none[r.order]++;
  else b.fired[r.order]++;
  if (why) b.reasons[why] = (b.reasons[why] || 0) + 1;
  if (r.baseline) {
    if (r.baseline.same) b.baseSame++;
    else { b.baseDiff++; if (b.baseDiffEx.length < 3) b.baseDiffEx.push({ seed: r.seed, turn: r.turn, use: r.use, order: r.order, enemy: r.diff, owner: r.baseline.diff }); }
  }
  for (const a of r.asked) b.askedWho[E.SIDES[a.who]] = (b.askedWho[E.SIDES[a.who]] || 0) + 1;
  if (r.error) b.errors.push(`seed ${r.seed} t${r.turn} ${r.use}/${r.order}: ${r.error}`);
  if (r.baseline && r.baseline.error) b.errors.push(`baseline seed ${r.seed} t${r.turn} ${r.use}/${r.order}: ${r.baseline.error}`);
  if (r.order === "opsFirst" && r.called && r.opsBeforeEvent === false) b.orderBad++;
  if (r.order === "eventFirst" && r.called && r.opsBeforeEvent === true) b.orderBad++;
  for (const by of r.tireBy || []) b.tireBy[by === r.player ? "player" : "owner"] = (b.tireBy[by === r.player ? "player" : "owner"] || 0) + 1;
  b.cardEnd[r.cardEnd] = (b.cardEnd[r.cardEnd] || 0) + 1;
  // #115's engine log vs this instrument (only once the engine logs events)
  if (r.called && r.completed) {
    const effect = !!(r.diff && r.diff.length);
    const ok = r.logStart === 1 && r.logEnd && r.logEnd.effect === effect && r.logEnd.side === CARD[r.card].side && r.logEnd.by === r.player;
    if (!ok) { b.logMismatch++; if (b.logMismatchEx.length < 2) b.logMismatchEx.push({ seed: r.seed, turn: r.turn, use: r.use, order: r.order, logStart: r.logStart, logEnd: r.logEnd, diff: r.diff }); }
  }
}

for (const x of silent) {
  const b = byCard[x.card]; if (!b) continue;
  b.silent = b.silent || { reform: [0, 0], pair: [0, 0] };
  b.silent[x.kind][0]++; if (x.fired) b.silent[x.kind][1]++;
  if (x.error) b.errors.push(`${x.kind}: ${x.error}`);
}
const summary = SIDED.map((c) => byCard[c.id] || { card: c.id, runs: 0 });
const totals = { states: states.length, coverage, runs: rows.length, errors: rows.filter((r) => r.error).length, notCalled: rows.filter((r) => !r.called && !r.over).length, notFinished: rows.filter((r) => r.called && !r.completed && !r.over).length, baseDiff: rows.filter((r) => r.baseline && !r.baseline.same).length, logMismatch: summary.reduce((n, b) => n + (b.logMismatch || 0), 0), orderBad: summary.reduce((n, b) => n + (b.orderBad || 0), 0), seconds: Math.round((Date.now() - t0) / 1000) };
console.log(JSON.stringify(totals));
for (const b of summary) {
  console.log([b.card, CARD[b.card].side === QIN ? "qin" : "chu", `runs=${b.runs}`, `fired=${b.fired?.opsFirst}/${b.fired?.eventFirst}`, `none=${b.none?.opsFirst}/${b.none?.eventFirst}`, `notFired=${b.notFired?.opsFirst}/${b.notFired?.eventFirst}`, `reasons=${JSON.stringify(b.reasons)}`, `base=${b.baseSame}/${(b.baseSame || 0) + (b.baseDiff || 0)}`, `asked=${JSON.stringify(b.askedWho)}`, `tire=${JSON.stringify(b.tireBy)}`, `end=${JSON.stringify(b.cardEnd)}`, `silent=${JSON.stringify(b.silent)}`, `err=${b.errors?.length}`, `log=${b.logMismatch}`, `order=${b.orderBad}`].join(" "));
  for (const e of (b.errors || []).slice(0, 3)) console.log("   ERR", e);
  for (const e of (b.baseDiffEx || []).slice(0, 2)) console.log("   BASEDIFF", JSON.stringify(e));
  for (const e of (b.logMismatchEx || []).slice(0, 1)) console.log("   LOGMISMATCH", JSON.stringify(e));
}
if (JSONOUT) writeFileSync(JSONOUT, JSON.stringify({ totals, summary }, null, 1));
export { summary, totals };
