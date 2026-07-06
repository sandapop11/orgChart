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

    // --- top level: visible children, wrapping rows/columns, orientation ---
    const horizontal = settings.orientation === "left-right";

    const visible = root.children.filter(function (c) {
      if (settings.filterDepartmentId) {
        return c.isGroup && c.id === settings.filterDepartmentId;
      }
      if (!settings.showEmpty && c.isGroup && countMembers(c) === 0) return false;
      return true;
    });
    const topBlocks = visible.map(function (c) {
      return c.isGroup ? groupBlock(c) : nodeBlock(c);
    });

    // group blocks into lines (rows when top-down, columns when left-right)
    const limit = horizontal
      ? Math.max(900, settings.viewportHeight || 0)
      : Math.max(1600, settings.viewportWidth || 0);
    const along = function (b) { return horizontal ? b.h : b.w; };
    const across = function (b) { return horizontal ? b.w : b.h; };
    const lines = [];
    let cur = [], curLen = 0;
    for (const b of topBlocks) {
      const extra = (cur.length ? sp.containerGap : 0) + along(b);
      if (cur.length && curLen + extra > limit) { lines.push(cur); cur = [b]; curLen = along(b); }
      else { cur.push(b); curLen += extra; }
    }
    if (cur.length) lines.push(cur);

    function lineLen(line) {
      return line.reduce(function (s, b) { return s + along(b); }, 0) +
        sp.containerGap * (line.length - 1);
    }
    const maxLine = lines.length ? Math.max.apply(null, lines.map(lineLen)) : 0;

    if (!horizontal) {
      const chartW = Math.max(card.w, maxLine) + MARGIN * 2;
      const rootX = chartW / 2 - card.w / 2;
      const rootCenterX = rootX + card.w / 2;
      const rootBottomY = MARGIN + card.h;
      cards.push({ node: root, x: rootX, y: MARGIN, w: card.w, h: card.h });
      const gutterX = MARGIN / 2;
      let ly = rootBottomY + sp.levelGap;
      let prevBottom = rootBottomY;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const len = lineLen(line);
        let lx = (chartW - len) / 2;
        const lh = Math.max.apply(null, line.map(across).concat([0]));

        if (li === 0) {
          // nothing sits between root and the first row: a direct elbow is safe.
          for (const b of line) {
            const anchor = b.place(lx, ly);
            connectors.push({ points: vElbow(rootCenterX, rootBottomY, anchor.cx, anchor.top) });
            lx += b.w + sp.containerGap;
          }
        } else {
          // later rows route through a side gutter so the trunk never crosses
          // over the rows placed above (a direct elbow would cut through them).
          const busY = (prevBottom + ly) / 2;
          const stubY = rootBottomY + sp.levelGap * 0.25;
          const anchors = [];
          for (const b of line) {
            anchors.push(b.place(lx, ly));
            lx += b.w + sp.containerGap;
          }
          const leftCx = Math.min.apply(null, anchors.map(function (a) { return a.cx; }));
          const rightCx = Math.max.apply(null, anchors.map(function (a) { return a.cx; }));
          connectors.push({ points: [
            { x: rootCenterX, y: rootBottomY },
            { x: rootCenterX, y: stubY },
            { x: gutterX, y: stubY },
            { x: gutterX, y: busY },
            { x: leftCx, y: busY }
          ] });
          if (anchors.length > 1) {
            connectors.push({ points: [{ x: leftCx, y: busY }, { x: rightCx, y: busY }] });
          }
          for (const a of anchors) {
            connectors.push({ points: [{ x: a.cx, y: busY }, { x: a.cx, y: a.top }] });
          }
        }
        prevBottom = ly + lh;
        ly += lh + sp.containerGap;
      }
      return { width: chartW, height: ly - sp.containerGap + MARGIN,
        cards, containers, connectors };
    }

    // left-right: root at left-center, blocks stacked in vertical columns
    const chartH = Math.max(card.h, maxLine) + MARGIN * 2;
    const rootY = chartH / 2 - card.h / 2;
    const rootRightX = MARGIN + card.w;
    const rootCenterY = rootY + card.h / 2;
    cards.push({ node: root, x: MARGIN, y: rootY, w: card.w, h: card.h });
    const gutterY = MARGIN / 2;
    let colX = rootRightX + sp.levelGap;
    let prevRight = rootRightX;
    for (let ci = 0; ci < lines.length; ci++) {
      const line = lines[ci];
      const len = lineLen(line);
      let by = (chartH - len) / 2;
      const colW = Math.max.apply(null, line.map(across).concat([0]));

      if (ci === 0) {
        for (const b of line) {
          b.place(colX, by);
          connectors.push({ points: hElbow(rootRightX, rootCenterY, colX, by + b.h / 2) });
          by += b.h + sp.containerGap;
        }
      } else {
        const busX = (prevRight + colX) / 2;
        const stubX = rootRightX + sp.levelGap * 0.25;
        const centers = [];
        for (const b of line) {
          b.place(colX, by);
          centers.push(by + b.h / 2);
          by += b.h + sp.containerGap;
        }
        const topCy = Math.min.apply(null, centers);
        const bottomCy = Math.max.apply(null, centers);
        connectors.push({ points: [
          { x: rootRightX, y: rootCenterY },
          { x: stubX, y: rootCenterY },
          { x: stubX, y: gutterY },
          { x: busX, y: gutterY },
          { x: busX, y: topCy }
        ] });
        if (centers.length > 1) {
          connectors.push({ points: [{ x: busX, y: topCy }, { x: busX, y: bottomCy }] });
        }
        for (const cy of centers) {
          connectors.push({ points: [{ x: busX, y: cy }, { x: colX, y: cy }] });
        }
      }
      prevRight = colX + colW;
      colX += colW + sp.containerGap;
    }
    return { width: colX - sp.containerGap + MARGIN, height: chartH,
      cards, containers, connectors };
  }

  const api = { compute, CARD_SIZES, SPACING, PILL, MARGIN };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.layoutEngine = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
