# OrgChart

A dependency-free, vanilla JS/CSS org chart widget. Pan/zoom canvas, department
containers, search, filtering, PNG export, print, and an in-widget settings
drawer — embeddable in any web page with a single script tag and stylesheet.

## Quick start

```html
<div id="chart" style="height: 600px"></div>

<link rel="stylesheet" href="dist/orgchart.css">
<script src="dist/orgchart.js"></script>
<script>
  var chart = OrgChart.render('chart', {
    data: [
      { id: 1, name: "Jane Doe (1001)", title: "CEO" },
      { id: 50, name: "Engineering", tags: "['group']", pid: 1 },
      { id: 2, name: "John Smith (1002)", title: "Engineer", pid: 50, DEPARTMENT_NAME: "Engineering" }
    ]
  });
</script>
```

That's it — `dist/orgchart.js` and `dist/orgchart.css` are self-contained
bundles (no build step, no other dependencies) built from this repo's source
via `node build.js`.

## `OrgChart.render(target, options)`

Mounts a chart into `target` and returns a handle for controlling it
afterward. Designed and tested for exactly one chart per page: each call
gets its own scoped DOM and internal state, but a couple of listeners are
page-level rather than per-instance (e.g. pressing Escape closes the
details/settings panel in every mounted chart, not just one) — mounting more
than one chart on the same page works in the common cases but hasn't been
built or tested for full isolation.

```js
var chart = OrgChart.render(target, options);
```

### `target`

One of:

| Type | Behavior |
|---|---|
| `string` | Treated as an element id first (`document.getElementById`), then as a CSS selector (`document.querySelector`) if no element with that id exists. |
| `Element` | Used directly. |

Throws `Error: OrgChart.render: target element not found: <target>` if
nothing resolves.

### `options`

