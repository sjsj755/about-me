// ============================================================
// 笔记本 · 内置示例数据（只放内容，不含任何逻辑）
// 在下方数组中增删改条目即可，页面无需改动。
// 字段说明：
//   id    唯一标识（内置条目用 n 前缀，勿与用户 u 前缀重复）
//   title 便签标题
//   date  记录日期（YYYY-MM-DD）
//   desc  一句话摘要（便签正面只展示摘要，正文在链接里）
//         ⚠️ 上限 60 字（与 notes.html 的 maxlength 一致）：便签纸尺寸固定，
//         超过 60 字会被裁掉半截（-webkit-line-clamp），配摘要时请自己数一下长度。
//   link  文档链接，不限来源（飞书文档 / 博客 / GitHub 仓库都可以，便签上不标来源）；
//         下面是占位示例，换成自己的文档地址即可；留空则点击便签打开本地详情弹窗
//   user  内置条目固定 false（不可删除），用户笔记为 true
// ============================================================
window.NOTES_BUILTIN = [
  { id: 'n1', title: 'vibe coding', date: '2026-08-10', desc: '编程学习与 AI 协作的方法论知识库，共 7 篇文档，覆盖问题求解、vibe coding 分工与工程门禁。', link: 'https://vcnb6bik6pl4.feishu.cn/wiki/space/7687865654786952488?ccm_open_type=lark_wiki_spaceLink&open_tab_from=wiki_home', user: false },
  { id: 'n2', title: 'skill设计', date: '2026-08-12', desc: 'Skill 是给 AI 写指令而非给人：三级分层架构、自由度光谱、六步流程，用最少 token 给最精准约束。', link: 'https://blog.ahzoo.cn/p/7382919/', user: false },
];