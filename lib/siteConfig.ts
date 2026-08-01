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
 * 本番の公開URL。canonical・OGP・sitemap・robots の絶対URLはすべてここから引く。
 *
 * 独自ドメインを当てたら `NEXT_PUBLIC_SITE_URL` を Vercel の環境変数に入れるだけで
 * 全部が切り替わる。未設定なら Vercel が自動で入れる本番URL（プレビュー環境でも
 * 本番URLを指すので canonical としては正しい）、それも無ければ既定値。
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://yorkys-orderly.vercel.app")
).replace(/\/$/, "");

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

/** ブランドカラー（テーマカラー / PWA の背景色） */
export const BRAND_BG = "#FDF8F2";

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
