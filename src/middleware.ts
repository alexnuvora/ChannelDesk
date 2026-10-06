import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|oauth.css|api/scheduler|media/[0-9a-f-]+|oauth/|mcp(?:/|$)|.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
