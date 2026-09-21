// #62 part 1, piece B: the audio engine. Browser-only (uses window/document/
// Web Audio/<audio> elements) -- audio-cues.js stays the DOM-free half so it
// can be unit-tested; this file is the one that actually makes sound, and is
// exercised by hand (see the issue's "check yourself") plus window.__audio.
//
// Settings: localStorage zh.sfx / zh.music, "1"/"0", default ON when the key
// is absent -- same store helper shape app.js/landing.js already use, so a
// private window (localStorage throwing) degrades to "always on" rather than
// crashing.
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
let sfxOn = store.get("zh.sfx", "1") !== "0";
let musicOn = store.get("zh.music", "1") !== "0";

const SFX_BASE = 0.9;      // "one gain node for all sounds (0.9) times the manifest's gain"
const MUSIC_BASE = 0.55;   // "music level 0.55 times the manifest's gain"
const CROSSFADE_MS = 1200; // scene change
const LOOP_OVERLAP_S = 1.5; // "1.5s overlap of tail into head"
const RESTART_GUARD_MS = 40;
const BATCH_GAP_MS = 180;
const MUSIC_OFF_FADE_MS = 300;
// #62 part 2, item D: "warm the dozen most frequent ones" only makes sense
// PER PAGE -- the landing never plays a single table sound, so warming the
// table's twelve there fetched+decoded ~130 KB the visit never used. Each
// entry page sets its own list right after importing this module (before
// the first gesture can fire onUnlocked() -- see setWarmCues() below); this
// default is table.
let WARM_CUES = [
  "sfx.ui.tap", "sfx.map.place", "sfx.map.confirm", "sfx.card.pick", "sfx.card.commit",
  "sfx.card.reveal", "sfx.card.event.qin", "sfx.card.event.chu", "sfx.card.event.neutral",
  "sfx.map.opponent", "sfx.turn.new", "sfx.ui.error",
];
export function setWarmCues(cues) { WARM_CUES = cues; }

let ctx = null;
let sfxMaster = null, musicMaster = null;
let unlocked = false;
let manifest = null, manifestPromise = null;

// Two alternating <audio>+GainNode layers so a scene change and a loop's own
// tail/head overlap can both crossfade the same way (see startLayer below).
const layers = [null, null];
let activeLayerIdx = -1;
let activeScene = null;     // the cue actually driving the current layer, or null
let requestedScene = null;  // the last cue setScene() was asked for, even if it never played
let sceneGainMul = 1;

const bufferCache = new Map(); // cue -> AudioBuffer | "missing" | Promise<AudioBuffer|null>
const lastPlayedAt = new Map(); // cue -> performance.now() of its last play()
const playingSfx = new Set();   // cue ids audibly playing right now (debug only)
const recentCues = [];          // #62 part 2: last 30 sfx actually started, {cue, t, rate} (debug only)
const warned = new Set();
function warnOnce(key, msg) { if (warned.has(key)) return; warned.add(key); console.warn(msg); }

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  sfxMaster = ctx.createGain(); sfxMaster.gain.value = sfxOn ? SFX_BASE : 0; sfxMaster.connect(ctx.destination);
  musicMaster = ctx.createGain(); musicMaster.gain.value = 1; musicMaster.connect(ctx.destination);
  return ctx;
}

function ensureManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch("./audio/manifest.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((j) => (manifest = j && j.cues ? j : { cues: {} }))
    .catch((e) => { warnOnce("manifest", `[audio] manifest unavailable: ${e.message}`); return (manifest = { cues: {} }); });
  return manifestPromise;
}

// ---------- unlock ----------
// "Nothing sounds before the first user gesture… create or resume the
// AudioContext there, then start the current scene's music. Try to start at
// load as well… if the browser refuses, wait for the gesture without an
// error in the console." Both switches off must create no AudioContext at
// all (the issue's "must stay true"), so every entry point here is guarded
// by `sfxOn || musicOn`.
function attemptUnlock() {
  if (unlocked || (!sfxOn && !musicOn)) return;
  if (!ensureCtx()) return;
  ctx.resume().then(() => { if (ctx.state === "running") onUnlocked(); }).catch(() => {});
}
function onUnlocked() {
  if (unlocked) return;
  unlocked = true;
  if (musicOn && requestedScene) setScene(requestedScene, { gainMul: sceneGainMul });
  if (sfxOn) scheduleWarm();
}
function scheduleWarm() {
  const warm = () => ensureManifest().then((m) => { for (const cue of WARM_CUES) { const e = m.cues[cue]; if (e && e.kind === "sfx") getBuffer(cue, e); } });
  if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 500);
}
document.addEventListener("pointerdown", attemptUnlock);
document.addEventListener("keydown", attemptUnlock);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attemptUnlock, { once: true });
else attemptUnlock(); // "try to start at load as well"

document.addEventListener("visibilitychange", () => {
  const layer = layers[activeLayerIdx];
  if (!layer) return;
  if (document.hidden) layer.el.pause();
  else if (musicOn) layer.el.play().catch(() => {});
});

