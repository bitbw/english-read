# English Read

> 一个全栈 EPUB 阅读器与间隔重复词汇学习平台。

[English](./README.md) | **中文文档**

---

## 项目简介

English Read 是一款基于 Next.js 15 的全栈 Web 应用，将在线 EPUB 阅读器与 SRS（间隔重复系统）词汇学习工作流结合在一起。支持个人上传与**公共书库**浏览，阅读时随时查词，再通过基于艾宾浩斯遗忘曲线的闪卡系统复习。

## 功能特性

- **EPUB 阅读器** — 分页阅读，字号调节，自动保存阅读进度
- **个人书架与公共书库** — 本地上传；浏览共享书目并加入个人书架
- **生词本** — 阅读中收藏生词；支持复习计划视图
- **间隔重复复习** — 艾宾浩斯间隔：1天 → 2天 → 4天 → 7天 → 15天 → 30天 → 已掌握；配置 AI 网关后可为干扰项生成相似词
- **词典与翻译** — 英文释义（Free Dictionary API）+ 中文翻译（MyMemory）；可选用 Google Cloud Translation 作为机翻回退；缓存 24 小时
- **身份验证** — NextAuth v5：GitHub / Google OAuth、邮箱密码、手机短信验证码（阿里云）；统一 **JWT** 会话
- **国际化** — 中英文 UI（next-intl，Cookie，URL 不变）
- **深色模式** — 跟随系统或可切换主题
- **可观测性** — Sentry 错误监控；可选用 PostHog、Vercel Analytics

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 + React 19（App Router） |
| 语言 | TypeScript（严格模式） |
| UI | shadcn/ui v4（`@base-ui/react`）、Tailwind CSS v4 |
| 认证 | NextAuth v5（OAuth + 凭证 + 手机 OTP）、JWT 会话 |
| 数据库 | Drizzle ORM + Neon serverless PostgreSQL |
| 文件存储 | Vercel Blob |
| 国际化 | next-intl ^4.9.1 |
| EPUB 引擎 | epubjs |
| 错误监控 | @sentry/nextjs |
| 分析 | 可选：PostHog、`@vercel/analytics` |

## 快速开始

### 前置要求

- Node.js 18+
- npm（仓库内含 `package-lock.json`）

### 安装依赖

```bash
git clone <repo-url>
cd english-read
npm install
```

### 环境变量

在项目根目录创建 `.env.local`。**最小集**（本地登录 + 数据库 + 上传）：

```env
AUTH_SECRET=
AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
POSTGRES_URL=              # Neon 连接池地址
POSTGRES_URL_NON_POOLING=  # Neon 直连地址（供 drizzle-kit 使用）
BLOB_READ_WRITE_TOKEN=     # Vercel Blob
```

使用 `npx auth secret` 生成 `AUTH_SECRET`。

短信登录、复习 AI 干扰项、翻译回退、埋点等**可选**变量见仓库根目录 [`.env.example`](./.env.example)。

### 数据库初始化

```bash
npx drizzle-kit generate   # 根据 Schema 生成迁移文件
npm run db:migrate         # 执行迁移（等同于 drizzle-kit migrate）
# 或：npx drizzle-kit migrate
npx drizzle-kit studio     # 打开 Drizzle Studio
```

### 开发运行

```bash
npm run dev       # 开发服务器 http://localhost:3000
npm run build     # 生产构建（含 ESLint）
npm run start     # 构建后启动生产服务
npm run lint      # 仅 ESLint
npx tsc --noEmit  # 仅 TypeScript 类型检查
```

## 目录结构

```
src/
├── app/
│   ├── (app)/                   # 需登录：侧栏 + 顶栏布局
│   │   ├── dashboard/
│   │   ├── library/             # 个人书架与上传
│   │   ├── library/store/       # 公共书库浏览与投稿
│   │   ├── vocabulary/          # 生词列表
│   │   ├── vocabulary/review/   # SRS 闪卡复习
│   │   ├── vocabulary/plan/     # 复习计划
│   │   ├── read/[bookId]/       # 全屏 EPUB 阅读器
│   │   └── settings/
│   ├── (auth)/                  # 登录、注册、错误页（无应用外壳）
│   ├── api/
│   └── dev/                     # 内部/开发用页面（可选）
├── components/
│   ├── reader/
│   └── ui/
├── lib/
│   ├── db/
│   ├── srs.ts
│   ├── blob.ts
│   └── auth.ts
├── i18n/
└── middleware.ts
messages/
├── en.json
└── zh.json
```

