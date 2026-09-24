// ============ 门禁校验（本地唯一入口） ============
// `npm run check` = JS 语法校验 + CSS 结构/产物一致性校验 + 缓存版本一致性校验
//                  + 白色面刻度契约校验 + 玻璃模糊契约校验 + 外观面板初值契约校验。
// 只读校验，不修改任何文件；任一项失败即以退出码 1 结束。
//
// 为什么要收口成一个入口：这几项校验各自依赖不同工具（node --check / css-graph），
// 但「提交前该跑什么」只应该有一个答案，否则迟早会漏跑其中一项。
//
// 边界说明：
//   - js/vendor/ 下的第三方压缩产物不参与校验（不是本仓库的源码）。
//   - 本脚本不跑 Playwright —— 那是 `npm test`，耗时且需要浏览器，属于另一道门。
//   - 白色面刻度契约是纯文本断言，所以放在这里而非 Playwright：不需要浏览器，
//     且必须与「dist 是否新鲜」同时成立才有意义（见 checkWhiteScale）。
//   - 玻璃模糊契约与外观面板初值契约同理（纯文本断言、不需要浏览器）。它们补的是
//     Playwright 侧的两类结构性盲区：视觉基线对首页卡片的 backdrop-filter 无分辨力
//     （实测注入 none 仍能通过），而 computed 断言又盖不到 HTML 初值 —— 详见各自函数头。
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const graph = require('./css-graph');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const VENDOR_DIR = 'vendor';

// 递归列出 js/ 下全部 .js（跳过 vendor），返回绝对路径（排序保证输出可复现）
function listJs() {
  const out = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .forEach((ent) => {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name !== VENDOR_DIR) walk(abs);
        } else if (ent.name.endsWith('.js')) {
          out.push(abs);
        }
      });
  })(JS_DIR);
  return out;
}

// 逐个过 `node --check`：只解析语法、不执行，因此不会触发任何副作用
function checkJs(files) {
  const bad = [];
  files.forEach((abs) => {
    try {
      execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
    } catch (e) {
      // node --check 的 stderr 形如：<文件>:<行> / 源码行 / 插入符 / 空行 / SyntaxError: ...
      // 末尾还会跟一段 Node 版本信息，所以不能简单取最后一行。
      const lines = String(e.stderr || e.message)
        .split('\n').map((s) => s.trim()).filter(Boolean);
      const detail = lines.find((l) => /Error/.test(l)) || lines[0] || '语法错误';
      const loc = (lines[0] || '').match(/:(\d+)$/);
      bad.push({ abs, msg: loc ? `${detail}（第 ${loc[1]} 行）` : detail });
    }
  });
  return bad;
}

// 各页 HTML 的 ?v= 缓存参数必须等于 css/manifest.json 的 version。
// 版本号是手工升的，没有任何机制会把它同步进 HTML —— 漏改一页，该页就会在 nginx 的
// 30d immutable 缓存下继续加载旧 CSS/JS（曾实际发生），所以由门禁兜住。
// 规则本体在 css-graph.js（纯函数），这里只负责读盘。
function checkCacheVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'css', 'manifest.json'), 'utf8'));
  const pages = fs.readdirSync(ROOT)
    .filter((n) => n.endsWith('.html'))
    .sort()
    .map((n) => ({ name: n, text: fs.readFileSync(path.join(ROOT, n), 'utf8') }));

  const errors = graph.cacheVersionErrors(manifest, pages);
  if (errors.length) {
    errors.forEach((e) => console.error(`  x [${e.code}] ${e.message}`));
    console.error(`\n缓存版本校验未通过（${errors.length} 项），已中止。`);
    process.exit(1);
  }
  console.log(`缓存版本校验通过（${pages.length} 个页面，v${manifest.version}）`);
}

// 各页 HTML 的样式引用必须是「shared.css + 本页 <stem>.css」恰好两个（Phase B 契约）。
// <link> 缺失不报 404、页面静默丢样式，只能静态拦截；规则本体在 css-graph.js。
function checkPageLinks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'css', 'manifest.json'), 'utf8'));
  const pages = fs.readdirSync(ROOT)
    .filter((n) => n.endsWith('.html'))
    .sort()
    .map((n) => ({ name: n, text: fs.readFileSync(path.join(ROOT, n), 'utf8') }));

  const errors = graph.pageLinkErrors(manifest, pages);
  if (errors.length) {
    errors.forEach((e) => console.error(`  x [${e.code}] ${e.message}`));
    console.error(`\n页面样式引用校验未通过（${errors.length} 项），已中止。`);
    process.exit(1);
  }
  console.log(`页面样式引用校验通过（${pages.length} 个页面 = shared + 本页产物）`);
}

