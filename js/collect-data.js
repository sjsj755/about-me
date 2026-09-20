// ============================================================
// 芸香集 · 内容数据（只放内容，不含任何逻辑）
// 在下方数组中增删改条目即可，页面无需改动。
// ============================================================
//
// 分类定义：key 为条目的 cat 取值，增删分类只需改这里
//   name  分类名（筛选按钮显示）
//   icon  分类图标（徽标/空状态显示）
//   grad  渐变色板 class（旧卡片墙用，定义见 style.css 中 g2/g3/g5/g6）
//
window.COLLECT_CATS = {
  note:  { name: '资料', icon: '📄', grad: 'g5' },
  quote: { name: '语句', icon: '❝',  grad: 'g2' },
  book:  { name: '书籍', icon: '📖', grad: 'g6' },
  misc:  { name: '其他', icon: '✦',  grad: 'g3' },
};
//
// 字段说明：
//   id     必填，唯一标识（建议 前缀+序号：b=资料 q=语句 k=书籍 m=其他）
//   cat    必填，分类：note=资料 quote=语句 book=书籍 misc=其他
//   title  必填，标题（语句分类中显示为「— 出处」）
//   desc   必填，正文 / 引文全文（详情灯箱完整展示）
//   author 可选，作者或出处（书籍建议「作者 / 年份」格式）
//   tags   可选，标签数组（用于子标签筛选）
//   link   可选，原文/参考链接（留空则不显示「原文」按钮）
//   year   可选，年份（显示在卡片与灯箱角落）
//   user   保持 false（页面里手动添加的条目才会是 true）
//
window.COLLECT_BUILTIN = [
  // —— 资料 note ——
  { id: 'b1', cat: 'note', title: 'Transformer 架构笔记', desc: '自注意力让序列内任意两位置直接建立关系，推理时延不再依赖距离；前馈层负责逐 token 变换。多层堆叠后形成残差流，让深层网络可训练。', tags: ['AI', '架构'], link: 'https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)', year: '2026', user: false },
  { id: 'b2', cat: 'note', title: 'RAG 的核心与边界', desc: '检索增强让模型在回答前读取外部知识，能缓解幻觉也能更新到最新数据；代价是多一层召回与排序工程。索引切块、重排与查询改写往往比换模型更有收益。', tags: ['AI', 'RAG', '检索'], link: 'https://en.wikipedia.org/wiki/Retrieval-augmented_generation', year: '2026', user: false },
  { id: 'b3', cat: 'note', title: 'Prompt Engineering 要点', desc: '清晰的角色、结构化的输出格式、少样本示例与思维链，是提升一致性的四个杠杆。指令越具体，模型越稳定；把「不要做 X」换成「请做 Y」通常更有效。', tags: ['AI', '提示词'], link: 'https://docs.anthropic.com/en/docs/prompt-engineering/overview', year: '2026', user: false },
  { id: 'b4', cat: 'note', title: 'Agent 与工具调用', desc: '模型不再只输出文本，而是产出结构化工具调用，再由执行器回传结果形成闭环。状态管理、错误重试与最大步数限制，决定 Agent 是能跑还是无限打转。', tags: ['AI', 'Agent', '工具调用'], link: 'https://platform.openai.com/docs/guides/function-calling', year: '2026', user: false },
  { id: 'b5', cat: 'note', title: '上下文窗口与工程化', desc: '长上下文不等于长记忆：有效注意力会随长度稀释，末尾的信息往往比中间更可靠。控制上下文预算、做分层摘要、把无关历史移出窗口，比单纯堆长度更划算。', tags: ['AI', '上下文', '长文本'], link: 'https://platform.openai.com/docs/guides/context-windows', year: '2026', user: false },
  { id: 'b6', cat: 'note', title: '多模态与视觉理解', desc: '把图像编码为 token 与文本共用一个词表，让单一模型同时理解图文。跨模态对齐决定了能否真正"看见"，而非只描述可见物体。', tags: ['AI', '多模态', '视觉'], link: 'https://platform.openai.com/docs/guides/vision', year: '2026', user: false },
  { id: 'b7', cat: 'note', title: '模型微调 vs 提示词', desc: '提示词便宜且即时，微调让模型获得领域习惯与固定格式。样本质量远比数量重要，小而干净的指令集通常胜过大规模噪声数据。', tags: ['AI', '微调', '评估'], link: 'https://huggingface.co/docs/transformers/training', year: '2025', user: false },
  { id: 'b8', cat: 'note', title: '推理优化与显存', desc: '量化、KV Cache、连续批处理与 PagedAttention 是推理提速的常见组合。吞吐与延迟是两件事，先定指标再选优化手段。', tags: ['AI', '推理', '性能'], link: 'https://github.com/vllm-project/vllm', year: '2025', user: false },
  { id: 'b9', cat: 'note', title: '幻觉与引用约束', desc: '让模型在回答中带引用来源，是抑制编造最直接的办法。约束输出格式、要求"不知道就说不知道"、对关键事实做二次核验，构成防幻觉的三层网。', tags: ['AI', '可靠性', '引用'], link: 'https://en.wikipedia.org/wiki/Large_language_model_hallucination', year: '2025', user: false },
  { id: 'b10', cat: 'note', title: '嵌入向量与检索', desc: '把文本映射到向量空间后，语义相近的内容距离更近，检索从关键词匹配升级为语义匹配。选择合适的 embedding 模型与重排器，决定召回质量上限。', tags: ['AI', '嵌入', '向量检索'], link: 'https://www.sbert.net/docs/pretrained_models.html', year: '2025', user: false },

  // —— 语句 quote ——
  { id: 'q1', cat: 'quote', title: 'The road less traveled', desc: '“May you have enough clouds in your life to beautify a sunset.” —— 愿你的云，只为日落而生。', tags: ['句子'], year: '2026', user: false },
  { id: 'q2', cat: 'quote', title: '关于设计', desc: '“Design is not just what it looks like and feels like. Design is how it works.” —— Steve Jobs', tags: ['句子', '设计'], year: '2025', user: false },
  { id: 'q3', cat: 'quote', title: '关于代码', desc: '“Talk is cheap. Show me the code.” —— Linus Torvalds', tags: ['句子'], year: '2025', user: false },
  { id: 'q4', cat: 'quote', title: '关于创作', desc: '“I am slowly learning that creativity is a form of attention.” —— 创造力，是一种注意力的练习。', tags: ['句子', '写作'], year: '2024', user: false },
  { id: 'q5', cat: 'quote', title: '关于日常', desc: '“Stay hungry, stay foolish.” —— 求知若饥，虚心若愚。', tags: ['句子'], year: '2024', user: false },
  { id: 'q6', cat: 'quote', title: '关于生活', desc: '“生活不是活给别人看的，而是活给自己记的。”', tags: ['句子', '生活'], year: '2024', user: false },

  // —— 书籍 book ——
  { id: 'k1', cat: 'book', title: '史记', author: ' 司马迁 / 西汉·约前104年始撰', desc: '中国第一部纪传体通史，原名《太史公书》，全书一百三十篇，由本纪、表、书、世家和列传组成，叙述自传说中的黄帝至汉武帝时期的历史。它开创纪传体史书范式，并以人物叙事、历史判断和文学表现力影响后世史学与散文', tags: ['书', '历史'], link: 'https://www.wenshuoge.com/book/6/%E5%8F%B2%E8%AE%B0', year: '2026', user: false },
  { id: 'k2', cat: 'book', title: '吕著中国通史', author: '吕思勉 / 1941', desc: '因为它不只是讲帝王将相，更关注平民百姓的日常生活，所以读起来特别有亲切感。书中还提出了很多“石破天惊”的独到见解，文字平实，非常适合作为中国历史的入门读物', tags: ['书', '历史'], link: 'https://www.wenshuoge.com/book/9826/%E5%90%95%E8%91%97%E4%B8%AD%E5%9B%BD%E9%80%9A%E5%8F%B2',year: '2026', user: false },
  { id: 'k3', cat: 'book', title: '南史', author: '李大师及其子李延寿 / 659', desc: '它在史料上做了大量删削和补充，有“事增文省”的美誉（内容更丰富但文字更简约），但也因此存在部分内容失实的问题。总的来说，它是了解南朝历史不可或缺的经典之作', tags: ['书', '历史'], year: '2026', link: 'https://www.wenshuoge.com/book/182/%E5%8D%97%E5%8F%B2',user: false },
  { id: 'k4', cat: 'book', title: '几何原本', author: '欧几里得 / 公元前300年左右', desc: '是数学经典，更被视为用公理化方法建立演绎体系的最早典范，深刻影响了后世科学的发展', tags: ['书', '数学'], year: '2025',link :'http://aleph0.clarku.edu/~djoyce/java/elements/elements.html', user: false },
  { id: 'k5', cat: 'book', title: '代码整洁之道', author: 'Robert C. Martin / 2008', desc: '好代码要像刚写的一样——干净、短小、命名清楚，别让别人猜你在想什么。', tags: ['书', '工程'], year: '2023', user: false },


  // —— 其他 misc ——
  { id: 'm1', cat: 'misc', title: '灵感清单：界面质感', desc: 'Apple HIG / Awwwards / Dribbble Trending——找质感时固定看这三处。', tags: ['灵感', '收藏'], link: 'https://awwwards.com', year: '2026', user: false },
  { id: 'm2', cat: 'misc', title: '喜欢的字体组合', desc: 'Quicksand + Noto Sans SC，圆润英文配干净中文，适合清新的个人站。', tags: ['字体', '设计'], year: '2026', user: false },
];
