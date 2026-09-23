// ============ 白色面刻度 token 接线验证（白色面收敛的反向证明） ============
// 背景：白色面收敛分两步。第 2 步把首页三文件的 39 处字面量换成 tokens.css 的白色面刻度；
//   第 3 步把其余 19 个文件 84 处一并收敛（刻度由 13 档扩到 17 档，并档 11 处，
//   口径见 tokens.css 的「并档口径」注释）。像素基线（tests/visual.spec.js）只能证明
//   「看得到的静态面没变」。
//   静态侧的「零字面量 + 刻度无孤儿」由 npm run check 兜住（tools/check.js）——
//   本文件负责 computed 值这一侧，两者互补。
//   实测确认，像素基线盖不到下面这些面（基线对 --w-70 的变异确实会红，
//   但那是因为气泡尾巴的 ::after 在 left:-12px 溢出 mask 盒外 —— 气泡本体仍未被保护）：
//     1) mask 盒内的面：.cal-grid 整格（跨天的「今天」高亮会漂）、.encourage-bubble 本体；
//     2) 常态不可见的面：.mascot-shine 常态 opacity: 0，只有 .is-active 才显示；
//     3) 尚未生成的面：.carousel-art 只在首帧图片加载失败时才进 DOM
//        （.carousel-dots 不在此列：CAROUSEL 有 2 帧，指示点在基线里是可见且被保护的）；
//     4) 交互态：基线只拍初始静态态，所有 :hover 与 [aria-expanded="true"] 从未生效过。
//   这些面若把 token 名写错（var(--w_55) 之类），声明会在 computed-value 阶段整条失效、
//   属性退回初始值 —— 视觉上「白没了」，而基线因为面不可见 / 不存在而永远保持绿。
//   本文件改用 computed 值把它们逐项钉死；已在基线保护范围内的面也一并断言，
//   作为「值本身不许再动」的回归锚点（基线只保证没变，不保证等于当初那个字面量）。
// 另外钉住 tokens.css 里写下的行为契约：刻度上的白一律是恒值、不跟随 --glass-alpha；
//   全项目唯一跟随 --glass-alpha 的白是 --glass-bg。最后一条用例是这条契约的正反面对照。
const { test, expect } = require('@playwright/test');

// 刻度全集：tokens.css 里定义的每一档都必须解析成预期色值。
// 未定义的 var(--x) 会让声明在 computed-value 阶段失效 → backgroundColor 退回透明
// （Chromium 记为 'rgba(0, 0, 0, 0)'），与 --w-0 的 'rgba(255, 255, 255, 0)' 可区分。
const SCALE = {
  '--white': 'rgb(255, 255, 255)',
  '--w-0': 'rgba(255, 255, 255, 0)',
  '--w-12': 'rgba(255, 255, 255, 0.12)',
  '--w-16': 'rgba(255, 255, 255, 0.16)',
  '--w-18': 'rgba(255, 255, 255, 0.18)',
  '--w-25': 'rgba(255, 255, 255, 0.25)',
  '--w-35': 'rgba(255, 255, 255, 0.35)',
  '--w-40': 'rgba(255, 255, 255, 0.4)',
  '--w-45': 'rgba(255, 255, 255, 0.45)',
  '--w-50': 'rgba(255, 255, 255, 0.5)',
  '--w-55': 'rgba(255, 255, 255, 0.55)',
  '--w-60': 'rgba(255, 255, 255, 0.6)',
  '--w-70': 'rgba(255, 255, 255, 0.7)',
  '--w-75': 'rgba(255, 255, 255, 0.75)',
  '--w-80': 'rgba(255, 255, 255, 0.8)',
  '--w-85': 'rgba(255, 255, 255, 0.85)',
  '--w-90': 'rgba(255, 255, 255, 0.9)',
  '--w-95': 'rgba(255, 255, 255, 0.95)',
};

