/**
 * テストから lib/*.ts をそのまま import するための解決フック（node:module の register で登録する）。
 *
 * TypeScript の型は Node の型ストリップ（Node 22.18 以降は既定で有効）が外す。
 * ここでするのは、アプリのコードが使っている書き方を Node が解決できる形に直すことだけ:
 *   - 拡張子なしの相対 import（"./supabase"）→ "./supabase.ts"
 *   - "@/lib/siteConfig" のような別名 → リポジトリ直下からの "lib/siteConfig.ts"
 * 対象はリポジトリ内のファイルだけ。node_modules の解決には手を出さない。
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function findFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, "index" + ext);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let candidate = null;
  if (specifier.startsWith("@/")) {
    candidate = path.join(ROOT, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:") &&
    !path.extname(specifier)
  ) {
    candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (candidate) {
    const file = findFile(candidate);
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
