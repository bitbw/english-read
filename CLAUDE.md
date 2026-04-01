# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Start development server
yarn build        # Production build (also runs ESLint)
yarn lint         # Run ESLint only
npx tsc --noEmit  # TypeScript type check only

# Database migrations
npx drizzle-kit generate   # Generate migration files from schema changes
npx drizzle-kit migrate    # Apply migrations to the database
npx drizzle-kit studio     # Open Drizzle Studio (DB browser)
```

## Environment Variables

Required in `.env.local`:
```
AUTH_SECRET=
AUTH_URL=http://localhost:3000
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
`middleware.ts` guards all routes under `/dashboard`, `/library`, `/read`, `/vocabulary`, `/settings`. Auth is NextAuth v5 using GitHub + Google OAuth with Drizzle adapter persisting sessions to Postgres. The `auth()` helper works in both Server Components and API routes.

### Database
Drizzle ORM over Neon serverless PostgreSQL (`src/lib/db/`). Schema in `schema.ts` — Auth.js tables (`users`, `accounts`, `sessions`, `verificationTokens`) plus app tables (`books`, `vocabulary`, `reviewLogs`). Import `db` from `@/lib/db`.

### UI Components
Uses **shadcn/ui v4** built on `@base-ui/react` (not Radix). This has two key differences from standard shadcn:
1. No `asChild` prop — use `render={<Link href="..." />}` pattern instead
2. `buttonVariants` must be imported from `@/components/ui/button-variants` (not from `button.tsx`) when used in Server Components, because `button.tsx` has `"use client"` which proxies exports to Server Components

### EPUB Reader
`EpubReader` (`components/reader/epub-reader.tsx`) is always `dynamic`-imported with `ssr: false`. Key design:
- `flow: "paginated"`, pixel dimensions from `getBoundingClientRect()` (not `%`)
- `ResizeObserver` on the viewerRef div calls `rendition.resize(w, h)` on container changes
- All `rendition.on(...)` event handlers registered **before** `rendition.display()` — registering after misses the first `relocated` event
- Reading progress saved via `fetch` in the `relocated` handler, plus `navigator.sendBeacon` on `visibilitychange` for reliable save when navigating away
- Touch swipe registered per iframe `view.window` in the `rendered` event; uses a `WeakSet` to avoid duplicate listeners across re-renders
- `EpubReader` is stateless for font size (receives `fontSize` prop from `ReaderClient`) and exposes `prev`/`next` controls via `onReady` callback

### Spaced Repetition
`src/lib/srs.ts` — Ebbinghaus intervals: stage 0→1 day, 1→2d, 2→4d, 3→7d, 4→15d, 5→30d, 6+→mastered. "Forgot" resets to stage 0. `vocabulary.reviewStage` and `vocabulary.nextReviewAt` drive the review queue (`GET /api/review` returns items where `nextReviewAt ≤ now`).

### File Storage
EPUB files uploaded to Vercel Blob via `src/lib/blob.ts`. The `blobUrl` is stored in `books.blobUrl` and passed directly to epubjs as the book source.

### Dictionary / Translation API
`GET /api/dictionary?word=...` — proxies Free Dictionary API (English definitions, single words only) and MyMemory translation API (Chinese translation, all inputs). Both are cached 24h with `next: { revalidate: 86400 }`.
