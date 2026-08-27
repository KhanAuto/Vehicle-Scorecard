(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const SPECS = {
    sell: {
      required: [
        { id: "sellAsIs", label: "Current As-Is Value", why: "Needed to establish what the vehicle is worth today." },
        { id: "sellTarget", label: "Expected Sale Price", why: "Needed to calculate realistic expected proceeds." }
      ],
      recommended: [
        { id: "sellPostRecon", label: "Post-Recon Market Value", why: "Shows whether planned recon adds enough value." },
        { id: "sellList", label: "Recommended List Price", why: "Helps compare your asking price with expected market value." },
        { id: "sellCosts", label: "Other Selling Costs", why: "Improves seller take-home accuracy." },
        { id: "sellReconMode", label: "Recon Strategy", why: "Controls which recon costs are included in the sale analysis." }
      ],
      optional: [
        { id: "sellQuick", label: "Quick-Sale Price", why: "Useful if you want a lower price for a faster sale." },
        { id: "sellFloor", label: "Seller Minimum Net", why: "Use when you have a hard minimum amount you need to receive." },
        { id: "brokerType", label: "Broker Fee Type", why: "Only applies if a broker or consignee is involved." },
        { id: "brokerFlat", label: "Flat Broker Fee", why: "Only applies to a flat-fee arrangement." },
        { id: "brokerPercent", label: "Commission %", why: "Only applies to a percentage commission." },
        { id: "brokerMinimum", label: "Minimum Commission", why: "Only applies if the broker has a minimum fee." }
      ],
      outputs: ["sellNet", "sellerNetAfterBroker", "reconBenefit", "pricingCheck"]
    },
    buy: {
      required: [
        { id: "buyAsk", fallback: "asking", label: "Seller Asking Price", why: "Needed as the starting purchase price." },
        { id: "buyResale", label: "Expected Resale Price", why: "Needed for profit, ROI and maximum-buy calculations." },
        { id: "requiredProfit", label: "Required Profit", why: "Needed to calculate the maximum sensible purchase price." }
      ],
      recommended: [
        { id: "buyTarget", label: "Target Purchase Price", why: "Enter the price you actually expect to offer or pay." },
        { id: "buyFees", label: "Tax / Title / Registration", why: "Adds unavoidable transaction costs to your basis." },
        { id: "buyAcqCosts", label: "Other Acquisition Costs", why: "Adds transport, auction, inspection or other acquisition expenses." },
        { id: "buySellingCosts", label: "Selling Costs", why: "Improves projected profit and margin accuracy." },
        { id: "buyReconMode", label: "Use Recon", why: "Controls which repair and reconditioning costs are included." }
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

  function migrateLegacyAsking() {
    const buyAsk = document.getElementById("buyAsk");
    const legacyAsking = document.getElementById("asking");

    if (
      buyAsk &&
      legacyAsking &&
      !String(buyAsk.value || "").trim() &&
      String(legacyAsking.value || "").trim()
    ) {
      buyAsk.value = legacyAsking.value;
    }
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

  function sectionHeading(title, note) {
    return `
      <div class="value-section-heading">
        <b>${title}</b>
        <span>${note}</span>
      </div>`;
  }

  function ensureInputSections(currentMode, spec) {
    const analysis = document.getElementById(currentMode === "buy" ? "buyAnalysis" : "sellAnalysis");
    const results = analysis?.querySelector(".results");
    if (!analysis || !results) return;

    let host = analysis.querySelector(".value-input-sections");
    if (!host) {
      host = document.createElement("div");
      host.className = "value-input-sections";
      host.innerHTML = `
        <section class="value-field-section required-section">
          ${sectionHeading("Required Inputs", "Complete these for a finished calculation")}
          <div class="value-input-grid" data-value-section="required"></div>
        </section>
        <section class="value-field-section recommended-section">
          ${sectionHeading("Recommended Inputs", "Improve accuracy")}
          <div class="value-input-grid" data-value-section="recommended"></div>
        </section>
        <section class="value-field-section optional-section">
          ${sectionHeading("Optional Inputs", "Only when applicable")}
          <div class="value-input-grid" data-value-section="optional"></div>
        </section>`;
      results.insertAdjacentElement("beforebegin", host);
    }

    const groups = {
      required: host.querySelector('[data-value-section="required"]'),
      recommended: host.querySelector('[data-value-section="recommended"]'),
      optional: host.querySelector('[data-value-section="optional"]')
    };

    ["required", "recommended", "optional"].forEach((type) => {
      spec[type].forEach((item) => {
        const input = document.getElementById(item.id);
        const label = input?.closest("label");
        if (label && groups[type] && label.parentElement !== groups[type]) {
          groups[type].append(label);
        }
      });
    });

    const optionalSection = host.querySelector(".optional-section");
    optionalSection?.classList.toggle("hidden", spec.optional.length === 0);

    analysis.querySelectorAll(".grid4.field-grid, .grid4.section-gap").forEach((grid) => {
      if (!grid.children.length) grid.classList.add("hidden");
    });
  }

  function typeLabel(type) {
    return type === "required" ? "Required" : type === "recommended" ? "Recommended" : "Optional";
  }

  function markField(item, type) {
    const input = document.getElementById(item.id);
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

    const isComplete = complete(item);

    if (type === "required") {
      requirement.textContent = isComplete ? "✓ Complete" : `Needed — ${item.why}`;
      requirement.className = `value-requirement-help ${isComplete ? "complete" : "needed"}`;
    } else if (type === "recommended") {
      requirement.textContent = isComplete ? "✓ Added" : item.why;
      requirement.className = `value-requirement-help ${isComplete ? "complete" : ""}`;
    } else {
      requirement.textContent = isComplete ? "✓ Added" : item.why;
      requirement.className = `value-requirement-help ${isComplete ? "complete" : ""}`;
    }
  }

  function markFields(spec) {
    document.querySelectorAll("#dealPage .value-field-badge, #dealPage .value-requirement-help").forEach((node) => node.remove());
    spec.required.forEach((item) => markField(item, "required"));
    spec.recommended.forEach((item) => markField(item, "recommended"));
    spec.optional.forEach((item) => markField(item, "optional"));
  }

  function updateOutputs(spec, missing) {
    document.querySelectorAll("#dealPage .calculation-waiting").forEach((element) => {
      element.classList.remove("calculation-waiting");
    });

    if (!missing.length) {
      APP.updateValue?.();
      return;
    }

    const message = missing.length === 1
      ? `Waiting for ${missing[0].label}`
      : `Waiting for ${missing.length} required inputs`;

    spec.outputs.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = message;
      element.classList.add("calculation-waiting");
    });
  }

  function render() {
    migrateLegacyAsking();

    const currentMode = mode();
    const spec = SPECS[currentMode];
    const panel = ensurePanel();
    if (!panel) return;

    ensureInputSections(currentMode, spec);
    markFields(spec);

    const missing = spec.required.filter((item) => !complete(item));
    const done = spec.required.length - missing.length;
    const ready = missing.length === 0;

    panel.innerHTML = `
      <div class="readiness-head compact">
        <div>
          <div class="readiness-title-row">
            <div class="readiness-title">${currentMode === "buy" ? "Buying" : "Selling"} analysis</div>
            <span class="analysis-mode-chip">${currentMode === "buy" ? "BUYING" : "SELLING"}</span>
          </div>
          <div class="readiness-summary ${ready ? "ready" : "pending"}">${done}/${spec.required.length} required inputs complete</div>
        </div>
        <div class="readiness-status ${ready ? "ready" : "pending"}">${ready ? "Calculation Ready" : `${missing.length} Needed`}</div>
      </div>

      <div class="readiness-progress"><div style="width:${Math.round((done / spec.required.length) * 100)}%"></div></div>

      ${currentMode === "buy" ? `
        <div class="value-context-card">
          <div>
            <span class="context-kicker">SELLER ASKING PRICE</span>
            <strong>${askingPrice()}</strong>
          </div>
          <span class="context-note">Enter or edit this below under Required Inputs.</span>
        </div>` : ""}

      <div class="readiness-note compact-note">
        Complete the <b>Required</b> fields first. <b>Recommended</b> fields improve accuracy, while <b>Optional</b> fields only apply to certain deals.
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

  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class"]
  });
})();
