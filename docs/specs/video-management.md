# トップページ動画の管理機能 仕様

## ステータス

**実装済み。マイグレーションは未適用（2ファイルとも）。**

コードは入っているが `supabase/store_media.sql` と `supabase/store_display_settings.sql` は
まだ流していない。適用するまでは `lib/storeMedia.ts` の `STORE_MEDIA_FALLBACK`
（＝移行前にコードへ直接書かれていたアセット）が使われ、お客様側の見え方は従来どおりになる。
適用手順は G を参照。

_作成: 2026-08-03 ／ 実装反映: 2026-08-03 ／ 表示設定への作り替え: 2026-08-04_

---

## 変更履歴

### 2026-08-04 — 「店舗設定」を「表示設定」に作り替えた

| 項目 | 変更前 | 変更後 |
|---|---|---|
| 画面名 | 店舗設定 | **表示設定** |
| URL | `/admin/settings` | **`/admin/display`**（旧URLは307でリダイレクト） |
| ナビのアイコン | `sliders` | `sliders`（変更なし。詳細は H-1） |
| 構成 | 1画面に「トップページ」セクション1つ | **2タブ（動画設定 / ベストセラー）** |
| 着地画面の背景 | 動画のみ | **色 / 画像 / 動画 から選ぶ** |
| ベストセラー設定 | メニュー管理の Top Bar → モーダル | **表示設定の「ベストセラー」タブ**（モーダル廃止） |

**既存店舗の見え方は変わらない。** `store_media.background_type` の既定値が `'video'` で、
コード側のフォールバックも `"video"` に倒しているため（H-2）。

詳細は H を参照。

---

## 0. このドキュメントの前提

- お客様側のトップページに動画が貼ってあったが、管理画面から差し替え・削除・非表示にする手段が無かった
- **トップページの見た目は変えない。**変えたのは管理側だけ
- 対象は2か所。`/`（二次元コード着地の全画面背景）と `/order`（注文ホームの16:9ヒーロー）

### 天真の決定（2026-08-03・承認済み）

| 論点 | 決定 |
|---|---|
| 配置場所 | **案C。**サイドナビに「店舗設定」を新設し、その中の「トップページ」セクションに置く |
| 対象（旧F-1） | **両方。**`/` と `/order` の2か所とも管理する |
| DBスキーマ | **案E-2。**`store_media` テーブルをスロット制で新設する |
| ビットレート（旧F-4） | **1.2 Mbps**（軽さ優先） |
| 圧縮失敗時（旧F-9） | **逃げ道なし。**圧縮できなければアップロードさせない |
| 注釈テキスト（旧F-8） | **固定。**店舗は編集できない |
| 動画なしの見え方（旧F-10） | **現状のまま。**枠ごと消える |
| 動画オフ時の着地画面の背景色 | **黒で確定**（`bg-black`）。`/` は動画の下に黒を敷き、動画が無い／OFF のときはそれだけが残る |
| 更新日時（旧F-11） | **表示する** |

追加の実装要件（同日）:

1. 圧縮後が元より大きい場合は、元のファイルをそのまま使い、その旨を画面に出す
2. 注釈テキストはスロットごとに変える（切り取られ方が違うため）
3. マイグレーションは作るだけ。適用は天真が行う
4. 「店舗設定」は今回「トップページ」セクションのみ。後からセクションを足せる構造にする
5. デザインは新規に作らず、既存の管理画面のコンポーネントと作法に合わせる
6. `ADMIN_NAV_ITEMS` への追加でロール着地先が変わらないことを確認する

---

## A. 現状（調べた事実）

### A-1. 「トップページの動画」は2か所ある

コード上、お客様側で動画が出る箇所は2つあり、**別物**。

| # | 画面 | URL | 動画の役割 | 形 |
|---|---|---|---|---|
| ① | QR着地／テイクアウト入口 | `/` | 全画面の背景動画（暗幕65%＋ロゴ・卓番） | 画面全体に `object-cover` |
| ② | 注文ホーム（社内で「トップページ」と呼んでいる画面） | `/order` | メニュー一覧の先頭に置くヒーロー動画 | **16:9 固定**に `object-cover` |

**①②の両方を管理対象にした**（旧F-1 = 両方）。「16:9で自動トリミングされる」という注意書きは②にだけ当てはまる（①は縦長の画面全体に敷くので 16:9 ではない）ので、**注釈テキストと圧縮時の縦横比の扱いはスロットごとに分けている**（C-4 / D-3）。

なお `lib/bestSellers.ts:2` のコメントが「トップページ最上部の Best Seller 枠」と書いているとおり、リポジトリ内で「トップページ」＝ `/order` を指す用法が既にある。

### A-2. ① `/` の背景動画の実装

- `app/page.tsx:15-26` — server component。JSON-LD を出すだけで、画面本体は `TopScreen` に委譲
- `components/top/TopScreen.tsx:85-94` — `<video>` を直接記述。**URL はハードコード**

  ```tsx
  <video
    ref={videoRef}
    src="/images/hero/background.mp4"
    poster="/images/hero/background-poster.webp"
    autoPlay muted loop playsInline
    className="absolute inset-0 w-full h-full object-cover"
  />
  ```

- `components/top/TopScreen.tsx:59-63` — iOS Safari 対策で `ref` 経由の `play()` を明示的に呼ぶ
- `components/top/TopScreen.tsx:97` — 動画の上に `bg-black/65` のオーバーレイ

### A-3. ② `/order` のヒーロー動画の実装

- `app/order/page.tsx:65-69` — **モジュール定数としてハードコード**されている。コメントにも「差し替えは この配列を変更するだけ」とある＝現状は差し替えにデプロイが必要

  ```tsx
  /* ── ヒーロー動画（既存アセット。差し替えは この配列を変更するだけ） ── */
  const HERO_MEDIA: MediaItem[] = [
    { type: "image", url: "/images/pancake/p1.webp" },
    { type: "video", url: "/images/hero/background.mp4" },
  ];
  ```

