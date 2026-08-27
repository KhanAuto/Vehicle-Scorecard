(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  let currentStep = 1;
  let ocrLoading = false;
  const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

  function el(tag, className = "", html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function cleanVin(value) {
    return String(value || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  }

  function extractVin(text) {
    const normalized = String(text || "").toUpperCase().replace(/[\r\n\t]/g, " ");
    const direct = normalized.match(VIN_PATTERN)?.[0];
    if (direct) return direct;
    return normalized.replace(/[^A-HJ-NPR-Z0-9]/g, "").match(/[A-HJ-NPR-Z0-9]{17}/)?.[0] || "";
  }

  function vehicleName() {
    const vehicle = APP.getVehicle();
    return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "Vehicle not identified";
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
    const name = document.querySelector("#intakeVehicleName");
    const vin = document.querySelector("#intakeVehicleVin");
    if (name) name.textContent = vehicleName();
    if (vin) vin.textContent = APP.value("vin") ? `VIN ${APP.value("vin")}` : "Manual vehicle identification";
  }

  function showEntry(kind) {
    document.querySelector("#vinEntryPanel")?.classList.toggle("hidden", kind !== "vin");
    document.querySelector("#manualEntryPanel")?.classList.toggle("hidden", kind !== "manual");
    if (kind === "vin") APP.$("#vin")?.focus();
  }

  function requireVehicle() {
    const vehicle = APP.getVehicle();
    if (vehicle.year && vehicle.make && vehicle.model) return true;
    const status = APP.$("#decodeStatus");
    status.textContent = "Identify the vehicle first: decode the VIN or select year, make and model.";
    status.classList.add("intake-warning");
    return false;
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ocrLoading) {
      return new Promise((resolve, reject) => {
        const timer = setInterval(() => window.Tesseract && (clearInterval(timer), resolve(window.Tesseract)), 150);
        setTimeout(() => { clearInterval(timer); reject(new Error("OCR load timeout")); }, 15000);
      });
    }
    ocrLoading = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => { ocrLoading = false; resolve(window.Tesseract); };
      script.onerror = () => { ocrLoading = false; reject(new Error("OCR library unavailable")); };
      document.head.appendChild(script);
    });
  }

  async function tryBarcode(file) {
    if (!("BarcodeDetector" in window)) return "";
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = ["code_39", "code_128", "data_matrix", "qr_code"].filter((f) => supported.includes(f));
      if (!formats.length) return "";
      const detector = new BarcodeDetector({ formats });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close?.();
      for (const code of codes) {
        const vin = extractVin(code.rawValue);
        if (vin) return vin;
      }
    } catch (error) {
      console.warn("VIN barcode scan unavailable", error);
    }
    return "";
  }

  async function tryOcr(file) {
    try {
      const Tesseract = await loadTesseract();
      const result = await Tesseract.recognize(file, "eng", {
        logger(message) {
          if (message.status === "recognizing text") {
            APP.$("#vinScanStatus").textContent = `Reading VIN tag… ${Math.round((message.progress || 0) * 100)}%`;
          }
        }
      });
      return extractVin(result?.data?.text || "");
    } catch (error) {
      console.warn("VIN OCR unavailable", error);
      return "";
    }
  }

  async function useCapturedVin(vin, label) {
    const cleaned = cleanVin(vin);
    if (cleaned.length !== 17) return false;
    APP.$("#vin").value = cleaned;
    showEntry("vin");
    APP.$("#vinScanStatus").textContent = `${label}: ${cleaned}. Identifying vehicle…`;
    APP.$("#decodeVin").click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    updateVehicleSummary();
    return true;
  }

  async function processVinPhoto(file) {
    const status = APP.$("#vinScanStatus");
    status.classList.remove("hidden");
    status.textContent = "Looking for a VIN barcode…";
    const barcodeVin = await tryBarcode(file);
    if (barcodeVin) return useCapturedVin(barcodeVin, "VIN barcode read");
    status.textContent = "No readable barcode found. Reading the VIN tag text…";
    const ocrVin = await tryOcr(file);
    if (ocrVin) return useCapturedVin(ocrVin, "VIN text read");
    status.textContent = "I couldn't confidently read a 17-character VIN. Try a closer, glare-free photo or enter it manually.";
    showEntry("vin");
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
    ["vin","yearSelect","makeSelect","modelSelect","model","trim","mileage","asking","zip","seller","title","keys","cold","records"].forEach((id) => {
      labels[id] = APP.$(`#${id}`)?.closest("label") || null;
    });

    const shell = el("div", "card intake-shell");
    shell.dataset.guided = "true";
    shell.innerHTML = `
      <div class="intake-topline"><div><div class="eyebrow intake-eyebrow">NEW VEHICLE ASSESSMENT</div><div class="title">Identify the Vehicle</div><div class="hint">Start with the vehicle itself. Scan a VIN, enter a VIN, or select the vehicle manually.</div></div><div id="intakeStepLabel" class="intake-step-label">Step 1 of 4</div></div>
      <div class="intake-progress"><div id="intakeProgressBar"></div></div>
      <div class="intake-step active" data-intake-step="1" id="intakeStep1">
        <div class="intake-method-grid">
          <button type="button" class="intake-method primary-method" id="scanVinCamera"><span class="method-icon">▣</span><b>Scan VIN / Barcode</b><span>Use your phone camera. Barcode scanning is fastest; VIN-tag photos can use OCR.</span></button>
          <button type="button" class="intake-method" id="showVinEntry"><span class="method-icon">VIN</span><b>Enter VIN</b><span>Type the 17-character VIN and identify the vehicle automatically.</span></button>
          <button type="button" class="intake-method" id="showManualEntry"><span class="method-icon">⌨</span><b>Enter Manually</b><span>Select year, make and model yourself.</span></button>
        </div>
        <input id="vinPhotoInput" type="file" accept="image/*" capture="environment" class="hidden">
        <div id="vinScanStatus" class="notice hidden"></div>
        <div id="vinEntryPanel" class="intake-entry-panel hidden"></div>
        <div id="manualEntryPanel" class="intake-entry-panel hidden"><div class="grid3 field-grid" id="manualVehicleFields"></div></div>
        <div id="guidedDecodeStatus"></div>
        <div class="intake-actions"><button class="btn primary" id="intakeVehicleNext">Vehicle Identified →</button></div>
      </div>
      <div class="intake-step" data-intake-step="2" id="intakeStep2">
        <div class="intake-confirm-card"><div class="muted">IDENTIFIED VEHICLE</div><div id="intakeVehicleName" class="intake-vehicle-name">Vehicle not identified</div><div id="intakeVehicleVin" class="muted"></div></div>
        <div class="grid2 field-grid intake-narrow-grid" id="mileageFields"></div>
        <div class="intake-actions"><button class="btn" data-intake-back="1">← Vehicle</button><button class="btn primary" id="intakeMileageNext">Continue →</button></div>
      </div>
      <div class="intake-step" data-intake-step="3" id="intakeStep3">
        <div class="title">What are you trying to learn?</div><div class="hint">Choose the purpose after the vehicle is identified. You can change it later.</div>
        <div id="guidedPurpose"></div>
        <div class="intake-actions"><button class="btn" data-intake-back="2">← Mileage</button><button class="btn primary" id="intakePurposeNext">Continue →</button></div>
      </div>
      <div class="intake-step" data-intake-step="4" id="intakeStep4">
        <div class="title">Additional Vehicle Details</div><div class="hint">Add what you know now. Most of this is optional and can be completed later.</div>
        <div class="grid4 field-grid" id="miscVehicleFields"></div><div id="guidedToolbar"></div><div id="guidedRecall"></div>
        <div class="intake-actions"><button class="btn" data-intake-back="3">← Purpose</button><button class="btn primary" id="intakeFinish">Start Assessment →</button></div>
      </div>`;

    oldCard.replaceWith(shell);

    const vinPanel = APP.$("#vinEntryPanel");
    vinPanel.append(labels.vin);
    const decodeButton = APP.$("#decodeVin");
    const decodeTools = el("div", "toolbar inline-toolbar no-print");
    decodeTools.append(decodeButton);
    vinPanel.append(decodeTools);
    APP.$("#guidedDecodeStatus").append(decodeStatus);

    ["yearSelect","makeSelect","modelSelect","model","trim"].forEach((id) => labels[id] && APP.$("#manualVehicleFields").append(labels[id]));
    ["mileage","zip"].forEach((id) => labels[id] && APP.$("#mileageFields").append(labels[id]));
    ["asking","seller","title","keys","cold","records"].forEach((id) => labels[id] && APP.$("#miscVehicleFields").append(labels[id]));

    assessment.classList.add("guided-purpose");
    assessment.querySelector(".selector-label")?.remove();
    const layerGrid = assessment.querySelector(".assessment-layer-grid");
    const conditionButton = layerGrid?.querySelector('[data-layer="condition"]');
    const valueButton = layerGrid?.querySelector('[data-layer="value"]');
    if (conditionButton) {
      conditionButton.querySelector("b").textContent = "Condition Only";
      conditionButton.querySelector("span").textContent = "Inspect, score and document the vehicle without pricing analysis.";
    }
    if (valueButton) valueButton.remove();
    const modeGrid = APP.$("#valueModeChoices");
    modeGrid.classList.remove("value-mode-grid");
    modeGrid.classList.add("assessment-layer-grid", "three-purpose-grid", "show");
    const buyButton = modeGrid.querySelector('[data-value-mode="buy"]');
    const sellButton = modeGrid.querySelector('[data-value-mode="sell"]');
    if (buyButton) { buyButton.querySelector("b").textContent = "Buying This Vehicle"; buyButton.querySelector("span").textContent = "Condition, recon, market position and maximum sensible purchase price."; }
    if (sellButton) { sellButton.querySelector("b").textContent = "Selling This Vehicle"; sellButton.querySelector("span").textContent = "Condition, recon, market position and realistic sale strategy."; }
    if (layerGrid && modeGrid) { layerGrid.append(...modeGrid.children); modeGrid.remove(); layerGrid.classList.add("three-purpose-grid"); }
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
      <button class="start-card start-card-primary" id="guidedNewVehicle"><b>+ Assess a Vehicle</b><span>Identify the vehicle first, then choose condition, buying or selling.</span></button>
      <button class="start-card" id="guidedSavedVehicles"><b>Open Saved Vehicles</b><span>Jump back into a previous inspection or value analysis.</span></button>`;
    APP.$("#guidedNewVehicle").onclick = () => { APP.clearCurrent(); showStep(1); APP.showPage("profilePage"); };
    APP.$("#guidedSavedVehicles").onclick = () => APP.showPage("savedPage");
  }

  function bindWizard() {
    APP.$("#scanVinCamera").onclick = () => APP.$("#vinPhotoInput").click();
    APP.$("#vinPhotoInput").onchange = async (event) => {
      const file = event.target.files?.[0];
      if (file) await processVinPhoto(file);
      event.target.value = "";
    };
    APP.$("#showVinEntry").onclick = () => showEntry("vin");
    APP.$("#showManualEntry").onclick = () => showEntry("manual");
    APP.$("#intakeVehicleNext").onclick = () => requireVehicle() && showStep(2);
    APP.$("#intakeMileageNext").onclick = () => {
      if (!APP.$("#mileageUnknown").checked && !APP.value("mileage").trim()) return alert("Enter the current mileage or mark mileage as unknown.");
      showStep(3);
    };
    APP.$("#intakePurposeNext").onclick = () => {
      const layer = APP.getLayer();
      const mode = APP.getMode();
      if (!layer || (layer === "value" && !["buy","sell"].includes(mode))) return alert("Choose Condition Only, Buying This Vehicle, or Selling This Vehicle.");
      showStep(4);
    };
    APP.$("#intakeFinish").onclick = () => {
      const missing = APP.validateVehicleProfile();
      if (missing.length) return alert(`Complete required vehicle information: ${missing.join(", ")}.`);
      APP.showPage("inspectionPage");
    };
    document.querySelectorAll("[data-intake-back]").forEach((button) => button.onclick = () => showStep(button.dataset.intakeBack));
    document.addEventListener("scorecard:vehiclechange", updateVehicleSummary);
  }

  function initialize() {
    buildWizard();
    transformDashboard();
    bindWizard();

    const originalLoadSaved = APP.loadSaved;
    APP.loadSaved = async (id) => {
      await originalLoadSaved(id);
      APP.showPage("homePage");
    };

    showStep(1);
  }

  document.addEventListener("scorecard:core-ready", initialize);
})();
