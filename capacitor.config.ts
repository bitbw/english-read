import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englishread.app',
  appName: 'English Read',
  webDir: 'capacitor-web',
  server: {
    url: 'https://english-read.bitbw.top',
    cleartext: false,
  },
  android: {
    webContentsDebuggingEnabled: true,
    appendUserAgent: " EnglishRead-App",  // 追加 UA 标识，服务端据此判断请求来自 App 内 WebView（用于 App 内跳登录页、隐藏下载按钮等）
  },
  plugins: {
    // 关闭后 fetch/XHR 走 WebView 自身网络栈，Set-Cookie 会写进和页面导航
    // 共用的系统 CookieManager，登录后的 session cookie 才能在重启 App 后持久生效。
    CapacitorHttp: {
      enabled: false,
    },
    SplashScreen: {
      // launchAutoHide: false 不可用。
      // 设为 false 后，原生桥在 WebView 加载期间注入的 window.Capacitor.triggerEvent()
      // 会因 Capacitor JS 运行时尚未完整初始化而报错（triggerEvent 未定义），
      // 导致 SplashScreen.hide() 无法被调用、splash 永远不消失。
      // 默认 true（~500ms 自动隐藏）足够 WebView 开始加载页面，无需 JS 介入。
      backgroundColor: "#F8FAFC",
    },
  },
};

export default config;