# 复习干扰项优化：自建语义词典方案

## 背景

当前干扰项选取流程：

```
Datamuse API（拼写近形词）→ 有道 API（取中文释义）→ 去重 → 展示
```

核心问题：
1. 运行时多次调用外部 API，延迟高
2. 仅做精确去重，**语义接近**的干扰项未被过滤
3. 外部 API 不可用时降级到通用占位词，体验差

根本解法：将"语义距离计算"从**运行时**前置到**数据准备阶段**，运行时只查数据库，零外部依赖。

---

## 延迟瓶颈分析

要理解各方案的价值，先看清当前系统的真实延迟分布。

### 当前流程：每道复习题的完整延迟链

```
加载一道复习题
  │
  ├── 1. GET /api/review/similar-words?word=xxx
  │      ├── Datamuse API（拼写近形词）        → 200-400ms
  │      └── 有道 API × N（取中文释义）        → N × 200-500ms
  │
  ├── 2. buildMeaningQuizEnriched()
  │      ├── resolveChineseGloss（正确答案）    → 0ms（已缓存）
  │      ├── 预加载干扰项（已有 zh）            → 0ms
  │      ├── 词库候选池 resolveChineseGloss × M → M × 200-500ms  ← 主瓶颈
  │      ├── 去重检查                          → ~0ms
  │      └── Fisher-Yates 洗牌                 → ~0ms
  │
  └── 总耗时：200-500ms + N×200-500ms + M×200-500ms
```

### 延迟分项占比

| 环节 | 延迟 | 说明 |
|------|------|------|
| Datamuse 查近形词 | 200-400ms | 每次复习一次，N=1 |
| 有道取候选词中文义 | **N × 200-500ms** | N 是 similar-words API 返回的干扰词数量（通常 3-5） |
| 词库池取中文义 | **M × 200-500ms** | M 是 resolveChineseGloss 逐词调词典的次数（通常 5-15） |
| 义类比较 / 去重 / 洗牌 | ~0ms | 纯内存操作 |

**核心结论：外调 API 获取中文释义占总延迟的 95% 以上。** 一方预加载需要调 N 次有道，另一方词库候选池需要调 M 次有道。用户词库越大，M 越大，延迟越高。

### 义类方案如何改变延迟分布

义类表缓存了**中文释义 + 义类 ID**，运行时不再需要调词典 API 获取候选词的中文：

```
义类方案运行时：
  ├── resolveChineseGloss（正确答案）          → 0ms（已缓存）
  ├── 预加载干扰项（已有 zh）                  → 0ms
  ├── 词库候选池查义类 ID（SQL）               → ~5ms × 1  ← 一次查询替代 M 次 API
  ├── 同义类过滤（内存 clusterId 比较）         → ~0ms
  └── 总耗时：约 5ms（vs 原来 2-8 秒）
```

| 环节 | 改造前 | 改造后（方案 C） |
|------|--------|----------------|
| 获取拼写近形词 | Datamuse API 200-400ms | 不变 |
| 获取候选词中文义 | API × (N+M) 次 **200-500ms/次** | SQL 1 次 **~5ms** |
| 相似度过滤 | 无（仅有精确去重） | 内存 clusterId **~0ms** |
| **合计** | **数秒级别** | **~400ms** |

### 义类表的一次性成本

每次用户首次遇到一个新词（保存到词汇表时）**只需一次**有道 API 调用获取中文义，之后所有复习都从义类表读取，不再调 API：

```
用户首次保存 "abandon"：
  POST /api/vocabulary → 有道 API ~300ms（获取中文义 + 写入义类表）

用户第 1 次复习 "abandon"：
  resolveChineseGloss("abandon") → 义类表读取 ~5ms（不调 API）

用户第 100 次复习 "abandon"：
  resolveChineseGloss("abandon") → 义类表读取 ~5ms（不调 API）
```

一次获取，永久复用。这是义类方案消除延迟的根本原因。

---

## 方案总览

| 方案 | 复杂度 | 运行时延迟 | 外部依赖 | 覆盖度 | 推荐 |
|------|--------|-----------|---------|--------|------|
| A：字段注入 | 低 | 内存过滤 ~0ms | 无 | 80% | 快速见效 |
| B：完整词典表 | 高 | SQL <10ms | 无 | 95%+ | 终极形态 |
| **C：凝聚版** | **中** | **内存过滤 ~0ms** | **无** | **90%** | **◎推荐首选** |

---

