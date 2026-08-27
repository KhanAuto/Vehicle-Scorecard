(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PHOTO_CACHE_KEY = "vehicleScorecardWikimediaPhotosV2";

  function cache() {
    try { return JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}"); }
    catch { return {}; }
  }

  function saveCache(data) {
    localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(data));
  }

  function keyFor(fields) {
    return [fields?.year, fields?.make, fields?.model]
      .filter(Boolean)
      .join("|")
      .toLowerCase();
  }

  function nameFor(fields) {
    return [fields?.year, fields?.make, fields?.model, fields?.trim]
      .filter(Boolean)
      .join(" ");
  }

  async function commonsCandidates(fields) {
    const terms = [fields?.year, fields?.make, fields?.model]
      .filter(Boolean)
      .join(" ");

    if (!terms) return [];

    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${terms} automobile`,
      gsrnamespace: "6",
      gsrlimit: "18",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "900",
      origin: "*",
      format: "json"
    }).toString();

    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return [];

    const data = await response.json();
    const make = String(fields?.make || "").toLowerCase();
    const modelTokens = String(fields?.model || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 1);

    return Object.values(data.query?.pages || {})
      .map((page) => {
        const title = String(page.title || "").toLowerCase();
        const info = page.imageinfo?.[0];
        let score = 0;

        if (!String(info?.mime || "").startsWith("image/")) score -= 100;
        if (title.includes(make)) score += 8;
        modelTokens.forEach((token) => { if (title.includes(token)) score += 5; });
        if (fields?.year && title.includes(String(fields.year))) score += 3;
        if (/front|side|rear|sedan|coupe|wagon|suv|hatchback|roadster|car|automobile/.test(title)) score += 2;
        if (/interior|dashboard|engine|wheel|rim|logo|badge|emblem|diagram|drawing|police|race|wreck|crash/.test(title)) score -= 14;

        return {
          score,
          url: info?.thumburl || info?.url || ""
        };
      })
      .filter((item) => item.url)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.url);
  }

  async function wikipediaCandidates(fields) {
    const terms = [fields?.year, fields?.make, fields?.model]
      .filter(Boolean)
      .join(" ");
    if (!terms) return [];

    const endpoint = new URL("https://en.wikipedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: terms,
      gsrlimit: "5",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "900",
      origin: "*",
      format: "json"
    }).toString();

    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data.query?.pages || {})
      .map((page) => page.thumbnail?.source)
      .filter(Boolean);
  }

  async function photoCandidates(fields) {
    const key = keyFor(fields);
    if (!key) return [];

    const stored = cache();
    if (Array.isArray(stored[key]) && stored[key].length) return stored[key];

    let urls = [];
    try { urls = await commonsCandidates(fields); } catch {}
    if (!urls.length) {
      try { urls = await wikipediaCandidates(fields); } catch {}
    }

    stored[key] = urls.slice(0, 6);
    saveCache(stored);
    return stored[key];
  }

  function fallbackPhoto(host) {
    if (!host) return;
    host.innerHTML = '<div class="v12-photo-fallback"><img src="logo-mark.svg" alt=""><span>No representative Wikimedia photo found</span></div>';
  }

  async function setPhoto(host, fields) {
    if (!host || host.dataset.photoPolish === keyFor(fields)) return;
    host.dataset.photoPolish = keyFor(fields);
    host.innerHTML = '<div class="v12-photo-loading">Loading Wikimedia photo…</div>';

    const urls = await photoCandidates(fields);
    if (!host.isConnected) return;
    if (!urls.length) {
      fallbackPhoto(host);
      return;
    }

    let index = 0;
    const tryNext = () => {
      if (index >= urls.length) {
        fallbackPhoto(host);
        return;
      }

      const img = new Image();
      img.alt = `Representative ${nameFor(fields)}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.onload = () => {
        if (!host.isConnected) return;
        host.innerHTML = "";
        host.appendChild(img);
      };
      img.onerror = () => {
        index += 1;
        tryNext();
      };
      img.src = urls[index];
    };

    tryNext();
  }

  function savedVehicleForCard(card) {
    const title = card.querySelector(".v12-vehicle-title")?.textContent?.trim();
    if (!title) return null;
    return (APP.getSaved?.() || []).find((vehicle) => nameFor(vehicle.fields || {}) === title) || null;
  }

  function hydrateVisiblePhotos() {
    document.querySelectorAll(".v12-vehicle-card").forEach((card) => {
      const vehicle = savedVehicleForCard(card);
      if (vehicle) setPhoto(card.querySelector(".v12-vehicle-photo"), vehicle.fields || {});
    });

    const hero = document.querySelector(".v12-hero-photo");
    if (hero) setPhoto(hero, APP.getVehicle?.() || {});
  }

  function installGarageSearch() {
    const garage = document.querySelector("#quickSaved.v12-garage");
    if (!garage || garage.querySelector(".v12-garage-search")) return;

    const list = garage.querySelector(".v12-garage-list");
    if (!list) return;

    const search = document.createElement("div");
    search.className = "v12-garage-search";
    search.innerHTML = '<span>⌕</span><input type="search" placeholder="Search saved vehicles…" aria-label="Search saved vehicles">';
    list.insertAdjacentElement("beforebegin", search);

    search.querySelector("input").addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      garage.querySelectorAll(".v12-vehicle-card").forEach((card) => {
        card.hidden = query && !card.textContent.toLowerCase().includes(query);
      });
    });
  }

  function installBottomDock() {
    let dock = document.getElementById("v12BottomDock");
    if (!dock) {
      dock = document.createElement("nav");
      dock.id = "v12BottomDock";
      dock.className = "v12-bottom-dock no-print";
      dock.setAttribute("aria-label", "Primary app navigation");
      dock.innerHTML = `
        <button data-dock="garage"><span class="dock-icon">⌂</span><span>Garage</span></button>
        <button data-dock="saved"><span class="dock-icon">▣</span><span>Saved</span></button>
        <button data-dock="new" class="dock-new"><span class="dock-icon">＋</span><span>New</span></button>
        <button data-dock="menu"><span class="dock-icon">☰</span><span>Menu</span></button>`;
      document.body.appendChild(dock);

      dock.addEventListener("click", (event) => {
        const button = event.target.closest("[data-dock]");
        if (!button) return;
        const action = button.dataset.dock;
        if (action === "garage") APP.showPage?.("homePage");
        if (action === "saved") APP.showPage?.("savedPage");
        if (action === "new") {
          APP.clearCurrent?.();
          APP.showPage?.("profilePage");
        }
        if (action === "menu") document.getElementById("appMenu")?.click();
      });
    }

    const page = document.querySelector(".page.active")?.id;
    dock.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
    if (page === "homePage") dock.querySelector('[data-dock="garage"]')?.classList.add("active");
    if (page === "savedPage") dock.querySelector('[data-dock="saved"]')?.classList.add("active");
  }

  function polishHome() {
    if (!document.querySelector("#homePage.page.active")) return;
    const garage = document.querySelector("#quickSaved.v12-garage");
    if (!garage) return;

    const heading = garage.querySelector(".v12-garage-head h2");
    const sub = garage.querySelector(".v12-garage-head p");
    if (heading) heading.textContent = "My Garage";
    if (sub) sub.textContent = "All your saved vehicles, research and assessments in one place.";

    installGarageSearch();
    hydrateVisiblePhotos();
  }

  function refresh() {
    installBottomDock();
    polishHome();
    hydrateVisiblePhotos();
  }

  const observer = new MutationObserver(() => window.setTimeout(refresh, 0));
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  ["scorecard:core-ready", "scorecard:dashboardrender", "scorecard:vehiclechange", "scorecard:pathchange"].forEach((eventName) => {
    document.addEventListener(eventName, () => window.setTimeout(refresh, 50));
  });
})();
