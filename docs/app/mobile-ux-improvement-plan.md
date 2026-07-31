# Capacitor App 移动端体验优化方案

> 基于当前项目（Next.js 15 + Capacitor 远程模式）的移动端 UX 差距分析及分阶段改进建议。
> 目标：让 App 端体验接近原生应用水准，消除"网页套壳"感。

---

## 现状概览

| 维度 | 当前状态 | 差距等级 |
|------|---------|---------|
| 移动端导航 | 仅汉堡菜单抽屉，`BottomNav` 已实现但被注释 | 🔴 阻塞级 |
| 页面过渡动画 | 无任何路由切换动画，页面切换生硬 | 🔴 阻塞级 |
| 阅读器（EPUB） | 触摸翻页、划词弹窗基础功能完备 | 🟡 待优化 |
| 阅读器（文章） | 无触摸翻页，体验与 EPUB 不一致 | 🟡 待优化 |
| 安全区域适配 | 未处理刘海屏、Home Indicator | 🟡 待优化 |
| 触觉反馈 | 无任何触觉反馈 | 🟢 锦上添花 |
| PWA | Manifest 不完整，无 Service Worker | 🟡 待优化 |
| iOS 支持 | 未配置 | 🟡 待优化 |
| 加载体验 | 仅仪表盘有骨架屏，阅读器启动只有一个"Loading"文字 | 🟡 待优化 |
| 原生功能 | 硬件返回键、文件选择器、分享等未使用原生能力 | 🟢 锦上添花 |

---

## Phase 1 — 高优先级（1-2 天）

这些改动影响面广、用户感知强，是消除"网页套壳"感的核心。

### 1.1 启用底部导航栏（BottomNav）

**问题**：当前移动端只能通过顶栏汉堡菜单导航，不符合移动端用户习惯。底部标签栏是移动 App 的标配。

**方案**：
1. 在 `src/app/(app)/layout.tsx` 中取消 `BottomNav` 的注释
2. 验证所有页面的 `pb-20 md:pb-0`（如 `article-reader-client.tsx`、`articles/page.tsx`）已覆盖
3. 在 `globals.css` 中添加 `safe-area-inset-bottom` 工具类：

```css
.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

4. 确认 `BottomNav` 在 Capacitor 原生环境中隐藏下载标签（代码已处理 `isNative` 判断）

**涉及文件**：
- `src/app/(app)/layout.tsx` — 取消 `BottomNav` 导入和渲染注释
- `src/components/layout/bottom-nav.tsx` — 验证状态/样式
- `src/app/globals.css` — 添加安全区域工具类
- 各页面 — 确认 `pb-20` 一致

**预期效果**：底部 5 个标签（首页、每日阅读、我的书库、词库、下载App），点击即切换，当前标签高亮。

---

### 1.2 修复 100vh 问题

**问题**：主布局使用 `h-screen`（Tailwind 的 `100vh`），移动端浏览器地址栏展开/收起时会导致高度跳动或底部内容被截断。

**方案**：将 `h-screen` 替换为 `h-dvh`（dynamic viewport height），或使用 CSS `dvh` 单位：

```css
/* globals.css */
.min-h-app {
  min-height: 100vh;
  min-height: 100dvh;
}
.h-app {
  height: 100vh;
  height: 100dvh;
}
```

**涉及文件**：
- `src/app/(app)/layout.tsx` — `h-screen` → `h-dvh` 或应用自定义类
- 任何使用 `h-screen` 的其他布局文件

---

### 1.3 添加页面过渡动画

**问题**：页面切换完全没有动画，在 App 中显得突兀。

**方案 A（轻量，推荐）**：使用 CSS `view-transition` API（Chrome 111+ 支持）：

```css
/* globals.css */
@view-transition {
  navigation: auto;
}
```

这是最简单的方式，零依赖，但仅 Chrome 支持。

**方案 B（兼容性更好）**：使用 Framer Motion 封装布局组件：

```bash
npm install framer-motion
```

在 `src/app/(app)/layout.tsx` 中添加页面包裹：

```tsx
import { motion, AnimatePresence } from "framer-motion";

