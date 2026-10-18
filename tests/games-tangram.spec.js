// ============ 游戏室 · 七巧板（机器人维修） ============
// 全部用例走真实数据与真实实现（不 stub）：验证「挂载 → 选中/拖动落子 → 越界与重叠拒绝 →
// 取回/旋转/重置 → 提示数实时染色 → 通关判定与锁局 → 切 tab 无残留」整条链路。
//
// 确定性手段：emulateMedia reducedMotion: 'reduce' —— 关闭落子/预览/提示的面色过渡，断言无动画窗口。
//
// 玩法为「行列数字提示」：6 块积木全部用上、不越出板面、互不重叠，并让每行每列被覆盖的格数正好等于
// 旁边的数字。不要求填满板面。共 4 关（js 里的 LEVELS 逐关给一组行列数字），难度递增；
// 通关弹层在还有下一关时给「下一关」，最后一关只剩「再拼一次」。
//
// 第 1 关解法（由 js/games-tangram.js 的 LEVELS[0] 与积木集合用回溯求解器扫出，共 3 解，取第 1 解）：
//   i4(idx0) rot1 → 锚点格 0     o (idx1) rot0 → 锚点格 2
//   s (idx2) rot0 → 锚点格 26    t (idx3) rot0 → 锚点格 13
//   i3(idx4) rot1 → 锚点格 5     l3(idx5) rot0 → 锚点格 28
// 第 2 / 3 / 4 关不写死解法：一律走「提示驱动」通路（见 solveByHints），提示按当前盘面现场求解。
const { test, expect } = require('@playwright/test');

const SOLUTION = [
  { idx: 0, rot: 1, cell: 0 },  // 长条（竖）
  { idx: 1, rot: 0, cell: 2 },  // 方块
  { idx: 2, rot: 0, cell: 26 }, // S 形
  { idx: 3, rot: 0, cell: 13 }, // T 形
  { idx: 4, rot: 1, cell: 5 },  // 短条（竖）
  { idx: 5, rot: 0, cell: 28 }, // 角形
];

// 四关的行列数字（与 js/games-tangram.js 的 LEVELS 一一对应；数字为文本，便于直接断言）
const LEVELS = [
  { name: '第 1 关', row: ['4', '4', '5', '2', '3', '4'], col: ['4', '2', '6', '4', '2', '4'] },
  { name: '第 2 关', row: ['4', '2', '5', '3', '2', '6'], col: ['3', '4', '3', '3', '6', '3'] },
  { name: '第 3 关', row: ['6', '5', '2', '2', '4', '3'], col: ['2', '4', '3', '5', '2', '6'] },
  { name: '第 4 关', row: ['5', '4', '2', '4', '3', '4'], col: ['3', '5', '6', '1', '2', '5'] },
];
const ROW_HINTS = LEVELS[0].row; // 第 1 关的行提示（多数既有用例仍以第 1 关为准）
const COL_HINTS = LEVELS[0].col;
const AREAS = [4, 4, 4, 4, 3, 3]; // 积木按下标顺序的面积

// 干净起点：默认落在第一个 tab（2048），这里统一切到七巧板
async function setup(page) {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch (e) { /* 隐私模式下忽略 */ }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('games.html');
  await page.locator('#gamesTab-tangram').click();
}

// 托盘积木（下标即 js 里 PIECES 的顺序）与板面格子（下标 = row*6+col）
function piece(page, idx) { return page.locator('.tg-piece').nth(idx); }
function cell(page, idx) { return page.locator('.tg-cell').nth(idx); }

// 选中某块 → 按 R 旋转 n 次 → 点锚点格落子
async function place(page, idx, rot, cellIndex) {
  await piece(page, idx).click();
  for (let k = 0; k < rot; k++) await page.keyboard.press('r');
  await cell(page, cellIndex).click();
}

// 读出盘面 36 格的 data-piece（空格为 null），下标即行优先格序
function boardOf(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.tg-board .tg-cell'))
    .map((el) => el.getAttribute('data-piece')));
}

