(function () {
  "use strict";

  function h(tag, attrs, kids) {
    var e = (tag === "svg")
      ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
      : document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (kids) {
      for (var i = 0; i < kids.length; i++) if (kids[i]) e.appendChild(kids[i]);
    }
    return e;
  }

  function build(options) {
    options = options || {};
    var showToolbar = options.showToolbar !== false;
    var els = {};

    var toolbar = null;
    if (showToolbar) {
      els.searchInput = h("input", { "class": "oc-search-input", type: "search",
        placeholder: "Search name, title, department…", autocomplete: "off" });
      els.searchCount = h("span", { "class": "oc-search-count" });
      els.deptFilter = h("select", { "class": "oc-dept-filter" },
        [ h("option", { value: "", text: "All departments" }) ]);
      els.btnFit = h("button", { type: "button", "class": "oc-btn oc-btn-fit", title: "Fit chart to screen", text: "⤢ Fit" });
      els.btnExport = h("button", { type: "button", "class": "oc-btn oc-btn-export", title: "Export as PNG", text: "⬇ Export" });
      els.btnPrint = h("button", { type: "button", "class": "oc-btn oc-btn-print", title: "Print / save as PDF", text: "🖨" });
      els.btnSettings = h("button", { type: "button", "class": "oc-btn oc-btn-settings", title: "Customize", text: "⚙" });
      toolbar = h("header", { "class": "oc-toolbar" }, [
        h("span", { "class": "oc-logo", text: "◈ OrgChart" }),
        els.searchInput, els.searchCount, els.deptFilter,
        h("span", { "class": "oc-spacer" }),
        els.btnFit, els.btnExport, els.btnPrint, els.btnSettings
      ]);
    }
    els.toolbar = toolbar;

    els.svg = h("svg", { "class": "oc-connectors", xmlns: "http://www.w3.org/2000/svg" });
    els.world = h("div", { "class": "oc-world" }, [els.svg]);
    els.status = h("div", { "class": "oc-status" });
    els.viewport = h("main", { "class": "oc-viewport" }, [els.world, els.status]);

    els.detailsBody = h("div", { "class": "oc-details-body" });
    els.detailsClose = h("button", { type: "button", "class": "oc-close", text: "✕" });
    els.detailsPanel = h("aside", { "class": "oc-details", hidden: "" },
      [els.detailsClose, els.detailsBody]);

    els.settingsBody = h("div", { "class": "oc-settings-body" });
    els.settingsClose = h("button", { type: "button", "class": "oc-close", text: "✕" });
    els.settingsDrawer = h("aside", { "class": "oc-settings-drawer", hidden: "" },
      [els.settingsClose, h("h2", { text: "Customize" }), els.settingsBody]);

    els.errorMessage = h("p", { "class": "oc-error-message" });
    els.btnRetry = h("button", { type: "button", "class": "oc-btn-retry", text: "Retry" });
    els.errorOverlay = h("div", { "class": "oc-error-overlay", hidden: "" }, [
      h("div", { "class": "oc-error-box" }, [
        h("h2", { text: "Could not load data" }),
        els.errorMessage, els.btnRetry
      ])
    ]);

    els.root = h("div", { "class": "orgchart-root" },
      [toolbar, els.viewport, els.detailsPanel, els.settingsDrawer, els.errorOverlay]);
    return els;
  }

  var api = { build: build };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.dom = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
