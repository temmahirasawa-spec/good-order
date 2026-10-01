# supabase/ — SQLの流し方

このディレクトリのSQLは**1機能1ファイル**で、追加された順に積み上がっている。
新しい店舗のSupabaseプロジェクトを立ち上げるときは、**下の順番どおりに**
Supabase ダッシュボード → SQL Editor に1本ずつ貼って実行する。

**順番を守ること。** 後のファイルは前のファイルが作ったテーブルに列を足したり、
前のファイルが作ったポリシーを差し替えたりしている。順番を飛ばすと
「テーブルが存在しません」で止まる。

1本ずつ流すのは、途中で止まったときにどこで止まったか分かるようにするため。
全部を1回で貼らないこと。

---

## 流す順番

| # | ファイル | 何をするか |
|---|---|---|
| 1 | `setup.sql` | 土台。stores / categories / menu_items / orders / order_items を作る |
| 2 | `takeout.sql` | テイクアウト対応。orders と menu_items に列を足す |
| 3 | `staff_calls.sql` | スタッフ呼び出し（店員を呼ぶボタン）のテーブル |
| 4 | `staff_foundation.sql` | スタッフ側の土台。stores / orders / order_items / staff_calls に列を足す |
| 5 | `staff_role_rls.sql` | 権限分離。kitchen / register / manager で見える範囲を分ける |
| 6 | `tables_qr.sql` | 卓と二次元コード。table_categories / tables を作る |
| 7 | `table_label_v2.sql` | 卓ラベルを「テーブル A-1」形式にする |
| 8 | `history_rls.sql` | 注文履歴をお客様側から読めるようにする |
| 9 | `orders_anon_lockdown.sql` | ↑で開けすぎた読み取りを塞ぐ。**8とセットで必ず流す** |
| 10 | `pickup_no.sql` | 受渡番号（日次リセットの連番） |
| 11 | `print_jobs.sql` | 厨房伝票の印刷待ち行列 |
| 12 | `printer_status.sql` | プリンタの生存記録と刷り直し |
| 13 | `order_insert_rpc.sql` | 注文登録のRPC（`place_order`）。**これが無いと注文が保存されない** |
| 14 | `categories_type.sql` | カテゴリに food / drink の区分を足す |
| 15 | `category_tag_color.sql` | カテゴリのタグ色をDB管理にする |
| 16 | `menu_videos.sql` | 動画メニュー。`menu-videos` バケットを作る |
| 17 | `menu_media_gallery.sql` | 画像ギャラリー（最大5枚） |
| 18 | `menu_media_order.sql` | メディアの並び替え |
| 19 | `order_items_cooking_status.sql` | 品物ごとの調理ステータス |
| 20 | `order_items_update_rls.sql` | ↑を厨房画面から更新できるようにする。**19の後** |
| 21 | `list_reorder.sql` | 一覧のドラッグ並び替えを保存する |
| 22 | `best_sellers.sql` | トップページの「Best Seller」枠 |
| 23 | `store_media.sql` | トップページの動画スロット |
| 24 | `store_display_settings.sql` | 背景タイプ（色 / 画像 / 動画）の設定。**23の後** |
| 25 | `table_layout_guard.sql` | 席設定の保存に安全弁（全卓が一度に消えるのを防ぐ）。**6の後** |
| 26 | `category_heading.sql` | カテゴリー見出し（説明文・英語名・サイズ）をDB管理に。**15の後** |
| 27 | `serving_timing.sql` | 提供タイミング（でき次第 / 先出し / 食後）と伝票の2枚出し。**26の後**。ドリンク区分の補正も含む |
| 28 | `menu_item_options.sql` | メニューのオプション（トッピング）。`place_order` / `claim_print_job` を差し替える。**27の後** |
| 29 | `sold_out.sql` | 売り切れ（`menu_items.is_sold_out`）。`place_order` を差し替えて売り切れの商品を弾く。**28の後** |
| 30 | `receipt_copies.sql` | 伝票の枚数（`stores.receipt_copies`: 1枚 / 毎回2枚 / 両方あるときだけ2枚）。`claim_print_job` を差し替える。**28の後** |
| 31 | `category_list_style.sql` | カテゴリーの一覧の見せ方（`categories.list_style`: 写真カード / 文字リスト / 自動）。**26の後** |
| 32 | `category_subcategories.sql` | サブカテゴリー（`categories.parent_id` で親子の2階層に）と、トップの各区画に出す件数（`categories.top_limit`）。**26の後** |
| 33 | `store_brand_accent.sql` | ブランドカラー（お客様画面のアクセント色。`stores.brand_accent`）。**22の後** |
| 34 | `set_drink_discount.sql` | セットドリンク割引（食事と一緒のドリンクを割り引く。`stores.set_drink_*` / `orders.discount_amount`）。`place_order` を差し替え、金額をサーバーで計算し直す。**29の後** |
| 35 | `pickup_completed.sql` | 受け渡した時刻を会計とは別の欄に持つ（`orders.picked_up_at`）。会計済みのテイクアウトが受渡画面から消える穴を塞ぐ。**19の後** |
| 36 | `tax_mode.sql` | 消費税（内税 / 外税、店内10% / テイクアウト8%。`stores.tax_*` / `orders.tax_amount`）。`place_order` を差し替える。**34の後** |
| 37 | `store_info_and_staff_calls.sql` | 店舗情報（写真・住所・営業時間など）と、スタッフ呼び出しの項目（`staff_call_options`）を店舗側から設定できるようにする。**5の後** |
| 38 | `feature_toggles.sql` | 厨房画面とスタッフ呼び出しを使うかどうか（`stores.kitchen_enabled` / `staff_call_enabled`）。**37の後** |
| 39 | `store_info_rows.sql` | 店舗情報の項目を自由に足し引きできるようにする（`stores.info_rows`）。37 で入れた住所などを移し替える。**37の後** |
| 40 | `order_stale_table_id.sql` | 作り直された卓（行が消えた卓）からの注文も通す。`place_order` を差し替える。**36の後**（ファイルに「前提:」が無いが、中で 34・36 の関数を呼ぶ） |
| 41 | `print_jobs_recovery.sql` | 印刷に失敗した伝票の自動復帰と、「追加(N)」の数え方を厨房・レジと揃える。11 が作った印刷の関数3つを差し替える。**40の後** |
| 42 | `set_drink_table_scope.sql` | セットドリンク割引を「同じ卓の会計前の注文ぜんぶ」で数える。`place_order` を差し替える。**40の後** |
| 43 | `register_edit.sql` | レジの会計画面で伝票を直す（明細を消す / 伝票ごと消す）。金額を作り直す `recalc_bill_totals` も作る。**42の後** |
| 44 | `order_server_pricing.sql` | 注文の値段をサーバーで決める。`place_order` を差し替え、お客様の端末が送った値段を使わず `menu_items.price` から計算する。**43の後** |