- `app/order/page.tsx:240` — `<Video16x9 media={HERO_MEDIA} />` を `loading` 解除後に描画
- `app/order/page.tsx:95` — ローディング中は `aspectRatio: "16/9"` のスケルトンが同じ位置に出る
- `components/ui/VideoBlock.tsx:100-102` — `Video16x9` は `w-full aspect-video`（＝16:9の枠）
- `components/ui/VideoBlock.tsx:72` — 中身の `<video>` は `object-cover`。**これが「16:9で自動トリミングされる」の実体。**枠に対して縦横比の違う動画を入れると、はみ出た側が切り落とされる
- `components/ui/VideoBlock.tsx:29-30` — `media` 配列から `type === "video"` の最初の1本を動画、`type === "image"` の最初の1枚を `poster` として使う
- `components/ui/VideoBlock.tsx:45` — **`if (!video) return null;`**。動画が無ければ枠ごと消える。非表示・削除の実装は既にこの1行で成立しており、お客様側のレイアウトを触る必要がない
- `components/ui/VideoBlock.tsx:38-43` — React の `muted` 属性が DOM に反映されないことがあるため `ref` 経由で `el.muted = true` してから `play()`
- `components/ui/VideoBlock.tsx:47-55, 79-95` — タップで一時停止／再開。一時停止中のみ中央に再生ボタンと右下に再生時間バッジ

### A-4. 動画ファイルの置き場所

**トップページの動画は Supabase Storage ではなく `public/` にある（＝リポジトリにコミットされた静的アセット）。**

| ファイル | サイズ | 用途 |
|---|---|---|
| `public/images/hero/background.mp4` | 711,242 B（695 KB） | ①②の両方が参照している同一ファイル |
| `public/images/hero/background-poster.webp` | 64,348 B（63 KB） | ①の poster。OGP画像の素材にもなっている（`docs/handoff.md:1197`） |

②の poster は `public/images/pancake/p1.webp`（`app/order/page.tsx:67`）。

一方、**メニュー商品の動画は Supabase Storage にある**。

- `lib/storage.ts:3-4` — バケットは `menu-images` と `menu-videos` の2つ
- `supabase/menu_videos.sql` — `menu-videos` を `public: true` で作成。RLS は SELECT が全員、INSERT / DELETE が `authenticated` のみ
- `lib/storage.ts:68-98` — `uploadMenuVideo` / `getMenuVideoUrl` / `deleteMenuVideo` / `extractVideoStoragePath`
- `lib/storage.ts:12` — `cacheControl = "2592000"`（30日）。「アップロードのパスが毎回ユニークなので差し替え＝別URL」という前提でこの長さにしている
- `lib/storage.ts:111-129` — `deleteUploadedMedia`。保存せずに閉じたときに Storage へ残る孤児オブジェクトを掃除する。失敗しても操作をブロックしない

つまり**動画を Storage に上げる配管は既に全部ある。**トップページ用に新しく作る必要があるのは「どのURLを使うか」の保存先だけ。

### A-5. 管理画面の現在の構成

サイドナビの定義は `lib/staffRoles.ts:55-65` の `ADMIN_NAV_ITEMS`。**配列の順序がそのまま表示順で、同時に各ロールの着地先（`allowed[0]`）でもある**（同ファイル 51-54 行のコメント）。

| 表示順 | href | ラベル | ロール | group |
|---|---|---|---|---|
| 1 | `/admin/kitchen` | 厨房 | manager, kitchen | ops |
| 2 | `/admin/register` | レジ | manager, register | ops |
| 3 | `/admin/pickup` | テイクアウト | manager, kitchen, counter | ops |
| — | （区切り線） | | | |
| 4 | `/admin/menu` | メニュー | manager | manage |
| 5 | `/admin/tables` | テーブル/二次元コード | manager | manage |
| — | （スペーサーで下端寄せ） | | | |
| 6 | `/admin/dashboard` | ダッシュボード | manager | review |

- `components/admin/nav/NavContent.tsx:63-76` — ops / manage / review の3群に分け、ops と manage の間に区切り線、review をログアウト直上へ下端寄せ
- `components/admin/nav/MenuAccordionNavItem.tsx:18-21` — 「メニュー」だけアコーディオンで、サブ項目は現在2つ

  ```ts
  const SUB_ITEMS = [
    { href: "/admin/menu", label: "メニュー管理" },
    { href: "/admin/menu/categories", label: "カテゴリ管理" },
  ] as const;
  ```

- `components/admin/AdminPageShell.tsx` — 全画面共通の外枠（PC=サイドバー / SP=ドロワー）
- `components/admin/TopBar.tsx:14-31` — `title` / `count` / `action`（件数の代わりに右側へ置く要素）/ `strip` のスロット構成

**「設定」を置く既存の作法は Top Bar のボタン → モーダル。**

- `app/admin/(protected)/menu/page.tsx:538-566` — Top Bar の `action` に「👑 ベストセラーの設定」と「＋ 新規追加」の2ボタン。SP では 44px の丸アイコンボタンに縮む
- `app/admin/(protected)/menu/page.tsx:506-507` — コメントに「二次元コード管理の『席カテゴリの設定』と同じく、Top Barのボタンからモーダルで開く」とあり、これが既定パターンだと明示されている
- `components/admin/tables/SeatSettingsModal.tsx` — もう一方の実例

**店舗全体の設定を置く画面は現在ひとつも無い。** 実際、受注停止フラグには API だけあって UI が無い。

- `lib/api.ts:355-370` — `isAcceptingOrders()` / `setAcceptingOrders()`
- 呼び出し元は `app/cart/page.tsx:49` と `lib/store.ts:197` の**読み取りだけ**。`setAcceptingOrders` を呼ぶ画面は存在しない（＝店舗側から受注を止められない）

### A-6. 既存の画像・動画アップロード機能の作法

コンポーネントは `components/admin/menu/MediaUploaderField.tsx`（Figma: `Form Field/Media Uploader` 306:1510）。

- 80×80 のタイルを並べ、先頭に「カバー」バッジ（122-128行）
- タイル右上の×で削除（130-137行）、複数あるときは前後移動ボタン（139-160行）＋タイル自体のドラッグ並び替え（51-67行）
- 追加は 40px 高の破線ボタン1つ。`uploading` 中はスピナー（166-177行）
- `<input type="file" accept="image/*,video/mp4,video/quicktime,video/webm">`（179-185行）。**種別は MIME から自動判別**して呼び出し元が振り分ける
- 注釈は本体の下に `type-jp-label text-text-tertiary` の2行（188-191行）

  > 画像は最大5枚、動画は1本まで（mp4/mov/webm、50MBまで）。
  > 動画は16:9推奨・9:16の縦動画にも対応しています。

呼び出し元 `app/admin/(protected)/menu/page.tsx` の挙動：

