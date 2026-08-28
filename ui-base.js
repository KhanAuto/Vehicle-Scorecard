(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  const PAGE_LABELS = {
    homePage: "Dashboard",
    profilePage: "Vehicle",
    inspectionPage: "Inspection",
    reconPage: "Recon",
    marketPage: "Market",
    dealPage: "Value",
    savedPage: "Saved Vehicles"
  };

  const DRAWER_PAGES = [
    ["homePage", "Dashboard", "⌂"],
    ["profilePage", "Vehicle", "🚘"],
    ["inspectionPage", "Inspection", "✓"],
    ["reconPage", "Recon", "🛠"],
    ["marketPage", "Market", "◫"],
    ["dealPage", "Value", "$"],
    ["savedPage", "Saved Vehicles", "▣"]
  ];

  const FLOWS = {
    condition: [
      ["profilePage", "Vehicle"],
      ["inspectionPage", "Inspection"],
      ["homePage", "Report"]
    ],
    value: [
      ["profilePage", "Vehicle"],
      ["inspectionPage", "Inspection"],
      ["reconPage", "Recon"],
      ["marketPage", "Market"],
      ["dealPage", "Value"],
      ["homePage", "Report"]
    ]
  };

  APP.showPage = showPage;

  async function loadVersion() {
    try {
      const response = await fetch(
        `./version.json?_=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await response.json();
      APP.state.version = data.version || APP.state.version;
    } catch (error) {
      // Keep the fallback version if version.json cannot be reached.
    }

    const version = APP.state.version;

    APP.$("#buildLabel").textContent = `v${version}`;
    APP.$("#drawerVersion").textContent =
      `v${version} · Production`;
    APP.$("#buildStatus").textContent =
      `Current build: v${version}`;
  }

  function currentPage() {
    return APP.$(".page.active")?.id || "homePage";
  }

  function closeDrawer() {
    APP.$("#appDrawer").classList.remove("open");
    APP.$("#appScrim").classList.remove("open");
  }

  function openDrawer() {
    APP.$("#appDrawer").classList.add("open");
    APP.$("#appScrim").classList.add("open");
  }

  function recordHistory(pageId) {
    if (APP.state.internalNavigation) return;

    const history = APP.state.history;
    const index = APP.state.historyIndex;

    if (history[index] === pageId) {
      syncNavigationControls();
      return;
    }

    APP.state.history = history.slice(0, index + 1);
    APP.state.history.push(pageId);
    APP.state.historyIndex =
      APP.state.history.length - 1;

    syncNavigationControls();
  }

  function showPage(pageId, options = {}) {
    const target = APP.$(`#${pageId}`);
    if (!target) return;

    APP.$$(".page").forEach((page) => {
      page.classList.toggle(
        "active",
        page.id === pageId
      );
    });

    if (options.record !== false) {
      recordHistory(pageId);
    }

    if (pageId === "savedPage") {
      APP.renderSaved();
      APP.renderCompare();
    }

    if (pageId === "homePage") {
      APP.renderDashboard();
      buildDashboardReport();
    }

    syncUI();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function goBack() {
    if (APP.state.historyIndex <= 0) {
      showPage("homePage");
      return;
    }

    APP.state.historyIndex -= 1;
    APP.state.internalNavigation = true;

    showPage(
      APP.state.history[APP.state.historyIndex],
      { record: false }
    );

    APP.state.internalNavigation = false;
    syncNavigationControls();
  }

  function goForward() {
    if (
      APP.state.historyIndex >=
      APP.state.history.length - 1
    ) {
      return;
    }

    APP.state.historyIndex += 1;
    APP.state.internalNavigation = true;

    showPage(
      APP.state.history[APP.state.historyIndex],
      { record: false }
    );

    APP.state.internalNavigation = false;
    syncNavigationControls();
  }

  function syncNavigationControls() {
    APP.$("#appBack").disabled =
      APP.state.historyIndex <= 0;

    APP.$("#appForward").disabled =
      APP.state.historyIndex >=
      APP.state.history.length - 1;

    APP.$("#appPageName").textContent =
      PAGE_LABELS[currentPage()] ||
      "Scorecard";

    APP.$$(".drawer-link").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.target === currentPage()
      );
    });
  }

  function renderDrawer() {
    APP.$("#drawerPages").innerHTML =
      DRAWER_PAGES
        .map(([pageId, label, icon]) => `
          <button
            class="drawer-link"
            data-target="${pageId}"
          >
            <span>${icon}</span>
            <span class="txt">${label}</span>
            <span>›</span>
          </button>
        `)
        .join("");

    APP.$$(".drawer-link").forEach((button) => {
      button.addEventListener("click", () => {
        closeDrawer();
        showPage(button.dataset.target);
      });
    });
  }

  function workflowComplete(pageId) {
    if (pageId === "profilePage") {
      return APP.validateVehicleProfile().length === 0;
    }

    if (pageId === "inspectionPage") {
      const overall =
        APP.inspection?.getOverallScore?.();

      return Boolean(
        overall?.total &&
        overall.answered === overall.total
      );
    }

    if (pageId === "reconPage") {
      return true;
    }

    if (pageId === "marketPage") {
      return Boolean(
        APP.numberFrom("kbbPrivate") ||
        APP.numberFrom("edmundsPrivate") ||
        APP.numberFrom("dealer1") ||
        APP.numberFrom("dealer2") ||
        APP.numberFrom("privateComp") ||
        APP.numberFrom("instantOffer")
      );
    }

    if (pageId === "dealPage") {
      if (APP.getMode() === "buy") {
        return Boolean(
          APP.numberFrom("buyTarget") ||
          APP.numberFrom("buyAsk")
        );
      }

      return Boolean(
        APP.numberFrom("sellTarget") ||
        APP.numberFrom("sellAsIs")
      );
    }

    return false;
  }

  function renderWorkflowStrip() {
    const layer = APP.getLayer() || "condition";
    const flow = FLOWS[layer];
    const current = currentPage();

    APP.$("#workflowStrip").innerHTML =
      flow
        .map(([pageId, label], index) => {
          const arrow = index
            ? '<span class="workflow-arrow">›</span>'
            : "";

          const classes = [
            "workflow-step",
            pageId === current ? "active" : "",
            workflowComplete(pageId) ? "done" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return `
            ${arrow}
            <button
              class="${classes}"
              data-workflow-page="${pageId}"
              type="button"
            >
              ${label}
            </button>
          `;
        })
        .join("");

    APP.$$("[data-workflow-page]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => showPage(
            button.dataset.workflowPage
          )
        );
      });
  }

  function renderAssessmentSelector() {
    const layer = APP.getLayer();
    const mode = APP.getMode();

    APP.$$("[data-layer]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.layer === layer
        );
      });

    APP.$("#valueModeChoices")
      .classList.toggle(
        "show",
        layer === "value"
      );

    APP.$$("[data-value-mode]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.valueMode === mode
        );
      });
  }

  function syncPageActions() {
    const layer =
      APP.getLayer() || "condition";

    const flow = FLOWS[layer];

    flow.forEach(([pageId], index) => {
      if (pageId === "homePage") return;

      const page = APP.$(`#${pageId}`);
      if (!page) return;

      const previousButton =
        page.querySelector("[data-prev]");

      const nextButton =
        page.querySelector("[data-next]");

      const previousTarget =
        index > 0
          ? flow[index - 1][0]
          : "homePage";

      const nextTarget =
        index < flow.length - 1
          ? flow[index + 1][0]
          : "homePage";

      if (previousButton) {
        const label =
          previousTarget === "homePage"
            ? "Dashboard"
            : flow[index - 1]?.[1] ||
              "Back";

        previousButton.textContent =
          `← ${label}`;

        previousButton.onclick = () =>
          showPage(previousTarget);
      }

      if (nextButton) {
        const label =
          nextTarget === "homePage"
            ? "View Report"
            : flow[index + 1]?.[1] ||
              "Next";

        nextButton.textContent =
          `${label} →`;

        nextButton.onclick = () => {
          if (pageId === "profilePage") {
            const missing =
              APP.validateVehicleProfile();

            if (missing.length) {
              alert(
                "Complete required vehicle information: " +
                missing.join(", ") +
                "."
              );

              return;
            }
          }

          if (pageId === "dealPage") {
            APP.saveCurrent();
          }

          showPage(nextTarget);
        };
      }
    });

    APP.$("#savedOverview").onclick =
      () => showPage("homePage");
  }

  function syncValueMode() {
    const mode = APP.getMode() === "sell" ? "sell" : "buy";

    APP.$$("[data-analysis-mode]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.analysisMode === mode
        );
      });

    APP.$("#sellAnalysis")
      .classList.toggle(
        "hidden",
        mode === "buy"
      );

    APP.$("#buyAnalysis")
      .classList.toggle(
        "hidden",
        mode !== "buy"
      );

    APP.$("#dealModeHint").textContent =
      mode === "buy"
        ? "Buying analysis: compare list price, target purchase price, all-in cost, condition and market value."
        : "Selling analysis: compare as-is/post-recon value, local market and expected proceeds.";
  }

  function syncUI() {
    renderDrawer();
    renderWorkflowStrip();
    renderAssessmentSelector();
    syncPageActions();
    syncValueMode();
    syncNavigationControls();
  }

  function ageBand(year) {
    const numericYear = Number(year);

    if (!numericYear) {
      return "Age unknown";
    }

    const age = Math.max(
      0,
      new Date().getFullYear() - numericYear
    );

    const band =
      age <= 3 ? "0–3 years" :
      age <= 7 ? "4–7 years" :
      age <= 14 ? "8–14 years" :
      age <= 24 ? "15–24 years" :
      "25+ years";

    return (
      `${age} year${age === 1 ? "" : "s"} old · ` +
      band
    );
  }

  function mileageBand() {
    if (APP.$("#mileageUnknown").checked) {
      return "Mileage band: Unknown";
    }

    const mileage = Number(
      APP.value("mileage")
    );

    if (
      !Number.isFinite(mileage) ||
      !mileage
    ) {
      return "Mileage band: Unknown";
    }

    const band =
      mileage < 30000 ? "Under 30k" :
      mileage < 60000 ? "30k–60k" :
      mileage < 100000 ? "60k–100k" :
      mileage < 150000 ? "100k–150k" :
      "150k+";

    return `Mileage band: ${band}`;
  }

  function reportMetric(
    label,
    value,
    subtext = ""
  ) {
    return `
      <div class="metric">
        <div class="muted">${label}</div>
        <div class="v">${value || "—"}</div>
        ${
          subtext
            ? `<div class="muted">${subtext}</div>`
            : ""
        }
      </div>
    `;
  }

  function buildDashboardReport() {
    const report =
      APP.$("#dashboardReport");

    const vehicle =
      APP.getVehicle();

    const overall =
      APP.inspection?.getOverallScore?.() || {
        pct: null,
        answered: 0,
        total: 0,
        coverage: 0
      };

    const hasVehicle =
      vehicle.year ||
      vehicle.make ||
      vehicle.model ||
      overall.pct !== null;

    if (!hasVehicle) {
      report.innerHTML = "";
      return;
    }

    const layer =
      APP.getLayer() || "condition";

    const mode =
      APP.getMode() || "inspect";

    const recommendations =
      APP.intelligence
        ?.getRecommendations?.() || {};

    const highPriorityCount =
      Object.values(recommendations)
        .filter((items) =>
          items.some(
            (item) =>
              item.level === "high"
          )
        )
        .length;

    const recommendedCount =
      Object.values(recommendations)
        .filter((items) =>
          items.length &&
          !items.some(
            (item) =>
              item.level === "high"
          )
        )
        .length;

    const vehicleName = [
      vehicle.year,
      vehicle.make,
      vehicle.model,
      vehicle.trim
    ]
      .filter(Boolean)
      .join(" ") ||
      "Current Vehicle";

    const mileageText =
      APP.$("#mileageUnknown").checked
        ? "Mileage unknown"
        : vehicle.mileage
          ? `${Number(vehicle.mileage)
              .toLocaleString()} miles`
          : "Mileage unknown";

    const modeLabel =
      layer === "condition"
        ? "CONDITION ASSESSMENT"
        : mode === "buy"
          ? "CONDITION + VALUE · BUYING"
          : "CONDITION + VALUE · SELLING";

    let financialMetrics = "";

    if (
      layer === "value" &&
      mode === "buy"
    ) {
      financialMetrics =
        reportMetric(
          "Expected Resale",
          APP.money(
            APP.value("buyResale")
          ),
          "Your realistic resale target"
        ) +
        reportMetric(
          "Most You Should Pay",
          APP.text(
            "calculatedMaxBuy"
          ),
          "Maximum recommended purchase price"
        ) +
        reportMetric(
          "Expected Profit",
          APP.text("buyProfit"),
          "After recon, fees and selling costs"
        );
    }

    if (
      layer === "value" &&
      mode === "sell"
    ) {
      financialMetrics =
        reportMetric(
          "Your Asking Price",
          APP.money(APP.value("sellAsk")),
          "Advertised or planned asking price"
        ) +
        reportMetric(
          "Estimated As-Is Value",
          APP.money(
            APP.value("sellAsIs")
          ),
          "Current estimate before repairs"
        ) +
        reportMetric(
          "Projected Sale Price",
          APP.money(
            APP.value("sellTarget")
          ),
          "Realistic sale target"
        ) +
        reportMetric(
          "Estimated Take-Home",
          APP.text("sellNet"),
          "After recon and selling costs"
        );
    }

    report.innerHTML = `
      <div class="report-kicker">
        ${modeLabel}
      </div>

      <div class="report-title">
        ${vehicleName}
      </div>

      <div class="report-meta">
        ${mileageText}${
          APP.value("vin")
            ? ` · VIN ${APP.value("vin")}`
            : ""
        }
        <br>
        ${ageBand(vehicle.year)} ·
        ${mileageBand()}
      </div>

      <div class="report-hero">
        <div>
          <div class="muted">
            Vehicle Condition
          </div>
          <div class="report-score">
            ${
              overall.pct === null
                ? "—"
                : `${overall.pct}/100`
            }
          </div>
          <div>
            ${
              APP.text("grade") ||
              "No scored checks yet"
            }
          </div>
        </div>

        <div>
          <div class="muted">
            Assessment
          </div>
          <div class="report-score report-verdict">
            ${
              layer === "condition"
                ? APP.text("grade") ||
                  "Condition recorded"
                : mode === "buy"
                  ? APP.text(
                      "dealAssessment"
                    ) ||
                    "Not calculated"
                  : APP.text(
                      "pricingCheck"
                    ) ||
                    "Sale plan"
            }
          </div>
          <div class="muted">
            ${
              layer === "condition"
                ? "Condition-focused assessment"
                : mode === "buy"
                  ? "Based on purchase, recon and resale assumptions"
                  : "Based on current value, recon and selling assumptions"
            }
          </div>
        </div>
      </div>

      <div class="report-grid">
        ${reportMetric(
          "Inspection Completion",
          overall.total
            ? `${overall.answered}/${overall.total} · ${overall.coverage}%`
            : "—",
          `${Math.max(
            0,
            overall.total -
            overall.answered
          )} checks remaining`
        )}

        ${reportMetric(
          "Maintenance Confidence",
          APP.text("maintenanceScore"),
          APP.text("maintenanceLabel")
        )}

        ${reportMetric(
          "Known Recon",
          APP.text("reconTotal"),
          "Repairs and maintenance currently planned"
        )}

        ${reportMetric(
          "Critical Red Flags",
          APP.text("redFlagCount") ||
          "0",
          "Scored critical concerns"
        )}

        ${reportMetric(
          "High Priority Focus",
          String(highPriorityCount),
          `${recommendedCount} additional recommended modules`
        )}

        ${financialMetrics}

        ${reportMetric(
          "Decision",
          APP.value("decision") ||
          "Undecided",
          "Your recorded final decision"
        )}
      </div>

      <div class="report-actions">
        <button
          data-report-page="inspectionPage"
        >
          View Inspection
        </button>

        ${
          layer === "value"
            ? `
              <button data-report-page="reconPage">
                View Recon
              </button>
              <button data-report-page="marketPage">
                View Market
              </button>
              <button data-report-page="dealPage">
                View Value Analysis
              </button>
            `
            : ""
        }

        <button data-report-page="profilePage">
          Edit Vehicle
        </button>
      </div>
    `;

    APP.$$(
      "[data-report-page]",
      report
    ).forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          showPage(
            button.dataset.reportPage
          )
      );
    });
  }

  function renderQuickSaved() {
    const host =
      APP.$("#quickSaved");

    const saved =
      APP.getSaved()
        .slice()
        .reverse();

    host.innerHTML = `
      <div class="quick-head">
        <div>
          <div class="title">
            Saved Vehicles
          </div>
          <div class="hint">
            Jump straight back into a previous
            inspection or analysis.
          </div>
        </div>

        <button
          class="btn primary"
          id="viewSaved"
        >
          View All Saved
        </button>
      </div>

      <div class="quick-actions">
        <button
          class="btn"
          id="newVehicle"
        >
          + New Vehicle
        </button>
      </div>

      <div class="quick-list">
        ${
          saved
            .slice(0, 4)
            .map((vehicle) => {
              const fields =
                vehicle.fields || {};

              const name = [
                fields.year,
                fields.make,
                fields.model,
                fields.trim
              ]
                .filter(Boolean)
                .join(" ") ||
                "Saved Vehicle";

              const mileage =
                vehicle.mileageUnknown
                  ? "Mileage unknown"
                  : fields.mileage
                    ? `${Number(
                        fields.mileage
                      ).toLocaleString()} miles`
                    : "Mileage not entered";

              return `
                <button
                  class="quick-card"
                  data-saved-id="${vehicle.id}"
                >
                  <b>${name}</b>
                  <span>
                    ${mileage} ·
                    ${
                      vehicle.score?.pct ||
                      "No score"
                    }
                  </span>
                  <em>Open →</em>
                </button>
              `;
            })
            .join("") ||
          '<div class="muted">No saved vehicles yet.</div>'
        }
      </div>
    `;

    APP.$("#viewSaved").onclick =
      () => showPage("savedPage");

    APP.$("#newVehicle").onclick =
      () => {
        APP.clearCurrent();
        showPage("profilePage");
      };

    APP.$$("[data-saved-id]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            APP.loadSaved(
              Number(
                button.dataset.savedId
              )
            )
        );
      });
  }

  function applyTheme(theme) {
    const nextTheme =
      theme === "dark"
        ? "dark"
        : "light";

    document.documentElement
      .dataset.theme =
      nextTheme;

    localStorage.setItem(
      APP.constants.THEME_KEY,
      nextTheme
    );

    APP.$("#themeSwitch")
      .classList.toggle(
        "on",
        nextTheme === "dark"
      );

    APP.$("#themeLabel")
      .textContent =
      nextTheme === "dark"
        ? "Dark Mode On"
        : "Dark Mode Off";
  }

  async function updateApp() {
    APP.toast(
      "Checking for the latest published build…"
    );

    try {
      const registrations =
        await navigator.serviceWorker
          ?.getRegistrations?.() ||
        [];

      await Promise.all(registrations.map(async (registration) => {
        try { await registration.unregister(); } catch (error) {}
      }));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys
          .filter((key) => key.startsWith("vehicle-scorecard"))
          .map((key) => caches.delete(key)));
      }

      const url = new URL(location.href);
      url.searchParams.set("refresh", Date.now());
      url.hash = "";
      location.replace(url);
    } catch (error) {
      location.reload();
    }
  }

  async function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    try {
      await navigator.serviceWorker
        .register(
          "./service-worker.js"
        );
    } catch (error) {
      console.warn(
        "Service worker registration failed.",
        error
      );
    }
  }

  function bindEvents() {
    APP.$("#appMenu").onclick =
      openDrawer;

    APP.$("#appClose").onclick =
      closeDrawer;

    APP.$("#appScrim").onclick =
      closeDrawer;

    APP.$("#appBack").onclick =
      goBack;

    APP.$("#appForward").onclick =
      goForward;

    APP.$("#appOverview").onclick =
      () => showPage("homePage");

    APP.$("#drawerSave").onclick =
      () => {
        APP.saveCurrent();
        closeDrawer();
      };

    APP.$("#drawerPrint").onclick =
      () => window.print();

    APP.$("#drawerUpdate").onclick =
      updateApp;

    APP.$("#themeSwitch").onclick =
      () => {
        applyTheme(
          document.documentElement
            .dataset.theme === "dark"
            ? "light"
            : "dark"
        );
      };

    APP.$$("[data-layer]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            APP.setLayer(
              button.dataset.layer
            )
        );
      });

    APP.$$("[data-value-mode]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            APP.setMode(
              button.dataset.valueMode
            )
        );
      });

    APP.$$("[data-analysis-mode]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () =>
            APP.setMode(
              button.dataset.analysisMode
            )
        );
      });

    APP.$$("[data-start-layer]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            APP.clearCurrent();
            APP.setLayer(
              button.dataset.startLayer
            );
            showPage("profilePage");
          }
        );
      });

    APP.$("#savedOverview").onclick =
      () => showPage("homePage");

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          closeDrawer();
        }
      }
    );

    document.addEventListener(
      "scorecard:workflowchange",
      syncUI
    );

    document.addEventListener(
      "scorecard:datachange",
      () => {
        renderWorkflowStrip();
        buildDashboardReport();
      }
    );

    document.addEventListener(
      "scorecard:inspectionchange",
      () => {
        renderWorkflowStrip();
        buildDashboardReport();
      }
    );

    document.addEventListener(
      "scorecard:intelligencechange",
      buildDashboardReport
    );

    document.addEventListener(
      "scorecard:dashboardrender",
      () => {
        renderQuickSaved();
        buildDashboardReport();
      }
    );
  }

  async function initializeUI() {
    APP.state.history = ["homePage"];
    APP.state.historyIndex = 0;

    applyTheme(
      localStorage.getItem(
        APP.constants.THEME_KEY
      ) || "light"
    );

    await loadVersion();

    bindEvents();
    renderQuickSaved();
    syncUI();
    buildDashboardReport();
    registerServiceWorker();
  }

  document.addEventListener(
    "scorecard:core-ready",
    initializeUI
  );
})();
