// ============ 笔记本页功能验证 ============
// 背景：notes.html 原先内联了 144 行脚本（与 js/notes.js 近乎重复），
// 且从未加载 js/notes.js / js/notes-data.js —— 正式模块一直是死代码。
// 本用例验证「去内联 + 接正式模块」后功能完好：渲染 / 新增 / 持久化 / 详情 / 删除。
const { test, expect } = require('@playwright/test');

const KEY = 'bijiben_notes_v1';
const BUILTIN_COUNT = 2;

test.describe('笔记本页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('notes.html');
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    await page.reload();
  });

  test('渲染内置笔记', async ({ page }) => {
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT);
    await expect(page.locator('.note-card .note-del')).toHaveCount(0); // 内置条目不可删除
    await expect(page.locator('#notesHint')).toContainText(`${BUILTIN_COUNT} 篇`);
  });

  test('新增笔记并持久化', async ({ page }) => {
    await page.locator('#addBtn').click();
    await expect(page.locator('#addModal')).toHaveClass(/open/);

    await page.locator('#fTitle').fill('grid 断点测试');
    await page.locator('#fDesc').fill('验证新增、保存与刷新后仍在。');
    await page.locator('#addForm button[type="submit"]').click();

    await expect(page.locator('#addModal')).not.toHaveClass(/open/);
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT + 1);
    await expect(page.locator('.note-card').first()).toContainText('grid 断点测试');

    // 持久化：刷新后仍在
    await page.reload();
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT + 1);
    await expect(page.locator('.note-card').first()).toContainText('grid 断点测试');
  });

  test('详情弹窗与三种关闭方式', async ({ page }) => {
    // 点击卡片本体打开详情
    await page.locator('.note-card').first().click();
    await expect(page.locator('#detailModal')).toHaveClass(/open/);
    await expect(page.locator('#detailBody')).toContainText('flex 与 grid 的取舍');

    // Esc 关闭
    await page.keyboard.press('Escape');
    await expect(page.locator('#detailModal')).not.toHaveClass(/open/);

    // × 关闭
    await page.locator('.note-card').first().click();
    await expect(page.locator('#detailModal')).toHaveClass(/open/);
    await page.locator('#detailModal [data-close]').click();
    await expect(page.locator('#detailModal')).not.toHaveClass(/open/);

    // 遮罩关闭
    await page.locator('.note-card').first().click();
    await expect(page.locator('#detailModal')).toHaveClass(/open/);
    await page.locator('#detailModal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#detailModal')).not.toHaveClass(/open/);
  });

  test('删除用户笔记', async ({ page }) => {
    await page.locator('#addBtn').click();
    await page.locator('#fTitle').fill('待删除');
    await page.locator('#fDesc').fill('这条会被删掉。');
    await page.locator('#addForm button[type="submit"]').click();
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT + 1);

    page.once('dialog', (d) => d.accept());
    await page.locator('.note-card').first().locator('.note-del').click();

    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT);
  });
});
