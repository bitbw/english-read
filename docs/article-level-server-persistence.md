# 文章级别持久化改为服务端存储改造方案

> 日期：2026-07-29

## 问题

文章级别（L1/L2/L3）当前仅通过 `document.cookie` 保存。在 Capacitor App（Android/iOS WebView）中，`document.cookie` 不可靠，退出 app 后级别丢失。Web 端正常，因为浏览器 cookie 持久化可靠。

## 目标

将文章级别存储到服务端 `users` 表，实现跨端统一持久化，完全移除 Cookie 依赖。

## 当前架构

```
用户点击 L2
    │
    ▼
saveArticleLevel(2)
    │
    ▼
document.cookie = "article_level=2; ..."
    │
    ├── Dashboard 加载 → cookies().get("article_level") → 显示级别
    └── Articles 加载   → URL ?level=2 → 显示级别
```

依赖文件：

| 文件 | 职责 |
|---|---|
| `src/lib/article-level.ts` | Cookie 读写核心逻辑 |
| `src/components/dashboard/dashboard-daily-articles.tsx` | 仪表盘级别切换 UI，调用 `saveArticleLevel()` |
| `src/components/articles/article-level-tabs.tsx` | 文章页级别切换 UI，调用 `saveArticleLevel()` |
| `src/app/(app)/dashboard/page.tsx` | 仪表盘 Server Component，从 Cookie 读默认级别 |
| `src/app/(app)/articles/page.tsx` | 文章页 Server Component，从 URL 读级别 |
| `src/app/api/user/preferences/route.ts` | 用户偏好 API（当前不含文章级别） |

## 目标架构

```
用户点击 L2
    │
    ▼
PATCH /api/user/preferences  →  DB users.articleLevel = 2
                │
                ▼
        Dashboard/Articles 加载
                │
          DB 直查 users.articleLevel
                │
          使用服务端值（默认 1）
```

无 Cookie 参与，完全通过 API 读写服务端。

## 改造步骤

### Step 1：数据库设计

**文件：`src/lib/db/schema.ts`**

两种方案选其一：

**方案 A — 独立列（推荐当前使用）**

```typescript
articleLevel: integer("article_level").notNull().default(1),
```

**方案 B — 独立列 + JSON 扩展字段（适合未来更多配置场景）**

```typescript
preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}).notNull(),
```

`articleLevel` 仍用独立列，扩展性配置放 JSON 字段。

#### 什么适合独立列，什么适合 JSON

| 用独立列 | 用 JSON |
|---|---|
| 需要 `WHERE` 过滤（如 `WHERE articleLevel = 2`） | 仅供展示，不参与 SQL 查询 |
| 有类型约束（integer、boolean、text） | 结构灵活，经常增减 |
| 会被其他表关联或业务逻辑引用 | 用户个性化配置（字体大小、主题、布局） |
| 业务核心、语义明确的字段 | 功能开关、实验性标志 |
| 例子：`articleLevel`、`timeZone`、`showOnLeaderboard` | 例子：`fontSize`、`theme`、`sidebarCollapsed`、`editorConfig` |

#### 判断标准

> 如果一个配置项将来可能需要**写 SQL 查它**（筛选用户、统计、导出），放独立列。如果只是**读出来用**，放 JSON。

生成并执行 migration：

```bash
npx drizzle-kit generate
npm run db:migrate
```

### Step 2：扩展用户偏好 API

**文件：`src/app/api/user/preferences/route.ts`**

- **GET** 返回中增加 `articleLevel` 字段
- **PATCH** 的 Zod schema 增加可选的 `articleLevel: z.number().int().min(1).max(3)` 验证
- **PATCH** 逻辑增加 `articleLevel` 的写入

### Step 3：重写 `article-level.ts`

**文件：`src/lib/article-level.ts`**

完全替换为服务端读写，移除 Cookie 逻辑：

