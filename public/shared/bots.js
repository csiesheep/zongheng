// The bot. Works from `view(state, seat)` like a human: it fills the unknown
// (the other hand, the draw pile) with a random consistent guess, lists what
// `legal()` allows, plays each candidate on the guess, answering every choice
// the play asks for by the same greedy rule, and keeps the best evaluation.
// Every decision carries a `why` for table talk (M3).
//
// Levels: easy = a random legal action (scoring cards played at once);
// normal = one ply plus noise; hard = one ply, then the other side's best
// reply on the top few, less noise.
import * as E from "./engine.js";

const { QIN, CHU, SPACES, SPACE, STATES, SCORED_REGIONS, CARD, ERA_DECKS, ERAS, JIUDING } = E;
export const LEVELS = ["easy", "normal", "hard"];

// Expected scorings of each region over a whole game, final scoring included.
const RATE = { jin: 3.0, west: 2.8, south: 2.8, east: 1.5, north: 1.5 };
// Enemy events that tire the realm when spent for ops: deadly at 民困.
const TIRING = new Set(["changping", "wangjian", "huaiwang"]);
const REFORM_PERK = [0, 0.5, 1.5, 3, 4, 6, 7];
const NOISE = { easy: 0, normal: 0.6, hard: 0.2 };
const pickOne = (arr, rng) => arr[rng.int(arr.length)];
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------- 滅國 after a restore ----------
// The engine's own condition (E.checkMarkers, owner 裁決 #119): after 田單復國
// lifts a 滅, `st.mieHold[id]` lists the spaces of that state Qin still
// controlled then; a space leaves the list once Qin loses it, and the state
// falls again only when Qin holds all of it with at least one space NOT on the
// list. So while every space of the state is on the list and still Qin's, no
// move of Qin's can destroy it: Qin must first lose one. True in exactly that
// case, for the advisor (advisor.js) and the evaluation below.
export function heldSinceRestore(st, id) {
  const held = st.mieHold && st.mieHold[id];
  if (!held || st.mie[id]) return false;
  return E.spacesOfState(id).every((x) => held.includes(x) && E.controller(st, x) === QIN);
}

