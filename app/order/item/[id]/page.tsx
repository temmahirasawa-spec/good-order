/**
 * 旧・商品詳細ページ。
 *
 * 詳細は `/order?item=<id>` のオーバーレイに置き換えたが、
 * 外部で共有されたURLや古いブックマークが死なないようリダイレクトだけ残す。
 * 遷移先の一覧はTOP固定にしている（どのカテゴリから開かれたURLかは復元できないため）。
 */
import { redirect } from "next/navigation";

export default function LegacyItemDetailPage({ params }: { params: { id: string } }) {
  redirect(`/order?item=${encodeURIComponent(params.id)}`);
}
