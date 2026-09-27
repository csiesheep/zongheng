// #130: `lobby: "realign"` -- 遊說 as a Twilight Struggle realignment roll -- and `"realign-mild"`.
//
// Expected values come from the brief of #130 (owner, 2026-09-26: 「遊說改成雙方都會輸（冷戰熱鬥的「重整」）：
// 比較周邊的局勢，輸的一方失去差值。局勢不好時，連你自己的點也會掉。」) and the orchestrator's
// resume message (「realign-mild: each side rolls 1d3 instead of 1d6, and a loser loses at most 2 per attempt」):
//   - target: any space with enemy influence that is not protected; no 局勢 > 0 needed; weariness does
//     not block it and it does not move weariness;
//   - X ops = X attempts on the one target, one at a time; stop once the enemy has nothing left there;
//   - each attempt, each side rolls 1d6 (mild: 1d3) and adds +1 per neighbour of the target it controls,
//     +1 if it has more influence in the target than the other side, +1 if the target is in its home
//     region (西土 Qin, 南方 Chu) or next to a space of it;
//   - the higher total wins; the loser removes the difference from its own influence there (never below
//     0; mild: at most 2); a tie does nothing; markers are checked after every attempt.
// And `"realign-own"` (owner's pick, from the orchestrator, #130): realign, but only on a space where the
// actor ALSO has at least 1 influence of its own; when the actor's own influence there reaches 0 the rest
// of the attempts are lost too (it no longer qualifies), as they are when the enemy's reaches 0. And 收手
// (owner, via the orchestrator): under realign-own, after each attempt that leaves attempts unspent the
// actor chooses `continue` (roll the next) or `stop` (the rest are lost) -- a pending decision after every
// roll, each roll made from the game's RNG as it is resolved, a `lobbyStop` entry when the actor stops; each
// attempt's entry names both sides' modifiers (the controlled neighbours, more influence, home).
// The modifiers and the losses are recomputed here from that text (`ctl`, `mods`, `expectLoss` below), not
// read from the engine; only the dice faces are read from the log, since the rule does not fix them.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN, CHU, SPACE, SPACES } = E;
const HOME = { [QIN]: "west", [CHU]: "south" };
const DIE = { realign: 6, "realign-mild": 3, "realign-own": 6 }, MILD_CAP = 2;
const OWN = { "realign-own": true };

// Control, straight from the rulebook: a side controls a space when its influence is at least the other
// side's plus the space's stability.
function ctl(inf, id) {
  const [q, c] = inf[id] || [0, 0], S = SPACE[id].stability;
  return q >= c + S ? QIN : c >= q + S ? CHU : null;
}
function mods(inf, side, id) {
  const opp = 1 - side, a = inf[id] || [0, 0];
  let m = SPACE[id].adj.filter((x) => ctl(inf, x) === side).length;
  if (a[side] > a[opp]) m++;
  const home = HOME[side];
  if (SPACE[id].region === home || SPACE[id].adj.some((x) => SPACE[x].region === home)) m++;
  return m;
}

