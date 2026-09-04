# GOOD ORDER リデザイン作業 引き継ぎメモ

**サービス名は「GOOD ORDER」**（旧称 Orderly）。表示文言・パッケージ名・リポジトリ名は
すべて改名済み。ただし以下3つは**意図的に `orderly` のまま残している**（後述の理由）:
`lib/store.ts` のカート永続化キー / `lib/kitchenAck.ts` の確認済みキー /
Postgres関数 `public.orderly_business_date()`。

次のセッションはここから読めば続きに着手できるはず。

## プロジェクトの概要

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase（Postgres/Auth/Storage/Realtime/RLS）の
飲食店モバイルオーダー＋管理画面「Orderly」。`prompts/` 配下の連番Stepプロンプト（Markdown）を
順番に実行してリデザインを進めている（macOSのDownloadsフォルダでEPERMサンドボックス問題が
出るため、この`prompts/`ディレクトリ運用にしている）。

全体方針: **既存のビジネスロジック・データフローは一切変更せず、Figmaデザイン
（file key `KGPuY4YVRQW6BMRrulBaFN`）に合わせて見た目だけを差し替える。**
客側（`/order`, `/order/menu`, `/order/[category]`, `/order/item/[id]`, `/cart`, `/complete`）は
リデザイン完了済み。現在はスタッフ側（`/admin/*`）のリデザインを進行中。

**Git状況（2026-07-26 更新）**: ここまでのリデザイン作業は全て
`main` に14コミットに分けてcommit済みで、**GitHubへpush完了**。

- リモート: https://github.com/temmahirasawa-spec/good-order （**public**）
  旧名 `Orderly` から改名済み（GitHubが旧URLからリダイレクトするので古いリンクも生きる）
- 公開前に機密スキャン実施済み（JWT・Webhook URL・実Supabase URL・パスワード代入とも0件。
  `.env.local` は `.gitignore` で除外、`.env.local.example` はプレースホルダのみ）
- **publicなので、今後 `.env.local` 等をうっかりコミットしないよう特に注意すること**

ユーザーから明示的に指示されない限りcommitしない運用は継続（既存ルール通り）。

## 直近までの進捗

- Step3-I: スタッフ管理画面共通基盤を新規構築済み
  - `components/admin/nav/{NavItem,MenuAccordionNavItem,NavContent,NavSidebar,NavDrawer}.tsx`
  - `components/admin/AdminPageShell.tsx`（render-propsで`openDrawer`を渡す。PC=NavSidebar常設／
    SP=ハンバーガーでNavDrawer）
  - `components/admin/TopBar.tsx`（PC/SP共通のタイトル+件数+strip行パターン。`action`propで
    件数の代わりに新規追加ボタン等を右側に置ける）
  - `components/admin/StatusBadge.tsx`
  - `app/admin/(protected)/layout.tsx`の`REDESIGNED_PREFIXES`配列で「新chrome化済みページ」を管理
- Step3-J: `/admin/register`（レジ）リデザイン完了済み
- Step3-K: `/admin/menu`（メニュー管理）リデザイン完了済み
  - 新規: `components/admin/menu/{AdminMenuRow,TagSelectField,MediaUploaderField,MenuPreviewCard}.tsx`、
    `components/ui/ToggleSwitch.tsx`、`Icon.tsx`に`grip`/`edit`追加
  - 既存バグ3件修正（`is_takeout`編集可能化／画像削除時のStorage削除／`calories`・
    `serving_time_min`をこのページの型・フェッチからのみ除去）
- Step3-L: `/admin/menu/categories`（カテゴリ管理）リデザイン完了（詳細は下記）
- **Step3-M: `/admin/pickup`（テイクアウト受け渡し）新規実装、完了**（詳細は下記）
- **`prompts/STEP3-KLM/`の3本（K→L→M）は全て消化済み。次のプロンプト待ち。**

## Step3-L（カテゴリ管理）で行ったこと

`app/admin/(protected)/menu/categories/page.tsx`を全面書き換え。CRUD・スラッグ自動生成・
Realtime更新・画像アップロードのロジックは保持したまま見た目をFigmaに合わせ、
プロンプトで指定された削除時の安全策も追加した。

### 新規コンポーネント
- `components/admin/category/CategoryRow.tsx` — PC=表示順バッジ／SP=編集ボタンの一覧行
  （Figma: `Category Row (Mobile)` 429:2534。AdminMenuRowと同じレスポンシブ1コンポーネント統合方針）
- `components/admin/category/ColorSwatchPicker.tsx` — タグ色10色スウォッチ
  （Figma: `Color Swatch Picker` 306:1535）

### 修正した不備（プロンプト指定）
- カテゴリ削除確認ダイアログに**実際の商品件数**を表示するようにした。
  ダイアログを開いた時点で`menu_items`を`count: "exact", head: true`で数え、
  取得完了まで「削除する」ボタンはdisabled。文言は件数0件／N件／取得失敗の3パターン。
  削除自体はブロックしない（合意通り）。実機確認では「パンケーキ」で
  「このカテゴリには8件の商品があります。削除すると商品も全て削除されます。この操作は取り消せません。」と表示。

### レイアウト周りの後始末（Step3-K引き継ぎ分）
- `app/admin/(protected)/layout.tsx`: `REDESIGNED_EXACT`を廃止し
  `REDESIGNED_PREFIXES = ["/admin/kitchen", "/admin/register", "/admin/menu"]`に統合した
- `app/admin/(protected)/menu/layout.tsx`（旧サブナビ）は**削除済み**

### ユーザーに報告済みの判断・差分
- ⠿グリップはFigma通り視覚のみ再現。一覧レベルのドラッグ並び替え機能自体が既存実装に無く
  （表示順は編集パネルの数値入力でのみ変更する既存仕様）、視覚差し替えのスコープでは
  新規のドラッグ機能実装は行っていない（Step3-Kと同じ判断）
- 削除ボタンの配置: Figmaの`Category Row`にも編集パネルにも削除ボタンが無いため、
  Step3-Kと同様に編集パネルのヘッダー（閉じるボタンの左）にゴミ箱アイコンとして配置した
  （新規作成時は非表示）。**旧実装では一覧行に編集/削除ボタンが並んでいたので、この点は挙動変更**
- PC版一覧行はFigma上編集ボタンが無いため、行全体クリックで編集パネルを開く仕様にした
- ~~表示順バッジ（PC）は推定実装~~ → PCテンプレート`309:279`と突き合わせて修正済み
  （Figmaの`Order Badge`は**数字のみ**の円形バッジ。下記「Figma突き合わせ」参照）
- `Color Swatch Picker`のFigmaコンポーネント説明文には「黒い外枠+チェック」とあるが、
  実物は外枠のみ（ユーザー確認済み）。**現在の実装（外枠のみ）が正しい**
- カテゴリ画像は既存仕様のまま1枚・圧縮モーダル無し。なお**画像を差し替えても
  Storageの旧ファイルが残る**（Step3-Kでメニュー画像側は直したが、カテゴリ側は
  プロンプトのスコープ外だったため未修正）

### 検証状況
`tsc --noEmit`・`next lint`・`rm -rf .next && npm run build`すべてクリーン
（lintのwarningは既存の`components/dashboard/OwnerView.tsx`のみ）。
`app/dev/ui/page.tsx`にCategoryRow/ColorSwatchPickerのセクションを追加。
さらに今回は**Chromeに管理画面のログインセッションが残っていたため実画面（`/admin/menu/categories`）
でもPC/SP・編集パネル・削除確認ダイアログまで目視確認できた**（ログイン操作はしていない。
SP幅の確認は390px幅のiframeを一時的に注入する方法で行った）。

## Step3-M（テイクアウト受け渡し）で行ったこと

新規画面 `/admin/pickup`。DBスキーマ・既存APIは一切変更していない。

### 新規/変更ファイル
- `app/admin/(protected)/pickup/page.tsx`（新規）— `order_type='takeout'` かつ
  `status='served'` の注文を`updated_at`昇順で一覧し、既存の`markOrderPickedUp()`を呼ぶ。
  3秒ポーリング＋60秒ごとの経過時間再計算（厨房画面と同じ方式）
- `components/admin/takeout/PickupCard.tsx`（新規、Figma: `Pickup Card` 462:2923）
- `components/Icon.tsx`: `check`アイコンを追加
- `lib/staffRoles.ts`: `ADMIN_NAV_ITEMS`に`/admin/pickup`を追加（レジの直後）
- `components/admin/nav/NavContent.tsx`: `NAV_ICONS`に`"/admin/pickup": "check"`
- `app/admin/(protected)/layout.tsx`: `REDESIGNED_PREFIXES`に`/admin/pickup`を追加
- `app/dev/ui/page.tsx`: PickupCardのセクション追加、Iconセクションの件数を`ICONS.length`に

### 判断した点（ユーザー報告済み）
> ⚠ このうち「受渡番号」「ロール」「ナビラベル」の3点は、後続の
> 「受渡番号・counterロール・並び替え永続化（Step3-N相当）」で置き換わっている。
> 現在の仕様はそちらの節を参照すること。

- ~~**受渡番号**: 注文IDの先頭6桁を流用~~
  → `orders.pickup_no`（サーバー採番の日次連番）に置き換え済み。
  注文IDの先頭6桁は"内部照合用ID"としてレジ画面にのみ残している
- **経過時間**: `orders.updated_at`（statusがservedになった時刻。`staff_foundation.sql`の
  トリガーで自動更新）からの経過。厨房画面と同じ`calcElapsed()`
- ~~**ロール**: `["manager", "kitchen"]`~~
  → `counter` ロールを新設し `["manager", "kitchen", "counter"]` に変更済み
- ~~**ナビラベルのみ「テイクアウト受渡」と短縮**~~
  → Top Barのタイトルも「テイクアウト受渡」に統一済み（ラベルは全画面で1つ）。
  短縮の理由自体は有効: Nav Sidebar v2は220px幅で、Active時は15px boldになり
  「テイクアウト受け渡し」だと143px枠に150px必要で「し」だけが行落ちする
- チェックアイコンはFigma側で**単一VECTORのポリラインに修正済み**、あわせて
  Component Set「Icon」(52:36) 配下へ移動して `Name=Check` に改名された
  （ノードIDは 388:445 のまま）。`components/Icon.tsx` の `check` は
  `M1.657 9.221L5.407 12.971L12.397 2.369`（strokeWidth 1.6・ROUND/ROUND）で
  Figmaと完全一致している
- 「受け渡し完了」後は即座に一覧から消す（ユーザー了承済み）。競合／RLSブロックで0件更新
  だった場合は再取得でカードが戻る（厨房画面と同じconsole.warn）
- PCのカードグリッドは`lg:grid-cols-2`（厨房画面と同じ）

### 検証状況
`tsc --noEmit`・`next lint`・`rm -rf .next && npm run build`すべてクリーン
（lint warningは既存の`OwnerView.tsx`の11件のみ）。
`/dev/ui`でPickupCardと`check`アイコンを目視確認。実画面`/admin/pickup`もPC（1400px iframe）・
SP両方で確認したが、**DBに`served`のテイクアウト注文が無かったため実データでのカード表示は
未確認**（空状態・Top Bar件数・ナビ項目は確認済み）。

## 受渡番号・counterロール・並び替え永続化（Step3-KLM後の追加5件）

ユーザー指示の5点。**コード側は全て実装済みだが、SQLマイグレーション3本が
まだSupabaseに未適用**（下記「未適用のSQL」参照）。

### 1. 受渡番号 `orders.pickup_no`
- `supabase/pickup_no.sql`（新規）
  - `pickup_no smallint` / `business_date date` を `orders` に追加
  - カウンタ表 `pickup_no_counters(store_id, business_date, last_no)`。
    RLS有効＋anon/authenticatedからREVOKEし、SECURITY DEFINERの採番トリガー経由でしか触れない
  - `assign_pickup_no()` = BEFORE INSERT トリガー。カウンタ行の
    `UPDATE ... RETURNING` の行ロックだけで直列化する（**advisory lockは使わない**）。
    01〜99で循環。クライアントが渡した値は無視して常に上書き
  - `orderly_business_date(ts)` = Asia/Tokyo基準の営業日。**日跨ぎ営業に対応する場合は
    この関数内の `INTERVAL '0 hours'` を営業終了時刻ぶんに変えるだけでよい**（コメント記載）
  - 既存注文へのバックフィルあり。`updated_at`（=受渡画面の経過時間の基準）が
    書き換わらないよう `trg_orders_set_updated_at` を一時無効化してから流す
  - `get_order_statuses()` の返り値に `pickup_no` を追加（DROP→CREATE。返り値型変更のため）
- **冪等性**: `lib/store.ts` の `saveOrderToDb` は元々ただの `.insert()` で、
  upsert / ON CONFLICT を使っていなかった（同じidの再送は一意制約違反で落ちるだけ）。
  今回 orders / order_items とも `upsert(..., { onConflict: "id", ignoreDuplicates: true })`
  ＝ `ON CONFLICT DO NOTHING` に変更。order_items の id は
  `derivedItemId(orderId, index)`（orderIdの先頭24文字＋index）で決定的に生成するので
  再送でも同じ行になる。**再送時は既存行が一切書き換わらない＝pickup_noは変わらない**
  （採番自体は消費されるので欠番は出るが、これは許容と合意済み）
- **表示**: `lib/pickupNo.ts` に `PICKUP_NO_LABEL` / `formatPickupNo`（2桁ゼロ埋め）/
  `internalOrderRef` を集約。お客様側は `/complete`（採番待ちは1秒×20回ポーリング）と
  `/history`、店舗側は受渡カードとレジ画面。どの画面も「受渡番号」ラベル付きで最も大きく表示する
- **anonの読み取り経路**: `orders` の直接SELECTはauthenticated限定のままなので、
  `get_order_statuses` RPC（SECURITY DEFINER、statusとpickup_noのみ返す）経由で読む

### 2. `counter` ロール
- `supabase/staff_role_rls.sql` の `orders_update_role_scoped` に counter を追加。
  `picked_up` は counter / kitchen / manager の3ロール。**会計（paid）は register / manager の
  ままで、金額系の権限は一切緩めていない**。変更前後の権限マトリクスは同ファイルのコメント参照
- `lib/staffRoles.ts` の `STAFF_ROLES` / `STAFF_ROLE_LABEL` にも counter を追加し、
  `/admin/pickup` のアクセス可能ロールを `["manager", "kitchen", "counter"]` に

### 3. ラベル統一
- サイドバー・Top Bar とも「テイクアウト受渡」。空状態も「受渡待ちの…」、
  Pickup Cardのボタンも「受渡完了」に統一した。
  **Figmaの Pickup Card のボタン文言は「受け渡し完了」なので、この1点だけ意図的にFigmaと差がある**

### 4. ⠿ドラッグ並び替えの永続化
- `hooks/useDragReorder.ts`（新規）: グリップだけを `draggable`、行全体をドロップ先にする。
  drop時にローカルを楽観的に並べ替え → 変更のあった行だけを1リクエストで永続化 →
  **失敗したときだけ元配列にロールバック**
- `supabase/list_reorder.sql`（新規）: `display_order` を 1..N に詰め直すマイグレーションと、
  `reorder_categories(jsonb)` / `reorder_menu_items(jsonb)` RPC（SECURITY INVOKERなので
  既存のRLSがそのまま効く。authenticatedにのみGRANT）
- **`sort_order` 列は新設していない**。指示は「`sort_order`（int）を追加」だったが、
  `categories` / `menu_items` には既に `display_order`（int NOT NULL）があり、
  お客様側の全クエリと編集パネルの「表示順」入力がこれを参照している。
  列を足すと並び順の真実が2つになるため、既存の `display_order` を単一の真実として使い、
  「既存行に現在の表示順で連番を振るマイグレーション」だけを `display_order` に対して実施した
  （初期データに DEFAULT 99 や重複があり、この詰め直しはドラッグ並び替えの前提として必須）
- **メニュー管理はカテゴリーフィルター適用中は並び替え不可**（一覧が部分集合になり
  全体順序に写像できないため）。ヒント文言で告知する

### 5. カテゴリ画像の差し替え時のStorage削除
- `app/admin/(protected)/menu/categories/page.tsx` の `deleteReplacedCategoryImage()`。
  **保存が成功してDBが新しい画像を指したあとに**旧オブジェクトを削除する
  （アップロード直後に消すと、キャンセルされた場合にDB参照だけが残って画像が壊れるため）。
  失敗はconsole.warnのみでユーザー操作をブロックしない。
  初期データのローカル画像パスは対象外にしている

### その他
- `vercel.json` に `"regions": ["hnd1"]` を追加

### SQLの適用状況: 3本とも適用済み
Supabaseダッシュボード → SQL Editor（role postgres）でこの順に実行済み。
1. `supabase/pickup_no.sql` — Success
2. `supabase/list_reorder.sql` — Success
3. `supabase/staff_role_rls.sql` — **ポリシー部分（section 2）のみ**実行した。
   section 1 の `get_sales_orders` は無変更のため触っていない

適用後の確認クエリ結果:
`pickup_no`/`business_date` 列あり・`assign_pickup_no` 関数とトリガーあり・
`reorder_categories`/`reorder_menu_items` あり・`pickup_no IS NULL` の注文 0件・
`pickup_no_counters` 11行・categories の display_order が 1..11 に整列・
`orders_update_role_scoped` に counter を含み paid も維持・
`order_items_update_kitchen_manager` は counter 非付与のまま。

**なお、ローカルには anon キーしか無く（`.env.local`）psql も supabase CLI も無いため、
今後もDDLはSQL Editor経由でしか流せない。**

### 検証: 実注文フローを1件通して確認済み
`/` （tableパラメータ無し＝テイクアウト導線）→「テイクアウトメニューを見る」→
5品をカートに追加（うち1品を数量12）→ 注文確定 → `/complete` →
`/admin/kitchen` で5品を調理完了 →「すべて提供済みにする」→ `/admin/pickup` →
「受渡完了」→ `/admin/register` で会計済み、まで通した。

- `/complete` に **受渡番号 #01** がサーバー採番で表示された（anon RPC経由）
- 受渡カード: PC（約412px幅）でもSP（390px）でも破綻なし。
  - 24文字の商品名「ミックスベリーとマスカルポーネのフレンチトースト」は
    PCは1行、SPは2行に折り返して省略なし（`-webkit-line-clamp: 2`）
  - 5品でもカードが縦に伸びるだけ、2桁数量「× 12」も右端に収まる
- レジ画面: 「受渡番号 #01」を大きく、右に「内部ID b8eaad」を小さく併記。
  会計確認ダイアログも「🛍 受渡番号 #01」
- 「受渡完了」後、3秒ポーリングで再取得してもカードが戻らない＝ picked_up がDBに永続化された
- 並び替え: カテゴリ管理で1行目を3番目へ移動 → リロード後も保持されることを確認（RPC経由）。
  確認後、元の順序に戻してある

検証用に一時的に行った変更は**すべて元に戻した**:
- テイクアウト商品「クロワッサンサンド」を長い名前に改名 → 検証後に戻した
- カテゴリの並び順を変更 → 元に戻した
- 作成したテスト注文（受渡番号 #01・¥11,924・id `b8eaada4-…`）は
  **後続のフォローアップ対応で削除済み**（下記）

**「オプション／変更指定が付いた場合」は検証できていない。このアプリのデータモデルに
その概念が存在しないため**（`order_items` は menu_item_id / quantity / unit_price のみ。
`components/ui/OptionCard.tsx` はスタッフ呼び出しシートの部品であって注文オプションではない）。

## フォローアップ対応3点（`prompts/followup-fixes-prompt.md`）

### 1. 検証用テスト注文の削除 — 完了
SQL Editorで、まず `id::text like 'b8eaad%' or (total_amount = 11924 and order_type = 'takeout')`
で **1件だけ**であることを確認してから、id 直指定で DELETE した
（`b8eaada4-3df0-4c3b-9033-a7ec59881eb8` / 受渡番号1 / takeout / paid / ¥11,924）。
削除後の確認: `orders` 0件・`order_items` 0件（`order_id` の ON DELETE CASCADE が効く）・
当日の paid 件数 0・当日の paid 合計 0。ダッシュボードも「今日の売上 ¥0 / 0組 /
今日はまだ会計済みの注文がありません。」になった。
あわせて、削除した注文を指していたブラウザ側の LocalStorage 履歴エントリも消してある。

### 2. 店内注文では受渡番号を非表示 — 完了
`app/complete/page.tsx`: 注文種別を **LocalStorage の履歴エントリ**（その注文の
スナップショット）から取る。カート側の `orderType` は画面遷移で変わりうるため使わない。
テイクアウトのときだけ受渡番号ブロックを描画し、店内注文では**行ごと出さない**
（プレースホルダーも残さない）。店内注文では `get_order_statuses` のポーリング自体も行わない。
採番（`pickup_no` の付与）は全注文でこれまで通り。

`app/history/page.tsx` の過去注文カードにも同じ条件を入れた（同じ理由なので統一。
指示は `/complete` のみだったので、不要ならこちらは戻す）。

### 3. `/admin/menu` でテイクアウト商品が保存できない不具合 — 完了
**方針**: 「テイクアウト対象にする」トグル（`form.is_takeout`）と連動させ、
ONのときだけカテゴリー選択の `required` を外した。あわせて
- ラベルの `*` を「（テイクアウト商品は任意）」に差し替え
- 先頭optionの文言を「選択してください」→「なし（テイクアウト専用）」に切り替え
- 保存時の payload を `category_id: form.category_id || null`（空文字ではなくNULL）に

**店内商品はこれまで通り必須のまま**（実機確認: 店内商品のパネルは
label「カテゴリー *」/ `select.required === true` / 先頭option「選択してください」）。
テイクアウト商品を `/admin/menu` から保存できることと、保存後も
`menu_items.category_id` が NULL のままであることをDBで確認済み。

## Step3-L / M のFigma突き合わせ（`prompts/step3-LM-figma-reconciliation-prompt.md`）

テンプレート（`309:279` / `462:2942`）を実際に取得して、推定実装だった箇所を修正した。

### 修正した差分
1. **カテゴリ管理PCの表示順バッジ**（`components/admin/category/CategoryRow.tsx`）
   Figmaの`Order Badge`（`327:498`）は**数字のみ**。「表示順」というラベル文字は入っていない。
   `bg/tertiary` / `radius-full` / 左右8・上下3 / **EN/Data/S**
   （Barlow SemiBold 13px・line-height 1.2・tracking 0.26px・`text/secondary`）に修正。
   プロジェクトに `type-en-data-s` が無いため生の任意値で指定している
2. **Top Barのボタン文言**: 「＋ 新規追加」→ **「＋ カテゴリ追加」**
   （サイズはFigmaと同じ padding 左右16・上下10 から出るので指定不要）
3. **ヒント文言**: PC/SPとも「⠿ をドラッグして並び替えると、メニュー画面での表示順が変わります」
   に統一（**句点なし**がFigma実物）。メニュー管理PCの「注文画面での…」も同文言に修正
4. **List Scrollの上パディング**: PCに `pt-8` を追加（Figma実測）
5. ~~**Pickup Cardのヘッダー**を1行の`JP/Heading/S`に戻した~~
   → **戻しすぎだったので再度差し戻し済み**（下記「Pickup Cardヘッダーの差し戻し」参照）。
   「受渡番号をどの画面でも最も大きく表示する」はユーザーの明示的な決定で、
   あのときのFigmaが受渡番号の仕様確定前の古いデザインだった
6. **Pickup Cardの数量**: `EN/Data/XS`（Barlow SemiBold **11px**・`text/secondary`）に修正
7. **Pickup Cardの影**: `var(--shadow-card)` → Figma実測の `0 1px 6px rgba(0,0,0,0.06)`
8. **受渡画面PCの余白**: Main を左右32・下32、カード間を24に修正（旧: 24 / 16）

### 差分なし・修正不要だったもの
- 一覧行の構造（grip16 → サムネ40 r8 → タグ色ドット16 → テキスト列 gap2 →
  バッジ、gap12・上下8・border-b）はFigmaと一致していた
- `Color Swatch Picker` はスウォッチ32×32・10色・選択中は2pxのink外枠のみ（チェック無し）で
  現在の実装が正しい

### Figmaと意図的に違うまま残している点
- ナビ・Top Bar・ボタンの文言短縮（「テイクアウト受渡」「受渡完了」）— 幅の都合。ユーザー了承済み
- Pickup Cardの品名は2行まで折り返し（Figmaは1行想定）— 省略記号だと読み違いが起きるため

### 今回のついでに気づいた未対応の差分（カテゴリ編集パネル）
突き合わせ対象に入っていなかったので**手を付けていない**が、`309:1748`（Slide Panel —
Category Editing）と実装で以下が違う:
- ラベル: Figma「スラッグ（slug）」「キャッチコピー（caption）」／実装「スラッグ（URL）」「キャッチコピー」
- カテゴリ画像: Figmaは**120×90の固定枠**／実装は幅いっぱいの16:7
- フッターボタン: Figmaは`py-12`＋14pxテキスト／実装は`h-48`＋15pxテキスト
- Figmaのパネルには**削除ボタンが無い**（実装はヘッダーにゴミ箱。既報の意図的差分）

## メニュー画面のバグ修正とナビのアコーディオン改修（コード＋Figma両方）

### 1. メニュー管理のカテゴリーフィルターが1/3しか表示されないバグ — 修正
`<main>` が `flex flex-col overflow-y-auto` で、一覧が `flex-1` のため、
**フィルター行が flex の既定 `shrink:1` で縦に潰されていた**。
フィルター行とヒント文言に `shrink-0` を付けて解決
（`app/admin/(protected)/menu/page.tsx`）。同じ構造のページを追加するときは要注意。

### 2. サイドバーのアコーディオン改修（Figmaも同時に更新済み）
- **名称変更**: 親「メニュー管理」→**「メニュー」**、サブ「メニュー追加」→**「メニュー管理」**、
  「カテゴリ追加」→**「カテゴリ管理」**。`ADMIN_NAV_ITEMS` の `/admin/menu` ラベルも
  「メニュー編集」→「メニュー」に合わせた（旧chromeのトップナビで使われる）
- **サブ項目のアイコン**: listアイコン → **プラス**。アイコン枠は他のナビ項目と同じ16pxで、
  **プラスの図形自体が12px**（丸端込みで 2〜14）。`components/Icon.tsx` に `plus` を追加
- **Active表示**: サブ項目が現在ページのときに ink 反転するようにした。あわせて
  **親行の ink 反転をやめた**（Figmaのテンプレートでも、サブがActiveのとき親行は白のまま）
- ついでに `NavContent` から `onNavigate` をアコーディオンにも渡すようにした
  （SPのドロワーでサブ項目をタップしてもドロワーが閉じなかったため）

### Figma側の変更（`use_figma`で実施）
- `Icon` コンポーネントセット（`52:36`）に **`Name=Plus`（`500:482`）を追加**。
  既存アイコンと同じ作り（角丸長方形2本・`text/primary` 変数バインド）。
  セットは 6列×4行 → 5行目の先頭に配置し、バウンズを 236×164 → **236×200** に拡張
