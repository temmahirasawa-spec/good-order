# 売り切れ（SOLD OUT）の表示と、伝票の枚数の設定

**状態: 確定（2026-09-12、天真の決定「A で進めて OK」）。本番反映済み（PR #68、SQL 2本適用済み）。Figma 反映済み（10章）。**
決定の記録は末尾「9. 決めてほしいこと」。洋輔さん向けの共有資料は `docs/share/2026-09-12-sold-out-and-receipt-copies.html`。

---

## 1. 何を作るか（2件）

| # | 依頼（洋輔さん） | 作るもの |
|---|---|---|
| ① | モバイルオーダーの画面に残したまま「SOLD OUT」の表記を出して、オーダーできないようにしたい（現状は表示自体を消すことしかできない） | 商品に「売り切れ」の状態を足す。お客様の画面には商品が残り、「SOLD OUT」と出て、カートに入れられない。管理画面「メニュー管理」から ON / OFF |
| ② | フードもドリンクもパンケーキも同じ1枚の伝票でいいので、1オーダーにつき同じ伝票を2枚出したい（毎回）。印刷状況のページから設定できるようにもしたい | 伝票の枚数を店舗の設定にする（1枚 / 毎回2枚 / フードとドリンクが両方あるときだけ2枚）。管理画面「印刷状況」の最下部で切り替え |

---

## 2. 用語と判定

| 用語 | 意味 | どこで決まるか |
|---|---|---|
| 公開 / 非公開 | 商品をお客様の画面に出すか。**非公開は商品ごと消える**（今までの「売り切れ」の代わり） | `menu_items.is_available`（既存） |
| 売り切れ | 商品は出したまま、注文だけできない状態 | `menu_items.is_sold_out`（**新設**） |
| 伝票の枚数 | 1回の注文で刷る枚数 | `stores.receipt_copies`（**新設**） |

- 「非公開」と「売り切れ」は別の操作。両方 ON なら非公開が勝つ（そもそも出ない）。
- 売り切れの判定は**最新のメニュー**で行う（カートに入れた後で売り切れになった商品も拾う）。
- 表記は洋輔さんの依頼どおり英語の **「SOLD OUT」** で統一する（帯・ピル・詳細の下部バー）。管理画面は日本語「売り切れ」。

---

## 3. お客様側の操作の流れ（①）

```
一覧（TOP / カテゴリー / テイクアウト）
  ├─ 売り切れの商品: 写真に「SOLD OUT」。ステッパー／「＋」／「カートに入れる」の代わりに押せないピル
  │     └─ タップすると商品詳細は開く（何が売り切れたかは見られる）。下部バーは「SOLD OUT」で押せない
  └─ 通常の商品: 今までどおり
                                                                      ▼
カート ─ 入れた後で売り切れになった行には「SOLD OUT」。行の削除はできる
       ─ 売り切れの行が1つでもあると「注文を確定する」が押せず、上に案内が出る
                                                                      ▼
注文の送信 ─ 画面側で止め、サーバー側（place_order）でも弾く（古い画面から届いた場合の最後の砦）
```

### 3-1. 一覧（Menu Card / Menu Card M / Menu Card Wide / Menu List Row / Recommend Card）
- 6 章の3案のどれか。中身は共通で、**「SOLD OUT」の文字が出る／操作部が押せなくなる**。
- 並び順・区画・タブは変えない。売り切れでも消えない（洋輔さんの依頼そのもの）。

### 3-2. 商品詳細（Product Detail）
- 写真の上に「SOLD OUT」の帯。写真の無い商品はタグの横に小さく。
- 下部バーはステッパーと「カートに入れる」の代わりに押せない「SOLD OUT」。

### 3-3. カート（Cart）
- 売り切れの行: 写真の色を抜いて帯、ステッパーの代わりにピル。提供タイミングの切替は出さない。削除はできる。
- 案内文（注文ボタンの上、赤字）: **「売り切れの商品が含まれています。カートから削除すると、ご注文いただけます。」**（9-3）
- 「注文を確定する」は押せない。
- サーバー側で弾かれたとき（売り切れにした直後に古い画面から送られた場合）の案内:
  **「売り切れになった商品が含まれているため、ご注文を送信できませんでした。カートから削除して、もう一度お試しください。」**（9-3）。メニューを取り直して、該当の行に「SOLD OUT」を出す。

### 3-4. 注文履歴の「同じ内容で注文」
- 売り切れの商品は再注文に入れない（非公開の商品と同じ扱い）。

