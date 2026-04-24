import { NextResponse } from "next/server";
import { sendSmsVerifyCode, isAliyunDypnsConfigured } from "@/lib/aliyun-dypns";
import { parsePhoneOtpPayload } from "@/lib/phone-auth";

const SMS_TEMPLATE_ERR = "短信服务未配置模板（ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE）";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "无效的 JSON" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || !("phone" in body)) {
    return NextResponse.json({ message: "缺少手机号" }, { status: 400 });
  }
  if (!("countryCode" in body)) {
    return NextResponse.json({ message: "缺少区号" }, { status: 400 });
  }
  const o = body as { countryCode: unknown; phone: unknown };
  const parsed = parsePhoneOtpPayload(o.countryCode, o.phone);
  if (!parsed) {
    return NextResponse.json({ message: "区号或手机号格式无效" }, { status: 400 });
  }

  if (!isAliyunDypnsConfigured()) {
    return NextResponse.json({ message: "短信服务未配置" }, { status: 503 });
  }
  if (!process.env.ALIYUN_SMS_SIGN_NAME || !process.env.ALIYUN_SMS_TEMPLATE_CODE) {
    return NextResponse.json({ message: SMS_TEMPLATE_ERR }, { status: 503 });
  }

  const result = await sendSmsVerifyCode(
    parsed.localDigits,
    parsed.countryCode,
  );
  if (!result.ok) {
    const isConfig = result.message === "短信服务未配置";
    return NextResponse.json(
      { message: result.message },
      { status: isConfig ? 503 : 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