| 行 | 内容 |
|---|---|
| 50-52 | `MAX_VIDEO_BYTES = 50MB` / `MAX_IMAGES = 5` / `MAX_VIDEOS = 1` |
| 378 | `file.type.startsWith("video/")` で画像／動画に分岐 |
| 299-316 | **画像**：`inspectImage()` で判定 → 大きければ圧縮確認モーダル |
| 318-350 | 「圧縮する」＝`compressImage(file)`、「そのまま」＝`compressImage(file, { resize: false })`（WebP化だけ） |
| 886-923 | 圧縮確認ダイアログ。現在の寸法・サイズと目安を並べて出す |
| 925-940 | 圧縮完了トースト（before → after と削減率） |
| 354-370 | **動画**：本数と 50MB を確認するだけ。**圧縮は一切していない。**超えたら `alert()` で拒否 |

画像圧縮の実装は `lib/imageCompression.ts`：

- Canvas API のみ。**外部ライブラリなし**（17-19行：長辺 ≤ 1440px、目標 300KB）
- 出力は WebP、書き出せない環境だけ JPEG にフォールバック（123-129行）
- 品質を `0.85 → 0.5` へ 0.07 刻みで下げながら目標サイズを狙う（71-85行）

**「まず inspect → 必要なら確認 → 圧縮 → アップロード → プレビュー」という流れが確立している。動画の圧縮はこの流れの動画版を作れば載る。**

### A-7. 圧縮をどこでやるかの制約（実際の設定に照らして）

| 項目 | 事実 | 出典 |
|---|---|---|
| 動画処理系の依存 | **ゼロ**。`ffmpeg` 系も `mp4box` 系も入っていない | `package.json` |
| API Route | `app/api/daily-report/route.ts` の1本のみ | `find app -name route.ts` |
| Vercel リージョン | `hnd1` 固定 | `vercel.json:2` |
| `maxDuration` の指定 | **どこにも無い**（＝プラットフォーム既定のまま） | `vercel.json` / 全 route |
| Vercel 関数の既定タイムアウト | 現行の既定は 300 秒 | プラットフォーム仕様 |
| Vercel 関数のリクエストボディ上限 | 100 MB | プラットフォーム仕様 |
| Vercel 関数のパッケージ上限 | 5 GB（Fluid Compute） | プラットフォーム仕様 |
| Supabase Storage への直アップロード | ブラウザから `supabase.storage.from(...).upload()` を直接叩いている。**Vercel を経由しない** | `lib/storage.ts:68-78` |
| バケットの公開設定 | `menu-videos` は `public: true`。RLS は SELECT 全員 / INSERT・DELETE authenticated | `supabase/menu_videos.sql` |
| Storage の CDN キャッシュ | 30日 | `lib/storage.ts:12` |
| 現在の動画の実サイズ | 695 KB（16:9のループ素材） | `public/images/hero/background.mp4` |

ここから読み取れる重要な点：

1. **アップロードは既に Vercel を通っていない。**ブラウザ → Supabase Storage の直アップロード。だから「100MB のボディ上限」も「300秒のタイムアウト」も**現状の経路には効いていない**。サーバー側圧縮を入れると、この経路をわざわざ Vercel 経由に作り替えることになる
2. Supabase の**プラン（容量・転送量の上限）はリポジトリからは判別できない。**F-6 に未決として挙げる。ただし対象は 1店舗 × 1本 × 数MB なので、容量より**お客様がトップページを開くたびに発生する転送量**の方が効く。ここは圧縮の目標値（D-2）で抑える

### A-8. 実装時に確認した事実（旧F-5 / 旧F-6）

**旧F-5：`stores` の anon SELECT — 既に開いていた。この論点は解消済み。**

- `supabase/setup.sql:129-130` に `stores_select_all`（`FOR SELECT TO anon, authenticated USING (true)`）がある
- `supabase/staff_foundation.sql:64` のコメントでも「stores は既に stores_select_all（anon,authenticated 読み取り可）」と確認できる
- したがって既存テーブル側にポリシー追加は不要。**新設した `store_media` には同じ形の SELECT ポリシーを付けた**（`supabase/store_media.sql` STEP 2）。書き込みポリシーは置かず、manager 限定の `save_store_media()` RPC だけを入口にしている

**旧F-6：容量・転送量の概算（1店舗あたり）。**

前提: 1本 15秒 × 1.2 Mbps = 約 2.2MB、ポスターは実測 約 78KB（`background.mp4` の1フレーム目を WebP 化した実測値）。スロットは2つ。差し替え時に旧オブジェクトは削除する。

| 項目 | 概算 |
|---|---|
| Storage 容量（定常） | **約 4.6MB**（2スロット × 2.3MB）。差し替えても増えない |
| 1客あたりの転送量 | **約 4.6MB**（`/` の背景 2.2MB ＋ `/order` のヒーロー 2.2MB ＋ ポスター2枚） |
| 100客/日のとき | 約 460MB/日 ＝ **約 14GB/月** |
| Supabase 無料枠（Storage 1GB / 転送 5GB）だと | **転送が先に足りなくなる。**約 36客/日で上限 |
| Supabase Pro（Storage 100GB / 転送 250GB）だと | 約 1,800客/日まで収まる |

補足2点。

- **アップロードするまで Supabase の転送量は増えない。**初期データは `public/` 配下の相対パス（Vercel が配信）なので、店舗が実際に差し替えるまで Storage は使われない
- CDN キャッシュは30日（`lib/storage.ts:12`）だが、これは端末ごとのキャッシュ。来客のたびに新しい端末で開かれるため、上の概算は「ほぼ毎回ダウンロードされる」前提で出している

> ### ⚠ Supabase は現在も無料枠。Pro への移行が必須（2026-08-03 確認）
>
> 転送量の上限が **5GB/月**しかないため、**この機能を有効にすると1日約36客で上限に達する。**
>
> **YORKYS BRUNCH の9月リオープン前に Pro プランへ移行すること。**
> 未移行のままリオープンすると、月の途中で上限に達した時点で**動画が配信されなくなる**
> （お客様の `/` は黒背景、`/order` はヒーローが出ない状態になる）。
>
> 移行するまでは、店舗設定から動画をアップロードしない運用にする。
> 初期データのまま（`public/` 配下・Vercel 配信）であれば Supabase の転送量は増えないため、
> リオープンまで現状維持でも安全。

---

## B. 配置場所の案（3案）→ **案C を採用**

