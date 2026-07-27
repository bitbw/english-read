```mermaid
sequenceDiagram
    participant App as Android App (WebView)
    participant BE as Backend (Vercel)
    participant SMS as 阿里云 Dypns

    App->>App: 1. 用户切换到 "手机号" Tab，输入国家码 + 手机号
    App->>BE: 2. POST /api/auth/sms/send { countryCode, phone }
    BE->>SMS: 3. 调用阿里云 Dypns 发送短信验证码
    SMS-->>BE: 4. 发送结果
    BE-->>App: 5. 200 OK（进入 60s 倒计时）
    App->>App: 6. 用户输入 / 剪贴板自动填充验证码

    App->>App: 7. 提交表单，调用 signIn("phone-otp", { countryCode, phone, code, redirect: false })
    Note over App,BE: 关键区别：无 Custom Tab、无 bridge token<br/>signIn 直接在 WebView 自己的上下文内发起 fetch
    App->>BE: 8. POST /api/auth/callback/phone-otp
    BE->>SMS: 9. verifySmsCode(phone, countryCode, code) 校验验证码
    SMS-->>BE: 10. 校验通过
    Note over BE: authorize() 按手机号查找/创建用户
    BE->>BE: 11. Auth.js 编码 JWT
    BE-->>App: 12. Set-Cookie: authjs.session-token=xxx（直接写入 WebView 自身 cookie 仓库）
    App->>App: 13. signIn 返回 { ok: true }
    App->>App: 14. router.replace("/dashboard") + router.refresh()，登录完成
```

```mermaid
sequenceDiagram
    participant App as Android App (WebView)
    participant BE as Backend (Vercel)
    participant DB as Postgres (Neon)

    App->>App: 1. 用户切换到 "邮箱" Tab，输入邮箱 + 密码
    App->>App: 2. 提交表单，调用 signIn("credentials", { email, password, redirect: false })
    Note over App,BE: 与手机号登录同理：无 Custom Tab、无 bridge token<br/>邮箱密码本就不涉及第三方 OAuth 授权页，可在 WebView 内直连
    App->>BE: 3. POST /api/auth/callback/credentials
    BE->>DB: 4. 按 email 查询用户 + passwordHash
    DB-->>BE: 5. 返回用户记录
    BE->>BE: 6. bcrypt.compare(password, passwordHash) 校验密码
    alt 校验失败
        BE-->>App: 7a. authorize() 返回 null → signIn 返回 { error }
        App->>App: 8a. 展示 "邮箱或密码错误"
    else 校验成功
        BE->>BE: 7b. Auth.js 编码 JWT
        BE-->>App: 8b. Set-Cookie: authjs.session-token=xxx
        App->>App: 9b. signIn 返回 { ok: true }
        App->>App: 10b. router.replace("/dashboard") + router.refresh()，登录完成
    end
```

```mermaid
flowchart TD
    A["用户在 login-form 选择<br/>手机号 Tab 或 邮箱 Tab"] --> B{哪个 Tab?}

    B -->|手机号| C1["输入手机号 → POST /api/auth/sms/send"]
    C1 --> C2["阿里云 Dypns 发送验证码"]
    C2 --> C3["用户输入/剪贴板自动填充验证码"]
    C3 --> C4["signIn('phone-otp', {countryCode, phone, code, redirect:false})"]
    C4 --> C5["POST /api/auth/callback/phone-otp"]
    C5 --> C6["authorize(): verifySmsCode() 校验"]

    B -->|邮箱| D1["输入 email + password"]
    D1 --> D2["signIn('credentials', {email, password, redirect:false})"]
    D2 --> D3["POST /api/auth/callback/credentials"]
    D3 --> D4["authorize(): 查用户 + bcrypt.compare()"]

    C6 --> E{校验通过?}
    D4 --> E

    E -->|No| F["signIn() 返回 {error}<br/>页面内展示错误提示"]
    E -->|Yes| G["Auth.js 编码 JWT"]
    G --> H["Set-Cookie: authjs.session-token=xxx<br/>直接写入 WebView 自身 cookie 仓库"]
    H --> I["signIn() 返回 {ok:true}"]
    I --> J["router.replace('/dashboard') + router.refresh()<br/>登录完成"]
```

## 与 GitHub / Google 流程的差异

手机号验证码和邮箱密码登录都基于 NextAuth `Credentials` provider（分别是 `phone-otp` 和默认的 `credentials`），本质是**同源表单提交**，不涉及第三方 OAuth 授权页跳转，因此在 App 端**完全不需要 Custom Tab、不需要自定义 scheme 深链接、不需要 `/api/mobile-bridge/*` 桥接令牌**：

- `signIn(provider, { redirect: false })` 直接从当前 WebView 页面发起 fetch 请求到 `/api/auth/callback/{provider}`。
- 请求与响应都发生在 WebView 自己的上下文里，`Set-Cookie` 会自动写入 WebView 自身的 cookie 仓库。
- 无论是否在 Capacitor 原生壳内（`isCapacitor()`），这条路径的代码完全一致 —— `onPhoneSubmit` / `onCredentialsSubmit` 中没有任何 `isCapacitor()` 分支判断，因为不存在"必须切到系统浏览器"的强制要求（这一点与 Google 强制要求 Custom Tab 的场景相反，见 [android-google-login-flow.mermaid.md](./android-google-login-flow.mermaid.md)）。
- 手机号登录多了一步前置的短信发送/校验（`/api/auth/sms/send` + 阿里云 Dypns `verifySmsCode`），邮箱登录则是直接 `bcrypt.compare` 校验密码哈希，两者校验方式不同，但拿到结果后设置 session cookie 的收尾逻辑完全一致。
