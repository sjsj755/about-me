// ============ 首页外观调节（js/appearance.js）契约验证 ============
// 三条主线：
//   1) 默认状态必须与改造前逐像素等价（不调节 = 零变化）；
//   2) 覆盖模式真的把轮播变成全视口固定背景层，且内容让出导航净空；
//   3) 两个滑块只写 :root 变量、可键盘操作、能落盘并跨刷新保持。
// 另外守住「无闪烁」的结构前提：appearance.js 与它依赖的 ui.js 必须在 <head> 同步加载
// （若退回 defer，覆盖模式会先按横幅排一次版再跳一次）。
const { test, expect } = require('@playwright/test');

// 关闭面板时滚动锁必须成对还原（与 modals.spec.js 同一口径）
const expectOpen = async (page, sel) => {
  await expect(page.locator(sel)).toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
};
const expectClosed = async (page, sel) => {
  await expect(page.locator(sel)).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
};

// 当前生效的 CSS 变量 / 布局事实
const snapshot = (page) => page.evaluate(() => {
  const root = document.documentElement;
  const carousel = document.getElementById('blogCarousel');
  const wrap = document.querySelector('.blog-wrap');
  const panel = document.querySelector('.blog-profile');
  const rect = carousel.getBoundingClientRect();
  return {
    cover: root.classList.contains('app-cover'),
    bgOpacity: root.style.getPropertyValue('--bg-image-opacity'),
    glassAlpha: root.style.getPropertyValue('--glass-alpha'),
    position: getComputedStyle(carousel).position,
    carouselHeight: rect.height,
    carouselTop: rect.top,
    wrapPaddingTop: parseFloat(getComputedStyle(wrap).paddingTop),
    ariaHidden: carousel.getAttribute('aria-hidden'),
    panelBg: getComputedStyle(panel).backgroundColor,
  };
});

// 指示点只在多张轮播时才渲染（当前 CAROUSEL 仅 1 张），
// 所以「覆盖模式隐藏指示点」这条 CSS 契约用探针元素验证，而不是依赖现有 DOM。
const probeDotsDisplay = (page) => page.evaluate(() => {
  const carousel = document.getElementById('blogCarousel');
  const probe = document.createElement('div');
  probe.className = 'carousel-dots';
  carousel.appendChild(probe);
  const display = getComputedStyle(probe).display;
  probe.remove();
  return display;
});

