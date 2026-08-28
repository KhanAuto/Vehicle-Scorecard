(() => {
  "use strict";

  const APP = window.VehicleScorecard;
  if (!APP) return;

  function item(name, max, options = {}) {
    return {
      name,
      max,
      critical: Boolean(options.critical),
      functionCheck: Boolean(options.functionCheck),
      labels: options.labels || null,
      scores: options.scores || null
    };
  }

  const GROUPS = [
    {
      id: "identity",
      title: "Vehicle Information & Transaction",
      weight: 0,
      type: "identity",
      hint: "Confirm identity, ownership, title, mileage consistency and warning-lamp concerns.",
      items: [
        item("VIN matches vehicle / title", 3, { labels: ["Verified", "Concern", "Problem", "N/A"], scores: [3, 2, 1, 0] }),
        item("Seller / registered owner verified", 3, { labels: ["Verified", "Concern", "Problem", "N/A"], scores: [3, 2, 1, 0] }),
        item("Title / lien status", 3, { labels: ["Clear", "Concern", "Problem", "N/A"], scores: [3, 2, 1, 0] }),
        item("Odometer / mileage consistency", 3, { labels: ["Consistent", "Concern", "Problem", "N/A"], scores: [3, 2, 1, 0] }),
        item("Warning lamps / stored fault concern", 3, { labels: ["Normal", "Concern", "Fault", "N/A"], scores: [3, 2, 1, 0] })
      ]
    },
    {
      id: "exterior",
      title: "Exterior, Body & Structure",
      weight: 15,
      hint: "Inspect paint, panels, glass, collision evidence, rust and structural condition.",
      items: [
        item("Front body / bumper / grille / lamps", 3),
        item("Hood / windshield / roof", 3),
        item("Driver-side body / paint", 3),
        item("Passenger-side body / paint", 3),
        item("Rear body / hatch / trunk", 3),
        item("Collision / structural repair evidence", 9, { critical: true }),
        item("Rust / corrosion / underbody damage", 6, { critical: true })
      ]
    },
    {
      id: "wear",
      title: "Tires, Wheels & Brakes",
      weight: 15,
      hint: "Check tire age/tread, wear pattern, wheels, pads, rotors and spare equipment.",
      items: [
        item("Tire set condition / age / tread", 6),
        item("Tire wear pattern / alignment clues", 3),
        item("Wheel condition / damage", 3),
        item("Front brake condition", 6, { critical: true }),
        item("Rear brake condition", 6),
        item("Spare / inflator / jack / tools", 3)
      ]
    },
    {
      id: "engine",
      title: "Engine Bay & Powertrain",
      weight: 22,
      hint: "Check engine, fluids, leaks, cooling, transmission and power delivery.",
      items: [
        item("Cold start / abnormal engine noise", 9, { functionCheck: true, critical: true }),
        item("Engine idle / smoke / running quality", 6, { functionCheck: true, critical: true }),
        item("Fluid leaks / engine-bay condition", 6),
        item("Transmission / clutch engagement", 6, { functionCheck: true, critical: true }),
        item("Shifting / slip / flare / shudder", 9, { functionCheck: true, critical: true }),
        item("Cooling / operating temperature", 9, { functionCheck: true, critical: true }),
        item("Acceleration / power delivery", 3, { functionCheck: true }),
        item("Exhaust / emissions symptoms", 3, { functionCheck: true })
      ]
    },
    {
      id: "interior",
      title: "Interior & Cabin",
      weight: 8,
      hint: "Inspect seats, trim, carpet, headliner, odors, water intrusion and cargo area.",
      items: [
        item("Seats / upholstery / cushions", 6),
        item("Carpet / trim / headliner", 3),
        item("Odor / cleanliness", 3),
        item("Cargo / trunk area", 3)
      ]
    },
    {
      id: "electrical",
      title: "Electrical, Controls & Equipment",
      weight: 7,
      hint: "Test controls, lighting, cameras, accessories and equipped driver-assistance features.",
      items: [
        item("Windows / locks / mirrors / basic electrical", 6, { functionCheck: true }),
        item("Seat adjustment / convenience features", 3, { functionCheck: true }),
        item("Infotainment / audio / navigation", 3, { functionCheck: true }),
        item("Backup camera / parking aids", 3, { functionCheck: true }),
        item("Lighting systems", 3, { functionCheck: true }),
        item("Keyless entry / remote start", 3, { functionCheck: true }),
        item("Driver-assistance systems", 3, { functionCheck: true })
      ]
    },
    {
      id: "hvac",
      title: "HVAC & Comfort",
      weight: 3,
      hint: "Test climate controls and comfort systems that apply to this vehicle.",
      items: [
        item("Front A/C & heat", 6, { functionCheck: true }),
        item("Rear HVAC", 3, { functionCheck: true }),
        item("Sunroof / convertible top", 3, { functionCheck: true })
      ]
    },
    {
      id: "road",
      title: "Road Test",
      weight: 13,
      hint: "Evaluate steering, suspension, vibration/noise and braking while moving.",
      items: [
        item("Steering / tracking / excessive play", 6, { functionCheck: true, critical: true }),
        item("Suspension / clunks / damping", 6, { functionCheck: true }),
        item("Wheel-bearing / driveline noise", 3, { functionCheck: true }),
        item("Braking performance / pull / pulsation", 6, { functionCheck: true, critical: true })
      ]
    },
    {
      id: "maintenance",
      title: "Maintenance & Records",
      weight: 0,
      type: "maintenance",
      hint: "Document service history and maintenance confidence separately from physical condition.",
      items: [
        item("Maintenance records / receipts", 6, { labels: ["Verified", "Partial", "Unknown", "N/A"], scores: [6, 4, 2, 0] }),
        item("Scheduled maintenance status", 6, { labels: ["Current", "Due Soon", "Unknown", "Overdue"], scores: [6, 4, 2, 1] }),
        item("Oil / fluid service confidence", 6, { labels: ["Verified", "Partial", "Unknown", "Overdue"], scores: [6, 4, 2, 1] }),
        item("Recent major wear-item service", 3, { labels: ["Verified", "Partial", "Unknown", "N/A"], scores: [3, 2, 1, 0] }),
        item("Manuals / spare keys", 3, { labels: ["Complete", "Partial", "Missing", "N/A"], scores: [3, 2, 1, 0] })
      ]
    }
  ];

  APP.inspection = {
    groups: GROUPS,
    render,
    recalculate,
    getOverallScore,
    migrateLegacyState
  };

  const LEGACY_KEY_MAP = {
    prestart_0: "identity_0",
    prestart_1: "identity_1",
    prestart_2: "identity_2",
    prestart_3: "identity_3",
    prestart_4: "identity_4",

    exterior_0: "exterior_0",
    exterior_1: "exterior_1",
    exterior_2: "exterior_2",
    exterior_3: "exterior_3",
    exterior_4: "exterior_4",
    exterior_5: "exterior_5",
    exterior_6: "exterior_6",

    tires_0: "wear_0",
    tires_1: "wear_1",
    tires_2: "wear_2",
    tires_3: "wear_3",
    tires_4: "wear_4",
    tires_5: "wear_5",

    interior_0: "interior_0",
    interior_1: "interior_1",
    interior_2: "interior_2",
    interior_3: "interior_3",

    documentation_0: "maintenance_0",
    documentation_1: "maintenance_1",
    documentation_2: "maintenance_2",
    documentation_3: "maintenance_3",
    documentation_4: "maintenance_4",

    mechanical_0: "engine_0",
    mechanical_1: "engine_1",
    mechanical_2: "engine_2",
    mechanical_3: "engine_3",
    mechanical_4: "engine_4",
    mechanical_5: "engine_5",
    mechanical_6: "road_0",
    mechanical_7: "road_1",
    mechanical_8: "road_2",
    mechanical_9: "road_3",
    mechanical_10: "engine_6",
    mechanical_11: "engine_7",

    equipment_0: "electrical_0",
    equipment_1: "electrical_1",
    equipment_2: "electrical_2",
    equipment_3: "electrical_3",
    equipment_4: "hvac_0",
    equipment_5: "hvac_1",
    equipment_6: "hvac_2",
    equipment_7: "electrical_4",
    equipment_8: "electrical_5",
    equipment_9: "electrical_6"
  };

  function migrateLegacyState(ratings = {}, notes = {}) {
    const migratedRatings = {};
    const migratedNotes = {};

    Object.entries(ratings).forEach(([key, value]) => {
      const normalizedValue =
        value && typeof value === "object"
          ? {
              label: value.label,
              value:
                value.value !== undefined
                  ? value.value
                  : value.val
            }
          : value;

      migratedRatings[LEGACY_KEY_MAP[key] || key] = normalizedValue;
    });

    Object.entries(notes).forEach(([key, value]) => {
      migratedNotes[LEGACY_KEY_MAP[key] || key] = value;
    });

    return {
      ratings: migratedRatings,
      itemNotes: migratedNotes
    };
  }

  function optionSet(group, itemDefinition) {
    if (itemDefinition.labels) {
      return itemDefinition.labels.map((label, index) => ({
        label,
        value: itemDefinition.scores[index]
      }));
    }

    const max = itemDefinition.max;
    const middle = max >= 9 ? 6 : max >= 6 ? 4 : 2;
    const low = max >= 9 ? 3 : max >= 6 ? 2 : 1;

    if (group.id === "road") {
      return [
        { label: "Normal", value: max },
        { label: "Minor Concern", value: middle },
        { label: "Significant Concern", value: low },
        { label: "N/A", value: 0 }
      ];
    }

    if (itemDefinition.functionCheck) {
      return [
        { label: "Functions", value: max },
        { label: "Issue Present", value: middle },
        { label: "Inoperative", value: low },
        { label: "N/A", value: 0 }
      ];
    }

    return [
      { label: "Good", value: max },
      { label: "Moderate", value: middle },
      { label: "Poor", value: low },
      { label: "N/A", value: 0 }
    ];
  }

  function ratingKey(groupId, index) {
    return `${groupId}_${index}`;
  }

  function groupScore(group) {
    let earned = 0;
    let possible = 0;
    let answered = 0;
    let criticalFlags = 0;

    group.items.forEach((itemDefinition, index) => {
      const rating = APP.state.ratings[ratingKey(group.id, index)];
      if (!rating) return;

      answered += 1;

      if (rating.value === 0) return;

      earned += rating.value;
      possible += itemDefinition.max;

      if (
        itemDefinition.critical &&
        rating.value <= itemDefinition.max / 3
      ) {
        criticalFlags += 1;
      }
    });

    return {
      pct: possible ? Math.round(earned / possible * 100) : null,
      answered,
      total: group.items.length,
      pending: Math.max(0, group.items.length - answered),
      criticalFlags
    };
  }

  function getOverallScore() {
    let weightedScore = 0;
    let usedWeight = 0;
    let answered = 0;
    let total = 0;

    GROUPS.filter((group) => group.weight > 0).forEach((group) => {
      const score = groupScore(group);

      answered += score.answered;
      total += score.total;

      if (score.pct !== null) {
        weightedScore += score.pct * group.weight;
        usedWeight += group.weight;
      }
    });

    return {
      pct: usedWeight ? Math.round(weightedScore / usedWeight) : null,
      answered,
      total,
      coverage: total ? Math.round(answered / total * 100) : 0
    };
  }

  function conditionGrade(score) {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Very Good";
    if (score >= 70) return "Good";
    if (score >= 60) return "Fair";
    if (score >= 50) return "Poor";
    return "High Risk";
  }

  function updateMaintenance() {
    const maintenanceGroup = GROUPS.find((group) => group.id === "maintenance");
    const score = groupScore(maintenanceGroup);

    APP.$("#maintenanceScore").textContent =
      score.pct === null ? "—" : `${score.pct}%`;

    APP.$("#maintenanceLabel").textContent =
      score.pct === null ? "Not assessed" :
      score.pct >= 85 ? "High confidence" :
      score.pct >= 65 ? "Moderate confidence" :
      score.pct >= 45 ? "Low confidence" : "Very low confidence";
  }

  function updateTransaction() {
    const identityGroup = GROUPS.find((group) => group.id === "identity");

    let concerns = 0;
    let problems = 0;
    let answered = 0;
    let applicable = 0;

    identityGroup.items.forEach((itemDefinition, index) => {
      const rating = APP.state.ratings[ratingKey(identityGroup.id, index)];

      if (rating?.value === 0) return;

      applicable += 1;

      if (!rating) return;

      answered += 1;

      if (rating.value === 1) {
        problems += 1;
      } else if (rating.value === 2) {
        concerns += 1;
      }
    });

    APP.$("#transactionStatus").textContent =
      problems ? "HOLD" :
      concerns ? "REVIEW" :
      answered === applicable && applicable ? "CLEAR" : "Pending";

    APP.$("#transactionFlags").textContent =
      problems ? `${problems} problem(s), ${concerns} concern(s)` :
      concerns ? `${concerns} concern(s)` :
      answered ? `${answered}/${applicable} checked` : "No checks completed";
  }

  function updateCriticalFlags() {
    const count = GROUPS
      .filter((group) => group.weight > 0)
      .reduce((sum, group) => sum + groupScore(group).criticalFlags, 0);

    APP.$("#redFlagCount").textContent = count;
  }

  function updateGroupStatus(group) {
    const details = APP.$(`.inspection-group[data-group="${group.id}"]`);
    if (!details) return;

    const score = groupScore(group);
    const status = details.querySelector(".group-completion");

    if (score.answered === 0) {
      status.textContent = `Not inspected · ${score.total} checks`;
      status.dataset.state = "idle";
    } else if (score.pending > 0) {
      status.textContent =
        `In progress · ${score.answered}/${score.total} · ${score.pending} pending`;
      status.dataset.state = "pending";
    } else {
      const naCount = group.items.filter((itemDefinition, index) => {
        const rating = APP.state.ratings[ratingKey(group.id, index)];
        return rating?.value === 0;
      }).length;

      status.textContent =
        `Complete · ${score.total}/${score.total} ✓` +
        (naCount ? ` · ${naCount} N/A` : "");

      status.dataset.state = "complete";
    }

    details.classList.toggle(
      "in-progress",
      score.answered > 0 && score.pending > 0
    );

    details.classList.toggle(
      "complete",
      score.answered === score.total && score.total > 0
    );
  }

  function recalculate() {
    const overall = getOverallScore();

    APP.$("#pct").textContent =
      overall.pct === null ? "—" : `${overall.pct}/100`;

    APP.$("#grade").textContent =
      overall.pct === null ? "No scored checks yet" : conditionGrade(overall.pct);

    APP.$("#completionPct").textContent = `${overall.coverage}%`;
    APP.$("#answeredCount").textContent = overall.answered;
    APP.$("#applicableCount").textContent = overall.total;
    APP.$("#scorebar").style.width = `${overall.pct || 0}%`;

    APP.$("#topScore").textContent =
      overall.pct === null ? "Condition —" : `Condition ${overall.pct}/100`;

    APP.$("#dashScore").textContent =
      overall.pct === null ? "—" : `${overall.pct}/100`;

    updateMaintenance();
    updateTransaction();
    updateCriticalFlags();

    GROUPS.forEach(updateGroupStatus);

    APP.updateMarket?.();

    document.dispatchEvent(new CustomEvent("scorecard:inspectionchange"));
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function render() {
    const host = APP.$("#inspectionGroups");
    if (!host) return;

    host.innerHTML = "";

    GROUPS.forEach((group) => {
      const details = document.createElement("details");

      details.className = "card inspection-group";
      details.dataset.group = group.id;

      details.innerHTML = `
        <summary>
          <span class="group-icon">${
            group.id === "engine" ? "⚙" :
            group.id === "road" ? "➜" :
            group.id === "wear" ? "◉" : "◇"
          }</span>

          <span class="group-main">
            <b>${group.title}</b>
            <small>${group.hint}</small>
          </span>

          <span class="group-completion" data-state="idle"></span>
          <span class="group-chevron">⌄</span>
        </summary>

        <div class="group-body">
          <div class="priority-reasons hidden"></div>
          <div class="group-items"></div>
        </div>
      `;

      host.appendChild(details);

      const itemHost = details.querySelector(".group-items");

      group.items.forEach((itemDefinition, index) => {
        const key = ratingKey(group.id, index);
        const row = document.createElement("div");

        row.className = "item";

        row.innerHTML = `
          <div class="rowhead">
            <div class="name">${itemDefinition.name}</div>
            <div class="pill">${itemDefinition.max} pts</div>
          </div>

          <div class="choices"></div>
          <input
            class="item-note"
            placeholder="Notes / measurement / defect"
            value="${escapeAttribute(APP.state.itemNotes[key] || "")}"
          >
        `;

        const choiceHost = row.querySelector(".choices");

        optionSet(group, itemDefinition).forEach((option, optionIndex) => {
          const button = document.createElement("button");

          button.type = "button";
          button.className =
            `choice ${["good", "mid", "bad", "na"][optionIndex] || ""}`;

          button.textContent = `${option.label} · ${option.value}`;

          const current = APP.state.ratings[key];

          if (
            current &&
            current.label === option.label &&
            current.value === option.value
          ) {
            button.classList.add("active");
          }

          button.addEventListener("click", () => {
            APP.state.ratings[key] = {
              label: option.label,
              value: option.value
            };

            [...choiceHost.children].forEach((child) => {
              child.classList.remove("active");
            });

            button.classList.add("active");
            recalculate();
          });

          choiceHost.appendChild(button);
        });

        row.querySelector(".item-note").addEventListener("input", (event) => {
          APP.state.itemNotes[key] = event.target.value;
        });

        itemHost.appendChild(row);
      });
    });

    APP.$$(".inspection-group").forEach((details) => {
      details.open = false;
    });
    recalculate();

    document.dispatchEvent(new CustomEvent("scorecard:inspectionrender"));
  }

  function initializeInspection() {
    render();
  }

  document.addEventListener("scorecard:core-ready", initializeInspection);

  if (document.readyState !== "loading" && APP.$("#inspectionGroups")) {
    initializeInspection();
  }
})();