```typescript
export async function fetchArticleLevel(): Promise<number> {
  try {
    const res = await fetch("/api/user/preferences");
    if (!res.ok) return 1;
    const data = await res.json();
    return data.articleLevel ?? 1;
  } catch {
    return 1;
  }
}

export async function saveArticleLevel(level: number): Promise<boolean> {
  try {
    const res = await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleLevel: level }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

客户端组件不再需要 `getSavedArticleLevel()` 和 `parseArticleLevel()`，服务端组件通过 DB 直查或 session 获取。

### Step 4：改造仪表盘

**文件：`src/components/dashboard/dashboard-daily-articles.tsx`**

在 `handleLevelChange` 中调用服务端保存：

```typescript
function handleLevelChange(level: number) {
  setActiveLevel(level);
  saveArticleLevel(level);
}
```

**文件：`src/app/(app)/dashboard/page.tsx`**

当前从 Cookie 读默认级别：

```typescript
const defaultLevel = parseArticleLevel(cookieStore.get("article_level")?.value);
```

改为从 DB 直查用户 `articleLevel`：

```typescript
const [userRow] = await db
  .select({ articleLevel: users.articleLevel })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

const defaultLevel = userRow?.articleLevel ?? 1;
```

同时移除文件顶部的 Cookie 相关导入：`cookies`（来自 `next/headers`）、`parseArticleLevel`。

### Step 5：改造文章页

**文件：`src/components/articles/article-level-tabs.tsx`**

在 `onClick` 中调用服务端保存：

```typescript
onClick={() => saveArticleLevel(lv)}
```

同时可以移除 `getSavedArticleLevel` 导入。

**文件：`src/app/(app)/articles/page.tsx`**

当前从 URL param 读级别，默认值为 1：

```typescript
const level = Math.max(1, Math.min(3, parseInt(sp.level ?? "1", 10)));
```

改为：如果 URL 没有指定 level，从当前用户查 `articleLevel` 作为默认值。

### Step 6（可选）：扩展 Auth Session

如果希望减少查询次数，可以在 `src/lib/auth.ts` 的 `callbacks.jwt` 和 `callbacks.session` 中把 `articleLevel` 写入 JWT session。这样任何页面都能直接从 `session.user.articleLevel` 拿到，无需额外 DB 查询。

但需注意 session JWT 中的 `articleLevel` 可能落后于最新值（用户切换级别后 session 未刷新），Dashboard/Articles 页面读取时需确保能拿到最新值。最简单的方式仍然是每次 Server Component 渲染时 DB 直查。

## 改动汇总

| # | 文件 | 改动类型 | 说明 |
|---|---|---|---|
| 1 | `src/lib/db/schema.ts` | 修改 | users 表加 `articleLevel` 列 |
| 2 | `npx drizzle-kit generate` + `db:migrate` | 命令 | 生成并执行 migration |
| 3 | `src/app/api/user/preferences/route.ts` | 修改 | GET/PATCH 支持 `articleLevel` |
| 4 | `src/lib/article-level.ts` | 修改 | 新增服务端保存/读取函数 |
| 5 | `src/components/dashboard/dashboard-daily-articles.tsx` | 修改 | 切换级别时调用服务端保存 |
| 6 | `src/components/articles/article-level-tabs.tsx` | 修改 | 切换级别时调用服务端保存 |
| 7 | `src/app/(app)/dashboard/page.tsx` | 修改 | 从 DB 直查 `users.articleLevel`、移除 Cookie 读取 |
| 8 | `src/app/(app)/articles/page.tsx` | 修改 | 从用户 API 或 DB 获取默认级别 |
| 9 （可选） | `src/lib/auth.ts` | 修改 | session 中附带 `articleLevel` |

## 兼容性

- **旧用户**：DB 新列默认 `1`，旧用户首次加载显示 L1，切换一次后即持久化
- **离线场景**：无网络时切换级别不会保存，但不影响之前已保存的级别
- **回滚**：去掉 DB 列前确认无代码依赖即可，API 忽略未知字段