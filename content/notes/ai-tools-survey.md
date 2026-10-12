# AI 工具平台调研报告（2025–2026）

> 调研范围：游戏开发、视频制作、语音/音频、查资料/研究四大类 AI 平台，以及**不同平台之间的组合方式**。
> 数据来源：2026 年公开资料。

---

## 一、游戏开发类 AI 平台

游戏开发链路长（美术资产→动画→音效→关卡→测试→发行），因此这类平台多按环节专精，最终汇入 **Unity / Unreal / GDevelop** 等引擎。

| 平台 | 核心能力 | 输出格式 / 集成 | 备注 |
|------|---------|----------------|------|
| **Meshy AI** | 文字/图片→3D 资产生成 | FBX/GLB/OBJ + PBR 贴图；Unity/Unreal/Roblox 插件 | 3D 资产生成代表 |
| **Scenario** | 训练自定义模型生成 2D 游戏素材 | 精细风格控制 | 适合需要统一美术风格的项目 |
| **Ludo.ai** | 精灵图/图标/UI/纹理/音乐/3D/视频 | 可直接拖入引擎 | 一站式多模态 |
| **Layer AI** | 图片/视频/3D/音频，背后 300+ 模型 | 单一界面调多模型 | 多模态整合代表 |
| **Cascadeur** | AI 3D 角色动画 | 关键帧→自动补全动作 | 动画环节专精 |
| **Promethean AI** | 环境资产生成与管理 | 引擎集成 | 适合场景搭建 |
| **Rosebud AI** | AI 游戏创作（代码+资产） | 浏览器即玩 | 偏轻量/原型 |
| **Jenova** | LLM+生成式 AI：2D/3D 资产、程序化世界、叙事、角色行为、代码 | — | 全栈生成 |
| **GDevelop** | 开源无代码 AI 游戏引擎 | 可发布到 Steam / 应用商店 | 引擎本身带 AI |
| **modl.ai** | AI 游戏测试 + 玩家行为分析 | — | 测试环节 |
| **Higgsfield** | 游戏资产创作 | — | — |

**选型要点**：需要统一美术风格选 Scenario；快速堆 3D 选 Meshy；动画选 Cascadeur；想少切换工具选 Layer AI / Ludo.ai；发行出口仍是 Unity/Unreal/GDevelop。

---

## 二、视频制作类 AI 平台

分为 **生成型**（文/图→视频）、**编辑套件型**（剪辑+AI 功能）、**数字人型**、**聚合路由型** 四档。

### 2.1 生成型（文/图→视频）

| 平台 | 特点 | 价格 |
|------|------|------|
| **Google Veo 3 / Veo 3.1** | 电影级画质，每月免费额度 | Plus $4.99 / Pro $19.99 |
| **OpenAI Sora 2** | 扩散模型，文+图→视频，最长 60 秒；经 ChatGPT / Azure | 含在 ChatGPT 订阅 |
| **Runway Gen-4.5** | 电影风 + 生成式编辑（运镜、扩展） | 免费版 + Standard $12/月 |
| **Kling AI 3.0** | 图生视频强、面部一致、身体物理好；日常首选 | — |
| **MiniMax 海螺 / H3** | 质量/价格比好 | — |
| **Dreamina（字节/CapCut）** | 产品视频、动画角色 | — |
| **Pika / PixVerse V6 / Luma / Wan 2.2-2.7 / Vidu / Seedance / Higgsfield** | 各有侧重 | — |
| **Genmo Mochi 1** | 开源，可本地部署 | 免费 |
| **Meta Vibes** | 社交平台集成 | — |

### 2.2 编辑套件型

| 平台 | 核心能力 | 价格 |
|------|---------|------|
| **LTX Studio** | 逐镜头分镜、创意控制 | $12/月 |
| **Adobe Firefly** | 商用安全素材；Premiere Pro 生成式延长 | $9.99/月 |
| **Wondershare Filmora** | AI 智能抠像/降噪/运动跟踪/静音检测 | — |
| **VEED** | 在线内容制作 | $12/月 |
| **OpusClip** | 长视频→爆款短片 | $15/月 |
| **invideo AI** | 提示词→社媒视频 | $10/席位 |
| **Vyond** | 动画角色视频 | $58/月 |
| **Pictory** | 内容转视频 | $25/月 |
| **revid.ai** | 社媒模板 | $39/月 |
| **Eddie AI** | 粗剪长素材，按量付费 | $10 起 |
| **CapCut** | 免费剪辑（桌面端无水印） | 免费 |

