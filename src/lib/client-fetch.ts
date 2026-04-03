"use client";

import { toast } from "sonner";

async function messageFromErrorResponse(res: Response): Promise<string> {
  const fallback = `请求失败（HTTP ${res.status}）`;
  try {
    const err = (await res.json()) as { error?: unknown };
    if (typeof err.error === "string") return err.error;
    if (err.error) return "请求被拒绝，请刷新页面或重新登录后再试";
  } catch {
    /* 非 JSON 响应 */
  }
  return fallback;
}

export type ClientFetchInit = RequestInit & {
  /** 为 false 时不自动 toast（默认 true） */
  showErrorToast?: boolean;
};

/**
 * 浏览器端统一 fetch：网络失败或非 2xx 时默认 Sonner toast（Next 无内置全局劫持）
 */
export async function clientFetch(
  input: RequestInfo | URL,
  init?: ClientFetchInit
): Promise<Response> {
  const { showErrorToast = true, ...fetchInit } = init ?? {};

  try {
    const res = await fetch(input, fetchInit);
    if (!res.ok && showErrorToast) {
      toast.error(await messageFromErrorResponse(res));
    }
    return res;
  } catch {
    const msg = "网络异常，请检查连接后重试";
    if (showErrorToast) toast.error(msg);
    throw new Error(msg);
  }
}