// ---------- evaluation: how good is this position for `side` ----------
// `terms`, when an object is passed, collects the same number split into named
// buckets from `side`'s point of view: the advisor (advisor.js) subtracts the
// buckets before a move from the buckets after it to say *why* the move
// scored. The bookkeeping is a side channel: every `vq` line below is the same
// expression in the same order as before it existed, so the returned value is
// bit for bit what it always was, and the buckets add back up to it
// (tests/advisor.test.js pins both). Keys starting with `$` are facts for the
// advisor's `params`, not part of the sum. Called with no `terms` (every call
// inside this file) the cost is one branch per bucket.
export function evaluate(st, side, terms = null) {
  if (st.winner != null) return st.winner === side ? 1000 : -1000;
  const sign = side === QIN ? 1 : -1;
  const T = terms ? (k, x) => { terms[k] = (terms[k] || 0) + sign * x; } : null;
  const turnsLeft = Math.max(0, st.options.turns - st.turn) + (st.phase === "headline" ? 1 : 0.5);
  const frac = Math.min(1, turnsLeft / st.options.turns);
  let vq = st.mandate; // everything below is from Qin's point of view
  if (T) T("mandate", st.mandate);
  for (const r of SCORED_REGIONS) {
    const [q, c] = E.regionTally(st, r);
    const card = "score_" + r;
    let exp = RATE[r] * frac;
    const inHand = st.hands[QIN]?.includes(card) || st.hands[CHU]?.includes(card);
    if (inHand) exp += 0.8;
    const dumped = st.discard.includes(card);
    if (dumped) exp *= 0.8;
    vq += exp * (q.total - c.total);
    if (T) {
      // The one place the bookkeeping does arithmetic of its own: the region
      // term split into the control level, the battlegrounds, and the premium
      // for the scoring card being in a hand. The three add back to the term.
      const expCard = inHand ? 0.8 * (dumped ? 0.8 : 1) : 0, expBase = exp - expCard;
      T(`region:${r}:base`, expBase * (q.base - c.base));
      T(`region:${r}:bg`, expBase * (q.bonus - c.bonus));
      T(`region:${r}:card`, expCard * (q.total - c.total));
      terms[`$net:${r}`] = sign * (q.total - c.total);
    }
  }
  const mie = Object.keys(st.mie).length, seals = Object.keys(st.seals).length;
  const mieHeld = 3 * mie + (mie === st.options.mie - 1 ? 8 : 0);
  vq += mieHeld;
  if (T) T("mie", mieHeld);
  const sealsHeld = 2 * seals + (seals === st.options.seals - 1 ? 8 : 0);
  vq -= sealsHeld;
  if (T) T("seals", -sealsHeld);
  // The roads to 滅 and 相印, as points still needed; a threat grows with
  // the markers already held.
  const mieScale = 1 + 0.7 * mie, sealScale = 1 + 0.7 * seals;
  for (const [id, s] of Object.entries(STATES)) {
    const sp = E.spacesOfState(id);
    if (!st.mie[id]) {
      // A state held whole since 田單復國 lifted its 滅 cannot fall until Qin
      // first loses a space of it (heldSinceRestore above): as far as this road goes.
      const blocked = heldSinceRestore(st, id);
      let need = 0;
      for (const x of sp) { const [q, c] = E.infOf(st, x), S = SPACE[x].stability; if (q < c + S) need += c + S - q; }
      const road = mieScale * (blocked ? 0.1 : need <= 2 ? 2.5 : need <= 4 ? 1.2 : need <= 6 ? 0.5 : 0.1);
      vq += road;
      if (T) { T(`mieRoad:${id}`, road); terms[`$mieNeed:${id}`] = blocked ? null : need; }
    } else if (T) terms[`$mieNeed:${id}`] = 0;
    if (!st.seals[id]) {
      const [q, c] = E.infOf(st, s.capital), S = SPACE[s.capital].stability;
      const need = Math.max(0, q + S - c) + (st.options.sealAt === "cap" ? Math.max(0, E.capOf(st, s.capital) - Math.max(c, q + S)) : 0);
      const road = sealScale * (need <= 1 ? 1.8 : need === 2 ? 1.0 : need === 3 ? 0.5 : 0.15);
      vq -= road;
      if (T) { T(`sealRoad:${id}`, -road); terms[`$sealNeed:${id}`] = need; }
    } else if (T) terms[`$sealNeed:${id}`] = 0;
  }
  const risk = (s) => (st.weariness <= 2 ? 3 * st.hands[s].filter((c) => TIRING.has(c) && CARD[c].side !== s).length : 0);
  const tiring = risk(QIN) - risk(CHU);
  vq -= tiring;
  if (T) { T("tiring", -tiring); terms.$tiring = st.hands[side].filter((c) => TIRING.has(c) && CARD[c].side !== side).length; }
  const reformPerk = REFORM_PERK[st.reform[QIN]] - REFORM_PERK[st.reform[CHU]];
  vq += reformPerk;
  if (T) T("reform", reformPerk);
  const enemyCards = (s) => st.hands[s].filter((c) => CARD[c].side === 1 - s).length;
  const enemyHeld = 0.4 * (enemyCards(QIN) - enemyCards(CHU));
  vq -= enemyHeld;
  if (T) { T("enemyCards", -enemyHeld); terms.$enemyCards = enemyCards(side); }
  const handSize = 0.25 * (st.hands[QIN].length - st.hands[CHU].length);
  vq += handSize;
  if (T) T("handSize", handSize);
  // A scoring card must leave the hand before the turn ends: with no action
  // left this turn it is a certain loss, with one left it is urgent.
  if (st.phase === "action") {
    for (const s of [QIN, CHU]) {
      const n = st.hands[s].filter((c) => CARD[c].scoring).length;
      if (!n) continue;
      const left = st.rounds - st.round + (st.actor === QIN || s === CHU ? 1 : 0);
      const pain = left < n ? 500 : left === n ? 8 * n : n;
      vq += (s === QIN ? -1 : 1) * pain;
      if (T) T("scoringPain", (s === QIN ? -1 : 1) * pain);
    }
  }
  if (st.luoyiYields) {
    const l = E.controller(st, "luoyi");
    if (l != null) {
      const yields = (l === QIN ? 1 : -1) * st.options.luoyi * turnsLeft * 0.8;
      vq += yields;
      if (T) T("luoyi", yields);
    }
  }
  for (const s of SPACES) {
    const [q, c] = E.infOf(st, s.id), ctl = E.controller(st, s.id);
    if (q > 0 && ctl !== QIN) { vq += 0.15; if (T) T("spread", 0.15); }
    if (c > 0 && ctl !== CHU) { vq -= 0.15; if (T) T("spread", -0.15); }
  }
  const j = st.jiuding;
  const cauldrons = (j.holder === QIN ? 1 : -1) * (j.faceDown ? 0.8 : 1.5);
  vq += cauldrons;
  if (T) T("jiuding", cauldrons);
  return side === QIN ? vq : -vq;
}

