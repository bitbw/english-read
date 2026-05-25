"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale, useTranslations } from "next-intl";

export function LocaleSwitcher() {
  const t = useTranslations("settings");
  const locale = useLocale();

  const switchLocale = (nextLocale: string) => {
    if (nextLocale === locale) return;
    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <Tabs value={locale} onValueChange={switchLocale}>
      <TabsList>
        <TabsTrigger value="zh">{t("chinese")}</TabsTrigger>
        <TabsTrigger value="en">{t("english")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
