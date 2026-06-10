import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware — runs on every matched route before rendering.
 * Handles: authentication guards, session validation, redirects.
 */
export async function middleware(request: NextRequest) {
  // TODO: Implement session validation using Supabase SSR client
  // const session = await getServerSession(request)
  // if (!session) return NextResponse.redirect(new URL("/login", request.url))

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
};
