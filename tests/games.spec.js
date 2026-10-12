// ============ 游戏室 · 架子可用性（反向证明） ============
// 本用例不依赖任何真实游戏：用 route 覆盖 js/games-data.js 注入假清单与假实现，
// 验证「清单 → 切换条 → 舞台挂载/销毁 → ctx 能力」整条链路。
//
// 为什么覆盖数据文件而不是 page.addInitScript：
//   games-data.js 在页面脚本阶段执行 `window.GAMES = []`，提前注入的清单会被它覆盖；
//   替换这个文件才是「换数据」的真接缝（它也是加游戏时唯一要改的数据文件）。
//
// 假实现在页面里挂 window.__probe，用来从页面外观测 mount / destroy / 按键 / 滑动次数。
const { test, expect } = require('@playwright/test');

const DATA_GLOB = '**/js/games-data.js*';

const TWO_GAMES = [
  { id: 'a', name: 'A 游戏', tag: '经典', desc: 'A 的说明' },
  { id: 'b', name: 'B 游戏' },
];

const PROBE_SRC = 'window.__probe = { mounted: [], destroyed: [], keys: [], swipes: [], bestA: null, idA: null };';

// 假实现：a 用满 ctx 的全部能力并回报给 __probe；b 只回报 mount / destroy。
// 注意这段是「将要跑在页面里的源码字符串」，其中的 ${} 不会被本文件插值。
const RUNNERS_SRC = `{
  a: {
    mount(ctx) {
      window.__probe.mounted.push('a');
      window.__probe.idA = ctx.id;
      ctx.hud('A 已就绪');
      ctx.onKey({ ArrowLeft: function () { window.__probe.keys.push('left'); } });
      ctx.onSwipe(function (d) { window.__probe.swipes.push(d); });
      ctx.best.set(42);
      window.__probe.bestA = ctx.best.get();
      return function destroy() { window.__probe.destroyed.push('a'); };
    }
  },
  b: {
    mount(ctx) {
      window.__probe.mounted.push('b');
      return function destroy() { window.__probe.destroyed.push('b'); };
    }
  }
}`;

// 只有 a 的实现：用来验证「数据先行、实现后补」时的未实现态
const RUNNERS_A_ONLY_SRC = `{
  a: {
    mount(ctx) {
      window.__probe.mounted.push('a');
      return function destroy() { window.__probe.destroyed.push('a'); };
    }
  }
}`;

// 假实现挂载时主动抛错：验证「打不开」态不会连累其它 tab
const RUNNERS_THROW_SRC = `{
  a: { mount() { throw new Error('boom'); } },
  b: {
    mount(ctx) {
      window.__probe.mounted.push('b');
      return function destroy() { window.__probe.destroyed.push('b'); };
    }
  }
}`;

// 用假数据替换数据文件（runners 为 null 表示「有清单、无实现」）
function stubData(page, games, runners) {
  return page.route(DATA_GLOB, (route) => route.fulfill({
    contentType: 'application/javascript; charset=utf-8',
    body: PROBE_SRC + '\nwindow.GAMES = ' + JSON.stringify(games) + ';\n'
      + 'window.GAME_RUNNERS = ' + (runners === null ? '{}' : runners) + ';\n',
  }));
}

// 合成一次滑动：pointerdown / pointerup 都派发在舞台上（冒泡到 window，正是 ctx.onSwipe 的监听位置）
function swipe(page, fromX, fromY, toX, toY) {
  return page.evaluate((p) => {
    const stage = document.getElementById('gamesStage');
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true };
    const mk = (type, x, y) => new PointerEvent(type, Object.assign({}, base, { clientX: x, clientY: y }));
    stage.dispatchEvent(mk('pointerdown', p.fromX, p.fromY));
    stage.dispatchEvent(mk('pointerup', p.toX, p.toY));
  }, { fromX, fromY, toX, toY });
}

