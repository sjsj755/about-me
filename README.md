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

- **原生 HTML / CSS / JavaScript**：无框架，浏览器直接运行；CSS 有一个编译期拼接步骤（见下方「构建与校验」）
- **GSAP + ScrollTrigger 3.12.5**：滚动动效与入场动画
- **Lenis 1.1.14**：平滑滚动
- **solarlunar**：日历农历换算
- **localStorage**：日历标记、用户新增条目等本地数据持久化
- **Playwright**：端到端测试（本地开发用）

外部 SDK（GSAP / ScrollTrigger / Lenis / solarlunar）全部本地化到 `js/vendor/`，不再依赖外部 CDN，并由 `js/fx.js` 统一封装为适配层：SDK 缺失或损坏时业务模块自动降级为「无动画但内容完整可见」，避免整页空白。

## 构建与校验

CSS 按 `css/manifest.json` 声明的顺序在编译期拼接为产物，**不使用 `@import`**（避免请求瀑布）：

```bash
npm run build:css   # 由 css/src/** 生成 css/dist/：shared.css + 7 个页面产物
npm run check       # 门禁：JS 语法 + CSS 结构与产物一致性 + 白色面刻度契约 + 缓存版本一致性 + 页面样式引用
npm run test        # Playwright 端到端测试
```

- 样式源码在 `css/src/`，产物 `css/dist/` **已入库**；每页恰好加载两个样式文件：`shared.css`（tokens + base + components）与 `css/dist/<页面>.css`（该页 pages + overrides）
- 改样式请改 `css/src/**` 再跑 `npm run build:css`；直接改 `css/dist/` 会被 `npm run check` 拦下
- `manifest.json` 的数组顺序**就是级联顺序**，新增源文件必须登记，否则构建会以 `E-UNUSED` 中止
- 白色面（控件 / 指示器 / 浮层 / 文字）统一取自 `css/src/tokens.css` 的 `--white` / `--w-*` 刻度，别处禁止再写 `rgba(255,255,255,…)` 或 `#fff`

## 目录结构

```
.
├── index.html / works.html / collect.html / sites.html
├── notes.html / photos.html / about.html      各页面
├── css/
│   ├── manifest.json                          源文件与产物的映射（级联顺序的唯一来源）
│   ├── src/                                   样式源码：tokens / base / components / pages / overrides
│   └── dist/                                  构建产物：shared.css + 7 个页面产物
├── js/
│   ├── fx.js                                  动效 SDK 适配层（GSAP / Lenis / solarlunar）
│   ├── ui.js                                  公共工具（localStorage 安全读写、弹窗等）
│   ├── links.js                               站点配置与外部链接
│   ├── main.js                                首页门户与日历逻辑
│   ├── *-data.js                              各页内置数据（纯数据，无逻辑）
│   ├── collect.js / notes.js / sites.js       对应页面的交互逻辑
│   └── vendor/                                第三方库本地副本（gsap / ScrollTrigger / lenis / solarlunar）
├── images/                                    图片资源
├── tools/                                     CSS 构建与门禁校验脚本
├── tests/                                     端到端测试
└── deploy/                                    Nginx 部署配置（未入库）
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

端到端测试位于 `tests/`（9 个 spec / 66 个用例），覆盖 7 个页面与弹窗、灯箱、SDK 降级、视觉基线与白色面刻度接线等关键路径。

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
