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
