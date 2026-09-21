// Guard for the audio cue map (orchestrator-owned, #62). public/audio-cues.js decides WHAT sounds, without a DOM:
// which piece of music belongs to which screen and seat, which sound a log entry makes, when the warning drum plays.
// The API was fixed in the issue before any code existed; this file is that contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as E from "../public/shared/engine.js";
import { fallbackFor } from "../public/shared/fallback.js";
import * as A from "../public/audio-cues.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../public/audio/manifest.json", import.meta.url), "utf8"));
const has = (cue) => Object.prototype.hasOwnProperty.call(manifest.cues, cue);

// ---------- part 1: the music ----------
test("every screen has its piece, and the table's piece follows the era and the seat", () => {
  assert.equal(A.sceneFor({ page: "landing" }), "bgm.landing");
  assert.equal(A.sceneFor({ page: "rules" }), null);
  for (const era of ["reform", "alliance", "conquest"]) {
    assert.equal(A.sceneFor({ page: "table", era, me: 0 }), `bgm.table.${era}.qin`);
    assert.equal(A.sceneFor({ page: "table", era, me: 1 }), `bgm.table.${era}.chu`);
    assert.equal(A.sceneFor({ page: "table", era, me: null }), `bgm.table.${era}.qin`, "a spectator hears the Qin version");
  }
  assert.equal(A.sceneFor({ page: "setup" }), "bgm.setup");
  assert.equal(A.sceneFor({ page: "lobby" }), "bgm.setup");
  assert.equal(A.sceneFor({ page: "table", era: "reform", me: 1, tutorial: true }), "bgm.tutorial");
});

test("the ending: the winner and a spectator hear the winner's piece, the loser hears their own defeat", () => {
  assert.equal(A.sceneFor({ page: "over", me: 0, winner: 0 }), "bgm.win.qin");
  assert.equal(A.sceneFor({ page: "over", me: 1, winner: 1 }), "bgm.win.chu");
  assert.equal(A.sceneFor({ page: "over", me: 0, winner: 1 }), "bgm.lose.qin");
  assert.equal(A.sceneFor({ page: "over", me: 1, winner: 0 }), "bgm.lose.chu");
  assert.equal(A.sceneFor({ page: "over", me: null, winner: 0 }), "bgm.win.qin");
  assert.equal(A.sceneFor({ page: "over", me: null, winner: 1 }), "bgm.win.chu");
});

test("every cue the map can ask for is in the manifest, except the two pieces that are not made yet", () => {
  assert.deepEqual([...A.missingCues(manifest)].sort(), ["bgm.setup", "bgm.tutorial"]);
  // and the manifest is not lying about itself
  for (const [cue, m] of Object.entries(manifest.cues)) {
    assert.ok(fs.existsSync(new URL("../public/audio/" + m.file, import.meta.url)), `${cue}: ${m.file} is not in public/audio`);
    assert.equal(m.kind, cue.startsWith("bgm.") ? "bgm" : "sfx", `${cue}: wrong kind`);
  }
});

// ---------- part 2: the sounds (skipped until the three functions exist) ----------
const part2 = typeof A.cuesForLog === "function" && typeof A.controlCues === "function" && typeof A.dangerFlags === "function";

