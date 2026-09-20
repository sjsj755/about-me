// ============ 笔记本 · 学习笔记页逻辑 ============
// 数据源：js/notes-data.js 内置示例 + 用户笔记（localStorage 持久化，同域各页共享）。
// 公共能力（转义/存储/弹窗）来自 js/ui.js。
(function () {
  const grid = document.getElementById('notesGrid');
  if (!grid) return;

  const KEY = 'bijiben_notes_v1';
  const BUILTIN = Array.isArray(window.NOTES_BUILTIN) ? window.NOTES_BUILTIN : [];
  const esc = window.UI.esc;

  // 用户笔记读写：键名与数据结构保持 { items: [...] } 不变
  function load() {
    const p = UI.loadJSON(KEY);
    return p && Array.isArray(p.items) ? p.items : [];
  }
  function save() {
    UI.saveJSON(KEY, { items: state });
  }
  const state = load();
  const all = () => state.concat(BUILTIN);

  // 渲染笔记卡片墙
  function renderGrid() {
    grid.innerHTML = '';
    const list = all();
    if (!list.length) {
      grid.innerHTML = `<div class="collect-empty">这里还没有笔记<span class="collect-empty-hint">点右上「写笔记」记下第一篇 ✨</span></div>`;
    }
    list.forEach((d, i) => {
      const card = document.createElement('article');
      card.className = 'glass-card note-card';
      card.innerHTML = `
      <h3 class="note-title">${esc(d.title)}</h3>
      <p class="note-body">${esc(d.desc)}</p>
      <div class="note-meta">
        <span class="note-date">📅 ${esc(d.date || '—')}</span>
        ${d.user ? '<span class="note-del" role="button" tabindex="0" aria-label="删除">✕ 删除</span>' : ''}
      </div>`;
      card.dataset.id = d.id;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.note-del')) { e.stopPropagation(); return; }
        openDetail(d); // 点击卡片本体：打开详情灯箱
      });
      const delBtn = card.querySelector('.note-del');
      if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeItem(d.id); });
      grid.appendChild(card);
    });
    // 卡片入场：SDK 缺失时适配层直接跳过，卡片保持终态（可见）
    Array.from(grid.querySelectorAll('.note-card')).forEach((card, i) => {
      FX.fromTo(card, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: (i % 3) * 0.07,
      });
    });
    document.getElementById('notesHint').innerHTML = `共 ${list.length} 篇笔记 · 保存在本地浏览器中`;
  }

  // 删除用户笔记
  function removeItem(id) {
    const d = state.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`删除「${d.title}」？此操作不可撤销。`)) return;
    state.splice(state.indexOf(d), 1);
    save(); renderGrid();
  }

  // 笔记详情灯箱：点击卡片打开
  function openDetail(d) {
    document.getElementById('detailBody').innerHTML = `
      <div class="dt-head"><span class="note-date">📅 ${esc(d.date || '—')}</span></div>
      <h3 class="dt-title">${esc(d.title)}</h3>
      <p class="dt-desc">${esc(d.desc)}</p>
      ${d.user ? '<div class="dt-actions"><button type="button" class="collect-btn danger" id="dtDel">✕ 删除</button></div>' : ''}`;
    const delBtn = document.getElementById('dtDel');
    if (delBtn) delBtn.addEventListener('click', () => { removeItem(d.id); UI.closeModal(document.getElementById('detailModal')); });
    UI.openModal(document.getElementById('detailModal'));
  }

  // 弹窗关闭途径（× / 遮罩 / Esc）统一交给工具层绑定
  UI.bindModals();

  // 写笔记弹窗
  function openAdd() {
    document.getElementById('addForm').reset();
    UI.openModal(document.getElementById('addModal'));
    setTimeout(() => document.getElementById('fTitle').focus(), 60);
  }

  document.getElementById('addBtn').addEventListener('click', openAdd);

  document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('fTitle').value.trim();
    const desc = document.getElementById('fDesc').value.trim();
    if (!title || !desc) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    state.unshift({
      id: 'u' + Date.now(),
      title,
      desc,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      user: true,
    });
    save();
    UI.closeModal(document.getElementById('addModal'));
    renderGrid();
  });

  renderGrid();
  FX.refresh();
})();
