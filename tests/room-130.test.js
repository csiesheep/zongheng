// #130: 遊說 (lobby "realign-own", with 收手) in a multiplayer room -- the room Durable Object over the same
// fake context as tests/room.test.js. What the orchestrator asked for (#130, "does 遊說 work in rooms"):
//   1. the clock restarts after every roll: each 收手 decision gets a fresh CLOCK_MS.choose (45 s);
//   2. the decision is the ordinary st.pending of the actor: the other seat's answer is refused (notYourTurn);
//   3. a seat that never answers (out of time, or away past the grace) is answered by the table, and play goes
//      on; a reconnecting seat is sent a view at the decision;
//   4. the other seat and a spectator see each roll (both dice, both sides' modifiers) and the pending;
//   5. nothing sent predicts a roll: no rngState, no seed, nothing pre-rolled in the pending;
//   6. the same state and the same action give the same roll.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { Room } from "../src/room.js";

const { QIN, CHU } = E;
const CHOOSE_MS = 45_000, GRACE_MS = 20_000;
const OPTIONS = { lobby: "realign-own", homeFall: "lose-turn" };

function fakeRoom({ humans = [0, 1], spectator = false } = {}) {
  const sent = [];
  const sockets = humans.map((side) => ({
    token: `t${side}`, side,
    send(msg) { sent.push({ to: side, msg: JSON.parse(msg) }); },
    deserializeAttachment() { return { token: `t${side}` }; },
    close() {},
  }));
  if (spectator) sockets.push({ token: "spectator", side: "spec", send(msg) { sent.push({ to: "spec", msg: JSON.parse(msg) }); }, deserializeAttachment() { return { token: null }; }, close() {} });
  const alarms = [];
  const ctx = {
    storage: { async get() { return null; }, async put() {}, async setAlarm(at) { alarms.push(at); }, async deleteAlarm() {}, async deleteAll() {} },
    getWebSockets(tag) { return tag ? sockets.filter((s) => s.token === tag) : sockets; },
  };
  const room = new Room(ctx, {});
  const seat = (side) => ({ idx: side, side, name: side === 0 ? "Qin player" : "Chu player", token: humans.includes(side) ? `t${side}` : `ai-${side}`, ready: true, ai: !humans.includes(side), lastSeen: Date.now() });
  room.room = {
    code: "TEST", phase: "lobby", seats: [seat(0), seat(1)], settings: { level: "normal", lang: "en", options: OPTIONS },
    state: null, rngState: 1, gen: 0, deadline: 0, clockKey: "", log: [], alarmAt: 0, idle: false, lastActive: Date.now(),
  };
  const bySide = (side) => sockets.find((s) => s.side === side);
  const views = (to) => sent.filter((m) => m.to === to && m.msg.type === "view").map((m) => m.msg);
  const last = (to) => views(to).at(-1);
  const errors = (to) => sent.filter((m) => m.to === to && m.msg.type === "error").map((m) => m.msg);
  return { room, sockets, sent, alarms, bySide, last, errors };
}
const act = (room, ws, action) => room.webSocketMessage(ws, JSON.stringify({ type: "act", action }));

// A realign-own game at Qin's action round, rebuilt so that Qin can 遊說 洛邑 (3 : 3) with a 3-op card, and an
// RNG state for which the first attempt leaves both sides something there: a 收手 decision follows it.
function stagedState() {
  let st = null;
  for (let seed = 1; seed < 200 && !st; seed++) {
    const rng = E.makeRng(seed * 7919);
    let s = E.createGame(seed, OPTIONS);
    for (let k = 0; s.winner == null && k < 3000; k++) {
      if (s.phase === "action" && s.actor === QIN && !s.pending && s.turn === 2) { st = s; break; }
      const who = E.mustAct(s), x = who[rng.int(who.length)];
      s = E.apply(s, B.randomAction(s, x, rng));
    }
  }
  st = E.clone(st);
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) { const i = pile.indexOf("mibing"); if (i >= 0) pile.splice(i, 1); }
  st.hands[QIN].push("mibing"); st.effects = []; st.forced = [null, null]; st.log = [];
  Object.assign(st.inf, { luoyi: [3, 3], hangu: [6, 0], xinzheng: [0, 4], yiyang: [0, 0] });
  for (let i = 1; i < 400; i++) {
    const t = E.clone(st); t.rngState = (i * 2654435761) >>> 0;
    const a = E.apply(t, PLAY);
    if (a.pending && a.pending.tag === "realign") {
      const b = E.apply(a, { type: "choose", side: QIN, choice: "continue" });
      if (b.pending && b.pending.tag === "realign") return t; // two decisions in a row
    }
  }
  throw new Error("no RNG state with two 收手 decisions");
}
const PLAY = { type: "play", side: QIN, card: "mibing", use: "lobby", target: "luoyi" };
async function atDecision(opts) {
  const f = fakeRoom(opts);
  await f.room.startGame();
  f.room.room.state = stagedState();
  await f.room.afterChange();
  await act(f.room, f.bySide(QIN), PLAY);
  assert.equal(f.room.room.state.pending?.tag, "realign", "Qin is at a 收手 decision");
  return f;
}

