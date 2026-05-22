/**
 * EPUB 上传体积上限（个人书架 `/api/upload` 与公共书库直传一致）。
 * 客户端与 API 须共用同一数值，避免只拦一端。
 */
export const MAX_EPUB_UPLOAD_BYTES = 10 * 1024 * 1024;
