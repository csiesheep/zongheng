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
  for (const id of ["tagline", "about", "credit"]) $(id).textContent = S[id];
  $("hero").textContent = S.title;
  $("joinCode").placeholder = t("landing.code");
  $("landName").placeholder = t("landing.name");
  // A room this tab still holds a seat in: offer the way back.
  const room = sess.get("zh.lastRoom");
  $("btnRoom").hidden = !room;
  if (room) { $("btnRoom").href = `play.html?room=${room}`; $("btnRoom").textContent = t("landing.backToRoom", { code: room }); }
  $("btnResume").hidden = !savedSolo();
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));

$("landName").value = store.get("zh.name", "");
$("landName").addEventListener("input", () => store.set("zh.name", $("landName").value.trim()));
$("btnCreate").onclick = () => { store.set("zh.name", $("landName").value.trim()); location.href = "play.html?create=1"; };
$("btnJoin").onclick = () => {
  const code = $("joinCode").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) { $("joinCode").focus(); return; }
  store.set("zh.name", $("landName").value.trim());
  location.href = `play.html?room=${code}`;
};
$("joinCode").addEventListener("keydown", (ev) => { if (ev.key === "Enter") $("btnJoin").click(); });

setLang(new URLSearchParams(location.search).get("lang") || store.get("zh.lang", (navigator.language || "").startsWith("zh") ? "zh-Hant" : "en"));
