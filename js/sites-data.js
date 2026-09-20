// ============ 站点集 · 数据源 ============
// 想补充站点？往 SITES 数组里加一行即可，页面会自动归类、计数与搜索。
// 字段说明：
//   cat  —— 分类，必须是 CATS 里已有的 key（ai/dev/design/tool/learn/news/other）
//   title —— 站点名称（卡片会取首字母/首字生成渐变小片）
//   desc  —— 一句话描述（建议 30 字内，超出会省略）
//   link  —— 跳转网址
// 注意：若新增分类 key，需同步在 css/style.css 补两条样式——
//   1) .cc-tag.cat-xxx 的配色（参考现有 cat-dev ~ cat-other）
//   2) grad 引用的 .g1~.g6 若不够用，新增一个渐变类
window.SITES_DATA = {
  // 分类元数据：name 显示名、grad 卡片色板（对应 style.css 里的 .g1~.g6）
  CATS: {
    dev:    { name: '开发', grad: 'g1' },
    design: { name: '设计', grad: 'g2' },
    tool:   { name: '工具', grad: 'g6' },
    learn:  { name: '学习', grad: 'g5' },
    news:   { name: '资讯', grad: 'g4' },
    ai:     { name: 'AI',   grad: 'g3' },
    other:  { name: '其他', grad: 'g3' },
  },

  // 内置站点：真实常用的查资料去处
  SITES: [
    // 开发
    { cat: 'dev',    title: 'MDN Web Docs',  desc: '前端最权威的文档，语法、兼容性、示例一站查全。', link: 'https://developer.mozilla.org/zh-CN/' },
    { cat: 'dev',    title: 'GitHub',         desc: '全球最大的代码托管平台，找开源项目、看源码必备。', link: 'https://github.com' },
    { cat: 'dev',    title: 'Can I Use',      desc: '查 CSS / JS 特性的浏览器兼容性，做适配前先看一眼。', link: 'https://caniuse.com' },
    { cat: 'dev',    title: 'Stack Overflow', desc: '报错先搜这里，大半的坑都有人踩过并写了解法。', link: 'https://stackoverflow.com' },
    
    // 设计
    { cat: 'design', title: 'Figma',          desc: '在线设计工具，画原型、做组件、交付标注都在这。', link: 'https://www.figma.com' },
    { cat: 'design', title: 'Dribbble',       desc: '设计师作品社区，找灵感、看流行视觉趋势。', link: 'https://dribbble.com' },
    { cat: 'design', title: 'Google Fonts',   desc: '免费可商用的字体库，中英文字体搭配都能找到。', link: 'https://fonts.google.com' },
    
    // 工具
    { cat: 'tool',   title: 'Excalidraw',     desc: '手绘风白板，画架构图、流程图又快又好看。', link: 'https://excalidraw.com' },
    { cat: 'tool',   title: 'Regex101',       desc: '正则表达式在线调试，逐段解释匹配过程。', link: 'https://regex101.com' },
    { cat: 'tool',   title: 'Squoosh',        desc: '浏览器里直接压缩图片，支持 WebP / AVIF。', link: 'https://squoosh.app' },
    { cat: 'tool',   title: 'CodePen',        desc: '在线写 HTML/CSS/JS 小demo，随手试验样式效果。', link: 'https://codepen.io' },
     
    // 学习
    { cat: 'learn',  title: 'freeCodeCamp',   desc: '免费编程课程 + 练习，跟着做项目学得最扎实。', link: 'https://www.freecodecamp.org' },
    { cat: 'learn',  title: 'LeetCode 力扣',  desc: '算法题库与题解，按标签和难度刷题很顺手。', link: 'https://leetcode.cn' },
    
    // 资讯
    { cat: 'news',   title: '掘金',           desc: '中文技术社区，前端文章质量高、更新快。', link: 'https://juejin.cn' },
    { cat: 'news',   title: 'Hacker News',    desc: '科技圈热点聚合，看看大家都在讨论什么新技术。', link: 'https://news.ycombinator.com' },
    { cat: 'news',   title: '少数派',         desc: '效率工具与数字生活评测，发现好用的软件。', link: 'https://sspai.com' },
    { cat: 'ai',     title: 'ChatGPT',        desc: 'OpenAI 对话助手，写代码、查资料、改文案都用得上。', link: 'https://chatgpt.com' },
    { cat: 'ai',     title: 'Perplexity',     desc: 'AI 搜索引擎，答案带来源引用，查证资料很放心。', link: 'https://www.perplexity.ai' },
    { cat: 'ai',     title: 'Hugging Face',   desc: '最大的 AI 模型社区，模型、数据集、在线 Demo 都能找。', link: 'https://huggingface.co' },
    { cat: 'ai',     title: 'v0',             desc: '用一句话生成前端界面代码，出原型、找布局灵感很快。', link: 'https://v0.dev' },
    { cat: 'ai',     title: 'MCP',            desc: 'Model Context Protocol 官方站，AI 连接工具与数据的开放标准。', link: 'https://modelcontextprotocol.io' },
    { cat: 'ai',     title: 'Skills.sh',      desc: 'Agent 技能注册表，浏览并一键安装社区共享的 AI 技能包。', link: 'https://skills.sh' },

    // 其他
    { cat: 'other',  title: '中国国家图书馆',  desc: '全世界中文文献收藏最多的图书馆，也是国内最大的外文文献收藏馆。', link: 'http://read.nlc.cn' },
  ],
};
