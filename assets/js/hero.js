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

  var TYPE_MS = 90;
  var DELETE_MS = 45;
  var HOLD_MS = 1500;
  var GAP_MS = 320;

  var index = 0;
  var chars = 0;
  var deleting = false;
  var bag = [];

  // 洗牌袋：每轮把全部句子打乱后依次抽，抽完再重洗。
  // 比纯随机更均匀，也不会连着两次抽到同一句。
  function refillBag() {
    var list = [];
    for (var i = 0; i < texts.length; i++) list.push(i);
    for (var j = list.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = list[j];
      list[j] = list[k];
      list[k] = tmp;
    }
    if (list.length > 1 && list[list.length - 1] === index) {
      var swap = list[list.length - 1];
      list[list.length - 1] = list[0];
      list[0] = swap;
    }
    bag = list;
  }

  function nextIndex() {
    if (!bag.length) refillBag();
    return bag.pop();
  }

  function fitFont(text) {
    var n = text.length;
    el.style.fontSize = n > 34 ? "0.6em" : n > 24 ? "0.76em" : n > 18 ? "0.9em" : "";
  }

  function tick() {
    var text = texts[index];

    if (!deleting) {
      if (chars === 0) fitFont(text);
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
      index = nextIndex();
      window.setTimeout(tick, GAP_MS + Math.random() * 260);
      return;
    }
    window.setTimeout(tick, DELETE_MS);
  }

  window.setTimeout(tick, 420);
})();
