// ============ 首页外观调节（js/appearance.js）契约验证 ============
// 四条主线：
//   1) 默认状态必须稳定（横幅模式 + 卡片透明度强制 0.5 + 首页卡片 4px 薄膜）；
//   2) 覆盖模式真的把轮播变成全视口固定背景层，且内容让出导航净空；
//   3) 两个滑块只写 :root 变量、可键盘操作、能落盘并跨刷新保持，且只在覆盖模式下提供；
//   4) 横幅模式一律按 BANNER_ALPHA 渲染，不读存储的 cardOpacity（见 appearance.js 文件头
//      「渲染契约」）—— 同时守住「首页卡片的少模糊不外溢到别页」这条范围契约。
// 另外守住「无闪烁」的结构前提：appearance.js 与它依赖的 ui.js 必须在 <head> 同步加载
// （若退回 defer，覆盖模式会先按横幅排一次版再跳一次）。
const { test, expect } = require('@playwright/test');

// 关闭面板时滚动锁必须成对还原（与 modals.spec.js 同一口径）
const expectOpen = async (page, sel) => {
  await expect(page.locator(sel)).toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
};
const expectClosed = async (page, sel) => {
  await expect(page.locator(sel)).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
};

// 当前生效的 CSS 变量 / 布局事实
const snapshot = (page) => page.evaluate(() => {
  const root = document.documentElement;
  const carousel = document.getElementById('blogCarousel');
  const wrap = document.querySelector('.blog-wrap');
  const panel = document.querySelector('.blog-profile');
  const rect = carousel.getBoundingClientRect();
  return {
    cover: root.classList.contains('app-cover'),
    bgOpacity: root.style.getPropertyValue('--bg-image-opacity'),
    glassAlpha: root.style.getPropertyValue('--glass-alpha'),
    position: getComputedStyle(carousel).position,
    carouselHeight: rect.height,
    carouselTop: rect.top,
    wrapPaddingTop: parseFloat(getComputedStyle(wrap).paddingTop),
    ariaHidden: carousel.getAttribute('aria-hidden'),
    panelBg: getComputedStyle(panel).backgroundColor,
  };
});

// 指示点只在多张轮播时才渲染（当前 CAROUSEL 仅 1 张），
// 所以「覆盖模式隐藏指示点」这条 CSS 契约用探针元素验证，而不是依赖现有 DOM。
const probeDotsDisplay = (page) => page.evaluate(() => {
  const carousel = document.getElementById('blogCarousel');
  const probe = document.createElement('div');
  probe.className = 'carousel-dots';
  carousel.appendChild(probe);
  const display = getComputedStyle(probe).display;
  probe.remove();
  return display;
});

// 读某个元素的 backdrop-filter 计算值（Chromium 归一化成 "blur(4px) saturate(150%)"）。
// 只取 blur 那一段做断言：本用例关心的是「卡片薄膜比导航更少模糊」这条范围契约，
// 不是 saturate 的具体数值。
const blurOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) throw new Error('选择器未命中：' + s);
  return getComputedStyle(el).backdropFilter;
}, sel);

