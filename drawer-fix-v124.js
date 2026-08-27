(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  function drawer(){ return document.getElementById("appDrawer"); }
  function scrim(){ return document.getElementById("appScrim"); }
  function isOpen(){ return drawer()?.classList.contains("open"); }
  function open(){
    drawer()?.classList.add("open");
    scrim()?.classList.add("open");
    document.documentElement.classList.add("drawer-open-v124");
    document.body.classList.add("drawer-open-v124");
  }
  function close(){
    drawer()?.classList.remove("open");
    scrim()?.classList.remove("open");
    document.documentElement.classList.remove("drawer-open-v124");
    document.body.classList.remove("drawer-open-v124");
  }

  // Intercept only the bottom Menu command and open the actual drawer directly.
  // This avoids relying on the now-hidden legacy top hamburger button.
  document.addEventListener("click", (event) => {
    const menu = event.target.closest('#v12BottomDock [data-v122-dock="menu"], #v12BottomDock [data-dock="menu"]');
    if (!menu) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    isOpen() ? close() : open();
  }, true);

  // Make drawer page navigation deterministic and prevent a tap from reaching
  // an expanded garage card behind the drawer on iOS Safari.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("#appDrawer .drawer-link[data-target]");
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = link.dataset.target;
    close();
    if (target) APP.showPage?.(target);
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target.closest("#appDrawer .drawer-close")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target === scrim()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, true);

  // Keep state synchronized if legacy code opens/closes the drawer.
  const observer = new MutationObserver(() => {
    const openNow = isOpen();
    document.documentElement.classList.toggle("drawer-open-v124", openNow);
    document.body.classList.toggle("drawer-open-v124", openNow);
  });
  if (drawer()) observer.observe(drawer(), { attributes:true, attributeFilter:["class"] });
})();