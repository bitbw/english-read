/** 设置页「学习时区」下拉：IANA 分组（value 仍为 IANA，供 API 保存） */
export const FOLLOW_BROWSER_SELECT_VALUE = "__follow_browser__";

export const LEARNING_TIMEZONE_GROUPS: { region: string; iana: readonly string[] }[] = [
  {
    region: "东亚 / 东南亚",
    iana: [
      "Asia/Shanghai",
      "Asia/Hong_Kong",
      "Asia/Taipei",
      "Asia/Tokyo",
      "Asia/Seoul",
      "Asia/Singapore",
      "Asia/Bangkok",
      "Asia/Jakarta",
      "Asia/Manila",
      "Asia/Kuala_Lumpur",
      "Asia/Ho_Chi_Minh",
    ],
  },
  {
    region: "南亚 / 西亚",
    iana: ["Asia/Kolkata", "Asia/Dubai", "Asia/Riyadh", "Asia/Tehran", "Asia/Jerusalem"],
  },
  {
    region: "欧洲 / 非洲",
    iana: [
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Madrid",
      "Europe/Rome",
      "Europe/Amsterdam",
      "Europe/Moscow",
      "Africa/Cairo",
      "Africa/Johannesburg",
      "Africa/Lagos",
    ],
  },
  {
    region: "美洲",
    iana: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Vancouver",
      "America/Toronto",
      "America/Sao_Paulo",
      "America/Mexico_City",
      "America/Buenos_Aires",
    ],
  },
  {
    region: "大洋洲",
    iana: ["Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Pacific/Auckland", "Pacific/Fiji"],
  },
  { region: "其它", iana: ["UTC", "Etc/GMT", "Atlantic/Reykjavik"] },
];

export const ALL_LEARNING_TIMEZONES: string[] = LEARNING_TIMEZONE_GROUPS.flatMap((g) => [...g.iana]);
