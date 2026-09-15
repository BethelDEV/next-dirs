import { type NextRequest, NextResponse } from "next/server";
// Routing hint only. Protected layouts, actions and APIs verify the session in D1.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedRoute =
    /^\/(dashboard|settings|submit|edit|payment|publish|admin)(\/|$)/.test(
      path,
    );
  const cookie = request.cookies
    .getAll()
    .some(({ name }) =>
      /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(name),
    );
  if (protectedRoute && !cookie) {
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("callbackUrl", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