// 提示数字：列带（上，左→右即列 0→5）与行带（左，上→下即行 0→5）
function colHint(page, c) { return page.locator('.tg-col-hints .tg-hint').nth(c); }
function rowHint(page, r) { return page.locator('.tg-row-hints .tg-hint').nth(r); }
// 关卡芯片（顺序即 LEVELS 顺序）
function levelChip(page, li) { return page.locator('.tg-levels .tg-level').nth(li); }

// 一路照着「提示」把当前这关解开：提示按当前盘面现场求解，故对任意一关都成立。
// 每轮都核对机器可读契约：提示先指「下标最小的未放块」，高亮格数 = 该块面积，且高亮格必须是空格。
async function solveByHints(page) {
  for (let round = 0; round < AREAS.length; round++) {
    await page.locator('.tg-hintbtn').click();
    const token = await page.locator('.tg').getAttribute('data-tg-hint');
    expect(token).toMatch(/^place:\d+:\d+:\d+$/);
    const [, piRaw, rotRaw, anchorRaw] = token.split(':');
    expect(Number(piRaw)).toBe(round); // 提示总是先指「下标最小的未放块」
    await expect(page.locator('.tg-piece.is-hint')).toHaveCount(1);
    await expect(page.locator('.tg-cell.is-hint')).toHaveCount(AREAS[round]);
    await expect(page.locator('.tg-cell.is-hint[data-piece]')).toHaveCount(0);

    await piece(page, Number(piRaw)).click();
    for (let k = 0; k < Number(rotRaw); k++) await page.keyboard.press('r');
    await cell(page, Number(anchorRaw)).click();
    await expect(page.locator('.tg-cell.is-hint, .tg-piece.is-hint')).toHaveCount(0); // 提示随落子退场
  }
}

// 手感（手持跟随）用例要用到的两个小工具：
//   幽灵块是 0×0 的游离节点（子格都是绝对定位，撑不出父盒），所以量位置只能读 transform 矩阵；
//   吸附断言拿它和「目标格 boundingBox 左上角」做整数比较，抹掉亚像素噪声。
function ghostXY(page) {
  return page.evaluate(() => {
    const g = document.querySelector('.tg-ghost');
    if (!g) return null;
    const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
    return { x: Math.round(m.m41), y: Math.round(m.m42) };
  });
}
function boxTopLeft(box) {
  return { x: Math.round(box.x), y: Math.round(box.y) };
}

