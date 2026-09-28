// #145: ad slots for the 戰報 page (and only that page). Owner, 2026-09-28: 「做 A，廣告先留空位」.
//
// ADS.client is null and every slot id is null until AdSense is approved. In that state a slot is an
// element in the DOM that is `hidden` (display:none, no space) and NOTHING here loads a script or
// touches an ad domain. Set `client` ("ca-pub-...") and a slot's id and that slot becomes a small
// 廣告 label over a standard AdSense <ins class="adsbygoogle"> unit; the adsbygoogle.js script is
// added to the page once, the first time such a slot is drawn.
export const ADS = { client: null, slots: { wait: null, inArticle: null, end: null, rail: null } };

// Reserved height (px) of each unit, so the page does not jump when the ad fills.
const MIN_H = { wait: 250, inArticle: 200, end: 250, rail: 600 };

export function adOn(name) { return !!(ADS.client && ADS.slots[name]); }

// The slot's markup. `label` is the (already translated) 廣告 / Advertisement text.
export function adSlotHTML(name, label) {
  if (!adOn(name)) return `<div class="ad-slot" data-ad="${name}" hidden></div>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return `<div class="ad-slot ad-${name}" data-ad="${name}"><p class="ad-tag">${esc(label)}</p>` +
    `<div class="ad-box" style="min-height:${MIN_H[name]}px"><ins class="adsbygoogle" style="display:block" ` +
    `data-ad-client="${esc(ADS.client)}" data-ad-slot="${esc(ADS.slots[name])}" data-ad-format="auto" data-full-width-responsive="true"></ins></div></div>`;
}

let scriptAdded = false;
// Call after slots were put in the DOM: loads the script (once) and asks it to fill each new unit.
export function activateAds(root = document) {
  if (!ADS.client) return;
  const units = [...root.querySelectorAll("ins.adsbygoogle:not([data-ad-done])")];
  if (!units.length) return;
  if (!scriptAdded) {
    scriptAdded = true;
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADS.client)}`;
    document.head.appendChild(s);
  }
  window.adsbygoogle = window.adsbygoogle || [];
  for (const u of units) {
    u.setAttribute("data-ad-done", "1");
    try { window.adsbygoogle.push({}); } catch {}
  }
}
