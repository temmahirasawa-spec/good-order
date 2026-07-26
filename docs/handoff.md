# Orderly リデザイン作業 引き継ぎメモ

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

**重要: このリポジトリは最初のコミット（`6cd946f Initial commit from Create Next App`）以降、
一度もcommitされていない。** ここまでのリデザイン作業（客側・スタッフ側とも）は全て
working tree上の未コミット変更として存在する。ユーザーから明示的に指示されない限りcommitしない
（既存ルール通り）。

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

## 次にやること

`prompts/`配下の未消化プロンプトは無い。ユーザーから次の指示を受け取るか、
下記の積み残しを片付ける。

### 既知の挙動（未修正）
- 厨房画面で同じ品目を連続クリックすると2回目が競合扱いになる（楽観ロックの
  `updated_at` がローカルで更新されないため）。3秒のポーリングを待てば通る。
  実運用で連打する場面は少ないが、既知の挙動として記録

### 積み残し
- 編集パネルで画像をアップロードしたあと保存せずキャンセルすると、
  アップロード済みオブジェクトがStorageに残る（カテゴリ・メニュー共通の既存挙動）
- `Color Swatch Picker` のFigma説明文は「黒い外枠+チェック」だが実描画は外枠のみ。
  外枠のみで実装している（要確認）
- カテゴリ管理PCの「表示順バッジ」はFigmaにPC版コンポーネントが無いため推定実装。
  PCテンプレートを入手できたら要突き合わせ

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
  - 恒久対策の候補（未実施・ユーザー判断待ち）:
    1. Dropboxの選択型同期で `.next` を除外する
    2. `.next` をDropbox外へのシンボリックリンクにする
       （`rm -rf .next && ln -s /tmp/orderly-next .next`）
- **本番ビルド直後にdevサーバーを起動すると`/dev/ui`等が500になる**（`.next`の成果物が
  production用のまま）。dev起動前にも`rm -rf .next`すること。
- dev稼働中にも`Cannot find module './948.js'`系のチャンク欠落で500になることがある。
  同じく dev停止 →`rm -rf .next`→ dev再起動で直る。
- devサーバーのログは`/tmp/orderly-dev.log`。

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
