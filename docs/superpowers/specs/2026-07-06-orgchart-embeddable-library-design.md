# OrgChart Embeddable Library — Design

## Goal

Package the existing OrgChart app as a reusable library so other projects can
drop a single JS file + single CSS file into a page, call one function against
a target `<div>`, and get a working, interactive org chart — without pulling
in the whole repo or copying HTML skeleton.

The standalone app (`index.html` + `data.js`) keeps working exactly as it does
today; it becomes the first consumer of the same factory function the library
exposes, rather than a separate code path.

## Non-goals

- Multiple org chart instances on the same page. Confirmed with the user:
  always exactly one chart per page. Page-level listeners (window `resize`,
  document `keydown` for Escape) stay global; no per-instance event
  namespacing is needed.
- A watch/auto-rebuild dev server. `build.js` is a one-shot script, re-run
  manually after source changes.
- Editing/write-back of org data. Unchanged non-goal from the original spec.

## Public API

```html
<div id="my-chart"></div>
<link rel="stylesheet" href="orgchart.css">
<script src="orgchart.js"></script>
<script>
  const chart = OrgChart.render('my-chart', {
    data: [ /* raw items, same shape as data.js's window.maps.items */ ],
    // — or — apiUrl: 'https://example.com/org.json',
    settings: { cardStyle: 'portrait', showToolbar: true },
    instanceId: 'my-chart'   // optional; defaults to the target element's id
  });

  chart.update(newDataArray); // swap in new data, re-adapt, re-layout, re-render
  chart.fit();                // re-center/re-fit the current layout
  chart.destroy();            // remove listeners + DOM, tear down the instance
</script>
```

- `target`: an element id string, a CSS selector string, or an `Element`.
  Resolved as: if a string, try `document.getElementById`, then
  `document.querySelector`; otherwise used directly as an `Element`.
