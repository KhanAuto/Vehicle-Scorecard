(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  function nameFor(v) {
    const f = v?.fields || {};
    return [f.year,f.make,f.model,f.trim].filter(Boolean).join(" ") || "Saved Vehicle";
  }
  function money(v){ return Number(v)>0 ? APP.money(Number(v)) : "—"; }
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
    const score=String(vehicle.score?.pct||"—");
    const grade=vehicle.conditionGrade||"—";
    const ratings=Object.keys(vehicle.ratings||{}).length;
    const recon=Object.values(vehicle.recon||{}).filter(x=>x?.status&&x.status!=="none").length;
    const market=["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"].filter(id=>Number(f[id])>0).length;
    const asking=Number(f.buyAsk)||0;
    const value=Number(f.buyResale)||Number(f.sellAsIs)||Number(f.sellTarget)||0;
    return `<div class="v123-inline-overview">
      <div class="v123-overview-grid">
        <div><small>CONDITION</small><strong>${score}${score!=="—"?" / 100":""} · ${grade}</strong></div>
        <div><small>INSPECTION</small><strong>${ratings ? `${ratings} checks recorded` : "Not started"}</strong></div>
        <div><small>RECON</small><strong>${recon ? `${recon} items` : "None recorded"}</strong></div>
        <div><small>MARKET DATA</small><strong>${market ? `${market} references` : "Not entered"}</strong></div>
        <div><small>ASKING PRICE</small><strong>${money(asking)}</strong></div>
        <div><small>VALUE CONTEXT</small><strong>${money(value)}</strong></div>
      </div>
      <div class="v123-vehicle-facts"><span>${f.mileage ? `${Number(f.mileage).toLocaleString()} miles` : "Mileage unknown"}</span>${f.vin?`<span>VIN ${f.vin}</span>`:""}${f.title?`<span>${f.title} title</span>`:""}</div>
      <div class="v123-actions">
        ${targetButton("Edit Vehicle Details","profilePage")}
        ${targetButton("View Inspection","inspectionPage")}
        ${targetButton("View Recon","reconPage")}
        ${targetButton("View Market","marketPage")}
        ${targetButton("View Value Analysis","dealPage")}
      </div>
      <div class="v1214-upgrade">
        <div class="v1214-upgrade-title">Build on this assessment</div>
        <div class="v1214-upgrade-copy">Keep everything already entered and stack additional analysis on top of it.</div>
        <div class="v1214-upgrade-actions">
          ${ratings ? "" : '<button type="button" class="btn" data-v1214-upgrade="inspection">+ Add Inspection</button>'}
          ${market ? "" : '<button type="button" class="btn" data-v1214-upgrade="market">+ Add Market & Value</button>'}
          ${(vehicle.assessmentPath || "") === "full" ? "" : '<button type="button" class="btn primary" data-v1214-upgrade="full">Complete Full Assessment</button>'}
        </div>
      </div>
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
  function install(){
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
