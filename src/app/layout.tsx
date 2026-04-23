import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { SentryUserSync } from "@/components/sentry-user-sync";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/lib/auth";
import { isProductionAnalytics } from "@/lib/analytics-env";
import { setSentryUserFromSession } from "@/lib/sentry-user";
import { Analytics } from "@vercel/analytics/next";
import { PostHogIdentify } from "@/components/posthog-identify";
import { PostHogProvider } from "@/components/posthog-provider";
import { SuspendedPostHogPageView } from "@/components/posthog-pageview";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "English Read - 英语阅读与生词本",
  description: "导入 EPUB 电子书，边读边记单词，艾宾浩斯间隔复习",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (isProductionAnalytics) {
    setSentryUserFromSession(session);
  }

  return (
    <html lang="zh" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PostHogProvider enabled={isProductionAnalytics}>
          <SessionProvider session={session}>
            <SentryUserSync />
            {isProductionAnalytics ? <PostHogIdentify /> : null}
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {isProductionAnalytics ? <SuspendedPostHogPageView /> : null}
              {children}
              <Toaster />
            </ThemeProvider>
          </SessionProvider>
          {isProductionAnalytics ? <Analytics /> : null}
        </PostHogProvider>
      </body>
    </html>
  );
}
