// #146: the dev log page. All text is already in devlog.html as zh/en pairs; this only decides <html lang>
// (?lang= wins, then the saved zh.lang, then the browser's language, as landing.js and rules.js do) and wires the
// language button. A classic script in <head>, so <html lang> is right before the first paint.
(function () {
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  function pick(l) { return l === "en" ? "en" : l === "zh-Hant" ? "zh-Hant" : null; }
  var lang = pick(new URLSearchParams(location.search).get("lang")) ||
    pick(store.get("zh.lang")) ||
    ((navigator.language || "").indexOf("zh") === 0 ? "zh-Hant" : "en");
  function apply() {
    document.documentElement.lang = lang;
    document.title = lang === "en" ? "Dev log — Zongheng" : "開發日誌 — 縱橫 Zongheng";
  }
  apply();
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("langBtn").addEventListener("click", function () {
      lang = lang === "en" ? "zh-Hant" : "en";
      store.set("zh.lang", lang);
      apply();
    });
  });
})();
