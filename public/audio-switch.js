// #62 part 1, piece C: the sfx/music pill switches, shared by the landing
// bar, the table's 紀錄 panel header and the desktop side foot -- one look
// (style.css's .audio-toggle, the same pill + gold-dot the 軍師 switch uses,
// see advisor.css/advisor-ui.js for that original) wired to audio.js's
// settings. This module carries no strings of its own -- `t` is the
// caller's own i18n lookup, called again on every language switch via the
// returned `sync()`.
import * as Audio from "./audio.js";

// On the table's desktop layout (>=1024px, desktop.css), the 紀錄 panel's
// own switches and the side foot's switches are both mounted AND both
// visible at once -- a click on either must update BOTH, or the two
// controls for the same setting could disagree on screen. Every mount's
// sync() is registered here; a click re-runs all of them, not just its own.
const allSyncs = [];

function buildOne(name, onClick) {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "audio-toggle";
  const label = document.createElement("span");
  label.className = "audio-toggle-label";
  const track = document.createElement("span");
  track.className = "audio-toggle-track";
  track.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "audio-toggle-dot";
  track.appendChild(dot);
  root.append(label, track);
  root.addEventListener("click", () => onClick(name));
  return { root, label };
}

// mountAudioSwitches(host, t): builds both pills once into `host` (idempotent
// -- a second call on the same host is a no-op) and returns a `sync()` the
// caller re-runs on every language switch (same convention as app.js's own
// setLang() re-running renderBackLink()/renderSetup()/etc.); every mount's
// sync also runs automatically after either switch is clicked, anywhere.
export function mountAudioSwitches(host, t) {
  if (!host || host.dataset.audioMounted) return { sync() {} };
  host.dataset.audioMounted = "1";
  const onClick = (name) => { Audio.setSetting(name, !Audio.getSetting(name)); allSyncs.forEach((fn) => fn()); };
  const sfx = buildOne("sfx", onClick);
  const music = buildOne("music", onClick);
  host.append(sfx.root, music.root);
  function syncOne(entry, name) {
    const on = Audio.getSetting(name);
    entry.root.classList.toggle("on", on);
    entry.root.setAttribute("aria-pressed", String(on));
    entry.label.textContent = t(`audio.${name}`);
    entry.root.setAttribute("aria-label", t(`audio.${name}${on ? "On" : "Off"}`));
  }
  const sync = () => { syncOne(sfx, "sfx"); syncOne(music, "music"); };
  allSyncs.push(sync);
  sync();
  return { sync };
}
