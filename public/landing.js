// The landing page: language, your name, and the ways into the game page
// (play.html). No engine here, so it loads fast and can be indexed later.
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import * as Audio from "./audio.js";
import * as Cues from "./audio-cues.js";
import { mountAudioButton } from "./audio-switch.js";
import * as Opening from "./opening.js";

const LANGS = { en, "zh-Hant": zh };
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const sess = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } } };

let lang = "en", S = en;
const t = (key, p = {}) => String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), S) ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));

// #62 part 2 (owner's revision): the landing plays bgm.landing (and only
// bgm.landing -- there's no era/winner/tutorial state on this page); one
// sound icon button in the bar's own right-hand group, before 規則.
const audioBtn = mountAudioButton($("audioBtnSlot"), t);
// #67: when the opening video plays, IT owns the first scene start -- calling
// setScene() here would let audio.js's onUnlocked() (fired by the very tap
// that also unlocks audio) start bgm.landing underneath the video. So the
// call moves into this function, run either right away below (no opening)
// or from the opening layer's own end() once its 0.8s fade finishes.
function startLandingMusic() { Audio.setScene(Cues.sceneFor({ page: "landing" })); }
// #62 part 2, item D: this page never plays a single table sound -- warm
// only the one sfx it can actually trigger (the bar's own buttons/links),
// not the table's twelve. Set before the first gesture can fire onUnlocked()
// (see audio.js's own comment on setWarmCues()) -- this runs synchronously
// right after the import, before any promise from audio.js's own
// attemptUnlock() (called at its module's own top level) can resolve.
Audio.setWarmCues(["sfx.ui.tap"]);

function savedSolo() {
  try { const s = JSON.parse(store.get("zh.solo", "null")); return !!(s && s.st && s.st.winner == null); } catch { return false; }
}
function setLang(l) {
  lang = LANGS[l] ? l : "en";
  S = LANGS[lang];
  store.set("zh.lang", lang);
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "Zongheng 縱橫" : "縱橫 Zongheng";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  $("joinCode").placeholder = t("landing.codePlaceholder");
  // A room this tab still holds a seat in, or a solo game still in progress:
  // offer the way back. Both can appear together; that row must still fit.
  const room = sess.get("zh.lastRoom");
  $("btnRoom").hidden = !room;
  if (room) { $("btnRoom").href = `play.html?room=${room}`; $("btnRoom").querySelector(".ctl-label").textContent = t("landing.backToRoom", { code: room }); }
  $("btnResume").hidden = !savedSolo();
  // Row 1 always shows Tutorial; when Resume and/or Back-to-room join it,
  // Tutorial's own label shrinks (one companion) or gives way to an
  // icon-only square (both), so the row always fits at 44px (issue #38).
  // The aria-label keeps the full text for a screen reader either way.
  const companions = (!$("btnResume").hidden ? 1 : 0) + (!$("btnRoom").hidden ? 1 : 0);
  const fit = companions === 2 ? "squeeze" : companions === 1 ? "paired" : "solo";
  $("ctaRow").dataset.fit = fit;
  $("btnTutorial").dataset.fit = fit;
  $("btnTutorial").setAttribute("aria-label", t("tutorial.button"));
  // The gold dot (#15) marks the tutorial unopened; it never reads or writes
  // zh.solo, only its own key, and disappears for good once the tutorial
  // page has been opened.
  $("tutEntryDot").hidden = store.get("zh.tutorialSeen", "") === "1";
  audioBtn.sync();
  if (openingLayer) openingLayer.sync(); // its aria-label is set via t(), same as audioBtn.sync() above
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));

$("btnCreate").onclick = () => { location.href = "play.html?create=1"; };
$("btnJoin").onclick = () => {
  const code = $("joinCode").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) { $("joinCode").focus(); return; }
  location.href = `play.html?room=${code}`;
};
$("joinCode").addEventListener("keydown", (ev) => { if (ev.key === "Enter") $("btnJoin").click(); });

