// ============ 游戏室 · 拼豆 ============
// 全部用例走真实数据与真实实现（不 stub）：验证「挂载 → 调色板/工具 → 拖动绘制 →
// 存档恢复 → 坏数据弃用 → 切 tab 强制落盘」整条链路。
//
// 确定性手段：emulateMedia reducedMotion: 'reduce' —— 关闭豆子过渡动画，断言无动画窗口。
const { test, expect } = require('@playwright/test');
const fs = require('fs');

// 干净起点：默认落在第一个 tab（2048），这里统一切到拼豆
async function setup(page) {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch (e) { /* 隐私模式下忽略 */ }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('games.html');
  await page.locator('#gamesTab-pindou').click();
}

// 读取盘面 144 格的 data-color（无豆为 null），下标即行优先格序
function boardOf(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.pd-board .pd-cell'))
    .map((el) => el.getAttribute('data-color')));
}

// 对指定格合成一次 pointerdown（走 boardEl 的真实监听 + cellFromPoint 命中链路）
function pressCell(page, index) {
  return page.evaluate((i) => {
    const cell = document.querySelectorAll('.pd-board .pd-cell')[i];
    const r = cell.getBoundingClientRect();
    cell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse',
      isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
    }));
  }, index);
}

test.describe('游戏室 · 拼豆', () => {
  test('挂载：tab 文案、盘面/调色板/工具就位、hud 初态', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await setup(page);
    const tab = page.locator('#gamesTab-pindou');
    await expect(tab).toHaveText('创作拼豆');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamesHint')).toContainText('点按或拖动放豆');

    await expect(page.locator('.pd-board')).toHaveAttribute('role', 'application');
    await expect(page.locator('.pd-board .pd-cell')).toHaveCount(144);
    await expect(page.locator('.pd-board .pd-cell[data-color]')).toHaveCount(0);

    await expect(page.locator('.pd-swatch')).toHaveCount(15);
    await expect(page.locator('.pd-swatch[data-color="pink"]')).toHaveAttribute('aria-label', '樱粉');
    await expect(page.locator('.pd-swatch[data-color="coral"]')).toHaveAttribute('aria-pressed', 'true'); // 默认色
    await expect(page.locator('.pd-swatch[data-color="mint"]')).toHaveAttribute('aria-pressed', 'false');

    await expect(page.locator('.pd-tool')).toHaveCount(5);
    await expect(page.locator('.pd-tool').nth(0)).toHaveAttribute('aria-pressed', 'true'); // 默认画笔
    await expect(page.locator('.pd-tool').nth(4)).toHaveText('清');

    await expect(page.locator('.pd-export')).toHaveText('导出 PNG');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 0 颗豆');
    await expect(page.locator('#gamesStage .games-hud')).toHaveAttribute('aria-live', 'polite');
    expect(errors).toEqual([]);
  });

  test('画笔：选色落豆、当前色同步、hud 计数', async ({ page }) => {
    await setup(page);

    await page.locator('.pd-swatch[data-color="pink"]').click();
    await expect(page.locator('.pd-swatch[data-color="pink"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.pd-swatch[data-color="mint"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.pd-current-dot')).toHaveAttribute('data-color', 'pink');
    await expect(page.locator('.pd-current-name')).toHaveText('樱粉');

    await page.locator('.pd-board .pd-cell').nth(0).click();
    await page.locator('.pd-board .pd-cell').nth(15).click();

    const board = await boardOf(page);
    expect(board[0]).toBe('pink');
    expect(board[15]).toBe('pink');
    expect(board.filter(Boolean)).toHaveLength(2);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 2 颗豆');
  });

  test('拖动：一笔连续绘制多格（pointerdown + move + elementFromPoint）', async ({ page }) => {
    await setup(page);

    const board = page.locator('.pd-board');
    await board.scrollIntoViewIfNeeded();
    const cells = page.locator('.pd-board .pd-cell');
    const a = await cells.nth(0).boundingBox();
    const b = await cells.nth(1).boundingBox();
    const c = await cells.nth(13).boundingBox();
    const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

    await page.mouse.move(center(a).x, center(a).y);
    await page.mouse.down();
    await page.mouse.move(center(b).x, center(b).y, { steps: 4 });
    await page.mouse.move(center(c).x, center(c).y, { steps: 4 });
    await page.mouse.up();

    const boardColors = await boardOf(page);
    expect(boardColors[0]).toBe('coral'); // 默认珊瑚红
    expect(boardColors[1]).toBe('coral');
    expect(boardColors[13]).toBe('coral');
    expect(boardColors.filter(Boolean)).toHaveLength(3);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 3 颗豆');
  });

  test('橡皮：擦除已放的豆', async ({ page }) => {
    await setup(page);

    await page.locator('.pd-board .pd-cell').nth(5).click();
    await expect(page.locator('.pd-board .pd-cell').nth(5)).toHaveAttribute('data-color', 'coral');

    await page.locator('.pd-tool[aria-label="橡皮"]').click();
    await expect(page.locator('.pd-tool[aria-label="橡皮"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.pd-board .pd-cell').nth(5).click();

    await expect(page.locator('.pd-board .pd-cell').nth(5)).not.toHaveAttribute('data-color');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 0 颗豆');
  });

  test('吸色：取色后自动切回画笔；空格给提示且不动当前色', async ({ page }) => {
    await setup(page);

    await page.locator('.pd-swatch[data-color="blue"]').click();
    await page.locator('.pd-board .pd-cell').nth(7).click();

    await page.locator('.pd-tool[aria-label="吸色"]').click();
    await page.locator('.pd-board .pd-cell').nth(7).click();

    // 取色成功：当前色变为天空蓝，工具自动切回画笔，可直接续画
    await expect(page.locator('.pd-current-dot')).toHaveAttribute('data-color', 'blue');
    await expect(page.locator('.pd-current-name')).toHaveText('天空蓝');
    await expect(page.locator('.pd-tool[aria-label="画笔"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已取色：天空蓝');

    await page.locator('.pd-board .pd-cell').nth(8).click();
    expect((await boardOf(page))[8]).toBe('blue');

    // 吸空格：提示、当前色不变
    await page.locator('.pd-tool[aria-label="吸色"]').click();
    await page.locator('.pd-board .pd-cell').nth(50).click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('这一格还没有豆，吸不了');
    await expect(page.locator('.pd-current-dot')).toHaveAttribute('data-color', 'blue');
  });

  test('填充：连通同色区整体换色，孤岛不受波及', async ({ page }) => {
    await setup(page);

    // 左上 2×2（格 0/1/12/13）放沙黄，与其它区域不连通
    await page.locator('.pd-swatch[data-color="sand"]').click();
    for (const i of [0, 1, 12, 13]) await page.locator('.pd-board .pd-cell').nth(i).click();

    await page.locator('.pd-swatch[data-color="mint"]').click();
    await page.locator('.pd-tool[aria-label="填充"]').click();
    await page.locator('.pd-board .pd-cell').nth(0).click();

    const board = await boardOf(page);
    expect([board[0], board[1], board[12], board[13]]).toEqual(['mint', 'mint', 'mint', 'mint']);
    expect(board[2]).toBeNull(); // 紧邻的空格不被吞
    expect(board.filter(Boolean)).toHaveLength(4);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 4 颗豆');
  });

  test('清空：两击确认才清、3 秒不确认自动解除', async ({ page }) => {
    await setup(page);

    await page.locator('.pd-board .pd-cell').nth(0).click();
    await page.locator('.pd-board .pd-cell').nth(1).click();

    const clearBtn = page.locator('.pd-tool').nth(4);
    await clearBtn.click(); // 第一击：武装
    await expect(clearBtn).toHaveText('确认');
    await expect(clearBtn).toHaveClass(/is-armed/);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('再点一次「确认」才会清空钉板');
    expect((await boardOf(page)).filter(Boolean)).toHaveLength(2); // 未清

    // 3 秒不确认：自动解除武装，豆子保留
    await page.waitForTimeout(3200);
    await expect(clearBtn).toHaveText('清');
    await expect(clearBtn).not.toHaveClass(/is-armed/);
    expect((await boardOf(page)).filter(Boolean)).toHaveLength(2);

    // 再武装并确认：清空
    await clearBtn.click();
    await clearBtn.click();
    await expect(clearBtn).toHaveText('清');
    await expect(page.locator('.pd-board .pd-cell[data-color]')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已清空钉板');
  });

  test('导出：空盘只提示，不产生下载', async ({ page }) => {
    await setup(page);
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await page.locator('.pd-export').click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('钉板还是空的，先拼几颗豆再导出吧');
    // toBlob 是异步链路，等一拍确认确实没有下载事件产生
    await page.waitForTimeout(400);
    expect(downloads).toBe(0);
  });

  test('导出：有豆时下载 PNG，签名/尺寸正确且不打断创作状态', async ({ page }) => {
    await setup(page);
    await page.locator('.pd-swatch[data-color="blue"]').click();
    await pressCell(page, 0);
    await pressCell(page, 1);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.pd-export').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^pindou-\d{8}-\d{6}\.png$/);
    const buf = fs.readFileSync(await download.path());
    expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG 签名
    expect(buf.readUInt32BE(16)).toBe(1080); // IHDR 宽（EXPORT_PX：2x 渲染）
    expect(buf.readUInt32BE(20)).toBe(1080); // IHDR 高

    // 导出是旁路动作：不换工具、不动盘面
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已导出 PNG 图片');
    await expect(page.locator('.pd-tool').nth(0)).toHaveAttribute('aria-pressed', 'true');
    expect((await boardOf(page)).filter(Boolean)).toHaveLength(2);
  });

  test('存档：落盘后 reload 恢复作品', async ({ page }) => {
    // 不能用 addInitScript 清库（reload 时会再执行一次），走「先加载再清 → reload」模式
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('games.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#gamesTab-pindou').click();

    // 放一颗樱粉豆
    await page.locator('.pd-swatch[data-color="pink"]').click();
    await pressCell(page, 20);

    // 400ms 防抖落盘完成后刷新
    await expect.poll(() => page.evaluate(() => localStorage.getItem('youxi_pindou_v1')), {
      timeout: 3000,
    }).not.toBeNull();
    await page.reload();
    await page.locator('#gamesTab-pindou').click();

    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已恢复你上次的作品，继续拼吧');
    const board = await boardOf(page);
    expect(board[20]).toBe('pink');
    expect(board.filter(Boolean)).toHaveLength(1);
  });

  test('坏存档：形状非法与颜色非法都整体弃用回默认', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem('youxi_pindou_v1', JSON.stringify({ board: 'nope', color: 'mint' }));
      } catch (e) { /* 忽略 */ }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('games.html');
    await page.locator('#gamesTab-pindou').click();

    // 形状非法：弃用，盘面为空、hud 默认播报
    await expect(page.locator('.pd-board .pd-cell[data-color]')).toHaveCount(0);
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 0 颗豆');

    // 颜色非法：同样整体弃用（坏数据不做部分恢复）
    await page.evaluate(() => {
      localStorage.setItem('youxi_pindou_v1', JSON.stringify({
        board: new Array(144).fill('hacker-green'),
        color: 'hacker-green',
      }));
    });
    await page.reload();
    await page.locator('#gamesTab-pindou').click();
    await expect(page.locator('.pd-board .pd-cell[data-color]')).toHaveCount(0);
    await expect(page.locator('.pd-current-dot')).toHaveAttribute('data-color', 'coral'); // 回默认色
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('自由创作中 · 已放 0 颗豆');
  });

  test('切 tab：destroy 强制落盘（不等防抖）、切回恢复', async ({ page }) => {
    await setup(page);
    await page.locator('.pd-board .pd-cell').nth(20).click();

    // 点击切走后立刻读库：同步强制落盘，400ms 防抖来不及触发
    await page.locator('#gamesTab-2048').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('youxi_pindou_v1') || 'null'));
    expect(saved).not.toBeNull();
    expect(saved.board.filter(Boolean)).toEqual(['coral']);

    // 切回拼豆：从存档恢复
    await page.locator('#gamesTab-pindou').click();
    await expect(page.locator('#gamesStage .games-hud')).toHaveText('已恢复你上次的作品，继续拼吧');
    expect((await boardOf(page))[20]).toBe('coral');
  });
});
