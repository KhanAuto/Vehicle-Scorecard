(() => {
  "use strict";

  const LIBRARY_URL =
    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

  const SCANNER_ID = "vinLiveScannerReader";

  let scanner = null;
  let libraryPromise = null;
  let running = false;
  let onVinDetected = null;
  let onPhotoFallback = null;

  function cleanVin(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-HJ-NPR-Z0-9]/g, "")
      .slice(0, 17);
  }

  function extractVin(value) {
    const source = String(value || "").toUpperCase();
    const direct = source.match(/[A-HJ-NPR-Z0-9]{17}/)?.[0];

    if (direct) {
      return cleanVin(direct);
    }

    return cleanVin(source);
  }

  function loadLibrary() {
    if (window.Html5Qrcode && window.Html5QrcodeSupportedFormats) {
      return Promise.resolve();
    }

    if (libraryPromise) {
      return libraryPromise;
    }

    libraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${LIBRARY_URL}"]`
      );

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("VIN scanner library failed to load.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = LIBRARY_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = () => {
        reject(new Error("VIN scanner library failed to load."));
      };

      document.head.appendChild(script);
    });

    return libraryPromise;
  }

  function ensureOverlay() {
    let overlay = document.getElementById("vinScannerOverlay");

    if (overlay) {
      return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = "vinScannerOverlay";
    overlay.className = "vin-scanner-overlay";
    overlay.innerHTML = `
      <div class="vin-scanner-sheet" role="dialog" aria-modal="true">
        <div class="vin-scanner-header">
          <div>
            <div class="vin-scanner-kicker">LIVE VIN SCANNER</div>
            <div class="vin-scanner-title">Align the VIN barcode</div>
          </div>
          <button
            type="button"
            class="vin-scanner-close"
            id="vinScannerClose"
            aria-label="Close scanner"
          >×</button>
        </div>

        <div class="vin-scanner-help">
          Hold the phone steady 6–12 inches from the barcode. Keep the full
          barcode inside the frame and reduce glare when possible.
        </div>

        <div class="vin-scanner-viewfinder">
          <div id="${SCANNER_ID}" class="vin-scanner-reader"></div>
          <div class="vin-scanner-frame" aria-hidden="true"></div>
        </div>

        <div id="vinScannerStatus" class="vin-scanner-status">
          Starting rear camera…
        </div>

        <div class="vin-scanner-actions">
          <button
            type="button"
            class="btn"
            id="vinScannerPhoto"
          >Use Photo Instead</button>

          <button
            type="button"
            class="btn"
            id="vinScannerCancel"
          >Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay
      .querySelector("#vinScannerClose")
      .addEventListener("click", stop);

    overlay
      .querySelector("#vinScannerCancel")
      .addEventListener("click", stop);

    overlay
      .querySelector("#vinScannerPhoto")
      .addEventListener("click", async () => {
        await stop();
        onPhotoFallback?.();
      });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        stop();
      }
    });

    return overlay;
  }

  function setStatus(message, state = "") {
    const status = document.getElementById("vinScannerStatus");

    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.state = state;
  }

  function scannerFormats() {
    const formats = window.Html5QrcodeSupportedFormats;

    return [
      formats.CODE_39,
      formats.CODE_128,
      formats.DATA_MATRIX,
      formats.QR_CODE
    ].filter((value) => value !== undefined);
  }

  async function start(options = {}) {
    onVinDetected = options.onVin || null;
    onPhotoFallback = options.onPhoto || null;

    const overlay = ensureOverlay();
    overlay.classList.add("open");
    document.documentElement.classList.add("vin-scanner-open");

    setStatus("Loading barcode scanner…");

    try {
      await loadLibrary();

      if (!window.isSecureContext) {
        throw new Error(
          "Live camera scanning requires HTTPS or an installed secure app."
        );
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not provide live camera access.");
      }

      scanner = new window.Html5Qrcode(SCANNER_ID, {
        formatsToSupport: scannerFormats(),
        verbose: false
      });

      const config = {
        fps: 12,
        aspectRatio: 1.7778,
        qrbox(viewfinderWidth, viewfinderHeight) {
          return {
            width: Math.floor(viewfinderWidth * 0.9),
            height: Math.max(
              105,
              Math.floor(viewfinderHeight * 0.30)
            )
          };
        }
      };

      setStatus("Starting rear camera…");

      await scanner.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          const vin = extractVin(decodedText);

          if (vin.length !== 17) {
            setStatus(
              "Barcode detected, but it did not contain a complete 17-character VIN. Keep scanning."
            );
            return;
          }

          setStatus(`VIN found: ${vin}`, "success");

          const callback = onVinDetected;
          await stop(false);
          await callback?.(vin, decodedText);
        },
        () => {
          // Frame-level misses are normal and intentionally ignored.
        }
      );

      running = true;
      setStatus("Scanning continuously… keep the barcode inside the frame.");
    } catch (error) {
      console.error("VIN live scanner unavailable", error);
      running = false;

      setStatus(
        `${error.message || "Live scanner could not start."} You can use a photo instead.`,
        "error"
      );
    }
  }

  async function stop(hideOverlay = true) {
    if (scanner) {
      try {
        if (running) {
          await scanner.stop();
        }
      } catch (error) {
        console.warn("VIN scanner stop warning", error);
      }

      try {
        await scanner.clear();
      } catch (error) {
        // Some browser/library combinations clear automatically after stop.
      }
    }

    scanner = null;
    running = false;

    if (hideOverlay) {
      document
        .getElementById("vinScannerOverlay")
        ?.classList.remove("open");

      document.documentElement.classList.remove("vin-scanner-open");
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      stop();
    }
  });

  window.VehicleVinScanner = {
    start,
    stop,
    extractVin,
    cleanVin
  };
})();