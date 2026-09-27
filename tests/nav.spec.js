// ============ 导航滚动收起 / 唤出（js/main.js 的导航模块 + components/nav-glass.css） ============
// 守住五条主线：
//   1) 页首附近（scrollY ≤ 40）永不收起，滚回页首是唤出路径之一；
//   2) 向下滚动后收起，且收起是「移出视口」而不是隐藏 —— 元素必须留在 tab 序与可访问性树里，
//      否则键盘用户滚到下方后按 Tab 会把焦点送进看不见的地方；
//   3) 鼠标设备上唤出的唯一入口是「光标进入顶部热区」，且该热区必须覆盖导航自身底边：
//      否则鼠标从唤出位置下移到链接上时会半路离开热区、导航在指针底下消失，链接点不到；
//   4) 键盘焦点进入导航即唤出；移动端菜单展开期间不得收起（菜单是独立浮层，见 nav-mobile.css）；
//   5) prefers-reduced-motion 只去掉过渡（运动），不去掉收起/唤出本身（功能）。
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

// 读导航的真实状态。
// 位置是唯一可信的「是否在屏幕上」判据：Playwright 的 toBeVisible() 只看 bbox 是否非空，
// 被 transform 推出视口的元素在它眼里照样算「可见」。
// restingTop 取 getComputedStyle().top（不含 transform），即导航完全到位时的 top 值。
const navState = (page) => page.evaluate(() => {
  const el = document.querySelector('.glass-nav');
  if (!el) throw new Error('缺少 .glass-nav');
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    hidden: el.classList.contains('is-hidden'),
    scrolled: el.classList.contains('scrolled'),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    restingTop: parseFloat(cs.top),
    transitionDuration: cs.transitionDuration,
    visibility: cs.visibility,
    rendered: cs.display !== 'none',
  };
});

// 位移带 .4s（唤出）/.3s（收起）过渡：类名先落、位置后到，几何断言必须轮询等待。
// 收起态的底边落在 -12px（见 nav-glass.css 的位移公式），所以「退净」等价于 bottom ≤ 0。
const expectOffScreen = (page) => expect.poll(async () => (await navState(page)).bottom)
  .toBeLessThanOrEqual(0);
// 唤出态 top 必须回到静止值 —— 用相对值而不是写死 18px，导航改偏移量时不用同步改测试。
const expectOnScreen = (page) => expect.poll(async () => {
  const s = await navState(page);
  return s.top - s.restingTop;
}).toBeGreaterThanOrEqual(0);

// 光标移到底部：鼠标设备下「光标不在顶部热区」是允许收起的前提条件。
async function moveAwayFromTop(page) {
  const vp = page.viewportSize();
  await page.mouse.move(Math.round(vp.width / 2), vp.height - 40);
}
// 光标进入视口顶部热区（导航带）
async function moveToTopZone(page, y = 12) {
  const vp = page.viewportSize();
  await page.mouse.move(Math.round(vp.width / 2), y);
}
// 真实滚轮而不是 window.scrollTo：Lenis 虚拟滚动与 scroll 事件的真实路径都要覆盖。
// 先把光标放回视口中间，避免落入顶部热区而让鼠标设备拒绝收起。
// 必须等 Lenis 的平滑滚动彻底停下再返回：它还在动画中时会继续朝目标滚，
// 后续测试里的 window.scrollTo 会被立刻拖回原处（实测 900 → 20 直接失效）。
async function wheelDown(page, px) {
  const vp = page.viewportSize();
  await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
  await page.mouse.wheel(0, px);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  let prev = -1;
  await expect.poll(async () => {
    const y = await page.evaluate(() => window.scrollY);
    const settled = y === prev;
    prev = y;
    return settled;
  }).toBe(true);
}

