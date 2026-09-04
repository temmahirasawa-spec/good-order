/**
 * Supabase / Postgres のエラーを、店舗の人が読んで**次に何をすればいいか分かる**
 * 日本語にする。
 *
 * 経緯: 管理画面のエラーは全て `alert("… " + String(err))` で出していたが、
 * Supabase が返すのはプレーンなオブジェクトなので `String()` すると
 * **`[object Object]`** になり、何が起きたのか誰にも分からなかった。
 * 2026-08-27 に店舗でカテゴリを削除しようとして発覚した。
 *
 * 原因コードが分かっているものは、原因と**回避策**まで書く。
 * 分からないものは、少なくとも message を出す（黙って潰さない）。
 */

/** Postgres のエラー形（Supabase の PostgrestError もこの形をしている） */
interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function asPgError(err: unknown): PgLikeError | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as PgLikeError;
  const looksLikePg =
    typeof e.code === "string" ||
    typeof e.message === "string" ||
    typeof e.details === "string";
  return looksLikePg ? e : null;
}

export interface DbErrorContext {
  /**
   * 23503（他のデータから参照されているので消せない）のときに差し替える説明。
   * 「なぜ消せないか」と「代わりに何をすればいいか」を必ず書くこと。
   */
  referenced?: string;
}

/**
 * エラーを日本語1本の文字列にする。alert() にそのまま渡せる。
 * 改行を含むので、UI 側で整形せずに出してよい。
 */
export function describeDbError(err: unknown, ctx: DbErrorContext = {}): string {
  const e = asPgError(err);

  if (e?.code === "23503") {
    // 外部キー違反。「消したいものが、他のデータから参照されている」
    return (
      ctx.referenced ??
      "他のデータから使われているため、削除できません。\n" +
        "先に、これを使っているデータを整理してください。"
    );
  }

  if (e?.code === "23505") {
    return (
      "同じ内容が既に登録されています。\n" +
      "重複できない項目（スラッグなど）を変えて、もう一度お試しください。"
    );
  }

  if (e?.code === "23514") {
    return (
      "入力された値が、許可されている範囲から外れています。\n" +
      "選択肢や文字数の上限を確認してください。"
    );
  }

  if (e?.code === "23502") {
    return "必須の項目が空です。入力し忘れがないか確認してください。";
  }

  if (e?.code === "42501" || e?.code === "PGRST301") {
    return (
      "この操作を行う権限がありません。\n" +
      "権限のあるアカウントでログインし直すか、マネージャーにご相談ください。"
    );
  }

  if (e?.code === "PGRST116") {
    return "対象のデータが見つかりませんでした。画面を再読み込みしてお試しください。";
  }

  // ネットワーク断（fetch の TypeError）はコードを持たない
  if (err instanceof TypeError) {
    return (
      "通信できませんでした。\n" +
      "インターネット接続を確認して、もう一度お試しください。"
    );
  }

  if (err instanceof Error && err.message) return err.message;
  if (e?.message) return e.message;

  // ここに来たら原因不明。せめて中身を出す（[object Object] にはしない）
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/* ── 削除できない理由の定型文。画面ごとに書き分けると表現がぶれるのでここに置く ── */

export const CANNOT_DELETE_ORDERED_ITEM =
  "この商品は、過去の注文で使われています。\n" +
  "売上と注文履歴が壊れてしまうため、削除できません。\n\n" +
  "販売を終える場合は、一覧の「販売中」をオフにしてください。\n" +
  "お客様のメニューから見えなくなります。";

export const CANNOT_DELETE_ORDERED_CATEGORY =
  "このカテゴリの商品が、過去の注文で使われています。\n" +
  "売上と注文履歴が壊れてしまうため、カテゴリごと削除することはできません。\n\n" +
  "お客様のメニューから隠す場合は、このカテゴリの商品をすべて\n" +
  "「販売停止」にしてください。商品が0件になったカテゴリは、\n" +
  "お客様の画面に表示されなくなります。";
