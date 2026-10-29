/* 文章页：目录高亮 */
(function () {
  "use strict";

  var toc = document.querySelector(".toc");
  if (!toc) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
  if (!links.length) return;

  var targets = links
    .map(function (link) {
      var id = decodeURIComponent(link.getAttribute("href").slice(1));
      var el = document.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if (!targets.length) return;

  var active = null;
  var ticking = false;

  function update() {
    var line = window.scrollY + 140;
    var current = targets[0];
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].el.offsetTop <= line) current = targets[i];
    }
    if (current.link !== active) {
      if (active) active.parentElement.classList.remove("is-active");
      current.link.parentElement.classList.add("is-active");
      active = current.link;
    }
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    },
    { passive: true }
  );

  update();
})();