### 2.3 数字人型

| 平台 | 能力 | 价格 |
|------|------|------|
| **Synthesia** | 数字人讲解视频 | $14/月 |
| **HeyGen / LiveAvatar** | 实时交互数字人 + 语音克隆 + 120 语言字幕 | Essential $99/月 |

### 2.4 聚合路由型

- **WaveSpeedAI**：单一界面把提示词分发到 WAN / Sora / Veo / Kling / 海螺 / Vidu，省去逐个平台试。

---

## 三、语音 / 音频类 AI 平台

分为 **TTS/语音克隆** 和 **音乐生成** 两类，再加 **音乐+视频一体**。

### 3.1 TTS / 语音克隆

| 平台 | 能力 | 价格 |
|------|------|------|
| **ElevenLabs** | 全能王者：TTS 90+ 语言、秒级语音克隆（29 语言）、音乐、音效、配音、转写、API；4.8/5（22k 评价） | 免费版 + $5/$22/$99 |
| **Hume Octave** | 用提示词"设计"一个声音 | — |
| **Inworld** | 游戏/直播实时语音，低延迟，提供 SDK | — |
| **WellSaid** | 企业级配音 | — |
| **Synthesia** | 通过数字人提供语音 | — |

### 3.2 音乐生成

| 平台 | 特点 |
|------|------|
| **Suno** | 全球用户最多、便宜、快、易上手 |
| **Udio** | 音质最强，专业/工作室档 |
| **Soundraw / AIVA** | AI 作曲 |
| **ACE Studio** | 一体化 AI 音乐工作室：专业人声 + AI 乐器 |

### 3.3 音乐 + 视频一体

- **Tunee**：AI 音乐 + 音乐 MV
- **freebeat**：节拍同步 MV、口型同步
- **Adobe Firefly 音乐视频**、**ElevenLabs 音乐视频制作器**

---

## 四、查资料 / 研究类 AI 平台

分为 **消费级 AI 搜索**、**深度研究（Deep Research）**、**学术/垂直**、**开源框架与企业知识库**。

### 4.1 消费级 AI 搜索

| 平台 | 特点 |
|------|------|
| **Perplexity** | 实时联网 + 引用来源；Deep Research 2–4 分钟出报告。注意：Pro 把深度研究额度从 600/天砍到 20/月 |
| **Google AI Mode / Google Search** | 谷歌搜索的 AI 模式 |
| **ChatGPT（带搜索）** | 创意写作、头脑风暴、编程 |
| **Microsoft Copilot**（原 Bing AI） | 整合 Outlook/Word/PowerPoint |
| **You.com** | YouChat 问答 / YouWrite 写作 / YouImagine 出图 |
| **Grok**（xAI） | — |
| **Amazon Rufus** | 购物搜索 |

### 4.2 深度研究（Deep Research）

| 平台 | 特点 |
|------|------|
| **Perplexity Deep Research** | 引用型，2–4 分钟 |
| **OpenAI Deep Research** | 可连接 MCP/应用，限制只搜可信站点 |
| **Google Gemini Deep Research / Max** | 多步商品/竞品分析 |
| **Claude（Anthropic）Deep Research** | 输出精简 5 页报告 |

### 4.3 学术 / 垂直

- **Consensus**：学术论文检索。

### 4.4 开源框架与企业知识库

- **LangChain open_deep_research**：开源，支持 GPT-5，Deep Research Bench 排名第 6。
- **Jina AI** 深度搜索、**阿里 ZeroSearch**、**字节 DeerFlow**、**MindSearch**。
- **阿里云 AI 搜索开放平台 / OpenSearch**：企业/开发者 RAG。
- **腾讯乐享知识库**：企业知识库，30 万+企业，99.7% 稳定性。
- **Confluence / Notion / Bloomfire / BetterYeah**：通用知识库。