// ---------- the guess: a full state consistent with what this seat sees ----------
export function determinize(view, side, rng) {
  const st = E.clone(view);
  st.log = [];
  const opp = 1 - side;
  const known = new Set([...st.hands[side], ...st.discard, ...st.removed]);
  if (Array.isArray(st.hands[opp])) for (const c of st.hands[opp]) known.add(c);
  for (const h of st.headline) if (h && h !== "hidden") known.add(h);
  const decks = { reform: ERA_DECKS.reform.slice(), alliance: ERA_DECKS.alliance.slice(), conquest: ERA_DECKS.conquest.slice() };
  if (st.options.scoringSplit === "v2") {
    decks.reform = decks.reform.filter((c) => c !== "score_west").concat("score_east");
    decks.alliance = decks.alliance.filter((c) => c !== "score_east").concat("score_west");
  }
  const merged = ERAS.filter((e) => e.from <= Math.max(1, st.turn)).map((e) => e.id);
  let pool = E.shuffle(rng, merged.flatMap((e) => decks[e]).filter((c) => !known.has(c)));
  st.later = Object.fromEntries(ERAS.filter((e) => !merged.includes(e.id)).map((e) => [e.id, decks[e.id]]));
  if (!Array.isArray(st.hands[opp])) st.hands[opp] = pool.splice(0, st.handCounts[opp]);
  if (st.headline[opp] === "hidden") st.headline[opp] = pool.shift() ?? null;
  st.draw = pool;
  st.rngState = rng.int(2 ** 31);
  delete st.handCounts; delete st.drawCount; delete st.laterCounts;
  return st;
}

// ---------- playing a candidate out, answering what it asks ----------
export function simulate(st, action, rng) {
  let s = E.apply(st, action);
  for (let guard = 0; s.pending && s.winner == null && guard < 16; guard++) {
    const who = s.pending.who;
    s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, rng) });
  }
  return s;
}
// ---------- the ops a play will really have, for the card page ----------
// An enemy card played for its ops EVENT FIRST has its ops read after the
// event (engine.js, the "ops" step's `afterEvent`, owner 裁決 #119): 荊軻刺秦王
// played by Qin lowers its own ops. So the page cannot print `opsOf` at play
// time for that order (#122). This plays the event out on a guess of the
// hidden cards -- the event's choices answered as the bot would, since no
// event's ops effect depends on them -- and reads the ops the engine then
// asks for. Ops first, own cards, 說客's pair: `opsOf` now, as always.
// `view` is left untouched.
export function opsForOrder(view, side, card, order) {
  const now = E.opsOf(view, side, card);
  const c = CARD[card];
  if (order !== "eventFirst" || !c || c.side == null || c.side === side) return now;
  try {
    const rng = E.makeRng(0);
    let s = E.apply(determinize(view, side, rng), { type: "play", side, card, use: "place", order: "eventFirst" });
    for (let guard = 0; s.pending && s.pending.tag !== "ops" && s.winner == null && guard < 16; guard++) {
      const who = s.pending.who;
      s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, rng) });
    }
    return s.pending && s.pending.tag === "ops" && s.pending.card === card ? s.pending.ops : now;
  } catch { return now; }
}
function evalAction(st, action, side, rng) {
  try { return evaluate(simulate(st, action, rng), side); } catch { return -Infinity; }
}
function bestOf(st, who, choices, rng) {
  let best = null, bestV = -Infinity;
  for (const ch of choices) {
    let v;
    try { v = evaluate(simulate(st, { type: "choose", side: who, choice: ch }, rng), who); } catch { continue; }
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best ?? choices[0];
}

function roomFor(p, s, side, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(s, id) - E.infOf(s, id)[side]);
  return r - (counts[id] || 0);
}
// Greedy per point on a scratch copy: try each option, keep the best, commit.
function bestPoints(st, p, who, rng) {
  const s = E.clone(st); s.log = [];
  const counts = {}, out = [];
  const bump = (id, d, side) => { const a = s.inf[id] || (s.inf[id] = [0, 0]); a[side] += d; };
  if (p.side != null) {
    for (let i = 0; i < p.n; i++) {
      let best = null, bestV = -Infinity;
      for (const id of p.options) {
        if (roomFor(p, s, p.side, id, counts) <= 0) continue;
        bump(id, 1, p.side); const v = evaluate(s, who); bump(id, -1, p.side);
        if (v > bestV) { bestV = v; best = id; }
      }
      if (best == null) break;
      bump(best, 1, p.side); counts[best] = (counts[best] || 0) + 1; out.push(best);
    }
    return out;
  }
  if (p.maxOf) { // lifting your own points: lose the least
    for (let i = 0; i < p.n; i++) {
      let best = null, bestV = -Infinity;
      for (const id of p.options) {
        if (roomFor(p, s, who, id, counts) <= 0) continue;
        bump(id, -1, who); const v = evaluate(s, who); bump(id, 1, who);
        if (v > bestV) { bestV = v; best = id; }
      }
      if (best == null) break;
      bump(best, -1, who); counts[best] = (counts[best] || 0) + 1; out.push(best);
    }
    return out;
  }
  if (p.n === 1) return bestOf(st, who, [...(p.min === 0 ? [[]] : []), ...p.options.map((id) => [id])], rng);
  // Several distinct picks whose meaning is "hit the enemy here" (張儀連橫).
  const scored = p.options.map((id) => { bump(id, -1, 1 - who); const v = evaluate(s, who); bump(id, 1, 1 - who); return { id, v }; });
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, p.n).map((x) => x.id);
}

