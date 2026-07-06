(function () {
  "use strict";

  function resolveTarget(target) {
    if (target && target.nodeType === 1) return target;
    if (typeof target === "string") {
      return document.getElementById(target) || document.querySelector(target);
    }
    return null;
  }

  function render(target, options) {
    options = options || {};
    var host = resolveTarget(target);
    if (!host) throw new Error("OrgChart.render: target element not found: " + target);

    var optSettings = options.settings || {};
    var showToolbar = optSettings.showToolbar !== false;
    var showFitButton = optSettings.showFitButton !== false;
    var showExportButton = optSettings.showExportButton !== false;
    var showPrintButton = optSettings.showPrintButton !== false;
    var showSettingsButton = optSettings.showSettingsButton !== false;
    var logoText = optSettings.logoText || "◈ OrgChart";
    var instanceId = options.instanceId || host.id || "default";

    var els = OrgChart.dom.build({
      showToolbar: showToolbar,
      showFitButton: showFitButton,
      showExportButton: showExportButton,
      showPrintButton: showPrintButton,
      showSettingsButton: showSettingsButton,
      logoText: logoText
    });
    host.appendChild(els.root);

    var state = {
      adapted: null, settings: null, collapsed: new Set(), selectedId: null,
      searchQuery: "", matches: [], matchIndex: 0, filterDept: null,
      controller: null, fitted: false, layout: null
    };

    var listeners = [];
    function on(t, type, fn, opts) {
      t.addEventListener(type, fn, opts);
      listeners.push({ target: t, type: type, fn: fn });
    }

    function prefersDark() {
      return typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function applyTheme() {
      var pref = state.settings.theme;
      var dark = pref === "dark" || (pref === "system" && prefersDark());
      els.root.dataset.theme = dark ? "dark" : "light";
    }
    var mq = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq && mq.addEventListener) {
      var onScheme = function () { if (state.adapted) applyTheme(); };
      mq.addEventListener("change", onScheme);
      listeners.push({ target: mq, type: "change", fn: onScheme });
    }

    async function loadData() {
      if (options.apiUrl) {
        try {
          var res = await fetch(options.apiUrl);
          if (!res.ok) throw new Error("HTTP " + res.status);
          var json = await res.json();
          if (!json || !Array.isArray(json.items)) throw new Error("unexpected JSON shape");
          return json.items;
        } catch (err) {
          console.warn("[orgchart] API load failed (" + err.message + "), falling back");
          if (Array.isArray(options.data)) return options.data;
          if (window.maps && Array.isArray(window.maps.items)) return window.maps.items;
          throw err;
        }
      }
      if (Array.isArray(options.data)) return options.data;
      if (window.maps && Array.isArray(window.maps.items)) return window.maps.items;
      throw new Error("No data source: pass options.data or options.apiUrl");
    }

    function showError(err) {
      els.errorMessage.textContent = String(err.message || err);
      els.errorOverlay.hidden = false;
    }

    function rebuildDeptOptions() {
      if (!els.deptFilter) return;
      while (els.deptFilter.options.length > 1) els.deptFilter.remove(1);
      for (var i = 0; i < state.adapted.departments.length; i++) {
        var d = state.adapted.departments[i];
        var opt = document.createElement("option");
        opt.value = d.id; opt.textContent = d.displayName;
        els.deptFilter.appendChild(opt);
      }
    }

    function update() {
      var a = state.adapted;
      var layoutSettings = Object.assign({}, state.settings, {
        viewportWidth: els.viewport.clientWidth,
        viewportHeight: els.viewport.clientHeight,
        filterDepartmentId: state.filterDept
      });
      state.layout = OrgChart.layoutEngine.compute(a.root, layoutSettings, state.collapsed);
      OrgChart.renderer.render(state.layout, a, state.settings,
        { world: els.world, svg: els.svg });
      els.status.textContent = "Loaded " +
        (a.nodesById.size - a.departments.length - 1) + " employees · " +
        a.departments.length + " departments" +
        (a.warnings.length ? " · " + a.warnings.length + " data warnings (see console)" : "");
      if (!state.fitted) { state.controller.fit(state.layout); state.fitted = true; }
      markSelected();
      applySearchHighlight();
    }

    function reportingPath(node) {
      var parts = [];
      var cur = node;
      while (cur && cur.pid !== null) {
        cur = state.adapted.nodesById.get(cur.pid);
        if (cur) parts.push(cur.displayName);
      }
      return parts.join(" → ") || "—";
    }

    function makeInitialsLg(node) {
      var R = OrgChart.renderer;
      var d = document.createElement("div");
      d.className = "avatar-lg";
      d.textContent = R.initials(node.displayName);
      d.style.background = R.avatarColor(node.displayName);
      return d;
    }

    function openDetails(id) {
      var node = state.adapted.nodesById.get(id);
      if (!node) return;
      state.selectedId = id;
      var body = els.detailsBody;
      body.innerHTML = "";

      var avatar;
      if (node.img) {
        avatar = document.createElement("img");
        avatar.src = node.img; avatar.alt = "";
        avatar.addEventListener("error", function () { avatar.replaceWith(makeInitialsLg(node)); });
      } else {
        avatar = makeInitialsLg(node);
      }
      avatar.classList.add("avatar-lg");
      body.appendChild(avatar);

      var h3 = document.createElement("h3");
      h3.textContent = node.displayName; body.appendChild(h3);
      var sub = document.createElement("div");
      sub.className = "sub"; sub.textContent = node.title; body.appendChild(sub);

      var dl = document.createElement("dl");
      var fields = [
        ["Department", node.department || "—"],
        ["Employee #", node.employeeNo || "—"],
        ["Reports to", reportingPath(node)],
        ["Tags", node.tags.filter(function (t) { return t !== "group"; }).join(", ") || "—"]
      ];
      for (var i = 0; i < fields.length; i++) {
        var dt = document.createElement("dt"); dt.textContent = fields[i][0];
        var dd = document.createElement("dd"); dd.textContent = fields[i][1];
        dl.appendChild(dt); dl.appendChild(dd);
      }
      body.appendChild(dl);

      els.detailsPanel.hidden = false;
      markSelected();
    }

    function closeDetails() {
      state.selectedId = null;
      els.detailsPanel.hidden = true;
      markSelected();
    }

    function markSelected() {
      var sel = els.world.querySelectorAll(".card--selected");
      for (var i = 0; i < sel.length; i++) sel[i].classList.remove("card--selected");
      if (state.selectedId) {
        var elc = els.world.querySelector('[data-card-id="' + state.selectedId + '"]');
        if (elc) elc.classList.add("card--selected");
      }
    }

    function expandAncestorsOf(ids) {
      for (var i = 0; i < ids.length; i++) {
        var cur = state.adapted.nodesById.get(ids[i]);
        while (cur && cur.pid !== null) {
          cur = state.adapted.nodesById.get(cur.pid);
          if (cur) state.collapsed.delete(cur.id);
        }
      }
    }

    function applySearchHighlight() {
      var hits = els.world.querySelectorAll(".card--hit");
      for (var i = 0; i < hits.length; i++) hits[i].classList.remove("card--hit");
      for (var j = 0; j < state.matches.length; j++) {
        var elc = els.world.querySelector('[data-card-id="' + state.matches[j] + '"]');
        if (elc) elc.classList.add("card--hit");
      }
      if (els.searchCount) {
        els.searchCount.textContent = state.matches.length
          ? (state.matchIndex + 1) + " of " + state.matches.length
          : (state.searchQuery.trim() ? "0 of 0" : "");
      }
    }

    function goToMatch() {
      var id = state.matches[state.matchIndex];
      if (!id) return;
      var item = state.layout.cards.find(function (c) { return c.node.id === id; });
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

    function ingest(items) {
      state.adapted = OrgChart.dataAdapter.adapt(items);
      state.adapted.warnings.forEach(function (w) { console.warn("[orgchart]", w); });
      rebuildDeptOptions();
    }

    async function boot() {
      els.errorOverlay.hidden = true;
      state.settings = OrgChart.settingsStore.load(instanceId);
      if (options.settings) Object.assign(state.settings, options.settings);
      applyTheme();
      if (!state.controller) {
        state.controller = OrgChart.interactions.init({
          viewport: els.viewport, world: els.world,
          onCardClick: openDetails,
          onToggleContainer: function (id) {
            if (state.collapsed.has(id)) state.collapsed.delete(id);
            else state.collapsed.add(id);
            update();
          }
        });
      }
      try {
        var items = await loadData();
        ingest(items);
        if (els.settingsBody) {
          OrgChart.settingsPanel.init(els.settingsBody, state.settings,
            state.adapted.departments, function (s) {
              OrgChart.settingsStore.save(instanceId, s);
              applyTheme();
              update();
            });
        }
        update();
      } catch (err) {
        showError(err);
      }
    }

    // --- event wiring (toolbar controls guarded for showToolbar:false) ---
    on(els.btnRetry, "click", boot);
    on(els.detailsClose, "click", closeDetails);
    on(els.settingsClose, "click", function () { els.settingsDrawer.hidden = true; });
    on(document, "keydown", function (e) {
      if (e.key === "Escape") { closeDetails(); els.settingsDrawer.hidden = true; }
    });
    if (els.btnFit) on(els.btnFit, "click", function () {
      if (state.layout) state.controller.fit(state.layout);
    });
    if (els.searchInput) {
      on(els.searchInput, "input", function (e) { runSearch(e.target.value); });
      on(els.searchInput, "keydown", function (e) {
        if (e.key === "Enter" && state.matches.length) {
          state.matchIndex = (state.matchIndex + 1) % state.matches.length;
          applySearchHighlight(); goToMatch();
        }
      });
    }
    if (els.deptFilter) on(els.deptFilter, "change", function (e) {
      state.filterDept = e.target.value || null;
      state.fitted = false;
      update();
    });
    if (els.btnSettings) on(els.btnSettings, "click", function () {
      els.settingsDrawer.hidden = !els.settingsDrawer.hidden;
    });
    if (els.btnExport) on(els.btnExport, "click", function () {
      OrgChart.exporter.exportPng(els.world, state.layout);
    });
    if (els.btnPrint) on(els.btnPrint, "click", function () { window.print(); });
    on(window, "beforeprint", function () {
      OrgChart.exporter.preparePrint(els.world, state.layout);
    });
    on(window, "afterprint", function () {
      OrgChart.exporter.restoreAfterPrint(els.world);
    });
    on(window, "resize", function () { if (state.adapted) update(); });

    boot();

    return {
      update: function (newData) {
        ingest(newData);
        update();
      },
      fit: function () { if (state.layout) state.controller.fit(state.layout); },
      destroy: function () {
        for (var i = 0; i < listeners.length; i++) {
          var L = listeners[i];
          if (L.target && L.target.removeEventListener) {
            L.target.removeEventListener(L.type, L.fn);
          }
        }
        listeners.length = 0;
        if (els.root.parentNode) els.root.parentNode.removeChild(els.root);
      }
    };
  }

  window.OrgChart = window.OrgChart || {};
  window.OrgChart.render = render;
})();
