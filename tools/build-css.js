// ============ CSS 构建（唯一 I/O 入口） ============
// 按 css/manifest.json 把 css/src/** 拼成 css/dist/shared.css 与 css/dist/<page>.css。
//
// 拼接方式是「原样首尾相接」（join('')），不做任何格式化。因此只要源文件按原顺序排列、
// 且每个文件都以换行结尾，产物就与拆分前的单文件逐字节等价 —— 这正是 Phase A 重构期间的
// 验收手段：每拆一次文件，css/dist/shared.css 都必须仍然逐字节不变。
//
// 由此推出一条硬约束：**manifest 数组的排列就是级联顺序**，源文件必须是原文件的
// 连续切片且按原顺序列出。不能按 tokens/base/components 分组重排 —— 原文件里
// base 与 component 区块本来就是交错的，重排会改变级联结果。
//
// 用法：
//   node tools/build-css.js           按 manifest 生成 css/dist/
//   node tools/build-css.js --check   只校验不写入（结构违规 / dist 过期 → 退出码 1）
'use strict';

const fs = require('fs');
const path = require('path');
const graph = require('./css-graph');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'css', 'src');
const DIST_DIR = path.join(ROOT, 'css', 'dist');
const MANIFEST_PATH = path.join(ROOT, 'css', 'manifest.json');

// 递归列出 css/src 下全部 .css，返回相对 SRC_DIR 的 posix 路径（排序保证结果可复现）
function listSrc() {
  const out = [];
  (function walk(dir, prefix) {
    fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .forEach((ent) => {
        const rel = prefix ? prefix + '/' + ent.name : ent.name;
        if (ent.isDirectory()) walk(path.join(dir, ent.name), rel);
        else if (ent.name.endsWith('.css')) out.push(rel);
      });
  })(SRC_DIR, '');
  return out;
}

function readSrc(file) {
  return fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
}

// 原样首尾相接。强制「以换行结尾」是拼接正确性的前提，不满足就直接失败，
// 而不是悄悄产出一个少一个换行的产物。
function concat(files) {
  return files.map((f) => {
    const text = readSrc(f);
    if (!text.endsWith('\n')) {
      throw new Error(`源文件必须以换行结尾（否则与下一个文件拼接处会粘连）：${f}`);
    }
    return text;
  }).join('');
}

// 计算全部产物内容（不落盘）：shared.css 恒存在，页面产物只在有专属源文件时生成
function compile(manifest) {
  const bundles = { 'shared.css': concat((manifest.shared || []).slice()) };
  Object.keys(manifest.pages || {}).forEach((page) => {
    const files = graph.resolveBundles(manifest, page).page;
    if (files.length) bundles[page + '.css'] = concat(files);
  });
  return bundles;
}

function readDist() {
  if (!fs.existsSync(DIST_DIR)) return {};
  const out = {};
  fs.readdirSync(DIST_DIR).filter((n) => n.endsWith('.css')).forEach((n) => {
    out[n] = fs.readFileSync(path.join(DIST_DIR, n), 'utf8');
  });
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  const errors = graph.validate(manifest, listSrc());
  if (errors.length) {
    errors.forEach((e) => console.error(`  x [${e.code}] ${e.message}`));
    console.error(`\n结构校验未通过（${errors.length} 项），已中止。`);
    process.exit(1);
  }

  const bundles = compile(manifest);
  const names = Object.keys(bundles).sort();
  const onDisk = readDist();

  if (check) {
    const problems = [];
    names.forEach((n) => {
      if (!(n in onDisk)) problems.push(`${n} 尚未生成`);
      else if (onDisk[n] !== bundles[n]) problems.push(`${n} 与 css/src 不一致（dist 已过期）`);
    });
    Object.keys(onDisk).forEach((n) => {
      if (!(n in bundles)) problems.push(`${n} 是 manifest 里不存在的陈旧产物`);
    });
    if (problems.length) {
      problems.forEach((p) => console.error(`  x ${p}`));
      console.error('\n请运行 npm run build:css 重新生成。');
      process.exit(1);
    }
    console.log(`CSS 产物已是最新（v${manifest.version}，${names.length} 个产物）`);
    return;
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });
  names.forEach((n) => {
    fs.writeFileSync(path.join(DIST_DIR, n), bundles[n]);
    console.log(`  ${n}  ${Buffer.byteLength(bundles[n], 'utf8')} B`);
  });
  console.log(`CSS 构建完成（v${manifest.version}）：css/dist/ 共 ${names.length} 个产物`);
}

main();
