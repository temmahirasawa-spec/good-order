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

export default nextConfig;
