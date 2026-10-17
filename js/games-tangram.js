// ============ 游戏室 · 七巧板（机器人维修） ============
// 契约见 js/games.js 文件头：本文件只向 window.GAME_RUNNERS 注册 id 为 'tangram' 的一款。
//
// 玩法：6×6 板面上是一块机器人剪影（下面 SHAPE 常量为唯一数据源），
//       把托盘里的 6 块积木全部拼进剪影 —— 全部用完 + 不越出剪影 + 不重叠，即通关。
//       本版不做行列提示数；剪影本身就是目标形状，且积木集合可精确铺满它（面积相等、无空隙）。
//
// 输入：点托盘积木 = 选中/手持；手持时点板面格 = 以该块「带圆点的格子」为锚点落子；
//       从托盘按住拖到板面松手 = 直接落子；点已放置的积木 = 取回；
//       「旋转」按钮或 R 键 = 旋转手持积木；「重置」按钮 = 清空重来。
// 落点反馈：拖动/悬停时把受影响的目标格染色（绿=可放，红=越界或重叠），松手才真正落子。
// 颜色：6 块积木的填充色全部取自站点 token（见 css/src/pages/games.css 的 .tg [data-piece=…] 映射），零字面量。
(function () {
  'use strict';

  var SIZE = 6;
  var CELLS = SIZE * SIZE;
  var DRAG_MIN = 6; // 拖拽判定阈值（px）：位移小于它算「轻点」，交给 click 处理

  // 目标剪影（唯一数据源）：1 = 机器人本体（必须被积木铺满），0 = 板面空白（不可落子）
  var SHAPE = [
    0, 0, 1, 1, 0, 0,
    0, 0, 1, 1, 0, 0,
    1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1,
    0, 1, 1, 1, 1, 0,
    0, 1, 0, 0, 1, 0,
  ];

  // 积木（基础朝向的相对坐标，已归一化）：
  // 面积 4 + 4 + 4 + 4 + 3 + 3 = 22 = 剪影格数，可精确铺满（已用回溯求解器验证存在解）。
  var PIECES = [
    { id: 'i4', name: '长条', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { id: 'o', name: '方块', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { id: 's', name: 'S 形', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    { id: 't', name: 'T 形', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
    { id: 'i3', name: '短条', cells: [[0, 0], [0, 1], [0, 2]] },
    { id: 'l3', name: '角形', cells: [[0, 0], [1, 0], [1, 1]] },
  ];

  // 剪影格数
  var TARGET_COUNT = 0;
  for (var t = 0; t < CELLS; t++) if (SHAPE[t]) TARGET_COUNT++;

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

  window.GAME_RUNNERS = window.GAME_RUNNERS || {};
  window.GAME_RUNNERS['tangram'] = { mount: mount };

  function mount(ctx) {
    // ---- 状态 ----
    var placements = new Array(PIECES.length).fill(null); // 每块：null 或 { rot, or, oc }
    var rotations = PIECES.map(function () { return 0; }); // 每块当前的朝向下标
    var owner = new Array(CELLS).fill(-1);                 // 每格归属的积木下标，-1 = 空
    var selected = -1;                                     // 手持的积木下标，-1 = 未手持
    var preview = null;                                    // { or, oc, ok } 当前的落点预览
    var drag = null;                                       // 拖动中：{ piece, x, y, moved, pointerId }
    var swallowClick = false;                              // 拖拽结束后的那次 click 要吞掉
    var solvedFlag = false;                                // 已通关：锁住落子

    // ---- 骨架 ----
    var root = document.createElement('div');
    root.className = 'tg';

    var main = document.createElement('div');
    main.className = 'tg-main';

    var boardEl = document.createElement('div');
    boardEl.className = 'tg-board';
    boardEl.setAttribute('role', 'application');
    boardEl.setAttribute('aria-label', '七巧板板面，6 乘 6，把积木拼进机器人剪影');
    var cells = new Array(CELLS);
    for (var i = 0; i < CELLS; i++) {
      var cell = document.createElement('div');
      cell.className = 'tg-cell';
      cell.dataset.i = String(i);
      if (!SHAPE[i]) cell.classList.add('is-blank');
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
    overlayText.textContent = '6 块积木全部归位，线路重新接通。';
    var overlayBtn = document.createElement('button');
    overlayBtn.type = 'button';
    overlayBtn.className = 'filter-chip tg-overlay-btn';
    overlayBtn.textContent = '再拼一次';
    overlayBtn.setAttribute('aria-label', '清空板面，重新拼一次');
    overlayBtn.addEventListener('click', resetBoard);
    overlay.appendChild(overlayTitle);
    overlay.appendChild(overlayText);
    overlay.appendChild(overlayBtn);

    // 叠加层放进板面内部：绝对定位脱离 Grid 流，不占格，按板面尺寸铺满（与 2048 弹层同一口径）
    boardEl.appendChild(overlay);

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
    controls.appendChild(rotateBtn);
    controls.appendChild(resetBtn);

    side.appendChild(tray);
    side.appendChild(controls);
    main.appendChild(boardEl);
    main.appendChild(side);
    root.appendChild(main);
    ctx.el.appendChild(root);

    // ---- 小工具 ----
    function inShape(r, c) {
      return r >= 0 && r < SIZE && c >= 0 && c < SIZE && SHAPE[r * SIZE + c] === 1;
    }
    function rotCells(idx, k) { return PIECES[idx].rots[k]; }
    function indexOf(r, c) { return r * SIZE + c; }
    function placedCount() {
      var n = 0;
      for (var k = 0; k < placements.length; k++) if (placements[k]) n++;
      return n;
    }
    function defaultHud() {
      return '已放 ' + placedCount() + '/' + PIECES.length + ' 块 · 全部拼进剪影就修好了';
    }
    function cellFromPoint(x, y) {
      if (typeof x !== 'number' || typeof y !== 'number') return -1;
      var el = document.elementFromPoint(x, y);
      var cellEl = el && el.closest ? el.closest('.tg-cell') : null;
      if (!cellEl || !boardEl.contains(cellEl)) return -1;
      return Number(cellEl.dataset.i);
    }

    // ---- 渲染 ----
    // owner 与板面 class/data 全部由 placements 推导，是唯一的真实来源
    function render() {
      owner.fill(-1);
      placements.forEach(function (p, idx) {
        if (!p) return;
        rotCells(idx, p.rot).forEach(function (rc) {
          var r = p.or + rc[0];
          var c = p.oc + rc[1];
          if (inShape(r, c)) owner[indexOf(r, c)] = idx;
        });
      });
      for (var k = 0; k < CELLS; k++) {
        var o = owner[k];
        if (o >= 0) cells[k].setAttribute('data-piece', PIECES[o].id);
        else cells[k].removeAttribute('data-piece');
      }
      clearPreview();
      renderTray();
    }

    // 托盘：预览按当前朝向重建；选中态与「已放置」态同步
    function renderTray() {
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
        return inShape(r, c) && owner[indexOf(r, c)] < 0;
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
      var ok = list.every(function (p) { return inShape(p[0], p[1]) && owner[indexOf(p[0], p[1])] < 0; });
      if (!ok) {
        ctx.hud('这里放不下：要么越出了剪影，要么和别的积木重叠');
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
    function isSolved() {
      for (var k = 0; k < placements.length; k++) if (!placements[k]) return false;
      var covered = 0;
      for (var j = 0; j < CELLS; j++) if (SHAPE[j] && owner[j] >= 0) covered++;
      return covered === TARGET_COUNT;
    }

    // ---- 选中 / 旋转 / 重置 ----
    function setSelected(idx) {
      if (idx < 0) {
        selected = -1;
        clearPreview();
        renderTray();
        ctx.hud(defaultHud());
        return;
      }
      selected = idx;
      clearPreview();
      renderTray();
      ctx.hud('已选中「' + PIECES[idx].name + '」，点剪影格子落子；按 R 或点「旋转」换朝向');
    }
    function rotateSelected() {
      if (solvedFlag) { ctx.hud('机器人已经修好了，想重来就点「重置」'); return; }
      if (selected < 0) { ctx.hud('先在托盘里选一块积木，再旋转'); return; }
      rotations[selected] = (rotations[selected] + 1) % PIECES[selected].rots.length;
      renderTray();
      if (preview) computePreview(selected, rotations[selected], preview.or, preview.oc);
      ctx.hud('已旋转「' + PIECES[selected].name + '」，朝向 ' + (rotations[selected] + 1) + '/' + PIECES[selected].rots.length);
    }
    function resetBoard() {
      placements = new Array(PIECES.length).fill(null);
      rotations = PIECES.map(function () { return 0; });
      selected = -1;
      solvedFlag = false;
      overlay.hidden = true;
      boardEl.classList.remove('is-done');
      render();
      ctx.hud('已重置，重新拼吧');
    }

    // ---- 托盘交互：拖动优先，轻点交给 click ----
    function onPiecePointerDown(e, idx) {
      swallowClick = false; // 新手势开始：解除上一次可能遗留的吞点标记
      if (e.button !== undefined && e.button !== 0) return; // 只响应主键
      if (placements[idx]) return; // 已放置：不由 pointerdown 起拖，留给 click 取回
      if (!e.isPrimary) return;
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
      if (!drag) return;
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
        ctx.hud('这里放不下：要么越出了剪影，要么和别的积木重叠');
      }
      clearPreview();
    }
    function onWindowPointerCancel(e) {
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;
      drag = null;
      clearPreview();
    }

    // 板面：轻点落子（手持时）/ 取回（未手持时）；悬停给预览
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
    boardEl.addEventListener('pointermove', function (e) {
      if (drag) return; // 拖拽中的预览由 window 层统一处理
      if (selected < 0 || solvedFlag) { clearPreview(); return; }
      previewAt(selected, rotations[selected], e.clientX, e.clientY);
    });
    boardEl.addEventListener('pointerleave', function () {
      if (drag) return;
      clearPreview();
    });

    // 键盘：R 旋转手持积木（声明式绑定，卸载时由框架统一解绑）
    ctx.onKey({ r: rotateSelected, R: rotateSelected });

    // ---- 启动 ----
    render();
    ctx.hud(defaultHud());

    // ---- 清理 ----
    // window 层监听不随节点移除而消失，必须在 destroy 里显式解绑
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    return function destroy() {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
      drag = null;
      preview = null;
    };
  }
})();
