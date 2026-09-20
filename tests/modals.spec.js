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
    // 首页 .portal-side 有常驻装饰性浮动（floatY，且按设计在减少动态偏好下也保留），
    // 日历因此一直在缓慢位移，Playwright 的稳定性检查永远无法通过。
    // 这里只冻结这一处装饰动画，不绕过可点击性检查 —— 真被遮挡仍会失败。
    await page.addStyleTag({ content: '.portal-side { animation: none !important; }' });
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