// ---------- music ----------
function targetGainFor(entry) { return MUSIC_BASE * (entry.gain ?? 1) * sceneGainMul; }
function rampGain(node, value, ms) {
  const now = ctx.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(value, now + ms / 1000);
}
function makeLayer(cue, entry) {
  const el = new Audio();
  el.src = `./audio/${entry.file}`;
  el.preload = "auto";
  let srcNode;
  try { srcNode = ctx.createMediaElementSource(el); } catch (e) { warnOnce("mediaSrc", `[audio] createMediaElementSource failed: ${e.message}`); return null; }
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  srcNode.connect(gainNode).connect(musicMaster);
  return { cue, el, gainNode, entry, overlapStarted: false };
}
function fadeLayerOut(layer, ms) {
  rampGain(layer.gainNode, 0, ms);
  setTimeout(() => { try { layer.el.pause(); } catch {} }, ms + 30);
}
function armLoopOverlap(layer) {
  if (!layer.entry.loop) return; // "loop: false pieces play once and stop"
  const dur = layer.entry.seconds || 0;
  if (!dur) return; // no known duration: can't schedule the overlap safely
  const fireAt = Math.max(0, dur - LOOP_OVERLAP_S);
  const onTick = () => {
    if (layers[activeLayerIdx] !== layer || layer.overlapStarted) return;
    if (layer.el.currentTime >= fireAt) { layer.overlapStarted = true; startLayer(layer.cue, layer.entry, LOOP_OVERLAP_S * 1000); }
  };
  layer.el.addEventListener("timeupdate", onTick);
}
async function startLayer(cue, entry, ms) {
  if (!ensureCtx()) return;
  const incoming = makeLayer(cue, entry);
  if (!incoming) return;
  const outgoing = activeLayerIdx >= 0 ? layers[activeLayerIdx] : null;
  const newIdx = activeLayerIdx === 0 ? 1 : 0;
  layers[newIdx] = incoming;
  activeLayerIdx = newIdx;
  activeScene = cue;
  try { await incoming.el.play(); } catch (e) { warnOnce(`play:${cue}`, `[audio] play() refused for ${cue}: ${e.message}`); }
  rampGain(incoming.gainNode, targetGainFor(entry), ms);
  if (outgoing) fadeLayerOut(outgoing, ms);
  armLoopOverlap(incoming);
}
function fadeOutActive(ms) {
  const layer = layers[activeLayerIdx];
  if (!layer) { activeScene = null; return; }
  fadeLayerOut(layer, ms);
  activeScene = null;
  activeLayerIdx = -1;
}

// #62 part 2, item B: a scene the manifest doesn't have falls back to a
// NAMED substitute, not to silence (the orchestrator's own measurement:
// landing straight to bgm.setup left `scene: null` on a fresh document,
// since "leave whatever's playing" has nothing to leave when nothing has
// played yet). Chained so a fallback that's ALSO missing keeps trying.
// bgm.setup has now landed (#63) so this table is likely to end up empty in
// practice, but it costs nothing to keep as the general rule.
const SCENE_FALLBACK = { "bgm.setup": "bgm.landing" };

// setScene(cue, { gainMul, fallbackCue, fallbackGainMul }): the ONE scene
// playing at a time. `gainMul` scales the music level for this scene only.
// `fallbackCue`/`fallbackGainMul` (#62 part 2, item E) are for a caller that
// has its OWN seat-or-context-dependent substitute in mind (the tutorial's
// reform-era piece at 0.6, while bgm.tutorial had no recording) -- tried
// only after `cue` itself and the static table above both come up empty,
// and resolved AFTER awaiting the manifest, never from a synchronous
// snapshot the caller might take before the first fetch has even landed
// (that race was the actual bug: bgm.tutorial existing or not was decided
// from a possibly-null cached manifest, so once it fell back once it could
// stay on the fallback even after the real file arrived). This function
// never reasons about pages/eras/tutorial itself (that's audio-cues.js's
// sceneFor()) -- it only ever chooses among cues it's actually been given.
export async function setScene(cue, { gainMul = 1, fallbackCue = null, fallbackGainMul = 1 } = {}) {
  requestedScene = cue;
  sceneGainMul = gainMul;
  if (!musicOn) return; // remembered in requestedScene; setSetting("music", true) starts it
  if (!cue) { fadeOutActive(CROSSFADE_MS); return; }
  const m = await ensureManifest();
  let resolved = cue, entry = m.cues[resolved], mul = gainMul;
  while ((!entry || entry.kind !== "bgm") && SCENE_FALLBACK[resolved]) { resolved = SCENE_FALLBACK[resolved]; entry = m.cues[resolved]; }
  if ((!entry || entry.kind !== "bgm") && fallbackCue) {
    const fe = m.cues[fallbackCue];
    if (fe && fe.kind === "bgm") { resolved = fallbackCue; entry = fe; mul = fallbackGainMul; }
  }
  if (!entry || entry.kind !== "bgm") { warnOnce(`scene:${cue}`, `[audio] missing bgm cue: ${cue} (no fallback either)`); return; } // truly nothing: leave whatever is already playing
  sceneGainMul = mul; // so a later same-cue refresh (below, or setSetting("music", true)) uses the multiplier that actually matches what's resolved
  if (resolved === activeScene && layers[activeLayerIdx]) { rampGain(layers[activeLayerIdx].gainNode, targetGainFor(entry), 150); return; }
  if (!unlocked) return; // onUnlocked() will call setScene(requestedScene) again
  await startLayer(resolved, entry, CROSSFADE_MS);
}

