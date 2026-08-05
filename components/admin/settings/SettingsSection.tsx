"use client";

/**
 * 店舗設定ページのセクション枠。
 *
 * 見た目は既存の components/dashboard/DashboardCard.tsx と同じ白カード
 * （角丸16・白背景・パディング SP20 / PC24・見出しは JP/Heading/S）。
 * 新しい見た目は作っていない。ダッシュボード専用のカードを設定画面から
 * 直接使うと役割が混ざるので、同じ寸法の薄いラッパーとして分けている。
 *
 * 今回入るセクションは「トップページ」だけだが、受注停止・営業時間など
 * 後から足せるよう、ページ側はこれを縦に並べるだけの構造にしてある。
 */
export default function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  /** 見出しの下に出す1〜2行の説明 */
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-white rounded-[var(--radius-lg)] flex flex-col gap-[var(--space-20)] min-w-0 p-[var(--space-20)] lg:px-[var(--space-24)]">
      {/* 見出しと中身の境目にヘアラインを引く（Figma 1103:24024 の各カード）。
          カードが縦に長いので、どこまでが見出しかが分からないと読み始めの位置を見失う */}
      <div className="border-b border-border-divider flex flex-col gap-[var(--space-4)] pb-[var(--space-12)] w-full">
        <h2 className="type-jp-heading-s text-text-primary">{title}</h2>
        {description && (
          <p className="type-jp-caption text-text-secondary">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
