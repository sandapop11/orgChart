# OrgChart Embeddable Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing OrgChart app as a reusable library so any project can drop one JS + one CSS file into a page and call `OrgChart.render(divId, { data, settings })` to display an interactive org chart inside that div.

**Architecture:** Refactor the singleton `src/app.js` (an IIFE that boots immediately against a static HTML skeleton) into a factory `OrgChart.render(target, options)` that builds its own scoped DOM inside the target element via a new `src/dom.js`, wires listeners to those created elements, keeps per-instance state, and returns a `{ update, destroy, fit }` handle. All CSS moves from global `#id` selectors to `.oc-*` classes nested under an `.orgchart-root` wrapper. A dependency-free `build.js` concatenates `src/*.js` + vendor and `styles/*.css` into committed `dist/orgchart.js` / `dist/orgchart.css`. The standalone `index.html` becomes the first consumer of the same factory.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5-style `function`/`var`/`const`, IIFE modules), no framework, no bundler. Tests via Node's built-in `node --test` with `jsdom` (already in `node_modules`) for behavioral/DOM tests. Vendored `html-to-image` only third-party runtime dependency.

## Global Constraints

- No new runtime dependencies; no build framework/bundler. `build.js` is plain Node (`fs`/`path` only).
- No write-back / editing of org data (unchanged non-goal).
- Exactly one chart instance per page — page-level listeners (`window` resize, `document` keydown, matchMedia) stay global but are tracked so `destroy()` can remove them.
- Preserve the existing localStorage key: the standalone app passes `instanceId: 'v1'` so settings save to `orgchart.settings.v1` as today.
- `dist/` is committed to git (NOT gitignored) — it is the distributable artifact.
- Match existing code style: IIFE modules attaching to `window.OrgChart`, `function` expressions, no arrow functions in `src/` (tests may use arrows).
- Run tests from the repo root with `node --test` (auto-discovers `tests/*.test.js`). Do NOT use `node --test tests/` — it fails with `MODULE_NOT_FOUND` on this Windows box.
- `themes.css` is unchanged (already uses only `:root` / `[data-theme]` selectors, no ids).

## File Structure

- **Create** `src/dom.js` — builds the widget's DOM tree (`OrgChart.dom.build(opts)` → element map). One responsibility: DOM construction.
- **Rewrite** `src/app.js` — `OrgChart.render(target, options)` factory; state, event wiring, instance handle.
- **Modify** `src/settings.js` — key-parameterized `settingsStore.load(id)` / `save(id, settings)`.
- **Rewrite** `styles/app.css`, `styles/chart.css` — scope all selectors under `.orgchart-root`, `.oc-*` classes; drawers become `position: absolute` within the widget.
- **Rewrite** `index.html` — bare `#app-root` div + scripts + `OrgChart.render('app-root', { instanceId: 'v1' })`.
- **Create** `build.js` — concatenate to `dist/orgchart.js` / `dist/orgchart.css`.
- **Create** `dist/orgchart.js`, `dist/orgchart.css` — build output (committed).
- **Create** `tests/support.js` — jsdom helper `makeWindow(files, opts)` loading scripts into a real window.
- **Create** `tests/dom.test.js`, `tests/css.test.js`, `tests/settings.test.js`, `tests/library.test.js`, `tests/dist.test.js`.
- **Unchanged:** `src/dataAdapter.js`, `src/layout.js`, `src/render.js`, `src/interactions.js`, `src/search.js`, `src/export.js`, `styles/themes.css`, `data.js`, `vendor/html-to-image.min.js`, and existing `tests/{dataAdapter,layout,search}.test.js`.

---

### Task 1: jsdom test helper + DOM builder (`src/dom.js`)

**Files:**
- Create: `tests/support.js`
- Create: `src/dom.js`
- Test: `tests/dom.test.js`

**Interfaces:**
- Produces: `OrgChart.dom.build(options)` → element map `els` with keys: `root` (`.orgchart-root`), `toolbar` (or `null` when `options.showToolbar === false`), `searchInput`, `searchCount`, `deptFilter`, `btnFit`, `btnExport`, `btnPrint`, `btnSettings` (all `undefined` when no toolbar), `viewport`, `world`, `svg`, `status`, `detailsPanel`, `detailsBody`, `detailsClose`, `settingsDrawer`, `settingsBody`, `settingsClose`, `errorOverlay`, `errorMessage`, `btnRetry`.
- Produces: `tests/support.js` exports `makeWindow(files, opts)` → a JSDOM instance whose `window` has each file in `files` (paths relative to repo root) executed as a real `<script>`, plus `matchMedia`/`print` stubs. `opts.body` optional extra body HTML.

- [ ] **Step 1: Write `tests/support.js`**

```js
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

// Load each source file as a real <script> inside one jsdom window so that
// window.OrgChart.* become true globals (matching browser semantics, where
// src/app.js references bare `OrgChart`). Paths are relative to the repo root.
function makeWindow(files, opts) {
  opts = opts || {};
  const dom = new JSDOM(
    "<!doctype html><html><body>" + (opts.body || "") + "</body></html>",
    { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" }
  );
  const win = dom.window;
  win.matchMedia = win.matchMedia || function () {
    return { matches: false, addEventListener: function () {}, removeEventListener: function () {} };
  };
  win.print = win.print || function () {};
  for (const f of files) {
    const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    const s = win.document.createElement("script");
    s.textContent = code;
    win.document.body.appendChild(s);
  }
  return dom;
}

module.exports = { makeWindow };
```

- [ ] **Step 2: Write the failing test `tests/dom.test.js`**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeWindow } = require("./support.js");

test("dom.build creates a scoped root with toolbar and chart elements", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({ showToolbar: true });
  assert.ok(els.root.classList.contains("orgchart-root"));
  assert.ok(els.toolbar, "toolbar built");
  assert.ok(els.searchInput && els.deptFilter && els.btnSettings);
  assert.ok(els.viewport && els.world && els.svg && els.status);
  assert.ok(els.detailsPanel && els.detailsClose && els.settingsDrawer && els.errorOverlay);
  // root actually contains the pieces
  assert.ok(els.root.contains(els.viewport));
  assert.ok(els.root.contains(els.toolbar));
});

