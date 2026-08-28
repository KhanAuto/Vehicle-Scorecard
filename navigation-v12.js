(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PATH_KEY = "vehicleScorecardAssessmentPath";
  const FLOWS = {
    inspection: [
      ["profilePage", "Vehicle"],
      ["inspectionPage", "Inspection"],
      ["homePage", "Report"]
    ],
    value: [
      ["profilePage", "Vehicle"],
      ["marketPage", "Market"],
      ["dealPage", "Value"],
      ["homePage", "Report"]
    ],
    full: [
      ["profilePage", "Vehicle"],
      ["inspectionPage", "Inspection"],
      ["reconPage", "Recon"],
      ["marketPage", "Market"],
      ["dealPage", "Value"],
      ["homePage", "Report"]
    ]
  };

  function getPath() {
    const stored = localStorage.getItem(PATH_KEY);
    if (FLOWS[stored]) return stored;
    return APP.getLayer?.() === "condition" ? "inspection" : "full";
  }

  function setPath(path) {
    if (!FLOWS[path]) return;
    localStorage.setItem(PATH_KEY, path);
    document.dispatchEvent(new CustomEvent("scorecard:pathchange"));
  }

  APP.getAssessmentPath = APP.getAssessmentPath || getPath;
  APP.setAssessmentPath = APP.setAssessmentPath || setPath;

  function activePage() {
    return document.querySelector(".page.active")?.id || "homePage";
  }

  function flow() {
    return FLOWS[getPath()] || FLOWS.full;
  }

  function pageComplete(pageId) {
    if (pageId === "profilePage") return (APP.validateVehicleProfile?.() || []).length === 0;
    if (pageId === "inspectionPage") {
      const s = APP.inspection?.getOverallScore?.();
      return Boolean(s?.answered);
    }
    if (pageId === "marketPage") {
      return ["kbbTrade","kbbPrivate","edmundsTrade","edmundsPrivate","estimatedWholesale","private1Price","private2Price","private3Price","dealer1Price","dealer2Price","dealer3Price","instantOffer","instantOffer2","dealerCashOffer","actualTradeOffer"]
        .some((id) => APP.numberFrom?.(id) > 0);
    }
    if (pageId === "dealPage") {
      const mode = APP.getMode?.();
      return mode === "buy" ? APP.numberFrom?.("buyAsk") > 0 : Boolean(APP.marketSnapshot?.().baseline);
    }
    if (pageId === "reconPage") return true;
    return false;
  }

  function renderStrip() {
    const strip = document.getElementById("workflowStrip");
    if (!strip) return;
    const current = activePage();
    strip.innerHTML = flow().map(([pageId, label], index) => {
      const classes = ["workflow-step", pageId === current ? "active" : "", pageComplete(pageId) ? "done" : ""].filter(Boolean).join(" ");
      return `${index ? '<span class="workflow-arrow">›</span>' : ""}<button class="${classes}" data-v12-workflow="${pageId}" type="button">${label}</button>`;
    }).join("");
    strip.querySelectorAll("[data-v12-workflow]").forEach((button) => {
      button.addEventListener("click", () => APP.showPage?.(button.dataset.v12Workflow));
    });
  }

  function syncDrawer() {
    const inFlow = new Set(flow().map(([pageId]) => pageId));
    document.querySelectorAll(".drawer-link").forEach((button) => {
      button.classList.remove("hidden");
      button.dataset.inAssessmentFlow = inFlow.has(button.dataset.target) ? "true" : "false";
    });
  }

  function syncPageButtons() {
    const current = activePage();
    const f = flow();
    const index = f.findIndex(([id]) => id === current);
    if (index < 0 || current === "homePage") return;
    const page = document.getElementById(current);
    const prev = page?.querySelector("[data-prev]");
    const next = page?.querySelector("[data-next]");
    const previous = index > 0 ? f[index - 1] : ["homePage", "Dashboard"];
    const following = index < f.length - 1 ? f[index + 1] : ["homePage", "Report"];
    if (prev) prev.textContent = `← ${previous[1]}`;
    if (next) next.textContent = following[0] === "homePage" ? "View Report →" : `${following[1]} →`;
  }

  function sync() {
    renderStrip();
    syncDrawer();
    syncPageButtons();
  }

  function navigate(direction) {
    const current = activePage();
    if (direction === "next" && current === "profilePage") {
      const missing = APP.validateVehicleProfile?.() || [];
      if (missing.length) {
        alert(`Complete required vehicle information: ${missing.join(", ")}.`);
        return;
      }

      // Older Value Analysis records can arrive here with the original value
      // path even after the user chose Add Inspection. Reconcile the pending
      // module before calculating the next page so Vehicle always proceeds to
      // the actual physical-condition assessment instead of Market.
      const editingId = APP.state?.editingId;
      const saved = (APP.getSaved?.() || []).find((vehicle) =>
        String(vehicle.id) === String(editingId)
      );
      if (saved?.moduleCoverage?.inspectionStarted) {
        setPath("full");
        APP.setLayer?.("value");
        if (saved.assessmentPath !== "full") {
          saved.assessmentPath = "full";
          saved.layer = "value";
          APP.saveList?.((APP.getSaved?.() || []).map((vehicle) =>
            String(vehicle.id) === String(saved.id) ? saved : vehicle
          ));
        }
      }
    }
    const f = flow();
    const index = f.findIndex(([id]) => id === current);
    if (index < 0) return;
    const target = direction === "next"
      ? (f[Math.min(index + 1, f.length - 1)]?.[0] || "homePage")
      : (index > 0 ? f[index - 1][0] : "homePage");
    if (target === "homePage") APP.saveCurrent?.();
    APP.showPage?.(target);
  }

  document.addEventListener("click", (event) => {
    const purpose = event.target.closest("[data-guided-purpose]");
    if (purpose) setPath(purpose.dataset.guidedPurpose);

    const directive = event.target.closest("[data-guided-directive]");
    if (directive) APP.setMode?.(directive.dataset.guidedDirective);

    const finish = event.target.closest("#intakeFinish");
    if (finish && ["value","full"].includes(getPath())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      APP.saveCurrent?.();
      APP.showPage?.(getPath() === "full" ? "inspectionPage" : "marketPage");
      return;
    }

    const button = event.target.closest(".page.active [data-next], .page.active [data-prev]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(button.hasAttribute("data-next") ? "next" : "prev");
  }, true);

  const originalShow = APP.showPage;
  if (typeof originalShow === "function" && !originalShow._v12Wrapped) {
    const wrapped = (pageId, options) => {
      const result = originalShow(pageId, options);
      window.setTimeout(sync, 0);
      return result;
    };
    wrapped._v12Wrapped = true;
    APP.showPage = wrapped;
  }

  ["scorecard:workflowchange","scorecard:datachange","scorecard:inspectionchange","scorecard:pathchange","scorecard:core-ready"]
    .forEach((name) => document.addEventListener(name, () => window.setTimeout(sync, 0)));
})();
