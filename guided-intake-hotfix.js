(() => {
  "use strict";

  function $(selector) {
    return document.querySelector(selector);
  }

  function selectMethod(kind) {
    document.querySelectorAll(".intake-method").forEach((button) => {
      button.classList.remove("selected-method");
    });

    const vinPanel = $("#vinEntryPanel");
    const manualPanel = $("#manualEntryPanel");
    const scanStatus = $("#vinScanStatus");

    if (kind === "vin") {
      $("#showVinEntry")?.classList.add("selected-method");
      vinPanel?.classList.remove("hidden");
      manualPanel?.classList.add("hidden");
      scanStatus?.classList.add("hidden");
      setTimeout(() => $("#vin")?.focus(), 0);
      return;
    }

    if (kind === "manual") {
      $("#showManualEntry")?.classList.add("selected-method");
      manualPanel?.classList.remove("hidden");
      vinPanel?.classList.add("hidden");
      scanStatus?.classList.add("hidden");
      setTimeout(() => $("#yearSelect")?.focus(), 0);
      return;
    }

    if (kind === "scan") {
      $("#scanVinCamera")?.classList.add("selected-method");
      vinPanel?.classList.add("hidden");
      manualPanel?.classList.add("hidden");

      const input = $("#vinPhotoInput");
      if (input) {
        input.click();
      } else {
        vinPanel?.classList.remove("hidden");
      }
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#scanVinCamera, #showVinEntry, #showManualEntry");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (button.id === "scanVinCamera") selectMethod("scan");
    if (button.id === "showVinEntry") selectMethod("vin");
    if (button.id === "showManualEntry") selectMethod("manual");
  }, true);
})();
