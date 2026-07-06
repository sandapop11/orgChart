(function () {
  "use strict";

  const PALETTE = ["#6366f1", "#d97706", "#059669", "#dc2626", "#0891b2",
    "#7c3aed", "#db2777", "#65a30d", "#0d9488", "#b45309"];

  function initials(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    const first = words[0][0] || "";
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function nameHash(name) {
    let h = 0;
    const s = String(name || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function avatarColor(name) { return "hsl(" + (nameHash(name) % 360) + ", 60%, 82%)"; }
  function avatarText(name)  { return "hsl(" + (nameHash(name) % 360) + ", 45%, 28%)"; }

  function deptColorFor(deptId, adapted, settings) {
    if (deptId && settings.deptColors && settings.deptColors[deptId]) {
      return settings.deptColors[deptId];
    }
    const i = adapted.departments.findIndex(function (d) { return d.id === deptId; });
    return i === -1 ? PALETTE[0] : PALETTE[i % PALETTE.length];
  }

  function el(tag, className, parent) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (parent) parent.appendChild(e);
    return e;
  }

  function avatarEl(node, settings) {
    if (settings.showPhotos && node.img) {
      const img = document.createElement("img");
      img.className = "avatar";
      img.src = node.img;
      img.alt = "";
      img.addEventListener("error", function () {
        img.replaceWith(initialsEl(node));
      });
      return img;
    }
    return initialsEl(node);
  }

  function initialsEl(node) {
    const d = document.createElement("div");
    d.className = "avatar";
    d.textContent = initials(node.displayName);
    d.style.background = avatarColor(node.displayName);
    d.style.color = avatarText(node.displayName);
    return d;
  }

  function cardEl(item, adapted, settings) {
    const node = item.node;
    const c = el("div", "card card--" + settings.cardStyle);
    c.dataset.cardId = node.id;
    c.style.left = item.x + "px";
    c.style.top = item.y + "px";
    c.style.width = item.w + "px";
    c.style.height = item.h + "px";
    c.style.setProperty("--orgchart-accent", deptColorFor(node.deptId, adapted, settings));

    if (settings.cardStyle === "portrait") {
      el("div", "band", c);
      c.appendChild(avatarEl(node, settings));
      el("div", "name", c).textContent = node.displayName;
      if (settings.showTitles) el("div", "title", c).textContent = node.title;
      if (settings.showBadges && node.department) {
        el("div", "badge", c).textContent = node.department;
      }
    } else {
      c.appendChild(avatarEl(node, settings));
      const text = el("div", "text", c);
      if (settings.showBadges && settings.cardStyle === "classic" && node.department) {
        el("div", "badge", text).textContent = node.department;
      }
      el("div", "name", text).textContent = node.displayName;
      if (settings.showTitles) el("div", "title", text).textContent = node.title;
      if (settings.cardStyle === "compact") el("div", "dot", c);
    }
    return c;
  }

  function containerEl(item, adapted, settings) {
    const box = el("div", "container-box" + (item.collapsed ? " collapsed" : ""));
    box.style.left = item.x + "px";
    box.style.top = item.y + "px";
    box.style.width = item.w + "px";
    box.style.height = item.h + "px";
    box.style.setProperty("--orgchart-accent",
      deptColorFor(item.node.deptId, adapted, settings));
    const label = el("div", "label", box);
    label.dataset.toggleId = item.node.id;
    label.textContent = item.node.displayName.toUpperCase() + " · " + item.count +
      (item.collapsed ? " ▸" : " ▾");
    if (item.collapsed) box.dataset.toggleId = item.node.id;
    return box;
  }

  function render(layoutResult, adapted, settings, mounts) {
    const world = mounts.world, svg = mounts.svg;
    world.querySelectorAll(".card, .container-box").forEach(function (n) { n.remove(); });
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    world.style.width = layoutResult.width + "px";
    world.style.height = layoutResult.height + "px";
    svg.setAttribute("width", layoutResult.width);
    svg.setAttribute("height", layoutResult.height);

    for (const conn of layoutResult.connectors) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", conn.points.map(function (p, i) {
        return (i ? "L" : "M") + p.x + "," + p.y;
      }).join(" "));
      svg.appendChild(path);
    }
    for (const item of layoutResult.containers) {
      world.appendChild(containerEl(item, adapted, settings));
    }
    for (const item of layoutResult.cards) {
      world.appendChild(cardEl(item, adapted, settings));
    }
  }

  const api = { render, initials, avatarColor, deptColorFor, PALETTE };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.renderer = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
