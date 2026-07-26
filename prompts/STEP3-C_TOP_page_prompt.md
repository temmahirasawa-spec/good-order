# Step 3-C: TOPページ（/order）の実装

Step3-A（トークン統合・データ層・ルーティング）、Step3-B（共通コンポーネントのReact化）が完了した前提で、
いよいよ新デザインの本丸である**TOPページの組み立て**をお願いします。

Figma参照: UTUTUファイル `KGPuY4YVRQW6BMRrulBaFN` / TOPフレーム node `32:4`
（フード7・ドリンク4の全11サブカテゴリを縦に並べた構成。Figma上には型として3カテゴリ分＋Best Seller枠のみ実体があり、
残りはこのプロンプトの仕様に従ってコードでループ生成する想定です）

---

## 1. ページ構成（上から順）

1. **Header Icon Button**（ハンバーガーメニュー等、既存のHeader機能をそのまま使用）
   - Figma上ではTab Navと座標が重なって配置されていましたが、これは配置ミスの可能性が高いです。
     実装では独立した行として、Tab Navより上に配置してください（現在本番で使っている
     ヘッダーの挙動・タップ時の遷移先はそのまま踏襲でOKです）
2. **Tab Nav**（ジャンプナビ、scrollspy方式）
   - タブ構成: 「おすすめ」+ 11サブカテゴリ = 計12タブ
     `おすすめ, パンケーキ, フレンチトースト, エッグベネディクト, サンドイッチ, フリッター,
     バーガー, ランチ, コーヒー, 紅茶, ソフトドリンク, アルコール`
   - クリックで該当セクションへスムーズスクロール（`scrollIntoView({behavior:'smooth', block:'start'}`
     など）。各セクションに `id="section-{subcategory}"`（おすすめは `section-best-seller`）を付与
   - スクロール位置に応じて現在地のタブをハイライト（`IntersectionObserver` でどのセクションが
     ビューポート上部に来ているか判定し、対応タブに active スタイルを当てる）
   - 横スクロール・二層構造（外側 overflow-x-auto、内側に左右 `space-16` を持つContentラッパー）は
     Step3-Bで作成済みの `TabNav` コンポーネントの仕様通り
3. **Filter Bar**
   - 「カスタマイズ」固定＋「アレルギー」「ニガテな食材」「受け取り方法」のFilterChip
   - 今回のStepでは**見た目の実装のみでOK**です。タップ時のフィルタリングロジック（実際に
     メニューを絞り込む処理）は別Stepで対応するので、モーダルやドロワーを開く導線だけ
     用意しておいてください（中身は空でも仮でも構いません）
4. **Video / 16:9** ヒーロー動画枠（既存の動画コンポーネントをそのまま利用）
5. **Best Seller セクション**（Menu Section Wide、カテゴリ横断）
   - 見出し: eyebrow「人気ランキング殿堂入り！長く愛されるメニュー」/ EN「Best Seller」/ JP「ベストセラー」
   - データ: 既存の `computeTopItems()`（サブカテゴリ絞り込みなしの全体版、直近14日注文数順→
     `人気`タグで補完）を流用し、上位8件程度を取得
   - 表示: `MenuCardWide` を `MenuCarouselWide` で横スクロールカルーセル表示
     （Step3-Bの仕様通り、2枚目以降がわずかにはみ出す見せ方が正解です）
6. **Menu Section ×11**（フード7→ドリンク4の順で縦に並べる）
   - 各セクションは同一パターンのループ生成:
     - 見出し（eyebrow / EN名 / JP名の3行、下記2章の文言を使用）
     - `computeTopItemsBySubcategory(items, subcategory, 4)` で取得した4件を
       2×2グリッドで `MenuCard` 表示
     - `SeeMoreButton`（ラベル「{JPカテゴリ名}をもっと見る」、遷移先 `/order/{subcategory-slug}`）
   - サブカテゴリの並び順・slug:
     `pancake, french_toast, eggs_benedict, sandwich, fritter, burger, lunch,`
     `coffee, tea, soft, alcohol`

---

## 2. 見出しコピー（eyebrow / EN / JP）

