// ============ 首页轮播横幅（js/blog-carousel.js） ============
// 守住三条主线：
//   1) 自动切帧在任何动画偏好下都照常进行。这里曾写成「prefers-reduced-motion 不自动播」，
//      结果是系统开了「减少动画」的访客永远只看到第一张图 —— 那是功能缺失，不是降级；
//   2) 该偏好只去掉淡入：home.css 把 .carousel-slide 的 transition 置为 none，computed 必须是 0s。
//      反过来，默认偏好下淡入必须还在，防止有人「顺手」把过渡一起删掉；
//   3) 悬停暂停 / 移出恢复仍然有效（本次改动没碰它，钉住避免以后误伤）。
// 为什么这个缺陷长期没被任何测试发现：Playwright 的 reducedMotion 默认是 no-preference，
//   整个用例集里轮播一直是「照常自动播」，问题只在真实访客环境下暴露。
//   本文件第一例显式 emulateMedia 成 reduce，才走得到那条分支。
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1440, height: 900 };

// 自动切帧间隔是 js/blog-carousel.js 的 INTERVAL（当前 5000ms）。
// 「会切帧」一律用轮询到变化来断言，不睡固定时长：不受机器快慢影响。
// 轮询上限取得远大于 INTERVAL，既能容纳慢机，也不至于把间隔写死 ——
// 将来把 INTERVAL 调到 15s 时，只需保证它仍小于这个上限即可。
const INTERVAL_BUDGET = 20000;

// 当前活动帧的下标；找不到 .is-active 时返回 -1（不抛错，交给断言判定）
const activeSlide = (page) => page.evaluate(() =>
  Array.prototype.slice.call(document.querySelectorAll('.carousel-slide'))
    .findIndex((el) => el.classList.contains('is-active')));

// 单张幻灯片的过渡时长：reduce 档应为 '0s'（运动被去掉），默认档应非 0（淡入仍在）
const slideTransitionDuration = (page) => page.evaluate(() => {
  const el = document.querySelector('.carousel-slide');
  if (!el) throw new Error('缺少 .carousel-slide');
  return getComputedStyle(el).transitionDuration;
});

test.describe('首页轮播：自动切帧与动画偏好', () => {
  test('prefers-reduced-motion: reduce —— 仍自动切帧，但不带淡入', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('index.html');

    // 帧确实在前进（第 1 帧 → 其它帧）
    await expect.poll(() => activeSlide(page), { timeout: INTERVAL_BUDGET })
      .toBeGreaterThan(0);
    // 运动确实被去掉：过渡为 0s（home.css 的 reduce 降级档），
    // 因此切帧是硬切、零动画 —— 既保住功能，又不违背「减少动画」的诉求
    expect(await slideTransitionDuration(page)).toBe('0s');
  });

  test('默认偏好 —— 自动切帧照常，且淡入仍在', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // 刻意不 emulateMedia：Playwright 默认即 no-preference，与绝大多数访客一致
    await page.goto('index.html');

    // 只断言「不是 0s」而不是写死 0.8s：淡入时长归 home.css 的 .carousel-slide 管，
    // 这里守的是「过渡没被一起删掉」这条契约，不替样式文件定值
    expect(await slideTransitionDuration(page)).not.toBe('0s');
    await expect.poll(() => activeSlide(page), { timeout: INTERVAL_BUDGET })
      .toBeGreaterThan(0);
  });

  test('悬停暂停 / 移出恢复', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('index.html');
    const vp = page.viewportSize();

    // 先把光标移到页面底部，再移入轮播：浏览器初始光标位置就在 (0,0)，
    // 而 (0,0) 落在轮播范围内 —— 不先移开的话，「是否有 mouseenter」会依赖
    // 浏览器对初始悬停节点的内部状态，结果不确定
    await page.mouse.move(5, vp.height - 5);
    await page.waitForTimeout(100);
    await page.locator('#blogCarousel').hover(); // mouseenter → stop()

    // 必须睡够一个完整周期才能证明「确实没动」—— 这是本文件唯一的固定等待。
    // 换用轮询是无效的：轮询只能证伪「动了」，证明「没动」只能靠等过一个周期。
    const paused = await activeSlide(page);
    await page.waitForTimeout(6500); // > INTERVAL(5000ms)，跨过一个切帧时刻
    expect(await activeSlide(page)).toBe(paused);

    // 移出后恢复：mouseleave → start()，下个周期内必须前进
    await page.mouse.move(5, vp.height - 5);
    await expect.poll(() => activeSlide(page), { timeout: INTERVAL_BUDGET })
      .not.toBe(paused);
  });
});