3案とも、**入力項目・文言は同じ**（C の内容）。変えるのは「器」だけ。
以下は検討時の3案。**天真の決定により案Cを採用した**（末尾参照）。

### 案A — メニュー管理の Top Bar にボタンを足し、モーダルで開く

**どこに置くか**
`/admin/menu` の Top Bar `action` に3つ目のボタン「トップページの動画」を追加し、`BestSellerModal` と同じ形のモーダルを開く。`app/admin/(protected)/menu/page.tsx:538-566` にボタンを1つ、`components/admin/menu/HeroVideoModal.tsx` を新規追加。

**店舗スタッフから見てわかりやすいか**
「ベストセラーの設定」の隣なので、**トップページ関連の設定はここ、という学習が1回で済む**のは利点。一方で、Top Bar のボタンが3つになる。SP（`size-[44px]` の丸ボタン）だと 44×3＋余白でタイトルを圧迫し、アイコンだけで3種類を見分けさせることになる。「動画はメニューの一部ではない」という点も引っかかりやすい。

**実装コスト**
**最小。**ページ追加もナビ変更も無い。既存モーダルをテンプレートにできる。

**強い／弱い**
- 強い：設定変更が年に数回の店舗。導線を増やさず、既存の運用を崩さない
- 弱い：トップページ側の設定項目が今後増える店舗。Top Bar のボタンが際限なく増える。プレビューと圧縮の進捗を出すにはモーダルが手狭

---

### 案B — サイドナビ「メニュー」アコーディオンに3つ目のサブ項目を足し、専用ページにする

**どこに置くか**
`components/admin/nav/MenuAccordionNavItem.tsx:18-21` の `SUB_ITEMS` に3行目を追加する。

```
メニュー
├ メニュー管理        /admin/menu
├ カテゴリ管理        /admin/menu/categories
└ トップページ設定    /admin/menu/top   ← 新規
```

`app/admin/(protected)/menu/top/page.tsx` を新規作成。`AdminPageShell` ＋ `TopBar title="トップページ設定"` で既存2画面と同じ外枠になる。**`ADMIN_NAV_ITEMS`（`lib/staffRoles.ts:55-65`）は触らない**ので、サイドバーの並び順＝各ロールの着地先という対応関係に影響しない。

**店舗スタッフから見てわかりやすいか**
**3案でいちばん見つけやすい。**サイドナビに文字で「トップページ設定」と出る。モーダルと違い、開くのに前提知識（どのボタンの中にあるか）が要らない。「メニュー」の下にある点も、`/order` がメニュー画面である以上、素直に読める。

**実装コスト**
**中。**ページ1枚を新規作成（Top Bar ＋ トグル ＋ アップローダ ＋ プレビュー）。`SUB_ITEMS` は1行追加のみ。`/admin/menu` 配下なのでロールガードは既存のまま効く（`ADMIN_NAV_ITEMS` の `/admin/menu` が manager 限定）。

**強い／弱い**
- 強い：トップページの見せ方を自分でいじりたい店舗。将来「ベストセラー設定」をモーダルからこの画面に引っ越して1か所にまとめられる。プレビューを実寸（390px）で常時出せるので、16:9トリミングの結果を上げる前後で確認できる
- 弱い：設定を一度入れたら二度と触らない店舗にはナビが1段深くなるだけ。「動画は本当にメニューの下か？」という分類の座りは案Cに劣る

---

### 案C — サイドナビ manage 群に「店舗設定」を新設し、その中の1セクションにする

**どこに置くか**
`ADMIN_NAV_ITEMS`（`lib/staffRoles.ts:55-65`）に `{ href: "/admin/settings", label: "店舗設定", roles: ["manager"], group: "manage" }` を追加し、`/admin/tables` の下（`review` 群の上）に置く。`app/admin/(protected)/settings/page.tsx` を新規作成し、その中の「トップページ」セクションに動画を置く。

**店舗スタッフから見てわかりやすいか**
分類としては**いちばん正しい。**「店の設定はここ」で完結する。加えて、A-5 で挙げたとおり**受注停止トグル（`setAcceptingOrders`）は API だけあって画面が無い**ので、この画面には最初から2つ目の中身がある。逆に、今すぐ入るのが動画と受注停止の2つだけだと、開いた瞬間はスカスカに見える。

**実装コスト**
**最大。**ページ新規＋ナビ項目追加。加えて `lib/staffRoles.ts:51-54` にあるとおり、**この配列は「そのロールが最初に見るべき画面」＝ `allowed[0]` を兼ねている。**manager の着地先が変わらないよう挿入位置に注意が要る（`/admin/kitchen` より後ろに入れる限り実害はないが、意図せず並びを崩さない確認が必要）。セクションを持つ設定ページという新しい器も要る。

**強い／弱い**
- 強い：多店舗・チェーン展開を見据える場合。営業時間・受注停止・ブランド切り替えなど設定項目が増えていく前提なら、最初からここに寄せた方が後で安い
- 弱い：今すぐ必要なのは動画1本だけ。器を先に作ることになる。ロール別の着地先ロジックに触るリスクを、動画1本のために負う形になる

---

### 決定：**案C**（AIの当初推奨は案B。天真の判断で案Cを採用）

対象が2か所に増えたことで、案Cの「店の設定はここ」という分類の正しさが効く形になった。
実装は `/admin/settings` を新設し、その中に「トップページ」セクションを1つ置いている。

**懸念だったロール着地先については、壊れないことを確認済み。**

- `app/admin/(protected)/layout.tsx:64-71` が `allowed[0].href` を「アクセス権の無いページを開いたときの飛び先」に使っている。`allowed` は `ADMIN_NAV_ITEMS` をロールで絞ったもの
- 新項目は `/admin/tables` の**後ろ**（index 5、`/admin/dashboard` の直前）に入れた。**先頭ではない**ので、どのロールでも `allowed[0]` は変わらない
  - manager: `/admin/kitchen`（変化なし）／ kitchen: `/admin/kitchen` ／ register: `/admin/register` ／ counter: `/admin/pickup`
- `lib/staffRoles.ts` の該当行に、先頭に入れてはいけない理由をコメントで残した
- `REDESIGNED_PREFIXES`（同 layout.tsx:25-32）にも `/admin/settings` を追加した。ここに載せないと旧デザインのトップバー枠が二重に被る

---

## C. 画面の中身（`/admin/settings`）

