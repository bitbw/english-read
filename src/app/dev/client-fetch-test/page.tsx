import { notFound } from "next/navigation";
import { ClientFetchTestClient } from "./client-fetch-test-client";

export default function ClientFetchTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <ClientFetchTestClient />;
}