- `Menu Accordion`（`320:2118`）のラベルを上記の新名称に変更（両バリアント）
- サブ項目の Icon インスタンスを `Name=Plus` に **swapComponent**
- `State=Open` の Parent Row から ink 背景を外し、ラベル・アイコン・シェブロンの色を
  `text/inverse` → `text/primary` に戻した
- Active な Nav Item（ink背景）配下のプラスが黒地に黒で見えなくなっていたため、
  MobileOrderページを走査して該当2箇所（メニュー管理PC `319:2392` /
  カテゴリ管理PC `319:2456` のサイドバー）のプラスを `text/inverse` に再バインド

**⚠ 既知の制約**: Nav Item の Active バリアントが持つ「アイコンを inverse にする」上書きは、
アイコンを別コンポーネントに swap すると効かない（レイヤーが一致しないため）。
今後アコーディオンのサブ項目を Active にするインスタンスを増やすときは、
プラスの塗りを手動で `text/inverse` に変える必要がある。

なお、Menu Accordion のサブ項目のアイコン枠は **16pxのまま**（インスタンス内の子フレームは
`resize` が効かず 16×16 に戻る）。プラスの図形が12pxなので見た目の要件は満たしている。

## Pickup Cardヘッダーの差し戻し ＋ カテゴリ編集パネルの確定
（`prompts/pickup-card-revert-and-category-panel-prompt.md`）

### 1. Pickup Cardヘッダー — 「ラベル＋大きい番号」に差し戻し済み
Figma（`462:2923`）が更新されたのでそちらに合わせた。**受渡番号をカード内で最も大きい要素に
する**というのはユーザーの明示的な決定で、Figmaが受渡番号の仕様確定前の古いデザインだった。

- ヘッダー: 左右20・上16・**下10**・**上端揃え**（`items-start`）
- 左は縦2段（要素間2px）
  - 上段: ラベル「受渡番号」= **JP/Chip Label**（Noto Sans JP Bold 13px / leading 1.2）・`text/secondary`
  - 下段: Bagアイコン16 + 番号 = **EN/Data/L**（Barlow SemiBold 20px / leading 1.2 /
    tracking 0.4px）・`text/primary`、要素間6px
- 右: 経過時間（JP/Caption・`text/secondary`）
- `JP/Chip Label`(13px Bold) と `EN/Data/L`(20px) は `app/typography.css` に対応クラスが
  無いため生の任意値で指定している

**⚠ Figma側の指摘**: ヘッダーフレーム（`462:2924`）が**高さ48px固定＋clip**のままなので、
2段になった番号「#01」が下で見切れている（Figmaのレンダリングでも切れている）。
実装側は高さを固定せずパディングだけで組んであるので見切れない。
Figmaのフレームを縦Hugにすれば揃う。**未修正**（今回の指示に含まれていないため触っていない）。

### 2. カテゴリ編集パネルの3差分 — コード変更不要を確認済み
ユーザー判断で「実装が正しい」となり、Figma側（PC `309:1748` / SP `429:2685`）が
実装に合わせて修正された。実装は以下のままで変更していない:

| 項目 | 実装の現状 |
|---|---|
| ラベル | 「スラッグ（URL）」「キャッチコピー」 |
| カテゴリ画像 | 幅いっぱいの横長（`aspect-[16/7]`） |
| フッターボタン | `h-[48px]` ＋ 15px（JP/Heading/S相当） |

## typography.css をFigmaの全27スタイルに同期（`prompts/typography-sync-prompt.md`）

`app/typography.css` に**10クラスを追加**して、Figma登録の27スタイルと1:1になった
（JP 12 + EN 15 = 27）。既存17クラスの値はFigmaと**すべて一致していてズレは無かった**。

### 追加したクラス
| クラス | Figmaスタイル | 値 |
|---|---|---|
| `type-jp-body-small` | JP/Body Small | 13px Medium / 1.5 / 0.01em |
| `type-jp-chip-label` | JP/Chip Label | 13px Bold / 1.2 / 0 |
| `type-jp-micro-label` | JP/Micro Label | 9px Bold / 1.2 / 0 |
| `type-en-data-xl` | EN/Data/XL | 28px SemiBold / 1.2 / 0 |
| `type-en-data-l` | EN/Data/L | 20px SemiBold / 1.2 / 0.02em |
| `type-en-data-m` | EN/Data/M | 15px SemiBold / 1.2 / 0 |
| `type-en-data-s` | EN/Data/S | 13px SemiBold / 1.2 / 0.02em |
| `type-en-data-xs` | EN/Data/XS | 11px SemiBold / 1.1 / 0 |
| `type-en-data-2xs` | EN/Data/2XS | 9px SemiBold / 1.1 / 0 |
| `type-en-wordmark` | EN/Wordmark | 16px SemiBold / 1.2 / 0.04em |

**EN/Data系には `font-variant-numeric` を入れていない**（Figma側に無いため）。
桁揃えが要る箇所は呼び出し側で `tabular-nums` を併用する
（PickupCardの数量がその例）。

### 任意値からクラスに置き換えたファイル
`PickupCard` / `CategoryRow` / `StaffCallChip` / `BillCard` / `OrderCard` /
`CheckoutConfirmAlert` / `NavSidebar` / `NavDrawer` / `NavContent` /
`MenuAccordionNavItem` / `MediaUploaderField` / `ui/MenuCard` /
`admin/register/page` / `admin/menu/page` / `admin/menu/categories/page` /
`order/[category]/page`

`BillCard` の合計金額（`text-[20px] lg:text-[22px]`）は**レスポンシブなので任意値のまま**
（カスタムクラスに `lg:` が効かないため。指示どおり）。

### ⚠ 残っている「既存トークンがあるのに任意値」（今回のスコープ外・未対応）
トークンが無かったわけではないので今回は触っていないが、揃えるなら以下:
- `admin/menu/page.tsx` `admin/menu/categories/page.tsx` のTopBarボタン
  `text-[17px]`→`type-jp-heading-m` / `text-[14px]`（JP Bold）→`type-jp-body-bold`
- 同2ファイルのフッターボタン `text-[15px]`（JP Bold 1.45）→`type-jp-heading-s`
- `TopBar` の件数・`TableChip`・`BillCard` の金額 `text-[14px]`（EN SemiBold 1.2）
  → `type-en-price-s`（tabular-numsが付く点だけ差分）
- `StoreInfoModal` / `StaffCallSheet` / `FilterPlaceholderSheet` の見出し
  `text-[22px] leading-[1.4]` は JP/Heading/XL（1.3）と**行間だけ違う**ので要判断

## `/admin/takeout` を `/admin/menu` に統合（`prompts/takeout-merge-prompt.md`）

テイクアウト商品のCRUD専用だった `/admin/takeout` を廃止し、`/admin/menu` に一本化した。
`/admin/pickup`（テイクアウト受渡）は**別画面なのでそのまま残している**（混同注意）。

### やったこと
- `app/admin/(protected)/takeout/` を削除（`git rm -r`）
- `next.config.mjs` に `redirects()` を追加し `/admin/takeout` → `/admin/menu`（307）
- `lib/staffRoles.ts` の `ADMIN_NAV_ITEMS` から `/admin/takeout` を削除、
  `NavContent.tsx` の `NAV_ICONS` からも削除
- `/admin/menu` のフィルター行に「テイクアウト」チップを**2番目**に追加
  （`TAKEOUT_FILTER = "__takeout__"` というsentinelで管理。カテゴリのslugと衝突しない）
- 「新規追加」の初期値をフィルターに追従させた（`openCreate`）。
  テイクアウトフィルター中は `is_takeout: true` ＋ カテゴリーなし、
  カテゴリーで絞り込み中はそのカテゴリーを初期選択

### 判断した点（ユーザー報告済み）
- **リダイレクトはページ削除＋`next.config.mjs`**。`(protected)` レイアウトの権限ガードは
  「ナビに無いURLならダッシュボードへ飛ばす」ので、page.tsxを残してリダイレクトすると
  そちらに吸われる。ルーティング層で処理すればガードより先に効く。
  `permanent: false`（307）にしたのはブラウザに永続キャッシュさせないため。
- **`display_order` は単一のグローバル列のまま**（テイクアウト用の第2ソート列は作らない）。
  ドラッグ時は「掴んだ行を、ドロップ先の行のグローバル位置へ移す」だけなので、
  テイクアウト部分列の相対順序も、それ以外の商品の相対順序も同時に保たれる。
  実測でも `reorder_menu_items` は1リクエスト・変更行のみを送っている。

### 検証状況（実画面で確認済み）
- テイクアウトチップ → 5件だけ表示、ヒント文言が「テイクアウト画面での表示順が変わります」に変化
- テイクアウトフィルター中に⠿でドラッグ → 楽観更新 → リロード後も順序が永続（検証後に元へ戻した）
- テイクアウト商品の編集→保存（カテゴリーなしのまま）が成功
- 「新規追加」でテイクアウト商品を作成→一覧に即反映→削除まで `/admin/menu` だけで完結
  （作成時は「公開する」をOFFにして客側に出ないようにした。検証後に削除済み）
- `tsc --noEmit` / `next lint` / `npm run build` すべて通過。ビルド結果に `/admin/takeout` は無い

## Step3-N: ダッシュボード新デザイン ＋ サイドバー並び替え（`prompts/STEP3-N_dashboard_prompt.md`）

管理画面リデザインの最終ページ。これで `/admin` 配下は全ページが
Nav Sidebar v2 / Nav Drawer の新chromeに載った（`REDESIGNED_PREFIXES` に全パスが入っている）。

### 1. `EN/Data` 系に `tabular-nums` を追加
`app/typography.css` の `type-en-data-2xs` 〜 `type-en-data-xl` 全6クラスに
`font-variant-numeric: tabular-nums` を入れ、`EN/Price` 系と揃えた。
呼び出し側で重複していた `PickupCard` の `tabular-nums` は外した。
**Figmaのテキストスタイルはこの機能を保持できないのでコード側が正**。

### 2. サイドバーの並び替え
`厨房 / レジ / テイクアウト`（ops）→ 区切り線 → `メニュー`（manage）→
スペーサー → `ダッシュボード`（review）→ 区切り線 → スタッフ名/ログアウト。

- `lib/staffRoles.ts` の `AdminNavItem` に `group: "ops" | "manage" | "review"` を追加。
  区切り線とスペーサーの位置は `NavContent.tsx` がこのグループで決める。
  ロールによっては片方のグループが空になる（kitchenロールなど）ので、
  線が浮かないよう都度存在チェックしている
- `テイクアウト受渡` → **`テイクアウト`** にリネーム。`/admin/takeout` を統合して
  区別が不要になったため。Top Bar（`/admin/pickup`）のタイトルも同時に短縮し、
  「画面名はサイドバーとTop Barで1つ」の方針を維持している

**権限ガードへの影響（プロンプト6章の確認事項）**:
`layout.tsx` のフォールバックは `ADMIN_NAV_ITEMS.filter(...)[0].href`＝
**配列の先頭＝サイドバー最上段**。並び替えにより、マネージャーが権限外URLを直打ちした
ときの着地先が `/admin/dashboard` → **`/admin/kitchen`** に変わった。
kitchen/register/counter は元々1画面しか見えないので影響なし。
「最初に見るべき画面＝最上段」という対応は意図的に1つの配列で兼ねている。

### 3. ダッシュボード本体
`app/admin/(protected)/dashboard/page.tsx` を全面書き換え。
集計は `lib/salesData.ts` をそのまま使い、**recharts の使用をやめて div/SVG で描いている**
（Figmaのグラフがすべて単純な矩形とポリラインで、recharts経由だと逆に寄せにくいため）。
結果 `/admin/dashboard` のバンドルは 126kB → 10.8kB。
`package.json` の `recharts` はどこからも参照されなくなった（削除は未実施）。

新規コンポーネント:
- `components/dashboard/dashboardTheme.ts` — グラフ配色・4区分定義・ヒートマップ色関数
- `components/dashboard/DashboardCard.tsx` / `StatCard.tsx` / `PeriodSelector.tsx`
- `components/dashboard/cards/` — HeroKpi / SalesChart / PopularMenu / PeakHeatmap /
  CategoryBreakdown / TableUtilization / SpendHistogram / DineInTakeout の8枚

削除: `components/dashboard/OwnerView.tsx` / `StaffView.tsx`

SPは Top Bar → Tab Nav（8セクション）→ Period Selector →カード縦1列。
PCは Top Bar（タイトル＋CSVボタン／ストリップ行に期間チップ）→ グリッド。
`TopBar` に `stripPcOnly` を足して、SPだけストリップ行を出さないようにしている。

### 4. 判断した点（すべてユーザー報告済み）
- **スタッフ/オーナー切替タブ・日報送信・受付停止トグルはダッシュボードから削除**
  （天真さんの判断「Figma通りに全部落とす」）。`/api/daily-report` と
  `lib/api.ts` の `isAcceptingOrders`/`setAcceptingOrders` は残してある。
  後者は `/cart` と `lib/store.ts` が注文時のチェックに使っているので消してはいけない
- **人気メニューのTOP5カードとTOP10カードは1枚に統合**（プロンプト4章）。
  タブ＋横バー＋「もっと見る（TOP10）」の段階開示でPC/SP共通。
  空いた枠のぶん、PCの売上推移カードを全幅にした
- **scrollspyは IntersectionObserver ではなくスクロール位置計算**。
  `/order` と違って main が固定高のスクロールコンテナなので、最後のカードは
  末尾まで送っても判定帯まで上がれずアクティブにならない。
  「判定線より上に来た最後のセクション」＋「末尾到達なら最終セクション」で判定している
- **時間別グラフは売上0の時間帯を前後から落とす**。8〜24時の16本はSP幅で潰れるため
- 前期比は prev が0のとき**バッジ自体を出さない**（旧実装は「— 前期間比」を表示）

### 5. Figmaの PC/SP テンプレート間で食い違っていた点（コード側で1つに寄せた）
Figma側の追随は天真さんが行う前提。
| 箇所 | PC | SP | 採用 |
|---|---|---|---|
| 店内/テイクアウトの色 | 店内=accent/deep, TO=status/info | 逆 | **PC側**（旧実装と同じ） |
| 期間チップ選択中 | surface/ink | accent/primary | **SP側**（プロンプトに明記） |
| 人気メニューのタブ選択中 | surface/ink | accent/primary | **SP側** |
| カテゴリ配色 | アンバー系6+青2 | 5色（色相が分かれる） | **SP側**＋既存トークンで8色に拡張 |
| Hero の前期比ピル | （PCに無し） | `#def2de`/`#338c40` 直値 | `status/success` トークン |

### 6. 途中で見つけた既存バグ（修正済み）
`lib/salesData.ts` の `fetchSalesData` が `o.order_items` を読んでいたが、
`get_sales_orders` RPC（`supabase/staff_role_rls.sql`）が返すキーは **`items`**。
このため `SalesOrder.items` が常に空配列で、**人気メニューとカテゴリ別売上は
ずっと「データなし」だった**。1語の修正で両カードが出るようになった。

### 検証状況
- PC(1092px)/SP(390px iframe)の両方で全カードを目視確認
- 実DBには会計済み注文が1件（しかも `order_items` が0行）しか無いため、
  **ブラウザ側で `window.fetch` を差し替えて合成データを流し込んで描画確認した**
  （DBは一切変更していない）。実データでの再確認は営業データが溜まってからで良い
- タブナビのアンカースクロール・scrollspy追従・末尾セクションのアクティブ化、
  期間チップ切替、人気メニューのタブ/TOP10展開をすべて操作して確認
- `tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過

## Step3-O: テーブル・二次元コード管理（`prompts/STEP3-O_qr_management_prompt.md`）

新規機能。各卓の注文用URLを二次元コードとして一覧・DL・A4印刷できる画面と、
テーブル識別方法そのものの変更（既存画面への波及あり）。

### DB適用済み（2026-07-27）
`supabase/tables_qr.sql` は天真さんが実行済み。移行結果:

- カテゴリー `A ・ テーブル` が1件作成された
- 卓は既存の `orders` / `staff_calls` の卓番号から **A1 / A5 / A99 / A999** の4件
  （99・999 は過去のテストデータ由来と思われる。不要なら席設定モーダルから削除可）
- 既存注文の `table_label` バックフィルも成功（厨房が "TABLE A5" と出ている）

### 用語
**「QRコード」は株式会社デンソーウェーブの登録商標**。
画面に出る文字列は必ず「二次元コード」。変数名・ファイル名（qrCode.ts, QrCard 等）は `qr` のままで良い。

### データモデル
- `table_categories`（code＝英大文字1文字 / name / display_order）
- `tables`（category_id / number / **short_code** / display_order / legacy_number）
- `orders` に `table_id`（ON DELETE SET NULL）と `table_label`（注文時点のスナップショット）
- `staff_calls` にも `table_label`（厨房のCall Chipだけ数値のままだと現場が混乱するため）

**表示は必ず `table_label`、集計・グルーピングは `table_id`。**

### URL
- 新形式 `https://<host>/?t=<short_code>`
- 旧形式 `?table=<数値>` も `legacy_number` 経由で解決し続ける（印刷済みカード互換）
- どちらも無ければテイクアウト、という既存判定は変えていない
- **ラベル（?table=A1）は絶対に埋めない**。カテゴリーのコードを変えた瞬間に印刷済みカードが
  全部無効になり、しかも画面にエラーが出ないのでお客様が読み取って初めて気づく。
  なお**Figmaのモックは `?table=A1` になっているが、プロンプト3章の指示どおり `?t=` を採用**した

### 新規ファイル
- `supabase/tables_qr.sql`
- `lib/tables.ts` / `lib/qrCode.ts`
- `components/admin/tables/`（QrCodeImage / QrCard / CodePicker / SeatSettingsModal）
- `app/admin/(protected)/tables/page.tsx` / `.../tables/print/page.tsx`

### 判断した点（ユーザー報告済み）
- **二次元コード生成は `qrcode`（MIT / 1.5.4）**。SVG出力必須という条件で選定。
  PNG(toDataURL)とSVG(toString)を1つのAPIで出せてブラウザ単体で完結する。
  `npm audit` の high は全部 next / eslint 由来の既存分で、qrcode 由来は無い
- **印刷は別ルート `/admin/tables/print`**。AdminPageShell が `h-screen`＋`overflow:hidden` なので、
  同じDOMに @media print を被せるとページ送りが効かず1ページ目しか出ない。
  面付けは mm 指定（`@page { size: A4; margin: 0 }`）。96dpi換算のpxだと
  ブラウザのスケーリング設定で実寸がずれて名刺トレイに合わない
- **anon に `tables` の生SELECTは開けない**。short_code は店頭掲示なので「知っていれば引ける」のは
  前提だが、生SELECTだと全卓を列挙できる。1件だけ返す SECURITY DEFINER の
  `resolve_table()` 経由にした（orders_anon_lockdown.sql と同じ方針）
- **レイアウト保存は `save_table_layout()` 1関数**。カテゴリーと卓を同時に作り直すので、
  個別のINSERT/DELETEを並べると途中で失敗して半分だけ反映された状態が残る
- **コード選択のポップオーバーは `position: fixed`**。モーダル本体が `overflow-y-auto` なので
  絶対配置だと下半分が切れる。トリガーの実測位置から置いている

### 既存画面への波及（5章）— 全部対応済み
| 画面 | 対応 |
|---|---|
| お客様側入口 `app/page.tsx` | `?t=` を `resolve_table` で解決。`?table=N` も維持。卓名表示もラベルへ |
| `lib/store.ts` | `tableId` / `tableLabel` を持ち、注文時に `orders` へ書く |
| 厨房 | Order Card / Call Chip とも `table_label`。グルーピングキーも `table_id` 優先 |
| レジ | Table Chip・会計確認とも `table_label`。卓の束ね方も `table_id` 優先（`Selection` が `n:number`→`key:string`） |
| ダッシュボード | テーブル稼働カードが T1〜T12 固定ではなく実際のラベル・実データ件数に。`TableStat` が `{key,label}` に |
| 履歴 `/history` | `tableLabel` を表示（無ければ数値） |
| CSV出力 | `table_label` 列を追加 |

**移行前の古いデータには必ず数値フォールバック**を入れてある（`lib/tables.ts` の `displayTableLabel`）。
厨房・レジは営業中に開きっぱなしの画面なので、ここが空欄になると事故になる。

### 検証状況（SQL適用後に実画面で全経路を確認済み）
- 一覧画面 PC/SP。移行された A1/A5/A99/A999 が `?t=<short_code>` 付きで表示される
- **お客様側の入口**: `?t=ttzfq8` → 「TABLE A1」、旧形式 `?table=5` → 「TABLE A5」。
  どちらも解決できることを確認（後方互換OK）
- **カートストア**: `?table=5` 訪問後に `tableId`(uuid) / `tableLabel`"A5" / `tableNumber`5 が
  localStorage に入ることを確認（＝注文INSERTに正しく載る）
- **厨房**: Order Card が "TABLE A5"（移行前の注文でもラベルが出る）
- **レジ**: Table Chip が "TABLE A1" / "TABLE A5"
- **ダッシュボード**: テーブル稼働カードのラベルが T5 ではなく "A5"
- **席設定モーダル**: カテゴリーBを新規作成→保存→一覧に反映→削除→保存 まで往復。
  このとき **既存 A の short_code が一切変わらないこと**を確認（最重要の不変条件）。
  削除確認の文言に卓数と「過去の注文は残ります」が出ることも確認
- **印刷**: 一覧の「選択した5件を印刷」→ 実ラベル（テイクアウト / テーブル A1〜A999）で面付け。
  13件で2ページに分割されることも別途確認
- `tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過

> 補足: ダッシュボードの「人気メニュー」「カテゴリ別売上」は現在も「データなし」。
> これはStep3-Nで直したマッピングのバグではなく、**唯一の会計済み注文に
> `order_items` の行が1件も無い**ため（RPCが `items: []` を返すことを確認済み）。
> 実際に注文が積まれれば出る。

## 卓ラベルの表示形式変更（Step3-O 追補）

天真さんの指摘「厨房のテーブル表示が TABLE 0 と出る」「カウンター C-1 のように
設定した名称＋番号にしてほしい」への対応。

### 原因（TABLE 0）
移行後に**新しく追加した卓は `legacy_number` が NULL** なので、注文時に
`orders.table_number` が 0 で入る。`table_label` が読めない経路に落ちると 0 が出る。
ラベルを必ず出す形にして根本から潰した。あわせて、卓の解決（サーバー往復）が
終わる前に「メニューを見る」を押せてしまう問題も塞いだ（解決するまでボタンを止める）。

### 新しい書式
- 短縮ラベル `tableShortLabel()` … **`A-1`**（コード-番号）
  ハイフンを入れるのは "A11" が「A-1の1」か「A-11」か読み違えないため
- フルラベル `tableFullLabel()` … **`カウンター A-1`**（カテゴリー名 ＋ 短縮ラベル）
  → **`orders.table_label` / `staff_calls.table_label` にはこの形で保存する**
- `shortenTableLabel(full)` … フルから短縮部分だけ取り出す（最後の空白より後ろ）

### どこで何を出すか
| 画面 | 表示 |
|---|---|
| 厨房 Order Card / Call Chip | フル（`TABLE` の接頭辞は廃止） |
| レジ Table Chip / 会計確認 | フル（同上） |
| 履歴 `/history` | フル |
| ダッシュボードのテーブル稼働 | 棒の軸は短縮、ツールチップはフル（棒幅が28〜32pxしかない） |
| 二次元コード管理の一覧カード | 短縮（グループ見出しに既にカテゴリー名が出ている） |
| 席設定モーダルの卓チップ | 短縮 |
| 印刷カード | フル（「テーブル」の接頭辞は廃止。ラベル自体が自己説明的なので） |
| お客様側TOP | 短縮（上に "TABLE" のラベルがあり、6xlの大きな文字なので390px幅に収まらない） |

### ⚠ 2本目のSQL `supabase/table_label_v2.sql` の実行が必要
- `resolve_table()` を新書式に（`short_label` も返すようにしたので DROP→CREATE）
- 既存スナップショットの付け替え。**卓が既に削除済みの注文は当時のラベルのまま残す**
  （スナップショットの意味を壊さないため）
- 未実行の間は旧ラベル（"A1"）がそのまま出るだけで、画面は壊れない

### Figmaも更新済み（`use_figma`）
- 厨房 PC/SP の Order Card ヘッダー・Call Chip、レジ PC/SP の Table Chip・
  会計確認アラートを `TABLE n` → `カウンター A-1` 形式に
- 二次元コード管理: カード見出しと席チップを `A1` → `A-1`、印刷カードをフルラベルに
- **カテゴリー名を短縮**（カウンター席→カウンター 等）。フルラベルに名前が乗るので、
  長いと厨房のカードヘッダーやレジのチップが横に伸びる
- ついでに **URL を `?table=A1` → `?t=k3f9x2` 形式に修正**（前回報告した差分）

## 卓名の2段組み表示とサイドバーの改行（Figma追随）

天真さんがFigmaを直したぶんの差し替え＋サイドバーの折り返し修正。

### サイドバー「テーブル/二次元コード」
220px幅だと1行に収まらず中途半端な位置で折れていたので、**改行位置を固定**した。
- `lib/staffRoles.ts` のラベルを `"テーブル/\n二次元コード"` に
- `NavItem` の span に `whitespace-pre-line`、高さを `h-[44px]` → `min-h-[44px]`
  （固定だと2行で文字がはみ出す）
- Figmaも Nav Sidebar v2 / Nav Drawer の**マスター側**を2行に変更。
  該当の Nav Item インスタンスだけ縦HUGにしてある

### 卓名は「カテゴリー名（小さくグレー）＋卓番号（大きく黒）」の2段組み
Figma 222:967（Order Card）/ 257:267（Table Chip）/ 222:241（Staff Call Chip）の更新に追随。

| 箇所 | 表示 |
|---|---|
| 厨房 Order Card | `カウンター`(JP/Heading/S・text-secondary) ＋ `L-1`(EN/Data/L・text-primary) |
| レジ Table Chip | `カウンター`(JP/Caption・text-secondary) ＋ `L-1`(EN/Price/L・text-primary) |
| 厨房 Call Chip | 卓番号のみ（`L-1`） |

`lib/tables.ts` に `splitTableLabel(full)` を追加（フルラベルを最後の空白で
カテゴリー名と卓番号に分ける）。`shortenTableLabel` はこれの薄いラッパー。
移行前の古いラベル（"5"）は category が空になり、卓番号だけが出る。

### 「TABLE 0」の原因と対策（再掲）
移行後に追加した卓は `legacy_number` が NULL なので `orders.table_number` が 0 で入る。
ラベルを必ず出す形にして潰した。あわせて、卓の解決が終わる前に
「メニューを見る」を押せてしまう問題も塞いだ（解決するまでボタンを止める）。

### SQL適用状況
`supabase/tables_qr.sql` / `supabase/table_label_v2.sql` とも**適用済み**。
実画面で「カウンター L-1」と出ることを厨房・レジの両方で確認した。

## お客様向け画面のUI改善（`prompts/customer-ui-improvements-prompt.md`）

### 1. 円形ボタンを48pxに統一
`Header Icon Button` 44→48 / `Back Button` 52→48 / `Modal Close Button` 36→48。
Modal Close Button は管理画面のモーダルでも使うのでそちらも48になる（合意済み）。

### 2. ヘッダーのボタンは常に右上に1つだけ
`OrderHeader` のボタンを `left-16` から `right-16 top-10` へ。☰でも×でも位置を変えない。
- TOP・ご注文確認 … `Header / Open`（☰）
- Menu・**カテゴリ一覧** … `Header / Close`（×）※カテゴリ一覧は☰だったので変更
- 商品詳細 … ×のみ右上（KVに浮かせる）。**メニューボタン☰は廃止**
- カート … 左Back＋右☰（変更なし、サイズのみ48）

### 3. TOPページ
- カテゴリごとの「2×2グリッド4件＋もっと見る」を**全商品の横カルーセル**に変更。
  `SeeMoreButton` はTOPから削除（`/order/[category]` 自体はMenuページから辿れる）
- 新規 `MenuCardM`（幅200）＋ `MenuCarouselM`（カード間12・左右パディング16）。
  2枚目が38pxはみ出す「見切れ」はスライド可能の手がかりなので scroll-snap で潰さない
- 新規 `CarouselDots`。スクロール量から現在地を算出。
  **10件以上でも横に伸びないよう最大7個に間引く**（先頭・末尾は必ず残す）
- 右下のスタッフ呼び出しベル（`FloatingStaffCall`）を廃止し、
  `FloatingCartButton`（`CartIconButton` 48px＋24pxバッジ）に置き換え。
  下部の「カートを見る」バーもTOPからは削除し、カート導線をこのボタン1つに集約
- **スタッフ呼び出しは失われていない**（Menuページの「スタッフを呼ぶ」とドロワーから使える）

### 4. 商品詳細
- **スクロール位置バグを修正**。原因は Next のスクロール復元とスライドアップ
  アニメの兼ね合いで、前の画面のスクロール位置が残ること。`PageTransition` で
  モーダルルートのときだけ `useLayoutEffect`（＝描画前）に `scrollTo(0,0)` を実行する
- 下部バーを再設計（白地＋上辺罫線・高さ76）。左に `CartIconButton`（バッジ付き）、
  右にステッパー＋「カートに入れる」。押すたびにバッジが増えてポップする
- `AddToCartButton` から**カートアイコンを削除**（左隣にカートアイコンが並ぶため重複）

### 5. カルーセルカードの操作UI
新規 `QuantityStepperS`（84×32）と `AddToCartButtonS`（108×32）。
84+8+108=200 でカード幅にちょうど収まる。カートのボックスアイコンは入れない。

### 6. CTAの統一
カートの「注文を確定する」と注文確認の「追加で注文する」を、商品詳細と同じ
`AddToCartButton` に差し替えた（独自スタイルだと高さが潰れる等のズレが再発するため）。

### ⚠ 途中で見つけた重大バグ（修正済み）
`CartIconButton` を入れた直後、**TOPページ全体が操作不能**になった。
原因は**ハイドレーション不一致**。カート個数は zustand persist（localStorage）なので
サーバー描画では常に0、クライアント初回描画では復元済み。個数でDOMを出し分けると
React がその Suspense 境界を丸ごとクライアント再描画に切り替え、
**イベントハンドラが失われて「見えているのに何も反応しない画面」**になる。

`hooks/useHydrated.ts` を追加し、個数依存のDOM（バッジ・下部バーの有無）は
ハイドレーション完了まで出さないようにした。
**同じ地雷が `BottomViewCartBar` にも元からあった**（`totalItems === 0` で null を返す）ので
そちらも直してある。カート個数で出し分けるUIを足すときは必ずこのフックを通すこと。

### 判断した点（ユーザー報告済み）
- カード／下部バーのステッパーは「何個入れるか」の**下書き**で、下限は1
  （0個追加は意味がないため）。カート画面のステッパーは従来どおり0で削除
- バッジは3桁以上を `99+` に丸める
- ドットはカテゴリカルーセルのみ。Best Seller（Menu Card Wide）は従来のまま
- 「カートを見る」バーの削除はTOPのみ。Menu・カテゴリ一覧では従来どおり出る

### 検証状況
実画面（localhost）で通しで確認済み:
ヘッダー右上化、カルーセルとドットの追従（実スクロール操作）、カード／下部バーの
ステッパーと「カートに入れる」でバッジが選択数ぶん増えてポップすること、
**深くスクロールしたTOPから商品詳細を開いても先頭から表示されること**（scrollY 3000 → 0）、
カート・注文確認のCTAが潰れず52pxで出ること。
`tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過。

