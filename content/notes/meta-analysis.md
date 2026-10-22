# Meta 分析：把多个小研究合并成一个大研究

> Meta 分析把多个（小样本）研究合并成一个（大样本）研究，从而得到更稳健的结论。
> 但前提是这些研究「同质到足以合并」——橘子不能和苹果放在一起研究。

## 全流程速览

1. 确定研究问题，检索文献
2. 文献质量评估
3. 数据提取
4. 数据分析
5. 异质性分析
6. 偏倚评估
7. 敏感性分析
8. 结论

## 开始之前：四个关键问题

| # | 关键问题 | 需要决定的事 |
|---|----------|--------------|
| 1 | 选题 | 需要合并什么研究？ |
| 2 | 异质性 | 不同研究的数据、研究方法能否合并？（橘子不能和苹果一起研究） |
| 3 | 数据获取 | 数据从哪里来、怎么拿到？ |
| 4 | 数据分析 | 用定性综合还是定量合并？ |

## 步骤一：确定研究问题，检索文献

### 1.1 用 PICOS 拆解研究问题

| 要素 | 含义 | 示例（腹腔镜胆囊切除术） |
|------|------|--------------------------|
| **P** | Population，人群 | 接受腹腔镜胆囊切除术的病人 |
| **I** | Intervention，干预 | 机械手辅助 |
| **C** | Comparison，对照 | 人手辅助 |
| **O** | Outcome，结局 | 并发症、中转开腹、手术时间等 |
| **S** | Study design，研究设计 | 随机对照试验（RCT） |

### 1.2 检索数据库

| 数据库 | 主要特点 | 地址 |
|--------|----------|------|
| **PubMed** | 免费平台，可使用 MEDLINE、布尔运算符、MeSH 主题词 | https://pubmed.ncbi.nlm.nih.gov/ |
| **Embase** | Elsevier 生物医学与药学数据库（药物、毒理、临床实验医学等） | https://www.embase.com/ |
| **Cochrane Library** | 系统综述与 Meta 分析数据库（循证医学「金标准」） | https://www.cochranelibrary.com/ |
| **Web of Science** | 引文检索平台（SCI-EXPANDED、SSCI、A&HCI） | https://www.webofscience.com/ |
| **Scopus** | Elsevier 文摘与引文数据库 | https://www.scopus.com/ |
| **Google Scholar** | 免费学术搜索引擎 | https://scholar.google.com/ |
| **PsycINFO** | 心理学、行为与卫生科学 | https://www.apa.org/pubs/databases/psycinfo |
| **ICTRP / ClinicalTrials.gov** | 临床试验注册库（在研与已完成试验） | https://trialsearch.who.int/ · https://clinicaltrials.gov/ |
| **LILACS** | 拉美与加勒比地区文献 | https://lilacs.bvsalud.org/ |
| **CNKI** | 中国知网，3500+ 中文期刊 | https://www.cnki.net/ |

> 重点：**PubMed、Embase、Cochrane Library 必查**，其余按需选查。

### 1.3 文献筛选

1. **去重（Deduplication）**：识别并删除重复记录，确保每项研究只评估一次。工具：EndNote、Mendeley、Zotero、Rayyan、Covidence。
2. **题录 / 摘要筛选（Title & Abstract Screening）**：由 **2 名独立审阅者** 按预设纳入 / 排除标准评估；分歧由第 3 名审阅者仲裁。
3. **全文筛选（Full-text Screening）**：对通过初筛的文献获取全文，再次由 **2 名独立审阅者** 对照纳入标准详评；记录排除原因；全文不可得时用馆际互借或公共图书馆。

## 步骤二：文献质量评估

先判断研究类型，再选对应工具：

| 工具 | 全称 | 用途 |
|------|------|------|
| **RoB 2** | Cochrane Risk of Bias Tool v2 | 评估 RCT 的偏倚风险 |
| **ROBINS-I** | Risk of Bias In Nonrandomized Studies of Interventions | 非随机干预研究 |
| **ROBINS-E** | Risk of Bias In Nonrandomized Studies – of Exposures | 非随机暴露研究 |
| **Newcastle-Ottawa Scale (NOS)** | — | 观察性研究质量评分（选择、可比性、暴露 / 结局确定） |
| **QUADAS** | Quality Assessment of Diagnostic Accuracy Studies | 诊断准确性研究 |
| **AMSTAR 2** | A MeaSurement Tool to Assess systematic Reviews 2 | 评估系统综述的方法学质量 |
| **GRADE** | Grading of Recommendations Assessment, Development and Evaluation | 评估证据质量与推荐强度（非评估单项研究偏倚） |
| **JADAD** | Jadad Scale | RCT 质量评分 |
| **STROBE / CONSORT** | — | 观察性研究 / RCT 的报告规范 |

> GRADE 评估的是**证据整体质量与推荐强度**，不用于评估单项研究的偏倚风险。

## 步骤三：数据提取

- **标准化提取表 / 模板**：维持采集口径统一。
- **提取要素**：
  - 研究特征（作者、年份、国家）
  - 人群特征（年龄、性别）
  - 干预细节（类型、剂量）
  - 评估的结局（主要 / 次要结局）
  - 报告结果（效应量、P 值）
- **执行**：2 名独立提取者；分歧讨论解决，必要时第三人介入；**试点测试**提取表以完善清晰度；培训提取者；记录方案偏差以保证透明。
- **工具**：Excel、JBI SUMARI、Covidence、系统综述管理软件。

## 步骤四：数据分析

- **定性综合（Qualitative Synthesis）**：聚焦文本数据整合，适用于无法定量合并的情况。
- **定量 Meta 分析**：用 R、RevMan 等统计软件计算合并效应量、置信区间，评估异质性。
- **可视化**：
  - **森林图（Forest Plot）**：展示各研究及合并效应。
  - **漏斗图（Funnel Plot）**：识别发表偏倚。

## 步骤五：异质性

异质性有两个来源：

1. **统计异质性**：各研究效应量的差异超出抽样误差。
2. **临床异质性**：人群、干预、对照、结局定义等实际差异。

用 **Cochran's Q 检验** 与 **I² = (Q − df) / Q × 100%** 评估；过高时探索来源（亚组分析、Meta 回归）。

模型选择：

- `p < 0.1` 或 `I² > 50%` → 随机效应模型（random effects model）
- 反之 → 固定效应模型（fixed effect model）
- 数据存在多层结构时 → 多水平模型（multilevel model）

## 步骤六：偏倚

1. **发表偏倚**：阳性文献更容易发表，所选文章可能大多是阳性结果。
2. **语言偏倚**：大量文章是英文的，其他语言文献很少。
3. **散在偏倚**：有些文献、会议、期刊可能没有被检索到。
4. **引用偏倚**：可能漏掉低引用的文献。

## 步骤七：敏感性分析

1. 排除低质量文献，看结论是否改变。
2. 拆分文献或逐篇剔除，看结果是否稳定。

## 步骤八：结论

按流程走完后，结论要同时回答两件事：

- 合并后的效应量是多少（方向、大小、置信区间）？
- 这个结论有多可信（证据质量、异质性与偏倚情况）？
