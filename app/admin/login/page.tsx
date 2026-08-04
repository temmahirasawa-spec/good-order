"use client";

/**
 * スタッフ管理画面のログイン。
 *
 * 見た目だけを現行の管理画面のトンマナに合わせ直したもの。新しい見た目は作っていない。
 * 借りている作法は以下のとおり:
 *   - カード枠      … components/admin/settings/SettingsSection.tsx と同じ
 *                     （白面・角丸16・SP20 / PC24 パディング・見出しは JP/Heading/S）
 *   - フォーム項目  … app/admin/(protected)/menu/categories/page.tsx の編集パネルと同じ
 *                     （ラベル JP/Caption Bold ＋ 高さ44・角丸8・border-border の入力）
 *   - 主ボタン      … app/admin/(protected)/tables/page.tsx の全幅ボタンと同じ
 *                     （墨面・角丸full・JP/Heading/S・反転文字）
 *   - エラー枠      … components/admin/settings/VideoSlotField.tsx と同じ
 *                     （status-urgent-subtle の面に status-urgent の文字）
 *   - 読み込み中    … 管理画面共通のスピナー（border-2 の円を回す）
 *
 * 認証処理（handleLogin）は一切変更していない。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authErr) {
        // Supabase のエラーメッセージを日本語で表示
        const msg = authErr.message ?? "";
        if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
          setError("メールアドレスまたはパスワードが正しくありません");
        } else if (msg.includes("Email not confirmed")) {
          setError("メールアドレスの確認が完了していません。確認メールをご確認ください。");
        } else {
          setError(`ログインできませんでした: ${msg}`);
        }
        return;
      }
      if (!data.session) {
        setError("セッションの取得に失敗しました。もう一度お試しください。");
        return;
      }
      router.replace("/admin/kitchen");
    } catch (err) {
      console.error("Login exception:", err);
      setError("ネットワークエラーが発生しました。接続を確認してもう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  /* 入力欄は管理画面のフォームと同一。focus のリングは足していない
     （管理画面の他の入力欄と同じくブラウザ標準の表示に任せる） */
  const inputClass =
    "w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary disabled:opacity-60";

  return (
    <div className="min-h-screen bg-bg-secondary flex flex-col items-center justify-center gap-[var(--space-24)] px-[var(--space-20)] py-[var(--space-40)]">
      {/* ブランド。文言は従来のまま */}
      <div className="flex flex-col items-center gap-[var(--space-4)]">
        <p className="type-en-wordmark text-text-primary">YORKYS BRUNCH</p>
        <p className="type-jp-caption text-text-secondary">Admin Console</p>
      </div>

      {/* ログインカード */}
      <div className="w-full max-w-[400px] bg-surface-white rounded-[var(--radius-lg)] flex flex-col gap-[var(--space-20)] p-[var(--space-20)] lg:p-[var(--space-24)]">
        <h1 className="type-jp-heading-s text-text-primary">管理画面ログイン</h1>

        {error && (
          <div
            role="alert"
            className="bg-status-urgent-subtle rounded-[var(--radius-sm)] px-[var(--space-16)] py-[var(--space-12)] w-full"
          >
            <p className="type-jp-body-small text-status-urgent">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-[var(--space-20)] w-full">
          <div className="flex flex-col gap-[var(--space-4)] w-full">
            <label htmlFor="admin-email" className="type-jp-caption-bold text-text-primary">
              メールアドレス
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
              aria-invalid={error ? true : undefined}
              placeholder="admin@example.com"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-[var(--space-4)] w-full">
            <label htmlFor="admin-password" className="type-jp-caption-bold text-text-primary">
              パスワード
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] bg-surface-ink disabled:opacity-60 rounded-[var(--radius-full)] flex items-center justify-center gap-[var(--space-8)] type-jp-heading-s text-text-inverse"
          >
            {loading && (
              <span
                aria-hidden
                className="w-4 h-4 border-2 border-text-tertiary border-t-text-inverse rounded-full animate-spin shrink-0"
              />
            )}
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>

      <p className="type-jp-caption text-text-tertiary text-center">
        管理者アカウントはSupabase Authで作成してください
      </p>
    </div>
  );
}
