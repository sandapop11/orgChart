# Org Chart Web App — Design

**Date:** 2026-07-06
**Status:** Approved pending final user review

## Overview

A standalone, view-only web app that renders a dynamic organization chart from the
company HR system's JSON data — a self-built replacement for Balkan OrgChartJS.
Vanilla HTML/CSS/JS with no build step: the files can be dropped next to the HR
system (hr.nepalscript.com) or opened from disk.

## Goals

- Render the org hierarchy from the existing `data.js` shape (or a live API returning the same JSON).
- Employee cards with photo, name, title, department; click for full details.
- Departments drawn as tinted, labeled **container boxes** around their members.
- Pan, zoom, fit-to-screen, collapse/expand departments.
- Search with highlight-and-navigate; single-department filter.
- Layout customization: card style presets, orientation, density, theme, department colors.
- Export to PNG; print/PDF via a print stylesheet.

## Non-goals

- **No editing.** The HR system is the single source of truth; this app never writes data.
- No backend, no accounts, no build tooling, no framework.
- No SVG export (disproportionately complex with HTML cards).
- No virtualization for thousands of nodes (target is tens to a few hundred employees).

## Data contract

Input is `maps = { items: [...] }` where each item has:

| Field | Notes |
|---|---|
| `id` | number (employees) — department nodes use 5xxxx ids |
| `pid` | **string** parent id; absent on the root (CEO) |
| `name` | display name, often suffixed `"(nn)"` with the employee number |
| `title` | job title |
| `DEPARTMENT_NAME` | department label |
| `img` | photo URL; may contain `..\/..\/` segments |
| `tags` | malformed string, e.g. `"tags: ['it-team']"`; `'group'` marks department nodes |

### dataAdapter.js responsibilities

- Normalize `id`/`pid` to one type and resolve parent links.
- Parse the `tags` string into a real array; `group` tag ⇒ department container node.
- Normalize image URLs (collapse `../` segments); extract employee number from the `name` suffix.
- Repair bad data instead of crashing: orphaned `pid` → attach to root + console warning;
  circular chains → break the cycle + warning; duplicate ids → keep first + warning.
- Output: `{ root, nodesById, departments }` — a clean tree of
  `{ id, name, title, department, img, tags, employeeNo, children, isGroup }`.
- The model supports arbitrary nesting (a manager hierarchy inside a department
  renders as a subtree inside that container) even though current data is two-level.

### Data loading

`app.js` reads a config object declared inline in `index.html`
(`window.OrgChartConfig = { apiUrl: "" }`). If `apiUrl` is set, `fetch()` it and
expect the same JSON shape; on failure (or no URL), fall back to the global `maps`
from `data.js`. Load failure with no fallback shows a friendly error + Retry.

## Architecture

Plain `<script>` tags in dependency order (no ES modules, so `file://` opening works).
Each file exposes one namespaced global (`OrgChart.layout`, `OrgChart.render`, …).

```
orgChart/
├── index.html          # app shell: toolbar, chart canvas, details panel, settings drawer
├── styles/
│   ├── app.css         # shell, toolbar, panels
│   ├── chart.css       # cards, containers, connectors
│   └── themes.css      # light/dark + department accent palette
├── src/
│   ├── dataAdapter.js  # raw items → clean tree (pure, unit-tested)
│   ├── layout.js       # tree + settings → positions (pure, unit-tested)
│   ├── render.js       # positions → DOM cards + SVG connector paths
│   ├── interactions.js # pan/zoom/fit, collapse, card click
│   ├── search.js       # search + department filter
│   ├── settings.js     # customization panel + localStorage persistence
│   ├── export.js       # PNG export + print handling
│   └── app.js          # config, bootstrapping, event wiring
├── vendor/
│   └── html-to-image.min.js   # only dependency, vendored
├── data.js             # existing HR data file, untouched
└── tests/              # node --test unit tests for adapter + layout
```

Module boundaries: `dataAdapter` and `layout` are pure functions of their inputs —
no DOM access — so they are testable in Node and replaceable independently.
`render` consumes only the layout output; `interactions`/`search` manipulate state
and re-invoke layout+render.

## Layout & rendering

- **World model:** one absolutely-positioned "world" `<div>` containing all cards and
  container boxes, with a single `<svg>` layer beneath for connectors. Pan/zoom is one
  CSS `transform: translate(...) scale(...)` on the world div.
- **Two-pass layout:** (1) measure each department container — members arranged in a
  wrapping grid capped at *N* columns (setting); (2) place containers side by side
  beneath the root with configurable gaps; container rows wrap when a row would exceed
  `max(1600px, viewport width)`. Root (CEO) card centered above.
