# モーション設計の実装（ボタンのプレス／ホバー／カート追加／数量変更）

タップ・クリック時の手触りを設計しました。**触って気持ちいいが、操作の邪魔をしない**ことが
基準です。派手さより、押した瞬間に反応が返ってくる速さを優先しています。

**先に `motion-lab.html` を開いて、実際に触って速度を確認してください。**
スライダーで速度と押し込み量を変えられるので、天真さんが調整した値があればそちらを正とします。

---

## 1. モーショントークンを追加する

`app/design-tokens.css`（または既存のトークンファイル）に追加してください。
数値を直書きせず、必ずこのトークン経由で参照します。

```css
:root {
  /* duration */
  --motion-press:   80ms;   /* 押し込み */
  --motion-release: 160ms;  /* 指を離したあとの戻り */
  --motion-state:   200ms;  /* ホバー・色・影の切り替え */
  --motion-roll:    180ms;  /* 数字の入れ替え */
  --motion-pop:     340ms;  /* カートバッジの跳ね */

  /* easing */
  --ease-out:  cubic-bezier(.2, 0, 0, 1);      /* 標準。減速して止まる */
  --ease-in:   cubic-bezier(.4, 0, 1, 1);      /* 退場 */
  --ease-pop:  cubic-bezier(.34, 1.56, .64, 1); /* 行き過ぎて戻る。遊びを許す場所だけ */

  /* transform */
  --press-scale: .96;
}
```

**`--ease-pop` を使ってよいのはカートバッジだけ**にしてください。跳ねる動きが画面のあちこちに
あると、全体が落ち着かなくなります。

---

## 2. プレス（すべてのタップ要素の共通土台）

ボタン・チップ・カード・アイコンボタン・ステッパーの±など、**押せるものすべて**に適用します。

```css
.pressable {
  transition:
    transform var(--motion-release) var(--ease-out),
    box-shadow var(--motion-state) var(--ease-out),
    background-color var(--motion-state) var(--ease-out),
    border-color var(--motion-state) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.pressable:active {
  transform: scale(var(--press-scale));
  transition-duration: var(--motion-press);
}
```

### 設計の意図
- **押し込み80ms・戻り160ms**と非対称にしています。同じ速さだと機械的で、戻りを遅くすると
  弾力が出ます
- 動かすのは **`transform` と `opacity` だけ**。`width`/`top`/`margin` を触ると
  レイアウト再計算が走り、連打時にカクつきます
- `-webkit-tap-highlight-color: transparent` … iOSの灰色の矩形を消します。自前の
  プレス表現と二重になるためです
- `touch-action: manipulation` … タップ後の300ms待ちを消します。**これが無いと
  どれだけアニメーションを詰めても遅く感じます**

### 注意
`overflow: hidden` の親の中で `scale` すると端が切れることがあります。カード内のボタンなど
入れ子になっている箇所は実機で確認してください。

---

## 3. ホバー（PCのみ）

**必ず `@media (hover: hover) and (pointer: fine)` で囲ってください。**
これが無いと、スマホでタップした要素にホバー状態が貼り付いたまま残ります。

```css
@media (hover: hover) and (pointer: fine) {
  .btn-pill:hover      { transform: translateY(-1px); box-shadow: 0 4px 14px rgb(0 0 0 / .12); }
  .btn-pill:active     { transform: scale(var(--press-scale)) translateY(0); }
  .btn-icon:hover      { background: var(--bg-tertiary); }
  .chip:hover:not(.is-active) { background: #E4E4E4; }
  .menu-card:hover     { box-shadow: 0 8px 24px rgb(0 0 0 / .10); }
  .menu-card:hover .menu-card__img { transform: scale(1.04); }
}
.menu-card__img { transition: transform 420ms var(--ease-out); }
```

カードの画像だけ **420ms** と遅くしています。小さい要素は速く、面積が大きいものは
ゆっくり動かすと自然に見えます。

---

## 4. カートに入った瞬間（この設計の要）

「カートに入った実感が薄い」という課題への回答です。

### やること
- **カートアイコンのバッジ**が `1 → 1.32 → 1` と跳ねる（`--motion-pop` / `--ease-pop`）
- 数字はその瞬間に切り替える

```css
@keyframes badge-pop {
  0%   { transform: scale(1); }
  38%  { transform: scale(1.32); }
  100% { transform: scale(1); }
}
.cart-badge.is-bumping { animation: badge-pop var(--motion-pop) var(--ease-pop); }
```

連打に対応するため、アニメーションを付け直す前に一度リセットしてください。

```js
badge.classList.remove('is-bumping');
void badge.offsetWidth;          // reflow を強制して再生し直す
badge.classList.add('is-bumping');
```

### やらないこと（重要）
- **ボタンのラベルを「追加しました」等に変えない。** 幅が変わってレイアウトが動き、
  続けて押したいときに邪魔になります