test("dom.build with showToolbar:false omits the toolbar but keeps the chart", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({ showToolbar: false });
  assert.equal(els.toolbar, null);
  assert.equal(els.searchInput, undefined);
  assert.ok(els.viewport && els.world && els.svg);
  assert.ok(els.detailsPanel, "details panel still built");
  assert.equal(els.root.querySelector(".oc-toolbar"), null);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `tests/dom.test.js` errors because `OrgChart.dom` is undefined (`src/dom.js` does not exist yet). Existing `dataAdapter`/`layout`/`search` tests still pass.

- [ ] **Step 4: Write `src/dom.js`**

```js
(function () {
  "use strict";

  function h(tag, attrs, kids) {
    var e = (tag === "svg")
      ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
      : document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (kids) {
      for (var i = 0; i < kids.length; i++) if (kids[i]) e.appendChild(kids[i]);
    }
    return e;
  }

  function build(options) {
    options = options || {};
    var showToolbar = options.showToolbar !== false;
    var els = {};

    var toolbar = null;
    if (showToolbar) {
      els.searchInput = h("input", { "class": "oc-search-input", type: "search",
        placeholder: "Search name, title, department…", autocomplete: "off" });
      els.searchCount = h("span", { "class": "oc-search-count" });
      els.deptFilter = h("select", { "class": "oc-dept-filter" },
        [ h("option", { value: "", text: "All departments" }) ]);
      els.btnFit = h("button", { "class": "oc-btn oc-btn-fit", title: "Fit chart to screen", text: "⤢ Fit" });
      els.btnExport = h("button", { "class": "oc-btn oc-btn-export", title: "Export as PNG", text: "⬇ Export" });
      els.btnPrint = h("button", { "class": "oc-btn oc-btn-print", title: "Print / save as PDF", text: "🖨" });
      els.btnSettings = h("button", { "class": "oc-btn oc-btn-settings", title: "Customize", text: "⚙" });
      toolbar = h("header", { "class": "oc-toolbar" }, [
        h("span", { "class": "oc-logo", text: "◈ OrgChart" }),
        els.searchInput, els.searchCount, els.deptFilter,
        h("span", { "class": "oc-spacer" }),
        els.btnFit, els.btnExport, els.btnPrint, els.btnSettings
      ]);
    }
    els.toolbar = toolbar;

    els.svg = h("svg", { "class": "oc-connectors", xmlns: "http://www.w3.org/2000/svg" });
    els.world = h("div", { "class": "oc-world" }, [els.svg]);
    els.status = h("div", { "class": "oc-status" });
    els.viewport = h("main", { "class": "oc-viewport" }, [els.world, els.status]);

    els.detailsBody = h("div", { "class": "oc-details-body" });
    els.detailsClose = h("button", { "class": "oc-close", text: "✕" });
    els.detailsPanel = h("aside", { "class": "oc-details", hidden: "" },
      [els.detailsClose, els.detailsBody]);

    els.settingsBody = h("div", { "class": "oc-settings-body" });
    els.settingsClose = h("button", { "class": "oc-close", text: "✕" });
    els.settingsDrawer = h("aside", { "class": "oc-settings-drawer", hidden: "" },
      [els.settingsClose, h("h2", { text: "Customize" }), els.settingsBody]);

    els.errorMessage = h("p", { "class": "oc-error-message" });
    els.btnRetry = h("button", { "class": "oc-btn-retry", text: "Retry" });
    els.errorOverlay = h("div", { "class": "oc-error-overlay", hidden: "" }, [
      h("div", { "class": "oc-error-box" }, [
        h("h2", { text: "Could not load data" }),
        els.errorMessage, els.btnRetry
      ])
    ]);

    els.root = h("div", { "class": "orgchart-root" },
      [toolbar, els.viewport, els.detailsPanel, els.settingsDrawer, els.errorOverlay]);
    return els;
  }

  var api = { build: build };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.dom = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test`
Expected: PASS — all tests including the two new `dom.test.js` tests.

- [ ] **Step 6: Commit**

```bash
git add tests/support.js src/dom.js tests/dom.test.js
git commit -m "feat: DOM builder module and jsdom test helper"
```

---

### Task 2: Scope CSS under `.orgchart-root`

**Files:**
- Rewrite: `styles/app.css`
- Rewrite: `styles/chart.css`
- Test: `tests/css.test.js`

**Interfaces:**
- Consumes: the `.oc-*` class names produced by `src/dom.js` (Task 1) and the `.card` / `.container-box` classes produced by `src/render.js` (unchanged).
- Produces: no JS API — a stylesheet where every rule is nested under `.orgchart-root` and drawers/overlay are `position: absolute` within the widget.

- [ ] **Step 1: Write the failing test `tests/css.test.js`**

```js
const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

function read(f) { return fs.readFileSync(path.join(__dirname, "..", f), "utf8"); }

test("app.css is scoped under .orgchart-root with no legacy id selectors", () => {
  const app = read("styles/app.css");
  assert.ok(app.includes(".orgchart-root"), "has root scope");
  assert.ok(!/#toolbar\b/.test(app), "no #toolbar");
  assert.ok(!/#viewport\b/.test(app), "no #viewport");
  assert.ok(!/#details-panel\b/.test(app), "no #details-panel");
  assert.ok(!/#settings-drawer\b/.test(app), "no #settings-drawer");
  assert.ok(!/#error-overlay\b/.test(app), "no #error-overlay");
});

test("chart.css is scoped and drops #connectors id selector", () => {
  const chart = read("styles/chart.css");
  assert.ok(chart.includes(".orgchart-root .card"), "cards scoped");
  assert.ok(chart.includes(".oc-connectors"), "connectors by class");
  assert.ok(!chart.includes("#connectors"), "no #connectors id");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — current `styles/app.css` contains `#toolbar` etc.

- [ ] **Step 3: Rewrite `styles/app.css`**

```css
.orgchart-root {
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; min-height: 0; overflow: hidden;
  font: 14px/1.45 system-ui, "Segoe UI", sans-serif;
  background: var(--bg); color: var(--text);
}
.orgchart-root, .orgchart-root *, .orgchart-root *::before, .orgchart-root *::after {
  box-sizing: border-box;
}

.orgchart-root .oc-toolbar {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  background: var(--toolbar-bg); color: var(--toolbar-text); flex: none;
}
.orgchart-root .oc-logo { font-weight: 700; margin-right: 8px; white-space: nowrap; }
.orgchart-root .oc-spacer { flex: 1; }
.orgchart-root .oc-toolbar input,
.orgchart-root .oc-toolbar select,
.orgchart-root .oc-toolbar button {
  color-scheme: dark;
  background: rgba(255, 255, 255, 0.08); color: inherit;
  border: 1px solid var(--toolbar-border); border-radius: 6px;
  padding: 5px 10px; font: inherit;
}
.orgchart-root .oc-toolbar select option { background: var(--toolbar-bg); color: var(--toolbar-text); }
.orgchart-root .oc-toolbar button { cursor: pointer; white-space: nowrap; }
.orgchart-root .oc-toolbar button:hover { background: rgba(255, 255, 255, 0.16); }
.orgchart-root .oc-search-input { width: 230px; }
.orgchart-root .oc-search-count { font-size: 12px; color: var(--text-muted); min-width: 48px; }

.orgchart-root .oc-viewport {
  flex: 1; position: relative; overflow: hidden; min-height: 0;
  background: radial-gradient(color-mix(in srgb, var(--wire) 35%, transparent) 1px,
    transparent 1px);
  background-size: 18px 18px; cursor: grab;
}
.orgchart-root .oc-viewport.panning { cursor: grabbing; }
.orgchart-root .oc-world { position: absolute; transform-origin: 0 0; }
.orgchart-root .oc-connectors { position: absolute; left: 0; top: 0; overflow: visible; }
.orgchart-root .oc-status {
  position: absolute; left: 12px; bottom: 10px; font-size: 12px;
  color: var(--text-muted); pointer-events: none;
}

.orgchart-root .oc-details,
.orgchart-root .oc-settings-drawer {
  position: absolute; top: 0; right: 0; bottom: 0; width: 300px;
  background: var(--surface); border-left: 1px solid var(--border);
  box-shadow: var(--shadow); padding: 16px; overflow-y: auto; z-index: 30;
}
.orgchart-root .oc-details[hidden],
.orgchart-root .oc-settings-drawer[hidden],
.orgchart-root .oc-error-overlay[hidden] { display: none; }
.orgchart-root .oc-close {
  position: absolute; top: 10px; right: 10px; border: none; background: none;
  font-size: 16px; cursor: pointer; color: var(--text-muted);
}

.orgchart-root .oc-error-overlay {
  position: absolute; inset: 0; background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.orgchart-root .oc-error-box {
  background: var(--surface); color: var(--text); border-radius: 12px;
  padding: 28px 36px; max-width: 420px; text-align: center; box-shadow: var(--shadow);
}
.orgchart-root .oc-error-box button {
  margin-top: 12px; padding: 8px 24px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface-2); color: inherit; font: inherit; cursor: pointer;
}

.orgchart-root .oc-details .avatar-lg {
  width: 72px; height: 72px; border-radius: 50%; object-fit: cover;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; margin: 12px auto 10px; background: var(--surface-2);
}
.orgchart-root .oc-details h3 { text-align: center; margin: 0 0 2px; }
.orgchart-root .oc-details .sub { text-align: center; color: var(--text-muted);
  font-size: 12.5px; margin-bottom: 14px; }
.orgchart-root .oc-details dl { margin: 0; }
.orgchart-root .oc-details dt { font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted);
  border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; }
.orgchart-root .oc-details dd { margin: 2px 0 0; font-size: 13.5px; }

.orgchart-root .oc-settings-drawer h2 { margin: 0 0 12px; font-size: 16px; }
.orgchart-root .oc-settings-drawer h3 { margin: 16px 0 4px; font-size: 13px; }
.orgchart-root .oc-settings-drawer .setting {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px;
}
.orgchart-root .oc-settings-drawer select,
.orgchart-root .oc-settings-drawer input[type="range"] { max-width: 140px; }
.orgchart-root .oc-settings-drawer button {
  margin-top: 14px; width: 100%; padding: 8px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2);
  color: inherit; font: inherit; cursor: pointer;
}

@media print {
  @page { size: landscape; margin: 8mm; }
  .orgchart-root .oc-toolbar,
  .orgchart-root .oc-details,
  .orgchart-root .oc-settings-drawer,
  .orgchart-root .oc-status,
  .orgchart-root .oc-error-overlay { display: none !important; }
  .orgchart-root { overflow: visible; height: auto; }
  .orgchart-root .oc-viewport { overflow: visible; background: none; }
  .orgchart-root .oc-world { position: static; transform-origin: 0 0; }
}
```

- [ ] **Step 4: Rewrite `styles/chart.css`**

```css
/* card sizes here MUST match OrgChart.layoutEngine.CARD_SIZES */
.orgchart-root .card {
  position: absolute; background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; box-shadow: var(--shadow); cursor: pointer;
  --accent: #6366f1;
}
.orgchart-root .card:hover { border-color: var(--accent); }
.orgchart-root .card--hit { outline: 3px solid var(--hit); outline-offset: 2px; }
.orgchart-root .card--selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }

.orgchart-root .card .avatar {
  border-radius: 50%; object-fit: cover; background: var(--surface-2);
  display: flex; align-items: center; justify-content: center; font-weight: 700;
}
.orgchart-root .card .name { font-weight: 600; font-size: 12px; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.orgchart-root .card .title { font-size: 10.5px; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.orgchart-root .card .badge { font-size: 9px; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--accent); }

/* portrait: 150x118 */
.orgchart-root .card--portrait { text-align: center; padding: 0 10px 8px; }
.orgchart-root .card--portrait .band { height: 26px; margin: 0 -10px;
  border-radius: 10px 10px 0 0; background: var(--accent); }
.orgchart-root .card--portrait .avatar { width: 48px; height: 48px; margin: -24px auto 4px;
  border: 3px solid var(--surface); font-size: 15px; }
.orgchart-root .card--portrait .badge { display: inline-block; margin-top: 2px; }

/* classic: 210x64 */
.orgchart-root .card--classic { display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  border-left: 4px solid var(--accent); }
.orgchart-root .card--classic .avatar { width: 44px; height: 44px; flex: none; font-size: 14px; }
.orgchart-root .card--classic .text { min-width: 0; }

/* compact: 170x44 */
.orgchart-root .card--compact { display: flex; align-items: center; gap: 8px; padding: 6px 8px; }
.orgchart-root .card--compact .avatar { width: 28px; height: 28px; border-radius: 6px; flex: none;
  font-size: 11px; }
.orgchart-root .card--compact .text { min-width: 0; }
.orgchart-root .card--compact .dot { width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); margin-left: auto; flex: none; }

.orgchart-root .container-box {
  position: absolute; border: 1.5px dashed var(--accent); border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  --accent: #6366f1;
}
.orgchart-root .container-box .label {
  position: absolute; top: -11px; left: 12px; background: var(--accent); color: #fff;
  font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 99px;
  cursor: pointer; user-select: none; white-space: nowrap;
}
.orgchart-root .container-box.collapsed {
  border-style: solid; border-radius: 99px; display: flex;
  align-items: center; justify-content: center; cursor: pointer;
}
.orgchart-root .container-box.collapsed .label { position: static; background: none;
  color: var(--accent); font-size: 12px; }

.orgchart-root .oc-connectors path { fill: none; stroke: var(--wire); stroke-width: 1.5;
  stroke-linejoin: round; }

.orgchart-root .hidden-el { display: none !important; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test`
Expected: PASS — `css.test.js` green, all others still green.

- [ ] **Step 6: Commit**

```bash
git add styles/app.css styles/chart.css tests/css.test.js
git commit -m "refactor: scope widget CSS under .orgchart-root"
```

---

### Task 3: Key-parameterized settings persistence

**Files:**
- Modify: `src/settings.js` (the `settingsStore` object, lines ~11-27; `settingsPanel` unchanged)
- Test: `tests/settings.test.js`

**Interfaces:**
- Consumes: `localStorage` (provided by jsdom in tests, browser at runtime).
- Produces: `OrgChart.settingsStore.load(instanceId)` → merged settings object; `OrgChart.settingsStore.save(instanceId, settings)` → void. Key is `"orgchart.settings." + (instanceId || "default")`. `settingsStore.DEFAULTS` unchanged.

- [ ] **Step 1: Write the failing test `tests/settings.test.js`**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeWindow } = require("./support.js");

