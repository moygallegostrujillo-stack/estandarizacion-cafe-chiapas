import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isAuth = !!req.auth;
  const isLoginPage = path.startsWith("/auth/login");

  // Public pages
  if (path === "/" && !isAuth) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Redirect to login if not authenticated and not already there
  if (!isAuth && !isLoginPage) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Redirect to dashboard if already logged in and on login page
  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL("/inicio", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