---

## 4. 店舗側

### 4-1. 管理画面「メニュー管理」（①）
- 一覧の行: 価格の右に **「売り切れ」チップ**（PC / SP 共通）。押すと ON / OFF。ON は赤い地。押した瞬間に切り替わり（楽観的更新）、失敗したときだけ戻る。
- ON のときはサムネにも「SOLD OUT」の帯（お客様の画面と同じ見え方）。
- 編集パネル: 「公開する」の下にトグル **「売り切れにする」**。補足「注文画面に残したまま「SOLD OUT」と表示され、カートに入れられなくなります」。
- 公開トグルは今までどおり（隠したいときはこちら）。

### 4-2. 管理画面「印刷状況」（②）
- 最下部に **「伝票の設定」** の見出しと「伝票の枚数」のカード。3択:

| 選択肢 | 意味 | 伝票の見出し |
|---|---|---|
| 1枚 | 厨房用に1枚だけ | 「厨房伝票」 |
| **2枚（毎回）** | 同じ伝票を続けて2枚（**洋輔さんの依頼。初期データで YORKYS はこれ**） | 「厨房伝票 1/2」「厨房伝票 2/2」 |
| フードとドリンクが両方あるときだけ2枚 | 2026-09-04 からの現状。片方だけの注文は1枚 | 「厨房伝票 1/2」「ドリンク伝票 2/2」 |

- 押した瞬間に切り替わり、失敗したときだけ戻る。次の注文から効く（刷り直しにも同じ枚数で出る）。
- 変更できるロールは刷り直しと同じ **manager / kitchen / counter**（伝票を必要とする当事者が自分で変えられる。register は外す）。

### 4-3. 伝票（`lib/receipt.ts`）
- 何枚刷るかを `stores.receipt_copies` で分岐する。紙の中身は変えない。
- 「2枚（毎回）」の2枚目の見出しは「厨房伝票 2/2」（「ドリンク伝票」にしない。洋輔さんが「同じ伝票」と言っているため。9-5）。

### 4-4. 厨房・レジ・受渡画面
- 変更なし（売り切れの商品は注文に入らないので、画面に出る前に止まる）。

---

## 5. 状態の一覧（design-rules 2-2）

| 画面 | 状態 |
|---|---|
| 一覧のカード（3種）・文字の行・おすすめカード | 通常／売り切れ／売り切れ＋人気リボン（リボンは出さない）／サムネなしの行の売り切れ |
| 商品詳細 | 通常／売り切れ（写真あり）／売り切れ（写真なし） |
| カート | 通常／売り切れの行あり（注文ボタン停止・案内）／全行売り切れ／空 |
| 注文の送信 | 成功／画面側で止めた／サーバー側で弾かれた（案内＋メニュー取り直し） |
| 履歴の再注文 | 売り切れを除いて入る／全部売り切れで0件（既存の案内「再注文できる商品が見つかりませんでした」） |
| メニュー管理 | チップ OFF／ON／切替失敗（元に戻して alert）／編集パネルのトグル |
| 印刷状況 | 読み込み中／1枚／2枚／両方あるときだけ2枚／保存失敗（元に戻して赤字） |

---

## 6. 「SOLD OUT」の見せ方 3案（器だけを変える。中身は同じ）

中身（共通）: 「SOLD OUT」の文字、操作部（ステッパー／＋／カートに入れる）は押せない、タップで詳細は開ける、並びは変えない。
たたき台: `.claude/verification/2026-09-12-sold-out/sold-out-3plans.html`（同 `.png`）。Figma 連携がこのセッションでは未認証のため HTML で出した（2026-09-04 と同じ進め方）。

| 案 | 器 | 写真 | 操作部 | 文字の行（写真なし） | 強い店舗・状況 |
|---|---|---|---|---|---|
| **A 帯** | 写真の色を抜いて、真ん中に墨の帯「SOLD OUT」 | 色が抜けて沈む | 押せないグレーのピル「SOLD OUT」 | 「＋」の代わりにピル（サムネがあれば小さい帯も） | 数量限定・日替わりが多い店。遠目でも一目で分かる。**YORKYS 向き（AI推奨）** |
| B 角のタグ | 写真はそのまま。左上に小さな墨のタグ「SOLD OUT」（人気リボンの位置） | そのまま | 同じピル | 名前の横に小さなタグ | 写真の魅力を保ちたい店。「また今度」を促す。ただし2列のグリッドでは見落としやすい |
| C 操作部だけ | 写真も文字もそのまま。操作部が枠線だけのピル「SOLD OUT」に変わる | そのまま | 枠線のピル | 同じ | 変更が最小。写真なしの文字メニュー主体の店なら A と同じ見え方 |