test("a log entry makes the sound the issue says it makes", { skip: !part2 }, () => {
  const qinCard = Object.keys(E.CARD).find((c) => E.CARD[c].side === E.QIN && !E.CARD[c].scoring);
  const chuCard = Object.keys(E.CARD).find((c) => E.CARD[c].side === E.CHU && !E.CARD[c].scoring);
  const neutral = Object.keys(E.CARD).find((c) => E.CARD[c].side == null && !E.CARD[c].scoring);
  const scoring = Object.keys(E.CARD).find((c) => E.CARD[c].scoring);
  const one = (entry, me = 0) => A.cuesForLog([entry], { me });
  assert.deepEqual(one({ type: "headline", cards: [qinCard, chuCard], first: 0 }), ["sfx.card.reveal"]);
  assert.deepEqual(one({ type: "play", side: 0, card: qinCard, use: "event" }), ["sfx.card.event.qin"]);
  assert.deepEqual(one({ type: "play", side: 0, card: chuCard, use: "event" }), ["sfx.card.event.chu"], "the sound follows the CARD's side, not the player's");
  assert.deepEqual(one({ type: "play", side: 1, card: neutral, use: "event" }), ["sfx.card.event.neutral"]);
  assert.deepEqual(one({ type: "play", side: 1, card: scoring, use: "event" }), ["sfx.card.event.neutral"]);
  assert.deepEqual(one({ type: "play", side: 0, card: qinCard, use: "place" }), []);
  assert.deepEqual(one({ type: "place", side: 1, points: ["hangu"], spent: 1 }, 0), ["sfx.map.opponent"]);
  assert.deepEqual(one({ type: "place", side: 0, points: ["hangu"], spent: 1 }, 0), [], "my own placement already sounded under my finger");
  assert.deepEqual(one({ type: "place", side: 0, points: ["hangu"], spent: 1 }, null), ["sfx.map.opponent"], "a spectator hears both sides' moves");
  assert.deepEqual(one({ type: "lobby", side: 1, target: "hangu", ops: 2, removed: 1 }, 0), ["sfx.map.opponent"]);
  assert.deepEqual(one({ type: "campaign", side: 0, target: "hangu", ops: 2, removed: 1, placed: 0 }, 0), ["sfx.map.campaign"]);
  assert.deepEqual(one({ type: "campaign", side: 1, target: "hangu", ops: 2, removed: 1, placed: 0 }, 0), ["sfx.map.campaign"]);
  assert.deepEqual(one({ type: "vp", side: 0, n: 2, mandate: 3 }), ["sfx.track.mandate.qin"]);
  assert.deepEqual(one({ type: "vp", side: 1, n: 2, mandate: -1 }), ["sfx.track.mandate.chu"]);
  assert.deepEqual(one({ type: "seal", state: "han" }), ["sfx.seal.gain"]);
  assert.deepEqual(one({ type: "unseal", state: "han" }), ["sfx.seal.lose"]);
  assert.deepEqual(one({ type: "mie", state: "han" }), ["sfx.mie"]);
  assert.deepEqual(one({ type: "turn", turn: 2, era: "reform" }), ["sfx.turn.new"]);
  assert.deepEqual(one({ type: "era", era: "alliance" }), ["sfx.turn.era"]);
  assert.deepEqual(one({ type: "over", winner: 0, reason: "mandate" }, 0), ["sfx.end.win.qin"]);
  assert.deepEqual(one({ type: "over", winner: 0, reason: "mandate" }, 1), ["sfx.end.lose.chu"]);
  assert.deepEqual(one({ type: "over", winner: 1, reason: "alliance" }, null), ["sfx.end.win.chu"]);
  for (const type of ["setup", "skip", "reshuffle", "endTurn", "discard", "bog", "tire", "reform", "restore", "jiuding", "opsLost", "score", "something-new"]) assert.deepEqual(one({ type, side: 0 }), [], `${type} should be silent for now`);
});

test("a big batch keeps the four most important sounds in order, and a repeated sound once", { skip: !part2 }, () => {
  const c = Object.keys(E.CARD).find((k) => E.CARD[k].side === E.QIN && !E.CARD[k].scoring);
  const batch = [{ type: "play", side: 1, card: c, use: "event" }, { type: "place", side: 1, points: ["hangu"], spent: 1 }, { type: "campaign", side: 1, target: "hangu", ops: 2, removed: 1, placed: 0 },
    { type: "vp", side: 1, n: 1, mandate: -1 }, { type: "seal", state: "han" }, { type: "mie", state: "wei" }, { type: "turn", turn: 5, era: "alliance" }];
  const out = A.cuesForLog(batch, { me: 0 });
  assert.equal(out.length, 4);
  assert.deepEqual(out, ["sfx.track.mandate.chu", "sfx.seal.gain", "sfx.mie", "sfx.turn.new"], "the four kept are the Mandate, the seal, the destroyed state and the new turn, in the order they happened");
  const twice = A.cuesForLog([{ type: "vp", side: 0, n: 1, mandate: 1 }, { type: "vp", side: 0, n: 1, mandate: 2 }], { me: 0 });
  assert.deepEqual(twice, ["sfx.track.mandate.qin"]);
});

