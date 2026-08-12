# 文本练习页（Paste & Read）功能设计

> 需求：用户输入一段英文文章/段落后，能像「每日英文」阅读页那样选中/点击单词弹出释义弹窗，并可一键加入生词本。新页面实现，并在首页（Dashboard）添加快捷入口。

## 1. 核心结论

**这是一个纯前端功能，不需要动数据库、不需要新增 API。**

现有的三块资产可直接复用，等于「白捡」了一个完成度很高的查词链路：

| 资产 | 位置 | 作用 |
|------|------|------|
| `WordPopup` 组件 | `src/components/reader/word-popup.tsx` | 释义/音标/英美发音/中文翻译/上下文/「加入生词本」「移出生词本」弹窗，自带与 `/api/dictionary`、`/api/vocabulary` 的全部交互 |
| 划词选中→弹窗逻辑 | `src/app/(app)/articles/[id]/article-reader-client.tsx`（L104–177） | `selectionchange` 防抖 + `getBoundingClientRect()` 计算锚点矩形 → 打开弹窗 |
| 上下文提取 | `src/lib/extract-readable-context.ts` | 从整段文本里智能截取选中词附近的完整句/整段作为生词 context |

后端 `/api/dictionary`（释义+翻译+音频，24h 缓存）与 `/api/vocabulary`（POST 新增 / `?lookup=` 查重 / `[id]` DELETE 删除）**两个接口均已存在且与页面无关**，粘贴文本阅读时直接调用即可。

---

## 2. 新页面设计

### 2.1 路由与名称

- 路由：`src/app/(app)/textreader/page.tsx`（客户端组件）
- 中文名：**文本练习**
- 图标建议：`FileText` / `PenLine`（lucide-react）
- 鉴权：加入 `middleware.ts` 的 `protectedRoutes`（见 §5）

### 2.2 页面布局（单页双态）

页面内用 state 切两个视图，不拆路由：

```
┌──────────────────────────────────────────────┐
│  back  文本练习                    字号 A- 17 A+ │
├──────────────────────────────────────────────┤
│  ── 视图 A：输入态（默认）──                     │
│  [ Textarea 黏贴/输入一段英文，placeholder 引导 ]   │
│  字数统计 · 清空 ·  ▶ 开始阅读                    │
│  ── 视图 B：阅读态（点「开始阅读」后）──            │
│  [ 由输入渲染成多个 <p> 段落，与文章阅读完全一致 ]   │
│  划词 → WordPopup（可加入生词本）                  │
│  编辑原文（返回输入态）                           │
└──────────────────────────────────────────────┘
```

### 2.3 视图 A：输入态

- 私有 UI 组件：`src/components/text-reader/text-reader-input.tsx`
- 用 `Textarea`（已在 `src/components/ui/textarea.tsx`，项目已有 shadcn v4 版本）。
- 实时显示**单词数 / 字符数**（可复用前端 `wordCount` 计算）。
- 「开始阅读」按钮判空（空文本 toast 提示）。
- **草稿持久化**：输入内容写入 `localStorage`（键：`english-read-text-reader-draft`），刷新页面不丢，进入页面时自动回填；「阅读态」点「编辑原文」回填仍保留。

### 2.4 视图 B：阅读态

- 私有组件：`src/components/text-reader/text-reader-read.tsx`
- 渲染逻辑与文章内容完全一致：按 `\n\n` 拆段，再按 `\n` 拆行（与 `article-reader-client.tsx` L180 相同），逐段渲染 `<p>` 并设置 `select-text`。
- **划词→弹窗**：见 §3 的共享 hook。
- 字号调节：加 A- / A+ 按钮，复用 `ARTICLE_FONT_SIZE_KEY` 或独立键 `english-read-text-reader-font-size`，范围 14–28px（与文章页一致）。
- 自动发音：复用 `readAutoPronunciationFromStorage` / `writeAutoPronunciationToStorage`（`src/lib/reader-auto-pronunciation.ts`），右上角同样放一个音量开关（Sheet 可省，直接放个图标按钮即可，避免过度设计）。