AI の推奨: **A**。洋輔さんの「表記を出す」は"分からせたい"という意味なので、写真を薄くして帯を通すのがいちばん確実。B は見落とすと「押しても入らない」の混乱になり、C は写真カードで弱い。
**実装は A で入れてある。** B / C に変えるのは `components/ui/SoldOut.tsx` と各カードの帯の位置を変えるだけ（1〜2時間）。

---

## 7. データの形（DB スキーマの変更。天真の確認が要る）

| ファイル | 変更 |
|---|---|
| `supabase/sold_out.sql` | `menu_items.is_sold_out boolean NOT NULL DEFAULT false`。`place_order()` を差し替え、売り切れの商品を含む注文を拒否（DETAIL `sold_out`） |
| `supabase/receipt_copies.sql` | `stores.receipt_copies text NOT NULL DEFAULT 'two_if_mixed'`（CHECK: one / two / two_if_mixed）。初期データで YORKYS を `two`。`claim_print_job()` を差し替えて `receiptCopies` を返す。`save_receipt_copies(p_mode)` RPC（manager / kitchen / counter） |

- RLS は触らない。anon の権限も増やさない。売り切れの切替は公開トグルと同じ経路（authenticated の UPDATE）。
- どちらの SQL も流しただけでは挙動が変わらない（既定値が現状）。ただし YORKYS の初期データ `two` は、マージ後に「毎回2枚」になる。
- **流す順番: SQL → マージ**。アプリ側は新しい列を前提に SELECT する。

---

## 8. 実装の範囲（触る場所）

| 場所 | 変更 |
|---|---|
| `lib/soldOut.ts`（新規） | 文言・判定・エラー判定を1か所に |
| `lib/receiptCopies.ts`（新規）/ `lib/receiptCopiesApi.ts`（新規） | 枚数の辞書と型 / 読み書き |
| `components/ui/SoldOut.tsx`（新規） | `SoldOutBand`（帯）と `SoldOutPill`（押せないピル）。sm / md / lg |
| `components/admin/print/ReceiptCopiesCard.tsx`（新規） | 印刷状況の設定カード |
| `lib/menu.ts` / `lib/api.ts` | `MenuItem.isSoldOut`。取得列に `is_sold_out` |
| `lib/store.ts` | `addItem` で弾く。`placeOrder` で最新メニューを見て止める。サーバー側の拒否を `"sold_out"` として返す |
| `components/ui/MenuCard.tsx` / `MenuListRow.tsx` / `RecommendCard.tsx` / `CartItemRow.tsx` / `components/order/ItemDetailOverlay.tsx` | 帯とピル |
| `app/cart/page.tsx` | 売り切れの行の判定、案内、ボタン停止、メニューの購読 |
| `app/history/page.tsx` | 再注文から売り切れを除く |
| `hooks/useOrderPageData.ts` | `handleAdd` で弾く |
| `components/admin/menu/AdminMenuRow.tsx` / `app/admin/(protected)/menu/page.tsx` | 「売り切れ」チップと編集パネルのトグル |
| `app/admin/(protected)/print/page.tsx` | 「伝票の設定」 |
| `lib/receipt.ts` | `receiptCopies()` を設定で分岐 |
| `components/admin/display/BestSellerPanel.tsx` | 注記の文言（売り切れは残る） |
| `app/dev/ui/page.tsx` | 各状態のギャラリー |

---

## 9. 決めてほしいこと（2026-09-12 に天真が決定した記録）

天真の回答は「A で進めて OK。マイグレーション、マージも」。2〜7 は異論なしとして、実装済みの内容で確定。

1. **「SOLD OUT」の器**: **A 帯（決定）**／ B 角のタグ／ C 操作部だけ
2. **売り切れの商品のタップ**: 詳細を開ける（推奨。何が売り切れたか見られる）／ 開かない
3. **お客様に見える文言**（3-3 の2文）: このままでよいか
4. **管理画面の操作場所**: メニュー管理の行のチップ＋編集パネルのトグル（実装済み）。厨房画面からも切り替えたいなら別途（厨房ロールはメニュー管理を開けないため）
5. **「2枚（毎回）」の2枚目の見出し**: 「厨房伝票 2/2」（実装済み）／ 「ドリンク伝票 2/2」のまま
6. **枚数を変えられるロール**: manager / kitchen / counter（実装済み。刷り直しと同じ）／ manager だけ
7. **初期データ**: SQL で YORKYS を「2枚（毎回）」にする（実装済み。依頼どおり）／ SQL では変えず管理画面で切り替える

