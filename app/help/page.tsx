import Link from "next/link";
import { HELP_PARTS, listHelpPages } from "@/lib/help/content";

export default function HelpIndex() {
  return (
    <div className="flex flex-col gap-[var(--space-40)]">
      <div className="flex flex-col gap-[var(--space-8)]">
        <h1 className="type-jp-heading-l">GOOD ORDER の使い方</h1>
        <p className="type-jp-body text-text-secondary leading-[1.8]">
          モバイルオーダー GOOD ORDER の、お客様・スタッフ・管理者それぞれの操作説明です。
          いまは YORKYS BRUNCH での使い方を書いています。
        </p>
      </div>
      {HELP_PARTS.map((part) => {
        const pages = listHelpPages(part.slug);
        return (
          <section key={part.slug} className="flex flex-col gap-[var(--space-12)]">
            <div>
              <p className="type-en-label text-text-secondary">PART {part.no}</p>
              <h2 className="type-jp-heading-m">
                <Link href={`/help/${part.slug}`}>{part.title}</Link>
              </h2>
              <p className="type-jp-body text-text-secondary">{part.lead}</p>
            </div>
            {pages.length === 0 ? (
              <p className="type-jp-caption text-text-secondary">準備中</p>
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
          </section>
        );
      })}
    </div>
  );
}
