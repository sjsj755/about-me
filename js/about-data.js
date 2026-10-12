// ============ 关于我 · 数据源 ============
// 关于页的所有文字内容集中在这里，改完刷新即可，无需动 HTML 和 main.js。
// 字段说明：
//   avatar   —— 头像图片路径（如 'images/about/Profile.webp'）；留空则显示默认渐变占位
//   roles    —— 头像旁的身份标签（一句话）
//   intro    —— 自我介绍面板：title 面板标题，paragraphs 段落数组（可加 <b>、<em> 等行内标签）
//   skills   —— 技能面板：title 面板标题；
//               groups 分组展示（推荐）：label 组名，items 该组技能标签；
//               也可用 items 平铺一个数组（不分组的旧格式，二选一）
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

  roles: '2027 届本科，正在学习与 AI 共事',

  intro: {
    title: '感悟',
    paragraphs: [
      // 每个字符串是一段；支持 <b>、<em> 等行内标签
      '能亲历这场新的技术革命，是我的幸运。它让我得以想象，珍妮纺纱机当年如何撞开旧世界：效率轰鸣，秩序重排，无数人的命运被卷入其中。',
      'AI 真的很厉害。你能做游戏、做短剧、做网页，甚至我买一块开发板，也能帮我做嵌入式。你降低了学习的门槛，提高了工作的效率，也逼我们重新回答那个古老的问题：我到底要成为什么？',
      '所以我把问题拆成了一件件小事：写代码、做项目、记录过程，边做边改答案。' , 
      '这页网站是其中一部分，作品集里还有更多。' ,
    ],
  },

  skills: {
    title: '我的技能',
    groups: [
      { label: '语言',        items: ['Python', 'JavaScript', 'TypeScript'] },
      { label: '前端',        items: ['React', 'Vue.js', 'HTML/CSS'] },
      { label: '后端',        items: ['FastAPI', 'Node.js', 'Spring Boot'] },
      { label: '数据 / 工具', items: ['MySQL', 'Redis', 'Hadoop', 'OpenCV'] },
    ],
  },

  timeline: {
    title: '经历足迹',
    items: [
      // 在这里填写经历，格式：{ period: '时间段', text: '描述' }，按时间倒序排列
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
