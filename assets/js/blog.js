/* 博客页：目录折叠、搜索、排序 */
(function () {
  "use strict";

  var tree = document.querySelector(".tree");
  if (!tree) return;

  var search = document.getElementById("blogSearch");
  var sort = document.getElementById("blogSort");
  var empty = document.querySelector(".empty-state");
  var counter = document.querySelector(".blog-count");
  var posts = Array.prototype.slice.call(tree.querySelectorAll(".tree-post"));
  var folders = Array.prototype.slice.call(tree.querySelectorAll(".tree-folder"));

  folders.forEach(function (folder) {
    var toggle = folder.querySelector(":scope > button.tree-row");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var collapsed = folder.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  });

  function visiblePosts() {
    return posts.filter(function (li) {
      return !li.hidden;
    }).length;
  }

  function updateCounter() {
    if (!counter) return;
    var total = posts.length;
    var shown = visiblePosts();
    counter.textContent =
      shown === total
        ? total + " 篇 · 共 " + folders.length + " 个目录"
        : "显示 " + shown + " / " + total + " 篇";
  }

  function applySearch(raw) {
    var query = (raw || "").trim().toLowerCase();

    posts.forEach(function (li) {
      if (!query) {
        li.hidden = false;
        return;
      }
      var haystack = (li.getAttribute("data-search") || "").toLowerCase();
      var inFolder = false;
      var parent = li.parentElement;
      while (parent && parent !== tree) {
        if (parent.classList && parent.classList.contains("tree-folder")) {
          var name = parent.getAttribute("data-folder-name") || "";
          if (name.toLowerCase().indexOf(query) !== -1) {
            inFolder = true;
            break;
          }
        }
        parent = parent.parentElement;
      }
      li.hidden = !(haystack.indexOf(query) !== -1 || inFolder);
    });

    folders.forEach(function (folder) {
      var shown = folder.querySelectorAll(".tree-post:not([hidden])").length;
      folder.hidden = query ? shown === 0 : false;
      if (query && shown > 0) {
        folder.classList.remove("is-collapsed");
        var row = folder.querySelector(":scope > button.tree-row");
        if (row) row.setAttribute("aria-expanded", "true");
      }
      var badge = folder.querySelector(":scope > .tree-row .count");
      if (badge) {
        var total = folder.querySelectorAll(".tree-post").length;
        badge.textContent = query && shown !== total ? shown + "/" + total : String(total);
      }
    });

    if (empty) empty.classList.toggle("is-visible", visiblePosts() === 0);
    updateCounter();
  }

  function sortPosts(mode) {
    var containers = tree.querySelectorAll(".tree-children");
    Array.prototype.forEach.call(containers, function (ul) {
      var kids = Array.prototype.slice.call(ul.children);
      var subFolders = kids.filter(function (el) {
        return el.classList.contains("tree-folder");
      });
      var items = kids.filter(function (el) {
        return el.classList.contains("tree-post");
      });
      if (items.length < 2) return;

      items.sort(function (a, b) {
        if (mode === "title-asc") {
          return (a.getAttribute("data-title") || "").localeCompare(
            b.getAttribute("data-title") || "",
            "zh-Hans-CN"
          );
        }
        var da = a.getAttribute("data-date") || "";
        var db = b.getAttribute("data-date") || "";
        if (mode === "date-asc") return da < db ? -1 : da > db ? 1 : 0;
        return da > db ? -1 : da < db ? 1 : 0;
      });

      subFolders.forEach(function (el) {
        ul.appendChild(el);
      });
      items.forEach(function (el) {
        ul.appendChild(el);
      });
    });
  }

  if (search) {
    search.addEventListener("input", function () {
      applySearch(search.value);
    });
  }

  if (sort) {
    sort.addEventListener("change", function () {
      sortPosts(sort.value);
    });
  }

  updateCounter();
})();
