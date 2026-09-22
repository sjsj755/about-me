// ============ 笔记本页功能验证 ============
// 背景：notes.html 原先内联了 144 行脚本（与 js/notes.js 近乎重复），
// 且从未加载 js/notes.js / js/notes-data.js —— 正式模块一直是死代码。
// 本用例验证「去内联 + 接正式模块」后功能完好：渲染 / 新增 / 持久化 / 详情 / 删除。
const { test, expect } = require('@playwright/test');

const KEY = 'bijiben_notes_v1';
const BUILTIN_COUNT = 2;

// 打开「写笔记」弹窗并等自动聚焦落定：openAdd 里有 60ms 的 focus 定时器，
// 不等它结束就输入，会把后一个字段的内容敲进前一个字段（新增字段后必现）。
async function openAddForm(page) {
  await page.locator('#addBtn').click();
  await expect(page.locator('#fTitle')).toBeFocused();
}

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
    // 内置条目都带链接：标题渲染为真锚点；便签上不标来源（链接可能来自博客 / GitHub / 飞书）
    await expect(page.locator('.note-card .note-link')).toHaveCount(BUILTIN_COUNT);
    await expect(page.locator('.note-card .note-meta .note-src')).toHaveCount(0);
    // 2 张便签挂在同一根绳子上
    await expect(page.locator('.note-group')).toHaveCount(1);
    await expect(page.locator('.note-rope')).toHaveCount(1);
  });

  test('每 3 张便签一组，各自挂在同一根绳子上', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await openAddForm(page);
      await page.locator('#fTitle').fill(`分组笔记 ${i}`);
      await page.locator('#fDesc').fill('分组验证');
      await page.locator('#addForm button[type="submit"]').click();
    }
    // 2 内置 + 5 新增 = 7 张 → 3 组（3 / 3 / 1）
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT + 5);
    await expect(page.locator('.note-group')).toHaveCount(3);
    await expect(page.locator('.note-rope')).toHaveCount(3);
    await expect(page.locator('.note-group').nth(0).locator('.note-card')).toHaveCount(3);
    await expect(page.locator('.note-group').nth(1).locator('.note-card')).toHaveCount(3);
    await expect(page.locator('.note-group').nth(2).locator('.note-card')).toHaveCount(1);
  });

  test('带链接的便签点击后新窗口打开文档', async ({ page }) => {
    await page.context().route('**/*feishu*', (route) => route.abort()); // 拦截外部跳转，避免真实请求
    await openAddForm(page);
    await page.locator('#fTitle').fill('带链接的笔记');
    await page.locator('#fLink').fill('https://xxx.feishu.cn/docx/abc123');
    await page.locator('#fDesc').fill('点击应新开窗口。');
    await page.locator('#addForm button[type="submit"]').click();

    const card = page.locator('.note-card').first();
    const link = card.locator('.note-link');
    await expect(link).toHaveAttribute('href', 'https://xxx.feishu.cn/docx/abc123');
    await expect(link).toHaveAttribute('target', '_blank');

    const popup = page.waitForEvent('popup');
    await link.click();
    await popup; // 新窗口已创建即视为通过
  });

  test('便签按日期倒序排列，最新的在最上面', async ({ page }) => {
    // 表单只会盖当天日期，造不出历史日期，所以直接写 localStorage
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({
        items: [
          { id: 'u1', title: '最旧', desc: '旧', link: '', date: '2026-01-05', user: true },
          { id: 'u2', title: '最新', desc: '新', link: '', date: '2026-12-31', user: true },
          { id: 'u3', title: '居中', desc: '中', link: '', date: '2026-06-01', user: true },
        ],
      }));
    }, KEY);
    await page.reload();

    // 用户笔记的相对顺序（内置数据随时会增删改，不写进断言）
    const titles = await page.locator('.note-card .note-title').allTextContents();
    expect(titles.filter((t) => ['最新', '居中', '最旧'].includes(t))).toEqual(['最新', '居中', '最旧']);

    // 整墙（含内置条目）都必须日期倒序：与具体数据无关的硬性约束
    const dates = (await page.locator('.note-card .note-date').allTextContents()).map((t) => t.replace(/[^\d-]/g, ''));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('新增笔记并持久化', async ({ page }) => {
    await openAddForm(page);
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

  test('摘要字数受限，便签正面完整显示不被裁切', async ({ page }) => {
    await openAddForm(page);
    const desc = page.locator('#fDesc');
    const counter = page.locator('#fDescCount');

    // 上限落在输入侧：maxlength 是硬约束，计数器与它同源（不再是看不见的限制）
    await expect(desc).toHaveAttribute('maxlength', '60');
    await expect(counter).toHaveText('0 / 60');

    // 用真实输入路径（不是 fill 直接赋值），才会被 maxlength 截断
    await desc.click();
    await page.keyboard.insertText('字'.repeat(80));
    await expect(desc).toHaveValue('字'.repeat(60));
    await expect(counter).toHaveText('60 / 60');
    await expect(counter).toHaveClass(/is-full/);

    await page.locator('#fTitle').fill('字数约束');
    await page.locator('#addForm button[type="submit"]').click();

    // 写到上限的摘要，在便签上应一字不少地排进 3 行内（scrollHeight 不超过可视高度，容忍 1px 亚像素误差）
    const body = page.locator('.note-card').first().locator('.note-body');
    await expect(body).toHaveText('字'.repeat(60));
    expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);

    // 墙上所有摘要都不该出现省略号式的裁切 —— 这条同时盯着内置数据有没有配得过长
    const clipped = await page.locator('.note-body').evaluateAll(
      (els) => els.filter((el) => el.scrollHeight - el.clientHeight > 1).length,
    );
    expect(clipped).toBe(0);

    // 计数器随表单重置归零，不会把上一次的计数带进下一次编辑
    await openAddForm(page);
    await expect(counter).toHaveText('0 / 60');
    await expect(counter).not.toHaveClass(/is-full/);
  });

  test('无链接笔记点击打开详情弹窗与三种关闭方式', async ({ page }) => {
    // 内置条目都带链接（点击跳新窗口），所以先造一条无链接笔记来验证详情弹窗
    await openAddForm(page);
    await page.locator('#fTitle').fill('本地笔记');
    await page.locator('#fDesc').fill('没有链接，走详情弹窗。');
    await page.locator('#addForm button[type="submit"]').click();
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT + 1);

    // 点击卡片本体打开详情
    await page.locator('.note-card').first().click();
    await expect(page.locator('#detailModal')).toHaveClass(/open/);
    await expect(page.locator('#detailBody')).toContainText('本地笔记');

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
    await openAddForm(page);
    await page.locator('#fTitle').fill('待删除');
    await page.locator('#fDesc').fill('这条会被删掉。');
    await page.locator('#addForm button[type="submit"]').click();
    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT + 1);

    page.once('dialog', (d) => d.accept());
    await page.locator('.note-card').first().locator('.note-del').click();

    await expect(page.locator('.note-card')).toHaveCount(BUILTIN_COUNT);
  });
});
