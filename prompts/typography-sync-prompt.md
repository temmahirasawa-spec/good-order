# typography.css の同期漏れを解消する

Pickup Cardの実装で `JP/Chip Label`（13px Bold）と `EN/Data/L`（20px）を生の任意値
（`text-[20px]`等）で書いてもらいましたが、これは`app/typography.css`に対応クラスが
無いことが原因の**トークン同期漏れ**です。

生の数値で散らばると、将来サイズを見直すときに一括変更ができず、トークン体系が
形骸化してしまいます。Figma側にある全27スタイルを`typography.css`に揃えてください。

---

## 1. Figmaの全テキストスタイル一覧（実測値）

以下がFigmaに登録されている全スタイルです。**`typography.css`に無いものを追加**し、
既にあるものは値が合っているか確認してください（ズレていればFigma側を正としてください）。

### 日本語（Noto Sans JP）

| スタイル名 | サイズ | ウェイト | line-height | letter-spacing |
|---|---|---|---|---|
| JP/Heading/XL | 22px | Bold | 130% | 0 |
| JP/Heading/L | 20px | Bold | 140% | 1% |
| JP/Heading/M | 17px | Bold | 140% | 1% |
| JP/Heading/S | 15px | Bold | 145% | 1% |
| JP/Body | 14px | Medium | 160% | 1% |
| JP/Body Bold | 14px | Bold | 160% | 1% |
| JP/Body Small | 13px | Medium | 150% | 1% |
| JP/Chip Label | 13px | Bold | 120% | 0 |
| JP/Caption | 12px | Medium | 150% | 1% |
| JP/Caption Bold | 12px | Bold | 150% | 1% |
| JP/Label | 11px | Medium | 140% | 2% |
| JP/Micro Label | 9px | Bold | 120% | 0 |

### 英数字（Barlow）

| スタイル名 | サイズ | ウェイト | line-height | letter-spacing |
|---|---|---|---|---|
| EN/Display/XL | 40px | Medium | 110% | 0 |
| EN/Display/L | 28px | Medium | 120% | 0 |
| EN/Display/M | 24px | Medium | 120% | 0 |
| EN/Display/S | 20px | Medium | 120% | 0 |
| EN/Price/L | 22px | SemiBold | 120% | 0 |
| EN/Price/M | 17px | SemiBold | 120% | 0 |
| EN/Price/S | 14px | SemiBold | 120% | 0 |
| EN/Data/XL | 28px | SemiBold | 120% | 0 |
| EN/Data/L | 20px | SemiBold | 120% | **2%** |
| EN/Data/M | 15px | SemiBold | 120% | 0 |
| EN/Data/S | 13px | SemiBold | 120% | **2%** |
| EN/Data/XS | 11px | SemiBold | 110% | 0 |
| EN/Data/2XS | 9px | SemiBold | 110% | 0 |
| EN/Label | 12px | Medium | 120% | **4%** |
| EN/Wordmark | 16px | SemiBold | 120% | **4%** |

命名規則は既存の`type-jp-*` / `type-en-*`に合わせてください
（例: `JP/Chip Label` → `type-jp-chip-label`、`EN/Data/L` → `type-en-data-l`）。

---

## 2. 既存の生の数値指定を置き換える

`typography.css`にクラスが揃ったら、**それが理由で任意値になっていた箇所**を
新しいクラスに置き換えてください。少なくとも以下は該当します。

- Pickup Cardヘッダー: ラベル→`type-jp-chip-label`、番号→`type-en-data-l`

他にも「Figmaのスタイル名は分かっているのにクラスが無くて`text-[Npx]`で書いた」箇所が
あれば、あわせて置き換えをお願いします。

**注意**: レスポンシブでサイズを出し分けている箇所（`lg:text-[Npx]`等）は、
handoff.mdにある通りカスタムクラスに`lg:`が効かないため、**そのまま任意値で残して
ください**。今回の対象は「トークンが無かったから仕方なく任意値にした」箇所だけです。

---

## 3. 報告してほしいこと

- 追加したクラスの一覧
- 既存クラスで値がFigmaとズレていたものがあれば、その内容
- 置き換えた箇所（ファイル単位で構いません）