test.describe('首页外观调节', () => {
  test('默认状态：横幅模式、卡片透明度强制 0.5、首页卡片模糊收到 4px', async ({ page }) => {
    await page.goto('index.html');
    const s = await snapshot(page);

    expect(s.cover).toBe(false);
    expect(s.position).toBe('relative');
    expect(s.wrapPaddingTop).toBe(34);        // 横幅在流内，内容只需 34px 间距
    expect(s.bgOpacity).toBe('1');
    // 横幅模式的渲染契约：一律用 BANNER_ALPHA = 0.5 渲染，不读存储的 cardOpacity
    //（默认是 0.7，见 js/appearance.js 的 CARD_DEFAULT）—— 见该文件头「渲染契约」。
    expect(s.glassAlpha).toBe('0.5');
    // --glass-bg 的 alpha 由 --glass-alpha 派生，横幅模式下必须仍是改造前的 0.5
    expect(s.panelBg).toBe('rgba(220, 240, 248, 0.5)');
    // 首页卡片薄膜：模糊走 --glass-blur-card（4px），导航仍走 --glass-blur（18px）。
    // 这条断言是「仅首页卡片」的范围契约 —— 若哪天误把 token 改成全局生效，
    // 导航会跟着变成 4px，这里立刻红。
    // 为什么必须逐个点名、不能只断言「某个 .glass-panel」：像素基线对这个属性没有分辨力
    //（实测把 --glass-blur-card 改成非法值 → backdrop-filter: none，index-desktop.png 仍通过，
    // 见开发文档第十二节第 6 条），computed 断言是唯一防线，漏一个选择器就是漏一处盲区。
    // 逐个点名也让失败信息直接指认是哪张卡，而不是一句「某个 .glass-panel 不对」。
    for (const sel of ['.blog-profile', '.clock', '.calendar']) {
      expect(await blurOf(page, sel), `${sel} 应走 --glass-blur-card`).toContain('blur(4px)');
    }
    // .feed-link 不属于上面三张卡：它在 home.css 有自己的一条规则（L144），是基线覆盖不到、
    // 上面的循环也覆盖不到的一处。这里按真实形态造一个条目（li.feed-item > a.feed-link）再读
    // computed 值 —— 直接读现成条目会让断言随 feed 数据条数漂移，读不到时更会静默通过。
    // 读完立刻移除：留着会让后面基于 :nth-child 或条数的断言失准。
    const feedBlur = await page.evaluate(() => {
      const list = document.getElementById('feedList');
      if (!list) throw new Error('缺少 #feedList');
      const li = document.createElement('li');
      li.className = 'feed-item';
      const a = document.createElement('a');
      a.className = 'feed-link';
      a.setAttribute('data-probe', 'blur');
      li.appendChild(a);
      list.appendChild(li);
      const out = getComputedStyle(a).backdropFilter;
      li.remove();
      return out;
    });
    expect(feedBlur).toContain('blur(4px)');
    // 兜底：.blog-wrap 内的每一张 .glass-panel 都必须走卡片档。上面是「点名的三张都在」，
    // 这条是「没有第四张漏在外面」—— 将来新增卡片忘了改 CSS 会在这里红，而不是靠人记得加名字。
    const escaped = await page.evaluate(() => [...document.querySelectorAll('.blog-wrap .glass-panel')]
      .filter((el) => !getComputedStyle(el).backdropFilter.includes('blur(4px)'))
      .map((el) => el.className));
    expect(escaped).toEqual([]);
    expect(await blurOf(page, '.glass-nav')).toContain('blur(18px)');
    expect(await probeDotsDisplay(page)).toBe('flex');
    // 无 localStorage 记录时不应写入任何键（apply 只读不写）
    expect(await page.evaluate(() => localStorage.getItem('appearance_v1'))).toBe(null);
  });

  test('面板贴着导航右缘弹出，遮罩不压暗不模糊（不被 .collect-modal 骨架接管）', async ({ page }) => {
    // 曾经的坑：home.css 在 manifest 里排在 collect-book.css 之前，
    // 单类名 .appearance-modal / .appearance-inner 会被 .collect-modal(-inner) 覆盖，
    // 结果遮罩保留 blur、面板被 flex 居中撑成 580px。这里把「必须覆盖成功」钉成契约。
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 面板有 .25s 的 scale 入场过渡（骨架的 .collect-modal:not(.open) 规则），
    // 量几何前必须等它落定，否则量到的是缩放过程中的中间值（320 × 0.9655 ≈ 308.9）
    await expect.poll(() => page.evaluate(() =>
      getComputedStyle(document.querySelector('.appearance-inner')).transform
    )).toBe('none');

    const r = await page.evaluate(() => {
      const modal = document.getElementById('appearanceModal');
      const inner = modal.querySelector('.appearance-inner');
      const nav = document.querySelector('.glass-nav');
      const m = getComputedStyle(modal);
      const i = getComputedStyle(inner);
      const box = inner.getBoundingClientRect();
      return {
        backdropFilter: m.backdropFilter,
        maskBg: m.backgroundColor,
        innerPosition: i.position,
        innerWidth: box.width,
        innerTop: box.top,
        innerRight: box.right,
        navRight: nav.getBoundingClientRect().right,
      };
    });

    expect(r.backdropFilter).toBe('none');          // 不模糊页面本身
    expect(r.maskBg).toBe('rgba(0, 0, 0, 0)');      // 不压暗页面本身
    expect(r.innerPosition).toBe('fixed');          // 贴视口，而不是被 flex 居中
    expect(r.innerWidth).toBe(320);                 // 320px 浮层，而不是骨架的 580px
    expect(Math.abs(r.innerTop - 84)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.innerRight - r.navRight)).toBeLessThanOrEqual(1); // 右缘与导航对齐
  });

  test('无闪烁前提：ui.js / appearance.js 在 head 同步加载', async ({ page }) => {
    await page.goto('index.html');
    const tags = await page.evaluate(() => {
      const pick = (name) => {
        const el = document.querySelector(`head script[src*="${name}"]`);
        return el
          ? { found: true, defer: el.hasAttribute('defer'), async: el.hasAttribute('async') }
          : { found: false };
      };
      return {
        ui: pick('ui.js'),
        appearance: pick('appearance.js'),
        inBody: !!document.querySelector('body script[src*="appearance.js"]'),
      };
    });
    expect(tags.ui).toEqual({ found: true, defer: false, async: false });
    expect(tags.appearance).toEqual({ found: true, defer: false, async: false });
    expect(tags.inBody).toBe(false);
  });

  test('切到覆盖模式：轮播变固定背景层、内容让出导航净空、指示点隐藏', async ({ page }) => {
    await page.goto('index.html');
    const viewport = page.viewportSize();

    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 横幅模式（默认）下两个透明度滑块整组 hidden，所以「打开即聚焦第一个可用控件」
    // 落到的是模式组里的按钮而不是滑块 —— 对隐藏元素 focus() 会被浏览器静默忽略。
    // 焦点必须是「同步」就位：.appearance-modal 把骨架的 visibility 过渡改成了打开即时生效
    // （若退回带过渡的写法，这里的 activeElement 会停在触发器上，键盘操作全部落空）。
    await expect(page.locator('#appearanceSliders')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement.dataset.mode)).toBe('banner');

    await page.locator('.appearance-mode[data-mode="cover"]').click();
    // 覆盖模式才提供这两个旋钮
    await expect(page.locator('#appearanceSliders')).toBeVisible();
    const s = await snapshot(page);

    expect(s.cover).toBe(true);
    // 覆盖模式才应用存储的卡片透明度；无记录时 = CARD_DEFAULT（0.7）
    expect(s.glassAlpha).toBe('0.7');
    expect(s.position).toBe('fixed');
    expect(s.carouselTop).toBe(0);
    expect(Math.abs(s.carouselHeight - viewport.height)).toBeLessThanOrEqual(1); // 铺满视口
    expect(s.wrapPaddingTop).toBe(96);        // 让出固定导航净空
    expect(s.ariaHidden).toBe('true');        // 纯装饰，对读屏隐藏
    expect(await probeDotsDisplay(page)).toBe('none');
    await expect(page.locator('.appearance-mode[data-mode="cover"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.appearance-mode[data-mode="banner"]')).toHaveAttribute('aria-pressed', 'false');

    // 落盘 + 关闭后滚动锁还原
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('appearance_v1')).mode)).toBe('cover');
    await page.keyboard.press('Escape');
    await expectClosed(page, '#appearanceModal');
  });

  test('覆盖模式跨刷新保持，且首帧前已生效（不出现先横幅后覆盖的跳变）', async ({ page }) => {
    // DOMContentLoaded 时记录一次类名：head 里的同步脚本若真的先于首帧执行，
    // 此刻 .app-cover 必须已经挂在 <html> 上
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        window.__clsAtReady = document.documentElement.className;
      }, { once: true });
    });
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await page.keyboard.press('Escape');
    await expectClosed(page, '#appearanceModal');

    await page.reload();
    const s = await snapshot(page);
    expect(s.cover).toBe(true);
    expect(s.position).toBe('fixed');
    expect(s.wrapPaddingTop).toBe(96);
    expect(await page.evaluate(() => window.__clsAtReady)).toContain('app-cover');
  });

  test('两个滑块：键盘可调、实时改 CSS 变量、松手落盘', async ({ page }) => {
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 滑块只在覆盖模式下提供，先切过去（横幅模式下它们是 hidden，focus() 不会生效）
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await expect(page.locator('#appearanceSliders')).toBeVisible();

    // 背景透明度：Home → 0%，End → 100%
    await page.locator('#appearanceBg').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#appearanceBgVal')).toHaveText('0%');
    await expect(page.locator('#appearanceBg')).toHaveAttribute('aria-valuetext', '0%');
    expect((await snapshot(page)).bgOpacity).toBe('0');

    await page.keyboard.press('End');
    await expect(page.locator('#appearanceBgVal')).toHaveText('100%');
    expect((await snapshot(page)).bgOpacity).toBe('1');

    // 卡片透明度：Home → 下限 20%（再低正文对比度不达标），并即时反映到玻璃面
    await page.locator('#appearanceCard').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#appearanceCardVal')).toHaveText('20%');
    await expect(page.locator('#appearanceCard')).toHaveAttribute('aria-valuetext', '20%');
    let s = await snapshot(page);
    expect(s.glassAlpha).toBe('0.2');
    expect(s.panelBg).toBe('rgba(220, 240, 248, 0.2)');

    // 键盘连按 8 次上箭头 → 20% + 8×5% = 60%
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
    await expect(page.locator('#appearanceCardVal')).toHaveText('60%');
    expect((await snapshot(page)).glassAlpha).toBe('0.6');

    // change（松手 / 失焦）才落盘
    await page.locator('#appearanceCard').blur();
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('appearance_v1');
      return raw ? JSON.parse(raw).cardOpacity : null;
    })).toBe(0.6);
  });

  test('两个透明度滑块只在覆盖模式下提供，切换模式时显隐与值都不出错', async ({ page }) => {
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');

    // 横幅模式（默认）：整组 hidden —— 不可见、不在 tab 序里、也不进可访问性树
    await expect(page.locator('#appearanceSliders')).toBeHidden();
    await expect(page.locator('#appearanceBg')).toBeHidden();
    await expect(page.locator('#appearanceCard')).toBeHidden();

    // 覆盖模式：两个旋钮出现
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await expect(page.locator('#appearanceSliders')).toBeVisible();

    // 在覆盖模式调到下限并落盘
    await page.locator('#appearanceCard').focus();
    await page.keyboard.press('Home');
    await page.locator('#appearanceCard').blur();
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('appearance_v1');
      return raw ? JSON.parse(raw).cardOpacity : null;
    })).toBe(0.2);

    // 切回横幅：滑块收起，但隐藏的是控件不是设置 —— 存储值仍是 0.2，
    // 而渲染走「横幅模式强制 BANNER_ALPHA」，所以此刻 --glass-alpha 是 0.5。
    await page.locator('.appearance-mode[data-mode="banner"]').click();
    await expect(page.locator('#appearanceSliders')).toBeHidden();
    expect((await snapshot(page)).glassAlpha).toBe('0.5');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('appearance_v1')).cardOpacity)).toBe(0.2);

    // 再切回覆盖：原值原样回灌（控件文字与渲染的 α 都回到 0.2），用户不需要重调
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await expect(page.locator('#appearanceSliders')).toBeVisible();
    await expect(page.locator('#appearanceCardVal')).toHaveText('20%');
    expect((await snapshot(page)).glassAlpha).toBe('0.2');

    // 焦点在滑块里时切到横幅：隐藏会把焦点抛回 body（Safari 点击按钮不移动焦点，
    // 这是真实可达的路径），必须交回刚点的模式按钮，键盘用户才不会掉出面板。
    // 用 dispatchEvent 触发是为了模拟「点击没有移动焦点」的那种浏览器行为。
    await page.locator('#appearanceCard').focus();
    await page.locator('.appearance-mode[data-mode="banner"]').dispatchEvent('click');
    await expect(page.locator('#appearanceSliders')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement.dataset.mode)).toBe('banner');

    // 重置同理会先隐藏滑块：焦点同样不能掉出面板（此时交回重置按钮）
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await page.locator('#appearanceCard').focus();
    await page.locator('#appearanceReset').dispatchEvent('click');
    await expect(page.locator('#appearanceSliders')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement.id)).toBe('appearanceReset');
  });

  test('恢复默认：一键回到默认外观（横幅 + 卡片 70%）', async ({ page }) => {
    await page.goto('index.html');
    await page.locator('#appearanceBtn').click();
    await page.locator('.appearance-mode[data-mode="cover"]').click();
    await page.locator('#appearanceCard').focus();
    await page.keyboard.press('Home');
    await page.locator('#appearanceCard').blur();

    await page.locator('#appearanceReset').click();
    const s = await snapshot(page);
    expect(s.cover).toBe(false);
    expect(s.position).toBe('relative');
    expect(s.wrapPaddingTop).toBe(34);
    expect(s.bgOpacity).toBe('1');
    expect(s.glassAlpha).toBe('0.5');   // 横幅模式强制回落，不读 cardOpacity
    expect(s.panelBg).toBe('rgba(220, 240, 248, 0.5)');
    await expect(page.locator('#appearanceCardVal')).toHaveText('70%');
    await expect(page.locator('.appearance-mode[data-mode="banner"]')).toHaveAttribute('aria-pressed', 'true');
    // 重置回横幅模式 → 滑块整组收起（值已回到默认 70%，见上一条断言）
    await expect(page.locator('#appearanceSliders')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('appearance_v1')))).toEqual({
      mode: 'banner', bgOpacity: 1, cardOpacity: 0.7,
    });
  });

  test('坏数据兜底：JSON 损坏回默认 / 数值越界夹取 / 非法字段回默认且不牵连合法字段', async ({ page }) => {
    await page.goto('index.html');

    // 1) JSON 损坏 → 整体回默认（默认模式是横幅，故 α 强制 0.5）
    await page.evaluate(() => localStorage.setItem('appearance_v1', '{not json'));
    await page.reload();
    let s = await snapshot(page);
    expect(s.cover).toBe(false);
    expect(s.bgOpacity).toBe('1');
    expect(s.glassAlpha).toBe('0.5');

    // 2) 非法模式 + 越界数值 → 模式回默认；数值是「能解析成数字就夹取到区间端点」
    //    （只有 NaN / 非数字才走 fallback，所以这里不是回默认而是贴到上下限）
    await page.evaluate(() => localStorage.setItem(
      'appearance_v1', JSON.stringify({ mode: 'weird', bgOpacity: -2, cardOpacity: 99 })
    ));
    await page.reload();
    s = await snapshot(page);
    expect(s.cover).toBe(false);       // 'weird' → 回默认 banner
    expect(s.bgOpacity).toBe('0');     // -2 夹到下限 0
    // 横幅模式强制回落：存储里被夹到 1 的 cardOpacity 不参与渲染，这里读到的是 0.5
    expect(s.glassAlpha).toBe('0.5');

    // 同一份越界数值 + 合法模式（cover）→ 夹取后的 1 才真正落到 --glass-alpha 上
    await page.evaluate(() => localStorage.setItem(
      'appearance_v1', JSON.stringify({ mode: 'cover', bgOpacity: -2, cardOpacity: 99 })
    ));
    await page.reload();
    s = await snapshot(page);
    expect(s.cover).toBe(true);
    expect(s.glassAlpha).toBe('1');    // 99 夹到上限 1

    // 3) 非法数值 + 合法模式 → 数值回默认，合法字段不被牵连
    await page.evaluate(() => localStorage.setItem(
      'appearance_v1', JSON.stringify({ mode: 'cover', bgOpacity: 'abc', cardOpacity: null })
    ));
    await page.reload();
    s = await snapshot(page);
    expect(s.cover).toBe(true);        // 合法模式保留
    expect(s.bgOpacity).toBe('1');     // 'abc' → NaN → 回默认
    expect(s.glassAlpha).toBe('0.7');  // null → NaN → 回默认 CARD_DEFAULT(0.7)
  });

  test('遮罩点击关闭并归还焦点；窄屏下覆盖模式同样铺满视口', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('index.html');

    // 窄屏触发点在导航下拉菜单里，先展开菜单再点
    await page.locator('#hamburger').click();
    await page.locator('#appearanceBtn').click();
    await expectOpen(page, '#appearanceModal');
    // 面板打开时下拉菜单必须收起，否则两者叠在同一角
    await expect(page.locator('.nav-links')).not.toHaveClass(/open/);

    await page.locator('.appearance-mode[data-mode="cover"]').click();
    const s = await snapshot(page);
    expect(Math.abs(s.carouselHeight - 844)).toBeLessThanOrEqual(1);
    expect(s.wrapPaddingTop).toBe(96);

    // 透明遮罩点击（左上角）关闭，焦点回到触发器
    await page.locator('#appearanceModal').click({ position: { x: 4, y: 4 } });
    await expectClosed(page, '#appearanceModal');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('appearanceBtn');
  });

  test('其它页面不受影响：无触发器、变量取默认值、卡片仍是 18px 模糊', async ({ page }) => {
    await page.goto('works.html');
    expect(await page.locator('#appearanceBtn').count()).toBe(0);
    const r = await page.evaluate(() => ({
      cover: document.documentElement.classList.contains('app-cover'),
      navBg: getComputedStyle(document.querySelector('.glass-nav')).backgroundColor,
    }));
    expect(r.cover).toBe(false);
    expect(r.navBg).toBe('rgba(220, 240, 248, 0.5)');
    // 首页卡片的「薄膜更少模糊」是页面级覆盖（.blog-wrap .glass-panel），不得外溢到别页：
    // 作品页卡片仍走 --glass-blur（18px）。卡片由 JS 渲染，先等它进 DOM 再读。
    await expect(page.locator('#worksGrid .work-card').first()).toBeAttached();
    expect(await blurOf(page, '#worksGrid .work-card')).toContain('blur(18px)');
  });
});
