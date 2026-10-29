/* 全站通用行为：导航隐藏、进度条、移动端菜单、代码复制、本地识别 */
(function () {
  "use strict";

  var nav = document.querySelector(".site-nav");
  var progress = document.querySelector(".progress span");
  var menu = document.querySelector(".mobile-menu");
  var toggle = document.querySelector(".nav-toggle");
  var lastY = window.scrollY;
  var ticking = false;

  function updateProgress() {
    if (!progress) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    progress.style.transform = "scaleX(" + ratio + ")";
  }

  function onScroll() {
    var y = window.scrollY;
    var delta = y - lastY;
    var menuOpen = menu && menu.classList.contains("is-open");

    if (nav) {
      nav.classList.toggle("is-scrolled", y > 8);
      if (!menuOpen && y > 96 && delta > 6) {
        nav.classList.add("is-hidden");
      } else if (delta < -6 || y <= 96) {
        nav.classList.remove("is-hidden");
      }
    }

    updateProgress();
    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (nav) nav.classList.remove("is-hidden");
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-copy]");
    if (!btn) return;
    var block = btn.closest(".code-block");
    var code = block && block.querySelector("pre code");
    if (!code) return;
    navigator.clipboard.writeText(code.textContent || "").then(
      function () {
        var old = btn.textContent;
        btn.textContent = "已复制";
        window.setTimeout(function () {
          btn.textContent = old;
        }, 1400);
      },
      function () {
        btn.textContent = "复制失败";
      }
    );
  });

  var host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    document.body.classList.add("is-local");
  }

  updateProgress();
})();
