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

## Figma 検品の負債台帳（2026-08-04 時点・未返済 74件）

**この74件は「直したもの」ではない。1件も直っていない。**
`scripts/figma-check-baseline.json` に登録して、検品を緑にしているだけの
**未返済の負債**である。台帳は「ここから増えたら落とす」ための基準線であって、
返済が終わったことを意味しない。

- **合計 74件 / 40種類**（`total: 74` / `keys: 40`）
- 1種類が複数件あるので、種類の数と件数は一致しない
- 内訳は下の表のとおり。**要約せず1行ずつ載せてある。返済するときの作業リストとして使う**

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

> 変更前は「セクション名＋メッセージ」の**重複を除いて**記録していたため、
> 同じセクションに同じ名前のノードをいくつ足してもキーが同じで緑のまま通っていた。
> 74件を40エントリに畳んだ時点で、**34件ぶんの検出力が失われていた。**

### 内訳（40種類 / 74件）

| ページ / セクション | ノード名 | 違反の内容 | 件数 |
|---|---|---|---|
| Components / 00 Foundations | `Chips` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 11 Staff / Orders | `Action Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 2 |
| Components / 11 Staff / Orders | `Cancel Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 11 Staff / Orders | `Confirm Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 11 Staff / Orders | `Done Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 4 |
| Components / 12 Staff / Lists & Rows | `Add Seat Chip` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 12 Staff / Lists & Rows | `Delete Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| Components / 12 Staff / Lists & Rows | `Edit Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 2 |
| Components / 15 Staff / Tables & QR | `DL Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 15 Staff / Tables & QR | `More Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Components / 15 Staff / Tables & QR | `コピー Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| MobileOrder / Dashboard / ダッシュボード / PC | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Admin Chip` | の高さが 38px です（SPのタップ領域は44px以上） | 8 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Export Button` | の高さが 40px です（SPのタップ領域は44px以上） | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tab` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tab` | の高さが 30px です（SPのタップ領域は44px以上） | 3 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| MobileOrder / Dashboard / ダッシュボード / SP | `Tabs` | の高さが 30px です（SPのタップ領域は44px以上） | 1 |
| MobileOrder / Menu Management / メニュー管理 / SP | `Admin Chip` | の高さが 38px です（SPのタップ領域は44px以上） | 6 |
| MobileOrder / Register / レジ / SP | `Table Chip` | の高さが 42px です（SPのタップ領域は44px以上） | 5 |
| Website / 00 LP / メイン | `CTA` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| Website / 00 LP / メイン | `CTA Panel` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| Website / 00 LP / メイン | `SP State — 追従ヘッダー + タブナビ + CTAバー` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / 00 LP / メイン | `Staff Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 2 |
| Website / PC States / 03 Staff Screens | `Add Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Best Seller Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Category Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Checkout Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `CSV Export Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Print Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / PC States / 03 Staff Screens | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Add Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Best Seller Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Checkout Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Export Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Print Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Seat Settings Button` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| Website / SP States / 03 Staff Screens | `Tab` | が生のフレームで作られています。既存のコンポーネントを使ってください | 3 |
| Website / SP States / 03 Staff Screens | `Tabs` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |
| 居酒屋 / 01 Components / 居酒屋 | `cta` | が生のフレームで作られています。既存のコンポーネントを使ってください | 1 |

---

## 覚えておくべき運用ルール

### Figma MCPの使い方（重要・過去のメモを訂正）

**⚠ 旧メモの「画面テンプレートはこのファイルに存在しない」は誤りだった。** テンプレートは
全部 **MobileOrder ページ（`32:2`）** にある。`get_metadata`を引数なしで呼ぶと
Componentsページ（`46:16`）しか返らないが、これはツールの挙動の問題で、
実際のファイルには5ページある:

| ページ名 | node ID |
|---|---|
| Components | `46:16` |
| **MobileOrder（画面テンプレートは全部ここ）** | **`32:2`** |
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
- `npm run build`と`npm run dev`を同時に同じディレクトリで動かさない。
  ビルド前は必ず`lsof -ti:3000 | xargs kill -9`＋`pkill -9 -f "next dev"`で落としてから
  `rm -rf .next && npm run build`する。
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
