(function () {
  "use strict";

  const DEFAULTS = {
    cardStyle: "portrait", orientation: "top-down", maxColumns: 4,
    spacing: "normal", theme: "system", deptColors: {},
    showPhotos: true, showTitles: true, showBadges: true, showEmpty: false
  };

  function keyFor(instanceId) {
    return "orgchart.settings." + (instanceId || "default");
  }

  const settingsStore = {
    DEFAULTS: DEFAULTS,
    load: function (instanceId) {
      try {
        const raw = localStorage.getItem(keyFor(instanceId));
        if (!raw) return Object.assign({}, DEFAULTS, { deptColors: {} });
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULTS, parsed,
          { deptColors: Object.assign({}, parsed.deptColors) });
      } catch (e) {
        return Object.assign({}, DEFAULTS, { deptColors: {} });
      }
    },
    save: function (instanceId, settings) {
      try { localStorage.setItem(keyFor(instanceId), JSON.stringify(settings)); } catch (e) {}
    }
  };

  function field(labelText, control) {
    const wrap = document.createElement("label");
    wrap.className = "setting";
    const span = document.createElement("span");
    span.textContent = labelText;
    wrap.appendChild(span);
    wrap.appendChild(control);
    return wrap;
  }

  function select(value, options, onInput) {
    const s = document.createElement("select");
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o[0]; opt.textContent = o[1];
      s.appendChild(opt);
    }
    s.value = value;
    s.addEventListener("change", function () { onInput(s.value); });
    return s;
  }

  function checkbox(checked, onInput) {
    const c = document.createElement("input");
    c.type = "checkbox"; c.checked = checked;
    c.addEventListener("change", function () { onInput(c.checked); });
    return c;
  }

  const settingsPanel = {
    init: function (bodyEl, settings, departments, onChange) {
      bodyEl.innerHTML = "";
      function changed() { onChange(settings); }

      bodyEl.appendChild(field("Card style", select(settings.cardStyle, [
        ["portrait", "Portrait"], ["classic", "Classic"], ["compact", "Compact"]
      ], function (v) { settings.cardStyle = v; changed(); })));

      bodyEl.appendChild(field("Orientation", select(settings.orientation, [
        ["top-down", "Top-down"], ["left-right", "Left-right"]
      ], function (v) { settings.orientation = v; changed(); })));

      const cols = document.createElement("input");
      cols.type = "range"; cols.min = "2"; cols.max = "8"; cols.step = "1";
      cols.value = String(settings.maxColumns);
      cols.addEventListener("input", function () {
        settings.maxColumns = Number(cols.value); changed();
      });
      bodyEl.appendChild(field("Max cards per row (" + settings.maxColumns + ")", cols));

      bodyEl.appendChild(field("Spacing", select(settings.spacing, [
        ["compact", "Compact"], ["normal", "Normal"], ["roomy", "Roomy"]
      ], function (v) { settings.spacing = v; changed(); })));

      bodyEl.appendChild(field("Theme", select(settings.theme, [
        ["light", "Light"], ["dark", "Dark"], ["system", "System"]
      ], function (v) { settings.theme = v; changed(); })));

      bodyEl.appendChild(field("Show photos",
        checkbox(settings.showPhotos, function (v) { settings.showPhotos = v; changed(); })));
      bodyEl.appendChild(field("Show job titles",
        checkbox(settings.showTitles, function (v) { settings.showTitles = v; changed(); })));
      bodyEl.appendChild(field("Show department badges",
        checkbox(settings.showBadges, function (v) { settings.showBadges = v; changed(); })));
      bodyEl.appendChild(field("Show empty departments",
        checkbox(settings.showEmpty, function (v) { settings.showEmpty = v; changed(); })));

      const h = document.createElement("h3");
      h.textContent = "Department colors";
      bodyEl.appendChild(h);
      const R = window.OrgChart.renderer;
      for (const d of departments) {
        const color = document.createElement("input");
        color.type = "color";
        color.value = R.deptColorFor(d.id, { departments: departments }, settings);
        color.addEventListener("input", function () {
          settings.deptColors[d.id] = color.value; changed();
        });
        bodyEl.appendChild(field(d.displayName, color));
      }

      const reset = document.createElement("button");
      reset.textContent = "Reset to defaults";
      reset.addEventListener("click", function () {
        const fresh = Object.assign({}, DEFAULTS, { deptColors: {} });
        Object.keys(settings).forEach(function (k) { delete settings[k]; });
        Object.assign(settings, fresh);
        settingsPanel.init(bodyEl, settings, departments, onChange);
        changed();
      });
      bodyEl.appendChild(reset);
    }
  };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.settingsStore = settingsStore;
    window.OrgChart.settingsPanel = settingsPanel;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { settingsStore, settingsPanel };
  }
})();