test("room 收手: the clock restarts after every roll (a fresh 45 s for each decision)", async () => {
  const f = await atDecision();
  const t0 = Date.now();
  assert.ok(f.room.room.deadline >= t0 + CHOOSE_MS - 2000 && f.room.room.deadline <= Date.now() + CHOOSE_MS, "first decision: a fresh choose clock");
  // Most of that clock goes by while the player watches the dice: 2 s left.
  f.room.room.deadline = Date.now() + 2000;
  await act(f.room, f.bySide(QIN), { type: "choose", choice: "continue" });
  assert.equal(f.room.room.state.pending?.tag, "realign", "a second decision");
  assert.equal(f.room.room.state.pending.k, 2);
  assert.ok(f.room.room.deadline >= Date.now() + CHOOSE_MS - 2000, `the second decision has its own clock (deadline in ${f.room.room.deadline - Date.now()} ms)`);
  assert.ok(f.last(QIN).deadline >= Date.now() + CHOOSE_MS - 2000, "and the seats are sent that deadline");
});

test("room 收手: only the actor may answer; the other seat is refused with notYourTurn", async () => {
  const f = await atDecision();
  assert.deepEqual(E.mustAct(f.room.room.state), [QIN]);
  const before = JSON.stringify(f.room.room.state);
  await act(f.room, f.bySide(CHU), { type: "choose", choice: "stop" });
  assert.equal(f.errors(CHU).at(-1).key, "notYourTurn");
  assert.equal(JSON.stringify(f.room.room.state), before, "nothing moved");
});

test("room 收手: out of time, the table answers for the seat by the bot's rule and play goes on", async () => {
  const f = await atDecision();
  const seq = f.room.room.state.logSeq, k = f.room.room.state.pending.k;
  f.room.room.deadline = Date.now() - 1;
  await f.room.pump();
  const st = f.room.room.state;
  assert.ok(st.logSeq > seq || (st.pending && st.pending.k > k), "the decision was answered");
  assert.ok(f.room.room.log.some((l) => l.sys && /ran out of time/.test(l.text)), "the table says so");
  const expected = B.realignExpect(E.clone(stagedAfter(f)), QIN, "luoyi") > 0 ? "continue" : "stop";
  assert.ok(expected === "continue" ? st.log.filter((l) => l.type === "realign").length >= 2 : st.log.some((l) => l.type === "lobbyStop"), `answered ${expected}`);
});
// The state at the first decision, rebuilt (the same staging and the same play): what the table saw.
function stagedAfter() { return E.apply(stagedState(), PLAY); }

test("room 收手: a seat away past the grace period is answered by the table; a reconnect gets a view at the decision", async () => {
  const f = await atDecision();
  // Qin reconnecting now is sent a view of the decision, with its clock.
  const qinSeat = f.room.seatBySide(QIN);
  const msg = f.room.viewMsg(qinSeat);
  assert.equal(msg.view.pending.tag, "realign");
  assert.equal(msg.view.pending.who, QIN);
  assert.ok(msg.deadline > Date.now());
  // Qin's socket drops and stays away past the grace: the table answers at the next alarm.
  f.sockets.splice(f.sockets.findIndex((s) => s.side === QIN), 1);
  qinSeat.lastSeen = Date.now() - GRACE_MS - 1;
  const seq = f.room.room.state.logSeq;
  await f.room.pump();
  assert.ok(f.room.room.state.logSeq > seq, "the table answered for the absent seat");
});

test("room 收手: the other seat and a spectator see each roll, both sides' modifiers, and whose decision it is", async () => {
  const f = await atDecision({ spectator: true });
  for (const who of [CHU, "spec"]) {
    const v = f.last(who).view;
    const e = v.log.filter((l) => l.type === "realign");
    assert.equal(e.length, 1, `${who}: the first attempt`);
    assert.equal(e[0].roll.length, 2); assert.equal(e[0].mod.length, 2);
    assert.ok(Array.isArray(e[0].adj[QIN]) && Array.isArray(e[0].adj[CHU]) && e[0].more.length === 2 && e[0].home.length === 2);
    assert.equal(v.pending.tag, "realign"); assert.equal(v.pending.who, QIN);
  }
  await act(f.room, f.bySide(QIN), { type: "choose", choice: "continue" });
  assert.equal(f.last(CHU).view.log.filter((l) => l.type === "realign").length, 2, "the second roll reaches Chu too");
});

test("room 收手: nothing sent predicts a roll -- no rngState, no seed, nothing rolled ahead in the pending", async () => {
  const f = await atDecision({ spectator: true });
  const PENDING_KEYS = ["who", "kind", "options", "tag", "target", "k", "ops", "step"].sort();
  for (const who of [QIN, CHU, "spec"]) {
    const v = f.last(who).view;
    assert.equal(v.rngState, undefined, `${who}: rngState`);
    assert.equal(v.seed, undefined, `${who}: the seed (it rebuilds the RNG)`);
    assert.deepEqual(Object.keys(v.pending).sort(), PENDING_KEYS, `${who}: the pending holds only the decision`);
    const step = v.plan.find((p) => p.do === "realign");
    assert.ok(step, "the plan step is visible");
    assert.deepEqual(Object.keys(step).sort(), ["choices", "do", "head", "k", "ops", "side", "target"], "and holds no roll");
  }
});

test("room 收手: the same state and the same answer give the same roll", async () => {
  const a = await atDecision(), b = await atDecision();
  await act(a.room, a.bySide(QIN), { type: "choose", choice: "continue" });
  await act(b.room, b.bySide(QIN), { type: "choose", choice: "continue" });
  const ra = a.room.room.state.log.filter((l) => l.type === "realign").map((l) => l.roll);
  const rb = b.room.room.state.log.filter((l) => l.type === "realign").map((l) => l.roll);
  assert.deepEqual(ra, rb);
  assert.equal(ra.length, 2);
});
