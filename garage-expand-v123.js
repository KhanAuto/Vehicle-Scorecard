(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  function nameFor(v) {
    const f = v?.fields || {};
    return [f.year,f.make,f.model,f.trim].filter(Boolean).join(" ") || "Saved Vehicle";
  }
  function money(v){ return Number(v)>0 ? APP.money(Number(v)) : "—"; }
  function savedFor(card){
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
    </div>`;
  }
  async function openPage(vehicle,page){
    if(!vehicle) return;
    await APP.loadSaved?.(vehicle.id);
    APP.showPage?.(page);
  }
  function bindCard(card){
    if(card.dataset.v123Bound==="1") return;
    card.dataset.v123Bound="1";
    card.setAttribute("role","button");
    card.setAttribute("aria-expanded","false");
    card.addEventListener("click",async event=>{
      const jump=event.target.closest("[data-v123-page]");
      const vehicle=savedFor(card);
      if(jump){
        event.preventDefault(); event.stopPropagation();
        await openPage(vehicle,jump.dataset.v123Page); return;
      }
      if(event.target.closest("button,a,input,select,textarea")) return;
      event.preventDefault(); event.stopPropagation();
      const existing=card.querySelector(":scope > .v123-inline-overview");
      document.querySelectorAll(".v12-vehicle-card.v123-expanded").forEach(other=>{
        if(other!==card){other.classList.remove("v123-expanded");other.setAttribute("aria-expanded","false");other.querySelector(":scope > .v123-inline-overview")?.remove();}
      });
      if(existing){ existing.remove(); card.classList.remove("v123-expanded"); card.setAttribute("aria-expanded","false"); return; }
      card.insertAdjacentHTML("beforeend",details(vehicle));
      card.classList.add("v123-expanded"); card.setAttribute("aria-expanded","true");
    },true);
  }
  function cleanLegacyOverview(){
    const home=document.querySelector("#homePage");
    if(!home) return;
    home.querySelectorAll("#dashboardReport,.v12-vehicle-dashboard").forEach(el=>{ if(!el.closest(".v12-vehicle-card")) el.classList.add("v123-hide-legacy-overview"); });
  }
  function refresh(){ document.querySelectorAll("#quickSaved .v12-vehicle-card").forEach(bindCard); cleanLegacyOverview(); }
  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.documentElement,{subtree:true,childList:true});
  ["scorecard:core-ready","scorecard:dashboardrender","scorecard:vehiclechange"].forEach(n=>document.addEventListener(n,()=>setTimeout(refresh,30)));
  setTimeout(refresh,50);
})();