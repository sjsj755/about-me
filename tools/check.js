// ============ 门禁校验（本地唯一入口） ============
// `npm run check` = JS 语法校验 + CSS 结构/产物一致性校验 + 缓存版本一致性校验
//                  + 白色面刻度契约校验。
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
  checkCacheVersion();
  checkPageLinks();

  console.log('门禁校验全部通过。');
}

main();