// Where to put `ops` points: greedy per point, costs and reach re-read as
// control changes (under reach "ts" the eligible set is the one at the start).
export function greedyPlacement(st, side, ops, restrict = null) {
  const s = E.clone(st); s.log = [];
  const reach = E.reachFrom(s, side);
  const points = [];
  let left = ops;
  while (left > 0) {
    let best = null, bestV = -Infinity, bestCost = 0;
    for (const sp of SPACES) {
      if (restrict && !restrict(sp.id)) continue;
      const cost = E.placeCost(s, side, sp.id);
      if (cost > left || !E.canPlaceAt(s, side, sp.id, reach) || E.infOf(s, sp.id)[side] >= E.capOf(s, sp.id)) continue;
      const a = s.inf[sp.id] || (s.inf[sp.id] = [0, 0]);
      a[side]++; const v = evaluate(s, side) - 0.01 * cost; a[side]--;
      if (v > bestV) { bestV = v; best = sp.id; bestCost = cost; }
    }
    if (best == null) break;
    (s.inf[best] || (s.inf[best] = [0, 0]))[side]++;
    points.push(best); left -= bestCost;
  }
  return points;
}
function bestOps(st, who, ops, allowed, rng) {
  const o = E.opsOptions(st, who);
  const cands = [];
  if (allowed.includes("place")) { const points = greedyPlacement(st, who, ops); if (points.length) cands.push({ use: "place", points }); }
  if (allowed.includes("campaign")) for (const t of o.campaignTargets) cands.push({ use: "campaign", target: t });
  if (allowed.includes("lobby")) for (const t of o.lobbyTargets) cands.push({ use: "lobby", target: t.id });
  return bestOf(st, who, cands, rng);
}
export function answer(st, p, who, rng) {
  switch (p.kind) {
    case "points": return bestPoints(st, p, who, rng);
    case "card": return bestOf(st, who, [...((p.min ?? 1) === 0 ? [[]] : []), ...p.options.map((c) => [c])], rng);
    case "option": return bestOf(st, who, p.options.map((o) => o.id), rng);
    case "ops": return bestOps(st, who, p.ops, p.allowed, rng);
    default: throw new Error(`answer: ${p.kind}`);
  }
}

