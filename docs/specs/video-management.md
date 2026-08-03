# トップページ動画の管理機能 仕様（提案）

## ステータス

**提案。天真の承認待ち。実装未着手。コード・マイグレーションともに未作成。**

このドキュメントは調査結果と提案だけを含む。E（DBスキーマ）と B の採用案は天真の承認が必要。

_作成: 2026-08-03_

---

## 0. このドキュメントの前提

- お客様側のトップページに動画が貼ってあるが、管理画面から差し替え・削除・非表示にする手段が一切ない
- **トップページの見た目は変えない。**変えるのは管理側だけ
- 実装前に、B の採用案・C の文言・D の圧縮方式・E のスキーマについて天真の判断が要る

---

## A. 現状（調べた事実）

### A-1. 「トップページの動画」は2か所ある

コード上、お客様側で動画が出る箇所は2つあり、**別物**。

| # | 画面 | URL | 動画の役割 | 形 |
|---|---|---|---|---|
| ① | QR着地／テイクアウト入口 | `/` | 全画面の背景動画（暗幕65%＋ロゴ・卓番） | 画面全体に `object-cover` |
| ② | 注文ホーム（社内で「トップページ」と呼んでいる画面） | `/order` | メニュー一覧の先頭に置くヒーロー動画 | **16:9 固定**に `object-cover` |

**今回の対象は② `/order` のヒーロー動画。** 依頼文にある「16:9で自動トリミングされる」という注意書きは②にだけ当てはまる（①は縦長の画面全体に敷くので 16:9 ではない）。①をどうするかは F-1 に未決として挙げる。

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

### A-3. ② `/order` のヒーロー動画の実装（今回の対象）

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

---

## B. 配置場所の案（3案）

3案とも、**入力項目・文言は同じ**（C の内容）。変えるのは「器」だけ。

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

### 推奨：**案B**

理由は3つ。

1. **見つけやすさが目的に直結する。**この機能は「一度設定して終わり」ではなく、季節ごとに動画を差し替える使い方を想定している。サイドナビに文字で出ている案Bが、モーダルに隠れる案Aより明確に優る
2. **リスクが小さい。**`SUB_ITEMS` に1行足すだけで、`ADMIN_NAV_ITEMS` にも各ロールの着地先ロジックにも触らない。案Cはそこに触る
3. **成長の余地がある。**`/order` の見せ方に関する設定は既に散らばっている（ベストセラーはメニュー管理の Top Bar の中）。「トップページ設定」というページを1枚作れば、それらを後から寄せる先ができる。案Aは寄せる先を作らないまま Top Bar のボタンを増やす方向に進む

**案Cを推さなかった理由**：分類の正しさでは案Cが上だが、今回の中身は動画1本。器を先に作るコストと、ロール着地先ロジックに触るリスクが、得られる整理と釣り合わない。ただし**受注停止トグルに UI を付ける話が動くなら、その時点で案Cに切り替えるべき**（F-3）。

---

## C. 画面の中身（推奨案B `/admin/menu/top` について）

Figma はまだ作らない。以下は文章での合意用。

### C-1. 画面構成

```
TopBar「トップページ設定」（SPはハンバーガー付き）
└ main
   ├ セクション見出し「ヒーロー動画」＋ 1行の説明
   ├ [1] 表示トグル
   ├ [2] 動画（現在の状態 / 差し替え / 削除）
   ├ [3] 注釈テキスト（静的）
   ├ [4] プレビュー（390px幅・16:9・実際と同じ Video16x9）
   └ [5] 保存ボタン（右下固定 or 末尾）
```

### C-2. 入力項目の一覧

| # | 項目 | 形式 | 既定値 | 備考 |
|---|---|---|---|---|
| 1 | トップページに動画を表示する | `components/ui/ToggleSwitch.tsx`（40×22） | ON | OFF のとき動画枠ごと消える（`VideoBlock.tsx:45` の `return null` がそのまま効く） |
| 2 | 動画ファイル | ファイル選択＋現在の動画のサムネイル | 未設定 | 1本のみ。差し替えは新規選択で上書き |
| 3 | 削除 | サムネイル右上の×（`MediaUploaderField.tsx:130-137` と同じ形） | — | 確認あり（C-5） |
| 4 | ポスター画像（先頭フレーム） | **自動生成。**上書き用の任意ファイル選択も置く | 自動 | `VideoBlock.tsx:30` が `media` 中の image を poster に使う。無いと再生開始まで灰色の枠が出る |
| 5 | 注釈テキスト | 静的表示（店舗は編集できない） | — | C-4 |

