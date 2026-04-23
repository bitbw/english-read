/**
 * 仅在生产环境向 PostHog / Sentry 上报。
 * `next dev` 下为 false；需验证生产上报请用 `next build && next start`。
 */
export const isProductionAnalytics = process.env.NODE_ENV === "production";
