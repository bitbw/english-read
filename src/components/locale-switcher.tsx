"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function LocaleSwitcher() {
  const t = useTranslations("settings");

  const switchLocale = (locale: string) => {
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => switchLocale("zh")}>
        {t("chinese")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => switchLocale("en")}>
        {t("english")}
      </Button>
    </div>
  );
}
