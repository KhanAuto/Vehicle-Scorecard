(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const FLOWS = {
    condition: ["profilePage", "inspectionPage", "homePage"],
    value: ["profilePage", "inspectionPage", "reconPage", "marketPage", "dealPage", "homePage"]
  };

  function activePageId() {
    return document.querySelector(".page.active")?.id || "homePage";
  }

  function getFlow() {
    return FLOWS[APP.getLayer?.() === "value" ? "value" : "condition"];
  }

  function syncValueAnalysis(mode) {
    const normalized = mode === "buy" ? "buy" : "sell";

    document.querySelectorAll("[data-analysis-mode]").forEach((button) => {
      const active = button.dataset.analysisMode === normalized;
      button.classList.toggle("active", active);
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    document.querySelector("#sellAnalysis")?.classList.toggle("hidden", normalized !== "sell");
    document.querySelector("#buyAnalysis")?.classList.toggle("hidden", normalized !== "buy");

    const hint = document.querySelector("#dealModeHint");
    if (hint) {
      hint.textContent = normalized === "buy"
        ? "Buying analysis: compare asking price, recon, market value and expected margin."
        : "Selling analysis: compare as-is/post-recon value, local market and expected proceeds.";
    }

    APP.updateValue?.();
  }

  function setValueMode(mode) {
    if (!["buy", "sell"].includes(mode)) return;

    // setMode also forces the assessment layer to value and persists the choice.
    APP.setMode?.(mode);
    syncValueAnalysis(mode);

    // Keep a loaded/saved vehicle synchronized without requiring the user to leave the page.
    if (APP.state?.editingId) {
      APP.saveCurrent?.();
    }
  }

  function navigate(direction) {
    const pageId = activePageId();
    const flow = getFlow();
    const index = flow.indexOf(pageId);

    if (index < 0) return false;

    if (direction === "next") {
      if (pageId === "profilePage") {
        const missing = APP.validateVehicleProfile?.() || [];
        if (missing.length) {
          alert(`Complete required vehicle information: ${missing.join(", ")}.`);
          return true;
        }
      }

      if (pageId === "dealPage") APP.saveCurrent?.();

      const target = flow[Math.min(index + 1, flow.length - 1)] || "homePage";
      APP.showPage?.(target);
      return true;
    }

    const target = index > 0 ? flow[index - 1] : "homePage";
    APP.showPage?.(target);
    return true;
  }

  document.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-analysis-mode]");
    if (modeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setValueMode(modeButton.dataset.analysisMode);
      return;
    }

    const button = event.target.closest(".page.active [data-next], .page.active [data-prev]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    navigate(button.hasAttribute("data-next") ? "next" : "prev");
  }, true);

  document.addEventListener("scorecard:workflowchange", () => {
    if (activePageId() === "dealPage") {
      syncValueAnalysis(APP.getMode?.() || "sell");
    }
  });

  // When Value is opened directly from the top navigation, reflect the workflow selected during intake.
  document.addEventListener("scorecard:core-ready", () => {
    syncValueAnalysis(APP.getMode?.() || "sell");
  });
})();
