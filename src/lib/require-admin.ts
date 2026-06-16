import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/role";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function requireAdminSession(): Promise<Session & { user: { id: string; role: "admin" } }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!isAdmin(session.user.role)) {
    redirect("/dashboard");
  }
  return session as Session & { user: { id: string; role: "admin" } };
}

export function assertAdminApi(
  session: Session | null,
): session is Session & { user: { id: string; role: "admin" } } {
  if (!session?.user?.id) {
    return false;
  }
  return isAdmin(session.user.role);
}

export function adminUnauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function adminForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireAdminApi(): Promise<
  | { session: Session & { user: { id: string; role: "admin" } } }
  | { error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: adminUnauthorizedResponse() };
  }
  if (!isAdmin(session.user.role)) {
    return { error: adminForbiddenResponse() };
  }
  return { session: session as Session & { user: { id: string; role: "admin" } } };
}