test.describe('首页外观调节', () => {
  test('默认状态与改造前等价：横幅模式、变量取默认值', async ({ page }) => {
    await page.goto('index.html');
    const s = await snapshot(page);

    expect(s.cover).toBe(false);
    expect(s.position).toBe('relative');
    expect(s.wrapPaddingTop).toBe(34);        // 横幅在流内，内容只需 34px 间距
    expect(s.bgOpacity).toBe('1');
    expect(s.glassAlpha).toBe('0.5');
    // --glass-bg 的 alpha 由 --glass-alpha 派生，默认必须仍是改造前的 0.5
    expect(s.panelBg).toBe('rgba(220, 240, 248, 0.5)');
    expect(await probeDotsDisplay(page)).toBe('flex');
    // 无 localStorage 记录时不应写入任何键（apply 只读不写）
    expect(await page.evaluate(() => localStorage.getItem('appearance_v1'))).toBe(null);
  });

  test('面板贴着导航右缘弹出，遮罩不压暗不模糊（不被 .collect-modal 骨架接管）', async ({ page }) => {
    // 曾经的坑：home.css 在 manifest 里排在 collect-book.css 之前，
    // 单类名 .appearance-modal / .appearance-inner 会被 .collect-modal(-inner) 覆盖，
    // 结果遮罩保留 blur、面板被 flex 居中撑成 580px。这里把「必须覆盖成功」钉成契约。
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 面板有 .25s 的 scale 入场过渡（骨架的 .collect-modal:not(.open) 规则），
    // 量几何前必须等它落定，否则量到的是缩放过程中的中间值（320 × 0.9655 ≈ 308.9）
    await expect.poll(() => page.evaluate(() =>
      getComputedStyle(document.querySelector('.appearance-inner')).transform
    )).toBe('none');

    const r = await page.evaluate(() => {
      const modal = document.getElementById('appearanceModal');
      const inner = modal.querySelector('.appearance-inner');
      const nav = document.querySelector('.glass-nav');
      const m = getComputedStyle(modal);
      const i = getComputedStyle(inner);
      const box = inner.getBoundingClientRect();
      return {
        backdropFilter: m.backdropFilter,
        maskBg: m.backgroundColor,
        innerPosition: i.position,
        innerWidth: box.width,
        innerTop: box.top,
        innerRight: box.right,
        navRight: nav.getBoundingClientRect().right,
      };
    });

    expect(r.backdropFilter).toBe('none');          // 不模糊页面本身
    expect(r.maskBg).toBe('rgba(0, 0, 0, 0)');      // 不压暗页面本身
    expect(r.innerPosition).toBe('fixed');          // 贴视口，而不是被 flex 居中
    expect(r.innerWidth).toBe(320);                 // 320px 浮层，而不是骨架的 580px
    expect(Math.abs(r.innerTop - 84)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.innerRight - r.navRight)).toBeLessThanOrEqual(1); // 右缘与导航对齐
  });

  test('无闪烁前提：ui.js / appearance.js 在 head 同步加载', async ({ page }) => {
    await page.goto('index.html');
    const tags = await page.evaluate(() => {
      const pick = (name) => {
        const el = document.querySelector(`head script[src*="${name}"]`);
        return el
          ? { found: true, defer: el.hasAttribute('defer'), async: el.hasAttribute('async') }
          : { found: false };
      };
      return {
        ui: pick('ui.js'),
        appearance: pick('appearance.js'),
        inBody: !!document.querySelector('body script[src*="appearance.js"]'),
      };
    });
    expect(tags.ui).toEqual({ found: true, defer: false, async: false });
    expect(tags.appearance).toEqual({ found: true, defer: false, async: false });
    expect(tags.inBody).toBe(false);
  });

  test('切到覆盖模式：轮播变固定背景层、内容让出导航净空、指示点隐藏', async ({ page }) => {
    await page.goto('index.html');
    const viewport = page.viewportSize();

    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 打开后焦点落在第一个滑块上（键盘用户不必先 Tab 一圈）。
    // 必须是「同步」就位：.appearance-modal 把骨架的 visibility 过渡改成了打开即时生效
    // （若退回带过渡的写法，这里的 activeElement 会停在触发器上，键盘操作全部落空）。
    expect(await page.evaluate(() => document.activeElement.id)).toBe('appearanceBg');

    await page.locator('.appearance-mode[data-mode="cover"]').click();
    const s = await snapshot(page);

    expect(s.cover).toBe(true);
    expect(s.position).toBe('fixed');
    expect(s.carouselTop).toBe(0);
    expect(Math.abs(s.carouselHeight - viewport.height)).toBeLessThanOrEqual(1); // 铺满视口
    expect(s.wrapPaddingTop).toBe(96);        // 让出固定导航净空
    expect(s.ariaHidden).toBe('true');        // 纯装饰，对读屏隐藏
    expect(await probeDotsDisplay(page)).toBe('none');
    await expect(page.locator('.appearance-mode[data-mode="cover"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.appearance-mode[data-mode="banner"]')).toHaveAttribute('aria-pressed', 'false');

    // 落盘 + 关闭后滚动锁还原
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('appearance_v1')).mode)).toBe('cover');
    await page.keyboard.press('Escape');
    await expectClosed(page, '#appearanceModal');
  });

  test('覆盖模式跨刷新保持，且首帧前已生效（不出现先横幅后覆盖的跳变）', async ({ page }) => {
    // DOMContentLoaded 时记录一次类名：head 里的同步脚本若真的先于首帧执行，
    // 此刻 .app-cover 必须已经挂在 <html> 上
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        window.__clsAtReady = document.documentElement.className;
      }, { once: true });
    });
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await page.keyboard.press('Escape');
    await expectClosed(page, '#appearanceModal');

    await page.reload();
    const s = await snapshot(page);
    expect(s.cover).toBe(true);
    expect(s.position).toBe('fixed');
    expect(s.wrapPaddingTop).toBe(96);
    expect(await page.evaluate(() => window.__clsAtReady)).toContain('app-cover');
  });

  test('两个滑块：键盘可调、实时改 CSS 变量、松手落盘', async ({ page }) => {
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');

    // 背景透明度：Home → 0%，End → 100%
    await page.locator('#appearanceBg').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#appearanceBgVal')).toHaveText('0%');
    await expect(page.locator('#appearanceBg')).toHaveAttribute('aria-valuetext', '0%');
    expect((await snapshot(page)).bgOpacity).toBe('0');

    await page.keyboard.press('End');
    await expect(page.locator('#appearanceBgVal')).toHaveText('100%');
    expect((await snapshot(page)).bgOpacity).toBe('1');

    // 卡片透明度：Home → 下限 20%（再低正文对比度不达标），并即时反映到玻璃面
    await page.locator('#appearanceCard').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#appearanceCardVal')).toHaveText('20%');
    await expect(page.locator('#appearanceCard')).toHaveAttribute('aria-valuetext', '20%');
    let s = await snapshot(page);
    expect(s.glassAlpha).toBe('0.2');
    expect(s.panelBg).toBe('rgba(220, 240, 248, 0.2)');

    // 键盘连按 8 次上箭头 → 20% + 8×5% = 60%
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
    await expect(page.locator('#appearanceCardVal')).toHaveText('60%');
    expect((await snapshot(page)).glassAlpha).toBe('0.6');

    // change（松手 / 失焦）才落盘
    await page.locator('#appearanceCard').blur();
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('appearance_v1');
      return raw ? JSON.parse(raw).cardOpacity : null;
    })).toBe(0.6);
  });

  test('恢复默认：一键回到改造前外观', async ({ page }) => {
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await page.locator('#appearanceCard').focus();
    await page.keyboard.press('Home');
    await page.locator('#appearanceCard').blur();

    await page.locator('#appearanceReset').click();
    const s = await snapshot(page);
    expect(s.cover).toBe(false);
    expect(s.position).toBe('relative');
    expect(s.wrapPaddingTop).toBe(34);
    expect(s.bgOpacity).toBe('1');
    expect(s.glassAlpha).toBe('0.5');
    expect(s.panelBg).toBe('rgba(220, 240, 248, 0.5)');
    await expect(page.locator('#appearanceCardVal')).toHaveText('50%');
    await expect(page.locator('.appearance-mode[data-mode="banner"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('appearance_v1')))).toEqual({
      mode: 'banner', bgOpacity: 1, cardOpacity: 0.5,
    });
  });

  test('坏数据兜底：JSON 损坏回默认 / 数值越界夹取 / 非法字段回默认且不牵连合法字段', async ({ page }) => {
    await page.goto('index.html');

    // 1) JSON 损坏 → 整体回默认
    await page.evaluate(() => localStorage.setItem('appearance_v1', '{not json'));
    await page.reload();
    let s = await snapshot(page);
    expect(s.cover).toBe(false);
    expect(s.bgOpacity).toBe('1');
    expect(s.glassAlpha).toBe('0.5');

    // 2) 非法模式 + 越界数值 → 模式回默认；数值是「能解析成数字就夹取到区间端点」
    //    （只有 NaN / 非数字才走 fallback，所以这里不是回默认而是贴到上下限）
    await page.evaluate(() => localStorage.setItem(
      'appearance_v1', JSON.stringify({ mode: 'weird', bgOpacity: -2, cardOpacity: 99 })
    ));
    await page.reload();
    s = await snapshot(page);
    expect(s.cover).toBe(false);
    expect(s.bgOpacity).toBe('0');     // -2 夹到下限 0
    expect(s.glassAlpha).toBe('1');    // 99 夹到上限 1

    // 3) 非法数值 + 合法模式 → 数值回默认，合法字段不被牵连
    await page.evaluate(() => localStorage.setItem(
      'appearance_v1', JSON.stringify({ mode: 'cover', bgOpacity: 'abc', cardOpacity: null })
    ));
    await page.reload();
    s = await snapshot(page);
    expect(s.cover).toBe(true);        // 合法模式保留
    expect(s.bgOpacity).toBe('1');     // 'abc' → NaN → 回默认
    expect(s.glassAlpha).toBe('0.5');  // null → NaN → 回默认
  });

  test('遮罩点击关闭并归还焦点；窄屏下覆盖模式同样铺满视口', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('index.html');

    // 窄屏触发点在导航下拉菜单里，先展开菜单再点
    await page.locator('#hamburger').click();
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 面板打开时下拉菜单必须收起，否则两者叠在同一角
    await expect(page.locator('.nav-links')).not.toHaveClass(/open/);

    await page.locator('.appearance-mode[data-mode="cover"]').click();
    const s = await snapshot(page);
    expect(Math.abs(s.carouselHeight - 844)).toBeLessThanOrEqual(1);
    expect(s.wrapPaddingTop).toBe(96);

    // 透明遮罩点击（左上角）关闭，焦点回到触发器
    await page.locator('#appearanceModal').click({ position: { x: 4, y: 4 } });
    await expectClosed(page, '#appearanceModal');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('appearanceBtn');
  });

  test('其它页面不受影响：无触发器、变量取默认值', async ({ page }) => {
    await page.goto('works.html');
    expect(await page.locator('#appearanceBtn').count()).toBe(0);
    const r = await page.evaluate(() => ({
      cover: document.documentElement.classList.contains('app-cover'),
      navBg: getComputedStyle(document.querySelector('.glass-nav')).backgroundColor,
    }));
    expect(r.cover).toBe(false);
    expect(r.navBg).toBe('rgba(220, 240, 248, 0.5)');
  });
});