### C-1. 画面構成

```
AdminPageShell（PC=Nav Sidebar / SP=Nav Drawer）
└ TopBar「店舗設定」
   └ main（bg-bg-secondary・コンテンツ幅は最大720px）
      └ SettingsSection「トップページ」          ← 増やすときはここに縦に足す
         ├ VideoSlotField「注文ホームのヒーロー動画」
         └ VideoSlotField「二次元コード着地画面の背景動画」
```

- `components/admin/settings/SettingsSection.tsx` — セクション枠。見た目は既存の `components/dashboard/DashboardCard.tsx` と同じ白カード（角丸16・パディング SP20 / PC24・見出し JP/Heading/S）
- `components/admin/settings/VideoSlotField.tsx` — 動画1枠ぶん。圧縮とアップロードまでを担い、結果のURLを親に返す
- 保存（DB書き込み）と旧オブジェクトの掃除はページ側（`app/admin/(protected)/settings/page.tsx`）

**セクションの増やし方**：`SettingsSection` をもう1つ並べるだけ。受注停止トグル（`lib/api.ts:355-370` に API はあるが画面が無い）はここに入れるのが自然。

### C-2. 入力項目の一覧

スロット2つとも同じ構成。

| # | 項目 | 形式 | 備考 |
|---|---|---|---|
| 1 | 表示ON/OFF | `components/ui/ToggleSwitch.tsx`（40×22） | **文言はスロットごとに変える**。「注文ホームに動画を表示する」／「着地画面に動画を表示する」。OFF で動画枠ごと消える |
| 2 | 動画（現在の状態） | SP: 80×80 ／ **PC: 16:9・幅240px** の再生マーク付きタイル | SP は `MediaUploaderField` と同じ80角。PC は実際の見え方に近づけて大きくしている |
| 3 | 削除 | タイル右上の× → 確認ダイアログ | C-6 |
| 4 | 追加 / 差し替え | 破線の全幅ボタン（h-40） | 動画の有無でラベルが変わる |
| 5 | 最終更新 | `最終更新: 2026/08/03 14:32` | 旧F-11 = 表示する。**動画の有無にかかわらず常に出す**（未保存のときは「まだ変更されていません」） |
| 6 | 注釈テキスト | 静的の**箇条書き**（店舗は編集できない） | スロットごとに文言が違う。C-4 |

**カードの幅**：メニュー管理と同じく幅の上限を付けず、コンテンツ幅をそのまま使う。横のパディングは SP16 / PC24。

**入れなかった項目**：音声ON/OFF（`VideoBlock.tsx:71` も `TopScreen.tsx` も常に muted）、ループON/OFF（常に loop）、表示位置・サイズ（「見た目は変えない」の前提から外れる）、ポスター画像の手動指定（動画の1フレーム目から自動生成する）。

### C-3. 保存の挙動

**操作のたびに即時保存する。「保存」ボタンは置かない。**

- トグルは**楽観的更新**。ローカルを先に反転 → RPC → 失敗したときだけロールバックして「保存できませんでした」を出す（CLAUDE.md 4章）
- 動画の差し替えは「圧縮 → アップロード完了 → `save_store_media()` を1回」。DBの切り替えは1トランザクションなので、**差し替え途中の状態がお客様側に出ることはない**
- 保存が**通ってから**、参照されなくなった旧オブジェクトを `deleteUploadedMedia()`（`lib/storage.ts:111-129`）で消す。先に消すと、保存に失敗したときお客様側が見ているURLが死ぬ
- 保存に失敗したときは、直前にアップロードしたオブジェクトを掃除する（Storage に孤児を残さない）
- 初期データの `/images/...`（`public/` 配下の相対パス）は Storage に無いので、`deleteUploadedMedia` 側で自動的に対象外になる

### C-4. 注釈テキスト（実装した文言）

**2か所で切り取られ方が違うので、同じ文言は使っていない。箇条書きで出す。**
文言は `app/admin/(protected)/settings/page.tsx` の `SLOT_CONFIG` にある。
**推奨仕様（解像度・長さ・形式）は1行にまとめる**（読み飛ばされないよう、他の説明と混ぜない）。

**① 注文ホームのヒーロー動画**（トグル: 注文ホームに動画を表示する ／ `hint`: メニュー一覧の先頭に、横長の帯として出ます。）

> - 16:9（横長）に自動でトリミングされます。上下が切れないよう、16:9で書き出した動画をアップロードしてください。
> - 推奨: 1920×1080（16:9）・15秒以内・mp4
> - 音声は再生されません。
> - アップロードした動画は自動的に圧縮されます（最大1280×720・mp4）。元のファイルは保存されません。

**② 二次元コード着地画面の背景動画**（トグル: 着地画面に動画を表示する ／ `hint`: お客様が二次元コードを読み取って最初に開く画面の、背景いっぱいに出ます。）

> - お客様の端末の画面いっぱいに敷かれます。画面の縦横比に合わせて拡大されるため、上下または左右が大きく切れます。見せたいものは中央に寄せてください。
> - 推奨: 1080×1920（縦長 9:16）・15秒以内・mp4
> - 上に白い文字とロゴが重なるので、暗めの映像が向いています。音声は再生されません。
> - アップロードした動画は自動的に圧縮されます（長辺1280px以内・mp4）。縦横比は元のまま保たれます。元のファイルは保存されません。

置き場所は既存に合わせてフィールド本体の**下**（`type-jp-label text-text-tertiary`、`MediaUploaderField.tsx:188-191` と同じ）。上に置くと読まれずに操作される。

### C-5. 状態の一覧（実装済み）

| 状態 | 表示 |
|---|---|
| 読み込み中 | `skeleton` クラスの箱 |
| 動画なし | タイルを出さず、破線ボタンが「＋ 動画を追加」になる |
| 検証中 | 「動画を確認しています…」＋不定形バー |
| 圧縮中 | 「圧縮しています…」＋**進捗バーと%**＋「動画の長さと同じくらいの時間がかかります。この画面を閉じずにお待ちください。」 |
| アップロード中 | 「アップロードしています…」＋不定形バー |
| 圧縮成功 | 緑の枠に `1920×1080 → 1280×720 ／ 12.4 MB → 2.2 MB（−82%）に圧縮しました。` |
| 元を採用 | 緑の枠に `元のファイル（694.6 KB）が十分に軽いため、そのまま使用します。` |
| 上限超過・圧縮失敗 | 赤い枠にインライン表示。**`alert()` は使わない。**アップロードは実行されない |
| アップロード失敗 | 同じく赤い枠。ボタンは再度押せる状態に戻る |
| 保存失敗 | ローカル状態をロールバックし、ページ上部に「保存できませんでした。通信環境をご確認のうえ、もう一度お試しください。」 |
| 削除確認 | 中央ダイアログ（C-6） |

