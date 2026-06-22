# 阅读页 Hydration Mismatch 修复计划

> 状态：**待实施**  
> 关联功能：阅读双模式（横翻分页 / 竖滚按章）  
> 涉及文件：[`reader-client.tsx`](../src/app/(app)/read/[bookId]/reader-client.tsx)、[`reader-layout-mode.ts`](../src/lib/reader-layout-mode.ts)

---

## 1. 现象

开发控制台出现 React hydration 警告，典型 diff：

```diff
<button aria-label="上一页">   <!-- 服务端 HTML -->
<button aria-label="上一章">   <!-- 客户端 hydration -->
```

完整日志指向 `ReaderClient` 底栏 prev/next 按钮，属性 `aria-label` 在服务端与客户端不一致。

---

## 2. 根因

`ReaderClient` 是 Client Component，但 Next.js App Router **仍会对 Client Component 做首屏 SSR**。下列 state 在 **SSR 与浏览器首帧** 使用了不同初值：

| State | 服务端初值 | 客户端初值 | 来源 |
|-------|-----------|-----------|------|
| `layoutMode` | `paginated`（默认） | `scrolled-doc` 等 | `readLayoutModeFromStorage()` |
| `colorScheme` | `"a"`（默认） | 用户上次选择 | `readColorSchemeFromStorage()` |
| `autoPronunciation` | 默认 `true` | 用户上次选择 | `readAutoPronunciationFromStorage()` |
| `fontSize` | `22` | localStorage 中 12–28 | `useEffect` 内读取（**已安全**） |

`readLayoutModeFromStorage()` 实现：

```typescript
export function readLayoutModeFromStorage(): ReaderLayoutMode {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_MODE; // SSR → paginated
  // 浏览器 → localStorage，可能是 scrolled-doc
}
```

**直接触发警告的是 `layoutMode`**：底栏按钮根据模式渲染不同 `aria-label`：

```tsx
aria-label={layoutMode === "paginated" ? t("prevPage") : t("prevChapter")}
```

用户 localStorage 已存「竖滚按章」时，服务端输出「上一页」，客户端期望「上一章」，hydration 失败。

`colorScheme` / `autoPronunciation` 若 SSR 与客户端默认值碰巧一致，可能暂不报错，但**同一类隐患**，建议一并纳入修复。

---

## 3. 影响评估

| 维度 | 说明 |
|------|------|
| 功能 | 阅读、翻页、进度保存 **不受影响**（React 会在客户端重绘） |
| 体验 | 控制台警告；理论上存在极短的首帧 UI/无障碍属性不一致 |
| 生产 | 同样会出现警告（非仅 dev）；Strict Mode 会放大双 mount，但 hydration 问题与 Strict Mode 无关 |
| 优先级 | **建议修**；改动小、收益明确 |

---

## 4. 修复原则

