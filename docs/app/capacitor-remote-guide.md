# Capacitor 远程模式接入指南

> 将 english-read（Next.js 15）包装为 Android/iOS App，通过 Capacitor 加载 https://english-read.bitbw.top/。

---

## 原理

Capacitor 创建一个原生 WebView 壳，加载你的 Vercel 部署域名。所有页面逻辑、API 请求、认证流程全部由线上服务处理，App 只负责提供原生容器。

```
用户 → App 原生壳 → WebView → https://english-read.bitbw.top → SSR/API 路由
                       │
                  Capacitor 插件层（推送、文件、支付等）
```

---

## 前置条件

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 | 运行项目 |
| Android Studio | >= 2023.1 | Android 打包与模拟器 |
| Xcode | >= 15 (macOS only) | iOS 打包与模拟器 |
| JDK | >= 17 | Android 编译 |
| Gradle | 8.x (随 Capacitor 自带) | Android 构建 |

**注意**：iOS 构建需要 macOS，Windows 只能构建 Android。

---

## 步骤 1: 初始化 Capacitor

在项目根目录执行：

```bash
# 安装 Capacitor 核心包
npm install @capacitor/core @capacitor/cli

# 安装 Android / iOS 平台包
npm install @capacitor/android
# macOS 才需要：npm install @capacitor/ios

# 初始化 Capacitor 配置
npx cap init \
  "English Read" \
  com.englishread.app \
  --web-dir .next
```

执行后会生成 `capacitor.config.ts`：

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englishread.app',
  appName: 'English Read',
  webDir: '.next',    // Next.js 构建产物目录
  server: {
    url: 'https://english-read.bitbw.top',  // <-- 关键：远程模式
    cleartext: false,                         // 不允许 HTTP
  },
  android: {
    // 允许 WebView 弹出键盘时调整布局
    adjustResize: true,
  },
};

export default config;
```

---

## 步骤 2: 添加原生平台

```bash
# 添加 Android 平台
npx cap add android

# macOS 才需要：
# npx cap add ios
```

这会创建 `android/`（和可选的 `ios/`）目录，包含完整的原生项目。

---

## 步骤 3: 配置 Android

### 3.1 修改 App 名称（Android）

编辑 `android/app/src/main/res/values/strings.xml`：

```xml
<resources>
    <string name="app_name">English Read</string>
</resources>
```

### 3.2 配置网络权限（如需要）

Android 默认允许 HTTPS 访问。如果你的 Vercel 域名是 HTTPS，无需额外配置。

### 3.3 配置启动屏

安装 Capacitor 启动屏插件（可选）：

```bash
npm install @capacitor/splash-screen
npx cap sync
```

在 `capacitor.config.ts` 中添加：

```typescript
const config: CapacitorConfig = {
  // ... 其他配置
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};
```

---

## 步骤 4: 处理 NextAuth 认证回调

NextAuth 的 OAuth 回调会跳转到外部浏览器，之后需要回到 App。

### 4.1 注册自定义 URL Scheme

Capacitor 默认使用 `app://` scheme。但 OAuth 回调建议使用 `https://` 通用链接。

安装 App Launcher 插件：

```bash
npm install @capacitor/app-launcher
```

### 4.2 配置 Android Deep Link

编辑 `android/app/src/main/AndroidManifest.xml`，在 `<activity>` 中添加：

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="english-read.bitbw.top" />
</intent-filter>
```

### 4.3 配置 OAuth Provider 回调 URL

在 GitHub OAuth App 设置中添加回调：

```
https://english-read.bitbw.top/api/auth/callback/github
```

Google OAuth 同理，添加同样的回调 URL。

---

## 步骤 5: 处理 iOS（macOS only）

如果使用 macOS：

```bash
# 添加 iOS 平台
npx cap add ios

