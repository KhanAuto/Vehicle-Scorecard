(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  function installGarageSearch() {
    const garage = document.querySelector("#quickSaved.v12-garage");
    if (!garage || garage.querySelector(".v12-garage-search")) return;
    const list = garage.querySelector(".v12-garage-list");
    if (!list) return;

    const search = document.createElement("div");
    search.className = "v12-garage-search";
    search.innerHTML = '<span>⌕</span><input type="search" placeholder="Search saved vehicles…" aria-label="Search saved vehicles">';
    list.insertAdjacentElement("beforebegin", search);

    search.querySelector("input")?.addEventListener("input", event => {
      const query = event.target.value.trim().toLowerCase();
      garage.querySelectorAll(".v12-vehicle-card").forEach(card => {
        card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query);
      });
    });
  }

  function installBottomDock() {
    let dock = document.getElementById("v12BottomDock");
    if (!dock) {
      dock = document.createElement("nav");
      dock.id = "v12BottomDock";
      dock.className = "v12-bottom-dock no-print";
      dock.setAttribute("aria-label", "Primary app navigation");
      document.body.appendChild(dock);
    }

    if (dock.dataset.v126Ready !== "1") {
      dock.dataset.v126Ready = "1";
      dock.innerHTML = `
        <button data-dock="home"><span class="dock-icon">⌂</span><span>Home</span></button>
        <button data-dock="garage"><span class="dock-icon">▣</span><span>Garage</span></button>
        <button data-dock="new" class="dock-new"><span class="dock-icon">＋</span><span>New</span></button>
        <button data-dock="menu"><span class="dock-icon">☰</span><span>Menu</span></button>`;

      dock.addEventListener("click", event => {
        const button = event.target.closest("[data-dock]");
        if (!button) return;
        const action = button.dataset.dock;
        if (action === "menu") return; // drawer-fix-v124 owns Menu exclusively.
        event.preventDefault();
        event.stopPropagation();

        if (action === "home") {
          APP.showPage?.("homePage");
          window.scrollTo({ top: 0, behavior: "auto" });
        } else if (action === "garage") {
          APP.showPage?.("homePage");
          requestAnimationFrame(() => document.querySelector(".v12-garage-list")?.scrollIntoView({ block:"start", behavior:"auto" }));
        } else if (action === "new") {
          APP.clearCurrent?.();
          APP.showPage?.("profilePage");
        }
      });
    }
    syncDock();
  }

  function syncDock() {
    const dock = document.getElementById("v12BottomDock");
    if (!dock) return;
    const page = document.querySelector(".page.active")?.id;
    dock.querySelectorAll("button").forEach(button => button.classList.remove("active"));
    if (page === "homePage") dock.querySelector('[data-dock="home"]')?.classList.add("active");
  }

  function polishHome() {
    if (!document.querySelector("#homePage.page.active")) return;
    const garage = document.querySelector("#quickSaved.v12-garage");
    if (!garage) return;
    const heading = garage.querySelector(".v12-garage-head h2");
    const sub = garage.querySelector(".v12-garage-head p");
    if (heading) heading.textContent = "My Garage";
    if (sub) sub.textContent = "All your saved vehicles, research and assessments in one place.";
    installGarageSearch();
  }

  function refresh() {
    installBottomDock();
    polishHome();
    syncDock();
  }

  ["scorecard:core-ready", "scorecard:dashboardrender", "scorecard:vehiclechange", "scorecard:pathchange"].forEach(name => {
    document.addEventListener(name, () => requestAnimationFrame(refresh));
  });
  window.addEventListener("load", refresh, { once:true });
  setTimeout(refresh, 100);
})();