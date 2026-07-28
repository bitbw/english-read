# 复习选题：中文选项语义相似度过滤方案

## 问题背景

当前复习系统在生成中文四选一题目时，仅对选项做了**精确字符串去重**（`glossDedupKey`：trim + lowercase + 去空格），没有做**语义相似度检查**。这会导致以下问题：

| 正确词 | 中文正确义项 | 干扰词 | 中文干扰义项 | 问题 |
|--------|-------------|--------|-------------|------|
| important | 重要的 | significant | 有重大意义的 | 语义过于接近 |
| abandon | 放弃 | give up | 放弃 | 译文完全相同 |
| beautiful | 美丽的 | pretty | 漂亮的 | 非常接近 |
| famous | 著名的 | well-known | 著名的 | 译文完全相同 |
| increase | 增加 | rise | 上升 | 语义接近易混淆 |

用户在选择时无法区分这些选项，测验变成了"在两个近义词里猜"，失去了测试词汇掌握度的意义。

---

## 目标

在保持 4 个选项的前提下，确保所有干扰项的**中文义项**与正确答案之间**语义距离足够远**，让测验真正测试"是否认识这个单词"，而不是"能否区分两个近义词的中文翻译"。

---

## 方案设计

采用**三层过滤流水线**，每层逐步增强准确性，层间有降级策略：

```
预加载干扰项（最多3个）
    │
    ▼
  第1层：字符级快速过滤（客户端，零依赖）
    │
    ▼
  第2层：嵌入向量语义过滤（服务端，可选）
    │
    ▼
  第3层：备选候选链替换
    │
    ▼
  最终 3 个干扰项
```

---

### 第1层：字符级相似度过滤（必选，客户端）

**位置：** `src/lib/review-distractor-pick.ts`

**原理：** 中文文本的公共子序列/公共字符比例越低，语义相同的概率越低。

#### 1.1 最长公共子序列比（LCS Ratio）

计算两个中文串的 LCS 长度与较长串长度的比值：

```
LCS("重要的", "有重大意义的") = "重大的" → len=3
longerLen = 6
ratio = 3/6 = 0.5
```

**阈值：** `SIMILARITY_THRESHOLD_LCS = 0.65`

#### 1.2 字符集合 Jaccard 相似度

```
A = {"重", "要", "的"}, B = {"有", "重", "大", "意", "义", "的"}
Jaccard = |A∩B| / |A∪B| = 2 / 7 ≈ 0.29
```

**阈值：** `SIMILARITY_THRESHOLD_JACCARD = 0.55`

#### 1.3 包含关系检测

若 `A ⊆ B` 或 `B ⊆ A`（子串或超串关系），直接标记为过于接近：

```typescript
"放弃" ⊆ "不要放弃" → 屏蔽
"美丽的" ⊇ "美的" → 屏蔽（"美的"含义不同，但视觉上太接近）
```

例外：长度 ≤ 2 的短串不触发此规则，避免误杀 "大的"、"好的" 等常见通用形容词。

#### 判定规则

三项联合判定：**任两项触发**则判定为"过于接近"。

```
LCS ratio > 0.65  → flag +1
Jaccard    > 0.55  → flag +1
containment true   → flag +1

flag >= 2 → 拒绝此干扰项
```

#### 实现（新函数 `isChineseMeaningTooSimilar`）

```typescript
// src/lib/review-distractor-pick.ts

const SIMILARITY_THRESHOLD_LCS = 0.65;
const SIMILARITY_THRESHOLD_JACCARD = 0.55;

/** 最长公共子序列长度 */
function longestCommonSubsequence(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** 字符级 Jaccard 相似度 */
function charJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** 判断两个中文义项是否语义过于接近 */
export function isChineseMeaningTooSimilar(zhA: string, zhB: string): boolean {
  if (zhA.length <= 2 || zhB.length <= 2) return false;

  let flags = 0;

  // 1. 包含关系
  if (zhA.includes(zhB) || zhB.includes(zhA)) flags++;

  // 2. LCS 比
  const lcs = longestCommonSubsequence(zhA, zhB);
  const longerLen = Math.max(zhA.length, zhB.length);
  if (lcs / longerLen > SIMILARITY_THRESHOLD_LCS) flags++;

  // 3. Jaccard
  if (charJaccardSimilarity(zhA, zhB) > SIMILARITY_THRESHOLD_JACCARD) flags++;

  return flags >= 2;
}
```

---

