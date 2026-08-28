(() => {
  "use strict";

  const APP = window.VehicleScorecard = window.VehicleScorecard || {};

  APP.constants = {
    STORAGE_KEY: "vehicleScorecardsV2",
    LAYER_KEY: "vehicleScorecardAssessmentLayer",
    MODE_KEY: "vehicleScorecardAssessmentMode",
    DEPTH_KEY: "vehicleScorecardInspectionDepth",
    THEME_KEY: "vehicleScorecardTheme",
    NHTSA_VPIC: "https://vpic.nhtsa.dot.gov/api/vehicles",
    NHTSA_API: "https://api.nhtsa.gov"
  };

  APP.state = {
    editingId: null,
    ratings: {},
    itemNotes: {},
    history: [],
    historyIndex: -1,
    internalNavigation: false,
    version: "11.0"
  };

  APP.$ = (selector, root = document) => root.querySelector(selector);
  APP.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  APP.money = (value) => {
    const number = Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
    return number.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    });
  };

  APP.numberFrom = (id) => {
    const value = APP.$(`#${id}`)?.value;
    return Math.max(0, Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0);
  };

  APP.text = (id) => APP.$(`#${id}`)?.textContent?.trim() || "";
  APP.value = (id) => APP.$(`#${id}`)?.value || "";

  APP.getLayer = () => localStorage.getItem(APP.constants.LAYER_KEY) || "";
  APP.getMode = () => localStorage.getItem(APP.constants.MODE_KEY) || "";

  APP.setLayer = (layer) => {
    if (!["condition", "value"].includes(layer)) return;

    localStorage.setItem(APP.constants.LAYER_KEY, layer);
    document.documentElement.dataset.assessmentLayer = layer;

    if (layer === "condition") {
      localStorage.setItem(APP.constants.MODE_KEY, "inspect");
      document.documentElement.dataset.assessmentMode = "inspect";
    }

    document.dispatchEvent(new CustomEvent("scorecard:workflowchange"));
  };

  APP.setMode = (mode) => {
    if (!["buy", "sell"].includes(mode)) return;

    localStorage.setItem(APP.constants.MODE_KEY, mode);
    localStorage.setItem(APP.constants.LAYER_KEY, "value");

    document.documentElement.dataset.assessmentMode = mode;
    document.documentElement.dataset.assessmentLayer = "value";

    document.dispatchEvent(new CustomEvent("scorecard:workflowchange"));
  };

  APP.getVehicle = () => ({
    year: APP.value("year") || APP.value("yearSelect"),
    make: APP.value("make") || APP.value("makeSelect"),
    model: APP.value("model") || APP.value("modelSelect"),
    trim: APP.value("trim"),
    zip: APP.value("zip") || APP.value("marketZip"),
    mileage: APP.value("mileage")
  });

  APP.toast = (message) => {
    const toast = APP.$("#appToast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 2400);
  };

  APP.consumerMakes = [
    "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
    "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
    "Genesis", "GMC", "Honda", "Hummer", "Hyundai", "Infiniti", "Isuzu",
    "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Lotus",
    "Lucid", "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "Mercury",
    "Mini", "Mitsubishi", "Nissan", "Oldsmobile", "Plymouth", "Polestar",
    "Pontiac", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Saab", "Saturn",
    "Scion", "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen",
    "Volvo", "Fisker", "Karma", "Ineos", "VinFast"
  ];

  function setOptions(select, values, placeholder) {
    select.innerHTML = `<option value="">${placeholder}</option>`;

    [...new Set(values.filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((value) => select.add(new Option(value, value)));
  }

  function initializeYears() {
    const years = [];
    const currentYear = new Date().getFullYear();

    for (let year = currentYear + 1; year >= 1981; year -= 1) {
      years.push(String(year));
    }

    setOptions(APP.$("#yearSelect"), years, "Select Year");
  }

  function populateConsumerMakes() {
    const select = APP.$("#makeSelect");
    setOptions(select, APP.consumerMakes, "Select Make");
    select.disabled = false;
  }

  async function loadMakes() {
    const year = APP.value("yearSelect");

    if (!year) {
      const makeSelect = APP.$("#makeSelect");
      makeSelect.innerHTML = '<option value="">Select Year First</option>';
      makeSelect.disabled = true;
      return;
    }

    APP.$("#year").value = year;
    populateConsumerMakes();

    const savedMake = APP.value("make");

    if (
      savedMake &&
      [...APP.$("#makeSelect").options].some((option) => option.value === savedMake)
    ) {
      APP.$("#makeSelect").value = savedMake;
    }
  }

  async function loadModels() {
    const year = APP.value("yearSelect");
    const make = APP.value("makeSelect");

    if (!year || !make) return;

    APP.$("#make").value = make;

    const select = APP.$("#modelSelect");
    select.disabled = true;
    select.innerHTML = '<option value="">Loading Models…</option>';

    try {
      const url =
        `${APP.constants.NHTSA_VPIC}/GetModelsForMakeYear/` +
        `make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;

      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();

      setOptions(
        select,
        (data.Results || []).map((row) => row.Model_Name),
        "Select Model"
      );

      select.disabled = false;

      const savedModel = APP.value("model");

      if (
        savedModel &&
        [...select.options].some((option) => option.value === savedModel)
      ) {
        select.value = savedModel;
      }
    } catch (error) {
      select.innerHTML = '<option value="">Model lookup unavailable</option>';
      select.disabled = false;
    }
  }

  async function decodeVin() {
    const input = APP.$("#vin");
    const status = APP.$("#decodeStatus");

    const vin = input.value
      .toUpperCase()
      .replace(/[^A-HJ-NPR-Z0-9]/g, "")
      .slice(0, 17);

    input.value = vin;

    if (vin.length !== 17) {
      status.textContent = "Enter a complete 17-character VIN.";
      return;
    }

    status.textContent = "Decoding VIN…";

    try {
      const url =
        `${APP.constants.NHTSA_VPIC}/DecodeVinValuesExtended/` +
        `${vin}?format=json`;

      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      const result = data.Results?.[0] || {};

      APP.$("#yearSelect").value = result.ModelYear || "";
      APP.$("#year").value = result.ModelYear || "";

      await loadMakes();

      if (result.Make) {
        if (
          ![...APP.$("#makeSelect").options].some(
            (option) => option.value === result.Make
          )
        ) {
          APP.$("#makeSelect").add(new Option(result.Make, result.Make));
        }

        APP.$("#makeSelect").value = result.Make;
        APP.$("#make").value = result.Make;
      }

      await loadModels();

      if (result.Model) {
        if (
          ![...APP.$("#modelSelect").options].some(
            (option) => option.value === result.Model
          )
        ) {
          APP.$("#modelSelect").add(new Option(result.Model, result.Model));
        }

        APP.$("#modelSelect").value = result.Model;
        APP.$("#model").value = result.Model;
      }

      APP.$("#trim").value = result.Trim || result.Series || "";

      status.textContent =
        "Decoded: " +
        [result.ModelYear, result.Make, result.Model, APP.value("trim")]
          .filter(Boolean)
          .join(" ");

      document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));
    } catch (error) {
      status.textContent = "VIN decode failed.";
    }
  }

  async function checkRecalls() {
    const vehicle = APP.getVehicle();
    const box = APP.$("#recallResults");

    if (!vehicle.year || !vehicle.make || !vehicle.model) {
      box.classList.remove("hidden");
      box.textContent = "Enter year, make and model first.";
      return;
    }

    box.classList.remove("hidden");
    box.textContent = "Checking NHTSA recalls…";

    try {
      const query =
        `make=${encodeURIComponent(vehicle.make)}` +
        `&model=${encodeURIComponent(vehicle.model)}` +
        `&modelYear=${vehicle.year}`;

      const response = await fetch(
        `${APP.constants.NHTSA_API}/recalls/recallsByVehicle?${query}`,
        { cache: "no-store" }
      );

      const data = await response.json();
      const recalls = data.results || data.Results || [];

      box.innerHTML =
        `<b>${recalls.length} recall campaign${recalls.length === 1 ? "" : "s"} found.</b>` +
        recalls.slice(0, 5).map((recall) => `
          <div style="margin-top:7px">
            <b>${recall.NHTSACampaignNumber || ""} — ${recall.Component || ""}</b><br>
            ${recall.Summary || ""}
          </div>
        `).join("");
    } catch (error) {
      box.textContent = "Recall lookup failed.";
    }
  }

  APP.reconItems = [
    ["Oil + filter service", 90, "maintenance"],
    ["Engine air filter", 35, "maintenance"],
    ["Cabin air filter", 35, "maintenance"],
    ["Coolant service", 175, "maintenance"],
    ["Brake fluid service", 130, "maintenance"],
    ["Transmission service", 250, "maintenance"],
    ["Differential / transfer case service", 180, "maintenance"],
    ["Battery", 200, "required"],
    ["Front brakes", 450, "required"],
    ["Rear brakes", 400, "required"],
    ["Set of 4 tires", 750, "required"],
    ["Alignment", 120, "maintenance"],
    ["Wiper blades", 45, "maintenance"],
    ["Headlight / bulbs / minor electrical", 75, "required"],
    ["A/C diagnosis / minor repair allowance", 200, "required"],
    ["Minor suspension / steering repair", 350, "required"],
    ["Windshield", 350, "required"],
    ["Professional interior / exterior detail", 250, "cosmetic"],
    ["Paint correction / polish", 300, "cosmetic"],
    ["Minor PDR / cosmetic body work", 250, "cosmetic"],
    ["Miscellaneous / other", 0, "required"]
  ].map(([name, defaultCost, group]) => ({ name, defaultCost, group }));

  function renderRecon() {
    const body = APP.$("#reconBody");
    body.innerHTML = "";

    APP.reconItems.forEach((item, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td><b>${item.name}</b></td>
        <td>
          <select id="rs${index}">
            <option value="none">Not Needed</option>
            <option value="recommended">Recommended</option>
            <option value="required">Required</option>
            <option value="unknown">Unknown</option>
          </select>
        </td>
        <td>${APP.money(item.defaultCost)}</td>
        <td><input id="ro${index}" placeholder="${item.defaultCost}"></td>
        <td><b id="ru${index}">$0</b></td>
      `;

      body.appendChild(row);

      APP.$(`#rs${index}`).addEventListener("change", updateRecon);
      APP.$(`#ro${index}`).addEventListener("input", updateRecon);
    });
  }

  function reconCost(index) {
    const override = APP.$(`#ro${index}`).value;

    return override === ""
      ? APP.reconItems[index].defaultCost
      : Math.max(0, Number(override) || 0);
  }

  APP.getReconTotals = () => {
    let required = 0;
    let recommended = 0;
    let cosmetic = 0;
    let unknown = 0;

    APP.reconItems.forEach((item, index) => {
      const status = APP.$(`#rs${index}`)?.value || "none";
      const cost = reconCost(index);

      if (status === "unknown") unknown += 1;

      if (!["required", "recommended"].includes(status)) return;

      if (item.group === "cosmetic") {
        cosmetic += cost;
      } else if (status === "required") {
        required += cost;
      } else {
        recommended += cost;
      }
    });

    const known = required + recommended + cosmetic;
    const contingency = APP.numberFrom("contingency");

    return {
      required,
      recommended,
      cosmetic,
      known,
      unknown,
      allIn: known + contingency
    };
  };

  function updateRecon() {
    APP.reconItems.forEach((item, index) => {
      const status = APP.$(`#rs${index}`)?.value || "none";
      const used = ["required", "recommended"].includes(status)
        ? reconCost(index)
        : 0;

      APP.$(`#ru${index}`).textContent = APP.money(used);
    });

    const totals = APP.getReconTotals();

    APP.$("#requiredRecon").textContent = APP.money(totals.required);
    APP.$("#recommendedRecon").textContent = APP.money(totals.recommended);
    APP.$("#cosmeticRecon").textContent = APP.money(totals.cosmetic);
    APP.$("#reconTotal").textContent = APP.money(totals.known);
    APP.$("#unknownReconCount").textContent = totals.unknown;
    APP.$("#reconRisk").textContent = APP.money(totals.allIn);
    APP.$("#dashRecon").textContent = APP.money(totals.known);

    updateValue();
    document.dispatchEvent(new CustomEvent("scorecard:datachange"));
  }

  function reconForMode(mode) {
    const totals = APP.getReconTotals();

    if (mode === "none") return 0;
    if (mode === "required") return totals.required;
    if (mode === "known") return totals.known;
    return totals.allIn;
  }

  function average(values) {
    const valid = values.filter((value) => value > 0);
    if (!valid.length) return 0;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function updateLinks() {
    const vehicle = APP.getVehicle();

    APP.$("#openKbb").href = "https://www.kbb.com/whats-my-car-worth/";
    APP.$("#openEdmunds").href = "https://www.edmunds.com/appraisal/";

    APP.$("#openCarGurus").href =
      "https://www.google.com/search?q=" +
      encodeURIComponent(
        `site:cargurus.com ${[
          vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.zip
        ].filter(Boolean).join(" ")} used`
      );

    APP.$("#openSearch").href =
      "https://www.google.com/search?q=" +
      encodeURIComponent(
        [
          vehicle.year, vehicle.make, vehicle.model, vehicle.trim,
          "used for sale", vehicle.zip
        ].filter(Boolean).join(" ")
      );
  }

  APP.updateMarket = () => {
    const tradeAverage = average([
      APP.numberFrom("kbbTrade"),
      APP.numberFrom("edmundsTrade"),
      APP.numberFrom("instantOffer")
    ]);

    const privateAverage = average([
      APP.numberFrom("kbbPrivate"),
      APP.numberFrom("edmundsPrivate"),
      APP.numberFrom("privateComp")
    ]);

    const localAverage = average([
      APP.numberFrom("dealer1"),
      APP.numberFrom("dealer2"),
      APP.numberFrom("privateComp")
    ]);

    APP.$("#guideTradeAvg").textContent = APP.money(tradeAverage);
    APP.$("#guidePrivateAvg").textContent = APP.money(privateAverage);
    APP.$("#localCompAvg").textContent = APP.money(localAverage);

    const condition = APP.inspection?.getOverallScore?.().pct ?? null;

    let factor = 1;

    if (condition !== null) {
      factor =
        condition >= 90 ? 0.98 :
        condition >= 80 ? 0.94 :
        condition >= 70 ? 0.89 :
        condition >= 60 ? 0.83 :
        condition >= 50 ? 0.76 : 0.68;
    }

    APP.$("#scoreAdjustedMarket").textContent =
      APP.money(average([privateAverage, localAverage]) * factor);

    updateLinks();
    updateValue();
  };

  function runMarketSearch() {
    const vehicle = APP.getVehicle();

    if (!vehicle.year || !vehicle.make || !vehicle.model) {
      APP.$("#marketStatus").textContent = "Vehicle information missing.";
      return;
    }

    if (!/^\d{5}$/.test(vehicle.zip)) {
      APP.$("#marketStatus").textContent = "Enter a 5-digit ZIP.";
      return;
    }

    const query = [
      vehicle.year,
      vehicle.make,
      vehicle.model,
      vehicle.trim,
      `used for sale near ${vehicle.zip}`
    ].filter(Boolean).join(" ");

    window.open(
      "https://www.google.com/search?q=" + encodeURIComponent(query),
      "_blank",
      "noopener"
    );
  }

  function updateValue() {
    const valueOnly = localStorage.getItem("vehicleScorecardAssessmentPath") === "value";
    const knownRepairEstimate = valueOnly ? APP.numberFrom("knownRepairEstimate") : 0;
    const baseSellRecon = reconForMode(APP.value("sellReconMode"));
    const sellRecon = APP.value("sellReconMode") === "none" ? 0 : baseSellRecon + knownRepairEstimate;
    const asIs = APP.numberFrom("sellAsIs");
    const postRecon = APP.numberFrom("sellPostRecon");
    const sellTarget = APP.numberFrom("sellTarget");
    const sellingCosts = APP.numberFrom("sellCosts");

    const sellerTakeHome = Math.max(0, sellTarget - sellRecon - sellingCosts);

    APP.$("#sellReconUsed").textContent = APP.money(sellRecon);
    APP.$("#sellNet").textContent = APP.money(sellerTakeHome);
    APP.$("#reconBenefit").textContent = APP.money(postRecon - asIs - sellRecon);

    let pricingCheck = "—";

    if (postRecon && sellTarget > postRecon) {
      pricingCheck = `+${APP.money(sellTarget - postRecon)} over market`;
    } else if (postRecon && APP.numberFrom("sellList") > postRecon) {
      pricingCheck = `List +${APP.money(APP.numberFrom("sellList") - postRecon)}`;
    } else if (postRecon) {
      pricingCheck = "Aligned";
    }

    APP.$("#pricingCheck").textContent = pricingCheck;

    const ask = APP.numberFrom("buyAsk") || APP.numberFrom("asking");
    const purchase = APP.numberFrom("buyTarget") || ask;
    const buyRecon = reconForMode(APP.value("buyReconMode")) + knownRepairEstimate;
    const buyFees = APP.numberFrom("buyFees");
    const acquisitionCosts = APP.numberFrom("buyAcqCosts");
    const buySellingCosts = APP.numberFrom("buySellingCosts");
    const resale = APP.numberFrom("buyResale");
    const buyIntent = APP.value("buyIntent") === "flip" ? "flip" : "ownership";

    const netResale = Math.max(0, resale - (buyIntent === "flip" ? buySellingCosts : 0));
    const basis = purchase + buyRecon + buyFees + acquisitionCosts;
    const profit = netResale - basis;
    const roi = basis ? profit / basis * 100 : 0;
    const margin = resale ? profit / resale * 100 : 0;

    const maxBuy = Math.max(0, netResale -
      (buyIntent === "flip" ? APP.numberFrom("requiredProfit") : 0) -
      buyRecon - buyFees - acquisitionCosts);

    const negotiationGap = maxBuy - ask;

    APP.$("#buyReconUsed").textContent = APP.money(buyRecon);
    APP.$("#buyBasis").textContent = APP.money(basis);
    APP.$("#buyProfit").textContent = APP.money(profit);
    APP.$("#buyROI").textContent = `${Math.round(roi)}%`;
    APP.$("#buyMargin").textContent = `${Math.round(margin)}%`;
    APP.$("#calculatedMaxBuy").textContent = APP.money(maxBuy);
    APP.$("#negotiationGap").textContent = APP.money(negotiationGap);

    let assessment = "—";

    APP.$$('[data-buy-flip-only]').forEach((element) => {
      element.classList.toggle("hidden", buyIntent !== "flip");
    });
    APP.$("#buyValueFieldLabel").textContent = buyIntent === "flip" ? "Expected Resale Price" : "Estimated Market Value";
    APP.$("#buyValueFieldHelp").textContent = buyIntent === "flip"
      ? "Your realistic resale target after planned work."
      : "A realistic condition-adjusted value for comparison with your all-in cost.";
    APP.$("#buyProfitLabel").textContent = buyIntent === "flip" ? "Projected Profit" : "Value Position";
    APP.$("#buyRoiLabel").textContent = buyIntent === "flip" ? "ROI" : "Value Position %";

    if (resale) {
      const redFlags = Number(APP.text("redFlagCount")) || 0;
      if (buyIntent === "flip") {
        assessment =
          profit < 0 ? "PASS" :
          APP.numberFrom("requiredProfit") && profit < APP.numberFrom("requiredProfit") ? "MARGINAL" :
          roi >= 25 && redFlags === 0 ? "STRONG BUY" :
          roi >= 15 ? "GOOD BUY" :
          roi >= 8 ? "MARGINAL" : "HIGH RISK";
      } else {
        const ratio = resale ? basis / resale : 0;
        assessment = redFlags ? "NEEDS PPI" :
          ratio <= .9 ? "STRONG VALUE" :
          ratio <= 1.02 ? "FAIR BUY" :
          ratio <= 1.08 ? "HIGH PRICE" : "OVERPRICED";
      }
    }

    APP.$("#dealAssessment").textContent = assessment;
    document.dispatchEvent(new CustomEvent("scorecard:datachange"));
  }

  APP.updateValue = updateValue;

  APP.fieldIds = [
    "year", "make", "model", "trim", "mileage", "vin", "asking", "zip",
    "seller", "title", "keys", "cold", "records", "contingency", "marketZip",
    "marketRadius", "compMileage", "marketNotes", "kbbTrade", "kbbPrivate",
    "edmundsTrade", "edmundsPrivate", "dealer1", "dealer2", "privateComp",
    "instantOffer", "sellAsIs", "sellPostRecon", "sellList", "sellTarget",
    "sellQuick", "sellFloor", "sellCosts", "sellReconMode", "buyIntent", "buyAsk", "buyTarget",
    "buyResale", "requiredProfit", "buyFees", "buyAcqCosts", "buySellingCosts",
    "buyReconMode", "knownCondition", "knownRepairEstimate", "knownRepairs",
    "decision", "status", "followup", "notes"
  ];

  APP.getSaved = () => {
    try {
      return JSON.parse(localStorage.getItem(APP.constants.STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  };

  APP.saveList = (vehicles) => {
    localStorage.setItem(APP.constants.STORAGE_KEY, JSON.stringify(vehicles));
    APP.renderSaved();
    APP.renderDashboard();
  };

  APP.snapshot = () => {
    const snapshot = {
      id: APP.state.editingId || Date.now(),
      savedAt: new Date().toISOString(),
      layer: APP.getLayer(),
      mode: APP.getMode(),
      mileageUnknown: APP.$("#mileageUnknown")?.checked || false,
      fields: {},
      ratings: APP.state.ratings,
      itemNotes: APP.state.itemNotes,
      recon: {},
      score: {
        pct: APP.text("pct"),
        grade: APP.text("grade")
      }
    };

    APP.fieldIds.forEach((id) => {
      snapshot.fields[id] = APP.$(`#${id}`)?.value || "";
    });

    APP.reconItems.forEach((item, index) => {
      snapshot.recon[index] = {
        status: APP.$(`#rs${index}`)?.value || "none",
        override: APP.$(`#ro${index}`)?.value || ""
      };
    });

    return JSON.parse(JSON.stringify(snapshot));
  };

  APP.saveCurrent = () => {
    const vehicle = APP.snapshot();
    const list = APP.getSaved();
    const existingIndex = list.findIndex((item) => item.id === vehicle.id);

    if (existingIndex >= 0) {
      list[existingIndex] = vehicle;
    } else {
      list.push(vehicle);
    }

    APP.state.editingId = vehicle.id;
    APP.saveList(list);
    APP.toast("Vehicle saved");
  };

  APP.clearCurrent = () => {
    APP.state.editingId = null;
    APP.state.ratings = {};
    APP.state.itemNotes = {};

    APP.fieldIds.forEach((id) => {
      const element = APP.$(`#${id}`);
      if (!element) return;

      if (element.tagName === "SELECT") {
        element.selectedIndex = 0;
      } else {
        element.value = "";
      }
    });

    APP.$("#mileageUnknown").checked = false;
    APP.$("#mileage").disabled = false;

    localStorage.removeItem(APP.constants.LAYER_KEY);
    localStorage.removeItem(APP.constants.MODE_KEY);

    APP.reconItems.forEach((item, index) => {
      APP.$(`#rs${index}`).value = "none";
      APP.$(`#ro${index}`).value = "";
    });

    APP.inspection?.render();
    APP.inspection?.recalculate();

    updateRecon();
    APP.updateMarket();
    document.dispatchEvent(new CustomEvent("scorecard:workflowchange"));
  };

  APP.loadSaved = async (id, destinationPage = "profilePage") => {
    const vehicle = APP.getSaved().find((item) => item.id === id);
    if (!vehicle) return;

    APP.state.editingId = id;

    APP.fieldIds.forEach((fieldId) => {
      const element = APP.$(`#${fieldId}`);
      if (element) {
        element.value = vehicle.fields?.[fieldId] || "";
      }
    });

    if (vehicle.layer) {
      localStorage.setItem(APP.constants.LAYER_KEY, vehicle.layer);
    }

    if (vehicle.mode) {
      localStorage.setItem(APP.constants.MODE_KEY, vehicle.mode);
    }

    APP.$("#mileageUnknown").checked = Boolean(vehicle.mileageUnknown);
    APP.$("#mileage").disabled = Boolean(vehicle.mileageUnknown);

    const year = vehicle.fields?.year || "";
    const make = vehicle.fields?.make || "";
    const model = vehicle.fields?.model || "";

    if (year) {
      APP.$("#yearSelect").value = year;
      APP.$("#year").value = year;
      if (destinationPage === "profilePage") await loadMakes();
    }

    if (make) {
      if (
        ![...APP.$("#makeSelect").options].some(
          (option) => option.value === make
        )
      ) {
        APP.$("#makeSelect").add(new Option(make, make));
      }

      APP.$("#makeSelect").value = make;
      APP.$("#make").value = make;
      if (destinationPage === "profilePage") await loadModels();
    }

    if (model) {
      if (
        ![...APP.$("#modelSelect").options].some(
          (option) => option.value === model
        )
      ) {
        APP.$("#modelSelect").add(new Option(model, model));
      }

      APP.$("#modelSelect").value = model;
      APP.$("#model").value = model;
    }

    const migratedInspection =
      APP.inspection?.migrateLegacyState?.(
        vehicle.ratings || {},
        vehicle.itemNotes || {}
      ) || {
        ratings: vehicle.ratings || {},
        itemNotes: vehicle.itemNotes || {}
      };

    APP.state.ratings = migratedInspection.ratings;
    APP.state.itemNotes = migratedInspection.itemNotes;

    APP.inspection?.render();

    APP.reconItems.forEach((item, index) => {
      APP.$(`#rs${index}`).value = vehicle.recon?.[index]?.status || "none";
      APP.$(`#ro${index}`).value = vehicle.recon?.[index]?.override || "";
    });

    updateRecon();
    APP.inspection?.recalculate();
    APP.updateMarket();

    document.dispatchEvent(new CustomEvent("scorecard:workflowchange"));
    document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));

    APP.showPage?.(destinationPage || "profilePage");
  };

  const savedSelection = new Set();

  APP.renderSaved = () => {
    const host = APP.$("#savedList");
    if (!host) return;

    const savedVehicles = APP.getSaved().slice().reverse();
    [...savedSelection].forEach((id) => {
      if (!savedVehicles.some((vehicle) => String(vehicle.id) === String(id))) savedSelection.delete(id);
    });
    host.innerHTML = `<div class="saved-bulk-bar">
      <label><input type="checkbox" id="savedSelectAll"> Select all</label>
      <span id="savedSelectedCount">0 selected</span>
      <button type="button" class="btn" id="compareSelected" disabled>Compare Selected</button>
      <button type="button" class="btn danger" id="deleteSelected" disabled>Delete Selected</button>
    </div><div id="savedBulkCards"></div>`;
    const cardHost = APP.$("#savedBulkCards");

    const updateBulkControls = () => {
      const count = savedSelection.size;
      APP.$("#savedSelectedCount").textContent = `${count} selected`;
      APP.$("#compareSelected").disabled = count < 2;
      APP.$("#deleteSelected").disabled = count === 0;
      APP.$("#savedSelectAll").checked = Boolean(savedVehicles.length) && count === savedVehicles.length;
      APP.$("#savedSelectAll").indeterminate = count > 0 && count < savedVehicles.length;
    };

    savedVehicles.forEach((vehicle) => {
      const card = document.createElement("div");
      card.className = "saved-card";

      const fields = vehicle.fields || {};
      const name = [fields.year, fields.make, fields.model, fields.trim]
        .filter(Boolean)
        .join(" ") || "Untitled Vehicle";

      const mileage = vehicle.mileageUnknown
        ? "Mileage unknown"
        : fields.mileage
          ? `${Number(fields.mileage).toLocaleString()} miles`
          : "Mileage not entered";

      card.innerHTML = `<label class="saved-select"><input type="checkbox" data-saved-select="${vehicle.id}" ${savedSelection.has(vehicle.id) ? "checked" : ""}><span>Select</span></label>
        <div class="vehicle-name">${name}</div>
        <div class="muted">${mileage} · ${vehicle.score?.pct || "No score"}</div>
      `;

      card.querySelector("[data-saved-select]").addEventListener("change", (event) => {
        if (event.target.checked) savedSelection.add(vehicle.id); else savedSelection.delete(vehicle.id);
        updateBulkControls();
      });

      const open = document.createElement("button");
      open.className = "btn";
      open.textContent = "Open";
      open.addEventListener("click", () => APP.loadSaved(vehicle.id));

      const remove = document.createElement("button");
      remove.className = "btn";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        if (confirm("Delete this vehicle?")) {
          APP.saveList(APP.getSaved().filter((item) => item.id !== vehicle.id));
        }
      });

      card.append(open, remove);
      cardHost.appendChild(card);
    });

    APP.$("#savedSelectAll").addEventListener("change", (event) => {
      savedSelection.clear();
      if (event.target.checked) savedVehicles.forEach((vehicle) => savedSelection.add(vehicle.id));
      APP.$$('[data-saved-select]').forEach((checkbox) => { checkbox.checked = event.target.checked; });
      updateBulkControls();
    });
    APP.$("#deleteSelected").addEventListener("click", () => {
      if (!savedSelection.size || !confirm(`Delete ${savedSelection.size} selected vehicle${savedSelection.size === 1 ? "" : "s"}?`)) return;
      const ids = new Set([...savedSelection].map(String));
      savedSelection.clear();
      ids.forEach((id) => compareSet.delete(id));
      APP.saveList(APP.getSaved().filter((vehicle) => !ids.has(String(vehicle.id))));
      APP.renderCompare();
      APP.toast("Selected vehicles deleted");
    });
    APP.$("#compareSelected").addEventListener("click", () => {
      compareSet.clear();
      savedSelection.forEach((id) => compareSet.add(id));
      APP.renderCompare();
      APP.$("#comparePicker")?.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    updateBulkControls();
  };

  const compareSet = new Set();

  APP.renderCompare = () => {
    const picker = APP.$("#comparePicker");
    const table = APP.$("#compareTable");

    picker.innerHTML = "";

    APP.getSaved().forEach((vehicle) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.checked = compareSet.has(vehicle.id);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          compareSet.add(vehicle.id);
        } else {
          compareSet.delete(vehicle.id);
        }

        renderCompareTable();
      });

      const fields = vehicle.fields || {};
      const name = [fields.year, fields.make, fields.model]
        .filter(Boolean)
        .join(" ");

      label.append(checkbox, document.createTextNode(` ${name}`));
      picker.append(label, document.createElement("br"));
    });

    function renderCompareTable() {
      const vehicles = APP.getSaved().filter((vehicle) =>
        compareSet.has(vehicle.id)
      );

      table.innerHTML = "";
      if (!vehicles.length) return;

      table.innerHTML =
        "<tr><th>Metric</th>" +
        vehicles.map((vehicle) => {
          const fields = vehicle.fields || {};
          return `<th>${[fields.year, fields.make, fields.model]
            .filter(Boolean)
            .join(" ")}</th>`;
        }).join("") +
        "</tr>";

      const rows = [
        ["Score", (vehicle) => vehicle.score?.pct || "—"],
        ["Mileage", (vehicle) => vehicle.mileageUnknown ? "Unknown" : vehicle.fields?.mileage || "—"],
        ["Asking", (vehicle) => APP.money(vehicle.fields?.asking)],
        ["Expected Sale", (vehicle) => APP.money(vehicle.fields?.sellTarget)],
        ["Expected Resale", (vehicle) => APP.money(vehicle.fields?.buyResale)],
        ["Decision", (vehicle) => vehicle.fields?.decision || "—"]
      ];

      rows.forEach(([label, getter]) => {
        table.insertAdjacentHTML(
          "beforeend",
          `<tr><td><b>${label}</b></td>` +
          vehicles.map((vehicle) => `<td>${getter(vehicle)}</td>`).join("") +
          "</tr>"
        );
      });
    }

    renderCompareTable();
  };

  APP.renderDashboard = () => {
    const saved = APP.getSaved();

    APP.$("#dashSaved").textContent = saved.length;

    const recent = APP.$("#dashRecent");
    recent.innerHTML = "";

    saved.slice(-3).reverse().forEach((vehicle) => {
      const fields = vehicle.fields || {};
      const name = [fields.year, fields.make, fields.model]
        .filter(Boolean)
        .join(" ") || "Untitled Vehicle";

      const mileage = vehicle.mileageUnknown
        ? "Mileage unknown"
        : fields.mileage
          ? `${Number(fields.mileage).toLocaleString()} miles`
          : "Mileage not entered";

      recent.insertAdjacentHTML(
        "beforeend",
        `<div class="saved-card">
          <div class="vehicle-name">${name}</div>
          <div class="muted">${mileage} · Condition ${vehicle.score?.pct || "—"}</div>
        </div>`
      );
    });

    if (!saved.length) {
      recent.innerHTML = '<div class="muted">No saved inspections yet.</div>';
    }

    APP.$("#dashMode").textContent =
      APP.getLayer() === "value"
        ? APP.getMode() === "buy"
          ? "Buying"
          : APP.getMode() === "sell"
            ? "Selling"
            : "Value"
        : APP.getLayer() === "condition"
          ? "Condition"
          : "—";

    document.dispatchEvent(new CustomEvent("scorecard:dashboardrender"));
  };

  APP.exportBlob = (data, filename) => {
    const link = document.createElement("a");

    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      })
    );

    link.download = filename;
    link.click();

    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  APP.validateVehicleProfile = () => {
    const missing = [];

    if (!APP.getLayer()) {
      missing.push("assessment type");
    }

    if (
      APP.getLayer() === "value" &&
      !["buy", "sell"].includes(APP.getMode())
    ) {
      missing.push("buying or selling");
    }

    if (!(APP.value("yearSelect") || APP.value("year"))) {
      missing.push("year");
    }

    if (!(APP.value("makeSelect") || APP.value("make"))) {
      missing.push("make");
    }

    if (!(APP.value("modelSelect") || APP.value("model"))) {
      missing.push("model");
    }

    if (
      !APP.$("#mileageUnknown").checked &&
      !APP.value("mileage").trim()
    ) {
      missing.push("mileage");
    }

    return missing;
  };

  function initializeCore() {
    initializeYears();
    renderRecon();
    APP.renderSaved();
    APP.renderDashboard();

    APP.$("#yearSelect").addEventListener("change", async () => {
      APP.$("#year").value = APP.value("yearSelect");
      await loadMakes();
      document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));
    });

    APP.$("#makeSelect").addEventListener("change", async () => {
      APP.$("#make").value = APP.value("makeSelect");
      await loadModels();
      document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));
    });

    APP.$("#modelSelect").addEventListener("change", () => {
      APP.$("#model").value = APP.value("modelSelect");
      document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));
    });

    APP.$("#mileage").addEventListener("input", () => {
      document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));
    });

    APP.$("#mileageUnknown").addEventListener("change", (event) => {
      APP.$("#mileage").disabled = event.target.checked;

      if (event.target.checked) {
        APP.$("#mileage").value = "";
      }

      document.dispatchEvent(new CustomEvent("scorecard:vehiclechange"));
    });

    APP.$("#decodeVin").addEventListener("click", decodeVin);
    APP.$("#checkRecalls").addEventListener("click", checkRecalls);

    APP.$("#zip").addEventListener("input", () => {
      APP.$("#marketZip").value = APP.value("zip");
    });

    APP.$("#marketZip").addEventListener("input", () => {
      APP.$("#zip").value = APP.value("marketZip");
    });

    APP.$("#runMarketSearch").addEventListener("click", runMarketSearch);
    APP.$("#refreshMarketLinks").addEventListener("click", updateLinks);

    APP.$$("input, select, textarea").forEach((element) => {
      element.addEventListener("input", () => {
        if (element.closest("#reconPage")) updateRecon();
        if (element.closest("#marketPage")) APP.updateMarket();
        if (element.closest("#dealPage")) updateValue();

        document.dispatchEvent(new CustomEvent("scorecard:datachange"));
      });

      element.addEventListener("change", () => {
        if (element.closest("#dealPage")) updateValue();
        document.dispatchEvent(new CustomEvent("scorecard:datachange"));
      });
    });

    APP.$("#exportCurrent").addEventListener(
      "click",
      () => APP.exportBlob(APP.snapshot(), "vehicle-inspection.json")
    );

    APP.$("#exportAll").addEventListener(
      "click",
      () => APP.exportBlob(APP.getSaved(), "vehicle-scorecard-backup.json")
    );

    APP.$("#importFile").addEventListener("change", async (event) => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;

        const data = JSON.parse(await file.text());

        if (
          Array.isArray(data) &&
          confirm("Replace saved vehicles with this backup?")
        ) {
          APP.saveList(data);
        }
      } catch (error) {
        alert("Invalid backup file.");
      }
    });

    updateRecon();
    APP.updateMarket();
    updateLinks();

    document.dispatchEvent(new CustomEvent("scorecard:core-ready"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCore);
  } else {
    initializeCore();
  }
})();
