# English Read

> A full-stack EPUB reader and spaced repetition vocabulary learning platform.

**English** | [中文文档](./README.zh.md)

---

## Overview

English Read is a Next.js 15 full-stack web application combining an online EPUB reader with an SRS (Spaced Repetition System) vocabulary learning workflow. Upload EPUBs or browse a shared public library, look up words while reading, and review them with an Ebbinghaus-curve-based flashcard system.

## Features

- **EPUB Reader** — paginated reading, font size control, reading progress auto-saved
- **Personal Library & Public Library** — upload to your shelf; browse and add books from a shared public catalog
- **Vocabulary** — collect unknown words from the reader; optional review plan view
- **Spaced Repetition Review** — Ebbinghaus intervals: 1d → 2d → 4d → 7d → 15d → 30d → mastered; distractor options may use AI when configured
- **Dictionary & Translation** — English definitions (Free Dictionary API) + Chinese translation (MyMemory); optional Google Cloud Translation fallback; cached 24 h
- **Authentication** — GitHub and Google OAuth; email/password; phone OTP (Aliyun SMS) via NextAuth v5 with JWT sessions
- **Internationalization** — English / Chinese UI (next-intl, cookie-based, URL unchanged)
- **Dark Mode** — system-aware theme toggle
- **Observability** — Sentry error monitoring; optional PostHog and Vercel Analytics

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 + React 19 (App Router) |
| Language | TypeScript (strict) |
| UI | shadcn/ui v4 (`@base-ui/react`), Tailwind CSS v4 |
| Auth | NextAuth v5 (OAuth + Credentials + phone OTP), JWT sessions |
| Database | Drizzle ORM + Neon serverless PostgreSQL |
| File Storage | Vercel Blob |
| i18n | next-intl ^4.9.1 |
| EPUB Engine | epubjs |
| Errors | @sentry/nextjs |
| Analytics | Optional: PostHog (`posthog-js`), `@vercel/analytics` |

## Getting Started

### Prerequisites

- Node.js 18+
- npm (this repo ships `package-lock.json`)

### Installation

```bash
git clone <repo-url>
cd english-read
npm install
```

### Environment Variables

Create `.env.local` in the project root. **Minimum** for local auth + DB + uploads:

```env
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

Generate `AUTH_SECRET` with `npx auth secret`.

**Optional** integrations (SMS login, AI review distractors, translation fallback, analytics) are documented in [`.env.example`](./.env.example).

### Database Setup

```bash
npx drizzle-kit generate   # Generate migration files from schema
npm run db:migrate         # Apply migrations (alias for drizzle-kit migrate)
# or: npx drizzle-kit migrate
npx drizzle-kit studio     # Open Drizzle Studio (DB browser)
```

### Development

```bash
npm run dev       # Dev server at http://localhost:3000
npm run build     # Production build (includes ESLint)
npm run start     # Start production server after build
npm run lint      # ESLint only
npx tsc --noEmit  # TypeScript check only
```

## Project Structure

```
src/
├── app/
│   ├── (app)/                   # Authenticated shell (Sidebar + Topbar)
│   │   ├── dashboard/
│   │   ├── library/             # Personal books + upload
│   │   ├── library/store/       # Public library browse & contribute
│   │   ├── vocabulary/          # Word list
│   │   ├── vocabulary/review/   # SRS flashcards
│   │   ├── vocabulary/plan/     # Review planning
│   │   ├── read/[bookId]/       # Full-screen EPUB reader
│   │   └── settings/
│   ├── (auth)/                  # login, signup, error (no app shell)
│   ├── api/
│   └── dev/                     # Internal/dev-only pages (optional)
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

## Architecture Notes

### Authentication

`middleware.ts` protects `/dashboard`, `/library`, `/read`, `/vocabulary`, and `/settings`. Sessions use **JWT** (`session.strategy: "jwt"`). Providers include GitHub, Google, email/password (hashed with bcrypt), and phone OTP (requires Aliyun env vars). Logged-in users hitting `/login` or `/signup` are redirected to `/dashboard`.

### EPUB Reader

`EpubReader` is dynamically imported with `{ ssr: false }`. Paginated flow with pixel dimensions from `getBoundingClientRect()`; touch swipe is registered on each iframe `view.window` for multi-iframe layouts.

### Spaced Repetition

Stages: `0→1d, 1→2d, 2→4d, 3→7d, 4→15d, 5→30d, 6+→mastered`. “Forgot” resets to stage 0. The review queue uses `vocabulary.nextReviewAt ≤ now`.

### UI Components

**shadcn/ui v4** on `@base-ui/react` (not Radix):

- No `asChild` — use `render={<Link href="..." />}`
- In Server Components, import `buttonVariants` from `@/components/ui/button-variants`

## Deployment guide

Hosting target is **Vercel**. Recommended flow: create **Storage** → register **OAuth** apps → copy env into **`.env.local`** → run **`npm run db:migrate`** once against Neon → connect the **GitHub repo** and deploy. Migration SQL lives in `src/lib/db/migrations/` ([`drizzle.config.ts`](./drizzle.config.ts) uses `POSTGRES_URL_NON_POOLING`). Optional env keys are listed in [`.env.example`](./.env.example).

### 1. Create Vercel Storage

