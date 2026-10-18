// ============ 游戏室 · 七巧板（机器人维修） ============
// 契约见 js/games.js 文件头：本文件只向 window.GAME_RUNNERS 注册 id 为 'tangram' 的一款。
//
// 玩法：6×6 纯网格，板面外沿标着每行、每列需要被覆盖的格数（LEVELS 里每关的 row / col 是唯一数据源）。
//       把托盘里的 6 块积木全部用上、不越出板面、互不重叠，并且让每行每列被覆盖的格数正好对上
//       旁边的数字，即通关。注意：提示数之和 = 积木总面积，所以不要求填满板面 —— 只要求各行列对上号。
//       共 4 关，难度递增（第 1 关 3 个解 → 第 2 关 2 个解 → 第 3 / 4 关唯一解）；通关弹层里还有下一关时给「下一关」。
//
// 输入：点托盘积木 = 选中/手持 —— 手持期间积木会变成一块「幽灵块」跟着指针走（见下），
//       点板面格 = 以该块「带圆点的格子」为锚点落子；再点同一块托盘积木 = 取消手持；
//       从托盘按住拖到板面松手 = 直接落子；点已放置的积木 = 取回；
//       点关卡芯片 = 切到那一关（清空板面重来，换成那一关的行列数字）；
//       「旋转」按钮或 R 键 = 旋转手持积木；「重置」按钮 = 清空重来；
//       「提示」按钮 = 按「当前盘面」现场求一步（不存在写死的答案，见下 solveAssignments）。
// 落点反馈：拖动/悬停时把受影响的目标格染色（绿=可放，红=越界或重叠），松手才真正落子。
// 手感（手持跟随）：指针移到板面上时幽灵块吸附到 6×6 网格（吸附点 = 真正会落下的位置），
//       离开板面则自由跟随指针 —— 位置 1:1 跟手、不加缓动（这是功能性交互，插值只会让落点难对准）；
//       触屏没有 hover 概念，触控路径不出幽灵块，仍走板面格染色。
// 颜色：6 块积木的填充色全部取自站点 token（见 css/src/pages/games.css 的 .tg [data-piece=…] 映射），零字面量。
(function () {
  'use strict';

  var SIZE = 6;
  var CELLS = SIZE * SIZE;
  var DRAG_MIN = 6; // 拖拽判定阈值（px）：位移小于它算「轻点」，交给 click 处理

  // 关卡（唯一数据源）：每关的 row / col = 该行 / 该列需要被积木覆盖的格数，标在板面外沿。
  // 每关两串之和必须相等，且等于积木总面积（4+4+4+4+3+3 = 22），否则那一关无解。
  // 下面 4 关都用回溯求解器枚举验证过：第 1 关 3 解、第 2 关 2 解、第 3 / 4 关唯一解（难度递增）。
  var LEVELS = [
    { name: '第 1 关', row: [4, 4, 5, 2, 3, 4], col: [4, 2, 6, 4, 2, 4] },
    { name: '第 2 关', row: [4, 2, 5, 3, 2, 6], col: [3, 4, 3, 3, 6, 3] },
    { name: '第 3 关', row: [6, 5, 2, 2, 4, 3], col: [2, 4, 3, 5, 2, 6] },
    { name: '第 4 关', row: [5, 4, 2, 4, 3, 4], col: [3, 5, 6, 1, 2, 5] },
  ];

  // 积木（基础朝向的相对坐标，已归一化）：
  // 面积 4 + 4 + 4 + 4 + 3 + 3 = 22 = 每关提示数之和。
  var PIECES = [
    { id: 'i4', name: '长条', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { id: 'o', name: '方块', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { id: 's', name: 'S 形', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    { id: 't', name: 'T 形', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
    { id: 'i3', name: '短条', cells: [[0, 0], [0, 1], [0, 2]] },
    { id: 'l3', name: '角形', cells: [[0, 0], [1, 0], [1, 1]] },
  ];

  // ---- 旋转工具：把基础朝向转出 4 个朝向并去重（方块只剩 1 个、长条剩 2 个） ----
  function normalize(cells) {
    var mr = Infinity;
    var mc = Infinity;
    cells.forEach(function (p) { if (p[0] < mr) mr = p[0]; if (p[1] < mc) mc = p[1]; });
    return cells.map(function (p) { return [p[0] - mr, p[1] - mc]; })
      .sort(function (a, b) { return (a[0] - b[0]) || (a[1] - b[1]); });
  }
  function rotateCW(cells) {
    // (r, c) → (c, -r) 即顺时针 90°，再平移回左上角
    return normalize(cells.map(function (p) { return [p[1], -p[0]]; }));
  }
  function buildRotations(cells) {
    var out = [];
    var seen = {};
    var cur = normalize(cells);
    for (var k = 0; k < 4; k++) {
      var key = cur.map(function (p) { return p.join(','); }).join(';');
      if (!seen[key]) { seen[key] = 1; out.push(cur); }
      cur = rotateCW(cur);
    }
    return out;
  }
  PIECES.forEach(function (p) { p.rots = buildRotations(p.cells); });

  // ---- 求解器（「提示」按钮用） ----
  // 给定「哪些格被哪块占着」（own，只读副本）、「哪几块已经固定」（locked，null 表示待求）与本关的
  // 行列提示（row / col），找出一整套满足行列提示数的摆法。
  // 提示必须按当前盘面现场求，不能照搬某个写死的解 —— 第 1 关就有 3 个解，玩家可能正走在另一个解上，
  // 写死的解一旦不一致就会把人指错。
  // 返回 assign：长度 6 的数组，assign[p] = { rot, or, oc }（已固定块回填原摆法）；无解返回 null。
  // 规模极小（≤5 块 × 去重后的朝向 × 36 个锚点），且每步都用「行列不得超过提示数」剪枝，纯同步开销可忽略。
  function solveAssignments(own, locked, row, col) {
    var assign = locked.slice();
    var rc = new Array(SIZE).fill(0);
    var cc = new Array(SIZE).fill(0);
    for (var k = 0; k < CELLS; k++) if (own[k] >= 0) { rc[Math.floor(k / SIZE)]++; cc[k % SIZE]++; }
    // 已经固定住的块要是把某行/列顶过了头，当前摆法必然解不开，不必再搜
    for (var i = 0; i < SIZE; i++) {
      if (rc[i] > row[i] || cc[i] > col[i]) return null;
    }
    var found = false;
    function dfs(p) {
      if (found) return;
      if (p === PIECES.length) {
        for (var q = 0; q < SIZE; q++) {
          if (rc[q] !== row[q] || cc[q] !== col[q]) return;
        }
        found = true;
        return;
      }
      if (locked[p]) { dfs(p + 1); return; } // 已固定：不参与搜索，只检查它在不在解里
      var rots = PIECES[p].rots;
      for (var kk = 0; kk < rots.length && !found; kk++) {
        var a = rots[kk][0];
        for (var R = 0; R < SIZE && !found; R++) {
          for (var C = 0; C < SIZE && !found; C++) {
            var or = R - a[0];
            var oc = C - a[1];
            var idxs = [];
            var fits = true;
            for (var j = 0; j < rots[kk].length; j++) {
              var rr = or + rots[kk][j][0];
              var ccc = oc + rots[kk][j][1];
              if (rr < 0 || rr >= SIZE || ccc < 0 || ccc >= SIZE) { fits = false; break; }
              if (own[rr * SIZE + ccc] >= 0) { fits = false; break; }
              if (rc[rr] + 1 > row[rr] || cc[ccc] + 1 > col[ccc]) { fits = false; break; }
              idxs.push(rr * SIZE + ccc);
            }
            if (!fits) continue;
            for (var m = 0; m < idxs.length; m++) {
              own[idxs[m]] = p;
              rc[Math.floor(idxs[m] / SIZE)]++;
              cc[idxs[m] % SIZE]++;
            }
            assign[p] = { rot: kk, or: or, oc: oc };
            dfs(p + 1);
            // 无论成败都先把落子回退（own / rc / cc 是借用来的工作区）；
            // 成功时要在回退之后立刻返回，才能把各层写好的 assign 原样带出去。
            for (var n = 0; n < idxs.length; n++) {
              own[idxs[n]] = -1;
              rc[Math.floor(idxs[n] / SIZE)]--;
              cc[idxs[n] % SIZE]--;
            }
            if (found) return;
            assign[p] = null;
          }
        }
      }
    }
    dfs(0);
    return found ? assign : null;
  }

  window.GAME_RUNNERS = window.GAME_RUNNERS || {};
  window.GAME_RUNNERS['tangram'] = { mount: mount };

  function mount(ctx) {
    // ---- 状态 ----
    var levelIdx = 0;                                      // 当前关卡下标（LEVELS 里的位置）
    var placements = new Array(PIECES.length).fill(null); // 每块：null 或 { rot, or, oc }
    var rotations = PIECES.map(function () { return 0; }); // 每块当前的朝向下标
    var owner = new Array(CELLS).fill(-1);                 // 每格归属的积木下标，-1 = 空
    var selected = -1;                                     // 手持的积木下标，-1 = 未手持
    var preview = null;                                    // { or, oc, ok } 当前的落点预览
    var drag = null;                                       // 拖动中：{ piece, x, y, moved, pointerId }
    var swallowClick = false;                              // 拖拽结束后的那次 click 要吞掉
    var solvedFlag = false;                                // 已通关：锁住落子
    var pointer = null;                                    // 最近一次鼠标/手写笔位置：{ x, y } —— 幽灵块跟随的唯一坐标源
    var pointerTouch = false;                              // 最近一次指针交互是否触屏（触屏没有 hover：不出幽灵块、不给悬停预览）
    var ghost = null;                                      // 手持幽灵块（挂在 body 上的游离节点，销毁时必须摘掉）
    var ghostKey = '';                                     // 幽灵块当前的构建依据 '<积木下标>:<朝向下标>'，变化即重建
    var geom = null;                                       // 板面几何快照：{ cell, step, left, top }（视口坐标；滚动/改尺寸后置空重测）
    var hint = null;                                       // 当前提示：{ piece, cells, kind: 'place' | 'retract' }，null = 无提示

    // ---- 骨架 ----
    var root = document.createElement('div');
    root.className = 'tg';

    var main = document.createElement('div');
    main.className = 'tg-main';

    var boardEl = document.createElement('div');
    boardEl.className = 'tg-board';
    boardEl.setAttribute('role', 'application');
    boardEl.setAttribute('aria-label', '七巧板板面，6 乘 6，把 6 块积木拼到每行每列的覆盖数都对上旁边的数字');
    var cells = new Array(CELLS);
    for (var i = 0; i < CELLS; i++) {
      var cell = document.createElement('div');
      cell.className = 'tg-cell';
      cell.dataset.i = String(i);
      cells[i] = cell;
      boardEl.appendChild(cell);
    }

    var overlay = document.createElement('div');
    overlay.className = 'tg-overlay';
    overlay.hidden = true;
    var overlayTitle = document.createElement('p');
    overlayTitle.className = 'tg-overlay-title';
    overlayTitle.textContent = '机器人修好了！';
    var overlayText = document.createElement('p');
    overlayText.className = 'tg-overlay-text';
    overlayText.textContent = '6 块积木全部归位，行与列的数字也对上了。';
    // 弹层按钮行：还有下一关时给「下一关」，最后一关只剩「再拼一次」。
    // 两者共用 .tg-overlay-btn 的触摸目标尺寸；e2e 分别用 .tg-overlay-next / .tg-overlay-replay 定位。
    var overlayActions = document.createElement('div');
    overlayActions.className = 'tg-overlay-actions';
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'filter-chip tg-overlay-btn tg-overlay-next';
    nextBtn.textContent = '下一关';
    nextBtn.setAttribute('aria-label', '进入下一关，重新拼');
    nextBtn.addEventListener('click', goNextLevel);
    var overlayBtn = document.createElement('button');
    overlayBtn.type = 'button';
    overlayBtn.className = 'filter-chip tg-overlay-btn tg-overlay-replay';
    overlayBtn.textContent = '再拼一次';
    overlayBtn.setAttribute('aria-label', '清空板面，重新拼一次');
    overlayBtn.addEventListener('click', resetBoard);
    overlayActions.appendChild(nextBtn);
    overlayActions.appendChild(overlayBtn);
    overlay.appendChild(overlayTitle);
    overlay.appendChild(overlayText);
    overlay.appendChild(overlayActions);

    // 叠加层放进板面内部：绝对定位脱离 Grid 流，不占格，按板面尺寸铺满（与 2048 弹层同一口径）
    boardEl.appendChild(overlay);

    // 关卡芯片行：复用共享 .filter-chip，与 .games-tabs 同一口径
    // （role=tab + aria-selected + .active + 漫游 tabindex）。文本与 aria-label 由 applyLevel() 按当前关刷新。
    var levelsRow = document.createElement('div');
    levelsRow.className = 'tg-levels';
    levelsRow.setAttribute('role', 'tablist');
    levelsRow.setAttribute('aria-label', '关卡选择');
    var levelChips = LEVELS.map(function (lv, li) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter-chip tg-level';
      b.dataset.level = String(li);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', li === 0 ? 'true' : 'false');
      b.tabIndex = li === 0 ? 0 : -1;
      b.textContent = lv.name;
      b.addEventListener('click', function () { loadLevel(li); });
      levelsRow.appendChild(b);
      return b;
    });
    // 横向 tablist：左右方向键移动并激活，Home / End 跳首尾（与 js/games.js 的切换条同一套手势）
    levelsRow.addEventListener('keydown', function (e) {
      var at = levelChips.indexOf(document.activeElement);
      if (at < 0) return;
      var to = -1;
      if (e.key === 'ArrowRight') to = (at + 1) % LEVELS.length;
      else if (e.key === 'ArrowLeft') to = (at + LEVELS.length - 1) % LEVELS.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = LEVELS.length - 1;
      if (to < 0) return;
      e.preventDefault();
      levelChips[to].focus();
      loadLevel(to);
    });

    // 提示条：板面外沿的数字（上 = 每列，左 = 每行）。包一层 grid 把「列提示 / 行提示 / 板面」
    // 摆成对齐的三角布局：左上角留空、列提示占顶行、行提示占左列、板面占右下 —— 三条轨道逐格对齐。
    var boardWrap = document.createElement('div');
    boardWrap.className = 'tg-board-wrap';

    var colHints = document.createElement('div');
    colHints.className = 'tg-col-hints';
    colHints.setAttribute('role', 'group');
    colHints.setAttribute('aria-label', '每列需要覆盖的格数');
    var rowHints = document.createElement('div');
    rowHints.className = 'tg-row-hints';
    rowHints.setAttribute('role', 'group');
    rowHints.setAttribute('aria-label', '每行需要覆盖的格数');

    // 初值取第 1 关；切关时由 applyLevel() 刷新文本与 aria-label。
    // role=img + aria-label：把孤立数字读成「第 N 列 / 行需要覆盖 M 格」，屏幕阅读器下才有意义。
    var colHintEls = new Array(SIZE);
    for (var ci = 0; ci < SIZE; ci++) {
      var ch = document.createElement('span');
      ch.className = 'tg-hint';
      ch.textContent = String(LEVELS[0].col[ci]);
      ch.setAttribute('role', 'img');
      ch.setAttribute('aria-label', '第 ' + (ci + 1) + ' 列需要覆盖 ' + LEVELS[0].col[ci] + ' 格');
      colHintEls[ci] = ch;
      colHints.appendChild(ch);
    }
    var rowHintEls = new Array(SIZE);
    for (var ri = 0; ri < SIZE; ri++) {
      var rh = document.createElement('span');
      rh.className = 'tg-hint';
      rh.textContent = String(LEVELS[0].row[ri]);
      rh.setAttribute('role', 'img');
      rh.setAttribute('aria-label', '第 ' + (ri + 1) + ' 行需要覆盖 ' + LEVELS[0].row[ri] + ' 格');
      rowHintEls[ri] = rh;
      rowHints.appendChild(rh);
    }
    boardWrap.appendChild(colHints);
    boardWrap.appendChild(rowHints);
    boardWrap.appendChild(boardEl);

    // 侧栏：托盘 + 控制按钮
    var side = document.createElement('div');
    side.className = 'tg-side';

    var tray = document.createElement('div');
    tray.className = 'tg-tray';
    tray.setAttribute('role', 'group');
    tray.setAttribute('aria-label', '积木托盘');
    var pieceBtns = new Array(PIECES.length);
    PIECES.forEach(function (p, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tg-piece';
      b.dataset.piece = p.id;
      b.dataset.idx = String(idx);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('pointerdown', function (e) { onPiecePointerDown(e, idx); });
      b.addEventListener('click', function (e) { onPieceClick(e, idx); });
      pieceBtns[idx] = b;
      tray.appendChild(b);
    });

    var controls = document.createElement('div');
    controls.className = 'tg-controls';
    var rotateBtn = document.createElement('button');
    rotateBtn.type = 'button';
    rotateBtn.className = 'filter-chip tg-rotate';
    rotateBtn.textContent = '旋转';
    rotateBtn.setAttribute('aria-label', '旋转手持的积木');
    rotateBtn.addEventListener('click', rotateSelected);
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'filter-chip tg-reset';
    resetBtn.textContent = '重置';
    resetBtn.setAttribute('aria-label', '清空板面，重新拼');
    resetBtn.addEventListener('click', resetBoard);
    var hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.className = 'filter-chip tg-hintbtn';
    hintBtn.textContent = '提示';
    hintBtn.setAttribute('aria-label', '给出下一步的提示');
    hintBtn.addEventListener('click', requestHint);
    controls.appendChild(rotateBtn);
    controls.appendChild(hintBtn);
    controls.appendChild(resetBtn);

    side.appendChild(tray);
    side.appendChild(controls);
    main.appendChild(boardWrap);
    main.appendChild(side);
    root.appendChild(levelsRow);
    root.appendChild(main);
    ctx.el.appendChild(root);

    // 手持幽灵块：挂在 document.body 上而不是板面/舞台里 ——
    //   ① 它要跟着指针走出板面甚至走出舞台，放在舞台内会被祖先的 overflow 裁掉；
    //   ② position: fixed 的包含块会被任何祖先的 transform / filter / backdrop-filter 劫持
    //      （舞台上有入场动画与玻璃态），挂 body 才能保证坐标就是视口坐标。
    // 代价：它不在 .tg 作用域内，所以 games.css 的色板映射宿主写成了 :is(.tg, .tg-ghost)；
    // 纯装饰（落点语义由板面格与 hud 承载），故 aria-hidden，且必须 pointer-events: none ——
    // 否则 elementFromPoint 会命中幽灵块，板面格判定全部失效。
    ghost = document.createElement('div');
    ghost.className = 'tg-ghost';
    ghost.hidden = true;
    ghost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghost);

    // ---- 小工具 ----
    function inBounds(r, c) {
      return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
    }
    function rotCells(idx, k) { return PIECES[idx].rots[k]; }
    function indexOf(r, c) { return r * SIZE + c; }
    function placedCount() {
      var n = 0;
      for (var k = 0; k < placements.length; k++) if (placements[k]) n++;
      return n;
    }
    function defaultHud() {
      return '已放 ' + placedCount() + '/' + PIECES.length + ' 块 · 每行每列的数字都对上就修好了';
    }
    function curLevel() { return LEVELS[levelIdx]; }
    function cellFromPoint(x, y) {
      if (typeof x !== 'number' || typeof y !== 'number') return -1;
      var el = document.elementFromPoint(x, y);
      var cellEl = el && el.closest ? el.closest('.tg-cell') : null;
      if (!cellEl || !boardEl.contains(cellEl)) return -1;
      return Number(cellEl.dataset.i);
    }

    // ---- 手持幽灵块：跟随指针 + 吸附板面格 ----
    // 与「板面格染色」是同一份落点信息的两种呈现：格染色回答「会落在哪几格」，
    // 幽灵块回答「手上这块现在长这样、在什么位置」。两者共用 preview，不会各说各话。
    function measureBoard() {
      // 一次 rect 读 + 一次 computed 读，产出一份纯算术的快照；
      // 之后每次 pointermove 都只做计算，不再读布局 —— 在 pointermove 里读布局会强制同步重排。
      if (!cells[0]) return;
      var r0 = cells[0].getBoundingClientRect();
      var cs = getComputedStyle(boardEl);
      var gap = parseFloat(cs.columnGap);
      if (!isFinite(gap)) gap = parseFloat(cs.gap) || 0;
      var next = { cell: r0.width, step: r0.width + gap, left: r0.left, top: r0.top };
      // 格子尺寸变了（断点切换 / 窗口缩放）必须按新尺寸重建幽灵块；只是位置变了（滚动）不用
      if (!geom || geom.cell !== next.cell || geom.step !== next.step) ghostKey = '';
      geom = next;
    }
    function buildGhost(idx, k) {
      var key = idx + ':' + k;
      if (ghostKey === key) return;
      ghostKey = key;
      ghost.textContent = '';
      var rc = rotCells(idx, k);
      var a = rc[0];
      var maxR = 0;
      var maxC = 0;
      rc.forEach(function (p) {
        var sq = document.createElement('span');
        sq.className = 'tg-ghost-cell';
        sq.setAttribute('data-piece', PIECES[idx].id); // 取色走 .tg-ghost 作用域里的同一条映射
        if (p[0] === a[0] && p[1] === a[1]) sq.classList.add('is-anchor'); // 锚点格 = 落子时对准目标格的那格
        sq.style.left = ((p[1] - a[1]) * geom.step) + 'px';
        sq.style.top = ((p[0] - a[0]) * geom.step) + 'px';
        sq.style.width = geom.cell + 'px';
        sq.style.height = geom.cell + 'px';
        ghost.appendChild(sq);
        if (p[0] > maxR) maxR = p[0];
        if (p[1] > maxC) maxC = p[1];
      });
      // 子格全是绝对定位，撑不出父盒 —— 不显式给尺寸，这块幽灵就是 0×0：
      // 投影会被裁成一条线，可见性判断（含 e2e 的 toBeVisible）也会把它当隐藏元素。
      ghost.style.width = (maxC * geom.step + geom.cell) + 'px';
      ghost.style.height = (maxR * geom.step + geom.cell) + 'px';
    }
    function moveGhost() {
      var a = rotCells(selected, rotations[selected])[0];
      var x;
      var y;
      if (preview) {
        // 吸附：幽灵块的锚点格正好盖住目标格 —— 所见即落点，不会「看起来偏了半格」
        x = geom.left + (preview.oc + a[1]) * geom.step;
        y = geom.top + (preview.or + a[0]) * geom.step;
      } else {
        // 自由跟随：锚点格中心对准指针。1:1、无缓动 —— 功能性交互加插值只会让落点难对准
        x = pointer.x - geom.cell / 2 - a[1] * geom.step;
        y = pointer.y - geom.cell / 2 - a[0] * geom.step;
      }
      ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }
    function hideGhost() {
      if (!ghost) return;
      ghost.hidden = true;
      ghost.classList.remove('is-ok', 'is-bad');
    }
    // 手持状态 → 幽灵块的唯一同步点：所有会改变「手持 / 朝向 / 预览」的路径末尾都要调它
    function syncHeld() {
      if (solvedFlag || selected < 0 || pointerTouch || !pointer) { hideGhost(); return; }
      if (!geom) measureBoard();
      buildGhost(selected, rotations[selected]);
      ghost.hidden = false;
      ghost.classList.toggle('is-ok', !!(preview && preview.ok));
      ghost.classList.toggle('is-bad', !!(preview && !preview.ok));
      moveGhost();
    }

    // ---- 渲染 ----
    // 由一份摆法清单推出「每格归属哪块」—— render 与「提示」的求解器都用它，只此一处口径
    function ownerOf(list) {
      var own = new Array(CELLS).fill(-1);
      list.forEach(function (p, idx) {
        if (!p) return;
        rotCells(idx, p.rot).forEach(function (rc) {
          var r = p.or + rc[0];
          var c = p.oc + rc[1];
          if (inBounds(r, c)) own[indexOf(r, c)] = idx;
        });
      });
      return own;
    }
    // owner 与板面 class/data 全部由 placements 推导，是唯一的真实来源
    function render() {
      owner = ownerOf(placements);
      for (var k = 0; k < CELLS; k++) {
        var o = owner[k];
        if (o >= 0) cells[k].setAttribute('data-piece', PIECES[o].id);
        else cells[k].removeAttribute('data-piece');
      }
      renderHints();
      clearPreview();
      renderTray();
      syncHeld();
    }

    // 提示条实时反馈：当前覆盖数 == 提示数 → 薄荷色（这一行/列已对上）；超过 → 珊瑚色（对不上，得挪走）。
    // owner 是唯一的覆盖来源，每次 render 重算 12 个数字，成本可忽略。
    function renderHints() {
      var rc = new Array(SIZE).fill(0);
      var cc = new Array(SIZE).fill(0);
      for (var k = 0; k < CELLS; k++) {
        if (owner[k] < 0) continue;
        rc[Math.floor(k / SIZE)]++;
        cc[k % SIZE]++;
      }
      var lv = curLevel();
      for (var i = 0; i < SIZE; i++) {
        colHintEls[i].classList.toggle('is-ok', cc[i] === lv.col[i]);
        colHintEls[i].classList.toggle('is-over', cc[i] > lv.col[i]);
        rowHintEls[i].classList.toggle('is-ok', rc[i] === lv.row[i]);
        rowHintEls[i].classList.toggle('is-over', rc[i] > lv.row[i]);
      }
    }

    // ---- 提示（求助） ----
    // 只挂类名、不造 DOM（与落点预览同一口径）：柠檬色环画在「该放的那几格」上，
    // 同时给托盘里对应的那块积木加脉冲环。色相刻意取积木色与预览色之外的 --accent-lemon，
    // 免得和「可放（薄荷）/ 放不下（珊瑚）」混淆。
    // 同时把当前提示写成一份机器可读的契约挂在根节点上（data-tg-hint）：
    //   place:<积木下标>:<朝向>:<锚点格>  |  retract:<积木下标>  |  无提示时不带该属性。
    // 仅供 e2e / 自动化读取，肉眼看不到；有它才能断言「照着提示走一定能解开」。
    function clearHint() {
      if (!hint) return;
      for (var k = 0; k < CELLS; k++) cells[k].classList.remove('is-hint');
      for (var p = 0; p < pieceBtns.length; p++) pieceBtns[p].classList.remove('is-hint');
      hint = null;
      root.removeAttribute('data-tg-hint');
    }
    function showHint(pieceIdx, cellIdxs, kind, token) {
      clearHint();
      hint = { piece: pieceIdx, cells: cellIdxs, kind: kind };
      for (var k = 0; k < cellIdxs.length; k++) cells[cellIdxs[k]].classList.add('is-hint');
      pieceBtns[pieceIdx].classList.add('is-hint');
      root.setAttribute('data-tg-hint', token);
    }
    // 提示 = 按当前盘面求一步。三种结果：
    //   ① 还有解 → 指出「第一块还没放的」积木该落在哪几格（解是按现盘面求的，与玩家当前走法自洽）；
    //   ② 无解但取回某一块就有解 → 指出该取回哪一块（从最后放下的那块往前找，优先动最近的手笔）；
    //   ③ 怎么算都无解 → 建议重置。
    function requestHint() {
      if (solvedFlag) { ctx.hud('机器人已经修好了，不用提示啦'); return; }
      var fixed = placements.slice();
      var lv = curLevel();
      var assign = solveAssignments(ownerOf(fixed), fixed, lv.row, lv.col);
      if (assign) {
        var target = -1;
        for (var p = 0; p < PIECES.length; p++) if (!fixed[p]) { target = p; break; }
        if (target >= 0) {
          var place = assign[target];
          var a0 = rotCells(target, place.rot)[0];
          var idxs = rotCells(target, place.rot).map(function (rc) {
            return indexOf(place.or + rc[0], place.oc + rc[1]);
          });
          var anchor = indexOf(place.or + a0[0], place.oc + a0[1]);
          showHint(target, idxs, 'place', 'place:' + target + ':' + place.rot + ':' + anchor);
          ctx.hud('提示：把「' + PIECES[target].name + '」放到高亮的 ' + idxs.length + ' 格上');
          return;
        }
      }
      for (var q = PIECES.length - 1; q >= 0; q--) {
        if (!fixed[q]) continue;
        var cur = fixed[q];
        var trial = fixed.slice();
        trial[q] = null;
        if (!solveAssignments(ownerOf(trial), trial, lv.row, lv.col)) continue;
        var cellsQ = rotCells(q, cur.rot).map(function (rc) {
          return indexOf(cur.or + rc[0], cur.oc + rc[1]);
        });
        showHint(q, cellsQ, 'retract', 'retract:' + q);
        ctx.hud('提示：先取回「' + PIECES[q].name + '」，再换个位置放');
        return;
      }
      ctx.hud('当前的摆法怎么放都解不开，点「重置」重来吧');
    }

    // 托盘：预览按当前朝向重建；选中态与「已放置」态同步。
    // 提示在这里退场：能走到这一行，说明玩家已经动了手（选中 / 旋转 / 落子 / 取回 / 重置），旧提示不该再留着。
    function renderTray() {
      clearHint();
      PIECES.forEach(function (p, idx) {
        var b = pieceBtns[idx];
        var placed = !!placements[idx];
        b.classList.toggle('is-placed', placed);
        b.classList.toggle('is-selected', selected === idx);
        b.setAttribute('aria-pressed', selected === idx ? 'true' : 'false');
        b.setAttribute('aria-label',
          p.name + '，' + p.cells.length + ' 格' + (placed ? '（已放置，点击取回）' : (selected === idx ? '（已选中）' : '')));
        renderMini(b, idx);
      });
    }
    function renderMini(btn, idx) {
      var rc = rotCells(idx, rotations[idx]);
      var rows = 0;
      var cols = 0;
      rc.forEach(function (p) {
        if (p[0] + 1 > rows) rows = p[0] + 1;
        if (p[1] + 1 > cols) cols = p[1] + 1;
      });
      var filled = {};
      rc.forEach(function (p) { filled[p[0] + ',' + p[1]] = 1; });
      var anchor = rc[0];
      var grid = document.createElement('span');
      grid.className = 'tg-mini';
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', var(--tg-mini-cell))';
      grid.style.gridTemplateRows = 'repeat(' + rows + ', var(--tg-mini-cell))';
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var mc = document.createElement('span');
          mc.className = 'tg-mini-cell';
          if (filled[r + ',' + c]) {
            mc.classList.add('on');
            mc.setAttribute('data-piece', PIECES[idx].id);
          }
          if (r === anchor[0] && c === anchor[1]) mc.classList.add('is-anchor');
          grid.appendChild(mc);
        }
      }
      btn.textContent = '';
      btn.appendChild(grid);
    }

    // ---- 落点预览：把受影响的目标格染色（不产生任何 DOM，只挂类名） ----
    function clearPreview() {
      preview = null;
      for (var k = 0; k < CELLS; k++) {
        cells[k].classList.remove('is-preview', 'is-ok', 'is-bad');
      }
    }
    function computePreview(idx, k, or, oc) {
      var list = rotCells(idx, k).map(function (rc) { return [or + rc[0], oc + rc[1]]; });
      var ok = list.every(function (p) {
        var r = p[0];
        var c = p[1];
        return inBounds(r, c) && owner[indexOf(r, c)] < 0;
      });
      clearPreview();
      list.forEach(function (p) {
        var r = p[0];
        var c = p[1];
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return; // 出格的部分无从染色，靠 ok 判定兜住
        cells[indexOf(r, c)].classList.add('is-preview', ok ? 'is-ok' : 'is-bad');
      });
      preview = { or: or, oc: oc, ok: ok };
    }
    // 以「指针所在格」为锚点落点：把积木的锚点格对准指针格
    function previewAt(idx, k, x, y) {
      var i = cellFromPoint(x, y);
      if (i < 0) { clearPreview(); return; }
      var a = rotCells(idx, k)[0];
      var or = Math.floor(i / SIZE) - a[0];
      var oc = (i % SIZE) - a[1];
      computePreview(idx, k, or, oc);
    }

    // ---- 落子 ----
    function tryPlace(idx, k, or, oc) {
      if (solvedFlag) { ctx.hud('机器人已经修好了，想重来就点「重置」'); return false; }
      var list = rotCells(idx, k).map(function (rc) { return [or + rc[0], oc + rc[1]]; });
      var ok = list.every(function (p) { return inBounds(p[0], p[1]) && owner[indexOf(p[0], p[1])] < 0; });
      if (!ok) {
        ctx.hud('这里放不下：要么越出板面，要么和别的积木重叠');
        return false;
      }
      placements[idx] = { rot: k, or: or, oc: oc };
      selected = -1;
      render();
      if (isSolved()) {
        solvedFlag = true;
        boardEl.classList.add('is-done');
        overlay.hidden = false;
        ctx.hud('机器人修好了！');
      } else {
        ctx.hud(defaultHud());
      }
      return true;
    }
    function retrieve(idx) {
      if (solvedFlag) { ctx.hud('机器人已经修好了，想重来就点「重置」'); return; }
      if (!placements[idx]) return;
      placements[idx] = null;
      selected = idx;
      render();
      ctx.hud('已取回「' + PIECES[idx].name + '」，重新找位置放吧');
    }
    // 通关 = 6 块全部用上，并且每行、每列被覆盖的格数都正好等于旁边的提示数。
    // （不要求填满板面：两串提示数之和 = 22 = 积木总面积，行列都对上时也不会残留空格。）
    function isSolved() {
      for (var k = 0; k < placements.length; k++) if (!placements[k]) return false;
      var rc = new Array(SIZE).fill(0);
      var cc = new Array(SIZE).fill(0);
      for (var j = 0; j < CELLS; j++) {
        if (owner[j] < 0) continue;
        rc[Math.floor(j / SIZE)]++;
        cc[j % SIZE]++;
      }
      var lv = curLevel();
      for (var i = 0; i < SIZE; i++) {
        if (rc[i] !== lv.row[i] || cc[i] !== lv.col[i]) return false;
      }
      return true;
    }

    // ---- 关卡 ----
    // 切关 = 换成那一关的行列数字 + 清空板面重来；不保留上一关的任何进度（本游戏没有进度存档）。
    function applyLevel() {
      var lv = curLevel();
      for (var i = 0; i < SIZE; i++) {
        colHintEls[i].textContent = String(lv.col[i]);
        colHintEls[i].setAttribute('aria-label', '第 ' + (i + 1) + ' 列需要覆盖 ' + lv.col[i] + ' 格');
        rowHintEls[i].textContent = String(lv.row[i]);
        rowHintEls[i].setAttribute('aria-label', '第 ' + (i + 1) + ' 行需要覆盖 ' + lv.row[i] + ' 格');
      }
      levelChips.forEach(function (b, li) {
        var on = li === levelIdx;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        b.classList.toggle('active', on);
      });
      nextBtn.hidden = levelIdx === LEVELS.length - 1; // 最后一关没有「下一关」
    }
    // 清空板面状态（不改关卡）：切关、点「重置」、点「再拼一次」都走它
    function resetState() {
      placements = new Array(PIECES.length).fill(null);
      rotations = PIECES.map(function () { return 0; });
      selected = -1;
      solvedFlag = false;
      overlay.hidden = true;
      boardEl.classList.remove('is-done');
      render();
    }
    function loadLevel(idx) {
      levelIdx = idx;
      applyLevel();
      resetState();
      ctx.hud(defaultHud());
    }
    function goNextLevel() {
      if (levelIdx >= LEVELS.length - 1) return;
      loadLevel(levelIdx + 1);
    }

    // ---- 选中 / 旋转 / 重置 ----
    function setSelected(idx) {
      if (idx < 0) {
        selected = -1;
        clearPreview();
        renderTray();
        syncHeld();
        ctx.hud(defaultHud());
        return;
      }
      selected = idx;
      clearPreview();
      renderTray();
      syncHeld(); // 幽灵块立即出现在指针处，之后随指针移动
      ctx.hud('已选中「' + PIECES[idx].name + '」，积木跟着指针走，点板面格子落子；按 R 或点「旋转」换朝向');
    }
    function rotateSelected() {
      if (solvedFlag) { ctx.hud('机器人已经修好了，想重来就点「重置」'); return; }
      if (selected < 0) { ctx.hud('先在托盘里选一块积木，再旋转'); return; }
      rotations[selected] = (rotations[selected] + 1) % PIECES[selected].rots.length;
      renderTray();
      // 换朝向后按「当前指针所在格」重新求落点：手持中的块始终跟着指针，转完不该跳到别处
      if (!pointerTouch && pointer) previewAt(selected, rotations[selected], pointer.x, pointer.y);
      else clearPreview();
      syncHeld();
      ctx.hud('已旋转「' + PIECES[selected].name + '」，朝向 ' + (rotations[selected] + 1) + '/' + PIECES[selected].rots.length);
    }
    function resetBoard() {
      resetState();
      ctx.hud('已重置，重新拼吧');
    }

    // ---- 托盘交互：拖动优先，轻点交给 click ----
    function onPiecePointerDown(e, idx) {
      swallowClick = false; // 新手势开始：解除上一次可能遗留的吞点标记
      if (e.button !== undefined && e.button !== 0) return; // 只响应主键
      if (!e.isPrimary) return; // 多指保护：手势开始后忽略附加触点，否则换指会让手持块跳位
      // 记账指针：轻点也记，这样紧接着的 click 能把幽灵块直接放到指针处
      pointerTouch = e.pointerType === 'touch';
      if (!pointerTouch) pointer = { x: e.clientX, y: e.clientY };
      if (placements[idx]) return; // 已放置：不由 pointerdown 起拖，留给 click 取回
      drag = { piece: idx, x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId };
    }
    function onPieceClick(e, idx) {
      if (swallowClick) { swallowClick = false; return; } // 刚拖过，吞掉这次 click
      if (solvedFlag) { ctx.hud('机器人已经修好了，想重来就点「重置」'); return; }
      if (placements[idx]) { retrieve(idx); return; }
      if (selected === idx) { setSelected(-1); return; } // 再点一次 = 取消手持
      setSelected(idx);
    }
    function onWindowPointerMove(e) {
      // 指针记账（幽灵块的坐标源）：触屏与附加触点不参与 —— 触屏没有 hover 概念
      if (e.isPrimary !== false) {
        pointerTouch = e.pointerType === 'touch';
        if (!pointerTouch) pointer = { x: e.clientX, y: e.clientY };
      }

      if (drag) {
        if (e.pointerId !== drag.pointerId) return;
        if (!drag.moved) {
          var dx = e.clientX - drag.x;
          var dy = e.clientY - drag.y;
          if (Math.abs(dx) < DRAG_MIN && Math.abs(dy) < DRAG_MIN) return;
          drag.moved = true;
          selected = drag.piece; // 起拖即手持
          clearPreview();
          renderTray();
        }
        previewAt(drag.piece, rotations[drag.piece], e.clientX, e.clientY);
        syncHeld();
        return;
      }

      // 手持（未按住）：指针在哪，预览环与幽灵块就跟到哪；离开板面自动清预览、幽灵块转自由跟随
      if (selected < 0 || solvedFlag) {
        if (!ghost.hidden) hideGhost();
        return;
      }
      if (pointerTouch || !pointer) return; // 触控路径不给悬停预览，免得手指离开后残留
      previewAt(selected, rotations[selected], pointer.x, pointer.y);
      syncHeld();
    }
    function onWindowPointerUp(e) {
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;
      var d = drag;
      drag = null;
      if (!d.moved) return; // 轻点：交给 click 走「选中 / 取回」逻辑
      // 只有「在同一块托盘积木上松手」才会补发 click，这时才需要吞掉它
      // （落在板面上松手时元素不同，浏览器本就不会补 click，别留下会误吞后续点击的标记）
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var onSamePiece = el && el.closest && el.closest('.tg-piece') === pieceBtns[d.piece];
      swallowClick = !!onSamePiece;
      if (preview && preview.ok) {
        tryPlace(d.piece, rotations[d.piece], preview.or, preview.oc);
      } else if (preview) {
        ctx.hud('这里放不下：要么越出板面，要么和别的积木重叠');
      }
      clearPreview();
      syncHeld(); // 放下成功则幽灵块已随 render() 消失；失败则回到「自由跟随」继续手持
    }
    function onWindowPointerCancel(e) {
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;
      drag = null;
      clearPreview();
      syncHeld();
    }
    // 滚动 / 改尺寸会让固定定位的幽灵块与板面的相对位置失真：作废几何快照并立刻重测重排
    function onViewportChange() {
      geom = null;
      if (!ghost.hidden) syncHeld();
    }

    // 板面：轻点落子（手持时）/ 取回（未手持时）。
    // 悬停预览与幽灵块由 window 层的 pointermove 统一驱动，这里不再重复一套（同一职责只留一个实现）。
    boardEl.addEventListener('pointerdown', function (e) {
      if (drag) return;
      if (e.button !== undefined && e.button !== 0) return;
      var i = cellFromPoint(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      if (solvedFlag) { ctx.hud('机器人已经修好了，想重来就点「重置」'); return; }
      if (selected < 0) {
        var o = owner[i];
        if (o >= 0) retrieve(o);
        return;
      }
      var a = rotCells(selected, rotations[selected])[0];
      var or = Math.floor(i / SIZE) - a[0];
      var oc = (i % SIZE) - a[1];
      tryPlace(selected, rotations[selected], or, oc);
    });

    // 键盘：R 旋转手持积木（声明式绑定，卸载时由框架统一解绑）
    ctx.onKey({ r: rotateSelected, R: rotateSelected });

    // ---- 启动 ----
    // loadLevel(0) 会写好第 1 关的数字、同步关卡芯片激活态、清空板面并给出默认播报
    loadLevel(0);

    // ---- 清理 ----
    // window 层监听不随节点移除而消失，必须在 destroy 里显式解绑；
    // 幽灵块挂在 body 上同理（切页时若不摘掉，会留在别的页面上继续跟着指针跑）
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    window.addEventListener('scroll', onViewportChange, { passive: true });
    window.addEventListener('resize', onViewportChange);
    return function destroy() {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
      window.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      clearHint();
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
      drag = null;
      preview = null;
      pointer = null;
    };
  }
})();