# 打开 Xcode
npx cap open ios
```

在 Xcode 中：
1. **Signing & Capabilities** → 添加 Associated Domains
2. Domain 填入 `applinks:english-read.bitbw.top`
3. 配置 Info.plist，添加 `CFBundleURLTypes` 用于 OAuth 回调

---

## 步骤 6: 构建与运行

### 每次更新代码后：

```bash
# 1. 构建 Next.js
npm run build

# 2. 同步到原生项目（Capacitor 会复制 webDir 内容）
npx cap sync

# 3. 打开原生 IDE
npx cap open android   # 打开 Android Studio
# npx cap open ios     # 打开 Xcode（macOS）
```

### 直接运行到设备：

```bash
# Android（需连接设备或打开模拟器）
npx cap run android

# iOS（macOS only）
# npx cap run ios
```

---

## 步骤 7: 配置 App 图标

### 7.1 生成图标

使用工具生成各平台图标：
- [Capacitor Icon Generator](https://github.com/ionic-team/capacitor-assets)
- [App Icon Generator](https://appicon.co/)

### 7.2 Android

替换 `android/app/src/main/res/mipmap-*/` 下的文件。

### 7.3 iOS（macOS only）

在 Xcode 中替换 `Assets.xcassets/AppIcon.appiconset/` 下的文件。

---

## 步骤 8: 构建发布版本

### 8.1 配置签名

项目采用 `keystore.properties` 文件管理签名配置（不与代码混在一起）。

#### 1) 生成签名密钥

```bash
# 生成到 android/app/ 目录下
keytool -genkey -v \
  -storetype PKCS12 \
  -keystore android/app/english-read.keystore \
  -alias englishread \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

按提示填写信息，记住设置的 **storePassword** 和 **keyPassword**。

#### 2) 创建 keystore.properties

在 `android/` 目录下创建 `keystore.properties`（**不要提交到 git**）：

```properties
# android/keystore.properties
storeFile=app/english-read.keystore
storePassword=你的密码
keyAlias=englishread
keyPassword=你的密码
```

确保该文件已加入 `.gitignore`：

```gitignore
# .gitignore
android/keystore.properties
android/app/*.keystore
```

### 8.2 配置 build.gradle

编辑 `android/app/build.gradle`，添加签名读取和 APK 命名逻辑：

```groovy
apply plugin: 'com.android.application'

// Keystore configuration
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.englishread.app"
    compileSdk = rootProject.ext.compileSdkVersion

    defaultConfig {
        applicationId "com.englishread.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        // ...
    }

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }

    // 自定义 APK 输出名称
    applicationVariants.configureEach { variant ->
        variant.outputs.configureEach { output ->
            if (variant.buildType.name == 'release') {
                outputFileName = "EnglishRead-v${defaultConfig.versionName}-release.apk"
            } else if (variant.buildType.name == 'debug') {
                outputFileName = "EnglishRead-v${defaultConfig.versionName}-debug.apk"
            }
        }
    }
}
```

> **说明**：此配置完全模仿 `eye-care-20-20-20` 项目的签名方案——通过外置 `keystore.properties` 加载签名信息，避免敏感信息泄露。APK 输出格式为 `EnglishRead-v{version}-{type}.apk`。

### 8.3 构建 APK / AAB

```bash
# 构建 APK（直接安装）
cd android
./gradlew assembleRelease

# 构建 AAB（Google Play 商店）
./gradlew bundleRelease
```

APK 位置：`android/app/build/outputs/apk/release/EnglishRead-v1.0-release.apk`
AAB 位置：`android/app/build/outputs/bundle/release/app-release.aab`

---

## 步骤 9: 添加构建脚本

### 9.1 在 package.json 中添加脚本

将以下脚本添加到项目根目录的 `package.json` 的 `scripts` 字段中：

```json
{
  "scripts": {
    "run:android": "cap run android --live-reload --port 4000 --host localhost --forwardPorts 4000:4000",
    "patch": "node scripts/bump-android-version.js",
    "build:android": "npm run build && cap sync && cd android && gradlew assembleRelease && cd .. && npm run upload:apk",
    "build:android:debug": "npm run build && cap sync && cd android && gradlew assembleDebug && cd .. && npm run upload:apk:debug",
    "upload:apk": "node --env-file=.env.local scripts/upload-apk.mjs",
    "upload:apk:debug": "node --env-file=.env.local scripts/upload-apk.mjs --debug",
    "logo": "npx @capacitor/assets generate"
  }
}
```

