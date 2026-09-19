// The landing page: language, your name, and the ways into the game page
// (play.html). No engine here, so it loads fast and can be indexed later.
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";

const LANGS = { en, "zh-Hant": zh };
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const sess = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } } };

let lang = "en", S = en;
const t = (key, p = {}) => String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), S) ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));

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
  if (room) { $("btnRoom").href = `play.html?room=${room}`; $("btnRoom").textContent = t("landing.backToRoom", { code: room }); }
  $("btnResume").hidden = !savedSolo();
  $("extraRow").hidden = $("btnRoom").hidden && $("btnResume").hidden;
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));

$("btnCreate").onclick = () => { location.href = "play.html?create=1"; };
$("btnJoin").onclick = () => {
  const code = $("joinCode").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) { $("joinCode").focus(); return; }
  location.href = `play.html?room=${code}`;
};
$("joinCode").addEventListener("keydown", (ev) => { if (ev.key === "Enter") $("btnJoin").click(); });

setLang(new URLSearchParams(location.search).get("lang") || store.get("zh.lang", (navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));

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
window.addEventListener("resize", syncDesktopSeam);
window.addEventListener("load", syncDesktopSeam);
if (window.ResizeObserver) {
  const sides = document.querySelector(".sides");
  if (sides) new ResizeObserver(syncDesktopSeam).observe(sides);
}
syncDesktopSeam();
