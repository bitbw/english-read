/**
 * Google Cloud Translation API v2（REST）测试脚本
 * 依据 docs/google.md：POST .../language/translate/v2，查询参数 key
 *
 * 前置：在 GCP 控制台启用 Cloud Translation API，并创建 API 密钥（可限制为 Translation API）
 *
 * 运行：
 *   node scripts/google-translate-test.js
 * 或通过环境变量传 key（避免写入文件）：
 *   GOOGLE_TRANSLATE_API_KEY=你的key node scripts/google-translate-test.js
 */

// ============ 请填写 / 按需修改 ============
/** API 密钥；留空则使用环境变量 GOOGLE_TRANSLATE_API_KEY */
const API_KEY = "";

const TEXT_TO_TRANSLATE = "Hello, world!";
/** 目标语言：简体中文 zh-CN（繁体可用 zh-TW），见 https://cloud.google.com/translate/docs/languages */
const TARGET_LANG = "zh-CN";
/** 源语言；留空则由 API 自动检测 */
const SOURCE_LANG = "en";
/** 源文本格式：'text' 纯文本 或 'html' */
const FORMAT = "text";
/** 可选：'nmt' 等，不填则由服务端默认 */
const MODEL = undefined;
// ==========================================

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

function resolveApiKey() {
  const fromEnv = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  const key = (API_KEY && String(API_KEY).trim()) || fromEnv;
  if (!key) {
    console.error(
      "请设置 API Key：在脚本顶部填写 API_KEY，或设置环境变量 GOOGLE_TRANSLATE_API_KEY。"
    );
    process.exit(1);
  }
  return key;
}

async function translate() {
  const key = resolveApiKey();

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", key);

  const body = {
    q: TEXT_TO_TRANSLATE,
    target: TARGET_LANG,
    format: FORMAT,
  };
  if (SOURCE_LANG) body.source = SOURCE_LANG;
  if (MODEL) body.model = MODEL;

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("HTTP", res.status, JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const list = json?.data?.translations;
  if (!Array.isArray(list)) {
    console.error("意外响应结构:", JSON.stringify(json, null, 2));
    process.exit(1);
  }

  for (const t of list) {
    const line = [
      t.translatedText && `译文: ${t.translatedText}`,
      t.detectedSourceLanguage && `(检测到的源语言: ${t.detectedSourceLanguage})`,
      t.model && `(model: ${t.model})`,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(line || JSON.stringify(t));
  }
}

translate().catch((err) => {
  console.error(err);
  process.exit(1);
});
