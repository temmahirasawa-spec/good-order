"use client";

/**
 * テーブル・二次元コード管理（Step3-O）
 * Figma: PC Template/二次元コード管理 529:2959 / SP 二次元コード管理 — Mobile 390 529:6939
 *
 * 表記は一貫して「二次元コード」。QRコードは株式会社デンソーウェーブの登録商標のため、
 * 画面に出る文字列に「QR」を含めない（コード内部の識別子は qr のままで構わない）。
 *
 * 二次元コードのURLには不変の short_code を埋める（`?t=k3f9x2`）。
 * ラベル（?table=A1）を埋めると、カテゴリーのコードを変えた瞬間に印刷済みカードが
 * 全部無効になり、しかも画面にはエラーが出ないためお客様が読み取って初めて気づく。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import QrCard from "@/components/admin/tables/QrCard";
import SeatSettingsModal from "@/components/admin/tables/SeatSettingsModal";
import { tableOrderUrl } from "@/lib/qrCode";
import {
  deleteTable,
  fetchTableGroups,
  saveTableLayout,
  tableShortLabel,
  type LayoutCategoryInput,
  type TableGroup,
} from "@/lib/tables";

/** テイクアウトのカードは卓ではないので、選択集合の中では固定のキーで扱う */
const TAKEOUT_KEY = "__takeout__";

/** Supabaseのエラーはプレーンなオブジェクトなので String() すると [object Object] になる */
function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const err = e as { message?: string; hint?: string; code?: string };
    // PostgREST は未作成テーブルを "Could not find the table ... in the schema cache" と返す
    const msg = err.message ?? "";
    if (err.code === "42P01" || err.code === "PGRST205" || /does not exist|Could not find the (table|function)/i.test(msg)) {
      return "テーブル・二次元コードのDBがまだ作成されていません（supabase/tables_qr.sql を実行してください）";
    }
    if (err.message) return err.message;
  }
  return "不明なエラーが発生しました";
}

