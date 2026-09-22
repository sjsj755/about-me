// ============ CSS 结构图（纯函数，零 I/O） ============
// 职责：把 css/manifest.json 解析成「每个产物由哪些源文件按什么顺序拼成」，
// 并校验结构约束（层级单向 / 无重复入口 / 无孤儿文件）。
// 本文件不做任何文件读写 —— 一切 I/O 都在 tools/build-css.js，
// 这样这些规则可以被直接调用与断言，不需要碰磁盘。
'use strict';

// 源文件 → 所属层。目录即层级；根目录下只允许三个具名文件。
// 层的用途只有一个：判断文件「该待在哪个产物里」与「能不能排在这个位置」，
// 不用来规定产物内部的排列 —— 那是 manifest 数组顺序的事。
function layerOf(file) {
  const f = String(file).replace(/\\/g, '/');
  if (f === 'tokens.css') return 'tokens';
  if (f === 'base.css') return 'base';
  if (f === 'overrides.css') return 'overrides';
  if (f.startsWith('components/')) return 'components';
  if (f.startsWith('pages/')) return 'pages';
  return null;
}

// 某个页面最终要加载的产物各自的源文件清单。
// overrides 是全局强制追加的，不随页面变化，且永远排在最后。
function resolveBundles(manifest, page) {
  const shared = (manifest.shared || []).slice();
  const own = ((manifest.pages || {})[page] || []).slice();
  const overrides = (manifest.overrides || []).slice();
  return { shared, page: own.concat(overrides) };
}

// 位置约束。这里刻意不强制「层级非递减」，原因：
// 拼接顺序就是级联顺序，唯一来源是 manifest 数组的排列；而 style.css 原本就是
// base / component / page 区块交错的，强制按层分组必然改变级联顺序 ——
// 而 Phase A 的验收标准恰恰是产物逐字节等价。因此只守住两条真正会出事的位置规则：
//   1) tokens.css 必须最先（变量要先于使用它的规则）
//   2) overrides.css 若参与页面产物，必须最后（晚期覆盖不能被页面样式反超）
// enforceOverridesLast 只对页面产物开启：Phase A 阶段 overrides.css 还留在共享包里。
function positionErrors(files, where, enforceOverridesLast) {
  const out = [];
  files.forEach((f, i) => {
    const layer = layerOf(f);
    if (layer === null) {
      out.push({
        code: 'E-ORPHAN', where, file: f,
        message: `${f} 没有归属层级：根目录只允许 tokens.css / base.css / overrides.css，其余须放进 components/ 或 pages/`,
      });
      return;
    }
    if (layer === 'tokens' && i !== 0) {
      out.push({
        code: 'E-ORDER', where, file: f,
        message: `${where} 位置违规：${f} 必须排在最前（变量要先于使用它的规则），当前在第 ${i + 1} 位`,
      });
    }
    if (layer === 'overrides' && enforceOverridesLast && i !== files.length - 1) {
      out.push({
        code: 'E-ORDER', where, file: f,
        message: `${where} 位置违规：${f} 必须排在最后（晚期覆盖不能被页面样式反超），当前在第 ${i + 1} 位`,
      });
    }
  });
  return out;
}

// 全量校验。srcFiles = css/src 下实际存在的全部 .css（相对 posix 路径）。
// 返回错误数组，非空即阻断构建。
function validate(manifest, srcFiles) {
  const errors = [];

  if (!manifest || typeof manifest.version !== 'string' || !manifest.version) {
    errors.push({ code: 'E-VERSION', where: 'manifest', message: 'manifest.version 缺失：它是各页 ?v= 缓存参数的唯一来源' });
  }

  // 收集全部声明：文件 → 声明位置
  const declared = [];
  (manifest.shared || []).forEach((f) => declared.push({ f, where: 'shared' }));
  Object.keys(manifest.pages || {}).forEach((p) => {
    ((manifest.pages || {})[p] || []).forEach((f) => declared.push({ f, where: `pages.${p}` }));
  });
  (manifest.overrides || []).forEach((f) => declared.push({ f, where: 'overrides' }));

  // 1) 声明了但不存在
  const actual = new Set(srcFiles);
  declared.forEach(({ f, where }) => {
    if (!actual.has(f)) {
      errors.push({ code: 'E-MISSING', where, file: f, message: `${where} 声明了 ${f}，但 css/src 下没有这个文件` });
    }
  });

  // 2) 同一文件被声明多次（G6：同一职责不允许存在多套实现入口）
  const seen = new Map();
  declared.forEach(({ f, where }) => {
    if (seen.has(f)) {
      errors.push({ code: 'E-DUP', where, file: f, message: `${f} 被重复声明：${seen.get(f)} 与 ${where}` });
    } else {
      seen.set(f, where);
    }
  });

  // 3) 游离在 manifest 之外的源文件（永远不会进入产物）
  srcFiles.forEach((f) => {
    if (!seen.has(f)) {
      errors.push({ code: 'E-UNUSED', where: 'src', file: f, message: `${f} 未被 manifest 引用，永远不会进入产物` });
    }
  });

  // 4) 位置约束（tokens 最先 / overrides 在页面产物末位 / 无游离层级）
  errors.push(...positionErrors((manifest.shared || []).slice(), 'shared', false));
  Object.keys(manifest.pages || {}).forEach((p) => {
    errors.push(...positionErrors(resolveBundles(manifest, p).page, `pages.${p}`, true));
  });

  return errors;
}

// 各页 HTML 里的 ?v= 缓存参数必须等于 manifest.version。
// manifest.version 自称是缓存参数的唯一来源，但没有任何环节会自动把它同步到 HTML ——
// 漏改一页，该页就会在 nginx 的 30d immutable 缓存下继续吃旧 CSS/JS（曾实际发生）。
// files 由调用方读好传入（本文件零 I/O）：[{ name, text }]。同一页可能出现多处同一错误
// 版本（每个 asset 一处），只报首个，避免刷屏。
function cacheVersionErrors(manifest, files) {
  const want = manifest && manifest.version ? String(manifest.version) : '';
  const errors = [];
  files.forEach(({ name, text }) => {
    const re = /[?&]v=(\d+)/g;
    const reported = new Set();
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1] === want || reported.has(m[1])) continue;
      reported.add(m[1]);
      const line = text.slice(0, m.index).split('\n').length;
      errors.push({
        code: 'E-CACHEVER', where: name, file: name,
        message: `${name}:${line} 的 v=${m[1]} 与 manifest.version（${want}）不一致：升级版本号后须同步所有页面的 ?v=`,
      });
    }
  });
  return errors;
}

module.exports = { layerOf, resolveBundles, validate, cacheVersionErrors };
