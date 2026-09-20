// Guard for the room's bot loop (orchestrator-owned, #25; written by the BE peer as its
// red-then-green proof, adopted with two assertions changed).
//
// A bot whose action the engine refuses must not keep the room awake forever
// (#25). The fake Durable Object context is the one in room.test.js plus two
// counters the loop is measured with: every `setAlarm` and every `deleteAlarm`.
//
// The seam is `decideFor(side)`: the room's one call into the bot. Overriding
// it is how a bot that stably produces an illegal action for the same position
// is staged without touching bots.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room.js";

const PUMPS = 20;

function fakeRoom({ level = "normal", humans = [0, 1] } = {}) {
  const sent = [];
  const sockets = humans.map((side) => ({
    token: `t${side}`, side,
    send(msg) { sent.push({ to: side, msg: JSON.parse(msg) }); },
    deserializeAttachment() { return { token: `t${side}` }; },
    close() {},
  }));
  const alarms = [];
  const deletes = [];
  const ctx = {
    storage: {
      async get() { return null; }, async put() {},
      async setAlarm(at) { alarms.push(at); },
      async deleteAlarm() { deletes.push(Date.now()); },
      async deleteAll() {},
    },
    getWebSockets(tag) { return tag ? sockets.filter((s) => s.token === tag) : sockets; },
  };
  const room = new Room(ctx, {});
  const seat = (side) => ({ idx: side, side, name: side === 0 ? "Qin player" : "Chu player", token: humans.includes(side) ? `t${side}` : `ai-${side}`, ready: true, ai: !humans.includes(side), lastSeen: Date.now() });
  room.room = {
    code: "TEST", phase: "lobby", seats: [seat(0), seat(1)], settings: { level, lang: "en" },
    state: null, rngState: 1, gen: 0, deadline: 0, clockKey: "", log: [], alarmAt: 0, idle: false, lastActive: Date.now(),
  };
  const lines = (re) => room.room.log.filter((l) => l.sys && re.test(l.text)).map((l) => l.text);
  // Everything the engine's state is: if this string is unchanged, nothing on
  // the table moved.
  const signature = () => JSON.stringify(room.room.state);
  return { room, sockets, sent, alarms, deletes, lines, signature };
}

// An action the engine refuses in every phase: no such card, and during a
// pending a `play` is not an action round either.
const illegal = (side) => ({ type: "play", side, card: "no-such-card", use: "event" });

test("room #25: a bot whose action is always refused is retried 3 times, then the table plays a fallback", async () => {
  const t = fakeRoom({ humans: [] });
  await t.room.startGame();
  t.room.decideFor = (side) => illegal(side);
  const before = t.signature();
  const alarms0 = t.alarms.length;
  await t.room.pump(); await t.room.pump(); await t.room.pump();

  assert.equal(t.lines(/^bot error:/).length, 3, "three refusals are logged, then the retrying stops");
  assert.equal(t.lines(/^bot fallback:/).length, 1, "the third refusal plays a fallback in the same pump");
  assert.notEqual(t.signature(), before, "the fallback moved the table");
  assert.equal(t.alarms.length - alarms0, 3, "two 900ms retries and the reschedule after the fallback");

  // Over many pumps the room keeps advancing instead of hanging: at most one
  // fallback per position, and never a fourth `bot error` for the same one.
  for (let i = 0; i < PUMPS; i++) await t.room.pump();
  const errs = t.lines(/^bot error:/).length, fbs = t.lines(/^bot fallback:/).length;
  assert.ok(fbs >= 4, `the broken bot keeps being carried by fallbacks (got ${fbs})`);
  // Three refusals per position at most: every complete cycle ends in a
  // fallback, and the last cycle may be two refusals in.
  assert.ok(errs <= 3 * fbs + 2, `at most three refusals per fallback (got ${errs} for ${fbs})`);
});