**トグルと動画は独立させる。**「今月は動画を出さない」を、ファイルを消さずにできる状態にしておく。削除は「もう使わない」ときだけの操作にする。

**入れない項目**（提案としての判断。異論があれば差し戻し可）

- 音声のON/OFF — `VideoBlock.tsx:71` は常に `muted`。自動再生の前提が muted なので、選ばせると「音が出ない」問題を必ず生む
- ループのON/OFF — `VideoBlock.tsx:70` は常に `loop`。切る意味が薄い
- 表示位置・サイズの変更 — 「トップページの見た目は変えない」という今回の前提から外れる

### C-3. 保存の挙動

- ファイル選択の瞬間に Storage へアップロードし、即プレビューに反映する（`app/admin/(protected)/menu/page.tsx` の既存フローと同じ）
- **保存せずに離脱したら `deleteUploadedMedia()`（`lib/storage.ts:111-129`）で孤児を掃除する。**既存の作法をそのまま使う
- トグルの切り替えは**楽観的更新**（CLAUDE.md 4章）。ローカル状態を先に反転 → 永続化 → 失敗時だけロールバック
- 「保存」を押すまでお客様側には反映しない（差し替え途中の状態が客席に出ないようにする）

### C-4. 注釈テキストの文言（案）

**主注釈（トリミングについて）— 3案**

| 案 | 文言 | 性格 |
|---|---|---|
| **文言案1（推奨）** | 16:9（横長）に自動でトリミングされます。上下が切れないよう、16:9で書き出した動画をアップロードしてください。 | 何が起きるか＋どうすればいいかが1文ずつ。既存の `MediaUploaderField.tsx:190` と同じ2文構成 |
| 文言案2 | 16:9で自動トリミングされるため、16:9のサイズでアップロードしてください。 | 依頼文そのまま。最短。ただし「トリミングされる」の結果（＝上下が切れる）が伝わりにくい |
| 文言案3 | 動画は横長（16:9）の枠に合わせて表示されます。縦長の動画をアップロードすると、左右に合わせて拡大され、上下が大きく切れます。 | いちばん親切だが長い。3行になり、注釈が主役になってしまう |

推奨は**文言案1**。「上下が切れる」という結果を明示しつつ2文に収まる。

**副注釈（推奨仕様）**

> 推奨：1920×1080・15秒以内・mp4。音声は再生されません。

**副注釈（自動圧縮）** — D の方式が決まってから確定させる。現時点の案：

> アップロードした動画は自動的に圧縮されます（1280×720 / mp4）。元のファイルは保存されません。

**注釈の置き場所**：既存に合わせ、アップローダ本体の**下**に `type-jp-label text-text-tertiary` で置く（`MediaUploaderField.tsx:188-191` と同じ）。上に置くと読まれずに操作される。

### C-5. 状態の一覧

| 状態 | 表示 | 備考 |
|---|---|---|
| **動画なし（初期）** | 破線の「＋ 動画を追加」ボタンのみ。プレビュー枠には「動画は表示されていません」のプレースホルダ | トグルは ON のままでよい（動画が無ければ枠ごと出ないため実害なし）。ただしトグルだけ ON で動画が無い状態は文言で明示する |
| **読み込み中（画面初期）** | 既存の `skeleton` クラスで 16:9 の箱 | `app/order/page.tsx:95` と同じ形 |
| **検証中** | 「動画を確認しています…」 | 寸法・長さ・サイズを読む数百ms |
| **圧縮中** | 進捗バー＋「圧縮しています… 42%」＋所要時間の目安 | D の方式では**動画の長さと同程度の時間がかかる**（15秒の動画で15秒前後）。無言で待たせない。**この間ページを離れないよう明示する** |
| **アップロード中** | スピナー（`MediaUploaderField.tsx:172-176` と同じ）＋「アップロードしています…」 | 進捗は Supabase JS が返さないので不定形スピナーでよい |
| **成功** | プレビューが差し替わる＋トースト「圧縮しました 48.2MB → 3.1MB（−94%）」 | `app/admin/(protected)/menu/page.tsx:925-940` の圧縮完了トーストと同じ形 |
| **拒否（長すぎ／大きすぎ）** | インラインの赤いメッセージ。**`alert()` は使わない** | 既存の動画側は `alert()`（同 358-360行）だが、これは新画面では踏襲しない |
| **失敗（圧縮）** | 「動画を圧縮できませんでした。別の形式（mp4）で書き出して再度お試しください。」＋再試行ボタン | 元ファイルをそのまま上げる導線は**出さない**（D-4 の上限を超えた素材が客側に出てしまうため） |
| **失敗（アップロード）** | 「アップロードに失敗しました。通信環境をご確認のうえ再度お試しください。」＋再試行ボタン | 圧縮済みファイルはメモリに残っているので、再圧縮せず再送できる |
| **保存失敗** | トグル／URL をロールバックし、「保存できませんでした」を表示 | 楽観的更新の失敗時（CLAUDE.md 4章） |
| **削除確認** | 確認モーダル（C-6） | |
| **未保存で離脱** | `beforeunload` で警告 | アップロード済み・未保存のファイルは `deleteUploadedMedia()` で掃除 |