test.describe('导航滚动收起 / 唤出', () => {
  test('首屏不收起，且滚动不足 40px 时仍可见', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('index.html');

    const initial = await navState(page);
    expect(initial.hidden).toBe(false);
    expect(initial.scrolled).toBe(false);

    // 光标特意停在底部：可见性只能来自「滚动距离不足」，而不是「光标恰好在顶部热区」
    await moveAwayFromTop(page);
    await page.evaluate(() => window.scrollTo(0, 20));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(20);
    await page.waitForTimeout(400);

    const s = await navState(page);
    expect(s.hidden).toBe(false);
    expect(s.scrolled).toBe(false);
    expect(s.top).toBeGreaterThanOrEqual(s.restingTop);
  });

  test('向下滚动后收起，鼠标回到顶部热区才唤出', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('index.html');

    await wheelDown(page, 900);
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);
    // .scrolled 是本次改造之前就有的行为，一并守住
    expect((await navState(page)).scrolled).toBe(true);
    await expectOffScreen(page);

    // 鼠标设备上唤出的入口：光标进入顶部热区
    await moveToTopZone(page);
    await expect(page.locator('.glass-nav')).not.toHaveClass(/is-hidden/);
    await expectOnScreen(page);

    // 光标再离开热区 → 重新收起（此时仍在页首之外）
    await moveAwayFromTop(page);
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);
    await expectOffScreen(page);
  });

  test('鼠标从唤出位置下移到导航带上仍保持可见，且该点真的能命中导航', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('index.html');
    await wheelDown(page, 900);
    await moveToTopZone(page);
    await expectOnScreen(page);

    // 导航自身的垂直中心：这是「从顶部热区下移到链接上」的必经位置。
    // 热区下沿若被写成小于导航底边的值，这里就会中途收起 —— 断言即护栏。
    const box = await page.locator('.glass-nav').boundingBox();
    const s = await navState(page);
    const cx = Math.round(box.x + box.width / 2);
    const cy = s.top + Math.round(box.height / 2);
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(400); // 留出「若会收起」的过渡时间，避免假通过

    const after = await navState(page);
    expect(after.hidden).toBe(false);
    expect(after.top).toBeGreaterThanOrEqual(after.restingTop);

    const hitInNav = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return !!(el && el.closest('.glass-nav'));
    }, [cx, cy]);
    expect(hitInNav).toBe(true);
  });

  test('滚回页首后即使光标不在顶部热区也可见', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('index.html');
    await wheelDown(page, 900);
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);

    await moveAwayFromTop(page); // 光标保持在底部
    await page.evaluate(() => window.scrollTo(0, 20));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(20);

    await expect(page.locator('.glass-nav')).not.toHaveClass(/is-hidden/);
    await expectOnScreen(page);
    expect((await navState(page)).scrolled).toBe(false);
  });

  test('键盘焦点进入导航即唤出（收起态不得把导航移出 tab 序与可访问性树）', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('index.html');
    await wheelDown(page, 900);
    await moveAwayFromTop(page);
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);

    // 收起只做 transform 位移：display / visibility 都不能被改，
    // 否则键盘用户滚到下方后按 Tab 会把焦点送进看不见的地方（且 :focus-within 也永不触发）
    const s = await navState(page);
    expect(s.rendered).toBe(true);
    expect(s.visibility).toBe('visible');

    await page.keyboard.press('Tab'); // DOM 中首个可聚焦元素就是导航里的 .brand
    const focused = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? { inNav: !!a.closest('.glass-nav'), cls: a.className } : null;
    });
    expect(focused).not.toBeNull();
    expect(focused.inNav).toBe(true);
    // 触发唤出的必须真是焦点，而不是焦点导致的页面回滚
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(40);

    await expect(page.locator('.glass-nav')).not.toHaveClass(/is-hidden/);
    await expectOnScreen(page);
  });

  test('移动端菜单展开期间不收起', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('index.html');
    await wheelDown(page, 600);
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);

    await moveToTopZone(page); // 先唤出，才点得到汉堡按钮
    await expect(page.locator('.glass-nav')).not.toHaveClass(/is-hidden/);

    await page.locator('#hamburger').click();
    await expect(page.locator('.nav-links')).toHaveClass(/open/);

    // 收起的两个条件都已满足（滚动 > 40 且光标已离开热区），但菜单开着就必须保持可见
    await moveAwayFromTop(page);
    await page.waitForTimeout(400);
    expect((await navState(page)).hidden).toBe(false);

    // 菜单关掉后，收起条件重新生效
    await page.locator('#hamburger').click();
    await expect(page.locator('.nav-links')).not.toHaveClass(/open/);
    await moveAwayFromTop(page); // click 会把光标移到按钮上（落在热区内），先移开
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);
    await expectOffScreen(page);
  });

  test('prefers-reduced-motion：去掉过渡但保留收起 / 唤出', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('index.html');

    await wheelDown(page, 900);
    await expect(page.locator('.glass-nav')).toHaveClass(/is-hidden/);
    // 最容易漏的是 .is-hidden 这一档：它的特异性 (0,2,0) 高于 perf.css 里的 .glass-nav，
    // 所以降级档必须把两个选择器都写上，否则收起仍会带 .2s 过渡
    expect((await navState(page)).transitionDuration).toBe('0s');
    await expectOffScreen(page);

    await moveToTopZone(page);
    await expect(page.locator('.glass-nav')).not.toHaveClass(/is-hidden/);
    expect((await navState(page)).transitionDuration).toBe('0s');
    await expectOnScreen(page);
  });
});
