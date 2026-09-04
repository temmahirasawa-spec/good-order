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

### 順番が特に効くところ

- **8 → 9** … `history_rls.sql` は注文をお客様に見せるため anon（ログイン無し）に
  読み取りを開ける。ただし開け方が広すぎて、ログイン無しで全卓の注文内容と金額が
  読める状態になる。`orders_anon_lockdown.sql` がそれを必要な範囲まで狭める。
  **8を流したら必ず9も流すこと。** 8で止めると個人情報こそ無いものの、
  売上と注文内容が誰にでも見える。
- **19 → 20** … 列を作ってから、その列を更新する権限を開ける。
- **23 → 24** … テーブルを作ってから、そのテーブルに列を足す。
- **11 → 12、11 → 13** … 印刷まわりは `print_jobs.sql` が土台。

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
足したら、この表の末尾に1行追加すること。
