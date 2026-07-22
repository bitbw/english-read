# 应用打包方案概览

> 将 english-read（Next.js 15 SSR 应用）包装为移动 App 的方案对比。

---

## 方案对比

| 维度 | A: PWA | B1: Capacitor 远程 | B2: Capacitor 本地 | C: Tauri Mobile | D/E: 原生重写 |
|------|--------|-------------------|-------------------|-----------------|-------------|
| 改动量 | 极小 | 小 | 中等 | 中等 | 极大 |
| 开发周期 | 1 天 | 1-2 天 | 3-5 天 | 3-5 天 | 数月 |
| 原生能力 | 有限 | 丰富（插件生态） | 丰富 | 中等（Rust 桥） | 完整 |
| App Store 发布 | 需额外工具 | 直接支持 | 直接支持 | 支持 | 支持 |
| 包体大小 | 0（浏览器） | ~10-20MB | ~10-20MB | ~5-8MB | 视方案定 |
| 离线能力 | 可配置 | 无 | 可配置 | 可配置 | 完整 |
| epub.js 兼容 | 完美 | 完美 | 需适配 | 需适配 | 需重写 |
| 维护成本 | 极低 | 低 | 中 | 中 | 高 |
| 学习成本 | 无 | 低 | 中 | 中高 | 高 |

---

## 方案 A: PWA

**原理**：添加 `manifest.json` + Service Worker，用户通过浏览器"添加到主屏幕"。

**适用场景**：个人使用、快速验证、不上架商店。

**限制**：
- iOS 上推送通知支持有限
- 无法调用原生 API（文件系统等）
- 无法上架 App Store / Google Play

---

## 方案 B1: Capacitor 远程模式（推荐）

**原理**：Capacitor 原生壳加载 Vercel 线上 URL。

**适用场景**：快速上架 App Store/Google Play，后续可升级到 B2。

**详见**：[capacitor-remote-guide.md](./capacitor-remote-guide.md)

---

## 方案 B2: Capacitor 本地模式

**原理**：将 Next.js 构建产物放入 Capacitor 本地目录，支持离线。

**关键挑战**：
- Next.js SSR 路由（`getServerSideProps`）在静态导出中不可用
- 需使用 `next export` 或配置 `output: 'export'`
- 动态路由需要 `generateStaticParams`
- API 路由需要独立部署（Vercel Serverless 或独立 server）

**适用场景**：需要离线阅读核心功能。

---

## 方案 C: Tauri Mobile

**原理**：Rust 原生壳 + 系统 WebView，包体最小。

**注意**：
- 移动端生态不够成熟
- 插件数量远少于 Capacitor
- Rust 后端开发有学习成本

**适用场景**：对包体大小极度敏感、团队有 Rust 经验。

---

## 方案 D: React Native / Expo WebView

**原理**：RN 应用内含 WebView 加载 Web 页面，可逐步原生化。

**适用场景**：最终目标是完全原生应用、团队有 RN 经验。

**风险**：epub.js 在 RN WebView 中可能有兼容性问题。

---

## 方案 E: Flutter 重写

**原理**：完全用 Flutter + Dart 重写。

**适用场景**：需要真正跨平台一致体验、团队有 Flutter 经验。

**风险**：
- 需寻找或自研 Flutter EPUB 解析方案
- 后端 API 全部重新对接
- 维护双代码库

---

## 推荐路线

```
MVP（1-2 天） → B1: Capacitor 远程模式
    │
    ├── 需要离线? → B2: Capacitor 本地模式
    │
    ├── 需要更小包体? → C: Tauri Mobile
    │
    └── 需要完整原生体验? → D/E: 原生重写
```