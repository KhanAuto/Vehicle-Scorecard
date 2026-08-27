(() => {
  "use strict";

  function $(selector) {
    return document.querySelector(selector);
  }

  function clearMethodSelection() {
    document.querySelectorAll(".intake-method").forEach((button) => {
      button.classList.remove("selected-method");
    });
  }

  function showVinPanel() {
    $("#vinEntryPanel")?.classList.remove("hidden");
    $("#manualEntryPanel")?.classList.add("hidden");
  }

  function showManualPanel() {
    $("#manualEntryPanel")?.classList.remove("hidden");
    $("#vinEntryPanel")?.classList.add("hidden");
  }

  async function applyScannedVin(vin) {
    const input = $("#vin");
    const status = $("#vinScanStatus");

    if (!input) {
      return;
    }

    input.value = vin;
    showVinPanel();

    status?.classList.remove("hidden");

    if (status) {
      status.textContent = `VIN barcode read: ${vin}. Identifying vehicle…`;
    }

    $("#decodeVin")?.click();
  }

  function openPhotoFallback() {
    const input = $("#vinPhotoInput");

    if (input) {
      input.click();
      return;
    }

    showVinPanel();
  }

  async function startLiveScan() {
    clearMethodSelection();
    $("#scanVinCamera")?.classList.add("selected-method");
    $("#vinEntryPanel")?.classList.add("hidden");
    $("#manualEntryPanel")?.classList.add("hidden");

    const status = $("#vinScanStatus");
    status?.classList.remove("hidden");

    if (status) {
      status.textContent = "Opening live VIN barcode scanner…";
    }

    if (!window.VehicleVinScanner) {
      if (status) {
        status.textContent =
          "Live scanner did not load. Opening the photo scanner instead.";
      }

      openPhotoFallback();
      return;
    }

    await window.VehicleVinScanner.start({
      onVin: applyScannedVin,
      onPhoto: openPhotoFallback
    });
  }

  function selectMethod(kind) {
    clearMethodSelection();

    const scanStatus = $("#vinScanStatus");

    if (kind === "vin") {
      window.VehicleVinScanner?.stop?.();
      $("#showVinEntry")?.classList.add("selected-method");
      showVinPanel();
      scanStatus?.classList.add("hidden");
      setTimeout(() => $("#vin")?.focus(), 0);
      return;
    }

    if (kind === "manual") {
      window.VehicleVinScanner?.stop?.();
      $("#showManualEntry")?.classList.add("selected-method");
      showManualPanel();
      scanStatus?.classList.add("hidden");
      setTimeout(() => $("#yearSelect")?.focus(), 0);
      return;
    }

    if (kind === "scan") {
      startLiveScan();
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "#scanVinCamera, #showVinEntry, #showManualEntry"
      );

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (button.id === "scanVinCamera") {
        selectMethod("scan");
      }

      if (button.id === "showVinEntry") {
        selectMethod("vin");
      }

      if (button.id === "showManualEntry") {
        selectMethod("manual");
      }
    },
    true
  );
})();
