const { test } = require("node:test");
const assert = require("node:assert/strict");
const { compute, CARD_SIZES, SPACING } = require("../src/layout.js");

function mk(id, opts) {
  return Object.assign({ id: String(id), isGroup: false, children: [] }, opts);
}
function dept(id, children) { return mk(id, { isGroup: true, children }); }
function base(over) {
  return Object.assign({ cardStyle: "portrait", orientation: "top-down",
    maxColumns: 4, spacing: "normal", showEmpty: false,
    filterDepartmentId: null, viewportWidth: 1200, viewportHeight: 800 }, over);
}
const CW = CARD_SIZES.portrait.w, CH = CARD_SIZES.portrait.h;
const SP = SPACING.normal;

test("container grid wraps at maxColumns", () => {
  const root = mk(1, { children: [dept(50, [mk(2), mk(3), mk(4), mk(5), mk(6)])] });
  const r = compute(root, base());
  const c = r.containers.find(x => x.node.id === "50");
  // 5 members, 4 columns -> 4 wide, 2 rows
  assert.equal(c.w, SP.pad * 2 + 4 * CW + 3 * SP.cardGap);
  assert.equal(c.h, SP.labelH + SP.pad * 2 + 2 * CH + SP.cardGap);
  assert.equal(c.count, 5);
  // all member cards sit inside the container box
  const members = r.cards.filter(k => ["2","3","4","5","6"].includes(k.node.id));
  assert.equal(members.length, 5);
  for (const m of members) {
    assert.ok(m.x >= c.x && m.x + m.w <= c.x + c.w);
    assert.ok(m.y >= c.y && m.y + m.h <= c.y + c.h);
  }
});

test("collapsed department renders as pill, members omitted", () => {
  const root = mk(1, { children: [dept(50, [mk(2), mk(3)])] });
  const r = compute(root, base(), new Set(["50"]));
  const c = r.containers.find(x => x.node.id === "50");
  assert.equal(c.collapsed, true);
  assert.deepEqual([c.w, c.h], [170, 36]);
  assert.equal(c.count, 2);
  assert.ok(!r.cards.some(k => k.node.id === "2"));
});

test("member with children renders as nested subtree inside container", () => {
  const root = mk(1, { children: [dept(50, [mk(2, { children: [mk(3), mk(4)] })])] });
  const r = compute(root, base());
  const parent = r.cards.find(k => k.node.id === "2");
  const kid = r.cards.find(k => k.node.id === "3");
  assert.ok(kid.y >= parent.y + parent.h + SP.levelGap - 1);
  // a connector joins parent bottom to child top
  assert.ok(r.connectors.length >= 3); // root->container + parent->2 children
});

test("card style changes card dimensions", () => {
  const root = mk(1, { children: [dept(50, [mk(2)])] });
  const r = compute(root, base({ cardStyle: "compact" }));
  const card = r.cards.find(k => k.node.id === "2");
  assert.deepEqual([card.w, card.h], [CARD_SIZES.compact.w, CARD_SIZES.compact.h]);
});

test("deterministic: same input gives identical output", () => {
  const root = mk(1, { children: [dept(50, [mk(2), mk(3)]), dept(51, [mk(4)])] });
  assert.deepEqual(compute(root, base()), compute(root, base()));
});