// ---- 白色面刻度契约（tokens.css 声明、全站执行）----
// 两条契约各对应一类真实退化：
//
// 契约一 · tokens.css 之外禁止白色字面量。所有白色面必须取自 --white / --w-*。
//   为什么必须静态拦：Firefox 专属伪元素（::-moz-range-track / ::-moz-range-thumb）
//   在 Chromium 通道下结构性读不到 computed 值，tests/surface-tokens.spec.js 对它们是
//   盲区 —— 只有「文本层零字面量」能证明这些规则也接在刻度上。它同时兜住「新增面
//   忘了用 token」和「token 名写错导致声明整条失效」这两类静默退化。
//
// 契约二 · 刻度只列实际用到的档位。声明了却无人消费的档位会让刻度悄悄膨胀，
//   而膨胀的刻度迟早会被随手挑一个「差不多的」值用掉，收敛成果就此瓦解。
//
// 先剥注释：tokens.css 的说明文字本身就写着 "rgba(255,255,255,…)" 与 "#fff"，
// 不剥会把契约自身的文档当成违规。
const WHITE_LITERAL = /rgba?\(\s*255\s*,\s*255\s*,\s*255\s*[,)]|#fff\b|#ffffff\b/i;
const SCALE_DECL = /^\s*(--w-[0-9]+)\s*:/gm;
const SCALE_USE = /var\((--w-[0-9]+)\)/g;

function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

// 递归列出目录下全部 .css，返回绝对路径（排序保证输出可复现）
function listCss(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .forEach((ent) => {
        const abs = path.join(d, ent.name);
        if (ent.isDirectory()) walk(abs);
        else if (ent.name.endsWith('.css')) out.push(abs);
      });
  })(dir);
  return out;
}

function checkWhiteScale() {
  // src 与 dist 都要过：src 管「写的人有没有用 token」，dist 管「产物真的带上了」。
  // dist 的新鲜度由前面的 build-css.js --check 保证，这里只管文本内容。
  const files = listCss(path.join(ROOT, 'css', 'src'))
    .concat(listCss(path.join(ROOT, 'css', 'dist')));
  const literals = [];
  const used = new Set();
  let declared = [];

  files.forEach((abs) => {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const text = stripCssComments(fs.readFileSync(abs, 'utf8'));
    text.split('\n').forEach((line, i) => {
      if (WHITE_LITERAL.test(line)) literals.push(`${rel}:${i + 1}  ${line.trim()}`);
      for (const m of line.matchAll(SCALE_USE)) used.add(m[1]);
    });
    // 刻度只可能定义在 tokens.css；从剥过注释的文本里取，避免读到注释里的示例
    if (rel === 'css/src/tokens.css') declared = [...text.matchAll(SCALE_DECL)].map((m) => m[1]);
  });

  if (!declared.length) {
    console.error('  x [SCALE_MISSING] 没能从 css/src/tokens.css 解析出任何 --w-* 刻度声明');
    process.exit(1);
  }

  const errors = literals.map((l) => ({
    code: 'WHITE_LITERAL',
    message: `白色字面量未收敛到刻度（应改用 var(--white) / var(--w-*)）：${l}`,
  }));
  declared.filter((t) => !used.has(t)).forEach((t) => errors.push({
    code: 'ORPHAN_SCALE',
    message: `刻度 ${t} 在 tokens.css 声明后无人消费（契约：刻度只列实际用到的档位）`,
  }));

  if (errors.length) {
    errors.forEach((e) => console.error(`  x [${e.code}] ${e.message}`));
    console.error(`\n白色面刻度契约校验未通过（${errors.length} 项），已中止。`);
    process.exit(1);
  }
  console.log(`白色面刻度契约通过（${declared.length} 档刻度全部有消费者，src+dist 零白色字面量）`);
}

