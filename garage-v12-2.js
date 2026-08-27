(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PHOTO_CACHE_KEY = "vehicleScorecardVehiclePhotosV3";

  function photoCache() {
    try { return JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}"); }
    catch { return {}; }
  }

  function savePhotoCache(value) {
    localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(value));
  }

  function fieldsName(fields = {}) {
    return [fields.year, fields.make, fields.model, fields.trim].filter(Boolean).join(" ");
  }

  function photoKey(fields = {}) {
    return [fields.year, fields.make, fields.model].filter(Boolean).join("|").toLowerCase();
  }

  async function wikipediaPhotos(fields = {}) {
    if (!fields.make || !fields.model) return [];

    const searches = [
      [fields.year, fields.make, fields.model].filter(Boolean).join(" "),
      [fields.make, fields.model].filter(Boolean).join(" ")
    ];

    const output = [];
    for (const search of searches) {
      const endpoint = new URL("https://en.wikipedia.org/w/api.php");
      endpoint.search = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: search,
        gsrnamespace: "0",
        gsrlimit: "8",
        prop: "pageimages",
        piprop: "thumbnail|name",
        pithumbsize: "960",
        origin: "*",
        format: "json"
      }).toString();

      try {
        const response = await fetch(endpoint.toString(), { mode: "cors", cache: "no-store", credentials: "omit" });
        if (!response.ok) continue;
        const data = await response.json();
        const pages = Object.values(data.query?.pages || {});
        const make = String(fields.make).toLowerCase();
        const modelTokens = String(fields.model).toLowerCase().split(/\s+/).filter(Boolean);
        pages
          .map((page) => {
            const title = String(page.title || "").toLowerCase();
            let rank = 0;
            if (title.includes(make)) rank += 5;
            modelTokens.forEach((token) => { if (title.includes(token)) rank += 4; });
            return { url: page.thumbnail?.source || "", rank };
          })
          .filter((item) => item.url)
          .sort((a, b) => b.rank - a.rank)
          .forEach((item) => { if (!output.includes(item.url)) output.push(item.url); });
      } catch {}

      if (output.length) break;
    }
    return output;
  }

  async function commonsPhotos(fields = {}) {
    if (!fields.make || !fields.model) return [];
    const search = [fields.year, fields.make, fields.model, "automobile"].filter(Boolean).join(" ");
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: search,
      gsrnamespace: "6",
      gsrlimit: "20",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "960",
      origin: "*",
      format: "json"
    }).toString();

    try {
      const response = await fetch(endpoint.toString(), { mode: "cors", cache: "no-store", credentials: "omit" });
      if (!response.ok) return [];
      const data = await response.json();
      const make = String(fields.make).toLowerCase();
      const tokens = String(fields.model).toLowerCase().split(/\s+/).filter((token) => token.length > 1);
      return Object.values(data.query?.pages || {})
        .map((page) => {
          const title = String(page.title || "").toLowerCase();
          const info = page.imageinfo?.[0];
          let rank = 0;
          if (title.includes(make)) rank += 8;
          tokens.forEach((token) => { if (title.includes(token)) rank += 5; });
          if (fields.year && title.includes(String(fields.year))) rank += 2;
          if (/interior|engine|wheel|logo|badge|emblem|diagram|drawing|wreck|race/.test(title)) rank -= 20;
          if (!String(info?.mime || "").startsWith("image/")) rank -= 100;
          return { url: info?.thumburl || info?.url || "", rank };
        })
        .filter((item) => item.url)
        .sort((a, b) => b.rank - a.rank)
        .map((item) => item.url);
    } catch {
      return [];
    }
  }

  async function getPhotos(fields = {}) {
    const key = photoKey(fields);
    if (!key) return [];
    const cached = photoCache();
    if (Array.isArray(cached[key]) && cached[key].length) return cached[key];

    let urls = await wikipediaPhotos(fields);
    const commons = await commonsPhotos(fields);
    urls = [...urls, ...commons].filter((url, index, list) => url && list.indexOf(url) === index).slice(0, 10);
    if (urls.length) {
      cached[key] = urls;
      savePhotoCache(cached);
    }
    return urls;
  }

  function vehicleForCard(card) {
    const id = card.dataset.vehicleId;
    if (id) return (APP.getSaved?.() || []).find((vehicle) => String(vehicle.id) === id) || null;
    const title = card.querySelector(".v12-vehicle-title")?.textContent?.trim();
    return (APP.getSaved?.() || []).find((vehicle) => fieldsName(vehicle.fields || {}) === title) || null;
  }

  function installPhoto(host, fields = {}) {
    if (!host || host.dataset.v122Photo === photoKey(fields)) return;
    host.dataset.v122Photo = photoKey(fields);
    host.innerHTML = '<div class="v12-photo-loading">Finding vehicle photo…</div>';

    getPhotos(fields).then((urls) => {
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
        img.onload = () => {
          if (!host.isConnected) return;
          host.innerHTML = "";
          host.appendChild(img);
        };
        img.onerror = () => { index += 1; next(); };
        img.src = urls[index];
      };
      next();
    });
  }

  function gradeFromScore(score) {
    if (score >= 97) return "A+";
    if (score >= 93) return "A";
    if (score >= 90) return "A-";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B-";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C-";
    if (score >= 65) return "D+";
    if (score >= 60) return "D";
    return "F";
  }

  function money(value) {
    const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return number > 0 ? APP.money(number) : "—";
  }

  function detailMarkup(vehicle) {
    const fields = vehicle.fields || {};
    const score = Number(vehicle.score?.pct) || 0;
    const grade = vehicle.conditionGrade || (score ? gradeFromScore(score) : "—");
    const checks = Object.keys(vehicle.ratings || {}).length;
    const ask = fields.buyAsk || fields.asking;
    const value = fields.sellAsIs || fields.buyResale || fields.sellTarget;
    const path = vehicle.assessmentPath === "inspection" ? "Inspection Only" : vehicle.assessmentPath === "value" ? "Value Analysis Only" : "Full Assessment";

    return `
      <div class="v122-expanded-grid">
        <div><small>Assessment</small><strong>${path}</strong></div>
        <div><small>Condition</small><strong>${score ? `${score}/100 · ${grade}` : "Not inspected"}</strong></div>
        <div><small>Checks Recorded</small><strong>${checks || "—"}</strong></div>
        <div><small>Decision</small><strong>${fields.decision || "In Progress"}</strong></div>
        <div><small>Seller Asking</small><strong>${money(ask)}</strong></div>
        <div><small>Estimated / Target Value</small><strong>${money(value)}</strong></div>
        <div><small>VIN</small><strong>${fields.vin || "Not entered"}</strong></div>
        <div><small>Mileage</small><strong>${vehicle.mileageUnknown ? "Unknown" : fields.mileage ? Number(fields.mileage).toLocaleString() : "Not entered"}</strong></div>
      </div>
      <div class="v122-card-actions">
        <button type="button" data-v122-open="${vehicle.id}">Open Vehicle Dashboard</button>
      </div>`;
  }

  function enhanceCards() {
    document.querySelectorAll(".v12-vehicle-card").forEach((card) => {
      const vehicle = vehicleForCard(card);
      if (!vehicle) return;
      card.dataset.vehicleId = String(vehicle.id);
      card.classList.add("v122-collapsible");
      card.setAttribute("role", "button");
      card.setAttribute("aria-expanded", card.classList.contains("expanded") ? "true" : "false");
      installPhoto(card.querySelector(".v12-vehicle-photo"), vehicle.fields || {});

      let details = card.querySelector(".v122-card-details");
      if (!details) {
        details = document.createElement("div");
        details.className = "v122-card-details";
        card.appendChild(details);
      }
      details.innerHTML = detailMarkup(vehicle);
    });

    const hero = document.querySelector(".v12-hero-photo");
    if (hero) installPhoto(hero, APP.getVehicle?.() || {});
  }

  function configureDock() {
    const dock = document.getElementById("v12BottomDock");
    if (!dock || dock.dataset.v122 === "true") return;
    dock.dataset.v122 = "true";
    dock.innerHTML = `
      <button data-v122-dock="home"><span class="dock-icon">⌂</span><span>Home</span></button>
      <button data-v122-dock="garage"><span class="dock-icon">▣</span><span>Garage</span></button>
      <button data-v122-dock="new" class="dock-new"><span class="dock-icon">＋</span><span>New</span></button>
      <button data-v122-dock="menu"><span class="dock-icon">☰</span><span>Menu</span></button>`;

    dock.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v122-dock]");
      if (!button) return;
      const action = button.dataset.v122Dock;
      if (action === "home") {
        APP.showPage?.("homePage");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (action === "garage") {
        APP.showPage?.("homePage");
        window.setTimeout(() => document.querySelector(".v12-garage-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
      if (action === "new") {
        APP.clearCurrent?.();
        APP.showPage?.("profilePage");
      }
      if (action === "menu") document.getElementById("appMenu")?.click();
    });
  }

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-v122-open]");
    if (open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      APP.loadSaved?.(open.dataset.v122Open).then(() => APP.showPage?.("homePage"));
      return;
    }

    const card = event.target.closest(".v12-vehicle-card");
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const expanded = !card.classList.contains("expanded");
    card.classList.toggle("expanded", expanded);
    card.setAttribute("aria-expanded", expanded ? "true" : "false");
  }, true);

  function refresh() {
    configureDock();
    enhanceCards();
  }

  const observer = new MutationObserver(() => window.setTimeout(refresh, 10));
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  ["scorecard:core-ready", "scorecard:dashboardrender", "scorecard:vehiclechange", "scorecard:pathchange"].forEach((name) => {
    document.addEventListener(name, () => window.setTimeout(refresh, 80));
  });
})();
