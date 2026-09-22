// ============ 外部 SDK 不可达时的降级验证 ============
// 背景：GSAP / ScrollTrigger / Lenis 本地化为 js/vendor/*.min.js。
// 文件损坏、被误删或部署漏传时同样是「全局变量不存在」——
// 原实现在 main.js 顶层直接 new Lenis(...)，抛错会导致整个 main.js 不执行，
// 且 .reveal 的 CSS 初始态（opacity:0）无人解除 —— 页面呈现为空白。
// 本用例拦截本地 vendor 的 SDK 请求，断言 7 个页面在无 SDK 时依然可见、可读。
const { test, expect } = require('@playwright/test');

const PAGES = [
  'index.html',
  'works.html',
  'photos.html',
  'about.html',
  'collect.html',
  'sites.html',
  'notes.html',
];

// 各页均存在的容器：section（index 的 #home、子页的 #works/#photos/...）
const ANCHOR = 'section';

// 拦截本地 vendor 的 SDK 请求，模拟「SDK 不可达」。
// 只拦三个动画 SDK，不拦 solarlunar —— 农历能力与动画降级互不影响。
const blockSdk = (page) => page.route(/\/js\/vendor\/(gsap|ScrollTrigger|lenis)\.min\.js/, (r) => r.abort());

test.describe('外部 SDK 不可达时的降级', () => {
  for (const page_ of PAGES) {
    test(`${page_} 在 SDK 被拦截时内容仍可见`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));

      // 拦截全部 SDK 请求，模拟本地文件缺失
      await blockSdk(page);

      await page.goto(page_);

      // 1) main.js 不得因 SDK 缺失而抛错
      expect(errors, `页面抛出未捕获错误：${errors.join(' | ')}`).toEqual([]);

      // 2) 必须打上降级标记
      await expect(page.locator('html')).toHaveClass(/no-gsap/);

      // 3) 入场初始态必须被还原，否则内容永久隐藏
      const reveal = page.locator('.reveal').first();
      if (await reveal.count()) {
        await expect(reveal).toHaveCSS('opacity', '1');
      }

      // 4) 标志性元素可见
      await expect(page.locator(ANCHOR).first()).toBeVisible();
    });
  }
});