脚本说明：

| 脚本 | 用途 |
|------|------|
| `run:android` | 热重载模式运行到 Android 设备（修改代码后自动刷新） |
| `patch` | 自动升级 Android 版本号（versionCode +1，versionName bump） |
| `build:android` | 完整构建流程：构建 Web → 同步 → 编译 Release APK → 上传到 Vercel Blob |
| `build:android:debug` | 同上，但编译 Debug APK |
| `upload:apk` | 单独上传已有 APK 到 Vercel Blob |
| `upload:apk:debug` | 上传 Debug APK |
| `logo` | 自动生成各平台 App 图标（需准备源图 `assets/icon.png`） |

### 9.2 创建 bump-android-version.js

在 `scripts/bump-android-version.js` 中创建版本自动升级脚本：

```javascript
/**
 * 自动更新 android/app/build.gradle 和 package.json 版本号
 *
 * 用法: node scripts/bump-android-version.js
 *
 * 效果:
 *   versionName "1.0"    → "1.1"
 *   versionName "1.0.0"  → "1.0.1"  (3段格式也支持)
 *   versionCode N        → N+1
 *   package.json version → 同步更新
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gradlePath = path.resolve(__dirname, '../android/app/build.gradle')
const pkgPath = path.resolve(__dirname, '../package.json')

// 1. 读取 build.gradle
let content = fs.readFileSync(gradlePath, 'utf-8')

// 2. 匹配 versionName — 支持 "x.y" 或 "x.y.z" 格式
const versionNameMatch = content.match(/versionName\s+"(\d+)\.(\d+)(?:\.(\d+))?"/)
if (!versionNameMatch) {
  console.error('[BOWEN_LOG] 未找到 versionName (格式: "x.y" 或 "x.y.z")')
  process.exit(1)
}

const major = parseInt(versionNameMatch[1], 10)
const minor = parseInt(versionNameMatch[2], 10)
const patch = versionNameMatch[3] !== undefined ? parseInt(versionNameMatch[3], 10) : -1

let newVersionName
if (patch >= 0) {
  // "x.y.z" → bump patch
  newVersionName = `${major}.${minor}.${patch + 1}`
} else {
  // "x.y" → bump minor
  newVersionName = `${major}.${minor + 1}`
}

// 3. 匹配 versionCode
const versionCodeMatch = content.match(/versionCode\s+(\d+)/)
if (!versionCodeMatch) {
  console.error('[BOWEN_LOG] 未找到 versionCode')
  process.exit(1)
}

const oldVersionCode = parseInt(versionCodeMatch[1], 10)
const newVersionCode = oldVersionCode + 1

// 4. 替换 build.gradle
content = content.replace(
  /versionCode\s+\d+/,
  `versionCode ${newVersionCode}`
)
content = content.replace(
  /versionName\s+"[\d.]+"/,
  `versionName "${newVersionName}"`
)

fs.writeFileSync(gradlePath, content, 'utf-8')

// 5. 同步更新 package.json 的 version 字段
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
pkg.version = newVersionName
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')

console.log(`[BOWEN_LOG] versionName 已更新: ${versionNameMatch[0].trim()} → ${newVersionName}`)
console.log(`[BOWEN_LOG] versionCode 已更新: ${oldVersionCode} → ${newVersionCode}`)
console.log(`[BOWEN_LOG] package.json version 已同步: ${newVersionName}`)
```

### 9.3 创建 upload-apk.mjs

在 `scripts/upload-apk.mjs` 中创建 APK 上传到 Vercel Blob 的脚本：

