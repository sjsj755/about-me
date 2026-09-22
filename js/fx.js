// ============ 外部动效 SDK 适配层（GSAP / Lenis / solarlunar） ============
// 全站唯一允许直接引用 window.gsap / window.Lenis / window.ScrollTrigger / window.solarlunar 的文件。
//
// 为什么需要它：这些 SDK 全部本地化在 js/vendor/（原先走 CDN，网络不可达时全局变量根本不存在），
// 但本地文件同样可能缺失、损坏或部署漏传 —— 只要全局变量不存在，后果与 CDN 不可达一致。
// 业务模块若直接写 gsap.xxx，一旦 SDK 缺失就是顶层抛错 —— 后续逻辑全部停摆，
// 且 .reveal 的 CSS 初始态（opacity:0）无人解除，整页变空白。
// 因此业务只向 FX 索取「能力」，不感知 SDK 是否就位：
//
//   FX.ready            是否具备动画能力（GSAP + ScrollTrigger）
//   FX.to / fromTo      动画；能力缺失时静默跳过，元素直接停在终态（无动画即最终样子）
//   FX.all(sel)         元素集合（替代 gsap.utils.toArray）
//   FX.onTick(fn)       逐帧回调：有 GSAP 走 ticker，否则退化为 rAF
//   FX.scrollTo         平滑滚动；无 Lenis 时退化为原生 scrollIntoView
//   FX.lockScroll       锁页面滚动（body overflow + 暂停 Lenis）/ FX.unlockScroll 还原
//   FX.refresh          延后一帧重测滚动位置与上限（动态渲染后调用）/ FX.refreshNow 立即重测
//   FX.bind3D(card)     卡片 3D 跟随鼠标
//   FX.lunar.ready      农历换算能力（solarlunar，仅首页加载）；solar2lunar / lunar2solar
//
// 本文件在 DOM 解析后（defer）自初始化，必须先于 main.js 与各页面模块加载。
(function () {
  'use strict';

  const gsap = window.gsap;
  const hasGsap = typeof gsap !== 'undefined' && typeof gsap.ticker !== 'undefined';
  const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';
  const hasLenis = typeof window.Lenis !== 'undefined';

  // 动画能力要求 GSAP + ScrollTrigger 同时就位：滚动浮现动画整体依赖 ScrollTrigger，
  // 只加载其中一个时这条动画链不成立，与其半残不如整体降级。
  const ready = hasGsap && hasScrollTrigger;

  let lenis = null;

  // 自初始化：能力缺失时给 <html> 打 no-gsap，交由 CSS 还原 .reveal 初始态保证内容可见。
  // 必须整段包 try/catch：window.FX 在本文件末尾才导出，此处一旦抛错，FX 就永远不存在，
  // 随后 main.js 顶层的 FX.ready 会直接抛 ReferenceError，全站 JS 停摆（比没有动画严重得多）。
  // 所以这里的异常一律降级：Lenis 不可用则退回原生滚动，GSAP 能力照常保留。
  if (ready) {
    try {
      if (hasLenis) {
        lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
        lenis.on('scroll', window.ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        // JS 动态渲染 / 字体与图片晚到都会在初始化后改变页面高度，此时必须重测滚动上限，
        // 否则 limit 停留在旧值，滚轮会被钳制无法下滚。
        window.addEventListener('load', () => lenis.resize());
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => lenis.resize());
      }
    } catch (e) {
      lenis = null;
    }
  } else {
    document.documentElement.classList.add('no-gsap');
  }

  function to(target, vars) {
    if (!ready) return;
    gsap.to(target, vars);
  }
  function fromTo(target, fromVars, toVars) {
    if (!ready) return;
    gsap.fromTo(target, fromVars, toVars);
  }
  function all(selector) {
    return ready ? gsap.utils.toArray(selector) : Array.from(document.querySelectorAll(selector));
  }
  function onTick(fn) {
    if (hasGsap) { gsap.ticker.add(fn); return; }
    (function loop() { fn(); requestAnimationFrame(loop); })();
  }

  function scrollTo(target, vars) {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, vars);
    else if (target.scrollIntoView) target.scrollIntoView({ block: 'start' });
  }

  function lockScroll() {
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
  }
  function unlockScroll() {
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  // 延后一帧：待布局与图片就绪后再测量，避免同帧内取到陈旧位置
  function refresh() {
    if (!hasScrollTrigger && !lenis) return;
    requestAnimationFrame(() => {
      if (hasScrollTrigger) window.ScrollTrigger.refresh();
      if (lenis && lenis.resize) lenis.resize();
    });
  }
  function refreshNow() {
    if (hasScrollTrigger) window.ScrollTrigger.refresh();
  }

  function bind3D(card) {
    if (!card) return;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      // 保留 CSS 的 --tilt 旋转，仅叠加微小的 3D 视角
      to(card, { rotateX: -py * 7, rotateY: px * 7, duration: 0.4, ease: 'power2.out' });
      // 记录光标位置供 CSS 高光定位（--wx/--wy）
      card.style.setProperty('--wx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--wy', ((e.clientY - r.top) / r.height * 100) + '%');
    });
    card.addEventListener('mouseleave', () => {
      to(card, { rotateX: 0, rotateY: 0, transform: '', duration: 0.5, ease: 'power2.out' });
    });
  }

  // 农历：solarlunar 是 defer 加载的本地 vendor，可能晚于本文件执行，故就位状态按调用时判定
  const lunar = {
    get ready() { return typeof window.solarlunar !== 'undefined'; },
    solar2lunar(y, m, d) { return lunar.ready ? window.solarlunar.solar2lunar(y, m, d) : null; },
    lunar2solar(y, m, d, isLeap) { return lunar.ready ? window.solarlunar.lunar2solar(y, m, d, !!isLeap) : null; },
  };

  window.FX = {
    ready, to, fromTo, all, onTick,
    scrollTo, lockScroll, unlockScroll, refresh, refreshNow,
    bind3D, lunar,
  };
})();