// ---- 玻璃模糊契约（tokens.css 声明、perf.css 降级档兜底）----
//
// 契约一 · --glass-blur-card 必须存在且是合法 <length>。
//   它没有 CSS fallback：变量名写错或声明被删时，blur(var(--glass-blur-card)) 会让整条
//   backdrop-filter 在 computed-value 阶段作废、退回 none，首页卡片静默失去模糊。
//   而视觉基线对这个属性没有分辨力（实测注入 backdrop-filter:none 仍能通过
//   index-desktop.png，见开发文档第十二节第 6 条），所以只能静态拦。
//   注意：写成 blur(var(--glass-blur-card, 4px)) 的 CSS fallback 并不解决问题 ——
//   它只防「变量被删除」，防不了「值写错」（值写错时 var() 解析成功、fallback 不触发）。
//
// 契约二 · --glass-blur-card 必须严格小于 perf.css 降级档的模糊半径。
//   前提：pages/home.css 的 .blog-wrap .glass-panel（特异性 0,2,0）会盖过 perf.css 的
//   .glass-panel（0,1,0），首页卡片在任何条件下都固定走 --glass-blur-card、拿不到降级档。
//   若该 token 被调到降级档之上，reduced-motion / 窄屏用户反而比降级档更贵。
//   为什么用严格小于而非小于等于：等于降级档时首页卡片不再「比降级档更省」，
//   这个 token 的存在意义（厚膜要配少模糊）就没了。
//   若哪天降级档提高特异性（例如写成 .glass-panel.glass-panel），级联前提失效，
//   本契约需要重新设计，而不是改数字。
//
// 为什么只认 backdrop-filter 行内的 blur：perf.css 里 backdrop-filter 只出现在降级档，
// 所以这等价于「作用域化解析」但正则简单得多。不要用 /blur\(([\d.]+)px\)/ 扫全文件 ——
// 将来任何人加一条装饰性的 filter: blur(2px) 都会把上界压到 2px，让合法的 token 无故报红。
// 若降级档之外也出现 backdrop-filter 的 blur，再把解析收窄到媒体查询块内。
const BLUR_CARD_DECL = /--glass-blur-card\s*:\s*([\d.]+)px\s*;/;
const BLUR_DEGRADE = /backdrop-filter:\s*blur\(\s*([\d.]+)px\s*\)/g;

function checkGlassBlur() {
  const tokens = stripCssComments(fs.readFileSync(path.join(ROOT, 'css', 'src', 'tokens.css'), 'utf8'));
  const perf = stripCssComments(fs.readFileSync(path.join(ROOT, 'css', 'src', 'components', 'perf.css'), 'utf8'));

  const errors = [];
  const decl = tokens.match(BLUR_CARD_DECL);
  if (!decl) {
    errors.push({
      code: 'BLUR_CARD_MISSING',
      message: 'css/src/tokens.css 里没有 `--glass-blur-card: <n>px;` 的合法声明'
        + '（写错或删除都会让首页卡片的 backdrop-filter 退化为 none）',
    });
  }

  const degraded = [...perf.matchAll(BLUR_DEGRADE)].map((m) => parseFloat(m[1]));
  if (!degraded.length) {
    errors.push({
      code: 'BLUR_DEGRADE_MISSING',
      message: 'css/src/components/perf.css 里找不到 backdrop-filter 的 blur(Npx) 降级档，降级契约已失效',
    });
  } else if (decl) {
    const limit = Math.min(...degraded);
    const card = parseFloat(decl[1]);
    if (!(card < limit)) {
      errors.push({
        code: 'BLUR_CARD_TOO_LARGE',
        message: `--glass-blur-card=${card}px 不小于 perf.css 降级档 ${limit}px，`
          + '首页卡片会比降级档更贵（契约要求严格小于）',
      });
    }
  }

  if (errors.length) {
    errors.forEach((e) => console.error(`  x [${e.code}] ${e.message}`));
    console.error(`\n玻璃模糊契约校验未通过（${errors.length} 项），已中止。`);
    process.exit(1);
  }
  console.log(`玻璃模糊契约通过（--glass-blur-card ${parseFloat(decl[1])}px < 降级档 ${Math.min(...degraded)}px）`);
}

// ---- 首页外观面板初值契约（appearance.js 常量 ↔ index.html 控件属性）----
//
// 为什么重点是 min、而不是 value：
//   syncControls() 只覆写 value / aria-valuetext / 标签文字，**从不写 min / max**。
//   所以 min="20" 是下限的唯一来源，CARD_MIN = 0.2 是另一套 —— 两者一旦分叉
//   （例如有人把 min 改成 10），用户能把滑块拖到 10%、标签显示 10%，
//   而 apply() 会把 --glass-alpha 静默夹到 0.2，出现「显示 10% 实际 0.2」的可见不一致，
//   且下次打开面板滑块又跳回 20。
//   value 一侧（CARD_DEFAULT / DEFAULTS.bgOpacity）实际影响极低 —— 面板打开时会被
//   syncControls 覆写 —— 但校验成本为零，一并钉住。
//
// 为什么不管 max：JS 侧对应的是 clampNum(..., 1) 里的字面量 1，没有命名常量；
//   而 range 的 max 只能是 100、误改概率接近零，不值得为它引入 CARD_MAX / BG_MAX。
//
// 常量以 js/appearance.js 为准。CARD_MIN_PCT 是历史遗留的未引用常量，不参与本校验。
const CARD_DEFAULT_DECL = /var\s+CARD_DEFAULT\s*=\s*([\d.]+)/;
const CARD_MIN_DECL = /var\s+CARD_MIN\s*=\s*([\d.]+)/;
const DEFAULTS_DECL = /var\s+DEFAULTS\s*=\s*\{([^}]*)\}/;
const BG_DEFAULT_IN_OBJ = /bgOpacity:\s*([\d.]+)/;