// #123 (owner: a self-collapse played with no warning, lost with a safe
// alternative sitting in hand): never offer -- to the scored bots below, or
// to the easy/random one further down -- a play that pushes weariness to 土
// 崩 against `side` right now, unless every legal play does (forced is still
// forced). `evaluate()` already scores an ended game at -1000/+1000 (win()'s
// own bookkeeping), which already pushes a losing play for normal/hard to
// the very bottom of the ranking -- but that is a strong bias, not a
// guarantee once several candidates all lose the same way, and it says
// nothing about the easy bot, which never evaluates anything. This filters
// candidates BEFORE any of that, from `E.actionWouldCollapse` (engine.js),
// the same simulate-don't-pattern-match check the card page's own warning
// uses. Above weariness 4 nothing any sided card tires by today (1, or 2
// through the one card that tires twice in a single play) can reach 土崩 (1)
// in one play, so the (cloning, simulating) check is skipped there rather
// than paid on every candidate all game.
const COLLAPSE_RISK_WEARINESS = 4;
function dropSelfCollapse(st, side, list) {
  if (list.length <= 1 || st.weariness > COLLAPSE_RISK_WEARINESS) return list;
  const safe = list.filter((a) => !E.actionWouldCollapse(st, side, a));
  return safe.length ? safe : list;
}

// ---------- candidates for an action round ----------
function actionCandidates(st, side, L) {
  const out = [];
  if (L.bog && L.bog.length) return L.bog.map((c) => ({ type: "play", side, card: c, use: "bog" }));
  let dead = null;
  for (const c of L.cards) {
    const u = c.uses, id = c.id;
    // 說客 alone as its event does nothing (its effect is empty): a dead play,
    // offered only when nothing else is legal (#115).
    if (id === "shuoke") dead = { type: "play", side, card: id, use: "event" };
    else out.push({ type: "play", side, card: id, use: "event" });
    if (u.reform) out.push({ type: "play", side, card: id, use: "reform" });
    if (u.place) { const points = greedyPlacement(st, side, u.place.ops); if (points.length) out.push({ type: "play", side, card: id, use: "place", order: "opsFirst", points }); }
    if (u.campaign) for (const t of u.campaign.targets) out.push({ type: "play", side, card: id, use: "campaign", order: "opsFirst", target: t });
    if (u.lobby) for (const t of u.lobby.targets) out.push({ type: "play", side, card: id, use: "lobby", order: "opsFirst", target: t.id });
    if (u.enemy && (u.place || u.campaign || u.lobby)) out.push({ type: "play", side, card: id, use: "place", order: "eventFirst" });
    if (u.pair && u.pair.length) {
      const pair = u.pair.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
      const pops = E.opsOf(st, side, pair);
      const points = greedyPlacement(st, side, pops);
      if (points.length) out.push({ type: "play", side, card: id, pair, use: "place", points });
      if (u.campaign) for (const t of u.campaign.targets) out.push({ type: "play", side, card: id, pair, use: "campaign", target: t });
      if (u.lobby) for (const t of u.lobby.targets) out.push({ type: "play", side, card: id, pair, use: "lobby", target: t.id });
    }
  }
  if (L.jiuding) {
    const j = L.jiuding, zhou = (id) => SPACE[id].region === "jin" || SPACE[id].region === "zhou";
    if (j.place) {
      const p4 = greedyPlacement(st, side, 4); if (p4.length) out.push({ type: "play", side, card: JIUDING, use: "place", points: p4 });
      const p5 = greedyPlacement(st, side, 5, zhou); if (p5.length && p5.every(zhou)) out.push({ type: "play", side, card: JIUDING, use: "place", points: p5 });
    }
    if (j.campaign) for (const t of j.campaign.targets) out.push({ type: "play", side, card: JIUDING, use: "campaign", target: t });
    if (j.lobby) for (const t of j.lobby.targets) out.push({ type: "play", side, card: JIUDING, use: "lobby", target: t.id });
  }
  if (!out.length && dead) out.push(dead);
  return dropSelfCollapse(st, side, out);
}

