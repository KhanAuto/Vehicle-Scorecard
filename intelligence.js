(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  let lastSignature = "";
  let requestInProgress = false;
  let latestRecommendations = {};

  APP.intelligence = {
    refresh,
    getRecommendations: () => latestRecommendations
  };

  function numeric(value) {
    return Number(String(value || "").replace(/[^0-9.]/g, "")) || 0;
  }

  function getYear() {
    return numeric(APP.value("year") || APP.value("yearSelect"));
  }

  function getMileage() {
    return APP.$("#mileageUnknown")?.checked
      ? 0
      : numeric(APP.value("mileage"));
  }

  function addRecommendation(target, groupId, text, level = "recommended") {
    if (!target[groupId]) {
      target[groupId] = [];
    }

    target[groupId].push({ text, level });
  }

  function buildLocalRecommendations() {
    const recommendations = {};
    const year = getYear();
    const mileage = getMileage();

    const age = year
      ? Math.max(0, new Date().getFullYear() - year)
      : null;

    if (age !== null) {
      if (age >= 20) {
        [
          "engine", "road", "wear", "exterior",
          "electrical", "hvac", "maintenance"
        ].forEach((groupId) => {
          addRecommendation(
            recommendations,
            groupId,
            `${age}-year-old vehicle: age-related deterioration deserves closer inspection.`,
            "high"
          );
        });
      } else if (age >= 13) {
        ["engine", "road", "wear", "exterior", "maintenance"]
          .forEach((groupId) => {
            addRecommendation(
              recommendations,
              groupId,
              `${age}-year-old vehicle: increased age-related inspection priority.`,
              "high"
            );
          });

        ["electrical", "hvac"].forEach((groupId) => {
          addRecommendation(
            recommendations,
            groupId,
            "Older vehicle: verify accessory and comfort-system operation."
          );
        });
      } else if (age >= 8) {
        ["engine", "road", "wear", "maintenance"].forEach((groupId) => {
          addRecommendation(
            recommendations,
            groupId,
            `${age}-year-old vehicle: verify wear, fluids, powertrain and service history.`
          );
        });
      } else if (age >= 4) {
        ["wear", "maintenance"].forEach((groupId) => {
          addRecommendation(
            recommendations,
            groupId,
            `${age}-year-old vehicle: routine wear and scheduled maintenance are worth verifying.`
          );
        });
      }
    }

    if (mileage >= 150000) {
      ["engine", "road", "wear", "maintenance"].forEach((groupId) => {
        addRecommendation(
          recommendations,
          groupId,
          `${mileage.toLocaleString()} miles: very high-mileage inspection priority.`,
          "high"
        );
      });
    } else if (mileage >= 100000) {
      ["engine", "road", "wear", "maintenance"].forEach((groupId) => {
        addRecommendation(
          recommendations,
          groupId,
          `${mileage.toLocaleString()} miles: high-mileage wear and service checks recommended.`
        );
      });
    } else if (mileage >= 60000) {
      ["engine", "wear", "maintenance"].forEach((groupId) => {
        addRecommendation(
          recommendations,
          groupId,
          `${mileage.toLocaleString()} miles: verify major wear items and maintenance history.`
        );
      });
    }

    return { recommendations, age };
  }

  function mapComponent(component) {
    const value = String(component || "").toUpperCase();
    const groups = new Set();

    if (
      /ENGINE|POWER TRAIN|FUEL|PROPULSION|HYBRID|ELECTRIC VEHICLE|SPEED CONTROL/
        .test(value)
    ) {
      groups.add("engine");
    }

    if (/STEERING|SUSPENSION|DRIVE SHAFT|AXLE/.test(value)) {
      groups.add("road");
    }

    if (/BRAKE|TIRE|WHEEL/.test(value)) {
      groups.add("wear");
    }

    if (/STRUCTURE|VISIBILITY|LATCH|DOOR|GLASS/.test(value)) {
      groups.add("exterior");
    }

    if (
      /ELECTRICAL|AIR BAG|FORWARD COLLISION|LANE DEPARTURE|BACK OVER|LIGHTING|EQUIPMENT/
        .test(value)
    ) {
      groups.add("electrical");
    }

    if (/AIR CONDITION|HEATER|CLIMATE/.test(value)) {
      groups.add("hvac");
    }

    return [...groups];
  }

  async function fetchPublicData() {
    const vehicle = APP.getVehicle();

    if (!vehicle.year || !vehicle.make || !vehicle.model) {
      return { complaints: [], recalls: [] };
    }

    const query =
      `make=${encodeURIComponent(vehicle.make)}` +
      `&model=${encodeURIComponent(vehicle.model)}` +
      `&modelYear=${vehicle.year}`;

    const [complaintsResult, recallsResult] = await Promise.allSettled([
      fetch(
        `${APP.constants.NHTSA_API}/complaints/complaintsByVehicle?${query}`,
        { cache: "no-store" }
      ).then((response) => response.json()),

      fetch(
        `${APP.constants.NHTSA_API}/recalls/recallsByVehicle?${query}`,
        { cache: "no-store" }
      ).then((response) => response.json())
    ]);

    return {
      complaints:
        complaintsResult.status === "fulfilled"
          ? complaintsResult.value.results ||
            complaintsResult.value.Results ||
            []
          : [],
      recalls:
        recallsResult.status === "fulfilled"
          ? recallsResult.value.results ||
            recallsResult.value.Results ||
            []
          : []
    };
  }

  function recommendationsFromPublicData(data) {
    const recommendations = {};
    const complaintCounts = {};
    const recallCounts = {};

    data.complaints.forEach((complaint) => {
      mapComponent(complaint.components || complaint.Component || "")
        .forEach((groupId) => {
          complaintCounts[groupId] = (complaintCounts[groupId] || 0) + 1;
        });
    });

    Object.entries(complaintCounts).forEach(([groupId, count]) => {
      if (count < 3) return;

      addRecommendation(
        recommendations,
        groupId,
        `NHTSA complaint data includes ${count} reports involving systems related to this module.`,
        count >= 10 ? "high" : "recommended"
      );
    });

    data.recalls.forEach((recall) => {
      mapComponent(recall.Component || "").forEach((groupId) => {
        recallCounts[groupId] = (recallCounts[groupId] || 0) + 1;
      });
    });

    Object.entries(recallCounts).forEach(([groupId, count]) => {
      addRecommendation(
        recommendations,
        groupId,
        `NHTSA lists ${count} recall campaign${count === 1 ? "" : "s"} related to this module.`,
        "high"
      );
    });

    return {
      recommendations,
      totalComplaints: data.complaints.length,
      totalRecalls: data.recalls.length
    };
  }

  function mergeRecommendations(...sets) {
    const merged = {};

    sets.forEach((set) => {
      Object.entries(set || {}).forEach(([groupId, recommendations]) => {
        recommendations.forEach((recommendation) => {
          addRecommendation(
            merged,
            groupId,
            recommendation.text,
            recommendation.level
          );
        });
      });
    });

    return merged;
  }

  function render(recommendations, metadata = {}) {
    latestRecommendations = recommendations;

    let highCount = 0;
    let recommendedCount = 0;

    APP.inspection?.groups?.forEach((group) => {
      const details = APP.$(
        `.inspection-group[data-group="${group.id}"]`
      );

      if (!details) return;

      details.classList.remove(
        "priority-high",
        "priority-recommended"
      );

      details.querySelector(".priority-badge")?.remove();

      const reasonsBox = details.querySelector(".priority-reasons");
      const reasons = recommendations[group.id] || [];

      if (!reasons.length) {
        reasonsBox.classList.add("hidden");
        reasonsBox.innerHTML = "";
        return;
      }

      const high = reasons.some(
        (reason) => reason.level === "high"
      );

      if (high) {
        highCount += 1;
        details.classList.add("priority-high");
      } else {
        recommendedCount += 1;
        details.classList.add("priority-recommended");
      }

      const badge = document.createElement("span");
      badge.className = `priority-badge ${high ? "high" : ""}`;
      badge.textContent = high
        ? "★ High Priority"
        : "★ Recommended";

      details.querySelector(".group-main")?.appendChild(badge);

      reasonsBox.classList.remove("hidden");
      reasonsBox.innerHTML =
        "<b>Why this module is recommended</b>" +
        reasons.map((reason) => {
          const bullet = reason.level === "high" ? "★" : "•";
          return `<div>${bullet} ${reason.text}</div>`;
        }).join("");
    });

    APP.$("#priorityCount").textContent = highCount;
    APP.$("#recommendedCount").textContent =
      `${recommendedCount} recommended`;

    const vehicle = APP.getVehicle();
    const year = numeric(vehicle.year);
    const mileage = getMileage();

    const age = year
      ? Math.max(0, new Date().getFullYear() - year)
      : null;

    APP.$("#vehicleIntel").innerHTML = `
      <div class="intel-head">
        <div>
          <b>Recommended Inspection Emphasis</b>
          <span>
            ${
              [
                age !== null ? `${age} years old` : null,
                mileage ? `${mileage.toLocaleString()} miles` : null,
                metadata.totalComplaints !== undefined
                  ? `${metadata.totalComplaints} NHTSA complaints reviewed`
                  : null,
                metadata.totalRecalls !== undefined
                  ? `${metadata.totalRecalls} recall campaigns`
                  : null
              ]
                .filter(Boolean)
                .join(" · ") ||
              "Enter year and mileage for targeted guidance."
            }
          </span>
        </div>

        <span class="intel-source">
          Age + mileage + public NHTSA data
        </span>
      </div>

      <div class="intel-note">
        Recommendations guide where to spend inspection time.
        They do not change the vehicle condition score.
      </div>
    `;

    document.dispatchEvent(
      new CustomEvent("scorecard:intelligencechange", {
        detail: {
          highCount,
          recommendedCount
        }
      })
    );
  }

  async function refresh(force = false) {
    const vehicle = APP.getVehicle();

    const signature = [
      vehicle.year,
      vehicle.make,
      vehicle.model,
      APP.$("#mileageUnknown")?.checked
        ? "unknown"
        : vehicle.mileage
    ].join("|");

    if (
      (!force && signature === lastSignature) ||
      requestInProgress
    ) {
      return;
    }

    lastSignature = signature;
    requestInProgress = true;

    const local = buildLocalRecommendations();
    render(local.recommendations);

    try {
      const publicData = await fetchPublicData();
      const publicRecommendations =
        recommendationsFromPublicData(publicData);

      render(
        mergeRecommendations(
          local.recommendations,
          publicRecommendations.recommendations
        ),
        publicRecommendations
      );
    } finally {
      requestInProgress = false;
    }
  }

  function initialize() {
    refresh(true);

    document.addEventListener(
      "scorecard:vehiclechange",
      () => refresh(true)
    );

    document.addEventListener(
      "scorecard:inspectionrender",
      () => render(latestRecommendations)
    );
  }

  document.addEventListener(
    "scorecard:core-ready",
    initialize
  );
})();
