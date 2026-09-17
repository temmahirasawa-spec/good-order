import Link from "next/link";
import { notFound } from "next/navigation";
import { HELP_PARTS, SCOPE_LABEL, getHelpPage, getHelpPart, listHelpPages } from "@/lib/help/content";
import { renderMarkdown } from "@/components/help/HelpMarkdown";

export function generateStaticParams() {
  return HELP_PARTS.flatMap((p) => listHelpPages(p.slug).map((pg) => ({ part: p.slug, slug: pg.slug })));
}

export function generateMetadata({ params }: { params: { part: string; slug: string } }) {
  const page = getHelpPage(params.part, params.slug);
  return { title: page?.title ?? "使い方" };
}

export default function HelpArticle({ params }: { params: { part: string; slug: string } }) {
  const part = getHelpPart(params.part);
  const page = getHelpPage(params.part, params.slug);
  if (!part || !page) notFound();
  const pages = listHelpPages(part.slug);
  const idx = pages.findIndex((p) => p.slug === page.slug);
  const prev = idx > 0 ? pages[idx - 1] : null;
  const next = idx < pages.length - 1 ? pages[idx + 1] : null;
  return (
    <div className="flex flex-col md:flex-row gap-[var(--space-40)]">
      {/* 目次（PC は左に固定、SP は本文の下） */}
      <aside className="order-2 md:order-1 md:w-[240px] shrink-0">
        <div className="md:sticky md:top-[72px] flex flex-col gap-[var(--space-8)]">
          <Link href={`/help/${part.slug}`} className="type-en-label text-text-secondary">PART {part.no}　{part.title}</Link>
          <ol className="flex flex-col">
            {pages.map((pg, i) => (
              <li key={pg.slug}>
                <Link
                  href={`/help/${part.slug}/${pg.slug}`}
                  className={`flex gap-[var(--space-8)] py-[var(--space-8)] type-jp-caption ${pg.slug === page.slug ? "text-text-primary font-bold" : "text-text-secondary"}`}
                >
                  <span className="w-[16px] shrink-0">{i + 1}</span>
                  <span>{pg.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </aside>
      <article className="order-1 md:order-2 flex-1 min-w-0 flex flex-col gap-[var(--space-16)]">
        <div className="flex flex-col gap-[var(--space-8)]">
          <p className="type-en-label text-text-secondary">PART {part.no} · {idx + 1} / {pages.length}</p>
          <h1 className="type-jp-heading-l">{page.title}</h1>
          {page.summary && <p className="type-jp-body text-text-secondary leading-[1.8]">{page.summary}</p>}
          {page.scope !== "common" && (
            <span className="self-start inline-flex items-center h-[24px] px-[var(--space-8)] rounded-[var(--radius-full)] bg-accent-subtle type-jp-caption-bold">
              {SCOPE_LABEL[page.scope]}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-[var(--space-16)]">{renderMarkdown(page.body)}</div>
        <nav className="mt-[var(--space-40)] pt-[var(--space-16)] border-t border-border-divider flex justify-between gap-[var(--space-16)]">
          {prev ? <Link href={`/help/${part.slug}/${prev.slug}`} className="type-jp-caption-bold text-text-secondary">← {prev.title}</Link> : <span />}
          {next ? <Link href={`/help/${part.slug}/${next.slug}`} className="type-jp-caption-bold text-text-secondary text-right">{next.title} →</Link> : <span />}
        </nav>
      </article>
    </div>
  );
}