// The other side's best one-ply reply, from the sampled state.
function replyValue(st, action, side, rng) {
  let s;
  try { s = simulate(st, action, rng); } catch { return -Infinity; }
  if (s.winner != null) return evaluate(s, side);
  const opp = 1 - side;
  if (s.phase !== "action" || s.actor !== opp || s.pending) return evaluate(s, side);
  const L = E.legal(s, opp);
  if (L.kind !== "action") return evaluate(s, side);
  let worst = Infinity;
  for (const b of actionCandidates(s, opp, L)) {
    let v;
    try { v = evaluate(simulate(s, b, rng), side); } catch { continue; }
    if (v < worst) worst = v;
  }
  return worst === Infinity ? evaluate(s, side) : worst;
}

// Headline: average over a few guesses of the other hand and headline.
function bestHeadline(view, side, cards, rng, level) {
  const K = level === "hard" ? 10 : 5;
  let best = null, bestV = -Infinity;
  for (const card of cards) {
    let total = 0, n = 0;
    for (let k = 0; k < K; k++) {
      const st = determinize(view, side, rng);
      const opp = 1 - side;
      let theirs = st.headline[opp];
      if (theirs == null) {
        const hand = st.hands[opp].filter((c) => c !== JIUDING);
        if (!hand.length) continue;
        theirs = rng.next() < 0.5 ? hand.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a)) : pickOne(hand, rng);
      }
      try {
        let s = E.apply(st, { type: "headline", side, card });
        if (s.headline[opp] == null) s = E.apply(s, { type: "headline", side: opp, card: theirs });
        for (let guard = 0; s.pending && s.winner == null && guard < 16; guard++) {
          const who = s.pending.who;
          s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, rng) });
        }
        total += evaluate(s, side); n++;
      } catch { /* an unplayable guess; skip it */ }
    }
    const v = n ? total / n : -Infinity;
    if (v > bestV) { bestV = v; best = card; }
  }
  return best ?? cards[0];
}

