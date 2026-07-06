const { test } = require("node:test");
const assert = require("node:assert/strict");
const adapter = require("../src/dataAdapter.js");

const RAW = [
  { id: 1, name: "Riken Singh Maharjan(999)", title: "CEO", DEPARTMENT_NAME: "Admin",
    img: "https://hr.example.com/../../thalo/images/emp//riken.jpg" },
  { id: 50001, name: "Showroom", title: "Showroom", DEPARTMENT_NAME: "Showroom",
    img: "https://hr.example.com/../images/dd.png", tags: "tags: ['group']", pid: "1" },
  { id: 2, name: "Amrita Maharjan(2)", title: "Client Relation Manager", DEPARTMENT_NAME: "Showroom",
    img: "", tags: "tags: ['it-team']", pid: "50001" }
];

test("ids and pids normalize to strings; root has null pid", () => {
  const { root, nodesById } = adapter.adapt(RAW);
  assert.equal(root.id, "1");
  assert.equal(root.pid, null);
  assert.equal(nodesById.get("2").pid, "50001");
});

test("malformed tags string parses to array; 'group' marks departments", () => {
  const { nodesById, departments } = adapter.adapt(RAW);
  assert.deepEqual(nodesById.get("2").tags, ["it-team"]);
  assert.equal(nodesById.get("50001").isGroup, true);
  assert.equal(nodesById.get("2").isGroup, false);
  assert.deepEqual(departments.map(d => d.id), ["50001"]);
});

test("employee number extracted from name suffix", () => {
  const { nodesById } = adapter.adapt(RAW);
  assert.equal(nodesById.get("2").displayName, "Amrita Maharjan");
  assert.equal(nodesById.get("2").employeeNo, "2");
  assert.equal(nodesById.get("50001").displayName, "Showroom");
  assert.equal(nodesById.get("50001").employeeNo, null);
});

test("image URLs collapse ../ segments; empty img stays empty", () => {
  const { nodesById } = adapter.adapt(RAW);
  assert.equal(nodesById.get("1").img, "https://hr.example.com/thalo/images/emp//riken.jpg");
  assert.equal(nodesById.get("2").img, "");
});

test("tree links children and assigns deptId from nearest group ancestor", () => {
  const { root, nodesById } = adapter.adapt(RAW);
  assert.deepEqual(root.children.map(c => c.id), ["50001"]);
  assert.deepEqual(nodesById.get("50001").children.map(c => c.id), ["2"]);
  assert.equal(nodesById.get("2").deptId, "50001");
  assert.equal(root.deptId, null);
});

test("duplicate ids: first wins, warning emitted", () => {
  const raw = RAW.concat([{ id: 2, name: "Impostor(9)", title: "X", pid: "50001" }]);
  const { nodesById, warnings } = adapter.adapt(raw);
  assert.equal(nodesById.get("2").displayName, "Amrita Maharjan");
  assert.ok(warnings.some(w => w.includes("duplicate id 2")));
});

test("orphan pid attaches to root with warning", () => {
  const raw = RAW.concat([{ id: 9, name: "Lost(9)", title: "X", pid: "77777" }]);
  const { root, nodesById, warnings } = adapter.adapt(raw);
  assert.ok(root.children.some(c => c.id === "9"));
  assert.equal(nodesById.get("9").pid, "1");
  assert.ok(warnings.some(w => w.includes("orphan") && w.includes("9")));
});

test("extra parentless nodes attach to root with warning", () => {
  const raw = RAW.concat([{ id: 10, name: "Second Root(10)", title: "X" }]);
  const { root, warnings } = adapter.adapt(raw);
  assert.ok(root.children.some(c => c.id === "10"));
  assert.ok(warnings.some(w => w.includes("10")));
});

test("circular pid chain is broken with warning", () => {
  const raw = RAW.concat([
    { id: 20, name: "A(20)", title: "X", pid: "21" },
    { id: 21, name: "B(21)", title: "X", pid: "20" }
  ]);
  const { root, nodesById, warnings } = adapter.adapt(raw);
  assert.ok(warnings.some(w => w.includes("circular")));
  // both nodes end up reachable from the root
  const seen = new Set();
  (function walk(n) { seen.add(n.id); n.children.forEach(walk); })(root);
  assert.ok(seen.has("20") && seen.has("21"));
});

test("no root at all throws", () => {
  assert.throws(() => adapter.adapt([{ id: 5, name: "X(5)", title: "X", pid: "99" },
                                     { id: 6, name: "Y(6)", title: "Y", pid: "98" }]),
    /no root node found/);
});
