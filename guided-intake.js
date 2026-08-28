(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PATH_KEY = "vehicleScorecardAssessmentPath";
  let currentStep = 1;
  let selectedPurpose = "";
  let selectedDirective = "";

  function syncSelectedPurpose() {
    const stored = localStorage.getItem(PATH_KEY);
    if (["inspection", "value", "full"].includes(stored)) {
      selectedPurpose = stored;
    } else if (!selectedPurpose) {
      selectedPurpose = APP.getLayer?.() === "condition" ? "inspection" : "full";
    }
    return selectedPurpose;
  }

  function el(tag, className = "", html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function vehicleName() {
    const vehicle = APP.getVehicle();
    return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "Vehicle not identified";
  }

  function showStep(step) {
    syncSelectedPurpose();
    currentStep = Math.min(3, Math.max(1, Number(step) || 1));
    document.querySelectorAll("[data-intake-step]").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.intakeStep) === currentStep);
    });
    const label = document.querySelector("#intakeStepLabel");
    const bar = document.querySelector("#intakeProgressBar");
    if (label) label.textContent = `Step ${currentStep} of 3`;
    if (bar) bar.style.width = `${currentStep * (100 / 3)}%`;
    if (currentStep >= 2) updateVehicleSummary();
    const directive = APP.$("#directiveChoices");
    if (directive) directive.classList.toggle("hidden", selectedPurpose === "inspection");
    if (currentStep === 3 && selectedPurpose !== "inspection") {
      const storedMode = APP.getMode?.();
      if (["buy", "sell"].includes(storedMode)) selectedDirective = storedMode;
      APP.$$('[data-guided-directive]').forEach((button) => {
        button.classList.toggle("selected", button.dataset.guidedDirective === selectedDirective);
      });
      syncDirectiveQuestions(selectedDirective);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVehicleSummary() {
    const name = APP.$("#intakeVehicleName");
    const vin = APP.$("#intakeVehicleVin");
    if (name) name.textContent = vehicleName();
    if (vin) vin.textContent = APP.value("vin") ? `VIN ${APP.value("vin")}` : "Manual vehicle identification";
  }

  function showEntry(kind) {
    APP.$("#vinEntryPanel")?.classList.toggle("hidden", kind !== "vin");
    APP.$("#manualEntryPanel")?.classList.toggle("hidden", kind !== "manual");
    APP.$$(".intake-method").forEach((button) => button.classList.toggle("selected", button.dataset.method === kind));
    if (kind === "vin") APP.$("#vin")?.focus();
    if (kind === "manual") APP.$("#yearSelect")?.focus();
  }

  function requireVehicle() {
    const vehicle = APP.getVehicle();
    if (vehicle.year && vehicle.make && vehicle.model) return true;
    const status = APP.$("#decodeStatus");
    if (status) {
      status.textContent = "Identify the vehicle first: decode the VIN or select year, make and model.";
      status.classList.add("intake-warning");
    }
    return false;
  }

  function applyPurpose(purpose) {
    selectedPurpose = purpose;
    if (purpose === "inspection") APP.setLayer("condition");
    if (purpose === "value" || purpose === "full") APP.setLayer("value");
  }

  function chooseDirective(mode) {
    selectedDirective = mode;
    APP.setMode(mode);
    APP.$$('[data-guided-directive]').forEach((button) => {
      const active = button.dataset.guidedDirective === mode;
      button.classList.toggle("selected", active);
    });
    syncDirectiveQuestions(mode);
  }

  function syncDirectiveQuestions(mode = selectedDirective) {
    const panel = APP.$("#directiveQuestions");
    if (!panel) return;
    panel.classList.toggle("hidden", !["buy", "sell"].includes(mode));
    APP.$("#buyDirectiveQuestions")?.classList.toggle("hidden", mode !== "buy");
    APP.$("#sellDirectiveQuestions")?.classList.toggle("hidden", mode !== "sell");

    const pairs = mode === "buy"
      ? [["intakeBuyAsk","buyAsk"],["intakeBuyTarget","buyTarget"],["intakeBuyIntent","buyIntent"]]
      : [["intakeSellFloor","sellFloor"],["intakeSellCosts","sellCosts"],["intakeSellReconMode","sellReconMode"]];
    pairs.forEach(([mirrorId, sourceId]) => {
      const mirror = APP.$(`#${mirrorId}`);
      const source = APP.$(`#${sourceId}`);
      if (mirror && source) mirror.value = source.value || "";
    });
  }

  function bindDirectiveQuestions() {
    const pairs = [
      ["intakeBuyAsk","buyAsk"],["intakeBuyTarget","buyTarget"],["intakeBuyIntent","buyIntent"],
      ["intakeSellFloor","sellFloor"],["intakeSellCosts","sellCosts"],["intakeSellReconMode","sellReconMode"]
    ];
    pairs.forEach(([mirrorId, sourceId]) => {
      const mirror = APP.$(`#${mirrorId}`);
      const source = APP.$(`#${sourceId}`);
      if (!mirror || !source) return;
      const sync = () => {
        source.value = mirror.value;
        source.dispatchEvent(new Event("input", { bubbles: true }));
      };
      mirror.addEventListener("input", sync);
      mirror.addEventListener("change", sync);
    });
  }

  function buildWizard() {
    const profile = APP.$("#profilePage");
    const oldCard = profile?.querySelector(":scope > .card");
    if (!oldCard || oldCard.dataset.guided === "true") return;

    const originalGrid = oldCard.querySelector(".field-grid");
    const oldToolbar = oldCard.querySelector(".inline-toolbar");
    const assessment = APP.$("#assessmentSelector");
    const decodeStatus = APP.$("#decodeStatus");
    const recallResults = APP.$("#recallResults");
    const decodeButton = APP.$("#decodeVin");
    const recallButton = APP.$("#checkRecalls");
    const labels = {};
    ["vin","yearSelect","makeSelect","modelSelect","model","trim","mileage","zip","seller","title","keys","cold","records"].forEach((id) => {
      labels[id] = APP.$(`#${id}`)?.closest("label") || null;
    });

    const shell = el("div", "card intake-shell");
    shell.dataset.guided = "true";
    shell.innerHTML = `
      <div class="intake-topline"><div><div class="eyebrow intake-eyebrow">NEW VEHICLE ASSESSMENT</div><div class="title">Identify the Vehicle</div><div class="hint">Enter the VIN to identify the vehicle automatically, or select the year, make and model manually.</div></div><div id="intakeStepLabel" class="intake-step-label">Step 1 of 3</div></div>
      <div class="intake-progress"><div id="intakeProgressBar"></div></div>
      <div class="intake-step active" data-intake-step="1">
        <div class="intake-method-grid intake-method-grid-two">
          <button type="button" class="intake-method primary-method" id="showVinEntry" data-method="vin"><span class="method-icon">VIN</span><b>Enter VIN</b><span>Enter the 17-character VIN and identify the vehicle automatically.</span></button>
          <button type="button" class="intake-method" id="showManualEntry" data-method="manual"><span class="method-icon">⌨</span><b>Enter Manually</b><span>Select the year, make and model yourself.</span></button>
        </div>
        <div id="vinEntryPanel" class="intake-entry-panel hidden"></div><div id="manualEntryPanel" class="intake-entry-panel hidden"><div class="grid3 field-grid" id="manualVehicleFields"></div></div><div id="guidedDecodeStatus"></div>
        <div class="intake-actions"><button class="btn primary" id="intakeVehicleNext">Vehicle Identified →</button></div>
      </div>
      <div class="intake-step" data-intake-step="2">
        <div class="intake-confirm-card"><div class="muted">IDENTIFIED VEHICLE</div><div id="intakeVehicleName" class="intake-vehicle-name">Vehicle not identified</div><div id="intakeVehicleVin" class="muted"></div></div>
        <div class="grid2 field-grid intake-narrow-grid" id="mileageFields"></div>
        <div class="intake-actions"><button class="btn" data-intake-back="1">← Vehicle</button><button class="btn primary" id="intakeMileageNext">Continue →</button></div>
      </div>
      <div class="intake-step" data-intake-step="3">
        <div class="title">Additional Vehicle Details</div><div class="hint">Add ownership and history details now if you know them. You can return and expand this vehicle profile at any time.</div>
        <div id="directiveChoices" class="directive-panel hidden"><div class="selector-label">For this value analysis, are you:</div><div class="assessment-layer-grid directive-grid"><button type="button" class="assessment-choice" data-guided-directive="buy"><b>Buying</b><span>Evaluate acquisition cost, risk, maximum sensible purchase price and expected value.</span></button><button type="button" class="assessment-choice" data-guided-directive="sell"><b>Selling</b><span>Evaluate current value, worthwhile recon, expected proceeds and sale strategy.</span></button></div></div>
        <div id="directiveQuestions" class="directive-questions hidden">
          <div id="buyDirectiveQuestions" class="directive-question-set hidden"><div class="directive-question-head"><b>Buying details</b><span>These values will carry into the Value module.</span></div><div class="grid3 field-grid"><label>List Price <span class="v1214-field-badge required">Required</span><input id="intakeBuyAsk" inputmode="decimal"><span class="field-help">The seller's advertised asking price.</span></label><label>Target Purchase Price <span class="v1214-field-badge optional">Optional</span><input id="intakeBuyTarget" inputmode="decimal"><span class="field-help">What you plan to offer or pay.</span></label><label>Purchase Intent<select id="intakeBuyIntent"><option value="ownership">Personal Use / Ownership</option><option value="flip">Resale / Flip</option></select><span class="field-help">Profitability is only used for Resale / Flip.</span></label></div></div>
          <div id="sellDirectiveQuestions" class="directive-question-set hidden"><div class="directive-question-head"><b>Selling details</b><span>Add only constraints you already know. The assessment will calculate what the vehicle is worth.</span></div><div class="grid3 field-grid"><label>Minimum Take-Home <span class="v1214-field-badge optional">Optional</span><input id="intakeSellFloor" inputmode="decimal"><span class="field-help">The minimum amount you need to receive after recon and selling costs.</span></label><label>Known Selling Costs <span class="v1214-field-badge optional">Optional</span><input id="intakeSellCosts" inputmode="decimal"><span class="field-help">Advertising, detailing, transport, paperwork or other known sale costs.</span></label><label>Recon Strategy <span class="v1214-field-badge optional">Optional</span><select id="intakeSellReconMode"><option value="all">Complete Planned Recon</option><option value="required">Required Only</option><option value="none">Sell As-Is</option></select><span class="field-help">Choose how much planned work should be included in the selling analysis.</span></label></div></div>
        </div>
        <div class="grid4 field-grid" id="miscVehicleFields"></div><div id="guidedRecallTools" class="toolbar inline-toolbar no-print"></div><div id="guidedRecall"></div>
        <div class="intake-actions"><button class="btn" data-intake-back="2">← Mileage</button><button class="btn primary" id="intakeFinish">Continue Assessment →</button></div>
      </div>`;
    oldCard.replaceWith(shell);

    if (labels.vin) APP.$("#vinEntryPanel").append(labels.vin);
    if (decodeButton) { const tools = el("div", "toolbar inline-toolbar no-print"); tools.append(decodeButton); APP.$("#vinEntryPanel").append(tools); }
    if (decodeStatus) APP.$("#guidedDecodeStatus").append(decodeStatus);
    ["yearSelect","makeSelect","modelSelect","model","trim"].forEach((id) => { if (labels[id]) APP.$("#manualVehicleFields").append(labels[id]); });
    ["mileage","zip"].forEach((id) => { if (labels[id]) APP.$("#mileageFields").append(labels[id]); });
    ["seller","title","keys","cold","records"].forEach((id) => { if (labels[id]) APP.$("#miscVehicleFields").append(labels[id]); });
    if (recallButton) APP.$("#guidedRecallTools").append(recallButton);
    if (recallResults) APP.$("#guidedRecall").append(recallResults);
    assessment?.remove(); oldToolbar?.remove(); originalGrid?.remove();
  }

  function transformDashboard() {
    const startGrid = APP.$("#homePage .start-grid");
    if (!startGrid || startGrid.dataset.guided === "true") return;
    startGrid.dataset.guided = "true";
    startGrid.innerHTML = `
      <button class="start-card start-card-primary" id="guidedNewVehicle"><b>+ New Vehicle</b><span>Start an inspection, value analysis or full assessment.</span></button>
      <button class="start-card" id="guidedSavedVehicles"><b>Open Saved Vehicles</b><span>Resume a vehicle and add or update any analysis without starting over.</span></button>`;
    APP.$("#guidedNewVehicle").onclick = () => { APP.clearCurrent(); selectedDirective = ""; syncSelectedPurpose(); showStep(1); APP.showPage("profilePage"); };
    APP.$("#guidedSavedVehicles").onclick = () => APP.showPage("savedPage");
  }

  function bindWizard() {
    APP.$("#showVinEntry").onclick = () => showEntry("vin");
    APP.$("#showManualEntry").onclick = () => showEntry("manual");
    APP.$$('[data-guided-directive]').forEach((button) => button.addEventListener("click", () => chooseDirective(button.dataset.guidedDirective)));
    bindDirectiveQuestions();
    APP.$("#intakeVehicleNext").onclick = () => { if (requireVehicle()) showStep(2); };
    APP.$("#intakeMileageNext").onclick = () => {
      if (!APP.$("#mileageUnknown").checked && !APP.value("mileage").trim()) {
        alert("Enter the current mileage or mark mileage as unknown.");
        return;
      }
      syncSelectedPurpose();
      showStep(3);
    };
    APP.$("#intakeFinish").onclick = () => {
      syncSelectedPurpose();
      if (selectedPurpose !== "inspection" && !selectedDirective) {
        alert("Choose Buying or Selling for the value analysis.");
        return;
      }
      applyPurpose(selectedPurpose);
      if (selectedDirective) APP.setMode(selectedDirective);
      APP.saveCurrent?.();
      if (selectedPurpose === "value") APP.showPage("marketPage");
      else APP.showPage("inspectionPage");
    };
    APP.$$('[data-intake-back]').forEach((button) => button.addEventListener("click", () => showStep(button.dataset.intakeBack)));
    APP.$("#decodeVin")?.addEventListener("click", () => setTimeout(updateVehicleSummary, 1000));
  }

  function clarifyInspectionMetrics() {
    const transactionMetric = APP.$("#transactionStatus")?.closest(".metric");
    const transactionLabel = transactionMetric?.querySelector(".muted");
    if (transactionLabel) transactionLabel.textContent = "Title & Vehicle History";
    const maintenanceMetric = APP.$("#maintenanceScore")?.closest(".metric");
    if (maintenanceMetric && !maintenanceMetric.querySelector(".metric-explainer")) maintenanceMetric.append(el("div", "muted metric-explainer", "Service-record confidence; separate from physical condition."));
    const redFlagMetric = APP.$("#redFlagCount")?.closest(".metric");
    if (redFlagMetric && !redFlagMetric.querySelector(".metric-explainer")) redFlagMetric.append(el("div", "muted metric-explainer", "Counts only critical safety, structural or major mechanical failures — not every Poor item."));
  }

  function bindInspectionNavigationFallback() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("#inspectionPage [data-next]");
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const assessmentPath = localStorage.getItem(PATH_KEY) || "inspection";
      APP.showPage(assessmentPath === "full" ? "reconPage" : "homePage");
    }, true);
  }

  function initialize() { syncSelectedPurpose(); buildWizard(); transformDashboard(); bindWizard(); clarifyInspectionMetrics(); bindInspectionNavigationFallback(); }
  document.addEventListener("scorecard:core-ready", initialize);
})();