## ベストセラー設定の追加 ＋ 並び替えUIの改善（`prompts/bestseller-and-reorder-prompt.md`）

### ⚠ `supabase/best_sellers.sql` の実行が必要
未実行の間、ベストセラー設定モーダルは「空の状態」で開き（取得失敗をcatchしている）、
保存しようとするとエラーになる。トップページは従来どおり自動算出のまま。

### 【1】ベストセラー設定
メニュー管理のTop Barに「👑 ベストセラーの設定」（SPは👑のみの丸ボタン）を置き、
モーダルで「トップページに表示するトグル」＋「登録済み商品の並び」を編集する。

- `stores.best_seller_enabled`（**settingsテーブルは新設せず**、同じ性質の
  `is_accepting_orders` がすでに stores にあるので列を1つ足した）
- `best_sellers(store_id, menu_item_id, display_order)`。menu_items 削除時は CASCADE
  （枠に幽霊が残らない）
- 保存は `save_best_sellers(p_enabled, p_items)` 1本（manager限定・トランザクション・
  20件上限をサーバー側でも検証）
- anon にも `best_sellers` の SELECT を開けている。中身は menu_item_id と並び順だけで、
  メニュー自体は元から公開情報。お客様側トップが直接読む必要がある

**トップページ側の分岐（プロンプト1-3の方針どおり実装）**:
| 状態 | 表示 |
|---|---|
| 表示OFF | Best Sellerセクションを**見出しごと描画しない**。タブナビと scrollspy からも除外 |
| 表示ON・登録0件 | 従来の `computeBestSellerItems()` による自動算出にフォールバック |
| 表示ON・登録あり | 指定順で表示。非公開/削除済みは落とすが順序は保つ |

設定の**取得に失敗したときも自動算出にフォールバック**する（設定が読めないだけで
枠が消えるのは困るため）。

### 【2】並び替えUI
- **SPは▲▼ボタン、PCは⠿ドラッグのまま**。`components/admin/ReorderButtons.tsx` を新設し、
  `AdminMenuRow` / `CategoryRow` / ベストセラー設定の3か所で使う。
  行の中で `hidden lg:flex`（⠿）と `lg:hidden`（▲▼）を出し分けている
- `useDragReorder` に `moveToTarget(sourceId, targetId)` を追加。▲▼は
  「**表示中の隣の行**」をtargetに渡すので、絞り込み中でも見たままの順序で動く
  （commit自体は全件配列の位置で計算するのでグローバル順序は壊れない）
- **並び替えできる条件を反転**した。メニュー管理は
  「すべて」＝並び替えUIごと非表示 / カテゴリー・テイクアウトで絞り込み中＝可能。
  トップページはカテゴリーごとに横並びで出るので、調整したいのは
  「そのカテゴリーの中での並び」であって全商品の通し順ではない
- カテゴリ管理は一覧が常に全件なので**常時並び替え可能**のまま
- ヒント文言をFigmaに合わせた（PC=⠿ / SP=▲▼）。「すべて」表示中はヒントも出さない

