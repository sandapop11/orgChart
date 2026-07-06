(function () {
  "use strict";

  const CARD_SIZES = {
    portrait: { w: 150, h: 118 },
    classic:  { w: 210, h: 64 },
    compact:  { w: 170, h: 44 }
  };
  const SPACING = {
    compact: { cardGap: 8,  containerGap: 16, levelGap: 40, pad: 12, labelH: 22 },
    normal:  { cardGap: 12, containerGap: 24, levelGap: 56, pad: 16, labelH: 24 },
    roomy:   { cardGap: 20, containerGap: 36, levelGap: 72, pad: 24, labelH: 28 }
  };
  const PILL = { w: 170, h: 36 };
  const MARGIN = 24;

  function countMembers(node) {
    let n = 0;
    for (const c of node.children) n += (c.isGroup ? 0 : 1) + countMembers(c);
    return n;
  }

  function vElbow(x1, y1, x2, y2) {
    const my = (y1 + y2) / 2;
    return [{ x: x1, y: y1 }, { x: x1, y: my }, { x: x2, y: my }, { x: x2, y: y2 }];
  }
  function hElbow(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    return [{ x: x1, y: y1 }, { x: mx, y: y1 }, { x: mx, y: y2 }, { x: x2, y: y2 }];
  }

  function compute(root, settings, collapsedIds) {
    collapsedIds = collapsedIds || new Set();
    const card = CARD_SIZES[settings.cardStyle] || CARD_SIZES.portrait;
    const sp = SPACING[settings.spacing] || SPACING.normal;
    const cards = [], containers = [], connectors = [];

    // --- block builders: each returns { w, h, place(x, y) -> { cx, top } } ---

    function nodeBlock(node) {
      if (node.children.length === 0) {
        return {
          w: card.w, h: card.h,
          place(x, y) {
            cards.push({ node, x, y, w: card.w, h: card.h });
            return { cx: x + card.w / 2, top: y };
          }
        };
      }
      const kids = node.children.map(function (c) {
        return c.isGroup ? groupBlock(c) : nodeBlock(c);
      });
      const rowW = kids.reduce(function (s, b) { return s + b.w; }, 0) +
        sp.cardGap * (kids.length - 1);
      const w = Math.max(card.w, rowW);
      const kidH = Math.max.apply(null, kids.map(function (b) { return b.h; }));
      return {
        w, h: card.h + sp.levelGap + kidH,
        place(x, y) {
          const pcx = x + w / 2;
          cards.push({ node, x: pcx - card.w / 2, y, w: card.w, h: card.h });
          let cx = x + (w - rowW) / 2;
          const cy = y + card.h + sp.levelGap;
          for (const b of kids) {
            const anchor = b.place(cx, cy);
            connectors.push({ points: vElbow(pcx, y + card.h, anchor.cx, anchor.top) });
            cx += b.w + sp.cardGap;
          }
          return { cx: pcx, top: y };
        }
      };
    }

    function groupBlock(node) {
      const count = countMembers(node);
      if (collapsedIds.has(node.id)) {
        return {
          w: PILL.w, h: PILL.h,
          place(x, y) {
            containers.push({ node, x, y, w: PILL.w, h: PILL.h, collapsed: true, count });
            return { cx: x + PILL.w / 2, top: y };
          }
        };
      }
      const blocks = node.children.map(function (c) {
        return c.isGroup ? groupBlock(c) : nodeBlock(c);
      });
      const rows = [];
      for (let i = 0; i < blocks.length; i += settings.maxColumns) {
        rows.push(blocks.slice(i, i + settings.maxColumns));
      }
      function rowW(r) {
        return r.reduce(function (s, b) { return s + b.w; }, 0) +
          sp.cardGap * (r.length - 1);
      }
      const innerW = rows.length ? Math.max.apply(null, rows.map(rowW)) : 80;
      const innerH = rows.length
        ? rows.reduce(function (s, r) {
            return s + Math.max.apply(null, r.map(function (b) { return b.h; }));
          }, 0) + sp.cardGap * (rows.length - 1)
        : 20;
      const w = innerW + sp.pad * 2;
      const h = innerH + sp.pad * 2 + sp.labelH;
      return {
        w, h,
        place(x, y) {
          containers.push({ node, x, y, w, h, collapsed: false, count });
          let ry = y + sp.labelH + sp.pad;
          for (const r of rows) {
            const rw = rowW(r);
            let rx = x + (w - rw) / 2;
            const rh = Math.max.apply(null, r.map(function (b) { return b.h; }));
            for (const b of r) { b.place(rx, ry); rx += b.w + sp.cardGap; }
            ry += rh + sp.cardGap;
          }
          return { cx: x + w / 2, top: y };
        }
      };
    }

    // Task 4 replaces this stub top level with wrapping, orientation and filtering.
    const topBlocks = root.children.map(function (c) {
      return c.isGroup ? groupBlock(c) : nodeBlock(c);
    });
    const rootW = topBlocks.reduce(function (s, b) { return s + b.w; }, 0) +
      sp.containerGap * Math.max(0, topBlocks.length - 1);
    const chartW = Math.max(card.w, rootW) + MARGIN * 2;
    const rootX = chartW / 2 - card.w / 2;
    cards.push({ node: root, x: rootX, y: MARGIN, w: card.w, h: card.h });
    let bx = (chartW - rootW) / 2;
    const by = MARGIN + card.h + sp.levelGap;
    let maxH = 0;
    for (const b of topBlocks) {
      const anchor = b.place(bx, by);
      connectors.push({ points: vElbow(rootX + card.w / 2, MARGIN + card.h, anchor.cx, anchor.top) });
      bx += b.w + sp.containerGap;
      if (b.h > maxH) maxH = b.h;
    }
    return { width: chartW, height: by + maxH + MARGIN, cards, containers, connectors };
  }

  const api = { compute, CARD_SIZES, SPACING, PILL, MARGIN };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.layoutEngine = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