パンケーキは確定済み、それ以外は天真さんのトーンで下書きした**ドラフト**です。
そのまま使ってもOKですし、自由に編集してから実装に反映してください
（Claude Code側では固定文言としてハードコードで構いません。将来CMS化する場合は別途）。

| サブカテゴリ (slug) | eyebrow | EN | JP | ステータス |
|---|---|---|---|---|
| pancake | これがYORKYSの原点！看板メニュー | PANCAKE | パンケーキ | 確定 |
| french_toast | 外はさくっ、中はとろける贅沢な一皿 | FRENCH TOAST | フレンチトースト | ドラフト |
| eggs_benedict | とろ〜りソースが自慢の、休日の主役 | EGG BENEDICT | エッグベネディクト | ドラフト |
| sandwich | 片手で頬張る、忙しい朝のご褒美 | SANDWICH | サンドイッチ | ドラフト |
| fritter | サクッと軽い、箸が止まらない一品 | FRITTER | フリッター | ドラフト |
| burger | ボリューム満点、がっつり派に人気 | BURGER | バーガー | ドラフト |
| lunch | お腹も心も満たす、しっかりごはん | LUNCH | ランチ | ドラフト |
| coffee | 豆から届ける、香り高い一杯 | COFFEE | コーヒー | ドラフト |
| tea | ゆったり時間のお供に、香り豊かな一杯 | TEA | 紅茶 | ドラフト |
| soft | 食事と一緒に、すっきり爽やかに | SOFT DRINK | ソフトドリンク | ドラフト |
| alcohol | 乾杯はここから、大人のひととき | ALCOHOL | アルコール | ドラフト |

※ Figma上ではエッグベネディクトのeyebrowがパンケーキと同一文言のままコピペされていた
バグがあったため（Figma側は修正済み）、実装では上表の文言を正としてください。

---

## 3. 使用コンポーネント（Step3-Bで作成済み）

- `TabNav`（12タブ、scrollspy対応）
- `FilterBar` / `FilterChip`
- 既存の `Video` コンポーネント
- `MenuCarouselWide` + `MenuCardWide`（Best Seller用）
- `MenuCard` + 2×2グリッドラッパー（11セクション共通）
- `SeeMoreButton`
- `QuantityStepper` / `AddToCartButton`（MenuCard内のカート操作、既存カートstateと連携）

---

## 4. データ取得

- `useOrderPageData()` から返る `categorySections`（またはStep3-Aで確認した全件データ）を使い、
  `computeTopItemsBySubcategory(items, subcategory, 4)` で11回ループ
- Best Sellerセクションのみ、サブカテゴリ絞り込みなしの `computeTopItems()` を別途呼び出し
- 上記データ取得方針が実際のフック実装と食い違う場合（例: `categorySections` の形が想定と違う等）は、
  無理に合わせず現状の実装に即した形で進めてください。その場合は変更点を一言報告してもらえれば十分です

---

## 5. 実装上の注意

- 11セクション＋Best Sellerで縦にかなり長いページになるため、画像の遅延読み込み（`next/image` の
  `loading="lazy"`、Best Seller以外）を意識してください
- カートへの追加（`QuantityStepper` の増減）は、Product DetailやMenu画面と同じカートstate
  （Zustand等、既存のもの）にそのまま反映される想定です。新規state分割は不要です
- Tab Navのscrollspyは、セクション数が多い（12個）ため、`IntersectionObserver` の
  `rootMargin` を調整してヘッダー分のオフセットを吸収してください
- Filter Barのタップ動作（モーダル/ドロワーの中身）は空実装で構いませんが、
  タップして「何も起きない」ように見えないよう、簡単なプレースホルダー
  （「Coming soon」的な表示等）は入れておくと確認しやすいです

---

## 6. 確認したいこと（実装後にフィードバックがあれば）

- Header Icon Buttonの現状のタップ挙動（何を開くか）はそのまま踏襲で問題ないか
- Best Sellerの「上位8件」という件数は今のデータ量的に妥当か（メニュー総数が少ない場合は
  件数を減らす調整が必要かもしれません）