- `options.data` and `options.apiUrl` are both supported (confirmed). If
  `apiUrl` is set, it's fetched first; on fetch failure it falls back to
  `options.data` if present (same graceful-degradation behavior the app
  already has with `data.js`'s `window.maps`). If neither is provided, the
  legacy `window.maps.items` global is checked last, purely so the existing
  `index.html` + `data.js` demo keeps working unmodified in that regard. If
  nothing resolves, the error overlay shows the existing "No data source"
  message.
- `options.settings`: partial settings object, merged over
  `settingsStore.DEFAULTS` and over whatever's already persisted for this
  `instanceId`, in that precedence order (persisted < passed-in options <
  in-widget drawer edits, matching current override behavior).
- `options.settings.showToolbar` (default `true`): when `false`, the header
  (search box, department filter, fit/export/print/settings-gear buttons) is
  never built. The chart canvas (pan/zoom), card click → details panel, and
  container collapse/expand all keep working regardless — only the toolbar
  chrome is affected. When there's no toolbar there's no way to reach the
  settings drawer from the UI; callers configure display settings entirely
  through `options.settings` in that mode.
- `options.instanceId` (default: target element's `id` attribute, else the
  literal string `"default"`): scopes localStorage persistence — see below.

## Refactor: singleton IIFE → factory

`src/app.js` currently runs immediately on script load, hard-wired to
`document.getElementById` against a static HTML skeleton in `index.html`. It
becomes a factory:

```js
window.OrgChart.render = function (target, options) { ... return { update, destroy, fit }; };
```

`render()`:
1. Resolves `target` to an `Element` (throws a clear error if not found).
2. Builds the internal DOM tree by `createElement` (toolbar iff
   `showToolbar`, viewport/world/svg, details aside, settings aside, error
   overlay) and appends it into the target, under a wrapper element carrying
   an `.orgchart-root` class.
3. Wires event listeners to the created element references directly
   (closures), not `document.getElementById` lookups — each `render()` call
   gets its own private `state` object (no shared module-level state).
4. Runs the existing `boot()` sequence (load data, adapt, layout, render,
   first fit) scoped to this instance.
5. Returns `{ update(newData), destroy(), fit() }`:
   - `update(newData)`: re-adapts and re-renders with new data, keeps current
     settings/collapsed-state/transform.
   - `destroy()`: removes the created DOM subtree and any listeners this
     instance attached to `window`/`document` (resize, matchMedia change,
     keydown), leaving the target element empty.
   - `fit()`: exposes the existing pan/zoom controller's `fit`.

Other modules (`dataAdapter`, `layout`, `render`, `interactions`, `search`,
`export`) already take explicit element/data parameters rather than doing
global lookups, so they need no structural changes — only call-site updates
where `app.js` passes them scoped elements instead of ones fetched via a
document-wide `$(id)` helper.

### CSS/DOM scoping

Global id selectors in `styles/app.css` / `styles/chart.css`
(`#toolbar`, `#viewport`, `#world`, `#status`, `#details-panel`,
`#settings-drawer`, `#error-overlay`, `#search-input`, `#dept-filter`,
`#btn-*`, `#connectors`) are replaced with scoped classes (e.g. `.oc-toolbar`,
`.oc-viewport`) nested under `.orgchart-root`, so the widget can't collide
with ids already present on a host page. `styles/themes.css`'s
`[data-theme]` attribute selector stays as-is (applied to
`document.documentElement`, matching current behavior — theme is a
page-level concern, consistent with the one-instance-per-page scope).

### Settings persistence

`settingsStore.load`/`.save` become key-parameterized:
`orgchart.settings.<instanceId>`. `index.html` passes `instanceId: 'v1'` when
calling `render()`, preserving today's existing localStorage key
(`orgchart.settings.v1`) so current saved preferences aren't lost.

### index.html migration

`index.html` keeps its `data.js` script tag (still defines `window.maps`) and
otherwise becomes: an empty root `<div id="app-root">` (or similar) plus the
script tags (unchanged set/order) ending in a call to
`OrgChart.render('app-root', { instanceId: 'v1' })`. No `data`/`apiUrl` option
needed there since the existing `window.maps` fallback covers it.

## Build pipeline

`build.js` (plain Node, no dependencies), run manually via `node build.js`:

- Concatenates, in dependency order, into `dist/orgchart.js`:
  `vendor/html-to-image.min.js`, `src/dataAdapter.js`, `src/layout.js`,
  `src/render.js`, `src/interactions.js`, `src/search.js`, `src/settings.js`,
  `src/export.js`, `src/app.js`.
- Concatenates into `dist/orgchart.css`:
  `styles/themes.css`, `styles/app.css`, `styles/chart.css`.
- Prepends a short "auto-generated by build.js, do not edit — see src/" banner
  comment (with a usage snippet matching the Public API section above) to
  each output file.
- Always regenerates both files fully from current source — no incremental/
  partial state, so a stale `dist/` is only possible if `build.js` isn't
  re-run after a source change.

`dist/` is committed to the repo (not gitignored) so other projects can
depend on a specific commit/copy of it directly.

## Testing / verification

- Existing unit tests (`dataAdapter`, `layout`, `search`) are unaffected by
  this refactor and keep passing.
- The existing jsdom behavioral harness is updated to mount via
  `OrgChart.render(div, {...})` into a plain, bare `<div>` (rather than
  relying on `index.html`'s static skeleton) and drive the same real
  interactions (click, collapse, search, filter) against real data — proving
  the library works from a cold target element, which is the actual embedding
  scenario.
- A new smoke test loads the built `dist/orgchart.js`/`dist/orgchart.css` (not
  the `src/` files) via the jsdom harness and mounts successfully, so passing
  tests reflect the artifact that actually ships, not just the source it was
  built from.
- Per this project's standing verification expectation, these automated
  checks are necessary but not sufficient — after implementation, the user
  should confirm by embedding the built `dist/` files in a throwaway HTML
  page and looking at it in a real browser before this is called done.
