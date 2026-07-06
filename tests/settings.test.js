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
  assert.equal(Object.keys(store.load("never-saved").deptColors).length, 0);
});

test("settings panel's Reset button has type=button (can't submit a host form)", () => {
  const win = makeWindow(["src/settings.js"], { body: '<div id="body"></div>' }).window;
  const bodyEl = win.document.getElementById("body");
  const settings = Object.assign({}, win.OrgChart.settingsStore.DEFAULTS, { deptColors: {} });
  win.OrgChart.settingsPanel.init(bodyEl, settings, [], function () {});
  const reset = Array.from(bodyEl.querySelectorAll("button"))
    .find(function (b) { return b.textContent === "Reset to defaults"; });
  assert.ok(reset, "reset button rendered");
  assert.equal(reset.getAttribute("type"), "button");
});