- **Orientation:** top-down (default) or left-to-right — the layout function swaps axes.
- **Connectors:** rounded orthogonal SVG paths from root to each container's edge
  (and to nested subtrees if present).
- **Collapse:** a collapsed department renders as a pill — `SHOWROOM · 15 ▸` — and the
  layout reflows.
- **Department containers:** dashed tinted border, pill label with name + head-count,
  per-department accent color used on the label, card bands/stripes, and connector.

## Card styles (switchable presets)

1. **Classic** — horizontal: round photo left, name/title right, department color stripe.
2. **Portrait** *(default)* — vertical: colored header band, large overlapping round
   photo, centered name/title, department chip.
3. **Compact** — small square photo, two tight text lines, department dot.

Broken/missing photos render a deterministic initials avatar (background color hashed
from the name). All styles show the same data; details live in the panel.

## Interactions & features

- **Pan/zoom:** drag to pan; wheel/pinch to zoom around cursor; toolbar zoom ± and
  **Fit** (frame entire chart). Initial view = Fit.
- **Collapse/expand:** click a container's label pill to toggle; search auto-expands
  collapsed departments containing hits.
- **Details panel:** clicking a card slides in a right panel: photo, name, title,
  department, employee number, tags, reporting path (e.g. Navin → Showroom → CEO).
  Esc or ✕ closes.
- **Search:** toolbar input, case-insensitive substring match over name/title/department.
  Matches get a highlight ring; the view pans/zooms to the first match; Enter cycles
  through matches; a `n of m` counter shows beside the input.
- **Department filter:** dropdown listing departments; selecting one hides all other
  containers (root + chosen container remain); "All" restores.

## Customization panel (⚙ drawer)

| Setting | Values | Default |
|---|---|---|
| Card style | Classic / Portrait / Compact | Portrait |
| Orientation | Top-down / Left-right | Top-down |
| Max cards per container row | 2–8 | 4 |
| Spacing | Compact / Normal / Roomy | Normal |
| Theme | Light / Dark / System | System |
| Department colors | auto-palette + per-department override | auto |
| Show photos / titles / dept badges | on/off each | on |
| Show empty departments | on/off | off |

Persisted to `localStorage` (`orgchart.settings.v1`); Reset-to-defaults button.

## Export & print

- **PNG:** `export.js` uses vendored *html-to-image* on the world div at fit-all
  framing, downloads `orgchart-YYYY-MM-DD.png`. Same-origin hosting next to the HR
  photos yields full-fidelity export; cross-origin-blocked photos fall back to
  initials avatars in the exported image.
- **Print/PDF:** print stylesheet hides toolbar/panels, scales the chart to fit
  landscape pages; user prints or "Save as PDF" from the browser dialog.

## Error handling

| Failure | Behavior |
|---|---|
| API unreachable / bad JSON | Error screen + Retry; auto-fallback to `data.js` if present |
| Photo 404 / blocked | Initials avatar, stable color per name |
| Orphan `pid` | Reparent to root, `console.warn` with ids |
| Circular `pid` chain | Break cycle, warn |
| Duplicate ids | First wins, warn |
| Empty department | Hidden unless "show empty departments" enabled |

## Testing

- **Unit (automated):** `node --test tests/` — no dependencies. Covers `dataAdapter`
  (string pids, malformed tags string, `../` URL normalization, orphan/cycle/duplicate
  repair, employee-number extraction, empty "Designing" department) and `layout`
  (grid wrapping, container row wrap, collapse reflow, both orientations, determinism).
- **Manual smoke checklist:** load from data.js and from a mock API; pan/zoom/fit;
  collapse/expand; search cycling; department filter; all three card styles; theme
  switch; PNG export; print preview — in Chrome/Edge.

## Decisions log

| Decision | Choice | Why |
|---|---|---|
| Project form | Standalone web app | Ready to use for the organization |
| Data source | HR API JSON, `data.js` fallback | Matches existing Balkan feed |
| Editing | View-only | HR system stays the single source of truth |
| Stack | Vanilla JS, no build | Easiest to deploy/maintain next to HR system |
| Departments | Container boxes (option B) | Chosen from visual mockups |
| Default card | Centered portrait (option B) | Chosen from visual mockups |
| Rendering | HTML cards + SVG connector layer | Easiest styling/theming; export via one vendored lib |
| PNG export lib | vendored html-to-image | Single small dependency, no CDN/network requirement |