## 方案 A：Vocabulary 表注入 `meaning_cluster_id`

### 设计

不改新表，仅在现有 `vocabulary` 表加一列 `meaning_cluster_id`，把"中文义项相近的词"打上相同 ID。

```sql
ALTER TABLE vocabulary ADD COLUMN meaning_cluster_id INTEGER;
CREATE INDEX idx_vocabulary_meaning_cluster ON vocabulary(meaning_cluster_id);
```

### 义类标注（关键词规则）

一期不需要 AI，使用关键词碰撞规则表：

| Cluster ID | 关键词 | 示例词 |
|-----------|--------|-------|
| 1 | 重要、重大、至关、要紧、关键 | important, vital, crucial, significant |
| 2 | 美丽、漂亮、好看、美观、秀丽、迷人 | beautiful, pretty, gorgeous, charming |
| 3 | 增加、增长、上升、提高、增强 | increase, rise, grow, enhance |
| 4 | 减少、降低、下降、缩减、削弱 | decrease, reduce, decline, weaken |
| 5 | 放弃、抛弃、舍弃、丢弃、放弃 | abandon, give up, discard, desert |
| 6 | 收集、聚集、集合、汇集、积累 | collect, gather, assemble, accumulate |
| 7 | 开始、启动、发起、着手 | begin, start, launch, initiate |
| 8 | 结束、完成、终止、完毕 | end, finish, complete, terminate |
| 9 | 帮助、援助、支持、协助 | help, assist, support, aid |
| 10 | 阻止、防止、阻碍、禁止 | prevent, stop, hinder, forbid |
| ... | ... | ... |

约 50-100 组义类覆盖 80% 常见英语词汇。冷僻词可标记为 `NULL`，不做过滤。

### 运行时逻辑

```typescript
// 在 buildMeaningQuizEnriched 中过滤预加载干扰项
const currentClusterId = currentWordClusterId; // 从词汇表或缓存取

for (const { word, zh } of distractorPreload ?? []) {
  if (rows.length >= 4) break;
  const candidateClusterId = getClusterId(word); // 从缓存或数据库取
  if (candidateClusterId !== null && candidateClusterId === currentClusterId) {
    continue; // 同义类，跳过
  }
  // ...原有逻辑
}

// 同义词库池第2梯过滤
for (const { en, zh } of distractorMeta) {
  if (rows.length >= 4) break;
  const candidateClusterId = getClusterId(en);
  if (candidateClusterId !== null && candidateClusterId === currentClusterId) {
    continue;
  }
  // ...
}
```

### 义类填充策略

| 阶段 | 方式 | 覆盖 |
|------|------|------|
| 初期 | 关键词规则（50-100组）批量回填现有词 | 80% |
| 增量 | 用户保存新词时触发规则匹配 | 新增词 |
| 优化 | 导出未匹配词，LLM 一次批量补充分组 | 长尾 |

### Pros / Cons

- 零运行时延迟，零外部依赖
- 无需改查询流程，仅在内存中多一次 `clusterId` 比较
- 手工维护关键词规则，部分冷僻词无法覆盖

---

## 方案 B：完整词典体系 `distractor_lexicon`

### 设计

新建三张表，构成完整词典体系：

```sql
-- 主词典表：标准英文词 → 中文释义
CREATE TABLE word_lexicon (
  id SERIAL PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  chinese_meaning TEXT NOT NULL,
  meaning_class_id INTEGER NOT NULL REFERENCES meaning_classes(id),
  phonetic TEXT,
  level TEXT CHECK(level IN ('ce4', 'ce6', 'ky', 'ielts', 'toefl', 'gre')),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_lexicon_word ON word_lexicon(word);
CREATE INDEX idx_lexicon_class ON word_lexicon(meaning_class_id);

-- 义类表
CREATE TABLE meaning_classes (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,           -- 如 "重要性"、"美观"、"增减"
  description TEXT
);

-- 拼写近邻预计算结果
CREATE TABLE spelling_neighbors (
  word_id INTEGER NOT NULL REFERENCES word_lexicon(id),
  neighbor_word_id INTEGER NOT NULL REFERENCES word_lexicon(id),
  distance INTEGER NOT NULL,            -- Levenshtein 距离
  PRIMARY KEY (word_id, neighbor_word_id)
);
CREATE INDEX idx_neighbors_word ON spelling_neighbors(word_id, distance);
```

### 运行时查询

一条 SQL 搞定，零外部 API：

