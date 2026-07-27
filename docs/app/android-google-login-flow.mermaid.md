```mermaid
sequenceDiagram
    participant App as Android App (WebView)
    participant CT as Chrome Custom Tab
    participant GG as Google OAuth
    participant BE as Backend (Vercel)

    App->>App: 1. 用户点击 "Login with Google"
    App->>CT: 2. Browser.open(/mobile-oauth-redirect?provider=google)
    Note over CT: Custom Tab 打开，独立 cookie 环境<br/>（Google 禁止在原生 WebView 内完成 OAuth，必须用 Custom Tab）<br/>只显示 loading，不渲染完整登录页
    CT->>CT: 3. MobileOAuthRedirect 检测到 provider=google
    CT->>BE: 4. signIn("google", callbackUrl: /api/mobile-bridge/issue)
    BE->>GG: 5. 重定向到 Google OAuth 授权页
    CT->>GG: 6. 用户选择账号并授权（或已登录自动跳转）
    GG->>BE: 7. 回调 /api/auth/callback/google
    Note over BE: OAuth 握手完成，设置 session cookie
    BE->>CT: 8. 重定向到 /api/mobile-bridge/issue
    CT->>BE: 9. GET /api/mobile-bridge/issue
    Note over BE: 读取 session，创建 HMAC 签名 bridge token（60s 有效）
    BE->>CT: 10. 重定向到 com.englishread.app://oauth-bridge?token=xxx

    Note over App,CT: ───── 这里弹出"打开 English Read"对话框 ─────

    CT->>App: 11. Android 拦截 custom scheme，打开 App
    Note over App: WebView 原在 login 页，但不等用户察觉
    App->>App: 12. handleDeepLink 提取 token，存到 sessionStorage
    App->>App: 13. 立即导航到 /mobile-oauth-redirect?bridging=true
    Note over App: WebView 显示 loading spinner<br/>用户不再看到 login 页
    App->>BE: 14. POST /api/mobile-bridge/consume { token }
    Note over BE: 验证 token，查询用户，编码 JWT
    BE->>App: 15. Set-Cookie: authjs.session-token=xxx
    App->>App: 16. Browser.close() 关闭 Custom Tab
    App->>App: 17. 导航到 /dashboard，用户已登录
```

```mermaid
flowchart TD
    A["用户点击 'Login with Google'"] --> B{isCapacitor?}
    B -->|Yes| C["Browser.open(/mobile-oauth-redirect?provider=google)"]
    B -->|No| D["signIn(google) 直接 OAuth"]
    D --> E["登录成功<br/>留在当前浏览器"]

    C --> F["Custom Tab 打开中转页<br/>(只显示 spinner)"]
    F --> G["MobileOAuthRedirect 检测到 provider=google"]
    G --> H["signIn(google, callbackUrl: /api/mobile-bridge/issue)"]
    H --> I["重定向到 Google 授权页"]
    I --> J["用户选择账号并授权"]
    J --> K["Google 回调"]
    K --> L["Auth.js 完成 OAuth 握手<br/>(设置 session cookie)"]
    L --> M["重定向到 /api/mobile-bridge/issue"]
    M --> N["创建 bridge token（60s 有效）"]
    N --> O["重定向到 com.englishread.app://oauth-bridge?token=xxx"]
    O --> P["Android 拦截 custom scheme"]
    P --> Q["弹出对话框:<br/>'打开 English Read'"]
    Q --> R["用户点击 '打开'"]
    R --> S["handleDeepLink 存 token 到 sessionStorage"]
    S --> T["立即导航到 /mobile-oauth-redirect?bridging=true<br/>(显示 loading，不再展示 login 页)"]
    T --> U["POST /api/mobile-bridge/consume"]
    U --> V["验证 token + 设置 JWT cookie 到 WebView"]
    V --> W["Browser.close() 关闭 Custom Tab"]
    W --> X["导航到 /dashboard<br/>登录完成"]
```

## 与 GitHub 流程的差异

Google 登录在 App 端与 GitHub 登录**完全共用同一套 Bridge 机制**（`useCapacitorOAuth` / `openOAuthUrl` / `MobileOAuthRedirect` / `/api/mobile-bridge/*`），唯一区别是 `signInWithOAuth("google")` 传入的 provider 不同。之所以必须走 Custom Tab + Bridge Token，而不能像手机号/邮箱那样在 WebView 内直连，是因为 **Google 明确禁止 OAuth 授权页在嵌入式 WebView（`WebView`/`Capacitor` 原生 WebView）中展示**，只允许系统级浏览器（Chrome Custom Tabs / SFSafariViewController）完成登录，随后再通过自定义 scheme 深链接把结果传回 App。
