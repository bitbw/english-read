import { auth } from "@/lib/auth";
import { setSentryUserFromSession } from "@/lib/sentry-user";
import { NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/library",
  "/read",
  "/vocabulary",
  "/settings",
];

export default auth((req) => {
  setSentryUserFromSession(req.auth);

  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (pathname === "/signup" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
