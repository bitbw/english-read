package com.englishread.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);  // 确保 WebView 接受并存储 Cookie
        cookieManager.flush();                // 立即将 Cookie 写入磁盘，避免 App 进程被杀时丢失 session
    }
}