test("room #25: when even the fallback is refused the room stops waking up and goes idle", async () => {
  const t = fakeRoom({ humans: [] });
  await t.room.startGame();
  t.room.decideFor = (side) => illegal(side);
  t.room.fallbackFor = () => null; // the engine accepts nothing at all
  const alarms0 = t.alarms.length;
  const before = t.signature();
  for (let i = 0; i < PUMPS; i++) await t.room.pump();

  assert.equal(t.lines(/^bot error:/).length, 3, "three refusals, then no more asking");
  assert.equal(t.lines(/^bot stuck:/).length, 1, "exactly one line says the room gave up");
  assert.equal(t.signature(), before, "no rule outcome: the table did not move");
  const scheduled = t.alarms.length - alarms0;
  assert.ok(scheduled <= 4, `${PUMPS} pumps schedule at most 4 alarms, not one each (got ${scheduled})`);
  const nine = t.alarms.slice(alarms0).filter((at) => at - Date.now() <= 1000 && at - Date.now() > 0).length;
  assert.ok(nine <= 2, `at most the two 900ms retries before giving up (got ${nine})`);
  // Nobody is connected: the object parks on the idle sweep instead of a 900ms
  // heartbeat, so the Durable Object can be evicted.
  assert.equal(t.room.room.idle, true, "the room is parked idle");
  assert.ok(t.alarms.at(-1) - Date.now() > 10 * 60_000, "the only alarm left is the idle sweep");
});

test("room #25: a bot that returns no action at all is capped the same way", async () => {
  const t = fakeRoom({ humans: [] });
  await t.room.startGame();
  t.room.decideFor = () => null;
  t.room.fallbackFor = () => null;
  const alarms0 = t.alarms.length;
  for (let i = 0; i < PUMPS; i++) await t.room.pump();
  assert.equal(t.lines(/^bot error:/).length, 3, "a silent null is logged like a refusal");
  assert.equal(t.lines(/^bot stuck:/).length, 1);
  assert.ok(t.alarms.length - alarms0 <= 4, `not one alarm per pump (got ${t.alarms.length - alarms0})`);
});

test("room #25: a human seat is not punished for the bot seat being stuck", async () => {
  const t = fakeRoom({ humans: [0] });
  await t.room.startGame();
  // Qin (human) places its free points; then it is the bot's setup choice.
  await t.room.webSocketMessage(t.sockets[0], JSON.stringify({ type: "act", action: { type: "choose", choice: ["yiyang", "yiyang", "hedong", "hedong"] } }));
  assert.equal(t.room.room.state.pending.who, 1, "the bot's setup");
  t.room.decideFor = (side) => illegal(side);
  t.room.fallbackFor = () => null;
  const alarms0 = t.alarms.length;
  for (let i = 0; i < PUMPS; i++) await t.room.pump();
  assert.equal(t.lines(/^bot stuck:/).length, 1);
  assert.ok(t.alarms.length - alarms0 <= 4, `not one alarm per pump (got ${t.alarms.length - alarms0})`);
  assert.equal(t.room.room.idle, false, "a human is connected, so the room does not delete itself");
  // Parked, not polling: whatever alarm is left is the clock the humans see (or none), never a 900 ms retry.
  const left = t.room.room.alarmAt;
  assert.ok(left === 0 || left === t.room.room.deadline, `the alarm left (${left}) is the deadline (${t.room.room.deadline}) or none`);
});

// Orchestrator's addition. The engine keeps only its last 400 log entries (engine.js, log()), so a key built on
// `log.length` stops changing in a long game and two different positions could share one refusal count, or one
// "stuck" mark. `logSeq` never stops.
test("room #25: the position key keeps changing when the engine's log is full", async () => {
  const t = fakeRoom({ humans: [] });
  await t.room.startGame();
  const st = t.room.room.state;
  const full = { ...st, log: Array.from({ length: 400 }, (_, i) => ({ i: i + 1, t: 1, r: 0, type: "pad" })), logSeq: 400 };
  // the next entry: the log stays at 400 entries, only the running number moves
  const next = { ...full, log: full.log.slice(1).concat([{ i: 401, t: 1, r: 0, type: "pad" }]), logSeq: 401 };
  assert.equal(full.log.length, next.log.length, "both logs are at the cap");
  assert.notEqual(t.room.failKey(0, full), t.room.failKey(0, next), "two positions that differ only by one logged event must not share a key");
  assert.equal(t.room.failKey(0, full), t.room.failKey(0, { ...full }), "the same position gives the same key");
});
