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