- **トーストを出さない。** バッジが跳ねれば伝わります。画面上部から何か降ってくると、
  そちらに視線を奪われて注文の流れが切れます
- **商品画像がカートに飛んでいく演出はしない。** 一度なら楽しくても、10品頼む人には
  10回待たされる演出になります

伝える仕事はバッジ一つに集約する、というのがこの設計の考え方です。

---

## 5. 数量の切り替わり

**今の数字が下へ抜けると同時に、次の数字が上から入ります。**
2つが同じ向きに動くので、切り替わりの瞬間にすれ違って重なることがありません。

```css
.count {
  position: relative;
  overflow: hidden;              /* 抜けていく数字を隠す。これが無いと箱の外にはみ出す */
  height: 24px;
  width: 34px;
  font-variant-numeric: tabular-nums;
}
.count span { position: absolute; inset: 0; display: grid; place-items: center; }

.count .is-leaving  { animation: roll-out var(--motion-roll) var(--ease-out) forwards; }
.count .is-entering { animation: roll-in  var(--motion-roll) var(--ease-out) forwards; }

@keyframes roll-out { from { transform: translateY(0);     opacity: 1; }
                      to   { transform: translateY(100%);  opacity: 0; } }
@keyframes roll-in  { from { transform: translateY(-100%); opacity: 0; }
                      to   { transform: translateY(0);     opacity: 1; } }
```

### 実装の注意（ここを外すと数字が残ります）

**1. 2つの数字は必ず同じ方向に動かす。**
古い数字を下、新しい数字を上から、というように**逆方向に動かすと中央ですれ違い**、
その瞬間に両方が半透明で重なって見えます。同じ向きに流すことが前提です。

**2. 退場させる前に入場クラスを必ず外す。**
一度入場した数字には `is-entering` が付いたままです。そこへ `is-leaving` を足すと
**2つの `animation` が競合し、CSSの後勝ちで `is-entering` が再生されて数字がその場に残ります。**
「最初の1回だけ正常で、2回目以降は前の数字が残る」という症状はこれが原因です。

**3. 連打で取り残された数字を先に消す。**
アニメーション中にもう一度押されると、退場中の数字が積み重なって三重に見えます。
新しい切り替えを始める前に、退場中の要素を即座に取り除いてください。

```js
// 退場中の数字が残っていたら先に片付ける
count.querySelectorAll('span.is-leaving').forEach(n => n.remove());

const current = count.querySelector('span:not(.is-leaving)');
current.classList.remove('is-entering');   // ← これが無いと数字が残る
current.classList.add('is-leaving');
current.addEventListener('animationend', () => current.remove(), { once: true });

const next = document.createElement('span');
next.textContent = value;
next.classList.add('is-entering');
count.appendChild(next);
```

削除は `setTimeout` ではなく **`animationend`** で行ってください。速度トークンを変えたとき、
`setTimeout` の固定値だと消えるタイミングがずれます。

なお、クラスを足し引きする代わりに **Web Animations API（`element.animate()`）** を使えば、
この競合自体が起きません。実装しやすい方を選んでください。

**4. `font-variant-numeric: tabular-nums` が必須。**
等幅数字でないと桁が変わるたびに横幅が動き、隣のボタンまでズレます
（`EN/Data` 系のクラスには追加済みのはずです）。

**5. 180ms を超えない。**
これ以上長いと、連打したときに前の数字が抜けきる前に次が来ます。

## 6. 動きを減らす設定への対応

OSで「視差効果を減らす」を有効にしている人には、動きを止めてください。

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

**この場合でもカート追加が伝わるように**、バッジの数字自体は変わるので機能は成立します。
動きに依存した情報設計になっていないか、`motion-lab.html` のチェックボックスで確認できます。

---

## 7. 適用範囲

| 要素 | プレス | ホバー | 備考 |
|---|---|---|---|
| ピルボタン全般 | ○ | 浮き＋影 | カートに入れる／注文を確定する／キャンセル等 |
| アイコンボタン（48px） | ○ | 背景色 | ☰／×／カート／編集 |
| フィルターチップ・期間チップ | ○ | 背景色 | 選択中はホバーなし |
| メニューカード | ○ | 画像ズーム＋影 | カード全体が押せる場合 |
| 数量ステッパーの ± | ○ | 背景色 | |
| 並び替えの▲▼ | ○ | 背景色 | 無効時はプレスもホバーもなし |
| カートバッジ | — | — | 跳ねるのみ |

**無効状態の要素にはプレスを効かせないでください**（`:active` を打ち消す）。押せたように
見えて何も起きないのが一番の不信感につながります。

---

## 8. 確認したいこと

- `motion-lab.html` で調整した速度・押し込み量（既定値から変えた場合）
- `overflow: hidden` の入れ子で `scale` が切れる箇所がなかったか
- 既存の `.btn-confirm` に独自アニメーションがあったはずなので、
  今回のトークンに寄せられるか、残すべき理由があるか
