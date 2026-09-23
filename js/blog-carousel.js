// ============ 首页 · 通栏轮播横幅 ============
// 数据源：js/links.js 的 CAROUSEL 数组，项格式 { src: '图片路径', caption: '图片说明' }。
// 轮播内不渲染任何视觉文字：caption 只作为 img.alt 供读屏使用，不做标题叠层。
// src 省略或图片加载失败时该帧降级为品牌渐变占位帧（纯视觉，同样无文案）。
// 动效：0.8s ease-out 淡入；15s 自动轮播，悬停 / 切后台暂停；prefers-reduced-motion 不自动播。
// 容错：#blogCarousel 不存在（非首页）静默退出。
// 可达性：指示点为 button 可键盘操作；非活动帧 aria-hidden。
(function () {
  'use strict';

  var root = document.getElementById('blogCarousel');
  if (!root) return;

  var INTERVAL = 15000;
  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var site = (typeof SITE !== 'undefined') ? SITE : { name: '' };
  var conf = (typeof CAROUSEL !== 'undefined' && CAROUSEL.length) ? CAROUSEL : [{}];
  var data = conf
    .filter(function (s) { return s && typeof s === 'object'; })
    .map(function (s) {
      return {
        src: typeof s.src === 'string' ? s.src : '',
        // caption 仅用于 img.alt（无 caption 时退回站点名），不参与视觉渲染
        caption: (typeof s.caption === 'string' && s.caption) || site.name || '',
      };
    });
  if (!data.length) { root.hidden = true; return; }

  var slideEls = [];
  var dotEls = [];
  var idx = 0;
  var timer = null;

  // 渐变占位帧：纯品牌视觉（渐变 + 光斑），不含任何文案
  function buildArt() {
    var art = document.createElement('div');
    art.className = 'carousel-art';
    return art;
  }

  function buildSlide(item, i) {
    var slide = document.createElement('div');
    slide.className = 'carousel-slide' + (i === 0 ? ' is-active' : '');
    slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');

    if (item.src) {
      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.caption;
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        // 坏图就地降级：清空后换成纯渐变占位帧
        while (slide.firstChild) slide.removeChild(slide.firstChild);
        slide.classList.add('is-art');
        slide.appendChild(buildArt());
      });
      slide.appendChild(img);
    } else {
      slide.classList.add('is-art');
      slide.appendChild(buildArt());
    }
    return slide;
  }

  // 幻灯片：纯 DOM API 构建，无 innerHTML 拼接
  data.forEach(function (item, i) {
    var slide = buildSlide(item, i);
    root.appendChild(slide);
    slideEls.push(slide);
  });

  // 指示点（44×44 热区，视觉为小圆点；负外边距收拢视觉间距）
  if (slideEls.length > 1) {
    var dots = document.createElement('div');
    dots.className = 'carousel-dots';
    slideEls.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel-dot' + (i === 0 ? ' is-active' : '');
      b.setAttribute('aria-label', '切换到第 ' + (i + 1) + ' 张');
      b.addEventListener('click', function () { stop(); goTo(i); start(); });
      dots.appendChild(b);
      dotEls.push(b);
    });
    root.appendChild(dots);
  }

  function goTo(n) {
    idx = (n + slideEls.length) % slideEls.length;
    slideEls.forEach(function (el, i) {
      el.classList.toggle('is-active', i === idx);
      el.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
    });
    dotEls.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
  }

  function start() {
    if (reduceMotion || timer || slideEls.length < 2) return;
    timer = setInterval(function () { goTo(idx + 1); }, INTERVAL);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  start();

  // 悬停暂停 / 移出恢复；标签页隐藏暂停、回来恢复
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
})();
