"use client";

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

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-6">
      {/* ロゴ */}
      <div className="mb-8 text-center">
        <p
          className="text-2xl font-bold text-warm-700 tracking-widest"
          style={{ fontFamily: "HalisR, sans-serif" }}
        >
          YORKYS BRUNCH
        </p>
        <p className="text-xs text-brand-muted mt-1 tracking-wider">Admin Console</p>
      </div>

      {/* ログインカード */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card px-6 py-8">
        <h1 className="text-lg font-semibold text-gray-800 mb-6">管理画面ログイン</h1>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-warm-700 text-white rounded-xl text-sm font-medium tracking-wide disabled:opacity-60 active:bg-warm-800 transition-colors mt-2"
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-brand-muted text-center">
        管理者アカウントはSupabase Authで作成してください
      </p>
    </div>
  );
}