### 第2层：嵌入向量语义过滤（可选，服务端）

**位置：** 新增 `src/lib/review-meaning-similarity-api.ts`

**原理：** 使用文本嵌入模型将中文义项转换为向量，计算余弦相似度。

#### 2.1 嵌入 API 选择

推荐方案（按推荐优先级）：

| 方案 | 成本 | 延迟 | 说明 |
|------|------|------|------|
| OpenAI `text-embedding-3-small` | $0.02/1K tokens | ~200ms | 质量最好，1536维 |
| 有道智云 AI 嵌入 | 免费额度 | ~300ms | 中文优化 |
| 本地 `@xenova/transformers` WASM | 免费 | ~500ms | 无外部依赖，浏览器侧运行 |

推荐使用 OpenAI embedding，因为项目中 Sentry/PostHog 等已有外部 API 集成，嵌入费用极低（一次复习大约消耗 50 tokens × 4 个选项 = 200 tokens ≈ $0.000004）。

#### 2.2 余弦相似度计算

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

#### 2.3 阈值

- `EMBEDDING_SIMILARITY_THRESHOLD = 0.82`（经验值，可根据实际数据微调）
- 高于阈值判定为语义过于接近

#### 2.4 批量 + 缓存策略

- **批量嵌入：** 一次 API 调用嵌入所有待比较选项
- **LRU 缓存：** 以 `zh_文本` 为 key，缓存 24h（单条约 1KB，1万条约 10MB）
- **缓存位置：** 服务端内存缓存 + 可选的 Redis/Upstash

---

### 第3层：备选候选链替换

当某个干扰项被判定为"过于接近"时，需要有后备候选来补齐 3 个干扰项。

#### 当前候选链（已有）

```
第1梯队：预加载干扰项（similar-words API） → 最多3个
第2梯队：词库近形词（vocabulary pool）    → 动态数量
第3梯队：通用中文干扰词（GENERIC_MEANING_DECOYS）→ 固定8个
第4梯队：占位字符串（"（干扰 3）"）       → 极少数兜底
```

#### 改进：候选链加入容量标记

在 `buildMeaningQuizEnriched` 中，过滤掉相似项后：

```typescript
// 修改后：对每层候选做相似度过滤
const candidates = [];

// 第1梯队：预加载干扰项，过滤相似
for (const { word, zh } of distractorPreload ?? []) {
  if (candidates.length >= 3) break;
  if (isChineseMeaningTooSimilar(correctZh, zh)) continue;  // ← 新增
  // ...原有逻辑
}

// 第2梯队：词库近形词，过滤相似
const distractorMeta = await Promise.all(toResolve.map(...));
for (const { en, zh } of distractorMeta) {
  if (candidates.length >= 3) break;
  if (zh && isChineseMeaningTooSimilar(correctZh, zh)) continue;  // ← 新增
  // ...原有逻辑
}
```

**关键设计：** 由于目前第1梯队最多 3 个预加载项，第2梯队来自用户词库（通常有几十到几百个单词），第3梯队有 8 个通用词，候选池足够大。即使过滤掉 1-2 个相似项，仍能填满 3 个干扰项。在极端情况下（所有候选都被过滤），才回退到通用词或占位符。

---

## 执行顺序图

```
开始生成 4 个选项
    │
    ├─ 1. 确定正确答案 correctZh
    │
    ├─ 2. 处理预加载干扰项（第1梯队）
    │      for each item:
    │        字符级过滤（第1层）→ 通过则保留
    │        嵌入过滤（第2层，可选）→ 通过则保留
    │
    ├─ 3. 处理词库干扰项（第2梯队）
    │      for each item:
    │         resolveChineseGloss（已有）
    │         字符级过滤（第1层）→ 通过则保留
    │         嵌入过滤（第2层，可选）→ 通过则保留
    │
    ├─ 4. 处理通用干扰词（第3梯队）
    │      for each item:
    │         字符级过滤（第1层）→ 通过则保留
    │
    ├─ 5. 凑满 4 个选项，Fisher-Yates 洗牌
    │
    └─ 6. 返回最终 options
```

---

## 实施步骤

### Phase 1：字符级过滤（核心，约 1-2 天）

1. **新增函数** `isChineseMeaningTooSimilar` 到 `src/lib/review-distractor-pick.ts`
   - `longestCommonSubsequence`（LCS）
   - `charJaccardSimilarity`
   - 联合判定逻辑

