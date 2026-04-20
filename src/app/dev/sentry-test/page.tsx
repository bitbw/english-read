import { notFound } from "next/navigation";
import { SentryTestClient } from "./sentry-test-client";

export default function SentryTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <SentryTestClient />;
}
