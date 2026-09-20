// ============ 站点集 · 简洁链接墙 ============
// 只保留最少的信息：站点名 + 一句话描述 + 跳转链接。数据来自 js/sites-data.js。
// 公共能力（转义）来自 js/ui.js。
(function () {
  const grid = document.getElementById('siteGrid');
  if (!grid || !window.SITES_DATA) return;

  const { CATS, SITES } = window.SITES_DATA;
  const esc = window.UI.esc;

  // 从网址提取域名（用于展示与搜索）
  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return String(url || ''); }
  }

  // 渲染分类 chips（含计数）
  function renderChips() {
    const wrap = document.getElementById('siteTags');
    wrap.innerHTML = Object.keys(CATS).map((f) =>
      `<button class="filter-chip${filter === f ? ' active' : ''}" data-cat="${f}">${CATS[f].name} ${SITES.filter((d) => d.cat === f).length}</button>`
    ).join('');
  }

  // 渲染站点网格：当前筛选 + 搜索条件下的链接卡
  function renderGrid() {
    const kw = (document.getElementById('siteSearch').value || '').trim().toLowerCase();
    grid.innerHTML = '';
    const list = SITES.filter((d) => {
      if (filter && d.cat !== filter) return false;
      if (!kw) return true;
      const c = CATS[d.cat] || CATS.other;
      return (d.title + ' ' + d.desc + ' ' + domainOf(d.link) + ' ' + c.name).toLowerCase().includes(kw);
    });

    if (!list.length) {
      grid.innerHTML = '<div class="collect-empty">没有找到匹配的站点<span class="collect-empty-hint">换个关键词试试 ✨</span></div>';
    }

    const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    list.forEach((d, i) => {
      const c = CATS[d.cat] || CATS.other;
      const dom = domainOf(d.link);
      const initial = (d.title || dom || '?').trim().charAt(0).toUpperCase();
      const card = document.createElement('a');
      card.className = 'site-card';
      card.href = d.link;
      card.target = '_blank';
      card.rel = 'noopener';
      card.setAttribute('aria-label', `${d.title}：${d.desc}`);
      card.innerHTML = `
      <span class="site-tile ${c.grad}" aria-hidden="true">${esc(initial)}</span>
      <span class="site-main">
        <span class="site-title">${esc(d.title)}</span>
        <span class="site-desc">${esc(d.desc)}</span>
        <span class="site-foot">
          <span class="cc-tag cat-${d.cat}">${c.name}</span>
          <span class="site-domain">${esc(dom)}</span>
        </span>
      </span>
      <span class="site-go" aria-hidden="true">↗</span>`;
      grid.appendChild(card);

      // 入场：首次渲染用 stagger 定基调；筛选/搜索触发的更新渲染降为 0.18s 纯淡入，
      // 避免高频输入时整组卡片反复"闪隐"（高频操作只允许近乎不可察觉的过渡）
      // SDK 缺失时适配层直接跳过，卡片保持终态（可见）
      if (!reduceMotion) {
        if (firstRender) {
          FX.fromTo(card, { opacity: 0, y: 24 }, {
            opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: (i % 8) * 0.045,
          });
        } else {
          FX.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out' });
        }
      }
    });

    const hint = document.getElementById('siteHint');
    const kwv = (document.getElementById('siteSearch').value || '').trim();
    hint.innerHTML = `共 ${list.length} 个站点`;
    if (kwv) hint.innerHTML += ` · 搜索「${esc(kwv)}」`;
    renderChips();
  }

  document.getElementById('siteSearch').addEventListener('input', renderGrid);

  // 筛选：分类点击切换（再点取消）
  document.getElementById('siteFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip || !chip.dataset.cat) return;
    const f = chip.dataset.cat;
    filter = filter === f ? '' : f;
    renderGrid();
  });

  let filter = '';
  let firstRender = true; // 首次渲染用 stagger 入场，之后的更新渲染只做快速淡入
  renderGrid();
  firstRender = false;
  FX.refresh();
})();