// Random play until `side` must take an action round, then a board of our own: every space empty except
// `inf`, `side` holding only `card`, the other side one harmless card, no effects, no markers.
function stage(options, side, { inf, card, weariness = 5, effects = [] }) {
  let st = null;
  for (let seed = 1; seed < 200 && !st; seed++) {
    const rng = E.makeRng(seed * 7919);
    let s = E.createGame(seed, options);
    for (let k = 0; s.winner == null && k < 3000; k++) {
      if (s.phase === "action" && s.actor === side && !s.pending && s.turn >= 2) { st = s; break; }
      const who = E.mustAct(s), x = who[rng.int(who.length)];
      s = E.apply(s, B.randomAction(s, x, rng));
    }
  }
  st = E.clone(st);
  st.log = [];
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
    for (const c of [card, "zhouzuo"]) { const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1); }
  }
  st.hands[side] = [card]; st.hands[1 - side] = ["zhouzuo"];
  st.inf = E.clone(inf);
  st.effects = effects; st.mie = {}; st.seals = {}; st.mieHold = {}; st.forced = [null, null];
  st.weariness = weariness; st.mandate = 0; st.jiuding = { holder: 1 - side, faceDown: true };
  return st;
}
const lobbyPlay = (side, card, target) => ({ type: "play", side, card, use: "lobby", target });
// Answer every 收手 decision with `choice` (realign-own asks after each attempt that leaves attempts unspent;
// the other modes never ask).
function playOut(s, choice = "continue") {
  for (let k = 0; s.pending && s.pending.tag === "realign" && k < 20; k++) s = E.apply(s, { type: "choose", side: s.pending.who, choice });
  return s;
}
// The same play from many RNG states, every attempt taken; returns [state after, its realign entries, state before].
function* rolls(st, action, n = 400) {
  for (let i = 1; i <= n; i++) {
    const s = E.clone(st); s.rngState = (i * 2654435761) >>> 0;
    const after = playOut(E.apply(s, action));
    yield [after, after.log.filter((l) => l.type === "realign"), s];
  }
}
function find(st, action, pred) {
  for (const r of rolls(st, action)) if (pred(r[1], r[0])) return r;
  throw new Error("no RNG state gives that roll");
}
const total = (e, s) => e.roll[s] + e.mod[s];

// Luoyi (周室, stability 3; next to 函谷關 which is 西土, 宜陽, 新鄭): Qin controls 函谷關, Chu controls 新鄭,
// Chu has more influence in Luoyi. By the text: Qin 1 (函谷關) + 0 + 1 (next to 西土) = 2;
// Chu 1 (新鄭) + 1 (more influence) + 0 (no 南方 neighbour) = 2.
const LUOYI = { hangu: [6, 0], xinzheng: [0, 4], luoyi: [2, 3] };

