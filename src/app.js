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

  function $(id) { return document.getElementById(id); }

  function applyTheme() {
    const pref = state.settings.theme;
    const dark = pref === "dark" ||
      (pref === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function () {
      if (state.adapted) applyTheme();
    });

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
    applySearchHighlight();
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

  function expandAncestorsOf(ids) {
    for (const id of ids) {
      let cur = state.adapted.nodesById.get(id);
      while (cur && cur.pid !== null) {
        cur = state.adapted.nodesById.get(cur.pid);
        if (cur) state.collapsed.delete(cur.id);
      }
    }
  }

  function applySearchHighlight() {
    document.querySelectorAll(".card--hit").forEach(function (n) {
      n.classList.remove("card--hit");
    });
    for (const id of state.matches) {
      const el = document.querySelector('[data-card-id="' + id + '"]');
      if (el) el.classList.add("card--hit");
    }
    $("search-count").textContent = state.matches.length
      ? (state.matchIndex + 1) + " of " + state.matches.length
      : (state.searchQuery.trim() ? "0 of 0" : "");
  }

  function goToMatch() {
    const id = state.matches[state.matchIndex];
    if (!id) return;
    const item = state.layout.cards.find(function (c) { return c.node.id === id; });
    if (item) state.controller.centerOn(item);
  }

  function runSearch(query) {
    state.searchQuery = query;
    state.matches = OrgChart.searchModule.match(state.adapted.nodesById, query);
    state.matchIndex = 0;
    expandAncestorsOf(state.matches);
    update();
    goToMatch();
  }

  async function boot() {
    $("error-overlay").hidden = true;
    state.settings = OrgChart.settingsStore.load();
    applyTheme();
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
      const sel = $("dept-filter");
      while (sel.options.length > 1) sel.remove(1);
      for (const d of state.adapted.departments) {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.displayName;
        sel.appendChild(opt);
      }
      OrgChart.settingsPanel.init($("settings-body"), state.settings,
        state.adapted.departments, function (s) {
          OrgChart.settingsStore.save(s);
          applyTheme();
          update();
        });
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
  $("settings-close").addEventListener("click", function () {
    $("settings-drawer").hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDetails(); $("settings-drawer").hidden = true; }
  });
  $("search-input").addEventListener("input", function (e) {
    runSearch(e.target.value);
  });
  $("search-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && state.matches.length) {
      state.matchIndex = (state.matchIndex + 1) % state.matches.length;
      applySearchHighlight();
      goToMatch();
    }
  });
  $("dept-filter").addEventListener("change", function (e) {
    state.filterDept = e.target.value || null;
    state.fitted = false; // re-fit for the new extent
    update();
  });
  $("btn-settings").addEventListener("click", function () {
    $("settings-drawer").hidden = !$("settings-drawer").hidden;
  });
  $("btn-export").addEventListener("click", function () {
    OrgChart.exporter.exportPng($("world"), state.layout);
  });
  $("btn-print").addEventListener("click", function () { window.print(); });
  window.addEventListener("beforeprint", function () {
    OrgChart.exporter.preparePrint($("world"), state.layout);
  });
  window.addEventListener("afterprint", function () {
    OrgChart.exporter.restoreAfterPrint($("world"));
  });
  window.addEventListener("resize", function () {
    if (state.adapted) update();
  });
  boot();

  window.OrgChart = window.OrgChart || {};
  window.OrgChart.app = { state, update, boot };
})();