```javascript
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// 从 build.gradle 读取版本号
const buildGradle = readFileSync(resolve(root, 'android/app/build.gradle'), 'utf-8')
const versionMatch = buildGradle.match(/versionName\s+"([^"]+)"/)
const version = versionMatch ? versionMatch[1] : '1.0'

const buildType = process.argv.includes('--debug') ? 'debug' : 'release'
const apkName = `EnglishRead-v${version}-${buildType}.apk`
const apkPath = resolve(root, `android/app/build/outputs/apk/${buildType}/${apkName}`)

if (!existsSync(apkPath)) {
  console.error(`[BOWEN_LOG] APK 文件未找到: ${apkPath}`)
  process.exit(1)
}

const blobPath = `apks/${apkName}`
const fileBuffer = readFileSync(apkPath)

console.log(`[BOWEN_LOG] 正在上传 ${apkName} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB)...`)

try {
  const { url } = await put(blobPath, fileBuffer, {
    access: 'public',
    contentType: 'application/vnd.android.package-archive',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  console.log(`[BOWEN_LOG] 上传成功: ${url}`)
} catch (e) {
  console.error('[BOWEN_LOG] 上传失败:', e.message)
  process.exit(1)
}
```

> **前置条件**：上传脚本依赖 `@vercel/blob` 包，确保已在项目中安装（english-read 已安装）。同时需要在 `.env.local` 中配置 `BLOB_READ_WRITE_TOKEN`。

### 9.4 添加 gitignore 配置

确保以下内容在 `.gitignore` 中：

```gitignore
# Android
android/keystore.properties
android/app/*.keystore

# APK 构建产物
android/app/build/outputs/

# 环境变量
.env.local
```

---

## 可选增强功能

### 推送通知

```bash
npm install @capacitor/push-notifications
npx cap sync
```

配置 Firebase Cloud Messaging（Android）和 APNs（iOS）。

### 文件下载（离线阅读）

```bash
npm install @capacitor/filesystem
npx cap sync
```

### 社交登录（Apple / Google）

```bash
npm install @capacitor/google-sign-in
npm install @capacitor/apple-sign-in
npx cap sync
```

---

## 常见问题

### Q: 为什么不用重写 Next.js 代码？

因为 Capacitor 远程模式直接加载 Vercel 上的完整 SSR 页面。所有 Next.js 功能（Server Components、API Routes、Middleware）都在服务端正常运作。

### Q: 离线时怎么办？

远程模式下无法离线。如果需要离线：
1. 升级到 B2 本地模式（见 [app-packaging-overview.md](./app-packaging-overview.md)）
2. 或单独做 PWA Service Worker 缓存策略

### Q: OAuth 登录在 App 内能正常工作吗？

大部分 OAuth 流程（GitHub、Google）会跳转到系统浏览器再回调回 App。需要：
1. 正确配置 Deep Link
2. 配置 OAuth Provider 的授权回调 URL 为你的 Vercel 域名

### Q: 如何调试 WebView？

```bash
# Android Chrome DevTools
chrome://inspect

# iOS Safari Web Inspector
# 设置 → Safari → 高级 → Web Inspector 开启
```

### Q: Capacitor 和直接浏览器有什么区别？

| 方面 | 浏览器 | Capacitor App |
|------|-------|---------------|
| 界面 | 有浏览器工具栏 | 全屏沉浸式 |
| App Store 发布 | 不可 | 可以 |
| 原生 API | 无 | 有（插件） |
| 推送通知 | 需浏览器支持 | 原生级别 |
| 用户感知 | 网页 | 真实 App |

---

## 开发工作流总结

```bash
# 日常开发（Web）
npm run dev                 # localhost:5000 正常开发

# 准备打包
npm run build               # 构建 Next.js
npx cap sync                # 同步到原生项目
npx cap run android         # 运行到设备/模拟器
```

**不需要**每次改代码都重新打包 App。开发时直接在浏览器中调试，只在需要测试原生功能（推送、文件等）时才运行 `cap run`。线上代码更新后，App 下次打开会自动加载最新内容（配置了 `server.url` 的情况下）。