(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const SPECS = {
    sell: {
      required: [
        { id: "sellAsIs", label: "Current As-Is Value", why: "Needed to establish today's value." },
        { id: "sellTarget", label: "Expected Sale Price", why: "Needed to calculate expected proceeds." }
      ],
      recommended: [
        { id: "sellPostRecon", label: "Post-Recon Market Value", why: "Shows whether recon adds enough value." },
        { id: "sellList", label: "Recommended List Price", why: "Helps compare asking price with market value." },
        { id: "sellCosts", label: "Other Selling Costs", why: "Improves net-proceeds accuracy." },
        { id: "sellReconMode", label: "Recon Strategy", why: "Controls which recon costs are included." }
      ],
      optional: ["sellQuick", "sellFloor", "brokerType", "brokerFlat", "brokerPercent", "brokerMinimum"],
      outputs: ["sellNet", "sellerNetAfterBroker", "reconBenefit", "pricingCheck"]
    },
    buy: {
      required: [
        { id: "buyAsk", fallback: "asking", label: "Seller Asking Price", why: "Needed as the starting purchase price." },
        { id: "buyResale", label: "Expected Resale Price", why: "Needed for profit, ROI and maximum-buy calculations." },
        { id: "requiredProfit", label: "Required Profit", why: "Needed to calculate the maximum sensible purchase price." }
      ],
      recommended: [
        { id: "buyTarget", label: "Target Purchase Price", why: "Uses the price you actually expect to pay." },
        { id: "buyFees", label: "Tax / Title / Registration", why: "Adds unavoidable transaction costs." },
        { id: "buyAcqCosts", label: "Other Acquisition Costs", why: "Adds transport, auction or inspection expenses." },
        { id: "buySellingCosts", label: "Selling Costs", why: "Improves projected profit and margin accuracy." },
        { id: "buyReconMode", label: "Use Recon", why: "Controls which recon costs are included." }
      ],
      optional: [],
      outputs: ["buyBasis", "buyProfit", "buyROI", "buyMargin", "calculatedMaxBuy", "negotiationGap", "dealAssessment"]
    }
  };

  function hasRawValue(id) {
    const element = document.getElementById(id);
    return !!element && String(element.value || "").trim() !== "";
  }

  function complete(item) {
    return hasRawValue(item.id) || (item.fallback && hasRawValue(item.fallback));
  }

  function mode() {
    return APP.getMode?.() === "buy" ? "buy" : "sell";
  }

  function moneyFromRaw(id) {
    const element = document.getElementById(id);
    const raw = String(element?.value || "").replace(/[^0-9.-]/g, "");
    const number = Number(raw);
    return Number.isFinite(number) && raw !== "" ? APP.money(number) : "—";
  }

  function askingPrice() {
    if (hasRawValue("buyAsk")) return moneyFromRaw("buyAsk");
    if (hasRawValue("asking")) return moneyFromRaw("asking");
    return "Not entered";
  }

  function ensurePanel() {
    const card = document.querySelector("#dealPage > .card");
    if (!card) return null;

    let panel = document.getElementById("valueReadiness");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "valueReadiness";
      panel.className = "value-readiness compact-readiness";
      const hint = document.getElementById("dealModeHint");
      hint ? hint.insertAdjacentElement("afterend", panel) : card.prepend(panel);
    }
    return panel;
  }

  function typeLabel(type) {
    return type === "required" ? "Required" : type === "recommended" ? "Recommended" : "Optional";
  }

  function markField(id, type, why = "") {
    const input = document.getElementById(id);
    const label = input?.closest("label");
    if (!label) return;

    let badge = label.querySelector(".value-field-badge");
    if (!badge) {
      badge = document.createElement("span");
      label.insertBefore(badge, label.firstChild);
    }
    badge.className = `value-field-badge ${type}`;
    badge.textContent = typeLabel(type);

    let requirement = label.querySelector(".value-requirement-help");
    if (!requirement) {
      requirement = document.createElement("span");
      requirement.className = "value-requirement-help";
      label.appendChild(requirement);
    }

    if (type === "required") {
      requirement.textContent = complete({ id }) ? "✓ Complete" : `Needed — ${why}`;
      requirement.className = `value-requirement-help ${hasRawValue(id) ? "complete" : "needed"}`;
    } else if (type === "recommended") {
      requirement.textContent = hasRawValue(id) ? "✓ Added" : (why || "Improves calculation accuracy.");
      requirement.className = `value-requirement-help ${hasRawValue(id) ? "complete" : ""}`;
    } else {
      requirement.textContent = "Only fill this out when it applies.";
      requirement.className = "value-requirement-help";
    }
  }

  function markFields(spec) {
    document.querySelectorAll("#dealPage .value-field-badge, #dealPage .value-requirement-help").forEach((node) => node.remove());
    spec.required.forEach((item) => markField(item.id, "required", item.why));
    spec.recommended.forEach((item) => markField(item.id, "recommended", item.why));
    spec.optional.forEach((id) => markField(id, "optional"));
  }

  function updateOutputs(spec, missing) {
    document.querySelectorAll("#dealPage .calculation-waiting").forEach((element) => element.classList.remove("calculation-waiting"));
    if (!missing.length) {
      APP.updateValue?.();
      return;
    }

    const message = missing.length === 1 ? `Waiting for ${missing[0].label}` : `Waiting for ${missing.length} required inputs`;
    spec.outputs.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = message;
      element.classList.add("calculation-waiting");
    });
  }

  function render() {
    const currentMode = mode();
    const spec = SPECS[currentMode];
    const panel = ensurePanel();
    if (!panel) return;

    markFields(spec);

    const missing = spec.required.filter((item) => !complete(item));
    const done = spec.required.length - missing.length;
    const ready = missing.length === 0;

    panel.innerHTML = `
      <div class="readiness-head compact">
        <div>
          <div class="readiness-title">${currentMode === "buy" ? "Buying" : "Selling"} analysis</div>
          <div class="readiness-summary ${ready ? "ready" : "pending"}">${done}/${spec.required.length} required inputs complete</div>
        </div>
        <div class="readiness-status ${ready ? "ready" : "pending"}">${ready ? "Ready" : `${missing.length} Remaining`}</div>
      </div>
      <div class="readiness-progress"><div style="width:${Math.round((done / spec.required.length) * 100)}%"></div></div>
      <div class="value-context-row">
        <span>Seller Asking Price</span>
        <strong>${askingPrice()}</strong>
      </div>
      <div class="readiness-note compact-note">
        Fill out the fields below. Each one is marked <b>Required</b>, <b>Recommended</b>, or <b>Optional</b> so you can see exactly what the calculation needs.
      </div>`;

    updateOutputs(spec, missing);
  }

  function scheduleRender() {
    window.setTimeout(render, 0);
  }

  document.addEventListener("input", (event) => {
    if (event.target.closest("#dealPage") || event.target.id === "asking") scheduleRender();
  });
  document.addEventListener("change", (event) => {
    if (event.target.closest("#dealPage") || event.target.id === "asking") scheduleRender();
  });
  document.addEventListener("scorecard:workflowchange", scheduleRender);
  document.addEventListener("scorecard:datachange", scheduleRender);
  document.addEventListener("scorecard:core-ready", scheduleRender);

  const observer = new MutationObserver(() => {
    if (document.querySelector("#dealPage.page.active")) scheduleRender();
  });
  observer.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["class"] });
})();
