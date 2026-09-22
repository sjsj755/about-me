// ============ 视觉基线（Phase B CSS 按页拆分的反向证明） ============
// 用途：拆分前后各跑一轮，像素级对比证明「视觉零变化」。
//   - 首次运行（无快照）：写入基线 —— 必须在拆分改动前执行；
//   - 拆分后重跑：逐像素对比，差异即失败，diff 图输出到 test-results/。
// 快照不入库（见 .gitignore）：基线只是迁移窗口内的一次性验收产物。
// 动态区域处理：时钟每秒刷新、鼓励语定时轮换、首页水波 canvas 跟随鼠标，
//   统一 mask 避免假差异；入场动画靠 settle() 的等待兜底。
const { test, expect } = require('@playwright/test');

const PAGES = ['index', 'works', 'collect', 'sites', 'notes', 'photos', 'about'];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
const DYNAMIC = '.clock, .encourage-bubble';

// 页面稳定化：网络空闲 → 滚到底触发 IntersectionObserver 懒加载 → 回顶 → 留出入场动画时间
async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
}

test.describe('视觉基线', () => {
  for (const vp of Object.keys(VIEWPORTS)) {
    for (const stem of PAGES) {
      test(`${stem} @ ${vp}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[vp]);
        await page.goto(`${stem}.html`);
        await settle(page);
        await expect(page).toHaveScreenshot(`${stem}-${vp}.png`, {
          fullPage: true,
          animations: 'disabled',
          mask: [page.locator(DYNAMIC)],
        });
      });
    }
  }

  test('index 日历弹窗 @ desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('index.html');
    await settle(page);
    await page.locator('.cal-day:not(.empty)').first().click();
    await expect(page.locator('#calModal')).toHaveClass(/open/);
    await page.waitForTimeout(400); // 弹窗过渡动画
    await expect(page).toHaveScreenshot('index-calModal-desktop.png', {
      animations: 'disabled',
      mask: [page.locator(DYNAMIC)],
    });
  });

  test('collect 详情弹窗 @ desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('collect.html');
    await settle(page);
    // 初始筛选为 book（collect.js 末尾 state.filter='book'），网格渲染的是 .book-card
    await page.locator('.book-card').first().click();
    await expect(page.locator('#detailModal')).toHaveClass(/open/);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('collect-detailModal-desktop.png', {
      animations: 'disabled',
    });
  });
});
