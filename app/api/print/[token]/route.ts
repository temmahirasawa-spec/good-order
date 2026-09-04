/**
 * 厨房プリンタ（EPSON TM-m30III-H）のサーバーダイレクトプリント受け口
 *
 * プリンタが Interval 秒ごとにこのURLへ POST してくる。方向は常に
 * 「プリンタ → こちら」なので、店舗のルーターにポート開放は要らない。
 *
 * プリンタが送ってくるのは application/x-www-form-urlencoded で、
 * ConnectionType による3種類（Server Direct Print User's Manual Rev.K）:
 *
 *   ConnectionType=GetRequest   … 印刷するものある?
 *       → あれば ePOS-Print XML を返す / 無ければ 200 + 空ボディ
 *   ConnectionType=SetResponse  … 印刷した結果の報告（ResponseFile に結果XML）
 *       → 200 + 空ボディ
 *   ConnectionType=SetStatus    … 状態通知（Status に状態XML）
 *       → 200 + 空ボディ
 *
 * 認証について:
 *   マニュアルはDigest認証を案内しているが、ここでは採用していない。
 *   Digest はサーバー側で nonce を保持する必要があり、Vercel の
 *   サーバーレス（インスタンスが使い回される前提が無い）とは相性が悪い。
 *   代わりに **URL のパスに推測不能なトークンを埋める**方式にしている。
 *   通信は HTTPS なのでトークンは経路上で暗号化され、実効的な強度は同等。
 *   プリンタ側は URL を 2043 文字まで受け付けるので長さの制約も無い。
 *
 * 設定するURLの形:
 *   https://<本番ドメイン>/api/print/<PRINT_ENDPOINT_TOKEN>
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { STORE_ID } from "@/lib/api";
import {
  buildPrintRequest,
  buildReceiptXml,
  describePrintFailure,
  describePrinterStatus,
  parsePrintResult,
  receiptCopies,
  type ReceiptJob,
} from "@/lib/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** プリンタへの応答はすべてこの Content-Type（マニュアル Rev.K 記載どおり） */
const XML_CONTENT_TYPE = "text/xml; charset=utf-8";

/**
 * 「印刷するものは無い」の応答。
 * 204 でもエラーでもなく、200 + 空ボディがマニュアルの規定。
 * ポーリングのたびに必ず通る経路なので、DBアクセスを増やさず軽く返す。
 */
function emptyOk(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: { "Content-Type": XML_CONTENT_TYPE },
  });
}

/** 長さの違いも含めて一定時間で比較する（トークンの総当たりを助けない） */
function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const expected = process.env.PRINT_ENDPOINT_TOKEN;
  if (!expected) {
    console.error("[print] PRINT_ENDPOINT_TOKEN が未設定のため受け付けられません");
    return new NextResponse(null, { status: 503 });
  }
  if (!tokenMatches(params.token, expected)) {
    // プリンタには何も教えない。存在しないURLとして扱う
    return new NextResponse(null, { status: 404 });
  }

  const db = admin();
  if (!db) {
    console.error("[print] Supabase のサーバー用キーが未設定です");
    return new NextResponse(null, { status: 503 });
  }

  const form = new URLSearchParams(await req.text());
  const connectionType = form.get("ConnectionType") ?? "";

  switch (connectionType) {
    case "GetRequest":
      return handleGetRequest(db);

    case "SetResponse":
      return handleSetResponse(db, form);

    // マニュアル内で ConnectionType の表記が Status / SetStatus と割れているため両方受ける
    case "SetStatus":
    case "Status":
      return handleSetStatus(db, form);

    default:
      console.warn("[print] 未知の ConnectionType:", connectionType);
      return emptyOk();
  }
}

