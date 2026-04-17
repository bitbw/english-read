import { SignupForm } from "@/components/signup-form";
import { AuthSplitShell } from "@/components/auth-split-shell";

export default function SignupPage() {
  return (
    <AuthSplitShell>
      <SignupForm />
    </AuthSplitShell>
  );
}
