// ============ 游戏室 · 2048 ============
// 实现契约见 js/games.js 文件头：本文件只向 window.GAME_RUNNERS 注册 id 为 '2048' 的一款。
//
// 操作：方向键 / WASD（桌面）· 滑动（触屏与鼠标拖拽，由 ctx.onSwipe 提供）· R 键或按钮重开。
// 计分：每次合并得分累计（合并结果值相加）；最佳分走 ctx.best（框架管理的 localStorage，
//       键 youxi_best_2048_v1），破纪录即时落盘，刷新不丢。
//
// 行为约定（与经典 2048 对齐）：
//   - 一次移动中每个方块最多参与一次合并（[2,2,4,4] 向左 → [4,8,·,·]）；
//   - 只有盘面真的发生变化才消耗回合并生成新块（90% 为 2、10% 为 4）；
//   - 无空格且无相邻同值 → 终局；合成出 2048 弹出祝贺，可关掉继续挑战更大的数字。
//
// 移动动画：方块绝对定位，位移全部走 CSS transform 过渡（js 只改 --r/--c 变量）；
//   动画窗口（SLIDE_MS）内的输入直接忽略，避免中途重排导致状态错乱。
//   prefers-reduced-motion 时整个游戏挂 .no-anim，移动同步落地、无任何过渡/弹跳。
//
// 测试 / 调试锚点：导航前设置 window.__G2048_SEED__（长度 16 的数字数组，行优先，0 为空格），
//   可固定初始盘面（随后照常按回合随机生成新块）。设置 null / 非法值即恢复随机开局。
(function () {
  'use strict';

  var SIZE = 4;
  var CELLS = SIZE * SIZE;
  var SLIDE_MS = 160; // 须与 games.css 里 .g2048-tile 的 transform 过渡时长一致
  var WIN_VALUE = 2048;

  window.GAME_RUNNERS = window.GAME_RUNNERS || {};

  // ---- 纯逻辑：单行向 index 0 方向压实合并 ----
  // line: 长度 4 的数组（tile 或 null，tile 形如 { v, r, c, el }）。
  // 返回 { out: 压实后的新数组, merges: [{absorber, absorbed}], gained: 本次得分, moved: 是否有变化 }
  function compactLine(line) {
    var tiles = [];
    for (var i = 0; i < line.length; i++) {
      if (line[i]) tiles.push(line[i]);
    }

    var out = new Array(line.length).fill(null);
    var merges = [];
    var gained = 0;
    var k = 0;
    for (var j = 0; j < tiles.length; j++) {
      if (j + 1 < tiles.length && tiles[j].v === tiles[j + 1].v) {
        out[k] = tiles[j];
        merges.push({ absorber: tiles[j], absorbed: tiles[j + 1] });
        gained += tiles[j].v * 2;
        j++; // 被吸收块跳过：一轮移动中每个块只合并一次
      } else {
        out[k] = tiles[j];
      }
      k++;
    }

    var moved = merges.length > 0;
    for (var m = 0; m < line.length; m++) {
      if (line[m] !== out[m]) moved = true;
    }
    return { out: out, merges: merges, gained: gained, moved: moved };
  }

  // 每个方向的第 L 条「线」上的 4 个槽位坐标，按「朝墙方向」排列（slots[0] 紧贴墙）。
  function slotsFor(dir, L) {
    var s = [];
    for (var i = 0; i < SIZE; i++) {
      if (dir === 'left') s.push({ r: L, c: i });
      else if (dir === 'right') s.push({ r: L, c: SIZE - 1 - i });
      else if (dir === 'up') s.push({ r: i, c: L });
      else s.push({ r: SIZE - 1 - i, c: L });
    }
    return s;
  }

  function mount(ctx) {
    var reduceMotion = !!ctx.reduceMotion;

    // ---- 骨架 ----
    var root = document.createElement('div');
    root.className = 'g2048' + (reduceMotion ? ' no-anim' : '');

    var bar = document.createElement('div');
    bar.className = 'g2048-top';

    function makeScore(label) {
      var box = document.createElement('div');
      box.className = 'g2048-score';
      var s = document.createElement('span');
      s.textContent = label;
      var strong = document.createElement('strong');
      box.appendChild(s);
      box.appendChild(strong);
      bar.appendChild(box);
      return strong;
    }
    var scoreNowEl = makeScore('得分');
    var scoreBestEl = makeScore('最佳');

    var btnRestart = document.createElement('button');
    btnRestart.type = 'button';
    btnRestart.className = 'filter-chip g2048-restart';
    btnRestart.textContent = '新开一局';
    bar.appendChild(btnRestart);

    var board = document.createElement('div');
    board.className = 'g2048-board';

    // 16 个底格（纯背景，位置与方块同一套变量定位）
    for (var r0 = 0; r0 < SIZE; r0++) {
      for (var c0 = 0; c0 < SIZE; c0++) {
        var cell = document.createElement('div');
        cell.className = 'g2048-cell';
        cell.style.setProperty('--r', String(r0));
        cell.style.setProperty('--c', String(c0));
        board.appendChild(cell);
      }
    }

    // 终局 / 达成弹层（视觉层；播报走 ctx.hud 的 aria-live 行）
    var overlay = document.createElement('div');
    overlay.className = 'g2048-overlay';
    overlay.hidden = true;
    var ovTitle = document.createElement('p');
    ovTitle.className = 'g2048-overlay-title';
    var ovText = document.createElement('p');
    ovText.className = 'g2048-overlay-text';
    var ovBtn = document.createElement('button');
    ovBtn.type = 'button';
    ovBtn.className = 'filter-chip g2048-overlay-btn';
    overlay.appendChild(ovTitle);
    overlay.appendChild(ovText);
    overlay.appendChild(ovBtn);

    root.appendChild(bar);
    root.appendChild(board);
    board.appendChild(overlay);
    ctx.el.appendChild(root);

    // ---- 状态 ----
    var grid = newGrid();
    var score = 0;
    var best = ctx.best.get();
    var newRecord = false; // 本局是否刷新过最佳分（终局文案用）
    var won = false;       // 是否已祝贺过 2048（只祝贺一次，之后继续玩不再弹）
    var busy = false;      // 动画窗口内锁输入
    var timer = null;      // 动画收尾定时器

    function newGrid() {
      var g = [];
      for (var i = 0; i < SIZE; i++) g.push(new Array(SIZE).fill(null));
      return g;
    }

    // ---- 尺寸：--cell / --gap 由 JS 依盘面宽度计算，格与块共用（ResizeObserver 跟随） ----
    function relayout() {
      var w = board.clientWidth;
      if (!w) return;
      var gap = Math.max(5, Math.min(12, Math.round(w * 0.028)));
      var cell = (w - gap * 5) / 4; // 左右各缩进一个 gap：4cell + 3gap + 2gap = w
      board.style.setProperty('--gap', gap + 'px');
      board.style.setProperty('--cell', cell + 'px');
    }
    function relayoutNoAnim() {
      if (reduceMotion) { relayout(); return; }
      root.classList.add('no-anim');
      relayout();
      void board.offsetWidth; // 先让尺寸跳到位，再放开过渡
      requestAnimationFrame(function () { root.classList.remove('no-anim'); });
    }
    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(relayoutNoAnim);
      ro.observe(board);
    }
    relayoutNoAnim();

    // ---- 方块 DOM ----
    function makeTileEl(t, extraClass) {
      var el = document.createElement('div');
      el.className = 'g2048-tile' + (extraClass ? ' ' + extraClass : '');
      el.dataset.v = String(t.v);
      var span = document.createElement('span');
      span.className = 'g2048-tile-v';
      span.textContent = String(t.v);
      el.appendChild(span);
      place(t, el);
      board.appendChild(el);
      t.el = el;
    }
    function place(t, el) {
      var node = el || t.el;
      node.style.setProperty('--r', String(t.r));
      node.style.setProperty('--c', String(t.c));
    }
    function paint(t) {
      t.el.dataset.v = String(t.v);
      t.el.firstChild.textContent = String(t.v);
    }
    function pop(el) {
      if (reduceMotion) return;
      el.classList.remove('is-merged');
      void el.offsetWidth; // 重触发弹跳动画
      el.classList.add('is-merged');
    }

    function spawn() {
      var empties = [];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (!grid[r][c]) empties.push({ r: r, c: c });
        }
      }
      if (!empties.length) return;
      var pos = empties[Math.floor(Math.random() * empties.length)];
      var t = { v: Math.random() < 0.9 ? 2 : 4, r: pos.r, c: pos.c, el: null };
      grid[pos.r][pos.c] = t;
      makeTileEl(t, 'is-new');
    }

    // ---- 移动 ----
    function move(dir) {
      if (busy) return; // 上一手的动画还没落地：忽略本次输入

      var next = newGrid();
      var merges = [];
      var gained = 0;
      var moved = false;

      for (var L = 0; L < SIZE; L++) {
        var slots = slotsFor(dir, L);
        var line = [];
        for (var i = 0; i < SIZE; i++) line.push(grid[slots[i].r][slots[i].c]);
        var res = compactLine(line);
        if (res.moved) moved = true;
        gained += res.gained;

        for (var k = 0; k < SIZE; k++) {
          var t = res.out[k];
          if (!t) continue;
          t.r = slots[k].r;
          t.c = slots[k].c;
          next[t.r][t.c] = t;
          place(t);
        }
        for (var m = 0; m < res.merges.length; m++) {
          var mg = res.merges[m];
          mg.absorbed.r = mg.absorber.r; // 被吸收块滑到吸收者的新位置
          mg.absorbed.c = mg.absorber.c;
          place(mg.absorbed);
          merges.push(mg);
        }
      }

      if (!moved) return;
      grid = next;
      busy = true;

      if (reduceMotion) {
        finalize(gained, merges);
      } else {
        timer = setTimeout(function () { finalize(gained, merges); }, SLIDE_MS);
      }
    }

    function finalize(gained, merges) {
      timer = null;
      busy = false;

      for (var i = 0; i < merges.length; i++) {
        merges[i].absorbed.el.remove();
        merges[i].absorbed.el = null;
      }
      for (var j = 0; j < merges.length; j++) {
        var t = merges[j].absorber;
        t.v *= 2;
        paint(t);
        pop(t.el);
      }

      if (gained > 0) {
        score += gained;
        if (score > best) {
          best = score;
          newRecord = true;
          ctx.best.set(best); // 破纪录即时落盘，中途关页不丢
        }
        paintScore();
      }

      spawn();
      checkEnd();
    }

    function hasValue(v) {
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (grid[r][c] && grid[r][c].v >= v) return true;
        }
      }
      return false;
    }
    function hasMoves() {
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          var t = grid[r][c];
          if (!t) return true;
          if (c + 1 < SIZE && grid[r][c + 1] && grid[r][c + 1].v === t.v) return true;
          if (r + 1 < SIZE && grid[r + 1][c] && grid[r + 1][c].v === t.v) return true;
        }
      }
      return false;
    }

    function checkEnd() {
      if (!won && hasValue(WIN_VALUE)) {
        won = true;
        ctx.hud('达成 ' + WIN_VALUE + '！');
        showOverlay(
          '达成 ' + WIN_VALUE + '！',
          '本局得分 ' + score + (newRecord ? ' · 新纪录' : '') + '，还可以继续挑战更大的数字。',
          '继续挑战',
          hideOverlay
        );
      } else if (!hasMoves()) {
        ctx.hud('游戏结束，本局得分 ' + score);
        showOverlay(
          '没地方动了',
          '本局得分 ' + score + (newRecord && score > 0 ? ' · 新纪录' : ''),
          '再来一局',
          restart
        );
      }
    }

    // ---- 弹层 ----
    function showOverlay(title, text, btnLabel, onClick) {
      ovTitle.textContent = title;
      ovText.textContent = text;
      ovBtn.textContent = btnLabel;
      ovBtn.onclick = onClick;
      overlay.hidden = false;
      ovBtn.focus();
    }
    function hideOverlay() {
      overlay.hidden = true;
      ovBtn.onclick = null;
    }

    // ---- 计分展示 ----
    function paintScore() {
      scoreNowEl.textContent = String(score);
      scoreBestEl.textContent = String(best);
    }

    // ---- 重开 ----
    function restart() {
      if (busy) return; // 动画中不重开：finalize 里持有旧格引用，半途清盘会错乱
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (grid[r][c] && grid[r][c].el) grid[r][c].el.remove();
        }
      }
      grid = newGrid();
      score = 0;
      newRecord = false;
      won = false;
      hideOverlay();
      paintScore();
      spawn();
      spawn();
      ctx.hud('新的一局开始，得分已清零');
    }
    btnRestart.addEventListener('click', restart);

    // ---- 输入 ----
    ctx.onKey({
      ArrowLeft: function () { move('left'); },
      ArrowRight: function () { move('right'); },
      ArrowUp: function () { move('up'); },
      ArrowDown: function () { move('down'); },
      a: function () { move('left'); },
      d: function () { move('right'); },
      w: function () { move('up'); },
      s: function () { move('down'); },
      r: restart,
      R: restart,
    });
    ctx.onSwipe(move); // onSwipe 回调的 'up'|'down'|'left'|'right' 与 move 的方向参数同名同义

    // ---- 开局 ----
    paintScore();
    var seed = window.__G2048_SEED__;
    if (Array.isArray(seed) && seed.length === CELLS
      && seed.every(function (n) { return typeof n === 'number' && isFinite(n) && n >= 0; })) {
      for (var i = 0; i < CELLS; i++) {
        var v = Math.floor(seed[i]);
        if (v <= 0) continue;
        var t = { v: v, r: Math.floor(i / SIZE), c: i % SIZE, el: null };
        grid[t.r][t.c] = t;
        makeTileEl(t, 'is-new');
      }
      checkEnd(); // 种子可能直接是终局盘面（满盘且无路可走）
    } else {
      spawn();
      spawn();
    }

    // ---- 清理：切走 / 离开页面时由框架调用 ----
    return function destroy() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (ro) { ro.disconnect(); ro = null; }
    };
  }

  window.GAME_RUNNERS['2048'] = { mount: mount };
})();
