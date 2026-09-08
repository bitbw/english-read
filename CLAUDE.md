# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This repo uses **npm** (see `package-lock.json`).

```bash
npm run dev           # Start development server (port 3000)
npm run build         # Production build (also runs ESLint)
npm run start         # Start production server
npm run lint          # Run ESLint only
npx tsc --noEmit      # TypeScript type check only

# Database migrations
npx drizzle-kit generate   # Generate migration files from schema changes
npm run db:migrate         # Apply migrations (drizzle-kit migrate)
npx drizzle-kit studio     # Open Drizzle Studio (DB browser)
```

## Environment Variables

Required in `.env.local`:
```
AUTH_SECRET=
AUTH_URL=http://localhost:5000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
POSTGRES_URL=              # Neon pooled connection
POSTGRES_URL_NON_POOLING=  # Neon direct connection (used by drizzle-kit)
BLOB_READ_WRITE_TOKEN=     # Vercel Blob
```

## Architecture

### Route Groups
- `(app)/` — authenticated pages with Sidebar + Topbar layout (`layout.tsx`)
- `(auth)/` — login and error pages (no nav shell)
- `read/[bookId]/` — full-screen reader, uses `-m-6` to escape the layout's `p-6` padding; height is `calc(100vh - 3.5rem)` to fill below the topbar

### Authentication
`middleware.ts` guards all routes under `/dashboard`, `/library`, `/read`, `/vocabulary`, `/settings`, `/leaderboard`, `/admin`, `/articles`, `/guide`. Auth is NextAuth v5 (GitHub, Google, email/password, phone OTP via Aliyun Dypns) with **JWT** session strategy (`session.strategy: "jwt"`). The Drizzle adapter still uses the `sessions` table for adapter/OAuth data; the live session is JWT-based. The `auth()` helper works in both Server Components and API routes. User roles: `user` | `admin` (enforced for `/admin`). Middleware also updates `lastOnlineAt` with 5-minute throttle and sets Sentry user in production.

### Database
Drizzle ORM over Neon serverless PostgreSQL (`src/lib/db/`). Schema in `schema.ts` with Auth.js tables (`users`, `accounts`, `sessions`, `verificationTokens`) plus app tables:
- `books` / `public_library_books` — personal + community bookshelf
- `vocabulary` / `review_logs` — word list + SRS review history
- `reading_daily_time` / `review_daily_stats` — daily stats per user
- `daily_articles` — scraped English articles from levelread.com

Import `db` from `@/lib/db`.

### UI Components
Uses **shadcn/ui v4** built on `@base-ui/react` (not Radix). Two key differences from standard shadcn:
1. No `asChild` prop — use `render={<Link href="..." />}` pattern instead
2. `buttonVariants` must be imported from `@/components/ui/button-variants` (not from `button.tsx`) when used in Server Components, because `button.tsx` has `"use client"` which proxies exports to Server Components

### i18n (Internationalization)
`next-intl` ^4.9.1 with locale stored in `locale` cookie (default `zh`). Valid locales: `zh`, `en`. Translation files in `messages/{zh,en}.json`. Config in `src/i18n/request.ts`. Uses Cookie routing strategy (URL unchanged). Use `getLocale()` / `getMessages()` from `next-intl/server` in Server Components, `useTranslations()` hook in Client Components.

### Data Fetching Pattern
Uses **SWR** for client-side data fetching. The `clientFetch` utility (`src/lib/client-fetch.ts`) wraps fetch with typed error handling. Key pattern: `const { data, error, isLoading } = useSWR<ApiResponse<T>>('/api/...', url => clientFetch(url))`.

