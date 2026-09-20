// ============ 关于我 · 数据源 ============
// 关于页的所有文字内容集中在这里，改完刷新即可，无需动 HTML 和 main.js。
// 字段说明：
//   avatar   —— 头像图片路径（如 'images/about/Profile.webp'）；留空则显示默认渐变占位
//   roles    —— 头像旁的身份标签（一句话）
//   intro    —— 自我介绍面板：title 面板标题，paragraphs 段落数组（可加 <b>、<em> 等行内标签）
//   skills   —— 技能面板：title 面板标题，items 技能标签数组
//   timeline —— 经历足迹：title 标题，items 数组（period 时间段、text 描述，按时间倒序排列）
//   cta      —— 底部按钮数组：text 按钮文字、link 跳转地址、style 按钮样式（primary 实心 / ghost 描边）
//               action 为 'contact' 时点击弹出联系表单，而非跳转
//   contact  —— 联系表单配置：title/subtitle 弹窗文案；email 收件邮箱；
//               formEndpoint 表单直发服务地址（如 Formspree 的 https://formspree.io/f/xxxx，
//               注册后填入即可让留言直接进邮箱）；留空则唤起访客邮件客户端发送
//   footer   —— 页脚版权后的一句话标语
// 注意：名字与版权年份不在这里，统一在 js/links.js 的 SITE 中维护。
const ABOUT_DATA = {
  avatar: 'images/about/Profile.webp',

  roles: 'AI 应用开发 / 全栈开发 · 2027 届',

  intro: {
    title: '自我介绍',
    paragraphs: [
      '专注 <b>LLM 应用落地</b>，独立完成 4 个从 0 到 1、完整上线且含量化评测的 AI 项目，全部具备 GitHub 仓库与可访问的在线演示。覆盖三条主线：<b>RAG 全链路</b>（解析→分块→多路召回→重排→拒答→评测）、<b>Agent 开发</b>（LangGraph 编排、多智能体协作）、<b>LLM 工程化</b>（防幻觉防注入、降级容错、压测与 CI/CD）。',
      '习惯用数据验证效果：食材识别准确率 0.944、检索 recall@5 = 0.755、接口 search P95 120ms，累计编写 <b>460+ 个自动化测试用例</b>并接入 CI 门禁。我相信好的工程源于可度量与可复现，把每一件小事做到精致。',
    ],
  },

  skills: {
    title: '我的技能',
    items: [
      'RAG 全链路',
      'Agent / LangGraph',
      'LLM 工程化',
      'Python / FastAPI',
      'React / Vue 3',
      'MySQL / Redis',
      '自动化测试',
      'Docker / CI-CD',
    ],
  },

  timeline: {
    title: '经历足迹',
    items: [
      { period: '2026.07 — 至今',  text: '数学教材 RAG 智能问答系统：独立开发并持续迭代，自建评测集驱动检索优化' },
      { period: '2025.08 — 2026.08', text: 'A2A 协议热点分析 Agent 服务：实现 A2A v1.0 完整服务端与双层去重管线' },
      { period: '2025.06 — 2026.06', text: 'AI 菜谱推荐系统：LangGraph 六节点工作流，识别准确率 0.944，已上线运行' },
    ],
  },

  cta: [
    { text: '查看我的作品',    link: 'works.html',                 style: 'primary' },
    { text: '联系我',          action: 'contact',                  style: 'ghost' },
    { text: 'GitHub @sjsj755', link: 'https://github.com/sjsj755', style: 'ghost' },
  ],

  contact: {
    title: '联系我',
    subtitle: '项目交流、合作邀请，或随手打个招呼，都欢迎留言。',
    email: '3398935844@qq.com',
    formEndpoint: '',
  },

  footer: '用数据验证创意，让每一个 AI 项目真实落地',
};