for (const mode of ["realign", "realign-mild", "realign-own"]) {
  test(`${mode}: the modifiers are +1 per controlled neighbour, +1 for more influence, +1 in or next to home`, () => {
    const st = stage({ lobby: mode }, QIN, { inf: LUOYI, card: "tiangou" });
    const [, [e]] = rolls(st, lobbyPlay(QIN, "tiangou", "luoyi"), 1).next().value;
    assert.ok(e, "one realign entry");
    assert.deepEqual(e.mod, [2, 2]);
    assert.deepEqual([mods(LUOYI, QIN, "luoyi"), mods(LUOYI, CHU, "luoyi")], [2, 2], "the test's own reading agrees");
    // 陳蔡 (南方): Chu controls 郢 next door and is at home; Qin controls 新鄭 next door. Qin 1, Chu 2.
    const inf = { ying: [0, 4], xinzheng: [2, 0], chencai: [1, 1] };
    const st2 = stage({ lobby: mode }, CHU, { inf, card: "tiangou" });
    const [, [e2]] = rolls(st2, lobbyPlay(CHU, "tiangou", "chencai"), 1).next().value;
    assert.deepEqual(e2.mod, [1, 2]);
    assert.equal(e2.side, CHU);
    assert.equal(e2.target, "chencai");
  });

  test(`${mode}: the dice are 1d${DIE[mode]}, both sides, every face seen`, () => {
    const st = stage({ lobby: mode }, QIN, { inf: LUOYI, card: "tiangou" });
    const seen = new Set();
    for (const [, es] of rolls(st, lobbyPlay(QIN, "tiangou", "luoyi"), 300)) for (const e of es) for (const r of e.roll) seen.add(r);
    assert.deepEqual([...seen].sort(), Array.from({ length: DIE[mode] }, (_, i) => i + 1));
  });

  test(`${mode}: a lost roll costs the actor its own points; a tie changes nothing; a won roll costs the enemy`, () => {
    const inf = { hangu: [6, 0], xinzheng: [0, 4], luoyi: [5, 5] };
    const st = stage({ lobby: mode }, QIN, { inf, card: "tiangou" }); // 1 op: one attempt
    const cap = mode === "realign-mild" ? MILD_CAP : Infinity;
    let lost = 0, tie = 0, won = 0;
    for (const [after, es] of rolls(st, lobbyPlay(QIN, "tiangou", "luoyi"), 200)) {
      assert.equal(es.length, 1);
      const [e] = es, d = total(e, QIN) - total(e, CHU);
      const [q, c] = after.inf.luoyi;
      if (d === 0) { tie++; assert.deepEqual([q, c], [5, 5], "tie"); assert.equal(e.lose, null); }
      else if (d < 0) { lost++; assert.deepEqual([q, c], [5 - Math.min(-d, cap, 5), 5], `lost by ${-d}`); assert.equal(e.lose, QIN); assert.equal(e.n, Math.min(-d, cap, 5)); }
      else { won++; assert.deepEqual([q, c], [5, 5 - Math.min(d, cap, 5)], `won by ${d}`); assert.equal(e.lose, CHU); }
    }
    assert.ok(lost > 0 && tie > 0 && won > 0, `all three outcomes seen (${lost}/${tie}/${won})`);
  });

  test(`${mode}: a loser never goes below 0${mode === "realign-mild" ? `, and never loses more than ${MILD_CAP}` : ""}`, () => {
    // Qin has 1 point in Luoyi. Chu 2 (新鄭, 宜陽) + 1 (more influence) = 3; Qin 1 (函谷關) + 1 (next to 西土) = 2.
    const inf = { xinzheng: [0, 4], yiyang: [0, 4], hangu: [6, 0], luoyi: [1, 5] };
    const st = stage({ lobby: mode }, QIN, { inf, card: "tiangou" });
    const [after, [e]] = find(st, lobbyPlay(QIN, "tiangou", "luoyi"), ([x]) => x && total(x, CHU) - total(x, QIN) >= 3);
    assert.deepEqual(after.inf.luoyi, [0, 5]);
    assert.equal(e.n, 1);
    if (mode === "realign-mild") {
      const inf2 = { ...inf, luoyi: [5, 6] }; // Chu 3, Qin 2: a 3-to-1 roll is a difference of 3
      const st2 = stage({ lobby: mode }, QIN, { inf: inf2, card: "tiangou" });
      const [after2, [e2]] = find(st2, lobbyPlay(QIN, "tiangou", "luoyi"), ([x]) => x && total(x, CHU) - total(x, QIN) > MILD_CAP);
      assert.deepEqual(after2.inf.luoyi, [5 - MILD_CAP, 6], `lost by ${total(e2, CHU) - total(e2, QIN)}, capped`);
      assert.equal(e2.n, MILD_CAP);
    }
  });

  test(`${mode}: X ops are X attempts, resolved one at a time, stopping once the enemy has nothing left`, () => {
    const inf = { hangu: [6, 0], xinzheng: [0, 4], luoyi: [3, 3] };
    const st = stage({ lobby: mode }, QIN, { inf, card: "mibing" }); // 3 ops
    let full = 0, early = 0;
    for (const [after, es] of rolls(st, lobbyPlay(QIN, "mibing", "luoyi"), 200)) {
      // Replay the attempts by the text, from the logged dice.
      const board = E.clone(inf);
      const stops = () => board.luoyi[CHU] === 0 || (!!OWN[mode] && board.luoyi[QIN] === 0);
      for (const e of es) {
        assert.equal(stops(), false, "no attempt after the sequence should have stopped");
        assert.deepEqual(e.mod, [mods(board, QIN, "luoyi"), mods(board, CHU, "luoyi")], "modifiers re-read before each attempt");
        const d = total(e, QIN) - total(e, CHU), cap = mode === "realign-mild" ? MILD_CAP : Infinity;
        if (d > 0) board.luoyi[CHU] = Math.max(0, board.luoyi[CHU] - Math.min(d, cap));
        if (d < 0) board.luoyi[QIN] = Math.max(0, board.luoyi[QIN] - Math.min(-d, cap));
      }
      assert.deepEqual(after.inf.luoyi, board.luoyi);
      if (es.length === 3) full++;
      else { early++; assert.ok(stops(), `stopped early only because ${OWN[mode] ? "one side" : "Chu"} had nothing left`); }
      assert.ok(es.length >= 1 && es.length <= 3);
      assert.deepEqual(es.map((e) => e.k), es.map((_, i) => i + 1));
      const lob = after.log.find((l) => l.type === "lobby");
      assert.equal(lob.mode, mode); assert.equal(lob.ops, 3); assert.equal(lob.attempts, es.length);
    }
    assert.ok(full > 0 && early > 0, `both seen (${full} full, ${early} early)`);
  });

  test(`${mode}: no 局勢 needed, weariness neither blocks nor moves it; a protected space is refused`, () => {
    // Chu lobbies 關中: every neighbour Qin's (局勢 −4), 西土 locked for raids at weariness 4 (homeLock 4).
    const inf = { guanzhong: [5, 1], hangu: [6, 0], hanzhong: [4, 0], yiqu: [5, 0], bashu: [4, 0] };
    const st = stage({ lobby: mode }, CHU, { inf, card: "tiangou", weariness: 4 });
    assert.equal(E.edge(st, CHU, "guanzhong"), -4);
    assert.ok(E.campaignLocked(st, "guanzhong"));
    const L = E.legal(st, CHU);
    assert.ok(L.cards[0].uses.lobby && L.cards[0].uses.lobby.targets.some((t) => t.id === "guanzhong"), "offered");
    const after = E.apply(st, lobbyPlay(CHU, "tiangou", "guanzhong"));
    assert.equal(after.weariness, 4);
    assert.equal(after.log.filter((l) => l.type === "realign").length, 1);
    // The same play without the option: refused, as today.
    const today = stage({ lobby: undefined }, CHU, { inf, card: "tiangou", weariness: 4 });
    assert.throws(() => E.apply(today, lobbyPlay(CHU, "tiangou", "guanzhong")), /no edge/);
    const prot = stage({ lobby: mode }, CHU, { inf, card: "tiangou", weariness: 4, effects: [{ card: "mozhe", side: QIN, kind: "protect", space: "guanzhong", until: "turn" }] });
    assert.throws(() => E.apply(prot, lobbyPlay(CHU, "tiangou", "guanzhong")), /protected/);
    // Nothing of the enemy's there: refused.
    assert.throws(() => E.apply(st, lobbyPlay(CHU, "tiangou", "luoyi")), /no enemy influence/);
  });

  test(`${mode}: markers are checked after every attempt, not once at the end`, () => {
    // 新鄭 (韓's capital, stability 2) under a Chu 相印; Qin 3, Chu 2. The first attempt Qin wins by exactly 1
    // leaves Chu 1 there and gives Qin control: 韓's 相印 goes at once, before the second attempt.
    const inf = { xinzheng: [3, 2], yiyang: [4, 0], luoyi: [5, 0] };
    const st = stage({ lobby: mode }, QIN, { inf, card: "mibing" });
    st.seals = { han: true }; st.sealVp = { han: true };
    const [after] = find(st, lobbyPlay(QIN, "mibing", "xinzheng"), ([a, b]) => a && b && total(a, QIN) - total(a, CHU) === 1);
    const types = after.log.map((l) => l.type).filter((t) => t === "realign" || t === "unseal");
    assert.deepEqual(types.slice(0, 3), ["realign", "unseal", "realign"]);
    assert.equal(after.seals.han, undefined);
  });

  test(`${mode}: the roll comes from the game's own RNG: the same state and play give the same result`, () => {
    const st = stage({ lobby: mode }, QIN, { inf: LUOYI, card: "mibing" });
    st.rngState = 12345;
    const a = E.apply(st, lobbyPlay(QIN, "mibing", "luoyi")), b = E.apply(st, lobbyPlay(QIN, "mibing", "luoyi"));
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.notEqual(a.rngState, 12345, "the dice moved the game's RNG");
  });
}

