(() => {
  "use strict";
  const APP = window.VehicleScorecard;
  if (!APP) return;

  const drawer = document.getElementById("appDrawer");
  const scrim = document.getElementById("appScrim");
  const dock = document.getElementById("v12BottomDock");
  if (!drawer || !scrim) return;

  function setOpen(open) {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    document.body.classList.toggle("drawer-open-v124", open);
  }

  // One bottom-dock handler. No document-level capture interception.
  dock?.addEventListener("click", event => {
    const button = event.target.closest('[data-v122-dock="menu"], [data-dock="menu"]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(!drawer.classList.contains("open"));
  });

  // Handle the drawer itself so taps are resolved inside the visible layer.
  drawer.addEventListener("click", event => {
    const closeButton = event.target.closest(".drawer-close");
    if (closeButton) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    const link = event.target.closest(".drawer-link[data-target]");
    if (!link) return;
    event.preventDefault();
    const target = link.dataset.target;
    setOpen(false);
    if (target) requestAnimationFrame(() => APP.showPage?.(target));
  });

  scrim.addEventListener("click", event => {
    event.preventDefault();
    setOpen(false);
  });
})();