31〜33 は 29・30 より先（2026-09-08）にリポジトリに入ったが、表への記載が漏れていたので後ろに付けた。
29・30 とは触る物が重ならないので、この順で流してよい。
1〜44 をこの順で空のデータベース（手元の練習用。Supabase ではない）に流し、最後まで止まらないこと、
上書きされる関数には最後のファイルの中身が残ることを 2026-10-01 に確かめた。

### 順番が特に効くところ

- **8 → 9** … `history_rls.sql` は注文をお客様に見せるため anon（ログイン無し）に
  読み取りを開ける。ただし開け方が広すぎて、ログイン無しで全卓の注文内容と金額が
  読める状態になる。`orders_anon_lockdown.sql` がそれを必要な範囲まで狭める。
  **8を流したら必ず9も流すこと。** 8で止めると個人情報こそ無いものの、
  売上と注文内容が誰にでも見える。
- **19 → 20** … 列を作ってから、その列を更新する権限を開ける。
- **23 → 24** … テーブルを作ってから、そのテーブルに列を足す。
- **11 → 12、11 → 13** … 印刷まわりは `print_jobs.sql` が土台。
- **13 → 27 → 28 → 29 → 34 → 36 → 40 → 42 → 44** … 注文を登録する `place_order` は、この9本が順に上書きしている
  （＝同じ名前の関数を、後のファイルが丸ごと置き換える）。**最後に流したものだけが残る**ので、
  順番を入れ替えても**エラーは出ずに**古い中身が残る。例: 36（税）をいちばん最後に流すと、
  卓単位のセットドリンク割引、作り直された卓からの注文の救済、値段のサーバー計算（44）が消える。
  伝票を取り出す `claim_print_job`（11 → 27 → 28 → 30）と、41 が差し替える印刷の関数3つ（11 → 41）も同じ。

### 新規プロジェクトでは読み飛ばしてよい注意書き

`tables_qr.sql` の冒頭に「STEP 0 の確認クエリを先に実行し、影響件数を
確かめてから」とある。これは**既に卓データが入っているDBに後から流す場合**の注意で、
まっさらな新規プロジェクトでは該当しない。そのまま最後まで流してよい。

---

## SQLを流し終わったあとにやること

SQLだけでは動かない。以下はSupabaseの画面かアプリ側での作業。

### 1. Storage のバケットを確認する

バケットはSQLの中で作られるので、原則そのままでよい。念のため Storage の画面で
2つとも「Public」で存在することを確認する。

| バケット | 作るファイル | 中身 |
|---|---|---|
| `menu-images` | `setup.sql` | メニュー写真 |
| `menu-videos` | `menu_videos.sql` | メニュー動画・トップページの動画 |

名前はアプリ側の `lib/storage.ts` に定数として書いてあるので、**変えないこと**。

### 2. スタッフのアカウントを作る

Authentication → Users から追加し、各ユーザーの
**app_metadata** に役割を入れる（`user_metadata` ではない。間違えると権限が効かない）。

```json
{ "role": "manager" }
```

役割は3つ。`staff_role_rls.sql` がこの値を見て、見える範囲を分けている。

| 役割 | できること |
|---|---|
| `kitchen` | 厨房画面。調理ステータスの更新 |
| `register` | レジ。会計（`paid`）にできる |
| `manager` | 全部。メニュー・卓・表示設定の管理 |

**金額と会計に関わる権限（`paid`）は `register` と `manager` だけ。**
ここを緩めないこと。

### 3. 店舗レコードを1件入れる

`stores` テーブルが空だと、お客様側のトップページが何も表示しない。

### 4. アプリ側の環境変数

Vercel のプロジェクト設定に以下を入れる。`SUPABASE_SERVICE_ROLE_KEY` を
入れ忘れると**厨房伝票が1枚も印刷されない**（`/api/print` が503を返す）。

詳細は `.env.local.example` を参照。

---

## 既存プロジェクトへの追加

新しい機能でSQLが必要になったら、**このディレクトリに新しいファイルを足す**。
既存のファイルは書き換えない（既に流したDBとの差分が分からなくなるため）。
足したら、この表の末尾に1行追加すること。番号は続きから振り、ファイル冒頭の「前提:」
（先に流しておくファイル）のうち、いちばん後ろの番号を「**Nの後**」に書く。
「前提:」は新しいファイルに必ず書く（無いと、ここに書く番号を中身から調べ直すことになる）。