// "Without the option" means a game whose options do not name `lobby` -- an old save, since #133 made realign-own
// the default. `lobby: undefined` stands for that here (createGame spreads it over the defaults).
test("without the option 遊說 is today's: 局勢 decides, no dice, the actor never loses", () => {
  const inf = { hangu: [6, 0], yiyang: [4, 0], xinzheng: [0, 4], luoyi: [2, 3] };
  const st = stage({ lobby: undefined }, QIN, { inf, card: "mibing" });
  const rng0 = st.rngState;
  const after = E.apply(st, lobbyPlay(QIN, "mibing", "luoyi"));
  // 局勢 = 2 controlled (函谷關, 宜陽) − 1 (新鄭) = 1: one Chu point goes.
  assert.deepEqual(after.inf.luoyi, [2, 2]);
  assert.equal(after.log.filter((l) => l.type === "realign").length, 0);
  assert.equal(after.rngState, rng0);
});

test("realign-own: a space where the actor has no influence of its own is not offered, and apply() refuses it", () => {
  // Chu has nothing in 函谷關, Qin 3; Chu has 1 in 關中.
  const inf = { guanzhong: [5, 1], hangu: [3, 0], luoyi: [0, 2] };
  const st = stage({ lobby: "realign-own" }, CHU, { inf, card: "tiangou" });
  const targets = E.legal(st, CHU).cards[0].uses.lobby.targets.map((t) => t.id);
  assert.ok(targets.includes("guanzhong"), "own 1 + enemy 5: offered");
  assert.equal(targets.includes("hangu"), false, "own 0: not offered");
  assert.throws(() => E.apply(st, lobbyPlay(CHU, "tiangou", "hangu")), /influence of your own/);
  // The same space under plain realign is a legal (riskless) target.
  const plain = stage({ lobby: "realign" }, CHU, { inf, card: "tiangou" });
  assert.ok(E.legal(plain, CHU).cards[0].uses.lobby.targets.some((t) => t.id === "hangu"));
  assert.doesNotThrow(() => E.apply(plain, lobbyPlay(CHU, "tiangou", "hangu")));
});

