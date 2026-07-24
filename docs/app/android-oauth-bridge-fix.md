# 修复 Android App 内 GitHub/Google OAuth 登录失败

## Context

Android App（Capacitor）里点击 GitHub/Google 登录后，会用 `@capacitor/browser` 打开一个 Chrome Custom Tab 完成 OAuth 授权。但目前流程是：

1. App 的 **WebView** 调用 `signIn(provider, {redirect:false})`，Auth.js 在这次请求里生成的 CSRF/state/PKCE cookie 写进了 **WebView 的 cookie 仓库**。
2. 拿到授权 URL 后，用 `Browser.open()` 在 **Custom Tab（独立的 Chrome cookie 仓库）**里打开。
3. GitHub/Google 授权完成后回调到 `/api/auth/callback/...` 时是在 Custom Tab 里，根本看不到 WebView 里的那些 state/PKCE cookie → Auth.js 校验失败 → 跳转到 `/error`（用户看到"OAuth认证失败"）。

即使这个问题修好，**第二个问题**依然存在：OAuth 全部在 Custom Tab 内完成后，session cookie 也只会写进 Custom Tab 的仓库，App 的 WebView 依然拿不到，无法真正登录。

根本原因是 **WebView 与 Custom Tab 是两个独立、不共享 cookie 的浏览环境**。修复方案：让整个 OAuth 往返（发起 → 跳转 → 回调）全部在 Custom Tab 内一致地完成（解决问题1），再用一个**无状态签名的一次性桥接令牌**通过自定义 URL scheme 把登录后的用户身份传回 WebView，由 WebView 自己发起请求换取真正的 session cookie（解决问题2）。

已确认可复用 `next-auth/jwt`（重新导出自 `@auth/core/jwt`）的 `encode`/`decode` 函数，直接用 `AUTH_SECRET` 生成/解析和 Auth.js 完全兼容的加密 session JWT，无需引入新依赖。桥接令牌本身用 Node 内置 `crypto` 做 HMAC 签名，短时效（60 秒），不落库、不加表（用户已确认选择"无状态签名令牌"方案，因为令牌只经由 Android Intent 在设备本地传递，不经过网络，重放窗口小、暴露面很小）。

## 实现方案

### 1. 新建 `src/lib/mobile-bridge.ts`
封装桥接令牌的签发与校验，不依赖数据库：

- `createBridgeToken(userId: string): string` — 用 `crypto.createHmac("sha256", AUTH_SECRET)` 对 `${userId}.${expiresAtMs}` 签名，拼成 `base64url(payload).base64url(signature)` 形式的紧凑令牌，60 秒过期。
- `verifyBridgeToken(token: string): { userId: string } | null` — 校验签名与过期时间，常量时间比较（`crypto.timingSafeEqual`）防止时序攻击。
- `isSafeNextPath(next: string | null): string` — 只允许以单个 `/` 开头、且不是 `//`（防止协议相对 URL 开放重定向）的相对路径，否则回退到 `/dashboard`。
- `getSessionCookieName(secure: boolean): string` — 返回 `${secure ? "__Secure-" : ""}authjs.session-token`，与 `@auth/core` 的 `defaultCookies` 逻辑一致（`node_modules/.pnpm/@auth+core@0.41.2/node_modules/@auth/core/lib/utils/cookie.js`）。

### 2. 新建 `src/app/api/mobile-bridge/issue/route.ts`（GET）
在 Custom Tab 内、OAuth 回调成功后被 Auth.js 作为 `callbackUrl` 重定向到这里：

- `await auth()` 读取当前会话（此时 cookie 就在同一个 Custom Tab 上下文里，能正常读到）。
- 无 session → `redirect("/error")`。
- 有 session → `next = isSafeNextPath(searchParams.get("next"))`，`token = createBridgeToken(session.user.id)`，`redirect(`com.englishread.app://oauth-bridge?token=${token}&next=${encodeURIComponent(next)}`)`。
- 因为目标不是 http(s) URL，Chrome 必须把它交给 Android 系统处理 → 可靠地唤起 App（不依赖 https App Links 在 Custom Tab 内跳转拦截的不确定行为）。

### 3. 新建 `src/app/api/mobile-bridge/consume/route.ts`（POST）
由 App 的 **WebView** 发起 fetch 调用（同源请求，自动带上/写回 WebView 自己的 cookie 仓库）：

- 用 Zod 校验 body：`{ token: string }`（复用现有路由的校验风格，如 `src/app/api/user/profile/route.ts`）。
- `verifyBridgeToken(token)` 失败 → `400`。
- 校验通过后按 `userId` 查库，取 `id/email/name/image/phone/role`（字段与 `callbacks.jwt` 里塞进 token 的字段一致）。
- 用 `encode({ token: {sub, email, name, picture: image, phone, role}, secret: AUTH_SECRET, salt: cookieName, maxAge: 30*24*60*60 })`（`next-auth/jwt` 导出）生成和 Auth.js 完全兼容的加密 session JWT。
- `secure = req.nextUrl.protocol === "https:"`，`cookieName = getSessionCookieName(secure)`。
- 用 `NextResponse.json({ok:true})` 附带 `.cookies.set(cookieName, encoded, {httpOnly:true, secure, sameSite:"lax", path:"/", maxAge})`，因为请求本身是 WebView 发的 fetch，Set-Cookie 会写进 WebView 自己的 cookie 仓库。

