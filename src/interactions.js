(function () {
  "use strict";

  function init(opts) {
    const viewport = opts.viewport, world = opts.world;
    const t = { x: 0, y: 0, scale: 1 };
    let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;

    function apply() {
      world.style.transform =
        "translate(" + t.x + "px," + t.y + "px) scale(" + t.scale + ")";
    }

    viewport.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY; ox = t.x; oy = t.y;
      viewport.classList.add("panning");
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      t.x = ox + dx; t.y = oy + dy;
      apply();
    });
    viewport.addEventListener("pointerup", function () {
      dragging = false;
      viewport.classList.remove("panning");
    });

    viewport.addEventListener("click", function (e) {
      if (moved) { moved = false; return; }
      const toggle = e.target.closest("[data-toggle-id]");
      if (toggle) { opts.onToggleContainer(toggle.dataset.toggleId); return; }
      const card = e.target.closest("[data-card-id]");
      if (card) opts.onCardClick(card.dataset.cardId);
    });

    viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const ns = Math.min(2.5, Math.max(0.2, t.scale * factor));
      const rect = viewport.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      // keep the point under the cursor stationary
      t.x = px - (px - t.x) * (ns / t.scale);
      t.y = py - (py - t.y) * (ns / t.scale);
      t.scale = ns;
      apply();
    }, { passive: false });

    function fit(size) {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      t.scale = Math.min(1, (vw / size.width) * 0.97, (vh / size.height) * 0.97);
      t.x = (vw - size.width * t.scale) / 2;
      t.y = (vh - size.height * t.scale) / 2;
      apply();
    }

    function centerOn(rect) {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      t.x = vw / 2 - (rect.x + rect.w / 2) * t.scale;
      t.y = vh / 2 - (rect.y + rect.h / 2) * t.scale;
      apply();
    }

    apply();
    return {
      fit: fit,
      centerOn: centerOn,
      getTransform: function () { return { x: t.x, y: t.y, scale: t.scale }; },
      setTransform: function (nt) { Object.assign(t, nt); apply(); }
    };
  }

  const api = { init };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.interactions = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