// 首页 + 等脚本渲染完（feed / 日历 / 轮播都由 JS 生成，不等就查不到元素）
async function openIndex(page) {
  await page.goto('index.html');
  await page.waitForLoadState('networkidle');
}

// 读单个 computed 值。选择器没命中直接抛错，绝不用「找不到就跳过」把失效伪装成通过。
function readCSS(page, sel, prop, pseudo) {
  return page.evaluate(([s, p, ps]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error('选择器未命中：' + s);
    return getComputedStyle(el, ps || null)[p];
  }, [sel, prop, pseudo]);
}

// 悬停后必须等过渡跑完再读 computed 值。
// 本页所有悬停面都带 transition: background .2s~.3s，而 getComputedStyle 取的是
// 过渡的瞬时插值 —— 刚 dispatch 完 mouseMoved 就读，拿到的是过渡起点（即未悬停的值），
// 会得到「:hover 没生效」的假象。500ms 覆盖本页最长的 .3s。
async function hoverSettled(page, sel) {
  // 一律取 first()：这些选择器大多命中一族元素（29 个日历格 / 2 个社交图标），
  // 而 :hover 同一时刻只可能落在一个元素上，读值时用 `sel:hover` 精确锁定被悬停的那个。
  await page.locator(sel).first().hover();
  await page.waitForTimeout(500);
}

