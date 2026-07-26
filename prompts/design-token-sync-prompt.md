# Design Token 同期: 網羅チェックで見つかった未反映分の修正

Figma側でカラースタイル・テキストスタイルの網羅チェックを行い、抜けを修正しました。
コード側の対応するトークン/CSSにも同じ変更を反映してください。

## 1. 「人気」バッジのフォントサイズ変更

- 対象: MenuCard・MenuCardWide等の「人気」バッジテキスト
- 変更: 11px → **9px**（Noto Sans JP Bold）に変更してください
  （11px以下は基本使わない方針ですが、4文字のタグが入る可能性があるためここだけ例外です）
- 該当する既存CSSクラス/トークン名があれば、そこを直接変更してもらって構いません

## 2. 英字見出し用の中間トークン追加

現状、EN見出し系のfont-sizeが実質20px・24px・28px・40pxの4段階に分かれていました。
Figma側では以下のようにトークン化しています。CSS変数/Tailwindのfont-sizeトークン等、
対応する仕組みがあれば同様に整理してください。

| トークン名 | サイズ | フォント | 用途例 |
|---|---|---|---|
| `EN/Display/S` | 20px | Barlow Medium | Menu Category Cardの見出し（PANCAKE等） |
| `EN/Display/M` | 24px | Barlow Medium | Menuページの「FOOD CATEGORY」「DRINK CATEGORY」見出し |
| `EN/Display/L` | 28px | Barlow Medium | Category Listingページの見出し（PANCAKE等） |
| `EN/Display/XL` | 40px | Barlow Medium | TOPページの「Best Seller」「PANCAKE」等セクション見出し |

**注意**: `EN/Display/L`は今回名前が変わっています（旧: 40px → 新: 28px）。
旧`EN/Display/L`（40px）は`EN/Display/XL`に改名されました。コード側で
`EN/Display/L`という名前のクラス/変数を40px相当の場所に使っている場合は、
`EN/Display/XL`に置き換えるようお願いします。

## 3. 新規カラートークン `bg/warm` の追加

カート画面（`/cart`）の背景色・Bottom Summary Barの背景色に、既存のグレー系トークン
（`bg/secondary`等）には無い暖色（クリーム寄り）を使っていたため、新規トークンとして
`bg/warm`を追加しました。

- 値（YORKYSテーマ）: `#FCF7EE` 相当（r:0.988, g:0.969, b:0.933）
- Demo（Green）テーマ用の値も別途用意しています（`#F6F9F3`相当、r:0.965, g:0.976, b:0.953）
- 使用箇所: Cartページのルート背景、Bottom Summary Barの背景
- Bottom Summary Barの枠線は、新規トークンを増やさず既存の`border/divider`をそのまま
  使う形にしています（枠線側は変更不要です）

もしテーマ切り替え（YORKYS / Demo）の仕組みがコード側に既にあれば、`bg/warm`もその
仕組みに乗せる形で追加してください。無ければ通常のCSS変数として`#FCF7EE`を追加するだけで
大丈夫です。
