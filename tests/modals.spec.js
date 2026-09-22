// ============ 弹窗关闭途径验证 ============
// 背景：main.js 原有 4 个弹窗各写一套「× 按钮 + 遮罩点击 + Esc」绑定，
// 现已收口到 js/ui.js 的 openModal / closeModal / bindDismiss。
// 每个弹窗都要验证三条关闭途径，以及滚动锁成对（打开锁住、关闭还原）。
const { test, expect } = require('@playwright/test');

async function expectOpen(page, sel) {
  await expect(page.locator(sel)).toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
}
async function expectClosed(page, sel) {
  await expect(page.locator(sel)).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
}
// 遮罩点击：点弹窗根元素的左上角（内容居中，该点必落在遮罩上）
const clickMask = (page, sel) => page.locator(sel).click({ position: { x: 4, y: 4 } });

test.describe('弹窗关闭途径', () => {
  test('日历标记弹层：× / 遮罩 / Esc', async ({ page }) => {
    await page.goto('index.html');
    const sel = '#calModal';
    const open = async () => {
      await page.locator('.cal-day:not(.empty)').first().click();
      await expectOpen(page, sel);
    };

    await open();
    await page.locator('#calModalClose').click();
    await expectClosed(page, sel);

    await open();
    await clickMask(page, sel);
    await expectClosed(page, sel);

    await open();
    await page.keyboard.press('Escape');
    await expectClosed(page, sel);
  });

  test('日历标记：保存 → 持久化 → 刷新后仍渲染', async ({ page }) => {
    // Playwright 每测试都是全新 context（localStorage 初始为空），天然幂等；
    // 不能用 addInitScript 清键——它会在 reload 时把刚保存的标记一并清掉。
    await page.goto('index.html');

    // 真实点击日期格（不冻结任何动画：曾因 .blog-side 常驻浮动导致点击落点漂移、弹层打不开）
    await page.locator('.cal-day:not(.empty)').first().click();
    await expectOpen(page, '#calModal');

    await page.locator('#calModalText').fill('回归验证标记');
    await page.locator('#calModalSave').click();
    await expectClosed(page, '#calModal');

    // 保存后立即渲染色点
    await expect(page.locator('.cal-dot').first()).toBeVisible();

    // 标记必须"真正可辨"：格子带 has-mark 底纹，且圆点不得压在农历小字上
    // （曾因圆点定位在 bottom:6% 压住农历小字、外加白色光晕，看起来像污渍而"标记没显示"）
    const geo = await page.evaluate(() => {
      const cell = document.querySelector('.cal-day.has-mark');
      if (!cell) return { hasMark: false };
      const dot = cell.querySelector('.cal-dot');
      const lunar = cell.querySelector('.cal-lunar');
      const d = dot ? dot.getBoundingClientRect() : null;
      const l = lunar ? lunar.getBoundingClientRect() : null;
      const overlap = (d && l)
        ? !(d.right <= l.left || d.left >= l.right || d.bottom <= l.top || d.top >= l.bottom)
        : false;
      return { hasMark: true, dotSize: d ? d.width * d.height : 0, overlap };
    });
    expect(geo.hasMark).toBe(true);
    expect(geo.dotSize).toBeGreaterThan(0);
    expect(geo.overlap).toBe(false);

    // localStorage 已写入
    const ls = await page.evaluate(() => localStorage.getItem('calendar_marks_v1'));
    expect(ls).toContain('回归验证标记');

    // 刷新后标记仍渲染
    await page.reload();
    await expect(page.locator('.cal-dot').first()).toBeVisible();
  });

  test('联系表单弹窗：× / 遮罩 / Esc', async ({ page }) => {
    await page.goto('about.html');
    const sel = '#contactModal';
    const open = async () => {
      await page.locator('[data-action="contact"]').click();
      await expectOpen(page, sel);
    };

    await open();
    await page.locator('#contactModal [data-contact-close]').first().click();
    await expectClosed(page, sel);

    await open();
    await clickMask(page, sel);
    await expectClosed(page, sel);

    await open();
    await page.keyboard.press('Escape');
    await expectClosed(page, sel);
  });

  test('相片灯箱：× / 遮罩 / Esc，且左右键仍能翻页', async ({ page }) => {
    await page.goto('photos.html');
    const sel = '#photoLightbox';
    const open = async () => {
      await page.locator('#photosGrid .work-card').first().click();
      await expectOpen(page, sel);
    };

    await open();
    await page.locator('#plClose').click();
    await expectClosed(page, sel);

    await open();
    await clickMask(page, sel);
    await expectClosed(page, sel);

    await open();
    await page.keyboard.press('Escape');
    await expectClosed(page, sel);

    // 左右键是灯箱特有行为，收口关闭途径后必须仍然生效
    await open();
    const first = await page.locator('#plCount').textContent();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#plCount')).not.toHaveText(first);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#plCount')).toHaveText(first);
    await page.keyboard.press('Escape');
    await expectClosed(page, sel);
  });

  test('作品灯箱：× / 遮罩 / Esc', async ({ page }) => {
    await page.goto('works.html');
    const sel = '#lightbox';
    const open = async () => {
      await page.locator('#worksGrid .work-card').first().click();
      await expectOpen(page, sel);
    };

    await open();
    await page.locator('#lbClose').click();
    await expectClosed(page, sel);

    await open();
    await clickMask(page, sel);
    await expectClosed(page, sel);

    await open();
    await page.keyboard.press('Escape');
    await expectClosed(page, sel);
  });
});
