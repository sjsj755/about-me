// ============ 站点集页功能验证 ============
// 覆盖：数据渲染 / 分类筛选（进入与取消）/ 搜索过滤与清空 / 空结果提示。
const { test, expect } = require('@playwright/test');

const CARD = '#siteGrid .site-card';

test.describe('站点集页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('sites.html');
  });

  test('渲染站点卡片与分类计数', async ({ page }) => {
    const total = await page.locator(CARD).count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('#siteHint')).toContainText(`${total} 个站点`);
    expect(await page.locator('#siteTags .filter-chip').count()).toBeGreaterThan(1);
  });

  test('分类筛选：点击进入、再点取消', async ({ page }) => {
    const total = await page.locator(CARD).count();
    const chip = page.locator('#siteTags .filter-chip').first();
    const cat = await chip.getAttribute('data-cat');

    await chip.click();
    await expect(chip).toHaveClass(/active/);
    const filtered = await page.locator(CARD).count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    // 筛出来的卡片必须都属于该分类（分类名渲染在卡片脚部的标签里）
    await expect(page.locator(`${CARD} .cc-tag`).first()).toHaveClass(new RegExp(`cat-${cat}`));

    await chip.click();
    await expect(chip).not.toHaveClass(/active/);
    expect(await page.locator(CARD).count()).toBe(total);
  });

  test('搜索过滤与清空', async ({ page }) => {
    const total = await page.locator(CARD).count();
    const domain = (await page.locator(`${CARD} .site-domain`).first().textContent()).trim();

    await page.locator('#siteSearch').fill(domain);
    const hit = await page.locator(CARD).count();
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThanOrEqual(total);
    await expect(page.locator('#siteHint')).toContainText(`搜索「${domain}」`);

    // 无结果：出现空态且卡片清空
    await page.locator('#siteSearch').fill('zzz-not-a-site-zzz');
    await expect(page.locator(CARD)).toHaveCount(0);
    await expect(page.locator('#siteGrid .collect-empty')).toBeVisible();

    await page.locator('#siteSearch').fill('');
    expect(await page.locator(CARD).count()).toBe(total);
  });
});