### C-6. 削除するときの確認

**確認あり。**器は `app/admin/(protected)/menu/page.tsx:941-970`（メニュー削除）と同じ。`window.confirm()` は使っていない。

> **動画を削除しますか？**
> 削除するとトップページから動画が消えます。この操作は取り消せません。
> 一時的に隠したいだけの場合は、「トップページに動画を表示する」をオフにしてください。

ボタンは `キャンセル` / `削除する`（`bg-status-urgent`）。3文目は「非表示にしたいだけなのに削除した」を防ぐためのもので、必ず入れる。

**差し替えには確認を出さない。**上書きは日常操作で、直前の状態はタイルで見えている。

---

## D. 圧縮の方式（実装）

### D-1. 採用した方式：ブラウザ側 WebCodecs で H.264/mp4 に再エンコード

実装は `lib/videoCompression.ts`。検討時に比較した5方式のうち方式3を採った。

- **サーバー側 ffmpeg を採らなかった理由**：A-7 のとおり、アップロードは元から Vercel を経由せずブラウザ → Supabase Storage 直。サーバー圧縮はこの経路をわざわざ作り替え、100MB のボディ上限を背負い、ffmpeg バイナリでビルドを膨らませ、Active CPU 課金を発生させる。年に数回の操作に釣り合わない
- **MediaRecorder を採らなかった理由**：Chrome の出力が webm になる。お客様の主端末は iPhone で、iOS Safari の webm 再生は信頼できない。**客席で動画が映らない事故に直結する**

**追加した依存**：`mp4-muxer`（MIT・ランタイム依存なし）。`import()` で動的読み込みしているので、管理画面のこのフローに入るまでロードされない。

### D-2. 処理の流れ

1. `inspectVideo()` で寸法・長さ・サイズを読む
2. `validateVideo()` で上限を判定。**超えていたらエンコードを始めずに拒否する**
3. 出力寸法を決める（D-3）
4. 画面外に置いた `<video>` を再生し、`requestVideoFrameCallback` でフレームを取り出す → canvas に cover 配置で描画 → `VideoFrame` → `VideoEncoder`（avc）→ `mp4-muxer`
5. 1フレーム目を別 canvas に控え、既存の `compressImage()`（`lib/imageCompression.ts:93`）に通して WebP のポスターにする
6. できた `File` を既存の `uploadMenuVideo()` / `uploadMenuImage()` に渡す。**アップロード経路は変えていない**（保存先は `top/` プレフィックス）

**制約**：デコードが再生速度に律速される。15秒の動画なら圧縮に15秒前後かかる。C-5 の進捗表示は必須。

**未対応ブラウザ**：`VideoEncoder` か `requestVideoFrameCallback` が無ければ「このブラウザでは動画を圧縮できません。Chrome または Safari の最新版でお試しください。」で止める。**未圧縮のまま上げる逃げ道は作っていない**（旧F-9 = なし）。

### D-3. 出力する具体値

| 項目 | 値 | 定数 |
|---|---|---|
| ビットレート | **1.2 Mbps** | `VIDEO_BITRATE` |
| フレームレート | 30fps 上限（元が30未満ならそのまま） | `VIDEO_MAX_FPS` |
| 長辺 | 1280px 上限。**拡大はしない** | `VIDEO_MAX_LONG_EDGE` |
| 総画素数 | 921,600（＝1280×720）上限 | `VIDEO_MAX_PIXELS` |
| コーデック | H.264 `avc1.42E01F`（Constrained Baseline / Level 3.1） | — |
| コンテナ | mp4（`fastStart: "in-memory"` ＝ moov を先頭に） | — |
| キーフレーム間隔 | 2秒 | — |
| 音声 | **完全に破棄** | — |
| ポスター | 1フレーム目 → `compressImage()`（長辺1440px / 300KB以内 / WebP） | — |

**縦横比の扱いはスロットで分ける**（`VideoFit`）。

| スロット | `fit` | 挙動 |
|---|---|---|
| `order_hero` | `cover-16x9` | **16:9 に中央基準でトリミングして焼き込む。**`VideoBlock.tsx:72` がどのみち切るので、先に切っておけば切られた分を転送しなくて済む |
| `landing_background` | `keep-aspect` | **縦横比は元のまま。**端末の画面比に合わせて `TopScreen.tsx` 側が切る。ここで固定比に焼くと縦動画が壊れる |

Level 3.1 の上限は 921,600 画素。1280×720 も 720×1280（縦）もちょうど収まる。

### D-4. 圧縮後が元より大きい場合

**元のファイルをそのまま使う。**`VideoCompressionResult.usedOriginal` が true になり、画面に
`元のファイル（694.6 KB）が十分に軽いため、そのまま使用します。` と出る。

現行の `background.mp4`（695KB）は既に手作業で高度に圧縮されているため、1.2 Mbps で再エンコードすると必ず重くなる。実測でもこの分岐に入ることを確認した。

**ただし元が mp4 のときだけ。** mov / webm を素通しすると、軽くはなっても iOS Safari で再生できない動画が客席に出る可能性があるため、そこは必ず再エンコードする。

### D-5. 元動画を残すか

**残さない。圧縮後だけを Storage に置く。**注釈にも「元のファイルは保存されません」と明記している。
差し替え時の旧オブジェクトは、DB保存が通ってから削除する（C-3）。

### D-6. 上限

| 項目 | 上限 | 定数 |
|---|---|---|
| ファイルサイズ（入力） | 200MB | `VIDEO_MAX_INPUT_BYTES` |
| 長さ | 30秒（推奨は15秒以内） | `VIDEO_MAX_DURATION_SEC` |
| 形式 | mp4 / mov / webm（`accept` は `MediaUploaderField.tsx:182` と同じ） | — |

入力の 200MB は、既存の商品動画の 50MB（`app/admin/(protected)/menu/page.tsx:50`）より緩い。あちらは「圧縮しないから」の値で、こちらは必ず圧縮するため。

---

## E. DBスキーマ（実装＝案E-2）