test.describe('游戏室 · 架子', () => {
  test('清单为空：切换条隐藏、舞台显示空态、页面正常', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('games.html');

    await expect(page.locator('#games')).toBeVisible();
    await expect(page.locator('#gamesTabs')).toBeHidden();
    await expect(page.locator('#gamesStage .games-empty-title')).toHaveText('游戏室正在布置');
    expect(errors).toEqual([]);
  });

  test('有清单：渲染 tab、默认激活第 1 个、ARIA 与说明行正确', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    const tabs = page.locator('#gamesTabs [role="tab"]');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText('经典A 游戏'); // tag 小标签 + 名称
    await expect(tabs.nth(1)).toHaveText('B 游戏');

    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(0)).toHaveAttribute('tabindex', '0');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#gamesStage')).toHaveAttribute('aria-labelledby', 'gamesTab-a');
    await expect(page.locator('#gamesHint')).toHaveText('A 的说明');

    expect(await page.evaluate(() => window.__probe.mounted)).toEqual(['a']);
    expect(await page.evaluate(() => window.__probe.idA)).toBe('a');
  });

  test('ctx.hud：写入舞台状态行', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    const hud = page.locator('#gamesStage .games-hud');
    await expect(hud).toHaveText('A 已就绪');
    await expect(hud).toHaveAttribute('aria-live', 'polite');
  });

  test('切换 tab：旧的 destroy、新的 mount，舞台无残留 DOM', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    await page.locator('#gamesTab-b').click();

    expect(await page.evaluate(() => window.__probe.destroyed)).toEqual(['a']);
    expect(await page.evaluate(() => window.__probe.mounted)).toEqual(['a', 'b']);
    await expect(page.locator('#gamesStage .games-mount')).toHaveCount(1);
    await expect(page.locator('#gamesStage .games-hud')).toHaveCount(1);
    await expect(page.locator('#gamesTab-b')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamesTab-a')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#gamesStage')).toHaveAttribute('aria-labelledby', 'gamesTab-b');
  });

  test('左右方向键在 tab 间移动并激活', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    await page.locator('#gamesTab-a').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#gamesTab-b')).toBeFocused();
    await expect(page.locator('#gamesTab-b')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.__probe.mounted)).toEqual(['a', 'b']);

    // 循环回到第一个，且 tabindex 漫游态跟着走
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#gamesTab-a')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamesTab-b')).toHaveAttribute('tabindex', '-1');
  });

  test('ctx.onKey：只拦截已声明的键，切走后自动解绑', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    const hit = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      return { prevented: e.defaultPrevented, keys: window.__probe.keys.slice() };
    });
    expect(hit.prevented).toBe(true);
    expect(hit.keys).toEqual(['left']);

    // 未声明的键必须放行（不夺浏览器的默认行为）
    const miss = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(miss).toBe(false);

    await page.locator('#gamesTab-b').click(); // b 没有声明任何键
    const after = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      return { prevented: e.defaultPrevented, keys: window.__probe.keys.slice() };
    });
    expect(after.prevented).toBe(false);
    expect(after.keys).toEqual(['left']); // 没有新增：监听已解绑
  });

  test('ctx.onSwipe：左滑回调收到 left', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    await swipe(page, 260, 120, 140, 128); // dx = -120，主轴为横向
    expect(await page.evaluate(() => window.__probe.swipes)).toEqual(['left']);

    // 位移小于阈值（30px）不算滑动
    await swipe(page, 200, 120, 190, 118);
    expect(await page.evaluate(() => window.__probe.swipes)).toEqual(['left']);
  });

  test('ctx.best：写入后刷新页面仍在（youxi_best_<id>_v1）', async ({ page }) => {
    await stubData(page, TWO_GAMES, RUNNERS_SRC);
    await page.goto('games.html');

    expect(await page.evaluate(() => window.__probe.bestA)).toBe(42);
    expect(await page.evaluate(() => localStorage.getItem('youxi_best_a_v1'))).toBe('42');

    await page.reload();
    expect(await page.evaluate(() => window.__probe.bestA)).toBe(42);
  });

  test('有清单无实现：显示未实现态、不抛错、仍可切回', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await stubData(page, TWO_GAMES, RUNNERS_A_ONLY_SRC);
    await page.goto('games.html');

    await page.locator('#gamesTab-b').click();
    await expect(page.locator('#gamesStage .games-empty-title')).toHaveText('这个游戏还没做好');
    expect(await page.evaluate(() => window.__probe.destroyed)).toEqual(['a']);

    await page.locator('#gamesTab-a').click();
    await expect(page.locator('#gamesStage .games-mount')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('mount 抛错：显示打不开态、其它 tab 仍可切换', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await stubData(page, TWO_GAMES, RUNNERS_THROW_SRC);
    await page.goto('games.html');

    await expect(page.locator('#gamesStage .games-empty-title')).toHaveText('这个游戏暂时打不开');

    await page.locator('#gamesTab-b').click();
    await expect(page.locator('#gamesStage .games-mount')).toHaveCount(1);
    expect(await page.evaluate(() => window.__probe.mounted)).toEqual(['b']);
    expect(errors).toEqual([]);
  });
});
