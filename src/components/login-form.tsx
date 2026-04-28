"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ClipboardEvent,
  type SubmitEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  PHONE_COUNTRY_CALLING_CODES,
  isSupportedCountryCode,
  isValidLocalForCountry,
} from "@/lib/phone-countries";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";

type LoginFormProps = {
  className?: string;
};

type OAuthProvider = "google" | "github";

const SMS_CODE_LEN = { min: 4, max: 8 } as const;

/**
 * 从整段剪贴/短信文字中提取 4～8 位连续数字，符合本页验证码与阿里云常见长度。
 */
function parseSmsOtpFromString(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (new RegExp(`^\\d{${SMS_CODE_LEN.min},${SMS_CODE_LEN.max}}$`).test(t)) {
    return t;
  }
  const compact = t.replace(/\D/g, "");
  if (
    compact.length >= SMS_CODE_LEN.min &&
    compact.length <= SMS_CODE_LEN.max
  ) {
    return compact;
  }
  const m = t.match(new RegExp(`\\d{${SMS_CODE_LEN.min},${SMS_CODE_LEN.max}}`));
  if (m) return m[0] ?? null;
  return null;
}

function setInputValueAndNotify(input: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  );
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function LoginForm({ className }: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [phoneLoginPending, setPhoneLoginPending] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [countryCode, setCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);
  const phoneBusy = sendingCode || phoneLoginPending;
  const busy = pending || oauthPending !== null || phoneBusy;

  const tryFillCodeFromClipboard = useCallback(() => {
    const el = document.getElementById("login-sms-code") as HTMLInputElement | null;
    if (!el || el.disabled) return;
    if (el.value.trim() !== "") return;
    if (!navigator.clipboard?.readText) return;
    void navigator.clipboard.readText().then(
      (text) => {
        const o = parseSmsOtpFromString(text);
        if (o) setInputValueAndNotify(el, o);
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const id = setTimeout(() => setCodeCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [codeCooldown]);

  async function signInWithOAuth(provider: OAuthProvider) {
    setOauthPending(provider);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setOauthPending(null);
    }
  }

  async function onSendCode() {
    setPhoneError(null);
    const el = document.getElementById("login-phone") as HTMLInputElement | null;
    const raw = el?.value?.trim() ?? "";
    const digits = raw.replace(/\D/g, "");
    if (!isValidLocalForCountry(countryCode, digits)) {
      setPhoneError(t("invalidPhone"));
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, phone: digits }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setPhoneError(data.message ?? t("loginFailed"));
        return;
      }
      setCodeCooldown(60);
      requestAnimationFrame(() => {
        const el = document.getElementById("login-sms-code") as HTMLInputElement | null;
        el?.focus();
        tryFillCodeFromClipboard();
      });
    } catch {
      setPhoneError(t("loginFailed"));
    } finally {
      setSendingCode(false);
    }
  }

  async function onPhoneSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhoneError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const cc = String(fd.get("countryCode") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").replace(/\D/g, "");
    const code = String(fd.get("code") ?? "").trim();
    if (
      !isSupportedCountryCode(cc) ||
      !isValidLocalForCountry(cc, phone) ||
      !code
    ) {
      setPhoneError(t("fillPhoneCode"));
      return;
    }
    setPhoneLoginPending(true);
    try {
      const res = await signIn("phone-otp", {
        countryCode: cc,
        phone,
        code,
        redirect: false,
      });
      if (res?.error) {
        setPhoneError(t("phoneOrCodeError"));
        return;
      }
      if (res?.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setPhoneError(t("loginFailed"));
    } finally {
      setPhoneLoginPending(false);
    }
  }

  async function onCredentialsSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      setError(t("fillEmailPassword"));
      return;
    }
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(t("emailOrPasswordError"));
        return;
      }
      if (res?.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setError(t("loginFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("login")}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {t("loginSubtitle")}
          </p>
        </div>
        <Tabs
          defaultValue="phone"
          className="w-full gap-4"
          onValueChange={() => {
            setError(null);
            setPhoneError(null);
          }}
        >
          <TabsList
            className="w-full min-w-0 grid h-auto min-h-8 grid-cols-2 gap-0.5 p-0.5 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:min-h-8 group-data-horizontal/tabs:items-stretch"
          >
            <TabsTrigger value="phone" className="min-w-0 flex-1 self-stretch px-2 py-1.5">
              {t("phone")}
            </TabsTrigger>
            <TabsTrigger value="email" className="min-w-0 flex-1 self-stretch px-2 py-1.5">
              {t("email")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="phone" className="mt-0">
            <form className="flex flex-col gap-4" onSubmit={onPhoneSubmit}>
              <input type="hidden" name="countryCode" value={countryCode} />
              <Field>
                <FieldLabel htmlFor="login-phone">{t("phone")}</FieldLabel>
                <div className="flex min-w-0 gap-2">
                  <Select
                    value={countryCode}
                    onValueChange={(v) => {
                      if (typeof v === "string" && isSupportedCountryCode(v)) {
                        setCountryCode(v);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="login-country-code"
                      size="default"
                      className="h-9 w-18 shrink-0 font-mono text-sm sm:w-20"
                      aria-label={
                        isSupportedCountryCode(countryCode)
                          ? t(`phoneCountry.${countryCode}`)
                          : t(`phoneCountry.${DEFAULT_PHONE_COUNTRY_CODE}`)
                      }
                    >
                      <SelectValue>
                        {(val: string | null) => `+${val ?? DEFAULT_PHONE_COUNTRY_CODE}`}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      alignItemWithTrigger={false}
                      className="min-w-[min(100vw-2rem,20rem)] max-w-[min(100vw-2rem,20rem)]"
                    >
                      <SelectGroup>
                        {PHONE_COUNTRY_CALLING_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {t(`phoneCountry.${c.code}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    id="login-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder={t("phonePlaceholder")}
                    maxLength={15}
                    disabled={busy}
                    className="min-w-0 flex-1"
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="login-sms-code">{t("verificationCode")}</FieldLabel>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id="login-sms-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t("codePlaceholder")}
                    maxLength={8}
                    disabled={busy}
                    className="min-w-0 flex-1"
                    onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
                      const text = e.clipboardData.getData("text/plain");
                      const o = parseSmsOtpFromString(text);
                      if (o) {
                        e.preventDefault();
                        setInputValueAndNotify(e.currentTarget, o);
                      }
                    }}
                    onFocus={() => {
                      tryFillCodeFromClipboard();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0"
                    disabled={busy || codeCooldown > 0}
                    onClick={() => void onSendCode()}
                  >
                    {sendingCode ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : codeCooldown > 0 ? (
                      t("resendIn", { seconds: codeCooldown })
                    ) : (
                      t("sendCode")
                    )}
                  </Button>
                </div>
              </Field>
              {phoneError ? (
                <p className="text-sm text-destructive" role="alert">
                  {phoneError}
                </p>
              ) : null}
              <Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  {phoneLoginPending ? t("phoneLoginPending") : t("phoneLogin")}
                </Button>
              </Field>
            </form>
          </TabsContent>
          <TabsContent value="email" className="mt-0">
            <form className="flex flex-col gap-4" onSubmit={onCredentialsSubmit}>
              <Field>
                <FieldLabel htmlFor="login-email">{t("email")}</FieldLabel>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  required
                  disabled={busy}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
                <PasswordInput
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
              </Field>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  {pending ? t("loggingIn") : t("loginButton")}
                </Button>
              </Field>
            </form>
          </TabsContent>
        </Tabs>
        <FieldSeparator>{t("or")}</FieldSeparator>
        <Field className="gap-3">
          <Button
            variant="outline"
            type="button"
            className="w-full"
            disabled={busy}
            onClick={() => void signInWithOAuth("google")}
          >
            {oauthPending === "google" ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {oauthPending === "google" ? t("redirecting") : t("loginWithGoogle")}
          </Button>
          <Button
            variant="outline"
            type="button"
            className="w-full"
            disabled={busy}
            onClick={() => void signInWithOAuth("github")}
          >
            {oauthPending === "github" ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <svg
                className="mr-2 h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            )}
            {oauthPending === "github" ? t("redirecting") : t("loginWithGithub")}
          </Button>
          <FieldDescription className="text-center">
            {t("noAccount")}{" "}
            <Link
              href="/signup"
              className="underline underline-offset-4 text-foreground"
            >
              {t("signup")}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  );
}