test.describe('游戏室 · 七巧板', () => {
  test('挂载：tab 文案、6×6 网格与行列提示就位、托盘就位、hud 初态', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await setup(page);
    const tab = page.locator('#gamesTab-tangram');
    await expect(tab).toHaveText('益智七巧板');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamesHint')).toContainText('每行每列');

    // 关卡芯片行：4 关、默认第 1 关激活（与页头 .games-tabs 同一口径：role=tab + aria-selected + .active）
    await expect(page.locator('.tg-levels')).toHaveAttribute('role', 'tablist');
    await expect(page.locator('.tg-levels .tg-level')).toHaveCount(4);
    await expect(page.locator('.tg-levels .tg-level')).toHaveText(LEVELS.map((lv) => lv.name));
    await expect(levelChip(page, 0)).toHaveAttribute('aria-selected', 'true');
    await expect(levelChip(page, 0)).toHaveClass(/active/);
    await expect(levelChip(page, 0)).toHaveAttribute('tabindex', '0');
    await expect(levelChip(page, 1)).toHaveAttribute('aria-selected', 'false');
    await expect(levelChip(page, 1)).toHaveAttribute('tabindex', '-1');

    await expect(page.locator('.tg-board')).toHaveAttribute('role', 'application');
    await expect(page.locator('.tg-board-wrap')).toHaveCount(1);
    await expect(page.locator('.tg-board .tg-cell')).toHaveCount(36); // 纯网格：不再有剪影/空白之分
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(0);

    // 行列提示：上 6 个（列）、左 6 个（行），数字与 ROW_HINTS / COL_HINTS 一致
    await expect(page.locator('.tg-col-hints .tg-hint')).toHaveCount(6);
    await expect(page.locator('.tg-row-hints .tg-hint')).toHaveCount(6);
    await expect(page.locator('.tg-col-hints .tg-hint')).toHaveText(COL_HINTS);
    await expect(page.locator('.tg-row-hints .tg-hint')).toHaveText(ROW_HINTS);
    await expect(colHint(page, 0)).toHaveAttribute('aria-label', '第 1 列需要覆盖 4 格');
    await expect(rowHint(page, 2)).toHaveAttribute('aria-label', '第 3 行需要覆盖 5 格');
    await expect(page.locator('.tg-hint.is-ok')).toHaveCount(0); // 空盘：没有任何行列对上号
    await expect(page.locator('.tg-hint.is-over')).toHaveCount(0);

    await expect(page.locator('.tg-piece')).toHaveCount(6);
    await expect(page.locator('.tg-piece[data-piece="i4"]')).toHaveAttribute('aria-label', /长条，4 格$/);

    // 提示按钮就位；起手没有任何提示（提示环与 data-tg-hint 契约都不该在）
    await expect(page.locator('.tg-hintbtn')).toHaveText('提示');
    await expect(page.locator('.tg-hintbtn')).toHaveAttribute('aria-label', '给出下一步的提示');
    await expect(page.locator('.tg')).not.toHaveAttribute('data-tg-hint');
    await expect(page.locator('.tg-cell.is-hint, .tg-piece.is-hint')).toHaveCount(0);
    await expect(page.locator('.tg-piece').nth(0)).not.toHaveClass(/is-selected/);
    await expect(page.locator('.tg-overlay')).toBeHidden();
    // 幽灵块（手持跟随用）在未手持时不该露面
    await expect(page.locator('.tg-ghost')).toHaveCount(1);
    await expect(page.locator('.tg-ghost')).toBeHidden();

    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 每行每列的数字都对上就修好了');
    await expect(page.locator('#gamesStage .games-hud')).toHaveAttribute('aria-live', 'polite');
    expect(errors).toEqual([]);
  });

  test('选中落子：点托盘选中、点锚点格落子、盘面染色与 hud 计数', async ({ page }) => {
    await setup(page);

    await piece(page, 1).click(); // 方块
    await expect(piece(page, 1)).toHaveClass(/is-selected/);
    await expect(piece(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#gamesStage .games-hud'))
      .toHaveText('已选中「方块」，积木跟着指针走，点板面格子落子；按 R 或点「旋转」换朝向');
    await expect(page.locator('.tg-ghost')).toBeVisible(); // 手持即出幽灵块

    await cell(page, 2).click(); // 锚点格落在第 0 行第 2 列
    await expect(page.locator('.tg-cell[data-piece="o"]')).toHaveCount(4);
    expect(await boardOf(page)).toEqual([
      null, null, 'o', 'o', null, null,
      null, null, 'o', 'o', null, null,
      null, null, null, null, null, null,
      null, null, null, null, null, null,
      null, null, null, null, null, null,
      null, null, null, null, null, null,
    ]);
    // 落子后自动放开手持，托盘上该块转为「已放置」
    await expect(piece(page, 1)).not.toHaveClass(/is-selected/);
    await expect(piece(page, 1)).toHaveClass(/is-placed/);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 1/6 块 · 每行每列的数字都对上就修好了');
  });

  test('提示实时染色：行列覆盖数对上亮薄荷、超出亮珊瑚', async ({ page }) => {
    await setup(page);
    await expect(page.locator('.tg-hint.is-ok, .tg-hint.is-over')).toHaveCount(0);

    await place(page, 0, 1, 0); // 长条竖在第 0 列第 0~3 行 → 第 0 列正好 4 格（= 提示 4）
    await expect(colHint(page, 0)).toHaveClass(/is-ok/);
    await expect(page.locator('.tg-col-hints .tg-hint.is-ok')).toHaveCount(1); // 其余列只有 0~1 格，未对上
    await expect(page.locator('.tg-hint.is-over')).toHaveCount(0);

    await cell(page, 0).click(); // 取回长条 → 手持，第 0 列的薄荷色应立即退回
    await expect(colHint(page, 0)).not.toHaveClass(/is-ok/);

    await page.keyboard.press('r'); // 转回横向 4 格
    await cell(page, 18).click();   // 落在第 3 行第 0~3 列 → 第 3 行 4 格，超过提示 2
    await expect(rowHint(page, 3)).toHaveClass(/is-over/);
    await expect(page.locator('.tg-hint.is-over')).toHaveCount(1);
    await expect(page.locator('.tg-hint.is-ok')).toHaveCount(0);
  });

  test('再点一次取消手持：幽灵块收回、不落子、盘面不变', async ({ page }) => {
    await setup(page);
    await piece(page, 0).click();
    await expect(piece(page, 0)).toHaveClass(/is-selected/);
    await expect(page.locator('.tg-ghost')).toBeVisible();
    await piece(page, 0).click(); // 同一块再点一次 = 取消
    await expect(piece(page, 0)).not.toHaveClass(/is-selected/);
    await expect(page.locator('.tg-ghost')).toBeHidden();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 每行每列的数字都对上就修好了');
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
  });

  test('手持跟随：幽灵块随指针移动，进板面吸附到目标格、离板面自由跟随', async ({ page }) => {
    await setup(page);
    await expect(page.locator('.tg-ghost')).toBeHidden(); // 起手不手持 → 没有幽灵块

    const p = await piece(page, 1).boundingBox(); // 方块（锚点格 = 左上格）
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    // 轻点选中后立刻就能看到幽灵块，不需要先甩一下指针
    await expect(page.locator('.tg-ghost')).toBeVisible();
    await expect(page.locator('.tg-ghost-cell')).toHaveCount(4);
    await expect(page.locator('.tg-ghost-cell[data-piece="o"]')).toHaveCount(4); // 取色与托盘同一份映射
    await expect(page.locator('.tg-ghost-cell.is-anchor')).toHaveCount(1); // 锚点格只有一个
    const atTray = await ghostXY(page);

    // 指针移到板面以外：块继续跟着走（位置变了），且不带落点状态环
    await page.mouse.move(20, 700);
    const away = await ghostXY(page);
    expect(away).not.toEqual(atTray);
    await expect(page.locator('.tg-ghost')).not.toHaveClass(/is-ok|is-bad/);

    // 指针压到第 0 行第 5 列：2×2 方块有一半会越出右边界 → 吸附 + 标红
    const c5 = await cell(page, 5).boundingBox();
    await page.mouse.move(c5.x + c5.width / 2, c5.y + c5.height / 2);
    await expect(page.locator('.tg-ghost')).toHaveClass(/is-bad/);
    expect(await ghostXY(page)).toEqual(boxTopLeft(c5)); // 吸附：幽灵块左上格正好盖住目标格
    await expect(page.locator('.tg-cell.is-preview.is-bad')).toHaveCount(2); // 板面格给出同一结论（出格的两格无从染色）

    // 指针压到能放的位置（第 0 行第 2 列，方块左上角落在网格内）：吸附 + 标绿
    const c2 = await cell(page, 2).boundingBox();
    await page.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2);
    await expect(page.locator('.tg-ghost')).toHaveClass(/is-ok/);
    expect(await ghostXY(page)).toEqual(boxTopLeft(c2));
    await expect(page.locator('.tg-cell.is-preview.is-ok')).toHaveCount(4);

    // 落子后幽灵块收回
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('.tg-cell[data-piece="o"]')).toHaveCount(4);
    await expect(page.locator('.tg-ghost')).toBeHidden();
  });

  test('手持旋转：指针停在板面上时按 R，幽灵块按新朝向重建且仍吸附在指针所在格', async ({ page }) => {
    await setup(page);
    await piece(page, 0).click(); // 长条，默认横向 4 格
    const c = await cell(page, 4).boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);

    await expect(page.locator('.tg-ghost-cell')).toHaveCount(4);
    await expect(page.locator('.tg-ghost')).toHaveClass(/is-bad/); // 横着从第 4 列往右必越界
    expect(await ghostXY(page)).toEqual(boxTopLeft(c));

    await page.keyboard.press('r'); // 转成竖向：第 4 列第 0~3 行正好落在网格内
    await expect(page.locator('.tg-ghost')).toHaveClass(/is-ok/);
    await expect(page.locator('.tg-ghost-cell')).toHaveCount(4);
    // 关键：换朝向后锚点格仍是「指针所在的那格」，幽灵块不会跳到别处
    expect(await ghostXY(page)).toEqual(boxTopLeft(c));
    await expect(page.locator('.tg-cell.is-preview.is-ok')).toHaveCount(4);
  });

  test('触屏：轻点选中不出幽灵块（触屏没有 hover，只剩板面格染色）', async ({ page }) => {
    await setup(page);
    // 合成一条真实触屏时序：pointerdown(touch) → window pointerup → click。
    // 不用 hasTouch 上下文也能覆盖「指针记账为 touch 就走无幽灵块的老路径」这条分支。
    await page.evaluate(() => {
      const b = document.querySelectorAll('.tg-piece')[1];
      const r = b.getBoundingClientRect();
      const at = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 };
      b.dispatchEvent(new PointerEvent('pointerdown', Object.assign({
        bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
      }, at)));
      window.dispatchEvent(new PointerEvent('pointerup', Object.assign({ bubbles: true }, at)));
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await expect(piece(page, 1)).toHaveClass(/is-selected/); // 选中照旧
    await expect(page.locator('.tg-ghost')).toBeHidden();     // 但不出幽灵块
  });

  test('越界拒绝：横向长条放到贴右边界的格子会越出板面，不生效', async ({ page }) => {
    await setup(page);
    await piece(page, 0).click(); // 长条，默认横向 4 格
    await cell(page, 4).click();  // 从第 4 列起会压到第 6/7 列（出界）

    await expect(page.locator('#gamesStage .games-hud'))
      .toHaveText('这里放不下：要么越出板面，要么和别的积木重叠');
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(piece(page, 0)).not.toHaveClass(/is-placed/);
    await expect(piece(page, 0)).toHaveClass(/is-selected/); // 手持不因失败而丢失
  });

  test('重叠拒绝：同一片格子已有积木时再放不进去', async ({ page }) => {
    await setup(page);
    await place(page, 0, 1, 2); // 长条竖着占第 2 列第 0~3 行
    await expect(page.locator('.tg-cell[data-piece="i4"]')).toHaveCount(4);

    await piece(page, 4).click(); // 短条
    await page.keyboard.press('r'); // 转成竖的，正好压在同一列
    await cell(page, 2).click();

    await expect(page.locator('#gamesStage .games-hud'))
      .toHaveText('这里放不下：要么越出板面，要么和别的积木重叠');
    await expect(page.locator('.tg-cell[data-piece="i4"]')).toHaveCount(4); // 原块不动
    await expect(page.locator('.tg-cell[data-piece="i3"]')).toHaveCount(0);
  });

  test('取回：点已放置的积木回托盘并转入手持', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2); // 方块落在第 0~1 行第 2~3 列
    await expect(page.locator('.tg-cell[data-piece="o"]')).toHaveCount(4);

    await cell(page, 2).click(); // 空手点已放置的块 = 取回
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(piece(page, 1)).toHaveClass(/is-selected/);
    await expect(piece(page, 1)).not.toHaveClass(/is-placed/);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已取回「方块」，重新找位置放吧');
  });

  test('旋转：R 键把长条转成竖向，落子随之改变占用格', async ({ page }) => {
    await setup(page);
    await place(page, 0, 1, 2); // 转 1 次 = 竖

    expect(await boardOf(page)).toEqual([
      null, null, 'i4', null, null, null,
      null, null, 'i4', null, null, null,
      null, null, 'i4', null, null, null,
      null, null, 'i4', null, null, null,
      null, null, null, null, null, null,
      null, null, null, null, null, null,
    ]);
    await expect(piece(page, 0)).toHaveClass(/is-placed/);
  });

  test('未手持时旋转：只给提示，不动任何状态', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('r');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('先在托盘里选一块积木，再旋转');

    await page.locator('.tg-rotate').click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('先在托盘里选一块积木，再旋转');
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
  });

  test('拖动落子：从托盘拖到板面，拖动中先给预览染色', async ({ page }) => {
    await setup(page);
    const p = await piece(page, 1).boundingBox(); // 方块
    const c = await cell(page, 2).boundingBox();
    const mid = (r, dx = 0, dy = 0) => ({ x: r.x + r.width / 2 + dx, y: r.y + r.height / 2 + dy });

    await page.mouse.move(mid(p).x, mid(p).y);
    await page.mouse.down();
    await page.mouse.move(mid(c).x, mid(c).y, { steps: 6 });

    // 松手前：预览已把 4 个落点标成「可放」，同时幽灵块跟着指针贴在目标格上
    await expect(page.locator('.tg-cell.is-preview.is-ok')).toHaveCount(4);
    await expect(page.locator('.tg-ghost')).toBeVisible();
    await expect(page.locator('.tg-ghost')).toHaveClass(/is-ok/);
    await page.mouse.up();

    await expect(page.locator('.tg-cell.is-preview')).toHaveCount(0);
    await expect(page.locator('.tg-ghost')).toBeHidden(); // 落子后收回幽灵块
    await expect(page.locator('.tg-cell[data-piece="o"]')).toHaveCount(4);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 1/6 块 · 每行每列的数字都对上就修好了');
  });

  test('重置：清空板面与手持状态', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2);  // 方块落在第 0~1 行第 2~3 列
    await place(page, 0, 1, 16); // 长条竖着落在第 4 列第 2~5 行
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(8);

    await page.locator('.tg-reset').click();
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('.tg-piece.is-placed')).toHaveCount(0);
    await expect(page.locator('.tg-hint.is-ok, .tg-hint.is-over')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已重置，重新拼吧');
  });

  test('通关：六块用尽且每行每列都对上提示数 → 弹层与锁局；再拼一次可重来', async ({ page }) => {
    await setup(page);
    for (const s of SOLUTION) await place(page, s.idx, s.rot, s.cell);

    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);
    await expect(page.locator('.tg-hint.is-ok')).toHaveCount(12); // 6 行 + 6 列全部对上
    await expect(page.locator('.tg-hint.is-over')).toHaveCount(0);
    await expect(page.locator('.tg-overlay')).toBeVisible();
    await expect(page.locator('.tg-overlay-title')).toHaveText('机器人修好了！');
    await expect(page.locator('.tg-overlay-text')).toHaveText('6 块积木全部归位，行与列的数字也对上了。');
    await expect(page.locator('.tg-board')).toHaveClass(/is-done/);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('机器人修好了！');
    await expect(page.locator('.tg-overlay-next')).toBeVisible(); // 第 1 关还有下一关

    // 通关后锁局：点托盘只提示，板面不回退
    await piece(page, 0).click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('机器人已经修好了，想重来就点「重置」');
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);

    // 再拼一次：清空重来
    await page.locator('.tg-overlay-replay').click();
    await expect(page.locator('.tg-overlay')).toBeHidden();
    await expect(page.locator('.tg-board')).not.toHaveClass(/is-done/);
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已重置，重新拼吧');
  });

  test('提示数不满足：六块用尽但行列对不上号 → 不通关', async ({ page }) => {
    await setup(page);
    // 与正解只差角形一块：角形改放在第 3~4 行、第 4~5 列（几何上完全合法），
    // 于是第 3 行变 3 格（提示 2）、第 4 行变 4 格（提示 3）→ 超标，不该判通关。
    const wrong = [
      { idx: 0, rot: 1, cell: 0 },
      { idx: 1, rot: 0, cell: 2 },
      { idx: 2, rot: 0, cell: 26 },
      { idx: 3, rot: 0, cell: 13 },
      { idx: 4, rot: 1, cell: 5 },
      { idx: 5, rot: 0, cell: 22 },
    ];
    for (const s of wrong) await place(page, s.idx, s.rot, s.cell);

    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22); // 6 块都用上了
    await expect(page.locator('.tg-overlay')).toBeHidden();
    await expect(page.locator('.tg-board')).not.toHaveClass(/is-done/);
    await expect(page.locator('.tg-hint.is-over')).toHaveCount(2); // 第 3 行、第 4 行超标
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 6/6 块 · 每行每列的数字都对上就修好了');
  });

  test('提示：空盘点「提示」→ 高亮该放的那一块与它的目标格；动手后提示退场', async ({ page }) => {
    await setup(page);

    await page.locator('.tg-hintbtn').click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('提示：把「长条」放到高亮的 4 格上');
    await expect(page.locator('.tg-piece.is-hint')).toHaveCount(1);
    await expect(page.locator('.tg-piece[data-piece="i4"]')).toHaveClass(/is-hint/);
    await expect(page.locator('.tg-cell.is-hint')).toHaveCount(4); // = 长条的面积
    await expect(page.locator('.tg-cell.is-hint[data-piece]')).toHaveCount(0); // 目标格必须是空格
    await expect(page.locator('.tg')).toHaveAttribute('data-tg-hint', /^place:0:/);

    // 再点一次不叠加，仍是同一条提示
    await page.locator('.tg-hintbtn').click();
    await expect(page.locator('.tg-cell.is-hint')).toHaveCount(4);

    // 一动手（重置）提示立即退场
    await page.locator('.tg-reset').click();
    await expect(page.locator('.tg-cell.is-hint, .tg-piece.is-hint')).toHaveCount(0);
    await expect(page.locator('.tg')).not.toHaveAttribute('data-tg-hint');
  });

  test('提示：摆不出解时指出该取回哪一块，照着做能通关', async ({ page }) => {
    await setup(page);
    // 先摆出「六块都用上、但行列对不上号」的局面：角形错放在第 3~4 行第 4~5 列
    const wrong = [
      { idx: 0, rot: 1, cell: 0 }, { idx: 1, rot: 0, cell: 2 }, { idx: 2, rot: 0, cell: 26 },
      { idx: 3, rot: 0, cell: 13 }, { idx: 4, rot: 1, cell: 5 }, { idx: 5, rot: 0, cell: 22 },
    ];
    for (const s of wrong) await place(page, s.idx, s.rot, s.cell);
    await expect(page.locator('.tg-overlay')).toBeHidden();

    await page.locator('.tg-hintbtn').click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('提示：先取回「角形」，再换个位置放');
    await expect(page.locator('.tg-piece[data-piece="l3"]')).toHaveClass(/is-hint/);
    await expect(page.locator('.tg-cell.is-hint')).toHaveCount(3); // 角形自身占的 3 格
    await expect(page.locator('.tg')).toHaveAttribute('data-tg-hint', 'retract:5');

    // 照做：取回角形 → 放到正解位置 → 通关
    await cell(page, 22).click(); // 角形当前占的锚点格 = 取回
    await expect(page.locator('.tg-cell.is-hint, .tg-piece.is-hint')).toHaveCount(0); // 提示随动作退场
    await cell(page, 28).click();
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);
    await expect(page.locator('.tg-hint.is-ok')).toHaveCount(12);
    await expect(page.locator('.tg-overlay')).toBeVisible();
  });

  test('提示：通关后点提示只说已经修好了，不再画环', async ({ page }) => {
    await setup(page);
    for (const s of SOLUTION) await place(page, s.idx, s.rot, s.cell);
    await expect(page.locator('.tg-overlay')).toBeVisible();

    await page.locator('.tg-hintbtn').click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('机器人已经修好了，不用提示啦');
    await expect(page.locator('.tg-cell.is-hint, .tg-piece.is-hint')).toHaveCount(0);
    await expect(page.locator('.tg')).not.toHaveAttribute('data-tg-hint');
  });

  test('提示：一路照着提示走能把这关解开（提示按当前盘面现场求，不依赖写死的答案）', async ({ page }) => {
    await setup(page);
    await solveByHints(page);

    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);
    await expect(page.locator('.tg-hint.is-ok')).toHaveCount(12);
    await expect(page.locator('.tg-overlay')).toBeVisible();
  });

  test('切关：点「第 2 关」芯片 → 行列数字换成那一关的、盘面清空、激活态转移；切回也还原', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2); // 先在第 1 关放一块，确认切关确实清空
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(4);

    await levelChip(page, 1).click();
    await expect(levelChip(page, 1)).toHaveAttribute('aria-selected', 'true');
    await expect(levelChip(page, 1)).toHaveClass(/active/);
    await expect(levelChip(page, 0)).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.tg-col-hints .tg-hint')).toHaveText(LEVELS[1].col);
    await expect(page.locator('.tg-row-hints .tg-hint')).toHaveText(LEVELS[1].row);
    await expect(colHint(page, 1)).toHaveAttribute('aria-label', '第 2 列需要覆盖 4 格'); // aria-label 同步刷新
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('.tg-hint.is-ok, .tg-hint.is-over')).toHaveCount(0);
    await expect(page.locator('.tg-piece.is-placed')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 每行每列的数字都对上就修好了');

    await levelChip(page, 0).click(); // 切回第 1 关
    await expect(page.locator('.tg-col-hints .tg-hint')).toHaveText(LEVELS[0].col);
    await expect(page.locator('.tg-row-hints .tg-hint')).toHaveText(LEVELS[0].row);
    await expect(levelChip(page, 0)).toHaveAttribute('aria-selected', 'true');
  });

  test('切关（键盘）：焦点在芯片上时左右方向键移动并激活，Home / End 跳首尾', async ({ page }) => {
    await setup(page);
    await levelChip(page, 0).focus();

    await page.keyboard.press('ArrowRight');
    await expect(levelChip(page, 1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.tg-row-hints .tg-hint')).toHaveText(LEVELS[1].row);

    await page.keyboard.press('End');
    await expect(levelChip(page, 3)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.tg-col-hints .tg-hint')).toHaveText(LEVELS[3].col);

    await page.keyboard.press('ArrowRight'); // 末尾回绕到第 1 关
    await expect(levelChip(page, 0)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowLeft'); // 开头回绕到最后一关
    await expect(levelChip(page, 3)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Home');
    await expect(levelChip(page, 0)).toHaveAttribute('aria-selected', 'true');
  });

  test('关卡：四关都能照提示解开；弹层「下一关」逐关推进，最后一关不再给「下一关」', async ({ page }) => {
    await setup(page);
    for (let li = 0; li < LEVELS.length; li++) {
      await expect(levelChip(page, li)).toHaveAttribute('aria-selected', 'true');
      await solveByHints(page);

      await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);
      await expect(page.locator('.tg-hint.is-ok')).toHaveCount(12);
      await expect(page.locator('.tg-overlay')).toBeVisible();

      if (li < LEVELS.length - 1) {
        await expect(page.locator('.tg-overlay-next')).toBeVisible();
        await page.locator('.tg-overlay-next').click(); // 推进下一关：换数字 + 清盘
        await expect(page.locator('.tg-overlay')).toBeHidden();
        await expect(levelChip(page, li + 1)).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('.tg-col-hints .tg-hint')).toHaveText(LEVELS[li + 1].col);
        await expect(page.locator('.tg-row-hints .tg-hint')).toHaveText(LEVELS[li + 1].row);
        await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
        await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 每行每列的数字都对上就修好了');
      } else {
        await expect(page.locator('.tg-overlay-next')).toBeHidden(); // 最后一关只剩「再拼一次」
        await expect(page.locator('.tg-overlay-replay')).toBeVisible();
      }
    }

    // 最后一关「再拼一次」仍可清空重来
    await page.locator('.tg-overlay-replay').click();
    await expect(page.locator('.tg-overlay')).toBeHidden();
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(levelChip(page, LEVELS.length - 1)).toHaveAttribute('aria-selected', 'true');
  });

  test('切 tab：切走清空本游戏节点，切回是全新局面（无进度存档）', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2);
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(4);

    await page.locator('#gamesTab-2048').click();
    await expect(page.locator('.tg-cell')).toHaveCount(0); // 七巧板挂载节点已随销毁移除
    await expect(page.locator('.tg-ghost')).toHaveCount(0); // 挂在 body 上的幽灵块也必须摘掉，否则会跟到别的游戏去

    await page.locator('#gamesTab-tangram').click();
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 每行每列的数字都对上就修好了');
    expect(await boardOf(page)).toEqual(new Array(36).fill(null));
  });
});