Open the [Vercel Dashboard](https://vercel.com/dashboard) → select or create your project → **Storage**, then provision:

**Postgres (Neon)**

| Field | Value |
|-------|--------|
| Type | **Postgres** |
| Purpose | App data: users, books, vocabulary, reviews, etc. |
| Auto-injected env | `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` |

Link the database to your Vercel project so these variables appear under **Settings → Environment Variables** (or copy them from the Storage UI for local `.env.local`).

**Blob**

| Field | Value |
|-------|--------|
| Type | **Blob** |
| Suggested name | `english-read-epub` |
| Purpose | Uploaded EPUB files |
| Auto-injected env | `BLOB_READ_WRITE_TOKEN` |

### 2. Create OAuth applications

**Google**

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. APIs & Services → Credentials → **Create Credentials** → OAuth 2.0 Client IDs.
3. Application type: **Web application**.
4. Under **Authorized redirect URIs**, add both local and production callbacks:

   ```
   http://localhost:3000/api/auth/callback/google
   https://your-domain.vercel.app/api/auth/callback/google
   ```

5. Save and copy **Client ID** and **Client Secret**.

**GitHub**

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
2. Local development:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Production: use a separate OAuth app or change the callback to `https://your-domain.vercel.app/api/auth/callback/github`.
4. Copy **Client ID** and generate a **Client Secret**.

### 3. Configure `.env.local`

In the project root, create `.env.local` (same keys as Vercel **Production** unless you use Preview-specific values):

```env
# Auth.js
AUTH_SECRET=          # run: npx auth secret
AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Neon — from Vercel Storage / project env
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=
```

Paste the output of `npx auth secret` into `AUTH_SECRET`.

### 4. Apply database migrations

[`drizzle.config.ts`](./drizzle.config.ts) reads **`.env.local`** (via `@next/env`) and applies migrations from `src/lib/db/migrations/` using **`POSTGRES_URL_NON_POOLING`**.

- **First deploy / empty database:** with `POSTGRES_URL_NON_POOLING` set (local file pointing at your Neon DB), run:

  ```bash
  npm run db:migrate
  ```

  Do **not** run `npx drizzle-kit generate` on the server unless you are changing the schema—committed migration files are the source of truth.

- **When you change `src/lib/db/schema.ts` locally:** run `npx drizzle-kit generate`, commit the new files under `src/lib/db/migrations/`, deploy, then run `npm run db:migrate` against each environment that should pick up the change.

Optional: `npx drizzle-kit studio` opens Drizzle Studio against the same connection.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy on Vercel

**Option A — Git integration (recommended)**  
Import the GitHub repository in Vercel, select the framework (Next.js), add **Environment Variables** for Production (and Preview if needed), then push to `main` (or your production branch). Build command is `npm run build` by default.

**Option B — Vercel CLI**

```bash
npm i -g vercel   # if needed
vercel            # preview
vercel --prod     # production
```

### 7. After deployment

1. **Environment variables** — Mirror `.env.local` in Vercel → **Settings** → **Environment Variables**. Set **`AUTH_URL`** to your production site origin (e.g. `https://your-domain.vercel.app`), not `http://localhost:3000`.
2. **OAuth** — Add production redirect URIs in Google Cloud Console and GitHub OAuth App settings (see §2).
3. **Optional product features** — Names and comments match [`.env.example`](./.env.example). Where to obtain:

   | Variables | Purpose | Where to obtain |
   |-----------|---------|-----------------|
   | `AI_GATEWAY_API_KEY` | Similar-word distractors in review (`/api/review/similar-words`) | [Vercel Dashboard](https://vercel.com/dashboard) → **AI** → **AI Gateway** → API keys · [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) |
   | `GOOGLE_TRANSLATE_API_KEY` | Machine translation fallback for `/api/dictionary` | [Google Cloud Console](https://console.cloud.google.com/) → enable [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com) → **APIs & Services** → **Credentials** → Create API key |
   | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog client analytics | [PostHog](https://app.posthog.com/) → **Project settings** → **Project API Key**; host = your region’s ingestion URL ([regions](https://posthog.com/docs/api#capture-api), e.g. `https://us.i.posthog.com`) |
   | `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET`, `ALIYUN_SMS_SIGN_NAME`, `ALIYUN_SMS_TEMPLATE_CODE`, … | Aliyun SMS OTP (DYPNS) login | AccessKey: [RAM](https://ram.console.aliyun.com/manage/ak); SMS / phone verification: [号码认证控制台](https://dypns.console.aliyun.com/) (sign & template); RAM needs `dypns:SendSmsVerifyCode` / `CheckSmsVerifyCode`; notes in [`docs/阿里云/`](./docs/阿里云/) |
   | `SENTRY_AUTH_TOKEN` | Upload **source maps** during `next build` (clearer stacks) | [sentry.io](https://sentry.io) → your organization → **Settings** → **Developer Settings** → **Auth Tokens** · [Next.js source maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#step-4-add-readable-stack-traces-with-source-maps-optional) |

   **Sentry runtime** — DSN is embedded; errors are reported when `NODE_ENV === "production"`. **`SENTRY_AUTH_TOKEN`** is only required if you want source maps uploaded on Vercel builds.

### 8. Database tables (overview)

| Table | Purpose |
|-------|---------|
| `users` | User profiles (Auth.js); email, phone, password hash |
| `accounts` | OAuth provider links (Auth.js) |
| `sessions` | Session records used by the Auth.js adapter |
| `verification_tokens` | Email verification tokens (Auth.js) |
| `public_library_books` | Shared catalog entries |
| `books` | Personal shelf; EPUB blob URL and reading progress |
| `reading_daily_time` | Per-day reading time (seconds) |
| `vocabulary` | Saved words and SRS schedule |
| `review_logs` | Each review outcome (remembered / forgotten) |
