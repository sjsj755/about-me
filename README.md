# 个人作品集 · Portfolio

一个纯静态的个人作品集网站，采用玻璃拟态（Glassmorphism）视觉风格，包含作品展示、语录收藏、站点导航、学习笔记、相片墙与个人简介等板块。

## 页面

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 首页门户 | `index.html` | 中央形象 + 环绕式导航，内置日历（支持标记与农历） |
| 作品集 | `works.html` | 作品卡片网格，支持分类筛选与灯箱详情 |
| 芸香集 | `collect.html` | 语录/收藏条目，瀑布流卡片墙 + 详情弹窗 |
| 站点集 | `sites.html` | 常用站点导航 |
| 笔记本 | `notes.html` | 学习笔记，本地新增与查看 |
| 相片 | `photos.html` | 相片墙 |
| 关于我 | `about.html` | 个人简介、技能与联系方式 |

## 技术栈

- **原生 HTML / CSS / JavaScript**：无框架、无构建步骤，直接由静态服务器托管
- **GSAP + ScrollTrigger 3.12.5**：滚动动效与入场动画
- **Lenis 1.1.14**：平滑滚动
- **solarlunar**：日历农历换算
- **localStorage**：日历标记、用户新增条目等本地数据持久化
- **Playwright**：端到端测试（本地开发用）

外部 SDK 全部通过 CDN（jsdelivr）加载，并由 `js/fx.js` 统一封装为适配层：CDN 不可达时业务模块自动降级为「无动画但内容完整可见」，避免整页空白。

## 目录结构

```
.
├── index.html / works.html / collect.html / sites.html
├── notes.html / photos.html / about.html      各页面
├── css/
│   └── style.css                              全站样式
├── js/
│   ├── fx.js                                  动效 SDK 适配层（GSAP / Lenis / solarlunar）
│   ├── ui.js                                  公共工具（localStorage 安全读写、弹窗等）
│   ├── links.js                               站点配置与外部链接
│   ├── main.js                                首页门户与日历逻辑
│   ├── *-data.js                              各页内置数据（纯数据，无逻辑）
│   ├── collect.js / notes.js / sites.js       对应页面的交互逻辑
│   └── vendor/solarlunar.min.js               第三方库
├── images/                                    图片资源
├── tests/                                     端到端测试（未随仓库发布）
└── deploy/                                    Nginx 部署配置（未随仓库发布）
```

数据与逻辑分离：`*-data.js` 只存放内容，页面逻辑不内联内容；用户自建条目写入 localStorage，与内置数据互不干扰。

## 本地运行

必须通过 HTTP 访问，**不能直接双击打开 HTML 文件**——`file://` 属于不透明源，localStorage 不可用，依赖本地存储的页面会失真。

```bash
# 任选一种静态服务器，端口以 4173 为例
python -m http.server 4173 --bind 127.0.0.1
npx serve -l 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 本地测试

端到端测试位于 `tests/`，未随仓库发布，仅在本地开发时使用。

```bash
npm install
npx playwright test

# 默认使用系统已安装的 Edge；可切换为 Chrome
PW_CHANNEL=chrome npx playwright test
```

测试通过 Python 内置 `http.server` 提供 HTTP 服务（见 `playwright.config.js`），串行执行以避免并发导致的假失败。

## 浏览器兼容

- 使用 `viewport-fit=cover` 与 `env(safe-area-inset-*)` 适配刘海屏
- 输入类元素字号固定 `16px`，避免 iOS Safari 聚焦时自动缩放
- 全屏高度使用 `svh` / `dvh` 单位，规避移动端视口溢出
- 交互元素触控区域不小于 44×44px

## 许可

个人项目，仅供学习与交流参考。
