(function () {
  "use strict";

  function exportPng(worldEl, size) {
    const prev = worldEl.style.transform;
    worldEl.style.transform = "none";
    return window.htmlToImage.toPng(worldEl, {
      width: size.width,
      height: size.height,
      backgroundColor:
        getComputedStyle(document.body).getPropertyValue("background-color"),
      pixelRatio: 2
    }).then(function (dataUrl) {
      worldEl.style.transform = prev;
      const a = document.createElement("a");
      a.download = "orgchart-" + new Date().toISOString().slice(0, 10) + ".png";
      a.href = dataUrl;
      a.click();
    }).catch(function (err) {
      worldEl.style.transform = prev;
      alert("Export failed: " + err.message +
        "\n(Cross-origin photos can block export when the app is not " +
        "hosted on the same domain as the images.)");
    });
  }

  // Scale the chart to fit one landscape page (~1050x730 css px at 96dpi A4).
  function preparePrint(worldEl, size) {
    worldEl.dataset.prePrintTransform = worldEl.style.transform;
    const s = Math.min(1050 / size.width, 730 / size.height, 1);
    worldEl.style.transform = "scale(" + s + ")";
  }
  function restoreAfterPrint(worldEl) {
    worldEl.style.transform = worldEl.dataset.prePrintTransform || "";
    delete worldEl.dataset.prePrintTransform;
  }

  const api = { exportPng, preparePrint, restoreAfterPrint };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.exporter = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
