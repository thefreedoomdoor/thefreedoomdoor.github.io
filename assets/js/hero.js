/* 首页打字机：句子来自 content/site.json，构建时内联到 data-text */
(function () {
  "use strict";

  var el = document.getElementById("typewriter");
  if (!el) return;

  var texts = [];
  try {
    texts = JSON.parse(el.getAttribute("data-text") || "[]") || [];
  } catch (error) {
    texts = [];
  }
  texts = texts.filter(function (t) {
    return typeof t === "string" && t.length > 0;
  });
  if (!texts.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    el.textContent = texts[0];
    return;
  }

  var TYPE_MS = 90;
  var DELETE_MS = 45;
  var HOLD_MS = 1500;
  var GAP_MS = 320;

  var index = 0;
  var chars = 0;
  var deleting = false;

  function tick() {
    var text = texts[index];

    if (!deleting) {
      el.textContent = text.slice(0, ++chars);
      if (chars >= text.length) {
        deleting = true;
        window.setTimeout(tick, HOLD_MS);
        return;
      }
      window.setTimeout(tick, TYPE_MS + Math.random() * 40);
      return;
    }

    el.textContent = text.slice(0, --chars);
    if (chars <= 0) {
      deleting = false;
      index = (index + 1) % texts.length;
      window.setTimeout(tick, GAP_MS);
      return;
    }
    window.setTimeout(tick, DELETE_MS);
  }

  window.setTimeout(tick, 420);
})();
