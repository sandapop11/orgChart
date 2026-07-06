(function () {
  "use strict";

  const state = {
    adapted: null,
    settings: null,        // Task 10 replaces with settingsStore.load()
    collapsed: new Set(),
    selectedId: null,
    searchQuery: "",
    matches: [],
    matchIndex: 0,
    filterDept: null,
    controller: null,
    fitted: false
  };

  const DEFAULT_SETTINGS = {
    cardStyle: "portrait", orientation: "top-down", maxColumns: 4,
    spacing: "normal", theme: "system", deptColors: {},
    showPhotos: true, showTitles: true, showBadges: true, showEmpty: false
  };

  function $(id) { return document.getElementById(id); }

  async function loadData() {
    const cfg = window.OrgChartConfig || {};
    if (cfg.apiUrl) {
      try {
        const res = await fetch(cfg.apiUrl);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (!json || !Array.isArray(json.items)) throw new Error("unexpected JSON shape");
        return json.items;
      } catch (err) {
        console.warn("API load failed (" + err.message + "), falling back to data.js");
        if (window.maps && Array.isArray(window.maps.items)) return window.maps.items;
        throw err;
      }
    }
    if (window.maps && Array.isArray(window.maps.items)) return window.maps.items;
    throw new Error("No data source: set OrgChartConfig.apiUrl or include data.js");
  }

  function showError(err) {
    $("error-message").textContent = String(err.message || err);
    $("error-overlay").hidden = false;
  }

  function update() {
    const a = state.adapted;
    const viewport = $("viewport");
    const layoutSettings = Object.assign({}, state.settings, {
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      filterDepartmentId: state.filterDept
    });
    state.layout = OrgChart.layoutEngine.compute(a.root, layoutSettings, state.collapsed);
    OrgChart.renderer.render(state.layout, a, state.settings,
      { world: $("world"), svg: $("connectors") });
    $("status").textContent = "Loaded " +
      (a.nodesById.size - a.departments.length - 1) + " employees · " +
      a.departments.length + " departments" +
      (a.warnings.length ? " · " + a.warnings.length + " data warnings (see console)" : "");
    if (!state.fitted) { state.controller.fit(state.layout); state.fitted = true; }
  }

  async function boot() {
    $("error-overlay").hidden = true;
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    if (!state.controller) {
      state.controller = OrgChart.interactions.init({
        viewport: $("viewport"),
        world: $("world"),
        onCardClick: function (id) { console.log("card", id); }, // Task 8 replaces
        onToggleContainer: function (id) {
          if (state.collapsed.has(id)) state.collapsed.delete(id);
          else state.collapsed.add(id);
          update();
        }
      });
    }
    try {
      const items = await loadData();
      state.adapted = OrgChart.dataAdapter.adapt(items);
      state.adapted.warnings.forEach(function (w) { console.warn("[orgchart]", w); });
      update();
    } catch (err) {
      showError(err);
    }
  }

  $("btn-retry").addEventListener("click", boot);
  $("btn-fit").addEventListener("click", function () {
    state.controller.fit(state.layout);
  });
  window.addEventListener("resize", function () {
    if (state.adapted) update();
  });
  boot();

  window.OrgChart = window.OrgChart || {};
  window.OrgChart.app = { state, update, boot };
})();
