// One Durable Object per room, named by its four-letter code. It is the
// authority on the game: it deals, applies every action through the engine,
// runs the bot seat (and any human who is away), keeps the clocks, and sends
// each socket only `view(state, side)`, never the state. The other hand and
// the draw pile are the secrets.
//
// Connections use the WebSocket Hibernation API, so an idle room costs
// nothing between messages. Everything needed to resume is in storage under
// "room"; all timers are the object's single alarm.
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import en from "../public/i18n/en.js";
import zh from "../public/i18n/zh-Hant.js";

const LANGS = { en, "zh-Hant": zh };
// Clocks per kind of decision; when time runs out the table decides for
// whoever has not acted, the way the bot would.
const CLOCK_MS = { headline: 60_000, action: 90_000, choose: 45_000 };
const BOT_MS = 900;          // pause before a bot moves so the table reads as a sequence
const GRACE_MS = 20_000;     // a disconnected human's decisions go to the bot after this
const IDLE_MS = 30 * 60_000; // a room nobody is connected to is deleted after this
const MAX_SEATS = E.MAX_PLAYERS;
const LOG_KEEP = 120, CHAT_MAX = 200;

const clean = (s) => String(s ?? "").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16);
const newToken = () => crypto.randomUUID().replace(/-/g, "");

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = undefined; // undefined = not loaded yet, null = no room here
  }

  // ---------- persistence ----------
  async load() {
    if (this.room === undefined) this.room = (await this.ctx.storage.get("room")) || null;
    return this.room;
  }
  async save() { if (this.room) await this.ctx.storage.put("room", this.room); }
  withRng(fn) {
    const rng = E.makeRng(0);
    rng.setState(this.room.rngState);
    const out = fn(rng);
    this.room.rngState = rng.getState();
    return out;
  }
  get S() { return LANGS[this.room.settings.lang] || en; }
  t(key, p = {}) {
    const v = key.split(".").reduce((o, k) => (o ? o[k] : undefined), this.S);
    return String(v ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? ""));
  }
  seatBySide(side) { return this.room.seats.find((s) => s.side === side) || null; }

  // ---------- sockets ----------
  sockets(tag) { return this.ctx.getWebSockets(tag); }
  connected(seat) { return !seat.ai && this.sockets(seat.token).length > 0; }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  broadcast(msg) {
    const json = JSON.stringify(msg);
    for (const ws of this.sockets()) { try { ws.send(json); } catch {} }
  }
  seatOf(ws) {
    const att = ws.deserializeAttachment();
    return att?.token ? this.room.seats.find((s) => s.token === att.token) || null : null;
  }
  lobbyMsg() {
    const r = this.room;
    return {
      type: "lobby", code: r.code, phase: r.phase, settings: r.settings,
      seats: r.seats.map((s) => ({ idx: s.idx, side: s.side, name: s.name, ready: s.ready, connected: s.ai || this.connected(s), ai: s.ai })),
    };
  }
  pushLobby() { this.broadcast(this.lobbyMsg()); }
  names() { return Object.fromEntries(this.room.seats.map((s) => [E.SIDES[s.side], s.name])); }
  viewMsg(seat) {
    const r = this.room;
    return { type: "view", view: E.view(r.state, seat ? seat.side : null), me: seat ? seat.side : null, names: this.names(), deadline: r.deadline, gen: r.gen };
  }
  pushViews() {
    this.room.lastActive = Date.now();
    for (const ws of this.sockets()) this.send(ws, this.viewMsg(this.seatOf(ws)));
  }
  say(seat, text, hot = false) {
    const entry = { seat, text, hot, sys: seat === null };
    this.room.log.push(entry);
    if (this.room.log.length > LOG_KEEP) this.room.log.splice(0, this.room.log.length - LOG_KEEP);
    this.broadcast({ type: "say", ...entry });
  }

  // ---------- the one alarm ----------
  async scheduleAt(at) { this.room.alarmAt = at; await this.ctx.storage.setAlarm(at); }
  async clearAlarm() { this.room.alarmAt = 0; await this.ctx.storage.deleteAlarm(); }
  async maybeIdle() {
    const r = this.room;
    if (this.sockets().length === 0 && (r.phase !== "game" || !r.state || r.state.winner != null)) {
      r.idle = true;
      await this.scheduleAt(Date.now() + IDLE_MS);
    }
  }
  async alarm() {
    const room = await this.load();
    if (!room) return;
    if (room.idle) {
      if (this.sockets().length === 0) { await this.ctx.storage.deleteAll(); this.room = null; return; }
      room.idle = false;
    }
    await this.pump();
    await this.save();
  }

  // ---------- HTTP entry: status probe or WebSocket upgrade ----------
  async fetch(request) {
    const url = new URL(request.url);
    const room = await this.load();
    if (url.pathname.endsWith("/status")) return Response.json({ exists: !!room });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });

    const code = url.searchParams.get("room");
    const name = clean(url.searchParams.get("name"));
    const tok = url.searchParams.get("token");
    const create = url.searchParams.get("create") === "1";
    const lang = LANGS[url.searchParams.get("lang")] ? url.searchParams.get("lang") : "en";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const reject = (key) => {
      server.accept();
      this.send(server, { type: "error", key, fatal: true });
      server.close(1008, "rejected");
      return new Response(null, { status: 101, webSocket: client });
    };

    let seat = null;
    if (!room) {
      if (!create) return reject("noRoom");
      this.room = {
        code, phase: "lobby", seats: [], settings: { level: "normal", lang },
        state: null, rngState: E.randomSeed(), gen: 0, deadline: 0, clockKey: "",
        log: [], alarmAt: 0, idle: false, lastActive: Date.now(),
      };
      seat = this.addSeat(name || this.t("setup.defaultName"), E.QIN);
    } else if (tok && (seat = room.seats.find((s) => s.token === tok && !s.ai))) {
      for (const old of this.sockets(tok)) { try { old.close(1000, "replaced"); } catch {} }
    } else if (room.phase !== "lobby") {
      seat = null; // spectator
    } else if (room.seats.filter((s) => !s.ai).length >= MAX_SEATS) {
      return reject("full");
    } else {
      // A joining human takes the bot's seat if one was added.
      const bot = room.seats.find((s) => s.ai);
      if (bot) room.seats.splice(room.seats.indexOf(bot), 1);
      seat = this.addSeat(name || this.t("setup.defaultName"), room.seats[0].side === E.QIN ? E.CHU : E.QIN);
      this.say(null, this.t("sys.joined", { name: seat.name }));
    }

    this.ctx.acceptWebSocket(server, [seat ? seat.token : "spectator"]);
    server.serializeAttachment({ token: seat ? seat.token : null });
    if (this.room.idle) { this.room.idle = false; await this.clearAlarm(); }

    this.send(server, { type: "joined", code: this.room.code, seat: seat ? seat.idx : -1, side: seat ? seat.side : null, token: seat ? seat.token : null });
    this.pushLobby();
    this.send(server, { type: "log", entries: this.room.log });
    if (this.room.state) this.send(server, this.viewMsg(seat));
    if (seat && this.room.phase === "game") await this.afterChange();
    await this.save();
    return new Response(null, { status: 101, webSocket: client });
  }

  addSeat(name, side) {
    const r = this.room;
    const taken = new Set(r.seats.map((s) => s.name));
    let n = name;
    for (let i = 2; taken.has(n); i++) n = `${name} ${i}`;
    const seat = { idx: r.seats.length, side, name: n, token: newToken(), ready: false, ai: false, lastSeen: Date.now() };
    r.seats.push(seat);
    this.reindex();
    return seat;
  }
  addBot() {
    const r = this.room;
    const side = r.seats[0].side === E.QIN ? E.CHU : E.QIN;
    const pool = this.withRng((rng) => E.shuffle(rng, this.S.names[E.SIDES[side]]));
    r.seats.push({ idx: r.seats.length, side, name: pool[0] || "Bot", token: `ai-${newToken()}`, ready: true, ai: true, lastSeen: 0 });
    this.reindex();
  }
  reindex() { this.room.seats.forEach((s, i) => { s.idx = i; }); }

  // ---------- messages ----------
  async webSocketMessage(ws, raw) {
    const room = await this.load();
    if (!room) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const seat = this.seatOf(ws);
    const isHost = seat && seat.idx === 0;
    room.lastActive = Date.now();
    if (seat) seat.lastSeen = Date.now();
    switch (m.type) {
      case "ready":
        if (!seat || room.phase !== "lobby") return;
        seat.ready = !!m.ready; this.pushLobby(); break;
      case "settings":
        if (!isHost || room.phase !== "lobby") return;
        if (B.LEVELS.includes(m.level)) room.settings.level = m.level;
        this.pushLobby(); break;
      case "swap":
        // The host swaps sides; the other seat, human or bot, takes the rest.
        if (!isHost || room.phase !== "lobby") return;
        for (const s of room.seats) s.side = s.side === E.QIN ? E.CHU : E.QIN;
        this.pushLobby(); break;
      case "addBot":
        if (!isHost || room.phase !== "lobby" || room.seats.length >= MAX_SEATS) return;
        this.addBot(); this.pushLobby(); break;
      case "removeBot": {
        if (!isHost || room.phase !== "lobby") return;
        const i = room.seats.findIndex((s) => s.ai);
        if (i < 0) return;
        room.seats.splice(i, 1); this.reindex(); this.pushLobby(); break;
      }
      case "start":
        if (!isHost || room.phase !== "lobby") return;
        if (room.seats.length < MAX_SEATS) return this.send(ws, { type: "error", key: "needMore" });
        if (room.seats.slice(1).some((s) => !s.ai && !s.ready)) return this.send(ws, { type: "error", key: "notReady" });
        await this.startGame(); break;
      case "act": {
        if (!seat || room.phase !== "game" || !m.action || !room.state || room.state.winner != null) return;
        if (!E.mustAct(room.state).includes(seat.side)) return this.send(ws, { type: "error", key: "notYourTurn" });
        const action = { ...m.action, side: seat.side };
        try { room.state = E.apply(room.state, action); } catch (err) { return this.send(ws, { type: "error", message: err.message }); }
        await this.afterChange(); break;
      }
      case "chat": {
        if (!seat) return;
        const text = String(m.text ?? "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
        if (!text) return;
        this.say(seat.idx, text); break;
      }
      case "rematch":
        if (!isHost || room.phase !== "over") return;
        await this.clearAlarm();
        for (const s of room.seats) { s.side = s.side === E.QIN ? E.CHU : E.QIN; s.ready = s.ai; }
        room.phase = "lobby"; room.state = null; room.deadline = 0; room.clockKey = "";
        this.pushLobby(); this.broadcast({ type: "view", view: null }); break;
      case "leave":
        await this.leave(seat);
        try { ws.close(1000, "left"); } catch {}
        break;
    }
    await this.save();
  }

  async leave(seat) {
    const room = this.room;
    if (!seat) return;
    if (room.phase === "lobby" || room.phase === "over") {
      room.seats = room.seats.filter((s) => s !== seat);
      this.reindex();
      if (room.phase === "over") { room.state = null; room.phase = "lobby"; for (const s of room.seats) s.ready = s.ai; }
      if (!room.seats.some((s) => !s.ai)) { await this.clearAlarm(); await this.ctx.storage.deleteAll(); this.room = null; return; }
      this.say(null, this.t("sys.left", { name: seat.name }));
      this.pushLobby();
    } else {
      // Mid-game the seat becomes a bot so the table keeps moving.
      seat.ai = true;
      this.say(null, this.t("sys.leftGame", { name: seat.name }));
      this.pushLobby();
      await this.afterChange();
    }
  }

  async webSocketClose(ws) {
    const room = await this.load();
    if (!room) return;
    const seat = this.seatOf(ws);
    const others = this.sockets().filter((s) => s !== ws);
    if (seat && !others.some((s) => s.deserializeAttachment()?.token === seat.token)) {
      seat.lastSeen = Date.now();
      this.pushLobby(); // shows the seat as away
      if (room.phase === "game") await this.afterChange();
    }
    if (others.length === 0) await this.maybeIdle();
    await this.save();
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }

  // ---------- game flow ----------
  async startGame() {
    const room = this.room;
    room.state = E.createGame(E.randomSeed(), room.settings.options || {});
    room.phase = "game"; room.gen++; room.deadline = 0; room.clockKey = ""; room.log = [];
    for (const s of room.seats) s.ready = false;
    this.pushLobby();
    this.broadcast({ type: "log", entries: [] });
    this.say(null, this.t("sys.dealt"));
    await this.afterChange();
  }

  // Which of the sides that must act are decided by the bot policy right now:
  // bot seats, and humans away longer than the grace period.
  botSides(need) {
    const now = Date.now();
    return need.filter((side) => { const s = this.seatBySide(side); return !s || s.ai || (!this.connected(s) && now - s.lastSeen > GRACE_MS); });
  }
  decideFor(side) {
    const room = this.room;
    return this.withRng((rng) => B.decide(E.view(room.state, side), side, room.settings.level, rng));
  }
  clockKind(st) { return st.pending ? "choose" : st.phase === "headline" ? "headline" : "action"; }

  // After any change: keep the clock, push views, schedule whatever is next.
  async afterChange() {
    const room = this.room, st = room.state;
    if (!st) return;
    if (st.winner != null) { await this.finish(); return; }
    const now = Date.now();
    const need = E.mustAct(st);
    // The clock restarts whenever the decision on the table changes.
    const key = `${st.turn}:${st.phase}:${st.round}:${st.actor}:${st.pending ? st.pending.kind + st.pending.who : ""}:${st.headline.map((h) => (h ? 1 : 0)).join("")}`;
    if (key !== room.clockKey) { room.clockKey = key; room.deadline = now + CLOCK_MS[this.clockKind(st)]; }
    this.pushViews();
    const bots = this.botSides(need);
    await this.scheduleAt(bots.length ? Math.min(now + BOT_MS, room.deadline) : room.deadline);
  }

  // The alarm handler: let a bot act, or enforce the clock.
  async pump() {
    const room = this.room, st = room.state;
    if (room.phase !== "game" || !st || st.winner != null) return;
    const now = Date.now();
    const need = E.mustAct(st);
    if (!need.length) return;
    const bots = this.botSides(need);
    let side = null, timeout = false;
    if (bots.length) side = bots[0];
    else if (room.deadline && now >= room.deadline - 50) { side = need[0]; timeout = true; }
    if (side == null) { await this.scheduleAt(room.deadline); return; }
    const seat = this.seatBySide(side);
    if (timeout && seat) this.say(null, this.t("sys.timeout", { name: seat.name }));
    const action = this.decideFor(side);
    if (!action) { await this.scheduleAt(now + BOT_MS); return; }
    try { room.state = E.apply(room.state, action); } catch (err) {
      // A bot action the engine refuses is a bug; log it and try again shortly.
      this.say(null, `bot error: ${err.message}`, true);
      await this.scheduleAt(now + BOT_MS);
      return;
    }
    await this.afterChange();
  }

  async finish() {
    const room = this.room;
    await this.clearAlarm();
    room.phase = "over"; room.deadline = 0;
    const w = room.state.winner;
    this.say(null, this.t("sys.over", { side: this.t(`sides.${E.SIDES[w]}`), name: this.seatBySide(w)?.name ?? "", reason: this.t(`ends.${room.state.reason}`) }));
    this.pushLobby();
    this.pushViews();
    await this.maybeIdle();
  }
}
