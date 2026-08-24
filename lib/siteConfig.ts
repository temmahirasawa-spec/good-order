/**
 * サイト全体で使う「店舗の事実」と「公開URL」の唯一の置き場所。
 *
 * ここに集約している理由は、同じ住所・営業時間が
 *   - 店舗情報モーダル（お客様が読む文字列）
 *   - 構造化データ JSON-LD（検索エンジンが読む値）
 *   - <meta description>
 * の3か所に出るため。別々に持つと必ずどれかが古くなる。
 */

/**
 * 店舗ごとのURL接頭辞（例: "/yorkys-shukugawa"）。未設定なら空文字。
 *
 * 実体は `next.config.mjs` の `basePath` で、Next.js が全ページ・全アセットの
 * URLに自動で付ける。ただし自動で付かない場所が3つあるので、そこだけこの値を
 * 手で足す必要がある:
 *   1. 二次元コードに埋めるURL（lib/qrCode.ts）
 *   2. `window.location.href` による画面遷移（lib/useAdminSession.ts）
 *   3. manifest.webmanifest の start_url とアイコンのパス（app/manifest.ts）
 *
 * `next/link` と `router.push` は自動で付くので、そちらは触らなくてよい。
 */
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/**
 * アプリが載っているホスト（スキーム＋ドメイン。接頭辞は含まない）。
 *
 * 独自ドメインを当てたら `NEXT_PUBLIC_SITE_URL` に **ドメインだけ** を入れる。
 * 例: `https://app.good-order.jp`（`/yorkys-shukugawa` は付けない。
 * 付けると下の siteUrl で二重になる）。
 * 未設定なら Vercel が自動で入れる本番URL（プレビュー環境でも本番URLを指すので
 * canonical としては正しい）、それも無ければ既定値。
 */
export const siteHost = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://yorkys-orderly.vercel.app")
).replace(/\/$/, "");

/**
 * 本番の公開URL。canonical・OGP・sitemap・robots の絶対URLはすべてここから引く。
 * ホストに店舗の接頭辞を足したもの（例: https://app.good-order.jp/yorkys-shukugawa）。
 */
export const siteUrl = `${siteHost}${basePath}`;

/** 店舗情報（Figma: Store Info — Half Modal 191:31 の記載値） */
export const STORE = {
  name: "YORKYS BRUNCH 夙川店",
  address: "兵庫県西宮市霞町5-44 ビンテージ夙川2F",
  /* JSON-LD 用に分解したもの。表示には `address` を使う */
  addressParts: {
    region: "兵庫県",
    locality: "西宮市",
    street: "霞町5-44 ビンテージ夙川2F",
  },
  hours: "11:00 - 21:00（L.O. 20:30）",
  /** JSON-LD の openingHoursSpecification 用（24時間表記） */
  opensAt: "11:00",
  closesAt: "21:00",
  holiday: "不定休",
  phone: "0798-42-8289",
  heroImage: "/images/pancake/p1.webp",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("YORKYS BRUNCH 夙川店"),
} as const;

/**
 * ブランドカラー（PWA のテーマカラー / スプラッシュ背景 / アドレスバー）。
 *
 * この値は HTML の meta タグと manifest.json に出力されるため、
 * CSS変数（var(--color-bg-warm)）を使うことが原理的にできない。
 * design-tokens.css の --color-bg-warm と同じ値を手で同期させること。
 *
 * design-qa-allow: PWA メタデータのため CSS変数が使えない（--color-bg-warm と同値）
 */
export const BRAND_BG = "#FCF7EE";

/**
 * 絞り込み機能（アレルギー／苦手な食材 等）の表示可否。
 *
 * ロジック自体は削除せず、表示のみをこのフラグで止めている。
 * YORKYS 以外の店舗で今後使う予定があるため。管理画面からのオン/オフ設定は別タスクで、
 * それまではコード上の定数として持つ。true に戻せば元の表示に戻る。
 */
export const ENABLE_MENU_FILTER = false;

export const SITE_DESCRIPTION =
  "兵庫県西宮市・夙川のパンケーキ＆ブランチカフェ「YORKYS BRUNCH 夙川店」の" +
  "モバイルオーダー。店内は座席の二次元コードから、テイクアウトはそのまま" +
  "スマートフォンでご注文いただけます。営業時間 11:00-21:00（L.O. 20:30）／不定休。";

/**
 * 構造化データ（schema.org Restaurant）。
 * 座標・価格帯・予約可否は確かな値が無いので入れていない。
 * 推測値を入れると Google 側の実店舗情報と食い違って不利になるため。
 */
export function restaurantJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: STORE.name,
    url: siteUrl,
    image: `${siteUrl}${STORE.heroImage}`,
    telephone: STORE.phone,
    servesCuisine: ["パンケーキ", "ブランチ", "カフェ"],
    address: {
      "@type": "PostalAddress",
      addressCountry: "JP",
      addressRegion: STORE.addressParts.region,
      addressLocality: STORE.addressParts.locality,
      streetAddress: STORE.addressParts.street,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: STORE.opensAt,
        closes: STORE.closesAt,
      },
    ],
    hasMap: STORE.mapUrl,
    /* テイクアウトのモバイルオーダーが検索から直接使えることを示す */
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/order/takeout`,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      deliveryMethod: ["https://schema.org/OnSitePickup"],
    },
  };
}
