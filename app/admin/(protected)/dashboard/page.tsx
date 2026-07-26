"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isAcceptingOrders, setAcceptingOrders } from "@/lib/api";
import StaffView from "@/components/dashboard/StaffView";
import OwnerView from "@/components/dashboard/OwnerView";

type SendResult = {
  success: boolean;
  results?: { slack: boolean; line: boolean };
  preview?: string;
  error?: string;
};

type Tab = "staff" | "owner";

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>("staff");

  // 日報送信（従来機能を保持）
  const [sending, setSending] = useState(false);
  const [toast, setToast]     = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const showToast = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  };

  // 受付停止・営業状態（見た目はFigma設計後に別途調整予定。ここでは動作のみ）
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [togglingAccepting, setTogglingAccepting] = useState(false);

  useEffect(() => {
    isAcceptingOrders()
      .then(setAccepting)
      .catch((err) => {
        console.error("[dashboard] isAcceptingOrders failed:", err);
        setAccepting(true);
      });
  }, []);

  const handleToggleAccepting = async () => {
    if (accepting === null || togglingAccepting) return;
    const next = !accepting;
    setTogglingAccepting(true);
    try {
      await setAcceptingOrders(next);
      setAccepting(next);
      showToast("ok", next ? "注文の受付を再開しました" : "注文の受付を停止しました");
    } catch (err) {
      console.error("[dashboard] setAcceptingOrders failed:", err);
      showToast("err", "受付状態の更新に失敗しました");
    } finally {
      setTogglingAccepting(false);
    }
  };

  const handleSendReport = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json: SendResult = await res.json();
      if (!res.ok || !json.success) {
        showToast("err", json.error ?? "送信に失敗しました");
        return;
      }
      const channels: string[] = [];
      if (json.results?.slack) channels.push("Slack");
      if (json.results?.line)  channels.push("LINE");
      showToast(
        "ok",
        channels.length > 0
          ? `${channels.join(" / ")} に送信しました`
          : "プレビュー生成完了（送信先未設定）"
      );
    } catch (err) {
      console.error("[dashboard] send exception:", err);
      showToast("err", "送信時にエラーが発生しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* タブ切り替え */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          {([
            { k: "staff", label: "スタッフ" },
            { k: "owner", label: "オーナー" },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === k
                  ? "bg-white text-warm-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAccepting}
            disabled={accepting === null || togglingAccepting}
            className={`px-3 py-2 border text-xs font-medium rounded-lg transition-colors disabled:opacity-60 ${
              accepting === false
                ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {accepting === null
              ? "…"
              : accepting
              ? "🟢 注文受付中（タップで停止）"
              : "🔴 受付停止中（タップで再開）"}
          </button>
          <button
            onClick={handleSendReport}
            disabled={sending}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-xs font-medium rounded-lg transition-colors"
          >
            {sending ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
                送信中…
              </>
            ) : (
              <>📤 日報を送信</>
            )}
          </button>
        </div>
      </div>

      {tab === "staff" ? <StaffView /> : <OwnerView />}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-medium shadow-lg ${
            toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
