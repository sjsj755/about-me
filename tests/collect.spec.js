// ============ 芸香集页功能验证 ============
// 覆盖：默认书籍视图渲染与计数 / 主分类切换与取消（视图形态随之变化）/
//       子标签筛选 / 搜索过滤与空态恢复 / 详情灯箱三条关闭途径 + 滚动锁成对 / 收藏夹。
const { test, expect } = require('@playwright/test');

const GRID = '#collectGrid';
const CHIP = '#collectTags .filter-chip';

// 滚动锁：与 modals.spec.js 保持同一判据（内联样式，成对出现）
const locked = (page) => page.evaluate(() => document.body.style.overflow);
// 遮罩点击：点弹窗根元素左上角（内容居中，该点必落在遮罩上）
const clickMask = (page, sel) => page.locator(sel).click({ position: { x: 4, y: 4 } });

test.describe('芸香集页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('collect.html');
  });

  test('默认进入书籍视图：书卡、计数与子标签就位', async ({ page }) => {
    const total = await page.locator(`${GRID} .book-card`).count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator(GRID)).toHaveClass(/book-wall/);
    await expect(page.locator('#collectHint')).toContainText(`共 ${total} 条`);

    // 四个主分类 chips，当前分类高亮
    await expect(page.locator(CHIP)).toHaveCount(4);
    await expect(page.locator(`${CHIP}[data-cat="book"]`)).toHaveClass(/active/);
    // 分类激活时子标签行由该分类条目聚合而来
    expect(await page.locator('#subTagRow .filter-chip').count()).toBeGreaterThan(0);
  });

  test('主分类切换与取消：视图形态随分类变化', async ({ page }) => {
    // 切到「语句」→ 引语卡墙
    await page.locator(`${CHIP}[data-cat="quote"]`).click();
    await expect(page.locator(`${CHIP}[data-cat="quote"]`)).toHaveClass(/active/);
    await expect(page.locator(GRID)).toHaveClass(/quote-wall/);
    expect(await page.locator(`${GRID} .quote-card`).count()).toBeGreaterThan(0);

    // 切到「资料」→ 学术文献列表
    await page.locator(`${CHIP}[data-cat="note"]`).click();
    await expect(page.locator(GRID)).toHaveClass(/acad-list/);
    expect(await page.locator(`${GRID} .acad-item`).count()).toBeGreaterThan(0);

    // 再点当前分类 → 取消筛选：回到通用玻璃卡片墙，子标签行清空
    await page.locator(`${CHIP}[data-cat="note"]`).click();
    await expect(page.locator(`${CHIP}[data-cat="note"]`)).not.toHaveClass(/active/);
    await expect(page.locator(GRID)).not.toHaveClass(/acad-list|quote-wall|book-wall/);
    expect(await page.locator(`${GRID} .collect-card`).count()).toBeGreaterThan(0);
    await expect(page.locator('#subTagRow .filter-chip')).toHaveCount(0);
  });

  test('子标签筛选：点击进入、再点取消', async ({ page }) => {
    const total = await page.locator(`${GRID} .book-card`).count();
    // 「历史」只覆盖部分书籍条目，用它验证筛选真的收窄了结果集
    const tag = page.locator('#subTagRow .filter-chip[data-tag="历史"]');
    await expect(tag).toBeVisible();

    await tag.click();
    await expect(tag).toHaveClass(/active/);
    const filtered = await page.locator(`${GRID} .book-card`).count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);

    await tag.click();
    await expect(tag).not.toHaveClass(/active/);
    expect(await page.locator(`${GRID} .book-card`).count()).toBe(total);
  });

  test('搜索过滤与空态恢复', async ({ page }) => {
    const total = await page.locator(`${GRID} .book-card`).count();

    await page.locator('#collectSearch').fill('几何原本');
    const hit = await page.locator(`${GRID} .book-card`).count();
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(total);
    await expect(page.locator('#collectHint')).toContainText('搜索「几何原本」');

    await page.locator('#collectSearch').fill('zzz-not-a-book-zzz');
    await expect(page.locator(`${GRID} .book-card`)).toHaveCount(0);
    await expect(page.locator(`${GRID} .collect-empty`)).toBeVisible();

    await page.locator('#collectSearch').fill('');
    expect(await page.locator(`${GRID} .book-card`).count()).toBe(total);
  });

  test('详情灯箱：× / 遮罩 / Esc 三条关闭途径，滚动锁成对', async ({ page }) => {
    const card = page.locator(`${GRID} .book-card`).first();
    const modal = '#detailModal';
    const open = async () => {
      await card.click();
      await expect(page.locator(modal)).toHaveClass(/open/);
      expect(await locked(page)).toBe('hidden');
    };

    await open();
    await expect(page.locator('#detailBody .dt-title')).not.toBeEmpty();
    await page.locator('#detailModal [data-close="detailModal"]').click();
    await expect(page.locator(modal)).not.toHaveClass(/open/);
    expect(await locked(page)).toBe('');

    await open();
    await clickMask(page, modal);
    await expect(page.locator(modal)).not.toHaveClass(/open/);

    await open();
    await page.keyboard.press('Escape');
    await expect(page.locator(modal)).not.toHaveClass(/open/);
    expect(await locked(page)).toBe('');
  });

  test('收藏夹：星标收藏、跨刷新持久化、移出收藏', async ({ page }) => {
    const id = await page.locator(`${GRID} .book-card`).first().getAttribute('data-id');
    const star = page.locator(`${GRID} [data-id="${id}"] .cc-star`);

    await star.click();
    await expect(star).toHaveClass(/on/);
    await expect(star).toHaveText('★');

    // 收藏写入 localStorage，刷新后仍在
    await page.reload();
    await expect(page.locator(`${GRID} [data-id="${id}"] .cc-star`)).toHaveClass(/on/);

    await page.locator('#favBtn').click();
    await expect(page.locator('#favModal')).toHaveClass(/open/);
    await expect(page.locator('#favSub')).toContainText('已收藏 1 条');
    await expect(page.locator('#favList .cm-fav-row')).toHaveCount(1);

    await page.locator('#favList .cm-fav-del').click();
    await expect(page.locator('#favSub')).toContainText('还没有收藏');
    await expect(page.locator('#favList .cm-fav-row')).toHaveCount(0);
    await expect(page.locator(`${GRID} [data-id="${id}"] .cc-star`)).not.toHaveClass(/on/);
  });
});
