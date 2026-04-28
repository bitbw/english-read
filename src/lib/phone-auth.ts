import {
  isSupportedCountryCode,
  isValidLocalForCountry,
} from "@/lib/phone-countries";

/** 中国大陆 11 位（不含 +86） */
const CN_MOBILE = /^1[3-9]\d{9}$/;

/**
 * 从用户输入得到纯 11 位国内手机号，不合法时返回 null（兼容旧逻辑 / 仅国内 API）。
 * @deprecated 多区号请用 {@link buildE164Phone}
 */
export function normalizeCnPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!CN_MOBILE.test(digits)) return null;
  return digits;
}

/**
 * 国家区号 + 本地号码（仅数字，不含 +）→ E.164 存库键，如 +8613800138000
 */
export function buildE164Phone(
  countryCode: string,
  localDigits: string,
): string | null {
  if (!isSupportedCountryCode(countryCode)) return null;
  if (!isValidLocalForCountry(countryCode, localDigits)) return null;
  return `+${countryCode}${localDigits}`;
}

/**
 * 发码/验码 API 与 NextAuth 入参：从原始输入解析为区号 + 国内号码。
 */
export function parsePhoneOtpPayload(
  countryCodeRaw: unknown,
  phoneRaw: unknown,
): { countryCode: string; localDigits: string; e164: string } | null {
  if (typeof countryCodeRaw !== "string" || typeof phoneRaw !== "string") {
    return null;
  }
  const countryCode = countryCodeRaw.trim();
  if (!isSupportedCountryCode(countryCode)) return null;
  const localDigits = phoneRaw.replace(/\D/g, "");
  const e164 = buildE164Phone(countryCode, localDigits);
  if (!e164) return null;
  return { countryCode, localDigits, e164 };
}

/** 展示用脱敏：支持 11 位国内、E.164 与其它存库形式 */
export function maskCnPhone(phone: string): string {
  return maskPhoneForDisplay(phone);
}

export function maskPhoneForDisplay(phone: string): string {
  if (phone.startsWith("+86") && phone.length >= 8) {
    const d = phone.slice(3);
    if (d.length === 11) {
      return `${d.slice(0, 3)}****${d.slice(-4)}`;
    }
  }
  if (CN_MOBILE.test(phone)) {
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }
  if (phone.length > 4) {
    return `****${phone.slice(-4)}`;
  }
  return phone;
}