/** 印刷するものがあるか聞かれた */
async function handleGetRequest(
  db: NonNullable<ReturnType<typeof admin>>
): Promise<NextResponse> {
  // printer_poll が3つまとめてやる（supabase/printer_status.sql）:
  //   1. プリンタの生存記録（15秒に1回に間引かれる）
  //   2. 渡したまま報告が返ってこなかったジョブの回収
  //   3. 次に刷るジョブの取り出し
  // 3秒おきに叩かれる経路なので、DBへの往復は1回に抑える。
  const { data, error } = await db.rpc("printer_poll", { p_store_id: STORE_ID });
  if (error) {
    console.error("[print] ジョブの取得に失敗:", error.message);
    // エラーを返すとプリンタ側がリトライを繰り返すため、
    // 「今は無い」として返し、次のポーリングに任せる
    return emptyOk();
  }
  if (!data) return emptyOk();

  const job = data as ReceiptJob;
  const xml = buildPrintRequest(buildReceiptXml(job));

  console.info(
    `[print] 伝票を送出: job=${job.jobId} ${job.orderType} ${job.tableLabel ?? `#${job.pickupNo}`} ${job.items.length}品 ${receiptCopies(job).length}枚`
  );

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": XML_CONTENT_TYPE },
  });
}

/** 印刷結果の報告が来た */
async function handleSetResponse(
  db: NonNullable<ReturnType<typeof admin>>,
  form: URLSearchParams
): Promise<NextResponse> {
  const responseFile = form.get("ResponseFile") ?? "";
  const result = parsePrintResult(responseFile);

  // プリンタはどのジョブの結果かを返してこない（printjobid は
  // PrintRequestInfo Version 2.00 以降の機能で、今は 1.00 を使っている）。
  // 渡してあるジョブは常に1件なので、'printing' のものを結果にする。
  const { data: printing, error: selectError } = await db
    .from("print_jobs")
    .select("id")
    .eq("status", "printing")
    .order("claimed_at", { ascending: true })
    .limit(1);

  if (selectError) {
    console.error("[print] 印刷中ジョブの特定に失敗:", selectError.message);
    return emptyOk();
  }
  const jobId = printing?.[0]?.id;
  if (!jobId) {
    // 回収済みなど。結果だけ来ても紐づけ先が無いので記録して終わり
    console.warn("[print] 結果を受け取ったが対象のジョブが見つかりません:", result);
    return emptyOk();
  }

  const { error } = await db.rpc("complete_print_job", {
    p_job_id: jobId,
    p_ok: result.success,
    p_error: result.success ? null : describePrintFailure(result),
  });
  if (error) {
    console.error("[print] 印刷結果の記録に失敗:", error.message);
    return emptyOk();
  }

  if (result.success) {
    console.info(`[print] 印刷完了: job=${jobId}`);
  } else {
    console.error(`[print] 印刷失敗: job=${jobId} ${describePrintFailure(result)}`);
  }
  return emptyOk();
}

/**
 * 状態通知が来た。管理画面の「印刷状況」に出すため printer_status に残す。
 *
 * 状態通知XMLのビットは `asbstatus="0x0F00003C"` の形（16進の文字列）で、
 * 印刷結果XMLの `status`（10進）とは表記が違う点に注意。
 */
async function handleSetStatus(
  db: NonNullable<ReturnType<typeof admin>>,
  form: URLSearchParams
): Promise<NextResponse> {
  const raw = form.get("Status") ?? form.get("ResponseFile") ?? "";

  const hex = /\basbstatus\s*=\s*"([^"]*)"/i.exec(raw)?.[1];
  const bits = hex ? Number.parseInt(hex, 16) : NaN;
  // 異常があるときだけ日本語の理由を入れる。正常時は null にして
  // 画面が「異常なし」を出せるようにする
  const note = Number.isFinite(bits)
    ? describePrinterStatus({ success: true, code: null, status: bits })
    : null;

  const { error } = await db.rpc("record_printer_status", {
    p_store_id: STORE_ID,
    p_note: note,
    p_raw: raw,
  });
  if (error) console.error("[print] 状態通知の記録に失敗:", error.message);

  console.info("[print] プリンタ状態通知:", note ?? "異常なし");
  return emptyOk();
}
