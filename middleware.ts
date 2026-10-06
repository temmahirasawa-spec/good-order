import { NextResponse, type NextRequest } from "next/server";

import { siteLock } from "./lib/site-lock";

/**
 * サイト全体のパスワード（lib/site-lock.ts。2026-10-07 天真の指示で非公開に）。
 * `/api/` は通す: 厨房プリンタ（/api/print/[token]）・日報の定期実行（/api/daily-report）・管理画面の Bearer 認証の API は、
 * それぞれ自前の鍵で守っていて、Basic 認証のヘッダーを付けられない（または Authorization を別の用途で使う）ため。
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  return siteLock(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
