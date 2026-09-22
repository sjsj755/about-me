// ============ 笔记本 · 学习笔记页逻辑 ============
// 数据源：js/notes-data.js 内置示例 + 用户笔记（localStorage 持久化，同域各页共享）。
// 公共能力（转义/存储/弹窗）来自 js/ui.js。
// 展示形态：每 3 张便签挂在同一根绳子上（.note-group），便签指向外部链接（飞书文档 / 博客 / GitHub 等不限来源）。
(function () {
  const grid = document.getElementById('notesGrid');
  if (!grid) return;

  const KEY = 'bijiben_notes_v1';
  const BUILTIN = Array.isArray(window.NOTES_BUILTIN) ? window.NOTES_BUILTIN : [];
  const esc = window.UI.esc;

  // 摘要字数计数器：实时回显「已用 / 上限」，让 maxlength 不再是一条看不见的限制。
  // 上限数字以 HTML 的 maxlength 为唯一来源（读 descField.maxLength），避免两处硬编码各自漂移。
  const descField = document.getElementById('fDesc');
  const descCount = document.getElementById('fDescCount');
  const MAX_DESC = descField && descField.maxLength > 0 ? descField.maxLength : 0;

  function syncDescCount() {
    if (!descField || !descCount || !MAX_DESC) return;
    const used = descField.value.length;
    descCount.textContent = `${used} / ${MAX_DESC}`;
    descCount.classList.toggle('is-full', used >= MAX_DESC);
  }
  if (descField && descCount) {
    // input 事件覆盖键入 / 粘贴 / 输入法上屏，斜杠后即为上游截断后的真实长度
    descField.addEventListener('input', syncDescCount);
    syncDescCount();
  }

  // 一根绳子上挂几张便签
  const PER_GROUP = 3;
  // 一列三张的固定歪斜角：模拟“手动挂上去的”参差感（悬停会回正）
  const TILTS = ['-1.8deg', '1.3deg', '-0.9deg'];
  // 便签纸底色：取自 --accent-* 同色系，循环使用
  const TINTS = [
    'rgba(243,215,138,.34)', 'rgba(127,180,232,.28)',
    'rgba(246,184,200,.28)', 'rgba(126,217,196,.26)',
  ];

  // 用户笔记读写：键名与数据结构保持 { items: [...] } 不变
  function load() {
    const p = UI.loadJSON(KEY);
    return p && Array.isArray(p.items) ? p.items : [];
  }
  function save() {
    UI.saveJSON(KEY, { items: state });
  }
  const state = load();
  // 时效性：整墙按日期倒序，最新的便签排在最上面（用户笔记与内置条目一起参与排序）。
  // sort 是稳定的，同一天内保持原顺序 —— state 本身是新→旧（新增走 unshift），同日用户笔记仍在前。
  const all = () => state.concat(BUILTIN)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // 单张便签：外层 .note-item 负责倾斜，内层 .note-card 负责入场动画，两层 transform 互不覆盖
  function buildNote(d, i) {
    const item = document.createElement('div');
    item.className = 'note-item';
    item.style.setProperty('--tilt', TILTS[i % PER_GROUP]);

    const card = document.createElement('article');
    card.className = 'glass-card note-card';
    card.style.setProperty('--note-tint', TINTS[i % TINTS.length]);
    card.dataset.id = d.id;
    card.innerHTML = `
      <span class="note-clip" aria-hidden="true"></span>
      <h3 class="note-title">${d.link
        ? `<a class="note-link" href="${esc(d.link)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a>`
        : esc(d.title)}</h3>
      <p class="note-body">${esc(d.desc)}</p>
      <div class="note-meta">
        <span class="note-date">📅 ${esc(d.date || '—')}</span>
        ${d.user ? '<span class="note-del" role="button" tabindex="0" aria-label="删除">✕ 删除</span>' : ''}
      </div>`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.note-del')) { e.stopPropagation(); return; }
      if (e.target.closest('.note-link')) return; // 命中真锚点：交还浏览器默认行为，避免开两个窗口
      if (d.link) window.open(d.link, '_blank', 'noopener');
      else openDetail(d); // 无链接的历史笔记：沿用原来的详情弹窗
    });
    const delBtn = card.querySelector('.note-del');
    if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeItem(d.id); });
    item.appendChild(card);
    return item;
  }

  // 渲染便签墙：按 PER_GROUP 切分，每组一根绳子 + 一行便签
  function renderGrid() {
    const list = all();
    grid.innerHTML = '';
    document.getElementById('notesHint').innerHTML = `共 ${list.length} 篇笔记 · 点击便签打开对应文档`;

    if (!list.length) {
      grid.innerHTML = `<div class="collect-empty">这里还没有笔记<span class="collect-empty-hint">点右上「写笔记」记下第一篇 ✨</span></div>`;
      return;
    }

    for (let i = 0; i < list.length; i += PER_GROUP) {
      const group = document.createElement('div');
      group.className = 'note-group';
      group.innerHTML = '<div class="note-rope" aria-hidden="true"></div>';
      const row = document.createElement('div');
      row.className = 'note-row';
      list.slice(i, i + PER_GROUP).forEach((d, j) => row.appendChild(buildNote(d, i + j)));
      group.appendChild(row);
      grid.appendChild(group);
    }

    // 入场：绳子自左“抽出”，随后每张便签从上方摆落并回正（SDK 缺失时适配层跳过，直接停在终态）
    Array.from(grid.querySelectorAll('.note-rope')).forEach((rope, i) => {
      FX.fromTo(rope, { opacity: 0, scaleX: 0 }, {
        opacity: 1, scaleX: 1, duration: 0.55, ease: 'power2.out', delay: i * 0.1,
      });
    });
    Array.from(grid.querySelectorAll('.note-card')).forEach((card, i) => {
      const tilt = parseFloat(TILTS[i % PER_GROUP]) || 0;
      FX.fromTo(card, { opacity: 0, y: -26, rotate: tilt * 3 }, {
        opacity: 1, y: 0, rotate: 0, duration: 0.7, ease: 'back.out(1.5)', delay: (i % PER_GROUP) * 0.08,
      });
    });
  }

  // 删除用户笔记
  function removeItem(id) {
    const d = state.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`删除「${d.title}」？此操作不可撤销。`)) return;
    state.splice(state.indexOf(d), 1);
    save(); renderGrid();
  }

  // 详情弹窗：仅无链接的笔记（历史本地数据）会走到这里
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
    syncDescCount(); // reset 不会触发 input，计数需手动归零
    UI.openModal(document.getElementById('addModal'));
    setTimeout(() => document.getElementById('fTitle').focus(), 60);
  }

  document.getElementById('addBtn').addEventListener('click', openAdd);

  document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('fTitle').value.trim();
    const desc = document.getElementById('fDesc').value.trim();
    const link = document.getElementById('fLink').value.trim();
    if (!title || !desc) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    state.unshift({
      id: 'u' + Date.now(),
      title,
      desc,
      link, // 留空则为本地笔记：点击便签打开详情弹窗
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