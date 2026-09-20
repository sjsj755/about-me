// ============ SDK 适配层（js/fx.js）契约验证 ============
// 背景：gsap / ScrollTrigger / Lenis 全走 CDN，本机 jsdelivr 不可达，
// 真实页面在测试环境里永远走「能力缺失」分支 —— 「能力就位」分支会完全没被覆盖。
// 因此这里用 addInitScript 注入 SDK 替身并拦截 CDN，把两条分支都测到。
const { test, expect } = require('@playwright/test');

// SDK 替身：只记录被怎么调用，不做真实动画。
// 注意 tween 本身不执行，所以断言「调用了什么」，不断言元素最终样式。
const stubSdk = () => {
  const calls = { to: [], fromTo: [], ticker: 0, lenis: [], refresh: 0 };
  window.__calls = calls;
  window.gsap = {
    ticker: { add: () => { calls.ticker += 1; }, lagSmoothing: () => {} },
    utils: { toArray: (sel) => Array.from(document.querySelectorAll(sel)) },
    to: () => { calls.to.push(1); },
    fromTo: () => { calls.fromTo.push(1); },
  };
  window.ScrollTrigger = {
    update: () => {},
    refresh: () => { calls.refresh += 1; },
  };
  window.Lenis = class {
    constructor() { calls.lenis.push('new'); }
    on() {}
    raf() {}
    resize() { calls.lenis.push('resize'); }
    stop() { calls.lenis.push('stop'); }
    start() { calls.lenis.push('start'); }
    scrollTo() { calls.lenis.push('scrollTo'); }
  };
};

const blockCdn = (page) => page.route('**/*jsdelivr*/**', (r) => r.abort());

test.describe('FX 适配层', () => {
  test('能力缺失：打 no-gsap、不抛错、lockScroll 仍生效', async ({ page }) => {
    await blockCdn(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('notes.html');

    expect(errors).toEqual([]);
    await expect(page.locator('html')).toHaveClass(/no-gsap/);

    const r = await page.evaluate(() => {
      const out = { ready: FX.ready };
      FX.lockScroll();
      out.locked = document.body.style.overflow;
      FX.unlockScroll();
      out.unlocked = document.body.style.overflow;
      FX.to('.reveal', { opacity: 1 });
      FX.refresh();
      FX.scrollTo(document.body);
      out.lunar = FX.lunar.solar2lunar(2026, 1, 1);
      return out;
    });
    expect(r).toEqual({ ready: false, locked: 'hidden', unlocked: '', lunar: null });
  });

  test('能力就位：不打 no-gsap、动画与滚动全部委派给 SDK', async ({ page }) => {
    await blockCdn(page);
    await page.addInitScript(stubSdk);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('notes.html');

    expect(errors).toEqual([]);
    expect(await page.evaluate(() => FX.ready)).toBe(true);
    await expect(page.locator('html')).not.toHaveClass(/no-gsap/);

    const c = await page.evaluate(() => window.__calls);
    // 业务侧动画确实流到了 SDK：入场（.reveal）+ 笔记卡片入场
    expect(c.to.length).toBeGreaterThan(0);
    expect(c.fromTo.length).toBeGreaterThan(0);
    expect(c.ticker).toBeGreaterThan(0);
    expect(c.lenis).toContain('new');
    // main.js 的初始化刷新 + notes.js 渲染后的重测
    expect(c.refresh).toBeGreaterThan(0);
  });

  test('能力就位：锁滚动会同时暂停 Lenis，解锁会恢复', async ({ page }) => {
    await blockCdn(page);
    await page.addInitScript(stubSdk);
    await page.goto('notes.html');

    // 通过打开弹窗走真实调用链（notes.js → ui.js → FX）
    await page.locator('#addBtn').click();
    await expect(page.locator('#addModal')).toHaveClass(/open/);
    let c = await page.evaluate(() => window.__calls);
    expect(c.lenis).toContain('stop');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.locator('#addModal [data-close]').first().click();
    await expect(page.locator('#addModal')).not.toHaveClass(/open/);
    c = await page.evaluate(() => window.__calls);
    expect(c.lenis).toContain('start');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('bind3D 在无 SDK 时仍写入高光坐标，不抛错', async ({ page }) => {
    await blockCdn(page);
    await page.goto('notes.html');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.evaluate(() => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      FX.bind3D(el);
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 7, bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });
    expect(errors).toEqual([]);
  });
});