test.describe('白色面刻度 token 接线', () => {
  test('刻度全集：--white 与 17 档刻度共 18 个变量都能解析成预期色值', async ({ page }) => {
    await openIndex(page);
    const values = await page.evaluate((tokens) => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const out = {};
      for (const t of tokens) {
        probe.style.background = 'none';
        probe.style.background = `var(${t})`;
        out[t] = getComputedStyle(probe).backgroundColor;
      }
      probe.remove();
      return out;
    }, Object.keys(SCALE));
    expect(values).toEqual(SCALE);
  });

  test('掩码面与不可见面：computed 值与改造前的字面量逐项一致', async ({ page }) => {
    await openIndex(page);

    // ---- .cal-grid 整格在像素基线里被 mask，格内每一档白只能靠 computed 值钉住 ----
    // .cal-dot 只在「有标记的日期」才渲染（本用例的上下文 localStorage 为空 → 恒不存在），
    // 用探针把它造进「今天」格；[data-probe] 属性只为躲开可能已存在的同名节点。
    const cal = await page.evaluate(() => {
      const grid = document.getElementById('calGrid');
      if (!grid) throw new Error('缺少 #calGrid');
      const today = grid.querySelector('.cal-day.today');
      if (!today) throw new Error('当月没有 .cal-day.today，日历未渲染');
      const lunar = today.querySelector('.cal-lunar');
      if (!lunar) throw new Error('.cal-day.today 内没有 .cal-lunar');
      const dot = document.createElement('span');
      dot.className = 'cal-dot';
      dot.setAttribute('data-probe', 'dot');
      today.appendChild(dot);
      return {
        todayColor: getComputedStyle(today).color,
        lunarColor: getComputedStyle(lunar).color,
        dotShadow: getComputedStyle(today.querySelector('.cal-dot[data-probe="dot"]')).boxShadow,
      };
    });
    expect(cal.todayColor).toBe('rgb(255, 255, 255)');            // .cal-day.today          → var(--white)
    expect(cal.lunarColor).toBe('rgba(255, 255, 255, 0.9)');      // .cal-day.today .cal-lunar → var(--w-90)
    expect(cal.dotShadow).toContain('rgba(255, 255, 255, 0.9)');  // .cal-day.today .cal-dot   → var(--w-90)

    // 悬停格：基线从不 hover，.cal-day:hover 唯一一档白只在 computed 值里可见
    await hoverSettled(page, '#calGrid .cal-day:not(.empty):not(.today)');
    expect(await readCSS(page, '#calGrid .cal-day:hover', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.7)');

    // ---- .encourage-bubble 同样被 mask（文案每 15s 轮换）----
    expect(await readCSS(page, '.encourage-bubble', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.7)');
    // 尾巴与气泡体必须同源：只改气泡不改尾巴会在玻璃底上露出一块三角缺口
    expect(await readCSS(page, '.encourage-bubble', 'borderRightColor', '::after')).toBe('rgba(255, 255, 255, 0.7)');

    // ---- .mascot-shine：常态 opacity: 0，基线里这层渐变从头到尾没被拍进去过 ----
    const shine = await readCSS(page, '.mascot-shine', 'backgroundImage');
    expect(shine).toContain('rgba(255, 255, 255, 0.5)');  // var(--w-50)
    expect(shine).toContain('rgba(255, 255, 255, 0)');    // var(--w-0)
  });

  test('尚未生成的面：轮播占位帧的白没接错', async ({ page }) => {
    await openIndex(page);

    // .carousel-art 只在帧图片缺失 / 加载失败时才进 DOM（当前两张图都正常，所以恒不存在）。
    // 这是「活的但没 DOM」的样式，只能用探针激活后再读。
    // 指示点不在此列：CAROUSEL 有 2 帧，.carousel-dots 真实存在于 DOM 且被基线保护，
    // 下面直接读真元素，不造探针（否则探针会与真元素在同一个 right/bottom 位置重叠）。
    const dots = page.locator('.carousel-dot');
    await expect(dots).toHaveCount(2);

    // 探针是 inset:0 的全幅绝对定位层，读完后必须立刻移除：它排在指示点之后，
    // 留在 DOM 里会把 .carousel-dot 整个盖住，下面的 hover 会因为「被拦截」而超时。
    const art = await page.evaluate(() => {
      const root = document.getElementById('blogCarousel');
      const el = document.createElement('div');
      el.className = 'carousel-art';
      root.appendChild(el);
      const out = {
        before: getComputedStyle(el, '::before').backgroundColor,
        after: getComputedStyle(el, '::after').backgroundColor,
      };
      el.remove();
      return out;
    });
    expect(art.before).toBe('rgba(255, 255, 255, 0.16)');  // 光斑 A → var(--w-16)
    expect(art.after).toBe('rgba(255, 255, 255, 0.12)');   // 光斑 B → var(--w-12)

    const dotRead = (i) => page.evaluate((n) => {
      const s = getComputedStyle(document.querySelectorAll('.carousel-dot')[n], '::before');
      return { bg: s.backgroundColor, shadow: s.boxShadow };
    }, i);

    const plain = await dotRead(1);                                 // 第 2 个点未选中
    expect(plain.bg).toBe('rgba(255, 255, 255, 0.55)');             // 未选中点 → var(--w-55)
    expect(plain.shadow).toContain('rgba(255, 255, 255, 0.18)');     // 点外圈   → var(--w-18)
    expect((await dotRead(0)).bg).toBe('rgb(255, 255, 255)');       // 选中点   → var(--white)

    // :hover 是基线唯一永远拍不到的态
    await hoverSettled(page, '.carousel-dot:not(.is-active)');
    expect((await dotRead(1)).bg).toBe('rgba(255, 255, 255, 0.85)'); // :hover → var(--w-85)
  });

  test('交互态：悬停、展开与选中态的白都取自刻度', async ({ page }) => {
    await openIndex(page);

    // :hover —— 视觉基线永远拍不到
    await hoverSettled(page, '.social-link');
    expect(await readCSS(page, '.social-link:hover', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.8)');

    await hoverSettled(page, '#calPrev');
    expect(await readCSS(page, '.cal-nav:hover', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.85)');

    // .feed-link 的真实条数取决于数据文件，探针让这条断言不随数据增减漂移
    await page.evaluate(() => {
      const li = document.createElement('li');
      li.className = 'feed-link';
      li.setAttribute('data-probe', 'feed');
      document.getElementById('feedList').appendChild(li);
    });
    await hoverSettled(page, '#feedList .feed-link[data-probe="feed"]');
    expect(await readCSS(page, '#feedList .feed-link[data-probe="feed"]:hover', 'backgroundColor'))
      .toBe('rgba(255, 255, 255, 0.75)');

    // 外观按钮两条规则特异性相同（.appearance-btn:hover 与 [aria-expanded="true"]），
    // 靠源顺序定胜负：先验未展开时的 :hover，再验展开态，顺序被调整这里立刻失败
    await hoverSettled(page, '#appearanceBtn');
    expect(await readCSS(page, '#appearanceBtn:hover', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.6)');
    await page.locator('#appearanceBtn').click();
    await expect(page.locator('#appearanceBtn')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#appearanceReset')).toBeVisible();
    await page.waitForTimeout(500); // 展开态切换的 background .25s 过渡
    expect(await readCSS(page, '#appearanceBtn', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.75)');

    // 面板内静态选中态与悬停态
    expect(await readCSS(page, '.appearance-mode.active', 'color')).toBe('rgb(255, 255, 255)');
    expect(await readCSS(page, '.appearance-mode[data-mode="cover"]', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.6)');
    expect(await readCSS(page, '.appearance-mode[data-mode="cover"]', 'borderTopColor')).toBe('rgba(255, 255, 255, 0.8)');
    await hoverSettled(page, '#appearanceReset');
    expect(await readCSS(page, '#appearanceReset:hover', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.9)');

    // 日历弹层内默认选中的档：弹层未打开，但 computed 值可读，无需为断言改页面状态
    expect(await readCSS(page, '.cal-ico.active', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.95)');
    expect(await readCSS(page, '.cal-rp.active', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.95)');
    expect(await readCSS(page, '.cal-input', 'backgroundColor')).toBe('rgba(255, 255, 255, 0.75)');
    expect(await readCSS(page, '.cal-save', 'color')).toBe('rgb(255, 255, 255)');
  });

  test('恒值不变量：白色面不跟随 --glass-alpha，--glass-bg 面跟随', async ({ page }) => {
    await openIndex(page);

    // 取样跨 4 个档位、两种属性类型（背景 / 文字色）
    const WHITE = [
      ['.social-link', 'backgroundColor', 'rgba(255, 255, 255, 0.55)'],
      ['.cal-ico', 'backgroundColor', 'rgba(255, 255, 255, 0.6)'],
      ['.encourage-bubble', 'backgroundColor', 'rgba(255, 255, 255, 0.7)'],
      ['.cal-input', 'backgroundColor', 'rgba(255, 255, 255, 0.75)'],
      ['.cal-save', 'color', 'rgb(255, 255, 255)'],
    ];
    // 对照组：全项目唯一的「跟随者」--glass-bg（导航玻璃 + 玻璃面板）
    const GLASS = ['.glass-nav', '.blog-profile'];

    const read = () => page.evaluate(([white, glass]) => {
      const one = ([sel, prop]) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('选择器未命中：' + sel);
        return getComputedStyle(el)[prop];
      };
      return {
        white: white.map(one),
        glass: glass.map((s) => getComputedStyle(document.querySelector(s)).backgroundColor),
      };
    }, [WHITE.map(([s, p]) => [s, p]), GLASS]);

    // 卡片透明度走的是 :root 上的同一个 --glass-alpha（js/appearance.js 也写这一处）
    for (const alpha of ['0.9', '0.1']) {
      await page.evaluate((v) => document.documentElement.style.setProperty('--glass-alpha', v), alpha);
      const now = await read();
      expect(now.white, `--glass-alpha=${alpha} 时白色面必须纹丝不动`).toEqual(WHITE.map((r) => r[2]));
      expect(now.glass, `--glass-alpha=${alpha} 时 --glass-bg 面必须跟随`).toEqual(
        GLASS.map(() => `rgba(220, 240, 248, ${alpha})`),
      );
    }
  });
});