// ============ 首页 · 外观调节（显示模式 / 背景透明度 / 卡片透明度） ============
// 数据契约：localStorage['appearance_v1'] = { mode: 'banner'|'cover', bgOpacity: 0..1, cardOpacity: 0.2..1 }
//   mode        'banner' = 贴顶通栏横幅（默认）；'cover' = 轮播整幅变为全视口固定背景层
//   bgOpacity   轮播图片层不透明度，1 = 图片清晰，0 = 只剩品牌渐变底
//   cardOpacity 玻璃面不透明度（写入 :root 的 --glass-alpha），0.5 = 改造前原样
//   面板契约：两个透明度滑块只在覆盖模式下提供（横幅模式整组 hidden，但数值不丢）；
//             隐藏的是控件，不是设置 —— 切回覆盖模式时按 state 原样回灌。
//
// 为什么这个文件在 <head> 里同步加载（而不是 defer）：
//   覆盖模式会把 .blog-carousel 从流内横幅改为 fixed 背景层，内容起始位置随之从「横幅之下」
//   变成「导航之下」。若等 defer 脚本再应用，每次进首页都会先按横幅排一遍版、再跳一次。
//   因此本模块必须在首次绘制前把 <html> 的类名与 CSS 变量写好；面板交互在 DOM 就绪后绑定。
//   同步加载也意味着 ui.js 必须先于本文件同步加载（存储 / 弹窗全部复用 UI，见 index.html 注释）。
//
// 容错：localStorage 不可用 / JSON 损坏 / 字段非法，一律回落到默认值（默认值 = 改造前外观）。
// 非首页（页面上没有触发器）只应用状态、不绑定交互，静默退出。
(function () {
  'use strict';

  var KEY = 'appearance_v1';
  var MODES = ['banner', 'cover'];
  var DEFAULTS = { mode: 'banner', bgOpacity: 1, cardOpacity: 0.5 };
  // 卡片透明度下限：覆盖模式下卡片背后是照片，再低正文对比度就不达标了。
  // 图片层可以调到 0（此时露出的是品牌渐变底，正文仍在浅色背景上）。
  var CARD_MIN = 0.2;
  var CARD_MIN_PCT = 20;

  var root = document.documentElement;

  // 数值规整：非数字 / 越界一律夹到合法区间，绝不把非法值写进样式
  function clampNum(v, min, max, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // 读取并规整：损坏 / 越界 / 缺字段全部回落默认值
  function readState() {
    var raw = UI.loadJSON(KEY);
    var s = (raw && typeof raw === 'object') ? raw : {};
    return {
      mode: MODES.indexOf(s.mode) >= 0 ? s.mode : DEFAULTS.mode,
      bgOpacity: clampNum(s.bgOpacity, 0, 1, DEFAULTS.bgOpacity),
      cardOpacity: clampNum(s.cardOpacity, CARD_MIN, 1, DEFAULTS.cardOpacity),
    };
  }

  var state = readState();

  // 应用：类名管布局模式，两个 CSS 变量管透明度（:root 上的变量让所有玻璃面统一跟随）
  function apply() {
    root.classList.toggle('app-cover', state.mode === 'cover');
    root.style.setProperty('--bg-image-opacity', String(state.bgOpacity));
    root.style.setProperty('--glass-alpha', String(state.cardOpacity));
    // 覆盖模式下整层是纯装饰背景：对读屏隐藏，避免把无交互的图片当内容播报
    var carousel = document.getElementById('blogCarousel');
    if (carousel) carousel.setAttribute('aria-hidden', state.mode === 'cover' ? 'true' : 'false');
  }

  function persist() { UI.saveJSON(KEY, state); }

  apply();

  // ---- 面板交互 ----
  function init() {
    // <head> 阶段 #blogCarousel 还不存在，apply() 里的 aria-hidden 需要在 DOM 就绪后补一次
    apply();

    var btn = document.getElementById('appearanceBtn');
    var modal = document.getElementById('appearanceModal');
    if (!btn || !modal) return; // 非首页（无触发器 / 无面板）静默退出

    var closeBtn = document.getElementById('appearanceClose');
    var modes = document.getElementById('appearanceModes');
    var sliders = document.getElementById('appearanceSliders');
    var bg = document.getElementById('appearanceBg');
    var card = document.getElementById('appearanceCard');
    var bgVal = document.getElementById('appearanceBgVal');
    var cardVal = document.getElementById('appearanceCardVal');
    var reset = document.getElementById('appearanceReset');

    // 拖动滑块时用 rAF 合并写入：每个 input 事件都改 --glass-alpha 会让所有
    // backdrop-filter 玻璃面重绘一次，逐事件写会掉帧
    var rafId = null;
    function scheduleApply() {
      if (rafId) return;
      rafId = requestAnimationFrame(function () { rafId = null; apply(); });
    }

    function setRangeText(input, label, pct) {
      input.setAttribute('aria-valuetext', pct + '%');
      label.textContent = pct + '%';
    }

    // 把 state 回灌到控件（打开面板 / 切换模式 / 重置后都要保持一致）
    function syncControls() {
      modes.querySelectorAll('.appearance-mode').forEach(function (b) {
        var on = b.dataset.mode === state.mode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      // 两个滑块只在覆盖模式下提供：横幅模式背后是纯渐变底，图片层不透明度看不出差别，
      // 卡片透明度也不是这个模式要解决的问题。用原生 hidden 整组收起（同时移出 tab 序与
      // 可访问性树，读屏与键盘都不会再碰到它们）。注意隐藏的只是控件：state 里的数值照旧
      // 持久化并在切回覆盖模式时原样回灌，不重置、不丢弃。
      if (sliders) sliders.hidden = state.mode !== 'cover';
      var bgPct = Math.round(state.bgOpacity * 100);
      var cardPct = Math.round(state.cardOpacity * 100);
      bg.value = String(bgPct);
      card.value = String(cardPct);
      setRangeText(bg, bgVal, bgPct);
      setRangeText(card, cardVal, cardPct);
    }

    // 模式切换会改变页面总高度：必须重测 Lenis 滚动上限与 ScrollTrigger 位置，
    // 否则沿用旧高度会滚不到底（作品页网格渲染后踩过同一个坑）。
    function refreshFx() {
      if (window.FX && typeof FX.refresh === 'function') FX.refresh();
    }

    function open() {
      // 窄屏下导航下拉菜单与面板同在右上/右侧，先收起菜单避免叠在一起
      var links = document.querySelector('.nav-links');
      if (links) links.classList.remove('open');
      syncControls();
      UI.openModal(modal);
      btn.setAttribute('aria-expanded', 'true');
      // 焦点落到第一个「当下可用」的控件（键盘用户不必先 Tab 一圈）：
      //   覆盖模式 → 滑块已显示，落在背景透明度滑块；
      //   横幅模式 → 滑块是 hidden，对隐藏元素 focus() 会被浏览器静默忽略（键盘按键全部落空），
      //             退回模式组里的按钮。
      // 这里可以同步聚焦：.appearance-modal 覆盖了骨架的 visibility 过渡（见 home.css），
      // 打开当帧计算值就是 visible；不像日历弹层那样需要等 300ms 过渡。
      var first = (sliders && !sliders.hidden) ? bg : modes.querySelector('.appearance-mode');
      if (first) first.focus();
    }

    function close() {
      UI.closeModal(modal);
      btn.setAttribute('aria-expanded', 'false');
      btn.focus(); // 焦点归位，键盘用户不会掉回页首
    }

    btn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    UI.bindDismiss('.appearance-modal', close); // 遮罩点击 + Esc

    // 模式切换
    modes.addEventListener('click', function (e) {
      var b = e.target.closest('.appearance-mode');
      if (!b) return;
      var next = b.dataset.mode === 'cover' ? 'cover' : 'banner';
      if (next === state.mode) return;
      // 切到横幅会把整组滑块隐藏。若此刻焦点正落在滑块里，隐藏会把焦点抛回 body
      //（Safari 点击按钮不移动焦点，键盘用户会直接掉出面板），所以先记录、切换后交接。
      var focusWasInSliders = !!sliders && sliders.contains(document.activeElement);
      state.mode = next;
      syncControls();
      // 只有「焦点原本在滑块里、切换后滑块被隐藏」这一种需要交接；
      // 切到覆盖时滑块可见，焦点保持不动即可。
      if (focusWasInSliders && sliders.hidden) b.focus();
      persist();
      apply();
      refreshFx();
    });

    // 滑块：input 只做实时预览（rAF 合并），change（松手）才落盘
    function bindRange(input, label, onInput) {
      input.addEventListener('input', function () {
        var pct = Math.round(clampNum(input.value, Number(input.min), Number(input.max), Number(input.value)));
        setRangeText(input, label, pct);
        onInput(pct);
        scheduleApply();
      });
      input.addEventListener('change', function () {
        apply();
        persist();
      });
    }

    bindRange(bg, bgVal, function (pct) { state.bgOpacity = pct / 100; });
    bindRange(card, cardVal, function (pct) { state.cardOpacity = pct / 100; });

    reset.addEventListener('click', function () {
      // 与模式切换同一个坑：重置会回到横幅模式并把滑块隐藏，
      // 焦点若在滑块里必须先记下来，之后交回按钮，否则掉回 body。
      var focusWasInSliders = !!sliders && sliders.contains(document.activeElement);
      state = {
        mode: DEFAULTS.mode,
        bgOpacity: DEFAULTS.bgOpacity,
        cardOpacity: DEFAULTS.cardOpacity,
      };
      syncControls();
      if (focusWasInSliders && sliders.hidden) reset.focus();
      persist();
      apply();
      refreshFx();
    });

    syncControls();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
