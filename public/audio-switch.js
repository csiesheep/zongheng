// #62 part 2 (owner's revision, 2026-09-20 night): ONE compact icon button
// in the top bar's first row -- replaces part 1's two pill switches (the
// landing's second line, the 紀錄 panel header and the desktop side foot are
// all gone; see app.js/landing.js/play.html/index.html/desktop.css). A
// speaker icon, no text label: on = the bar's gold (inherited from `.bar
// button`'s own resting colour), off = dim with a diagonal slash through
// the icon. `aria-pressed`, `aria-label`/`title` from `audio.on`/`audio.off`.
//
// One press toggles BOTH zh.sfx and zh.music to the same value (the owner:
// 「音效音樂同一開關」) -- the two settings stay separate in storage and in
// audio.js (a later need may still want them apart), but this button always
// writes both together. Read as "on" if EITHER is on, so a profile left
// mixed by part 1 (one on, one off) shows ON and the first press turns both
// off, per the owner's own rule.
import * as Audio from "./audio.js";

// Every mount's sync is registered here so a press anywhere updates every
// button on the page (there is normally only one per page today, but this
// keeps the same safety part 1 needed when two mounts coexisted).
const allSyncs = [];
const isOn = () => Audio.getSetting("sfx") || Audio.getSetting("music");
function setBoth(on) { Audio.setSetting("sfx", on); Audio.setSetting("music", on); }

const ICON = `
<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
  <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/>
  <path class="audio-btn-waves" d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line class="audio-btn-slash" x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

// mountAudioButton(host, t): builds the one button into `host` (idempotent),
// returns { sync() } re-run on every language switch (same convention as
// the rest of app.js/landing.js's own setLang()).
export function mountAudioButton(host, t) {
  if (!host || host.dataset.audioMounted) return { sync() {} };
  host.dataset.audioMounted = "1";
  const root = document.createElement("button");
  root.type = "button";
  root.className = "small audio-btn";
  root.innerHTML = ICON;
  root.addEventListener("click", () => { setBoth(!isOn()); allSyncs.forEach((fn) => fn()); });
  host.appendChild(root);
  const sync = () => {
    const on = isOn();
    root.classList.toggle("on", on);
    root.setAttribute("aria-pressed", String(on));
    const label = t(on ? "audio.on" : "audio.off");
    root.setAttribute("aria-label", label);
    root.title = label;
  };
  allSyncs.push(sync);
  sync();
  return { sync };
}