### C-6. 削除するときの確認

**確認あり。**理由：削除は取り消せず（Storage からもオブジェクトを消す）、かつ**お客様側の見え方がすぐ変わる**操作だから。

- 形式：既存に合わせた確認モーダル（`app/admin/(protected)/menu/page.tsx:949` の「メニューを削除しますか？」と同じ器）。`window.confirm()` は使わない（`SeatSettingsModal.tsx:103` は使っているが、新デザイン側の作法はモーダル）
- 文言案：
  > **動画を削除しますか？**
  > 削除するとトップページから動画が消えます。この操作は取り消せません。
  > 一時的に隠したいだけの場合は、「トップページに動画を表示する」をオフにしてください。
- 3文目を必ず入れる。「非表示にしたいだけなのに削除した」を防ぐのが、この確認の主目的
- ボタン：`キャンセル` / `削除する`（危険色）
- **差し替え（新しい動画を選ぶ）には確認を出さない。**上書きは日常操作で、直前の状態はプレビューで見えている

---

## D. 圧縮の方式

### D-1. 選択肢の評価

| # | 方式 | 新規依存 | Vercel制約 | 出力形式 | 判定 |
|---|---|---|---|---|---|
| 1 | 圧縮しない（検証と上限だけ） | なし | なし | 元のまま | **却下。**依頼の「自動的に圧縮される」を満たさない |
| 2 | ブラウザ：`MediaRecorder` ＋ canvas | なし | なし | **Chrome は webm(VP8/VP9)** | **却下。**出力が webm になる。お客様の主端末は iPhone で、iOS Safari の webm 再生は信頼できない。**客席で動画が映らない事故に直結する** |
| 3 | **ブラウザ：WebCodecs（`VideoEncoder`）＋ mp4 muxer** | `mp4-muxer` 相当（数十KB、動的import） | **なし**（アップロードは元から Supabase 直行） | **mp4 / H.264** | **推奨** |
| 4 | サーバー：Vercel Function ＋ ffmpeg | `ffmpeg-static`（約80MB） | 300秒・100MBボディ・Active CPU課金 | mp4 / H.264 | 却下（理由は下記） |
| 5 | 外部サービス（Mux / Cloudflare Stream 等） | SDK＋契約 | なし | HLS/mp4 | 却下（理由は下記） |

**方式4を却下する理由**：A-7 のとおり、**現状アップロードは Vercel を経由していない**（ブラウザ → Supabase Storage 直）。方式4はこの経路をわざわざ Vercel 経由に作り替え、100MB のボディ上限を新たに背負い、ffmpeg バイナリでビルド成果物を膨らませ、Active CPU 課金を発生させる。得るものは「ブラウザ差を気にしなくてよい」だけ。**年に数回・1店舗1本の操作にこの投資は釣り合わない。**

**方式5を却下する理由**：品質と配信効率では最良だが、新しいベンダー契約と月額が発生する。動画1本・15秒のループにアダプティブ配信は要らない。「アクセント4色の差し替えだけでブランド切替が済む」構造（CLAUDE.md 4章）に外部依存を1つ足す割に合わない。

### D-2. 推奨方式：ブラウザ側 WebCodecs で H.264/mp4 に再エンコード

**処理の流れ**

