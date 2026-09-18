// The client. Scaffold (M0): the placeholder landing with the language
// toggle. M3 adds the views (landing / setup / lobby / table / over), picked
// by query string so the build works at any prefix, the solo driver and the
// room socket client.
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";

const LANGS = { en, "zh-Hant": zh };
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let lang = "en", S = en;
function t(key) {
  return String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), S) ?? key);
}
function setLang(l) {
  lang = LANGS[l] ? l : "en";
  S = LANGS[lang];
  store.set("zh.lang", lang);
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "Zongheng 縱橫" : "縱橫 Zongheng";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  for (const id of ["tagline", "about", "soon", "credit"]) $(id).textContent = S[id];
  $("hero").textContent = S.title;
}
$("langBtn").addEventListener("click", () => setLang(lang === "en" ? "zh-Hant" : "en"));

const wanted = new URLSearchParams(location.search).get("lang");
setLang(wanted || store.get("zh.lang", navigator.language.startsWith("zh") ? "zh-Hant" : "en"));
