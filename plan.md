基于对项目的了解，这里给你一个完整的 i18n 方案建议。                                                                                                                                                  
  ---                                                                                                                                       方案推荐：next-intl    
                                                                                                                                            为什么选 next-intl？                                                                                                                                                                                                                                                                ┌───────────────┬─────────────────────────────────────────────────────────────────┬───────────────────────────────────────────┐           │     方案      │                              优点                               │                   缺点                    │           ├───────────────┼─────────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤           │ next-intl ✅  │ App Router 原生支持、Server Component 友好、TypeScript 类型安全 │ 需要一定迁移成本                          │           ├───────────────┼─────────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤           │ next-i18next  │ 老牌稳定                                                        │ 为 Pages Router 设计，App Router 支持差   │           ├───────────────┼─────────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤           │ react-i18next │ 灵活                                                            │ 主要是客户端，Server Component 需额外配置 │           ├───────────────┼─────────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤           │ 自己实现      │ 零依赖                                                          │ 功能不完整，维护成本高                    │           └───────────────┴─────────────────────────────────────────────────────────────────┴───────────────────────────────────────────┘         

  ---
  两种实现路线

  路线 A：URL 前缀路由（/zh/dashboard、/en/dashboard）

  优点：SEO 友好、可书签、符合 Web 标准
  缺点：需改动所有 Link 组件、路由结构变化大
  适合：有公开内容页面的项目

  路线 B：Cookie/Header 路由（URL 不变）

  优点：几乎不改路由结构，迁移成本低
  缺点：无 SEO 优势（但你这个项目全是登录后页面，SEO 无意义）
  适合：纯应用型项目 ✅ 你的情况

  你的项目全是受保护路由（/dashboard、/library 等），推荐路线 B（Cookie 方案），改动最小、风险最低。

  ---
  具体实施步骤

  第一步：安装依赖

  yarn add next-intl

  第二步：创建翻译文件结构

  src/
    messages/
      zh.json    # 中文（现有文字）
      en.json    # 英文翻译

  示例 zh.json：
  {
    "nav": {
      "home": "首页",
      "library": "我的书架",
      "store": "公共书库",
      "vocabulary": "生词本",
      "plan": "复习计划",
      "settings": "设置"
    },
    "dashboard": {
      "greeting": "你好，{name} 👋",
      "motto": "今天也要坚持学习哦"
    }
  }

  第三步：配置 next-intl（Cookie 模式）

  src/i18n/request.ts（新文件）：
  import { getRequestConfig } from 'next-intl/server';
  import { cookies } from 'next/headers';

  export default getRequestConfig(async () => {
    const locale = (await cookies()).get('locale')?.value ?? 'zh';
    return {
      locale,
      messages: (await import(`@/messages/${locale}.json`)).default,
    };
  });

  next.config.ts 中加入：
  import createNextIntlPlugin from 'next-intl/plugin';
  const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
  export default withNextIntl({ ...yourConfig });

  第四步：在组件中使用

  Server Component：
  import { useTranslations } from 'next-intl';

  export default function Sidebar() {
    const t = useTranslations('nav');
    return <span>{t('home')}</span>; // 输出"首页"
  }

  Client Component：
  'use client';
  import { useTranslations } from 'next-intl';

  export function LoginForm() {
    const t = useTranslations('auth');
    return <button>{t('login')}</button>;
  }

  第五步：语言切换组件

  'use client';
  export function LocaleSwitcher() {
    const switchLocale = (locale: string) => {
      document.cookie = `locale=${locale}; path=/; max-age=31536000`;
      window.location.reload();
    };
    return (
      <button onClick={() => switchLocale('en')}>EN</button>
      <button onClick={() => switchLocale('zh')}>中</button>
    );
  }

  ---
  迁移工作量评估

  ┌──────────────┬─────────────────────────┬──────────┬─────────────────────┐
  │     模块     │          文件           │ 字符串数 │        难度         │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ 导航栏       │ sidebar.tsx, topbar.tsx │ ~10      │ 低                  │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ 仪表板       │ dashboard/page.tsx      │ ~20      │ 低                  │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ 登录表单     │ login-form.tsx          │ ~10      │ 低                  │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ 生词本       │ vocabulary/page.tsx     │ ~15      │ 低                  │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ 复习页面     │ review-page-client.tsx  │ ~10      │ 中                  │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ 设置页面     │ settings/page.tsx       │ ~30      │ 中（动态插值多）    │
  ├──────────────┼─────────────────────────┼──────────┼─────────────────────┤
  │ API 错误提示 │ api/...                 │ ~20      │ 高（需要传 locale） │
  └──────────────┴─────────────────────────┴──────────┴─────────────────────┘

  总体评估：中等工作量，约 2~3 天可完成核心页面迁移。

  ---
  建议的执行顺序

  1. 安装 + 基础配置（1h）
  2. 提取所有文字到 zh.json（1h，可用脚本辅助）
  3. 翻译 en.json（可先用 AI 批量翻译）
  4. 逐文件替换硬编码文字（主要工作量）
  5. 加切换入口到设置页面

  ---
  需要我直接开始实施吗？ 可以从第一步开始帮你写代码，或者先只帮你提取所有文字到翻译文件。