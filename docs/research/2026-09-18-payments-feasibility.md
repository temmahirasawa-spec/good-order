# 決済機能（テーブル会計・POS）をどこまでやれるか — 調査メモ

_2026-09-18・天真の依頼「STORES にあるテーブル会計が気になる。POS を作る／このモバイルオーダーに PayPay やカード決済を付けるのはどれくらい難しいか」への回答_

## 結論（3行）

1. **決済事業者になる必要はない。** Stripe や GMO（fincode）、PayPay for Developers のような「決済代行」を使えば、お金は決済代行から店に直接流れ、UTUTU はライセンス（資金移動業）を取らずに済む。これが業界の標準的なやり方で、STORES も同じ構造。
2. **難易度は「お客様が自分のスマホで払う（テーブル会計・事前決済）」が中、「店の端末で払う POS レジ」が中〜高。** 前者は既存の GOOD ORDER に 1〜2 か月で足せる範囲。後者はハードウェアの選定と対面決済の認証がからむが、2025 年 9 月に Stripe Terminal が日本で使えるようになり、以前より現実的になった。
3. **POS レジそのものを作るのはおすすめしない。** 現金・レシート・締め・インボイスまで抱えることになる。Square や STORES レジのような既存 POS と連携するか、Stripe Terminal のような「決済だけ」を足すのが現実的。

## 1. 3つの選択肢

| | A. お客様のスマホで払う | B. 店の端末で払う（Terminal） | C. 既存レジと連携 |
|---|---|---|---|
| 何が起きるか | カートや会計画面で「今払う」を押し、カード／Apple Pay／PayPay で支払う。レジ対応不要 | スタッフがカードリーダーや iPhone を差し出して払ってもらう | GOOD ORDER は注文だけ。会計は Square／STORES レジで（今の運用に近い） |
| 使う仕組み | Stripe（Connect＋Checkout）、fincode byGMO（プラットフォーム機能）、PayPay for Developers | Stripe Terminal（日本 2025-09 開始）、Square Terminal API（日本対応済み） | Square Orders API 等。レジに注文を流す |
| 開発の重さ | 中（3〜6 週間） | 中〜高（＋2〜4 週間、端末の購入・検証） | 中（レジごとに別実装） |
| 店の手数料の目安 | カード 3.6%、PayPay 3.6%（Stripe／fincode） | Stripe Terminal 3.24%、Square 対面 2.5〜3.25% | レジ側の手数料 |
| ライセンス | 不要（決済代行が持つ） | 不要 | 不要 |

## 2. ライセンスの話（いちばん心配していた点）