```sql
SELECT l.word, l.chinese_meaning
FROM spelling_neighbors sn
JOIN word_lexicon l ON l.id = sn.neighbor_word_id
WHERE sn.word_id = (
  SELECT id FROM word_lexicon WHERE word = :targetWord
)
  AND l.meaning_class_id != (
    SELECT meaning_class_id FROM word_lexicon WHERE word = :targetWord
  )
ORDER BY sn.distance ASC
LIMIT 6;
```

预期耗时：<10ms（全部走索引）

### 词典数据来源

| 来源 | 许可证 | 词条数 | 说明 |
|------|--------|-------|------|
| [ECDICT](https://github.com/skyim/ECDICT) | MIT | ~8万 | 英中词典 SQLite 导出 |
| GDCC/CET-4/6 词表 | 公开 | ~6000 | 大学英语考试核心词 |
| 考研/雅思/托福词表 | 公开 | ~2万 | 各机构开源词表 |
| 用户词汇表回填 | 自有 | 动态 | 用户已存的生词 |

### 义类标注方式

**推荐：LLM 批量处理一次性完成**

```
System: 你是一个英语词汇义类标注专家。给每个英文词分配一个义类 ID。
同一个义类的词应该中文释义相似或属于同一概念领域。
只输出 CSV: word,class_id,class_label

important,1,重要性
significant,1,重要性
vital,1,重要性
beautiful,2,美观
pretty,2,美观
gorgeous,2,美观
pretty,2,美观
...
```

大约 2-3 万核心词，一次 GPT-4o-mini 调用约 $2-3。

### 增量维护

- 用户查词时，若词不在 `word_lexicon` 中，自动查询 ECDICT 补充
- 若 ECDICT 也没有，LLM 单条查询补充义类
- `meaning_classes` 表支持热更新义类

### 批处理预计算脚流程

```mermaid
flowchart LR
    A[导入 ECDICT 词典] --> B[LLM 标注义类]
    B --> C[写入 word_lexicon<br/>& meaning_classes]
    C --> D[遍历所有词对<br/>计算 Levenshtein 距离]
    D --> E[过滤距离 > 4 的远邻]
    E --> F[写入 spelling_neighbors]
```

### Pros / Cons

- 运行时最快，一次 SQL <10ms
- 完全不依赖外部 API，词典自持
- 初始建库 3-5 天，需导入 + 批处理 + 义类标注
- 新增词需要补充到词典中

---

## 方案 C：凝聚版（推荐首选）

### 设计

不改 `vocabulary` 表结构，新增一张轻量辅助表：

```sql
CREATE TABLE word_meaning_clusters (
  word TEXT PRIMARY KEY,                -- 标准化英文词（小写）
  chinese_meaning TEXT NOT NULL,        -- 从 definition 提取的中文译义
  meaning_cluster_id INTEGER NOT NULL,  -- 义类 ID（同义类 ID 归为一组）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_wmc_cluster ON word_meaning_clusters(meaning_cluster_id);
```

### 与方案 A 和 B 的区别

| | 方案 A | 方案 C |
|--|--------|--------|
| 存储位置 | 改 `vocabulary` 表 | 独立辅助表 |
| 覆盖范围 | 仅用户词汇表 | 用户词汇表 + 扩展词表 |
| 义类来源 | 关键词规则 | 关键词规则 + LLM 批处理 |
| 与业务解耦 | 耦合 | 独立，可单独维护 |

| | 方案 B | 方案 C |
|--|--------|--------|
| 词典规模 | 8 万词全覆盖 | 2-3 万常见词 |
| 拼写近邻 | 预计算到表 | 运行时 Levenshtein（已有） |
| 义类精度 | 高（LLM 精标） | 中（关键词 + LLM） |

### 实施步骤

**Step 1：创建义类关键词映射**

在 `src/lib/meaning-clusters.ts` 中定义核心规则：

```typescript
export const MEANING_CLUSTER_RULES: Array<{
  clusterId: number;
  label: string;
  keywords: string[];
}> = [
  { clusterId: 1, label: "重要性", keywords: ["重要", "重大", "至关", "要紧", "关键"] },
  { clusterId: 2, label: "美观",   keywords: ["美丽", "漂亮", "好看", "美观", "迷人", "秀丽"] },
  { clusterId: 3, label: "增减",   keywords: ["增加", "增长", "上升", "提高", "增强"] },
  { clusterId: 4, label: "减降",   keywords: ["减少", "降低", "下降", "缩减", "削弱"] },
  { clusterId: 5, label: "放弃",   keywords: ["放弃", "抛弃", "舍弃", "丢弃", "遗弃"] },
  { clusterId: 6, label: "聚集",   keywords: ["收集", "聚集", "集合", "汇集", "积累"] },
  { clusterId: 7, label: "开始",   keywords: ["开始", "启动", "发起", "着手"] },
  { clusterId: 8, label: "结束",   keywords: ["结束", "完成", "终止", "完毕"] },
  { clusterId: 9, label: "帮助",   keywords: ["帮助", "援助", "支持", "协助", "扶持"] },
  { clusterId: 10, label: "阻止",  keywords: ["阻止", "防止", "阻碍", "禁止", "阻拦"] },
  { clusterId: 11, label: "分开",  keywords: ["分开", "分离", "分割", "分裂", "隔离"] },
  { clusterId: 12, label: "连接",  keywords: ["连接", "联系", "关联", "结合", "结合"] },
  { clusterId: 13, label: "制造",  keywords: ["制造", "生产", "制作", "创造", "建造"] },
  { clusterId: 14, label: "破坏",  keywords: ["破坏", "摧毁", "毁灭", "损坏", "毁坏"] },
  { clusterId: 15, label: "保护",  keywords: ["保护", "维护", "守护", "保卫", "防护"] },
  { clusterId: 16, label: "思考",  keywords: ["思考", "考虑", "认为", "以为", "觉得"] },
  { clusterId: 17, label: "知道",  keywords: ["知道", "了解", "理解", "明白", "懂得"] },
  { clusterId: 18, label: "说",    keywords: ["说", "讲", "告诉", "叙述", "表达"] },
  { clusterId: 19, label: "看",    keywords: ["看", "看见", "观看", "注视", "观察"] },
  { clusterId: 20, label: "听",    keywords: ["听", "听见", "聆听", "倾听"] },
];
```

**Step 2：提取义类函数**

```typescript
// src/lib/meaning-clusters.ts

import { storedChineseGloss } from "./review-quiz";

/** 根据中文义判定义类 ID（逐条规则匹配，返回第一个命中） */
export function resolveClusterId(chineseMeaning: string): number | null {
  for (const rule of MEANING_CLUSTER_RULES) {
    for (const kw of rule.keywords) {
      if (chineseMeaning.includes(kw)) {
        return rule.clusterId;
      }
    }
  }
  return null; // 未匹配
}

/** 从词汇表 definition 提取义类 ID */
export function getClusterIdFromDefinition(definition: string | null): number | null {
  const zh = storedChineseGloss(definition);
  if (!zh) return null;
  return resolveClusterId(zh);
}
```

**Step 3：批处理脚本**

```typescript
// scripts/backfill-meaning-clusters.ts

import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { getClusterIdFromDefinition } from "@/lib/meaning-clusters";
import { wordMeaningClusters } from "@/lib/db/schema"; // 假设已定义

async function backfill() {
  const words = await db.select().from(vocabulary);
  const batch = words.map(w => ({
    word: w.normalizedWord,
    chineseMeaning: storedChineseGloss(w.definition) ?? "",
    meaningClusterId: getClusterIdFromDefinition(w.definition),
  })).filter(w => w.meaningClusterId !== null);

  // 批量 UPSERT
  await db.insert(wordMeaningClusters)
    .values(batch)
    .onConflictDoUpdate({ target: wordMeaningClusters.word, set: { meaningClusterId: sql`EXCLUDED.meaning_cluster_id` } });
}
```

**Step 4：增量钩子**

在用户保存生词时（`POST /api/vocabulary`）同步写入 `word_meaning_clusters`：

```typescript
// src/app/api/vocabulary/route.ts 中新增
const clusterId = getClusterIdFromDefinition(body.definition);
if (clusterId !== null) {
  await db.insert(wordMeaningClusters).values({
    word: normalizedWord,
    chineseMeaning: storedChineseGloss(body.definition) ?? "",
    meaningClusterId: clusterId,
  }).onConflictDoNothing();
}
```

**Step 5：运行时改动**

```typescript
// src/lib/review-quiz.ts 中 buildMeaningQuizEnriched 修改

// 获取当前词的义类 ID
const currentClusterId = clusterCache.get(targetEnKey)
  ?? await getClusterIdFromDb(currentWord);

// 过滤预加载干扰项（第1梯队）
for (const { word, zh } of distractorPreload ?? []) {
  if (rows.length >= 4) break;
  const candidateClusterId = clusterCache.get(normalizeWordKey(word));
  if (candidateClusterId !== null && candidateClusterId === currentClusterId) continue;
  // ...原有逻辑
}

// 过滤词库干扰项（第2梯队）
for (const { en, zh } of distractorMeta) {
  if (rows.length >= 4) break;
  const candidateClusterId = clusterCache.get(normalizeWordKey(en));
  if (candidateClusterId !== null && candidateClusterId === currentClusterId) continue;
  // ...原有逻辑
}

// 过滤后被拒绝太多导致不够4个？第3梯队通用词兜底
// 通用词"那里；那儿"等不受义类影响，总能凑足
```

### 义类扩展：LLM 批量补全

针对关键词规则未覆盖的"漏网之鱼"，每月一次 LLM 批量处理：

```typescript
// scripts/llm-extend-clusters.ts

const UNMATCHED = await db.select()
  .from(wordMeaningClusters)
  .where(isNull(wordMeaningClusters.meaningClusterId))
  .limit(500);

// 分组发 LLM
const prompt = `以下英文词的中文释义未分配到义类，请将它们分到已有义类中。
已有义类：${MEANING_CLUSTER_RULES.map(r => `${r.clusterId}.${r.label}`).join("、")}

未分配词汇：
${UNMATCHED.map(w => `${w.word}: ${w.chineseMeaning}`).join("\n")}

输出格式（CSV）：word,clusterId
...`;
```

---

## 三方案对比总结

| 维度 | 方案 A：字段注入 | 方案 B：完整词典表 | 方案 C：凝聚版 |
|------|-----------------|------------------|--------------|
| 运行时延迟 | ~0ms（内存） | <10ms（SQL 索引） | ~0ms（内存） |
| 外部 API 依赖 | 无 | 无 | 义类批处理时短时用 |
| 初始工作量 | 1-2 天 | 3-5 天 | 2-3 天 |
| 新增词处理 | 即时规则匹配 | 需补充到词典 | 即时规则匹配 |
| 覆盖度 | 80% | 95%+ | 90% |
| 维护成本 | 低 | 中（词典更新） | 低（规则新增即可） |
| 与现有系统耦合 | 高（改 vocabulary 表） | 低（独立新表） | 低（独立新表） |
| 可迁移性 | 低（耦合业务表） | 高（词典可复用） | 中 |

---

## 推荐路径

```
Phase 1（2-3天）：方案 C
  ├── 创建 word_meaning_clusters 表
  ├── 定义核心义类关键词规则（20-30组，覆盖 80% 常见词）
  ├── 批处理回填已有词汇
  ├── 增量钩子写入新词
  └── 运行时义类过滤

Phase 2（1-2天）：阈值调优
  ├── 义类规则覆盖度分析
  ├── 用 review submit 数据验证正确率提升
  └── 调整义类颗粒度（过粗则拆分、过细则合并）

Phase 3（可选）：扩展词典
  ├── 导入 ECDICT 开源词典
  ├── LLM 批标注全量义类
  └── 升级到方案 B 的 spelling_neighbors 预计算
```

---

## 附录：与现有系统的关系

```
用户词汇表（vocabulary）
    │
    ├── definition JSON ──→ storedChineseGloss() ──→ resolveClusterId() ──→ word_meaning_clusters
    │                                                                          │
    │                                                    ┌─────────────────────┘
    │                                                    ▼
    │                                          buildMeaningQuizEnriched()
    │                                             │
    │                                ┌────────────┴────────────┐
    │                                ▼                        ▼
    │                       distractorPreload         vocabulary pool
    │                          │ 过滤同义类               │ 过滤同义类
    │                          ▼                        ▼
    │                     有效干扰项池（3 个梯队候补）
    │                             │
    │                             ▼
    │                      最终 4 个选项（含正确答案）
    └─────────────────────────────────────────────────────┘
```

现有系统中的以下部分**不需要改动**：
- `pickDistractorEnglishWords`（拼写距离评分逻辑不变）
- `computeSimilarWordDistractors`（Datamuse 查询逻辑不变）
- `resolveChineseGloss`（中文义获取逻辑不变）
- 前端展示组件

只改动 `buildMeaningQuizEnriched` 中的**候选过滤环节**，新增 `resolveClusterId` → 跳过同义类候选 → 取下一个候补。