### 検証状況
実画面（localhost・PC/SP iframe）で確認済み:
「すべて」で⠿とヒントが消えること、カテゴリーで絞ると復活すること、
SPで▲▼が出て先頭の▲・最終の▼が無効になること、
**▲▼で実際に並びが変わりDBに永続化されること**（検証後に元へ戻した）、
カテゴリ管理もSP=▲▼/PC=⠿で切り替わること、ベストセラー設定モーダルの表示。
`tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過。

> 残: SP実機での長押しコンテキストメニュー確認（ドラッグをやめたので出ないはずだが、
> 実機タッチでの確認は未実施。`select-none` / `touch-manipulation` は入れてある）

## 商品詳細を「一覧に重ねるオーバーレイ」に変更（ルート遷移をやめた）

天真さんの指摘2点 —「開閉を左右スライドに」「TOPのスクロール位置を保持」— への対応。
**この2つは同じ原因（詳細が別ルートで、開くと一覧がアンマウントされること）から
来ている**ので、原因ごと外した。

### なぜルート遷移をやめたか
一度は `/order/item/[id]` のまま左右スライド＋`router.back()` で作ったが、
Next の App Router は遷移が完了するまで戻り先ページをマウントしないため、
**閉じるアニメ中に詳細が退いた領域には背景色しか出ない**という割り切りが残った。
天真さんの「アプリではありえない挙動なので妥協になります。同一ページ内の
オーバーレイで管理画面に影響が出たりがないのであれば、実装したいです」を受けて、
詳細を一覧の上に重ねる方式へ作り替えた。

### 構成
- `lib/itemOverlay.ts` — URLは `?item=<商品ID>`。`window.history.pushState` /
  `replaceState` を直接叩く（**Next 14.1+ はネイティブHistory APIと
  `useSearchParams` が同期する**ので、同一ルートのクエリ変更でRSC往復が起きない）。
  `pushedByApp` フラグで「アプリが履歴を積んで開いたか／直リンクか」を覚える
- `components/order/ItemDetailOverlay.tsx` — `fixed inset-0 z-50` の全画面。
  中身は旧詳細ページとまったく同じ（KV・Intro・Sub Image・縦動画・Recommended・
  Bottom Detail Bar）
- `app/order/layout.tsx` — オーバーレイを**1つだけ**マウント。TOP／カテゴリ一覧／
  テイクアウトのどこから開いても同じインスタンスが使われる
- `app/order/item/[id]/page.tsx` — `redirect('/order?item=<id>')` だけの
  サーバーコンポーネントに縮小（外部共有URL・古いブックマーク救済用）
- `components/PageTransition.tsx` — 詳細の特別扱いを全削除。お客様画面の
  `page-fade-in` のみに戻した。`body.page-sliding` も不要になったので撤去

### 実装上の注意（踏んだ順）
- **下部バーは `position: fixed` にできない**。スライド中は祖先に transform が
  乗るので fixed がビューポート基準でなくなる。オーバーレイ内 flex の末尾に
  `shrink-0` で置いている
- 背面の一覧に慣性スクロールが伝わらないよう、開いている間は
  `document.body.style.overflow = "hidden"`＋本文側に `overscroll-contain`
- 閉じる時は退場アニメ（260ms）を待ってから `history.back()`。
  **直リンクで開かれた場合は戻り先がアプリ外**なので、その時だけ
  `replaceState` でパラメータを落とす
- 開いている間は `useUiStore.setOverlay("modal")` でカートFABを隠す（既存ルール）
- **管理画面への影響なし** — 変更したのは `app/order/**` と
  `components/order/` ＋ `PageTransition`（`/admin`・`/api` は素通り）だけ

### 検証状況
実測で確認済み:
- TOPを scrollY 3500 までスクロール → 商品タップ → `/order?item=…` になり
  オーバーレイ表示、**一覧はマウントされたまま `window.scrollY` は 3500 のまま**
- ×で閉じる → `/order` に戻り scrollY 3500／`body.overflow` も復帰
- **ブラウザの戻るボタン**でも同じく閉じる（scrollY 3500 維持）
- カテゴリ一覧 `/order/pancake` からも同様（`/order/pancake?item=…` → 閉じて 700 維持）
- 旧URL `/order/item/<id>` 直叩き → `/order?item=<id>` にリダイレクトして
  オーバーレイが開き、×で履歴を戻さずパラメータだけ落ちる
- アニメを一時的に3秒へ引き伸ばして目視 → **スライド中も背面に一覧が見えている**
  （＝今回の主目的。旧方式の「背景色しか出ない」割り切りは解消）
- `tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過

## モーション設計の実装（prompts/motion-spec-prompt.md）

タップの手触りを設計仕様どおりに入れた。基準は**触って気持ちいいが操作の邪魔をしない**こと。

### トークン（app/globals.css の `:root`）
`--motion-press/release/state/roll/pop`、`--ease-out/in/pop`、`--press-scale` を追加。
既存の `--t-*` / `--ease-breath` 系はページトランジションが使っているのでそのまま残した。
**`--ease-pop` を使ってよいのはカートバッジだけ**（跳ねる動きが複数あると画面が落ち着かない）。

### プレス（押せるものすべての土台）
`button, .btn, .pressable` に共通で当てている。
`<a>` / `<Link>` / カードなど button でない要素には `.pressable` を明示的に付ける
（LinkButton・SeeMoreButton・MenuCategoryCard・RecommendCard）。

- 押し込み80ms / 戻り160msの**非対称**。同じ速さだと機械的で、戻りを遅くすると弾力が出る
- 動かすのは `transform` だけ。`width`/`top`/`margin` を触ると連打でカクつく
- `touch-action: manipulation` … タップ後の300ms待ちを消す。
  **これが無いとどれだけアニメを詰めても遅く感じる**
- **無効な要素は押し込まない**（`button:disabled:active` 等で打ち消し）。
  押せたように見えて何も起きないのが一番の不信感になる

> 以前は `button:active { transform: scale(0.97) }` を無条件に当てていたため、
> **disabled のボタンも押し込めてしまっていた**。今回それも直っている。

### ホバー（PCのみ）
`@media (hover: hover) and (pointer: fine)` で囲っている。
**これが無いとスマホでタップした要素にホバーが貼り付いたまま残る。**
`.btn-pill`（浮き＋影）/ `.btn-icon`（背景色）/ `.btn-icon-soft`（元から bg-tertiary の円ボタン用）/
`.chip`（`.is-active` 以外）/ `.menu-card`（影＋画像ズーム）。
画像だけ420msと遅いのは、面積が大きいものはゆっくり動かすと自然に見えるため。

> インラインの `style={{ boxShadow }}` は **stylesheet の `:hover` に勝ってしまう**ので、
> ボタン類の影は `shadow-[var(--shadow-card)]` クラスに移した。

### カートに入った瞬間
バッジが `1 → 1.32 → 1` と跳ねるだけ。**トーストも、飛んでいく画像も、ラベル差し替えもしない**
（幅が変わると連続で押したいときに邪魔になる／視線が奪われて注文の流れが切れる）。
Header.tsx にあった**アイコン自体の回転バウンド（cart-bump）は削除**した。
跳ねる主体はバッジ一つに集約する。

### 数量の切り替わり（components/ui/RollingNumber.tsx を新規追加）
今の数字が下へ抜けると同時に、次の数字が上から入る（**同じ向き**なのですれ違わない）。

**退場と入場を別々のDOM要素として描き分けている**のが要点。同じ要素にクラスを付け替えると
2つの animation が競合し、CSSの後勝ちで入場が再生されて数字がその場に残る
（「最初の1回だけ正常で、2回目以降は前の数字が残る」症状の正体）。
`seq` をキーに含めて毎回作り直すことで、この競合自体を起こさない。
連打時は seq が進んだ時点で古い退場要素がキーごと外れるので、三重に積み重ならない。
削除は `setTimeout` ではなく `animationend`（速度トークンを変えても消えるタイミングがずれない）。

### 検証状況
- トークン8種が意図した値で配信されていること、`(hover: hover) and (pointer: fine)` 配下に
  7ルールが入っていること、`button:disabled:active` の打ち消しが存在することを実測
- ステッパーの寸法が据え置きであること（L: 36px高/数字20×24が上下中央、S: 32px高/16×18）
- 連打しても `.count` の中が常に「退場1＋入場1」の2要素で収まること
- `tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過

> **`animationend` による退場要素の削除だけは自動検証できていない。**
> 操作対象タブがバックグラウンド（`visibilityState: "hidden"`）だと Chrome は
> CSSアニメを進めず、`Animation.finish()` を呼んでも `animationend` が発火しない
> （100msのプローブ要素で切り分け済み）。表示中のタブでは発火するので実機で確認すること。

### 積み残し（設計仕様 §8 への回答）
- **`overflow:hidden` の入れ子**: カルーセル（`overflow-x-auto overflow-y-hidden`）の中にある
  Menu Card M の「カートに入れる」は、PCホバー時の**影の下側が切れる**。
  押し込み（縮小）と浮き（-1px）は問題なし。横スクロール領域は `overflow-y: visible` に
  できないため、直すならカルーセルに下余白を足すことになる
- **`.btn-confirm`**: 独自アニメーションは持っておらず、静的なスタイルのみだった。
  今回の共通プレスをそのまま継承させている（寄せる作業は不要だった）
- **motion-lab の調整値**: 既定値のまま実装した（`~/Downloads/motion-lab_2.html` の初期値と一致）。
  天真さんがスライダーで詰めた値があればトークン5行を差し替えるだけで反映できる

## オーバーレイ後の微修正3点（下部バーの隙間 / マーキー / カートFAB）

### 1. 下部バーの下に透明な隙間ができる
オーバーレイを `fixed inset-0` で組んでいたのが原因。`inset-0` が基準にするのは
**レイアウトビューポート**で、モバイルSafari/Chromeでアドレスバーが引っ込んで
表示領域が広がっても追従しない。広がった分だけ下に隙間が空き、背面の一覧が透ける。

`.h-viewport { height: 100vh; height: 100dvh; }`（globals.css）を追加し、
オーバーレイを `fixed left-0 right-0 top-0 h-viewport` に変更。
dvh は現在の表示領域に追従するのでズレない。`100vh` を先に書いて未対応ブラウザの
フォールバックにしている（後勝ちで dvh が採用される）。

> デスクトップのエミュレート環境では隙間が出ないので気づけない。
> **この手の「実機だけで出る下部の隙間」は、まず dvh を疑うこと。**

### 2. RECOMMENDED が自動で流れない
2つ原因があった（`components/ui/MenuCarousel.tsx`）。

- **位置を `el.scrollLeft` から読み戻して足し込んでいた**。30px/秒だと1フレーム
  約0.5px で、これがブラウザ側の丸めに飲まれると位置が永久に進まない
  （**iOS Safari は `scrollLeft` を整数に丸める**）。現在位置を JS 側の変数で
  持ち、DOMには書くだけにした
- **`pointerdown` で恒久停止していた**。詳細を縦スクロールしようとした指が
  たまたまカルーセルに乗っただけで二度と動かなくなる。
  触っている間だけ止めて、離してから2秒で再開する方式に変更

### 3. TOPのカートFABを右下→左下へ
`components/ui/FloatingCartButton.tsx` を `right-[16px]` → `left-[16px]`。

あわせて**セーフエリアの二重計上**を修正。`safe-bottom`（padding-bottom: env(...)）と
`bottom: calc(24px + env(...))` の両方が付いていたため、ホームインジケータのある
端末ではボタンが余分に浮き、下に透明な余白ができていた。`bottom` 側に一本化。

### 検証状況
- 下部バー: `gapBelowBar = 0`（dialog高さ = innerHeight）を実測
- FAB: 左16px / 下24px / wrapperのpadding-bottom 0 を実測
- `tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過

> **マーキーの動作は自動化ブラウザでは検証できない**。操作対象のタブが
> バックグラウンド扱い（`document.visibilityState === "hidden"`）だと
> Chromeが `requestAnimationFrame` を止めるため、`scrollLeft` は常に0のまま。
> コードレビューでの確認にとどめ、実際に流れるかは実機で見てもらうこと。

## デプロイ手順（2026-07-29 更新: Git連携を有効化）

それまでは Vercel と GitHub が繋がっておらず、push しても本番は変わらなかった。
毎回ローカルから `npx vercel --prod` を叩いて上げていた（＝手元の作業ツリーの
中身がそのまま本番になるので、コミットし忘れたファイルでも動いてしまう危険があった）。

`vercel git connect https://github.com/temmahirasawa-spec/good-order.git` で接続済み。
**以降は `main` への push だけで本番が更新される。**

- 環境変数は Vercel 側に登録済みのものが使われる（`.env.local` は `.gitignore` 対象で
  リポジトリには入っていない）
- そのため **ビルドに要るファイルは必ずコミットする**こと。
  手動 `vercel --prod` と違い、Git連携ビルドはリポジトリの中身だけで走る
- 手動で上げたいときは従来どおり `npx vercel --prod` も使える

## 積み残しの解消（2026-07-29）

「次にやること」に溜めていた3件を片付けた。

### 1. 厨房で同じ品目を連続クリックすると2回目が競合になる → 修正

原因は**自分の更新で変わった `updated_at` をローカルに書き戻していなかったこと**。
`order_items` には BEFORE UPDATE トリガー（`trg_order_items_set_updated_at`）が
効いていて、更新のたびに `updated_at` が変わる。ところが画面が持っている値は
取得時のままなので、3秒のポーリングが来る前にもう一度押すと、**他端末ではなく
自分の直前の更新と競合**して0件更新になっていた。

- `updateOrderItemCookingStatusIfUnchanged` / `updateOrderStatusIfUnchanged`
  （`lib/api.ts`）が、更新後の `updated_at` を返すようにした
  （`.select("id, updated_at")` は元からあり、`RETURNING` はトリガー適用後の値を返す）
- 厨房側は成功時にその値を state に書き戻す。`updateItemInGroups` に
  `newUpdatedAt` 引数を足した
- ポーリングの巻き戻り防止に使っている `pendingItemUpdates` も
  `status` だけでなく `updatedAt` を持つようにした。DBがまだ追いつかず
  ローカル値で上書きするときに、基準値まで古いままだと同じ競合が再発するため
- 応答待ちの間にさらに押されていた場合は、後着の楽観更新を巻き戻さないよう
  「pending がまだ自分のものか」を確認してから書き戻す

> 連打そのものを直列化はしていない。**応答が返る前**に押した2発目は
> 従来どおり競合→再取得で吸収される（表示は正しい状態に収束する）。

### 2. 保存せずキャンセルするとStorageに孤児オブジェクトが残る → 修正

編集パネルは**ファイルを選んだ瞬間にアップロードして即プレビュー**する作りなので、
保存せず閉じられるとオブジェクトだけが残る。方針を
**「DBを正として、Storageは後から追従させる」**に統一した（`lib/storage.ts` に
`deleteUploadedMedia()` を新設。失敗は警告ログのみでユーザー操作をブロックしない）。

| 操作 | Storage の扱い |
|---|---|
| このパネルで上げたぶん＋キャンセル | その場で削除（DBはまだ参照していない） |
| このパネルで上げたぶん＋保存 | 残す（本採用） |
| 既存メディアを外す＋保存 | **保存が通ってから**削除 |
| 既存メディアを外す＋キャンセル | 削除しない |

- `closePanel()` を「保存後に閉じる」用に残し、×・キャンセル・背景クリックは
  新しい `cancelPanel()` に振り替えた（メニュー管理・カテゴリ管理の両方）
- **あわせて既存の別バグも直した。** メニュー管理の `handleRemoveMedia` は
  既存メディアも**その場でStorageから消していた**ため、外したあとキャンセルすると
  DBの参照だけが残って画像が壊れていた。保存成功後に消す方式へ変更
- カテゴリ管理は、同じパネル内で画像を選び直したときに1枚前を即削除する
  （どちらもDBは未参照なので保存を待つ理由が無い）

### 3. Color Swatch Picker のFigma差分 → 実装が正しいことを確認済み

`get_screenshot`（`306:1535`）で再確認した。**Figmaコンポーネントの実描画は
黒い外枠のみで、チェックは無い**（選択中のスウォッチを4倍に拡大して確認）。
説明文だけが古い。現在の実装（外枠のみ）で一致しているので変更不要。

### 4. カルーセル内でホバー影が切れる（設計仕様 §8）→ 修正

`overflow-x: auto` を使う以上 `overflow-y` だけ `visible` にはできない（仕様で
auto に強制される）ので、**クリップ範囲そのものを下へ広げた**。
overflow のクリップは padding box なので、`padding-bottom` が影の逃げ場になる。

`.carousel-hover-room`（globals.css / ホバー可能端末のみ）で
`padding-bottom: 12px` + `margin-bottom: -12px`。**打ち消し合うのでレイアウトは
1pxも動かない**。12px の根拠は `.btn-pill` のホバー影 `0 4px 14px` が
下に約11pxはみ出すこと。

### 未適用だったSQLは2本とも適用済みだった
実DBに問い合わせて確認した（`docs/handoff.md` の旧「⚠実行が必要」は解消）。
- `best_sellers.sql`: `best_sellers` テーブルに行があり、`stores.best_seller_enabled` も存在
- `table_label_v2.sql`: `resolve_table(p_legacy_number:=1)` が
  `{label:"テーブル A-1", short_label:"A-1"}` を返す（＝新書式・`short_label` 付き）

### 検証状況
- **厨房**: 実画面で同じ品目を **900ms間隔で4連打**（＝ポーリング3秒より短い、
  従来なら必ず競合した条件）。4回とも状態が正しく1段ずつ進み、
  `console.warn` の競合検出は**0件**。検証後に元の「未調理」へ戻した（0/3品）
- **Storage**: 管理画面で32pxのテスト画像を実際にアップロード → キャンセル →
  Storage の list API（CDNを経由しないので実体が分かる）で**消えていること**を確認。
  既存画像を control として同時に引き、そちらは残ることも確認
- **カルーセル**: `padding-bottom:12px` / `margin-bottom:-12px` を実測。
  「カートに入れる」の下端がカード下端と**完全に一致**していた（＝以前は影が
  全部切れていた）こと、クリップ範囲が12px下がったこと、ドットの位置が
  カード下端から12pxのまま変わらないことを実測
- `tsc --noEmit` / `next lint`（警告0）/ `npm run build` 通過

> **既存メディアを外してキャンセルしたとき消えないこと**は、実データを壊す
> リスクがあるので実画面では試していない（コードレビューのみ）。

## 公開準備②: SEO / favicon / OGP / Search Console（2026-07-29）

公開準備の2本目。1本目（メディア圧縮）の続き。

### インデックス方針（この設計の前提）

**検索に載せるのは TOP（`/`）だけ。** 注文フロー・カート・履歴・管理画面はすべて noindex。

- `/` は卓パラメータが無いとテイクアウト注文の入口になるので、検索から直接来ても
  注文が成立する = 単体で完結している唯一のページ
- `/order`・`/cart`・`/complete`・`/history` はカート状態や二次元コードを前提にした
  画面で、検索から来ても意味を成さない
- 将来メニュー一覧をSEOに使いたくなったら `app/order/layout.tsx` の `robots` を
  外すだけでよい

`robots.txt` でクロールを止めるのは `/admin`・`/api/`・`/dev/` の3つだけ。
**注文フローは robots.txt では止めていない**（robots.txt で弾くとページ内の noindex を
読んでもらえず、逆に「URLだけ」インデックスされることがあるため。クロールは許可して
`<meta name="robots" content="noindex">` で除外するのが正しい）。

### 追加・変更したファイル

| ファイル | 役割 |
|---|---|
| `lib/siteConfig.ts` | **新規**。公開URL・店舗情報・JSON-LD の唯一の置き場所 |
| `app/layout.tsx` | metadataBase / title template / OGP / Twitter Card / manifest / appleWebApp / Search Console 確認タグ |
| `app/robots.ts` | `/robots.txt` を生成 |
| `app/sitemap.ts` | `/sitemap.xml` を生成（TOPの1件のみ） |
| `app/manifest.ts` | `/manifest.webmanifest` を生成 |
| `app/page.tsx` | **server component になった**。JSON-LD を出すだけ |
| `components/top/TopScreen.tsx` | **新規**（旧 `app/page.tsx` の中身をそのまま移動） |
| `app/{order,cart,complete,history,admin,dev}/layout.tsx` | 各セグメントの title と noindex |
| `components/StoreInfoModal.tsx` | 店舗情報を `lib/siteConfig.ts` から引くように |
| `app/favicon.ico` `app/icon.png` `app/apple-icon.png` | ブランドアイコン（後述） |
| `app/opengraph-image.jpg` + `.alt.txt` | OGP画像 1200×630（37KB） |
| `public/icons/*` | manifest 用 192 / 512 / maskable |

**`app/page.tsx` を server component に分けた理由**: JSON-LD をクライアントの
JSバンドルに載せないため。画面本体は hooks を使うので client のまま
`components/top/TopScreen.tsx` に移し、`app/page.tsx` は構造化データを出すためだけの
薄いラッパーになっている。

### 公開URLの決まり方（独自ドメインを当てるときはここだけ）

`lib/siteConfig.ts` の `siteUrl` が canonical・OGP・sitemap・robots の絶対URLすべての
出どころ。優先順位は:

1. `NEXT_PUBLIC_SITE_URL`（Vercelの環境変数に入れる。**独自ドメインを当てたらこれだけ**）
2. `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`（Vercelが自動で入れる本番URL。
   プレビュー環境でも本番URLを指すので canonical としては正しい）
3. `https://yorkys-orderly.vercel.app`（既定値）

### アイコンの作り方（作り直すとき用）

素材は `public/images/logo/logoSmallBlack.webp`（1000×348 の横組みロゴ）。
たまごマークのバウンディングボックスを生ピクセルで実測して `crop=191:229:0:17`。
これを `#FDF8F2`（テーマカラーと同じクリーム）の正方形に載せている。
マークの高さ比率は 512/192/180 が 62%、maskable が 45%（中央80%が安全域のため）、
16/32/48 は 76〜80%（小サイズは余白を詰めないと潰れて見える）。

`favicon.ico` は 16/32/48 の PNG を ICO コンテナに連結して自作した
（ImageMagick が無いため。ICO は Vista 以降 PNG をそのまま格納できる）。
**旧 `favicon.ico` は create-next-app の既定アイコンのままだった**（25,931バイト）。

OGP画像は LPのヒーロー動画の1フレーム目（`background-poster.webp`）を
`gblur=sigma=3` + 黒55%で沈めて、白ロゴを中央に置いたもの。中央配置なのは
LINEなどが正方形にトリミングしてもロゴが切れないようにするため。

### 検証済み（ローカル本番ビルドで実測）

- `/robots.txt` `/sitemap.xml` `/manifest.webmanifest` が期待どおりの中身で 200
- `/favicon.ico`(3.4KB) `/icon.png` `/apple-icon.png` `/opengraph-image.jpg` が 200
- `robots` メタ: `/`=index,follow ／ order・cart・complete・history=noindex,nofollow ／
  admin・dev=noindex,nofollow,nocache
- `<title>` がテンプレート（`%s｜YORKYS BRUNCH 夙川店`）で全ページ出ている
- JSON-LD が TOP のHTMLに入っていること、JSONとしてパースできることを確認
- TOP画面の見た目が分割後も変わっていないことをブラウザで確認
- `tsc --noEmit` / `npm run build` 通過

### ⚠ ユーザー側の作業が必要なもの

1. **Google Search Console の登録**（コードだけでは終わらない）
   - <https://search.google.com/search-console> で URLプレフィックス型のプロパティとして
     `https://yorkys-orderly.vercel.app/`（独自ドメインならそちら）を追加
   - 所有権の確認は「HTMLタグ」方式が楽。表示される
     `<meta name="google-site-verification" content="XXXX">` の **XXXX の部分だけ**を
     Vercel の環境変数 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` に入れて再デプロイ
     → Search Console 側で「確認」を押す
   - 確認後、サイトマップに `sitemap.xml` を送信
   - 独自ドメインを当てるなら、**先にドメインを決めてから登録する**のが手戻りがない
2. **`NEXT_PUBLIC_SITE_URL`** — 独自ドメインを当てたら Vercel の環境変数に設定
3. **OGPの見え方の最終確認** — 本番デプロイ後に実際にLINEやXへURLを貼って確認
   （ローカルURLでは各社のクローラーが取得できないため未検証）

### 判断が要る／未対応で残していること

- `keywords` に入れた **「ヨーキーズブランチ」** はこちらの推定表記。正式なカナ表記が
  あれば `app/layout.tsx` の `keywords` を直すこと
- **公式サイトがある場合**、そちらにも同じ店舗の構造化データがあるはず。本来は
  `sameAs` で公式サイトを指すか、`@id` を揃えて同一実体だと示すのが望ましい。
  公式ドメインが分からないので今回は入れていない
- JSON-LD に **座標・価格帯・予約可否は入れていない**。確かな値が無く、推測を入れると
  Google側の実店舗情報と食い違って不利になるため
- `app/layout.tsx` の `viewport` は `maximumScale:1, userScalable:false` のまま。
  Lighthouse のアクセシビリティで減点される項目だが、モバイルオーダーの
  アプリ的な操作感を優先した既存の判断なので変えていない
- `public/fonts/` の HalisR 7ファイルのうち **ExtraLight と Regular は
  `app/globals.css` から参照されていない**（各53KB）。デプロイ容量の話なので
  「余分なコードの棚卸し」セッションでまとめて判断したい
- `/dev/ui` は認証なしで本番に出ている。noindex にはしたが、**そもそも本番に
  含めるべきかはセキュリティ回で判断**

## ログイン画面のリデザインと、そのFigma起こし（2026-08-04）

コード → Figma の**写し取り**。デザインを新しく決めた作業ではない。

### コード側（PR #26）
`/admin/login` だけが旧デザイン（`warm-*` / `brand-*` パレット・HalisR・Tailwind既定の角丸と
グレー）のまま残っていたので、他の管理画面と同じトークンと作法に揃えた。
借りた先は SettingsSection（カード枠）／ menu/categories の編集パネル（フォーム項目）／
tables の全幅ボタン（主ボタン）／ VideoSlotField（エラー枠）。
**`handleLogin` と import は1文字も変えていない**（機械的に照合済み）。文言も変えていない。

### Figma側（`Admin Login / 管理画面ログイン` = `1148:8687`）
MobileOrder ページの**最下部**に新設。PC 3枚（`1180x820`）＋ SP 3枚（`390x844`）で、
状態は 通常 / エラー / ローディング の3つ（空・0件・削除確認はこの画面に起こり得ない）。

| 使ったもの | node |
|---|---|
| 入力欄 | `Form Field / Type=Text`（`306:1484`）のインスタンス ×12 |
| 主ボタン | `Modal Button / Style=Primary`（`638:872`）のインスタンス ×6 |

**既存に無かったので新規に作ったもの**: エラーバナー / スピナー / ブランドロックアップ。
別セッションが同じファイルを触っていたため、Componentsページには登録せず
ログインのフレーム内に閉じてある（＝共通コンポーネントの子を触らない ＝ 8/3 の
「Nav Sidebar に子を足したら別画面のラベルが化けた」事故の再発を構造的に防ぐ）。

**⚠ 既知の差分**: ローディングのスピナーは**ボタンの子ではなく、ボタンの上に重ねた絶対配置**。
Figma はインスタンスに子を追加できないため。スピナーと文字の間隔8pxは実装どおりだが、
2つ合わせた塊が**本物より約12px 左に寄っている**。
きれいに直すなら `Modal Button` に Loading バリアントを足すのが正解（＝共通コンポーネントの
変更なので別タスク）。

### この作業で分かったこと
- `search_design_system` は**published library しか見ない**。このファイル内のコンポーネントは
  引っかからず、別プロジェクト（`eSIM Web改善`）の Input / RadioButton が返ってくる。
  **ファイル内の資産を探すときは Components ページ（`46:16`）の metadata を直接読むこと**
- `node.query()` の属性セレクタは**値に空白があると壊れる**。`FRAME[name=Login Card]` は
  `FRAME[name=Login` ＋ `Card]` に分解されて null が返る。空白を含む名前は
  `children.find(c => c.name === "...")` で取ること
- セクションの子（フレーム）の x/y は**セクション基準の相対座標**
- クローンしたフレームの幅を変えても、中のテキストは折り返さない。
  `textAutoResize = "HEIGHT"` ＋ `layoutSizingHorizontal = "FILL"` を明示すること
  （PC→SPでバナーの文字が切れて発覚）

## 次にやること

`prompts/`配下の未消化プロンプトは無い。

### 公開準備の残り
1. ~~メディア圧縮~~（完了・未コミット）
2. ~~SEO / favicon / OGP / Search Console~~（完了・未コミット）
3. セキュリティ点検（RLS・`/dev/ui` の扱い・service_role keyのローテーション・
   管理画面の権限）
4. 余分なコード / 依存の棚卸しとパフォーマンス
5. 本番デプロイ後の実機確認（OGP・動画再生・二次元コードからの導線）

### 積み残し
- カテゴリ管理PCの「表示順バッジ」はFigmaにPC版コンポーネントが無いため推定実装。
  PCテンプレートを入手できたら要突き合わせ
- motion-lab の調整値は既定値のまま。天真さんがスライダーで詰めた値があれば
  `app/globals.css` の `:root` のトークン5行を差し替えるだけで反映できる
- 商品を削除したとき、その商品が参照していた既存画像はStorageに残る
  （今回入れたのは「そのパネルで上げたぶん」の掃除まで。過去ぶんの棚卸しは別件）

## Figma 検品の負債台帳（2026-08-05 時点・未返済 2030件）

**この2030件は「直したもの」ではない。1件も直っていない。**
`scripts/figma-check-baseline.json` に登録して、検品を緑にしているだけの
**未返済の負債**である。台帳は「ここから増えたら落とす」ための基準線であって、
返済が終わったことを意味しない。

- **合計 2030件 / 923種類**（`total: 2030` / `keys: 923`）
- 1種類が複数件あるので、種類の数と件数は一致しない
- 内訳は下の表のとおり。**要約せず1行ずつ載せてある。返済するときの作業リストとして使う**

### ⚠ 65件 → 2030件 に増えたのは「悪化」ではなく「検査を新しく足したから」（2026-08-05）

`harness/scripts/check-figma.mjs`（#35 でハーネス側に先行移植済み）から
**余白のスケール検査**を本体 `scripts/check-figma.mjs` に移植した。この検査は、
オートレイアウトの `paddingTop/Right/Bottom/Left` `itemSpacing` `counterAxisSpacing` が
Spacing変数のスケール（`0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 112, 128`）に
乗っているか、または変数バインド済みかを見る。値がスケール外の中途半端な数字（例:
`itemSpacing=10.174359321594238`）だと落ちる。

移植すると、これまで検知していなかった**887種類 / 1965件**の余白違反が新たに見えるようになった。
**これは1件も新規に増えた不備ではない。** 検査を足す前から Figma 側に存在していた違反が、
検査を足したことで初めて可視化されただけである。旧来の36種類/65件（生フレームのボタン・
SPタップ領域）と合算して、台帳は **923種類 / 2030件** になった。

移植前に「構造・パディング」が0件であることを確認してから
`npm run design:figma -- --update-baseline` で台帳を作り直した（この確認を怠ると、
構造違反を抱えたまま台帳に焼き付けてしまい、以後その穴が見えなくなる）。

**PRの本文でもこの書き分けを崩さないこと**（「増えた」ではなく「見えるようになった」。
「返済した」と「誤検知が消えた」を混ぜないのと同じ理由）。

### ⚠ 74件 → 65件 に減ったが、**9件は「返済した」のではなく「誤検知だった」**

判定の誤りを直した結果、**9件が台帳から消えた。これは1件も直していない。**
消えたのは以下で、いずれも中身はコンポーネント化されており、**それを包む枠を責めていただけ**だった。

| ノード | 寸法 | 実体 |
|---|---|---|
| `CTA` ×3 / `CTA Panel` ×3 | 最大 1440×630 | LP のセクション帯そのもの |
| `Staff Tabs` ×2 | 689×40 / 342×79 | 中身は `Web / Tab Pill` インスタンス5個 |
| `SP State — 追従ヘッダー + タブナビ + CTAバー` | 390×844 | 画面まるごとのフレーム |

**返済すべき実体は 65件。** 内訳の表がそれである。

### 「生フレームのボタン」判定の考え方（2026-08-04 に変更）

名前だけで決めると入れ物まで落とす。**中身と大きさも見る。**
名前が `button|btn|chip|cta|tab` にあたり、末尾が入れ物の語でない Frame を候補にしたうえで、

1. **子孫に INSTANCE / COMPONENT が2個以上あるもの**は候補から外す（ボタンを並べている入れ物）
2. **高さが 120px を超えるもの**は候補から外す（セクション帯・大きなカード）

> **「1個以上」にしてはいけない（2026-08-04 に実測して判明）。**
> 生フレームのボタンはたいてい中に `Icon` インスタンスを1個持っている
> （`Delete Button` 32×32 の中に `Icon` 1個、など）。1個で除外すると
> **本物の生フレームボタン11件がまとめて消えた。**
> `Delete Button`×3 / `Edit Button`×2 / `More Button` / `コピー Button` / `DL Button` /
> `Best Seller Settings Button`×2 / `Export Button` がそれ。2個以上に絞って拾い直している。

3. **直接の子に、枠とほぼ同じ大きさ（幅または高さが90%以上）の INSTANCE / COMPONENT が
   あるもの**は候補から外す（そのコンポーネントを包んでいるだけの容器）

> **なぜ3つ目が要るか（2026-08-04 に追加）。個数では容器と本物を区別できない。**
> GOOD LOOP の `CTA Block` は 342×77 の枠に `Loop / Button`（342×52）が**1個**だけ。
> GOOD ORDER の `Delete Button` は 32×32 の枠に `Icon`（16×16）が**1個**だけ。
> どちらもインスタンス1個・高さ120px以下なので、条件1と2では区別できない。
> 違うのは**大きさの比率**で、前者は幅が100%一致（＝包んでいるだけ）、後者は50%（＝本物のボタン）。
> これで GOOD LOOP 側に残っていた `CTA Block` 18件（9業態×2）が除外される。
>
> **「直接の子」に限ること。** 子孫まで見ると、深い階層のインスタンスが偶然大きいだけで除外される。
>
> **GOOD ORDER の件数はこの条件では変わらない。** 追加除外されるノードが1件も無いことを
> 実際に走査して確認済み（MobileOrder 5 / Website 17 / Components 18 / 居酒屋 1 のまま）。
> この条件は LOOP 側の誤検知を消すために足したもので、ORDER の負債65件はそのまま残る。

**幅では判定しない。** PC管理画面には横幅864pxの全幅ボタンが実在するため、
幅を条件に入れると本物を見逃す。
**`CONTAINERISH` の語リストに語を足す方向で解こうとしないこと。**
末尾が容器の語でない入れ物（`CTA Block` `Hero CTAs`）はいくらでも作れるので、語は永久に足り続ける。

### ベースラインの仕組み（2026-08-04 に件数つき形式へ変更）

**キーごとに件数を記録する。「同じ違反が増えたこと」も検出できる。**

| 状況 | 結果 |
|---|---|
| キーが台帳に無い | **落とす**（新しい種類の違反） |
| キーがあり、今回の件数 ≤ 台帳の件数 | 通す |
| キーがあり、今回の件数 > 台帳の件数 | **落とす**。「8件で登録されていたものが9件に増えています（+1）」と出す |
| キーがあり、今回の件数 < 台帳の件数 | 通す。「返済が進んだもの」として報告する |

**件数が減っても台帳は自動では書き換わらない。** 書き換わるのは
`npm run design:figma -- --update-baseline` を明示的に叩いたときだけ。
勝手に基準線が下がると、返済したことに気づけなくなる。

**旧形式（キーの配列）が置かれていたらエラーで落とす。** 件数を持たない台帳を
「全部1件ずつ」と読み替えると、いきなり大量に落ちて原因が分からなくなるため。

**台帳がまだ無い状態で違反が出たときだけ、初回向けの案内を出す。**
台帳が既にある場合は出さない（`--update-baseline` を安易な逃げ道として案内しないため）。

### 内訳（923種類 / 2030件）

内訳は下表のとおり。既存分（36種類/65件・生フレームのボタン・SPタップ領域）と、今回移植した余白のスケール検査分（887種類/1965件）が両方含まれる。

| ページ / セクション | ノード名 | 違反の内容 | 件数 |
|---|---|---|---|
| Brand Guideline / 02_LOGO_SYSTEM | `Logo/Lockup/Horizontal` | の余白がスケール外です（itemSpacing=22） | 1 |
| Brand Guideline / 02_LOGO_SYSTEM | `Logo/Lockup/Stacked` | の余白がスケール外です（itemSpacing=28） | 1 |
| Brand Guideline / 03_COMPONENTS | `BB/Card/Rule` | の余白がスケール外です（itemSpacing=10） | 1 |
| Brand Guideline / 03_COMPONENTS | `BB/Tag/Status` | の余白がスケール外です（paddingBottom=3） | 1 |
| Brand Guideline / 03_COMPONENTS | `BB/Tag/Status` | の余白がスケール外です（paddingLeft=10） | 1 |
| Brand Guideline / 03_COMPONENTS | `BB/Tag/Status` | の余白がスケール外です（paddingRight=10） | 1 |
| Brand Guideline / 03_COMPONENTS | `BB/Tag/Status` | の余白がスケール外です（paddingTop=3） | 1 |
| Components / 00 Foundations | `Chips` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 00 Foundations | `Demo` | の余白がスケール外です（itemSpacing=10） | 3 |
| Components / 00 Foundations | `Info` | の余白がスケール外です（itemSpacing=3） | 17 |
| Components / 00 Foundations | `List` | の余白がスケール外です（itemSpacing=14） | 1 |
| Components / 00 Foundations | `Meta` | の余白がスケール外です（itemSpacing=3） | 27 |
| Components / 00 Foundations | `Num` | の余白がスケール外です（paddingLeft=10） | 6 |
| Components / 00 Foundations | `Num` | の余白がスケール外です（paddingRight=10） | 6 |
| Components / 00 Foundations | `Orderly — Foundations` | の余白がスケール外です（itemSpacing=72） | 1 |
| Components / 00 Foundations | `Orderly — Foundations` | の余白がスケール外です（paddingBottom=72） | 1 |
| Components / 00 Foundations | `Orderly — Foundations` | の余白がスケール外です（paddingLeft=72） | 1 |
| Components / 00 Foundations | `Orderly — Foundations` | の余白がスケール外です（paddingRight=72） | 1 |
| Components / 00 Foundations | `Orderly — Foundations` | の余白がスケール外です（paddingTop=72） | 1 |
| Components / 00 Foundations | `Pill` | の余白がスケール外です（paddingBottom=14） | 3 |
| Components / 00 Foundations | `Pill` | の余白がスケール外です（paddingLeft=28） | 3 |
| Components / 00 Foundations | `Pill` | の余白がスケール外です（paddingRight=28） | 3 |
| Components / 00 Foundations | `Pill` | の余白がスケール外です（paddingTop=14） | 3 |
| Components / 00 Foundations | `radius/full` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 00 Foundations | `radius/lg` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 00 Foundations | `radius/md` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 00 Foundations | `radius/sm` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 00 Foundations | `radius/xl` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 00 Foundations | `radius/xs` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 02 Buttons & CTAs | `Count Badge` | の余白がスケール外です（paddingLeft=6） | 1 |
| Components / 02 Buttons & CTAs | `Count Badge` | の余白がスケール外です（paddingRight=6） | 1 |
| Components / 03 Navigation | `State=Active` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 03 Navigation | `State=Active` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 03 Navigation | `State=Inactive` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 03 Navigation | `State=Inactive` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 04 Tags & Steppers | `Category Tag` | の余白がスケール外です（paddingLeft=10） | 1 |
| Components / 04 Tags & Steppers | `Category Tag` | の余白がスケール外です（paddingRight=10） | 1 |
| Components / 05 Cards | `Category Tag` | の余白がスケール外です（paddingLeft=10） | 3 |
| Components / 05 Cards | `Category Tag` | の余白がスケール外です（paddingRight=10） | 3 |
| Components / 05 Cards | `Text` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 06 Carousels | `Carousel Dots` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 10 Staff / Navigation | `State=Default` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 10 Staff / Navigation | `State=Default` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 10 Staff / Navigation | `State=Default` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 10 Staff / Navigation | `State=Selected` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 10 Staff / Navigation | `State=Selected` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 10 Staff / Navigation | `State=Selected` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 10 Staff / Navigation | `Sub Items` | の余白がスケール外です（paddingLeft=28） | 2 |
| Components / 11 Staff / Orders | `Action Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 2 |
| Components / 11 Staff / Orders | `Cancel Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 11 Staff / Orders | `Confirm Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 11 Staff / Orders | `Done Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 4 |
| Components / 11 Staff / Orders | `Done Button` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 11 Staff / Orders | `Done Button` | の余白がスケール外です（paddingTop=10） | 1 |
| Components / 11 Staff / Orders | `Header` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 11 Staff / Orders | `Item Row` | の余白がスケール外です（paddingBottom=10） | 2 |
| Components / 11 Staff / Orders | `Item Row` | の余白がスケール外です（paddingTop=10） | 2 |
| Components / 11 Staff / Orders | `Number Row` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 12 Staff / Lists & Rows | `Add Seat Chip` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 12 Staff / Lists & Rows | `Add Seat Chip` | の余白がスケール外です（paddingBottom=6） | 1 |
| Components / 12 Staff / Lists & Rows | `Add Seat Chip` | の余白がスケール外です（paddingTop=6） | 1 |
| Components / 12 Staff / Lists & Rows | `Best Seller Row` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 12 Staff / Lists & Rows | `Best Seller Row` | の余白がスケール外です（paddingTop=10） | 1 |
| Components / 12 Staff / Lists & Rows | `Best Seller Row (Mobile)` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 12 Staff / Lists & Rows | `Best Seller Row (Mobile)` | の余白がスケール外です（paddingTop=10） | 1 |
| Components / 12 Staff / Lists & Rows | `Category Head` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 12 Staff / Lists & Rows | `Delete Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| Components / 12 Staff / Lists & Rows | `Edit Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 2 |
| Components / 12 Staff / Lists & Rows | `Order Badge` | の余白がスケール外です（paddingBottom=3） | 1 |
| Components / 12 Staff / Lists & Rows | `Order Badge` | の余白がスケール外です（paddingTop=3） | 1 |
| Components / 12 Staff / Lists & Rows | `Seat Chip` | の余白がスケール外です（paddingBottom=6） | 1 |
| Components / 12 Staff / Lists & Rows | `Seat Chip` | の余白がスケール外です（paddingTop=6） | 1 |
| Components / 12 Staff / Lists & Rows | `Seats` | の余白がスケール外です（paddingLeft=26） | 1 |
| Components / 12 Staff / Lists & Rows | `Table Category Row` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 12 Staff / Lists & Rows | `Table Category Row` | の余白がスケール外です（paddingBottom=14） | 1 |
| Components / 12 Staff / Lists & Rows | `Table Category Row` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `Input` | の余白がスケール外です（paddingBottom=10） | 2 |
| Components / 13 Staff / Forms & Inputs | `Input` | の余白がスケール外です（paddingTop=10） | 2 |
| Components / 13 Staff / Forms & Inputs | `Swatches` | の余白がスケール外です（counterAxisSpacing=10） | 1 |
| Components / 13 Staff / Forms & Inputs | `Swatches` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 13 Staff / Forms & Inputs | `おすすめ` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `おすすめ` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `なし` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `なし` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `人気` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `人気` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `限定` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 13 Staff / Forms & Inputs | `限定` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 15 Staff / Tables & QR | `DL Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 15 Staff / Tables & QR | `DL Button` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 15 Staff / Tables & QR | `Info` | の余白がスケール外です（itemSpacing=10） | 1 |
| Components / 15 Staff / Tables & QR | `More Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 15 Staff / Tables & QR | `Print Card (91x55mm)` | の余白がスケール外です（paddingLeft=22） | 1 |
| Components / 15 Staff / Tables & QR | `Print Card (91x55mm)` | の余白がスケール外です（paddingRight=22） | 1 |
| Components / 15 Staff / Tables & QR | `QR Card` | の余白がスケール外です（paddingBottom=14） | 1 |
| Components / 15 Staff / Tables & QR | `QR Card` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 15 Staff / Tables & QR | `Table Tag` | の余白がスケール外です（paddingBottom=5） | 1 |
| Components / 15 Staff / Tables & QR | `Table Tag` | の余白がスケール外です（paddingTop=5） | 1 |
| Components / 15 Staff / Tables & QR | `コピー Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 15 Staff / Tables & QR | `コピー Button` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / お問い合わせ` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / お問い合わせ` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / お問い合わせ` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 実店舗検証` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 実店舗検証` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 実店舗検証` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 導入の流れ` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 導入の流れ` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 導入の流れ` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 機能` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 機能` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 機能` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 管理画面` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 管理画面` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 管理画面` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 課題` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 課題` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Item / 課題` | の余白がスケール外です（paddingTop=14） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Neutral` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Neutral` | の余白がスケール外です（paddingLeft=18） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Neutral` | の余白がスケール外です（paddingRight=18） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Neutral` | の余白がスケール外です（paddingTop=10） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Outline` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Outline` | の余白がスケール外です（paddingLeft=18） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Outline` | の余白がスケール外です（paddingRight=18） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Outline` | の余白がスケール外です（paddingTop=10） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Warm` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Warm` | の余白がスケール外です（paddingLeft=18） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Warm` | の余白がスケール外です（paddingRight=18） | 1 |
| Components / 17 Website / Buttons & Tabs | `Variant=Warm` | の余白がスケール外です（paddingTop=10） | 1 |
| Components / 18 Website / Overlay Parts | `Web / Annotation Label` | の余白がスケール外です（paddingBottom=6） | 1 |
| Components / 18 Website / Overlay Parts | `Web / Annotation Label` | の余白がスケール外です（paddingLeft=10） | 1 |
| Components / 18 Website / Overlay Parts | `Web / Annotation Label` | の余白がスケール外です（paddingRight=10） | 1 |
| Components / 18 Website / Overlay Parts | `Web / Annotation Label` | の余白がスケール外です（paddingTop=6） | 1 |
| Components / 18 Website / Overlay Parts | `Web / Sheet Grabber` | の余白がスケール外です（paddingBottom=10） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（itemSpacing=3） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（itemSpacing=6） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingBottom=13） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingBottom=5） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingBottom=6） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingLeft=11） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingLeft=14） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingRight=11） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingRight=14） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingTop=13） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingTop=5） | 1 |
| Components / 19 Website / Cards & Blocks | `Frame` | の余白がスケール外です（paddingTop=6） | 1 |
| Components / 19 Website / Cards & Blocks | `Web / Sticky CTA Bar (SP)` | の余白がスケール外です（paddingBottom=14） | 1 |
| Components / 19 Website / Cards & Blocks | `Web / Sticky CTA Bar (SP)` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Frame` | の余白がスケール外です（paddingLeft=14） | 8 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Frame` | の余白がスケール外です（paddingRight=14） | 8 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Hour Header` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Hour Header` | の余白がスケール外です（paddingLeft=28） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 土` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 日` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 月` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 木` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 水` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 火` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Row 金` | の余白がスケール外です（itemSpacing=3） | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Admin Chip` | の高さが 38px です（SPのタップ領域は44px以上） | 8 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Bar Col` | の余白がスケール外です（itemSpacing=6） | 8 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Bars` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Category Breakdown Card` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Col` | の余白がスケール外です（itemSpacing=6） | 15 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Export Button` | の高さが 40px です（SPのタップ領域は44px以上） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Grid` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Header Row` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Item` | の余白がスケール外です（itemSpacing=6） | 2 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 土` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 日` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 月` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 木` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 水` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 火` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Row 金` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Secondary KPI Grid` | の余白がスケール外です（counterAxisSpacing=10） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Secondary KPI Grid` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Spend Histogram Card` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Stack` | の余白がスケール外です（itemSpacing=1） | 7 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tab` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tab` | の余白がスケール外です（paddingBottom=6） | 3 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tab` | の余白がスケール外です（paddingTop=6） | 3 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tab` | の高さが 30px です（SPのタップ領域は44px以上） | 3 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tabs` | の高さが 30px です（SPのタップ領域は44px以上） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Value Row` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Add Form` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Add Form` | の余白がスケール外です（paddingBottom=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Add Form` | の余白がスケール外です（paddingLeft=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Add Form` | の余白がスケール外です（paddingRight=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Add Form` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Card / ベストセラー` | の余白がスケール外です（paddingTop=22） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Card / 二次元コード着地画面の背景` | の余白がスケール外です（paddingTop=22） | 3 |
| MobileOrder / Display Settings / 表示設定 / PC | `Card / 注文ホームのヒーロー動画` | の余白がスケール外です（paddingTop=22） | 3 |
| MobileOrder / Display Settings / 表示設定 / PC | `Card Head` | の余白がスケール外です（itemSpacing=10） | 7 |
| MobileOrder / Display Settings / 表示設定 / PC | `Color Picker` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Color Picker` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Field` | の余白がスケール外です（paddingRight=10） | 2 |
| MobileOrder / Display Settings / 表示設定 / PC | `HEX Field` | の余白がスケール外です（paddingBottom=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `HEX Field` | の余白がスケール外です（paddingLeft=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `HEX Field` | の余白がスケール外です（paddingRight=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `HEX Field` | の余白がスケール外です（paddingTop=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `List Head` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Num` | の余白がスケール外です（paddingBottom=3） | 6 |
| MobileOrder / Display Settings / 表示設定 / PC | `Num` | の余白がスケール外です（paddingLeft=9） | 6 |
| MobileOrder / Display Settings / 表示設定 / PC | `Num` | の余白がスケール外です（paddingRight=9） | 6 |
| MobileOrder / Display Settings / 表示設定 / PC | `Num` | の余白がスケール外です（paddingTop=3） | 6 |
| MobileOrder / Display Settings / 表示設定 / PC | `Ref / 背景タイプ選択UI（採用：セグメント）` | の余白がスケール外です（paddingTop=36） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment` | の余白がスケール外です（paddingBottom=3） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment` | の余白がスケール外です（paddingLeft=3） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment` | の余白がスケール外です（paddingRight=3） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment` | の余白がスケール外です（paddingTop=3） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment / 動画` | の余白がスケール外です（paddingBottom=9） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment / 動画` | の余白がスケール外です（paddingTop=9） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment / 画像` | の余白がスケール外です（paddingBottom=9） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment / 画像` | の余白がスケール外です（paddingTop=9） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment / 色` | の余白がスケール外です（paddingBottom=9） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Segment / 色` | の余白がスケール外です（paddingTop=9） | 4 |
| MobileOrder / Display Settings / 表示設定 / PC | `Select / カテゴリ` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Select / 商品名` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Display Settings / 表示設定 / PC | `Toggle Row` | の余白がスケール外です（paddingBottom=10） | 7 |
| MobileOrder / Display Settings / 表示設定 / PC | `Toggle Row` | の余白がスケール外です（paddingTop=10） | 7 |
| MobileOrder / Display Settings / 表示設定 / PC | `Type Selector` | の余白がスケール外です（itemSpacing=6） | 3 |
| MobileOrder / Display Settings / 表示設定 / PC | `案 案1　セグメント` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Add Form` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Add Form` | の余白がスケール外です（paddingBottom=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Add Form` | の余白がスケール外です（paddingLeft=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Add Form` | の余白がスケール外です（paddingRight=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Add Form` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Card / ベストセラー` | の余白がスケール外です（paddingTop=18） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Card / 二次元コード着地画面の背景` | の余白がスケール外です（paddingTop=18） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Card / 注文ホームのヒーロー動画` | の余白がスケール外です（paddingTop=18） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Content` | の余白がスケール外です（itemSpacing=14） | 4 |
| MobileOrder / Display Settings / 表示設定 / SP | `Field` | の余白がスケール外です（paddingRight=10） | 2 |
| MobileOrder / Display Settings / 表示設定 / SP | `Fields` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `HEX Field` | の余白がスケール外です（paddingBottom=9） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `HEX Field` | の余白がスケール外です（paddingTop=9） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `List Head` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Notes` | の余白がスケール外です（paddingTop=6） | 7 |
| MobileOrder / Display Settings / 表示設定 / SP | `Palette` | の余白がスケール外です（counterAxisSpacing=6） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Palette` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment` | の余白がスケール外です（paddingBottom=3） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment` | の余白がスケール外です（paddingLeft=3） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment` | の余白がスケール外です（paddingRight=3） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment` | の余白がスケール外です（paddingTop=3） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment / 動画` | の余白がスケール外です（paddingBottom=9） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment / 動画` | の余白がスケール外です（paddingTop=9） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment / 画像` | の余白がスケール外です（paddingBottom=9） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment / 画像` | の余白がスケール外です（paddingTop=9） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment / 色` | の余白がスケール外です（paddingBottom=9） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Segment / 色` | の余白がスケール外です（paddingTop=9） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Select / カテゴリ` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Select / 商品名` | の余白がスケール外です（itemSpacing=6） | 1 |
| MobileOrder / Display Settings / 表示設定 / SP | `Toggle Row` | の余白がスケール外です（paddingBottom=10） | 7 |
| MobileOrder / Display Settings / 表示設定 / SP | `Toggle Row` | の余白がスケール外です（paddingTop=10） | 7 |
| MobileOrder / Display Settings / 表示設定 / SP | `Type Selector` | の余白がスケール外です（itemSpacing=6） | 3 |
| MobileOrder / Display Settings / 表示設定 / SP | `Type Selector` | の余白がスケール外です（paddingTop=10） | 3 |
| MobileOrder / Menu Management / メニュー管理 / PC | `Actions` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / Menu Management / メニュー管理 / SP | `Admin Chip` | の高さが 38px です（SPのタップ領域は44px以上） | 6 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Actions` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Body` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Body` | の余白がスケール外です（paddingTop=18） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Content` | の余白がスケール外です（itemSpacing=28） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Group / A ・ カウンター席` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Group / B ・ テーブル席` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Group / C ・ ソファー席` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Group / テイクアウト` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Group Header` | の余白がスケール外です（itemSpacing=10） | 4 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Popover / コード選択 — PC` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Popover / コード選択 — PC` | の余白がスケール外です（paddingBottom=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Popover / コード選択 — PC` | の余白がスケール外です（paddingLeft=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Popover / コード選択 — PC` | の余白がスケール外です（paddingRight=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / PC | `Popover / コード選択 — PC` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Body` | の余白がスケール外です（itemSpacing=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Body` | の余白がスケール外です（paddingBottom=28） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Body` | の余白がスケール外です（paddingTop=18） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Bottom Print Bar` | の余白がスケール外です（paddingBottom=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Bottom Print Bar` | の余白がスケール外です（paddingTop=14） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Group / A ・ カウンター席` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Group / B ・ テーブル席` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Group / テイクアウト` | の余白がスケール外です（itemSpacing=10） | 1 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Handle` | の余白がスケール外です（paddingTop=10） | 2 |
| MobileOrder / QR Management / 二次元コード管理 / SP | `Header` | の余白がスケール外です（paddingBottom=14） | 2 |
| MobileOrder / Register / レジ / SP | `Table Chip` | の高さが 42px です（SPのタップ領域は44px以上） | 5 |
| MobileOrder / 注文 / SP | `Order Item Row` | の余白がスケール外です（paddingBottom=10） | 5 |
| MobileOrder / 注文 / SP | `Order Item Row` | の余白がスケール外です（paddingTop=10） | 5 |
| MobileOrder / 注文 / SP | `Section Header` | の余白がスケール外です（itemSpacing=10） | 2 |
| Website / 00 LP / メイン | `CTA` | の余白がスケール外です（paddingBottom=88） | 1 |
| Website / 00 LP / メイン | `CTA Panel` | の余白がスケール外です（itemSpacing=18） | 1 |
| Website / 00 LP / メイン | `CTA Panel` | の余白がスケール外です（paddingBottom=44） | 1 |
| Website / 00 LP / メイン | `CTA Panel` | の余白がスケール外です（paddingLeft=28） | 1 |
| Website / 00 LP / メイン | `CTA Panel` | の余白がスケール外です（paddingRight=28） | 1 |
| Website / 00 LP / メイン | `CTA Panel` | の余白がスケール外です（paddingTop=52） | 1 |
| Website / 00 LP / メイン | `Call Section` | の余白がスケール外です（paddingBottom=7.630769729614258） | 1 |
| Website / 00 LP / メイン | `Call Section` | の余白がスケール外です（paddingTop=7.630769729614258） | 1 |
| Website / 00 LP / メイン | `Call Strip` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / 00 LP / メイン | `Call Strip` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / 00 LP / メイン | `Call Strip` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Call Strip` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Category Listing` | の余白がスケール外です（itemSpacing=9.743589401245117） | 1 |
| Website / 00 LP / メイン | `Category Title` | の余白がスケール外です（itemSpacing=1.9487179517745972） | 1 |
| Website / 00 LP / メイン | `Category Title` | の余白がスケール外です（paddingLeft=11.692307472229004） | 1 |
| Website / 00 LP / メイン | `Category Title` | の余白がスケール外です（paddingRight=11.692307472229004） | 1 |
| Website / 00 LP / メイン | `Category Title` | の余白がスケール外です（paddingTop=1.9487179517745972） | 1 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（itemSpacing=10.174359321594238） | 2 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（itemSpacing=12.307692527770996） | 2 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（itemSpacing=7.794871807098389） | 3 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（paddingLeft=10.174359321594238） | 2 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（paddingLeft=12.307692527770996） | 2 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（paddingLeft=7.794871807098389） | 3 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（paddingRight=10.174359321594238） | 2 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（paddingRight=12.307692527770996） | 2 |
| Website / 00 LP / メイン | `Content` | の余白がスケール外です（paddingRight=7.794871807098389） | 3 |
| Website / 00 LP / メイン | `Dots` | の余白がスケール外です（itemSpacing=7） | 1 |
| Website / 00 LP / メイン | `Dots Wrap` | の余白がスケール外です（paddingTop=1.9487179517745972） | 9 |
| Website / 00 LP / メイン | `Dots Wrap` | の余白がスケール外です（paddingTop=2.5435898303985596） | 6 |
| Website / 00 LP / メイン | `Dots Wrap` | の余白がスケール外です（paddingTop=3.076923131942749） | 6 |
| Website / 00 LP / メイン | `Drawer` | の余白がスケール外です（paddingBottom=28） | 1 |
| Website / 00 LP / メイン | `Drawer` | の余白がスケール外です（paddingTop=14） | 1 |
| Website / 00 LP / メイン | `Feature Card 01` | の余白がスケール外です（itemSpacing=14） | 1 |
| Website / 00 LP / メイン | `Feature Card 02` | の余白がスケール外です（itemSpacing=14） | 1 |
| Website / 00 LP / メイン | `Feature Card 03` | の余白がスケール外です（itemSpacing=14） | 1 |
| Website / 00 LP / メイン | `Float / Cart Toast` | の余白がスケール外です（paddingBottom=9） | 1 |
| Website / 00 LP / メイン | `Float / Cart Toast` | の余白がスケール外です（paddingRight=14） | 1 |
| Website / 00 LP / メイン | `Float / Cart Toast` | の余白がスケール外です（paddingTop=9） | 1 |
| Website / 00 LP / メイン | `Float / Recommend` | の余白がスケール外です（paddingBottom=9） | 1 |
| Website / 00 LP / メイン | `Float / Recommend` | の余白がスケール外です（paddingRight=14） | 1 |
| Website / 00 LP / メイン | `Float / Recommend` | の余白がスケール外です（paddingTop=9） | 1 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（itemSpacing=10） | 2 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（itemSpacing=7） | 3 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingBottom=10） | 1 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingBottom=13） | 3 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingBottom=18） | 4 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingBottom=7） | 3 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingBottom=9） | 2 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingLeft=14） | 6 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingRight=14） | 6 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingTop=13） | 3 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingTop=18） | 4 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingTop=7） | 3 |
| Website / 00 LP / メイン | `Frame` | の余白がスケール外です（paddingTop=9） | 2 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（itemSpacing=1.9487179517745972） | 12 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（itemSpacing=2.5435898303985596） | 8 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（itemSpacing=3.076923131942749） | 8 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（paddingLeft=10.174359321594238） | 8 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（paddingLeft=12.307692527770996） | 8 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（paddingLeft=7.794871807098389） | 12 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（paddingRight=10.174359321594238） | 8 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（paddingRight=12.307692527770996） | 8 |
| Website / 00 LP / メイン | `Frame 1` | の余白がスケール外です（paddingRight=7.794871807098389） | 12 |
| Website / 00 LP / メイン | `Frame 3` | の余白がスケール外です（itemSpacing=1.9487179517745972） | 2 |
| Website / 00 LP / メイン | `Frame 3` | の余白がスケール外です（itemSpacing=3.076923131942749） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（itemSpacing=7.794871807098389） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingBottom=46.769229888916016） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingLeft=7.794871807098389） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingRight=7.794871807098389） | 1 |
| Website / 00 LP / メイン | `Grid` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / 00 LP / メイン | `Half Modal / 先行導入の相談` | の余白がスケール外です（itemSpacing=14） | 1 |
| Website / 00 LP / メイン | `Header` | の余白がスケール外です（itemSpacing=3.8974359035491943） | 2 |
| Website / 00 LP / メイン | `Header` | の余白がスケール外です（itemSpacing=6.153846263885498） | 1 |
| Website / 00 LP / メイン | `Hero` | の余白がスケール外です（paddingBottom=56） | 1 |
| Website / 00 LP / メイン | `Hero` | の余白がスケール外です（paddingTop=36） | 1 |
| Website / 00 LP / メイン | `Intro` | の余白がスケール外です（itemSpacing=5.846153736114502） | 2 |
| Website / 00 LP / メイン | `Intro` | の余白がスケール外です（itemSpacing=9.230769157409668） | 1 |
| Website / 00 LP / メイン | `Intro` | の余白がスケール外です（paddingLeft=12.307692527770996） | 1 |
| Website / 00 LP / メイン | `Intro` | の余白がスケール外です（paddingLeft=7.794871807098389） | 2 |
| Website / 00 LP / メイン | `Intro` | の余白がスケール外です（paddingRight=12.307692527770996） | 1 |
| Website / 00 LP / メイン | `Intro` | の余白がスケール外です（paddingRight=7.794871807098389） | 2 |
| Website / 00 LP / メイン | `Item / 管理画面` | の余白がスケール外です（paddingBottom=18） | 1 |
| Website / 00 LP / メイン | `Item / 管理画面` | の余白がスケール外です（paddingTop=18） | 1 |
| Website / 00 LP / メイン | `Lane` | の余白がスケール外です（itemSpacing=14） | 1 |
| Website / 00 LP / メイン | `Left` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（itemSpacing=5.846153736114502） | 9 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（itemSpacing=7.630769729614258） | 6 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（itemSpacing=9.230769157409668） | 6 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（paddingLeft=10.174359321594238） | 6 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（paddingLeft=12.307692527770996） | 6 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（paddingLeft=7.794871807098389） | 9 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（paddingRight=10.174359321594238） | 6 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（paddingRight=12.307692527770996） | 6 |
| Website / 00 LP / メイン | `Menu Carousel` | の余白がスケール外です（paddingRight=7.794871807098389） | 9 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（itemSpacing=10.174359321594238） | 6 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（itemSpacing=12.307692527770996） | 6 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（itemSpacing=7.794871807098389） | 9 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（paddingBottom=19.487178802490234） | 9 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（paddingBottom=25.435897827148438） | 6 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（paddingBottom=30.76923179626465） | 6 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（paddingTop=19.487178802490234） | 9 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（paddingTop=25.435897827148438） | 6 |
| Website / 00 LP / メイン | `Menu Section` | の余白がスケール外です（paddingTop=30.76923179626465） | 6 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（itemSpacing=10.174359321594238） | 2 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（itemSpacing=12.307692527770996） | 2 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（itemSpacing=7.794871807098389） | 3 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（paddingBottom=19.487178802490234） | 3 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（paddingBottom=25.435897827148438） | 2 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（paddingBottom=30.76923179626465） | 2 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（paddingTop=19.487178802490234） | 3 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（paddingTop=25.435897827148438） | 2 |
| Website / 00 LP / メイン | `Menu Section Wide` | の余白がスケール外です（paddingTop=30.76923179626465） | 2 |
| Website / 00 LP / メイン | `Order List` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Order List` | の余白がスケール外です（paddingBottom=25.435897827148438） | 1 |
| Website / 00 LP / メイン | `Order List` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Order List` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Order List` | の余白がスケール外です（paddingTop=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Product Detail` | の余白がスケール外です（itemSpacing=19.487178802490234） | 2 |
| Website / 00 LP / メイン | `Product Detail` | の余白がスケール外です（itemSpacing=30.76923179626465） | 1 |
| Website / 00 LP / メイン | `Recommended` | の余白がスケール外です（itemSpacing=15.384615898132324） | 1 |
| Website / 00 LP / メイン | `Recommended` | の余白がスケール外です（itemSpacing=9.743589401245117） | 2 |
| Website / 00 LP / メイン | `Recommended` | の余白がスケール外です（paddingBottom=38.97435760498047） | 2 |
| Website / 00 LP / メイン | `Recommended` | の余白がスケール外です（paddingBottom=61.5384635925293） | 1 |
| Website / 00 LP / メイン | `Recommended` | の余白がスケール外です（paddingTop=19.487178802490234） | 2 |
| Website / 00 LP / メイン | `Recommended` | の余白がスケール外です（paddingTop=30.76923179626465） | 1 |
| Website / 00 LP / メイン | `Row` | の余白がスケール外です（itemSpacing=7.794871807098389） | 3 |
| Website / 00 LP / メイン | `Solution` | の余白がスケール外です（itemSpacing=36） | 1 |
| Website / 00 LP / メイン | `Solution` | の余白がスケール外です（paddingTop=88） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingBottom=7.630769729614258） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / 00 LP / メイン | `Top Bar` | の余白がスケール外です（paddingTop=7.630769729614258） | 1 |
| Website / PC States / 01 Problem Modals | `Compare` | の余白がスケール外です（itemSpacing=31.535619735717773） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（itemSpacing=10.511873245239258） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（itemSpacing=12.2638521194458） | 4 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（itemSpacing=14） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（itemSpacing=5.255936622619629） | 2 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（itemSpacing=7） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（itemSpacing=8.759894371032715） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingBottom=10.511873245239258） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingBottom=10） | 3 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingBottom=11） | 3 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingBottom=12.2638521194458） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingBottom=17.51978874206543） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingBottom=7） | 2 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingLeft=12.2638521194458） | 2 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingLeft=14） | 2 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingLeft=17.51978874206543） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingLeft=18） | 3 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingRight=12.2638521194458） | 2 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingRight=14） | 2 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingRight=17.51978874206543） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingRight=18） | 3 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingTop=10.511873245239258） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingTop=10） | 3 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingTop=11） | 3 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingTop=12.2638521194458） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingTop=17.51978874206543） | 1 |
| Website / PC States / 01 Problem Modals | `Frame` | の余白がスケール外です（paddingTop=7） | 2 |
| Website / PC States / 01 Problem Modals | `Mobile Order` | の余白がスケール外です（itemSpacing=19.271766662597656） | 1 |
| Website / PC States / 01 Problem Modals | `Mobile Order` | の余白がスケール外です（paddingBottom=28.031661987304688） | 1 |
| Website / PC States / 01 Problem Modals | `Mobile Order` | の余白がスケール外です（paddingLeft=35.03957748413086） | 1 |
| Website / PC States / 01 Problem Modals | `Mobile Order` | の余白がスケール外です（paddingRight=35.03957748413086） | 1 |
| Website / PC States / 01 Problem Modals | `Mobile Order` | の余白がスケール外です（paddingTop=31.535619735717773） | 1 |
| Website / PC States / 01 Problem Modals | `Paper Menu` | の余白がスケール外です（itemSpacing=19.271766662597656） | 1 |
| Website / PC States / 01 Problem Modals | `Paper Menu` | の余白がスケール外です（paddingBottom=28.031661987304688） | 1 |
| Website / PC States / 01 Problem Modals | `Paper Menu` | の余白がスケール外です（paddingLeft=35.03957748413086） | 1 |
| Website / PC States / 01 Problem Modals | `Paper Menu` | の余白がスケール外です（paddingRight=35.03957748413086） | 1 |
| Website / PC States / 01 Problem Modals | `Paper Menu` | の余白がスケール外です（paddingTop=31.535619735717773） | 1 |
| Website / PC States / 02 Feature Switch | `Button Row` | の余白がスケール外です（itemSpacing=12.307692527770996） | 2 |
| Website / PC States / 02 Feature Switch | `Content` | の余白がスケール外です（itemSpacing=12.307692527770996） | 4 |
| Website / PC States / 02 Feature Switch | `Content` | の余白がスケール外です（itemSpacing=18.461538314819336） | 1 |
| Website / PC States / 02 Feature Switch | `Content` | の余白がスケール外です（paddingBottom=61.5384635925293） | 1 |
| Website / PC States / 02 Feature Switch | `Content` | の余白がスケール外です（paddingLeft=12.307692527770996） | 5 |
| Website / PC States / 02 Feature Switch | `Content` | の余白がスケール外です（paddingRight=12.307692527770996） | 5 |
| Website / PC States / 02 Feature Switch | `DRINK CATEGORY` | の余白がスケール外です（itemSpacing=6.153846263885498） | 1 |
| Website / PC States / 02 Feature Switch | `Dots Wrap` | の余白がスケール外です（paddingTop=3.076923131942749） | 12 |
| Website / PC States / 02 Feature Switch | `FOOD CATEGORY` | の余白がスケール外です（itemSpacing=6.153846263885498） | 1 |
| Website / PC States / 02 Feature Switch | `Frame 1` | の余白がスケール外です（itemSpacing=3.076923131942749） | 16 |
| Website / PC States / 02 Feature Switch | `Frame 1` | の余白がスケール外です（paddingLeft=12.307692527770996） | 16 |
| Website / PC States / 02 Feature Switch | `Frame 1` | の余白がスケール外です（paddingRight=12.307692527770996） | 16 |
| Website / PC States / 02 Feature Switch | `Frame 3` | の余白がスケール外です（itemSpacing=3.076923131942749） | 2 |
| Website / PC States / 02 Feature Switch | `Header` | の余白がスケール外です（itemSpacing=6.153846263885498） | 2 |
| Website / PC States / 02 Feature Switch | `Intro` | の余白がスケール外です（itemSpacing=9.230769157409668） | 2 |
| Website / PC States / 02 Feature Switch | `Intro` | の余白がスケール外です（paddingLeft=12.307692527770996） | 2 |
| Website / PC States / 02 Feature Switch | `Intro` | の余白がスケール外です（paddingRight=12.307692527770996） | 2 |
| Website / PC States / 02 Feature Switch | `Links` | の余白がスケール外です（itemSpacing=12.307692527770996） | 1 |
| Website / PC States / 02 Feature Switch | `Menu` | の余白がスケール外です（itemSpacing=12.307692527770996） | 1 |
| Website / PC States / 02 Feature Switch | `Menu Carousel` | の余白がスケール外です（itemSpacing=9.230769157409668） | 12 |
| Website / PC States / 02 Feature Switch | `Menu Carousel` | の余白がスケール外です（paddingLeft=12.307692527770996） | 12 |
| Website / PC States / 02 Feature Switch | `Menu Carousel` | の余白がスケール外です（paddingRight=12.307692527770996） | 12 |
| Website / PC States / 02 Feature Switch | `Menu Section` | の余白がスケール外です（itemSpacing=12.307692527770996） | 12 |
| Website / PC States / 02 Feature Switch | `Menu Section` | の余白がスケール外です（paddingBottom=30.76923179626465） | 12 |
| Website / PC States / 02 Feature Switch | `Menu Section` | の余白がスケール外です（paddingTop=30.76923179626465） | 12 |
| Website / PC States / 02 Feature Switch | `Menu Section Wide` | の余白がスケール外です（itemSpacing=12.307692527770996） | 4 |
| Website / PC States / 02 Feature Switch | `Menu Section Wide` | の余白がスケール外です（paddingBottom=30.76923179626465） | 4 |
| Website / PC States / 02 Feature Switch | `Menu Section Wide` | の余白がスケール外です（paddingTop=30.76923179626465） | 4 |
| Website / PC States / 02 Feature Switch | `Product Detail` | の余白がスケール外です（itemSpacing=30.76923179626465） | 2 |
| Website / PC States / 02 Feature Switch | `Recommended` | の余白がスケール外です（itemSpacing=15.384615898132324） | 2 |
| Website / PC States / 02 Feature Switch | `Recommended` | の余白がスケール外です（paddingBottom=61.5384635925293） | 1 |
| Website / PC States / 02 Feature Switch | `Recommended` | の余白がスケール外です（paddingBottom=61.540000915527344） | 1 |
| Website / PC States / 02 Feature Switch | `Recommended` | の余白がスケール外です（paddingTop=30.76923179626465） | 1 |
| Website / PC States / 02 Feature Switch | `Row` | の余白がスケール外です（itemSpacing=6.153846263885498） | 5 |
| Website / PC States / 02 Feature Switch | `Section Header` | の余白がスケール外です（itemSpacing=7.692307949066162） | 2 |
| Website / PC States / 03 Staff Screens | `Actions` | の余白がスケール外です（itemSpacing=9.152542114257812） | 2 |
| Website / PC States / 03 Staff Screens | `Add Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Add Button` | の余白がスケール外です（paddingBottom=9.152542114257812） | 1 |
| Website / PC States / 03 Staff Screens | `Add Button` | の余白がスケール外です（paddingLeft=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Add Button` | の余白がスケール外です（paddingRight=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Add Button` | の余白がスケール外です（paddingTop=9.152542114257812） | 1 |
| Website / PC States / 03 Staff Screens | `Add Table Card` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Bars List` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | の余白がスケール外です（itemSpacing=5.491525650024414） | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | の余白がスケール外です（paddingBottom=8.237288475036621） | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | の余白がスケール外です（paddingLeft=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | の余白がスケール外です（paddingRight=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | の余白がスケール外です（paddingTop=8.237288475036621） | 1 |
| Website / PC States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（itemSpacing=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingBottom=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingTop=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Body` | の余白がスケール外です（itemSpacing=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Body` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Body` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Body` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Body` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Bottom Row` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Bottom Row 2` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Bottom Row 3` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `CSV Export Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `CSV Export Button` | の余白がスケール外です（paddingBottom=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `CSV Export Button` | の余白がスケール外です（paddingLeft=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `CSV Export Button` | の余白がスケール外です（paddingRight=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `CSV Export Button` | の余白がスケール外です（paddingTop=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Call Strip` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Category Card` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Category Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Category Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Category Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Category Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Category Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Category Settings Button` | の余白がスケール外です（paddingBottom=8.237288475036621） | 1 |
| Website / PC States / 03 Staff Screens | `Category Settings Button` | の余白がスケール外です（paddingLeft=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Category Settings Button` | の余白がスケール外です（paddingRight=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Category Settings Button` | の余白がスケール外です（paddingTop=8.237288475036621） | 1 |
| Website / PC States / 03 Staff Screens | `Chart Card` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Chart Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Chart Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Chart Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Chart Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Checkout Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Checkout Button` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Checkout Button` | の余白がスケール外です（paddingTop=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（itemSpacing=25.627119064331055） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingBottom=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingBottom=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingLeft=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingRight=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingTop=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingBottom=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingTop=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Footer` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Footer` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Footer` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Footer` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Footer` | の余白がスケール外です（paddingTop=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（itemSpacing=3.6610169410705566） | 22 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（itemSpacing=7.322033882141113） | 39 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingBottom=10.983051300048828） | 2 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingBottom=3.6610169410705566） | 3 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingBottom=7.322033882141113） | 8 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingLeft=10.983051300048828） | 3 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingLeft=12.813559532165527） | 8 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingRight=10.983051300048828） | 3 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingRight=12.813559532165527） | 8 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingTop=10.983051300048828） | 2 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingTop=3.6610169410705566） | 3 |
| Website / PC States / 03 Staff Screens | `Frame` | の余白がスケール外です（paddingTop=7.322033882141113） | 8 |
| Website / PC States / 03 Staff Screens | `Grid` | の余白がスケール外です（itemSpacing=14.644067764282227） | 5 |
| Website / PC States / 03 Staff Screens | `Grid` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Grid` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Grid` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Grid` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Group` | の余白がスケール外です（itemSpacing=7.322033882141113） | 2 |
| Website / PC States / 03 Staff Screens | `Group / A ・ カウンター席` | の余白がスケール外です（itemSpacing=12.813559532165527） | 1 |
| Website / PC States / 03 Staff Screens | `Group / B ・ テーブル席` | の余白がスケール外です（itemSpacing=12.813559532165527） | 1 |
| Website / PC States / 03 Staff Screens | `Group / C ・ ソファー席` | の余白がスケール外です（itemSpacing=12.813559532165527） | 1 |
| Website / PC States / 03 Staff Screens | `Group / テイクアウト` | の余白がスケール外です（itemSpacing=12.813559532165527） | 1 |
| Website / PC States / 03 Staff Screens | `Group Header` | の余白がスケール外です（itemSpacing=9.152542114257812） | 4 |
| Website / PC States / 03 Staff Screens | `Header` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Header` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Header` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Header` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Heatmap Card` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Heatmap Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Heatmap Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Heatmap Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Heatmap Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingBottom=3.6610169410705566） | 1 |
| Website / PC States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingTop=3.6610169410705566） | 1 |
| Website / PC States / 03 Staff Screens | `Histogram Card` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Histogram Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Histogram Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Histogram Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Histogram Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Hour Header` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Hour Header` | の余白がスケール外です（paddingLeft=25.627119064331055） | 1 |
| Website / PC States / 03 Staff Screens | `KPI Row` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Legend` | の余白がスケール外です（itemSpacing=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Legend` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（paddingTop=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Preview Wrap` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Preview Wrap` | の余白がスケール外です（paddingTop=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | の余白がスケール外です（paddingBottom=9.152542114257812） | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | の余白がスケール外です（paddingLeft=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | の余白がスケール外です（paddingRight=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | の余白がスケール外です（paddingTop=9.152542114257812） | 1 |
| Website / PC States / 03 Staff Screens | `Ranking Card` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Ranking Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Ranking Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Ranking Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Ranking Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Row 土` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Row 日` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Row 月` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Row 木` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Row 水` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Row 火` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Row 金` | の余白がスケール外です（itemSpacing=2.745762825012207） | 1 |
| Website / PC States / 03 Staff Screens | `Rows` | の余白がスケール外です（itemSpacing=1.8305084705352783） | 2 |
| Website / PC States / 03 Staff Screens | `Scroll Area` | の余白がスケール外です（itemSpacing=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Scroll Area` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Scroll Area` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Scroll Area` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Scroll Area` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Sub Bar` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Sub Bar` | の余白がスケール外です（paddingLeft=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Sub Bar` | の余白がスケール外です（paddingRight=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingBottom=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingLeft=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingRight=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingTop=14.644067764282227） | 1 |
| Website / PC States / 03 Staff Screens | `Table Bars` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Table Chip Strip` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Tabs` | の余白がスケール外です（itemSpacing=7.322033882141113） | 1 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（itemSpacing=10.983051300048828） | 3 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingBottom=14.644067764282227） | 5 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingLeft=21.966102600097656） | 4 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingLeft=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingRight=21.966102600097656） | 4 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingRight=29.288135528564453） | 1 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingTop=18.305084228515625） | 4 |
| Website / PC States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingTop=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Top10 Card` | の余白がスケール外です（itemSpacing=10.983051300048828） | 1 |
| Website / PC States / 03 Staff Screens | `Top10 Card` | の余白がスケール外です（paddingBottom=18.305084228515625） | 1 |
| Website / PC States / 03 Staff Screens | `Top10 Card` | の余白がスケール外です（paddingLeft=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Top10 Card` | の余白がスケール外です（paddingRight=21.966102600097656） | 1 |
| Website / PC States / 03 Staff Screens | `Top10 Card` | の余白がスケール外です（paddingTop=18.305084228515625） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（counterAxisSpacing=10） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=10） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=11.324502944946289） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=13.15384578704834） | 4 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=13.589404106140137） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=5.637362480163574） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=6.794702053070068） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（itemSpacing=9.059602737426758） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingBottom=13.589404106140137） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingBottom=15.854305267333984） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingBottom=18.791208267211914） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingBottom=6） | 4 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingBottom=9） | 3 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingLeft=14） | 3 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingLeft=15.854305267333984） | 2 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingLeft=18.791208267211914） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingRight=14） | 3 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingRight=15.854305267333984） | 2 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingRight=18.791208267211914） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingTop=13.589404106140137） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingTop=15.854305267333984） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingTop=18.791208267211914） | 1 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingTop=6） | 2 |
| Website / SP States / 01 Problem Half Modals | `Frame` | の余白がスケール外です（paddingTop=9） | 3 |
| Website / SP States / 01 Problem Half Modals | `Mobile Order` | の余白がスケール外です（itemSpacing=24.913908004760742） | 1 |
| Website / SP States / 01 Problem Half Modals | `Mobile Order` | の余白がスケール外です（paddingBottom=36.23841094970703） | 1 |
| Website / SP States / 01 Problem Half Modals | `Mobile Order` | の余白がスケール外です（paddingLeft=45.298011779785156） | 1 |
| Website / SP States / 01 Problem Half Modals | `Mobile Order` | の余白がスケール外です（paddingRight=45.298011779785156） | 1 |
| Website / SP States / 01 Problem Half Modals | `Mobile Order` | の余白がスケール外です（paddingTop=40.768211364746094） | 1 |
| Website / SP States / 01 Problem Half Modals | `Paper Menu` | の余白がスケール外です（itemSpacing=20.670330047607422） | 1 |
| Website / SP States / 01 Problem Half Modals | `Paper Menu` | の余白がスケール外です（paddingBottom=30.065933227539062） | 1 |
| Website / SP States / 01 Problem Half Modals | `Paper Menu` | の余白がスケール外です（paddingLeft=37.58241653442383） | 1 |
| Website / SP States / 01 Problem Half Modals | `Paper Menu` | の余白がスケール外です（paddingRight=37.58241653442383） | 1 |
| Website / SP States / 01 Problem Half Modals | `Paper Menu` | の余白がスケール外です（paddingTop=33.82417297363281） | 1 |
| Website / SP States / 02 Feature Switch | `Button Row` | の余白がスケール外です（itemSpacing=7.794871807098389） | 2 |
| Website / SP States / 02 Feature Switch | `Content` | の余白がスケール外です（itemSpacing=11.692307472229004） | 1 |
| Website / SP States / 02 Feature Switch | `Content` | の余白がスケール外です（itemSpacing=7.794871807098389） | 4 |
| Website / SP States / 02 Feature Switch | `Content` | の余白がスケール外です（paddingBottom=38.97435760498047） | 1 |
| Website / SP States / 02 Feature Switch | `Content` | の余白がスケール外です（paddingLeft=7.794871807098389） | 5 |
| Website / SP States / 02 Feature Switch | `Content` | の余白がスケール外です（paddingRight=7.794871807098389） | 5 |
| Website / SP States / 02 Feature Switch | `DRINK CATEGORY` | の余白がスケール外です（itemSpacing=3.8974359035491943） | 1 |
| Website / SP States / 02 Feature Switch | `Dots Wrap` | の余白がスケール外です（paddingTop=1.9487179517745972） | 12 |
| Website / SP States / 02 Feature Switch | `FOOD CATEGORY` | の余白がスケール外です（itemSpacing=3.8974359035491943） | 1 |
| Website / SP States / 02 Feature Switch | `Frame 1` | の余白がスケール外です（itemSpacing=1.9487179517745972） | 16 |
| Website / SP States / 02 Feature Switch | `Frame 1` | の余白がスケール外です（paddingLeft=7.794871807098389） | 16 |
| Website / SP States / 02 Feature Switch | `Frame 1` | の余白がスケール外です（paddingRight=7.794871807098389） | 16 |
| Website / SP States / 02 Feature Switch | `Frame 3` | の余白がスケール外です（itemSpacing=1.9487179517745972） | 2 |
| Website / SP States / 02 Feature Switch | `Header` | の余白がスケール外です（itemSpacing=3.8974359035491943） | 2 |
| Website / SP States / 02 Feature Switch | `Intro` | の余白がスケール外です（itemSpacing=5.846153736114502） | 2 |
| Website / SP States / 02 Feature Switch | `Intro` | の余白がスケール外です（paddingLeft=7.794871807098389） | 2 |
| Website / SP States / 02 Feature Switch | `Intro` | の余白がスケール外です（paddingRight=7.794871807098389） | 2 |
| Website / SP States / 02 Feature Switch | `Links` | の余白がスケール外です（itemSpacing=7.794871807098389） | 1 |
| Website / SP States / 02 Feature Switch | `Menu` | の余白がスケール外です（itemSpacing=7.794871807098389） | 1 |
| Website / SP States / 02 Feature Switch | `Menu Carousel` | の余白がスケール外です（itemSpacing=5.846153736114502） | 12 |
| Website / SP States / 02 Feature Switch | `Menu Carousel` | の余白がスケール外です（paddingLeft=7.794871807098389） | 12 |
| Website / SP States / 02 Feature Switch | `Menu Carousel` | の余白がスケール外です（paddingRight=7.794871807098389） | 12 |
| Website / SP States / 02 Feature Switch | `Menu Section` | の余白がスケール外です（itemSpacing=7.794871807098389） | 12 |
| Website / SP States / 02 Feature Switch | `Menu Section` | の余白がスケール外です（paddingBottom=19.487178802490234） | 12 |
| Website / SP States / 02 Feature Switch | `Menu Section` | の余白がスケール外です（paddingTop=19.487178802490234） | 12 |
| Website / SP States / 02 Feature Switch | `Menu Section Wide` | の余白がスケール外です（itemSpacing=7.794871807098389） | 4 |
| Website / SP States / 02 Feature Switch | `Menu Section Wide` | の余白がスケール外です（paddingBottom=19.487178802490234） | 4 |
| Website / SP States / 02 Feature Switch | `Menu Section Wide` | の余白がスケール外です（paddingTop=19.487178802490234） | 4 |
| Website / SP States / 02 Feature Switch | `Product Detail` | の余白がスケール外です（itemSpacing=19.487178802490234） | 2 |
| Website / SP States / 02 Feature Switch | `Recommended` | の余白がスケール外です（itemSpacing=9.743589401245117） | 2 |
| Website / SP States / 02 Feature Switch | `Recommended` | の余白がスケール外です（paddingBottom=38.97435760498047） | 2 |
| Website / SP States / 02 Feature Switch | `Recommended` | の余白がスケール外です（paddingTop=19.487178802490234） | 2 |
| Website / SP States / 02 Feature Switch | `Row` | の余白がスケール外です（itemSpacing=3.8974359035491943） | 5 |
| Website / SP States / 02 Feature Switch | `Section Header` | の余白がスケール外です（itemSpacing=4.871794700622559） | 2 |
| Website / SP States / 03 Staff Screens | `Actions` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Add Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Add Table Card` | の余白がスケール外です（itemSpacing=2.5435898303985596） | 1 |
| Website / SP States / 03 Staff Screens | `Bar Col` | の余白がスケール外です（itemSpacing=3.815384864807129） | 8 |
| Website / SP States / 03 Staff Screens | `Bars` | の余白がスケール外です（itemSpacing=6.358974456787109） | 1 |
| Website / SP States / 03 Staff Screens | `Best Seller Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Bill Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Bottom Print Bar` | の余白がスケール外です（paddingBottom=8.90256404876709） | 1 |
| Website / SP States / 03 Staff Screens | `Bottom Print Bar` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Bottom Print Bar` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Bottom Print Bar` | の余白がスケール外です（paddingTop=8.90256404876709） | 1 |
| Website / SP States / 03 Staff Screens | `Call Section` | の余白がスケール外です（paddingBottom=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Call Section` | の余白がスケール外です（paddingTop=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Call Strip` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Call Strip` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Call Strip` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Cards` | の余白がスケール外です（itemSpacing=7.630769729614258） | 3 |
| Website / SP States / 03 Staff Screens | `Category Breakdown Card` | の余白がスケール外です（itemSpacing=8.90256404876709） | 1 |
| Website / SP States / 03 Staff Screens | `Category Breakdown Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Category Breakdown Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Category Breakdown Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Category Breakdown Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Checkout Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Checkout Button` | の余白がスケール外です（paddingBottom=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Checkout Button` | の余白がスケール外です（paddingTop=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Col` | の余白がスケール外です（itemSpacing=2.5435898303985596） | 12 |
| Website / SP States / 03 Staff Screens | `Col` | の余白がスケール外です（itemSpacing=3.815384864807129） | 15 |
| Website / SP States / 03 Staff Screens | `Compare Row` | の余白がスケール外です（itemSpacing=2.5435898303985596） | 3 |
| Website / SP States / 03 Staff Screens | `Content` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Content` | の余白がスケール外です（itemSpacing=15.261539459228516） | 1 |
| Website / SP States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingBottom=25.435897827148438） | 1 |
| Website / SP States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingLeft=10.174359321594238） | 2 |
| Website / SP States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingRight=10.174359321594238） | 2 |
| Website / SP States / 03 Staff Screens | `Content` | の余白がスケール外です（paddingTop=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Dine-in vs Takeout Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Export Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingBottom=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Filter Row` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Grid` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Group` | の余白がスケール外です（itemSpacing=5.087179660797119） | 2 |
| Website / SP States / 03 Staff Screens | `Group / A ・ カウンター席` | の余白がスケール外です（itemSpacing=6.358974456787109） | 1 |
| Website / SP States / 03 Staff Screens | `Group / B ・ テーブル席` | の余白がスケール外です（itemSpacing=6.358974456787109） | 1 |
| Website / SP States / 03 Staff Screens | `Group / テイクアウト` | の余白がスケール外です（itemSpacing=6.358974456787109） | 1 |
| Website / SP States / 03 Staff Screens | `Group Header` | の余白がスケール外です（itemSpacing=5.087179660797119） | 3 |
| Website / SP States / 03 Staff Screens | `Header Row` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Hero KPI Card` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Hero KPI Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Hero KPI Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Hero KPI Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Hero KPI Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingBottom=7.630769729614258） | 2 |
| Website / SP States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingLeft=10.174359321594238） | 2 |
| Website / SP States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingRight=10.174359321594238） | 2 |
| Website / SP States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Hint Wrap` | の余白がスケール外です（paddingTop=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Item` | の余白がスケール外です（itemSpacing=3.815384864807129） | 2 |
| Website / SP States / 03 Staff Screens | `Left` | の余白がスケール外です（itemSpacing=5.087179660797119） | 5 |
| Website / SP States / 03 Staff Screens | `Left` | の余白がスケール外です（itemSpacing=7.630769729614258） | 5 |
| Website / SP States / 03 Staff Screens | `Legend` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Legend` | の余白がスケール外です（itemSpacing=2.5435898303985596） | 1 |
| Website / SP States / 03 Staff Screens | `List` | の余白がスケール外です（itemSpacing=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `List` | の余白がスケール外です（paddingBottom=15.261539459228516） | 1 |
| Website / SP States / 03 Staff Screens | `List` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `List` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `List Scroll` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Order List` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Order List` | の余白がスケール外です（paddingBottom=25.435897827148438） | 1 |
| Website / SP States / 03 Staff Screens | `Order List` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Order List` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Order List` | の余白がスケール外です（paddingTop=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Page Content` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Page Content` | の余白がスケール外です（paddingBottom=20.348718643188477） | 1 |
| Website / SP States / 03 Staff Screens | `Page Content` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Page Content` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Page Content` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Peak Time Heatmap Card` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Peak Time Heatmap Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Peak Time Heatmap Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Peak Time Heatmap Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Peak Time Heatmap Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Period Selector` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Period Selector` | の余白がスケール外です（paddingBottom=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Period Selector` | の余白がスケール外です（paddingLeft=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Period Selector` | の余白がスケール外です（paddingRight=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Period Selector` | の余白がスケール外です（paddingTop=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Popular Menu Card` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Popular Menu Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Popular Menu Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Popular Menu Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Popular Menu Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Print Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Rank Row` | の余白がスケール外です（itemSpacing=2.5435898303985596） | 5 |
| Website / SP States / 03 Staff Screens | `Row 土` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Row 日` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Row 月` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Row 木` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Row 水` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Row 火` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Row 金` | の余白がスケール外です（itemSpacing=3.815384864807129） | 1 |
| Website / SP States / 03 Staff Screens | `Rows` | の余白がスケール外です（itemSpacing=1.2717949151992798） | 2 |
| Website / SP States / 03 Staff Screens | `Rows` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Sales Chart Card` | の余白がスケール外です（itemSpacing=10.174359321594238） | 1 |
| Website / SP States / 03 Staff Screens | `Sales Chart Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Sales Chart Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Sales Chart Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Sales Chart Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Seat Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Secondary KPI Grid` | の余白がスケール外です（counterAxisSpacing=10） | 1 |
| Website / SP States / 03 Staff Screens | `Secondary KPI Grid` | の余白がスケール外です（itemSpacing=6.358974456787109） | 1 |
| Website / SP States / 03 Staff Screens | `Spend Histogram Card` | の余白がスケール外です（itemSpacing=8.90256404876709） | 1 |
| Website / SP States / 03 Staff Screens | `Spend Histogram Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Spend Histogram Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Spend Histogram Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Spend Histogram Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Stack` | の余白がスケール外です（itemSpacing=0.6358974575996399） | 7 |
| Website / SP States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingBottom=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingLeft=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingRight=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Summary Block` | の余白がスケール外です（paddingTop=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Tab` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| Website / SP States / 03 Staff Screens | `Tab` | の余白がスケール外です（paddingBottom=3.815384864807129） | 3 |
| Website / SP States / 03 Staff Screens | `Tab` | の余白がスケール外です（paddingLeft=7.630769729614258） | 3 |
| Website / SP States / 03 Staff Screens | `Tab` | の余白がスケール外です（paddingRight=7.630769729614258） | 3 |
| Website / SP States / 03 Staff Screens | `Tab` | の余白がスケール外です（paddingTop=3.815384864807129） | 3 |
| Website / SP States / 03 Staff Screens | `Table Chip Strip` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingBottom=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingLeft=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingRight=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Table Utilization Card` | の余白がスケール外です（paddingTop=12.717948913574219） | 1 |
| Website / SP States / 03 Staff Screens | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Tabs` | の余白がスケール外です（itemSpacing=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（itemSpacing=7.630769729614258） | 1 |
| Website / SP States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingBottom=7.630769729614258） | 2 |
| Website / SP States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingLeft=10.174359321594238） | 5 |
| Website / SP States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingRight=10.174359321594238） | 5 |
| Website / SP States / 03 Staff Screens | `Top Bar` | の余白がスケール外です（paddingTop=7.630769729614258） | 2 |
| Website / SP States / 03 Staff Screens | `Trend Tag` | の余白がスケール外です（paddingBottom=2.5435898303985596） | 1 |
| Website / SP States / 03 Staff Screens | `Trend Tag` | の余白がスケール外です（paddingLeft=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Trend Tag` | の余白がスケール外です（paddingRight=5.087179660797119） | 1 |
| Website / SP States / 03 Staff Screens | `Trend Tag` | の余白がスケール外です（paddingTop=2.5435898303985596） | 1 |
| Website / SP States / 03 Staff Screens | `Value Row` | の余白がスケール外です（itemSpacing=6.358974456787109） | 1 |
| Website / SP States / 03 Staff Screens | `Values` | の余白がスケール外です（itemSpacing=5.087179660797119） | 3 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Category Tag` | の余白がスケール外です（paddingBottom=5） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Category Tag` | の余白がスケール外です（paddingLeft=10） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Category Tag` | の余白がスケール外です（paddingRight=10） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Category Tag` | の余白がスケール外です（paddingTop=5） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Filter Chip` | の余白がスケール外です（paddingBottom=5） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Filter Chip` | の余白がスケール外です（paddingLeft=10） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Filter Chip` | の余白がスケール外です（paddingRight=10） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Filter Chip` | の余白がスケール外です（paddingTop=5） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Staff Call Button` | の余白がスケール外です（paddingLeft=14） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Staff Call Button` | の余白がスケール外です（paddingRight=14） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Tag` | の余白がスケール外です（paddingBottom=3） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Tag` | の余白がスケール外です（paddingLeft=6） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Tag` | の余白がスケール外です（paddingRight=6） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `IZ / Tag` | の余白がスケール外です（paddingTop=3） | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `cta` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |

---

## 覚えておくべき運用ルール

### Figma MCPの使い方（重要・過去のメモを訂正）

**⚠ 旧メモの「画面テンプレートはこのファイルに存在しない」は誤りだった。** テンプレートは
全部 **MobileOrder ページ（`32:2`）** にある。

**⚠ `get_metadata`を引数なしで呼んでも全ページは返らない（2026-08-04 再確認）。**
返るのは `MobileOrder` / `Components` / `_Archive` の3つだけ。
実際のページ数はもっと多く、**`npm run design:figma` の出力が正確**（同スクリプトは
Figma REST API を直接叩いている）。2026-08-04 時点の実在ページ:

> MobileOrder / Website / 居酒屋 / GOOD LOOP / GOOD LOOP LP / Components /
> Brand Guideline / ロゴ / コーポレートサイト

| ページ名 | node ID |
|---|---|
| Components | `46:16` |
| **MobileOrder（画面テンプレートは全部ここ）** | **`32:2`** |
| _Archive | `617:8337` |
| ロゴ | `0:1` |
| コーポレートサイト | `18:2` |
| 参考サイト | `60:762` |

- `get_metadata`に`nodeId`を渡せば、そのページ配下のnode ID一覧が確実に取れる
  （出力が大きいとツール応答には載らず `.../tool-results/*.txt` にJSONで保存されるので、
  Bash+pythonでgrepする）。`32:2`は約166k文字・1979行。
- MobileOrderページの主なセクション（`get_metadata nodeId:"32:2"` の実測）:
  - `60:772` 注文（お客様側 TOP/Product Detail/Menu/Category Listing/Cart/Order Confirmed…）
  - `430:3294` Register / レジ ・ `448:2864` Dashboard ・ `448:2867` Menu Management
  - `448:2870` Categories Management ・ `448:2873` Takeout Management
  - `430:3259` Kitchen ・ `462:3169` Takeout Pickup
- 判明しているテンプレートのnode ID:
  - `309:279` Template / Categories Management 1180x820
  - `462:2942` Template / Takeout Pickup 1180x820 ／ `462:3083` Takeout Pickup — Mobile 390
- `get_screenshot`は16×16のアイコンだと拡大されずそのまま返るので、細部を確認したい場合は
  `curl`でPNGを落としてPython(PIL)で輝度マップを出すと確実（Step3-Mのチェックアイコンで使用）。
  なお Component Set「Icon」(52:36) は 6列×4行・36pxピッチ・パディング20pxに整理され、
  バウンズも 756x56 → 236x164 に修正済み（旧バウンズ不一致による Return/Bell/Bag/Map Pin の
  クリップは解消）。variantプロパティのプルダウン順だけはFigmaの制約でキャンバス配置と
  一致していないが、コード側は文字列名で引くだけなので影響しない。
- `get_design_context`を呼ぶ前に`read_skill_uri("skill://figma/figma-design-to-code/SKILL.md")`で
  スキルを読むのが必須（ツール仕様）。

### ビルド/devサーバー運用

> **✅ 2026-08-04 解消: `npm run check` は dev サーバーを起動したまま回してよくなった（PR #24）。**
> `next dev` と `next build` が同じ `.next/` を奪い合うのが原因だったので、出力先を分けた。
> - `next.config.mjs` の `distDir` を `NEXT_DIST_DIR` で差し替え可能にした（未指定なら `.next`）
> - `npm run check` は `npm run build:check`（＝ `NEXT_DIST_DIR=.next-check`）を呼ぶ
> - `npm run dev` と、Vercel が呼ぶ `npm run build` は**どちらも `.next` のまま**
>
> Stop hook が AI の1ターンごとに `npm run check` を回すため、これは単発の不便ではなく
> ハーネスの構造的な不具合だった。**以下の「同時に動かすな」は、この変更以前の話。**

- ~~`npm run build`と`npm run dev`を同時に同じディレクトリで動かさない~~（PR #24 で解消）。
  ただし**手で `npm run build` を叩くと従来どおり `.next` を上書きする**ので、dev を
  起動したまま検証したいときは `npm run check`（＝ `build:check`）を使うこと。
- **`Cannot find module for page: /_document` の原因が判明した（2026-07-26）。**
  Dropboxがビルド中の`.next`を同期してしまい、`.next/server/pages-manifest.json` 等に
  **競合コピー**（`… (平澤天真 の競合コピー 2026-07-26).json`）を作って本体を差し替えるため、
  Nextがページを解決できなくなる。1回のビルドで25個の競合コピーが生成されていたこともある。
  検出は `find .next -name "* (*" | wc -l`。
  - **`xattr -w com.dropbox.ignored 1 .next` は効かなかった**（このMacのDropboxは
    CloudStorage/File Provider版で、ignore属性を尊重しない）。実際に属性を付けた状態でも
    競合コピーが10個できてビルドが落ちた。**この方法は当てにしないこと。**
  - 現状の実用的な回避策は**ビルドをもう一度流すこと**（`rm -rf .next && npm run build`）。
    経験上2回目で通る。
  - 恒久対策の候補:
    1. Dropboxの選択型同期で `.next` を除外する（未実施・ユーザー判断待ち。**残る唯一の候補**）
    2. ~~`.next` をDropbox外へのシンボリックリンクにする~~
       — **試して失敗した（2026-07-29）。この方法は採らないこと。**

> **⚠ `.next` のシンボリックリンク化は絶対にやらないこと（2026-07-29に実証）。**
> `ln -s /private/tmp/orderly-next .next` にすると、Nextが吐いた
> `/private/tmp/orderly-next/server/app/page.js` から見て上位に `node_modules` が
> 無いため `Cannot find module 'next/dist/compiled/next-server/app-page.runtime.dev.js'`
> で起動しない。逃げようとしてリンク先に `node_modules` のシンボリックリンクを
> 張ると、今度は `Cannot find module 'next/dist/pages/_app'` になる。
> **さらに悪いことに、この状態を片付ける過程で `node_modules` が空になった**
> （379→0。Dropbox の File Provider がリンクを辿ったものと思われる）。
> 復旧は `npm ci` で済み、**Git管理下のファイルは無傷**だったが、
> Dropbox配下でシンボリックリンクを使う発想自体を捨てること。
>
> なお `npm ci` 前の `node_modules/next/dist/pages/` は**存在しなかった**。
> Dropboxが同期の過程で欠落させていた可能性が高く、
> 「動くはずのものが動かない」ときは `npm ci` で入れ直すのが早い。
- **本番ビルド直後にdevサーバーを起動すると`/dev/ui`等が500になる**（`.next`の成果物が
  production用のまま）。dev起動前にも`rm -rf .next`すること。
- dev稼働中にも`Cannot find module './948.js'`系のチャンク欠落で500になることがある。
  同じく dev停止 →`rm -rf .next`→ dev再起動で直る。
- devサーバーのログは`/tmp/orderly-dev.log`。

### サービス名の改名（Orderly → GOOD ORDER）で**変えなかった**もの
表示に出ない永続化キー・DBオブジェクトなので、改名するとデータや挙動が壊れる。
名前の見た目のために払うコストに見合わないため、意図的に `orderly` を残している。

- `lib/store.ts` の `name: "orderly-cart"` — カート（zustand persist）のLocalStorageキー。
  変えると**既存のお客様のカート・注文履歴・テーブル番号が全部消える**
- `lib/kitchenAck.ts` の `orderly_kitchen_ack` — 厨房の「確認済み注文」キー。
  変えると一度だけ全注文が新規扱いになり、アラートと通知音が鳴る
- `supabase/pickup_no.sql` の `public.orderly_business_date()` — **本番DBに作成済みの関数**。
  SQLファイルだけ書き換えてもDBは変わらず、DB側を変えるなら採番トリガーと
  バックフィルの参照も同時に張り替える必要がある（受渡番号の採番が止まるリスク）

将来どうしても揃えたい場合は、LocalStorageキーは「旧キーがあれば読み込んで新キーに
コピーする」移行コードを噛ませれば無害に変えられる。DB関数は
`ALTER FUNCTION … RENAME TO …` とトリガー再作成をセットで行うこと。

なお `app/design-tokens.css` の `Figma file: UTUTU — "Orderly — Foundations" board` は
**Figma側のボード名そのもの**なので、Figmaを改名するまでは変えていない。

### その他
- Tailwindのカスタムクラス（`type-jp-*`, `type-en-*`など`app/typography.css`で定義された
  もの）は`lg:`等のresponsive variantを付けても効かない（Tailwind JITが認識する標準
  ユーティリティではないため）。PC/SPで文字サイズを出し分けたい箇所は生の
  `text-[Npx]`等の任意値ユーティリティを使うこと。
- `/admin`はログインが必要。**パスワードの入力・ログイン操作はしない。**
  ただしChromeにセッションが残っていれば実画面をそのまま目視確認できる（今回はできた）。
  残っていない場合は`/dev/ui`（認証不要のギャラリーページ）でコンポーネント単位に確認する。
- SP幅（390px）の見た目確認は、ウィンドウを狭められない場合、
  `javascript_tool`で390px幅のiframeを一時的にページへ注入する方法が使える。
- 見た目の差し替えであっても、Figmaに存在するが既存機能に無いもの（逆も然り）は
  無理に一致させず、ユーザーに差分として報告する運用（このプロジェクト全体の一貫方針）。

---

## 厨房伝票の印刷（フェーズ1: 印刷ジョブキュー）

EPSON TM-m30III-H の**サーバーダイレクトプリント**で厨房伝票を出す機能。
プリンタが数秒おきにこちらのサーバーへ HTTP で「印刷するものある?」と
聞きに来る方式なので、店舗ルーターのポート開放が要らず Vercel と相性がよい。
機種選定の根拠・実機セットアップ手順・全体の工程は Artifact 2本にまとめてある。

### 決定事項（天真の回答、2026-08-20）

| 論点 | 決定 |
|---|---|
| 枚数 | **キッチン用1枚のみ。お客様控えは出さない** |
| 品名 | **日本語表記のみ**（英語併記なし） |
| 新規/追加 | 新規は「新規」、2回目以降は**「追加(2)」のように回数付き** |
| 金額 | **刷らない**（点数のみ） |

伝票デザインは天真がFigma外で作成し画像で支給。要素とサイズ感:
黒地白文字の「新規」バッジ／右上に「厨房伝票」／太い区切り線／
テーブル（特大）＋受付時刻／受渡番号／数量（特大）＋品名の明細行（点線区切り）／
合計 N点。**忠実な再現は不要、項目とサイズ感を合わせる**という指示。

### 受渡番号の扱い（既存設計の再確認）

天真から「受渡番号ってなに？設計にあったっけ」と質問があったため確認した。
**存在する。しかも天真自身の指示で入ったもの**（上記「受渡番号・counterロール・
並び替え永続化」節）。ただし後から**「店内注文では受渡番号を非表示」**という
決定が入っている（同「2. 店内注文では受渡番号を非表示 — 完了」節）ため、
番号自体は全注文に振られるが**画面に出るのはテイクアウトのみ**。
店内注文では `/complete` でも `/history` でも行ごと出していない。
店舗側で使うのは `/admin/pickup`（テイクアウト受渡画面）だけ。

→ **思い出せなくて自然な状態**だった（店内注文では画面のどこにも出ないため）。

**伝票への反映は未確定**。支給されたデザインには「テーブル A-1」と
「受渡番号（テイクアウト）#07」が同じ紙に並んでいるが、これは既存設計と矛盾する。
店内=卓ラベルが主役 / テイクアウト=受渡番号が主役 の**2バリエーション**と解釈するのが
自然だが、天真に確認中。フェーズ3（レイアウト実装）着手前に決着させること。

### `supabase/print_jobs.sql`（新規）

- `print_jobs` テーブル: status（pending/printing/done/failed）、seq、attempts、
  last_error、claimed_at、printed_at。`order_id` に UNIQUE 制約（二重投入の機構的防止）
- `enqueue_print_job()` = orders の **AFTER INSERT** トリガー。SECURITY DEFINER
  （anon が orders を INSERT するため）
- **例外を握りつぶしている**: ジョブ作成に失敗しても注文の INSERT は成功させる。
  「印刷が壊れても注文は通る」を DB レベルで担保する設計上の意図。RAISE WARNING のみ
- `print_job_seq_for_order()` = 「新規/追加(N)」の N。**VOLATILE のままにすること**
  （STABLE にすると AFTER INSERT トリガーから自分自身の行が見えず常に 1 を返す）
- `claim_print_job(store_id)` = pending 最古を1件 'printing' にして伝票データを
  jsonb で返す。**FOR UPDATE SKIP LOCKED** で同時呼び出しでも同じジョブが
  2台に渡らない（＝二重印刷が起きない）
- `complete_print_job(job_id, ok, error)` = 成功なら done、失敗なら pending に戻して
  再挑戦。**5回で failed** に落として止める（紙切れのまま無限に刷り直さない）
- `reclaim_stale_print_jobs()` = 'printing' のまま **2分** 経過したものを pending に戻す

### 判断: 「追加(N)」の数え方

**同じ卓の・同じ営業日の・まだ会計（status='paid'）が済んでいない注文のうち、
自分より前のものの数 + 1**。テイクアウトは常に 1（新規）。

つまり**会計が済むと次の注文はまた「新規」に戻る**＝席の入れ替わりでリセットされる。
席を跨いだ通し番号にしたい場合は `print_job_seq_for_order()` だけ差し替えればよい。
**この挙動でよいか天真に確認中。**

卓の識別は `table_id` を優先し、NULL のものは `table_number` でグループ化する
（移行前の `?table=N` 由来の注文への対応）。
`created_at` が同値のときは `id` で決着させ、同時 INSERT でも順序が一意に決まるようにした。

### 判断: 取りこぼし回収は「出ない」より「2枚出る」を選ぶ

プリンタに渡した直後に電源やWi-Fiが落ちると 'printing' のまま残り、放置すると
永久に印刷されない。2分で pending に戻すが、**実際には印刷できていて報告だけ
届かなかった場合は同じ伝票がもう1枚出る**。厨房伝票では欠落のほうが事故が大きいため
こちらを取った。2分はプリンタのポーリング間隔（3秒想定）より十分長く取ってある。

### 権限

- **anon は print_jobs に一切触れない**（REVOKE ALL）。注文内容が読めてしまうため
  SELECT も渡さない。ジョブを積むのは SECURITY DEFINER のトリガーなので anon の権限は不要
- authenticated は **SELECT のみ**（管理画面の「印刷状況」用）。
  INSERT/UPDATE/DELETE のポリシーは意図的に作っていない
- claim / complete / reclaim の3関数は **service_role にのみ EXECUTE**。
  サーバー側API（`app/api/print/...`）が service_role キーで呼ぶ

### 残り

フェーズ2: プリンタが叩く窓口 API（`app/api/print/[token]/route.ts`）
フェーズ3: 伝票レイアウト生成（`lib/receipt.ts`、ePOS-Print XML）— **デザイン確認待ち**
フェーズ4: ニセ・プリンタ（`scripts/fake-printer.mjs`）＋ `/dev/ui` にプレビュー
フェーズ5: 管理画面「印刷状況」（`app/admin/(protected)/print/page.tsx`）
フェーズ6: 実機接続（店舗・営業時間外）

## 厨房伝票の印刷（フェーズ2-4: 受け口API・伝票生成・ニセプリンタ）

### 通信仕様の根拠（重要）

EPSON の **Server Direct Print User's Manual Rev.K**（M00062910）と
**ePOS-Print XML User's Manual Rev.S**（M00048218）から起こした。

**プリンタ → サーバー**（`application/x-www-form-urlencoded`、パラメータは2〜3個だけ）:

| ConnectionType | 付随パラメータ | 意味 |
|---|---|---|
| `GetRequest` | `ID` | 印刷するものある? |
| `SetResponse` | `ID` / `ResponseFile` | 印刷結果の報告（ResponseFileは結果XML） |
| `SetStatus` | `ID` / `Status` | 状態通知 |

**サーバー → プリンタ**: `Content-Type: text/xml; charset=utf-8`。
- 印刷するものがある → `<PrintRequestInfo Version="1.00">` に包んだ ePOS-Print XML
- **印刷するものが無い → HTTP 200 ＋ 空ボディ**（204でもエラーでもない。マニュアル規定）
- 結果・状態を受けた後も同じく 200 ＋ 空ボディ

**確認できなかった点**: Rev.K は2016年版で TM-m30III-H の記載が無い（本機は Rev.R / 2023年で追記）。
Rev.R以降の本文はクリックスルー同意の内側で取得できなかった。
そのため**本機がどの `PrintRequestInfo Version` に対応するかは未確認**。
`Version="1.00"` は全機種・全ファームで「バージョン指定なし」と同じ扱いになる
最も保守的な選択なのでこれを採用した。**SDP対応そのものは本機の
Technical Reference Guide Rev.F に明記あり**（p.16 / p.92）。実機確認はフェーズ6。

### 判断: Digest認証を使わず、URLにトークンを埋める

マニュアルはDigest認証を案内しているが採用していない。Digestはサーバー側で
nonce を保持する必要があり、Vercelのサーバーレス（インスタンスの使い回しが前提にできない）
と相性が悪い。代わりに `/api/print/<token>` の形でパスに推測不能なトークンを置く。
通信はHTTPSなのでトークンは経路上で暗号化され、実効的な強度は同等。
プリンタ側のURL欄は2043文字まで入るので長さの制約も無い。

- 環境変数 `PRINT_ENDPOINT_TOKEN`（`.env.local.example` に記載）。`openssl rand -hex 24` で生成
- **未設定なら503を返して何もしない**。印刷が動かないだけで注文には影響しない
- トークン比較は `timingSafeEqual`。不一致は404（存在しないURLとして扱い、情報を与えない）

### `lib/receipt.ts`（新規）

ePOS-Print XML の組み立て。**`<text>` は「属性だけの空要素で状態を切り替え、
中身入りの要素で印字する」というスタイル指定モデル**で、`<text em="true"/>` 以降が
ずっと太字になる。使い終わったら必ず戻すこと。改行は要素の区切りではなく本文中の `&#10;`。

- 座標系は 80mm紙の印字幅 **576ドット**（= 半角48桁 / 全角24文字）
- 受付時刻と合計点数は**右端から逆算して右揃え**（点数の桁数が変わっても揃う）
- 長い品名は `wrapByWidth()` で自前に折り返して**継続行を品名の左端に字下げ**する。
  プリンタ任せの自動折り返しだと継続行が左端に戻り、数量の列と重なって読めなくなる
- `parsePrintResult()` は正規表現で `success` / `code` / `status` を拾う。
  XMLパーサを足さないのは、この応答が1要素で形が固定されており、依存を増やすより
  読み取り箇所を1つに閉じ込めるほうが安全なため
- `describePrintFailure()` が `status` のビットを「用紙切れ」「カバーが開いています」等の
  日本語にする。フェーズ5の管理画面でそのまま出せる

### `app/api/print/[token]/route.ts`（新規）

- `ConnectionType` で3分岐。未知の値は 200 + 空ボディで受け流す
- `GetRequest` のたびに `reclaim_stale_print_jobs()` → `claim_print_job()` の順で呼ぶ。
  **滞留ジョブ回収のための cron は要らない**
- **DBエラー時も 200 + 空ボディを返す**。エラーを返すとプリンタがリトライを繰り返すため、
  「今は無い」として次のポーリングに任せる
- `SetResponse` にはジョブIDが含まれない（`printjobid` は Version 2.00 以降の機能）。
  渡してあるジョブは常に1件なので `status='printing'` の最古を対象にする
- `SetStatus` は今はログのみ。保存先テーブルはフェーズ5で作る

### `scripts/fake-printer.mjs`（新規）— ニセ・プリンタ

実機と同じ喋り方で `/api/print/<token>` を叩き、返ってきたXMLを
「紙に出たらこう見える」形にターミナルへ描いて、結果を報告し返す。

```
node scripts/fake-printer.mjs            # 3秒おきにポーリング（要 npm run dev）
node scripts/fake-printer.mjs --once     # 1回だけ
node scripts/fake-printer.mjs --fail     # 用紙切れとして報告（失敗経路の確認）
node scripts/fake-printer.mjs --xml      # 生のXMLも表示
node scripts/fake-printer.mjs --render foo.xml   # サーバー無しで見た目だけ確認
```

紙のシミュレーションで踏んだ罠を2つ記録しておく（同じ実装をするとき再発しやすい）:

1. **自己終了タグが後続の閉じタグを飲み込む**。`<text lang="ja"/>` を
   `/<text\b([^>]*?)(\/?)>(?:([\s\S]*?)<\/text>)?/` で拾うと、次の `</text>` までを
   中身として取ってしまう。開きタグだけ正規表現で拾い、**閉じタグは自分で探す**こと
2. **スパース配列の穴**。`x` 指定で桁を飛ばすと配列が歯抜けになり、`map`/`join` が
   穴を詰めて桁位置が崩れる。添字で舐めて空白を敷き直すこと

### 残り

フェーズ5: 管理画面「印刷状況」（プリンタの生存・未印刷・失敗・再印刷ボタン）。
  `SetStatus` の保存先テーブルもここで作る
フェーズ6: 実機接続（店舗・営業時間外）

---

## お客様が注文を確定できなかった不具合と修正（2026-08-20）

厨房プリンタの通しテスト中に発見。**印刷とは無関係の既存の不具合**で、
`lib/store.ts` の `saveOrderToDb` が RLS に弾かれ、注文が DB に入らない。

### 症状

`/order` で商品をカートに入れて注文を確定すると、画面は `/complete` に進み
「ご注文ありがとうございます」まで表示されるが、**注文は保存されていない**。
ブラウザのコンソールにだけエラーが出る:

```
[saveOrderToDb] failed: {code: 42501,
  message: new row violates row-level security policy for table "orders"}
```

`saveOrderToDb` は例外を握りつぶして `false` を返すだけなので、
**お客様にもスタッフにも失敗が見えない**。これが厄介な点。

### 切り分け（anonキーで直接叩いて確認）

| 送り方 | 結果 |
|---|---|
| 素の INSERT（`Prefer: return=minimal`） | **HTTP 201 成功** |
| upsert（`Prefer: resolution=ignore-duplicates`）＝**アプリと同じ** | **HTTP 401 / 42501 RLS違反** |

`setup.sql` の `orders_insert_all`（anon の INSERT を `WITH CHECK (true)` で許可）は
正しく効いている。落ちているのは **upsert のときだけ**。

### 原因

PostgREST の upsert は `ON CONFLICT DO NOTHING` であっても
**UPDATE 権限を要求する**。しかし `staff_role_rls.sql` の
`orders_update_role_scoped` で UPDATE はスタッフのロール限定になっており、
**anon には UPDATE ポリシーが1つも無い**ため、upsert 全体が拒否される。

つまり以下の2つの変更が組み合わさって生まれた不具合:
1. `pickup_no.sql` の作業で `saveOrderToDb` を `.insert()` から
   `.upsert(..., { onConflict: "id", ignoreDuplicates: true })` に変更した（再送の冪等性のため）
2. `staff_role_rls.sql` で orders の UPDATE をロール限定に絞った

どちらも単体では正しく、**組み合わせで壊れている**。
DB上の最後の注文は 2026-07-31 で、それ以降の注文が1件も無いのと符合する。

### 対応（天真の判断: 案1で決定・実装済み）

1. **注文の INSERT を SECURITY DEFINER の RPC に移す（推奨）**
   `orders_anon_lockdown.sql` で anon の読み取りを RPC 経由に移したのと同じやり方。
   RLS を緩めずに冪等性も保てる。既存の設計方針と一貫する。作業量は中
2. **anon に orders の UPDATE ポリシーを足す**
   最小の変更だが **RLS の緩和**にあたる。金額列を書き換えられる経路を作ることになるので
   条件を厳しく絞る必要があり、審査が難しい。非推奨
3. **`saveOrderToDb` を素の `.insert()` に戻す**
   すぐ直るが、pickup_no の作業で入れた「再送しても受渡番号が変わらない」冪等性を失う
   （同じ id の再送は一意制約違反で落ちる）

### テストで分かったこと（副産物）

素の INSERT で注文を1件作ったところ、**`print_jobs` のトリガーは正常に発火し**、
ニセ・プリンタが伝票を受け取り、`status='done'` / `attempts=1` まで通った。
2回目のポーリングでは何も返らず、**二重印刷が起きないことも確認済み**。
このテスト注文（`aa34b14c-…`・明細なし・¥100）は確認後に削除済みで、
DB は 2026-07-31 の注文までの状態に戻してある。

### 実装: `supabase/order_insert_rpc.sql` + `lib/store.ts`

天真の判断で**案1（SECURITY DEFINER の RPC に移す）**を採用した。

- `place_order(p_order_id, p_store_id, p_table_number, p_table_id, p_table_label,
  p_order_type, p_total_amount, p_items jsonb)` を追加し、anon / authenticated に EXECUTE を付与
- `lib/store.ts` の `saveOrderToDb` は `supabase.rpc("place_order", ...)` を呼ぶだけになった。
  `derivedItemId()` は不要になったので削除（明細の冪等性はRPC側の「再送なら何もしない」で担保）

RPC に移したことで副次的に得られたもの:

- **注文と明細が1トランザクション**で入る。従来は orders と order_items を別々に往復して
  いたため、途中で失敗すると**明細の無い注文**が残りえた
- **status をクライアントに決めさせない**（従来 anon は `status='paid'` の注文を直接 INSERT できた）
- テイクアウトの卓の正規化（`table_*` を落とす）がサーバー側に移った
- 再送は「何もしない」で確実に冪等。受渡番号も振り直されない
- **返り値 boolean**: `true`=今回登録した / `false`=再送で既にあった。false は失敗ではない

**RLSは緩めていない。** `orders` / `order_items` の UPDATE ポリシーは一切触っていない。

### 判断: 直接INSERTの経路は今回まだ塞がない

`order_insert_rpc.sql` の section 3 に、`orders_insert_all` /
`order_items_insert_all` を DROP する SQL をコメントで置いてある（**今回は実行しない**）。
RPC 経由の注文が本番で問題なく動くことを確認してから別途実行する。
いっしょに流すと、RPCに不具合があったときに注文が完全に通らなくなるため段階を分けた。

### 判断: 失敗を Sentry に送る

`placeOrder` は `saveOrderToDb` を `void` で呼ぶ（fire-and-forget）ため、
DB保存に失敗してもお客様の画面は完了に進む。**今回の不具合が3週間気づかれなかったのは
これが原因**なので、`console.error` に加えて `Sentry.captureException` を入れた
（`tags.feature = "order-submit"`、orderId / orderType / 点数 / 金額を extra に付ける）。

`sentry.client.config.ts` は無く client 側の初期化は未確認だが、
`captureException` は未初期化なら無害な no-op なので入れておく。
`app/global-error.tsx` が既に `@sentry/nextjs` を import しているため
クライアントバンドルへの追加コストも無い。

### 残っている課題（別途判断が要る）

- **金額がクライアント任せ**: `total_amount` と `unit_price` をブラウザから受け取っている。
  RPC 側で `menu_items.price` から再計算すれば改ざんできなくなるが、
  「注文時点の単価のスナップショット」という現在の意味づけが変わるため今回は触っていない
- **受付停止（`stores.is_accepting_orders`）の判定がクライアント側だけ**。
  RPC 側でも弾くべきだが、これも注文確定の挙動変更にあたるため今回は触っていない

### 伝票の卓ラベルが二重になる不具合（2026-08-20・実データで発覚）

`orders.table_label` に実際に入っている値は **「テーブル A-1」「カウンター L-1」**
（`lib/tables.ts` の `resolveTable` が返す `label` をそのままスナップショットしている）。
`resolve_table` RPC は `label`（フル）と `short_label`（"A-1"）の両方を返すが、
**ストアに入れて注文に残すのはフルラベルのほう**という既存の決定がある。

`lib/receipt.ts` の `headline()` は小さいラベルに "テーブル" を決め打ちしていたため、
伝票が **「テーブル / テーブル A-1」** と二重に出ていた。

**修正**: `table_label` を**最後の空白で割り**、前半を小さいラベル、後半を主役の値にする。

| `table_label` | 小さいラベル | 主役の値 |
|---|---|---|
| `テーブル A-1` | テーブル | **A-1** |
| `カウンター L-1` | カウンター | **L-1** |
| `12`（空白なし・移行前） | テーブル | **12** |
| `null` | 受渡番号 | **#07** |

支給されたデザイン（小さい「テーブル」＋特大「A-1」）と一致し、
**カウンター席なら小さいラベルが「カウンター」になって席種も伝わる**ようになった。

短縮ラベルを DB から引き直さずスナップショットの文字列を割っているのは、
卓を消したり改名しても過去の伝票の表記が変わらないようにするため（既存方針と同じ）。

### 二次元コードの着地点は `/`（`/order` ではない）

テスト中に取り違えたので記録。卓の解決（`resolveTable` → `setTableRef`）を
行っているのは `components/top/TopScreen.tsx` で、これが載っているのは
**`app/page.tsx`＝ルート `/`**。したがって卓つきで開くURLは:

- 新形式: `/?t=<short_code>`（例: `/?t=ttzfq8`）
- 旧形式: `/?table=<数値>`

`/order?t=...` で開くと TopScreen を通らないので **卓が解決されず
`tableLabel` が null のまま**になる。動作確認のときに注意。

現在DBにある卓（確認用）: `ttzfq8`=テーブル A-1 / `teuvw7`=テーブル A-5 /
`q4vwux`=カウンター L-1。

### 実データでの通し確認（2026-08-20・完了）

dev サーバー＋本番Supabaseで、`/?t=ttzfq8`（テーブル A-1）から実際に注文して確認した。

| 確認項目 | 結果 |
|---|---|
| 注文が DB に保存される（#40 のRPC修正） | **OK**（`place_order` 経由で保存。RLSに弾かれない） |
| AFTER INSERT トリガーが印刷ジョブを積む | **OK** |
| 伝票の卓が「テーブル / A-1」（#41 の修正） | **OK**（二重表記が解消） |
| 1回目が「新規」 | **OK** |
| 同じ卓の2回目が「追加(2)」 | **OK** |
| 会計（paid）後の3回目が「新規」に戻る | **OK**（天真の承認どおり） |
| 印刷完了の報告で done になる | **OK**（`attempts=1`） |
| 2回目のポーリングで何も返らない＝二重印刷しない | **OK** |

実際に出た伝票:

```
　  新  規  　                          厨房伝票      　  追  加  ( 2 ) 　                    厨房伝票
━━━━━━━━━━━━━━━━━━━━━━━━      ━━━━━━━━━━━━━━━━━━━━━━━━
テーブル                             受付            テーブル                             受付
A  -  1                              08/20 16:28     A  -  1                              08/20 16:29
━━━━━━━━━━━━━━━━━━━━━━━━      ━━━━━━━━━━━━━━━━━━━━━━━━
2       ブレンドコーヒー                              1       フレンチフライ
────────────────────────      ━━━━━━━━━━━━━━━━━━━━━━━━
1       マスカルポーネ＆エスプレッソ                  合計                                        1 点
━━━━━━━━━━━━━━━━━━━━━━━━
合計                                        3 点
```

テストで作った注文3件は削除済み。DBは 2026-07-31 の注文までの状態に戻してあり、
`print_jobs` は0件、孤児の `order_items` も無いことを確認した。
ブラウザ側の LocalStorage（カート・注文履歴）も消してある。

**注意**: dev サーバーを再起動した直後はブラウザが古いJSを掴んでいることがあり
（HMRのWebSocketが切れて404が出る）、修正前のコードが動いて誤った結論を出しかける。
コンソールのエラーは**過去のページ読み込みぶんも溜まっている**ので、
判断はコンソールではなく**DBの実データ**で行うこと。

## 厨房伝票の印刷（フェーズ5: 管理画面「印刷状況」）

営業中にプリンタが止まっても誰も気づけない、という状態を無くすための画面。
`/admin/print`。アクセスできるのは manager / kitchen / counter。

### `supabase/printer_status.sql`（新規）

- `printer_status` テーブル（店舗につき1行）: `last_seen_at` / `last_status_at` /
  `status_note`（「用紙切れ」等の日本語）/ `status_raw`（調査用の元XML）
- `printer_poll(store_id)` = **受け口APIが毎回呼ぶ処理を1本にまとめたもの**。
  生存記録 → 滞留ジョブの回収 → 次のジョブ取り出し。
  3秒おきに叩かれる経路なのでDBへの往復を1回に減らした（以前は reclaim + claim で2回）
- `record_printer_status(store_id, note, raw)` = 状態通知の記録
- `requeue_print_job(job_id)` = 刷り直し。**中で `app_metadata.role` を見て
  manager / kitchen / counter 以外は弾く**。register を外しているのは伝票の
  再発行に関与しないため。会計（paid）権限まわりは一切触っていない

**判断: 生存記録の書き込みは15秒に1回に間引く。**
3秒ごとに1行を更新し続けると1日3万回近い更新になり、1行しかないテーブルに
不要なゴミ（dead tuple）が溜まる。画面側の判定は「60秒以上音沙汰なし＝停止」
（`PRINTER_OFFLINE_AFTER_MS`）なので15秒の粒度で足りる。

### `lib/printStatus.ts`（新規）

画面とギャラリー（`/dev/ui`）の両方から使う表示ロジック。
`describePrinterHealth()` が状態を ok / warning / offline / unknown の4つに落とし、
**見出し（何が起きているか）と補足（原因とやること）をセットで返す**。
「つながっているか」→「困りごとがあるか」の順で判定する。
通信が切れていれば紙の有無は分からないので、そちらを先に出す。

### 状態通知のビットは16進、印刷結果は10進

`<printerstatus asbstatus="0x0F00003C"/>` と `<response status="251854870"/>` で
**同じ意味のビットなのに表記が違う**。受け口API側で 16進をパースしてから
`describePrinterStatus()` に渡している。

`lib/receipt.ts` に `describePrinterStatus()`（異常が無ければ **null**）を追加した。
`describePrintFailure()`（必ず文字列を返す）とは別にしてあるのは、
画面が「異常なし」を出し分けられるようにするため。

### 判断: この画面のデザインはFigmaに対応ノードが無い

新規画面のためFigmaにノードが無い。**新しい配色やタイポは一切足さず**、
既存の管理画面（`/admin/pickup`・`/admin/kitchen`）のレイアウトと
`app/design-tokens.css` のトークン（status-success / warning / urgent / info）
だけで組んだ。`StatusBadge` と同じドット＋ラベルの形も踏襲している。
**Figmaを起こす場合は差し替え前提**。天真に確認済みではないので、
気に入らなければ作り直す。

### `/dev/ui` のスクリーンショットについて

`PrinterHealthCard`（4状態）と `PrintJobRowCard`（4状態）のセクションを追加し、
PC 1400px / SP 390px の両方で確認済み。

**注意: この環境では Playwright MCP のブラウザが未インストール**
（`npx @playwright/mcp install-browser chrome-for-testing` が必要）だったため、
Browser ペインで確認した。ペインには**スクロール後に再描画されない不具合**があり、
真っ白な画像しか撮れない。**ウィンドウを数px リサイズすると再描画される**ので、
「JSでスクロール → resize_window で高さを±20px 変える → 撮影」で回避できる。

### 残り

フェーズ6: 実機接続（店舗・営業時間外）。開発側の作業はこれで完了。

---

## 独自ドメインと、店舗ごとのURL接頭辞（2026-08-24）

`good-order.jp` をムームードメインで取得したことに伴う、URL体系の決定と実装。

### 決めたこと

| URL | 中身 |
|---|---|
| `good-order.jp` | GOOD ORDER の公式サイト。**まだ作っていない。DNSも未設定のまま** |
| `app.good-order.jp/yorkys-shukugawa` | YORKYS BRUNCH 夙川店の本番（新Vercel＋新Supabase） |
| `app.good-order.jp/demo` | 製品デモ（現行の `yorkys-orderly` を将来ここへ） |
| `app.good-order.jp/<店名>` | 今後の導入店。店名は店側が決められる |

ネームサーバーは取得時から**ムームーDNS**（`dns01/dns02.muumuu-domain.com`）。
Vercel のネームサーバーには**移していない**。ムームーDNSのカスタム設定に
CNAME を1行足す方式で運用する。

### なぜ basePath 方式にしたか（案A）

Vercel は **1ドメイン＝1プロジェクト**。`app.good-order.jp` を「デモ」と「YORKYS」の
両方に同時に向けることはできない。それでもデモと本番はVercelプロジェクトごと
分けたい（デモの操作が本番の売上データに混ざらないため）。この2つを両立させる
方法を3つ比較した。

| 案 | 中身 | 採否 |
|---|---|---|
| **A** | 各プロジェクトが `basePath` で自分の接頭辞を名乗る。`app.good-order.jp` は YORKYS プロジェクトに直接当てる | **採用** |
| B | `app.good-order.jp` に「振り分け役」プロジェクトを置き、rewrites で各店舗へプロキシ | 見送り |
| C | アプリ自体を多店舗対応（`app/[shop]/...`）に作り替える | 見送り |

Bを見送った理由: プロキシが1枚挟まるので、厨房画面の Realtime（WebSocket）と
Supabase Auth のCookieが正しく通るかを実機検証する必要があり、9月リオープンまでに
検証時間が取れない。**2店舗目が入る時点でBへ移行する**。そのときも各店舗の
`basePath` は既に入っているので、**YORKYSのURLは変わらない**。

Cを見送った理由: 全ページのルーティング・全テーブルのRLS書き換えになり数週間。
9月に間に合わない。SaaSとして数十店舗を捌く段になったら改めて検討する。

**URLを先に確定させることが目的**。二次元コードは紙に刷って店に置くので、
後からURLを変えると全部刷り直しになる。見た目や機能は後から直せるが、
紙に焼き付いたURLは直せない。

### basePath が自動で付かない4箇所（実装済み）

`next/link` と `router.push` は Next.js が自動で接頭辞を付ける。付かないのは以下。
**新しくコードを足すときはここに該当しないか確認すること。**

| 場所 | 何をしたか |
|---|---|
| `lib/qrCode.ts` の `tableOrderUrl()` | `window.location.origin` に接頭辞を足す。ここを忘れると刷った紙が全部無効になる |
| `lib/useAdminSession.ts` の `logout()` | `window.location.href` は Next を経由しないので手で足す |
| `app/manifest.ts` | `start_url` と `icons[].src`。抜けるとホーム画面から起動したときだけ404 |
| `app/robots.ts` | `disallow` のパス。robots.txt の記法はドメイン先頭からの絶対パスのため |

値の出どころは環境変数 `NEXT_PUBLIC_BASE_PATH` の1つだけ。
`next.config.mjs` と `lib/siteConfig.ts` の両方がこれを読む
（next.config は .mjs なので TS からは import できず、環境変数が唯一の共有手段）。

### `NEXT_PUBLIC_SITE_URL` の意味が変わった

以前は「公開URLそのもの」だったが、**今は「ドメインだけ」を入れる**。
店舗の接頭辞はコード側（`lib/siteConfig.ts`）が足す。

```
NEXT_PUBLIC_SITE_URL=https://app.good-order.jp        ← 正
NEXT_PUBLIC_SITE_URL=https://app.good-order.jp/yorkys-shukugawa  ← 誤（二重になる）
```

`siteConfig.ts` のエクスポートも増えた: `siteHost`（ドメイン）/ `basePath`（接頭辞）/
`siteUrl`（両者を繋いだもの。canonical・OGP・sitemap の出どころ。従来どおり）。

### ⚠ 残っている課題

1. **robots.txt がドメイン直下に置けない**
   basePath があるので `/yorkys-shukugawa/robots.txt` に出る。検索エンジンは
   ドメイン直下の `/robots.txt` しか読まないため、本番では事実上「robots.txt なし」。
   `/admin` `/dev` は各ページの noindex メタで除外済みなので実害は無いが、
   案Bへ移行して振り分け役を置いたら、そこに全店舗ぶんの robots.txt を出すこと。
2. **`vercel.json` の cron パスに店名がハードコードされている**
   `/yorkys-shukugawa/api/daily-report`。vercel.json は静的JSONなので環境変数で
   分岐できない。同じリポジトリを見るデモ側では404になるため、
   **デモ側のVercelプロジェクトでは Cron Jobs を Disable にすること**。
   3店舗目が増えたら `vercel.ts`（環境変数で組み立てられる新方式）へ移行が必要。
3. **本番の環境変数が2つ欠けている**（2026-08-24 時点、`yorkys-orderly`）
   - `SUPABASE_SERVICE_ROLE_KEY` … 無いと `/api/print` が503を返し、**厨房伝票が1枚も出ない**
   - `CRON_SECRET` … 無いとAI日報が動かない
   新しいYORKYSプロジェクトを作るときは**必ず両方入れること**。

### 検証したこと（ローカル本番ビルド、`NEXT_PUBLIC_BASE_PATH=/yorkys-shukugawa`）

- `/` → `/yorkys-shukugawa` へ307リダイレクト
- `/yorkys-shukugawa`・`/order`・`/admin/login` が200
- 既存の `/admin/takeout` → `/admin/menu` リダイレクトも接頭辞込みで動作
- 接頭辞なしの `/order` は404（他店舗のURLと混ざらない）
- `manifest.webmanifest` の `start_url` と icons、`sitemap.xml` の `<loc>`、
  `robots.txt` の Disallow と Sitemap 行がすべて接頭辞込みで出力される
- 接頭辞なし（＝デモ・ローカル）でビルドすると従来どおりルート直下で動く

---

## basePath を本番へ反映するときの手順（2026-08-26 に踏んだ罠）

`NEXT_PUBLIC_BASE_PATH` を Vercel に追加したあと、**本番へ反映するのに何度も失敗した**。
同じことを繰り返さないよう、原因と正しい手順を残す。

### 踏んだ罠3つ

1. **`NEXT_PUBLIC_` の環境変数を Sensitive で登録すると効かない**
   `vercel env add` は既定で Sensitive（値を隠す）として保存する。しかし
   `NEXT_PUBLIC_*` はブラウザ側のJSに埋め込む前提の値なので、Sensitive とは
   両立しない。**`--no-sensitive` を付けて登録すること。**

2. **`vercel redeploy` は「前回と同じ環境変数」を使い回す**
   環境変数を足したあとに `vercel redeploy` しても、**追加した変数は読まれない**。
   ビルドログには新しいビルドが走ったように出るので気づきにくい。

3. **`vercel redeploy` は「そのデプロイのコミット」を再ビルドする**
   Deployments 一覧の一番上が最新コミットとは限らない（promote や redeploy で
   作られたデプロイが上に来る）。**古いデプロイを redeploy すると、本番が
   その時点のコードに巻き戻る。** 実際 2026-08-26 に本番を 8/4 の状態
   （印刷API・注文RPCが存在しない）へ巻き戻す事故を起こした。

### 正しい手順

環境変数を変えたら、**新しいコミットを push して自動デプロイを走らせる**のが唯一
確実な方法。PR を作ってマージすれば、そのコミット＋最新の環境変数でビルドされる。

Vercel 画面の Redeploy を使う場合は、**対象デプロイのコミットが最新か必ず確認する**
こと（Deployments 一覧で Source 欄のコミットハッシュを見る）。

### 事故ったときの戻し方

正しいコミットのデプロイを探して promote すれば即座に戻せる。

```
gh api "repos/<owner>/<repo>/deployments?per_page=5" --jq '.[] | {sha, env: .environment}'
gh api "repos/<owner>/<repo>/deployments/<id>/statuses" --jq '.[0].environment_url'
npx vercel promote <そのURL> --yes
```

promote はビルドし直さないので数秒で完了する。

---

## カテゴリー見出しをDB管理に移す（2026-08-26）

### 何が問題だったか

カテゴリー自体は `categories` テーブルで管理しているのに、お客様側 `/order` の
見出し（説明文・英語名・日本語名）だけが `app/order/page.tsx` の
`SECTION_COPY` に11カテゴリぶんハードコードされていた。

そのため **管理画面からカテゴリーを追加してもお客様の画面に出ない**。
コード側に用意した11個の枠しか描画されず、店舗が自分でメニュー構成を
変えられない状態だった。天真の指摘で発覚（「ここ設計ミスですかね」）。

### 直した形

見出しの3要素をすべて `categories` に持たせ、管理画面から設定できるようにした。

| 表示 | DBの列 | 備考 |
|---|---|---|
| 説明文（小さい文字） | `description` | 40文字以内。DB側にも CHECK 制約 |
| カテゴリー名（英語） | `caption` | 既存列を流用。例: PANCAKE |
| カテゴリー名（日本語） | `name` | 既存列 |

英語名・日本語名はそれぞれ「大・中・小」を選べる（`en_size` / `jp_size`）。
**新しいサイズ値は作らず、既存のデザイントークンに割り当てている。**

| | 大 | 中 | 小 |
|---|---|---|---|
| 英語 | `type-en-display-xl` | `type-en-display-l` | `type-en-display-m` |
| 日本語 | `type-jp-heading-m` | `type-jp-body-bold` | `type-jp-caption-bold` |

既定値は英語=大 / 日本語=小。これはDB管理に移す前の見た目と同じ組み合わせなので、
既存カテゴリーの見え方は変わらない。

### 副次的に直ったこと

- タブ（画面上部のカテゴリー切り替え）も `SECTION_ORDER` 固定をやめ、
  DBの `display_order` 順で作るようにした
- scrollspy の監視対象も同様
- **説明文・英語名が未入力なら、その行ごと描画しない**（空行が空くのを避ける）

### 白紙化のときに失われた文言

2026-08-26 にダミーデータを全削除したため、旧 `SECTION_COPY` の
キャッチコピー11件は消えている。参考として記録しておく。

```
pancake       これがYORKYSの原点！看板メニュー
french_toast  外はさくっ、中はとろける贅沢な一皿
eggs_benedict とろ〜りソースが自慢の、休日の主役
sandwich      片手で頬張る、忙しい朝のご褒美
fritter       サクッと軽い、箸が止まらない一品
burger        ボリューム満点、がっつり派に人気
lunch         お腹も心も満たす、しっかりごはん
coffee        豆から届ける、香り高い一杯
tea           ゆったり時間のお供に、香り豊かな一杯
soft          食事と一緒に、すっきり爽やかに
alcohol       乾杯はここから、大人のひととき
```

---

# 提供タイミングの指定と、伝票の2枚出し（2026-09-04・実装済み、PR前）

仕様は `docs/specs/serving-timing.md`（確定版）。ブランチ `feat/serving-timing`。
天真の3つの依頼「FOOD と DRINK 両方の注文は伝票を2枚」「パンケーキ・フレンチトーストは
でき次第 / 食後」「DRINK は先出し / 食後」を、1つの仕組み「提供タイミング」＋「2枚出し」にまとめた。

## 進め方（design-rules との関係）

1. 先に操作の流れを文章で出し、選択UIの器を3案（A セグメント / B 説明つきカード / C チップ）
   **HTMLのたたき台**で比較して天真の決定を取った（`.claude/verification/2026-09-04-serving-timing/`）。
   Figma 連携（MCP）がこのセッションでは未認証で書けなかったため、Figma の代わりに HTML で出した。
2. 決定: **商品詳細は B（フードの補足は「調理でき次第お持ちします」）、カートは A**、
   伝票・厨房・完了画面・管理画面はたたき台どおり。
3. 天真の指示で **Figma と実装の両方を進める**ことになり、実装を先に完了させた。
   セッション内で Figma を再接続してもらったが、**MCP のツールがこのセッションには現れなかった**
   （ToolSearch / ListPlugins とも空）。**Figma は新しいセッションで着手すること**（下記「残り」）。

## 実装の要点

| 場所 | 中身 |
|---|---|
| `lib/servingTiming.ts`（新規） | 文言・初期値・対象判定・カート行キーを1か所に。他はすべてここを見る |
| `lib/store.ts` | `CartItem.servingTiming`。行の同一性は「商品ID＋タイミング」（`cartLineKey`）。`addItem` は省略時に初期値を自動で入れる（`menuDataStore` のカテゴリーから引く）。`decrementItem` / `setServingTiming` を追加 |
| `components/ui/ServingTimingCards.tsx`（新規） | 商品詳細の選択カード（案B）。Option Card 180:167 を土台に説明文とラジオを足した |
| `components/ui/SegmentedControl.tsx`（新規） | カート行の切替（案A）。**Figma に無い新規部品**。高さ44 |
| `components/ui/ServingTimingBadge.tsx`（新規） | 読み取り表示。「食後」は墨チップ、初期値は薄い文字。厨房・完了・履歴で共用 |
| `lib/receipt.ts` | `receiptCopies()` で枚数を決め、`buildReceiptXml()` が1ジョブの中で伝票を N 回組み立てる。見出しは「厨房伝票 1/2」「ドリンク伝票 2/2」。明細の下に提供タイミング（食後は黒帯・倍高） |
| `supabase/serving_timing.sql`（新規） | `categories.serving_timing_choice` / `order_items.serving_timing` / `place_order` と `claim_print_job` の差し替え / 初期データ |
| 管理画面「カテゴリ管理」 | 「区分」の下にトグル「提供タイミングをお客様が選べる」 |
| `app/history/page.tsx` | 再注文の `MenuItem` を `rowToMenuItem` で作るようにした（従来は category/subcategory が "food"/"pancake" 決め打ちで、**再注文した商品のタグが全部「パンケーキ」になっていた**。副次的に修正） |

## 判断: 2枚出しは「1ジョブで2回組み立てる」

ジョブを2つにすると `print_jobs.order_id` の UNIQUE（二重印刷の機構的防止）を崩すことになる。
1つの `<epos-print>` の中で伝票を2回組み立てて2回 `<cut>` すれば、刷り直しも1操作で2枚出る。
ニセ・プリンタ（`node scripts/fake-printer.mjs --render`）で2枚・黒帯・右揃えの見出しを確認済み。

## 判断: 値は3値（asap / first / after_meal）で持つ

「標準 / 食後」の2値にすると、後でカテゴリーの区分を変えたときに過去の注文・伝票の意味が変わる。
NULL は「選択対象外」（テイクアウト・対象外カテゴリー・移行前の注文）。

## 本番データで分かったこと（重要）

**本番のカテゴリーは全14件が「フード」区分だった。「ドリンク」（slug `drink`）「アルコール」（`alcohol`）も。**
このままだと 2枚出しもドリンクの「先出し / 食後」も一度も効かない。
`supabase/serving_timing.sql` の初期データ（2-a）でこの2件をドリンク区分に直す。
天真には報告済み。管理画面「カテゴリ管理」の「区分」からいつでも変えられる。

slug も想定と違った（`frenchtoast` であって `french_toast` ではない）。初期データは slug と名前の両方で拾う。

## ⚠ 流す順番: SQL → マージ

アプリ側は新しい列（`categories.serving_timing_choice` / `order_items.serving_timing`）を前提に SELECT する。
**SQL を流す前にマージすると、お客様側のカテゴリー取得と厨房画面の明細取得が「列が無い」で失敗する。**
SQL だけ先に流してもアプリは壊れない。手順: (1) SQL Editor で `serving_timing.sql` を実行 → (2) PR をマージ。

## 副次的に見つけた別件（未対応）

お客様画面のカテゴリータグ・見出しは `SUBCATEGORY_LABEL[slug] ?? slug` で、
本番の新しいカテゴリー（`brekkie` `hamburger` `frenchtoast` 等）は**英字のスラッグのまま表示**されている。
DB の `categories.name` / `caption` を優先する共通ヘルパーに寄せるべき。別タスクにした（spawn_task で提案済み）。

## 洋輔さんへの共有資料

`docs/share/2026-09-04-serving-timing.html`。1ファイルで完結（写真は埋め込み）。
何が変わるか・お客様の3ステップ・店舗側の変化・Q&A・変更点一覧。画面はHTMLで再現したもので、実機のスクリーンショットではない。

## Figma（同日中に追いついた）

セッション中に Figma 連携がつながったので、実装の後追いで起こした。作ったものの一覧は
`docs/specs/serving-timing.md` の 10 章。スクリーンショットは
`.claude/verification/2026-09-04-serving-timing/figma-*.png`。`npm run design:figma` は
「構造・パディング 全ページ問題なし / 新しい違反なし・増えた違反なし」で通っている。

判断と注意:
- **共通部品 `Order Item Row` に子を足した**（design-rules 6）。末尾に隠しバッジを追加し、
  BOOLEAN `Show Timing` で出す形にしたので、既存インスタンスには影響しない。
  変更前後で Kitchen の PC / SP の全行（20行）の文言を突き合わせ、一致を確認した
- `Cart Item Row` は触らず、`Cart Item Row (Timing)` を別部品として置いた。
  **その後、天真が構造を作り直した**（セグメントを情報の列の中ではなく、画像＋情報のブロックの下に
  行の内側いっぱいの幅で置く。上のブロックとの間隔 space/16、画像は上揃え）。天真のフレームを
  そのままコンポーネント化して私のものと差し替え、カートのインスタンスと実装（`CartItemRow.tsx`）も同じ構造に揃えた
- Segmented Control の内側余白は **space/4**（3px はスペーシングのスケールに無い）。実装側も `p-[var(--space-4)]` に揃えた
- 「食後」チップの文字は **JP/Caption Bold**（12px）。実装側も `type-jp-caption-bold` に揃えた
- Product Detail の提供タイミング枠は Intro の中に paddingTop 12 で入れ、本文との距離を実装（mt-24）と同じ 24 にした
- `npm run design:figma` を通すために、**自分の作業以外の既存の構造違反も直した**:
  Components ページの浮いていた `Frame 3` → 新設 `99 未整理` セクションへ / `00 Foundations` の下パディング 97→100（下のセクションを 3px ずつ押し下げ）/
  Brand Guideline ページの浮いていた `Frame 1` → `99_ARCHIVE` へ移動（消していない）
- Order Confirmed の `Order Item Row`（原本と複製）の上下パディングを 10→12（space/12）にした。行は高さ固定 50 なので見た目は変わらない。
  複製で件数が倍になり「増えた違反」で落ちたため、原本ごと返済した

## 仕上げ（同日）

- **PR #53** を作成（`feat/serving-timing` → `main`）。マージは天真
- **SQL は天真が本番（`good-order` / `oiropkuvaenebmlicrac`）に実行済み**なのを本番データで確認した
  （`categories.serving_timing_choice` と、ドリンク・アルコールの `category_type='drink'` が入っている）
- お客様側（商品詳細・カート・完了・履歴）と `/dev/ui` の実機スクリーンショット（PC 1400 / SP 390）は
  `.claude/verification/2026-09-04-serving-timing/*-pc-1400.png` / `*-sp-390.png`。
  管理画面はログインが要るため天真の指示で省略し、PR には Figma のフレームを載せた
- **スクリーンショットの撮り方（Playwright MCP が繋がらない環境用）**: Playwright のキャッシュにある
  `chrome-headless-shell` を DevTools Protocol で操作するスクリプトを使った（`localStorage` に
  カートの中身を先に入れてから撮る）。スクリプトは scratchpad に置いたもので、リポジトリには入れていない。
  同じ手を使うなら: `~/Library/Caches/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell --remote-debugging-port=9333`
  を起動し、`/json/new` でタブを作って `Page.navigate` → `Runtime.evaluate` で seed → `Page.captureScreenshot`
- **dev サーバーが壊れていた**: HTML は 200 なのに CSS・JS・フォントがすべて 404（`.next/static` が空）。
  Browser ペインが管理していたサーバーだったので `preview_stop` → `preview_start name=dev` で立て直した。
  `npm run check`（`next build`）を dev サーバーと同時に走らせたのが原因の可能性がある。
  **同時に走らせない**か、走らせたあとは dev を再起動すること
- 2つの Supabase プロジェクトの正体: **`good-order`（NANO、`oiropkuvaenebmlicrac`）が本番**。
  `good-order-yorkys-shukugawa`（MICRO、`kugmyzvhwzphmuicdken`）は未使用。名前と実態が逆なので注意。
  本番サイトのJSに埋め込まれた接続先と `.env.local` の両方で確認した

## 残り

- **PR #53 は 2026-09-04 に天真がマージ済み**（main の `d497adb`）。カート行の構造差し替え（天真が Figma で確定した形）は
  マージ後に出た差分なので **PR #54**（`refactor/cart-row-timing-layout`）に分けた。マージは天真
- マージ後、店舗の実機でパンケーキ＋ドリンクを注文して伝票が2枚出ることを確認する
- `feat/serving-timing` ブランチには PR #54 と同じ内容のコミット（`bee884a`）が残っている。PR #54 がマージされたら消してよい
- 別タスク: お客様画面のカテゴリータグが英字スラッグのまま出る不具合（spawn_task 済み）
- 未使用の Supabase プロジェクト `good-order-yorkys-shukugawa`（MICRO）を残すか消すかの判断（天真）