## 架构说明

### 身份验证

`middleware.ts` 保护 `/dashboard`、`/library`、`/read`、`/vocabulary`、`/settings`。会话策略为 **JWT**。支持 GitHub、Google、邮箱密码（bcrypt）、手机短信验证码（需阿里云环境变量）。已登录用户访问 `/login` 或 `/signup` 会重定向到 `/dashboard`。

### EPUB 阅读器

`EpubReader` 始终以 `{ ssr: false }` 动态导入。分页模式，尺寸来自 `getBoundingClientRect()`。Touch 滑动注册在各 iframe 的 `view.window` 上。

### 间隔重复

阶段对应：`0→1d, 1→2d, 2→4d, 3→7d, 4→15d, 5→30d, 6+→已掌握`。「忘了」将阶段重置为 0。复习队列由 `vocabulary.nextReviewAt ≤ now` 驱动。

### UI 组件

基于 `@base-ui/react` 的 **shadcn/ui v4**（非 Radix）：

- 无 `asChild`，使用 `render={<Link href="..." />}`
- 在 Server Components 中从 `@/components/ui/button-variants` 导入 `buttonVariants`

## 部署指南

默认部署在 **Vercel**。推荐顺序：**Storage** → 注册 **OAuth** → 配置 **`.env.local`** → 对 Neon 执行一次 **`npm run db:migrate`** → **关联 GitHub 仓库**并部署。迁移 SQL 已纳入版本库（`src/lib/db/migrations/`），[`drizzle.config.ts`](./drizzle.config.ts) 使用 **`POSTGRES_URL_NON_POOLING`**。可选环境变量见根目录 [`.env.example`](./.env.example)。

### 1. 创建 Vercel Storage

登录 [Vercel Dashboard](https://vercel.com/dashboard) → 选择或新建项目 → **Storage**，创建：

**Postgres (Neon)**

| 字段 | 值 |
|------|-----|
| 类型 | **Postgres** |
| 用途 | 用户、书籍、生词、复习记录等业务数据 |
| 创建后自动注入 | `POSTGRES_URL`、`POSTGRES_URL_NON_POOLING` |

将数据库**关联到当前 Vercel 项目**后，变量会出现在 **Settings → Environment Variables**；本地开发可在 Storage 详情页复制到 `.env.local`。

**Blob**

| 字段 | 值 |
|------|-----|
| 类型 | **Blob** |
| 建议命名 | `english-read-epub` |
| 用途 | 存储上传的 EPUB 文件 |
| 创建后自动注入 | `BLOB_READ_WRITE_TOKEN` |

### 2. 创建 OAuth 应用

**Google OAuth**

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials → **Create Credentials** → OAuth 2.0 Client IDs
3. Application type 选 **Web application**
4. **Authorized redirect URIs** 同时添加本地与生产：

   ```
   http://localhost:3000/api/auth/callback/google
   https://你的域名.vercel.app/api/auth/callback/google
   ```

5. 保存后复制 **Client ID** 和 **Client Secret**

**GitHub OAuth**

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
2. 本地开发：

   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

3. 生产环境：单独创建 OAuth App，或将 callback 改为 `https://你的域名.vercel.app/api/auth/callback/github`
4. 复制 **Client ID**，并 **Generate a new client secret**

### 3. 配置 `.env.local`

在项目根目录创建 `.env.local`（与 Vercel **Production** 变量保持一致；若使用 Preview 环境可单独配置）：

```env
# Auth.js
AUTH_SECRET=          # 运行下方命令生成
AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Neon — Vercel Storage / 项目环境变量
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=
```

生成 `AUTH_SECRET`：

```bash
npx auth secret
```

将输出的字符串填入 `AUTH_SECRET=` 后面。

### 4. 数据库迁移

[`drizzle.config.ts`](./drizzle.config.ts) 会通过 `@next/env` 加载环境变量，并基于 **`POSTGRES_URL_NON_POOLING`** 执行 `src/lib/db/migrations/` 下的迁移。

- **首次部署 / 空库：**在本地 `.env.local` 中指向目标 Neon（或临时使用生产直连串），执行：

  ```bash
  npm run db:migrate
  ```

  **无需**在生产机上执行 `npx drizzle-kit generate`——迁移文件已在仓库中；只有修改了 `src/lib/db/schema.ts` 才需要在本地 `generate` 并提交新的 SQL。

- **修改 Schema 后：**本地执行 `npx drizzle-kit generate`，提交 `src/lib/db/migrations/` 中的新文件，部署后再对各环境执行 `npm run db:migrate`。

可选：`npx drizzle-kit studio` 使用同一连接打开 Drizzle Studio。

### 5. 本地启动

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)

