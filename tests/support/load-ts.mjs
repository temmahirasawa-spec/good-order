/**
 * テストから lib/*.ts を読み込む入口。
 * 解決フック（ts-hooks.mjs）は「このあと読み込むモジュール」にだけ効くので、
 * TS のモジュールは必ず importLib()（動的 import）で読むこと。
 */
import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);

// lib/supabase.ts はモジュールの先頭で createClient() を呼ぶ。URL の形を見るだけで通信はしないので
// ダミーで足りる（.github/workflows/check.yml のビルドと同じ考え方）。テストは本番に一切つながない。
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-anon-key-for-tests";

/** リポジトリ直下からの相対パスで TS のモジュールを読む（例: "lib/tax.ts"） */
export function importLib(relPath) {
  return import(new URL(`../../${relPath}`, import.meta.url).href);
}
