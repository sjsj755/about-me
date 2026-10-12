// ============ 笔记详情页逻辑（note.html?id=<id>） ============
// 数据源：js/notes-data.js 的 window.NOTES_BUILTIN —— content 字段指向本地 Markdown 文件。
// 渲染管线：fetch(.md) → marked（GFM 表格/代码块）→ DOMPurify 消毒 → 注入正文容器。
// 三条非正常路径都不白屏：
//   1. id 缺失 / 未命中内置数据 → 「笔记不存在」空态；
//   2. marked / DOMPurify 缺失或初始化失败 → 纯文本 pre-wrap 渲染（esc 转义，无 XSS 面）；
//   3. fetch 失败或正文为空 → 「加载失败」空态。
(function () {
  const bodyEl = document.getElementById('noteBody');
  if (!bodyEl) return;
  const esc = window.UI.esc;

  const headEl = document.getElementById('noteHead');
  const titleEl = document.getElementById('noteTitle');
  const dateEl = document.getElementById('noteDate');
  const sourceEl = document.getElementById('noteSource');
  const emptyEl = document.getElementById('noteEmpty');
  const emptyMsg = document.getElementById('noteEmptyMsg');

  // 空态/错误态：隐藏头部与正文，只留提示与返回引导
  function showEmpty(msg) {
    headEl.hidden = true;
    bodyEl.hidden = true;
    emptyMsg.textContent = msg;
    emptyEl.hidden = false;
  }

  // 剥离首个 ATX 一级标题：页面头部已用数据字段的 title 展示，正文再渲染一遍会重复。
  // 仅剥文件开头的一行 `# xxx`，文件在 VS Code 里预览时仍自带标题，作者无需关心此规则。
  function stripLeadingH1(md) {
    return md.replace(/^\s*#\s+[^\n]*\n/, '');
  }

  // 降级渲染：esc 转义后保留换行与缩进，可读性与 .md 源文件一致
  function renderPlain(md) {
    bodyEl.innerHTML = `<div class="note-plain">${esc(stripLeadingH1(md))}</div>`;
  }

  // MD 管线。marked.parse 同步返回 string（v12 默认，未开 async 选项）；
  // sanitize 抛错也回退纯文本，保证「渲染失败」永远不等于「页面失败」。
  function renderMarkdown(md) {
    let html;
    try {
      html = window.DOMPurify.sanitize(window.marked.parse(stripLeadingH1(md)));
    } catch (e) {
      renderPlain(md);
      return;
    }
    bodyEl.innerHTML = html;
    // MD 正文里的外链统一新窗口 + noopener：不要求写 MD 的人记得带 rel
    bodyEl.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    buildToc();
  }

  // ---- 右侧目录（TOC）----
  // 渲染完成后从正文 h2/h3 提取，注入顺序 id（sec-N，不依赖中文 slug 编码）。
  // 点击走 FX.scrollTo（Lenis 平滑滚动；SDK 缺失时适配层退化为原生 scrollIntoView，
  // 标题上的 scroll-margin-top 保证两条路径都躲开固定导航）。
  // 无任何标题（如纯文本降级渲染）则保持 hidden，目录整体自洽缺席。
  function buildToc() {
    const headings = Array.from(bodyEl.querySelectorAll('h2, h3'));
    if (!headings.length) return;
    const tocNav = document.getElementById('noteToc');
    const tocList = document.getElementById('noteTocList');
    if (!tocNav || !tocList) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const links = headings.map((h, i) => {
      h.id = 'sec-' + i;
      const li = document.createElement('li');
      li.className = h.tagName === 'H3' ? 'toc-h3' : 'toc-h2';
      const a = document.createElement('a');
      a.href = '#sec-' + i;
      a.textContent = h.textContent;
      a.addEventListener('click', (e) => {
        // 接管默认锚点：改走适配层平滑滚动（reduced-motion 时 immediate 直达），再同步 hash
        e.preventDefault();
        FX.scrollTo(h, { offset: -104, immediate: reduced });
        history.replaceState(null, '', '#sec-' + i);
      });
      li.appendChild(a);
      tocList.appendChild(li);
      return a;
    });

    tocNav.hidden = false;

    // 滚动高亮：标题进入「导航下方 ~40% 视口带」即视为当前章节。
    // IntersectionObserver 观察真实几何，不受 Lenis 滚动劫持影响。
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const idx = headings.indexOf(en.target);
        if (idx < 0) return;
        links.forEach((l) => l.classList.remove('is-active'));
        links[idx].classList.add('is-active');
      });
    }, { rootMargin: '-104px 0px -60% 0px' });
    headings.forEach((h) => io.observe(h));
    links[0].classList.add('is-active'); // 页面顶部兜底：默认高亮第一章

    // 页底兜底：末章若不足一屏，滚动到底也进不了顶部观察带（observer 永不触发），
    // 接近页底时直接高亮最后一章；回滚后由 observer 恢复正确章节。
    window.addEventListener('scroll', () => {
      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight < doc.scrollHeight - 8) return;
      links.forEach((l) => l.classList.remove('is-active'));
      links[links.length - 1].classList.add('is-active');
    }, { passive: true });
  }

  // 能力检测：两个库都就绪才走 MD 管线，任一缺失都降级为纯文本
  function hasRenderer() {
    try {
      return typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function'
        && typeof window.DOMPurify !== 'undefined' && typeof window.DOMPurify.sanitize === 'function';
    } catch (e) { return false; }
  }

  // ---- 阅读进度绳 + 悬浮操作组 ----
  // 绳子常驻右缘（<1240px 隐藏，避免与目录重叠）；不足一屏（空态/短文）时整体缺席。
  // 悬浮组滚过 0.6 屏才浮现：顶部时「回顶/返回」动作无意义。
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progressEl = document.getElementById('noteProgress');
  const fillEl = document.getElementById('npFill');
  const knotEl = document.getElementById('npKnot');
  const fabsEl = document.getElementById('noteFabs');
  const badgeEl = document.getElementById('npBadge');
  const topBtn = document.getElementById('npTop');
  let trackH = 0;
  let progTicking = false;

  function measureTrack() {
    const track = progressEl && progressEl.querySelector('.np-track');
    trackH = track ? track.offsetHeight : 0;
  }
  function updateProgress() {
    progTicking = false;
    const y = window.scrollY || 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const hasRoom = maxScroll > 0;
    if (progressEl) progressEl.hidden = !hasRoom;
    if (!hasRoom) { if (fabsEl) fabsEl.classList.remove('is-on'); return; }
    const p = Math.min(1, Math.max(0, y / maxScroll));
    fillEl.style.transform = 'scaleY(' + p + ')';
    knotEl.style.transform = 'translateY(' + (trackH * p).toFixed(1) + 'px)';
    badgeEl.textContent = Math.round(p * 100) + '%';
    fabsEl.classList.toggle('is-on', y > window.innerHeight * 0.6);
  }
  function onScrollRaf() {
    if (!progTicking) { progTicking = true; requestAnimationFrame(updateProgress); }
  }
  if (progressEl && fabsEl && fillEl && knotEl && badgeEl && topBtn) {
    measureTrack();
    window.addEventListener('scroll', onScrollRaf, { passive: true });
    window.addEventListener('resize', () => { measureTrack(); updateProgress(); });
    // 正文 fetch 注入、图片/字体加载都会改变页高，且不伴随 scroll 事件：
    // 用 ResizeObserver 兜底重算（transform/textContent 写入不改布局，无回调循环）
    if (window.ResizeObserver) new ResizeObserver(updateProgress).observe(document.body);
    topBtn.addEventListener('click', () => FX.scrollTo(0, { immediate: reduced }));
    updateProgress();
  }

  // ---- 主流程 ----
  const id = new URLSearchParams(location.search).get('id') || '';
  const list = Array.isArray(window.NOTES_BUILTIN) ? window.NOTES_BUILTIN : [];
  const d = list.find((x) => x.id === id);

  if (!d) {
    showEmpty('笔记不存在或已被移除。');
    return;
  }

  titleEl.textContent = d.title || '未命名笔记';
  dateEl.textContent = '📅 ' + (d.date || '—');
  document.title = (d.title || '笔记详情') + ' · 笔记本';

  // 原文外链（可选）：同时配了 link 与 content 的条目，头部提供「查看原文」。
  // href 只放行 http(s) 与相对地址，杜绝 javascript: 伪协议被写进数据文件。
  if (d.link && /^(https?:\/\/|\/|\.\/)/.test(d.link)) {
    sourceEl.setAttribute('href', d.link);
    sourceEl.hidden = false;
  }

  if (!d.content) {
    showEmpty('这篇笔记暂无正文。');
    return;
  }

  bodyEl.innerHTML = '<p class="note-loading">加载中…</p>';
  fetch(d.content)
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then((md) => {
      if (!md.trim()) throw new Error('empty content');
      if (hasRenderer()) renderMarkdown(md);
      else renderPlain(md);
      // 正文注入把页面高度撑大了若干倍：必须延后一帧重测 Lenis 的滚动上限，
      // 否则 limit 停留在初始矮页面的值，目录点击 scrollTo 会被钳制在中途。
      FX.refresh();
    })
    .catch(() => showEmpty('内容加载失败，请稍后重试。'));
})();
