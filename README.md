# Used-Vehicle Scorecard

A mobile/desktop used-vehicle condition and value-assessment app designed to work from GitHub Pages without paid API keys.

## v11.0 clean rebuild

This repository was fully consolidated in v11.0.

There are no version-specific patch scripts in the production runtime.

### Production files

- `index.html` — application shell and page layout
- `styles.css` — all application styling and dark mode
- `js/core.js` — vehicle data, VIN/model lookup, recon, market, buy/sell calculations, save/export/import
- `js/inspection.js` — inspection modules, scoring, completion counts and condition grade
- `js/intelligence.js` — age/mileage/NHTSA-based inspection emphasis
- `js/ui.js` — navigation, dashboard/report, workflow, dark mode and updater
- `service-worker.js` — simple network-first PWA/offline support
- `version.json` — single user-facing version source
- `manifest.webmanifest` — installable app configuration
- `icon-180.png`, `icon-192.png`, `icon-512.png` — app icons

## App purpose

The app is condition-first.

### Condition Assessment

`Vehicle → Inspection → Report`

The condition scorecard works without entering pricing data.

### Condition + Value Assessment

`Vehicle → Inspection → Recon → Market → Value → Report`

After selecting the value layer, the user chooses:

- Buying
- Selling

The financial analysis stacks on top of the condition assessment.

## Condition scoring

Physical condition is separate from maintenance confidence and transaction/title status.

Weighted condition groups:

- Exterior, Body & Structure: 15%
- Tires, Wheels & Brakes: 15%
- Engine Bay & Powertrain: 22%
- Interior & Cabin: 8%
- Electrical, Controls & Equipment: 7%
- HVAC & Comfort: 3%
- Road Test: 13%

These weights preserve the prior scoring model:
Mechanical/Road Test 35%, Wear 15%, Exterior 15%, Interior 8%, Equipment/HVAC 10%.

`N/A` counts as answered for module completion but is excluded from the scoring denominator.

## Inspection intelligence

Inspection modules may be marked Recommended or High Priority using:

- vehicle age
- mileage
- public NHTSA complaint data
- public NHTSA recall data

These recommendations do **not** alter the condition score.

## Vehicle lookup

Year/make/model lookup uses public NHTSA vPIC endpoints.

The make selector intentionally uses a curated passenger/light-duty consumer manufacturer list instead of exposing every manufacturer in NHTSA's database.

## Saved vehicles

Existing storage compatibility is preserved using the same localStorage key:

`vehicleScorecardsV2`

Saved vehicle data remains local to the browser/device.

The v11.0 save format also records:

- assessment layer
- buying/selling mode
- mileage unknown state

Older saved records remain loadable.

## Market comparison

Market values are manually entered.

The app provides links to KBB, Edmunds and web/CarGurus searches.

No paid market API key is required.

## PWA updates

`version.json` is the user-facing version source.

The service worker uses one stable cache and a network-first strategy for same-origin app files. This removes the old chain of versioned service-worker caches and injected patch scripts.

Use:

`☰ → Update / Refresh App`

to request the latest worker/assets and reload the published build.

## GitHub Pages deployment

Publish the repository root from `main`.

Live URL:

`https://khanauto.github.io/Vehicle-Scorecard/`

## What was removed

v11.0 replaces the previous layered runtime that accumulated files such as:

- `app-shell.html`
- `app.css`
- `app.js`
- `build.js`
- `navigation.js`
- `navigation-v103.js`
- `make-filter-v104.js`
- `profile-flow-v106.js`
- `inspection-count-v106.js`
- `priority-highlight-v106.js`
- `dashboard-v107.js`
- `theme-v108.js`
- `workflow-v109.js`

Their functionality has been consolidated into the four readable JavaScript modules above.

Git history remains the rollback system. Old runtime patch files do not need to remain in the production repository.
