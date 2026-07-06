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

test("filterDepartmentId keeps only that container plus root", () => {
  const root = mk(1, { children: [dept(50, [mk(2)]), dept(51, [mk(3)])] });
  const r = compute(root, base({ filterDepartmentId: "51" }));
  assert.deepEqual(r.containers.map(c => c.node.id), ["51"]);
  assert.ok(r.cards.some(k => k.node.id === "1"));
  assert.ok(!r.cards.some(k => k.node.id === "2"));
});

test("empty departments hidden unless showEmpty", () => {
  const root = mk(1, { children: [dept(50, [mk(2)]), dept(60, [])] });
  const hidden = compute(root, base());
  assert.ok(!hidden.containers.some(c => c.node.id === "60"));
  const shown = compute(root, base({ showEmpty: true }));
  assert.ok(shown.containers.some(c => c.node.id === "60"));
});

test("container rows wrap when exceeding max(1600, viewportWidth)", () => {
  // 6 depts x 1 member: each container ~ 182 wide; force tiny threshold via viewportWidth
  const depts = [50, 51, 52, 53, 54, 55].map(id => dept(id, [mk(id + 100)]));
  const root = mk(1, { children: depts });
  const narrow = compute(root, base({ viewportWidth: 100 })); // threshold = 1600 still
  const ys1 = new Set(narrow.containers.map(c => c.y));
  assert.equal(ys1.size, 1, "under 1600px total width stays on one row");
  // 12 wide containers exceed 1600 -> multiple rows
  const many = mk(1, { children: Array.from({ length: 12 }, (_, i) => dept(70 + i, [mk(200 + i)])) });
  const wrapped = compute(many, base({ viewportWidth: 100 }));
  const ys2 = new Set(wrapped.containers.map(c => c.y));
  assert.ok(ys2.size > 1, "wraps onto additional rows");
});

test("left-right orientation puts root left of containers", () => {
  const root = mk(1, { children: [dept(50, [mk(2)]), dept(51, [mk(3)])] });
  const r = compute(root, base({ orientation: "left-right" }));
  const rootCard = r.cards.find(k => k.node.id === "1");
  for (const c of r.containers) {
    assert.ok(c.x > rootCard.x + rootCard.w, "container is to the right of root");
  }
  // containers stack vertically
  const [a, b] = r.containers;
  assert.notEqual(a.y, b.y);
});

function segmentsIntersectBox(points, box) {
  // Only axis-aligned segments are produced by the layout engine.
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (a.x === b.x) {
      const x = a.x, y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      if (x > box.x && x < box.x + box.w && y1 > box.y && y0 < box.y + box.h) return true;
    } else if (a.y === b.y) {
      const y = a.y, x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
      if (y > box.y && y < box.y + box.h && x1 > box.x && x0 < box.x + box.w) return true;
    }
  }
  return false;
}

test("connectors to wrapped rows do not cross earlier-row containers", () => {
  // enough departments to force wrapping onto a 2nd row at the 1600px threshold
  const depts = Array.from({ length: 10 }, (_, i) =>
    dept(50 + i, [mk(200 + i), mk(300 + i), mk(400 + i)]));
  const root = mk(1, { children: depts });
  const r = compute(root, base());
  assert.ok(new Set(r.containers.map(c => c.y)).size > 1, "test setup should produce 2+ rows");

  for (const conn of r.connectors) {
    for (const box of r.containers) {
      assert.ok(!segmentsIntersectBox(conn.points, box),
        "connector " + JSON.stringify(conn.points) +
        " crosses container " + box.node.id + " at " + JSON.stringify({ x: box.x, y: box.y, w: box.w, h: box.h }));
    }
  }
});

test("connectors to wrapped columns (left-right) do not cross earlier-column containers", () => {
  const depts = Array.from({ length: 10 }, (_, i) =>
    dept(50 + i, [mk(200 + i), mk(300 + i), mk(400 + i)]));
  const root = mk(1, { children: depts });
  const r = compute(root, base({ orientation: "left-right", viewportHeight: 900 }));
  assert.ok(new Set(r.containers.map(c => c.x)).size > 1, "test setup should produce 2+ columns");

  for (const conn of r.connectors) {
    for (const box of r.containers) {
      assert.ok(!segmentsIntersectBox(conn.points, box),
        "connector " + JSON.stringify(conn.points) +
        " crosses container " + box.node.id + " at " + JSON.stringify({ x: box.x, y: box.y, w: box.w, h: box.h }));
    }
  }
});

test("chart bounds contain every element", () => {
  const root = mk(1, { children: [dept(50, [mk(2), mk(3), mk(4)]), dept(51, [mk(5)])] });
  for (const o of ["top-down", "left-right"]) {
    const r = compute(root, base({ orientation: o }));
    for (const el of r.cards.concat(r.containers)) {
      assert.ok(el.x >= 0 && el.y >= 0, o + ": no negative coords");
      assert.ok(el.x + el.w <= r.width && el.y + el.h <= r.height, o + ": inside bounds");
    }
  }
});
