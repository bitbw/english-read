# Level Read 文章抓取告警方案

## 目标

避免 `levelread.com` 调整页面结构、上游请求失败或 Vercel Cron 漏跑后，文章长期不更新却只能靠人工翻日志发现。

本方案只使用项目已经接入的 Sentry 和 Vercel Cron，不新增邮件服务、依赖或邮件凭据。Sentry 负责监控和发出事件；邮件收件人及通知规则在 Sentry 中配置。

## 当前状态

- Vercel Cron 在 `vercel.json` 中配置为每天 `08:00 UTC` 调用 `/api/cron/scrape-articles`。
- 抓取接口位于 Next.js App Router：`src/app/api/cron/scrape-articles/route.ts`。
- 项目已安装 `@sentry/nextjs`，当前本地安装版本为 `10.55.0`，并在 `next.config.mjs` 使用 `withSentryConfig`。
- 当前配置使用 `webpack.automaticVercelMonitors`，它只覆盖 Webpack + Pages Router；本项目的 Cron 是 App Router Route Handler，因此不能依赖这项配置监控该任务。
- 另一个独立问题是：抓取即使发现正文解析失败，接口目前仍会汇总结果并返回 HTTP 200。只观察 HTTP 状态或 Vercel 请求日志不足以发现“任务跑了，但没有抓到文章”。
- 正文解析器已修复为读取文章段落标记，并兼容当前英文发布日期格式；改动已经用 Level 1、2、3 的实时文章 HTML 做过本地解析验证。

## 推荐结构：两类告警

### 1. Cron 运行告警：漏跑、超时、任务执行失败

优先使用 Sentry Next.js SDK 对 Vercel Cron 的自动监控。将 `next.config.mjs` 中旧的 `webpack.automaticVercelMonitors` 改为：

```js
export default withSentryConfig(withNextIntl(nextConfig), {
  // 保留现有 Sentry 配置
  _experimental: {
    vercelCronsMonitoring: true,
  },
  webpack: {
    // 保留现有 webpack treeshake 等设置，不再设置 automaticVercelMonitors
  },
});
```

这里的 `_experimental.vercelCronsMonitoring` 会读取 `vercel.json` 的 Cron 配置并从 Vercel Cron 请求生成 Sentry check-in，支持 App Router 和 Pages Router。它目前仍是 experimental 选项，升级 Sentry SDK 时应重新核对官方配置。不要同时保留旧的 `webpack.automaticVercelMonitors`。

Vercel 的 cron schedule 使用 UTC；Sentry Monitor 的 schedule 必须与 `vercel.json` 保持一致，即 `0 8 * * *`。给任务设置合理的 missed check-in 宽限时间和最大运行时间，避免部署或短暂调度延迟造成误报。

### 2. 抓取质量告警：上游内容变化或数据没有写入

自动 Cron check-in 证明的是任务执行情况，不等于正文已成功入库。抓取逻辑还应将以下状态明确报告到 Sentry：

| 情况 | 处理建议 |
| --- | --- |
| Level Read 列表请求超时、HTTP 非 2xx 或解析不到预期列表结构 | 记录具体等级和失败原因，并报告一次抓取失败事件；不要把网络异常伪装成空列表 |
| 找到文章链接，但最新候选文章全部取不到有效标题/正文 | 作为高优先级内容抓取失败，报告 Sentry；这正是页面结构变化的主要信号 |
| 只有个别文章失败，但同一轮仍成功抓到其他文章 | 记录失败 slug 和计数；是否立即邮件通知可按噪音容忍度决定，建议至少在连续发生或成功数为 0 时告警 |
| 数据库写入失败 | 作为任务失败上报，包含等级/slug 和异常，不包含文章全文 |
| 列表请求正常、有文章候选且内容解析成功，但文章已存在 | 这是正常去重，不应告警 |
| 页面正常返回，但确实没有新内容 | 不应仅因为“新增条数为 0”报警；现有 `onConflictDoNothing` 也意味着处理成功不一定新增行 |

内容异常事件应使用稳定的事件名称/分组和专用 tag（例如 `cron.job=scrape-articles`、`scrape.level=2`），每轮聚合成一条，不要每个 HTML 错误都单独发一封邮件。上报字段只放状态码、slug、等级、错误类型和计数，不发送正文或敏感信息。

## 邮件通知配置

在 Sentry 项目中建立两条 Issue Alert（或等价的 Workflow）：

1. **Cron 未按时运行/失败**：关联 Cron Monitor 的 missed、failed、timeout 事件。
2. **文章内容抓取失败**：过滤 `cron.job=scrape-articles`，只对这类业务失败事件通知。

为通知动作选择 Email，配置接收人或团队；设置通知频率/冷却时间，避免同一故障每天重复轰炸。若 Sentry 只通知 Issue 的负责人/团队，则需先给 Monitor 或 Issue 配好负责人，并确认该负责人邮箱可接收 Sentry 通知。

## 实施与验收顺序

1. 修改 Sentry Next.js 配置，部署 Preview，检查 Sentry 是否出现对应 Cron Monitor 和 check-in。
2. 将抓取失败场景归一化上报：列表失败、候选正文全失败、数据库写入失败；成功去重不报警。
3. 在 Preview 使用可控的解析失败模拟或测试入口验证：Sentry 收到事件，Issue Alert 发送测试邮件；不要为测试调用会写生产数据库的抓取接口。
4. 验证恢复路径：下一次 check-in / 成功抓取后，Monitor 或 Issue 能恢复/关闭；失败事件有链接到对应 Vercel 请求和 slug 的信息。
5. 部署 Production 后观察至少一次真实 Cron check-in；确认 Monitor schedule 与 UTC 时间一致，邮件送达。

## 方案边界和维护

- 邮件由 Sentry 发送；本项目不需要 SMTP/Resend API Key，也不把收件人地址写进代码。
- Sentry Cron Monitor 覆盖“任务是否按计划启动、是否超时或失败”；业务级“正文是否可解析”仍需由抓取代码报告。
- 如果 Sentry 监控套餐/配额不支持 Cron Monitors，备用方案才是增加独立邮件提供商或外部 heartbeat 服务；不建议当前先引入第二套告警系统。
- Sentry 的 Next.js Cron 自动监控配置与事件规则可能随 SDK 版本变化，升级 `@sentry/nextjs` 后应重新验证 Preview。

## 官方参考

- [Sentry Next.js Cron Monitoring](https://docs.sentry.io/platforms/javascript/guides/nextjs/crons/)
- [Sentry Next.js Build Options: `vercelCronsMonitoring`](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/#_experimentalvercelcronsmonitoring)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