// 在主内容区域包裹
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

**方案 C（最小化改动）**：使用纯 CSS fade-in：

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
main > * { animation: fade-in 0.2s ease-out; }
```

**推荐**：先用方案 A（CSS view-transition，零代码改动量），再评估是否需要升级。

---

### 1.4 全局样式 & 安全区域

**操作清单**：

```css
/* src/app/globals.css — 添加以下内容 */

/* 安全区域内边距工具类 */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.safe-area-top {
  padding-top: env(safe-area-inset-surface, 0px);
}

/* 触摸目标最小尺寸（所有可点击元素至少 44px） */
@layer base {
  button, a, [role="button"] {
    @media (max-width: 767px) {
      min-height: 44px;
    }
  }
}

/* 禁止文本选中（App 全局） */
.no-select {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

**涉及文件**：
- `src/app/globals.css`

---

## Phase 2 — 中等优先级（2-3 天）

这些改动进一步提升体验，用户能明显感知到"更像一个 App"。

### 2.1 阅读器启动骨架

**问题**：EPUB 阅读器加载时只显示 `loadingBook`（一个字符串），没有任何骨架或进度反馈。

**方案**：
- 为 `EpubReader` 创建专用的骨架组件
- 显示书籍封面占位 + 进度条
- 可以复用现有的 `src/components/ui/skeleton.tsx`

```tsx
// src/components/reader/reader-keleton.tsx
export function ReaderSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <Skeleton className="h-64 w-48" />  // 封面占位
      <div className="space-y-3 w-full max-w-md">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-2 w-40" />      // 进度条草
        <Skeleton className="h-4 w-16" />       // 进度文字
      </div>
    </div>
  );
}
```

**涉及文件**：
- `src/components/reader/` — 新建骨架组件
- `src/app/(app)/read/[bookId]/reader-client.tsx` — 加载状态切换

---

### ️2.2 文章阅读器触摸翻

**问题**：文章阅读器（`article-reade-client.tsx`）没有触摸翻页功能，用户在 EPUB 阅读器和文章阅读器之间的体验不一致。

**方案**：复用 EPUB 阅读器的滑动逻辑，在文章阅读器中添加左右滑动翻页：

```tsx
// 在 article-reader-client.tsx 中添加
const [touchStart, setTouchStart] = useState<number | null>(null);
const SWIPE_THRESHOLD = 80;

const handleTouchStart = (e: React.TouchEvent) => {
  setTouchStart(e.touches[0].clientX);
};

const handleTouchEnd = (e: React.TouchEvent) => {
  if (touchStart === null) return;
  const diff = e.changedTouches[0].clientX - touchStart;
  if (Math.abs(diff) > SWIPE_THRESHOLD) {
    if (diff > 0) navigatePrev(); // 右滑 = 上一
    else navigateNext();          // 左 = 下一章
  }
  setTouchStart(null);};
```
```

**涉及文件**：
- `src/app/(app)/articles/[id]/article-reader-client.tsx`

---

### 2.3 添加原生返回按钮处理

**问题**：Android 硬件返回键默认会退出 App，无法回到上一页或关闭抽屉。

**方案**：添加 Capacitor App 插件监听：

```tsx
// src/hooks/se-android-back-button.ts
mport { useEffect } from "react";
mport { App } from "@capacitor/app";
mport { isCapacitor } from "@/lib/is-capacitor";export functon useAndoidBackButton(handler: () => boolean) {
  useEffect(() => {
    if (!isCapacitor()) return;
    const listener = App.addListener("backButton", () => {
      // 返回 true 表示已处理，App 不退出
      // 返回 false 表示未处理，App 执行默认行为
      handler();
    });
    return () => listener.remove();
  }, [handler]);}
```

在布局中注册：先尝试关闭弹窗/抽屉 → 再返回上一页 → 最后退出 App。

**涉及文件**：
- `src/hooks/se-android-back-button.ts` — 新建
- 可能需要调整 `epub-reader.tsx` 或 `reader-client.tsx`

---

### 2.4 使用原生文件选择器

**问题**：上传 EPU 文件使用浏览器 `<input type="file">`，在 App 中不够"原生"。

**方案**：安装 `@capactor/dialog` 或保持现状（差异不大，优先级低）。

```
npm install @capactor/dialog
npx cap sync
```

然后用原生弹窗确认替换浏览器的 `confrm()`。

---

### 2.5 补全 PWA Manifest

**问题**：`public/manifest.webmanifest` 缺少核心字段。

**方案**：

```json
{
  "name": "English Read",
  "short_name": "EnRead",
  "descrption": "全栈 EB 英语读平台",
  "start_url": "/login",
  "dispay": "standalone",
  "ackround_color": "#F8FAFC",
  "theme_color": "#F8FAFC",
  "rientation": "portrait",
  "icons": [
    { "src": "/icons/icon-48x48.png", "sizes": "48x48", "ype": "mage/png" },
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "ype": "mage/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "ype": "mage/png" }
  ]}
```

**涉及文件**：
- `public/manifest.webmanifest`

---

## Phase 3 — 视觉精细化（1-2 天）

这些改动不涉及功能变更，只调整 UI 细节，让 App 看起来更精致。

### 3.1 ）动屏幕优化

**问题**：当前启动屏只显示背景色 `#F8FAFC`，没有任何 Logo 或品牌元素。

**方案**：
1. 在 `capacitor.config.ts` 中配置：

```ts
SplashScreen: {
  launchShowDuration: 1500,
  backgroundColor: "#F8FAFC",
  androidSplashResourceName: "splash",
  showSpinner: false,
}
```

2. Android 原生：在 `android/app/src/main/res/drawable/` 中添加自定义 splash 布局（带 Logo 居中）
3. 下一版本可考虑用 Splash Screen API 在 WebView 加载完成后才隐藏

---

### 3.2 统触摸反馈

**问题**：所有按钮点击既无触觉反馈也无微交互动画。

**方案**：
- 在 Capacitor 中：使用 Haptics 插件

```bash
npm install @capacitor/haptics
npx cap sync
```

```ts
import { Haptics } from "@capacitor/haptics";

// 轻反馈（按钮点击）
await Haptics.impact({ style: ImpactStyle.Light });

// 成功反馈
await Haptics.notification({ type: NotificationType.Success });
```

- 在 CSS 中：统一 `active:scale-95` 效果（Tailwind 可直接用）
- 不需要每个按钮都加触觉，在关键交互上用（翻页、提交、收藏等）

---

### 3.3 状态栏适配

**问题**：未配置状态栏样式，Android 上可能白底白字或黑底黑字。

**方案**：

```bash
npm install @capacitor/status-bar
npx cap sync
```

```ts
import { StatusBar, Style } from "@capacitor/status-bar";

// 亮色模式
await StatusBar.setStyle({ style: Style.Dark });

// 暗色模式
await StatusBar.setStyle({ style: Style.Light });

// 设置背景色（Android）
await StatusBar.setBackgroundColor({ color: "#F8FAFC" });
```

在布局初始化时根据主题动态切换。

---

### 3.4 动化底部安全区域

**问题**：只有 BottomNav 使用了 `safe-area-inset-bottom`，但其他固定在底部的元素也需要。

**需要处理的元素**：
- 阅读器底部控制栏
- 查词弹窗（移动端底部已加 45px 预留，需用 `env()` 替代硬编码）
- 任何 `fixed bottom-*` 的组件

---

### 3.5 刷新指示器

**问题**：当前下拉刷新只有文字指示器，不够直观。

**方案**：在 `pull-to-refresh.tsx` 中优化：
- 添加 Material Design 风格旋转加载弧线
- 拉动距离与弧线角度/颜色渐变联动
- 释放后弧线变为完整旋转动画

---

## Phase 4 — 进阶功能（视需求）

| 功能 | 说明 | 复杂度 |
|------|------|--------|
| 滑动返回（iOS 边缘返回） | iOS 从左边缘右滑返回上一页 | 中 |
| 原生分享 | 使用 `@capacitor/share` 分享书籍/文章 | 低 |
| 深色模式自动跟随系统 | 在 Capacitor 中用 ` Appearance` 插件监听系统主题 | 低 |
| 推送通知 | `@capacitor/push-notifications` + Firebase | 高 |
| 离线缓存 | Service Worker 缓存已打开的书籍和查词记录 | 高 |
| 动画翻页效果 | 模拟真实书页翻动（Canvas/WebGL） | 高 |
| 沉浸式阅读模式 | 隐藏状态栏、全屏、自适应字号 | 中 |

---

## 建议实施顺序

```
Phase 1 (高优先级)
├── 1.1 启用 BottomNav           ← 最优先，一次性解决导航问题
├── 1.2 修复 100vh 问题           ← 解决布局跳动
├── 1.3 添加页面过渡动画           ← 提升切换流畅感
└── 1.4 全局样式 & 安全区域       ← 基础 CSS 完善

Phase 2 (中优先级)
├── 2.1 阅读器骨架屏              ← 消除空加载
├── 2.2 文章阅读器触摸翻页         ← 统一阅读体验
├── 2.3 原生返回按钮              ← Android 必要
├── 2.4 原生文件选择器            ← 锦上添花
└── 2.5 PWA Manifest 补全        ← Web 用户也需要

Phase 3 (视觉精细化)
├── 3.1 启动屏优化               ← 第一印象
├── 3.2 统一触摸反馈              ← 微交互
├── 3.3 状态栏适配               ← 系统融合
├── 3.4 底部安全区域全面覆盖       ← 完善适配
└── 3.5 下拉刷新视觉优化          ← 细节提升
```

---

## 各改动投入产出比评估

| 改动 | 预计工时 | 用户感知度 | 性价比 |
|------|---------|-----------|--------|
| 启用 BottomNav | 30 min | ⭐⭐⭐⭐⭐ | ★★★★★ |
| CSS view-transition 动画 | 10 min | ⭐⭐⭐⭐ | ★★★★★ |
| 安全区域 CSS | 30 min | ⭐⭐⭐ | ★★★★ |
| 100vh 修复 | 15 min | ⭐⭐⭐ | ★★★★ |
| 阅读器骨架屏 | 1 hr | ⭐⭐⭐ | ★★★★ |
| 文章触摸翻页 | 1-2 hr | ⭐⭐⭐ | ★★★ |
| 原生返回按钮 | 1 hr | ⭐⭐⭐ | ★★★ |
| 启动屏 Logo | 2 hr（需设计资源） | ⭐⭐⭐ | ★★★ |
| 状态栏适配 | 30 min | ⭐⭐ | ★★★ |
| 触觉反馈 | 2 hr | ⭐⭐ | ★★ |
| PWA Manifest | 15 min | ⭐ | ★★ |

---

## 技术预研要点

1. **view-transition API 兼容性**：Chrome 111+ / Android WebView 均支持，适合 Capacitor 场景。Safari 在 18+ 版本支持，iOS 可能需要 fallback。

2. **dvh 单位兼容性**：Android WebView 和现代 iOS 均支持 `100dvh`，可以放心使用。

3. **BottomNav 状态保持**：由于是 Next.js App Router，用 Link 导航会触发 RSC 刷新，天然保持底部导航状态。Active 标签通过 `usePathname()` 判断。

4. **动画库选择**：
   - Framer Motion：功能最全但包体积较大（~30KB gzipped）
   - CSS view-transition：零依赖，足够满足页面切换动画
   - 建议：先用 view-transition，发现不够再用 Framer Motion

5. **安全区域值**：
   - `env(safe-area-inset-top)` — 刘海屏/状态栏区域
   - `env(safe-area-inset-bottom)` — Home Indicator 区域
   - `env(safe-area-inset-left)` / `env(safe-area-inset-right)` — 挖孔屏

---

## 参考资源

- [Capacitor 官方文档 — 用户体验指南](https://capacitorjs.com/docs/guides/splash-screens)
- [web.dev —  safe-area-inset-* 详解](https://web.dev/issue/10084)
- [Tailwind CSS v4 — dvh 支持](https://tailwindcss.com/docs/height)
- [CSS View Transitions API 文档](https://developer.mozilla.org/en-us/dos/Wen/API/View_transitions_API)