// ---------- sfx ----------
function getBuffer(cue, entry) {
  const cached = bufferCache.get(cue);
  if (cached === "missing") return Promise.resolve(null);
  if (cached instanceof Promise) return cached;
  if (cached) return Promise.resolve(cached);
  const p = fetch(`./audio/${entry.file}`, { cache: "force-cache" })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
    .then((buf) => ensureCtx().decodeAudioData(buf))
    .then((decoded) => { bufferCache.set(cue, decoded); return decoded; })
    .catch((e) => { bufferCache.set(cue, "missing"); warnOnce(`sfx:${cue}`, `[audio] sfx unavailable for ${cue}: ${e.message}`); return null; });
  bufferCache.set(cue, p);
  return p;
}
// play(cue, { rate }): a one-shot sound. Never throws -- a missing file, a
// failed decode or a refused start all just warn once and go silent for
// that cue (the issue's own rule).
export async function play(cue, { rate = 1 } = {}) {
  if (!sfxOn) return;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const last = lastPlayedAt.get(cue) || 0;
  if (now - last < RESTART_GUARD_MS) return; // "not restarted within 40 ms"
  lastPlayedAt.set(cue, now);
  const m = await ensureManifest();
  const entry = m.cues[cue];
  if (!entry || entry.kind !== "sfx") { warnOnce(`sfx-missing:${cue}`, `[audio] missing sfx cue: ${cue}`); return; }
  if (!sfxOn || !unlocked) return; // settings/unlock may have changed while awaiting the manifest
  const buf = await getBuffer(cue, entry);
  if (!buf || !sfxOn) return;
  if (!ensureCtx()) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = entry.gain ?? 1;
    src.connect(g).connect(sfxMaster);
    playingSfx.add(cue);
    src.onended = () => playingSfx.delete(cue);
    src.start();
    // #62 part 2: window.__audio.recent -- a rolling log of the sfx that
    // actually started (past every guard above: on, not within the 40ms
    // restart window, in the manifest, decoded, ctx available), for the
    // orchestrator's hidden-pane verification (no speakers there either) --
    // this is the one place a "press -> sound" claim can be checked against
    // the engine's own log for the same stretch.
    recentCues.push({ cue, t: Date.now(), rate });
    if (recentCues.length > 30) recentCues.shift();
  } catch (e) { warnOnce(`start:${cue}`, `[audio] start() failed for ${cue}: ${e.message}`); }
}
// playBatch(cues): cuesForLog's own output, spaced BATCH_GAP_MS apart so a
// bot's whole turn doesn't land as one chord.
export function playBatch(cues, { gap = BATCH_GAP_MS } = {}) {
  cues.forEach((cue, i) => setTimeout(() => play(cue), i * gap));
}

// getManifest(): the manifest once loaded, or null before the first
// setScene()/play() call has fetched it (app.js's tutorial fallback reads
// this to decide whether bgm.tutorial exists yet, without forcing a fetch
// of its own -- see audio-cues.js's missingCues()).
export function getManifest() { return manifest; }

// ---------- settings ----------
export function getSetting(name) { return name === "sfx" ? sfxOn : musicOn; }
export function setSetting(name, value) {
  const on = !!value;
  if (name === "sfx") {
    sfxOn = on;
    store.set("zh.sfx", on ? "1" : "0");
    if (sfxMaster) sfxMaster.gain.value = on ? SFX_BASE : 0; // "silences sounds at once"
  } else if (name === "music") {
    musicOn = on;
    store.set("zh.music", on ? "1" : "0");
    if (on) { if (requestedScene) setScene(requestedScene, { gainMul: sceneGainMul }); }
    else fadeOutActive(MUSIC_OFF_FADE_MS); // "fades the music out in 0.3 s and stops fetching it"
  }
  attemptUnlock(); // clicking a switch is itself a user gesture
}

// ---------- debug (read-only) ----------
if (typeof window !== "undefined") {
  window.__audio = {
    get unlocked() { return unlocked; },
    get scene() { return activeScene; },
    get requestedScene() { return requestedScene; },
    get settings() { return { sfx: sfxOn, music: musicOn }; },
    get playing() { return Array.from(playingSfx); },
    get recent() { return recentCues.slice(); },
  };
}
