// The room Durable Object over a fake context. Every socket records what it
// is sent, so these tests check what actually leaves the room: each seat its
// own view, never the other hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { Room } from "../src/room.js";

function fakeRoom({ level = "normal", humans = [0, 1] } = {}) {
  const sent = [];
  const sockets = humans.map((side) => ({
    token: `t${side}`, side,
    send(msg) { sent.push({ to: side, msg: JSON.parse(msg) }); },
    deserializeAttachment() { return { token: `t${side}` }; },
    close() {},
  }));
  const alarms = [];
  const ctx = {
    storage: { async get() { return null; }, async put() {}, async setAlarm(at) { alarms.push(at); }, async deleteAlarm() {}, async deleteAll() {} },
    getWebSockets(tag) { return tag ? sockets.filter((s) => s.token === tag) : sockets; },
  };
  const room = new Room(ctx, {});
  const seat = (side) => ({ idx: side, side, name: side === 0 ? "Qin player" : "Chu player", token: humans.includes(side) ? `t${side}` : `ai-${side}`, ready: true, ai: !humans.includes(side), lastSeen: Date.now() });
  room.room = {
    code: "TEST", phase: "lobby", seats: [seat(0), seat(1)], settings: { level, lang: "en" },
    state: null, rngState: 1, gen: 0, deadline: 0, clockKey: "", log: [], alarmAt: 0, idle: false, lastActive: Date.now(),
  };
  const bySide = (side) => sockets.find((s) => s.side === side);
  const views = (side) => sent.filter((m) => m.to === side && m.msg.type === "view").map((m) => m.msg);
  const last = (side) => views(side).at(-1);
  return { room, sockets, sent, alarms, bySide, views, last };
}
const act = (room, ws, action) => room.webSocketMessage(ws, JSON.stringify({ type: "act", action }));

test("room: the deal sends each seat its own view, with the other hand hidden and the draw pile a count", async () => {
  const { room, last } = fakeRoom();
  await room.startGame();
  assert.equal(room.room.phase, "game");
  const q = last(0), c = last(1);
  assert.equal(q.me, 0); assert.equal(c.me, 1);
  assert.equal(q.view.hands[1], null); assert.equal(c.view.hands[0], null);
  assert.ok(Array.isArray(q.view.hands[0]) && Array.isArray(c.view.hands[1]));
  assert.equal(q.view.draw, undefined); assert.equal(typeof q.view.drawCount, "number");
  assert.equal(q.view.rngState, undefined);
  assert.equal(q.view.pending.who, 0, "Qin places its free points first");
  assert.ok(q.deadline > Date.now(), "a clock is running");
});

test("room: a legal act applies and both seats get the new view; the wrong seat or a bad choice gets an error", async () => {
  const { room, bySide, last, sent } = fakeRoom();
  await room.startGame();
  await act(room, bySide(1), { type: "choose", choice: ["yiyang"] });
  assert.equal(sent.filter((m) => m.to === 1 && m.msg.type === "error").at(-1).msg.key, "notYourTurn");
  await act(room, bySide(0), { type: "choose", choice: ["linzi", "linzi", "linzi", "linzi"] });
  assert.match(sent.filter((m) => m.to === 0 && m.msg.type === "error").at(-1).msg.message, /not allowed/);
  await act(room, bySide(0), { type: "choose", choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  assert.equal(room.room.state.pending.who, 1);
  assert.equal(last(1).view.pending.who, 1);
  assert.deepEqual(E.infOf(room.room.state, "yiyang"), [2, 0]);
});

test("room: a bot seat moves when the alarm pumps, and a human who runs out of time is played by the table", async () => {
  const { room, bySide, alarms } = fakeRoom({ humans: [0] });
  await room.startGame();
  await act(room, bySide(0), { type: "choose", choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  assert.equal(room.room.state.pending.who, 1, "now the bot's setup");
  assert.ok(alarms.at(-1) <= Date.now() + 1000, "the bot is scheduled soon");
  for (let i = 0; i < 6 && room.room.state.phase === "setup"; i++) await room.pump();
  assert.equal(room.room.state.phase, "headline");
  // Qin (human) has not headlined; force the clock and pump: the bot seat
  // headlines first, then the table decides for Qin.
  room.room.deadline = Date.now() - 1;
  for (let i = 0; i < 3 && room.room.state.phase === "headline"; i++) { room.room.deadline = Date.now() - 1; await room.pump(); }
  assert.equal(room.room.state.phase, "action", "both headlines are in and resolved");
  const timeouts = room.room.log.filter((l) => l.sys && /ran out of time/.test(l.text));
  assert.equal(timeouts.length, 1);
});

test("room: when the engine declares a winner the room finishes and says who won", async () => {
  const { room, last } = fakeRoom();
  await room.startGame();
  E.win(room.room.state, 1, "alliance");
  await room.afterChange();
  assert.equal(room.room.phase, "over");
  assert.equal(last(0).view.winner, 1);
  assert.ok(room.room.log.some((l) => l.sys && /wins: four seals held/.test(l.text)));
});
