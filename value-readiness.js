(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const SPECS = {
    sell: {
      title: "Selling calculation readiness",
      required: [
        {
          id: "sellAsIs",
          label: "Current As-Is Value",
          why: "Establishes what the vehicle is worth before additional work."
        },
        {
          id: "sellTarget",
          label: "Expected Sale Price",
          why: "Needed to calculate realistic net proceeds."
        }
      ],
      recommended: [
        {
          id: "sellPostRecon",
          label: "Post-Recon Market Value",
          why: "Shows whether planned recon actually adds enough value."
        },
        {
          id: "sellList",
          label: "Recommended List Price",
          why: "Lets the app compare your advertised price with expected market value."
        },
        {
          id: "sellCosts",
          label: "Other Selling Costs",
          why: "Improves the accuracy of seller take-home."
        }
      ],
      optional: [
        "sellQuick",
        "sellFloor",
        "brokerType",
        "brokerFlat",
        "brokerPercent",
        "brokerMinimum"
      ],
      outputs: [
        "sellNet",
        "sellerNetAfterBroker",
        "reconBenefit",
        "pricingCheck"
      ]
    },
    buy: {
      title: "Buying calculation readiness",
      required: [
        {
          id: "buyAsk",
          fallback: "asking",
          label: "Seller Asking Price",
          why: "Defines the starting price you are comparing against."
        },
        {
          id: "buyResale",
          label: "Expected Resale Price",
          why: "Needed to estimate profit, ROI and maximum sensible purchase price."
        },
        {
          id: "requiredProfit",
          label: "Required Profit",
          why: "Defines the minimum return the deal must produce."
        }
      ],
      recommended: [
        {
          id: "buyTarget",
          label: "Target Purchase Price",
          why: "Lets the app calculate your expected basis at the price you actually plan to pay."
        },
        {
          id: "buyFees",
          label: "Tax / Title / Registration",
          why: "Adds unavoidable transaction costs to your basis."
        },
        {
          id: "buyAcqCosts",
          label: "Other Acquisition Costs",
          why: "Captures transport, auction, inspection or other acquisition expenses."
        },
        {
          id: "buySellingCosts",
          label: "Selling Costs",
          why: "Improves projected profit and margin accuracy."
        }
      ],
      optional: [],
      outputs: [
        "buyBasis",
        "buyProfit",
        "buyROI",
        "buyMargin",
        "calculatedMaxBuy",
        "negotiationGap",
        "dealAssessment"
      ]
    }
  };

  function hasRawValue(id) {
    const element = document.getElementById(id);
    if (!element) return false;

    if (element.tagName === "SELECT") {
      return String(element.value || "").trim() !== "";
    }

    return String(element.value || "").trim() !== "";
  }

  function requirementComplete(item) {
    return hasRawValue(item.id) || (item.fallback && hasRawValue(item.fallback));
  }

  function mode() {
    return APP.getMode?.() === "buy" ? "buy" : "sell";
  }

  function ensurePanel() {
    const dealCard = document.querySelector("#dealPage > .card");
    if (!dealCard) return null;

    let panel = document.getElementById("valueReadiness");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "valueReadiness";
    panel.className = "value-readiness";

    const hint = document.getElementById("dealModeHint");
    if (hint) {
      hint.insertAdjacentElement("afterend", panel);
    } else {
      dealCard.prepend(panel);
    }

    return panel;
  }

  function badgeFor(type) {
    return `<span class="value-field-badge ${type}">${
      type === "required" ? "Required" :
      type === "recommended" ? "Recommended" :
      "Optional"
    }</span>`;
  }

  function markField(id, type) {
    const element = document.getElementById(id);
    const label = element?.closest("label");
    if (!label) return;

    let badge = label.querySelector(".value-field-badge");

    if (!badge) {
      label.insertAdjacentHTML("afterbegin", badgeFor(type));
      badge = label.querySelector(".value-field-badge");
    }

    badge.className = `value-field-badge ${type}`;
    badge.textContent =
      type === "required" ? "Required" :
      type === "recommended" ? "Recommended" :
      "Optional";
  }

  function markFields(spec) {
    document.querySelectorAll("#dealPage .value-field-badge").forEach((badge) => badge.remove());

    spec.required.forEach((item) => markField(item.id, "required"));
    spec.recommended.forEach((item) => markField(item.id, "recommended"));
    spec.optional.forEach((id) => markField(id, "optional"));

    if (mode() === "sell") {
      markField("sellReconMode", "recommended");
    } else {
      markField("buyReconMode", "recommended");
    }
  }

  function waitingText(missing) {
    if (!missing.length) return "";
    if (missing.length === 1) return `Waiting for ${missing[0].label}`;
    return `Waiting for ${missing.length} required inputs`;
  }

  function updateOutputs(spec, missing) {
    if (!missing.length) {
      APP.updateValue?.();
      return;
    }

    const message = waitingText(missing);

    spec.outputs.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = message;
      element.classList.add("calculation-waiting");
    });
  }

  function clearWaitingClasses() {
    document.querySelectorAll("#dealPage .calculation-waiting").forEach((element) => {
      element.classList.remove("calculation-waiting");
    });
  }

  function render() {
    const currentMode = mode();
    const spec = SPECS[currentMode];
    const panel = ensurePanel();
    if (!panel) return;

    markFields(spec);
    clearWaitingClasses();

    const missingRequired = spec.required.filter((item) => !requirementComplete(item));
    const completeRequired = spec.required.length - missingRequired.length;
    const recommendedComplete = spec.recommended.filter(requirementComplete).length;

    const requiredRows = spec.required.map((item) => {
      const complete = requirementComplete(item);
      return `
        <div class="readiness-row ${complete ? "complete" : "missing"}">
          <span class="readiness-symbol">${complete ? "✓" : "○"}</span>
          <span>
            <b>${item.label}</b>
            <small>${complete ? "Entered" : item.why}</small>
          </span>
          <strong>${complete ? "Ready" : "Needed"}</strong>
        </div>`;
    }).join("");

    const recommendedRows = spec.recommended.map((item) => {
      const complete = requirementComplete(item);
      return `
        <div class="readiness-row recommended-row ${complete ? "complete" : ""}">
          <span class="readiness-symbol">${complete ? "✓" : "○"}</span>
          <span>
            <b>${item.label}</b>
            <small>${complete ? "Entered" : item.why}</small>
          </span>
          <strong>${complete ? "Added" : "Recommended"}</strong>
        </div>`;
    }).join("");

    const ready = missingRequired.length === 0;

    panel.innerHTML = `
      <div class="readiness-head">
        <div>
          <div class="readiness-title">${spec.title}</div>
          <div class="readiness-summary ${ready ? "ready" : "pending"}">
            ${completeRequired}/${spec.required.length} required inputs complete
          </div>
        </div>
        <div class="readiness-status ${ready ? "ready" : "pending"}">
          ${ready ? "Calculation Ready" : `${missingRequired.length} Remaining`}
        </div>
      </div>

      <div class="readiness-progress">
        <div style="width:${Math.round((completeRequired / spec.required.length) * 100)}%"></div>
      </div>

      <div class="readiness-grid">
        <div>
          <div class="readiness-section-label">REQUIRED</div>
          ${requiredRows}
        </div>
        <div>
          <div class="readiness-section-label">RECOMMENDED · ${recommendedComplete}/${spec.recommended.length}</div>
          ${recommendedRows || '<div class="muted">No additional recommended inputs.</div>'}
        </div>
      </div>

      <div class="readiness-note">
        Required fields must be entered before the app treats the financial result as complete. Recommended fields improve accuracy. Optional fields only apply when relevant.
      </div>`;

    updateOutputs(spec, missingRequired);
  }

  function scheduleRender() {
    window.setTimeout(render, 0);
  }

  document.addEventListener("input", (event) => {
    if (event.target.closest("#dealPage")) scheduleRender();
  });

  document.addEventListener("change", (event) => {
    if (event.target.closest("#dealPage")) scheduleRender();
  });

  document.addEventListener("scorecard:workflowchange", scheduleRender);
  document.addEventListener("scorecard:datachange", scheduleRender);
  document.addEventListener("scorecard:core-ready", scheduleRender);

  const observer = new MutationObserver(() => {
    if (document.querySelector("#dealPage.page.active")) scheduleRender();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class"]
  });
})();
