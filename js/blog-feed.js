// ============ 首页 · 最近更新列表 ============
// 聚合 笔记(notes-data.js) 与 作品(works-data.js)，按时间倒序取前 8 条渲染到 #feedList。
// 依赖：js/ui.js（UI.esc）、js/links.js（SOCIAL / WORK_LINKS）、js/notes-data.js、js/works-data.js。
// 容错：#feedList 不存在时静默退出（非首页加载本文件不报错）。
(function () {
  'use strict';

  // 社交图标链接填充（配置见 js/links.js 的 SOCIAL；HTML 里写 data-social 键名即可）
  document.querySelectorAll('a[data-social]').forEach((a) => {
    const conf = typeof SOCIAL !== 'undefined' ? SOCIAL : null;
    if (conf && conf[a.dataset.social]) a.href = conf[a.dataset.social];
  });

  const list = document.getElementById('feedList');
  if (!list) return;

  const esc = (window.UI && window.UI.esc) ? window.UI.esc : (s) => String(s == null ? '' : s);
  const items = [];

  // 笔记：有完整日期
  (window.NOTES_BUILTIN || []).forEach((n) => {
    items.push({
      type: '笔记', cls: 'is-note', title: n.title,
      desc: n.desc || '', dateText: n.date || '', sortKey: n.date || '',
      href: n.link || 'notes.html',
    });
  });

  // 作品：仅有年份（排序取当年 1 月 1 日，展示只显年份）
  const works = (typeof WORKS_DATA !== 'undefined') ? WORKS_DATA : [];
  works.forEach((w) => {
    let href = w.link || '';
    if (!href && w.linkKey && (typeof WORK_LINKS !== 'undefined')) href = WORK_LINKS[w.linkKey] || '';
    items.push({
      type: '作品', cls: 'is-work', title: w.title,
      desc: w.desc || '', dateText: w.year || '', sortKey: w.year ? w.year + '-01-01' : '',
      href: href || 'works.html',
    });
  });

  items.sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''));
  const top = items.slice(0, 8);

  if (!top.length) {
    list.innerHTML = '<li class="feed-empty">还没有更新，先去笔记本和作品集逛逛吧。</li>';
    return;
  }

  list.innerHTML = top.map((it) => {
    const external = /^https?:\/\//.test(it.href);
    return '<li class="feed-item">'
      + '<a class="feed-link" href="' + esc(it.href) + '"'
      + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>'
      + '<span class="feed-chip ' + it.cls + '">' + esc(it.type) + '</span>'
      + '<span class="feed-body">'
      + '<span class="feed-title">' + esc(it.title) + '</span>'
      + (it.desc ? '<span class="feed-desc">' + esc(it.desc) + '</span>' : '')
      + '</span>'
      + '<time class="feed-date">' + esc(it.dateText) + '</time>'
      + '</a></li>';
  }).join('');
})();
