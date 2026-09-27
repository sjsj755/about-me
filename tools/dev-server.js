// tools/dev-server.js — Playwright webServer 专用静态文件服务器
//
// 用途：替代 `python -m http.server`。Python 3.14 下该服务器在长时间负载后会死亡，
// 导致测试尾部用例批量 ERR_CONNECTION_REFUSED（2026-09-28 体检结论）。
// 仅绑定回环地址、仅供本地测试使用；生产环境仍由 nginx 提供（见 deploy/nginx/person.conf）。
//
// 入参校验清单：端口（1-65535 整数）、HTTP 方法（GET/HEAD 白名单）、
// URL 解码（畸形百分号 400）、空字节与反斜杠（400）、
// 点开头的隐藏段（404）、相对路径越界（根前缀校验，404）。

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---- 启动参数校验 ----
const rawPort = process.argv[2] || process.env.PORT || 4173;
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[dev-server] 非法端口: ${rawPort}（需要 1-65535 的整数）`);
  process.exit(1);
}

// 服务根目录固定为项目根（tools/ 的上一级），与进程 cwd 无关
const ROOT = path.resolve(__dirname, '..');

// ---- MIME 表（覆盖站点全部资源类型，未识别类型按二进制流处理）----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.xml': 'application/xml; charset=utf-8',
};

function fail(res, status, text) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function notFound(res) {
  fail(res, 404, '404 Not Found');
}

function serveFile(res, method, filePath, size) {
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': size,
    // 测试服务器禁用缓存：任何文件改动立即对用例可见
    'Cache-Control': 'no-store',
  });
  if (method === 'HEAD') return res.end();
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => fail(res, 500, '500 Internal Server Error')); // stat 与读取间的竞态兜底
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  req.on('error', () => res.destroy());
  res.on('error', () => res.destroy());

  // 方法白名单：测试仅需 GET/HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('405 Method Not Allowed');
  }

  // URL 解码：畸形百分号编码直接 400
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return fail(res, 400, '400 Bad Request');
  }

  // 空字节与反斜杠拒绝（后者防 Windows 路径分隔符混淆）
  if (pathname.includes('\0') || pathname.includes('\\')) {
    return fail(res, 400, '400 Bad Request');
  }

  // 点开头段一律 404（.git/.trae 等隐藏内容，'..' 段也在此被拒绝）
  if (pathname.split('/').some((seg) => seg.startsWith('.'))) {
    return notFound(res);
  }

  // 越界双保险第二层：解析后必须仍位于根目录内
  const filePath = path.resolve(ROOT, '.' + pathname);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return notFound(res);
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // 目录 → 尝试其下 index.html（支持 / 与 /resume/ 形式）；否则 404，不提供目录列表
      if (!err && st.isDirectory()) {
        const idx = path.join(filePath, 'index.html');
        return fs.stat(idx, (e2, st2) => {
          if (e2 || !st2.isFile()) return notFound(res);
          serveFile(res, req.method, idx, st2.size);
        });
      }
      return notFound(res);
    }
    serveFile(res, req.method, filePath, st.size);
  });
});

// 半开连接/畸形请求兜底，避免 socket 异常拖垮进程
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.on('error', (e) => {
  console.error(`[dev-server] 监听失败: ${e.message}`);
  process.exit(1);
});

// 保活保障：本服务器的首要职责是活完整个测试流程，未捕获异常只记录不退出
process.on('uncaughtException', (e) => console.error('[dev-server] uncaught:', e && e.message));
process.on('unhandledRejection', (e) => console.error('[dev-server] unhandledRejection:', e && e.message));

server.listen(port, '127.0.0.1', () => {
  console.log(`[dev-server] http://127.0.0.1:${port}  root=${ROOT}`);
});