ファイルは `supabase/store_media.sql`。**まだ適用していない**（G を参照）。

### E-1. テーブル

```sql
CREATE TABLE IF NOT EXISTS public.store_media (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  slot        text        NOT NULL,   -- 'order_hero' | 'landing_background'
  kind        text        NOT NULL DEFAULT 'video',
  url         text,                   -- NULL = 動画なし
  poster_url  text,
  enabled     boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slot)
);
```

**`slot` に CHECK 制約は付けていない。**許可値は `save_store_media()` 側で検査する。スロットを増やすときに `ALTER TABLE` ではなく関数の差し替えで済ませるため。

### E-2. RLS

- `store_media_select_all` — `FOR SELECT TO anon, authenticated USING (true)`。お客様側の `/` と `/order` が未認証で読む。入っているのは公開バケットの動画URLだけで、`stores` が既に同じ扱いになっている（A-8）
- **書き込みポリシーは置かない。**保存は `save_store_media()`（`SECURITY DEFINER`・manager 限定）だけが入口。`best_sellers.sql` と同じ方針。`REVOKE ALL ... FROM PUBLIC` ＋ `GRANT EXECUTE ... TO authenticated`

### E-3. Storage

**新しいバケットは作らない。**既存の `menu-videos`（`supabase/menu_videos.sql`）と `menu-images`（`supabase/setup.sql`）を `top/` 配下で使う。どちらも `public: true` で、SELECT 全員 / INSERT・DELETE authenticated のポリシーが既に入っているため追加作業は不要。

### E-4. 初期データ

STEP 5 で、移行前にコードへ直接書かれていた値をそのまま入れる。

| slot | url | poster_url |
|---|---|---|
| `order_hero` | `/images/hero/background.mp4` | `/images/pancake/p1.webp` |
| `landing_background` | `/images/hero/background.mp4` | `/images/hero/background-poster.webp` |

`/images/...` は `public/` 配下の相対パス。Next.js がそのまま配信するので `<video src>` にも使える。Storage には置かない。**これにより、マイグレーション適用後の見え方が一切変わらない。**

---

## F. 残っている未決事項

解消したもの（旧F-1 / F-4 / **F-5** / F-6 / F-8 / F-9 / F-10 / F-11）は削除した。
旧F-5（`stores` の anon SELECT）は「既に開いていた」ことが確認できたため解消（A-8）。
旧F-6（Supabase のプラン）は「無料枠のまま」と判明したため、未決ではなく
**リオープン前の必須作業**として A-8 の警告枠に移した。

| # | 論点 | 選択肢 | 影響 |
|---|---|---|---|
| **F-2** | 初期状態では `/` と `/order` が同じ `background.mp4` を共有している。**適用後は別スロットなので片方だけ差し替えられる**が、それが意図どおりか | 別々でよい / 常に同じものを使いたい | 「常に同じ」にしたいなら、片方を保存したときにもう片方も同じURLにする導線が要る（現状はない） |
| **F-3** | 「店舗設定」に受注停止トグルを足すか | 足す / 当面なし | `lib/api.ts:355-370` に `setAcceptingOrders()` があるが画面が無い（＝店舗側から受注を止められない）。器はできたので、足すなら安い |
| **F-7** | 圧縮に対応していないブラウザで店舗が詰まったときの逃げ道 | 現状のまま（拒否） / 別途用意 | 旧F-9 の決定により逃げ道なしで実装した。管理画面は PC/タブレット想定なので実害は小さいはずだが、実運用で詰まったら再検討 |
| **F-8** | 動画の**プレビュー**を実寸（390px幅）で出すか | 出す / 現状の80pxタイルのまま | 今は 80×80 のサムネイルのみ。16:9トリミングの結果を上げる前に確認したい、という要望が出たら追加する |
| **F-9** | 圧縮の所要時間が長いときの中断（キャンセル）操作 | 追加する / 現状のまま | 30秒上限なので最大30秒前後。今は中断ボタンを置いていない |

---

## G. マイグレーションの適用手順（天真が実行）

**AI は適用していない。**以下は天真が Supabase ダッシュボードで行う。

**⚠ 2ファイルある。必ず `store_media.sql` → `store_display_settings.sql` の順で流すこと。**
後者は前者が作ったテーブルに列を足す差分なので、逆順だと失敗する。

1. Supabase ダッシュボード → SQL Editor を開く
2. `supabase/store_media.sql` の **STEP 0** のコメント内のクエリを実行し、店舗が1件であることを確認する
   ```sql
   SELECT id, name FROM public.stores ORDER BY created_at;
   ```
3. `supabase/store_media.sql` の全文を貼り付けて実行する（STEP 1〜5）
4. **STEP 6** の確認クエリを実行し、2件入っていることを確認する
   ```sql
   SELECT slot, enabled, url, poster_url, updated_at FROM public.store_media ORDER BY slot;
   ```
5. お客様側の `/` と `/order` を開き、動画が今までどおり出ることを確認する
6. **`supabase/store_display_settings.sql` の全文を貼り付けて実行する**（STEP 1〜2）
7. **STEP 3** の確認クエリを実行し、2件とも `background_type = 'video'` になっていることを確認する
   ```sql
   SELECT slot, enabled, background_type, background_color, url, image_url
     FROM public.store_media ORDER BY slot;
   ```
8. もう一度お客様側の `/` を開き、**背景動画が変わらず出る**ことを確認する
9. 管理画面（manager でログイン）→ サイドナビ「表示設定」→「動画設定」で、
   トグル・背景タイプの切り替え（色 / 画像 / 動画）・差し替え・削除が動くことを確認する
10. 「ベストセラー」タブで、登録・並べ替え・保存が動くことを確認する

**適用前でも壊れない。** `lib/storeMedia.ts` の `fetchStoreMedia()` は例外を投げず、テーブルが無ければ `STORE_MEDIA_FALLBACK`（＝移行前と同じアセット）を返す。実際、適用前の状態でお客様側の画面が従来どおり表示されることを確認済み。

---

## H. 表示設定への作り替え（2026-08-04）

### H-1. 画面名・ナビ・ルーティング

- サイドナビと Top Bar の文言を「店舗設定」→「**表示設定**」に変更（`lib/staffRoles.ts`）
- URL を `/admin/settings` → `/admin/display` に変更。**旧URLは `next.config.mjs` の
  redirects で 307 リダイレクト**（`/admin/takeout` → `/admin/menu` と同じ扱い）