### 2.5 输入长度上限

- 单次输入建议上限 **5000 字符**（Textarea `maxLength`），超过 `VOCAB_WORD_MAX_LENGTH` 的划选 WordPopup 已有拦截。
- 长文本允许，但 WordPopup 的词典查询前缀截断 `MAX_DICTIONARY_QUERY_CHARS=3000` 已兜底。

---

## 3. 划词→弹窗：抽取共享 Hook（推荐）

文章阅读页 L104–177 的划词检测逻辑可直接平移过来，但它是**内联在组件里的命令式 DOM 代码**。两处要用同样逻辑，按项目 DRY 与 code-review 规范，**抽取成共享 hook**，而不是复制粘贴：

**新建 `src/hooks/use-word-selection-popup.ts`**

- 入参：
  - `refs`: `Array<RefObject<HTMLElement>>`（本页只有内容容器一个；文章页是两个：`contentRef` + `headerRef`）
  - `delayMs`（默认 300）
- 出参：`{ popup: { word, context, anchorRect } | null, closePopup() }`
- 内部：`mouseup` / `touchend` / `selectionchange`(防抖) → 校验选区、单词长度（`VOCAB_WORD_MAX_LENGTH`）、锚点矩形非零 → 返回 `WordPopupAnchorRect`。

**同步重构 `article-reader-client.tsx` 使用该 hook**，删掉内联 L104–177，行为不变（上下文提取逻辑 `extractReadableContext` 也收进 hook，`startContainer.textContent` 取段文本）。

> 备选：不抽取、在 text-reader 里复制一份同样的逻辑。工作量更小、零重构风险，但出现两份需要同时维护的 DOM 监听代码。**推荐抽 hook**，文章页有现成的 e2e/手动验证路径（`/articles/[id]` 划词加入生词本）可回归。

### 弹窗复用（复用而非改造）

阅读态末尾与文章页完全一致地渲染：

```tsx
{popup && (
  <div data-word-popup>
    <WordPopup
      word={popup.word}
      context={popup.context}
      contextCfi=""              // 非 epub，传空串（WordPopup 无该值时不会影响保存）
      anchorRect={popup.anchorRect}
      onClose={closePopup}
      onSaved={() => {}}
      autoPronunciation={autoPronunciation}
    />
  </div>
)}
```

- **不传 `bookId`**：`WordPopup.handleSave`（L316–318）只在传入 `bookId` 时才带上，生词本 schema 的 `book_id` 是可空外键 → 粘贴文本的生词 **正确归属「无书籍来源」**，与手动添加一致。
- WordPopup 保存路径（`POST /api/vocabulary`）已处理 `alreadyExists` 去重与多义词 `serializeVocabularyDefinition`，无需改动。

---

## 4. 首页快捷入口

**不加侧边栏导航**，只在首页 `src/components/dashboard/dashboard-quick-actions.tsx` 的按钮行里加一个入口：与「加入生词」按钮（L33–41，`variant="outline" size="sm"`）并排、样式一致（该组件是 `(app)/dashboard/page.tsx` L199 渲染的快捷操作条）：

```tsx
<Link href="/textreader">
  <Button variant="outline" size="sm" className="gap-2">
    <FileText className="h-4 w-4" />
    {t("textReader")}
  </Button>
</Link>
```

- 放在「加入生词」旁边，与手动添加生词的入口视觉完全一致，各端（桌面/移动）均可从首页触达。
- 移动端底部导航 `bottom-nav.tsx` 已满 5 项，不加。

---

## 5. 鉴权 `middleware.ts`

`protectedRoutes`（L6–16）追加 `"/textreader"`，未登录访问重定向到 `/login`。

---

## 6. i18n 文案清单

在 `messages/zh.json` / `messages/en.json` 两处同步新增（沿用已有命名空间风格）：

```
textreader.title        → 文本练习
textreader.inputPlaceholder → 在这里粘贴或输入一段英文，然后点击「开始阅读」
textreader.wordCount    → {count} 个单词
textreader.startReading → 开始阅读
textreader.editOriginal → 编辑原文
textreader.emptyError   → 请输入或粘贴文本
textreader.clearDraft   → 清空
textreader.textareaLabel → 输入文本
```

