/**
 * 使い方マニュアル（/help）の中身。
 *
 * 文章は `content/help/<part>/<slug>.md` の Markdown。ビルド時にこのファイルが読んで
 * ページにする（サーバー側だけで動く。ブラウザには HTML だけ届く）。
 *
 * 製品化のための印（frontmatter の scope）:
 *   common … どの店でも使う
 *   store  … 使う店と使わない店がある設定
 *   yorkys … YORKYS BRUNCH だけ。製品版に載せるか未定
 * 段落の先頭に [YORKYS] / [店ごと] と書いても、その段落だけに印が付く（components/help/HelpMarkdown.tsx）。
 *
 * 2026-09-18、天真の決定: 3部構成（お客様 / 当日の運用 / 設定）、公開ページ、第1部から書く。
 */
import fs from "fs";
import path from "path";

export type HelpScope = "common" | "store" | "yorkys";

export interface HelpPart {
  slug: string;
  no: number;
  title: string;
  lead: string;
}

export const HELP_PARTS: HelpPart[] = [
  { slug: "customer", no: 1, title: "お客様はこう注文する", lead: "スタッフが「聞かれたら答えられる」ための、お客様の画面の流れ" },
  { slug: "staff",    no: 2, title: "当日の運用（スタッフ用）", lead: "厨房・レジ・ホールの画面の見方と、困ったときの対処" },
  { slug: "admin",    no: 3, title: "設定（管理者用）", lead: "管理画面の各機能が何のためにあり、どう設定すると何が変わるか" },
];

export interface HelpPage {
  part: string;
  slug: string;
  order: number;
  title: string;
  summary: string;
  scope: HelpScope;
  body: string;
}

const ROOT = path.join(process.cwd(), "content", "help");

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return { meta, body: raw.slice(m[0].length) };
}

export function listHelpPages(part: string): HelpPage[] {
  const dir = path.join(ROOT, part);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
      const scope = (["common", "store", "yorkys"].includes(meta.scope) ? meta.scope : "common") as HelpScope;
      return {
        part,
        slug: f.replace(/\.md$/, ""),
        order: Number(meta.order ?? 999),
        title: meta.title ?? f,
        summary: meta.summary ?? "",
        scope,
        body,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function getHelpPage(part: string, slug: string): HelpPage | null {
  return listHelpPages(part).find((p) => p.slug === slug) ?? null;
}

export function getHelpPart(slug: string): HelpPart | null {
  return HELP_PARTS.find((p) => p.slug === slug) ?? null;
}

export const SCOPE_LABEL: Record<HelpScope, string> = {
  common: "共通",
  store: "店ごとの設定",
  yorkys: "YORKYS だけ",
};