2. **修改** `src/lib/review-quiz.ts` 中的 `buildMeaningQuizEnriched`
   - 在预加载干扰项循环中加入 `isChineseMeaningTooSimilar(correctZh, tzh)` 检查
   - 在词库干扰项循环中加入 `isChineseMeaningTooSimilar(correctZh, zh)` 检查

3. **单元测试**
   - 测试用例：近义词对（"重要的" vs "有重大意义的"）、同义词对（"放弃" vs "抛弃"）、无关词对（"苹果" vs "桌子"）、短串边界（"大" vs "大的"）

### Phase 2：嵌入语义过滤（增强，约 2-3 天）

1. **新增** `src/lib/review-meaning-similarity-api.ts`
   - OpenAI embedding 客户端
   - 批量嵌入、余弦相似度、LRU 缓存

2. **新增 API 端点** `POST /api/review/check-meaning-similarity`
   - 接收 `{ correctZh: string, candidates: string[] }`
   - 返回 `{ similarFlags: boolean[] }`

3. **修改** `buildMeaningQuizEnriched`
   - 在字符级过滤之后，调用嵌入检查做二次验证

4. **环境变量** 新增 `OPENAI_API_KEY` 到 `.env.local`

### Phase 3：阈值调优与监控（持续）

1. **A/B 测试标记：** 在 `POST /api/review/submit` 中记录用户实际选择分布
   - 如果正确选项的选中率 < 70%，说明干扰项可能太接近或太有迷惑性
   - 如果正确选项的选中率 > 95%，说明干扰项可能太容易排除

2. **调整阈值：** 基于实际数据微调 LCS/Jaccard 阈值

---

## 风险评估

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 字符级过滤误杀正常干扰项 | 中 | 低 | 三层判定 `≥2` 才拒绝，降低误杀率 |
| 嵌入请求增加延迟 | 低 | 中 | Phase 2 可选，默认只启用 Phase 1（毫秒级） |
| 候选池被过度过滤导致不足 4 个选项 | 低 | 低 | 第3梯队通用词作为最终兜底 |
| LCS DP 表占用内存（选项很少，max 4） | 极低 | 极低 | 每次计算最长串长度 ≤ 15 字符 |

---

## 边界情况处理

- **短语翻译：** 如 "give up" → "放弃"，干扰项可能来自 LLM 生成，也需要做过滤
- **多义项答案：** 如 "record" 的正译文可能是 "记录；录制"，干扰项过滤时以完整字符串为单位
- **标点符号：** 中文分号 `；`、逗号 `，` 等标点在 LCS/Jaccard 计算前建议保留（它们是语义的一部分，如 "记录；录制" 与 "记录" 有包含关系，但语义不同，需要 LCS 阈值来区分）
- **长度极短（≤ 2字符）：** 直接跳过字符级过滤，避免误杀

---

## 附录：相似度阈值实验数据

| 对 | LCS 比 | Jaccard | 包含 | 结果 | 判定 |
|---|--------|---------|------|------|------|
| "重要的" / "有重大意义的" | 0.50 | 0.29 | 否 | flag=0 | ✅ 通过 |
| "重要的" / "主要" | 0.33 | 0.40 | 否 | flag=0 | ✅ 通过 |
| "增加" / "上升" | 0.00 | 0.00 | 否 | flag=0 | ✅ 通过 |
| "美丽的" / "漂亮的" | 0.00 | 0.00 | 否 | flag=0 | ✅ 通过 |
| "放弃" / "抛弃" | 0.00 | 0.25 | 否 | flag=0 | ✅ 通过 |
| "放弃" / "不要放弃" | 0.50 | 0.50 | 是 | flag=2 | ❌ 拒绝 |
| "重要的" / "重要" | 0.67 | 0.67 | 是 | flag=3 | ❌ 拒绝 |
| "正确的" / "错误的" | 0.33 | 0.33 | 否 | flag=0 | ✅ 通过 |
| "开始" / "结束" | 0.00 | 0.00 | 否 | flag=0 | ✅ 通过 |
| "收集" / "聚集" | 0.00 | 0.17 | 否 | flag=0 | ✅ 通过 |
| "著名的" / "出名" | 0.33 | 0.50 | 否 | flag=0 | ✅ 通过 |
| "著名的" / "著名的" | 1.00 | 1.00 | 是 | flag=3 | ❌ 拒绝（已被 exact dedup 拦截） |

结论：阈值为 `≥2 flags` 时，误杀率低（仅当确实包含/大部分重叠时），同时能有效拦截同文替换。