test("realign-own: when the actor's own influence reaches 0 the rest of the attempts are lost", () => {
  // Qin 1 in Luoyi against Chu 5 and much better Chu modifiers: a lost first attempt empties Qin there.
  const inf = { xinzheng: [0, 4], yiyang: [0, 4], hangu: [6, 0], luoyi: [1, 5] };
  const st = stage({ lobby: "realign-own" }, QIN, { inf, card: "mibing" }); // 3 ops
  const [after, es, before] = find(st, lobbyPlay(QIN, "mibing", "luoyi"), ([x]) => x && total(x, CHU) > total(x, QIN));
  assert.equal(es.length, 1, "one attempt, then Qin no longer qualifies");
  assert.deepEqual(after.inf.luoyi, [0, 5]);
  const lob = after.log.find((l) => l.type === "lobby");
  assert.equal(lob.attempts, 1); assert.equal(lob.ops, 3);
  // Under plain realign the same roll goes on to the second and third attempts.
  const plain = stage({ lobby: "realign" }, QIN, { inf, card: "mibing" });
  plain.rngState = before.rngState;
  assert.equal(E.apply(plain, lobbyPlay(QIN, "mibing", "luoyi")).log.filter((l) => l.type === "realign").length, 3);
});

// ---------- 收手 (realign-own) ----------
// Luoyi 3 : 3 with Qin's 3-op card: a first attempt that neither empties Chu nor Qin leaves two unspent.
const OPEN = { hangu: [6, 0], xinzheng: [0, 4], luoyi: [3, 3] };
function firstOpen(mode = "realign-own") {
  const st = stage({ lobby: mode }, QIN, { inf: OPEN, card: "mibing" });
  for (let i = 1; i < 400; i++) {
    const s = E.clone(st); s.rngState = (i * 2654435761) >>> 0;
    const after = E.apply(s, lobbyPlay(QIN, "mibing", "luoyi"));
    const [q, c] = after.inf.luoyi;
    if (q > 0 && c > 0) return { before: s, after };
  }
  throw new Error("no open first attempt");
}

