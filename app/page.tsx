import TopScreen from "@/components/top/TopScreen";
import { restaurantJsonLd } from "@/lib/siteConfig";

/**
 * TOP（二次元コードの着地点／テイクアウトの入口）。
 *
 * 画面本体は client component（卓の解決に hooks を使う）なので
 * components/top/TopScreen.tsx に置き、このファイルは server component のまま
 * 構造化データを出すためだけに残している。こうすると JSON-LD は
 * サーバーで描画されたHTMLにだけ載り、クライアントのJSバンドルには入らない。
 *
 * 検索にインデックスさせているのはサイト内でこのページだけ（robots は
 * app/layout.tsx の既定 index:true がそのまま効く）。
 */
export default function TopPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // 値はすべて lib/siteConfig.ts の静的な定数なので、外部入力は混ざらない
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd()) }}
      />
      <TopScreen />
    </>
  );
}
