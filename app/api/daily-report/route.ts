/**
 * 営業日報を生成して Slack / LINE に送信する
 *   - Vercel Cron からの定期起動 (Authorization: Bearer ${CRON_SECRET})
 *   - x-cron-secret ヘッダーでの外部呼び出し
 *   - 管理ダッシュボードの手動送信（Supabase 認証済みユーザーのアクセストークン）
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateDailyReport, formatReportText } from "@/lib/dailyReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyRequest(req: Request): Promise<{ ok: boolean; via?: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const xCron      = req.headers.get("x-cron-secret") ?? "";

  // (1) x-cron-secret ヘッダー
  if (cronSecret && xCron && xCron === cronSecret) {
    return { ok: true, via: "x-cron-secret" };
  }

  // (2) Authorization: Bearer <token>
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const token = m[1].trim();

    // (2a) Vercel Cron は Bearer CRON_SECRET を自動付与
    if (cronSecret && token === cronSecret) {
      return { ok: true, via: "authorization-cron" };
    }

    // (2b) Supabase アクセストークンとして検証（認証済みユーザーのみ）
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && service) {
      try {
        const admin = createClient(url, service, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data.user) {
          return { ok: true, via: `user:${data.user.email ?? data.user.id}` };
        }
      } catch {
        // fallthrough to 401
      }
    }
  }

  return { ok: false };
}

async function sendToSlack(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (err) {
    console.error("[daily-report] Slack send failed:", err);
    return false;
  }
}

async function sendToLine(text: string): Promise<boolean> {
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ message: "\n" + text }).toString();
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    return res.ok;
  } catch (err) {
    console.error("[daily-report] LINE send failed:", err);
    return false;
  }
}

async function handle(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await generateDailyReport(new Date());
    const text   = formatReportText(report);

    const [slack, line] = await Promise.all([sendToSlack(text), sendToLine(text)]);

    return NextResponse.json({
      success: true,
      results: { slack, line },
      preview: text,
      via: auth.via,
    });
  } catch (err) {
    console.error("[daily-report] failed:", err);
    return NextResponse.json(
      { error: "Daily report generation failed", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