test("收手: after an attempt with attempts left the actor is asked continue / stop; that roll is already made", () => {
  const { before, after } = firstOpen();
  assert.equal(after.log.filter((l) => l.type === "realign").length, 1, "one attempt rolled, not three");
  assert.ok(after.pending, "a decision is pending");
  assert.equal(after.pending.who, QIN);
  assert.equal(after.pending.kind, "option");
  assert.deepEqual(after.pending.options.map((o) => o.id).sort(), ["continue", "stop"]);
  assert.equal(after.pending.target, "luoyi");
  assert.notEqual(after.rngState, before.rngState, "the first roll came from the game's RNG");
  assert.equal(after.actor, QIN, "still Qin's action round");
  // Nothing else of the play has happened yet: the round has not passed to Chu.
  assert.deepEqual(E.mustAct(after), [QIN]);
});

test("收手: stop loses the remaining attempts and logs a stop", () => {
  const { after } = firstOpen();
  const s = E.apply(after, { type: "choose", side: QIN, choice: "stop" });
  assert.equal(s.pending, null);
  assert.equal(s.log.filter((l) => l.type === "realign").length, 1);
  assert.deepEqual(s.inf.luoyi, after.inf.luoyi, "no more rolls");
  const stop = s.log.find((l) => l.type === "lobbyStop");
  assert.ok(stop, "a stop entry");
  assert.equal(stop.side, QIN); assert.equal(stop.target, "luoyi"); assert.equal(stop.k, 1); assert.equal(stop.left, 2);
  assert.equal(s.log.find((l) => l.type === "lobby").attempts, 1);
  assert.equal(s.actor, CHU, "the action round passed on");
  assert.equal(s.rngState, after.rngState, "stopping rolls nothing");
});

test("收手: continue rolls exactly once more (from the RNG then), and asks again only while attempts are left", () => {
  const { after } = firstOpen();
  const s = E.apply(after, { type: "choose", side: QIN, choice: "continue" });
  const es = s.log.filter((l) => l.type === "realign");
  assert.equal(es.length, 2);
  assert.notEqual(s.rngState, after.rngState, "the second roll is made now, not before");
  const [q, c] = s.inf.luoyi;
  if (q > 0 && c > 0) {
    assert.ok(s.pending && s.pending.tag === "realign", "one attempt left: asked again");
    const t = E.apply(s, { type: "choose", side: QIN, choice: "continue" });
    assert.equal(t.log.filter((l) => l.type === "realign").length, 3);
    assert.equal(t.pending, null, "no attempts left: nothing to ask");
  } else assert.equal(s.pending, null, "auto-stop: nothing to ask");
});

test("收手: a save and reload mid-sequence resumes at the decision and plays on identically", () => {
  const { after } = firstOpen();
  const saved = JSON.stringify(after), loaded = JSON.parse(saved);
  assert.deepEqual(loaded.pending, after.pending);
  const view = E.view(loaded, QIN);
  assert.equal(view.pending.tag, "realign", "the seat's view shows the decision");
  for (const choice of ["continue", "stop"]) {
    const a = E.apply(after, { type: "choose", side: QIN, choice }), b = E.apply(loaded, { type: "choose", side: QIN, choice });
    assert.equal(JSON.stringify(b), JSON.stringify(a), choice);
  }
  assert.throws(() => E.apply(loaded, { type: "choose", side: CHU, choice: "stop" }), /not your choice/);
});

test("收手: the auto-stops still apply (enemy emptied, own emptied, the last attempt) and ask nothing", () => {
  const st = stage({ lobby: "realign-own" }, QIN, { inf: { ...OPEN, luoyi: [3, 1] }, card: "mibing" });
  const [, , before] = find(st, lobbyPlay(QIN, "mibing", "luoyi"), ([x]) => x && total(x, QIN) > total(x, CHU));
  const won = E.apply(before, lobbyPlay(QIN, "mibing", "luoyi"));
  assert.equal(won.inf.luoyi[CHU], 0); assert.equal(won.pending, null, "enemy emptied");
  const st2 = stage({ lobby: "realign-own" }, QIN, { inf: { ...OPEN, xinzheng: [0, 4], yiyang: [0, 4], luoyi: [1, 5] }, card: "mibing" });
  const [, , before2] = find(st2, lobbyPlay(QIN, "mibing", "luoyi"), ([x]) => x && total(x, CHU) > total(x, QIN));
  const lost = E.apply(before2, lobbyPlay(QIN, "mibing", "luoyi"));
  assert.equal(lost.inf.luoyi[QIN], 0); assert.equal(lost.pending, null, "own emptied");
  const one = stage({ lobby: "realign-own" }, QIN, { inf: OPEN, card: "tiangou" });
  assert.equal(E.apply(one, lobbyPlay(QIN, "tiangou", "luoyi")).pending, null, "one op, one attempt: nothing to ask");
});

