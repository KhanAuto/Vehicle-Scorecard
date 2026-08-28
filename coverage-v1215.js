(() => {
"use strict";
const APP=window.VehicleScorecard;if(!APP)return;
const hasInspection=v=>Object.keys(v?.ratings||{}).length>0;
const hasMarket=v=>["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","instantOffer","private1Price","private2Price","private3Price","dealer1Price","dealer2Price","dealer3Price"].some(id=>Number(v?.fields?.[id])>0);
const hasValue=v=>["buyAsk","buyResale","sellAsIs","sellTarget","knownCondition","knownRepairEstimate"].some(id=>String(v?.fields?.[id]||"").trim());
const hasRecon=v=>Object.values(v?.recon||{}).some(x=>x&&(x.status&&x.status!=="none"||Number(x.override)>0));
function coverage(v){return{vehicle:true,inspection:hasInspection(v),recon:hasRecon(v),market:hasMarket(v),value:hasValue(v)}}
function label(v,c){
 const selected=v?.assessmentPath;
 if(selected==="inspection")return"Inspection Only";
 if(selected==="value")return"Value Analysis Only";
 if(selected==="full")return"Full Assessment";
 const n=["inspection","recon","market","value"].filter(k=>c[k]).length;
 if(c.inspection&&c.recon&&c.market&&c.value)return"Full Assessment";
 if(c.inspection&&(c.market||c.value))return"Inspection + Value";
 if(c.inspection)return"Inspection";
 if(c.market||c.value)return"Value Analysis";
 return"Vehicle Information";
}
function decorate(){
 document.querySelectorAll("#quickSaved .v12-vehicle-card").forEach(card=>{
   const id=Number(card.dataset.vehicleId)||card.dataset.vehicleId;
   const v=APP.getSaved?.().find(x=>String(x.id)===String(id)); if(!v)return;
   const c=coverage(v);
   const badge=card.querySelector(".v12-vehicle-badges .v12-pill.blue");
   if(badge) badge.textContent=label(v,c);
   const exp=card.querySelector(".v123-inline-overview"); if(!exp)return;
   let panel=exp.querySelector(".v1215-coverage");
   if(!panel){panel=document.createElement("div");panel.className="v1215-coverage";exp.prepend(panel);}
   const rows=[["Vehicle",true],["Inspection",c.inspection],["Recon",c.recon],["Market",c.market],["Value",c.value]];
   panel.innerHTML=`<div class="v1215-title">Assessment coverage</div><div class="v1215-grid">${rows.map(([n,done])=>`<div class="v1215-module ${done?"done":"available"}"><span>${n}</span><b>${done?"Completed":"Available to add"}</b></div>`).join("")}</div><div class="v1215-note">This vehicle is progressive: adding a module keeps the information already saved and updates this same vehicle record.</div>`;
 });
}
const oldSave=APP.saveCurrent;
if(typeof oldSave==="function"&&!oldSave._v1215){
 const wrapped=()=>{const r=oldSave();setTimeout(()=>{document.dispatchEvent(new CustomEvent("scorecard:garagerender"));decorate()},0);return r};wrapped._v1215=true;APP.saveCurrent=wrapped;
}
["scorecard:garagerender","scorecard:datachange","scorecard:inspectionchange","scorecard:workflowchange"].forEach(n=>document.addEventListener(n,()=>setTimeout(decorate,0)));
document.addEventListener("click",e=>{if(e.target.closest(".v12-vehicle-card"))setTimeout(decorate,20)},true);
window.addEventListener("load",()=>setTimeout(decorate,100),{once:true});
setTimeout(decorate,150);
})();
