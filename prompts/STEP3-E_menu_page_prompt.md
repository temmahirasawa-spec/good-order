# Step 3-E: Menuページ（全カテゴリ＋クイックリンク）実装 ＋ ハンバーガー導線の差し替え

天真さんの判断により、ハンバーガー（≡）の遷移先を **AppDrawer → このMenuページ** に
置き換えます。履歴（履歴一覧）機能はこのMenuページには含めません。

---

## A. ハンバーガー導線の差し替え

- 対象: `OrderHeader`（TOPページ）／ Product Detail画面の浮遊HeaderIconButton
  （Step3-D報告のとおり「Aと共有」のロジックなので、OrderHeader側を直せば両方に反映されるはずです）
- 変更前: タップでAppDrawer（`underHeader`バリアント）を開閉トグル
- 変更後: タップで `/order/menu`（本Stepで新規実装するMenuページ）へ遷移
- **スコープ外の注意**: カテゴリ一覧・カート・履歴・テイクアウト管理などの
  **旧デザインのページ（既存`Header.tsx`使用）は今回変更しないでください**。
  そちらは引き続きAppDrawer（`standalone`バリアント）のままでOKです
- 結果として`OrderHeader`はシンプルになるはずです。Menuページ自身の中でレンダリングする
  場合は`Header/Close`相当（×、タップで戻る）、それ以外のページでは`Header/Open`相当
  （☰、タップで`/order/menu`へ）を出すだけで、内部にopen/close stateを持つ必要は
  無くなります
- `AppDrawer`の`underHeader`バリアントが本Stepの変更で使われなくなる可能性があります。
  使用箇所が本当に無くなった場合、残すか削除するかはお任せします（判断だけ一言報告してください）

---

## B. Menuページ本体（`/order/menu`）

Figma参照: `Menu`（390×844, node `118:524`）

### 構成（上から順）

1. **ヘッダー**: `Header/Close`相当（×タップで前の画面に戻る = `router.back()`。
   遷移元が無い場合は`/order`へフォールバック）
2. **フードカテゴリ**: 見出し（EN「FOOD CATEGORY」/ JP「フード」）+
   `Menu Category Card` ×7（`Size=Large`171px ×2列×2行 + `Size=Small`114px ×3列×1行）
   - 並び順: `pancake, french_toast, eggs_benedict, sandwich, fritter, burger, lunch`
     （TOPページ・DBの`display_order`と同じ並びに揃えています。Figma実物は
     `french_toast`と`eggs_benedict`の順が入れ替わっていましたが、TOPとの一貫性を
     優先してこちらを正としました）
3. **ドリンクカテゴリ**: 見出し（EN「DRINK CATEGORY」/ JP「ドリンク」）+
   `Menu Category Card` ×4（`Size=Large` 2列×2行）
   - 並び順: `coffee, tea, soft, alcohol`
4. **リンク**: `Link Button` ×4（2列×2行）
   - 「トップへ戻る」→ `/order`
   - 「スタッフを呼ぶ」→ 既存の`StaffCallSheet`を開く
   - 「テイクアウト」→ 既存のテイクアウトページへ遷移（既存挙動のまま）
   - 「店舗情報」→ 既存の`StoreInfoModal`を開く
5. **Bottom View Cart Bar**（既存コンポーネント、node `173:156`）:
   「カートを見る」→ 既存のカート画面へ遷移

### Menu Category Cardのタップ動作
- 各カードタップで `/order/{subcategory-slug}`（Category Listing）へ遷移。
  TOPの`SeeMoreButton`と同じ遷移先です

### データ
- `Menu Category Card`の背景画像はカテゴリごとの代表写真です。`categories`テーブル等に
  既にカテゴリ単位の画像フィールドがあればそれを使用してください。無ければ、各カテゴリの
  最初の商品（`display_order`順1件目）の画像を仮の代表写真として使う形で構いません
  （その場合はどちらを採用したか一言報告してください）

---

## 確認したいこと（実装中に判断できれば、報告だけで大丈夫です）

1. カテゴリ代表画像のデータソース（Bセクション末尾参照）
2. `AppDrawer`の`underHeader`バリアントの要否（Aセクション末尾参照）
