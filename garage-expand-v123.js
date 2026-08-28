(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  function nameFor(v) {
    const f = v?.fields || {};
    return [f.year,f.make,f.model,f.trim].filter(Boolean).join(" ") || "Saved Vehicle";
  }
  function money(v){ return Number(v)>0 ? APP.money(Number(v)) : "—"; }
  function scoreNumber(value) {
    const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
    return match ? Math.min(100, Math.max(0, Number(match[0]) || 0)) : null;
  }
  function baseGrade(score) {
    if (score === null) return "—";
    if(score>=97)return"A+";if(score>=93)return"A";if(score>=90)return"A-";
    if(score>=87)return"B+";if(score>=83)return"B";if(score>=80)return"B-";
    if(score>=77)return"C+";if(score>=73)return"C";if(score>=70)return"C-";
    if(score>=65)return"D+";if(score>=60)return"D";return"F";
  }
  function persistSavedSilently(vehicles) {
    localStorage.setItem(APP.constants.STORAGE_KEY, JSON.stringify(vehicles));
  }
  function savedFor(card){
    const id = card.dataset.vehicleId;
    if (id) return (APP.getSaved?.()||[]).find(v => String(v.id) === String(id)) || null;
    const title=card.querySelector(".v12-vehicle-title")?.textContent?.trim();
    return (APP.getSaved?.()||[]).find(v=>nameFor(v)===title) || null;
  }
  function targetButton(label,page){ return `<button type="button" class="btn v123-jump" data-v123-page="${page}">${label}</button>`; }
  function details(vehicle){
    const f=vehicle.fields||{};
    const score=scoreNumber(vehicle.score?.pct);
    const grade=vehicle.conditionGrade||"—";
    const ratings=Object.keys(vehicle.ratings||{}).length;
    const totalChecks=(APP.inspection?.groups||[]).reduce((total,group)=>total+(group.items?.length||0),0);
    const coverage=totalChecks?Math.round(Math.min(ratings,totalChecks)/totalChecks*100):0;
    const recon=Object.values(vehicle.recon||{}).filter(x=>x?.status&&x.status!=="none").length;
    const market=["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","estimatedWholesale","private1Price","private2Price","private3Price","dealer1Price","dealer2Price","dealer3Price","instantOffer","instantOffer2","dealerCashOffer","actualTradeOffer"].filter(id=>Number(f[id])>0).length;
    const selling=vehicle.mode==="sell";
    const priceOneLabel=selling?"ASKING PRICE":"SELLER ASKING PRICE";
    const priceOne=selling?(Number(f.sellAsk)||0):(Number(f.buyAsk)||Number(f.asking)||0);
    const priceTwoLabel=selling?"CURRENT AS-IS VALUE":"ESTIMATED MARKET VALUE";
    const priceTwo=selling?(Number(f.sellAsIs)||0):(Number(f.buyResale)||0);
    const gradeWasCapped=score!==null&&grade!=="—"&&grade!==baseGrade(score);
    const reportType=["inspection","value","full"].includes(vehicle.assessmentPath)?vehicle.assessmentPath:(vehicle.layer==="condition"?"inspection":"full");
    const analysisIntent=vehicle.mode==="sell"?"sell":"buy";
    const upgradeActions=[
      ratings?"":'<button type="button" class="btn" data-v1214-upgrade="inspection">+ Add Inspection</button>',
      market?"":'<button type="button" class="btn" data-v1214-upgrade="market">+ Add Market & Value</button>',
      (vehicle.assessmentPath||"")==="full"?"":'<button type="button" class="btn primary" data-v1214-upgrade="full">Complete Full Assessment</button>'
    ].filter(Boolean).join("");
    return `<div class="v123-inline-overview">
      <div class="v123-overview-grid">
        <div><small>CONDITION</small><strong>${score===null?"Not inspected":`${score}/100 · ${grade}`}</strong><span>${gradeWasCapped?"Grade limited by critical findings":"Physical condition score"}</span></div>
        <div><small>INSPECTION COVERAGE</small><strong>${ratings ? `${Math.min(ratings,totalChecks)}/${totalChecks} checks · ${coverage}%` : "Not started"}</strong><span>${coverage===100?"All inspection questions answered":"Recorded answers, including N/A"}</span></div>
        <div><small>RECON PLAN</small><strong>${recon ? `${recon} item${recon===1?"":"s"} planned` : "None recorded"}</strong><span>Required, recommended or cosmetic work</span></div>
        <div><small>MARKET DATA</small><strong>${market ? `${market} pricing reference${market===1?"":"s"}` : "Not entered"}</strong><span>Guides and comparable values entered</span></div>
        <div><small>${priceOneLabel}</small><strong>${money(priceOne)}</strong><span>${selling?"Your advertised or planned asking price":"Seller's advertised price"}</span></div>
        <div><small>${priceTwoLabel}</small><strong>${money(priceTwo)}</strong><span>${selling?"Estimated value before planned work":"Condition-adjusted comparison value"}</span></div>
      </div>
      <div class="v123-vehicle-facts"><span>${f.mileage ? `${Number(f.mileage).toLocaleString()} miles` : "Mileage unknown"}</span>${f.vin?`<span>VIN ${f.vin}</span>`:""}${f.title?`<span>${f.title} title</span>`:""}</div>
      <div class="v123-report-type">
        <label><span>Active Report Type</span><select data-v123-report-type-select><option value="inspection" ${reportType==="inspection"?"selected":""}>Inspection Only</option><option value="value" ${reportType==="value"?"selected":""}>Value Analysis Only</option><option value="full" ${reportType==="full"?"selected":""}>Full Assessment</option></select></label>
        <button type="button" class="btn primary" data-v123-apply-report-type>Apply Report Type</button>
        <small>Previously entered modules are preserved if you switch report types.</small>
      </div>
      <div class="v123-report-type v123-analysis-intent">
        <label><span>Analysis Intent</span><select data-v123-analysis-intent-select><option value="buy" ${analysisIntent==="buy"?"selected":""}>Buying</option><option value="sell" ${analysisIntent==="sell"?"selected":""}>Selling</option></select></label>
        <button type="button" class="btn primary" data-v123-apply-analysis-intent>Apply Intent</button>
        <small>Switching intent keeps all saved information and changes which Buying or Selling questions appear when editing.</small>
      </div>
      <div class="v123-actions">
        ${targetButton("Edit Vehicle Details","profilePage")}
        ${targetButton("View Inspection","inspectionPage")}
        ${targetButton("View Recon","reconPage")}
        ${targetButton("View Market","marketPage")}
        ${targetButton("View Value Analysis","dealPage")}
        <button type="button" class="btn v123-remove" data-v123-remove>Remove from Garage</button>
      </div>
      ${upgradeActions?`<div class="v1214-upgrade">
        <div class="v1214-upgrade-title">Build on this assessment</div>
        <div class="v1214-upgrade-copy">Keep everything already entered and stack additional analysis on top of it.</div>
        <div class="v1214-upgrade-actions">${upgradeActions}</div>
      </div>`:""}
    </div>`;
  }
  function upgradeVehiclePath(vehicle, page) {
    if (!vehicle || !["inspectionPage", "reconPage", "marketPage", "dealPage"].includes(page)) return vehicle;

    const currentPath = vehicle.assessmentPath || (vehicle.layer === "condition" ? "inspection" : "full");
    const addsInspection = page === "inspectionPage" && currentPath === "value";
    const addsValueModule = ["reconPage", "marketPage", "dealPage"].includes(page) && currentPath === "inspection";
    if (!addsInspection && !addsValueModule) return vehicle;

    const upgraded = {
      ...vehicle,
      assessmentPath: "full",
      layer: "value",
      moduleCoverage: {
        ...(vehicle.moduleCoverage || {}),
        fullRequested: true,
        ...(addsInspection ? { inspectionStarted: true } : {}),
        ...(addsValueModule ? { valueStarted: true } : {})
      }
    };
    persistSavedSilently((APP.getSaved?.() || []).map((saved) =>
      String(saved.id) === String(upgraded.id) ? upgraded : saved
    ));
    return upgraded;
  }
  async function openPage(vehicle,page){
    if(!vehicle) return;
    vehicle = upgradeVehiclePath(vehicle, page);
    await APP.loadSaved?.(vehicle.id, page);
    if (vehicle.assessmentPath === "full") {
      APP.setAssessmentPath?.("full");
      APP.setLayer?.("value");
    }
    APP.showPage?.(page);
  }
  function collapseOthers(except){
    document.querySelectorAll("#quickSaved .v12-vehicle-card.v123-expanded").forEach(other=>{
      if(other===except) return;
      other.classList.remove("v123-expanded");
      other.setAttribute("aria-expanded","false");
      other.querySelector(":scope > .v123-inline-overview")?.remove();
    });
  }
  function cleanLegacyOverview(){
    document.querySelectorAll("#homePage > #dashboardReport, #homePage .v12-vehicle-dashboard").forEach(el=>el.classList.add("v123-hide-legacy-overview"));
  }
  async function routeCapturedAction(action, card) {
    const vehicle = savedFor(card);
    if (!vehicle) return;

    if (action.hasAttribute("data-v123-apply-report-type")) {
      const selected = card.querySelector("[data-v123-report-type-select]")?.value;
      if (!["inspection", "value", "full"].includes(selected)) return;
      const saved = APP.getSaved?.().find((item) => String(item.id) === String(vehicle.id));
      if (!saved) return;
      saved.moduleCoverage = saved.moduleCoverage || {};
      if (["value", "full"].includes(saved.assessmentPath) && ["buy", "sell"].includes(saved.mode)) {
        saved.moduleCoverage.previousValueMode = saved.mode;
      }
      saved.assessmentPath = selected;
      saved.layer = selected === "inspection" ? "condition" : "value";
      saved.mode = ["buy", "sell"].includes(saved.mode) ? saved.mode : saved.moduleCoverage.previousValueMode || "buy";
      persistSavedSilently(APP.getSaved().map((item) => String(item.id) === String(saved.id) ? saved : item));

      const labels = { inspection: "Inspection Only", value: "Value Analysis Only", full: "Full Assessment" };
      const badge = card.querySelector(".v12-vehicle-badges .v12-pill.blue");
      if (badge) badge.textContent = labels[selected];
      const overview = card.querySelector(":scope > .v123-inline-overview");
      if (overview) overview.outerHTML = details(saved);
      APP.toast?.(`Report type changed to ${labels[selected]}`);
      return;
    }

    if (action.hasAttribute("data-v123-apply-analysis-intent")) {
      const selected = card.querySelector("[data-v123-analysis-intent-select]")?.value;
      if (!["buy", "sell"].includes(selected)) return;
      const saved = APP.getSaved?.().find((item) => String(item.id) === String(vehicle.id));
      if (!saved) return;
      saved.mode = selected;
      saved.moduleCoverage = { ...(saved.moduleCoverage || {}), previousValueMode: selected };
      persistSavedSilently(APP.getSaved().map((item) => String(item.id) === String(saved.id) ? saved : item));

      const badge = card.querySelector(".v12-vehicle-badges .v12-pill:not(.blue)");
      if (badge) badge.textContent = selected === "buy" ? "Buying" : "Selling";
      const overview = card.querySelector(":scope > .v123-inline-overview");
      if (overview) overview.outerHTML = details(saved);
      APP.toast?.(`Analysis intent changed to ${selected === "buy" ? "Buying" : "Selling"}`);
      return;
    }

    if (action.hasAttribute("data-v123-remove")) {
      if (!confirm(`Remove ${nameFor(vehicle)} from My Garage?`)) return;
      APP.saveList?.((APP.getSaved?.() || []).filter((saved) => String(saved.id) !== String(vehicle.id)));
      APP.toast?.("Vehicle removed from My Garage");
      return;
    }

    const upgradeKind = action.dataset.v1214Upgrade;
    if (upgradeKind) {
      const saved = APP.getSaved?.().find((v) => String(v.id) === String(vehicle.id));
      if (!saved) return;
      saved.moduleCoverage = saved.moduleCoverage || {};
      if (upgradeKind === "inspection") saved.moduleCoverage.inspectionStarted = true;
      if (upgradeKind === "market") saved.moduleCoverage.valueStarted = true;
      if (upgradeKind === "full") saved.moduleCoverage.fullRequested = true;
      saved.assessmentPath = "full";
      saved.layer = "value";
      persistSavedSilently(APP.getSaved().map((v) => String(v.id) === String(saved.id) ? saved : v));

      const page = upgradeKind === "market" ? "marketPage" : "inspectionPage";
      APP.setAssessmentPath?.("full");
      APP.setLayer?.("value");
      await APP.loadSaved?.(vehicle.id, page);
      if (page === "inspectionPage") APP.inspection?.render?.();
      APP.showPage?.(page);
      APP.toast?.("Existing vehicle information preserved. Add the missing module when ready.");
      return;
    }

    const page = action.dataset.v123Page;
    if (page) await openPage(vehicle, page);
  }
  function installCapturedActionRouter() {
    if (document.documentElement.dataset.v121ModuleRouter === "1") return;
    document.documentElement.dataset.v121ModuleRouter = "1";
    document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-v1214-upgrade], [data-v123-page], [data-v123-remove], [data-v123-apply-report-type], [data-v123-apply-analysis-intent]");
      if (!action) return;
      const card = action.closest(".v12-vehicle-card");
      if (!card) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      routeCapturedAction(action, card);
    }, true);
  }
  function install(){
    installCapturedActionRouter();
    const host = document.getElementById("quickSaved");
    if (!host || host.dataset.v126Expand === "1") { cleanLegacyOverview(); return; }
    host.dataset.v126Expand = "1";
    host.addEventListener("click", async event => {
      const card = event.target.closest(".v12-vehicle-card");
      if (!card || !host.contains(card)) return;
      const vehicle = savedFor(card);
      const upgrade = event.target.closest("[data-v1214-upgrade]");
      if (upgrade) {
        event.preventDefault();
        event.stopPropagation();
        if (!vehicle) return;
        const kind = upgrade.dataset.v1214Upgrade;
        const saved = APP.getSaved?.().find((v) => String(v.id) === String(vehicle.id));
        if (saved) {
          saved.moduleCoverage = saved.moduleCoverage || {};
          if (kind === "inspection") saved.moduleCoverage.inspectionStarted = true;
          if (kind === "market") saved.moduleCoverage.valueStarted = true;
          if (kind === "full") saved.moduleCoverage.fullRequested = true;
          saved.assessmentPath = "full";
          saved.layer = "value";
          persistSavedSilently(APP.getSaved().map(v => v.id === saved.id ? saved : v));
        }
        const page = kind === "market" ? "marketPage" : "inspectionPage";
        await APP.loadSaved?.(vehicle.id, page);
        APP.setAssessmentPath?.("full");
        APP.setLayer?.("value");
        if (page === "inspectionPage") APP.inspection?.render?.();
        APP.showPage?.(page);
        APP.toast?.("Existing vehicle information preserved. Add the missing module when ready.");
        return;
      }
      const jump = event.target.closest("[data-v123-page]");
      if (jump) {
        event.preventDefault();
        event.stopPropagation();
        await openPage(vehicle, jump.dataset.v123Page);
        return;
      }
      if (event.target.closest("button,a,input,select,textarea")) return;
      event.preventDefault();
      event.stopPropagation();
      const existing = card.querySelector(":scope > .v123-inline-overview");
      if (existing) {
        existing.remove();
        card.classList.remove("v123-expanded");
        card.setAttribute("aria-expanded","false");
        return;
      }
      collapseOthers(card);
      card.insertAdjacentHTML("beforeend", details(vehicle));
      card.classList.add("v123-expanded");
      card.setAttribute("aria-expanded","true");
    });
    cleanLegacyOverview();
  }

  ["scorecard:core-ready","scorecard:dashboardrender","scorecard:vehiclechange"].forEach(name=>{
    document.addEventListener(name,()=>requestAnimationFrame(install));
  });
  window.addEventListener("load",install,{once:true});
  setTimeout(install,100);
})();
