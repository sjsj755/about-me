// ============ 游戏室 · 页面模块（架子） ============
// 职责只有两件：按 window.GAMES 渲染切换条；维护「单一舞台 + 挂载/销毁生命周期」的协议。
// 本文件不含任何具体游戏 —— 游戏本体由 window.GAME_RUNNERS 提供（契约见下）。
//
// ---- 加一款游戏 ----
//   ① js/games-data.js 的 GAMES 里加一条 { id, name, tag?, desc? }（id 必须唯一，且与实现同名）；
//   ② 实现二选一：
//      a) 写进本文件末尾的 GAME_RUNNERS 对象；
//      b) 另建 js/games-<id>.js，写 window.GAME_RUNNERS['<id>'] = { mount(ctx) { … } }，
//         并在 games.html 里把它的 <script> 放在 games.js 之前（同样 defer、带版本号）；
//   ③ 全站版本号要一起升（css/manifest.json 的 version 与各页 HTML 的 ?v=，见 tools/css-graph.js 的 E-CACHEVER）。
//
// ---- 实现契约 ----
//   window.GAME_RUNNERS = {
//     '<id>': {
//       // 把一个完整游戏挂进 ctx.el；返回的 destroy 会在切走 / 离开页面时调用（可省略）
//       mount(ctx) { …; return function destroy() { … }; }
//     }
//   };
//
//   ctx 提供：
//     el            舞台内的干净挂载容器（<div class="games-mount">，每次切换都是新节点，游戏只管往里画）
//     id            当前游戏 id
//     hud(text)     写入舞台上方的 aria-live 状态行（纯文本，走 textContent，无 HTML 注入面）
//     onKey(map)    声明式按键绑定，如 { ArrowLeft: fn, r: fn }；卸载时自动解绑
//     onSwipe(fn)   滑动识别，回调收 'up' | 'down' | 'left' | 'right'；卸载时自动解绑
//     best          计分持久化：best.get() / best.set(n)，localStorage 键 youxi_best_<id>_v1
//     reduceMotion  是否命中 prefers-reduced-motion: reduce（供游戏自行决定要不要播动画）
//
//   hud / onKey / onSwipe 都挂在「本次挂载」的生命周期上：切走时统一解绑，游戏实现不必自己清理。
//   mount 抛错会被 try/catch 接住，舞台显示「打不开」态，其余 tab 仍可切换。
(function () {
  'use strict';

  const stage = document.getElementById('gamesStage');
  if (!stage) return; // 非游戏页：立即退出，不触碰任何 DOM

  const tabsBox = document.getElementById('gamesTabs');
  const hint = document.getElementById('gamesHint');
  const UI = window.UI || {};
  const FX = window.FX || {};
  const esc = UI.esc || ((s) => String(s == null ? '' : s));
  const loadJSON = UI.loadJSON || (() => null);
  const saveJSON = UI.saveJSON || (() => {});
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // 清单：只保留 id 合法的条目，避免一条脏数据把整个切换条渲染崩掉
  const GAMES = (Array.isArray(window.GAMES) ? window.GAMES : [])
    .filter((g) => g && typeof g.id === 'string' && g.id);

  // 注册表挂在 window 上而不是本模块私有：实现既能内联写，也能另建文件先挂上去
  window.GAME_RUNNERS = window.GAME_RUNNERS || {};
  const RUNNERS = window.GAME_RUNNERS;

  let currentId = null; // 当前激活的游戏 id
  let teardown = null;  // 当前挂载的清理函数（解绑监听 + 调用游戏的 destroy）

  // ---------- 舞台内的降级态（空 / 未实现 / 打不开） ----------
  // 一律渲染中性文案（面向访客），绝不抛错、绝不空白。
  function showNotice(title, sub) {
    stage.classList.remove('is-playing');
    stage.textContent = '';
    const box = document.createElement('div');
    box.className = 'games-empty';
    const h = document.createElement('p');
    h.className = 'games-empty-title';
    h.textContent = title;
    const p = document.createElement('p');
    p.className = 'games-empty-hint';
    p.textContent = sub;
    box.appendChild(h);
    box.appendChild(p);
    stage.appendChild(box);
  }

  // ---------- 计分持久化 ----------
  // 键名沿用项目约定 <名字>_v1（calendar_marks_v1 / yunxiang_collect_v1 / bijiben_notes_v1）
  function makeBest(id) {
    const key = 'youxi_best_' + id + '_v1';
    return {
      get() {
        const v = loadJSON(key);
        return typeof v === 'number' && isFinite(v) ? v : 0;
      },
      set(n) {
        const v = Number(n);
        saveJSON(key, isFinite(v) ? v : 0);
      },
    };
  }

  // ---------- ctx 能力：按键 ----------
  // 只对 map 里列出的键 preventDefault，不劫持其它键。
  // 输入控件内 / contenteditable 上 / 带 ctrl|meta|alt 修饰键 / 输入法组合中，一律放行。
  const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;
  function bindKeys(map, disposers) {
    if (!map || typeof map !== 'object') return;
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const t = e.target;
      if (t && (EDITABLE.test(t.tagName || '') || t.isContentEditable)) return;
      if (!Object.prototype.hasOwnProperty.call(map, e.key)) return;
      const fn = map[e.key];
      if (typeof fn !== 'function') return;
      e.preventDefault(); // 只对已声明的键拦截默认行为（如方向键滚动页面）
      fn(e);
    };
    document.addEventListener('keydown', onKeyDown);
    disposers.push(() => document.removeEventListener('keydown', onKeyDown));
  }

  // ---------- ctx 能力：滑动 ----------
  // pointerdown 落在舞台上，pointerup / pointercancel 收在 window 上（指针移出舞台再松手也算）。
  // 位移小于阈值不算滑动；超过阈值取主轴方向。鼠标拖拽与触控板同样生效。
  const SWIPE_MIN = 30;
  function bindSwipe(fn, disposers) {
    if (typeof fn !== 'function') return;
    let sx = 0;
    let sy = 0;
    let active = false;
    const onDown = (e) => { active = true; sx = e.clientX; sy = e.clientY; };
    const onCancel = () => { active = false; };
    const onUp = (e) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < SWIPE_MIN && ady < SWIPE_MIN) return;
      fn(adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };
    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    disposers.push(() => {
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    });
  }

  // 逐个执行清理函数：任一个抛错都不能连累后面的（否则监听会漏解绑，切页后仍在响应）
  function runDisposers(disposers) {
    disposers.forEach((d) => { try { d(); } catch (e) { /* 单个解绑失败可忽略 */ } });
    disposers.length = 0;
  }

  // ---------- 挂载 / 卸载 ----------
  // 返回本次挂载的 unmount；mount 抛错时返回 null（舞台已切到「打不开」态）。
  function mountGame(def, runner) {
    const disposers = [];
    stage.classList.add('is-playing');
    stage.textContent = '';

    const hudEl = document.createElement('p');
    hudEl.className = 'games-hud';
    hudEl.setAttribute('aria-live', 'polite');

    const el = document.createElement('div');
    el.className = 'games-mount';

    stage.appendChild(hudEl);
    stage.appendChild(el);

    const ctx = {
      el: el,
      id: def.id,
      hud: (text) => { hudEl.textContent = text == null ? '' : String(text); },
      onKey: (map) => bindKeys(map, disposers),
      onSwipe: (fn) => bindSwipe(fn, disposers),
      best: makeBest(def.id),
      reduceMotion: reduceMotion,
    };

    let destroy = null;
    try {
      destroy = runner.mount(ctx);
    } catch (err) {
      console.warn('[games] 游戏 ' + def.id + ' 挂载失败：', err);
      runDisposers(disposers);
      showNotice('这个游戏暂时打不开', '换一个试试，其它游戏不受影响。');
      return null;
    }

    return function unmount() {
      try {
        if (typeof destroy === 'function') destroy();
      } catch (err) {
        console.warn('[games] 游戏 ' + def.id + ' 的 destroy 抛错：', err);
      }
      runDisposers(disposers);
    };
  }

  // ---------- 切换条 ----------
  function tabButtons() {
    return tabsBox ? Array.prototype.slice.call(tabsBox.querySelectorAll('[role="tab"]')) : [];
  }

  // 选中态三处同步：aria-selected / tabindex（漫游 tabindex 只留当前项）/ .active（复用共享 chip 样式）
  function syncTabs(id) {
    tabButtons().forEach((b) => {
      const on = b.dataset.game === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('active', on);
      if (on) stage.setAttribute('aria-labelledby', b.id);
    });
  }

  function renderTabs() {
    if (!tabsBox) return;
    if (!GAMES.length) {
      tabsBox.hidden = true;
      tabsBox.textContent = '';
      return;
    }
    tabsBox.hidden = false;
    tabsBox.innerHTML = GAMES.map((g, i) => (
      '<button type="button" class="filter-chip" role="tab" id="gamesTab-' + esc(g.id) + '"'
      + ' aria-controls="gamesStage" aria-selected="' + (i === 0 ? 'true' : 'false') + '"'
      + ' tabindex="' + (i === 0 ? '0' : '-1') + '" data-game="' + esc(g.id) + '">'
      + (g.tag ? '<span class="games-tab-tag">' + esc(g.tag) + '</span>' : '')
      + esc(g.name || g.id)
      + '</button>'
    )).join('');
  }

  // ---------- 激活某个游戏 ----------
  function findGame(id) {
    for (let i = 0; i < GAMES.length; i++) {
      if (GAMES[i].id === id) return GAMES[i];
    }
    return null;
  }

  // 舞台高度随游戏而变，必须重测滚动上限（Lenis 的滚动上限取自文档高度，项目已记录过这个坑）
  function refreshLayout() {
    if (typeof FX.refresh === 'function') FX.refresh();
  }

  function activate(id) {
    if (id === currentId) return;
    const def = findGame(id);
    if (!def) return;

    // 先拆掉上一个再挂新的：destroy 抛错已在 unmount 内部接住，不会阻断切页
    if (teardown) { teardown(); teardown = null; }
    currentId = id;
    syncTabs(id);
    if (hint) hint.textContent = def.desc || '';

    const runner = RUNNERS[id];
    if (!runner || typeof runner.mount !== 'function') {
      // 数据先行、实现后补：页面依然可用，只是这款点开还没有内容
      showNotice('这个游戏还没做好', '位置先留着，很快就会有能玩的东西。');
      refreshLayout();
      return;
    }
    teardown = mountGame(def, runner);
    refreshLayout();
  }

  // ---------- 切换条交互（WAI-ARIA tabs） ----------
  if (tabsBox) {
    tabsBox.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('[role="tab"]');
      if (!btn || !tabsBox.contains(btn)) return;
      activate(btn.dataset.game);
    });
    // 横向 tablist：左右方向键移动并激活，Home / End 跳首尾。
    // 不接管上下方向键 —— 那会夺掉焦点在按钮上时的页面滚动。
    tabsBox.addEventListener('keydown', (e) => {
      const btn = e.target.closest && e.target.closest('[role="tab"]');
      if (!btn) return;
      const list = tabButtons();
      const i = list.indexOf(btn);
      if (i < 0) return;
      let next = -1;
      if (e.key === 'ArrowRight') next = (i + 1) % list.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + list.length) % list.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = list.length - 1;
      else return;
      e.preventDefault();
      list[next].focus();
      activate(list[next].dataset.game);
    });
  }

  // ---------- 启动 ----------
  renderTabs();
  if (!GAMES.length) {
    showNotice('游戏室正在布置', '这里会放几款简单的小游戏，先占个位置。');
    refreshLayout();
    return;
  }
  activate(GAMES[0].id);
})();
