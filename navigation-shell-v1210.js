(() => {
  "use strict";

  const FULL_DRAWER = [
    ["homePage", "Dashboard", "⌂"],
    ["profilePage", "Vehicle", "🚘"],
    ["inspectionPage", "Inspection", "✓"],
    ["reconPage", "Recon", "🛠"],
    ["marketPage", "Market", "◫"],
    ["dealPage", "Value", "$"],
    ["savedPage", "Saved Vehicles", "▣"]
  ];

  function measureNavigationShell() {
    const header = document.querySelector(".app-header");
    const bar = document.getElementById("appControlbar");
    if (!header || !bar) return;

    const root = document.documentElement;
    root.style.setProperty(
      "--scorecard-header-height",
      `${Math.ceil(header.getBoundingClientRect().height)}px`
    );
    root.style.setProperty(
      "--scorecard-controlbar-height",
      `${Math.ceil(bar.getBoundingClientRect().height)}px`
    );
  }

  function drawerIsComplete(container) {
    const targets = [...container.querySelectorAll(".drawer-link")]
      .map((button) => button.dataset.target);
    return targets.length === FULL_DRAWER.length &&
      FULL_DRAWER.every(([pageId], index) => targets[index] === pageId);
  }

  function ensureFullDrawer() {
    const APP = window.VehicleScorecard;
    const container = document.getElementById("drawerPages");
    if (!APP || !container || drawerIsComplete(container)) return;

    container.innerHTML = FULL_DRAWER.map(([pageId, label, icon]) => `
      <button class="drawer-link" data-target="${pageId}" type="button">
        <span>${icon}</span>
        <span class="txt">${label}</span>
        <span>›</span>
      </button>
    `).join("");

    container.querySelectorAll(".drawer-link").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById("appDrawer")?.classList.remove("open");
        document.getElementById("appScrim")?.classList.remove("open");
        APP.showPage?.(button.dataset.target);
      });
    });
  }

  function refresh() {
    measureNavigationShell();
    ensureFullDrawer();
  }

  function ready() {
    refresh();

    document.getElementById("appMenu")?.addEventListener("click", () => {
      requestAnimationFrame(() => {
        ensureFullDrawer();
        measureNavigationShell();
      });
    });

    ["scorecard:workflowchange", "scorecard:garagerender"].forEach((name) => {
      document.addEventListener(name, () => requestAnimationFrame(refresh));
    });

    window.addEventListener("resize", measureNavigationShell, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(measureNavigationShell, 80), { passive: true });

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(measureNavigationShell);
      const header = document.querySelector(".app-header");
      const bar = document.getElementById("appControlbar");
      if (header) observer.observe(header);
      if (bar) observer.observe(bar);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})();