test("every sound the map can return is in the manifest: a whole game on fallbacks, heard from each seat", { skip: !part2 }, () => {
  for (const me of [0, 1, null]) {
    let st = E.createGame(11), seen = 0, heard = new Set();
    while (st.winner == null) {
      const side = E.mustAct(st)[0]; const fb = fallbackFor(st, side); assert.ok(fb);
      const last = st.log.length ? st.log[st.log.length - 1].i : -1;
      const fresh = fb.state.log.filter((l) => l.i > last);
      for (const cue of A.cuesForLog(fresh, { me })) { heard.add(cue); assert.ok(has(cue), `${cue} is not in the manifest`); }
      for (const cue of A.controlCues(st, fb.state, me)) { heard.add(cue); assert.ok(has(cue), `${cue} is not in the manifest`); }
      st = fb.state; seen++;
    }
    assert.ok(heard.size >= 6, `seat ${me}: only ${[...heard].join(", ")} in a whole game`);
    if (me == null) assert.ok(![...heard].some((c) => c.startsWith("sfx.map.control.")), "a spectator controls nothing");
  }
});

test("control: gaining and losing a space, each at most once per change", { skip: !part2 }, () => {
  let found = { gain: false, lose: false };
  for (let seed = 1; seed <= 12 && !(found.gain && found.lose); seed++) {
    let st = E.createGame(seed);
    while (st.winner == null) {
      const fb = fallbackFor(st, E.mustAct(st)[0]); if (!fb) break;
      for (const me of [0, 1]) {
        const cues = A.controlCues(st, fb.state, me);
        assert.ok(cues.length <= 2 && new Set(cues).size === cues.length, `a cue twice in one call: ${cues.join(", ")}`);
        for (const c of cues) assert.ok(c === "sfx.map.control.gain" || c === "sfx.map.control.lose", c);
        if (cues.includes("sfx.map.control.gain")) found.gain = true;
        if (cues.includes("sfx.map.control.lose")) found.lose = true;
      }
      assert.deepEqual(A.controlCues(st, st, 0), [], "nothing changed, nothing sounds");
      st = fb.state;
    }
  }
  assert.ok(found.gain && found.lose, "twelve games never gained or never lost a space: this test proves nothing");
});

test("danger flags: each condition alone, and none at the start of a game", { skip: !part2 }, () => {
  const st = E.createGame(3);
  assert.deepEqual(A.dangerFlags(st), []);
  const w = (patch) => A.dangerFlags({ ...JSON.parse(JSON.stringify(st)), ...patch });
  const states = Object.keys(E.STATES);
  assert.deepEqual(w({ seals: Object.fromEntries(states.slice(0, st.options.seals - 1).map((s) => [s, true])) }), ["seals"]);
  assert.deepEqual(w({ seals: Object.fromEntries(states.slice(0, st.options.seals - 2).map((s) => [s, true])) }), []);
  assert.deepEqual(w({ mie: Object.fromEntries(states.slice(0, st.options.mie - 1).map((s) => [s, true])) }), ["mie"]);
  assert.deepEqual(w({ mandate: 15 }), ["mandateQin"]);
  assert.deepEqual(w({ mandate: 14 }), []);
  assert.deepEqual(w({ mandate: -15 }), ["mandateChu"]);
  assert.deepEqual(w({ weariness: 2 }), ["weariness"]);
  assert.deepEqual(w({ weariness: 3 }), []);
  assert.deepEqual(w({ turn: st.options.turns }), ["lastTurn"]);
  assert.deepEqual(w({ mandate: -16, weariness: 2, turn: st.options.turns }), ["lastTurn", "mandateChu", "weariness"], "sorted");
});
