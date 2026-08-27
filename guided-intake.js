(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  let currentStep = 1;

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
      panel.classList.toggle(
        "active",
        Number(panel.dataset.intakeStep) === currentStep
      );
    });

    const label = document.querySelector("#intakeStepLabel");
    const bar = document.querySelector("#intakeProgressBar");

    if (label) label.textContent = `Step ${currentStep} of 4`;
    if (bar) bar.style.width = `${currentStep * 25}%`;
    if (currentStep >= 2) updateVehicleSummary();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVehicleSummary() {
    const name = document.querySelector("#intakeVehicleName");
    const vin = document.querySelector("#intakeVehicleVin");

    if (name) name.textContent = vehicleName();
    if (vin) {
      vin.textContent = APP.value("vin")
        ? `VIN ${APP.value("vin")}`
        : "Manual vehicle identification";
    }
  }

  function showEntry(kind) {
    document.querySelector("#vinEntryPanel")?.classList.toggle(
      "hidden",
      kind !== "vin"
    );

    document.querySelector("#manualEntryPanel")?.classList.toggle(
      "hidden",
      kind !== "manual"
    );

    document.querySelectorAll(".intake-method").forEach((button) => {
      button.classList.toggle(
        "selected",
        button.dataset.method === kind
      );
    });

    if (kind === "vin") APP.$("#vin")?.focus();
    if (kind === "manual") APP.$("#yearSelect")?.focus();
  }

  function requireVehicle() {
    const vehicle = APP.getVehicle();

    if (vehicle.year && vehicle.make && vehicle.model) {
      return true;
    }

    const status = APP.$("#decodeStatus");
    if (status) {
      status.textContent =
        "Identify the vehicle first: decode the VIN or select year, make and model.";
      status.classList.add("intake-warning");
    }

    return false;
  }

  function buildWizard() {
    const profile = APP.$("#profilePage");
    const oldCard = profile?.querySelector(":scope > .card");

    if (!oldCard || oldCard.dataset.guided === "true") return;

    const assessment = APP.$("#assessmentSelector");
    const originalGrid = oldCard.querySelector(".field-grid");
    const toolbar = oldCard.querySelector(".inline-toolbar");
    const decodeStatus = APP.$("#decodeStatus");
    const recallResults = APP.$("#recallResults");

    const labels = {};

    [
      "vin", "yearSelect", "makeSelect", "modelSelect", "model", "trim",
      "mileage", "asking", "zip", "seller", "title", "keys", "cold", "records"
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

      <div class="intake-step active" data-intake-step="1" id="intakeStep1">
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

      <div class="intake-step" data-intake-step="2" id="intakeStep2">
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

      <div class="intake-step" data-intake-step="3" id="intakeStep3">
        <div class="title">What are you trying to learn?</div>
        <div class="hint">Choose the purpose after the vehicle is identified. You can change it later.</div>
        <div id="guidedPurpose"></div>

        <div class="intake-actions">
          <button class="btn" data-intake-back="2">← Mileage</button>
          <button class="btn primary" id="intakePurposeNext">Continue →</button>
        </div>
      </div>

      <div class="intake-step" data-intake-step="4" id="intakeStep4">
        <div class="title">Additional Vehicle Details</div>
        <div class="hint">Add what you know now. Most of this is optional and can be completed later.</div>
        <div class="grid4 field-grid" id="miscVehicleFields"></div>
        <div id="guidedToolbar"></div>
        <div id="guidedRecall"></div>

        <div class="intake-actions">
          <button class="btn" data-intake-back="3">← Purpose</button>
          <button class="btn primary" id="intakeFinish">Start Assessment →</button>
        </div>
      </div>`;

    oldCard.replaceWith(shell);

    const vinPanel = APP.$("#vinEntryPanel");
    if (labels.vin) vinPanel.append(labels.vin);

    const decodeButton = APP.$("#decodeVin");
    if (decodeButton) {
      const decodeTools = el("div", "toolbar inline-toolbar no-print");
      decodeTools.append(decodeButton);
      vinPanel.append(decodeTools);
    }

    if (decodeStatus) APP.$("#guidedDecodeStatus").append(decodeStatus);

    ["yearSelect", "makeSelect", "modelSelect", "model", "trim"].forEach((id) => {
      if (labels[id]) APP.$("#manualVehicleFields").append(labels[id]);
    });

    ["mileage", "zip"].forEach((id) => {
      if (labels[id]) APP.$("#mileageFields").append(labels[id]);
    });

    ["asking", "seller", "title", "keys", "cold", "records"].forEach((id) => {
      if (labels[id]) APP.$("#miscVehicleFields").append(labels[id]);
    });

    assessment.classList.add("guided-purpose");
    assessment.querySelector(".selector-label")?.remove();

    const layerGrid = assessment.querySelector(".assessment-layer-grid");
    const conditionButton = layerGrid?.querySelector('[data-layer="condition"]');
    const valueButton = layerGrid?.querySelector('[data-layer="value"]');

    if (conditionButton) {
      conditionButton.querySelector("b").textContent = "Condition Only";
      conditionButton.querySelector("span").textContent =
        "Inspect, score and document the vehicle without pricing analysis.";
    }

    if (valueButton) valueButton.remove();

    const modeGrid = APP.$("#valueModeChoices");

    if (modeGrid) {
      modeGrid.classList.remove("value-mode-grid");
      modeGrid.classList.add("assessment-layer-grid", "three-purpose-grid", "show");

      const buyButton = modeGrid.querySelector('[data-value-mode="buy"]');
      const sellButton = modeGrid.querySelector('[data-value-mode="sell"]');

      if (buyButton) {
        buyButton.querySelector("b").textContent = "Buying This Vehicle";
        buyButton.querySelector("span").textContent =
          "Condition, recon, market position and maximum sensible purchase price.";
      }

      if (sellButton) {
        sellButton.querySelector("b").textContent = "Selling This Vehicle";
        sellButton.querySelector("span").textContent =
          "Condition, recon, market position and realistic sale strategy.";
      }

      if (layerGrid) {
        layerGrid.append(...modeGrid.children);
        modeGrid.remove();
        layerGrid.classList.add("three-purpose-grid");
      }
    }

    APP.$("#guidedPurpose").append(assessment);

    if (toolbar) APP.$("#guidedToolbar").append(toolbar);
    if (recallResults) APP.$("#guidedRecall").append(recallResults);

    originalGrid?.remove();
  }

  function transformDashboard() {
    const startGrid = APP.$("#homePage .start-grid");

    if (!startGrid || startGrid.dataset.guided === "true") return;

    startGrid.dataset.guided = "true";
    startGrid.innerHTML = `
      <button class="start-card start-card-primary" id="guidedNewVehicle">
        <b>+ Assess a Vehicle</b>
        <span>Identify the vehicle first, then choose condition, buying or selling.</span>
      </button>

      <button class="start-card" id="guidedSavedVehicles">
        <b>Open Saved Vehicles</b>
        <span>Jump back into a previous inspection or value analysis.</span>
      </button>`;

    APP.$("#guidedNewVehicle").onclick = () => {
      APP.clearCurrent();
      showStep(1);
      APP.showPage("profilePage");
    };

    APP.$("#guidedSavedVehicles").onclick = () => APP.showPage("savedPage");
  }

  function bindWizard() {
    APP.$("#showVinEntry").onclick = () => showEntry("vin");
    APP.$("#showManualEntry").onclick = () => showEntry("manual");

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
      const layer = APP.getLayer();
      const mode = APP.getMode();

      if (!layer || (layer === "value" && !["buy", "sell"].includes(mode))) {
        alert("Choose Condition Only, Buying This Vehicle, or Selling This Vehicle.");
        return;
      }

      showStep(4);
    };

    APP.$("#intakeFinish").onclick = () => {
      APP.saveCurrent?.();
      APP.showPage("inspectionPage");
    };

    document.querySelectorAll("[data-intake-back]").forEach((button) => {
      button.addEventListener("click", () => showStep(button.dataset.intakeBack));
    });

    APP.$("#decodeVin")?.addEventListener("click", () => {
      setTimeout(updateVehicleSummary, 1000);
    });
  }

  function initialize() {
    buildWizard();
    transformDashboard();
    bindWizard();
  }

  document.addEventListener("scorecard:core-ready", initialize);
})();