---

## 五、不同平台之间的组合（重点）

这是你关心的核心。组合方式分三层：**「胶水层」**负责把多个单点工具串起来；**「一站多模态平台」**在单个产品内覆盖多环节；**「手工流水线」**按链路拼装。

### 5.1 胶水层（编排引擎）

| 工具 | 角色 |
|------|------|
| **ComfyUI** | 节点式工作流引擎，本地串联图像/视频/3D 模型；众多流水线的骨干 |
| **n8n + MCP** | 零代码 AI Agent，连接大量工具（含视频工作流） |
| **Pixelle-Video（ATH-MaaS）** | 基于 ComfyUI 的全自动短视频引擎：一条流里生成视频配图/片段/语音 |
| **Wireflow** | 节点画布上的 AI 视频流水线：脚本→配音→图片→片段，可复用 |
| **HashMeta** | 脚本→分镜→语音合成→数字人全自动 |

### 5.2 一站多模态平台（单产品覆盖多环节）

| 平台 | 覆盖环节 |
|------|---------|
| **Layer AI** | 图像/视频/3D/音频，背后 300+ 模型 |
| **ElevenLabs** | 语音 + 音乐 + 音效 + 视频，单一 API |
| **Adobe Creative Cloud + Firefly + Premiere** | 出图→生成式延长→剪辑商用闭环 |
| **HeyGen** | 数字人 + 语音克隆 + 字幕一体 |
| **Elser AI** | 角色对话 + 音效 + 环境音频一处完成 |
| **Tunee / freebeat / Firefly 音乐视频** | 音乐 + MV 一体 |

### 5.3 典型手工流水线（推荐组合）

**🎬 短视频全流程**
```
Perplexity/ChatGPT（选题+脚本）
   → Midjourney / Meshy（视觉素材）
   → ElevenLabs（配音）
   → Suno（背景音乐）
   → Veo / Kling / Runway（视频片段）
   → CapCut / Filmora（剪辑）
   → 自动发布
```

**🎮 游戏开发全流程**
```
Meshy（3D资产）+ Scenario（2D素材，统一风格）
   → Cascadeur（角色动画）
   → ElevenLabs（角色语音）+ Suno（游戏音乐）
   → Runway（过场动画）
   → Unity / Unreal / GDevelop（组装发行）
   → modl.ai（测试）
```

**📚 研究输出全流程**
```
Perplexity Deep Research（搜集+引用）
   → Claude / Gemini Deep Research（提炼成报告）
   → Consensus（补充学术证据）
   → Notion / 腾讯乐享（沉淀知识库）
```

### 5.4 选胶水还是选一站？

- **要可控、要本地、要省钱** → ComfyUI + 开源模型（Mochi 1 等）+ Pixelle/n8n+MCP。
- **要省事、要商用安全** → Adobe 全家桶 + Firefly；或 Layer AI / ElevenLabs 这类一站多模态。
- **要快速量产短视频** → WaveSpeedAI（路由多家视频模型）+ ElevenLabs + OpusClip。
- **做游戏** → 资产走 Meshy/Scenario，音走 ElevenLabs/Suno，动画走 Cascadeur，引擎用 Unity/Unreal/GDevelop。

---

## 六、速查：每类「首选 + 平替」

| 类别 | 首选 | 平替 / 开源 |
|------|------|------------|
| 游戏资产 | Meshy + Scenario | Layer AI、GDevelop |
| 视频生成 | Kling AI / Veo 3 | Genmo Mochi 1（开源本地） |
| 视频编辑 | Adobe Firefly + Premiere | CapCut（免费） |
| 语音/TTS | ElevenLabs | Hume Octave、Inworld |
| 音乐 | Suno（易） / Udio（精） | ACE Studio、AIVA |
| 研究 | Perplexity + Claude Deep Research | LangChain open_deep_research（开源） |
| 编排胶水 | ComfyUI + n8n/MCP | Pixelle-Video、Wireflow |

---
