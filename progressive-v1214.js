(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  const modules = {
    profilePage: {
      title: "Vehicle Information",
      help: "Identify the exact vehicle so every later module refers to the same car. Year, make, model and mileage are the minimum information for a dependable assessment. VIN, trim, ZIP, seller and asking-price details improve identification and context but can be added later.",
      required: ["yearSelect","makeSelect","modelSelect","mileage"],
      optional: ["vin","model","trim","asking","zip"]
    },
    inspectionPage: {
      title: "Physical Inspection",
      help: "Score only what you can actually observe. N/A is appropriate when equipment is not present. You can continue with an incomplete inspection, but coverage is shown on the report so a partial inspection is never presented as complete.",
      required: [],
      optional: []
    },
    reconPage: {
      title: "Reconditioning",
      help: "Record repairs, maintenance and preparation you believe the vehicle needs. Known costs make the full assessment more precise; unknown items can remain unfilled and the risk reserve can be used for uncertainty.",
      required: [],
      optional: ["contingency"]
    },
    marketPage: {
      title: "Market References",
      help: "Use comparable market references to establish a defensible local value range. ZIP and at least one pricing reference are recommended for a usable market analysis. More independent references improve confidence.",
      required: ["marketZip"],
      optional: ["marketRadius","compMileage","marketNotes","kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"]
    },
    dealPage: {
      title: "Value Analysis",
      help: "This module turns the known vehicle, condition, recon and market information into a buying or selling decision. Value-only assessments can use reported condition and known repairs; a completed physical inspection provides a stronger condition basis.",
      required: [],
      optional: ["knownCondition","knownRepairEstimate","knownRepairs"]
    }
  };

  const valueRequired = {
    buy: ["buyAsk","buyResale"],
    sell: ["sellAsIs","sellTarget"]
  };

  function controlLabel(id) {
    const el = document.getElementById(id);
    return el?.closest("label") || null;
  }
  function badge(label, type) {
    if (!label || label.querySelector(".v1214-field-badge")) return;
    const span = document.createElement("span");
    span.className = "v1214-field-badge " + type;
    span.textContent = type === "required" ? "Required" : "Optional";
    label.insertBefore(span, label.firstChild);
  }
  function decorateFields(pageId) {
    const cfg = modules[pageId];
    if (!cfg) return;
    cfg.required.forEach(id => badge(controlLabel(id), "required"));
    cfg.optional.forEach(id => badge(controlLabel(id), "optional"));
    if (pageId === "dealPage") {
      const mode = APP.getMode?.() === "sell" ? "sell" : "buy";
      valueRequired[mode].forEach(id => badge(controlLabel(id), "required"));
      valueRequired[mode === "buy" ? "sell" : "buy"].forEach(id => badge(controlLabel(id), "optional"));
    }
  }
  function helpPanel(pageId) {
    const page = document.getElementById(pageId);
    const cfg = modules[pageId];
    if (!page || !cfg || page.querySelector(".v1214-help")) return;
    const first = page.querySelector(".card");
    if (!first) return;
    const panel = document.createElement("details");
    panel.className = "card v1214-help no-print";
    panel.innerHTML = `<summary>What am I looking at? <span>Module help</span></summary><p>${cfg.help}</p><div class="v1214-help-key"><span class="v1214-key required">Required</span><span>Best completed for a confident result.</span><span class="v1214-key optional">Optional</span><span>Adds context or precision when available.</span></div>`;
    first.insertAdjacentElement("beforebegin", panel);
  }
  function empty(id) {
    const el=document.getElementById(id);
    if (!el) return true;
    if (el.type === "checkbox") return !el.checked;
    return !String(el.value || "").trim();
  }
  function missing(pageId) {
    if (pageId === "profilePage") {
      const ids=["yearSelect","makeSelect","modelSelect"];
      const miss=ids.filter(empty);
      const mileageUnknown=document.getElementById("mileageUnknown")?.checked;
      if (!mileageUnknown && empty("mileage")) miss.push("mileage");
      return miss;
    }
    if (pageId === "inspectionPage") {
      const score=APP.inspection?.getOverallScore?.();
      return !score || Number(score.coverage || 0) < 100 ? ["inspection coverage"] : [];
    }
    if (pageId === "marketPage") {
      const miss=empty("marketZip") ? ["market ZIP"] : [];
      const refs=["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","dealer1","dealer2","privateComp","instantOffer"];
      if (!refs.some(id => !empty(id))) miss.push("at least one market reference");
      return miss;
    }
    if (pageId === "dealPage") {
      const mode=APP.getMode?.() === "sell" ? "sell" : "buy";
      return valueRequired[mode].filter(empty);
    }
    return [];
  }
  function friendly(id) {
    const names={yearSelect:"year",makeSelect:"make",modelSelect:"model",mileage:"mileage",marketZip:"market ZIP",buyAsk:"list price",buyResale:"estimated market value",sellAsIs:"current as-is value",sellTarget:"target sale price"};
    return names[id] || id;
  }
  function statusPanel(pageId) {
    const page=document.getElementById(pageId);
    if (!page) return;
    let panel=page.querySelector(".v1214-completion");
    if (!panel) {
      panel=document.createElement("div");
      panel.className="card v1214-completion no-print";
      const actions=page.querySelector(".page-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",panel);
      else page.appendChild(panel);
    }
    const miss=missing(pageId);
    if (!miss.length) {
      panel.className="card v1214-completion complete no-print";
      panel.innerHTML="<b>Module status: Complete</b><span>The key information for this module is filled in.</span>";
    } else {
      panel.className="card v1214-completion attention no-print";
      panel.innerHTML=`<b>Module status: Needs attention</b><span>You can continue, but this module is not completely filled out. Missing: ${miss.map(friendly).join(", ")}. The report will reflect the reduced information available.</span>`;
    }
  }
  function refresh() {
    Object.keys(modules).forEach(pageId => {
      helpPanel(pageId);
      decorateFields(pageId);
      statusPanel(pageId);
    });
  }
  document.addEventListener("click", e => {
    const next=e.target.closest("[data-next]");
    if (!next) return;
    const page=next.closest(".page");
    if (!page) return;
    const miss=missing(page.id);
    if (miss.length) APP.toast?.("Continuing with missing information. This module will be marked Needs Attention.");
  }, true);
  ["scorecard:core-ready","scorecard:datachange","scorecard:inspectionchange","scorecard:workflowchange","scorecard:pathchange","scorecard:dashboardrender"].forEach(n=>document.addEventListener(n,()=>setTimeout(refresh,0)));
  document.addEventListener("input",()=>setTimeout(refresh,0));
  document.addEventListener("change",()=>setTimeout(refresh,0));
  window.addEventListener("load",refresh,{once:true});
  setTimeout(refresh,100);
})();
