/** 当前时刻下该 IANA 时区相对 GMT 的展示（如 GMT+8、GMT-5），非法时区返回空串 */
export function formatTimezoneGmtOffset(iana: string, when: Date = new Date()): string {
  const tz = iana.trim();
  if (!tz) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(when);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function learningTimeZoneOptionLabel(iana: string): string {
  const off = formatTimezoneGmtOffset(iana);
  return off ? `${iana}（${off}）` : iana;
}
