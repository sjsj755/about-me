// Playwright 配置：纯静态站点。
// webServer 用 tools/dev-server.js（Node 静态服务器，含入参校验与保活保障）：
// 此前用 python -m http.server，在 Python 3.14 下长时间运行会死亡，导致测试尾部
// 用例批量 ERR_CONNECTION_REFUSED（2026-09-28 体检结论）。
// 不设 reuseExistingServer：采用默认值（仅 CI 复用），本地总是启动全新服务器，
// 避免复用遗留孤儿进程造成不可复现的假失败。
// 浏览器用系统已装的 Edge/Chrome 通道（channel），避免下载 Playwright 自带 Chromium
// （cdn.playwright.dev 在国内网络下常不可达）。可用 PW_CHANNEL=chrome 覆盖。
const { defineConfig } = require('@playwright/test');

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  // 串行执行：本机用系统 Edge 通道，并发多实例会因资源争抢产生假失败
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: `node tools/dev-server.js ${PORT}`,
    url: BASE + 'index.html',
    timeout: 60000,
  },
  use: {
    baseURL: BASE,
    browserName: 'chromium',
    channel: process.env.PW_CHANNEL || 'msedge',
  },
});