// ---------- random play (easy, and the fuzz driver) ----------
export function randomPoints(st, side, ops, rng) {
  const trial = E.clone(st); trial.log = [];
  const reach = E.reachFrom(trial, side);
  const points = [];
  let left = ops;
  for (let i = 0; i < ops; i++) {
    const cands = SPACES.filter((s) => E.canPlaceAt(trial, side, s.id, reach) && E.infOf(trial, s.id)[side] < E.capOf(trial, s.id) && E.placeCost(trial, side, s.id) <= left);
    if (!cands.length) break;
    const id = pickOne(cands, rng).id;
    left -= E.placeCost(trial, side, id);
    E.place(trial, side, id, 1);
    points.push(id);
    if (left <= 0) break;
  }
  return points;
}
export function randomOps(st, side, ops, allowed, rng) {
  const o = E.opsOptions(st, side);
  const uses = allowed.filter((u) => (u === "place" ? o.placeOptions.length : u === "campaign" ? o.campaignTargets.length : o.lobbyTargets.length) > 0);
  if (!uses.length) return null;
  const use = pickOne(uses, rng);
  if (use === "place") return { use, points: randomPoints(st, side, ops, rng) };
  if (use === "campaign") return { use, target: pickOne(o.campaignTargets, rng) };
  return { use, target: pickOne(o.lobbyTargets, rng).id };
}
export function randomChoice(st, p, rng) {
  switch (p.kind) {
    case "points": {
      const n = p.min + (p.n > p.min ? rng.int(p.n - p.min + 1) : 0);
      const counts = {}, out = [];
      for (let i = 0; i < n; i++) {
        const cands = p.options.filter((id) => roomFor(p, st, p.side, id, counts) > 0);
        if (!cands.length) break;
        const id = pickOne(cands, rng);
        counts[id] = (counts[id] || 0) + 1; out.push(id);
      }
      return out;
    }
    case "card": {
      const min = p.min ?? 1, max = p.n ?? 1;
      const n = min + (max > min ? rng.int(max - min + 1) : 0);
      const pool = p.options.slice(), out = [];
      while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
      return out;
    }
    case "option": return pickOne(p.options, rng).id;
    case "ops": return randomOps(st, p.who, p.ops, p.allowed, rng);
    default: throw new Error(`randomChoice: ${p.kind}`);
  }
}
export function randomAction(st, side, rng) {
  const L = E.legal(st, side);
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: randomChoice(st, L.pending, rng) };
    case "headline": return { type: "headline", side, card: pickOne(L.cards, rng) };
    case "action": {
      if (L.bog && L.bog.length) return { type: "play", side, card: pickOne(L.bog, rng), use: "bog" };
      const scoring = L.cards.find((c) => CARD[c.id].scoring);
      if (scoring) return { type: "play", side, card: scoring.id, use: "event" };
      const opts = [];
      // 說客 alone as its event is a dead play (#115): only when nothing else is legal.
      const dead = L.cards.some((c) => c.id === "shuoke") ? { type: "play", side, card: "shuoke", use: "event" } : null;
      for (const c of L.cards) {
        const u = c.uses;
        if (c.id !== "shuoke") opts.push({ type: "play", side, card: c.id, use: "event" });
        if (u.reform) opts.push({ type: "play", side, card: c.id, use: "reform" });
        const order = () => (u.enemy ? (rng.next() < 0.5 ? "eventFirst" : "opsFirst") : undefined);
        if (u.place) opts.push(() => { const o = order(); return { type: "play", side, card: c.id, use: "place", order: o, points: o === "eventFirst" ? undefined : randomPoints(st, side, u.place.ops, rng) }; });
        if (u.campaign) opts.push(() => ({ type: "play", side, card: c.id, use: "campaign", order: order(), target: pickOne(u.campaign.targets, rng) }));
        if (u.lobby) opts.push(() => ({ type: "play", side, card: c.id, use: "lobby", order: order(), target: pickOne(u.lobby.targets, rng).id }));
        if (u.pair && u.pair.length) opts.push(() => {
          const pair = pickOne(u.pair, rng);
          const ops = randomOps(st, side, E.opsOf(st, side, pair), ["place", "campaign", "lobby"], rng);
          return ops ? { type: "play", side, card: c.id, pair, ...ops } : null;
        });
      }
      if (L.jiuding) {
        const j = L.jiuding;
        if (j.place) opts.push(() => ({ type: "play", side, card: JIUDING, use: "place", points: randomPoints(st, side, 4, rng) }));
        if (j.campaign) opts.push(() => ({ type: "play", side, card: JIUDING, use: "campaign", target: pickOne(j.campaign.targets, rng) }));
        if (j.lobby) opts.push(() => ({ type: "play", side, card: JIUDING, use: "lobby", target: pickOne(j.lobby.targets, rng).id }));
      }
      // A pair with no ops to spend comes back null: draw again from the rest.
      // #123: same rejection for a play that would collapse the realm on
      // this side right now (dropSelfCollapse's own comment, above) -- easy
      // is pure random with no evaluation at all, so it is the level most
      // likely to walk into one with a safe card sitting right next to it.
      const riskGate = st.weariness <= COLLAPSE_RISK_WEARINESS;
      while (opts.length) {
        const i = rng.int(opts.length), o = opts[i];
        const a = typeof o === "function" ? o() : o;
        if (a && (!riskGate || !E.actionWouldCollapse(st, side, a))) return a;
        opts.splice(i, 1);
      }
      return dead;
    }
    default: return null;
  }
}

// Every candidate with its value, best first: for tests, debugging and hints.
export function scoreCandidates(view, side, rng, level = "normal") {
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  if (L.kind !== "action") return [];
  return actionCandidates(st, side, L).map((a) => ({ a, v: evalAction(st, a, side, rng) })).sort((x, y) => y.v - x.v);
}

// ---------- the decision ----------
export function decide(view, side, level = "normal", rng) {
  if (level === "easy") { const a = randomAction(view, side, rng); if (a) a.why = "random"; return a; }
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  const noise = NOISE[level] ?? 0.6;
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: answer(st, L.pending, side, rng), why: L.pending.kind };
    case "headline": return { type: "headline", side, card: bestHeadline(view, side, L.cards, rng, level), why: "headline" };
    case "action": {
      const cands = actionCandidates(st, side, L);
      if (!cands.length) return null;
      const scored = cands.map((a) => ({ a, v: evalAction(st, a, side, rng) + noise * gauss(rng) }));
      scored.sort((x, y) => y.v - x.v);
      let top = scored.slice(0, level === "hard" ? 4 : 1);
      if (level === "hard" && top.length > 1) {
        for (const t of top) t.v = replyValue(st, t.a, side, rng) + noise * gauss(rng);
        top.sort((x, y) => y.v - x.v);
      }
      const a = top[0].a;
      a.why = `${a.use}:${a.card}`;
      return a;
    }
    default: return null;
  }
}
