import { Suspense } from "react";
import { MobileOAuthRedirect } from "@/components/mobile-oauth-redirect";

export default function MobileOAuthRedirectPage() {
  return (
    <Suspense fallback={null}>
      <MobileOAuthRedirect />
    </Suspense>
  );
}