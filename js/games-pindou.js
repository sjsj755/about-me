// ============ 游戏室 · 拼豆 ============
// 实现契约见 js/games.js 文件头：本文件只向 window.GAME_RUNNERS 注册 id 为 'pindou' 的一款。
//
// 玩法：12×12 钉板，点按或拖动放豆，自由创作。作品与工具状态自动保存，刷新/关页不丢。
//
// 工具：画（放当前色）· 擦（移除）· 吸（取该格颜色并切回画笔）· 填（连通同色区一起换）· 清（两击确认，防误触）。
// 存档：localStorage 键 youxi_pindou_v1（走 UI.loadJSON / UI.saveJSON 封装），坏数据整体弃用回默认，
//       写入做 400ms 防抖，卸载时强制落盘。（历史存档里的 tpl 字段已随模板功能移除，读取时忽略。）
// 输入：盘面 pointerdown / pointermove + setPointerCapture —— 拖动跨格连续绘制，
//       elementFromPoint 命中格子；触屏滚动由框架的 .games-stage.is-playing { touch-action: none } 放行。
// 颜色：15 色全部取自站点 token（映射见 tokens.css accent 系与 games.css 的 --pd-bead 色板），零字面量。
// 导出：把钉板重画到离屏 canvas（2x 渲染出 1080×1080 PNG）触发下载；色值运行时读 CSS 计算值，
//       色板映射与白面刻度仍是唯一数据源，这里不复制色值。
(function () {
  'use strict';

  var SIZE = 12;
  var CELLS = SIZE * SIZE;
  var STORE_KEY = 'youxi_pindou_v1';
  var SAVE_DELAY = 400;
  var CLEAR_ARM_MS = 3000;

  // 调色板：id 必须与 games.css 的 .pd [data-color="<id>"] 色板映射一一对应（token 见 tokens.css）。
  // 15 色按色系排布（红 → 暖黄 → 绿 → 蓝 → 紫 → 棕灰），首位为默认画笔色。
  var PALETTE = [
    { id: 'coral', name: '珊瑚红' },
    { id: 'berry', name: '莓红' },
    { id: 'pink', name: '樱粉' },
    { id: 'orange', name: '杏橙' },
    { id: 'lemon', name: '柠檬黄' },
    { id: 'sand', name: '沙黄' },
    { id: 'leaf', name: '嫩草绿' },
    { id: 'mint', name: '薄荷绿' },
    { id: 'blue', name: '天空蓝' },
    { id: 'lav', name: '薰衣草' },
    { id: 'plum', name: '紫罗兰' },
    { id: 'brown', name: '咖啡棕' },
    { id: 'ink', name: '墨蓝' },
    { id: 'soft', name: '灰蓝' },
    { id: 'stone', name: '岩灰' },
  ];
  var COLOR_IDS = PALETTE.map(function (p) { return p.id; });

  var TOOLS = [
    { id: 'pen', label: '画', name: '画笔' },
    { id: 'eraser', label: '擦', name: '橡皮' },
    { id: 'picker', label: '吸', name: '吸色' },
    { id: 'fill', label: '填', name: '填充' },
    { id: 'clear', label: '清', name: '清空钉板' },
  ];

  window.GAME_RUNNERS = window.GAME_RUNNERS || {};
  window.GAME_RUNNERS['pindou'] = { mount: mount };

  function mount(ctx) {
    var UI = window.UI || {};
    var loadJSON = typeof UI.loadJSON === 'function' ? UI.loadJSON : function () { return null; };
    var saveJSON = typeof UI.saveJSON === 'function' ? UI.saveJSON : function () {};

    // ---- 状态 ----
    var board = new Array(CELLS).fill(null);
    var currentColor = PALETTE[0].id;
    var tool = 'pen';
    var drawing = false;       // 拖动绘制中
    var saveTimer = null;
    var clearArmTimer = null;

    // ---- 骨架 ----
    var root = document.createElement('div');
    root.className = 'pd';

    var main = document.createElement('div');
    main.className = 'pd-main';

    // 钉板：12×12 CSS Grid，格子自适应（无需 JS 算尺寸）
    var boardEl = document.createElement('div');
    boardEl.className = 'pd-board';
    boardEl.setAttribute('role', 'application');
    boardEl.setAttribute('aria-label', '拼豆钉板，12 乘 12，点按或拖动放豆');
    var cells = new Array(CELLS);
    for (var i = 0; i < CELLS; i++) {
      var cell = document.createElement('div');
      cell.className = 'pd-cell';
      cell.dataset.i = String(i);
      cells[i] = cell;
      boardEl.appendChild(cell);
    }

    // 侧栏：当前色 + 调色板 + 工具
    var side = document.createElement('div');
    side.className = 'pd-side';

    var currentRow = document.createElement('div');
    currentRow.className = 'pd-current';
    var currentDot = document.createElement('span');
    currentDot.className = 'pd-current-dot';
    currentDot.dataset.color = currentColor;
    var currentText = document.createElement('span');
    currentText.className = 'pd-current-name';
    currentRow.appendChild(currentDot);
    currentRow.appendChild(currentText);

    var palette = document.createElement('div');
    palette.className = 'pd-palette';
    palette.setAttribute('role', 'group');
    palette.setAttribute('aria-label', '豆子调色板');
    var swatches = {}; // colorId -> button
    PALETTE.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pd-swatch';
      b.dataset.color = p.id;
      b.setAttribute('aria-label', p.name);
      b.title = p.name;
      b.addEventListener('click', function () { setColor(p.id); });
      swatches[p.id] = b;
      palette.appendChild(b);
    });

    var toolsRow = document.createElement('div');
    toolsRow.className = 'pd-tools';
    toolsRow.setAttribute('role', 'group');
    toolsRow.setAttribute('aria-label', '工具');
    var toolBtns = {}; // toolId -> button
    TOOLS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pd-tool';
      b.textContent = t.label;
      b.setAttribute('aria-label', t.name);
      b.title = t.name;
      b.addEventListener('click', function () { onToolClick(t.id); });
      toolBtns[t.id] = b;
      toolsRow.appendChild(b);
    });

    // 导出：旁路动作（不是绘图工具），复用共享 .filter-chip 按钮样式，撑满侧栏一行
    var exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'filter-chip pd-export';
    exportBtn.textContent = '导出 PNG';
    exportBtn.setAttribute('aria-label', '把当前作品导出为 PNG 图片');
    exportBtn.addEventListener('click', exportPng);

    side.appendChild(currentRow);
    side.appendChild(palette);
    side.appendChild(toolsRow);
    side.appendChild(exportBtn);
    main.appendChild(boardEl);
    main.appendChild(side);
    root.appendChild(main);
    ctx.el.appendChild(root);

    // ---- 渲染 ----
    function paintCell(i) {
      var v = board[i];
      if (v) cells[i].setAttribute('data-color', v);
      else cells[i].removeAttribute('data-color');
    }
    function renderAll() {
      for (var i = 0; i < CELLS; i++) paintCell(i);
    }
    function setColor(id) {
      currentColor = id;
      currentDot.dataset.color = id;
      var name = '未知色';
      PALETTE.forEach(function (p) { if (p.id === id) name = p.name; });
      currentText.textContent = name;
      COLOR_IDS.forEach(function (cid) {
        swatches[cid].setAttribute('aria-pressed', cid === id ? 'true' : 'false');
      });
      disarmClear();
    }
    function setTool(id) {
      tool = id;
      TOOLS.forEach(function (t) {
        toolBtns[t.id].classList.toggle('active', t.id === id);
        toolBtns[t.id].setAttribute('aria-pressed', t.id === id ? 'true' : 'false');
      });
    }
    function onToolClick(id) {
      if (id === 'clear') {
        if (toolBtns.clear.classList.contains('is-armed')) {
          doClear();
        } else {
          armClear();
        }
        return;
      }
      disarmClear();
      setTool(id);
    }
    function armClear() {
      var b = toolBtns.clear;
      b.classList.add('is-armed');
      b.textContent = '确认';
      b.setAttribute('aria-label', '再点一次确认清空钉板');
      if (clearArmTimer) clearTimeout(clearArmTimer);
      clearArmTimer = setTimeout(disarmClear, CLEAR_ARM_MS);
      ctx.hud('再点一次「确认」才会清空钉板');
    }
    function disarmClear() {
      if (clearArmTimer) { clearTimeout(clearArmTimer); clearArmTimer = null; }
      var b = toolBtns.clear;
      if (!b.classList.contains('is-armed')) return;
      b.classList.remove('is-armed');
      b.textContent = '清';
      b.setAttribute('aria-label', '清空钉板');
    }
    function doClear() {
      disarmClear();
      var changed = false;
      for (var i = 0; i < CELLS; i++) {
        if (board[i]) { board[i] = null; paintCell(i); changed = true; }
      }
      if (changed) { scheduleSave(); updateHud('已清空钉板'); }
    }

    // ---- hud ----
    function beadCount() {
      var n = 0;
      for (var i = 0; i < CELLS; i++) if (board[i]) n++;
      return n;
    }
    function updateHud(override) {
      if (override) { ctx.hud(override); return; }
      ctx.hud('自由创作中 · 已放 ' + beadCount() + ' 颗豆');
    }

    // ---- 导出 PNG ----
    var EXPORT_PAD = 8;   // 对应 .pd-board 的 padding
    var EXPORT_GAP = 4;   // 对应 .pd-board 的 gap
    var EXPORT_CELL = 40; // 每格渲染尺寸（CSS 里约 23px，导出统一放大更清晰）
    var EXPORT_SCALE = 2; // 2x 渲染，导出 1080×1080
    var EXPORT_PX = (EXPORT_PAD * 2 + SIZE * EXPORT_CELL + (SIZE - 1) * EXPORT_GAP) * EXPORT_SCALE;

    function cssVar(el, prop) {
      var v = getComputedStyle(el).getPropertyValue(prop).trim();
      return v || null;
    }
    function roundRectPath(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
    function exportStamp() {
      var d = new Date();
      function p2(n) { return (n < 10 ? '0' : '') + n; }
      return '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) +
        '-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    }
    // 收集导出所需色值：豆色/豆面高光从调色板按钮读（--pd-bead/--pd-shine 的计算值），
    // 板底/格子/钉点/渐变终点从 :root 白面刻度读。任一取不到都整体放弃，不画半成品。
    function collectExportTheme() {
      var root = document.documentElement;
      var theme = { colors: {}, shine: {}, bg: null, cell: null, peg: null, shineLo: null };
      var ok = true;
      COLOR_IDS.forEach(function (id) {
        var el = swatches[id];
        var bead = el ? cssVar(el, '--pd-bead') : null;
        if (!bead) { ok = false; return; }
        theme.colors[id] = bead;
        // 高光：各色可自带 --pd-shine（深色豆更收敛），缺省回落到 --w-80
        theme.shine[id] = (el && cssVar(el, '--pd-shine')) || cssVar(root, '--w-80');
      });
      theme.bg = cssVar(root, '--w-35');
      theme.cell = cssVar(root, '--w-45');
      theme.peg = cssVar(root, '--w-70');
      theme.shineLo = cssVar(root, '--w-0');
      ['bg', 'cell', 'peg', 'shineLo'].forEach(function (k) { if (!theme[k]) ok = false; });
      return ok ? theme : null;
    }
    function drawBoard(c, theme) {
      var pad = EXPORT_PAD * EXPORT_SCALE;
      var gap = EXPORT_GAP * EXPORT_SCALE;
      var cell = EXPORT_CELL * EXPORT_SCALE;
      var step = cell + gap;
      // 板底（含 1px 描边，对应 .pd-board 的 border；--w-70 同时是钉点色）
      roundRectPath(c, 0, 0, EXPORT_PX, EXPORT_PX, 14 * EXPORT_SCALE);
      c.fillStyle = theme.bg;
      c.fill();
      c.strokeStyle = theme.peg;
      c.lineWidth = EXPORT_SCALE;
      c.stroke();
      for (var i = 0; i < CELLS; i++) {
        var x = pad + (i % SIZE) * step;
        var y = pad + Math.floor(i / SIZE) * step;
        roundRectPath(c, x, y, cell, cell, 4 * EXPORT_SCALE);
        c.fillStyle = theme.cell;
        c.fill();
        if (!board[i]) {
          // 空格中心钉点（对应 .pd-cell 的 radial-gradient）
          c.beginPath();
          c.arc(x + cell / 2, y + cell / 2, 1.5 * EXPORT_SCALE, 0, Math.PI * 2);
          c.fillStyle = theme.peg;
          c.fill();
          continue;
        }
        roundRectPath(c, x, y, cell, cell, 4 * EXPORT_SCALE);
        c.fillStyle = theme.colors[board[i]];
        c.fill();
        // 豆面高光：上缘向下的透明渐变，近似 CSS 的 inset 阴影
        c.save();
        roundRectPath(c, x, y, cell, cell, 4 * EXPORT_SCALE);
        c.clip();
        var g = c.createLinearGradient(0, y, 0, y + cell * 0.45);
        g.addColorStop(0, theme.shine[board[i]]);
        g.addColorStop(1, theme.shineLo);
        c.fillStyle = g;
        c.fillRect(x, y, cell, cell * 0.45);
        c.restore();
      }
    }
    function exportPng() {
      disarmClear(); // 导出时解除「清空」武装，避免挂着「确认」态去做旁路动作
      if (beadCount() === 0) { ctx.hud('钉板还是空的，先拼几颗豆再导出吧'); return; }
      var theme = collectExportTheme();
      if (!theme) { ctx.hud('导出失败：读不到颜色主题，请刷新重试'); return; }
      for (var i = 0; i < CELLS; i++) {
        if (board[i] && !theme.colors[board[i]]) { ctx.hud('导出失败：有未知颜色的豆子'); return; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = EXPORT_PX;
      canvas.height = EXPORT_PX;
      var c = canvas.getContext('2d');
      if (!c) { ctx.hud('导出失败：当前浏览器不支持画布导出'); return; }
      try {
        drawBoard(c, theme);
      } catch (err) {
        ctx.hud('导出失败，请重试');
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) { ctx.hud('导出失败，请重试'); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'pindou-' + exportStamp() + '.png';
        document.body.appendChild(a);
        try {
          a.click();
          ctx.hud('已导出 PNG 图片');
        } catch (err) {
          ctx.hud('导出失败，请重试');
        }
        a.remove();
        // 下载触发后即可回收；极端情况下定时器没跑，blob 也会随页面关闭释放
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, 'image/png');
    }

    // ---- 落豆 ----
    function setBead(i, color) {
      if (board[i] === color) return false;
      board[i] = color;
      paintCell(i);
      return true;
    }
    // 填充：从 startIdx 出发，把 4 邻接连通的同色区（含空）整体换成当前色
    function floodFill(startIdx, color) {
      var target = board[startIdx];
      if (target === color) return false;
      var seen = new Array(CELLS).fill(false);
      var stack = [startIdx];
      var changed = false;
      while (stack.length) {
        var i = stack.pop();
        if (seen[i]) continue;
        seen[i] = true;
        if (board[i] !== target) continue;
        setBead(i, color);
        changed = true;
        var r = Math.floor(i / SIZE);
        var c = i % SIZE;
        if (r > 0) stack.push(i - SIZE);
        if (r < SIZE - 1) stack.push(i + SIZE);
        if (c > 0) stack.push(i - 1);
        if (c < SIZE - 1) stack.push(i + 1);
      }
      return changed;
    }
    // 工具作用到格子；pen/eraser 支持拖动连续作用，picker/fill 只在按下时生效一次。
    // 返回 true 表示盘面发生了变化。
    function applyTool(i, isDrag) {
      if (tool === 'pen') return setBead(i, currentColor);
      if (tool === 'eraser') return setBead(i, null);
      if (isDrag) return false;
      if (tool === 'picker') {
        var v = board[i];
        if (!v) { updateHud('这一格还没有豆，吸不了'); return false; }
        setColor(v);
        setTool('pen');
        var name = v;
        PALETTE.forEach(function (p) { if (p.id === v) name = p.name; });
        updateHud('已取色：' + name);
        return false;
      }
      if (tool === 'fill') return floodFill(i, currentColor);
      return false;
    }
    function cellFromPoint(x, y) {
      var el = document.elementFromPoint(x, y);
      var cell = el && el.closest ? el.closest('.pd-cell') : null;
      return cell ? Number(cell.dataset.i) : -1;
    }
    function afterChange(changed) {
      if (!changed) return;
      scheduleSave();
      updateHud();
    }

    // 盘面指针事件：元素级监听随舞台卸载一起销毁，无需手动解绑
    boardEl.addEventListener('pointerdown', function (e) {
      var i = cellFromPoint(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* 已释放等场景可忽略 */ }
      drawing = true;
      afterChange(applyTool(i, false));
    });
    boardEl.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      if (tool !== 'pen' && tool !== 'eraser') return;
      var i = cellFromPoint(e.clientX, e.clientY);
      if (i < 0) return;
      afterChange(applyTool(i, true));
    });
    function stopDrawing() { drawing = false; }
    boardEl.addEventListener('pointerup', stopDrawing);
    boardEl.addEventListener('pointercancel', stopDrawing);

    // ---- 存档 ----
    function scheduleSave() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, SAVE_DELAY);
    }
    function saveNow() {
      saveTimer = null;
      saveJSON(STORE_KEY, {
        board: board,
        color: currentColor,
        tool: tool === 'clear' ? 'pen' : tool,
      });
    }
    function isValidColor(v) { return COLOR_IDS.indexOf(v) >= 0; }
    function restore() {
      var data = loadJSON(STORE_KEY);
      if (!data || typeof data !== 'object') return false;
      if (!Array.isArray(data.board) || data.board.length !== CELLS) return false;
      var ok = true;
      data.board.forEach(function (v) { if (v !== null && !isValidColor(v)) ok = false; });
      if (!ok) return false;
      board = data.board.map(function (v) { return v || null; });
      if (isValidColor(data.color)) currentColor = data.color;
      var toolOk = false;
      TOOLS.forEach(function (t) { if (t.id === data.tool && t.id !== 'clear') toolOk = true; });
      if (toolOk) tool = data.tool;
      return true;
    }

    // ---- 启动 ----
    var restored = restore();
    renderAll();
    setColor(currentColor);
    setTool(tool === 'clear' ? 'pen' : tool);
    if (restored) {
      updateHud('已恢复你上次的作品，继续拼吧');
    } else {
      updateHud();
    }

    // ---- 清理 ----
    return function destroy() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; saveNow(); } // 卸载前把未落盘的改动写掉
      if (clearArmTimer) { clearTimeout(clearArmTimer); clearArmTimer = null; }
    };
  }
})();
