import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_ROUTES, ROUTES } from "@/lib/constants";

/**
 * Optimistic check only: signed-out page visits go to /login. Real verification happens
 * in the route handlers via `requireRole()`; API routes are never redirected here.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/" || pathname.startsWith("/api/") || PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!isPublic && !request.cookies.get("cq_session")?.value) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
