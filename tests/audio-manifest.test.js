// Guard for the audio assets (orchestrator-owned, #61). The client trusts public/audio/manifest.json blindly:
// a cue whose file is missing is silence in the game and nobody hears a missing sound in review.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dir = new URL("../public/audio/", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", dir), "utf8"));
const prompts = JSON.parse(fs.readFileSync(new URL("prompts.json", dir), "utf8"));
const cues = Object.entries(manifest.cues);
const LOOPS = ["bgm.landing", "bgm.setup", "bgm.tension", "bgm.tutorial", "bgm.table.reform.qin", "bgm.table.reform.chu", "bgm.table.alliance.qin", "bgm.table.alliance.chu", "bgm.table.conquest.qin", "bgm.table.conquest.chu"];

test("the manifest and the folder agree: every cue has its file, every file has its cue", () => {
  assert.equal(manifest.version, 1);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp3")).sort();
  assert.deepEqual(cues.map(([, m]) => m.file).sort(), files);
  for (const [cue, m] of cues) assert.equal(m.file, cue + ".mp3", `${cue}: the file is named after the cue`);
});

test("every entry has the shape the client reads", () => {
  for (const [cue, m] of cues) {
    assert.deepEqual(Object.keys(m).sort(), ["file", "gain", "kind", "loop", "seconds", "source"], cue);
    assert.match(cue, /^(sfx|bgm)\.[a-z]+(\.[a-zA-Z]+)*$/, cue);
    assert.equal(m.kind, cue.startsWith("bgm.") ? "bgm" : "sfx", `${cue}: kind`);
    assert.equal(m.loop, LOOPS.includes(cue), `${cue}: loop`);
    assert.ok(typeof m.gain === "number" && m.gain > 0 && m.gain <= 2, `${cue}: gain ${m.gain}`);
    assert.ok(typeof m.seconds === "number" && m.seconds > 0, `${cue}: seconds`);
    // a sound is a moment, a piece of music is not: a swapped file would show here
    if (m.kind === "sfx") assert.ok(m.seconds >= 0.1 && m.seconds <= 6, `${cue}: a sound of ${m.seconds} s`);
    else assert.ok(m.seconds >= 25 && m.seconds <= 200, `${cue}: a piece of ${m.seconds} s`);
    assert.ok(prompts[cue] && prompts[cue].source === m.source, `${cue}: prompts.json does not record this take`);
  }
});

test("sizes: nothing the phone has to download is large by accident", () => {
  let total = 0;
  for (const [cue, m] of cues) {
    const bytes = fs.statSync(new URL(m.file, dir)).size; total += bytes;
    // the bitrate that the size implies: a sound at 96 to 160 kb/s, music near 128 kb/s (a 32 kb/s build was handed in once)
    const kbps = (bytes * 8) / 1000 / m.seconds;
    if (m.kind === "bgm") assert.ok(kbps > 110 && kbps < 140, `${cue}: ${Math.round(kbps)} kb/s`);
    else assert.ok(bytes < 80_000, `${cue}: ${bytes} bytes for a sound`);
    assert.ok(bytes < 3_000_000, `${cue}: ${bytes} bytes`);
  }
  assert.ok(total < 25_000_000, `public/audio is ${total} bytes`);
});

test("the first-priority cues are all there", () => {
  const need = ["sfx.ui.tap", "sfx.ui.error", "sfx.card.pick", "sfx.card.commit", "sfx.card.reveal", "sfx.card.event.qin", "sfx.card.event.chu", "sfx.card.event.neutral", "sfx.map.place", "sfx.map.confirm",
    "sfx.map.control.gain", "sfx.map.control.lose", "sfx.map.campaign", "sfx.map.opponent", "sfx.track.mandate.qin", "sfx.track.mandate.chu", "sfx.seal.gain", "sfx.seal.lose", "sfx.mie", "sfx.warn", "sfx.turn.new",
    "sfx.turn.era", "sfx.turn.yours", "sfx.turn.clock.tick", "sfx.turn.clock.last", "sfx.end.win.qin", "sfx.end.win.chu", "sfx.end.lose.qin", "sfx.end.lose.chu",
    "bgm.landing", "bgm.table.reform.qin", "bgm.table.reform.chu", "bgm.table.alliance.qin", "bgm.table.alliance.chu", "bgm.table.conquest.qin", "bgm.table.conquest.chu", "bgm.win.qin", "bgm.win.chu", "bgm.lose.qin", "bgm.lose.chu"];
  for (const cue of need) assert.ok(manifest.cues[cue], `${cue} is missing from the manifest`);
});
