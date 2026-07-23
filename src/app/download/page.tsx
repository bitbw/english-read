import type { Metadata } from "next";
import { DownloadPageClient } from "./download-client";

export const metadata: Metadata = {
  title: "Download App",
  description: "Download English Read Android App",
};

export default function DownloadPage() {
  return <DownloadPageClient />;
}