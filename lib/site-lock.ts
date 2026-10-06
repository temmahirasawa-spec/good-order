import { NextResponse, type NextRequest } from "next/server";

/**
 * サイト全体のパスワード（Basic 認証）。2026-10-07 天真の指示「アプリと LP を非公開に。パスワードが無いと入れないように」。
 *
 * - パスワードは Vercel の環境変数 `SITE_PASSWORD`（コードには書かない）。**未設定なら何もしない**（ローカル開発・外すとき）
 * - ユーザー名は問わない（空欄でもよい）。パスワードだけを見る
 * - 外す（公開する）ときは、Vercel の `SITE_PASSWORD` を消して再デプロイするだけでよい
 *
 * 返り値: 通してよいなら null、だめなら 401（ブラウザがパスワードの入力欄を出す）
 */
export function siteLock(request: NextRequest): NextResponse | null {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6).trim());
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (sameText(given, password)) return null;
    } catch {
      // 壊れたヘッダーは「パスワード違い」と同じ扱い
    }
  }
  return new NextResponse("このサイトは現在非公開です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="UTUTU", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** 長さと中身を、途中で抜けずに比べる（文字ごとの比較時間から推測されないように） */
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