### EPUB Reader
`EpubReader` (`components/reader/epub-reader.tsx`) is always `dynamic`-imported with `ssr: false`. Key design:
- `flow: "paginated"`, pixel dimensions from `getBoundingClientRect()` (not `%`)
- `ResizeObserver` on the viewerRef div calls `rendition.resize(w, h)` on container changes
- All `rendition.on(...)` event handlers registered **before** `rendition.display()` — registering after misses the first `relocated` event
- Reading progress saved via `fetch` in the `relocated` handler, plus `navigator.sendBeacon` on `visibilitychange` for reliable save when navigating away
- Touch swipe registered per iframe `view.window` in the `rendered` event; uses a `WeakSet` to avoid duplicate listeners across re-renders
- `EpubReader` is stateless for font size (receives `fontSize` prop from `ReaderClient`) and exposes `prev`/`next` controls via `onReady` callback

### Spaced Repetition (SRS)
`src/lib/srs.ts` — Ebbinghaus intervals: stage 0→1 day, 1→2d, 2→4d, 3→7d, 4→15d, 5→30d, 6+→mastered. "Forgot" resets to stage 0. `vocabulary.reviewStage` and `vocabulary.nextReviewAt` drive the review queue (`GET /api/review` returns items where `nextReviewAt ≤ now`).

### Review Quiz System
`src/lib/review-quiz.ts` defines the quiz UI logic: Chinese 4-option multiple choice with dynamic distractors (sourced from user's vocabulary + generic decoys), plus multi-meaning display. The quiz is a Client Component (`components/review/`), backed by API routes: `/api/review/plan` (fetch review plan), `/api/review/submit` (submit answer), `/api/review/stats` (review statistics), `/api/review/similar-words` (distractor suggestions).

### File Storage
EPUB files uploaded to Vercel Blob via `src/lib/blob.ts`. The `blobUrl` is stored in `books.blobUrl` and passed directly to epubjs as the book source. Cover images also stored via Blob (`/api/upload/cover`).

### Dictionary / Translation API
`GET /api/dictionary?word=...` — proxies Free Dictionary API (English definitions, single words only) and MyMemory/Google Translate API (Chinese translation, all inputs). Both are cached 24h with `next: { revalidate: 86400 }`.

### Analytics & Observability
- **PostHog** — user analytics via `posthog-js` + `@/components/posthog-provider.tsx`; per-page tracking via `SuspendedPostHogPageView`
- **Sentry** — error tracking via `@sentry/nextjs`; user identity synced in middleware
- **Vercel Analytics** — basic traffic analytics

### Public Library
Community book sharing system with tiered ratings. Upload flow: upload EPUB to Vercel Blob (`/api/library/public/blob`), then finalize with metadata (`/api/library/public/finalize`). Browse at `/library/store`, detail at `/library/store/[publicBookId]`.

## 文档输出规范

产出方案、实施或输出类文档时,统一遵守以下规则:

1. 文档写入当前项目 `docs/<分类>/` 目录,禁止写到项目根目录或其他位置。
2. 优先复用 `docs/` 下已有的分类文件夹;仅当现有分类都不合适时才新建分类。
3. 同一主题的相关文档(方案、实施、输出等)应集中在同一分类文件夹下。
## 提交、合并与发布推送规范

- 使用简洁的 Conventional Commit 风格提交信息，例如 `feat: add recurring ledger entries`、`fix: ...` 或 `docs: ...`。保持每次提交聚焦。
- Pull Request 应说明行为变更、数据库/迁移影响、所需环境变量和验证命令；涉及 UI 变更时附上截图，并明确 Preview/production 的迁移步骤。
- `main` 是生产分支，`preview` 是预览、测试和验证分支。
- 用户要求“发布 prod”或生产发布时：先检查工作区；如有未提交改动，使用清晰命名的 stash 保存。切换到 `main`，拉取最新远程代码，将当前开发分支合并到 `main` 并推送；完成后返回原开发分支，恢复 stash（如有）并推送原分支。
- 用户要求“发布 test”“发布预览”“发布测试分支”等时，按上述流程操作，但目标分支改为 `preview`。
- 如果开发工作本来就在 `preview`，且用户只要求推送/测试预览分支，直接提交并推送 `preview`，不要执行自合并。
- 任何分支切换前都必须先执行 `git status`。不得丢失未提交工作；所有 stash 必须在分支操作完成后恢复。
