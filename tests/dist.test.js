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
