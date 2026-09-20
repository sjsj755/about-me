// ============ 门禁校验（本地唯一入口） ============
// `npm run check` = JS 语法校验 + CSS 结构/产物一致性校验。
// 只读校验，不修改任何文件；任一项失败即以退出码 1 结束。
//
// 为什么要收口成一个入口：这两个校验各自依赖不同工具（node --check / css-graph），
// 但「提交前该跑什么」只应该有一个答案，否则迟早会漏跑其中一项。
//
// 边界说明：
//   - js/vendor/ 下的第三方压缩产物不参与校验（不是本仓库的源码）。
//   - 本脚本不跑 Playwright —— 那是 `npm test`，耗时且需要浏览器，属于另一道门。
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

  console.log('门禁校验全部通过。');
}

main();
