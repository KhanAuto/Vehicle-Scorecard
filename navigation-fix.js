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
    const button = event.target.closest(".page.active [data-next], .page.active [data-prev]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    navigate(button.hasAttribute("data-next") ? "next" : "prev");
  }, true);
})();