test("收手 only under realign-own: realign and realign-mild roll every attempt without asking", () => {
  for (const mode of ["realign", "realign-mild"]) {
    const st = stage({ lobby: mode }, QIN, { inf: OPEN, card: "mibing" });
    for (let i = 1; i < 60; i++) {
      const s = E.clone(st); s.rngState = (i * 2654435761) >>> 0;
      assert.equal(E.apply(s, lobbyPlay(QIN, "mibing", "luoyi")).pending, null, `${mode} rng ${i}`);
    }
  }
});

test("each attempt's entry names both sides' modifiers: controlled neighbours, more influence, home", () => {
  for (const mode of ["realign", "realign-mild", "realign-own"]) {
    const st = stage({ lobby: mode }, QIN, { inf: LUOYI, card: "tiangou" });
    const e = E.apply(st, lobbyPlay(QIN, "tiangou", "luoyi")).log.find((l) => l.type === "realign");
    assert.deepEqual(e.adj, [["hangu"], ["xinzheng"]], mode);
    assert.deepEqual(e.more, [false, true], mode);
    assert.deepEqual(e.home, [true, false], mode);
    for (const s of [QIN, CHU]) assert.equal(e.mod[s], e.adj[s].length + (e.more[s] ? 1 : 0) + (e.home[s] ? 1 : 0));
  }
});

// For the pick screen and the preview (owner's display B): the odds of ONE attempt as the board stands, from
// the engine, so the page never keeps its own copy of the rule. Luoyi (LUOYI): modifiers 2 : 2, so d = 0 and
// 1d6 − 1d6 decides: win 15/36, tie 6/36, lose 15/36. Net, by hand: the actor (Qin, 2 there) against Chu (3):
// a − b = 1…5 occurs 5, 4, 3, 2, 1 times; a win removes min(diff, 3) = 5·1 + 4·2 + 3·3 + 2·3 + 1·3 = 31, a loss
// costs min(diff, 2) = 5·1 + 4·2 + 3·2 + 2·2 + 1·2 = 25, so the expected net is (31 − 25) / 36 = 1/6.
test("realignOdds: one attempt's modifiers, win / tie / lose and expected net, as the board stands", () => {
  const st = stage({ lobby: "realign-own" }, QIN, { inf: LUOYI, card: "tiangou" });
  const o = E.realignOdds(st, QIN, "luoyi");
  assert.deepEqual(o.mod, [2, 2]);
  assert.deepEqual(o.why[QIN], { adj: ["hangu"], more: false, home: true });
  assert.deepEqual(o.why[CHU], { adj: ["xinzheng"], more: true, home: false });
  assert.ok(Math.abs(o.win - 15 / 36) < 1e-12 && Math.abs(o.tie - 6 / 36) < 1e-12 && Math.abs(o.lose - 15 / 36) < 1e-12);
  assert.ok(Math.abs(o.net - 6 / 36) < 1e-12, `net ${o.net}`);
  // Without a realign value there are no odds to show.
  assert.equal(E.realignOdds(stage({ lobby: undefined }, QIN, { inf: LUOYI, card: "tiangou" }), QIN, "luoyi"), null);
  // Mild caps the loss at 2 and rolls 1d3: modifiers 2 : 2, faces 1…3: win 3/9, tie 3/9, lose 3/9.
  const m = E.realignOdds(stage({ lobby: "realign-mild" }, QIN, { inf: LUOYI, card: "tiangou" }), QIN, "luoyi");
  assert.ok(Math.abs(m.win - 3 / 9) < 1e-12 && Math.abs(m.tie - 3 / 9) < 1e-12);
});