### 4. 改造登录发起入口（`src/components/login-form.tsx` / `signup-form.tsx`）
`signInWithOAuth` 里 `isCapacitor()` 分支改为：不再自己调用 `signIn()`，而是直接把 Custom Tab 打开到本站的 `/login` 页面并带上标记参数：

```ts
if (isCapacitor()) {
  await openOAuthUrl(`${window.location.origin}/login?mobileOAuthStart=${provider}`);
  setOauthPending(null);
  return;
}
```

### 5. `/login` 页面内新增"移动端 OAuth 中继"逻辑
在 `login-form.tsx` 内新增一个小的子组件（模式参考 `src/components/posthog-pageview.tsx` 的 `useSearchParams` + `<Suspense>` 包裹方式），检测 `mobileOAuthStart` 参数：

```tsx
function MobileOAuthRelay() {
  const params = useSearchParams();
  useEffect(() => {
    const provider = params.get("mobileOAuthStart");
    if (provider === "google" || provider === "github") {
      void signIn(provider, {
        callbackUrl: `/api/mobile-bridge/issue?next=${encodeURIComponent("/dashboard")}`,
      });
    }
  }, [params]);
  return null;
}
```

这个页面是被 Custom Tab 打开的（不是 WebView），所以这里跑起来的 `signIn()`（默认 `redirect: true`，走完整页面跳转）会让**发起签名请求 → 跳转 GitHub/Google → 回调**全部在 Custom Tab 这一个 cookie 上下文里完成，解决问题1。在 `LoginForm` 里用 `<Suspense fallback={null}><MobileOAuthRelay /></Suspense>` 包裹。

### 6. 改造 `src/hooks/use-capacitor-oauth.ts`
去掉现在基于 `AUTH_CALLBACK_PREFIX`（`/api/auth/callback/`）的旧处理逻辑（新流程下 WebView 永远不会再收到这个 https 深链接，OAuth 回调已经完全在 Custom Tab 内解决），替换为处理新的自定义 scheme：

```ts
const BRIDGE_SCHEME_PREFIX = "com.englishread.app://oauth-bridge";

function handleDeepLink(url: string) {
  if (processingRef.current) return;
  if (!url.startsWith(BRIDGE_SCHEME_PREFIX)) return;
  processingRef.current = true;

  const parsed = new URL(url);
  const token = parsed.searchParams.get("token");
  const next = parsed.searchParams.get("next") ?? "/dashboard";

  void (async () => {
    try {
      if (token) {
        const res = await fetch("/api/mobile-bridge/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          const { Browser } = await import("@capacitor/browser");
          await Browser.close().catch(() => {});
          window.location.href = next;
          return;
        }
      }
      const { Browser } = await import("@capacitor/browser");
      await Browser.close().catch(() => {});
      window.location.href = "/error";
    } finally {
      processingRef.current = false;
    }
  })();
}
```

### 7. `android/app/src/main/AndroidManifest.xml`
新增一个自定义 scheme 的 intent-filter（不需要 `autoVerify`，自定义 scheme 天然只归属本 App）：

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.englishread.app" android:host="oauth-bridge" />
</intent-filter>
```

原有的 `english-read.bitbw.top` https App Link intent-filter保留不动（不确定是否被其他深链接场景使用，不属于本次修复范围）。

## 涉及文件清单

- 新建 `src/lib/mobile-bridge.ts`
- 新建 `src/app/api/mobile-bridge/issue/route.ts`
- 新建 `src/app/api/mobile-bridge/consume/route.ts`
- 修改 `src/components/login-form.tsx`（`signInWithOAuth` + 新增 `MobileOAuthRelay`）
- 修改 `src/components/signup-form.tsx`（`signInWithOAuth` 同步改为打开 `/login?mobileOAuthStart=...`）
- 修改 `src/hooks/use-capacitor-oauth.ts`（替换深链接处理逻辑）
- 修改 `android/app/src/main/AndroidManifest.xml`（新增 intent-filter）

## 验证方式

1. `npx tsc --noEmit` 确认类型检查通过。
2. `npm run lint` 确认无新增 lint 问题。
3. `npm run build:android:debug`（或手动 `cap sync android && cd android && gradlew assembleDebug`）打包新 APK。
4. 真机安装后：点击 GitHub/Google 登录 → 观察是否打开 Custom Tab → 完成授权后 Custom Tab 应自动关闭并跳回 App 首页/dashboard，且已处于登录态（检查 `document.cookie` 或直接看是否能访问需要登录的页面）。
5. 边界情况：令牌过期（等 60 秒以上再手动触发 `/api/mobile-bridge/consume`）应返回 400；`next` 参数传入 `//evil.com` 应被 `isSafeNextPath` 拦截并回退到 `/dashboard`。
