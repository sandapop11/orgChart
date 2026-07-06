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

test("themes.css defines orgchart-prefixed variables under .orgchart-root, not bare :root", () => {
  const themes = read("styles/themes.css");
  assert.ok(themes.includes(".orgchart-root {"), "light vars scoped to .orgchart-root");
  assert.ok(themes.includes('.orgchart-root[data-theme="dark"]'), "dark override scoped to .orgchart-root");
  assert.ok(!/^:root\b/m.test(themes), "no bare :root selector");
  assert.ok(themes.includes("--orgchart-bg"), "variables are orgchart-prefixed");
  assert.ok(!/--bg:/.test(themes), "no unprefixed --bg declaration");
});

test("app.css and chart.css only reference orgchart-prefixed custom properties", () => {
  const combined = read("styles/app.css") + read("styles/chart.css");
  const varRefs = combined.match(/var\(--[a-zA-Z0-9-]+/g) || [];
  assert.ok(varRefs.length > 10, "sanity: found var() references");
  for (const ref of varRefs) {
    assert.ok(ref.startsWith("var(--orgchart-"), "unprefixed variable reference: " + ref);
  }
  assert.ok(!combined.includes(".card--orgchart-hit"), "BEM modifier class must stay .card--hit, not corrupted");
  assert.ok(combined.includes(".card--hit"), "search-hit class present and correctly named");
});
