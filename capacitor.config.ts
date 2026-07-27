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
  },
  plugins: {
    // 关闭后 fetch/XHR 走 WebView 自身网络栈，Set-Cookie 会写进和页面导航
    // 共用的系统 CookieManager，登录后的 session cookie 才能在重启 App 后持久生效。
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;