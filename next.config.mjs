import { withSentryConfig } from "@sentry/nextjs";
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
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
