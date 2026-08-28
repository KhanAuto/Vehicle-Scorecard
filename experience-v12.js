(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PATH_KEY = "vehicleScorecardAssessmentPath";
  const IMAGE_CACHE_KEY = "vehicleScorecardCommonsImagesV1";
  const AUTO_VALUE_KEY = "vehicleScorecardAutoValueV1";

  const FLOWS = {
    inspection: ["profilePage", "inspectionPage", "homePage"],
    value: ["profilePage", "marketPage", "dealPage", "homePage"],
    full: ["profilePage", "marketPage", "dealPage", "inspectionPage", "reconPage", "homePage"]
  };

  function path() {
    const saved = localStorage.getItem(PATH_KEY);
    if (["inspection", "value", "full"].includes(saved)) return saved;
    return APP.getLayer?.() === "condition" ? "inspection" : "full";
  }

  APP.getAssessmentPath = path;
  APP.setAssessmentPath = (next) => {
    if (!["inspection", "value", "full"].includes(next)) return;
    localStorage.setItem(PATH_KEY, next);
    document.dispatchEvent(new CustomEvent("scorecard:pathchange"));
  };

  function rawNumber(id) {
    const node = document.getElementById(id);
    if (!node) return 0;
    return Math.max(0, Number(String(node.value || "").replace(/[^0-9.-]/g, "")) || 0);
  }

  function average(values) {
    const good = values.filter((value) => Number.isFinite(value) && value > 0);
    if (!good.length) return 0;
    return good.reduce((sum, value) => sum + value, 0) / good.length;
  }

  function criticalFlags() {
    let count = 0;
    let structural = false;
    let powertrain = false;
    let safety = false;

    (APP.inspection?.groups || []).forEach((group) => {
      group.items.forEach((item, index) => {
        if (!item.critical) return;
        const rating = APP.state?.ratings?.[`${group.id}_${index}`];
        if (!rating || rating.value === 0 || rating.value > item.max / 3) return;
        count += 1;
        if (group.id === "exterior") structural = true;
        if (group.id === "engine") powertrain = true;
        if (["wear", "road"].includes(group.id)) safety = true;
      });
    });

    return { count, structural, powertrain, safety };
  }

  const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];

  function numericLetter(score) {
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

  function capGrade(letter, cap) {
    const current = GRADE_ORDER.indexOf(letter);
    const limit = GRADE_ORDER.indexOf(cap);
    return current < limit ? cap : letter;
  }

  function conditionAssessment() {
    const overall = APP.inspection?.getOverallScore?.() || { pct: null, coverage: 0, answered: 0, total: 0 };
    if (overall.pct === null) {
      return { ...overall, letter: "—", descriptor: "Not inspected", risk: "Unknown", flags: criticalFlags() };
    }

    const flags = criticalFlags();
    let letter = numericLetter(overall.pct);

    if (flags.count >= 3) letter = "F";
    else if (flags.count === 2) letter = capGrade(letter, "D");
    else if (flags.count === 1) {
      if (flags.structural || flags.safety) letter = capGrade(letter, "D+");
      else if (flags.powertrain) letter = capGrade(letter, "C-");
    }

    const descriptor =
      letter.startsWith("A") ? "Excellent condition" :
      letter.startsWith("B") ? "Good condition" :
      letter.startsWith("C") ? "Fair condition" :
      letter.startsWith("D") ? "Poor condition" : "Major deficiencies";

    const risk =
      flags.count >= 2 ? "High" :
      flags.count === 1 ? "Elevated" :
      overall.pct >= 85 ? "Low" :
      overall.pct >= 75 ? "Moderate" :
      overall.pct >= 65 ? "Elevated" : "High";

    return { ...overall, letter, descriptor, risk, flags };
  }

  APP.conditionAssessment = conditionAssessment;

  function marketSnapshot() {
    const trade = average([rawNumber("kbbTrade"), rawNumber("edmundsTrade"), rawNumber("instantOffer")]);
    const privateGuide = average([rawNumber("kbbPrivate"), rawNumber("edmundsPrivate"), rawNumber("privateComp")]);
    const local = average([rawNumber("dealer1"), rawNumber("dealer2"), rawNumber("privateComp")]);
    let baseline = average([privateGuide, local]);
    if (!baseline && trade) baseline = trade * 1.15;

    const condition = conditionAssessment();
    const inspected = condition.pct !== null && condition.coverage >= 25;
    const factor = !inspected ? 1 :
      condition.pct >= 95 ? 1.03 :
      condition.pct >= 90 ? 1.01 :
      condition.pct >= 85 ? 0.98 :
      condition.pct >= 80 ? 0.95 :
      condition.pct >= 75 ? 0.91 :
      condition.pct >= 70 ? 0.87 :
      condition.pct >= 60 ? 0.80 : 0.70;

    const recon = APP.getReconTotals?.() || { required: 0, known: 0 };
    const conditionAdjusted = baseline ? baseline * factor : 0;
    const asIs = Math.max(0, conditionAdjusted - (recon.required || 0));
    const expectedSale = conditionAdjusted ? conditionAdjusted * 0.985 : 0;
    const quickSale = asIs ? asIs * 0.91 : 0;
    const list = conditionAdjusted ? conditionAdjusted * 1.035 : 0;

    const refs = ["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"]
      .filter((id) => rawNumber(id) > 0).length;

    const confidence = inspected
      ? (refs >= 4 && condition.coverage >= 75 ? "High" : refs >= 2 ? "Moderate" : "Low")
      : (refs >= 4 ? "Moderate" : refs >= 2 ? "Preliminary" : "Low");

    return { trade, privateGuide, local, baseline, conditionAdjusted, asIs, expectedSale, quickSale, list, refs, inspected, confidence, condition };
  }

  APP.marketSnapshot = marketSnapshot;

  function setAutoValue(id, value) {
    const input = document.getElementById(id);
    if (!input || !value) return;
    if (input.dataset.userEdited === "true") return;
    input.value = String(Math.round(value));
    input.dataset.autoDerived = "true";
  }

  function syncDerivedValues() {
    const snap = marketSnapshot();
    if (!snap.baseline) return;

    setAutoValue("buyResale", snap.expectedSale);
    setAutoValue("sellAsIs", snap.asIs);
    setAutoValue("sellPostRecon", snap.conditionAdjusted);
    setAutoValue("sellTarget", snap.expectedSale);
    setAutoValue("sellList", snap.list);
    setAutoValue("sellQuick", snap.quickSale);
    APP.updateValue?.();
    localStorage.setItem(AUTO_VALUE_KEY, JSON.stringify({ at: Date.now(), baseline: snap.baseline }));
  }

  function watchUserEdits() {
    ["buyResale","sellAsIs","sellPostRecon","sellTarget","sellList","sellQuick"].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("input", () => {
        if (input.dataset.autoDerived === "true") {
          input.dataset.autoDerived = "false";
          input.dataset.userEdited = "true";
        }
      });
    });
  }

  function money(value) {
    return value ? APP.money(value) : "—";
  }

  function pricePosition() {
    const snap = marketSnapshot();
    const ask = rawNumber("buyAsk");
    if (!ask || !snap.asIs) return "Not enough data";
    const delta = ask - snap.asIs;
    const pct = snap.asIs ? delta / snap.asIs * 100 : 0;
    if (pct <= -8) return "Attractive asking price";
    if (pct <= 3) return "Near estimated value";
    if (pct <= 10) return "Slightly high";
    return "High vs estimated value";
  }

  function renderMarketPreview() {
    const card = document.querySelector("#marketPage > .card");
    if (!card) return;
    let panel = document.getElementById("v12PricingPreview");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "v12PricingPreview";
      panel.className = "v12-price-preview";
      const status = document.getElementById("marketStatus");
      status?.insertAdjacentElement("afterend", panel);
    }

    const snap = marketSnapshot();
    const mode = APP.getMode?.() || "buy";
    const ask = rawNumber("buyAsk");
    panel.innerHTML = `
      <div class="v12-price-preview-head">
        <div><div class="v12-price-preview-title">Preliminary Pricing Assessment</div><div class="v12-price-preview-sub">${snap.inspected ? "Uses the physical inspection currently on file." : "Assumes fair/typical condition for age and mileage until a physical inspection is completed."}</div></div>
        <span class="v12-pill ${snap.refs >= 3 ? "green" : "amber"}">${snap.confidence} confidence</span>
      </div>
      <div class="v12-price-grid">
        <div class="v12-price-cell"><small>Market baseline</small><strong>${money(snap.baseline)}</strong></div>
        <div class="v12-price-cell"><small>${snap.inspected ? "Condition-adjusted" : "Fair-condition estimate"}</small><strong>${money(snap.conditionAdjusted)}</strong></div>
        <div class="v12-price-cell"><small>Market references</small><strong>${snap.refs || "0"}</strong></div>
        <div class="v12-price-cell"><small>${mode === "buy" ? "Ask position" : "Estimated as-is"}</small><strong>${mode === "buy" ? (ask ? pricePosition() : "Enter ask on Value") : money(snap.asIs)}</strong></div>
      </div>`;
  }

  function gradeClass(letter) {
    if (letter.startsWith("A")) return "v12-grade-a";
    if (letter.startsWith("B")) return "v12-grade-b";
    if (letter.startsWith("C")) return "v12-grade-c";
    if (letter.startsWith("D")) return "v12-grade-d";
    return "v12-grade-f";
  }

  function imageCache() {
    try { return JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || "{}"); }
    catch { return {}; }
  }

  function saveImageCache(cache) {
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
  }

  function vehicleKey(vehicle) {
    const f = vehicle.fields || vehicle;
    return [f.year, f.make, f.model].filter(Boolean).join("|").toLowerCase();
  }

  async function commonsImage(vehicle) {
    const f = vehicle.fields || vehicle;
    if (!f.make || !f.model) return "";
    const key = vehicleKey(vehicle);
    const cache = imageCache();
    if (cache[key] !== undefined) return cache[key];

    const terms = [f.year, f.make, f.model, "automobile"].filter(Boolean).join(" ");
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: terms,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "640",
      origin: "*",
      format: "json"
    }).toString();

    try {
      const response = await fetch(url.toString(), { cache: "force-cache" });
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {});
      const pick = pages.find((page) => {
        const info = page.imageinfo?.[0];
        return info && String(info.mime || "").startsWith("image/") && !/logo|badge|diagram|interior|engine/i.test(page.title || "");
      });
      const info = pick?.imageinfo?.[0];
      const image = info?.thumburl || info?.url || "";
      cache[key] = image;
      saveImageCache(cache);
      return image;
    } catch {
      cache[key] = "";
      saveImageCache(cache);
      return "";
    }
  }

  function vehicleName(vehicle) {
    const f = vehicle.fields || vehicle;
    return [f.year, f.make, f.model, f.trim].filter(Boolean).join(" ") || "Saved Vehicle";
  }

  function vehicleMileage(vehicle) {
    const f = vehicle.fields || vehicle;
    return vehicle.mileageUnknown ? "Mileage unknown" : f.mileage ? `${Number(f.mileage).toLocaleString()} mi` : "Mileage not entered";
  }

  function savedGrade(vehicle) {
    const raw = String(vehicle.score?.pct || "").replace(/[^0-9]/g, "");
    const score = Number(raw) || null;
    return score === null ? "—" : numericLetter(score);
  }

  function pathLabel(savedPath, vehicle) {
    const p = savedPath || vehicle.assessmentPath || (vehicle.layer === "condition" ? "inspection" : "full");
    return p === "inspection" ? "Inspection Only" : p === "value" ? "Value Analysis Only" : "Full Assessment";
  }

  function renderRail(savedPath, vehicle) {
    const p = savedPath || vehicle.assessmentPath || (vehicle.layer === "condition" ? "inspection" : "full");
    const ratings = vehicle.ratings || {};
    const inspected = Object.keys(ratings).length > 0;
    const hasMarket = ["kbbPrivate","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"].some((id) => Number(vehicle.fields?.[id]) > 0);
    const hasValue = Boolean(Number(vehicle.fields?.buyAsk) || Number(vehicle.fields?.sellTarget) || Number(vehicle.fields?.buyResale));
    const hasRecon = Object.values(vehicle.recon || {}).some((x) => x.status && x.status !== "none");
    const steps = p === "inspection"
      ? [["Vehicle",true],["Inspection",inspected],["Report",inspected]]
      : p === "value"
        ? [["Vehicle",true],["Market",hasMarket],["Value",hasValue],["Report",hasValue]]
        : [["Vehicle",true],["Market",hasMarket],["Value",hasValue],["Inspection",inspected],["Recon",hasRecon],["Report",inspected && hasValue]];
    return `<div class="v12-progress-rail">${steps.map(([label, done], index) => `<div class="v12-progress-node ${done ? "done" : index === steps.findIndex((x) => !x[1]) ? "active" : ""}"><span class="v12-progress-dot">${done ? "✓" : ""}</span></div>`).join("")}</div>`;
  }

  async function hydrateCardImage(card, vehicle) {
    const img = await commonsImage(vehicle);
    if (!img || !card.isConnected) return;
    const host = card.querySelector(".v12-vehicle-photo");
    if (host) host.innerHTML = `<img src="${img}" alt="Representative ${vehicleName(vehicle)}" loading="lazy" referrerpolicy="no-referrer">`;
  }

  function renderGarage() {
    const host = document.getElementById("quickSaved");
    if (!host) return;
    const saved = APP.getSaved?.().slice().reverse() || [];
    host.className = "card v12-garage";
    host.innerHTML = `
      <div class="v12-garage-head"><div><h2>My Garage</h2><p>Saved vehicles, research and assessments in one place.</p></div><div class="v12-garage-actions"><button id="v12AllVehicles" class="btn">View All</button></div></div>
      <div class="v12-start-panel">
        <button class="v12-start-choice inspection" data-v12-start="inspection"><span class="v12-choice-icon">✓</span><b>Inspection Only</b><span>Assess physical condition, maintenance and risk when the vehicle is in front of you.</span></button>
        <button class="v12-start-choice value" data-v12-start="value"><span class="v12-choice-icon">$</span><b>Value Analysis Only</b><span>Decide whether an online listing is worth your time before arranging an inspection.</span></button>
        <button class="v12-start-choice full" data-v12-start="full"><span class="v12-choice-icon">◆</span><b>Full Assessment</b><span>Start with pricing, layer on inspection findings, then produce the complete decision breakdown.</span></button>
      </div>
      <div class="v12-garage-list">${saved.length ? "" : '<div class="muted">No saved vehicles yet. Start with one of the options above.</div>'}</div>`;

    document.querySelector("#homePage .dashboard-grid")?.classList.add("v12-hidden");

    const list = host.querySelector(".v12-garage-list");
    saved.slice(0, 8).forEach((vehicle) => {
      const scoreText = String(vehicle.score?.pct || "").replace(/\/100/g, "");
      const score = Number(String(scoreText).replace(/[^0-9]/g, "")) || null;
      const grade = savedGrade(vehicle);
      const mode = vehicle.mode === "sell" ? "Selling" : vehicle.mode === "buy" ? "Buying" : "Inspection";
      const card = document.createElement("div");
      card.className = "v12-vehicle-card";
      card.innerHTML = `
        <div class="v12-vehicle-photo"><div class="v12-photo-empty">Representative vehicle image<br>Wikimedia Commons</div></div>
        <div><div class="v12-vehicle-title">${vehicleName(vehicle)}</div><div class="v12-vehicle-meta">${vehicleMileage(vehicle)}${vehicle.fields?.vin ? ` · ${vehicle.fields.vin}` : ""}</div>
          <div class="v12-vehicle-badges"><span class="v12-pill blue">${pathLabel(null, vehicle)}</span><span class="v12-pill">${mode}</span></div>
          <div class="v12-score-row"><div class="v12-score-cell"><small>Condition</small><strong>${score ? `${score}/100` : "Not inspected"}</strong></div><div class="v12-score-cell"><small>Grade</small><strong class="v12-grade-badge ${gradeClass(grade)}">${grade}</strong></div><div class="v12-score-cell"><small>Decision</small><strong>${vehicle.fields?.decision || "In Progress"}</strong></div></div>
          ${renderRail(null, vehicle)}
        </div>`;
      card.addEventListener("click", async () => { await APP.loadSaved(vehicle.id); APP.showPage?.("homePage"); });
      list.appendChild(card);
      hydrateCardImage(card, vehicle);
    });

    host.querySelector("#v12NewVehicle")?.addEventListener("click", () => startPath("full"));
    host.querySelector("#v12AllVehicles")?.addEventListener("click", () => APP.showPage?.("savedPage"));
    host.querySelectorAll("[data-v12-start]").forEach((button) => button.addEventListener("click", () => startPath(button.dataset.v12Start)));
  }

  function startPath(nextPath) {
    APP.clearCurrent?.();
    APP.setAssessmentPath(nextPath);
    if (nextPath === "inspection") APP.setLayer?.("condition");
    else APP.setLayer?.("value");
    APP.showPage?.("profilePage");
  }

  async function currentVehicleImage() {
    return commonsImage({ fields: APP.getVehicle?.() || {} });
  }

  async function augmentReport() {
    const report = document.getElementById("dashboardReport");
    if (!report || !APP.getVehicle) return;
    const vehicle = APP.getVehicle();
    if (!vehicle.year && !vehicle.make && !vehicle.model) return;
    if (report.querySelector(".v12-vehicle-hero")) return;

    const condition = conditionAssessment();
    const market = marketSnapshot();
    const mode = APP.getMode?.() || "inspect";
    const recon = APP.getReconTotals?.() || { known: 0, required: 0 };
    const ask = rawNumber("buyAsk");
    const maxBuy = rawNumber("calculatedMaxBuy");
    const hero = document.createElement("div");
    hero.className = "v12-vehicle-hero";
    hero.innerHTML = `
      <div class="v12-hero-photo"><div class="v12-photo-empty">Loading representative vehicle image…</div></div>
      <div><div class="v12-hero-title">${[vehicle.year,vehicle.make,vehicle.model,vehicle.trim].filter(Boolean).join(" ")}</div><div class="v12-hero-meta">${vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} miles` : "Mileage unknown"}${APP.value("vin") ? ` · ${APP.value("vin")}` : ""}</div>
      <div class="v12-hero-tags"><span class="v12-pill blue">${pathLabel(path(), {})}</span><span class="v12-pill">${mode === "buy" ? "Buying" : mode === "sell" ? "Selling" : "Condition"}</span><span class="v12-pill ${condition.flags.count ? "amber" : "green"}">${condition.flags.count} critical flags</span></div></div>`;
    report.prepend(hero);

    const img = await currentVehicleImage();
    if (img && hero.isConnected) hero.querySelector(".v12-hero-photo").innerHTML = `<img src="${img}" alt="Representative ${vehicle.make} ${vehicle.model}" referrerpolicy="no-referrer">`;

    const section = document.createElement("div");
    section.className = "v12-dashboard-sections";
    section.innerHTML = `
      <div class="v12-section"><div class="v12-section-head">Condition Summary</div><div class="v12-section-body"><div class="v12-summary-grid">
        <div class="v12-summary-metric"><small>Condition Score</small><strong class="green">${condition.pct === null ? "—" : `${condition.pct}/100`}</strong><div class="muted">${condition.descriptor}</div></div>
        <div class="v12-summary-metric"><small>Letter Grade</small><strong class="v12-grade-inline ${gradeClass(condition.letter)}"><span class="letter">${condition.letter}</span></strong></div>
        <div class="v12-summary-metric"><small>Risk Level</small><strong class="${condition.risk === "Low" ? "green" : "amber"}">${condition.risk}</strong><div class="muted">${condition.flags.count} critical concern${condition.flags.count === 1 ? "" : "s"}</div></div>
      </div><div class="v12-confidence"><div class="v12-confidence-head"><span>Inspection Confidence</span><span>${condition.coverage}% · ${condition.answered}/${condition.total} checks</span></div><div class="v12-confidence-track"><div class="v12-confidence-fill" style="width:${condition.coverage}%"></div></div></div></div></div>
      <div class="v12-section"><div class="v12-section-head">Pricing & Decision Context</div><div class="v12-section-body"><div class="v12-summary-grid">
        <div class="v12-summary-metric"><small>Estimated As-Is</small><strong>${money(market.asIs)}</strong><div class="muted">${market.inspected ? "Condition-adjusted" : "Fair-condition assumption"}</div></div>
        <div class="v12-summary-metric"><small>${mode === "buy" ? "Seller Asking" : "Expected Sale"}</small><strong>${mode === "buy" ? money(ask) : money(market.expectedSale)}</strong></div>
        <div class="v12-summary-metric"><small>${mode === "buy" ? "Max Recommended" : "Known Recon"}</small><strong>${mode === "buy" ? money(maxBuy) : money(recon.known)}</strong></div>
      </div><div class="v12-action-panel"><button data-v12-action="inspection">Run / Update Inspection</button><button data-v12-action="value">Update Value Analysis</button><button class="primary" data-v12-action="full">Run Full Assessment</button></div></div></div>`;
    hero.insertAdjacentElement("afterend", section);
    section.querySelectorAll("[data-v12-action]").forEach((button) => button.addEventListener("click", () => switchPath(button.dataset.v12Action)));
  }

  function switchPath(nextPath) {
    APP.setAssessmentPath(nextPath);
    if (nextPath === "inspection") {
      APP.setLayer?.("condition");
      APP.showPage?.("inspectionPage");
    } else {
      APP.setLayer?.("value");
      APP.showPage?.("marketPage");
    }
    APP.saveCurrent?.();
  }

  function installBrand() {
    const mark = document.querySelector(".brandmark");
    if (mark) {
      mark.classList.add("v12-brandmark");
      mark.innerHTML = '<img src="icon-192.png" alt="">';
    }
    const drawer = document.querySelector(".drawer-emblem");
    if (drawer) drawer.innerHTML = '<img src="icon-192.png" alt="" style="width:38px;height:38px">';
  }

  function applyDarkDefault() {
    if (!localStorage.getItem(APP.constants.THEME_KEY)) {
      localStorage.setItem(APP.constants.THEME_KEY, "dark");
      document.documentElement.dataset.theme = "dark";
    }
  }

  function patchSnapshot() {
    const originalSnapshot = APP.snapshot;
    if (typeof originalSnapshot === "function" && !originalSnapshot._v12) {
      const wrapped = () => {
        const snap = originalSnapshot();
        snap.assessmentPath = path();
        return snap;
      };
      wrapped._v12 = true;
      APP.snapshot = wrapped;
    }

    const originalLoad = APP.loadSaved;
    if (typeof originalLoad === "function" && !originalLoad._v12) {
      const wrappedLoad = async (id) => {
        const vehicle = APP.getSaved?.().find((item) => item.id === id);
        if (vehicle?.assessmentPath) localStorage.setItem(PATH_KEY, vehicle.assessmentPath);
        const result = await originalLoad(id);
        document.dispatchEvent(new CustomEvent("scorecard:pathchange"));
        return result;
      };
      wrappedLoad._v12 = true;
      APP.loadSaved = wrappedLoad;
    }

    const originalClear = APP.clearCurrent;
    if (typeof originalClear === "function" && !originalClear._v12) {
      const wrappedClear = () => {
        const result = originalClear();
        localStorage.removeItem(PATH_KEY);
        return result;
      };
      wrappedClear._v12 = true;
      APP.clearCurrent = wrappedClear;
    }
  }

  function hideDerivedJudgmentInputs() {
    ["buyResale","sellAsIs","sellPostRecon","sellTarget","sellList","sellQuick"].forEach((id) => {
      const label = document.getElementById(id)?.closest("label");
      if (label) label.classList.add("v12-derived");
    });

    const card = document.querySelector("#dealPage > .card");
    if (!card) return;
    let banner = document.getElementById("v12EstimateBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "v12EstimateBanner";
      banner.className = "v12-estimate-banner";
      document.getElementById("valueReadiness")?.insertAdjacentElement("afterend", banner);
    }
    const snap = marketSnapshot();
    banner.innerHTML = `<div class="muted">APP ESTIMATED CURRENT VALUE</div><div class="big">${money(snap.asIs)}</div><div class="note">${snap.inspected ? `Adjusted using ${snap.condition.pct}/100 (${snap.condition.letter}) physical condition and known repair needs.` : "Preliminary estimate assumes fair/typical physical condition for this vehicle's age and mileage. Complete an inspection to refine it."} Based on ${snap.refs} entered market reference${snap.refs === 1 ? "" : "s"}.</div>`;
  }

  function syncTopScore() {
    const condition = conditionAssessment();
    const top = document.getElementById("topScore");
    if (top) top.textContent = condition.pct === null ? "Condition —" : `Condition ${condition.pct}/100 · ${condition.letter}`;
  }

  function rerender() {
    syncDerivedValues();
    renderMarketPreview();
    hideDerivedJudgmentInputs();
    syncTopScore();
    if (document.querySelector("#homePage.page.active")) {
      renderGarage();
      window.setTimeout(augmentReport, 25);
    }
  }

  document.addEventListener("input", (event) => {
    if (event.target.closest("#marketPage") || event.target.closest("#dealPage") || event.target.closest("#reconPage")) window.setTimeout(rerender, 0);
  });
  document.addEventListener("change", (event) => {
    if (event.target.closest("#marketPage") || event.target.closest("#dealPage") || event.target.closest("#reconPage")) window.setTimeout(rerender, 0);
  });
  ["scorecard:datachange","scorecard:inspectionchange","scorecard:workflowchange","scorecard:pathchange","scorecard:dashboardrender","scorecard:vehiclechange"].forEach((name) => document.addEventListener(name, () => window.setTimeout(rerender, 0)));

  document.addEventListener("scorecard:core-ready", () => {
    applyDarkDefault();
    patchSnapshot();
    installBrand();
    watchUserEdits();
    window.setTimeout(rerender, 75);
  });
})();