- 日本では「隔地者間でお金を移動する」ことを業として行うと**為替取引**にあたり、銀行免許か**資金移動業**の登録が要る。資金移動業は供託金 1,000 万円・マネロン対策・本人確認などの義務があり、スタートアップには重い（[EC法務ドットコム](https://ec-houmu.com/start/shunodaikou)、[マネーフォワード](https://biz.moneyforward.com/establish/basic/82628/)）。
- ただし「店から委任を受けて、お客様のお金を店の代わりに受け取り、すみやかに店に渡す」だけの**収納代行**は、原則として登録不要。条件は、取引に付随していること、お金を長く預からないこと、専用口座で分けること（[GVA 法律事務所](https://gvalaw.jp/blog/a20200227/)、[One Asia Lawyers](https://oneasia.legal/6556)）。
- **決済代行（Stripe Connect や fincode のプラットフォーム機能）を使えば、UTUTU の口座をお金が通らない。** お客様 → 決済代行 → 店の口座に直接入り、UTUTU は「プラットフォーム手数料」を差し引いた分だけ受け取る形にできる。この形なら収納代行かどうかの議論にもならず、いちばん安全（[Stripe Connect](https://stripe.com/connect)、[fincode プラットフォーム機能](https://www.fincode.jp/platform/)）。
- 2025 年の資金決済法改正で規制が入ったのは「国境をまたぐ収納代行」で、国内の飲食店には関係ない。

## 3. 選択肢 A（お客様のスマホで払う）を GOOD ORDER に足すと何が要るか

**決済代行の候補**

- **Stripe**: カード・Apple Pay・Google Pay が 3.6%。**PayPay も使えるが別審査で約 2 週間**、プラットフォーム（Connect）の場合は「通常より長い」とされる。店ごとに特商法の表示ページ・日本語の商品ページが要る。2025 年 3 月から **3D セキュアが必須**（[Stripe サポート](https://support.stripe.com/questions/accepting-paypay-payments-for-japan-based-stripe-accounts)、[Stripe 料金](https://stripe.com/pricing)）。
- **Stripe Connect のコスト**: 決済 3.6% に加え、店ごとにアカウント月額 200 円＋送金ごと 250 円＋0.25%（[PAY.JP の解説](https://pay.jp/column/stripe-connect-guide)、[Stripe Connect 料金](https://stripe.com/connect/pricing)）。店が 10 店なら月 2,000 円＋送金費。
- **fincode byGMO**: カード・PayPay（3.6%）・コンビニ・Apple Pay。「テナント」ごとに手数料率を変えて自動で分配するプラットフォーム機能がある。国内事業者で日本語サポート（[fincode PayPay](https://www.fincode.jp/payments/paypay/)、[料金](https://www.fincode.jp/pricing/)）。
- **PayPay for Developers を直接**: 手数料 3.6%、初期・月額なし。ただし**店ごとに PayPay の加盟店契約と審査（数日〜数週間）**が要り、プラットフォームとして複数店をまとめる仕組みは公開情報では確認できなかった（[PayPay for Developers](https://developer.paypay.ne.jp/products/docs)、[API図鑑](https://api-zukan.com/blog/paypay-api-guide)）。

**作るもの（GOOD ORDER 側）**

1. 店の登録: 管理画面に「決済を使う」設定。店が Stripe に口座を登録する導線（Connect Express の画面を開くだけ）
2. お客様側: カート（事前決済）または「お会計」画面（テーブル会計＝食べ終わってから、卓の未会計ぜんぶをまとめて払う）に「カードで払う」「PayPay で払う」。**卓の未会計を集計する処理はレジで実装済み**なので、それを流用できる
3. 支払い完了の受け取り（webhook）→ 注文を「会計済み」に。レジ画面には「スマホで支払い済み」と出す
4. 返金・取消しの操作（レジ画面）。今は注文の取り消し自体が無いので、ここは新規
5. 領収書（インボイス対応: 登録番号・税率ごとの内訳）。税額はすでに注文ごとに保存している
6. 失敗時の逃げ道: 決済が通らないときはレジで現金、という運用を残す

**見積り**: Stripe Connect＋カードで 3〜5 週間。PayPay 追加は実装は小さいが審査待ち 2 週間以上。fincode でも同程度。

**注意点**

- 3D セキュアで「支払いの途中でカード会社の画面が出る」ため、卓で急いでいるお客様にはひと手間。Apple Pay はこれが軽い
- 分割払い・割り勘は決済代行側でも標準では無い。1 卓 1 回で払う前提（今と同じ）
- 店ごとの特商法ページ・日本語の商品ページが審査で見られる。GOOD ORDER の店舗情報・メニュー画面がそのまま使える

## 4. 選択肢 B（店の端末で払う）

- **Stripe Terminal**（2025-09-03 日本開始）: 端末は BBPOS WisePad 3 が 10,480 円、Stripe Reader S700 が 52,480 円。**iPhone の Tap to Pay** なら端末なしでカードのタッチ決済ができる。手数料はカード 3.24%。PayPay・WeChat Pay 対応（PayPay は別審査）。Suica・iD・QUICPay は検討中（[Impress Watch](https://www.watch.impress.co.jp/docs/news/2044261.html)、[Stripe Terminal 端末](https://stripe.com/terminal/devices)）
- **Square**: 日本で Terminal API・Payments API・Orders API が使える（Reader SDK／Mobile Payments SDK は未対応）。カードのほか、申請すれば Suica 等の交通系・iD・PayPay も端末で受けられる。手数料は対面 2.5〜3.25%（[Square 日本向け開発ガイド](https://developer.squareup.com/docs/international-development/japan)、[Square 料金](https://squareup.com/jp/ja/payments/pricing)）
- 「POS レジ」として作る場合は、現金の管理・レシート印字・日次の締め・返品・インボイスまで自分で持つことになる。これは決済よりも会計・税務の作り込みが重く、**GOOD ORDER の強み（注文の体験）から遠い**

## 5. STORES との比較

- STORES モバイルオーダーは 2025-08 に「テーブルオーダー」を追加。お客様が卓の二次元コードから注文し、**カードか PayPay でその場で決済**。初期・月額は無料で、決済手数料 3.6%＋10 円／注文。STORES レジと連携して売上・在庫を一元管理（[STORES プレスリリース](https://www.st.inc/news/2025-08-07-mo)、[機能一覧](https://stores.fun/mobileorder/functions)）
- 手数料は Stripe／fincode と同じ 3.6% 水準なので、**GOOD ORDER が決済を足しても店の負担は STORES と横並びにできる**
- 差がつくのは「レジ・在庫との一体化」。STORES はレジも自社。GOOD ORDER が同じ土俵で戦うより、**注文と卓の体験（1杯ごとの選択、提供タイミング、伝票の見張り）で差をつけ、決済は決済代行に任せる**ほうが現実的

## 6. おすすめの進め方

1. **第1段階（1〜2 か月）**: Stripe Connect（Express）＋ Checkout で「お客様のスマホで払う」を店ごとの任意機能として足す。カード・Apple Pay・Google Pay。現金はこれまでどおりレジ。UTUTU の収益はプラットフォーム手数料（例: 0.5〜1%）として決済から自動で差し引く
2. **第2段階**: PayPay を Stripe 経由で追加（審査の申請は第1段階と同時に出す）
3. **第3段階（必要なら）**: Stripe Terminal の Tap to Pay（iPhone）で、レジでも同じ Stripe で受ける。端末を買わずに始められる
4. **やらない**: 自前で POS レジを作る、資金移動業の登録

## 7. 決める前に確かめること

- YORKYS BRUNCH で「テーブル会計」の需要が実際にどれだけあるか（レジに並ぶ時間が問題になっているか）
- Stripe か fincode か。Stripe は開発者向けの道具が最も揃っている。fincode は国内サポートと PayPay の扱いに強み。**どちらもプラットフォーム型の審査が要るので、先に問い合わせて可否と期間を確かめる**
- 決済を足した場合の店との契約（手数料の取り方、返金時の負担、障害時の責任）

## 出典

- Stripe: [料金](https://stripe.com/pricing)、[PayPay の有効化](https://support.stripe.com/questions/accepting-paypay-payments-for-japan-based-stripe-accounts)、[Connect 料金](https://stripe.com/connect/pricing)、[Terminal 日本開始（Impress Watch）](https://www.watch.impress.co.jp/docs/news/2044261.html)
- PayPay: [PayPay for Developers](https://developer.paypay.ne.jp/products/docs)、[API図鑑](https://api-zukan.com/blog/paypay-api-guide)
- GMO: [fincode PayPay](https://www.fincode.jp/payments/paypay/)、[プラットフォーム機能](https://www.fincode.jp/platform/)
- Square: [日本向け開発ガイド](https://developer.squareup.com/docs/international-development/japan)、[料金](https://squareup.com/jp/ja/payments/pricing)
- STORES: [テーブルオーダー発表](https://www.st.inc/news/2025-08-07-mo)、[機能一覧](https://stores.fun/mobileorder/functions)
- 法規制: [EC法務ドットコム](https://ec-houmu.com/start/shunodaikou)、[GVA 法律事務所](https://gvalaw.jp/blog/a20200227/)、[マネーフォワード](https://biz.moneyforward.com/establish/basic/82628/)、[One Asia Lawyers](https://oneasia.legal/6556)