| Option | Type | Default | Description |
|---|---|---|---|
| `data` | `Array<Item>` | — | Array of raw employee/department records (see [Data format](#data-format)). Used directly if provided. |
| `apiUrl` | `string` | — | Fetched via `fetch()` on load; the response must be JSON shaped `{ items: [...] }`. If the fetch fails, falls back to `data` if provided. Provide at least one of `data` or `apiUrl`. |
| `settings` | `object` | `{}` | Initial display settings. Precedence, lowest to highest: built-in defaults → whatever was already persisted in `localStorage` for this `instanceId` → this `settings` object. See [Settings reference](#settings-reference). A visitor can further change settings afterward through the in-widget settings drawer (⚙), which persists back to `localStorage`. |
| `instanceId` | `string` | the target element's `id` attribute, or `"default"` | Scopes settings persistence to `localStorage` key `orgchart.settings.<instanceId>`. Give each embedded chart on a distinct page/id its own value so their saved preferences don't collide. |

### Return value

```ts
{
  update(newData: Array<Item>): void, // re-adapt and re-render with new data;
                                       // keeps current settings/pan/zoom/collapsed state
  fit(): void,                        // re-center and re-fit the chart to the viewport
  destroy(): void                     // remove all DOM and listeners this chart added;
                                       // safe to call more than once
}
```

## Data format

`data` (and the `items` array from `apiUrl`) is a flat array — no nesting
required. Each item:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string \| number` | yes | Must be unique. |
| `pid` | `string \| number \| null` | no | Parent's `id`. Exactly one item in the array must have no `pid` (`null`/`undefined`/`""`) — that item becomes the chart's root. |
| `name` | `string` | no | Display name. A trailing, digits-only `"(123)"` (space before it optional) is parsed out as an employee number and shown separately in the details panel, e.g. `"Jane Doe (1001)"`. Non-numeric parentheticals are left as part of the display name. |
| `title` | `string` | no | Job title, shown on the card and in the details panel. |
| `DEPARTMENT_NAME` | `string` | no | Department label shown on member cards (independent of the tree structure below). |
| `img` | `string` | no | Photo URL. Falls back to a colored initials avatar if empty, invalid, or if the image fails to load (e.g. blocked by CORS). |
| `tags` | `Array<string> \| string` | no | A string is parsed for quoted tags, e.g. `"['group']"`. Include `"group"` to make this item a **department container** instead of a person card — its children render inside a dashed, tinted box, and the container becomes collapsible. |

Data quirks that are recovered automatically (with a `console.warn`, not a
thrown error): duplicate `id`s (first one wins), a `pid` pointing at a
non-existent id (orphan gets attached to the root), and circular `pid` chains
(broken at the point of the cycle). The one unrecoverable case is data with
*no* root at all (every item has a `pid`) — that throws `Error: no root node
found`. On initial load this is caught and shown in the widget's own error
overlay; passed to `chart.update()` later, it throws out of that call, so
wrap `update()` in `try`/`catch` if the new data isn't already known-good.

## Settings reference

Passed via `options.settings`, and editable live through the widget's own
settings drawer (unless `showToolbar` is `false`):

| Key | Type | Default | Values |
|---|---|---|---|
| `cardStyle` | `string` | `"portrait"` | `"portrait"` \| `"classic"` \| `"compact"` |
| `orientation` | `string` | `"top-down"` | `"top-down"` \| `"left-right"` |
| `maxColumns` | `number` | `4` | `2`–`8`; members per row/column inside a department container before wrapping |
| `spacing` | `string` | `"normal"` | `"compact"` \| `"normal"` \| `"roomy"` |
| `theme` | `string` | `"system"` | `"light"` \| `"dark"` \| `"system"` (follows `prefers-color-scheme`) |
| `showPhotos` | `boolean` | `true` | Show avatar photos (vs. always using initials) |
| `showTitles` | `boolean` | `true` | Show job title on cards |
| `showBadges` | `boolean` | `true` | Show department badge on cards |
| `showEmpty` | `boolean` | `false` | Include departments with zero members |
| `deptColors` | `object` | `{}` | Maps a department's `id` to a hex color string, e.g. `{ "50": "#7c3aed" }` |
| `showToolbar` | `boolean` | `true` | `false` omits the entire header (search, department filter, fit/export/print/settings buttons). The pan/zoom canvas, card-click details panel, and department collapse/expand still work either way. With no toolbar, the settings drawer is unreachable from the UI — configure display settings entirely via `options.settings` instead. |
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

## Theming

Colors, spacing tokens, etc. are CSS custom properties, all prefixed
`--orgchart-` and scoped to the chart's own `.orgchart-root` wrapper — they
won't collide with same-named variables in whatever page or app embeds the
chart. Override them in your own stylesheet if you want a different palette
than the built-in light/dark themes:

```css
#chart.orgchart-root {
  --orgchart-bg: #fafafa;
  --orgchart-accent: #7c3aed;
}
```

Per-department accent colors are set via `settings.deptColors` (above)
rather than CSS, since they're computed per department at render time.

## Built-in interactions

- **Pan**: click-drag the canvas. **Zoom**: mouse wheel.
- **Click a card**: opens the details panel (name, title, department,
  employee #, reporting path, tags).
- **Click a department label**: collapses/expands that department.
- **Search box**: matches name, title, and department; Enter cycles through
  matches.
- **Department filter**: narrows the chart to one department.
- **⚙ settings**: card style, orientation, spacing, theme, per-department
  colors, and toggling photos/titles/badges/empty departments — persisted to
  `localStorage` per `instanceId`.
- **Export**: downloads a PNG of the current chart. If any photo is hosted
  on a different origin without CORS headers, the whole export can fail
  (shown via an alert) rather than silently omitting that photo.
- **Print**: scales the chart to fit a single landscape page.
- **Escape**: closes the details panel and settings drawer.

## Building from source

```
node build.js
```

Regenerates `dist/orgchart.js` (concatenation of `src/*.js` + the vendored
`html-to-image` PNG-export dependency) and `dist/orgchart.css` (concatenation
of `styles/*.css`) from current source. Re-run after any change under `src/`
or `styles/` — `dist/` is not built automatically.

## Project structure

```
src/            source modules (dataAdapter, layout, render, interactions,
                search, settings, dom, export, app)
styles/         themes.css (tokens), app.css (chrome), chart.css (cards)
vendor/         vendored html-to-image (PNG export), never CDN-loaded
dist/           built, embeddable bundle — orgchart.js + orgchart.css
tests/          node --test suite (run: `node --test`)
build.js        bundles src/ + styles/ into dist/
index.html      standalone demo app, mounts via OrgChart.render + data.js
data.js         sample/fallback data for the standalone demo
```

## Running the standalone demo

Open `index.html` directly — it loads `data.js` and mounts via
`OrgChart.render('app-root', { instanceId: 'v1' })`. To load from an API
instead, edit that last line to add `apiUrl: 'https://...'` (an endpoint
returning `{ "items": [...] }`) to the options object.

## Tests

```
node --test
```

Runs the full suite (data adaptation, layout geometry, search, DOM
construction, CSS scoping, settings persistence, and behavioral tests that
mount a real chart in jsdom and drive clicks/search/filter/collapse against
it), including a smoke test against the built `dist/` bundle itself.
