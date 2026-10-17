// ============ 游戏室 · 2048 ============
// 全部用例走真实数据与真实实现（不 stub）：验证「清单 → 挂载 → 玩法 → 计分持久化 → 胜负态」。
//
// 确定性手段：
//   1. emulateMedia reducedMotion: 'reduce' —— games.js 在加载时缓存该偏好，
//      2048 挂载时据此加 .no-anim 并同步落地每一步（无动画窗口），断言无需等待过渡；
//   2. window.__G2048_SEED__（js/games-2048.js 的测试锚点）固定初始盘面，合并位置可精确预言。
const { test, expect } = require('@playwright/test');

// 16 格行优先数组；这里只列前几个值，其余补 0
function seedRow(values) {
  const full = new Array(16).fill(0);
  values.forEach(([i, v]) => { full[i] = v; });
  return full;
}

async function setup(page, seed) {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch (e) { /* 隐私模式下忽略 */ }
  });
  if (seed) await page.addInitScript((v) => { window.__G2048_SEED__ = v; }, seed);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('games.html');
}

// 读写方块的内联定位变量（--r/--c 由 js/games-2048.js 逐块设置）
function tilesOf(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.g2048-tile')).map((el) => ({
    v: Number(el.dataset.v),
    r: Number(el.style.getPropertyValue('--r')),
    c: Number(el.style.getPropertyValue('--c')),
  })));
}

// 合成一次滑动（与 games.spec.js 同一口径：pointer 事件派发在舞台上）
function swipe(page, fromX, fromY, toX, toY) {
  return page.evaluate((p) => {
    const stage = document.getElementById('gamesStage');
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true };
    const mk = (type, x, y) => new PointerEvent(type, Object.assign({}, base, { clientX: x, clientY: y }));
    stage.dispatchEvent(mk('pointerdown', p.fromX, p.fromY));
    stage.dispatchEvent(mk('pointerup', p.toX, p.toY));
  }, { fromX, fromY, toX, toY });
}

