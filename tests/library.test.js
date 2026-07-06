const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeWindow } = require("./support.js");

const SRC = [
  "src/dataAdapter.js", "src/layout.js", "src/render.js", "src/interactions.js",
  "src/search.js", "src/settings.js", "src/dom.js", "src/export.js", "src/app.js"
];
const DATA = [
  { id: 1, name: "Riya Shah (100)", title: "CEO" },
  { id: 50, name: "Sales", tags: "['group']", pid: 1 },
  { id: 2, name: "Alice Rai (101)", title: "Rep", pid: 50, DEPARTMENT_NAME: "Sales" },
  { id: 3, name: "Bob Lama (102)", title: "Rep", pid: 50, DEPARTMENT_NAME: "Sales" },
  { id: 60, name: "Factory", tags: "['group']", pid: 1 },
  { id: 4, name: "Chandra K (103)", title: "Worker", pid: 60, DEPARTMENT_NAME: "Factory" }
];
function tick(win) { return new Promise(function (r) { win.setTimeout(r, 0); }); }

async function mount(opts) {
  const dom = makeWindow(SRC, { body: '<div id="host"></div>' });
  const win = dom.window;
  const chart = win.OrgChart.render("host", Object.assign({ data: DATA, instanceId: "t" }, opts));
  await tick(win);
  return { win, chart, doc: win.document };
}

test("render mounts cards into a bare div", async () => {
  const { doc } = await mount();
  const cards = doc.querySelectorAll(".orgchart-root .card");
  assert.ok(cards.length >= 4, "root + 3 leaf members rendered, got " + cards.length);
  assert.ok(doc.querySelectorAll(".orgchart-root .container-box").length >= 2);
});

test("toolbar buttons don't submit a <form> the target happens to sit inside", async () => {
  const dom = makeWindow(SRC, { body: '<form id="host-form"><div id="host"></div></form>' });
  const win = dom.window;
  win.OrgChart.render("host", { data: DATA, instanceId: "form-test" });
  await tick(win);
  const form = win.document.getElementById("host-form");
  let submitted = false;
  form.addEventListener("submit", function (e) { submitted = true; e.preventDefault(); });
  for (const cls of [".oc-btn-fit", ".oc-btn-settings", ".oc-btn-print", ".oc-btn-export"]) {
    const btn = win.document.querySelector(cls);
    btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  }
  assert.equal(submitted, false, "a toolbar button submitted the host form");
});

test("theme attribute is scoped to .orgchart-root, not the host page's <html>", async () => {
  const { doc } = await mount({ settings: { theme: "dark" } });
  assert.equal(doc.querySelector(".orgchart-root").dataset.theme, "dark");
  assert.equal(doc.documentElement.dataset.theme, undefined,
    "must not set data-theme on the host page's <html> element");
});

test("clicking a card opens the details panel", async () => {
  const { win, doc } = await mount();
  const card = doc.querySelector('.orgchart-root .card[data-card-id="2"]');
  card.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  const panel = doc.querySelector(".oc-details");
  assert.equal(panel.hidden, false);
  assert.ok(doc.querySelector(".oc-details-body h3").textContent.indexOf("Alice") !== -1);
});

test("clicking a container label collapses it", async () => {
  const { win, doc } = await mount();
  const before = doc.querySelectorAll(".orgchart-root .card").length;
  const label = doc.querySelector('.oc-world .container-box .label[data-toggle-id="50"]');
  label.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  const after = doc.querySelectorAll(".orgchart-root .card").length;
  assert.ok(after < before, "collapsing hides member cards");
  assert.ok(doc.querySelector(".container-box.collapsed"));
});

test("search highlights matching cards", async () => {
  const { win, doc } = await mount();
  const input = doc.querySelector(".oc-search-input");
  input.value = "Alice";
  input.dispatchEvent(new win.Event("input", { bubbles: true }));
  const hits = doc.querySelectorAll(".card--hit");
  assert.equal(hits.length, 1);
  assert.equal(doc.querySelector(".oc-search-count").textContent, "1 of 1");
});

test("department filter narrows to one container", async () => {
  const { win, doc } = await mount();
  const sel = doc.querySelector(".oc-dept-filter");
  sel.value = "60";
  sel.dispatchEvent(new win.Event("change", { bubbles: true }));
  const boxes = doc.querySelectorAll(".orgchart-root .container-box");
  assert.equal(boxes.length, 1);
  assert.ok(boxes[0].textContent.toUpperCase().indexOf("FACTORY") !== -1);
});

test("showToolbar:false renders chart with no toolbar but card click still works", async () => {
  const { win, doc } = await mount({ settings: { showToolbar: false } });
  assert.equal(doc.querySelector(".oc-toolbar"), null);
  assert.ok(doc.querySelectorAll(".orgchart-root .card").length >= 4);
  const card = doc.querySelector('.orgchart-root .card[data-card-id="2"]');
  card.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  assert.equal(doc.querySelector(".oc-details").hidden, false);
});

test("handle.update swaps data; handle.destroy empties the target", async () => {
  const { win, doc, chart } = await mount();
  chart.update([
    { id: 1, name: "New Boss", title: "CEO" },
    { id: 70, name: "Ops", tags: "['group']", pid: 1 },
    { id: 9, name: "Deepak T", title: "Analyst", pid: 70 }
  ]);
  await tick(win);
  assert.ok(doc.querySelector('.card[data-card-id="9"]'), "new data rendered");
  assert.equal(doc.querySelector('.card[data-card-id="2"]'), null, "old data gone");
  chart.destroy();
  assert.equal(doc.getElementById("host").children.length, 0, "target emptied");
  chart.destroy(); // idempotent, must not throw
});

test("render throws on a missing target", () => {
  const win = makeWindow(SRC).window;
  assert.throws(function () { win.OrgChart.render("nope", { data: DATA }); }, /target element not found/);
});

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

test("standalone path: window.maps + render('app-root') renders", async () => {
  const files = ["data.js"].concat(SRC);
  const dom = makeWindow(files, { body: '<div id="app-root"></div>' });
  const win = dom.window;
  assert.ok(win.maps && Array.isArray(win.maps.items), "data.js defines window.maps.items");
  win.OrgChart.render("app-root", { instanceId: "v1" });
  await tick(win);
  assert.ok(win.document.querySelectorAll(".orgchart-root .card").length > 0);
});
