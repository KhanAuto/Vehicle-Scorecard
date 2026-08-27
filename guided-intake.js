(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  let currentStep = 1;
  let selectedPurpose = "";

  function el(tag, className = "", html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function vehicleName() {
    const vehicle = APP.getVehicle();
    return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
      .filter(Boolean)
      .join(" ") || "Vehicle not identified";
  }

  function showStep(step) {
    currentStep = Math.min(4, Math.max(1, Number(step) || 1));

    document.querySelectorAll("[data-intake-step]").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.intakeStep) === currentStep);
    });

    const label = document.querySelector("#intakeStepLabel");
    const bar = document.querySelector("#intakeProgressBar");
    if (label) label.textContent = `Step ${currentStep} of 4`;
    if (bar) bar.style.width = `${currentStep * 25}%`;
    if (currentStep >= 2) updateVehicleSummary();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVehicleSummary() {
    const name = APP.$("#intakeVehicleName");
    const vin = APP.$("#intakeVehicleVin");
    if (name) name.textContent = vehicleName();
    if (vin) {
      vin.textContent = APP.value("vin")
        ? `VIN ${APP.value("vin")}`
        : "Manual vehicle identification";
    }
  }

  function showEntry(kind) {
    APP.$("#vinEntryPanel")?.classList.toggle("hidden", kind !== "vin");
    APP.$("#manualEntryPanel")?.classList.toggle("hidden", kind !== "manual");

    APP.$$(".intake-method").forEach((button) => {
      button.classList.toggle("selected", button.dataset.method === kind);
    });

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
    if (purpose === "condition") APP.setLayer("condition");
    if (purpose === "buy") APP.setMode("buy");
    if (purpose === "sell") APP.setMode("sell");
  }

  function choosePurpose(purpose) {
    selectedPurpose = purpose;
    applyPurpose(purpose);

    APP.$$('[data-guided-purpose]').forEach((button) => {
      button.classList.toggle("active", button.dataset.guidedPurpose === purpose);
      button.classList.toggle("selected", button.dataset.guidedPurpose === purpose);
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
    [
      "vin", "yearSelect", "makeSelect", "modelSelect", "model", "trim",
      "mileage", "zip", "seller", "title", "keys", "cold", "records"
    ].forEach((id) => {
      labels[id] = APP.$(`#${id}`)?.closest("label") || null;
    });

    const shell = el("div", "card intake-shell");
    shell.dataset.guided = "true";
    shell.innerHTML = `
      <div class="intake-topline">
        <div>
          <div class="eyebrow intake-eyebrow">NEW VEHICLE ASSESSMENT</div>
          <div class="title">Identify the Vehicle</div>
          <div class="hint">Enter the VIN to identify the vehicle automatically, or select the year, make and model manually.</div>
        </div>
        <div id="intakeStepLabel" class="intake-step-label">Step 1 of 4</div>
      </div>

      <div class="intake-progress"><div id="intakeProgressBar"></div></div>

      <div class="intake-step active" data-intake-step="1">
        <div class="intake-method-grid intake-method-grid-two">
          <button type="button" class="intake-method primary-method" id="showVinEntry" data-method="vin">
            <span class="method-icon">VIN</span>
            <b>Enter VIN</b>
            <span>Enter the 17-character VIN and identify the vehicle automatically.</span>
          </button>
          <button type="button" class="intake-method" id="showManualEntry" data-method="manual">
            <span class="method-icon">⌨</span>
            <b>Enter Manually</b>
            <span>Select the year, make and model yourself.</span>
          </button>
        </div>
        <div id="vinEntryPanel" class="intake-entry-panel hidden"></div>
        <div id="manualEntryPanel" class="intake-entry-panel hidden">
          <div class="grid3 field-grid" id="manualVehicleFields"></div>
        </div>
        <div id="guidedDecodeStatus"></div>
        <div class="intake-actions">
          <button class="btn primary" id="intakeVehicleNext">Vehicle Identified →</button>
        </div>
      </div>

      <div class="intake-step" data-intake-step="2">
        <div class="intake-confirm-card">
          <div class="muted">IDENTIFIED VEHICLE</div>
          <div id="intakeVehicleName" class="intake-vehicle-name">Vehicle not identified</div>
          <div id="intakeVehicleVin" class="muted"></div>
        </div>
        <div class="grid2 field-grid intake-narrow-grid" id="mileageFields"></div>
        <div class="intake-actions">
          <button class="btn" data-intake-back="1">← Vehicle</button>
          <button class="btn primary" id="intakeMileageNext">Continue →</button>
        </div>
      </div>

      <div class="intake-step" data-intake-step="3">
        <div class="title">What type of assessment are you running?</div>
        <div class="hint">Condition is always the foundation. Pricing analysis adds recon, market and buy/sell economics on top.</div>
        <div class="assessment-layer-grid three-purpose-grid guided-purpose-grid">
          <button type="button" class="assessment-choice" data-guided-purpose="condition">
            <b>Condition Only</b>
            <span>Inspect, score and document the vehicle without pricing analysis.</span>
          </button>
          <button type="button" class="assessment-choice" data-guided-purpose="buy">
            <b>Condition + Pricing · Buying</b>
            <span>Condition, recon, market position and maximum sensible purchase price.</span>
          </button>
          <button type="button" class="assessment-choice" data-guided-purpose="sell">
            <b>Condition + Pricing · Selling</b>
            <span>Condition, recon, market position and realistic sale strategy.</span>
          </button>
        </div>
        <div class="intake-actions">
          <button class="btn" data-intake-back="2">← Mileage</button>
          <button class="btn primary" id="intakePurposeNext">Continue →</button>
        </div>
      </div>

      <div class="intake-step" data-intake-step="4">
        <div class="title">Additional Vehicle Details</div>
        <div class="hint">Add ownership and history details now if you know them. Pricing fields are handled later in Value & Price Analysis.</div>
        <div class="grid4 field-grid" id="miscVehicleFields"></div>
        <div id="guidedRecallTools" class="toolbar inline-toolbar no-print"></div>
        <div id="guidedRecall"></div>
        <div class="intake-actions">
          <button class="btn" data-intake-back="3">← Purpose</button>
          <button class="btn primary" id="intakeFinish">Start Assessment →</button>
        </div>
      </div>`;

    oldCard.replaceWith(shell);

    if (labels.vin) APP.$("#vinEntryPanel").append(labels.vin);
    if (decodeButton) {
      const decodeTools = el("div", "toolbar inline-toolbar no-print");
      decodeTools.append(decodeButton);
      APP.$("#vinEntryPanel").append(decodeTools);
    }
    if (decodeStatus) APP.$("#guidedDecodeStatus").append(decodeStatus);

    ["yearSelect", "makeSelect", "modelSelect", "model", "trim"].forEach((id) => {
      if (labels[id]) APP.$("#manualVehicleFields").append(labels[id]);
    });

    ["mileage", "zip"].forEach((id) => {
      if (labels[id]) APP.$("#mileageFields").append(labels[id]);
    });

    ["seller", "title", "keys", "cold", "records"].forEach((id) => {
      if (labels[id]) APP.$("#miscVehicleFields").append(labels[id]);
    });

    if (recallButton) APP.$("#guidedRecallTools").append(recallButton);
    if (recallResults) APP.$("#guidedRecall").append(recallResults);

    assessment?.remove();
    oldToolbar?.remove();
    originalGrid?.remove();
  }

  function transformDashboard() {
    const startGrid = APP.$("#homePage .start-grid");
    if (!startGrid || startGrid.dataset.guided === "true") return;

    startGrid.dataset.guided = "true";
    startGrid.innerHTML = `
      <button class="start-card start-card-primary" id="guidedNewVehicle">
        <b>+ Assess a Vehicle</b>
        <span>Identify the vehicle first, then choose condition-only or condition + pricing.</span>
      </button>
      <button class="start-card" id="guidedSavedVehicles">
        <b>Open Saved Vehicles</b>
        <span>Jump back into a previous inspection or value analysis.</span>
      </button>`;

    APP.$("#guidedNewVehicle").onclick = () => {
      APP.clearCurrent();
      selectedPurpose = "";
      showStep(1);
      APP.showPage("profilePage");
    };

    APP.$("#guidedSavedVehicles").onclick = () => APP.showPage("savedPage");
  }

  function bindWizard() {
    APP.$("#showVinEntry").onclick = () => showEntry("vin");
    APP.$("#showManualEntry").onclick = () => showEntry("manual");

    APP.$$('[data-guided-purpose]').forEach((button) => {
      button.addEventListener("click", () => choosePurpose(button.dataset.guidedPurpose));
    });

    APP.$("#intakeVehicleNext").onclick = () => {
      if (requireVehicle()) showStep(2);
    };

    APP.$("#intakeMileageNext").onclick = () => {
      if (!APP.$("#mileageUnknown").checked && !APP.value("mileage").trim()) {
        alert("Enter the current mileage or mark mileage as unknown.");
        return;
      }
      showStep(3);
    };

    APP.$("#intakePurposeNext").onclick = () => {
      if (!selectedPurpose) {
        alert("Choose Condition Only, Condition + Pricing · Buying, or Condition + Pricing · Selling.");
        return;
      }
      showStep(4);
    };

    APP.$("#intakeFinish").onclick = () => {
      if (!selectedPurpose) {
        alert("Choose an assessment type before starting the inspection.");
        showStep(3);
        return;
      }

      applyPurpose(selectedPurpose);
      APP.saveCurrent?.();
      applyPurpose(selectedPurpose);
      APP.showPage("inspectionPage");
    };

    APP.$$('[data-intake-back]').forEach((button) => {
      button.addEventListener("click", () => showStep(button.dataset.intakeBack));
    });

    APP.$("#decodeVin")?.addEventListener("click", () => {
      setTimeout(updateVehicleSummary, 1000);
    });
  }

  function clarifyInspectionMetrics() {
    const transactionMetric = APP.$("#transactionStatus")?.closest(".metric");
    const transactionLabel = transactionMetric?.querySelector(".muted");
    if (transactionLabel) transactionLabel.textContent = "Title & Vehicle History";

    const maintenanceMetric = APP.$("#maintenanceScore")?.closest(".metric");
    if (maintenanceMetric && !maintenanceMetric.querySelector(".metric-explainer")) {
      const note = el("div", "muted metric-explainer", "Service-record confidence; separate from physical condition.");
      maintenanceMetric.append(note);
    }

    const redFlagMetric = APP.$("#redFlagCount")?.closest(".metric");
    if (redFlagMetric && !redFlagMetric.querySelector(".metric-explainer")) {
      const note = el("div", "muted metric-explainer", "Counts only critical safety, structural or major mechanical failures — not every Poor item.");
      redFlagMetric.append(note);
    }
  }

  function bindInspectionNavigationFallback() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("#inspectionPage [data-next]");
      if (!button) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const layer = APP.getLayer() || "condition";
      const target = layer === "value" ? "reconPage" : "homePage";

      if (layer === "condition") {
        APP.saveCurrent?.();
      }

      APP.showPage(target);
    }, true);
  }

  function initialize() {
    buildWizard();
    transformDashboard();
    bindWizard();
    clarifyInspectionMetrics();
    bindInspectionNavigationFallback();
  }

  document.addEventListener("scorecard:core-ready", initialize);
})();
