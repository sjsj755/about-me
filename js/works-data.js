// ============ 分类标签配置 ============
// 筛选胶囊按此数组生成（顺序即显示顺序）。
//   key   对应上方作品的 cat
//   label 胶囊显示文案
// 数据里出现而此处未配置的分类会自动追加到胶囊末尾（文案回退为该分类第一个作品的 catText）。
const WORK_CATS = [
  { key: 'web', label: 'Web 应用' },
  { key: 'agent', label: 'Agent' },
  { key: 'collect', label: '收集本' },
];
// ============ 作品内容集中配置 ============
// 补充/修改作品只改这个文件：网格、筛选胶囊、灯箱全部自动生成，无需动 HTML 和 main.js。
//
// WORKS_DATA 字段说明：
//   title   标题
//   cat     分类 key（英文，用于筛选；同 key 归为一类，对应下方 WORK_CATS）
//   catText 分类显示名（仅作卡片副标题；筛选胶囊文案由 WORK_CATS 决定）
//   year    年份
//   desc    灯箱里的详细介绍
//   skills  灯箱里的技能标签（数组）
//   img     封面图路径（留空则用 grad 渐变占位）
//   grad    占位渐变类：g1 ~ g6
//   ratio   封面宽高比，如 '3 / 4'（瀑布流高低错落；省略则默认 '4 / 3'）
//   link    直接写链接（外链 URL 或站内页面如 'collect.html'）
//   linkKey 外链在 js/links.js 的 WORK_LINKS 里的键名（与 link 二选一，link 优先）
const WORKS_DATA = [
  { title: '寻·旅记', cat: 'web', catText: 'web旅行规划', year: '2026', desc: '专注「行程规划 + 足迹记录」，将一次旅行完整地串成一段可回看的旅程。核心功能覆盖：智能行程编排、地图与景点速查、实时天气推送、花销流水记账，以及按时间轴回看足迹。以海岛清新蓝与沙滩暖米白为基调，用「详情页一键收藏」「滑动即切换日期」等交互，让每一次点击都自然、明确、有反馈——像海浪一样柔和而流畅。', skills: ['智能行程编排', '地图 / 景点速查', '天气与路线'], img: 'images/works/travl.webp', grad: 'g1', ratio: '3 / 4', linkKey: 'works1' },
  { title: '热点agent', cat: 'agent', catText: 'a2a-agent', year: '2026', desc: '专注「AI 热点追踪与深度分析」，将散落在 GitHub、博客、Hacker News 与 arXiv 上的技术浪潮，串成一段可回溯的知识旅程。核心能力覆盖：多源并发采集、文本与语义双重去重合并、LLM 三维评分（关联度/热度/可信度）、逐条深度分析，以及日报/周报自动生成。以 Task + Artifact 的标准契约交付，通过 A2A 协议让每一次调用都自然、明确、可复用——像一张智能雷达屏，实时扫描技术前沿的潮汐涌动。受限于成本目前仅给出项目地址', skills: ['智能采集', '深度分析', '报告生成'], img: 'images/works/agent-a2a.webp', grad: 'g2', ratio: '4 / 3', linkKey: 'works2' },
  { title: 'ai厨师', cat: 'web', catText: 'web厨师', year: '2026', desc: '专注「冰箱里有什么，就推荐什么菜」，将散落的食材串成可烹饪的美味旅程。核心能力覆盖：口语化输入识别、食材标准化映射、混合检索召回、缺料最少排序、AI 推荐文案生成，以及快路径秒级响应。以 parse → link → filter → retrieve → rank → generate 的 LangGraph 流水线驱动，让每一次推荐都有迹可循、可插拔、可降级——像一位懂食材的厨师，温和而可靠', skills: ['口语化识别', '轻量便捷', '精准推荐'],img: 'images/works/chef.webp', grad: 'g3', ratio: '1 / 1', linkKey: 'works3' },
  { title: '洛克图鉴', cat:'web', catText: '游戏图鉴', year: '2026', desc: '一个功能完善的游戏宠物图鉴网站，为玩家提供宠物信息查询、属性克制查看、技能检索、特性展示等核心功能，打造一站式的游戏数据查询平台。', skills: ['资料', '游戏'], img: 'images/works/roke.webp',grad: 'g4', ratio: '4 / 5', linkKey: 'works4' },
  { title: 'bilibi弹幕助手', cat:'web', catText: '弹幕助手', year:'2026', desc: '基于 Python + React 的 B 站直播弹幕实时采集与分析工具，支持直播中实时轻量分析和直播回放离线深度分析两种模式', skills:['工具'],img: 'images/works/bilibil.webp',grad:'g5',ratio:'5/5',linkkey:'works5'},
  { title: '数学rag', cat:'rag', catText: 'rag', year:'2026', desc: '这是一个面向数学教材与学习资料的智能问答工具。上传数学资料后，系统会自动整理内容，形成可按问题查找的知识库。之后，你可以像请教老师一样提问，系统会从资料中找出相关段落，生成答案，并标注来源和页码，方便核对。', skills:['rag','工具'],img: 'images/works/rag.webp',grad:'g6',ratio:'5/6',linkkey:'works6'},
  
];


