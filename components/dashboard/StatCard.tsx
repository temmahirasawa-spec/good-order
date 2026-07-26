"use client";

/**
 * KPIカード（Figma: Stat Card 289:267。PC 190x94 / SP 174x94 の共有コンポーネント）
 * ラベル(JP/Body Small) ＋ 数値(EN/Data/XL) ＋ 前期比。
 *
 * Figmaでは前期比が常に緑だが、実装では下振れを status/urgent にしている
 * （増減が色で分からないと数値を読み直すことになるため。既存実装の挙動も同じ）。
 */

export interface Delta {
  /** 表示文字列（"+12%" / "-2%" / "+0.2" など） */
  text: string;
  up: boolean;
}

export default function StatCard({
  label,
  value,
  delta,
  className = "",
}: {
  label: string;
  value: string;
  /** 前期比を持たない指標（店内比率・テイクアウト比率）は null */
  delta?: Delta | null;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface-white rounded-[var(--radius-lg)] flex flex-col gap-[var(--space-8)] min-w-0 px-[var(--space-20)] py-[var(--space-16)] ${className}`}
      style={{ boxShadow: "0 1px 1px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)" }}
    >
      <p className="type-jp-body-small text-text-secondary truncate">{label}</p>
      {/* 値は折り返さず、幅が足りないときだけ省略する（"¥3,776 -2%" が174pxをわずかに超えるため） */}
      <div className="flex gap-[var(--space-8)] items-baseline min-w-0 overflow-hidden">
        <p className="type-en-data-xl text-text-primary whitespace-nowrap">{value}</p>
        {delta && (
          <p
            className={`type-en-data-s whitespace-nowrap shrink-0 ${
              delta.up ? "text-status-success" : "text-status-urgent"
            }`}
          >
            {delta.text}
          </p>
        )}
      </div>
    </div>
  );
}