// 取某个 <input> 的整个标签文本。两个易错点都已避开：
//   1) id="appearanceBg" 是 id="appearanceBgVal" 的前缀 —— 两处正则都带收尾引号，
//      所以 id="appearanceBg" 不会命中 id="appearanceBgVal"；
//   2) [^>]* 不跨 '>'，所以从上一个 <input 起算的匹配不会越界到下一个 input。
function inputTag(html, id) {
  const m = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
  return m ? m[0] : null;
}
function attrOf(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function checkAppearanceDefaults() {
  const js = fs.readFileSync(path.join(ROOT, 'js', 'appearance.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const errors = [];
  // 注意：正则都要求 `var ` 前缀或对象键形态，所以不会命中文件头注释里的
  // 「CARD_DEFAULT = 0.7 = 首页卡片的厚膜默认」这类说明文字。
  const cardDefault = js.match(CARD_DEFAULT_DECL);
  const cardMin = js.match(CARD_MIN_DECL);
  const defaultsObj = js.match(DEFAULTS_DECL);
  const bgDefault = defaultsObj ? defaultsObj[1].match(BG_DEFAULT_IN_OBJ) : null;

  const require_ = (m, name) => {
    if (!m) {
      errors.push({
        code: 'APPEARANCE_CONST_MISSING',
        message: `js/appearance.js 里解析不出 ${name}，本契约无法校验`,
      });
    }
    return m ? m[1] : null;
  };
  const cardDefaultVal = require_(cardDefault, 'CARD_DEFAULT');
  const cardMinVal = require_(cardMin, 'CARD_MIN');
  const bgDefaultVal = require_(bgDefault, 'DEFAULTS.bgOpacity');

  const cardTag = inputTag(html, 'appearanceCard');
  const bgTag = inputTag(html, 'appearanceBg');
  if (!cardTag) errors.push({ code: 'APPEARANCE_INPUT_MISSING', message: 'index.html 里找不到 <input id="appearanceCard">' });
  if (!bgTag) errors.push({ code: 'APPEARANCE_INPUT_MISSING', message: 'index.html 里找不到 <input id="appearanceBg">' });

  // 百分比刻度与 js/appearance.js 的 syncControls 一致：Math.round(x * 100)。
  // 必须取整 —— 0.2 * 100 在 IEEE754 下是 20.000000000000004，直接比会假红。
  const compare = (jsVal, attrVal, where, label) => {
    if (jsVal === null || attrVal === null) return;
    const expect = Math.round(parseFloat(jsVal) * 100);
    const actual = parseInt(attrVal, 10);
    if (expect !== actual) {
      errors.push({
        code: 'APPEARANCE_DEFAULT_MISMATCH',
        message: `${where} 与 js/appearance.js 的 ${label} 不一致：HTML 是 ${actual}，常量算出 ${expect}`,
      });
    }
  };
  if (cardTag) {
    compare(cardMinVal, attrOf(cardTag, 'min'), '#appearanceCard 的 min', 'CARD_MIN × 100');
    compare(cardDefaultVal, attrOf(cardTag, 'value'), '#appearanceCard 的 value', 'CARD_DEFAULT × 100');
  }
  if (bgTag) {
    compare(bgDefaultVal, attrOf(bgTag, 'value'), '#appearanceBg 的 value', 'DEFAULTS.bgOpacity × 100');
  }

  if (errors.length) {
    errors.forEach((e) => console.error(`  x [${e.code}] ${e.message}`));
    console.error(`\n外观面板初值契约校验未通过（${errors.length} 项），已中止。`);
    process.exit(1);
  }
  console.log('外观面板初值契约通过（3 处 HTML 初值 = js/appearance.js 常量）');
}

function main() {
  const files = listJs();
  const bad = checkJs(files);
  if (bad.length) {
    bad.forEach((b) => console.error(`  x ${path.relative(ROOT, b.abs)}  ${b.msg}`));
    console.error(`\nJS 语法校验未通过（${bad.length}/${files.length}），已中止。`);
    process.exit(1);
  }
  console.log(`JS 语法校验通过（${files.length} 个文件，已排除 js/vendor/）`);

  // CSS 结构与产物一致性：直接复用 build-css.js --check，避免同一职责出现两套实现
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'build-css.js'), '--check'], { stdio: 'inherit' });
  } catch (e) {
    process.exit(typeof e.status === 'number' ? e.status : 1);
  }

  // 必须排在上面 build-css.js --check 之后：dist 陈旧时扫 dist 得到的结论没有意义
  checkWhiteScale();
  // 下面两个只读 css/src 与 js/、index.html，不依赖 dist 新鲜度，排序自由；
  // 紧跟 checkWhiteScale 只为让「读源码的静态契约」聚在一起，便于阅读
  checkGlassBlur();
  checkAppearanceDefaults();
  checkCacheVersion();
  checkPageLinks();

  console.log('门禁校验全部通过。');
}

main();
