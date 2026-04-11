import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const isAuthenticated = Boolean(token?.id);
  const role = token?.role as string | undefined;
  const pathname = request.nextUrl.pathname;

  const isAdminRoute = pathname.startsWith("/admin");
  const isTechnicianRoute = pathname.startsWith("/inventory") || pathname.startsWith("/submissions");

  if (!isAuthenticated && (isAdminRoute || isTechnicianRoute)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/inventory", request.url));
  }

  if (isTechnicianRoute && role === "ADMIN") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/inventory/:path*", "/submissions/:path*", "/admin/:path*"]
};
