// ============ 笔记详情页功能验证（note.html?id=<id>） ============
// 覆盖 js/note.js 的四条路径与 notes.js 的新分流：
//   正常渲染（真实 fetch + marked + DOMPurify） / 空态（坏 id、无 id）
//   fetch 失败兜底 / marked 缺失降级为纯文本 / DOMPurify 消毒
//   笔记本页点击带 content 的便签 → 跳转详情页（content > link > 弹窗）
const { test, expect } = require('@playwright/test');

const N6_TITLE = 'AI 工具平台调研';
// 调研报告正文的结构特征：六个章节 H2、多张 GFM 表格、三条流水线代码块
const N6_H2 = ['一、游戏开发类 AI 平台', '二、视频制作类 AI 平台', '三、语音 / 音频类 AI 平台', '四、查资料 / 研究类 AI 平台', '五、不同平台之间的组合（重点）', '六、速查：每类「首选 + 平替」'];

test.describe('笔记详情页', () => {
  test('渲染内置笔记的 Markdown 正文', async ({ page }) => {
    await page.goto('note.html?id=n6');

    // 头部取自数据字段（正文首个 H1 已被剥离，页面只出现一次标题）
    await expect(page.locator('#noteTitle')).toHaveText(N6_TITLE);
    await expect(page.locator('#noteDate')).toContainText('2026-10-12');
    await expect(page).toHaveTitle(new RegExp(N6_TITLE));
    await expect(page.locator('#noteSource')).toBeHidden(); // n6 未配 link

    // 结构渲染：H2 章节齐全、表格与代码块进入 DOM、无脚本注入
    for (const h2 of N6_H2) {
      await expect(page.locator('#noteBody h2').filter({ hasText: h2 })).toHaveCount(1);
    }
    const counts = await page.locator('#noteBody').evaluate((el) => ({
      table: el.querySelectorAll('table').length,
      pre: el.querySelectorAll('pre').length,
      script: el.querySelectorAll('script').length,
    }));
    expect(counts.table).toBeGreaterThan(0);
    expect(counts.pre).toBeGreaterThan(0);
    expect(counts.script).toBe(0);

    // 正文 H1 已剥离：标题只在页面头部出现
    await expect(page.locator('#noteBody h1')).toHaveCount(0);
  });

  test('笔记本页点击带 content 的便签跳转详情页', async ({ page }) => {
    await page.goto('notes.html');
    const card = page.locator('.note-card').filter({ hasText: N6_TITLE });
    // 分流优先级：content 路径的标题是本站锚点（不带 target=_blank）
    const link = card.locator('.note-link');
    await expect(link).toHaveAttribute('href', 'note.html?id=n6');
    await expect(link).not.toHaveAttribute('target', '_blank');

    await card.click();
    await page.waitForURL(/note\.html\?id=n6$/);
    await expect(page.locator('#noteBody h2').first()).toBeVisible(); // 正文已渲染
  });

  test('坏 id 与无 id 显示空态', async ({ page }) => {
    for (const url of ['note.html?id=nope', 'note.html']) {
      await page.goto(url);
      await expect(page.locator('#noteEmpty')).toBeVisible();
      await expect(page.locator('#noteEmptyMsg')).toContainText('笔记不存在');
      await expect(page.locator('#noteBody')).toBeHidden();
      await expect(page.locator('#noteHead')).toBeHidden();
      // hidden 属性不能被 .note-toc{display:block} 覆盖：空态下不得出现空目录框
      await expect(page.locator('#noteToc')).toBeHidden();
    }
  });

  test('正文 fetch 失败兜底为加载失败空态', async ({ page }) => {
    await page.route('**/content/notes/ai-tools-survey.md', (route) => route.abort());
    await page.goto('note.html?id=n6');
    await expect(page.locator('#noteEmpty')).toBeVisible();
    await expect(page.locator('#noteEmptyMsg')).toContainText('加载失败');
    await expect(page.locator('#noteBody')).toBeHidden();
  });

  test('marked 缺失时降级为纯文本渲染', async ({ page }) => {
    // glob 尾部带 *：页面引用 vendor 脚本带 ?v= 缓存参数，不带会被 query 部分挡掉
    await page.route('**/js/vendor/marked.min.js*', (route) => route.abort());
    await page.goto('note.html?id=n6');
    // 降级容器按源文件形态呈现（pre-wrap），内容完整且未被解析成标签
    const plain = page.locator('#noteBody .note-plain');
    await expect(plain).toBeVisible();
    await expect(plain).toContainText('Meshy AI');
    await expect(page.locator('#noteBody table')).toHaveCount(0); // GFM 表格未解析
  });

  test('DOMPurify 消毒注入内容', async ({ page }) => {
    // 拦截 md 请求返回带 XSS 载荷的内容，验证渲染产物中脚本与事件属性被剥除
    const evil = '# 注入测试\n\n<script>window.__xss=1</script>\n\n<img src=x onerror="window.__xss=2">\n\n正文段落';
    await page.route('**/content/notes/ai-tools-survey.md', (route) => route.fulfill({
      status: 200,
      contentType: 'text/markdown; charset=utf-8',
      body: evil,
    }));
    await page.goto('note.html?id=n6');
    await expect(page.locator('#noteBody')).toContainText('正文段落');
    const xss = await page.evaluate(() => window.__xss || 0);
    expect(xss).toBe(0);
    const counts = await page.locator('#noteBody').evaluate((el) => ({
      script: el.querySelectorAll('script').length,
      onError: el.querySelectorAll('[onerror]').length,
    }));
    expect(counts.script).toBe(0);
    expect(counts.onError).toBe(0);
  });

  test('宽屏右侧目录生成、点击滚动与高亮', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('note.html?id=n6');
    await expect(page.locator('#noteToc')).toBeVisible();

    // 目录项与正文 h2/h3 一一对应（含三级缩进），且都在视口带内参与高亮
    const tocLinks = page.locator('#noteTocList a');
    const headings = page.locator('#noteBody h2, #noteBody h3');
    const tocCount = await tocLinks.count();
    expect(tocCount).toBe(await headings.count());
    expect(tocCount).toBeGreaterThan(5);

    // 初始高亮第一章
    await expect(tocLinks.first()).toHaveClass(/is-active/);

    // 点击最后一章：标题滚入视口且不被固定导航遮挡，目录高亮随之迁移
    const last = tocLinks.last();
    await last.click();
    await expect(last).toHaveClass(/is-active/);
    const pos = await headings.nth(tocCount - 1).evaluate((el) => ({
      top: el.getBoundingClientRect().top,
      scrolled: window.scrollY,
    }));
    expect(pos.scrolled).toBeGreaterThan(0);
    expect(pos.top).toBeGreaterThan(70); // glass-nav 高度以下

    // hash 同步到当前章节（replaceState，不产生历史记录）
    expect(new URL(page.url()).hash).toBe('#sec-' + (tocCount - 1));

    // 滚轮悬停目录可内部滚动（Lenis 由 data-lenis-prevent 放行，不得劫持去滚整页）。
    // 压低视口保证目录内容必然超高；内容完整可见时目录无需滚动，跳过该断言。
    await page.setViewportSize({ width: 1440, height: 700 });
    const toc = page.locator('#noteToc');
    const overflow = await toc.evaluate((el) => el.scrollHeight - el.clientHeight);
    if (overflow > 0) {
      await toc.hover();
      await page.mouse.wheel(0, 300);
      const inner = await toc.evaluate((el) => el.scrollTop);
      expect(inner).toBeGreaterThan(0); // 目录自身滚动了
    }
  });

  test('窄屏隐藏目录', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('note.html?id=n6');
    await expect(page.locator('#noteBody h2').first()).toBeVisible(); // 正文已渲染
    await expect(page.locator('#noteToc')).toBeHidden();
  });
});
