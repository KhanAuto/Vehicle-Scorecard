(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PATH_KEY = "vehicleScorecardAssessmentPath";
  const IMAGE_CACHE_KEY = "vehicleScorecardCommonsImagesV1";
  let syncingDerived = false;

  function num(id) {
    const node = document.getElementById(id);
    return Math.max(0, Number(String(node?.value || "").replace(/[^0-9.-]/g, "")) || 0);
  }

  function avg(values) {
    const valid = values.filter((v) => Number.isFinite(v) && v > 0);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  }

  function money(value) {
    return value > 0 ? APP.money(value) : "—";
  }

  function path() {
    const stored = localStorage.getItem(PATH_KEY);
    return ["inspection","value","full"].includes(stored)
      ? stored
      : APP.getLayer?.() === "condition" ? "inspection" : "full";
  }

  const grades = ["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","F"];

  function numericGrade(score) {
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

  function gradeCap(letter, cap) {
    return grades.indexOf(letter) < grades.indexOf(cap) ? cap : letter;
  }

  function criticalFlags() {
    let count = 0;
    let structural = false;
    let safety = false;
    let powertrain = false;
    (APP.inspection?.groups || []).forEach((group) => {
      group.items.forEach((item, index) => {
        if (!item.critical) return;
        const rating = APP.state?.ratings?.[`${group.id}_${index}`];
        if (!rating || rating.value === 0 || rating.value > item.max / 3) return;
        count += 1;
        if (group.id === "exterior") structural = true;
        if (["wear","road"].includes(group.id)) safety = true;
        if (group.id === "engine") powertrain = true;
      });
    });
    return { count, structural, safety, powertrain };
  }

  function condition() {
    const score = APP.inspection?.getOverallScore?.() || { pct: null, coverage: 0, answered: 0, total: 0 };
    const flags = criticalFlags();
    if (score.pct === null) return { ...score, letter: "—", descriptor: "Not inspected", risk: "Unknown", flags };

    let letter = numericGrade(score.pct);
    if (flags.count >= 3) letter = "F";
    else if (flags.count === 2) letter = gradeCap(letter, "D");
    else if (flags.count === 1 && (flags.structural || flags.safety)) letter = gradeCap(letter, "D+");
    else if (flags.count === 1 && flags.powertrain) letter = gradeCap(letter, "C-");

    const descriptor = letter.startsWith("A") ? "Excellent condition" :
      letter.startsWith("B") ? "Good condition" :
      letter.startsWith("C") ? "Fair condition" :
      letter.startsWith("D") ? "Poor condition" : "Major deficiencies";

    const risk = flags.count >= 2 ? "High" : flags.count === 1 ? "Elevated" :
      score.pct >= 85 ? "Low" : score.pct >= 75 ? "Moderate" : score.pct >= 65 ? "Elevated" : "High";

    return { ...score, letter, descriptor, risk, flags };
  }

  APP.conditionAssessment = condition;

  function market() {
    const trade = avg([num("kbbTrade"), num("edmundsTrade"), num("instantOffer")]);
    const privateGuide = avg([num("kbbPrivate"), num("edmundsPrivate"), num("privateComp")]);
    const local = avg([num("dealer1"), num("dealer2"), num("privateComp")]);
    let baseline = avg([privateGuide, local]);
    if (!baseline && trade) baseline = trade * 1.15;

    const currentMileage = Number(APP.value?.("mileage")) || 0;
    const comparableMileage = num("compMileage");
    let mileageFactor = 1;
    if (baseline && currentMileage && comparableMileage) {
      const diff = currentMileage - comparableMileage;
      mileageFactor = Math.max(0.85, Math.min(1.15, 1 - (diff / 10000) * 0.015));
    }

    const c = condition();
    const inspected = c.pct !== null && c.coverage >= 25;
    const valueOnly = path() === "value";
    const reportedCondition = valueOnly ? String(APP.value?.("knownCondition") || "") : "";
    const reportedFactors = { excellent: 1.03, good: 1.00, fair: 0.95, poor: 0.85 };
    const conditionFactor = inspected
      ? (c.pct >= 95 ? 1.03 : c.pct >= 90 ? 1.01 : c.pct >= 85 ? 0.98 :
        c.pct >= 80 ? 0.95 : c.pct >= 75 ? 0.91 : c.pct >= 70 ? 0.87 :
        c.pct >= 60 ? 0.80 : 0.70)
      : (reportedFactors[reportedCondition] || 1);
    const conditionBasis = inspected ? "inspected" : reportedCondition ? "reported" : "assumed";

    const recon = APP.getReconTotals?.() || { required: 0, known: 0 };
    const knownRepairEstimate = valueOnly ? num("knownRepairEstimate") : 0;
    const fairEstimate = baseline * mileageFactor;
    const adjusted = fairEstimate * conditionFactor;
    const asIs = Math.max(0, adjusted - (inspected ? (recon.required || 0) : knownRepairEstimate));
    const expectedSale = adjusted ? adjusted * 0.985 : 0;
    const list = adjusted ? adjusted * 1.035 : 0;
    const quick = asIs ? asIs * 0.91 : 0;
    const refs = ["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"].filter((id) => num(id) > 0).length;
    const confidence = inspected
      ? refs >= 4 && c.coverage >= 75 ? "High" : refs >= 2 ? "Moderate" : "Low"
      : refs >= 4 ? "Moderate" : refs >= 2 ? "Preliminary" : "Low";

    return { trade, privateGuide, local, baseline, fairEstimate, adjusted, asIs, expectedSale, list, quick, refs, confidence, inspected, mileageFactor, condition: c, recon, conditionBasis, reportedCondition, knownRepairEstimate };
  }

  APP.marketSnapshot = market;

  function setAuto(id, value) {
    const input = document.getElementById(id);
    if (!input || !value || input.dataset.userEdited === "true") return false;
    const next = String(Math.round(value));
    if (input.value === next) return false;
    input.value = next;
    input.dataset.autoDerived = "true";
    return true;
  }

  function syncDerived() {
    if (syncingDerived) return;
    const m = market();
    if (!m.baseline) return;
    let changed = false;
    changed = setAuto("buyResale", m.expectedSale) || changed;
    changed = setAuto("sellAsIs", m.asIs) || changed;
    changed = setAuto("sellPostRecon", m.adjusted) || changed;
    changed = setAuto("sellTarget", m.expectedSale) || changed;
    changed = setAuto("sellList", m.list) || changed;
    changed = setAuto("sellQuick", m.quick) || changed;
    if (changed) {
      syncingDerived = true;
      try { APP.updateValue?.(); } finally { window.setTimeout(() => { syncingDerived = false; }, 0); }
    }
  }

  function watchDerivedInputs() {
    ["buyResale","sellAsIs","sellPostRecon","sellTarget","sellList","sellQuick"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", (event) => {
        if (event.isTrusted && event.target.dataset.autoDerived === "true") {
          event.target.dataset.userEdited = "true";
          event.target.dataset.autoDerived = "false";
        }
      });
    });
  }

  function gradeClass(letter) {
    if (letter.startsWith("A")) return "v12-grade-a";
    if (letter.startsWith("B")) return "v12-grade-b";
    if (letter.startsWith("C")) return "v12-grade-c";
    if (letter.startsWith("D")) return "v12-grade-d";
    return "v12-grade-f";
  }

  function pathName(p = path()) {
    return p === "inspection" ? "Inspection Only" : p === "value" ? "Value Analysis Only" : "Full Assessment";
  }

  function installBrand() {
    const mark = document.querySelector(".brandmark");
    if (mark) {
      mark.classList.add("v12-brandmark");
      mark.innerHTML = '<img src="icon-192.png" alt="Vehicle Scorecard">';
    }
    const drawer = document.querySelector(".drawer-emblem");
    if (drawer) drawer.innerHTML = '<img src="icon-192.png" alt="" style="width:40px;height:40px">';
  }

  function darkDefault() {
    if (!localStorage.getItem(APP.constants.THEME_KEY)) {
      localStorage.setItem(APP.constants.THEME_KEY, "dark");
      document.documentElement.dataset.theme = "dark";
    }
  }

  function patchPersistence() {
    const originalSnapshot = APP.snapshot;
    if (typeof originalSnapshot === "function" && !originalSnapshot._v12b) {
      const wrapped = () => {
        const snap = originalSnapshot();
        snap.assessmentPath = path();
        snap.conditionGrade = condition().letter;
        return snap;
      };
      wrapped._v12b = true;
      APP.snapshot = wrapped;
    }

    const originalLoad = APP.loadSaved;
    if (typeof originalLoad === "function" && !originalLoad._v12b) {
      const wrappedLoad = async (id, destinationPage) => {
        const vehicle = APP.getSaved?.().find((v) => v.id === id);
        const inspectionWasAdded = Boolean(
          vehicle?.moduleCoverage?.inspectionStarted ||
          (Object.keys(vehicle?.ratings || {}).length && vehicle?.assessmentPath === "value")
        );
        const restoredPath = inspectionWasAdded ? "full" : vehicle?.assessmentPath;
        if (restoredPath) localStorage.setItem(PATH_KEY, restoredPath);
        const result = await originalLoad(id, destinationPage);
        if (inspectionWasAdded) {
          APP.setAssessmentPath?.("full");
          APP.setLayer?.("value");
        }
        document.dispatchEvent(new CustomEvent("scorecard:pathchange"));
        return result;
      };
      wrappedLoad._v12b = true;
      APP.loadSaved = wrappedLoad;
    }
  }

  function imageCache() {
    try { return JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || "{}"); } catch { return {}; }
  }

  async function commonsImage(fields) {
    if (!fields?.make || !fields?.model) return "";
    const key = [fields.year, fields.make, fields.model].filter(Boolean).join("|").toLowerCase();
    const cache = imageCache();
    if (cache[key] !== undefined) return cache[key];

    const query = [fields.year, fields.make, fields.model, "car"].filter(Boolean).join(" ");
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "10",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "720",
      origin: "*",
      format: "json"
    }).toString();

    try {
      const response = await fetch(endpoint.toString(), { cache: "force-cache" });
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {});
      const make = String(fields.make).toLowerCase();
      const model = String(fields.model).toLowerCase();
      const ranked = pages.map((page) => {
        const title = String(page.title || "").toLowerCase();
        const info = page.imageinfo?.[0];
        let rank = 0;
        if (title.includes(make)) rank += 4;
        if (title.includes(model)) rank += 5;
        if (fields.year && title.includes(String(fields.year))) rank += 2;
        if (/front|rear|side|sedan|coupe|suv|wagon|roadster|vehicle|car/.test(title)) rank += 1;
        if (/logo|badge|emblem|interior|engine|diagram|drawing|wheel|dashboard/.test(title)) rank -= 8;
        if (!String(info?.mime || "").startsWith("image/")) rank -= 20;
        return { page, rank };
      }).sort((a, b) => b.rank - a.rank);
      const info = ranked[0]?.page?.imageinfo?.[0];
      const url = info?.thumburl || info?.url || "";
      cache[key] = url;
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
      return url;
    } catch {
      cache[key] = "";
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
      return "";
    }
  }

  function vehicleName(vehicle) {
    const f = vehicle.fields || vehicle;
    return [f.year, f.make, f.model, f.trim].filter(Boolean).join(" ") || "Saved Vehicle";
  }

  function savedScore(vehicle) {
    const raw = String(vehicle.score?.pct || "").replace(/[^0-9]/g, "");
    return Number(raw) || 0;
  }

  function progressRail(vehicle) {
    const p = vehicle.assessmentPath || (vehicle.layer === "condition" ? "inspection" : "full");
    const inspected = Object.keys(vehicle.ratings || {}).length > 0;
    const hasMarket = ["kbbPrivate","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"].some((id) => Number(vehicle.fields?.[id]) > 0);
    const hasValue = Boolean(Number(vehicle.fields?.buyAsk) || Number(vehicle.fields?.sellTarget) || Number(vehicle.fields?.buyResale));
    const hasRecon = Object.values(vehicle.recon || {}).some((x) => x.status && x.status !== "none");
    const steps = p === "inspection"
      ? [["Vehicle",true],["Inspection",inspected],["Report",inspected]]
      : p === "value"
        ? [["Vehicle",true],["Market",hasMarket],["Value",hasValue],["Report",hasValue]]
        : [["Vehicle",true],["Inspection",inspected],["Recon",hasRecon],["Market",hasMarket],["Value",hasValue],["Report",inspected && hasValue]];
    const firstOpen = steps.findIndex((x) => !x[1]);
    return `<div class="v12-progress-rail">${steps.map(([label, done], i) => `<div class="v12-progress-node ${done ? "done" : i === firstOpen ? "active" : ""}" title="${label}"><span class="v12-progress-dot">${done ? "✓" : ""}</span></div>`).join("")}</div>`;
  }

  function launchNew(p) {
    APP.clearCurrent?.();
    localStorage.setItem(PATH_KEY, p);
    if (p === "inspection") APP.setLayer?.("condition"); else APP.setLayer?.("value");
    APP.showPage?.("profilePage");
  }

  async function hydrateImage(host, fields) {
    const url = await commonsImage(fields);
    if (url && host?.isConnected) host.innerHTML = `<img src="${url}" alt="Representative ${vehicleName(fields)}" loading="lazy" referrerpolicy="no-referrer">`;
  }

  function renderGarage() {
    const host = document.getElementById("quickSaved");
    if (!host) return;
    const saved = APP.getSaved?.().slice().reverse() || [];
    host.className = "card v12-garage";
    host.innerHTML = `
      <div class="v12-garage-head"><div><h2>My Garage</h2><p>Research, inspect and revisit saved vehicles without starting over.</p></div><div class="v12-garage-actions"><button class="btn" id="v12All">View All</button></div></div>
      <div class="v12-start-panel">
        <button class="v12-start-choice inspection" data-v12-launch="inspection"><span class="v12-choice-icon">✓</span><b>Inspection Only</b><span>Vehicle is in front of you. Focus on physical condition, maintenance and risk.</span></button>
        <button class="v12-start-choice value" data-v12-launch="value"><span class="v12-choice-icon">$</span><b>Value Analysis Only</b><span>Screen an online listing first and decide whether it is worth pursuing.</span></button>
        <button class="v12-start-choice full" data-v12-launch="full"><span class="v12-choice-icon">◆</span><b>Full Assessment</b><span>Inspect first, capture recon needs, then use market and value data for the complete decision report.</span></button>
      </div>
      <div class="v12-garage-list"></div>`;

    document.querySelector("#homePage .dashboard-grid")?.classList.add("v12-hidden");
    const list = host.querySelector(".v12-garage-list");

    if (!saved.length) list.innerHTML = '<div class="muted">No saved vehicles yet.</div>';
    saved.slice(0, 8).forEach((vehicle) => {
      const score = savedScore(vehicle);
      const letter = vehicle.conditionGrade || (score ? numericGrade(score) : "—");
      const card = document.createElement("div");
      card.className = "v12-vehicle-card";
      card.dataset.vehicleId = vehicle.id;
      card.innerHTML = `
        <div class="v12-vehicle-photo"><div class="v12-photo-empty">Finding representative image…</div></div>
        <div><div class="v12-vehicle-title">${vehicleName(vehicle)}</div><div class="v12-vehicle-meta">${vehicle.mileageUnknown ? "Mileage unknown" : vehicle.fields?.mileage ? `${Number(vehicle.fields.mileage).toLocaleString()} mi` : "Mileage not entered"}${vehicle.fields?.vin ? ` · ${vehicle.fields.vin}` : ""}</div>
          <div class="v12-vehicle-badges"><span class="v12-pill blue">${vehicle.assessmentPath === "value" ? "Value Analysis Only" : vehicle.assessmentPath === "inspection" ? "Inspection Only" : "Full Assessment"}</span><span class="v12-pill">${vehicle.mode === "sell" ? "Selling" : vehicle.mode === "buy" ? "Buying" : "Condition"}</span></div>
          <div class="v12-score-row"><div class="v12-score-cell"><small>Condition</small><strong>${score ? `${score}/100` : "Not inspected"}</strong></div><div class="v12-score-cell"><small>Grade</small><strong class="v12-grade-badge ${gradeClass(letter)}">${letter}</strong></div><div class="v12-score-cell"><small>Decision</small><strong>${vehicle.fields?.decision || "In Progress"}</strong></div></div>${progressRail(vehicle)}
        </div>`;
      // Card clicks are handled by garage-expand-v123.js so a click expands
      // the saved vehicle in place instead of loading the VIN/profile workflow.
      list.appendChild(card);
      // Photo hydration is owned by garage-v12-2.js. Keeping a single photo
      // renderer prevents the legacy Commons loader from racing and replacing
      // the persisted/correct image after navigation or a dashboard re-render.
    });

    host.querySelector("#v12All")?.addEventListener("click", () => APP.showPage?.("savedPage"));
    host.querySelectorAll("[data-v12-launch]").forEach((button) => button.addEventListener("click", () => launchNew(button.dataset.v12Launch)));

    // Notify the garage-specific enhancers after the card DOM has actually
    // been rebuilt so persisted photos and expand behavior attach to this render.
    document.dispatchEvent(new CustomEvent("scorecard:garagerender"));
  }

  function renderPricingPreview() {
    const status = document.getElementById("marketStatus");
    if (!status) return;
    let panel = document.getElementById("v12PricingPreview");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "v12PricingPreview";
      panel.className = "v12-price-preview";
      status.insertAdjacentElement("afterend", panel);
    }
    const m = market();
    panel.innerHTML = `
      <div class="v12-price-preview-head"><div><div class="v12-price-preview-title">Preliminary Pricing Assessment</div><div class="v12-price-preview-sub">${m.conditionBasis === "inspected" ? `Refined using the ${m.condition.pct}/100 (${m.condition.letter}) physical inspection.` : m.conditionBasis === "reported" ? `Uses the user-entered ${m.reportedCondition} reported condition; no physical inspection has been completed.` : "Uses a fair/typical condition assumption because no inspection or reported condition is available."}</div></div><span class="v12-pill ${m.refs >= 3 ? "green" : "amber"}">${m.confidence} confidence</span></div>
      <div class="v12-price-grid"><div class="v12-price-cell"><small>Market baseline</small><strong>${money(m.baseline)}</strong></div><div class="v12-price-cell"><small>Mileage-adjusted</small><strong>${money(m.fairEstimate)}</strong></div><div class="v12-price-cell"><small>Estimated as-is</small><strong>${money(m.asIs)}</strong></div><div class="v12-price-cell"><small>References entered</small><strong>${m.refs}</strong></div></div>`;
  }

  function renderValueReadiness() {
    const card = document.querySelector("#dealPage > .card");
    if (!card) return;
    const mode = APP.getMode?.() === "sell" ? "sell" : "buy";
    const m = market();
    const valueContext = document.getElementById("valueOnlyConditionCard");
    if (valueContext) valueContext.classList.toggle("hidden", path() !== "value");
    const basis = document.getElementById("valueConditionBasis");
    if (basis) {
      basis.textContent = m.conditionBasis === "reported"
        ? `Condition basis: user-entered ${m.reportedCondition} reported condition${m.knownRepairEstimate ? `; ${money(m.knownRepairEstimate)} known repairs will be deducted from the as-is estimate` : ""}. No physical inspection has been completed.`
        : "Condition basis: fair/typical assumption. No physical inspection or reported condition is available; enter known condition above to replace this assumption.";
    }
    let panel = document.getElementById("valueReadiness");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "valueReadiness";
      panel.className = "value-readiness compact-readiness";
      document.getElementById("dealModeHint")?.insertAdjacentElement("afterend", panel);
    }

    const marketReady = m.refs > 0;
    const askReady = mode === "sell" || num("buyAsk") > 0;
    const profitReady = mode === "sell" || num("requiredProfit") > 0;
    const requiredTotal = mode === "buy" ? 3 : 1;
    const requiredDone = mode === "buy" ? [marketReady, askReady, profitReady].filter(Boolean).length : (marketReady ? 1 : 0);

    panel.innerHTML = `
      <div class="readiness-head compact"><div><div class="readiness-title">${mode === "buy" ? "Buying" : "Selling"} analysis readiness</div><div class="readiness-summary ${requiredDone === requiredTotal ? "ready" : "pending"}">${requiredDone}/${requiredTotal} required inputs complete</div></div><div class="readiness-status ${requiredDone === requiredTotal ? "ready" : "pending"}">${requiredDone === requiredTotal ? "Ready" : `${requiredTotal-requiredDone} Remaining`}</div></div>
      <div class="readiness-progress"><div style="width:${Math.round(requiredDone/requiredTotal*100)}%"></div></div>
      <div class="readiness-note compact-note">The app calculates current value from market references, mileage and the available condition basis. In Value Analysis Only, reported condition and known repairs are used without requiring the Inspection or Recon pages.</div>`;

    ["buyResale","sellAsIs","sellPostRecon","sellTarget","sellList","sellQuick"].forEach((id) => document.getElementById(id)?.closest("label")?.classList.add("v12-derived"));

    const mark = (id, type, text) => {
      const label = document.getElementById(id)?.closest("label");
      if (!label) return;
      label.querySelectorAll(".value-field-badge,.value-requirement-help").forEach((n) => n.remove());
      const badge = document.createElement("span"); badge.className = `value-field-badge ${type}`; badge.textContent = type[0].toUpperCase()+type.slice(1); label.insertBefore(badge,label.firstChild);
      const help = document.createElement("span"); help.className = "value-requirement-help"; help.textContent = text; label.appendChild(help);
    };

    if (mode === "buy") {
      mark("buyAsk","required",num("buyAsk") ? "✓ Complete" : "Needed — seller's advertised asking price.");
      mark("requiredProfit","required",num("requiredProfit") ? "✓ Complete" : "Needed — minimum profit/return you want the deal to produce.");
      mark("buyTarget","recommended",num("buyTarget") ? "✓ Added" : "Recommended — your intended offer or purchase price.");
      mark("buyFees","recommended",num("buyFees") ? "✓ Added" : "Recommended — taxes, title and registration.");
      mark("buyAcqCosts","recommended",num("buyAcqCosts") ? "✓ Added" : "Recommended — transport, inspection or acquisition costs.");
      mark("buySellingCosts","recommended",num("buySellingCosts") ? "✓ Added" : "Recommended if resale is part of the plan.");
    } else {
      mark("sellCosts","recommended",num("sellCosts") ? "✓ Added" : "Recommended — fees or selling costs you expect.");
      mark("sellFloor","optional",num("sellFloor") ? "✓ Added" : "Optional — minimum take-home you would accept.");
      mark("brokerType","optional","Optional — only if another person is brokering the sale.");
    }

    let banner = document.getElementById("v12EstimateBanner");
    if (!banner) {
      banner = document.createElement("div"); banner.id = "v12EstimateBanner"; banner.className = "v12-estimate-banner"; panel.insertAdjacentElement("afterend", banner);
    }
    banner.innerHTML = `<div class="muted">APP ESTIMATED CURRENT VALUE</div><div class="big">${money(m.asIs)}</div><div class="note">${m.conditionBasis === "inspected" ? `Uses ${m.condition.pct}/100 (${m.condition.letter}) inspected condition.` : m.conditionBasis === "reported" ? `Uses user-entered ${m.reportedCondition} reported condition${m.knownRepairEstimate ? ` and deducts ${money(m.knownRepairEstimate)} of known repairs` : ""}.` : "Uses a fair/typical condition assumption; no physical inspection or reported condition is available."} ${m.refs ? `Based on ${m.refs} entered market reference${m.refs===1?"":"s"}.` : "Enter at least one market reference on the Market page to calculate a value."}</div>`;
  }

  async function augmentDashboard() {
    const report = document.getElementById("dashboardReport");
    const vehicle = APP.getVehicle?.();
    if (!report || !vehicle || (!vehicle.year && !vehicle.make && !vehicle.model)) return;
    report.querySelectorAll(".v12-vehicle-hero,.v12-dashboard-sections").forEach((n) => n.remove());

    const c = condition();
    const m = market();
    const mode = APP.getMode?.() || "inspect";
    const ask = num("buyAsk");
    const maxBuy = num("calculatedMaxBuy");
    const recon = APP.getReconTotals?.() || { known: 0 };

    const hero = document.createElement("div");
    hero.className = "v12-vehicle-hero";
    hero.innerHTML = `<div class="v12-hero-photo"><div class="v12-photo-empty">Finding representative image…</div></div><div><div class="v12-hero-title">${[vehicle.year,vehicle.make,vehicle.model,vehicle.trim].filter(Boolean).join(" ")}</div><div class="v12-hero-meta">${vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} miles` : "Mileage unknown"}${APP.value("vin") ? ` · ${APP.value("vin")}` : ""}</div><div class="v12-hero-tags"><span class="v12-pill blue">${pathName()}</span><span class="v12-pill">${mode === "buy" ? "Buying" : mode === "sell" ? "Selling" : "Condition"}</span><span class="v12-pill ${c.flags.count ? "amber" : "green"}">${c.flags.count} critical flags</span></div></div>`;
    report.prepend(hero);
    // Hero photo hydration is handled by garage-v12-2.js as well.

    const sections = document.createElement("div");
    sections.className = "v12-dashboard-sections";
    const activePath = path();
    const conditionSection = `<div class="v12-section"><div class="v12-section-head">Condition Summary</div><div class="v12-section-body"><div class="v12-summary-grid"><div class="v12-summary-metric"><small>Condition Score</small><strong class="green">${c.pct===null?"—":`${c.pct}/100`}</strong><div class="muted">${c.descriptor}</div></div><div class="v12-summary-metric"><small>Letter Grade</small><strong class="v12-grade-inline ${gradeClass(c.letter)}"><span class="letter">${c.letter}</span></strong></div><div class="v12-summary-metric"><small>Risk Level</small><strong class="${c.risk==="Low"?"green":"amber"}">${c.risk}</strong><div class="muted">${c.flags.count} critical concern${c.flags.count===1?"":"s"}</div></div></div><div class="v12-confidence"><div class="v12-confidence-head"><span>Inspection Confidence</span><span>${c.coverage}% · ${c.answered}/${c.total} checks</span></div><div class="v12-confidence-track"><div class="v12-confidence-fill" style="width:${c.coverage}%"></div></div></div></div></div>`;
    const basisText = m.conditionBasis === "inspected" ? `Observed: ${c.pct}/100 inspected condition` : m.conditionBasis === "reported" ? `Entered: ${m.reportedCondition} reported condition${m.knownRepairEstimate ? `; ${money(m.knownRepairEstimate)} known repairs` : ""}` : "Assumption: fair/typical condition; no inspection or reported condition";
    const pricingSection = `<div class="v12-section"><div class="v12-section-head">Pricing & Decision Context</div><div class="v12-section-body"><div class="v12-summary-grid"><div class="v12-summary-metric"><small>Estimated As-Is</small><strong>${money(m.asIs)}</strong><div class="muted">${basisText}</div></div><div class="v12-summary-metric"><small>${mode==="buy"?"Seller Asking":"Expected Sale"}</small><strong>${mode==="buy"?money(ask):money(m.expectedSale)}</strong></div><div class="v12-summary-metric"><small>${mode==="buy"?"Max Recommended":activePath==="value"?"Known Repairs":"Known Recon"}</small><strong>${mode==="buy"?money(maxBuy):money(activePath==="value"?m.knownRepairEstimate:recon.known)}</strong></div></div><div class="v12-report-basis"><b>Data basis:</b> ${basisText}. Market references and mileage are user-entered unless otherwise shown.</div><div class="v12-action-panel"><button data-v12-action="inspection">Run / Update Inspection</button><button data-v12-action="value">Update Value Analysis</button><button class="primary" data-v12-action="full">Run Full Assessment</button></div></div></div>`;
    sections.innerHTML = activePath === "inspection" ? conditionSection : activePath === "value" ? pricingSection : conditionSection + pricingSection;
    hero.insertAdjacentElement("afterend", sections);
    sections.querySelectorAll("[data-v12-action]").forEach((button) => button.addEventListener("click", () => {
      const p = button.dataset.v12Action;
      localStorage.setItem(PATH_KEY,p);
      if (p === "inspection") { APP.setLayer?.("condition"); APP.showPage?.("inspectionPage"); }
      else if (p === "full") { APP.setLayer?.("value"); APP.showPage?.("inspectionPage"); }
      else { APP.setLayer?.("value"); APP.showPage?.("marketPage"); }
      APP.saveCurrent?.();
    }));
  }

  function syncGradeUI() {
    const c = condition();
    const top = document.getElementById("topScore");
    if (top) top.textContent = c.pct === null ? "Condition —" : `Condition ${c.pct}/100 · ${c.letter}`;
    const grade = document.getElementById("grade");
    if (grade && c.pct !== null) grade.textContent = `${c.letter} · ${c.descriptor}`;
  }

  function render() {
    syncDerived();
    syncGradeUI();
    renderPricingPreview();
    renderValueReadiness();
    if (document.querySelector("#homePage.page.active")) {
      renderGarage();
      window.setTimeout(augmentDashboard, 20);
    }
  }

  ["scorecard:datachange","scorecard:inspectionchange","scorecard:workflowchange","scorecard:pathchange","scorecard:dashboardrender","scorecard:vehiclechange"].forEach((eventName) => {
    document.addEventListener(eventName, () => window.setTimeout(render, 0));
  });
  document.addEventListener("input", (event) => {
    if (event.target.closest("#marketPage") || event.target.closest("#dealPage") || event.target.closest("#reconPage")) window.setTimeout(render, 0);
  });
  document.addEventListener("change", (event) => {
    if (event.target.closest("#marketPage") || event.target.closest("#dealPage") || event.target.closest("#reconPage")) window.setTimeout(render, 0);
  });

  document.addEventListener("scorecard:core-ready", () => {
    darkDefault();
    installBrand();
    patchPersistence();
    watchDerivedInputs();
    window.setTimeout(render, 100);
  });
})();
