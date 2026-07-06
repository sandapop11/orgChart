(function () {
  "use strict";

  function match(nodesById, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const node of nodesById.values()) {
      if (node.isGroup) continue;
      const hay = (node.displayName + " " + node.title + " " + node.department)
        .toLowerCase();
      if (hay.indexOf(q) !== -1) out.push(node.id);
    }
    return out;
  }

  const api = { match };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.searchModule = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
