(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PHOTO_CACHE_KEY = "vehicleScorecardVehiclePhotosV3";

  function photoCache() {
    try { return JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}"); }
    catch { return {}; }
  }
  function savePhotoCache(value) { localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(value)); }
  function fieldsName(fields = {}) { return [fields.year, fields.make, fields.model, fields.trim].filter(Boolean).join(" "); }
  function photoKey(fields = {}) { return [fields.year, fields.make, fields.model].filter(Boolean).join("|").toLowerCase(); }

  async function wikipediaPhotos(fields = {}) {
    if (!fields.make || !fields.model) return [];
    const searches = [[fields.year, fields.make, fields.model].filter(Boolean).join(" "), [fields.make, fields.model].filter(Boolean).join(" ")];
    const output = [];
    for (const search of searches) {
      const endpoint = new URL("https://en.wikipedia.org/w/api.php");
      endpoint.search = new URLSearchParams({action:"query",generator:"search",gsrsearch:search,gsrnamespace:"0",gsrlimit:"8",prop:"pageimages",piprop:"thumbnail|name",pithumbsize:"960",origin:"*",format:"json"}).toString();
      try {
        const response = await fetch(endpoint.toString(), { mode:"cors", cache:"no-store", credentials:"omit" });
        if (!response.ok) continue;
        const data = await response.json();
        const make = String(fields.make).toLowerCase();
        const tokens = String(fields.model).toLowerCase().split(/\s+/).filter(Boolean);
        Object.values(data.query?.pages || {}).map(page => {
          const title = String(page.title || "").toLowerCase();
          let rank = title.includes(make) ? 5 : 0;
          tokens.forEach(token => { if (title.includes(token)) rank += 4; });
          return { url:page.thumbnail?.source || "", rank };
        }).filter(x => x.url).sort((a,b) => b.rank-a.rank).forEach(x => { if (!output.includes(x.url)) output.push(x.url); });
      } catch {}
      if (output.length) break;
    }
    return output;
  }

  async function commonsPhotos(fields = {}) {
    if (!fields.make || !fields.model) return [];
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({action:"query",generator:"search",gsrsearch:[fields.year,fields.make,fields.model,"automobile"].filter(Boolean).join(" "),gsrnamespace:"6",gsrlimit:"20",prop:"imageinfo",iiprop:"url|mime",iiurlwidth:"960",origin:"*",format:"json"}).toString();
    try {
      const response = await fetch(endpoint.toString(), { mode:"cors", cache:"no-store", credentials:"omit" });
      if (!response.ok) return [];
      const data = await response.json();
      const make = String(fields.make).toLowerCase();
      const tokens = String(fields.model).toLowerCase().split(/\s+/).filter(t => t.length > 1);
      return Object.values(data.query?.pages || {}).map(page => {
        const title = String(page.title || "").toLowerCase();
        const info = page.imageinfo?.[0];
        let rank = title.includes(make) ? 8 : 0;
        tokens.forEach(token => { if (title.includes(token)) rank += 5; });
        if (fields.year && title.includes(String(fields.year))) rank += 2;
        if (/interior|engine|wheel|logo|badge|emblem|diagram|drawing|wreck|race/.test(title)) rank -= 20;
        if (!String(info?.mime || "").startsWith("image/")) rank -= 100;
        return { url:info?.thumburl || info?.url || "", rank };
      }).filter(x => x.url).sort((a,b) => b.rank-a.rank).map(x => x.url);
    } catch { return []; }
  }

  async function getPhotos(fields = {}) {
    const key = photoKey(fields);
    if (!key) return [];
    const cached = photoCache();
    if (Array.isArray(cached[key]) && cached[key].length) return cached[key];
    const urls = [...await wikipediaPhotos(fields), ...await commonsPhotos(fields)].filter((url,i,list) => url && list.indexOf(url) === i).slice(0,10);
    if (urls.length) { cached[key] = urls; savePhotoCache(cached); }
    return urls;
  }

  function vehicleForCard(card) {
    const id = card.dataset.vehicleId;
    if (id) return (APP.getSaved?.() || []).find(v => String(v.id) === id) || null;
    const title = card.querySelector(".v12-vehicle-title")?.textContent?.trim();
    return (APP.getSaved?.() || []).find(v => fieldsName(v.fields || {}) === title) || null;
  }

  function installPhoto(host, fields = {}) {
    const key = photoKey(fields);
    if (!host || !key || host.dataset.v122Photo === key) return;
    host.dataset.v122Photo = key;
    host.innerHTML = '<div class="v12-photo-loading">Finding vehicle photo…</div>';
    getPhotos(fields).then(urls => {
      if (!host.isConnected) return;
      let index = 0;
      const next = () => {
        if (index >= urls.length) {
          host.innerHTML = '<div class="v122-photo-none"><img src="logo-mark.svg" alt=""><span>Representative photo unavailable</span></div>';
          return;
        }
        const img = new Image();
        img.alt = `Representative ${fieldsName(fields)}`;
        img.decoding = "async";
        img.onload = () => { if (host.isConnected) { host.innerHTML = ""; host.appendChild(img); } };
        img.onerror = () => { index += 1; next(); };
        img.src = urls[index];
      };
      next();
    });
  }

  function enhanceCards() {
    document.querySelectorAll(".v12-vehicle-card").forEach(card => {
      const vehicle = vehicleForCard(card);
      if (!vehicle) return;
      card.dataset.vehicleId = String(vehicle.id);
      installPhoto(card.querySelector(".v12-vehicle-photo"), vehicle.fields || {});
    });
    const hero = document.querySelector(".v12-hero-photo");
    if (hero) installPhoto(hero, APP.getVehicle?.() || {});
  }

  // v12.5: garage-v12-2 now owns photos only. Card expansion/navigation is
  // handled by garage-expand-v123; the bottom dock/menu is handled elsewhere.
  // Removing the former document-level capture listener and document-wide
  // MutationObserver prevents drawer taps from being intercepted and removes
  // the repeated refresh loop that caused mobile sluggishness.
  let refreshQueued = false;
  function refresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => { refreshQueued = false; enhanceCards(); });
  }

  ["scorecard:core-ready", "scorecard:dashboardrender", "scorecard:vehiclechange", "scorecard:pathchange"].forEach(name => {
    document.addEventListener(name, refresh);
  });
  window.addEventListener("load", refresh, { once:true });
  setTimeout(refresh, 100);
})();