1. `<video>` に読み込み、`loadedmetadata` で 幅・高さ・長さ を取得（`lib/imageCompression.ts:55-68` の `inspectImage` と同じ「まず検査する」作法）
2. D-4 の上限を超えていたら**この時点で拒否**（エンコードを始めない）
3. 出力寸法を計算（16:9 に合わせる。D-3）
4. `requestVideoFrameCallback` でフレームを取り出し → canvas に描画 → `VideoFrame` → `VideoEncoder`（`avc1`）→ mp4 muxer
5. できた `File` を既存の `uploadMenuVideo()`（`lib/storage.ts:68-78`）に渡す。**アップロード経路は一切変えない**
6. 同時に先頭フレームを canvas から取り出し、既存の `compressImage()`（`lib/imageCompression.ts:93`）で WebP 化して `uploadMenuImage()` へ。これがポスター画像になる

**フォールバック**：`VideoEncoder` が使えない環境（未対応ブラウザ）では、
「このブラウザでは動画を圧縮できません。Chrome または Safari の最新版でお試しください。」を出して**拒否する**。管理画面は PC / タブレット（CLAUDE.md 1章）で、Chrome / Edge / Safari 16.4+ が対象。ここで「未圧縮のまま上げる」逃げ道を作ると、上限を超えた素材が客側に出る。

**制約として認識しておくこと**：この方式はデコードを再生速度に律速される。**15秒の動画なら圧縮に15秒前後かかる。**C-5 の「圧縮中」状態で進捗と目安時間を必ず出す。

### D-3. 出力する具体値

| 項目 | 値 | 根拠 |
|---|---|---|
| 解像度 | **1280 × 720**（長辺基準で縮小のみ。拡大しない） | お客様側の表示幅は最大 448px（`app/order/page.tsx:206` の `max-w-md`）。DPR3 でも実効 1344px。1280 でほぼ等倍。1920 にしても見た目はほとんど変わらず転送量だけ倍増する |
| 縦横比 | **16:9 に強制**（`object-cover` と同じ規則で中央基準にトリミング） | `VideoBlock.tsx:72` がどのみち切る。**先に切っておけば、切られた分を転送しなくて済む** |
| フレームレート | **30fps 上限**（元が30未満ならそのまま） | 60fps は容量が倍。ループ背景に不要 |
| コーデック | **H.264 / `avc1.42E01E`（Baseline 3.0）** | iOS / Android / PC の全部で確実に再生される。`VideoBlock.tsx` は `<video>` タグ直で、HLS 等の再生ライブラリは持っていない |
| コンテナ | **mp4**（`faststart` 相当＝moov を先頭に） | moov が末尾だと再生開始前に全体をダウンロードすることになる |
| ビットレート | **2.0 Mbps**（可変、上限 2.5 Mbps） | 720p30 のループ映像では十分。15秒で約 3.7MB |
| キーフレーム間隔 | **2秒** | ループ再生の巻き戻しを軽くする |
| 音声 | **完全に破棄** | `VideoBlock.tsx:71` が常に `muted`。持っても再生されず、容量だけ増える |
| 出力サイズ目標 | **≤ 5MB**（超えたらビットレートを 1.5 → 1.2 Mbps と段階的に下げて再試行） | `lib/imageCompression.ts:71-85` の「品質を下げながら目標サイズを狙う」と同じ考え方 |
| ポスター | 先頭フレーム → 既存 `compressImage()` で WebP（長辺1440px / 300KB以内） | `lib/imageCompression.ts:17-19` の既定値をそのまま使う |

参考：現行の `background.mp4` は 695KB。上の設定なら 15秒で 3〜4MB になる。**現状より重くなる**が、これは現行素材が既に手作業で高度に圧縮されているため。転送量を優先するなら 1.2 Mbps（15秒で約 2.2MB）まで落とす選択もある → F-4。

### D-4. 元動画を残すか

**残さない。圧縮後だけを Storage に置く。**

理由：

- 元動画（数十MB〜）を1本ごとに残すと、Supabase Storage の容量を差し替えのたびに食う。**削除の導線が無い分だけ確実に溜まる**
- 「元に戻したい」は、店舗のPCに元ファイルがある以上、再アップロードで足りる
- 既存の画像側も同じ判断をしている（`lib/imageCompression.ts` は圧縮後のみを上げる）

ただし C-4 の注釈で「元のファイルは保存されません」と明示する。

