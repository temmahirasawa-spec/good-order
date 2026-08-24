import { withSentryConfig } from "@sentry/nextjs";
/**
 * 店舗ごとのURL接頭辞（例: "/yorkys-shukugawa"）。
 *
 * 1つのドメイン app.good-order.jp の下に、店舗をパスで並べるための設定。
 * Vercel は「1ドメイン＝1プロジェクト」なので、店舗ごとに Vercel プロジェクトと
 * Supabase を分けたまま同じURL体系に見せるには、各プロジェクトが自分の接頭辞を
 * 名乗る必要がある。それをこの環境変数1つで切り替える。
 *
 *   YORKYS本番     NEXT_PUBLIC_BASE_PATH=/yorkys-shukugawa
 *   デモ・ローカル   未設定（＝従来どおりルート直下で動く）
 *
 * NEXT_PUBLIC_ を付けているのは、二次元コードのURL組み立て（lib/qrCode.ts）など
 * ブラウザ側でも同じ値が必要なため。秘密の値ではないので公開して問題ない。
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ビルド成果物の出力先。既定は .next。
  //
  // next dev と next build が同じ .next/ を共有しているため、dev サーバーを
  // 起動したまま next build を走らせると dev 側のチャンクが上書きされて 404 になる。
  // Stop hook が AI の1ターンごとに npm run check（＝内部で next build）を回すので、
  // これは単発の不便ではなくハーネスの構造的な不具合だった。
  //
  // そこで NEXT_DIST_DIR で出力先を差し替えられるようにし、npm run check から
  // 呼ばれるビルド（npm run build:check）だけ .next-check を使わせて分離する。
  // 未指定なら従来どおり .next。next dev はこちらを使うので起動速度は変わらない。
  // Vercel が実行する `npm run build` も環境変数を渡さないので .next のまま。
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 空文字を渡すと Next が「/」扱いで警告を出すので、値があるときだけ指定する
  ...(basePath ? { basePath } : {}),
  async redirects() {
    return [
      // basePath を付けると、ドメイン直下（app.good-order.jp/）は
      // どのページにも該当せず 404 になる。店舗トップへ送り直す。
      // basePath:false は「この source には接頭辞を自動で付けない」の意味で、
      // これが無いと /yorkys-shukugawa/ 自身にマッチして無限ループになる。
      // permanent:false（307）なのは、将来この位置に振り分け役のプロジェクトを
      // 置いたときにブラウザのキャッシュが邪魔をしないようにするため。
      ...(basePath
        ? [
            {
              source: "/",
              destination: basePath,
              basePath: false,
              permanent: false,
            },
          ]
        : []),
      {
        // /admin/takeout（テイクアウト商品のCRUD）は /admin/menu に統合して廃止した。
        // ブックマークされている可能性があるのでリダイレクトを残す。
        // ルーティング層で処理するので (protected) レイアウトの権限ガードより先に効き、
        // 「ナビに無いURL＝ダッシュボードへ飛ばす」既定の挙動に吸われない。
        // permanent:false（307）にしてあるのは、ブラウザに永続キャッシュさせないため。
        source: "/admin/takeout",
        destination: "/admin/menu",
        permanent: false,
      },
      {
        // 「店舗設定」を「表示設定」に作り替えたときに /admin/settings → /admin/display へ
        // 移した。ブックマークされている可能性があるのでリダイレクトを残す。
        // permanent:false（307）なのは /admin/takeout と同じ理由で、
        // ブラウザに永続キャッシュさせないため（将来また動かす余地を残す）。
        source: "/admin/settings",
        destination: "/admin/display",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "ututu",

  project: "good-order",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // 使っていない機能のコードをバンドルから除去する。
  // Tracing と Session Replay はウィザードで無効にしたが、既定ではコード自体は
  // 残るため、明示的に除外して初期読み込みを軽くする。
  // （お客さんのスマホで開くアプリなので、共通JSの重さが体感に直結する）
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayCanvas: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
