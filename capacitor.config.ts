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
};

export default config;