import { NextRequest, NextResponse } from "next/server";

export async function middleware(_request: NextRequest) {
  // Route protection is enforced server-side in layouts/pages via requireAdmin/requireTechnician.
  // Keep middleware as a pass-through to avoid edge token decoding mismatches.
  return NextResponse.next();
}

export const config = {
  matcher: ["/inventory/:path*", "/submissions/:path*", "/admin/:path*"]
};