**差し替え時の旧ファイル**：`deleteMenuVideo()`（`lib/storage.ts:87-92`）で消す。**ただし保存が成功してから消す。**先に消すと、保存に失敗したときにお客様側が参照している URL が死ぬ。

### D-5. 上限を設けるか

**設ける。エンコード前に拒否する。**

| 項目 | 上限 | 理由 |
|---|---|---|
| ファイルサイズ（入力） | **200MB** | 既存の 50MB（`app/admin/(protected)/menu/page.tsx:50`）は「圧縮しないから」の値。圧縮するなら緩められる。スマホで撮った素材が弾かれない水準に |
| 長さ | **30秒**（推奨は15秒以内） | 圧縮時間が長さに比例する（D-2）。60秒だと1分待たせることになる。ループ背景に30秒超は不要 |
| 形式 | mp4 / mov / webm（`accept` は既存の `MediaUploaderField.tsx:182` と同じ） | 入力は緩く、出力は mp4 に統一 |
| 最小寸法 | 640×360 未満は警告（拒否はしない） | 拡大はしないので、小さい素材はぼやけたまま出る |

上限に当たったときのメッセージ案：

> この動画は◯秒です。30秒以内の動画をアップロードしてください。

---

## E. DBスキーマの案（**天真の承認が必要。マイグレーションは未作成**）

### 案E-1（推奨）：`stores` に列を足す

`supabase/best_sellers.sql` の STEP 1 が**まったく同じ判断を既に下している**（同ファイルの設計メモ：「表示ON/OFFは stores に列を1つ足す。settings テーブルを新設しなくても、同じ性質のフラグ（is_accepting_orders）がすでに stores にある」）。それに揃える。

```sql
-- supabase/top_hero_video.sql（新規ファイル。既存ファイルは書き換えない）
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS hero_video_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hero_video_url      text,
  ADD COLUMN IF NOT EXISTS hero_video_poster_url text,
  ADD COLUMN IF NOT EXISTS hero_video_updated_at timestamptz;
```

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| `hero_video_enabled` | boolean NOT NULL | `true` | C-2 の表示トグル |
| `hero_video_url` | text | NULL | Storage の公開URL。NULL＝動画なし |
| `hero_video_poster_url` | text | NULL | 自動生成したポスターの公開URL |
| `hero_video_updated_at` | timestamptz | NULL | 最終更新。管理画面に「最終更新: 8/3」と出す用 |

**RLS**：`stores` は既存ポリシーがある（`supabase/setup.sql`）。**緩めない。**

- 読み：お客様側の `/order` が読む必要がある。`best_sellers` と同じく、公開情報（既に誰でも見られる動画のURL）なので anon の SELECT で問題ない。ただし `stores` テーブル全体の SELECT を anon に開けるのが現状どうなっているかを実行前に確認すること（→ F-5）
- 書き：**manager のみ。**`save_best_sellers()`（`supabase/best_sellers.sql` STEP 4）と同じく、`auth.jwt() -> 'app_metadata' ->> 'role'` を検査する `SECURITY DEFINER` の RPC を1本立て、そこだけを入口にする

```sql
-- 保存RPC（manager のみ）。トグルとURLを1トランザクションで入れ替える
CREATE OR REPLACE FUNCTION public.save_hero_video(
  p_enabled    boolean,
  p_video_url  text,
  p_poster_url text
) RETURNS void ...
```

**Storage バケット**：`menu-videos` を**そのまま使う**（`supabase/menu_videos.sql`）。パスの先頭を `top/` にして商品動画と分ける。バケットを新設すると RLS を1組増やすことになり、得るものが無い。

**移行**：`hero_video_url` が NULL のあいだは `app/order/page.tsx:66-69` の `HERO_MEDIA` 定数をフォールバックとして使う。`bestSellerEnabled` が「読めなかったら従来動作」にフォールバックしている作法（`hooks/useOrderPageData.ts` の該当箇所）と同じ。**これによりマイグレーション直後の見え方が一切変わらない。**

### 案E-2：`store_media` テーブルを新設する

```sql
CREATE TABLE public.store_media (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id  uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  slot      text NOT NULL,          -- 'order_hero' | 'landing_background' | ...
  kind      text NOT NULL,          -- 'video' | 'image'
  url       text NOT NULL,
  poster_url text,
  enabled   boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slot)
);
```

