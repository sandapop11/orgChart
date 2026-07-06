(function () {
  "use strict";

  function parseTags(raw) {
    if (Array.isArray(raw)) return raw.slice();
    if (typeof raw !== "string") return [];
    const tags = [];
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(raw)) !== null) tags.push(m[1]);
    return tags;
  }

  function normalizeImageUrl(raw) {
    if (typeof raw !== "string" || raw.trim() === "") return "";
    try {
      return new URL(raw.replace(/\\\//g, "/")).href;
    } catch (e) {
      return "";
    }
  }

  function splitName(raw) {
    const name = typeof raw === "string" ? raw.trim() : "";
    const m = name.match(/^(.*?)\s*\((\d+)\)$/);
    if (m) return { displayName: m[1], employeeNo: m[2] };
    return { displayName: name, employeeNo: null };
  }

  function adapt(rawItems) {
    const warnings = [];
    const nodesById = new Map();

    for (const item of rawItems || []) {
      const id = String(item.id);
      if (nodesById.has(id)) {
        warnings.push("duplicate id " + id + ": kept first item, ignored later one");
        continue;
      }
      const parts = splitName(item.name);
      const tags = parseTags(item.tags);
      nodesById.set(id, {
        id,
        pid: item.pid === undefined || item.pid === null || item.pid === ""
          ? null : String(item.pid),
        name: typeof item.name === "string" ? item.name : "",
        displayName: parts.displayName,
        employeeNo: parts.employeeNo,
        title: item.title || "",
        department: item.DEPARTMENT_NAME || "",
        img: normalizeImageUrl(item.img),
        tags,
        isGroup: tags.indexOf("group") !== -1,
        deptId: null,
        children: []
      });
    }

    const root = linkTree(nodesById, warnings);
    assignDeptIds(root, null);

    const departments = [];
    for (const node of nodesById.values()) if (node.isGroup) departments.push(node);

    return { root, nodesById, departments, warnings };
  }

  // Task 2 extends this with orphan/cycle/multi-root repairs.
  function linkTree(nodesById, warnings) {
    // break circular pid chains first
    for (const node of nodesById.values()) {
      const seen = new Set([node.id]);
      let cur = node;
      while (cur.pid !== null) {
        const parent = nodesById.get(cur.pid);
        if (!parent) break;
        if (seen.has(parent.id)) {
          warnings.push("circular pid chain broken at id " + cur.id);
          cur.pid = null;
          break;
        }
        seen.add(parent.id);
        cur = parent;
      }
    }

    // pick the root: first node (insertion order) with no pid
    let root = null;
    for (const node of nodesById.values()) {
      if (node.pid === null) { root = node; break; }
    }
    if (!root) throw new Error("no root node found");

    for (const node of nodesById.values()) {
      if (node === root) continue;
      let parent = node.pid !== null ? nodesById.get(node.pid) : undefined;
      if (!parent) {
        warnings.push("orphan node " + node.id + " (pid " + node.pid +
          " not found): attached to root");
        node.pid = root.id;
        parent = root;
      }
      parent.children.push(node);
    }
    return root;
  }

  function assignDeptIds(node, currentDeptId) {
    if (!node) return;
    node.deptId = node.isGroup ? node.id : currentDeptId;
    const nextDept = node.isGroup ? node.id : currentDeptId;
    for (const child of node.children) assignDeptIds(child, nextDept);
  }

  const api = { adapt };

  if (typeof window !== "undefined") {
    window.OrgChart = window.OrgChart || {};
    window.OrgChart.dataAdapter = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
