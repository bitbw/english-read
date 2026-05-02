import DypnsClient, {
  CheckSmsVerifyCodeRequest,
  SendSmsVerifyCodeRequest,
} from "@alicloud/dypnsapi20170525";
import { $OpenApiUtil } from "@alicloud/openapi-core";

let cached: DypnsClient | null | undefined;

/** 阿里云 OpenAPI：超时为毫秒。跨境/冷启动易触发 ConnectTimeout，默认放宽；可用环境变量覆盖 */
const DEFAULT_DYPNS_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_DYPNS_READ_TIMEOUT_MS = 60_000;

function parseTimeoutMs(raw: string | undefined, fallback: number): number {
  const n = raw?.trim() ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1000 ? n : fallback;
}

function getDypnsClient(): DypnsClient | null {
  if (cached === undefined) {
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
    if (!accessKeyId || !accessKeySecret) {
      cached = null;
    } else {
      const connectTimeout = parseTimeoutMs(
        process.env.ALIYUN_DYPNS_CONNECT_TIMEOUT_MS,
        DEFAULT_DYPNS_CONNECT_TIMEOUT_MS
      );
      const readTimeout = parseTimeoutMs(
        process.env.ALIYUN_DYPNS_READ_TIMEOUT_MS,
        DEFAULT_DYPNS_READ_TIMEOUT_MS
      );
      cached = new DypnsClient(
        new $OpenApiUtil.Config({
          accessKeyId,
          accessKeySecret,
          endpoint: "dypnsapi.aliyuncs.com",
          connectTimeout,
          readTimeout,
        }),
      );
    }
  }
  return cached;
}

/** 是否具备调用阿里云融合认证短信接口所需环境变量（不含业务模板，发送前仍须检查模板） */
export function isAliyunDypnsConfigured(): boolean {
  return !!(
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET
  );
}

function smsTemplateEnvOk(): boolean {
  return !!(
    process.env.ALIYUN_SMS_SIGN_NAME &&
    process.env.ALIYUN_SMS_TEMPLATE_CODE
  );
}

/**
 * 使用控制台「赠送签名 + 赠送模板」发送验证码（TemplateParam 中 code 为 ##code## 由系统生成，见产品文档）。
 */
/** @param nationalNumber 国内号码，不含区号、不含 +（与地域 countryCode 组合） */
export async function sendSmsVerifyCode(
  nationalNumber: string,
  countryCode: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isAliyunDypnsConfigured() || !smsTemplateEnvOk()) {
    return { ok: false, message: "短信服务未配置" };
  }
  const client = getDypnsClient();
  if (!client) {
    return { ok: false, message: "短信服务未配置" };
  }

  const signName = process.env.ALIYUN_SMS_SIGN_NAME!;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE!;
  const templateParam =
    process.env.ALIYUN_SMS_TEMPLATE_PARAM ?? '{"code":"##code##","min":"5"}';
  const schemeName = process.env.ALIYUN_SMS_SCHEME_NAME;

  const req = new SendSmsVerifyCodeRequest({
    phoneNumber: nationalNumber,
    countryCode,
    signName,
    templateCode,
    templateParam,
    schemeName: schemeName || undefined,
    codeType: 1,
    returnVerifyCode: false,
  });

  try {
    const res = await client.sendSmsVerifyCode(req);
    const body = res.body;
    if (body?.code === "OK" && body.success) {
      return { ok: true };
    }
    return { ok: false, message: body?.message?.trim() || "发送失败" };
  } catch (e) {
    console.error("[BOWEN_LOG] sendSmsVerifyCode", e);
    return { ok: false, message: "发送失败，请稍后重试" };
  }
}

/**
 * 调用阿里云 CheckSmsVerifyCode，仅当业务层返回 PASS 视为验码成功。
 */
export async function verifySmsCode(
  nationalNumber: string,
  countryCode: string,
  code: string,
): Promise<boolean> {
  if (!isAliyunDypnsConfigured()) return false;
  const client = getDypnsClient();
  if (!client) return false;

  const schemeName = process.env.ALIYUN_SMS_SCHEME_NAME;
  const req = new CheckSmsVerifyCodeRequest({
    phoneNumber: nationalNumber,
    countryCode,
    verifyCode: code.trim(),
    schemeName: schemeName || undefined,
    caseAuthPolicy: 1,
  });
  try {
    const res = await client.checkSmsVerifyCode(req);
    const body = res.body;
    if (body?.code !== "OK" || !body.success) return false;
    return body.model?.verifyResult === "PASS";
  } catch (e) {
    console.error("[BOWEN_LOG] checkSmsVerifyCode", e);
    return false;
  }
}
