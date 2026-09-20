// ============ 芸香集 · 收集本页 ============
// 数据源：内置条目 + 用户自建条目（localStorage 持久化，同域各页共享）。
(function () {
  const grid = document.getElementById('collectGrid');
  if (!grid) return;
  const openModal = UI.openModal;
  const closeModal = UI.closeModal;

  // 分类与内置条目：全部来自 js/collect-data.js（纯数据文件），在此只读取不定义
  const CATS = window.COLLECT_CATS || {};
  const BUILTIN = Array.isArray(window.COLLECT_BUILTIN) ? window.COLLECT_BUILTIN : [];
  const KEY = 'yunxiang_collect_v1';
  // 分类兜底：数据文件缺失或条目 cat 未知时仍可渲染，不抛错
  const FALLBACK_CAT = { name: '其他', icon: '✦', grad: '' };
  const catOf = (d) => CATS[d.cat] || CATS.misc || FALLBACK_CAT;

  function load() {
    const p = UI.loadJSON(KEY) || {};
    return { items: Array.isArray(p.items) ? p.items : [], favs: Array.isArray(p.favs) ? p.favs : [] };
  }
  function save() {
    UI.saveJSON(KEY, { items: state.items, favs: state.favs });
  }
  const state = load();
  const all = () => BUILTIN.concat(state.items);

  const esc = window.UI.esc;

  // 搜索索引：内容不可变，预计算可检索小写串并缓存（避免逐键重复拼接分配）
  const searchIndex = new WeakMap();
  function blobOf(d) {
    let s = searchIndex.get(d);
    if (!s) {
      s = (d.title + ' ' + d.desc + ' ' + (d.author || '') + ' ' + (d.tags || []).join(' ')).toLowerCase();
      searchIndex.set(d, s);
    }
    return s;
  }

  // 渲染主分类 chips（资料/语句/书籍/其他，含计数）
  function renderChips() {
    const wrap = document.getElementById('collectTags');
    const counts = {}; // 单遍计数，O(n) 替代按分类重复扫描的 O(c·n)
    all().forEach((d) => { counts[d.cat] = (counts[d.cat] || 0) + 1; });
    wrap.innerHTML = Object.keys(CATS).map((f) =>
      `<button class="filter-chip${state.filter === f ? ' active' : ''}" data-cat="${f}">${CATS[f].name} ${counts[f] || 0}</button>`
    ).join('');
  }

  // 渲染当前分类下的子标签（取该分类条目的标签并集，含计数）
  function renderSubTags() {
    const wrap = document.getElementById('subTagRow');
    if (!state.filter) { wrap.innerHTML = ''; return; }
    const counts = {};
    all().filter((d) => d.cat === state.filter).forEach((d) => (d.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, 'zh'));
    wrap.innerHTML = tags.map((t) =>
      `<button class="filter-chip${state.subTag === t ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)} ${counts[t]}</button>`
    ).join('');
  }

  // 渲染条目网格：当前筛选 + 搜索条件下的卡片
  // opts.chrome=false：跳过 chips/subtags 重建（与搜索关键词无关）
  // opts.animate=false：跳过入场 stagger（搜索逐键/增删等高频路径）
  // 显式参数传递，避免调用方依赖模块级标志的时序耦合
  function renderGrid(opts) {
    const o = opts || {};
    const rebuildChrome = o.chrome !== false;
    const animate = o.animate !== false;
    const kw = (document.getElementById('collectSearch').value || '').trim().toLowerCase();
    grid.innerHTML = '';
    const favSet = new Set(state.favs); // O(1) 收藏查询，替代逐卡 includes 的 O(n·f)
    const list = all().filter((d) => {
      const okCat = !state.filter || d.cat === state.filter;
      if (!okCat) return false;
      const okTag = !state.subTag || (d.tags || []).includes(state.subTag);
      if (!okTag) return false;
      if (!kw) return true;
      return blobOf(d).includes(kw);
    });

    if (!list.length) {
      grid.innerHTML = `<div class="collect-empty">这里还没有条目<span class="collect-empty-hint">${kw ? '换个关键词试试' : '在 js/collect-data.js 中补充内容'} ✨</span></div>`;
    }

    // 「资料」→ 学术文献列表；「语句」→ 引语卡墙；「书籍」→ 紧凑书墙；其余沿用玻璃卡片墙
    const isAcad = state.filter === 'note';
    const isQuote = state.filter === 'quote';
    const isBook = state.filter === 'book';
    grid.classList.toggle('acad-list', isAcad);
    grid.classList.toggle('quote-wall', isQuote);
    grid.classList.toggle('book-wall', isBook);

    list.forEach((d, i) => {
      const c = catOf(d);
      const isFav = favSet.has(d.id);
      const card = document.createElement('article');
      if (isAcad) {
        card.className = 'acad-item';
        card.innerHTML = `
        <div class="acad-index">${String(i + 1).padStart(2, '0')}</div>
        <div class="acad-body">
          <div class="acad-head">
            <h3 class="acad-title">${esc(d.title)}</h3>
            <span class="acad-year">${esc(d.year || '—')}</span>
          </div>
          <p class="acad-desc">${esc(d.desc)}</p>
          <div class="acad-meta">
            ${d.author ? `<span class="cc-tag acad-src">${esc(d.author)}</span>` : ''}
            ${(d.tags || []).map((t) => `<span class="cc-tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
        <div class="acad-side">
          <span class="cc-star${isFav ? ' on' : ''}" role="button" tabindex="0" aria-label="收藏">${isFav ? '★' : '☆'}</span>
          <span class="cc-ov-copy" role="button" tabindex="0">📋 复制</span>
          ${d.link ? `<a class="cc-ov-link" href="${esc(d.link)}" target="_blank" rel="noopener">原文 ↗</a>` : ''}
          ${d.user ? '<span class="cc-del" role="button" tabindex="0" aria-label="删除">✕</span>' : ''}
        </div>`;
      } else if (isQuote) {
        // 引语卡：无图区，引文即主视觉，点击打开详情灯箱
        card.className = 'glass-card quote-card';
        card.innerHTML = `
        <span class="qc-mark" aria-hidden="true">❝</span>
        <p class="qc-text">${esc(d.desc) || esc(d.title)}</p>
        ${(d.tags && d.tags.length) ? `<div class="qc-tags">${d.tags.map((t) => `<span class="cc-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="qc-foot">
          <span class="qc-src">— ${esc(d.title)}${d.author ? ' · ' + esc(d.author) : ''}</span>
          <span class="qc-year">${esc(d.year || '')}</span>
          <span class="cc-star${isFav ? ' on' : ''}" role="button" tabindex="0" aria-label="收藏">${isFav ? '★' : '☆'}</span>
          ${d.user ? '<span class="cc-del" role="button" tabindex="0" aria-label="删除">✕</span>' : ''}
        </div>`;
      } else if (isBook) {
        // 书卡：无图区，书名衬线主视觉 + 作者 + 完整描述，点击打开详情灯箱
        card.className = 'glass-card book-card';
        card.innerHTML = `
        <div class="bk-head">
          <h3 class="bk-title">${esc(d.title)}</h3>
          <span class="bk-year">${esc(d.year || '')}</span>
        </div>
        ${d.author ? `<p class="bk-author">${esc(d.author)}</p>` : ''}
        <p class="bk-desc">${esc(d.desc)}</p>
        ${(d.tags && d.tags.length) ? `<div class="bk-tags">${d.tags.map((t) => `<span class="cc-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="bk-foot">
          ${d.link ? `<a class="cc-ov-link" href="${esc(d.link)}" target="_blank" rel="noopener">原文 ↗</a>` : ''}
          <span class="cc-star${isFav ? ' on' : ''}" role="button" tabindex="0" aria-label="收藏">${isFav ? '★' : '☆'}</span>
          ${d.user ? '<span class="cc-del" role="button" tabindex="0" aria-label="删除">✕</span>' : ''}
        </div>`;
      } else {
        card.className = 'glass-card work-card collect-card' + (i % 3 === 1 ? '' : ' tall');
        card.innerHTML = `
        <div class="work-thumb ${c.grad}">
          <span class="cc-type-badge">${c.icon} ${c.name}</span>
          <span class="cc-star${isFav ? ' on' : ''}" role="button" tabindex="0" aria-label="收藏">${isFav ? '★' : '☆'}</span>
          ${d.user ? '<span class="cc-del" role="button" tabindex="0" aria-label="删除">✕</span>' : ''}
          <div class="work-overlay">
            <h4 class="cc-ov-title">${esc(d.title)}</h4>
            <p class="cc-ov-desc">${esc(d.desc)}</p>
            <div class="cc-ov-actions">
              <span class="cc-ov-copy">📋 复制</span>
              ${d.link ? `<a class="cc-ov-link" href="${esc(d.link)}" target="_blank" rel="noopener">查看链接 ↗</a>` : ''}
            </div>
          </div>
        </div>
        <div class="work-info">
          <h3 class="cc-title">${esc(d.title)}</h3>
          <p class="cc-desc">${esc(d.desc)}</p>
          <div class="cc-meta">
            <span class="cc-tag cat-${d.cat}">${c.name}</span>
            ${d.author ? `<span class="cc-tag">${esc(d.author)}</span>` : ''}
            ${d.tags.slice(0, 2).map((t) => `<span class="cc-tag">${esc(t)}</span>`).join('')}
            <span class="cc-year">${esc(d.year || '—')}</span>
          </div>
        </div>`;
      }
      card.dataset.id = d.id;
      card.addEventListener('click', (e) => {
        const star = e.target.closest('.cc-star');
        const del = e.target.closest('.cc-del');
        const copy = e.target.closest('.cc-ov-copy');
        const link = e.target.closest('.cc-ov-link');
        if (star || del || copy || link) { e.stopPropagation(); return; }
        openDetail(d); // 点击卡片本体：打开详情灯箱
      });
      const linkBtn = card.querySelector('.cc-ov-link');
      if (linkBtn) linkBtn.addEventListener('click', (e) => e.stopPropagation());
      const copyBtn = card.querySelector('.cc-ov-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(`${d.title} — ${d.desc}${d.link ? '\n' + d.link : ''}`).then(() => {
            const t = copyBtn.textContent;
            copyBtn.textContent = '已复制 ✓';
            setTimeout(() => { copyBtn.textContent = t; }, 1400);
          });
        });
      }
      card.querySelector('.cc-star').addEventListener('click', (e) => { e.stopPropagation(); toggleFav(d.id); });
      const delBtn = card.querySelector('.cc-del');
      if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeItem(d.id); });
      grid.appendChild(card);
    });

    // 复用作品卡的 3D 跟随（学术列表不需要倾斜，仅玻璃卡片启用）
    Array.from(grid.querySelectorAll('.collect-card')).forEach(FX.bind3D);
    if (animate) {
      Array.from(grid.querySelectorAll('.collect-card, .acad-item, .quote-card, .book-card')).forEach((card, i) => {
        FX.fromTo(card, { opacity: 0, y: isAcad || isQuote || isBook ? 18 : 40 }, {
          opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: (i % 3) * 0.07,
        });
      });
    }

    const hint = document.getElementById('collectHint');
    const kwv = (document.getElementById('collectSearch').value || '').trim();
    hint.innerHTML = `共 ${list.length} 条`;
    if (kwv) hint.innerHTML += ` · 搜索「${esc(kwv)}」`;
    hint.innerHTML += ` · 自建条目保存在本地，收藏随时可在 ♥ 收藏夹查看`;
    // chips/subtags 只依赖数据与筛选状态，与关键词无关；逐键搜索时无需重建
    if (rebuildChrome) {
      renderChips();
      renderSubTags();
    }
  }

  // 收藏切换：原地更新星标，不重渲网格（避免高频整墙重动画）
  function toggleFav(id) {
    const i = state.favs.indexOf(id);
    const on = i < 0;
    if (on) state.favs.push(id); else state.favs.splice(i, 1);
    save();
    document.querySelectorAll(`#collectGrid [data-id="${id}"] .cc-star`).forEach((s) => {
      s.classList.toggle('on', on);
      s.textContent = on ? '★' : '☆';
      // 收藏成功的轻量确认：180ms 星标弹跳（reduced-motion 跳过）
      if (on && s.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        s.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
          { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
        );
      }
    });
  }

  // 删除自建条目（含清理收藏）
  function removeItem(id) {
    const d = all().find((x) => x.id === id);
    if (!d || !d.user) return;
    if (!confirm(`删除「${d.title}」？此操作不可撤销。`)) return;
    state.items = state.items.filter((x) => x.id !== id);
    state.favs = state.favs.filter((x) => x !== id);
    save(); renderGrid({ animate: false });
  }

  // 条目详情灯箱：点击卡片打开，展示完整内容与操作
  function openDetail(d) {
    const c = catOf(d);
    const isFav = state.favs.includes(d.id);
    document.getElementById('detailBody').innerHTML = `
      <div class="dt-head">
        <span class="cc-tag cat-${d.cat}">${c.icon} ${c.name}</span>
        <span class="dt-year">${esc(d.year || '—')}</span>
      </div>
      <h3 class="dt-title">${esc(d.title)}</h3>
      ${d.author ? `<p class="dt-author">${esc(d.author)}</p>` : ''}
      <p class="dt-desc">${esc(d.desc) || '（暂无内容）'}</p>
      ${(d.tags && d.tags.length) ? `<div class="dt-tags">${d.tags.map((t) => `<span class="cc-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="dt-actions">
        <button type="button" class="collect-btn" id="dtCopy">📋 复制</button>
        ${d.link ? `<a class="collect-btn" href="${esc(d.link)}" target="_blank" rel="noopener">原文 ↗</a>` : ''}
        <button type="button" class="collect-btn" id="dtFav">${isFav ? '★ 已收藏' : '☆ 收藏'}</button>
        ${d.user ? '<button type="button" class="collect-btn danger" id="dtDel">✕ 删除</button>' : ''}
      </div>`;
    document.getElementById('dtCopy').addEventListener('click', () => {
      navigator.clipboard?.writeText(`${d.title} — ${d.desc}${d.link ? '\n' + d.link : ''}`).then(() => {
        const b = document.getElementById('dtCopy');
        b.textContent = '已复制 ✓';
        setTimeout(() => { b.textContent = '📋 复制'; }, 1400);
      });
    });
    document.getElementById('dtFav').addEventListener('click', () => { toggleFav(d.id); openDetail(d); });
    const delBtn = document.getElementById('dtDel');
    if (delBtn) delBtn.addEventListener('click', () => { removeItem(d.id); closeModal(document.getElementById('detailModal')); });
    openModal(document.getElementById('detailModal'));
  }

  UI.bindModals();

  // 收藏夹弹窗：展示已收藏条目
  function openFav() {
    const favs = all().filter((d) => state.favs.includes(d.id));
    document.getElementById('favSub').textContent = favs.length ? `已收藏 ${favs.length} 条` : '还没有收藏，点卡片右上角的 ☆ 收进去';
    document.getElementById('favList').innerHTML = favs.length ? favs.map((d) => {
      const c = CATS[d.cat] || CATS.misc;
      return `<div class="cm-fav-item">
        <div class="cm-fav-row">
          <span class="cc-tag cat-${d.cat}">${c.name}</span>
          <span class="cm-fav-title">${esc(d.title)}</span>
          ${d.link ? `<a class="cm-fav-open" href="${esc(d.link)}" target="_blank" rel="noopener">打开 ↗</a>` : ''}
          <span class="cm-fav-del" data-unfav="${esc(d.id)}">移出收藏</span>
        </div>
        ${d.desc ? `<p class="cm-fav-desc">${esc(d.desc)}</p>` : ''}
      </div>`;
    }).join('') : '<div class="cm-fav-item" style="text-align:center;color:var(--text-soft)">收藏夹是空的 🌱</div>';
    document.querySelectorAll('#favList .cm-fav-del').forEach((b) => {
      b.addEventListener('click', () => { toggleFav(b.dataset.unfav); openFav(); });
    });
    openModal(document.getElementById('favModal'));
  }

  document.getElementById('favBtn').addEventListener('click', openFav);
  document.getElementById('collectSearch').addEventListener('input', () => {
    renderGrid({ chrome: false, animate: false }); // 逐键输入：跳过 chrome 重建与入场动画
  });

  // 筛选：主分类点击切换（再点取消），切换分类时清空子标签；子标签点击切换
  document.getElementById('collectFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    if (chip.dataset.cat) {
      const f = chip.dataset.cat;
      state.filter = state.filter === f ? '' : f;
      state.subTag = '';
    } else if (chip.dataset.tag) {
      const t = chip.dataset.tag;
      state.subTag = state.subTag === t ? '' : t;
    }
    renderGrid(); // 筛选切换偶发，默认重放入场
  });

  state.filter = 'book';
  state.subTag = '';
  renderGrid();
  FX.refresh();
})();
