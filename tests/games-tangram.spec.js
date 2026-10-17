// ============ 游戏室 · 七巧板（机器人维修） ============
// 全部用例走真实数据与真实实现（不 stub）：验证「挂载 → 选中/拖动落子 → 越界与重叠拒绝 →
// 取回/旋转/重置 → 通关判定与锁局 → 切 tab 无残留」整条链路。
//
// 确定性手段：emulateMedia reducedMotion: 'reduce' —— 关闭落子/预览的面色过渡，断言无动画窗口。
//
// 解法（由 js/games-tangram.js 的 SHAPE 与积木集合反推，与回溯求解器结果一致）：
//   i4(idx0) rot1 → 锚点格 2     o (idx1) rot0 → 锚点格 16
//   s (idx2) rot1 → 锚点格 21    t (idx3) rot3 → 锚点格 19
//   i3(idx4) rot1 → 锚点格 3     l3(idx5) rot1 → 锚点格 12
const { test, expect } = require('@playwright/test');

const SOLUTION = [
  { idx: 0, rot: 1, cell: 2 },  // 长条（竖）
  { idx: 1, rot: 0, cell: 16 }, // 方块
  { idx: 2, rot: 1, cell: 21 }, // S 形
  { idx: 3, rot: 3, cell: 19 }, // T 形
  { idx: 4, rot: 1, cell: 3 },  // 短条（竖）
  { idx: 5, rot: 1, cell: 12 }, // 角形
];

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

test.describe('游戏室 · 七巧板', () => {
  test('挂载：tab 文案、剪影/空白格分明、托盘就位、hud 初态', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await setup(page);
    const tab = page.locator('#gamesTab-tangram');
    await expect(tab).toHaveText('益智七巧板');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamesHint')).toContainText('机器人剪影');

    await expect(page.locator('.tg-board')).toHaveAttribute('role', 'application');
    await expect(page.locator('.tg-board .tg-cell')).toHaveCount(36);
    // 剪影 22 格（要填的坑）、空白 14 格
    await expect(page.locator('.tg-board .tg-cell:not(.is-blank)')).toHaveCount(22);
    await expect(page.locator('.tg-board .tg-cell.is-blank')).toHaveCount(14);
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(0);

    await expect(page.locator('.tg-piece')).toHaveCount(6);
    await expect(page.locator('.tg-piece[data-piece="i4"]')).toHaveAttribute('aria-label', /长条，4 格$/);
    await expect(page.locator('.tg-piece').nth(0)).not.toHaveClass(/is-selected/);
    await expect(page.locator('.tg-overlay')).toBeHidden();

    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 全部拼进剪影就修好了');
    await expect(page.locator('#gamesStage .games-hud')).toHaveAttribute('aria-live', 'polite');
    expect(errors).toEqual([]);
  });

  test('选中落子：点托盘选中、点锚点格落子、盘面染色与 hud 计数', async ({ page }) => {
    await setup(page);

    await piece(page, 1).click(); // 方块
    await expect(piece(page, 1)).toHaveClass(/is-selected/);
    await expect(piece(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已选中「方块」，点剪影格子落子；按 R 或点「旋转」换朝向');

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
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 1/6 块 · 全部拼进剪影就修好了');
  });

  test('再点一次取消手持：不落子、盘面不变', async ({ page }) => {
    await setup(page);
    await piece(page, 0).click();
    await expect(piece(page, 0)).toHaveClass(/is-selected/);
    await piece(page, 0).click(); // 同一块再点一次 = 取消
    await expect(piece(page, 0)).not.toHaveClass(/is-selected/);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 全部拼进剪影就修好了');
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
  });

  test('越界拒绝：横向长条放到剪影外的空白格不生效', async ({ page }) => {
    await setup(page);
    await piece(page, 0).click(); // 长条，默认横向 4 格
    await cell(page, 0).click();  // 会压到第 0 行第 0/1 列的空白格

    await expect(page.locator('#gamesStage .games-hud'))
      .toHaveText('这里放不下：要么越出了剪影，要么和别的积木重叠');
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(piece(page, 0)).not.toHaveClass(/is-placed/);
    await expect(piece(page, 0)).toHaveClass(/is-selected/); // 手持不因失败而丢失
  });

  test('重叠拒绝：同一片剪影已有积木时再放不进去', async ({ page }) => {
    await setup(page);
    await place(page, 0, 1, 2); // 长条竖着占第 2 列第 0~3 行
    await expect(page.locator('.tg-cell[data-piece="i4"]')).toHaveCount(4);

    await piece(page, 4).click(); // 短条
    await page.keyboard.press('r'); // 转成竖的，正好压在同一列
    await cell(page, 2).click();

    await expect(page.locator('#gamesStage .games-hud'))
      .toHaveText('这里放不下：要么越出了剪影，要么和别的积木重叠');
    await expect(page.locator('.tg-cell[data-piece="i4"]')).toHaveCount(4); // 原块不动
    await expect(page.locator('.tg-cell[data-piece="i3"]')).toHaveCount(0);
  });

  test('取回：点已放置的积木回托盘并转入手持', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2); // 方块落在左上角 2×2
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

    // 松手前：预览已把 4 个落点标成「可放」
    await expect(page.locator('.tg-cell.is-preview.is-ok')).toHaveCount(4);
    await page.mouse.up();

    await expect(page.locator('.tg-cell.is-preview')).toHaveCount(0);
    await expect(page.locator('.tg-cell[data-piece="o"]')).toHaveCount(4);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 1/6 块 · 全部拼进剪影就修好了');
  });

  test('重置：清空板面与手持状态', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2);  // 方块落在第 0~1 行第 2~3 列
    await place(page, 0, 1, 16); // 长条竖着落在第 4 列第 2~5 行
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(8);

    await page.locator('.tg-reset').click();
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('.tg-piece.is-placed')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已重置，重新拼吧');
  });

  test('通关：六块用尽且铺满剪影 → 弹层与锁局；再拼一次可重来', async ({ page }) => {
    await setup(page);
    for (const s of SOLUTION) await place(page, s.idx, s.rot, s.cell);

    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);
    await expect(page.locator('.tg-overlay')).toBeVisible();
    await expect(page.locator('.tg-overlay-title')).toHaveText('机器人修好了！');
    await expect(page.locator('.tg-board')).toHaveClass(/is-done/);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('机器人修好了！');

    // 通关后锁局：点托盘只提示，板面不回退
    await piece(page, 0).click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('机器人已经修好了，想重来就点「重置」');
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(22);

    // 再拼一次：清空重来
    await page.locator('.tg-overlay-btn').click();
    await expect(page.locator('.tg-overlay')).toBeHidden();
    await expect(page.locator('.tg-board')).not.toHaveClass(/is-done/);
    await expect(page.locator('.tg-board .tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已重置，重新拼吧');
  });

  test('切 tab：切走清空本游戏节点，切回是全新局面（无进度存档）', async ({ page }) => {
    await setup(page);
    await place(page, 1, 0, 2);
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(4);

    await page.locator('#gamesTab-2048').click();
    await expect(page.locator('.tg-cell')).toHaveCount(0); // 七巧板挂载节点已随销毁移除

    await page.locator('#gamesTab-tangram').click();
    await expect(page.locator('.tg-cell[data-piece]')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已放 0/6 块 · 全部拼进剪影就修好了');
    expect(await boardOf(page)).toEqual(new Array(36).fill(null));
  });
});