## 10. Figma（2026-09-12 に起こし済み）

決定後、同じ日に `use_figma` で起こした。方針: **既存の共通部品には手を入れず、複製した「(Sold Out)」部品を足す**
（design-rules 6 の「共通部品に子を挿入すると既存インスタンスの上書きがずれる」を避けるため。Cart Item Row (Timing) と同じやり方）。

| 場所 | 追加したもの |
|---|---|
| Components / 04 Tags & Steppers | `Sold Out Band`（Size=SM 56 / MD 200 / LG 390。surface/ink の帯、白抜き「SOLD OUT」）、`Sold Out Pill`（Size=SM 32 / MD 36 / LG 52。bg/tertiary 地に text/tertiary） |
| Components / 05 Cards | `Menu Card M (Sold Out)` `Menu Card (Sold Out)` `Menu Card Wide (Sold Out)` `Recommend Card (Sold Out)` `Cart Item Row (Sold Out)` `Menu List Row (Sold Out)`（Thumb=None / Image）。写真の上に Dim（surface/white 60%）＋ Band、操作部は Pill。人気リボンは出さない。Category Tag は部品のインスタンスに置き換えた |
| Components / 08 Bottom Bars | `Bottom Detail Bar (Sold Out)`（ステッパーと CTA の代わりに Pill LG） |
| Components / 12 Staff / Lists & Rows | `Sold Out Chip`（State=Off / On）、`Admin Menu Row (Sold Out)` `Admin Menu Row (Mobile) (Sold Out)`（BOOLEAN `Sold Out` でサムネの帯を出し分け）、`Edit Button`（SP 行の編集ボタンを部品化。生フレームの違反を増やさないため） |
| Components / 21 Staff / Print Status（新設） | `Setting Radio Row`（State=Default / Selected、Label / Description）、`Receipt Copies Card`、`Printer Health Card`（State=OK / Offline）、`Print Job Row`（Status=Pending / Done） |
| MobileOrder / 注文 / SP | `TOP — 売り切れ`（パンケーキの1枚目と、ドリンクの1行目が売り切れ）、`Product Detail — 売り切れ`、`Cart — 売り切れ`（赤い案内＋ボタン 40%） |
| MobileOrder / Menu Management | PC `Template / Menu Management — 売り切れ 1180x820`（1行目 ON、他は OFF のチップ。編集パネルに「売り切れにする」）、SP `Menu Management — 売り切れ — Mobile 390` / `Menu Item Editing — 売り切れ — Mobile 390` |
| MobileOrder / Print Status / 印刷状況（新設） | PC `Template / Print Status 1180x820`、SP `Print Status — Mobile 390`（テイクアウト受け渡しのテンプレートを土台に、プリンタ状態・出ていない伝票・最近印刷した伝票・伝票の設定） |

`npm run design:figma`: **構造・パディング 全ページ問題なし ／ 新しい違反なし・増えた違反なし**。
返済したもの: 02 Buttons & CTAs の右パディング（103→100）、Components の区画を 100px 間隔で並べ直し。

Figma で決めたこと（相談なしで決めた。覆せる）:
- `Sold Out Band` LG は EN/Display/S のまま（実装の tracking 8% は付けていない。テキストスタイルから外れるため）
- `Sold Out Chip` の左右余白は space/12（実装も 10px → 12px に揃えた）
- Menu Management SP の Filter Row の Admin Chip は、新しい画面では高さ 44（SP のタップ領域の規約。元の画面は 38 のまま）
- Nav Sidebar v2 に「印刷状況」の項目が無い（部品に子を足すと既存画面がずれるため触っていない）。印刷状況のテンプレートでは、どの項目も強調していない。別タスク
- 店舗の写真は、複製した画面では差し替えた行だけ元の写真を戻した（インスタンスを差し替えると写真の上書きが消えるため）

スクリーンショット: `.claude/verification/2026-09-12-sold-out/figma-*.png`。

---

_最終更新: 2026-09-12_
