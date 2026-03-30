# English Read - 部署配置指南

## 1. 创建 Vercel Storage

登录 [Vercel Dashboard](https://vercel.com/dashboard) → 选择项目 → **Storage** 标签页，依次创建以下两个存储：

### Postgres (Neon)

| 字段 | 值 |
|------|-----|
| 类型 | **Postgres** |
| 用途 | 存储用户、书籍、生词、复习记录 |
| 创建后自动注入 | `POSTGRES_URL`、`POSTGRES_URL_NON_POOLING` |

### Blob Store

| 字段 | 值 |
|------|-----|
| 类型 | **Blob** |
| 建议命名 | `english-read-epub` |
| 用途 | 存储上传的 EPUB 文件 |
| 创建后自动注入 | `BLOB_READ_WRITE_TOKEN` |

---

## 2. 创建 OAuth 应用

### Google OAuth

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials → **Create Credentials** → OAuth 2.0 Client IDs
3. Application type 选 **Web application**
4. Authorized redirect URIs 添加：
   ```
   http://localhost:3000/api/auth/callback/google
   https://你的域名.vercel.app/api/auth/callback/google
   ```
5. 保存后复制 **Client ID** 和 **Client Secret**

### GitHub OAuth

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
2. 本地开发用（填写如下）：
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. 生产环境另建一个 App，callback URL 改为 `https://你的域名.vercel.app/api/auth/callback/github`
4. 保存后复制 **Client ID**，点击 **Generate a new client secret** 复制 **Client Secret**

---

## 3. 配置 .env.local

在项目根目录创建 `.env.local` 文件，填入以下内容：

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

# Vercel Postgres (Neon) — 从 Vercel Storage 页面复制
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# Vercel Blob — 从 Vercel Storage 页面复制
BLOB_READ_WRITE_TOKEN=
```

生成 `AUTH_SECRET`：

```bash
npx auth secret
```

将输出的字符串填入 `AUTH_SECRET=` 后面。

---

## 4. 推送数据库表结构

确保 `POSTGRES_URL_NON_POOLING` 已填写，然后执行：

```bash
# 生成迁移文件
npx drizzle-kit generate

# 推送到数据库
npx drizzle-kit migrate
```

---

## 5. 本地启动

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)

---

## 6. 部署到 Vercel

```bash
# 安装 Vercel CLI（如未安装）
npm i -g vercel

# 部署
vercel
```

部署完成后，在 Vercel 项目 → Settings → Environment Variables 中添加上述所有环境变量（将 `AUTH_URL` 改为你的生产域名），并将 Google/GitHub OAuth 的 callback URL 更新为生产地址。

---

## 数据库表结构一览

| 表名 | 说明 |
|------|------|
| `users` | 用户基本信息（Auth.js） |
| `accounts` | OAuth 账户绑定（Auth.js） |
| `sessions` | 登录会话（Auth.js） |
| `verification_tokens` | 邮箱验证（Auth.js） |
| `books` | 书籍信息，含 EPUB Blob URL 和阅读进度 |
| `vocabulary` | 生词本，含艾宾浩斯复习阶段和下次复习时间 |
| `review_logs` | 每次复习记录（记忆/遗忘结果） |
