"use client";

import { toast } from "sonner";

export const CLIENT_FETCH_NETWORK_ERROR = "网络异常，请检查连接后重试";

type ApiErrorBody = {
  message?: unknown;
  error?: unknown;
};

async function parseApiErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    return (await res.clone().json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

/**
 * 从 API JSON 体提取可读错误文案。
 * 优先级：`message` → `error`（字符串原样；对象等非字符串则用固定提示）→ `HTTP status` 兜底。
 */
export function errorMessageFromApiBody(body: ApiErrorBody | null, status: number): string {
  const fallback = `请求失败（HTTP ${status}）`;
  if (!body) return fallback;
  if (typeof body.message === "string" && body.message.trim() !== "") {
    return body.message.trim();
  }
  // 常见：{ error: "Unauthorized" }
  if (typeof body.error === "string") return body.error;
  // 常见：Zod safeParse 失败时的 { error: flatten 对象 }，不宜整段展示给用户
  if (body.error) return "请求被拒绝，请刷新页面或重新登录后再试";
  return fallback;
}

async function toastForFailedResponse(res: Response): Promise<void> {
  const body = await parseApiErrorBody(res);
  toast.error(errorMessageFromApiBody(body, res.status));
}

export type ClientFetchInit = RequestInit & {
  /** 为 false 时不自动 toast（默认 true） */
  showErrorToast?: boolean;
};

function browserIanaTimeZone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const t = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (t && t.length <= 120) return t;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 浏览器端统一 fetch：网络失败或非 2xx 时默认 Sonner toast（Next 无内置全局劫持）。
 * 错误文案优先使用响应 JSON 的 `message`，否则使用字符串 `error`。
 * 自动附加 `X-User-Timezone`（IANA），供服务端按学习时区切日；调用方已设置则不覆盖。
 */
export async function clientFetch(
  input: RequestInfo | URL,
  init?: ClientFetchInit
): Promise<Response> {
  const { showErrorToast = true, ...fetchInit } = init ?? {};
  const headers = new Headers(fetchInit.headers);
  if (!headers.has("X-User-Timezone")) {
    const tz = browserIanaTimeZone();
    if (tz) headers.set("X-User-Timezone", tz);
  }
  const nextInit: RequestInit = { ...fetchInit, headers };

  try {
    const res = await fetch(input, nextInit);
    if (!res.ok && showErrorToast) {
      await toastForFailedResponse(res);
    }
    return res;
  } catch {
    if (showErrorToast) toast.error(CLIENT_FETCH_NETWORK_ERROR);
    throw new Error(CLIENT_FETCH_NETWORK_ERROR);
  }
}
