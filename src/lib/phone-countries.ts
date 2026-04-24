/** 登录页可选国家/地区（与阿里云 Dypns countryCode 一致，不含 +） */
export const PHONE_COUNTRY_CALLING_CODES = [
  { code: "86" },
  { code: "1" },
  { code: "852" },
  { code: "886" },
  { code: "81" },
  { code: "82" },
  { code: "65" },
  { code: "60" },
  { code: "44" },
  { code: "33" },
  { code: "49" },
  { code: "61" },
] as const;

export type PhoneCountryCallingCode = (typeof PHONE_COUNTRY_CALLING_CODES)[number]["code"];

export const DEFAULT_PHONE_COUNTRY_CODE: PhoneCountryCallingCode = "86";

const CN = /^1[3-9]\d{9}$/;
const US_CA = /^\d{10}$/;
const HK = /^\d{8}$/;
const TW = /^9\d{8}$/;
const SG = /^(8|9)\d{7}$/;

/**
 * 校验「不含国家区号」的本地号码（仅数字）。
 * 非穷举国家使用 5–15 位数字，是否可发以阿里云与运营商为准。
 */
export function isValidLocalForCountry(
  countryCode: string,
  localDigits: string,
): boolean {
  if (!/^\d+$/.test(localDigits) || localDigits.length < 5) return false;
  switch (countryCode) {
    case "86":
      return CN.test(localDigits);
    case "1":
      return US_CA.test(localDigits);
    case "852":
      return HK.test(localDigits);
    case "886":
      return TW.test(localDigits);
    case "81":
      return localDigits.length >= 10 && localDigits.length <= 11;
    case "82":
      return localDigits.length >= 9 && localDigits.length <= 11;
    case "65":
      return localDigits.length === 8 && SG.test(localDigits);
    case "60":
      return localDigits.length >= 9 && localDigits.length <= 10;
    case "44":
      return localDigits.length >= 10 && localDigits.length <= 11;
    case "33":
    case "49":
      return localDigits.length >= 9 && localDigits.length <= 11;
    case "61":
      return localDigits.length >= 9 && localDigits.length <= 10;
    default:
      return localDigits.length >= 5 && localDigits.length <= 15;
  }
}

export function isSupportedCountryCode(
  c: string,
): c is PhoneCountryCallingCode {
  return PHONE_COUNTRY_CALLING_CODES.some((x) => x.code === c);
}