1. **SSR 与客户端首帧 state 必须相同**（均用代码内默认值，不读 `localStorage`）。
2. **用户偏好仅在 `useEffect`（mount 后）从 localStorage 恢复**。
3. 恢复 localStorage 后若需驱动 `EpubReader` 换模式，继续用现有 `rendition.flow()` 路径，**不要**把实时 CFI 写回 `initialCfi`（避免整书重载，见 [`liveCfi` 问题修复记录](#7-关联问题已修复)）。
4. 尽量复用项目内已有模式（与 `fontSize` 的读法对齐）。

---

## 5. 推荐方案：`mounted` 门闩 + 默认初值

### 5.1 思路

```tsx
// ① 初值：永远用常量，SSR / CSR 首帧一致
const [layoutMode, setLayoutMode] = useState<ReaderLayoutMode>(DEFAULT_LAYOUT_MODE);
const [colorScheme, setColorScheme] = useState<ReaderColorSchemeId>(DEFAULT_COLOR_SCHEME);
const [autoPronunciation, setAutoPronunciation] = useState(true);

// ② mount 后一次性从 localStorage 恢复
useEffect(() => {
  setLayoutMode(readLayoutModeFromStorage());
  setColorScheme(readColorSchemeFromStorage());
  setAutoPronunciation(readAutoPronunciationFromStorage());
  // fontSize 已有类似 effect，保持不变
}, []);
```

### 5.2 底栏 `aria-label`（可选加固）

在 `layoutMode` 尚未从 storage 同步前，使用与 SSR 一致的文案，避免 effect 运行前的一帧 edge case：

```tsx
const [prefsHydrated, setPrefsHydrated] = useState(false);

useEffect(() => {
  setLayoutMode(readLayoutModeFromStorage());
  // ...
  setPrefsHydrated(true);
}, []);

const navLabel =
  !prefsHydrated || layoutMode === "paginated" ? t("prevPage") : t("prevChapter");
```

若 5.1 已保证初值一致，5.2 为**可选**；实现时二选一即可，避免过度复杂。

### 5.3 `EpubReader` 与模式恢复时序

当前结构：

```
cfiReady → 挂载 EpubReader（layoutMode 来自 state）
```

**潜在问题**：mount 时 `layoutMode` 仍为默认 `paginated`，effect 后才变为 `scrolled-doc`，会触发 `epub-reader.tsx` 内 `rendition.flow()` 切换。

| 阶段 | layoutMode | EpubReader 行为 |
|------|------------|-----------------|
| 首帧 | `paginated` | `renderTo(flow: auto)` |
| prefs effect 后 | `scrolled-doc` | `rendition.flow('scrolled-doc')` |

这是**可接受**的：已有 `skipNextLayoutFlowSyncRef` 与 `currentCfiRef`，切换模式不会丢 CFI。  
若希望**避免**「先横翻再竖滚」的闪动，可升级为方案 B。

---

## 6. 备选方案

### 方案 B：prefs 就绪后再挂载 EpubReader

```tsx
const [prefsHydrated, setPrefsHydrated] = useState(false);

useEffect(() => {
  setLayoutMode(readLayoutModeFromStorage());
  setColorScheme(readColorSchemeFromStorage());
  setAutoPronunciation(readAutoPronunciationFromStorage());
  setPrefsHydrated(true);
}, []);

// 渲染
{cfiReady && prefsHydrated && <EpubReader layoutMode={layoutMode} ... />}
```

- **优点**：EpubReader 首次 `renderTo` 即用正确 `flow`，无模式二次切换。
- **缺点**：首屏晚一帧挂载阅读器（通常不可感知）。

### 方案 C：抽取 `useReaderPrefs()` hook

将 layoutMode / colorScheme / autoPronunciation / fontSize 的「默认初值 + mount 后 hydration」收到 [`src/hooks/use-reader-prefs.ts`](../src/hooks/use-reader-prefs.ts)，供 `ReaderClient` 与后续设置页复用。

- **优点**：消除三处重复的 localStorage 模式；以后新增偏好只改一处。
- **缺点**：多一个文件，本次可不做，作为 refactor  follow-up。

### 方案 D：Cookie 同步 SSR（不推荐）

把 `layoutMode` 写入 cookie，服务端 `ReadPage` 读 cookie 传给 `ReaderClient`。

- **优点**：SSR HTML 可与用户偏好完全一致。
- **缺点**：需 middleware / server 传参；阅读偏好走 cookie 过重；与现有 localStorage 策略不一致。**不建议**。

---

## 7. 关联问题（已修复）

**翻页时「加载书籍中」闪现 + `about:srcdoc` 频繁报错**

- **原因**：曾用 `liveCfi` 更新 `initialCfi`，每次翻页触发 `EpubReader` 整段 destroy/init。
- **修复**：`initialCfi` 仅传服务端 `effectiveCfi`；init effect 不依赖翻页 CFI。
- **本文档不涉及该逻辑回退**。

---

## 8. 实施步骤（建议顺序）

1. **修改 `reader-client.tsx`**
   - `layoutMode` / `colorScheme` / `autoPronunciation` 初值改为各模块 `DEFAULT_*`。
   - 新增单个 `useEffect` 在 mount 后从 localStorage 批量恢复（可与现有 `fontSize` effect 合并或并列）。
2. **（可选）** 采用方案 B：`prefsHydrated` 后再挂 `EpubReader`。
3. **自测**
   - localStorage 清空 → 进入阅读页 → 无 hydration 警告。
   - localStorage 设为 `scrolled-doc` → 刷新 → 无 hydration 警告；模式为竖滚。
   - 切换横翻/竖滚 → 无整书重载、无 loading 闪现。
   - 底栏 aria-label 与当前模式一致。
4. **（可选）** 抽取 `useReaderPrefs`，统一 prefs hydration。

---

## 9. 验证清单

- [ ] 控制台无 `A tree hydrated but some attributes...`（阅读页底栏按钮）
- [ ] `layoutMode=scrolled-doc` 存 localStorage 后硬刷新，首屏即为竖滚（或方案 B 下极短延迟后竖滚，无横翻闪屏）
- [ ] 横翻 / 竖滚切换、翻页、进度保存正常
- [ ] `colorScheme`、`autoPronunciation` 刷新后仍恢复用户选择
- [ ] 生产 build `npm run build` 通过

---

## 10. 不在本次范围

- `about:srcdoc` sandbox 脚本警告（epubjs 默认行为，无需为 hydration 修复）
- `GET /read/META-INF/container.xml` 404（旁路请求，功能正常可忽略）
- Cookie / 服务端持久化阅读模式
- React Strict Mode 下 epub Blob XHR 两次（dev 正常现象）

---

## 11. 参考

- [React: Hydration mismatch](https://react.dev/link/hydration-mismatch)
- 项目内：[`docs/epub-reader-回显与进度.md`](./epub-reader-回显与进度.md)
- 代码：[`src/lib/reader-layout-mode.ts`](../src/lib/reader-layout-mode.ts)
