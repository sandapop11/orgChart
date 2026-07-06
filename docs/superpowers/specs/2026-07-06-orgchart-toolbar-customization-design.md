# OrgChart Toolbar Customization — Design

## Goal

Let an embedder configure the toolbar more granularly than the existing
all-or-nothing `showToolbar`: hide any of the four action buttons
individually, and replace the "◈ OrgChart" logo text with their own brand.

## Non-goals

- Per-button control over the search box or department filter dropdown —
  confirmed with the user as out of scope; only the four action buttons
  (Fit, Export, Print, Settings) get individual toggles.
- Live editing or persistence of these options through the settings drawer —
  confirmed with the user these are structural/branding decisions made by the
  embedding page, not visitor display preferences.
- Any change to the settings drawer's own contents, the layout engine, or the
  data adapter.

## New `options.settings` fields

| Key | Type | Default |
|---|---|---|
| `showFitButton` | `boolean` | `true` |
| `showExportButton` | `boolean` | `true` |
| `showPrintButton` | `boolean` | `true` |
| `showSettingsButton` | `boolean` | `true` |
| `logoText` | `string` | `"◈ OrgChart"` |

All five are **boot-time only**, evaluated once when `OrgChart.render()`
mounts — exactly like the existing `showToolbar`:

- Read directly from `options.settings` in `src/app.js`, not from
  `settingsStore`/`localStorage`.
- Not added to `settingsStore.DEFAULTS`, not persisted, not shown as controls
  in the settings drawer (`src/settings.js`'s `settingsPanel`).
- `logoText` replaces the entire logo span's text verbatim (icon included) —
  a caller who wants an icon includes their own character/emoji in the
  string they pass.

## Implementation

**`src/dom.js`** — `build(options)` already takes `options.showToolbar`. Add
four more boolean params (`showFitButton`, `showExportButton`,
`showPrintButton`, `showSettingsButton`, each treated as `!== false`, same
convention as `showToolbar`) and one string param (`logoText`, default
`"◈ OrgChart"` when falsy/omitted). Inside the `if (showToolbar)` block:

- Only construct `els.btnFit` when `showFitButton` is truthy; same for
  `els.btnExport` / `showExportButton`, `els.btnPrint` / `showPrintButton`,
  `els.btnSettings` / `showSettingsButton`. When a flag is `false`, leave the
  corresponding `els.btn*` as `undefined` (not built at all).
- Build the toolbar's children array as before — `h()` already skips falsy
  entries (`if (kids[i]) e.appendChild(kids[i])`), so omitted buttons simply
  don't appear; no other change to the toolbar's child list construction is
  needed.
- Replace the hardcoded `text: "◈ OrgChart"` on the logo span with the
  `logoText` param.

**`src/app.js`** — alongside the existing:

```js
var showToolbar = !(options.settings && options.settings.showToolbar === false);
```

compute the four new booleans the same way, plus:

```js
var logoText = (options.settings && options.settings.logoText) || "◈ OrgChart";
```

and pass all of them into the `OrgChart.dom.build({...})` call.

No changes needed to event wiring: `app.js` already guards every button
listener with `if (els.btnFit) on(...)`, `if (els.btnExport) on(...)`, etc.,
so a button that was never constructed (now `undefined` instead of an
`Element`) simply gets no listener — the existing null-checks already handle
this correctly.

No changes needed to `src/interactions.js`, `src/layout.js`,
`src/dataAdapter.js`, `src/render.js`, `src/search.js`, or `src/settings.js`.

## Interaction with `showSettingsButton`

If `showSettingsButton` is `false` while `showToolbar` is `true`, the
settings drawer becomes unreachable from the UI — the same situation that
already exists today when `showToolbar` itself is `false`. This is expected:
configure display settings up front via `options.settings` in that case.

## Documentation

`README.md`'s settings reference table gets five new rows (mirroring the
existing `showToolbar` row's description style), and the "Quick start" /
options discussion should note that these are boot-time-only, non-persisted
options — not editable via the in-widget drawer.

## Testing / verification

- Extend the existing DOM-construction unit tests (`src/dom.js`'s tests) to
  cover: each button individually omitted, all four omitted, and a custom
  `logoText` rendering verbatim.
- Extend the jsdom behavioral harness (or add a focused test) to confirm that
  when a button is omitted via settings, no corresponding element exists in
  the mounted DOM and no click handler fires for it (e.g. clicking where the
  button would have been doesn't trigger `export`/`print`/etc.).
- Re-run `node build.js` after the source change so `dist/orgchart.js` picks
  up the new params, and confirm the existing `dist/` smoke test still
  passes.
- Per this project's standing verification expectation: after automated
  tests pass, confirm behavior in a real browser (Playwright) — mount a
  chart with a couple of buttons disabled and a custom `logoText`, and
  visually/DOM-inspect that the disabled buttons are absent and the logo
  text is correct.