（新增 `textreader` 顶层命名空间即可，与 `articles`、`wordPopup` 并列；「文本练习」按钮文案复用 `textreader.title`。）

---

## 7. 文件清单汇总

| 操作 | 文件 |
|------|------|
| 新增 | `src/app/(app)/textreader/page.tsx` |
| 新增 | `src/components/text-reader/text-reader-input.tsx` |
| 新增 | `src/components/text-reader/text-reader-read.tsx` |
| 新增 | `src/hooks/use-word-selection-popup.ts`（抽取划词逻辑） |
| 修改 | `src/app/(app)/articles/[id]/article-reader-client.tsx`（改用共享 hook，删内联逻辑） |
| 修改 | `src/components/dashboard/dashboard-quick-actions.tsx`（首页入口，与「加入生词」并排） |
| 修改 | `middleware.ts`（protectedRoutes） |
| 修改 | `messages/zh.json`、`messages/en.json`（文案） |

**不需要**：新增 API route、schema 迁移、drizzle 改动。

---

## 8. 边界情况与注意事项

1. **划选跨段落**：选区锚点 `commonAncestorContainer` 必须落在内容容器内才响应（hook 里 `refs.some(r => r.current?.contains(node))` 校验），跨段落整片选中的多词会走 WordPopup 的「词组」分支（TTS 朗读、无词典 mp3，但可正常保存为词组生词）。
2. **草稿很长时**：localStorage 上限约 5MB，5000 字符完全安全；清空需显式 remove 键。
3. **XSS**：粘贴文本以 React 文本节点渲染（`react` 自动转义），**不得用 `dangerouslySetInnerHTML`**，杜绝注入。
4. **字号持久化键名**：与文章页 `ARTICLE_FONT_SIZE_KEY` 区分或复用均可；区分可避免文章字号被文本练习改掉，建议独立键。
5. **WordPopup 关闭**：`closePopup` 同时 `removeAllRanges()`，移动端 `touchend` 事件需与 hook 的 `handlePointerUp` 保持一致（WordPopup 自带 `data-word-popup` 命中排除）。

---

## 9. 实施步骤（分阶段）

**Phase 1 — 抽取共享 hook（无 UI 变化，先回归）**
1. 新建 `src/hooks/use-word-selection-popup.ts`，把文章页 L104–177 逻辑原样抽出（参数化 `refs` + `delayMs`）。
2. 重构 `article-reader-client.tsx` 改用 hook。
3. 回归验证：`/articles/[id]` 划词、加入生词本、移出生词本、移动端触屏划词。

**Phase 2 — 新页面**
4. `textreader` 路由 + middleware 鉴权。
5. `text-reader-input`（Textarea + 计数 + 开始阅读 + localStorage 草稿）。
6. `text-reader-read`（段落渲染 + 字号 + 自动发音开关 + WordPopup）。
7. i18n 文案。

**Phase 3 — 入口**
8. 首页 `DashboardQuickActions` 快捷按钮（与「加入生词」并排、样式一致）。
9. `npm run lint` + `npx tsc --noEmit` + `npm run build` 全绿。

**Phase 4 — 测试（按项目 80% 覆盖要求）**
11. `use-word-selection-popup`：单测（选区解析、超长字拦截、锚点矩形、关闭清空选区）。
12. e2e（Playwright）：输入文本→开始阅读→划词→弹窗出现→加入生词→生词本可见。

---

## 10. 风险与后续扩展

- **风险**：重构文章页划词逻辑有回归风险 → 用 Phase 1 单独验证隔离。
- **扩展**（本期不做，记录备选）：
  - 一键「整段加入」：解析出所有不在生词本的高频词列表，批量子查询 `?lookup=`；
  - 生词高亮：渲染时对已收录生词着色（复用 `lookup` 批量查询）；
  - 保存整篇到书架（建一个「文本」类书籍，走现有 `books` 表）。