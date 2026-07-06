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

test("every button has type=button so it can't submit a host page's <form>", () => {
  const dom = makeWindow(["src/dom.js"]);
  const els = dom.window.OrgChart.dom.build({ showToolbar: true });
  const buttons = els.root.querySelectorAll("button");
  assert.ok(buttons.length > 0, "sanity: found button elements");
  buttons.forEach(function (b) {
    assert.equal(b.getAttribute("type"), "button",
      "button missing type=\"button\": " + (b.className || b.textContent));
  });
});