- **長所**：`/`（A-2）の背景動画も `landing_background` スロットとして同じ画面・同じコードで扱える。将来スロットが増えても `ALTER TABLE` が不要
- **短所**：今すぐ必要なスロットは1つ。RLS を1テーブル分新設することになる。既存の `best_sellers` が示した「列を足せば済む」判断から外れる

**推奨は案E-1。**F-1（`/` の背景動画も対象にするか）が「する」に倒れ、かつスロットが今後も増える見込みなら案E-2に切り替える。列4本の追加なので、E-1 → E-2 の移行は難しくない。

---

## F. 未決事項

判断が必要で、こちらで決めるべきでないもの。

| # | 論点 | 選択肢 | 影響 |
|---|---|---|---|
| **F-1** | **対象は `/order` のヒーロー動画だけか、`/` の背景動画も含めるか** | (a) `/order` だけ（本書の前提） / (b) 両方 | (b) なら E は案E-2（スロット制）が有力になり、C-4 の「16:9」注釈は `/order` 用にしか使えない（`/` は縦全画面なので別の注釈が要る）。画面の項目数も倍になる |
| **F-2** | **`/` の背景動画は現在 `/order` と同じ `background.mp4` を共有している。**片方だけ差し替えたとき、もう片方はどうなるのが正しいか | (a) 別々に持つ / (b) 常に同じものを使う | F-1 が (a) のとき、`/` は `public/` のファイルを見続ける＝管理画面から変えても `/` は変わらない。この非対称を許容するかどうか |
| **F-3** | **案C（`/admin/settings` 新設）に切り替えるべきタイミング** | 今すぐ / 受注停止トグルの UI を作るとき / 当面なし | A-5 のとおり `setAcceptingOrders()` は API だけあって画面が無い。これに UI を付ける予定があるなら、案C を先に作った方が安い |
| **F-4** | **転送量と画質のどちらを優先するか**（D-3 のビットレート） | 2.0 Mbps（15秒 ≒ 3.7MB） / 1.2 Mbps（≒ 2.2MB） | 現行素材は 695KB。**どの設定でも現状より重くなる。**客席の通信環境と Supabase の転送量上限（F-6）次第 |
| **F-5** | **`stores` テーブルの anon SELECT が現在どうなっているか** | — | 案E-1 は `/order`（未認証）から `hero_video_url` を読む前提。開いていなければポリシー追加が要る（＝RLS を触る＝天真の確認事項）。**Supabase ダッシュボードでの確認が必要で、リポジトリからは判別できない** |
| **F-6** | **Supabase のプラン（Storage 容量・転送量の上限）** | Free / Pro / — | リポジトリからは判別できない。動画は画像と桁が違う。無料枠なら D-3 のビットレートを下げる必要がある |
| **F-7** | **Vercel のプラン（関数の実行時間上限）** | Hobby / Pro | 方式3（ブラウザ圧縮）を採るなら**影響しない**。方式4に切り替える判断をする場合にだけ必要 |
| **F-8** | **注釈テキストを店舗が編集できるようにするか** | 固定 / 編集可 | 本書は固定にしている（C-2）。編集可にするとカラムが1本増え、文言の品質を店舗に委ねることになる |
| **F-9** | **圧縮に失敗したとき、未圧縮のまま上げる逃げ道を用意するか** | なし（本書の前提） / あり | 本書は「なし」。逃げ道を作ると上限を超えた素材が客席に出る。ただし店舗が詰まる可能性は残る |
| **F-10** | **お客様側の文言・見え方**（C-5 の「動画は表示されていません」等） | — | CLAUDE.md 3章より、お客様の目に触れる文言は天真の確認事項。ただし本機能ではお客様側に新規文言は出ない想定（動画が無ければ枠ごと消える）。**この想定でよいかの確認だけ必要** |
| **F-11** | **`hero_video_updated_at` を管理画面に出すか**（案E-1） | 出す / 列ごと不要 | 「いつ差し替えたか」が分かると運用上便利だが、無くても機能は成立する |

---

## 付録：本書が触れていないこと

- Figma のデザイン（`docs/specs/design-rules.md` に従い、B の案が決まってから着手。PC / SP の対で作り、状態セットを揃える）
- 実装コードとマイグレーション（本書は提案まで）
- `/dev/ui` ギャラリーへの追加（新規コンポーネントを作る段階で必要になる。CLAUDE.md 2章）
