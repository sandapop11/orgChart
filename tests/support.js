"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

// Load each source file as a real <script> inside one jsdom window so that
// window.OrgChart.* become true globals (matching browser semantics, where
// src/app.js references bare `OrgChart`). Paths are relative to the repo root.
function makeWindow(files, opts) {
  opts = opts || {};
  const dom = new JSDOM(
    "<!doctype html><html><body>" + (opts.body || "") + "</body></html>",
    { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" }
  );
  const win = dom.window;
  win.matchMedia = win.matchMedia || function () {
    return { matches: false, addEventListener: function () {}, removeEventListener: function () {} };
  };
  win.print = win.print || function () {};
  for (const f of files) {
    const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    const s = win.document.createElement("script");
    s.textContent = code;
    win.document.body.appendChild(s);
  }
  return dom;
}

module.exports = { makeWindow };
