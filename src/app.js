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
    markSelected();
  }

  function reportingPath(node) {
    const parts = [];
    let cur = node;
    while (cur && cur.pid !== null) {
      cur = state.adapted.nodesById.get(cur.pid);
      if (cur) parts.push(cur.displayName);
    }
    return parts.join(" → ") || "—";
  }

  function openDetails(id) {
    const node = state.adapted.nodesById.get(id);
    if (!node) return;
    state.selectedId = id;
    const body = $("details-body");
    body.innerHTML = "";

    let avatar;
    if (node.img) {
      avatar = document.createElement("img");
      avatar.src = node.img;
      avatar.alt = "";
      avatar.addEventListener("error", function () {
        avatar.replaceWith(makeInitialsLg(node));
      });
    } else {
      avatar = makeInitialsLg(node);
    }
    avatar.classList.add("avatar-lg");
    body.appendChild(avatar);

    const h3 = document.createElement("h3");
    h3.textContent = node.displayName;
    body.appendChild(h3);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = node.title;
    body.appendChild(sub);

    const dl = document.createElement("dl");
    const fields = [
      ["Department", node.department || "—"],
      ["Employee #", node.employeeNo || "—"],
      ["Reports to", reportingPath(node)],
      ["Tags", node.tags.filter(function (t) { return t !== "group"; }).join(", ") || "—"]
    ];
    for (const f of fields) {
      const dt = document.createElement("dt"); dt.textContent = f[0];
      const dd = document.createElement("dd"); dd.textContent = f[1];
      dl.appendChild(dt); dl.appendChild(dd);
    }
    body.appendChild(dl);

    $("details-panel").hidden = false;
    markSelected();
  }

  function makeInitialsLg(node) {
    const R = OrgChart.renderer;
    const d = document.createElement("div");
    d.className = "avatar-lg"; // keeps the class when replacing a failed <img>
    d.textContent = R.initials(node.displayName);
    d.style.background = R.avatarColor(node.displayName);
    return d;
  }

  function closeDetails() {
    state.selectedId = null;
    $("details-panel").hidden = true;
    markSelected();
  }

  function markSelected() {
    document.querySelectorAll(".card--selected").forEach(function (n) {
      n.classList.remove("card--selected");
    });
    if (state.selectedId) {
      const el = document.querySelector('[data-card-id="' + state.selectedId + '"]');
      if (el) el.classList.add("card--selected");
    }
  }

  async function boot() {
    $("error-overlay").hidden = true;
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    if (!state.controller) {
      state.controller = OrgChart.interactions.init({
        viewport: $("viewport"),
        world: $("world"),
        onCardClick: openDetails,
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
  $("details-close").addEventListener("click", closeDetails);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDetails(); $("settings-drawer").hidden = true; }
  });
  window.addEventListener("resize", function () {
    if (state.adapted) update();
  });
  boot();

  window.OrgChart = window.OrgChart || {};
  window.OrgChart.app = { state, update, boot };
})();
