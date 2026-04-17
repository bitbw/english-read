import { LoginForm } from "@/components/login-form";
import { AuthSplitShell } from "@/components/auth-split-shell";

export default function LoginPage() {
  return (
    <AuthSplitShell>
      <LoginForm />
    </AuthSplitShell>
  );
}
