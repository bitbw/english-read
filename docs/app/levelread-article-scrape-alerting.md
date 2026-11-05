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
- 抓取接口现已实现最小内容告警：同一轮 Cron 中连续两篇候选文章无法取得有效标题或正文时，向 Sentry 上报一条异常；成功解析一篇会重置连续失败计数。

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

自动 Cron check-in 证明的是任务执行情况，不等于正文已成功入库。目前先采用最小实现：同一轮任务里连续两篇候选文章详情页未能解析出标题或正文时，调用 `Sentry.captureException` 上报一次。事件使用固定错误消息以便在 Sentry 中归并，并附上失败文章的等级和 slug，不附文章全文。成功解析文章会清零连续失败计数；正常去重不报警。阈值按“同一轮连续两篇”计算，不跨 Cron 执行保存状态。

这条告警覆盖文章详情页请求失败、HTTP 非 2xx、标题缺失或正文结构变化导致解析为空。它不覆盖列表页请求失败或列表结构变化造成候选链接数为零；要覆盖这些情况，应让列表抓取区分“确实无文章”和“请求/解析失败”，再上报对应异常。

其他需要分别处理的状态：

| 情况 | 处理建议 |
| --- | --- |
| Level Read 列表请求超时、HTTP 非 2xx 或解析不到预期列表结构 | 记录具体等级和失败原因，并报告一次抓取失败事件；不要把网络异常伪装成空列表 |
| 找到文章链接，但连续两篇取不到有效标题/正文 | 已实现：上报一条 Sentry 异常；连续失败的等级和 slug 作为附加信息 |
| 单篇失败，随后文章成功 | 不告警；成功会重置连续失败计数 |
| 数据库写入失败 | 作为任务失败上报，包含等级/slug 和异常，不包含文章全文 |
| 列表请求正常、有文章候选且内容解析成功，但文章已存在 | 这是正常去重，不应告警 |
| 页面正常返回，但确实没有新内容 | 不应仅因为“新增条数为 0”报警；现有 `onConflictDoNothing` 也意味着处理成功不一定新增行 |

内容异常使用固定错误消息和 `cron_job=scrape-articles` tag，便于在 Sentry 中归并和筛选。不要每个 HTML 错误都单独发一封邮件；上报字段只放 slug 和等级，不发送正文或敏感信息。

## 通知配置

`Sentry.captureException` 负责把错误发到 Sentry，不会自动发送邮件。检查时（2026-11-04），`english-read` 项目已有启用的 `feishu-alerts` Issue Alert：覆盖该项目的新 Issue，并通过飞书 webhook 通知。因此这条固定错误首次创建 Issue 时应走现有飞书通知；部署后应确认 Sentry Issue 和飞书消息都收到。

如需邮件，在 Sentry 的该 Issue Alert 中添加 Email 动作或创建单独规则，按 `cron_job=scrape-articles` / 固定错误消息筛选，并配置收件人。Cron 漏跑、超时的 Cron Monitor 告警是另一件事，不由本次正文失败事件覆盖。

## 实施与验收顺序

1. 已实现：连续两篇候选文章正文失败时，Preview/Production 的 Sentry 服务端 SDK 收到一条业务异常；本地 `development` 环境默认禁用 Sentry 上报。
2. 部署 Preview 后，用不写生产数据库的方式验证 Sentry Issue 和现有飞书通知；如果选择邮件，再验证邮件动作和送达。
3. 如需监控 Cron 漏跑，再单独配置 `_experimental.vercelCronsMonitoring` 并确认 Monitor schedule 与 `vercel.json` 中的 UTC schedule 一致。
4. 部署 Production 后观察真实运行及对应通知；成功文章会重置失败计数，但 Sentry Issue 的关闭/恢复策略仍由 Issue Alert 配置决定。

## 方案边界和维护

- 邮件由 Sentry 发送；本项目不需要 SMTP/Resend API Key，也不把收件人地址写进代码。
- Sentry Cron Monitor 覆盖“任务是否按计划启动、是否超时或失败”；业务级“正文是否可解析”仍需由抓取代码报告。
- 如果 Sentry 监控套餐/配额不支持 Cron Monitors，备用方案才是增加独立邮件提供商或外部 heartbeat 服务；不建议当前先引入第二套告警系统。
- Sentry 的 Next.js Cron 自动监控配置与事件规则可能随 SDK 版本变化，升级 `@sentry/nextjs` 后应重新验证 Preview。

## 官方参考

- [Sentry Next.js Cron Monitoring](https://docs.sentry.io/platforms/javascript/guides/nextjs/crons/)
- [Sentry Next.js Build Options: `vercelCronsMonitoring`](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/#_experimentalvercelcronsmonitoring)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
