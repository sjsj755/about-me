// ============ 首页 · 通栏轮播横幅 ============
// 数据源：js/links.js 的 CAROUSEL 数组，项格式 { src: '图片路径', caption: '标题' }。
// src 省略时该帧渲染为品牌渐变占位帧；CAROUSEL 为空时回退为单帧站点占位横幅。
// 动效：0.8s ease-out 淡入；5s 自动轮播，悬停 / 切后台暂停；prefers-reduced-motion 不自动播。
// 容错：#blogCarousel 不存在（非首页）静默退出；图片加载失败就地降级为渐变占位帧。
// 可达性：指示点为 button 可键盘操作；非活动帧 aria-hidden。
(function () {
  'use strict';

  var root = document.getElementById('blogCarousel');
  if (!root) return;

  var INTERVAL = 5000;
  var FALLBACK_MOTTO = '记录学习、作品与生活的一片小园地。';
  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var site = (typeof SITE !== 'undefined') ? SITE : { name: '', motto: '' };
  var conf = (typeof CAROUSEL !== 'undefined' && CAROUSEL.length) ? CAROUSEL : [{}];
  var data = conf
    .filter(function (s) { return s && typeof s === 'object'; })
    .map(function (s) {
      return {
        src: typeof s.src === 'string' ? s.src : '',
        caption: (typeof s.caption === 'string' && s.caption) || site.name || '',
        motto: (typeof s.motto === 'string' && s.motto) || site.motto || FALLBACK_MOTTO,
      };
    });
  if (!data.length) { root.hidden = true; return; }

  var slideEls = [];
  var dotEls = [];
  var idx = 0;
  var timer = null;

  // 渐变占位帧内容：站点名 + 副标语
  function buildArt(item) {
    var art = document.createElement('div');
    art.className = 'carousel-art';
    var name = document.createElement('span');
    name.className = 'carousel-art-name';
    name.textContent = item.caption;
    var motto = document.createElement('span');
    motto.className = 'carousel-art-motto';
    motto.textContent = item.motto;
    art.appendChild(name);
    art.appendChild(motto);
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
        // 坏图就地降级：清空后换成渐变占位帧（保留 caption 文案）
        while (slide.firstChild) slide.removeChild(slide.firstChild);
        slide.classList.add('is-art');
        slide.appendChild(buildArt(item));
      });
      slide.appendChild(img);
      if (item.caption) {
        var cap = document.createElement('span');
        cap.className = 'carousel-caption';
        cap.textContent = item.caption;
        slide.appendChild(cap);
      }
    } else {
      slide.classList.add('is-art');
      slide.appendChild(buildArt(item));
    }
    return slide;
  }

  // 幻灯片：DOM API + textContent 写入，无 innerHTML 拼接
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