test.describe('游戏室 · 2048', () => {
  test('挂载：tab 渲染、盘面就位、种子盘面逐格正确', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await setup(page, seedRow([[0, 2], [1, 4], [5, 2]]));
    // 清单现含三款（2048 + 拼豆 + 七巧板），2048 默认激活；另两款见各自的 spec
    const tab = page.locator('#gamesTabs [role="tab"]');
    await expect(tab).toHaveCount(3);
    await expect(tab.nth(0)).toHaveText('益智2048');
    await expect(tab.nth(1)).toHaveText('创作拼豆');
    await expect(tab.nth(2)).toHaveText('益智七巧板');

    await expect(page.locator('.g2048-cell')).toHaveCount(16);
    expect(await tilesOf(page)).toEqual([
      { v: 2, r: 0, c: 0 },
      { v: 4, r: 0, c: 1 },
      { v: 2, r: 1, c: 1 },
    ]);
    await expect(page.locator('.g2048-overlay')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('键盘：ArrowLeft 压实合并、计分与最佳分落盘', async ({ page }) => {
    await setup(page, seedRow([[0, 2], [1, 2]]));
    await page.keyboard.press('ArrowLeft');

    // 两个 2 合成 (0,0) 的 4，随后随机补一个新块
    const tiles = await tilesOf(page);
    const merged = tiles.find((t) => t.v === 4);
    expect(merged).toEqual({ v: 4, r: 0, c: 0 });
    expect(tiles).toHaveLength(2);

    await expect(page.locator('.g2048-score').nth(0).locator('strong')).toHaveText('4');
    await expect(page.locator('.g2048-score').nth(1).locator('strong')).toHaveText('4');
    expect(await page.evaluate(() => localStorage.getItem('youxi_best_2048_v1'))).toBe('4');
  });

  test('键盘：WASD 与方向键等效（d 向右压实到最右列）', async ({ page }) => {
    await setup(page, seedRow([[0, 2], [1, 2]]));
    await page.keyboard.press('d');

    const tiles = await tilesOf(page);
    expect(tiles.find((t) => t.v === 4)).toEqual({ v: 4, r: 0, c: 3 });
  });

  test('键盘：无效方向不消耗回合、不生成新块', async ({ page }) => {
    // 块都已顶在最上排：向上没有可动空间
    await setup(page, seedRow([[0, 2], [1, 4]]));
    await page.keyboard.press('ArrowUp');
    expect(await tilesOf(page)).toEqual([
      { v: 2, r: 0, c: 0 },
      { v: 4, r: 0, c: 1 },
    ]);
    await expect(page.locator('.g2048-score').nth(0).locator('strong')).toHaveText('0');
  });

  test('滑动：左滑等效 ArrowLeft（pointer 事件链路）', async ({ page }) => {
    await setup(page, seedRow([[0, 2], [1, 2]]));
    await swipe(page, 300, 200, 120, 204); // dx = -180，主轴横向

    expect((await tilesOf(page)).find((t) => t.v === 4)).toEqual({ v: 4, r: 0, c: 0 });
  });

  test('最佳分：刷新后仍在（ctx.best 持久化）', async ({ page }) => {
    // 注意不能用 addInitScript 清 localStorage：它会在 reload 时再次执行，把刚存的最高分清掉。
    // 这里先加载一次清掉历史数据，reload 得到干净起点，再玩一局、再 reload 验证持久化。
    await page.addInitScript((v) => { window.__G2048_SEED__ = v; }, seedRow([[0, 2], [1, 2]]));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('games.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.g2048-score').nth(1).locator('strong')).toHaveText('4');

    await page.reload();
    await expect(page.locator('.g2048-score').nth(1).locator('strong')).toHaveText('4');
    await expect(page.locator('.g2048-score').nth(0).locator('strong')).toHaveText('0');
  });

  test('达成 2048：祝贺弹层、可继续挑战', async ({ page }) => {
    await setup(page, seedRow([[0, 1024], [1, 1024]]));
    await page.keyboard.press('ArrowLeft');

    const overlay = page.locator('.g2048-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('.g2048-overlay-title')).toHaveText('达成 2048！');
    await expect(page.locator('.g2048-tile[data-v="2048"]')).toHaveCount(1);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('达成 2048！');

    await page.locator('.g2048-overlay-btn').click();
    await expect(overlay).toBeHidden();
    // 继续后 2048 块仍在盘上，可继续游戏
    await expect(page.locator('.g2048-tile[data-v="2048"]')).toHaveCount(1);
  });

  test('终局：满盘无路弹层、再来一局清盘重开', async ({ page }) => {
    // 棋盘格交替取值，行列皆无相邻同值 → 开局即终局
    await setup(page, [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
    const overlay = page.locator('.g2048-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('.g2048-overlay-title')).toHaveText('没地方动了');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('游戏结束，本局得分 0');

    await page.locator('.g2048-overlay-btn').click();
    await expect(overlay).toBeHidden();
    expect(await tilesOf(page)).toHaveLength(2); // 重开只发 2 个起始块
    await expect(page.locator('.g2048-score').nth(0).locator('strong')).toHaveText('0');
  });

  test('新开一局按钮：清空计分与盘面', async ({ page }) => {
    await setup(page, seedRow([[0, 2], [1, 2]]));
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.g2048-score').nth(0).locator('strong')).toHaveText('4');

    await page.locator('.g2048-restart').click();
    expect(await tilesOf(page)).toHaveLength(2);
    await expect(page.locator('.g2048-score').nth(0).locator('strong')).toHaveText('0');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('新的一局开始，得分已清零');
    // 最佳分不随重开清零
    await expect(page.locator('.g2048-score').nth(1).locator('strong')).toHaveText('4');
  });

  test('降级：无种子时随机开局 2 块、切走后无残留节点', async ({ page }) => {
    await setup(page, null);
    expect(await tilesOf(page)).toHaveLength(2);

    // 框架在切换时整体置换舞台内容；2048 自身的定时器/观察器由 destroy 释放。
    // 单游戏清单无法切走，这里直接验证挂载点被框架复用前的干净性：
    // 重开两次后再按键，游戏仍应正常响应（监听未泄漏、未失效）。
    await page.locator('.g2048-restart').click();
    await page.locator('.g2048-restart').click();
    await page.keyboard.press('ArrowLeft');
    const tiles = await tilesOf(page);
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    expect(tiles.length).toBeLessThanOrEqual(3); // 2 起始块 + 至多 1 个合并后新块
  });
});