export default function AdminTablesPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<TableGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState("");

  // 二次元コードに埋めるURLは、いま管理画面を開いているホストを基準にする
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await fetchTableGroups();
      setGroups(g);
      // 既定は全選択（Figmaの「13件すべて選択中」の状態）
      setSelected(new Set([TAKEOUT_KEY, ...g.flatMap((x) => x.tables.map((t) => t.id))]));
    } catch (e) {
      console.error("[tables] load failed:", e);
      // 卓が読めなくてもテイクアウトの二次元コードは出せるので、空リストで続行する
      setGroups([]);
      setSelected(new Set([TAKEOUT_KEY]));
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const allKeys = useMemo(
    () => [TAKEOUT_KEY, ...(groups ?? []).flatMap((g) => g.tables.map((t) => t.id))],
    [groups]
  );
  const selectedCount = allKeys.filter((k) => selected.has(k)).length;

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleSaveLayout = async (payload: LayoutCategoryInput[]) => {
    await saveTableLayout(payload);
    await load();
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!groups) return;
    try {
      await deleteTable(groups, tableId);
      await load();
    } catch (e) {
      console.error("[tables] delete failed:", e);
      setError(`卓の削除に失敗しました：${errorMessage(e)}`);
    }
  };

  /* 印刷ビューは別ルート。管理画面のシェルは h-screen + overflow-hidden なので、
     同じDOMに @media print を被せるとページ送りが効かない。
     選択した卓は short_code をクエリで渡す（URLに載っても店頭の掲示物と同じ情報） */
  const openPrint = () => {
    if (!groups) return;
    const codes: string[] = [];
    if (selected.has(TAKEOUT_KEY)) codes.push(TAKEOUT_KEY);
    for (const g of groups) {
      for (const t of g.tables) if (selected.has(t.id)) codes.push(t.short_code);
    }
    if (codes.length === 0) return;
    router.push(`/admin/tables/print?codes=${encodeURIComponent(codes.join(","))}`);
  };

  const printLabel = `選択した${selectedCount}件を印刷`;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="二次元コード管理"
            onMenuClick={openDrawer}
            action={
              <>
                <button
                  type="button"
                  onClick={openPrint}
                  disabled={selectedCount === 0}
                  className="hidden lg:flex bg-surface-ink items-center justify-center rounded-[var(--radius-full)] px-[var(--space-20)] py-[10px] type-jp-heading-s text-text-inverse whitespace-nowrap disabled:opacity-40"
                >
                  {printLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="席カテゴリの設定・テーブルの追加"
                  className="lg:hidden flex bg-accent-primary items-center justify-center rounded-full w-[44px] h-[44px] shrink-0"
                >
                  <span className="font-jp font-bold text-[20px] leading-none text-text-primary">＋</span>
                </button>
              </>
            }
          />

          {/* ── Sub Bar（PCのみ） ── */}
          <div className="hidden lg:flex shrink-0 bg-surface-white border-b border-border-divider items-center justify-between gap-[var(--space-16)] px-[var(--space-32)] py-[var(--space-8)]">
            <p className="type-jp-caption text-text-secondary">
              {selectedCount > 0
                ? `${selectedCount}件選択中 ・ 名刺サイズ10面/A4 で印刷されます`
                : "印刷する二次元コードを選んでください"}
            </p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="bg-bg-tertiary flex items-center rounded-[var(--radius-full)] px-[var(--space-16)] py-[9px] type-jp-body text-text-primary whitespace-nowrap shrink-0"
            >
              席カテゴリの設定・テーブルの追加
            </button>
          </div>

          <main className="flex-1 overflow-y-auto bg-bg-tertiary lg:bg-bg-secondary">
            {/* SPは＋ボタンからの導線が分かりにくいので、上部に一言置く（Figma SPにも同じ文言がある） */}
            <p className="lg:hidden px-[var(--space-16)] pt-[var(--space-16)] type-jp-caption text-text-secondary leading-[1.6]">
              ＋ から席カテゴリの設定・テーブルの追加ができます。選択した二次元コードは名刺サイズ10面/A4で印刷できます。
            </p>

            <div className="flex flex-col gap-[var(--space-32)] px-[var(--space-16)] lg:px-[var(--space-32)] pt-[var(--space-16)] lg:pt-[var(--space-20)] pb-[120px] lg:pb-[var(--space-32)]">
              {error && (
                <div className="bg-status-urgent-subtle rounded-[var(--radius-lg)] px-[var(--space-20)] py-[var(--space-16)] type-jp-body text-status-urgent">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-[var(--space-80)]">
                  <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin" />
                </div>
              ) : (
                <>
                  {/* テイクアウトは卓ではないので最上部に1件だけ。パラメータなしのURL */}
                  <Group title="テイクアウト" count="1件">
                    <QrCard
                      accent
                      label="テイクアウト"
                      url={tableOrderUrl(origin, null)}
                      selected={selected.has(TAKEOUT_KEY)}
                      onToggleSelected={() => toggle(TAKEOUT_KEY)}
                    />
                  </Group>

                  {(groups ?? []).map((g, gi) => (
                    <Group
                      key={g.category.id}
                      title={`${g.category.code} ・ ${g.category.name}`}
                      count={`${g.tables.length}卓`}
                    >
                      {g.tables.map((t) => (
                        <QrCard
                          key={t.id}
                          label={tableShortLabel(g.category.code, t.number)}
                          url={tableOrderUrl(origin, t.short_code)}
                          selected={selected.has(t.id)}
                          onToggleSelected={() => toggle(t.id)}
                          onDelete={() => void handleDeleteTable(t.id)}
                        />
                      ))}
                      {/* 追加導線は最後のグループの末尾にだけ置く（Figmaと同じ） */}
                      {gi === (groups ?? []).length - 1 && (
                        <AddTableCard onClick={() => setSettingsOpen(true)} />
                      )}
                    </Group>
                  ))}

                  {(groups ?? []).length === 0 && (
                    <Group title="席カテゴリー" count="0件">
                      <AddTableCard onClick={() => setSettingsOpen(true)} />
                    </Group>
                  )}
                </>
              )}
            </div>
          </main>

          {/* SPは固定フッターに印刷ボタン（Figma SP） */}
          <div className="lg:hidden shrink-0 bg-surface-white border-t border-border-divider px-[var(--space-16)] py-[var(--space-12)] safe-bottom">
            <button
              type="button"
              onClick={openPrint}
              disabled={selectedCount === 0}
              className="bg-surface-ink flex items-center justify-center rounded-[var(--radius-full)] h-[52px] w-full type-jp-heading-s text-text-inverse disabled:opacity-40"
            >
              {printLabel}
            </button>
          </div>

          <SeatSettingsModal
            open={settingsOpen}
            groups={groups ?? []}
            onClose={() => setSettingsOpen(false)}
            onSave={handleSaveLayout}
          />
        </>
      )}
    </AdminPageShell>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[14px] w-full">
      <div className="flex gap-[10px] items-center">
        <h2 className="type-jp-heading-s text-text-primary">{title}</h2>
        <p className="type-jp-caption text-text-secondary">{count}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-[var(--space-16)] items-start">
        {children}
      </div>
    </section>
  );
}

function AddTableCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-border border-dashed rounded-[var(--radius-lg)] flex flex-col gap-[var(--space-8)] items-center justify-center w-full min-h-[88px] lg:min-h-[256px] py-[var(--space-24)]"
    >
      <span className="font-jp font-bold text-[20px] leading-none text-text-secondary">＋</span>
      <span className="type-jp-body text-text-secondary">テーブルを追加</span>
    </button>
  );
}
