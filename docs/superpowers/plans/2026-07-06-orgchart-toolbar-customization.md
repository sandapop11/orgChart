# OrgChart Toolbar Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let embedders hide the Fit/Export/Print/Settings toolbar buttons individually and replace the "◈ OrgChart" logo text with their own brand, via five new `options.settings` fields.

**Architecture:** Extend `src/dom.js`'s `build()` with five new params (four button-visibility booleans + `logoText`), each defaulting the same way `showToolbar` already does (`!== false` / `|| default`). Extend `src/app.js` to read these from `options.settings` and pass them through to `dom.build()`. No other module changes — existing null-guarded event wiring in `app.js` already handles buttons that don't exist.

**Tech Stack:** Vanilla JS (no framework, no build tooling beyond the repo's own `build.js`), `node --test` + jsdom for tests.

## Global Constraints

- All five new fields (`showFitButton`, `showExportButton`, `showPrintButton`, `showSettingsButton`, `logoText`) are boot-time only: read once from `options.settings` at mount, never added to `settingsStore.DEFAULTS`, never persisted to `localStorage`, never exposed as a control in the settings drawer.
- `logoText` default is exactly `"◈ OrgChart"` (matches current hardcoded text) and replaces the logo span's text verbatim, icon included.
- Button flags default to `true` (shown) when omitted, consistent with `showToolbar`'s existing `!== false` convention.
- Per-button flags only affect the four action buttons (Fit, Export, Print, Settings) — search box and department filter are explicitly out of scope, unaffected.
- Run `node build.js` to refresh `dist/orgchart.js`/`dist/orgchart.css` after any `src/` change — dist is not auto-built.

---

### Task 1: `dom.js` — per-button visibility flags and custom logo text

**Files:**
- Modify: `src/dom.js:20-43` (the `build()` function's toolbar-construction block)
- Test: `tests/dom.test.js`

**Interfaces:**
- Consumes: nothing new from other modules.
- Produces: `OrgChart.dom.build(options)` now also accepts `options.showFitButton`, `options.showExportButton`, `options.showPrintButton`, `options.showSettingsButton` (each `boolean`, default `true` via `!== false`), and `options.logoText` (`string`, default `"◈ OrgChart"`). When a button flag is `false`, the corresponding `els.btnFit` / `els.btnExport` / `els.btnPrint` / `els.btnSettings` is `undefined` (never constructed) instead of an `Element` — this is the exact contract `src/app.js`'s existing `if (els.btnFit) on(...)`-style guards already rely on.

- [ ] **Step 1: Write the failing tests**

Add to `tests/dom.test.js`:

```js
test("dom.build omits individual toolbar buttons when their flag is false", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({
    showToolbar: true, showFitButton: false, showExportButton: false,
    showPrintButton: false, showSettingsButton: false
  });
  assert.equal(els.btnFit, undefined);
  assert.equal(els.btnExport, undefined);
  assert.equal(els.btnPrint, undefined);
  assert.equal(els.btnSettings, undefined);
  assert.equal(els.toolbar.querySelector(".oc-btn"), null,
    "no action buttons should remain in the toolbar DOM");
  assert.ok(els.searchInput && els.deptFilter,
    "search box and department filter are unaffected by these flags");
});

test("dom.build shows all four buttons by default when flags are omitted", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({ showToolbar: true });
  assert.ok(els.btnFit && els.btnExport && els.btnPrint && els.btnSettings);
});

test("dom.build uses a custom logoText verbatim", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({ showToolbar: true, logoText: "★ Acme Corp" });
  assert.equal(els.toolbar.querySelector(".oc-logo").textContent, "★ Acme Corp");
});

test("dom.build defaults logoText to the original OrgChart branding", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({ showToolbar: true });
  assert.equal(els.toolbar.querySelector(".oc-logo").textContent, "◈ OrgChart");
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test tests/dom.test.js`
Expected: the four new tests FAIL (e.g. `els.btnFit` is an `Element`, not `undefined`; logo text assertions may pass already since the default hasn't changed yet — the button-omission tests are the ones that must fail here).

- [ ] **Step 3: Implement in `src/dom.js`**

Replace the toolbar-construction block (currently `src/dom.js:20-43`) with:

```js
  function build(options) {
    options = options || {};
    var showToolbar = options.showToolbar !== false;
    var showFitButton = options.showFitButton !== false;
    var showExportButton = options.showExportButton !== false;
    var showPrintButton = options.showPrintButton !== false;
    var showSettingsButton = options.showSettingsButton !== false;
    var logoText = options.logoText || "◈ OrgChart";
    var els = {};

    var toolbar = null;
    if (showToolbar) {
      els.searchInput = h("input", { "class": "oc-search-input", type: "search",
        placeholder: "Search name, title, department…", autocomplete: "off" });
      els.searchCount = h("span", { "class": "oc-search-count" });
      els.deptFilter = h("select", { "class": "oc-dept-filter" },
        [ h("option", { value: "", text: "All departments" }) ]);
      if (showFitButton) {
        els.btnFit = h("button", { type: "button", "class": "oc-btn oc-btn-fit", title: "Fit chart to screen", text: "⤢ Fit" });
      }
      if (showExportButton) {
        els.btnExport = h("button", { type: "button", "class": "oc-btn oc-btn-export", title: "Export as PNG", text: "⬇ Export" });
      }
      if (showPrintButton) {
        els.btnPrint = h("button", { type: "button", "class": "oc-btn oc-btn-print", title: "Print / save as PDF", text: "🖨" });
      }
      if (showSettingsButton) {
        els.btnSettings = h("button", { type: "button", "class": "oc-btn oc-btn-settings", title: "Customize", text: "⚙" });
      }
      toolbar = h("header", { "class": "oc-toolbar" }, [
        h("span", { "class": "oc-logo", text: logoText }),
        els.searchInput, els.searchCount, els.deptFilter,
        h("span", { "class": "oc-spacer" }),
        els.btnFit, els.btnExport, els.btnPrint, els.btnSettings
      ]);
    }
    els.toolbar = toolbar;
```

(No change needed to the `h()` helper — it already skips falsy entries in its `kids` array via `if (kids[i]) e.appendChild(kids[i])`, so `undefined` buttons are simply omitted.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/dom.test.js`
Expected: PASS (all tests in the file, including the 4 new ones and the 3 pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/dom.js tests/dom.test.js
git commit -m "feat: add per-button toolbar visibility and custom logo text to dom.build"
```

---

### Task 2: `app.js` — wire the new settings through to `dom.build`

**Files:**
- Modify: `src/app.js:12-20` (target resolution / `dom.build` call inside `render()`)
- Test: `tests/library.test.js`

**Interfaces:**
- Consumes: `OrgChart.dom.build(options)`'s new params from Task 1 (`showFitButton`, `showExportButton`, `showPrintButton`, `showSettingsButton`, `logoText`).
- Produces: `OrgChart.render(target, options)` now reads `options.settings.showFitButton`, `options.settings.showExportButton`, `options.settings.showPrintButton`, `options.settings.showSettingsButton` (each boolean, default `true`), and `options.settings.logoText` (string, default `"◈ OrgChart"`) — same precedence/read pattern as the existing `options.settings.showToolbar`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/library.test.js` (uses the existing `mount(opts)` helper already defined in that file):

```js
test("individual toolbar buttons can be hidden while others remain", async () => {
  const { doc } = await mount({ settings: { showFitButton: false, showPrintButton: false } });
  assert.equal(doc.querySelector(".oc-btn-fit"), null);
  assert.equal(doc.querySelector(".oc-btn-print"), null);
  assert.ok(doc.querySelector(".oc-btn-export"), "export button still present");
  assert.ok(doc.querySelector(".oc-btn-settings"), "settings button still present");
});

test("custom logoText replaces the default toolbar branding", async () => {
  const { doc } = await mount({ settings: { logoText: "★ Acme Corp" } });
  assert.equal(doc.querySelector(".oc-logo").textContent, "★ Acme Corp");
});

test("button flags and logoText default to shown/original when settings is omitted", async () => {
  const { doc } = await mount();
  assert.ok(doc.querySelector(".oc-btn-fit") && doc.querySelector(".oc-btn-export") &&
    doc.querySelector(".oc-btn-print") && doc.querySelector(".oc-btn-settings"));
  assert.equal(doc.querySelector(".oc-logo").textContent, "◈ OrgChart");
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test tests/library.test.js`
Expected: FAIL on the two new toggle/logo-text tests (`.oc-btn-fit` etc. present regardless of the flag; `.oc-logo` still reads the hardcoded default even when `logoText` was passed) — the third test should already pass since it only checks today's existing default behavior.

- [ ] **Step 3: Implement in `src/app.js`**

Replace the two lines currently at `src/app.js:17-20`:

```js
    var showToolbar = !(options.settings && options.settings.showToolbar === false);
    var instanceId = options.instanceId || host.id || "default";

    var els = OrgChart.dom.build({ showToolbar: showToolbar });
```

with:

```js
    var optSettings = options.settings || {};
    var showToolbar = optSettings.showToolbar !== false;
    var showFitButton = optSettings.showFitButton !== false;
    var showExportButton = optSettings.showExportButton !== false;
    var showPrintButton = optSettings.showPrintButton !== false;
    var showSettingsButton = optSettings.showSettingsButton !== false;
    var logoText = optSettings.logoText || "◈ OrgChart";
    var instanceId = options.instanceId || host.id || "default";

    var els = OrgChart.dom.build({
      showToolbar: showToolbar,
      showFitButton: showFitButton,
      showExportButton: showExportButton,
      showPrintButton: showPrintButton,
      showSettingsButton: showSettingsButton,
      logoText: logoText
    });
```

(`optSettings` is a locally-scoped variable, distinct from `state.settings` used later in `boot()` — this block runs before `state.settings` exists, at the top of `render()` where target/toolbar are resolved. Naming it differently avoids any confusion with the persisted-settings object assigned later.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/library.test.js`
Expected: PASS (all tests in the file, including the 3 new ones).

- [ ] **Step 5: Run the full test suite**

Run: `node --test`
Expected: PASS across every file in `tests/` (dataAdapter, layout, search, dom, css, settings, library, dist — `dist.test.js` still reads the pre-Task-3 `dist/orgchart.js`, so it exercises old behavior only; that's expected until Task 3 rebuilds it).

- [ ] **Step 6: Commit**

```bash
git add src/app.js tests/library.test.js
git commit -m "feat: read per-button toolbar visibility and logoText from options.settings"
```

---

### Task 3: Rebuild `dist/` and confirm the shipped bundle picks up the change

**Files:**
- Modify (generated): `dist/orgchart.js`, `dist/orgchart.css`
- No test file changes — `tests/dist.test.js` already exists and exercises `dist/orgchart.js` end-to-end.

**Interfaces:**
- Consumes: `src/dom.js` and `src/app.js` from Tasks 1–2 (already committed).
- Produces: a rebuilt `dist/orgchart.js` that contains the new `dom.js`/`app.js` source, so `dist/orgchart.js`'s `OrgChart.render` behaves identically to `src/app.js`'s.

- [ ] **Step 1: Rebuild**

Run: `node build.js`
Expected output: `Built dist/orgchart.js and dist/orgchart.css`

- [ ] **Step 2: Run the dist smoke tests**

Run: `node --test tests/dist.test.js`
Expected: PASS (both existing tests — bundle mounts a chart, CSS is scoped with no legacy id selectors).

- [ ] **Step 3: Run the full test suite one more time**

Run: `node --test`
Expected: PASS across all files.

- [ ] **Step 4: Commit**

```bash
git add dist/orgchart.js dist/orgchart.css
git commit -m "chore: rebuild dist/ with toolbar button toggles and logoText support"
```

---

### Task 4: Update `README.md`

**Files:**
- Modify: `README.md` (the "Settings reference" table, `README.md:100-118` in the current file)

**Interfaces:**
- Consumes: the five field names/defaults/behaviors from Tasks 1–2 (already implemented and tested).
- Produces: documentation only — no code interface.

- [ ] **Step 1: Add five rows to the settings reference table and a boot-time-only note**

In `README.md`, the settings table currently ends with the `showToolbar` row followed directly by the `## Theming` heading. Insert the five new rows immediately after the `showToolbar` row (i.e. as the new last rows of that table), then add an explanatory paragraph directly under the table, before `## Theming`:

```markdown
| `showFitButton` | `boolean` | `true` | `false` hides the ⤢ Fit button from the toolbar. |
| `showExportButton` | `boolean` | `true` | `false` hides the ⬇ Export button from the toolbar. |
| `showPrintButton` | `boolean` | `true` | `false` hides the 🖨 Print button from the toolbar. |
| `showSettingsButton` | `boolean` | `true` | `false` hides the ⚙ Settings button from the toolbar. If `showToolbar` is `true` but this is `false`, the settings drawer becomes unreachable from the UI — configure display settings entirely via `options.settings` instead. |
| `logoText` | `string` | `"◈ OrgChart"` | Replaces the toolbar's logo text verbatim, icon included — include your own icon/emoji in the string if you want one. |

`showToolbar`, `showFitButton`, `showExportButton`, `showPrintButton`,
`showSettingsButton`, and `logoText` are **boot-time only**: read once from
`options.settings` when the chart mounts, never persisted to `localStorage`,
and not exposed as controls in the in-widget settings drawer. Every other
setting in the table above (`cardStyle` through `deptColors`) is both
live-editable through the settings drawer and persisted per `instanceId`.
```

- [ ] **Step 2: Verify the rendered table by eye**

Open `README.md` and confirm: no broken table pipes, the new rows read correctly, and the boot-time-only paragraph doesn't contradict the earlier per-row descriptions (e.g. the existing `showToolbar` row's own inline explanation and this new paragraph should agree — both say it's a structural, non-drawer setting).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document per-button toolbar visibility and logoText settings"
```

---

### Task 5: Real-browser verification (Playwright)

**Files:** none (verification only, no source changes expected)

- [ ] **Step 1: Build a throwaway HTML page**

Create a scratch file (e.g. in the repo root, untracked, or in the session scratchpad) that loads `dist/orgchart.css` + `dist/orgchart.js` and calls:

```html
<div id="chart" style="height:600px"></div>
<link rel="stylesheet" href="dist/orgchart.css">
<script src="dist/orgchart.js"></script>
<script>
  OrgChart.render('chart', {
    data: [
      { id: 1, name: "Jane Doe (1001)", title: "CEO" },
      { id: 50, name: "Engineering", tags: "['group']", pid: 1 },
      { id: 2, name: "John Smith (1002)", title: "Engineer", pid: 50, DEPARTMENT_NAME: "Engineering" }
    ],
    settings: {
      showExportButton: false,
      showPrintButton: false,
      logoText: "★ Acme Corp"
    }
  });
</script>
```

- [ ] **Step 2: Open it in Playwright and verify**

Use the Playwright MCP tools to navigate to the file, take a snapshot/screenshot, and confirm: the toolbar logo reads "★ Acme Corp", the Export and Print buttons are absent, and the Fit and Settings buttons are still present and clickable (clicking Fit visibly re-centers; clicking Settings opens the drawer).

- [ ] **Step 3: Delete the throwaway HTML file** (it was scratch-only, not part of the plan's deliverable)

---

## Post-plan summary

After Task 5, all of the following are true:
- `src/dom.js` and `src/app.js` support `showFitButton`, `showExportButton`, `showPrintButton`, `showSettingsButton`, `logoText`.
- `dist/orgchart.js`/`dist/orgchart.css` are rebuilt and reflect the change.
- `README.md`'s settings reference documents all five new options.
- `node --test` passes in full.
- Real-browser (Playwright) verification confirms the feature works in an actual embedding, not just under jsdom.
