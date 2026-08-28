(() => {
  "use strict";

  const REPORT_MODULES = [
    ["profilePage", "Vehicle", "🚘"],
    ["inspectionPage", "Inspection", "✓"],
    ["reconPage", "Recon", "🛠"],
    ["marketPage", "Market", "◫"],
    ["dealPage", "Value", "$"]
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

  function ensureFullDrawer() {
    const APP = window.VehicleScorecard;
    const container = document.getElementById("drawerPages");
    if (!APP || !container || container.querySelector(".drawer-nav-group")) return;

    container.dataset.groupedNavigation = "1";
    container.innerHTML = `
      <button class="drawer-link" data-target="homePage" type="button">
        <span>⌂</span><span class="txt">Dashboard</span><span>›</span>
      </button>
      <details class="drawer-nav-group" open>
        <summary><span>◆</span><span class="txt">Current Report</span><span class="drawer-group-chevron">⌄</span></summary>
        <div class="drawer-nav-children">
          ${REPORT_MODULES.map(([modulePage, label, icon]) => `<button class="drawer-link drawer-child" data-target="${modulePage}" type="button"><span>${icon}</span><span class="txt">${label}</span><span>›</span></button>`).join("")}
        </div>
      </details>
      <button class="drawer-link" data-target="savedPage" type="button">
        <span>▣</span><span class="txt">Saved Vehicles</span>
        <span>›</span>
      </button>
    `;

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