### 6. 在 Vercel 上部署

**方式 A — 关联 Git（推荐）**  
在 Vercel 中 Import 本仓库，框架选 Next.js，在 **Environment Variables** 中填入生产所需变量后，向 `main`（或你的生产分支）推送即可触发构建；默认构建命令为 `npm run build`。

**方式 B — Vercel CLI**

```bash
npm i -g vercel   # 若未安装
vercel            # 预览部署
vercel --prod     # 生产部署
```

### 7. 部署完成后

1. **环境变量** — 在 Vercel → **Settings** → **Environment Variables** 中配置与 `.env.local` 对应的项；将 **`AUTH_URL`** 设为生产站点根地址（例如 `https://你的域名.vercel.app`），不要使用 `http://localhost:3000`。
2. **OAuth** — 在 Google Cloud Console 与 GitHub OAuth 中确认生产回调 URL（见 §2）。
3. **可选业务能力** — 变量名与说明见 [`.env.example`](./.env.example)。**获取方式**如下：

   | 变量 | 用途 | 获取方式 |
   |------|------|----------|
   | `AI_GATEWAY_API_KEY` | 复习相似词干扰项（`/api/review/similar-words`） | [Vercel 控制台](https://vercel.com/dashboard) → **AI** → **AI Gateway** → API 密钥 · [AI Gateway 文档](https://vercel.com/docs/ai-gateway) |
   | `GOOGLE_TRANSLATE_API_KEY` | `/api/dictionary` 机翻回退 | [Google Cloud Console](https://console.cloud.google.com/) → 启用 [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com) → **API 与服务** → **凭据** → 创建 API 密钥 |
   | `NEXT_PUBLIC_POSTHOG_KEY`、`NEXT_PUBLIC_POSTHOG_HOST` | PostHog 客户端埋点 | [PostHog](https://app.posthog.com/) → **项目设置** → **Project API Key**；`HOST` 为分区采集地址（见 [分区说明](https://posthog.com/docs/api#capture-api)，如 `https://us.i.posthog.com`） |
   | `ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET`、`ALIYUN_SMS_SIGN_NAME`、`ALIYUN_SMS_TEMPLATE_CODE` 等 | 阿里云短信 OTP（融合认证 DYPNS）登录 | AccessKey：[RAM 访问控制](https://ram.console.aliyun.com/manage/ak)；签名与模板：[号码认证控制台](https://dypns.console.aliyun.com/)；RAM 需 `dypns:SendSmsVerifyCode`、`CheckSmsVerifyCode`；仓库内说明见 [`docs/阿里云/`](./docs/阿里云/) |
   | `SENTRY_AUTH_TOKEN` | 构建时上传 **source map**（堆栈可读） | [Sentry](https://sentry.io) → 组织 → **Settings** → **Developer Settings** → **Auth Tokens** · [Next.js Source Maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#step-4-add-readable-stack-traces-with-source-maps-optional) |

   **Sentry 运行时** — DSN 已写在代码中，生产环境（`NODE_ENV === "production"`）会自动上报。**`SENTRY_AUTH_TOKEN`** 仅在需要在 Vercel 构建阶段上传 source map 时配置。

### 8. 数据库表结构一览

| 表名 | 说明 |
|------|------|
| `users` | 用户基本信息（Auth.js）；邮箱、手机号、密码哈希等 |
| `accounts` | OAuth 账户绑定（Auth.js） |
| `sessions` | Auth.js 适配器使用的会话记录 |
| `verification_tokens` | 邮箱验证（Auth.js） |
| `public_library_books` | 公共书库书目 |
| `books` | 个人书架；EPUB Blob 地址与阅读进度 |
| `reading_daily_time` | 每日阅读时长（秒） |
| `vocabulary` | 生词本；艾宾浩斯阶段与下次复习时间 |
| `review_logs` | 每次复习记录（记住 / 遗忘） |