- `REDESIGNED_PREFIXES`（`app/admin/(protected)/layout.tsx`）も差し替えた
- **`ADMIN_NAV_ITEMS` の並び順は変えていない。**manage 群の末尾のままなので、
  どのロールでも `allowed[0]`（＝ログイン直後の着地先）は変わらない

> **ナビのアイコンについて。**「ダッシュボードと同じ棒グラフになっている」という
> 指摘を受けて調べたが、**`NAV_ICONS`（`components/admin/nav/NavContent.tsx`）は
> 以前から `sliders` を指していた**（`dashboard` は棒グラフ、`sliders` は
> つまみ2つの別デザイン）。今回はキーを `/admin/settings` → `/admin/display` に
> 付け替えただけで、絵は変えていない。

### H-2. 背景タイプ（色 / 画像 / 動画）

着地画面（`/`）の背景に何を使うかを選べるようにした。`store_media` に3列を足している
（`supabase/store_display_settings.sql`）。

| 列 | 型 | 既定 | 用途 |
|---|---|---|---|
| `background_type` | text | **`'video'`** | `color` / `image` / `video` |
| `background_color` | text | NULL | `#RRGGBB`（大文字） |
| `image_url` | text | NULL | `image` のときの画像。**動画の `url` とは別に持つ** |

**既存店舗の見え方を守っている仕掛けは3段ある。**

1. `ALTER TABLE ... DEFAULT 'video'` — 既存行は自動的に `video` になる
2. `parseBackgroundType()`（`lib/storeMedia.ts`）— NULL・未知の値は `"video"` に倒す
3. `fetchStoreMedia()` — 3列を含むクエリが失敗したら**旧い列だけで引き直す**。
   マイグレーション未適用の DB でもお客様側が壊れない

画像を `url` に相乗りさせず `image_url` に分けたのは、「動画 → 画像 → 動画に戻す」の
往復で先に入れた動画が消えるのを避けるため。

### H-3. 文字色の自動切り替え

背景が**色のときだけ**、選ばれた色の明るさから文字とロゴの色を決める。
画像・動画は常に白（暗幕65%が乗るため）。実装は `lib/backgroundColor.ts` の1か所だけで、
**管理画面のプレビューとお客様側が同じ関数を通る**（別々に書くとズレるため）。

- 式: WCAG 2.x の相対輝度 `L = 0.2126R + 0.7152G + 0.0722B`（sRGB→linear 変換つき）
- しきい値: **`L > 0.201687` なら黒文字**、それ以外は白文字
- しきい値の求め方: 黒文字(`#1A1A1A`)にしたときのコントラスト比と、白文字(`#FFFFFF`)に
  したときのコントラスト比が等しくなる点。`(L+0.05)/(L_ink+0.05) = 1.05/(L+0.05)` を解いた値。
  「0.5」のような直感的な数字ではなく**どちらが読みやすいかの分岐点そのもの**なので、
  境目の色でも必ず読みやすい方に倒れる
- 明るい背景ではロゴも `logoSmallBlack.webp` に差し替える（白ロゴでは見えないため）

パレットは20色。前半10色は `tag/*` と同値、後半10色は固定値。
**どちらも `lib/backgroundColor.ts` にリテラルで持ち、デザイントークンを参照していない。**
店舗が選ぶ「背景の選択肢」であって、ブランド切り替え（YORKYS / Izakaya）で
中身が変わってはいけないため。各行に `design-qa-allow` を付けて意図を明示している。

### H-4. HEX の不正入力

- 受け入れる揺らぎ: 先頭の `#` の有無 / 大文字小文字 / 3桁の短縮形（`#abc` → `#AABBCC`）/ 前後の空白
- **正しい形になるまで保存しない。**打っている途中は必ず不正な値を経由するため、
  1文字ごとに保存すると着地画面の色が壊れる
- 不正な間は入力欄の枠を `status-urgent` にし、下に
  「#RRGGBB の形式で入力してください（例: #2C2A28）。正しい形になるまで背景色は変わりません。」を出す
- **不正なまま入力欄から離れたら、最後に確定している色に戻す**（中途半端な文字列を残さない）
- サーバー側（`save_store_media`）でも `^#[0-9A-Fa-f]{6}$` を検査する。
  RPC を直接叩かれても壊れないようにするため

### H-5. ベストセラーの移設

メニュー管理の Top Bar のボタンとモーダル（`components/admin/menu/BestSellerModal.tsx`）を
削除し、`components/admin/display/BestSellerPanel.tsx` として表示設定のタブに移した。
**中身の機能は変えていない。**

- フッターの「キャンセル / 保存する」は「保存する」1つに（画面内なので戻り先が無い）
- 「選ぶ」は Outline に（黒いボタンが2つ並ぶと主従が読めない）
- 並び替えは **PC=⠿ドラッグ / SP=▲▼**。SPは既存の `components/admin/ReorderButtons.tsx` を流用
- SPの商品追加フォームは縦積み。各フィールドと「選ぶ」は44px以上

### H-6. お客様側（`/`）

`components/top/TopScreen.tsx` が `resolveLandingBackground()` の結果で出し分ける。

| 背景 | 地の色 | 暗幕65% | 文字・ロゴ |
|---|---|---|---|
| 色 | 選んだ色 | **敷かない**（色が濁るため） | 明るさで自動 |
| 画像 | `bg-black` | 敷く | 白 |
| 動画 | `bg-black` | 敷く | 白 |
| 表示OFF・未設定 | `bg-black` | 敷く | 白 |

> **⚠ 前景のクラスを inline style に置き換えないこと。**
> いったん全部 `rgba()` の inline style に統一したところ、同じ色のはずなのに
> ブラウザの合成で **1/255 だけずれるピクセルが925個**出た（実測）。
> そのため **light（＝動画・画像・未設定）のときは従来の Tailwind クラス
> （`text-white/75` など）をそのまま使い、dark のときだけ inline で塗る**形にしてある。
> この形で main と比較して**差分0px**であることを確認済み。

---

## 付録：本書が触れていないこと

- Figma のデザイン。既存の管理画面コンポーネントの流用で作ったため、新規のデザイン作業は発生していない
- 商品ごとの動画（`menu_items.video_url`）。こちらは従来どおり `/admin/menu` の商品編集で扱い、**圧縮は入っていない**（50MB超で拒否するだけ）。同じ圧縮を載せるかは別タスク