test("settings persist independently per instanceId", () => {
  const store = makeWindow(["src/settings.js"]).window.OrgChart.settingsStore;
  const a = store.load("a"); a.cardStyle = "compact"; store.save("a", a);
  const b = store.load("b"); b.cardStyle = "classic"; store.save("b", b);
  assert.equal(store.load("a").cardStyle, "compact");
  assert.equal(store.load("b").cardStyle, "classic");
});

test("unknown instanceId returns defaults", () => {
  const store = makeWindow(["src/settings.js"]).window.OrgChart.settingsStore;
  assert.equal(store.load("never-saved").cardStyle, "portrait");
  assert.deepEqual(store.load("never-saved").deptColors, {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — current `load()`/`save()` ignore an id argument and share one fixed key, so `load("a")` and `load("b")` collide.

- [ ] **Step 3: Modify `src/settings.js`** — replace the `KEY` constant and the `settingsStore` object (currently lines ~4 and ~11-27) with:

```js
  function keyFor(instanceId) {
    return "orgchart.settings." + (instanceId || "default");
  }

  const settingsStore = {
    DEFAULTS: DEFAULTS,
    load: function (instanceId) {
      try {
        const raw = localStorage.getItem(keyFor(instanceId));
        if (!raw) return Object.assign({}, DEFAULTS, { deptColors: {} });
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULTS, parsed,
          { deptColors: Object.assign({}, parsed.deptColors) });
      } catch (e) {
        return Object.assign({}, DEFAULTS, { deptColors: {} });
      }
    },
    save: function (instanceId, settings) {
      try { localStorage.setItem(keyFor(instanceId), JSON.stringify(settings)); } catch (e) {}
    }
  };
```

Leave the `DEFAULTS` object, `settingsPanel`, and the `window.OrgChart` exports at the bottom unchanged. (The old `const KEY = "orgchart.settings.v1";` line is removed — replaced by `keyFor`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — `settings.test.js` green, all others still green.

- [ ] **Step 5: Commit**

```bash
git add src/settings.js tests/settings.test.js
git commit -m "refactor: key settings persistence by instanceId"
```

---

### Task 4: Factory refactor of `src/app.js` + behavioral tests

**Files:**
- Rewrite: `src/app.js` (entire file)
- Test: `tests/library.test.js`

**Interfaces:**
- Consumes: `OrgChart.dom.build` (Task 1), `OrgChart.settingsStore.load/save` (Task 3), and the unchanged `OrgChart.{dataAdapter,layoutEngine,renderer,interactions,searchModule,settingsPanel,exporter}` modules.
- Produces: `OrgChart.render(target, options)` → `{ update(newData), destroy(), fit() }`.
  - `target`: element id string, CSS selector string, or an `Element`.
  - `options`: `{ data?: Array, apiUrl?: string, settings?: object, instanceId?: string }`. `settings.showToolbar === false` builds no toolbar. `instanceId` defaults to the target's `id` attribute, else `"default"`.

- [ ] **Step 1: Write the failing test `tests/library.test.js`**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeWindow } = require("./support.js");

const SRC = [
  "src/dataAdapter.js", "src/layout.js", "src/render.js", "src/interactions.js",
  "src/search.js", "src/settings.js", "src/dom.js", "src/export.js", "src/app.js"
];
const DATA = [
  { id: 1, name: "Riya Shah (100)", title: "CEO" },
  { id: 50, name: "Sales", tags: "['group']", pid: 1 },
  { id: 2, name: "Alice Rai (101)", title: "Rep", pid: 50, DEPARTMENT_NAME: "Sales" },
  { id: 3, name: "Bob Lama (102)", title: "Rep", pid: 50, DEPARTMENT_NAME: "Sales" },
  { id: 60, name: "Factory", tags: "['group']", pid: 1 },
  { id: 4, name: "Chandra K (103)", title: "Worker", pid: 60, DEPARTMENT_NAME: "Factory" }
];
function tick(win) { return new Promise(function (r) { win.setTimeout(r, 0); }); }

async function mount(opts) {
  const dom = makeWindow(SRC, { body: '<div id="host"></div>' });
  const win = dom.window;
  const chart = win.OrgChart.render("host", Object.assign({ data: DATA, instanceId: "t" }, opts));
  await tick(win);
  return { win, chart, doc: win.document };
}

test("render mounts cards into a bare div", async () => {
  const { doc } = await mount();
  const cards = doc.querySelectorAll(".orgchart-root .card");
  assert.ok(cards.length >= 4, "root + 3 leaf members rendered, got " + cards.length);
  assert.ok(doc.querySelectorAll(".orgchart-root .container-box").length >= 2);
});

test("clicking a card opens the details panel", async () => {
  const { win, doc } = await mount();
  const card = doc.querySelector('.orgchart-root .card[data-card-id="2"]');
  card.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  const panel = doc.querySelector(".oc-details");
  assert.equal(panel.hidden, false);
  assert.ok(doc.querySelector(".oc-details-body h3").textContent.indexOf("Alice") !== -1);
});

test("clicking a container label collapses it", async () => {
  const { win, doc } = await mount();
  const before = doc.querySelectorAll(".orgchart-root .card").length;
  const label = doc.querySelector('.oc-world .container-box .label[data-toggle-id="50"]');
  label.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  const after = doc.querySelectorAll(".orgchart-root .card").length;
  assert.ok(after < before, "collapsing hides member cards");
  assert.ok(doc.querySelector(".container-box.collapsed"));
});

test("search highlights matching cards", async () => {
  const { win, doc } = await mount();
  const input = doc.querySelector(".oc-search-input");
  input.value = "Alice";
  input.dispatchEvent(new win.Event("input", { bubbles: true }));
  const hits = doc.querySelectorAll(".card--hit");
  assert.equal(hits.length, 1);
  assert.equal(doc.querySelector(".oc-search-count").textContent, "1 of 1");
});

test("department filter narrows to one container", async () => {
  const { win, doc } = await mount();
  const sel = doc.querySelector(".oc-dept-filter");
  sel.value = "60";
  sel.dispatchEvent(new win.Event("change", { bubbles: true }));
  const boxes = doc.querySelectorAll(".orgchart-root .container-box");
  assert.equal(boxes.length, 1);
  assert.ok(boxes[0].textContent.toUpperCase().indexOf("FACTORY") !== -1);
});

test("showToolbar:false renders chart with no toolbar but card click still works", async () => {
  const { win, doc } = await mount({ settings: { showToolbar: false } });
  assert.equal(doc.querySelector(".oc-toolbar"), null);
  assert.ok(doc.querySelectorAll(".orgchart-root .card").length >= 4);
  const card = doc.querySelector('.orgchart-root .card[data-card-id="2"]');
  card.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  assert.equal(doc.querySelector(".oc-details").hidden, false);
});

test("handle.update swaps data; handle.destroy empties the target", async () => {
  const { win, doc, chart } = await mount();
  chart.update([
    { id: 1, name: "New Boss", title: "CEO" },
    { id: 70, name: "Ops", tags: "['group']", pid: 1 },
    { id: 9, name: "Deepak T", title: "Analyst", pid: 70 }
  ]);
  await tick(win);
  assert.ok(doc.querySelector('.card[data-card-id="9"]'), "new data rendered");
  assert.equal(doc.querySelector('.card[data-card-id="2"]'), null, "old data gone");
  chart.destroy();
  assert.equal(doc.getElementById("host").children.length, 0, "target emptied");
  chart.destroy(); // idempotent, must not throw
});

test("render throws on a missing target", () => {
  const win = makeWindow(SRC).window;
  assert.throws(function () { win.OrgChart.render("nope", { data: DATA }); }, /target element not found/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `OrgChart.render` is not a function (current `app.js` is a self-booting IIFE, no `render` export). Note: the current `app.js` also calls `boot()` and `document.getElementById(...)` at load; once rewritten it must NOT run anything at load.

- [ ] **Step 3: Rewrite `src/app.js`** (entire file) with:

```js
(function () {
  "use strict";

  function resolveTarget(target) {
    if (target && target.nodeType === 1) return target;
    if (typeof target === "string") {
      return document.getElementById(target) || document.querySelector(target);
    }
    return null;
  }

  function render(target, options) {
    options = options || {};
    var host = resolveTarget(target);
    if (!host) throw new Error("OrgChart.render: target element not found: " + target);

    var showToolbar = !(options.settings && options.settings.showToolbar === false);
    var instanceId = options.instanceId || host.id || "default";

    var els = OrgChart.dom.build({ showToolbar: showToolbar });
    host.appendChild(els.root);

    var state = {
      adapted: null, settings: null, collapsed: new Set(), selectedId: null,
      searchQuery: "", matches: [], matchIndex: 0, filterDept: null,
      controller: null, fitted: false, layout: null
    };

    var listeners = [];
    function on(t, type, fn, opts) {
      t.addEventListener(type, fn, opts);
      listeners.push({ target: t, type: type, fn: fn });
    }

    function prefersDark() {
      return typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function applyTheme() {
      var pref = state.settings.theme;
      var dark = pref === "dark" || (pref === "system" && prefersDark());
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }
    var mq = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq && mq.addEventListener) {
      var onScheme = function () { if (state.adapted) applyTheme(); };
      mq.addEventListener("change", onScheme);
      listeners.push({ target: mq, type: "change", fn: onScheme });
    }

    async function loadData() {
      if (options.apiUrl) {
        try {
          var res = await fetch(options.apiUrl);
          if (!res.ok) throw new Error("HTTP " + res.status);
          var json = await res.json();
          if (!json || !Array.isArray(json.items)) throw new Error("unexpected JSON shape");
          return json.items;
        } catch (err) {
          console.warn("[orgchart] API load failed (" + err.message + "), falling back");
          if (Array.isArray(options.data)) return options.data;
          if (window.maps && Array.isArray(window.maps.items)) return window.maps.items;
          throw err;
        }
      }
      if (Array.isArray(options.data)) return options.data;
      if (window.maps && Array.isArray(window.maps.items)) return window.maps.items;
      throw new Error("No data source: pass options.data or options.apiUrl");
    }

    function showError(err) {
      els.errorMessage.textContent = String(err.message || err);
      els.errorOverlay.hidden = false;
    }

    function rebuildDeptOptions() {
      if (!els.deptFilter) return;
      while (els.deptFilter.options.length > 1) els.deptFilter.remove(1);
      for (var i = 0; i < state.adapted.departments.length; i++) {
        var d = state.adapted.departments[i];
        var opt = document.createElement("option");
        opt.value = d.id; opt.textContent = d.displayName;
        els.deptFilter.appendChild(opt);
      }
    }

    function update() {
      var a = state.adapted;
      var layoutSettings = Object.assign({}, state.settings, {
        viewportWidth: els.viewport.clientWidth,
        viewportHeight: els.viewport.clientHeight,
        filterDepartmentId: state.filterDept
      });
      state.layout = OrgChart.layoutEngine.compute(a.root, layoutSettings, state.collapsed);
      OrgChart.renderer.render(state.layout, a, state.settings,
        { world: els.world, svg: els.svg });
      els.status.textContent = "Loaded " +
        (a.nodesById.size - a.departments.length - 1) + " employees · " +
        a.departments.length + " departments" +
        (a.warnings.length ? " · " + a.warnings.length + " data warnings (see console)" : "");
      if (!state.fitted) { state.controller.fit(state.layout); state.fitted = true; }
      markSelected();
      applySearchHighlight();
    }

    function reportingPath(node) {
      var parts = [];
      var cur = node;
      while (cur && cur.pid !== null) {
        cur = state.adapted.nodesById.get(cur.pid);
        if (cur) parts.push(cur.displayName);
      }
      return parts.join(" → ") || "—";
    }

    function makeInitialsLg(node) {
      var R = OrgChart.renderer;
      var d = document.createElement("div");
      d.className = "avatar-lg";
      d.textContent = R.initials(node.displayName);
      d.style.background = R.avatarColor(node.displayName);
      return d;
    }

    function openDetails(id) {
      var node = state.adapted.nodesById.get(id);
      if (!node) return;
      state.selectedId = id;
      var body = els.detailsBody;
      body.innerHTML = "";

      var avatar;
      if (node.img) {
        avatar = document.createElement("img");
        avatar.src = node.img; avatar.alt = "";
        avatar.addEventListener("error", function () { avatar.replaceWith(makeInitialsLg(node)); });
      } else {
        avatar = makeInitialsLg(node);
      }
      avatar.classList.add("avatar-lg");
      body.appendChild(avatar);

      var h3 = document.createElement("h3");
      h3.textContent = node.displayName; body.appendChild(h3);
      var sub = document.createElement("div");
      sub.className = "sub"; sub.textContent = node.title; body.appendChild(sub);

      var dl = document.createElement("dl");
      var fields = [
        ["Department", node.department || "—"],
        ["Employee #", node.employeeNo || "—"],
        ["Reports to", reportingPath(node)],
        ["Tags", node.tags.filter(function (t) { return t !== "group"; }).join(", ") || "—"]
      ];
      for (var i = 0; i < fields.length; i++) {
        var dt = document.createElement("dt"); dt.textContent = fields[i][0];
        var dd = document.createElement("dd"); dd.textContent = fields[i][1];
        dl.appendChild(dt); dl.appendChild(dd);
      }
      body.appendChild(dl);

      els.detailsPanel.hidden = false;
      markSelected();
    }

    function closeDetails() {
      state.selectedId = null;
      els.detailsPanel.hidden = true;
      markSelected();
    }

    function markSelected() {
      var sel = els.world.querySelectorAll(".card--selected");
      for (var i = 0; i < sel.length; i++) sel[i].classList.remove("card--selected");
      if (state.selectedId) {
        var elc = els.world.querySelector('[data-card-id="' + state.selectedId + '"]');
        if (elc) elc.classList.add("card--selected");
      }
    }

    function expandAncestorsOf(ids) {
      for (var i = 0; i < ids.length; i++) {
        var cur = state.adapted.nodesById.get(ids[i]);
        while (cur && cur.pid !== null) {
          cur = state.adapted.nodesById.get(cur.pid);
          if (cur) state.collapsed.delete(cur.id);
        }
      }
    }

    function applySearchHighlight() {
      var hits = els.world.querySelectorAll(".card--hit");
      for (var i = 0; i < hits.length; i++) hits[i].classList.remove("card--hit");
      for (var j = 0; j < state.matches.length; j++) {
        var elc = els.world.querySelector('[data-card-id="' + state.matches[j] + '"]');
        if (elc) elc.classList.add("card--hit");
      }
      if (els.searchCount) {
        els.searchCount.textContent = state.matches.length
          ? (state.matchIndex + 1) + " of " + state.matches.length
          : (state.searchQuery.trim() ? "0 of 0" : "");
      }
    }

    function goToMatch() {
      var id = state.matches[state.matchIndex];
      if (!id) return;
      var item = state.layout.cards.find(function (c) { return c.node.id === id; });
      if (item) state.controller.centerOn(item);
    }

    function runSearch(query) {
      state.searchQuery = query;
      state.matches = OrgChart.searchModule.match(state.adapted.nodesById, query);
      state.matchIndex = 0;
      expandAncestorsOf(state.matches);
      update();
      goToMatch();
    }

    function ingest(items) {
      state.adapted = OrgChart.dataAdapter.adapt(items);
      state.adapted.warnings.forEach(function (w) { console.warn("[orgchart]", w); });
      rebuildDeptOptions();
    }

    async function boot() {
      els.errorOverlay.hidden = true;
      state.settings = OrgChart.settingsStore.load(instanceId);
      if (options.settings) Object.assign(state.settings, options.settings);
      applyTheme();
      if (!state.controller) {
        state.controller = OrgChart.interactions.init({
          viewport: els.viewport, world: els.world,
          onCardClick: openDetails,
          onToggleContainer: function (id) {
            if (state.collapsed.has(id)) state.collapsed.delete(id);
            else state.collapsed.add(id);
            update();
          }
        });
      }
      try {
        var items = await loadData();
        ingest(items);
        if (els.settingsBody) {
          OrgChart.settingsPanel.init(els.settingsBody, state.settings,
            state.adapted.departments, function (s) {
              OrgChart.settingsStore.save(instanceId, s);
              applyTheme();
              update();
            });
        }
        update();
      } catch (err) {
        showError(err);
      }
    }

    // --- event wiring (toolbar controls guarded for showToolbar:false) ---
    on(els.btnRetry, "click", boot);
    on(els.detailsClose, "click", closeDetails);
    on(els.settingsClose, "click", function () { els.settingsDrawer.hidden = true; });
    on(document, "keydown", function (e) {
      if (e.key === "Escape") { closeDetails(); els.settingsDrawer.hidden = true; }
    });
    if (els.btnFit) on(els.btnFit, "click", function () {
      if (state.layout) state.controller.fit(state.layout);
    });
    if (els.searchInput) {
      on(els.searchInput, "input", function (e) { runSearch(e.target.value); });
      on(els.searchInput, "keydown", function (e) {
        if (e.key === "Enter" && state.matches.length) {
          state.matchIndex = (state.matchIndex + 1) % state.matches.length;
          applySearchHighlight(); goToMatch();
        }
      });
    }
    if (els.deptFilter) on(els.deptFilter, "change", function (e) {
      state.filterDept = e.target.value || null;
      state.fitted = false;
      update();
    });
    if (els.btnSettings) on(els.btnSettings, "click", function () {
      els.settingsDrawer.hidden = !els.settingsDrawer.hidden;
    });
    if (els.btnExport) on(els.btnExport, "click", function () {
      OrgChart.exporter.exportPng(els.world, state.layout);
    });
    if (els.btnPrint) on(els.btnPrint, "click", function () { window.print(); });
    on(window, "beforeprint", function () {
      OrgChart.exporter.preparePrint(els.world, state.layout);
    });
    on(window, "afterprint", function () {
      OrgChart.exporter.restoreAfterPrint(els.world);
    });
    on(window, "resize", function () { if (state.adapted) update(); });

    boot();

    return {
      update: function (newData) {
        ingest(newData);
        update();
      },
      fit: function () { if (state.layout) state.controller.fit(state.layout); },
      destroy: function () {
        for (var i = 0; i < listeners.length; i++) {
          var L = listeners[i];
          if (L.target && L.target.removeEventListener) {
            L.target.removeEventListener(L.type, L.fn);
          }
        }
        listeners.length = 0;
        if (els.root.parentNode) els.root.parentNode.removeChild(els.root);
      }
    };
  }

  window.OrgChart = window.OrgChart || {};
  window.OrgChart.render = render;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — all `library.test.js` tests plus all earlier tests.

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/library.test.js
git commit -m "feat: OrgChart.render factory with instance handle"
```

---

### Task 5: Migrate `index.html` to the factory

**Files:**
- Rewrite: `index.html`
- Test: `tests/library.test.js` (add one test replicating the standalone `data.js` path)

**Interfaces:**
- Consumes: `OrgChart.render` (Task 4), `window.maps` from `data.js` (the fallback data source).
- Produces: a standalone page that mounts into `#app-root` with `instanceId: 'v1'` (preserving the existing localStorage key).

- [ ] **Step 1: Add the failing test** — append to `tests/library.test.js`:

```js
test("standalone path: window.maps + render('app-root') renders", async () => {
  const files = ["data.js"].concat(SRC);
  const dom = makeWindow(files, { body: '<div id="app-root"></div>' });
  const win = dom.window;
  assert.ok(win.maps && Array.isArray(win.maps.items), "data.js defines window.maps.items");
  win.OrgChart.render("app-root", { instanceId: "v1" });
  await tick(win);
  assert.ok(win.document.querySelectorAll(".orgchart-root .card").length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `node --test`
Expected: This test should already PASS if `data.js` defines `window.maps.items` and the factory works — it verifies the exact standalone code path before we touch `index.html`. If it fails, fix the factory before proceeding. (`index.html` itself is verified by the browser check at the end.)

- [ ] **Step 3: Rewrite `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Org Chart</title>
<link rel="stylesheet" href="styles/themes.css">
<link rel="stylesheet" href="styles/app.css">
<link rel="stylesheet" href="styles/chart.css">
<style>
  html, body { height: 100%; margin: 0; }
  #app-root { height: 100%; }
</style>
</head>
<body>
<div id="app-root"></div>

<script src="data.js"></script>
<script src="src/dataAdapter.js"></script>
<script src="src/layout.js"></script>
<script src="src/render.js"></script>
<script src="src/interactions.js"></script>
<script src="src/search.js"></script>
<script src="src/settings.js"></script>
<script src="src/dom.js"></script>
<script src="vendor/html-to-image.min.js"></script>
<script src="src/export.js"></script>
<script src="src/app.js"></script>
<script>OrgChart.render('app-root', { instanceId: 'v1' });</script>
</body>
</html>
```

- [ ] **Step 4: Run tests + verify index.html structure**

Run: `node --test`
Expected: PASS — including the new standalone-path test.

Then manually confirm `index.html` contains `OrgChart.render('app-root'` and `src/dom.js`, and no longer contains `id="toolbar"`:

Run: `grep -c "OrgChart.render('app-root'" index.html && grep -c "src/dom.js" index.html && ! grep -q 'id="toolbar"' index.html && echo OK`
Expected: prints `1`, `1`, then `OK`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/library.test.js
git commit -m "refactor: index.html mounts via OrgChart.render"
```

---

### Task 6: Build script + committed `dist/` + bundle smoke test

**Files:**
- Create: `build.js`
- Create: `dist/orgchart.js`, `dist/orgchart.css` (generated, committed)
- Test: `tests/dist.test.js`

**Interfaces:**
- Consumes: all `src/*.js`, `vendor/html-to-image.min.js`, `styles/*.css`.
- Produces: `dist/orgchart.js` (exposes `OrgChart.render`) and `dist/orgchart.css` (scoped `.orgchart-root` styles). `node build.js` regenerates both fully.

**Note on order:** `vendor/html-to-image.min.js` is concatenated **last**. Nothing references `htmlToImage` at load time (`src/export.js` only touches `window.htmlToImage` inside `exportPng`), so putting the large third-party blob last guarantees `OrgChart.render` is defined even if the vendor script has any load-time quirk, and keeps the bundle resilient.

- [ ] **Step 1: Write `build.js`**

```js
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");

// src first (so OrgChart.render is defined regardless of vendor), vendor last.
const JS_FILES = [
  "src/dataAdapter.js", "src/layout.js", "src/render.js", "src/interactions.js",
  "src/search.js", "src/settings.js", "src/dom.js", "src/export.js", "src/app.js",
  "vendor/html-to-image.min.js"
];
const CSS_FILES = ["styles/themes.css", "styles/app.css", "styles/chart.css"];

const JS_BANNER =
"/*!\n" +
" * orgchart.js - bundled build. DO NOT EDIT.\n" +
" * Auto-generated by build.js from src/ + vendor/. Re-run: node build.js\n" +
" *\n" +
" * Usage:\n" +
" *   <div id=\"chart\" style=\"height:600px\"></div>\n" +
" *   <link rel=\"stylesheet\" href=\"orgchart.css\">\n" +
" *   <script src=\"orgchart.js\"></script>\n" +
" *   <script>\n" +
" *     var chart = OrgChart.render('chart', { data: [ /* items */ ] });\n" +
" *     // chart.update(newData); chart.fit(); chart.destroy();\n" +
" *   </script>\n" +
" */\n";

const CSS_BANNER =
"/*!\n" +
" * orgchart.css - bundled build. DO NOT EDIT.\n" +
" * Auto-generated by build.js from styles/. Re-run: node build.js\n" +
" */\n";

function concat(files) {
  return files.map(function (f) {
    return "/* ==== " + f + " ==== */\n" + fs.readFileSync(path.join(ROOT, f), "utf8");
  }).join("\n");
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "orgchart.js"), JS_BANNER + "\n" + concat(JS_FILES) + "\n", "utf8");
fs.writeFileSync(path.join(OUT, "orgchart.css"), CSS_BANNER + "\n" + concat(CSS_FILES) + "\n", "utf8");
console.log("Built dist/orgchart.js and dist/orgchart.css");
```

- [ ] **Step 2: Run the build**

Run: `node build.js`
Expected: prints `Built dist/orgchart.js and dist/orgchart.css`; both files now exist.

- [ ] **Step 3: Write the failing test `tests/dist.test.js`**

```js
const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeWindow } = require("./support.js");

function tick(win) { return new Promise(function (r) { win.setTimeout(r, 0); }); }

test("dist/orgchart.js mounts a chart from the bundle alone", async () => {
  assert.ok(fs.existsSync(path.join(__dirname, "..", "dist", "orgchart.js")),
    "run `node build.js` first");
  const dom = makeWindow(["dist/orgchart.js"], { body: '<div id="d"></div>' });
  const win = dom.window;
  assert.equal(typeof win.OrgChart.render, "function");
  const chart = win.OrgChart.render("d", { instanceId: "smoke", data: [
    { id: 1, name: "CEO", title: "Chief" },
    { id: 50, name: "Sales", tags: "['group']", pid: 1 },
    { id: 2, name: "Alice", title: "Rep", pid: 50 }
  ] });
  await tick(win);
  assert.ok(win.document.querySelectorAll(".orgchart-root .card").length >= 2);
  chart.destroy();
});

test("dist/orgchart.css is scoped with no legacy id selectors", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "dist", "orgchart.css"), "utf8");
  assert.ok(css.includes(".orgchart-root"));
  assert.ok(!/#toolbar\b/.test(css));
  assert.ok(!/#viewport\b/.test(css));
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — `dist.test.js` green, all others green. (If the vendor blob errors under jsdom despite being last, the src portion still defines `OrgChart.render`; investigate only if the smoke test fails.)

- [ ] **Step 5: Commit**

```bash
git add build.js dist/orgchart.js dist/orgchart.css tests/dist.test.js
git commit -m "feat: build.js bundling src+styles into committed dist/"
```

---

### Task 7: Full-suite verification + browser confirmation

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `node --test`
Expected: all suites pass — `dataAdapter`, `layout`, `search` (pre-existing), plus `dom`, `css`, `settings`, `library`, `dist`. Note the count of passing tests.

- [ ] **Step 2: Confirm the standalone app still opens**

Open `index.html` in a browser (`file://` is fine). Confirm: the chart renders, pan/zoom works, a card click opens the details panel (now anchored within the widget, not the full page), the settings gear opens the drawer and its close button works, search highlights/cycles, the department filter narrows the view, and PNG export + print still function. Confirm saved settings persist across reload (the `orgchart.settings.v1` key is reused).

- [ ] **Step 3: Confirm the embeddable bundle works from a bare div** — create a throwaway `dist/demo.html` (do not commit) to exercise the real shipped artifact:

```html
<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="orgchart.css">
<div id="chart" style="height: 90vh; border: 1px solid #ccc"></div>
<script src="orgchart.js"></script>
<script src="../data.js"></script>
<script>
  var chart = OrgChart.render('chart', { instanceId: 'demo', data: window.maps.items });
  // sanity: chart.fit(); chart.update(window.maps.items); chart.destroy();
</script>
</script>
```

Open `dist/demo.html` in a browser. Confirm the chart renders inside the bordered div, the toolbar/drawers stay within that div's bounds (not overlaying the whole page), and interactions work. Then delete `dist/demo.html`.

- [ ] **Step 4: Report results** — state the passing test count and the outcome of the browser checks. Per this project's verification standard, do NOT claim "done" on green tests alone; the browser confirmation in Steps 2-3 is required before completion. If any check fails, use systematic-debugging before declaring completion.

---

## Self-Review

**Spec coverage:**
- Public API `OrgChart.render(target, {data, apiUrl, settings, instanceId})` → Task 4. ✓
- `target` accepts id/selector/Element → Task 4 `resolveTarget`. ✓
- `data` and `apiUrl` both supported, with fallback chain → Task 4 `loadData`. ✓
- `settings.showToolbar` default true, `false` skips toolbar → Tasks 1 (DOM) + 4 (wiring). ✓
- `instanceId` defaults to target id / `"default"` → Task 4. ✓
- Instance handle `{ update, destroy, fit }` → Task 4. ✓
- Singleton IIFE → factory, private state, listener teardown → Task 4. ✓
- CSS/DOM scoping under `.orgchart-root`, `.oc-*` → Tasks 1-2. ✓ (Spec's mention of keeping drawers as-is is superseded by making them `position: absolute` within the widget — a documented improvement required so embedded drawers don't cover the whole host page; noted in Task 2.)
- Settings persistence keyed `orgchart.settings.<instanceId>` → Task 3. ✓
- `index.html` migrated, preserves `v1` key → Task 5. ✓
- `build.js` → `dist/orgchart.js` + `dist/orgchart.css`, committed, full regeneration, banner → Task 6. ✓
- Testing: jsdom harness mounting into a bare div + dist smoke test → Tasks 4 + 6; browser confirmation → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type/name consistency:** `OrgChart.dom.build` (Task 1) called in Task 4; element-map keys used in Task 4 (`els.searchInput`, `els.deptFilter`, `els.detailsBody`, etc.) match Task 1's produced keys; `settingsStore.load(id)`/`save(id, settings)` (Task 3) called in Task 4; `.oc-*` classes in CSS (Task 2) match those built in Task 1 and queried in tests (Task 4/6). ✓

**Deviation noted:** vendor concatenated last (Task 6) vs. spec's "vendor + src" ordering — justified inline (load-time resilience; `htmlToImage` used lazily).
