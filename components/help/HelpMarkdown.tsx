/**
 * マニュアル用の小さな Markdown 表示（外部ライブラリなし）。
 * components/ に置くのは、Tailwind がクラス名を拾うのが app/ と components/ だけのため（lib/ だと装飾が効かない）。
 *
 * 対応しているのは、マニュアルを書くのに要る分だけ:
 *   ## 見出し / ### 小見出し / 段落 / - 箇条書き / 1. 番号つき / > 注意書き
 *   ![説明](画像) / **太字** / [文字](リンク)
 *   段落の先頭の [YORKYS] [店ごと] → 印（バッジ）
 * 表・コードブロックなどは要るようになったら足す。
 */
import type { ReactNode } from "react";
import { SCOPE_LABEL, type HelpScope } from "@/lib/help/content";

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = key;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++} className="font-bold text-text-primary">{m[1].slice(2, -2)}</strong>);
    else if (m[2]) {
      const mm = m[2].match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={i++} href={mm[2]} className="underline text-accent-primary">{mm[1]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ScopeBadge({ scope }: { scope: HelpScope }) {
  const cls = scope === "yorkys" ? "bg-accent-subtle text-text-primary" : "bg-bg-tertiary text-text-secondary";
  return (
    <span className={`inline-flex items-center h-[20px] px-[var(--space-8)] rounded-[var(--radius-full)] type-jp-caption-bold ${cls} mr-[var(--space-8)] align-middle`}>
      {SCOPE_LABEL[scope]}
    </span>
  );
}

function paragraph(text: string, key: number): ReactNode {
  let scope: HelpScope | null = null;
  let t = text;
  if (t.startsWith("[YORKYS]")) { scope = "yorkys"; t = t.slice(8).trim(); }
  else if (t.startsWith("[店ごと]")) { scope = "store"; t = t.slice(5).trim(); }
  return (
    <p key={key} className="type-jp-body text-text-primary leading-[1.8]">
      {scope && <ScopeBadge scope={scope} />}
      {inline(t)}
    </p>
  );
}

export function renderMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }
    if (line.startsWith("### ")) { out.push(<h3 key={key++} className="type-jp-heading-s text-text-primary mt-[var(--space-24)]">{inline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith("## ")) { out.push(<h2 key={key++} className="type-jp-heading-m text-text-primary mt-[var(--space-40)] pt-[var(--space-16)] border-t border-border-divider">{inline(line.slice(3))}</h2>); i++; continue; }
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      out.push(
        <figure key={key++} className="my-[var(--space-16)] flex flex-col items-center gap-[var(--space-8)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img[2]} alt={img[1]} loading="lazy" className="w-full max-w-[360px] rounded-[var(--radius-md)] border border-border-divider shadow-[var(--shadow-card)]" />
          {img[1] && <figcaption className="type-jp-caption text-text-secondary text-center">{img[1]}</figcaption>}
        </figure>
      );
      i++; continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { buf.push(lines[i].slice(2)); i++; }
      out.push(
        <div key={key++} className="my-[var(--space-16)] p-[var(--space-16)] rounded-[var(--radius-md)] bg-accent-subtle flex flex-col gap-[var(--space-8)]">
          {buf.map((b, j) => <p key={j} className="type-jp-body text-text-primary leading-[1.8]">{inline(b)}</p>)}
        </div>
      );
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      out.push(<ul key={key++} className="list-disc pl-[var(--space-24)] flex flex-col gap-[var(--space-8)]">{items.map((t, j) => <li key={j} className="type-jp-body text-text-primary leading-[1.8]">{inline(t)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
      out.push(<ol key={key++} className="list-decimal pl-[var(--space-24)] flex flex-col gap-[var(--space-8)]">{items.map((t, j) => <li key={j} className="type-jp-body text-text-primary leading-[1.8]">{inline(t)}</li>)}</ol>);
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{2,3} |- |\d+\. |> |!\[)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(paragraph(buf.join(""), key++));
  }
  return out;
}