// ---------- opening video (#67) ----------
// opening.js decides WHETHER to play (no DOM there, so the orchestrator's
// test can import it into Node); everything below -- the layer, the
// <video>, the crossfade -- is the DOM half, owned here.
function buildOpeningLayer() {
  const heroEl = document.querySelector(".hero");
  const controlsEl = document.querySelector(".controls");
  const page = document.querySelector(".landing-page");
  // Inert while the layer is up (readied for the crossfade underneath, but
  // not interactive) -- EXCEPT the bar, which stays reachable so a player
  // can mute before tapping. The bar's own audio button lives inside .hero
  // and would go inert along with it, so a duplicate is mounted inside the
  // layer itself (mountAudioButton() is idempotent per host and every mount
  // stays in sync via audio-switch.js's shared allSyncs).
  heroEl.inert = true;
  controlsEl.inert = true;

  const layer = document.createElement("div");
  layer.className = "opening-layer";

  const video = document.createElement("video");
  video.className = "opening-video";
  video.playsInline = true;
  video.preload = "auto";
  video.poster = "video/opening_start.jpg";
  video.src = "video/opening.mp4";
  video.muted = true; // set to the real switch state right before play() in begin()
  layer.appendChild(video);

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "opening-hit";
  const line = document.createElement("span");
  line.className = "opening-line";
  line.dataset.t = "opening.tap";
  hit.appendChild(line);
  hit.setAttribute("aria-label", t("opening.tap"));
  layer.appendChild(hit);

  const audioSlot = document.createElement("span");
  audioSlot.className = "opening-audio-slot";
  layer.appendChild(audioSlot);
  const openingAudioBtn = mountAudioButton(audioSlot, t);

  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "opening-skip";
  skip.dataset.t = "opening.skip";
  layer.appendChild(skip);

  page.appendChild(layer);

  let phase = "start"; // "start" -> "playing" -> "ending" -> "done"
  let startTimeoutId = null;
  let started = false; // the video's own "playing" event actually fired

  function onKeydown(ev) { if (ev.key === "Escape") end(); }
  function onPlaying() { started = true; }

  function end() {
    if (phase === "ending" || phase === "done") return;
    phase = "ending";
    if (startTimeoutId) clearTimeout(startTimeoutId);
    document.removeEventListener("keydown", onKeydown);
    video.removeEventListener("playing", onPlaying);
    try { video.pause(); } catch {}
    layer.classList.add("opening-fade");
    setTimeout(() => {
      layer.remove();
      store.set(Opening.OPENING_KEY, "1");
      heroEl.inert = false;
      controlsEl.inert = false;
      phase = "done";
      startLandingMusic();
    }, 800); // matches .opening-fade's own transition duration in opening.css
  }

  function begin() {
    if (phase !== "start") return;
    phase = "playing";
    hit.setAttribute("aria-label", t("opening.skip")); // now a "tap to end" surface
    line.hidden = true;
    video.muted = !(Audio.getSetting("sfx") || Audio.getSetting("music")); // the engine's own switch, read through audio.js
    video.addEventListener("playing", onPlaying, { once: true });
    video.addEventListener("ended", end, { once: true });
    video.addEventListener("error", end, { once: true });
    document.addEventListener("keydown", onKeydown);
    video.play().catch(end); // a refused play() ends it at once, same as the 3s guard below
    startTimeoutId = setTimeout(() => { if (!started) end(); }, 3000); // "must never wait on it"
  }
  hit.addEventListener("click", () => { if (phase === "start") begin(); else if (phase === "playing") end(); });
  skip.addEventListener("click", end);

  return {
    // hit's aria-label is set via setAttribute (its text content -- the
    // opening.tap line -- is a data-t node and already covered by setLang's
    // own loop), so a language switch needs it refreshed by hand too.
    sync() { openingAudioBtn.sync(); hit.setAttribute("aria-label", t(phase === "start" ? "opening.tap" : "opening.skip")); },
  };
}

const openingLayer = Opening.shouldPlayOpening({
  seen: store.get(Opening.OPENING_KEY, null) === "1",
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  params: new URLSearchParams(location.search),
}) ? buildOpeningLayer() : (startLandingMusic(), null);

setLang(new URLSearchParams(location.search).get("lang") || store.get("zh.lang", (navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));

// #62: sfx.ui.tap on every button/link-button press. The landing has no map
// hit buttons or hand cards (play.html's own exclusions), so every
// <button>/<a> qualifies here.
document.addEventListener("click", (ev) => { if (ev.target.closest("button, a")) Audio.play("sfx.ui.tap"); }, true);

// Desktop (>=768px, see landing-desktop.css): the backdrop's gold seam has
// to line up with the Qin/Chu split inside the phone column. That split is
// an exact 50/50 flex division of .sides and isn't a fixed number (it
// depends on viewport height, the bar's height, and the controls' height),
// so we measure it instead of trying to duplicate it in a CSS calc(). Runs
// on every width; it's cheap, and mobile CSS never reads --seam-y.
function syncDesktopSeam() {
  const qin = $("btnQin");
  if (!qin) return;
  const y = qin.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty("--seam-y", `${y}px`);
}
// A plain 'resize' event can fire a frame before the browser has settled
// the new layout (observed after #12's bar-overlay change: a window
// resize's own handler read #btnQin mid-reflow and got the OLD height —
// a second resize was needed to correct it). Two rAFs guarantee at least
// one full layout+paint has happened before we measure, so one resize is
// enough. A setTimeout fallback is added because rAF doesn't run at all
// while the tab is backgrounded/hidden (a resize can still land there,
// e.g. a window manager resizing an occluded window); the timeout still
// fires, just possibly throttled, and re-measuring is harmless either
// way. ResizeObserver on #btnQin itself is kept as a third, independent
// path (its callback always runs after layout is current).
function syncDesktopSeamNextFrame() {
  requestAnimationFrame(() => requestAnimationFrame(syncDesktopSeam));
  setTimeout(syncDesktopSeam, 120);
}
window.addEventListener("resize", syncDesktopSeamNextFrame);
window.addEventListener("load", syncDesktopSeam);
if (window.ResizeObserver) {
  const qin = $("btnQin");
  if (qin) new ResizeObserver(syncDesktopSeam).observe(qin);
  const sides = document.querySelector(".sides");
  if (sides) new ResizeObserver(syncDesktopSeam).observe(sides);
}
syncDesktopSeam();
