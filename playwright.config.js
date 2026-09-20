// Playwright 配置：纯静态站点。
// 用 Python 内置 http.server 提供 HTTP 服务（而非 file://）：
// file:// 属于不透明源，localStorage 不可用，会让依赖本地存储的页面测试失真。
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
    command: `python -m http.server ${PORT} --bind 127.0.0.1`,
    url: BASE + 'index.html',
    reuseExistingServer: true,
    timeout: 60000,
  },
  use: {
    baseURL: BASE,
    browserName: 'chromium',
    channel: process.env.PW_CHANNEL || 'msedge',
  },
});
