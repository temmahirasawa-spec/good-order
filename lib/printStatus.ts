/**
 * 管理画面「印刷状況」の表示ロジック。
 *
 * 画面（app/admin/(protected)/print/page.tsx）とギャラリー（/dev/ui）の
 * 両方から使うので、判定はここに集約する。
 */

/** print_jobs.status と同じ */
export type PrintJobStatus = "pending" | "printing" | "done" | "failed";

export interface PrintJobRow {
  id: string;
  status: PrintJobStatus;
  seq: number;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  /** 注文側のスナップショット */
  tableLabel: string | null;
  pickupNo: number | null;
  orderType: "dine_in" | "takeout";
}

export interface PrinterStatusRow {
  lastSeenAt: string | null;
  lastStatusAt: string | null;
  statusNote: string | null;
}

/**
 * プリンタが生きていないと判断するまでの猶予。
 *
 * プリンタ側の問い合わせ間隔は3秒想定、生存記録の書き込みは15秒に間引いている
 * （supabase/printer_status.sql）。その両方を吸収してなお「止まった」と
 * 言い切れる長さとして60秒を取っている。短くすると健全なのに赤くなる。
 */
export const PRINTER_OFFLINE_AFTER_MS = 60_000;

export type PrinterHealth = "ok" | "warning" | "offline" | "unknown";

export interface PrinterHealthView {
  health: PrinterHealth;
  /** 見出しに出す一言 */
  headline: string;
  /** その下に出す補足。原因と、やることを書く */
  detail: string;
}

/** 「3分前」のような相対表記。60秒未満は「たった今」 */
export function formatSince(iso: string | null, now: number): string {
  if (!iso) return "—";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.floor(hour / 24)}日前`;
}

/**
 * プリンタの状態をひとことにまとめる。
 *
 * 優先順位は「つながっているか」→「困りごとがあるか」。
 * 通信が切れていれば紙の有無は分からないので、そちらを先に出す。
 */
export function describePrinterHealth(
  printer: PrinterStatusRow | null,
  now: number
): PrinterHealthView {
  if (!printer || !printer.lastSeenAt) {
    return {
      health: "unknown",
      headline: "まだ一度もつながっていません",
      detail:
        "プリンタの設定画面にサーバーのURLを登録すると、ここに接続状況が出ます。設定がまだの場合は手順書を確認してください。",
    };
  }

  const since = now - new Date(printer.lastSeenAt).getTime();
  if (since > PRINTER_OFFLINE_AFTER_MS) {
    return {
      health: "offline",
      headline: "プリンタが応答していません",
      detail: `最後の応答は${formatSince(printer.lastSeenAt, now)}です。電源とWi-Fiを確認してください。復旧すれば、たまっている伝票は自動で印刷されます。`,
    };
  }

  if (printer.statusNote) {
    return {
      health: "warning",
      headline: printer.statusNote,
      detail:
        "プリンタとはつながっていますが、このままでは印刷できません。解消すると、たまっている伝票は自動で印刷されます。",
    };
  }

  return {
    health: "ok",
    headline: "正常に動いています",
    detail: `最後の応答は${formatSince(printer.lastSeenAt, now)}です。`,
  };
}

/** 伝票1枚の識別子。店内は卓、テイクアウトは受渡番号（伝票の刷り分けと同じ規則） */
export function jobIdentity(job: PrintJobRow): string {
  if (job.orderType === "takeout" || !job.tableLabel) {
    return `受渡番号 #${String(job.pickupNo ?? 0).padStart(2, "0")}`;
  }
  return job.tableLabel;
}

/** 「新規」「追加(2)」。伝票に刷る文言と揃える */
export function jobSeqLabel(seq: number): string {
  return seq <= 1 ? "新規" : `追加(${seq})`;
}
