import Link from "next/link";
import { notFound } from "next/navigation";
import { HELP_PARTS, getHelpPart, listHelpPages } from "@/lib/help/content";

export function generateStaticParams() {
  return HELP_PARTS.map((p) => ({ part: p.slug }));
}

export default function HelpPartPage({ params }: { params: { part: string } }) {
  const part = getHelpPart(params.part);
  if (!part) notFound();
  const pages = listHelpPages(part.slug);
  return (
    <div className="flex flex-col gap-[var(--space-24)]">
      <div>
        <p className="type-en-label text-text-secondary">PART {part.no}</p>
        <h1 className="type-jp-heading-l">{part.title}</h1>
        <p className="type-jp-body text-text-secondary">{part.lead}</p>
      </div>
      {pages.length === 0 ? (
        <p className="type-jp-body text-text-secondary">準備中です。</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border-divider bg-surface-white rounded-[var(--radius-md)] border border-border-divider">
          {pages.map((pg, i) => (
            <li key={pg.slug}>
              <Link href={`/help/${part.slug}/${pg.slug}`} className="flex gap-[var(--space-12)] items-baseline px-[var(--space-16)] py-[var(--space-12)]">
                <span className="type-en-data-s text-text-secondary w-[20px] shrink-0">{i + 1}</span>
                <span className="flex flex-col gap-[var(--space-2)]">
                  <span className="type-jp-body-bold">{pg.title}</span>
                  {pg.summary && <span className="type-jp-caption text-text-secondary">{pg.summary}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
