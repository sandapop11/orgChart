const { test } = require("node:test");
const assert = require("node:assert/strict");
const { match } = require("../src/search.js");

function node(id, displayName, title, department, isGroup) {
  return { id: String(id), displayName, title, department, isGroup: !!isGroup };
}
const NODES = new Map([
  ["1", node(1, "Riken Singh Maharjan", "CEO", "Admin")],
  ["50001", node(50001, "Showroom", "Showroom", "Showroom", true)],
  ["2", node(2, "Amrita Maharjan", "Client Relation Manager", "Showroom")],
  ["3", node(3, "Aryan Rajbanshi", "Sales Associate", "Showroom")]
]);

test("matches name, title and department, case-insensitively", () => {
  assert.deepEqual(match(NODES, "amrita"), ["2"]);
  assert.deepEqual(match(NODES, "sales"), ["3"]);
  assert.deepEqual(match(NODES, "ShOwRoOm"), ["2", "3"]);
});

test("group nodes are never matched", () => {
  assert.ok(!match(NODES, "showroom").includes("50001"));
});

test("blank query returns empty", () => {
  assert.deepEqual(match(NODES, ""), []);
  assert.deepEqual(match(NODES, "   "), []);
});
