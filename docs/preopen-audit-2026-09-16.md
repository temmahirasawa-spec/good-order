# プレオープン前 リスク棚卸し（2026-09-16）

> **これは AI 6体＋点検役1体による調査結果で、私（天真・AI）は裏を取っていません。**
> 実装に入る前に、必ず1件ずつ `howToVerify` を実行して再現を確認すること。
> 誤りが混ざっている前提で読む。再現しないものは「再現せず」と記録して閉じる。
>
> 生成方法: Workflow `preopen-risk-survey`（7エージェント / 2.7Mトークン / 40分、読み取りのみ）
> 前提: 明日プレオープン・初日30人想定・今後1日100件

## 明日の営業を止める可能性が高い順（点検役の判定）

1. 卓の二次元コード（紙）が、今の tables 11行の short_code と一致しているかを6本とも誰も確認していない。席レイアウトは一度作り直されており（本番に 'ソファ席 A-1' の注文が残っているのに table_categories は テーブル席/ボックス席 の2つだけ）、save_table_layout は作り直すたび short_code を振り直す。紙が古いと resolveTable が null を返し、TopScreen.tsx:55-62 は卓を設定しないまま注文を通すので、全卓のお客様がレジの『—』という1枚の伝票に合流する。開店直後に全席同時に起きる。

2. 注文・会計を取り消す手段がアプリにもDBにも存在しない。orders_status_check は pending/preparing/served/picked_up/paid の5つだけで 'cancelled' が無く、管理画面に取消UIも無い（CheckoutConfirmAlert.tsx:33 が『この操作は取り消せません』）。二重注文（領域1の高リスク）も、誤って押した『会計済み』（押すと同卓の全端末が15秒でTHANK YOU画面に落ちる）も、復旧手段が天真によるSQLだけになる。

3. 注文が店に届く経路が厨房プリンタ1本なのに、店側が『届いていない』に気づく仕組みが無い。kitchen_enabled=false・staff_call_enabled=false・レジに音もバッジも無いうえ、visibilitychange / wakeLock の実装がリポジトリ全体で0件。iPad が自動ロックすると /admin/print の『プリンタ応答なし』にも誰も気づけない。伝票が1枚出ないだけで、その注文は永久に誰にも見えない。

4. ログイン直後の着地画面が /admin/kitchen ＝『使わない』としてサイドバーから隠した画面。login/page.tsx:57 が直接そこへ飛ばし、layout.tsx:57 のフォールバック allowed[0] も ADMIN_NAV_ITEMS の先頭（/admin/kitchen）。kitchen ページ自体に機能OFFの判定が1つも無い（grep で features のヒット0）。朝いちにスタッフが開くと、会計済みで下がらない注文が並ぶ画面に着き、しかもサイドバーに戻る導線が無い。

5. 会計済みの注文が厨房画面から永久に下がらず、かつ table_id が NULL の注文が『table-0』で合流する。本番に実データ（0559ed87 / status=paid / done 0件 / table_label='ソファ席 A-1'）が既に存在する。厨房を開いた瞬間に前日の注文が『未処理』として並び、『すべて提供済みにする』を押すと別卓の注文まで巻き込む。


## 6領域の誰も見ていなかった箇所

### 卓の二次元コード（紙）の実地確認が、6本のレポートのどこにも無い。全員が「席設定を触るな」とは書いたが、「今テーブルに貼ってある紙が、今のDBの short_code を指しているか」を誰も確かめていない。

**なぜ**: 本番の table_categories は テーブル席(A) / ボックス席(B) の2つだけなのに、本番の注文 0559ed87 の table_label は 'ソファ席 A-1'。つまり席のカテゴリごと作り直された履歴が実データに残っている。supabase/table_layout_guard.sql の save_table_layout は卓を作り直すたび public.generate_table_short_code() で short_code を振り直すので、その作り直しより前に刷った紙は全部死んでいる。死んだコードを読むと lib/tables.ts:170-173 が null を返し、components/top/TopScreen.tsx:55-62 は setTableRef を呼ばないまま setTableResolved(true) するので、お客様は卓なしのまま注文まで進める。レジ側は app/admin/(protected)/register/page.tsx:81 で 'n0' に落ちるため、卓が違うお客様全員が1枚の伝票に合流する。開店直後に全席で同時に起きるうえ、画面にはエラーが出ないので発覚が遅れる。

**確認**: 開店前に、実際にテーブルに置く11枚の紙を1枚ずつスマホのカメラで読み、URLの ?t= の後ろの6文字を書き出す。次の11個と完全に一致することを確認する（1枚でも違えば、その席は /admin/tables から刷り直す）: テーブル席A-1=gcqgjh / A-2=4euupa / A-3=2sethj / A-4=k7uvx6 / A-5=aaeye8 / A-6=c5fwnj / ボックス席B-1=8dw2rk / B-2=n24bx9 / B-3=hdg74j / B-4=bvu7x4 / B-5=9kvrq9。DB側の突き合わせは SELECT t.short_code, c.name||' '||c.code||'-'||t.number AS label FROM public.tables t JOIN public.table_categories c ON c.id=t.category_id ORDER BY c.code, t.number;（SELECTのみ）。読み取ったあと画面上部に出る卓名が、その席の札と一致することも1枚ずつ目視する（『—』が出たらその紙は死んでいる）。


### 注文・会計の「取り消し」が、アプリにもデータモデルにも存在しない。6本とも二重注文・誤会計が起きる経路は指摘しているが、起きたあとどう戻すかを誰も書いていない。

**なぜ**: 本番の orders_status_check は CHECK (status = ANY (ARRAY['pending','preparing','served','picked_up','paid'])) で 'cancelled' が無い（pg_constraint で確認）。取消・返品・注文削除のUIはリポジトリ全体に1つも無く（app/admin と components/admin を「取り消/取消/キャンセル/revert」で grep した結果、ヒットするのはメニュー編集の保存キャンセルとカテゴリ削除の警告文だけ）、components/admin/register/CheckoutConfirmAlert.tsx:33 は『この操作は取り消せません。』と明記している。さらに RLS（supabase/staff_role_rls.sql:135）は register ロールに status='paid' への更新しか許さないので、レジ担当者は自力で戻せない。結果として (1) 領域1が挙げた二重注文（3回再送失敗後の押し直しで新UUIDが振られる）は、伝票2枚・料理2人前・レジ2件請求になったまま消せない、(2) 卓を1つ押し間違えて『会計済み』にすると、その卓の全端末が15秒以内に THANK YOU 画面に落ちて注文継続不能になるのに、戻す操作が無い。どちらも『明日その場で起きて、その場で直せない』種類の事故。

**確認**: コードを変えずに確認できる。(1) SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='c'; を実行し、返る配列に 'cancelled' が無いことを見る。(2) /admin/register を PC 1400px で開き、伝票カードと確認ダイアログのどこにも『取り消す』『会計を戻す』に当たるボタンが無いことを目視する。(3) 明日の当座の備えとして、天真が SQL Editor で流す取り消し手順を先に書いておく。二重注文の削除は DELETE FROM public.order_item_options WHERE order_item_id IN (SELECT id FROM public.order_items WHERE order_id='<消す注文ID>'); DELETE FROM public.order_items WHERE order_id='<消す注文ID>'; DELETE FROM public.print_jobs WHERE order_id='<消す注文ID>'; DELETE FROM public.orders WHERE id='<消す注文ID>'; の順（order_items を先に消さないと外部キーで落ちる）。誤会計を戻すのは UPDATE public.orders SET status='pending' WHERE id='<戻す注文ID>';。どちらも書き込みなので、実行は天真の判断で。


### ログイン直後の着地画面が /admin/kitchen ＝『使わない』としてサイドバーから隠した画面であること。厨房OFFは3本のレポートが触れているが、「OFFにした画面が全員の入口になっている」というつなぎ目は誰も見ていない。

**なぜ**: app/admin/login/page.tsx:57 が成功時に router.replace("/admin/kitchen") を直書きしている。URL直打ちのフォールバックも app/admin/(protected)/layout.tsx:57 の router.replace(allowed[0].href) で、allowed[0] は lib/staffRoles.ts の ADMIN_NAV_ITEMS の先頭＝ /admin/kitchen（同ファイルのコメントが『配列の順序がそのままサイドバーの表示順であり、同時に layout.tsx の権限ガードのフォールバック先』と明記）。一方 components/admin/nav/NavContent.tsx:63 は features.kitchen が false のとき /admin/kitchen をサイドバーから外す。そして app/admin/(protected)/kitchen/page.tsx には機能OFFの判定が1つも無い（同ファイルを features / kitchen_enabled / kitchenEnabled で grep してヒット0）。本番は kitchen_enabled=false。つまり明日の朝、スタッフがログインすると、サイドバーに載っていない厨房画面に着地し、そこには会計済みで下がらない注文（本番に実在: 0559ed87）が『未処理』として並ぶ。戻るためのナビ項目が無いので、レジに行くには自分でサイドバーの『レジ』を探すことになる。

**確認**: 開店前に、実際に使うiPadで https://app.good-order.jp/yorkys-shukugawa/admin/login を開き、manager アカウントでログインする。(1) URL が /admin/kitchen になること、(2) 左のサイドバーに『厨房』の項目が無いこと、(3) 画面に 2026-09-16 の会計済み注文（ソファ席 A-1）がカードとして出ていること、の3つを目視する。3つとも当てはまれば本項目は確定。当日の回避策は、ログイン後に必ず『レジ』を押してから使う／レジのタブをブックマークして直接開く、を朝礼で共有すること。


### iPad の自動ロック・スリープと、通知が紙1枚しかないことの組み合わせ。個々の要素は別々のレポートに出てくるが、掛け算になったときの見え方を誰も書いていない。

**なぜ**: 注文がホールに届く経路はプリンタ1本（本番 stores.kitchen_enabled=false / staff_call_enabled=false）。レジ画面には通知音もタイトル点滅も無く、着席済みの卓の追加注文では件数表示も変わらない。異常に気づく唯一の導線 /admin/print は人が見ないと分からない。そのうえ visibilitychange / wakeLock / NoSleep の実装がリポジトリ全体で0件（app/ components/ lib/ を grep して 0 ヒット）なので、iPad が自動ロックすれば3秒ポーリングは止まり、画面は消える。つまり『紙が出ていない』と『画面が寝ている』が同時に起きると、注文が入っていることを知る手段が店に1つも無くなる。現時点の本番は正常（printer_status.last_seen_at が9秒前、status<>'done' の print_jobs は0件）なので、朝の時点で仕込める対策で足りる。

**確認**: 開店前に、レジ用iPadの 設定 > 画面表示と明るさ > 自動ロック を『なし』にし、充電ケーブルを挿したままにする。そのうえで /admin/print を別タブで開きっぱなしにし、上部カードが『正常・最後の応答はたった今』であることを確認する。営業中の生存確認は SELECT last_seen_at, now()-last_seen_at AS age, (SELECT count(*) FROM public.print_jobs WHERE status<>'done') AS stuck FROM public.printer_status;（SELECTのみ）で、age が1分以内・stuck が0であること。


### 開店前30分に何を何分で、どの順でやるかという単一の手順書が無い。6本ともクエリと再現手順は書いたが、担当をまたぐ『通し確認』とその後始末が誰の担当にもなっていない。

**なぜ**: 特に抜けているのは3点。(1) 二次元コードの実地スキャン（上記の最初のギャップ）は領域をまたぐので誰も書いていない。(2) 通し確認のテスト注文は『領域2』が推奨しているが、そのテスト注文を当日の売上・厨房画面からどう外すかが決まっていない。会計済みにしても orders には残り、厨房画面には下がらない（done にする経路が無い）ので、開店時点で画面に1件ゴミが乗った状態から始まることになる。実際いま本番には 2026-09-16 の注文が1件あり status=paid・明細0件done で、この状態のまま朝を迎える。(3) 開店前に is_accepting_orders を止めておく手段が管理画面に無い（lib/api.ts:472 の setAcceptingOrders は呼び出し元ゼロ）ため、準備中の時間帯にお客様が先にコードを読むと注文が通ってしまう。

**確認**: 次の順で実施し、各ステップの結果を1行ずつメモする。①プリンタの自己診断（電源OFF→給紙ボタンを押しながらON）で紙とカッターを確認。②レジiPadの自動ロックを『なし』にし、日付が正しいことを 設定 > 一般 > 日付と時刻 で確認。③11枚の紙を全部スキャンし、卓名が札と一致することを目視（上記ギャップ1）。④実機で1件テスト注文を出し、伝票2枚が10秒以内に出て、卓名・提供タイミング・オプションが一致することを紙で確認。⑤ /admin/print の上部カードが『正常』であることを確認。⑥テスト注文を消す（消す手段はSQLしかない。上記ギャップ2の DELETE 手順を天真が実行）。⑦前日の残り物を消す: SELECT id, business_date, status, table_label FROM public.orders WHERE status<>'served' AND status<>'picked_up'; を実行し、返った行を厨房画面から下げるかどうかを天真が判断する。⑧ SELECT status, count(*) FROM public.print_jobs WHERE created_at > now()-interval '1 day' GROUP BY 1; で pending/failed が0であることを確認して開店。


### アプリの合計金額と、実際に Square で打つ金額を突き合わせる導線が無い。決済が別系統であることは前提として共有されているが、締めのときに合うかを誰も見ていない。

**なぜ**: アプリは決済しない。レジは伝票を見て Square に打ち、アプリ側は『会計済み』にするだけ（app/admin/(protected)/register/page.tsx:285-292）。金額の正はDB側の calc_order_total だが、厨房伝票には金額が一切印字されない設計（lib/receipt.ts）ので、レジ担当者が金額を読むのはレジ画面だけ。さらに本番は set_drink_enabled=true / set_drink_discount=200 で、フード1品につきドリンク1杯 −200円が自動で乗り、tax_mode='included' の店内10%・テイクアウト8%。打ち間違いや割引の見落としが起きても、当日中に検知する手段が無い（/admin/dashboard は orders 由来の数字しか出さないので、Square 側とは突き合わない）。営業は止まらないが、初日の締めで金額が合わずに原因追跡ができなくなる。

**確認**: 閉店後に SELECT table_label, pickup_no, total_amount, discount_amount, tax_amount, order_type FROM public.orders WHERE business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date ORDER BY created_at;（SELECTのみ）を実行し、Square の当日の取引一覧と1件ずつ突き合わせる。合計だけの照合は SELECT count(*), sum(total_amount) FROM public.orders WHERE business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date; で足りる。ズレがあった注文について discount_amount が200の倍数になっているか（セットドリンク割引の見落としか）を先に見ると切り分けが早い。


### 逆に、優先度を下げてよい項目が混ざっている。明日の朝の限られた時間をここに使わないこと。

**なぜ**: 次の6つは、本番の実データ上いずれも明日は発火しないか、発火しても営業が止まらない。(1) 受渡番号99巡回 — 2領域が重複して挙げているが、初日は30件想定で、pickup_no_counters の last_no を見れば進行が分かる。(2) テイクアウト受渡画面が永久に空 — 本番の menu_items で is_takeout=true は0件なので、テイクアウト商品を公開しない限り発火しない。(3) anon の TRUNCATE 権限と get_recent_item_counts の公開 — PostgREST は TRUNCATE を公開しておらず、後者は集計値のみ。auth.users は manager 2件だけ。(4) localStorage の orderHistory 肥大 — お客様は各自の端末で、初日には到達しない。(5) 商品名の波ダッシュ U+301C の文字化け — ピザ3品のみで、読めれば料理は作れる。(6) カテゴリ背景写真の未設定（15件すべて）とドリンク13件の写真なし — 見た目の問題で、注文経路は動く。メニューのデータ自体は健全だった（63品すべて is_available=true、価格0円なし、画像50件はすべて Supabase Storage の公開バケットで平均199KB・最大295KB、空のカテゴリなし）。

**確認**: 朝の作業から外してよいことの裏取りだけ、次の3クエリで足りる（すべてSELECTのみ、30秒で終わる）。SELECT count(*) FROM public.menu_items WHERE is_takeout AND is_available;（0であること）／SELECT business_date, last_no FROM public.pickup_no_counters ORDER BY business_date DESC LIMIT 3;（last_no が90未満であること）／SELECT email, raw_app_meta_data->>'role' FROM auth.users;（manager 2件だけで、register/kitchen/counter が増えていないこと）。3つとも満たすなら、上記6項目は営業後の宿題に回してよい。



---

## 領域別の詳細

### 管理画面（app/admin）と設定・権限（supabase の RLS / SECURITY DEFINER 関数）

**重要経路**

- **席設定の保存 → 卓の DELETE → 注文の卓ひもづけ** — save_table_layout は一覧に無い卓を DELETE する。orders.table_id は ON DELETE SET NULL（本番で確認済み）なので、営業中に1卓でも消すと (1) その卓の未会計注文が table_id を失い、(2) その二次元コードを読んだお客様の注文が卓なし／別卓として入る。2026-09-16 の全滅事故と同じ構造が、件数の少ない削除では今も残っている。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/table_layout_guard.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/admin/tables/SeatSettingsModal.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/top/TopScreen.tsx`
- **二次元コード → resolve_table → カートの tableId/tableLabel → place_order** — 卓の識別は TopScreen が1回だけ解決し、結果を localStorage(orderly-cart) に焼き付ける。解決に失敗したときに前の値をクリアしないため、卓の取り違え・卓なし注文がここから発生する。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/top/TopScreen.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql`
- **カテゴリ削除 → menu_items の CASCADE** — menu_items_category_id_fkey は ON DELETE CASCADE（本番確認済み）。order_items_menu_item_id_fkey が NO ACTION なので注文実績のある商品は守られるが、まだ一度も注文されていないカテゴリは確認ダイアログ1枚で商品ごと全消しになる。プレオープン初日は注文実績が無い＝守りが効かない日。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/menu/categories/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dbError.ts`
- **金額に効く設定（税・セットドリンク割引）→ place_order の calc_order_total** — 金額の正はサーバー（place_order）。stores 1行の tax_mode / tax_rate_* / set_drink_* を変えると、次の注文から即座に請求額が変わる。取り消しの導線は無い。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/tax_mode.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/set_drink_discount.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/tax/page.tsx`
- **設定 → お客様画面への反映経路** — メニュー/カテゴリは menuDataStore の30秒TTL＋Realtime、店舗設定（税・割引・機能ON/OFF・店舗情報）は画面ごとの都度フェッチ。Realtime の publication に menu_items が入っていないため、設計上の即時反映が実際には効いていない。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/menuDataStore.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/api.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/features.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tax.ts`
- **admin の権限ガード（画面 / RPC / RLS の三層）** — 画面は app_metadata.role で出し分け、設定系 RPC は関数内で manager チェック、テーブルは RLS。三層目（RLS）だけが素通しになっている。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/layout.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/staffRoles.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/staff_role_rls.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/orders_anon_lockdown.sql`

**リスク**

#### [critical] 二次元コードが解決できないと、カートに残っている「前の卓」のまま注文が入る（＝別のお客様の伝票に合流する）。新品の端末なら卓なし（table_id=NULL / table_label=NULL / table_number=0）で入り、レジは全部を n0 という1つの伝票に束ねる。

- **根拠**: components/top/TopScreen.tsx:48-63 — `const t = await resolveTable(...)` のあと `if (t) {...} else if (legacyNumber !== null) {...}` の2分岐しかなく、`?t=<死んだshort_code>` は legacyNumber が null なので **どちらにも入らず setTableRef が一度も呼ばれない**。コメントも「解決できなかった場合もボタンは開ける」と明記。一方 lib/store.ts:476-481 の partialize は tableId / tableLabel を orderly-cart に永続化しているので、前回の値が残り続ける。さらに app/admin/(protected)/register/page.tsx:73-81 の tableKey() は table_id → table_label → `n${table_number}` の順なので、両方 NULL の注文はすべて `n0` に合流する。卓が消えるのは supabase/table_layout_guard.sql の save_table_layout（DELETE FROM public.tables ...）で、本番の orders_table_id_fkey は `ON DELETE SET NULL`。
- **確認手順**: 1) 本番の生きている short_code を確認: `SELECT short_code FROM public.tables ORDER BY display_order LIMIT 1;`（現在 A-1 は gcqgjh）。2) ローカル dev を 390px で開き `http://localhost:3000/?t=gcqgjh` → 開始 → 商品をカートへ。DevTools の Application > Local Storage で `orderly-cart` の tableId / tableLabel が入ることを確認。3) 同じタブで `http://localhost:3000/?t=zzzzzz`（存在しない short_code）を開く。4) 再び `orderly-cart` を見て **tableId / tableLabel が gcqgjh の卓のまま変わっていない** ことを確認 → これが取り違えの実体。5) localStorage を全消しして `?t=zzzzzz` だけで開き、カートまで進んで `orderly-cart` の tableId が null・tableLabel が null になることを確認 → これが n0 合流の実体。※ place_order は実行しない。

#### [critical] セットドリンク割引が本番で ON になっており、アルコール（最高 ¥4,620）も割引対象。フード1品につきドリンク1杯 −¥200 が全ての店内注文に自動で乗る。

- **根拠**: 本番 public.stores の実値: set_drink_enabled=true / set_drink_discount=200 / set_drink_takeout=false。対象の決まり方は set_drink_discount_for()（本番の関数定義で確認）が `LEFT JOIN public.categories c ... FILTER (WHERE ctype = 'drink')` としているだけで、本番の categories には category_type='drink' が2件ある: 「ドリンク」(slug=drink) と **「アルコール」(slug=alcohol, 価格 ¥770〜¥4,620)**。docs/handoff.md:3529 の章では「設定は OFF」と書かれており、その後 ON に変わっている（＝天真・洋輔さんが把握しているか未確認）。
- **確認手順**: 1) `SELECT set_drink_enabled, set_drink_discount, set_drink_takeout FROM public.stores;` が (true, 200, false) であることを確認。2) `SELECT name, slug, category_type FROM public.categories WHERE category_type='drink';` で アルコール が含まれることを確認。3) 実際の割引額は SELECT だけで再現できる: `SELECT public.set_drink_discount_for('10000000-0000-0000-0000-000000000001','dine_in', '[{"menu_item_id":"<パンケーキのid>","quantity":1,"unit_price":1340},{"menu_item_id":"<アルコールのid>","quantity":1,"unit_price":4620}]'::jsonb);` → 200 が返れば「ワインが200円引き」が成立している。menu_item_id は `SELECT id, name, price FROM public.menu_items WHERE category_id IN (SELECT id FROM public.categories WHERE slug IN ('pancake','alcohol'));` で引く。4) 洋輔さんに「アルコールも割引対象でよいか」を確認する。

#### [critical] 営業中に注文を止めるスイッチが管理画面に存在しない。厨房・プリンタが詰まっても注文が入り続ける。

- **根拠**: lib/api.ts:472-479 に setAcceptingOrders() が定義されているが、`grep -rn "setAcceptingOrders" app/ lib/ components/` の結果は **定義行の lib/api.ts:472 のみ**（呼び出し元ゼロ）。一方 lib/store.ts:339-345 は注文のたびに isAcceptingOrders() を叩いており、本番の stores.is_accepting_orders は true。つまり「読むだけで誰も書けないフラグ」になっている。
- **確認手順**: 1) `grep -rn "setAcceptingOrders\|is_accepting_orders\|受付停止" app/admin/` を実行し、ヒットが0件であること（＝管理画面に導線が無いこと）を確認。2) ローカル dev で /admin/display・/admin/store・/admin/tax・/admin/menu をすべて開き、注文受付を止めるトグルが無いことを目視で確認。3) 当日止める必要が出たときの唯一の手段を先に決めておく: `UPDATE public.stores SET is_accepting_orders=false WHERE id='10000000-0000-0000-0000-000000000001';`（＝AI か天真が SQL を打つしかない）。この手順を洋輔さんに事前共有するかどうかを天真に確認する。

#### [high] カテゴリ削除が、そのカテゴリの商品を全件まとめて消す。初日は注文実績が無いので、DB 側の安全弁（order_items の外部キー）が効かない。

- **根拠**: 本番の制約: `menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE`。守りになっているのは `order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)`（confdeltype='a' = NO ACTION）だけで、**その商品が一度も注文されていなければ何も止めない**。画面側 app/admin/(protected)/menu/categories/page.tsx:375-405 は件数を出して警告するのみで「削除自体はブロックしない」とコメントに明記。本番の orders は現在 25 件すべて paid（検証分）で、明日の朝の時点で実績はほぼ無い。
- **確認手順**: 1) `SELECT c.name, count(m.id) AS items FROM public.categories c LEFT JOIN public.menu_items m ON m.category_id=c.id GROUP BY c.name ORDER BY items DESC;` で、ドリンク19件・アルコール7件・トースト6件・パンケーキ6件が1回の削除で消え得ることを確認。2) `SELECT count(*) FROM public.order_items;` が 0 に近い＝守りが効かないことを確認。3) ローカル dev で /admin/menu/categories を開き、カテゴリ編集パネル右上のゴミ箱を押して確認ダイアログの文言を読む（「このカテゴリには19件の商品があります。削除すると商品も全て削除されます」が出るか）。押して確定はしない。

#### [high] 売り切れ切替が、お客様が開いている画面に届かない。Realtime の publication に menu_items が入っていない。

- **根拠**: 本番の `SELECT p.pubname, c.relname FROM pg_publication p LEFT JOIN pg_publication_rel pr ON pr.prpubid=p.oid LEFT JOIN pg_class c ON c.oid=pr.prrelid;` の結果は supabase_realtime に **orders と order_items の2つだけ**。lib/menuDataStore.ts:107-127 は `{ event:"UPDATE", schema:"public", table:"menu_items" }` を購読しているが、publication に無いので一生イベントが来ない。実際の反映は lib/menuDataStore.ts:29 の `TTL_MS = 30_000` と fetchAll の呼び出しタイミング頼み（画面を開いたまま動かないお客様には届かない）。管理画面側の切替は app/admin/(protected)/menu/page.tsx:584-597 で menu_items を直接 UPDATE している。
- **確認手順**: 1) `SELECT c.relname FROM pg_publication p JOIN pg_publication_rel pr ON pr.prpubid=p.oid JOIN pg_class c ON c.oid=pr.prrelid WHERE p.pubname='supabase_realtime';` に menu_items が無いことを確認。2) ローカル dev をつなぎ、ブラウザA で /order のカテゴリ一覧を開いたまま放置、ブラウザB の /admin/menu で同じ商品の状態チップを「売り切れ」に切り替える。3) ブラウザA を触らず30秒待ち、SOLD OUT の帯が出ないことを確認。ページ内を遷移すると出る（TTL 経由）ことも確認する。4) 最後の砦は place_order 側の売り切れ拒否（supabase/order_stale_table_id.sql の `売り切れの商品が含まれています` / DETAIL='sold_out'）なので、注文自体は通らない＝事故にはならないが、「切ったのにお客様の画面にすぐ出ない」ことをホールに伝えておく必要がある。

#### [high] 席設定の安全弁が「5卓以上かつ全体の半数以上」でしか止まらない。11卓ある今、4卓までは黙って消えて印刷済みの二次元コードが死ぬ。

- **根拠**: supabase/table_layout_guard.sql の条件は `IF v_tbl_deleting >= 5 AND v_tbl_deleting * 2 >= v_tbl_total THEN RAISE EXCEPTION`。本番の卓数は11（テーブル席 A-1〜A-6 が6卓、ボックス席 B-1〜B-5 が5卓）なので、4卓の削除は素通り。5卓消しても 5*2=10 < 11 で素通り。実質「6卓以上同時」でしか止まらない。short_code は再作成で必ず振り直される（save_table_layout の INSERT が public.generate_table_short_code() を呼ぶ）ので、消して作り直した卓の紙は復活しない。SeatSettingsModal.tsx:118-127 の window.confirm にも「印刷済みの二次元コードは読み取れなくなります」と書いてある。
- **確認手順**: 1) `SELECT count(*) FROM public.tables;` が 11 であることを確認。2) `SELECT id, short_code, c.code||'-'||t.number AS label FROM public.tables t JOIN public.table_categories c ON c.id=t.category_id ORDER BY c.code, t.number;` を控えて、明日の営業前後で short_code が1つも変わっていないことを突き合わせられるようにする。3) 明日は席設定を触らない運用にする（触る必要が出たら、消さずに追加だけにする）ことを洋輔さんに伝える。

#### [high] RLS が authenticated ロール全員に stores / menu_items / categories / menu_item_options の全書き込みを許している。金額・税・割引の設定がテーブル直叩きで誰でも変えられる（CLAUDE.md 4章の「金額・会計に関わる権限は register / manager のみ」に反する）。

- **根拠**: 本番の pg_policy: `stores_write_authenticated` polcmd='*' roles=authenticated using=true withcheck=true。同形のポリシーが `menu_items_write_authenticated` / `categories_write_authenticated` / `menu_item_options_write_authenticated` にもある。stores には tax_mode / tax_rate_dine_in / tax_rate_takeout / set_drink_enabled / set_drink_discount / kitchen_enabled / staff_call_enabled / info_rows が同居している。設定用の RPC（save_tax_setting / save_set_drink_setting / save_feature_toggles など）は関数内で `auth.jwt()->'app_metadata'->>'role' <> 'manager'` を弾いているが、テーブル直 UPDATE はその検査を通らない。緩和材料: 本番の auth.users は login@temma.me と yosuke.itakura@gmail.com の2件だけで、どちらも role='manager'。つまり **今日時点では悪用できるアカウントが存在しない**。register / kitchen / counter アカウントを作った瞬間に穴になる。
- **確認手順**: 1) `SELECT c.relname, p.polname, p.polcmd, pg_get_expr(p.polwithcheck, p.polrelid) FROM pg_class c JOIN pg_policy p ON p.polrelid=c.oid WHERE c.relname IN ('stores','menu_items','categories') AND p.polcmd='*';` で withcheck が true であることを確認。2) `SELECT email, raw_app_meta_data->>'role' FROM auth.users;` が manager 2件だけであることを確認（＝今は実害なし）。3) 明日までにスタッフ用アカウントを作らない、を運用の前提にする。作るなら先に stores の書き込みポリシーを manager 限定に絞る SQL が必要（＝CLAUDE.md 3章の「RLS の緩和/変更」に当たるので天真の OK を取ってから）。

#### [medium] テイクアウト対象の商品が本番に1件も無い。テイクアウトの二次元コード（/admin/tables の最上段）は刷れてしまうので、刷って置くと読んだお客様が空のメニューに着く。

- **根拠**: `SELECT count(*) FROM public.menu_items WHERE is_takeout;` = 0（カテゴリ別集計でも takeout 列が全カテゴリ 0）。app/order/takeout/page.tsx は `allMenuItems.filter((m) => m.isTakeout)` で絞るだけ。ハンバーガーメニュー側は docs/handoff.md:4088-4096 のとおり「テイクアウト（準備中）」で押せなくしてあるが、**二次元コードの URL（lib/qrCode.ts の tableOrderUrl(origin, null) ＝ パラメータ無しの `/`）はその判定を通らず、TopScreen の isTakeoutOnly=true で /order/takeout に直行する**。
- **確認手順**: 1) `SELECT count(*) FROM public.menu_items WHERE is_takeout;` が 0 であることを確認。2) ローカル dev を 390px で `http://localhost:3000/`（パラメータ無し）で開き、開始ボタンを押して /order/takeout に着き、商品が0件の空の画面になることを確認。3) /admin/tables の最上段「テイクアウト」カードのチェックを外して印刷する運用にするか、テイクアウト商品を登録するかを洋輔さんに確認する。

#### [medium] カテゴリの背景写真が15カテゴリすべて未設定。メニュー画面のカテゴリカードが全部白箱になる。

- **根拠**: `SELECT name, (image_url IS NOT NULL AND image_url <> '') AS has_image FROM public.categories;` の結果、15件すべて has_image=false。components/ui/MenuCategoryCard.tsx:41-48 に写真なし用の分岐（`bg-surface-white border border-border` ＋ 黒文字）があるので**壊れはしない**が、Figma の想定（写真＋25%黒オーバーレイ＋白文字）とは別物の見た目になる。あわせて menu_items の写真も ドリンク19件中13件が未設定。
- **確認手順**: 1) `SELECT name, slug, image_url FROM public.categories ORDER BY display_order;` で image_url が全件 NULL であることを確認。2) ローカル dev を 390px で /order/menu を開き、カテゴリカードが白箱で並ぶことをスクリーンショットで確認。3) `SELECT c.name, count(*) FILTER (WHERE m.image_url IS NULL OR m.image_url='') AS no_image, count(*) AS items FROM public.menu_items m JOIN public.categories c ON c.id=m.category_id GROUP BY c.name HAVING count(*) FILTER (WHERE m.image_url IS NULL OR m.image_url='') > 0;` で ドリンク 13/19 を確認。4) 明日までに写真を入れるか、白箱のままで行くかを天真に確認する（デザインの意思決定なので勝手に決めない）。

#### [medium] 厨房画面 OFF ＋ スタッフ呼び出し OFF。注文がホールに届く経路が厨房プリンタ1本しかない。

- **根拠**: 本番 public.stores: kitchen_enabled=false / staff_call_enabled=false。components/admin/nav/NavContent.tsx:61-63 が features.kitchen=false のとき /admin/kitchen をサイドバーから外す。lib/features.ts の冒頭コメントどおり印刷は止めていないので、注文は伝票にだけ出る。staff_call_options は3件（お水をください / お会計をお願いします / スタッフを呼ぶ）が is_active=true で登録済みだが、staff_call_enabled=false なのでお客様側の入口は全部消えている。printer_status.last_seen_at は 2026-09-15 17:21:20+00（＝JST 9/16 02:21）で、ブリッジは今日の未明まで生きていた。print_jobs は25件すべて status='done' で滞留なし。
- **確認手順**: 1) `SELECT kitchen_enabled, staff_call_enabled FROM public.stores;` が (false, false) であることを確認 → これが意図どおりか洋輔さんに再確認する。2) 開店直前に `SELECT last_seen_at, now() - last_seen_at AS age FROM public.printer_status;` を打ち、age が数分以内であることを確認（数時間なら印刷ブリッジが落ちている＝注文が誰にも届かない状態で開店することになる）。3) `SELECT status, count(*) FROM public.print_jobs WHERE created_at > now() - interval '1 day' GROUP BY status;` で queued/failed が溜まっていないことを確認。4) プリンタが落ちたときの代替として /admin/kitchen を一時的に ON に戻す手順（/admin/display > 機能設定 のトグル）を洋輔さんに事前共有しておく。

#### [low] anon（＝公開されている anon キーを持つ誰でも）が get_recent_item_counts を叩けて、直近14日の商品別の注文数量が取れる。

- **根拠**: 本番の proacl で `get_recent_item_counts` は `anon=X/postgres`、prosecdef=true、かつ関数本体に role チェックが無い（`SELECT oi.menu_item_id, SUM(oi.quantity) ... FROM public.order_items` を丸ごと返す）。Supabase の security advisor も 0028 anon_security_definer_function_executable として列挙している。同じく anon 実行可能な save_table_layout / save_brand_accent / save_best_sellers / save_store_media は、いずれも関数内に `auth.jwt()->'app_metadata'->>'role' IS DISTINCT FROM 'manager'` の検査があるので**書き込みは通らない**（本番の関数定義で1つずつ確認済み）。
- **確認手順**: 1) `SELECT p.proname, p.prosecdef, array_to_string(p.proacl::text[],' | ') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_recent_item_counts';` で anon=X が付いていることを確認。2) 関数本体に manager チェックが無いことを `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='get_recent_item_counts';` で確認。3) 明日の営業には影響しないので、営業後の宿題として扱う。

#### [low] anon ロールに menu_items / orders / stores 等の TRUNCATE 権限が付いている。

- **根拠**: `SELECT table_name, grantee, string_agg(privilege_type,',') FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon' GROUP BY 1,2;` の結果、best_sellers / categories / menu_item_options / menu_items / order_item_options / order_items / orders / staff_calls / store_media / stores の10テーブルで anon に DELETE,INSERT,SELECT,TRUNCATE,UPDATE が付いている。INSERT/UPDATE/DELETE は RLS ポリシー（anon には SELECT 系しか無い）で止まるが、**TRUNCATE は RLS の対象外**。ただし PostgREST は TRUNCATE を公開していないので、現状の HTTP API からは到達できない。多層防御の欠落であって、今日の攻撃面ではない。
- **確認手順**: 1) 上記の grants クエリを実行して TRUNCATE が anon に付いていることを確認。2) `SELECT c.relname, p.polcmd, array_to_string(ARRAY(SELECT pg_get_userbyid(r) FROM unnest(p.polroles) r),',') FROM pg_class c JOIN pg_policy p ON p.polrelid=c.oid WHERE c.relname='menu_items';` で anon に書き込みポリシーが無い（＝RLS で止まる）ことを確認。3) 営業後の宿題として `REVOKE TRUNCATE, INSERT, UPDATE, DELETE ON ... FROM anon;` を検討する（RLS の変更に当たるので天真の OK が必要）。

#### [low] ブランドカラーが未設定（stores.brand_accent = NULL）。

- **根拠**: 本番 public.stores の brand_accent は NULL。docs/handoff.md:3323 の章でオリーブモスをブランドカラーとして導入した経緯があり、landing_background 側には background_color='#5E6B4A' が入っている（store_media の landing_background 行）。つまり着地画面だけオリーブ、お客様画面のアクセントは既定色、という食い違いが起きうる。
- **確認手順**: 1) `SELECT brand_accent FROM public.stores;` が NULL、`SELECT slot, background_type, background_color, enabled FROM public.store_media;` で landing_background が color/#5E6B4A/enabled=true・order_hero が enabled=false であることを確認。2) ローカル dev で `/`（着地）と `/order`（TOP）を 390px で並べて撮り、アクセント色が揃っているか天真に見せて判断を仰ぐ（デザインの意思決定なので勝手に決めない）。

**調査時の注意**

- 本番DBに対して実行したのは SELECT と pg_catalog / information_schema の参照、および Supabase の security advisor 取得のみ。place_order をはじめ RPC は一度も呼んでおらず、INSERT / UPDATE / DELETE も行っていない。リポジトリのファイルは一切変更しておらず、コミットもしていない。
- set_drink_discount_for() は STABLE な純粋関数なので、金額の検証は SELECT だけで（注文を作らずに）再現できる。次に触る担当者もこの手段を使うこと。REST 経由で place_order を試すと本番に実データが残る（docs/handoff.md:4144 に前例あり）。
- docs/handoff.md:4194 の「注文が通らない ─ 本当の原因は卓だった」で入った修正（supabase/order_stale_table_id.sql と register の tableKey）は本番に両方入っていることを確認済み。ただしあれが救うのは「卓の行が消えたのに、同じラベルの卓が今もある」場合だけで、上の critical #1（ラベルごと消えた／前の卓の値がカートに残っている）は救われない。
- 本番の orders は25件すべて paid、print_jobs は25件すべて done で、明日に持ち越す滞留データは無い。
- auth.users は manager 2件（login@temma.me / yosuke.itakura@gmail.com）のみ。RLS の緩さ（risk: authenticated 全書き込み）は、スタッフ用の register / kitchen / counter アカウントを作らない限り実害に至らない。
- Supabase の security advisor で auth_leaked_password_protection が無効との警告あり（管理画面のログインは共有アカウント運用）。営業には影響しないが、パスワード強度の担保が無い点は記録しておく。

### 伝票がプリントされるか（厨房プリンタ EPSON TM-m30III-H / サーバーダイレクトプリント）

**重要経路**

- **注文 → 印刷ジョブが積まれる** — orders への AFTER INSERT トリガー trg_orders_enqueue_print_job（本番で有効を確認）が print_jobs に1行積む。例外は握りつぶす設計なので、ここが壊れても注文は通る＝伝票だけ静かに出なくなる。order_id に UNIQUE があるので二重投入はしない。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`
- **プリンタのポーリング → ジョブ受け渡し** — プリンタが約5.8秒おきに POST /yorkys-shukugawa/api/print/<token> を叩く。route が printer_poll()（生存記録15秒間引き＋2分放置ジョブの回収＋claim）を1往復で呼び、ePOS-Print XML を返す。実測: 直近24時間で printer_poll 14,805回・全件200・1時間も欠けなし（Supabase edge_logs）。ここが今の本番の生命線。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/print/[token]/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/printer_status.sql`
- **伝票の版面を組み立てる** — claim_print_job() が返す JSON（卓ラベル・受渡番号・明細・提供タイミング・オプション・枚数設定）から ePOS-Print XML を作る。本番の関数定義は supabase/receipt_copies.sql と一致することを pg_proc で確認済み。金額は一切刷らない設計。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/receipt.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/receipt_copies.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dateFormat.ts`
- **印刷結果の報告 → done / 再挑戦 / 失敗** — SetResponse を受けて complete_print_job()。成功で done、失敗は pending に戻すが attempts>=5 で failed に固定（本番の関数ソースで確認）。ここが復旧可否を決める分岐。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/print/[token]/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql`
- **店舗が異常に気づく唯一の導線 /admin/print** — プリンタ生存・未印刷・失敗・刷り直し・伝票枚数の設定が全部ここにしかない。厨房画面（/admin/kitchen）には print への参照がゼロ（grep で確認）＝この画面を人が開かない限り、伝票が出ていないことは誰にも通知されない。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/print/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/printStatus.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/admin/print/PrintJobRowCard.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/admin/print/PrinterHealthCard.tsx`
- **トークン認証とサーバー鍵** — URLパスの推測不能トークン（本番48文字）を timingSafeEqual で照合。未設定なら503、不一致なら404。DB接続は SUPABASE_SERVICE_ROLE_KEY（RLS素通り）。どちらが欠けても伝票は1枚も出ない。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/print/[token]/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/daily-report/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dailyReport.ts`

**リスク**

#### [critical] 紙切れ・カバー開き・カッター異常が管理画面に出ない（プリンタの状態通知が本番で一度も届いていない）

- **根拠**: 本番DB: printer_status.last_status_at = NULL / status_note = NULL（store 10000000-...-0001）。Supabase edge_logs の直近24時間で /rest/v1/rpc/record_printer_status の呼び出しは0件（printer_poll は14,805件）。lib/printStatus.ts:describePrinterHealth() は statusNote が無ければ health='ok'「正常に動いています」を返すので、紙が無くてもポーリングさえ続けば緑のまま。異常の唯一の露出は失敗ジョブの last_error（/admin/print の「出ていない伝票」）だけで、厨房画面には print の参照がゼロ（grep: app/admin/(protected)/kitchen/page.tsx に print 該当なし）。
- **確認手順**: ① 明日の開店前、プリンタの紙を抜いた状態（またはカバーを開けた状態）で /admin/print を開き、上部カードが「正常」のままか「要対応」に変わるかを目視する。緑のままなら本項目は確定。② 同時に本番ログで確認する: Supabase MCP の query_logs に対し source='edge_logs' で log_attributes['request.path']='/rest/v1/rpc/record_printer_status' を24時間集計し、0件であることを見る。③ 0件なら、プリンタ設定画面（Web Config → サーバーダイレクトプリント）の「ステータス通知」を有効にし、通知先URLを印刷と同じ <本番ホスト>/yorkys-shukugawa/api/print/<token> にすると、以後 last_status_at が入る。

#### [critical] 印刷失敗が5回で 'failed' に固定され、紙を替えても自動では出ない。しかも画面は「自動で印刷されます」と案内している

- **根拠**: supabase/print_jobs.sql の complete_print_job（本番の pg_proc.prosrc と一致）: MAX_ATTEMPTS=5、attempts>=5 で status='failed'。claim_print_job は claim のたびに attempts を +1 し、reclaim_stale_print_jobs は status を pending に戻すだけで attempts をリセットしない。ポーリング実測は約5.8秒間隔（edge_logs 628回/時）なので、失敗を返し続けると約30秒で failed に到達する。failed を戻す経路は requeue_print_job（/admin/print の「刷り直す」）のみで自動復帰は無い。一方 lib/printStatus.ts:88 と :95 の detail は「復旧すれば、たまっている伝票は自動で印刷されます」「解消すると、たまっている伝票は自動で印刷されます」と書いている。
- **確認手順**: 開店前に実機で: ① 紙を抜く → テスト注文を1件入れる → 30〜60秒待つ → /admin/print の「出ていない伝票」でその行が「失敗」になるか「未印刷」のままかを見る。② 紙を戻して2分待ち、伝票が自動で出るか確認する。③ 出ない場合は該当行の「刷り直す」を押して出ることを確認する。④ DB側の確認は SELECT id,status,attempts,last_error,claimed_at FROM public.print_jobs ORDER BY created_at DESC LIMIT 5;（SELECT のみ）で status='failed' と attempts を見る。

#### [high] 印刷済み（done）の伝票を画面から刷り直せない。紙詰まり・伝票の紛失・レシート台からの落下に対して復旧手段がない

- **根拠**: components/admin/print/PrintJobRowCard.tsx の canRequeue = job.status !== "done"。/admin/print の「最近印刷した伝票」は done のみを並べるので、そこには「刷り直す」ボタンが1つも出ない。RPC 側（requeue_print_job）は job の status を問わず戻せるため、これはUIだけの制約。
- **確認手順**: /admin/print を開き、「最近印刷した伝票」セクションの任意の行に「刷り直す」ボタンが表示されないことを目視する（PC 1400px）。回避策の確認は本番DBを書き換えるので実施しないこと。明日どうしても必要になった場合は、店から番号を聞いた上で人間が SQL Editor で UPDATE public.print_jobs SET status='pending', attempts=0, last_error=NULL WHERE id='...'; を流す運用になる、という前提で手順を用意しておく。

#### [high] ローカルの dev サーバー＋ニセ・プリンタが本番の伝票を食う（画面上は「印刷済み」、紙は出ない）

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/.env.local の NEXT_PUBLIC_SUPABASE_URL は oiropkuvaenebmlicrac.supabase.co（＝本番）で、SUPABASE_SERVICE_ROLE_KEY と PRINT_ENDPOINT_TOKEN も入っている。scripts/fake-printer.mjs は既定で http://localhost:3000/api/print/<token> を叩き（scripts/fake-printer.mjs の URL_ 定義）、ローカル dev の route.ts:71 はその本番キーで printer_poll を呼ぶ。つまり `npm run dev` を上げて `node scripts/fake-printer.mjs` を走らせるだけで、店のジョブを claim → SetResponse(success) → status='done' にしてしまう。紙は店で1枚も出ない。
- **確認手順**: 明日は開発端末で `node scripts/fake-printer.mjs`（--render 以外）を実行しないこと。すでに動いていないかの確認は `ps aux | grep fake-printer`。事後確認は本番DBで SELECT id,claimed_at,printed_at, extract(epoch from (printed_at-claimed_at)) FROM public.print_jobs WHERE created_at > now()-interval '1 day' ORDER BY created_at DESC; を実行し、店で紙が出ていないのに done になっている行が無いかを突き合わせる。

#### [medium] 印刷結果の紐づけが「status='printing' の最古1件」なので、printing が同時に2件あると取り違えて、実際には出ていない伝票が done になる（黙って消える）

- **根拠**: app/api/print/[token]/route.ts:161-166 — .from("print_jobs").select("id").eq("status","printing").order("claimed_at",{ascending:true}).limit(1)。store_id での絞り込みも printjobid も無い（PrintRequestInfo Version="1.00" を使っているため printjobid が返らない旨は lib/receipt.ts の buildPrintRequest コメントに記載）。printing が同時に2件になる条件は、SetResponse が届かなかった／関数がタイムアウトした直後に次の GetRequest が来た場合で、回収は2分後（reclaim_stale_print_jobs の RECLAIM_AFTER=interval '2 minutes'）。現状の本番は全25件が attempts=1 で発生痕跡なし。
- **確認手順**: 営業中または営業後に SELECT count(*) FROM public.print_jobs WHERE status='printing'; を数回実行し、2以上になる瞬間が無いかを見る。事後の検知は SELECT id,status,attempts,claimed_at,printed_at FROM public.print_jobs WHERE created_at::date = current_date AND (attempts > 1 OR printed_at IS NULL) ORDER BY created_at; で、attempts>1 の行（＝回収が走った行）を洗い出し、店に「同じ伝票が2枚出たか／出なかったか」を確認する。

#### [medium] /admin/print の一覧が直近50行だけなので、失敗した伝票が新しい注文に押し出されて画面から消える

- **根拠**: app/admin/(protected)/print/page.tsx: RECENT_LIMIT=20、クエリは .limit(RECENT_LIMIT + 30)（=50）を created_at desc で取得し、その50行から waiting = status!=='done' を絞っている。1日100件の想定では同日中に50件を超えるため、朝に失敗した伝票は昼には一覧から消える。TopBar の「未印刷 N件」も同じ50行から数えている。
- **確認手順**: 本番DBで SELECT count(*) FROM public.print_jobs WHERE created_at::date = current_date; を実行し、50を超えた時点で /admin/print を開き、その日いちばん古い失敗／未印刷ジョブ（SELECT id,status,created_at FROM public.print_jobs WHERE status IN ('pending','failed') ORDER BY created_at LIMIT 1; で特定）が画面の「出ていない伝票」に載っているかを突き合わせる。

#### [medium] 卓が作り直された注文（table_id が NULL）は「新規／追加(N)」の採番が他の卓と合流する

- **根拠**: supabase/print_jobs.sql:print_job_seq_for_order() のグループキーは COALESCE(table_id::text, 'n:' || COALESCE(table_number,0))。2026-09-16 の order_stale_table_id.sql で、消えた卓は同ラベルに付け替え、見つからなければ table_id=NULL・table_label だけ残す仕様になった。本番には既に該当行がある: orders 0559ed87-a3bd-48ac-a890-a847e47eaccc（table_id=NULL / table_number=0 / table_label='ソファ席 A-1' / business_date=2026-09-16）。同日に別の卓でも NULL が出ると、両者が 'n:0' で同じ束になり、新しいお客様の1枚目に「追加(2)」と刷られる。
- **確認手順**: 営業後に SELECT table_label, count(*) FROM public.orders WHERE table_id IS NULL AND business_date = current_date GROUP BY table_label; を実行し、2種類以上のラベルが出たら発生。伝票側は SELECT j.seq, o.table_label, o.created_at FROM public.print_jobs j JOIN public.orders o ON o.id=j.order_id WHERE o.table_id IS NULL AND o.business_date=current_date ORDER BY o.created_at; で、卓が違うのに seq が連番になっていないかを見る。

#### [medium] 印刷経路のエラーがどこにも通知されない（Sentry にも上がらない）

- **根拠**: app/api/print/[token]/route.ts は DBエラー時も 200 + 空ボディを返す（:130-133 ジョブ取得失敗、:169-170 印刷中ジョブ特定失敗、:185-186 結果記録失敗）。記録は console.error のみ。instrumentation.ts は onRequestError = Sentry.captureRequestError だけで、ルートが例外を投げない限り Sentry へは何も飛ばない（Sentry.captureException の呼び出しは print 経路に無い）。つまり Supabase 障害中は「プリンタは正常・伝票は出ない・アラートなし」になる。
- **確認手順**: Vercel のログで確認する: プロジェクト yorkys-orderly の Runtime Logs を /api/print で絞り、"[print] ジョブの取得に失敗" "[print] 印刷結果の記録に失敗" "[print] 状態通知の記録に失敗" を検索する。Sentry 側は Issues に print 由来のイベントが1件も無いことを確認すれば、通知が無いことの裏が取れる。

#### [medium] 印刷トークンが単一・URLパス埋め込みで、失効には店舗でのプリンタ再設定が必要

- **根拠**: app/api/print/[token]/route.ts:82-89（PRINT_ENDPOINT_TOKEN と timingSafeEqual、不一致は404）。本番の .env.local 上のトークン長は48文字。ローテーション手段はコードに無く、Vercel の環境変数を変えた瞬間にプリンタ側は404を返され続ける（＝伝票停止）。漏れた場合、第三者は GetRequest で注文内容（品名・数量・卓・時刻）を読め、ジョブを claim して done にできる＝店の伝票を止められる。URL は Vercel のリクエストログにパスとして残る。
- **確認手順**: Vercel のダッシュボードで Environment Variables の PRINT_ENDPOINT_TOKEN が Sensitive 扱いか、値が Production のみに入っているかを確認する。漏洩が疑われる場合の手順（実行は人間）: 新トークンを Vercel に入れる → 再デプロイ → 店でプリンタの Web Config のURLを新トークンに書き換える、の順。逆順にすると伝票が止まる。

#### [medium] SUPABASE_SERVICE_ROLE_KEY が Vercel で平文（Non-sensitive）のまま。欠落すると伝票が1枚も出ない

- **根拠**: 使用箇所は app/api/print/[token]/route.ts:71、app/api/daily-report/route.ts:37、lib/dailyReport.ts:27 の3か所のみ（リポジトリ全文 grep で確認。クライアントバンドルには入らない）。無い場合 route.ts:94-95 で 503 を返し、プリンタは何も受け取れない。docs/handoff.md:4174-4190 に「Vercel が Needs Attention を出している。Sensitive へ付け替えるのは天真の作業。AI はやらない」と記録あり（2026-09-15・未対応）。
- **確認手順**: Vercel ダッシュボード → yorkys-orderly → Settings → Environment Variables で SUPABASE_SERVICE_ROLE_KEY が Production に存在し Sensitive になっているかを目視。欠落の即時検知は、ニセ・プリンタを本番URLに向けず、代わりに /admin/print の上部カードが「停止」に変わるか（printer_poll が通らなくなると last_seen_at が更新されないため60秒で赤くなる）で判断する。

#### [low] 伝票枚数が 'two'（毎回2枚）なので、1ジョブ＝2枚ぶんの印字。途中で紙が尽きるとジョブ全体が失敗し、刷り直すと必ず2枚出る

- **根拠**: 本番 stores.receipt_copies='two'（SELECT で確認、YORKYS BRUNCH）。lib/receipt.ts:receiptCopies() が 'two' で [{厨房伝票 1/2},{厨房伝票 2/2}] を返し、buildReceiptXml() が1つの <epos-print> の中で2回組み立てて2回 <cut> する。実データ（job 136deac4、テーブル席 A-1、4品）を lib/receipt.ts でレンダリングして2枚出力・見出し・カットを確認済み。
- **確認手順**: 開店前のテスト注文で、紙が2枚（1/2 と 2/2）カットされて出ることを目視。1枚しか出ない場合は /admin/print 最下部の「伝票の枚数」が「2枚（毎回）」になっているかを確認する（SELECT name, receipt_copies FROM public.stores; でも可）。

#### [low] 商品名に含まれる波ダッシュ 〜（U+301C）が実機で文字化けする可能性

- **根拠**: 本番 menu_items に U+301C（ascii()=12316）を含む商品が3件: 「マルゲリータ 〜モッツァレラとバジルのピッツア〜」「オルトラーナ 〜…〜」「クアトロフォルマッジョ 〜4種チーズと栗のはちみつのピッツア〜」。lib/receipt.ts は <text lang="ja"/> を指定して UTF-8 のまま送るため、プリンタ側の日本語コードページ変換に依存する（U+301C は CP932 の変換表に無く、U+FF5E ～ が 0x8160 に当たる系の実装が多い）。ニセ・プリンタは変換を模していないので検出できない。
- **確認手順**: 開店前に「マルゲリータ」を1品だけ入れたテスト注文を出し、紙の上で 〜 が正しく出るか（? や空白・別記号になっていないか）を目視。化けていたら /admin/menu で商品名の 〜 を ～（U+FF5E）に置き換えれば直る（データ変更なので天真の判断を取ること）。

#### [low] プリンタのURLに basePath /yorkys-shukugawa が含まれる。環境変数や独自ドメインを触ると一斉に伝票が止まる

- **根拠**: next.config.mjs:16,33 — NEXT_PUBLIC_BASE_PATH があるときだけ basePath を付与。docs/handoff.md に「YORKYS本番 NEXT_PUBLIC_BASE_PATH=/yorkys-shukugawa」。よって実際の受け口は <ホスト>/yorkys-shukugawa/api/print/<token>。ローカルの .env.local には NEXT_PUBLIC_BASE_PATH が無い（接頭辞なし）ので、ローカルで確かめたURLをそのまま実機に入れると404になる。next.config.mjs の redirects に /api を拾うものは無いことは確認済み。
- **確認手順**: プリンタの Web Config に入っているURLを読み、/yorkys-shukugawa/api/print/ を含むことを確認する。サーバー側の生存は /admin/print の上部カードが「正常・最後の応答はたった今」であることで足りる。

#### [low] ポーリングが1日15,000回ほど Vercel の関数実行を消費している

- **根拠**: Supabase edge_logs で /rest/v1/rpc/printer_poll が24時間 14,805回（毎時 619〜630回、深夜も途切れなし）。1回につき Vercel の Node 関数が1回起動する。プリンタは24時間ポーリングを続けており、閉店中も止まらない。
- **確認手順**: Vercel ダッシュボード → yorkys-orderly → Usage で Function Invocations の推移と、プランの上限に対する余裕を見る。上限に当たると全ページが止まるため、余裕が薄い場合はプリンタ側の Interval を 3〜5秒から 10秒へ延ばす（伝票が出るまでの遅れは最大10秒になる）。

**調査時の注意**

- 読み取りのみで実施した。リポジトリのファイルは1つも変更していない。書いたのは scratchpad の3ファイル（render-receipt.cjs / job.json / receipt.xml）だけで、リポジトリ外。
- 本番DBに対して行ったのは SELECT と pg_catalog の参照のみ。place_order / claim_print_job / printer_poll / requeue_print_job / complete_print_job などの RPC は一切呼んでいない。print_jobs・orders・stores への書き込みなし。
- 伝票の中身の検証は、既存の注文（job 136deac4-8c33-4bb1-b3db-3815eac3c9c2）の claim ペイロードを SELECT だけで再現し、lib/receipt.ts をローカルで実行して紙面を描かせる方法を取った。ジョブを claim していないので本番のキューは動かしていない。
- 秘密情報は出力していない。.env.local は変数名と本番 Supabase のホスト名（NEXT_PUBLIC で公開前提）、トークンの文字数のみを確認し、値は読み出していない。
- 結論として、伝票の中身は注文と一致していた: 卓ラベル（テーブル席／A-1 の2段）・受付時刻（JST 変換 09/15 16:01 が UTC 07:01 と一致）・提供タイミング（でき次第／先出し／食後は黒帯）・オプション（＋HOT）・合計点数（4点＝SUM(quantity)）・2枚出し（1/2・2/2）まで実データで確認。長い品名（37文字）・2桁数量・テイクアウトの受渡番号でも版面は崩れなかった。
- 金額については、厨房伝票に金額・割引・税は一切印字されない（天真の決定 2026-08-20、lib/receipt.ts の設計）。検証した注文は total_amount=4422 / discount_amount=400 だったが、claim_print_job の返り値に金額の項目自体が無い。お客様向けの金額入りレシートは未実装で、docs/share/2026-09-14-receipt-printer.html の3案（レジ用プリンタの選定）が洋輔さんの判断待ちの段階。明日のレジのレシートは Square 側になる。
- 明日の朝の動作確認の推奨手順（この順で実施すると切り分けが効く）: ①プリンタ単体の自己診断（電源OFF→給紙ボタンを押しながらON）で紙・カッター・印字ヘッドを確認する。②/admin/print を開き上部カードが「正常・最後の応答はたった今」であることを確認する（サーバーとプリンタの往復が生きている証明）。③実機の端末で二次元コードから入り直して1件テスト注文を出し、2枚（厨房伝票 1/2・2/2）が10秒以内に出ることを確認する。④その伝票で、卓名・時刻・提供タイミング・トッピングが注文と一致することを目視する。⑤紙を抜いてもう1件テスト注文を出し、30〜60秒後に /admin/print で「失敗」になるか、紙を戻して自動で出るかを確認する（出なければ「刷り直す」を押す運用を朝礼で共有する）。⑥テスト注文はレジで会計済みにして当日の売上から外す。⑦アプリ側にテスト印刷の機能は存在しないため（grep で確認）、③のテスト注文が唯一の通し確認手段になる。

### お客様の画面（/order 配下・/cart・/complete・/history・ItemDetailOverlay・components/ui）

**重要経路**

- **QR読み取り → 卓の確定 → 注文開始** — 卓が確定しないまま注文が通ると、厨房の伝票とレジに卓名が出ない／前回の卓名が付く。resolveTable が失敗しても『注文をはじめる』は開く。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/top/TopScreen.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`
- **退店ガード（VisitClosedGate）の通過** — ここで誤判定すると、お客様は1品も注文できない。/order と /cart の両方をこのガードが包んでいる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/visitSession.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/ui/VisitClosedGate.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/order/layout.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/cart/layout.tsx`
- **一覧のステッパー（下書き）→「カートに入れる」→ カート** — 今日いちばん手が入った経路。下書きの数量・オプション必須商品の分岐・カード幅がここに集中している。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/hooks/useDraftQuantities.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/order/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/order/[category]/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/order/takeout/page.tsx`
- **商品詳細ハーフモーダル（開閉・スワイプ・おすすめ・CTA切替）** — 今日新規に入れたばかりで検証が浅い。HOT/ICEDの確定がここでしか行われない。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/order/ItemDetailOverlay.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/itemOverlay.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/ui/RecommendCard.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/ui/Buttons.tsx`
- **カート → 注文を確定する → /complete** — 最後の1タップ。ここが押せない／二重になると営業が止まる。二度押し防止と失敗時の扱いは実装済み。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/cart/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/complete/page.tsx`
- **メニューの取得（menuDataStore）とオプションの取得** — オプションが取れないと HOT/ICED を選ばせずにカートへ入る。メニューが取れないと画面が真っ白になる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/menuDataStore.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/api.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/menuOptions.ts`

**リスク**

#### [high] 【幅375px未満】2列グリッドのカードが左右で重なり、左のカードの「カートに入れる」の右端を押すと右の商品がカートに入る

- **根拠**: components/ui/MenuCard.tsx:154 が w-[171px] 固定、app/order/[category]/page.tsx:177 と app/order/takeout/page.tsx:142 が `grid grid-cols-2 justify-items-center gap-y-[16px] px-[var(--space-16)]`（列のgapが無い）。列幅は (vw-32)/2 なので vw<374 でカードが列からはみ出す。ローカル dev の実測: 320px → 左カード l=3 r=174 / 右カード l=147 r=318（27px 重なり）、360px → 左 l=12.5 r=183.5 / 右 l=176.5 r=347.5（7px 重なり）。ボタンも同じ量だけ重なり、DOM で後ろにある右カードが当たり判定を取る。171 は「390px 専用」の数値（同ファイル冒頭のコメントに 171 =(390−16×2−16)÷2 とある）。Android の 360px 幅は実機で非常に多い。
- **確認手順**: dev サーバ（http://localhost:3000）で /order/pancake を開き、ブラウザの幅を 320px と 360px にして次を実行する: `[...document.querySelectorAll('.grid > div')].slice(0,2).map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right]})` 。1つ目の right が 2つ目の left より大きければ重なっている。390px では重ならないことも同じ手順で確認する。

#### [high] 【退店ガードの誤作動】過去に会計済みの注文が端末に残っていると、新しいご来店の入口でいきなり「ご注文ありがとうございました／お会計が完了しました」が出て1品も注文できない

- **根拠**: lib/visitSession.ts:76-88 は loadHistory()（lib/history.ts:13 MAX=30、日付での絞り込みなし）の全注文IDを get_order_statuses に投げ、`rows.every(r=>r.status==='paid')` で締める。lib/visitSession.ts:58-63 の beginVisit() は **既に締まっているときしか** 履歴を消さないので、前回の来店がフラグ未設定のまま終わった端末は古い注文を持ち越す。本番DB（oiropkuvaenebmlicrac）の orders は現在 **25件すべて status='paid'**（2026-09-14〜09-15、すべて dine_in）。get_order_statuses は created_at > now()-90days を返すので、9/14-15 に検証で使った洋輔さん・天真さん・スタッフの端末は明日この条件に一致する。VisitClosedGate は /order と /cart の両方を包む（app/order/layout.tsx:29、app/cart/layout.tsx:14）。
- **確認手順**: dev サーバで http://localhost:3000/ を開き DevTools の Console で `localStorage.removeItem('orderly_visit_closed'); localStorage.setItem('yorkys_order_history', JSON.stringify([{orderId:'<本番の paid な注文ID>',orderedAt:new Date().toISOString(),items:[],status:'paid',tableNumber:1,orderType:'dine_in',totalAmount:0}]))` を実行し、その後 /order を開く。15秒以内に「ご注文ありがとうございました」が出れば再現。本番の注文IDは `select id from orders where status='paid' limit 1;`（SELECTのみ）で取れる。

#### [high] 【詳細シート】「カートに入れる」を押したあとに HOT→ICED を選び直しても入れ直せず、カートには最初に押したほう（HOT）だけが残る

- **根拠**: components/order/ItemDetailOverlay.tsx:592 で setAdded(true)。added を false に戻すのは同ファイル 147-164 の `[itemId]` の effect だけで、オプション変更（473行 onChange={setDraftOptionIds}）も数量変更（568-569行）も added を戻さない。added=true の間、上の段は 555-557 行で opacity-0 + pointer-events-none になり、押せるのは「カートを見る」だけ。一方オプションのラジオは操作可能なまま（ローカルで ICED をクリックすると aria-checked が true に変わることを確認済み）で、455-457 行の価格表示も更新されるため、お客様には切り替わったように見える。本番には HOT/ICED が single 選択の商品が12件ある（アメリカーノ・カフェラテ・カフェモカ・キャラメルマキアート・マキアート・アールグレイティー・ロイヤルミルクティー・ほうじ茶ラテ・ほうじ茶ショコララテ・抹茶ラテ・抹茶ホワイトモカラテ ほか）。
- **確認手順**: 390px 幅で http://localhost:3000/order?item=4d88fec5-2667-4ac6-b3ef-ac1ea8d6e937 （カフェラテ）を開く → 下部の「カートに入れる ¥660」を押す → 下部が「カートを見る」に変わる → 本文の「ICED」を押す（ラジオが ICED に移ることを目視） → /cart を開き、行の下に「＋HOT」と出ていれば再現。

#### [high] 【文言】関連のおすすめカードとカート画面のカテゴリタグに、日本語ではなく英語の slug（drink / hamburger / eggsbenedict など）がそのまま出る

- **根拠**: components/ui/RecommendCard.tsx:38 `const label = SUBCATEGORY_LABEL[item.subcategory] ?? item.subcategory;` と app/cart/page.tsx:290 `categoryLabel={SUBCATEGORY_LABEL[ci.item.subcategory] ?? ci.item.subcategory}` が、DB を見る resolveCategoryLabel(categories, slug)（lib/categoryLabels.ts:62）ではなく固定辞書 SUBCATEGORY_LABEL（同 10-22行）を使っている。本番のカテゴリ slug は pancake / brekkie / eggsbenedict / toast / hamburger / frenchflies / acaibowl / salad / pasta / pizza / rice / drink / alcohol / kids の14件で、辞書に載っているのは pancake と alcohol の2件だけ。ローカル実測: 詳細シートの「関連のおすすめ」4枚がすべてタグ「drink」、カート画面のカフェラテの行のタグも「drink」（同じ商品でも詳細シート本体のタグは resolveCategoryLabel を通るので「ドリンク」と出ており、画面内で不一致）。これは 2026-09-15 にハンバーガーメニューで直したのと同じ種類の直し漏れ（docs/handoff.md「1. ハンバーガーメニューにカテゴリーが2つしか出ない」）。
- **確認手順**: 390px で http://localhost:3000/order?item=4d88fec5-2667-4ac6-b3ef-ac1ea8d6e937 を開いて下までスクロールし、RECOMMENDED のカードのタグが「drink」になっていることを目視。次に /cart を開き、ドリンクの行のタグが「drink」になっていることを目視。Console なら `[...document.querySelectorAll('[role=dialog] section')].pop().innerText` で確認できる。

#### [medium] 【数量】一覧でステッパーを3にしてから「カートに入れる」を押すと、オプションのある商品では黙って1個に戻る（お客様が3個頼んだつもりで1個しか入らない）

- **根拠**: app/order/page.tsx:132-140 / app/order/[category]/page.tsx:143-151 / app/order/takeout/page.tsx:79-86 が `if (needsDetail(item)) { openItemDetail(item.id); return; }` で下書き数量を渡さずに詳細を開く。詳細側は components/order/ItemDetailOverlay.tsx:154 で必ず setDraftQty(1)。本番でオプションが有効な商品は14件（ドリンク12・グリーンサラダボウル・トリプルベリーアサイーボウル）。一覧には戻らないので、下書きの3は表示ごと消える。
- **確認手順**: 390px で http://localhost:3000/order/drink を開き、「その他」の中の「カフェラテ」の行の ＋ を2回押して 3 にしてから「カートに入れる」を押す。詳細シートが開いたときステッパーが 1 になっていれば再現。

#### [medium] 【メニュー取得失敗】categories/menu_items の初回取得が失敗すると、エラー表示も再試行ボタンも無い真っ白なメニューになる

- **根拠**: lib/menuDataStore.ts:95-98 は catch で `set({loading:false, error:String(e)})` とするだけで loadedAt を入れない。app/order/page.tsx:94 経由の hooks/useOrderPageData.ts:102 は `loading = storeLoading && !storeLoaded` なので、失敗後は loading=false・categorySections=[] になり、ヘッダーと空の main だけが描画される。`error` を読んでいる画面はお客様側に1つも無い（app/order・app/cart・components/ui を grep して 0 件）。fetchAll を呼び直す導線も無い（呼ぶのは各ページの mount 時のみ）。
- **確認手順**: Chrome DevTools の Network タブで `Block request URL` に Supabase の REST ホスト（*.supabase.co/rest/*）を追加してから http://localhost:3000/order をリロードする。ヘッダーだけの白い画面になり、エラーも再読み込みの案内も出ないことを確認する。

#### [medium] 【Chrome(iOS)】/cart と /complete が h-[100dvh] のまま。ツールバーの出入りで「注文を確定する」が画面の下に隠れて押せない可能性がある

- **根拠**: app/cart/page.tsx:221 `h-[100dvh] flex flex-col` で footer（注文ボタン）は shrink-0 の最下段、app/complete/page.tsx:103 も同じ。今日、詳細シートではまさにこの理由で dvh を捨てて window.visualViewport の実寸に切り替えている（components/order/ItemDetailOverlay.tsx:178-203 のコメント「100dvh を信用しない。Chrome(iOS) は下のツールバーが引っ込むと、100dvh が実際に見えている高さとずれる」、docs/handoff.md「追補2」）。同じ器の作りが /cart と /complete には残っている。ローカルの Chromium では 100dvh=844 で正常なので、机上では再現しない。
- **確認手順**: 実機の iPhone の Chrome で本番（app.good-order.jp）の /cart をカートに商品がある状態で開き、上下にスクロールしてツールバーを引っ込めた状態で「注文を確定する」が画面内に残っているか、下に隙間や見切れが出ないかを目視する。Safari と Chrome の両方で確認すること。

#### [medium] 【卓の取り違え】?t=<short_code> の解決に失敗すると、前回の来店の卓ラベルを付けたまま注文できてしまう

- **根拠**: components/top/TopScreen.tsx:44-63: `const t = await resolveTable(...)` が null のとき、新形式（shortCode あり・legacyNumber null）では if も else if も通らず setTableRef が呼ばれない。それでも 60行目で setTableResolved(true) するのでボタンが開く。lib/tables.ts:170-173 は RPC のエラー時に console.error して null を返すだけ。cart ストアの tableId/tableLabel/tableNumber は localStorage（orderly-cart）に永続化されているので、同じ端末の前回の卓が残る。画面の卓名は「—」になるが、注文はそのまま通る。本番の tables は11件・short_code はすべて設定済み・重複なしなので、通信断か RLS 変更が引き金。
- **確認手順**: DevTools の Network で `resolve_table` を含むリクエストをブロックしてから http://localhost:3000/?t=<実在の short_code> を開く。TOP の卓名が「—」なのに「注文をはじめる」が押せること、その後 Console で `JSON.parse(localStorage.getItem('orderly-cart')).state.tableLabel` に前回の卓ラベルが残っていることを確認する。short_code は `select short_code from tables limit 1;`（SELECTのみ）で取れる。

#### [medium] 【幅320px】詳細シートの CTA が「カートに入…」で切れ、金額が完全に見えなくなる

- **根拠**: components/order/ItemDetailOverlay.tsx:582-584 の CTA は `flex-1 min-w-0 max-w-[190px]` で、components/ui/Buttons.tsx:31 のラベルは overflow-hidden + text-ellipsis。320px 実測: ラベルの scrollWidth=144 に対し clientWidth=96 で「カートに入れる ¥660」が「カートに入…」になる（カート48 + gap12 + ステッパー124 + gap8 + 左右padding32 = 224 しか残らない）。金額は本文側（455行）に別途出ているので致命ではないが、今日「押す前に必ず金額が見える」ことを狙って入れた表示がいちばん狭い端末で効かない。
- **確認手順**: 320px 幅で http://localhost:3000/order?item=4d88fec5-2667-4ac6-b3ef-ac1ea8d6e937 を開き、Console で `const s=document.querySelector('[role=dialog] .border-t button.btn-pill').firstElementChild; [s.scrollWidth, s.clientWidth, s.innerText]` を実行。scrollWidth > clientWidth なら省略が出ている。

#### [medium] 【写真の無いドリンク13件】一覧の行に空のグレーの四角（サムネ枠）が縦に並ぶ

- **根拠**: app/order/[category]/page.tsx:105 と app/order/page.tsx:244 の showThumb は「そのカテゴリーに1枚でも写真があるか」で決まる。ドリンク（19件中13件が写真なし、アルコール7件は写真あり）では true になり、components/ui/MenuListRow.tsx:55-71 の 56px 枠だけが bg-bg-tertiary で残る。ローカル実測: /order/drink の「その他」の先頭3行（アメリカーノ・カフェラテ・マキアート）とも img 要素が無く、空のグレー枠だけ。docs/handoff.md 自身が「灰色の空箱に帯だけが乗ると『画像の読み込みに失敗した』ように見える」と書いているのと同じ見え方になる。
- **確認手順**: 390px で http://localhost:3000/order/drink を開き「その他」まで下げて目視。Console なら `[...document.querySelector('#section-drink__other').querySelectorAll('.border-b')].slice(0,3).map(e=>!!e.querySelector('img'))` が [false,false,false] になる。

#### [medium] 【長時間タブを開きっぱなし】メニューが一度も取り直されず、売り切れ・価格・オプションの変更が届かないまま注文して弾かれる

- **根拠**: lib/menuDataStore.ts:54-58 の fetchAll は各ページの mount 時のみ。Realtime（同106-131行）は **menu_items の INSERT/UPDATE/DELETE だけ**で、categories と menu_item_options は購読していない。visibilitychange / online での取り直しはコード全体に存在しない（lib・hooks・components・app を grep して0件）。iOS がバックグラウンドで WebSocket を切った場合、その間の売り切れ変更は取りこぼす。最後の砦はサーバ側（place_order が売り切れを弾く）なので事故にはならないが、お客様には「注文できません」のアラートが出る。
- **確認手順**: 390px で /order を開いたまま、管理画面（別ブラウザ）で任意の商品を売り切れにする → お客様側の画面で SOLD OUT が付くかを見る。次に、お客様側のタブを別アプリに切り替えて数分置いてから戻し、その間に別の商品を売り切れにして、戻したあとに反映されるかを見る。反映されなければ取りこぼしが再現している。

#### [low] 【詳細シート】中身が先頭にあるとき、おすすめカルーセルを横スワイプすると指が少し下にぶれただけで横スクロールが効かず、シートが下がる

- **根拠**: components/order/ItemDetailOverlay.tsx:283-300 の onMove は dy>0 なら無条件に e.preventDefault() する（listener は passive:false）。開始条件は scrollRef.scrollTop===0 だけ（277行）で、対象はシート全体（sheetRef, 266行）。カルーセル側に touch-action の指定は無い（実測 touchAction: auto）。写真の無い商品（KV 72px）は中身が短く、390px で RECOMMENDED の見出しが scrollTop=0 のまま y=641（表示領域 703）に入る＝先頭のままカルーセルに触れられる。
- **確認手順**: 実機 or デバイスエミュレーションのタッチ操作で、320px 幅で /order?item=<写真の無いドリンクのID> を開き、スクロールせずに RECOMMENDED のカードを右から左へ、わずかに下向きの角度でスワイプする。カルーセルが動かずシートが下にずれれば再現。

#### [low] 【履歴の金額】DB への保存に失敗した注文も履歴（localStorage）に残るため、再送で成功すると /history に同じ注文が2件・金額が二重に見える

- **根拠**: lib/store.ts:388 で appendHistory(entry) を DB 書き込みの**前**に行い、3回リトライしても失敗したときは 444行で `{ok:false, reason:'failed'}` を返すだけで履歴から消していない。お客様はアラートに従ってもう一度押すが、そのとき orderId は新規採番される（同 385行 generateUuid は placeOrder 内で毎回呼ばれる）。/history は localStorage をそのまま並べる（app/history/page.tsx:40）ので、幽霊注文がそのまま金額付きで残る。
- **確認手順**: DevTools の Network で Supabase の rpc/place_order をブロックした状態で /cart から注文を確定し、「通信エラー…」のアラートを閉じる。ブロックを解除してもう一度確定し、/history に同じ内容が2件並ぶことを確認する（ローカル dev のみで行い、本番では実施しないこと）。

#### [low] 【React 警告】/order?table=<数値>（旧形式の印刷済みカード）で、描画中に zustand の setter を呼んでいる

- **根拠**: hooks/useOrderPageData.ts:77 `if (tableParam) setTable(parseInt(tableParam, 10));` が useEffect の外（render 本体）にある。新形式 ?t= では通らないが、既に印刷済みの ?table= のカードが店に残っていれば毎レンダーで呼ばれ、React の『Cannot update a component while rendering a different component』警告と余分な再描画が出る。
- **確認手順**: http://localhost:3000/order?table=1 を開き、Console に 'Cannot update a component while rendering' の警告が出るかを見る。店で配っている二次元コードが ?t= 形式だけかは、管理画面の /admin/tables で印刷物を確認する。

**調査時の注意**

- 本番DBへの書き込みは一切していない。Supabase MCP では SELECT のみ実行（menu_items / categories / menu_item_options / orders / stores / tables の件数と設定、pg_policy と pg_proc の定義）。place_order などの RPC は呼んでいない。
- リポジトリのファイルは1つも変更していない。コミット・PR も作っていない。
- 検証はローカルの dev サーバ（http://localhost:3000、既に起動中だったものを使用）でのみ行った。CLAUDE.md の規約どおり dev サーバを自分で起動していない。
- 検証の途中で、共有のブラウザタブを別の Claude セッションが同時に操作していたため、自分用のタブを分けて計測し直した。そのタブで「カートに入れる」を1回押した（localStorage の dev カートのみ）ので、押す前の状態（カフェラテ x1）に戻してからタブを閉じた。
- 作業中に components/ui/Buttons.tsx が他の作業で書き換わった（ViewCartButton のバッジ修正）。それは触っていない。
- 本レポートの「高」3件（グリッドの重なり・退店ガードの誤作動・詳細シートのオプション入れ直し不能）は、いずれも文言やロジックの変更を伴うため、CLAUDE.md 3章の『止まって確認する』に当たる。修正案は出していない。

### インフラ・監視・当日の運用（Vercel / GitHub Actions / 環境変数 / cron / Sentry / Supabase advisors・負荷・復旧手順）

**重要経路**

- **注文の投入（お客様のスマホ → place_order）** — 営業の入口。ここが落ちると全部止まる。本番の place_order には 2026-09-16 の「消えた卓の救済」ブロックが適用済みであることを確認した（同じラベルの卓に付け替え、無ければ table_id を NULL にして注文は通す）。9/15 の FK 違反 15 件は最後が 14:56 UTC で、修正より前。現在の tables 11 行のラベルは RPC が組み立てる `c.name||' '||c.code||'-'||t.number` と完全一致するので救済は機能する。失敗時は lib/store.ts:97,108 が Sentry に送る。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql`
- **厨房への表示（/admin/kitchen）** — Realtime ではなく 3 秒ポーリング（kitchen/page.tsx:274）。Realtime が壊れていても新しい注文は出る、という点で設計は堅い。ただし失敗時の扱いに穴がある（risks 1 参照）。business_date はクライアント側 lib/dateFormat.ts:29-36 が UTC+9 固定、DB 側 orderly_business_date は AT TIME ZONE 'Asia/Tokyo'。日本に夏時間は無いので両者は一致する。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/kitchen/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dateFormat.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/layout.tsx`
- **厨房プリンタへの伝票（プリンタ → /api/print/<token> → printer_poll）** — 本番で生きている。PRINT_ENDPOINT_TOKEN は設定済み（誤トークンで 503 ではなく 404 が返る）、SUPABASE_SERVICE_ROLE_KEY も設定済み（printer_status.last_seen_at が 2026-09-15 17:35 UTC まで更新されている）。print_jobs 25 件はすべて done、滞留ゼロ。ただし失敗はどこにも通知されない（risks 3・4）。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/print/[token]/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/printStatus.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/print/page.tsx`
- **レジ・会計（/admin/register）** — 3 秒ポーリング（register/page.tsx:157-161）、business_date で当日のみ。PR #105 の「table_label を先に見る」修正は本番デプロイ済みコミット f0cc5a34 に含まれる（GitHub Production deployment と git HEAD が一致）。厨房と同じ「無言で固まる」穴を共有する（register/page.tsx:151-152）。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx`
- **エラーの気づき方（Sentry）** — Sentry の取り込み経路は本番で実際に生きていることを確認した。basePath 込みの /yorkys-shukugawa/monitoring?o=4511842277523456&p=4511842286960640&r=us に POST すると Sentry ingest から 401 と x-sentry-error ヘッダが返る（＝リクエストが Sentry まで到達している）。クライアント側の Sentry.init も本番バンドル chunks/2581 系に入っている。問題は「何が送られていないか」と「誰に届くか」（risks 3）。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/next.config.mjs`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/instrumentation-client.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`

**リスク**

#### [critical] 管理画面のセッションが切れる／Wi-Fi が一瞬切れると、厨房・レジ画面が「古い注文を表示したまま」無言で固まる。エラー表示も再ログイン誘導も出ない。

- **根拠**: app/admin/(protected)/layout.tsx:35-46 — 認証ガードは getSession() をマウント時に1回だけ実行し、以後は onAuthStateChange の 'SIGNED_OUT' しか見ない。トークンが期限切れ／リフレッシュ失敗になっても再判定されない。app/admin/(protected)/kitchen/page.tsx:214-215 — loadOrders の失敗は catch で console.error するだけ。setGroups が呼ばれないので state は直前の値のまま残り、画面は古い注文を表示し続ける。エラー用の state も UI も存在しない。register も同じ（register/page.tsx:151-152）。さらに RLS は orders_select_authenticated が {authenticated} 限定のため、(a) JWT 期限切れ → PostgREST 401 → 画面が固まる、(b) 何らかの理由で anon に落ちる → ポリシー不在で HTTP 200 + 0 行 → setGroups([]) が走り『注文なし』という正常そうな画面になる、の2通りの無言failureがある。実際にトークンが死んだまま復帰しない端末が本番に存在する証拠として、9/15 の Realtime 401 が 4,906 件（下記 risk 2）。
- **確認手順**: 1) kitchen ロールで https://app.good-order.jp/yorkys-shukugawa/admin/kitchen を開く。2) Chrome DevTools → Network タブ → Throttling を 'Offline' にして 30 秒待つ。3) 画面を見る：注文カードが直前のまま残り、エラーバナーもスピナーも『接続できません』も一切出ないことを確認する（これが不具合）。4) Offline のまま別端末から1件注文し、Online に戻したときに初めて出てくることを確認する。5) DevTools Console に [KitchenPage] loadOrders failed が出ているのに画面には何も出ていないことを確認する。復旧手順の確認は、Offline 中に画面を再読み込みすると /admin/login に飛ぶかどうかも併せて見る。

#### [high] Realtime が本番で事実上まったく動いていない。原因が2つ重なっており、「売り切れにしたのにお客様の画面に反映されない」が起きる。加えて一部端末が 401 を無限リトライし続けて無駄な通信を出している。

- **根拠**: (a) 接続自体が失敗：Supabase edge_logs で 2026-09-15 06:00〜17:42 UTC の /realtime/v1/websocket は 401 が 4,906 件、101（成功）が 50 件のみ。しかも 101 は 15:24 UTC 以降（＝ローカル開発が動き出した深夜）に限られ、営業時間帯 06:00〜15:00 UTC は成功ゼロ・毎時 300〜600 件の 401。UA は iPhone Safari 2,081 / Mac Chrome 1,927 など 2〜6 端末が延々リトライしている形。anon キー単体では 101 で接続できる（curl --http1.1 で確認済み・キーの exp は 2036 年）ので、キーの問題ではなく、セッションが死んだ後も realtime に期限切れトークンが張り付いたままになっているのが原因。lib/supabase.ts:9-22 は session があるときしか supabase.realtime.setAuth() を呼ばず、session が無くなったときに anon キーへ戻す経路が無い。(b) 仮に接続できてもイベントが流れない：pg_publication で supabase_realtime は puballtables=false、メンバーは orders と order_items の2つだけ。menu_items と categories は入っていない。supabase/ 配下に ALTER PUBLICATION を含む SQL は1本も無い。購読側は lib/menuDataStore.ts:106-131（menu_items の INSERT/UPDATE/DELETE）、app/admin/(protected)/menu/page.tsx:174、app/admin/(protected)/menu/categories/page.tsx:198。
- **確認手順**: (a) Supabase MCP の query_logs で次を実行し、401 が 0 件に近いことを確認する: select log_attributes['response.status_code'] st, count(*) n from logs where source='edge_logs' and log_attributes['request.path']='/realtime/v1/websocket' group by st  （iso_timestamp_start/end に営業時間帯を指定）。(b) execute_sql で select * from pg_publication_tables where pubname='supabase_realtime'; を実行し、menu_items と categories が含まれることを確認する。(c) 画面での確認：スマホで /yorkys-shukugawa/order を開いたまま、別のPCで /admin/menu からその商品を売り切れにする。スマホ側をリロードせずに SOLD OUT 帯が出れば直っている（今は出ない）。

#### [high] 印刷が止まっても、注文がプリンタに渡らなくても、Sentry にも Slack にも何も飛ばない。気づけるのは誰かが /admin/print を開いたときだけ。

- **根拠**: app/api/print/[token]/route.ts は DB エラーをすべて console.error に落として emptyOk() を返す設計（printer_poll 失敗 141-148行付近、印刷中ジョブ特定失敗、complete_print_job 失敗、record_printer_status 失敗のすべて）。Sentry.captureException はこのファイルに1箇所も無い（grep で Sentry の参照は app/global-error.tsx と lib/store.ts のみ）。DB 側も enqueue_print_job が EXCEPTION WHEN OTHERS THEN RAISE WARNING で握りつぶすため、伝票ジョブの作成に失敗しても注文は成功扱いになり、痕跡は Postgres のログだけに残る。厨房・レジ・受渡・印刷の各画面も console.error のみ（kitchen/page.tsx:215,232,242,261,364,417 ほか）。Sentry 側の通知先（アラートルール・メール/Slack 連携）はリポジトリに無く、ここからは確認できない。
- **確認手順**: (1) Sentry の通知が生きているかを先に確認する：https://ututu.sentry.io の good-order プロジェクト → Alerts で、Issue Alert が1つ以上あり通知先（メールまたは Slack）が洋輔さん・天真さんに向いているかを見る。無ければ『新規 Issue で即通知』のルールを1本作る。(2) 実際に届くかの試験：お客様側の /yorkys-shukugawa/cart で、DevTools の Network を Offline にしてから『注文を確定する』を押す。lib/store.ts:108 の captureException が発火するので、数分以内に Sentry に Issue が立ち、通知が届くことを確認する（本番DBには何も書かれない）。(3) 印刷側は execute_sql で select status, count(*) from print_jobs group by status; を営業中に数回叩き、failed / pending が滞留していないかを見る。

#### [medium] プリンタが紙切れ・オフラインになったとき、5回失敗すると伝票が failed で落ち、人が /admin/print で手動requeueしない限りその伝票は永久に出ない。

- **根拠**: 本番の complete_print_job は MAX_ATTEMPTS=5 で、失敗時 attempts>=5 なら status='failed'、未満なら 'pending' に戻す。reclaim_stale_print_jobs は claimed_at が 2 分以上前の 'printing' を 'pending' に戻す。claim_print_job は status='pending' を created_at 昇順で1件ずつ取るため、失敗を繰り返すジョブが先頭にいる間は後続の伝票も出ない（最悪 5回 × 2分 = 約10分）。requeue_print_job は manager / kitchen / counter のみ実行可。オフライン判定は lib/printStatus.ts:36 の PRINTER_OFFLINE_AFTER_MS = 60秒。現時点の本番は print_jobs 25件すべて done、printer_status.last_seen_at = 2026-09-15 17:35 UTC、last_status_at は null（プリンタから状態通知が一度も来ていないので、紙切れは status_note では検知できず『応答なし』でしか分からない）。
- **確認手順**: 開店前に /yorkys-shukugawa/admin/print を kitchen ロールで開き、上段が『正常に動いています』かつ『最後の応答は たった今』であることを確認する。次にプリンタの電源を60秒以上切り、同じ画面が『プリンタが応答していません』に変わることを確認してから戻す。当日の運用としてこの画面をタブで開きっぱなしにしておき、伝票が出ないという申告があったら (1) この画面の上段で生死を見る (2) 下の一覧で該当の卓／受渡番号の行を探し『刷り直す』を押す、を手順として店員に渡す。

#### [medium] SUPABASE_SERVICE_ROLE_KEY が Vercel に Non-sensitive（平文）で登録されたまま。Vercel のダッシュボードを見られる人に RLS を全部素通りする鍵が見える。

- **根拠**: docs/handoff.md:4174-4185 に 2026-09-15 時点『未対応』として記録されている（Vercel が Needs Attention を2件出している。SUPABASE_SERVICE_ROLE_KEY と CRON_SECRET）。この鍵が実際に本番で使われていることは確認済み：誤トークンで /yorkys-shukugawa/api/print/... が 503 ではなく 404 を返す（PRINT_ENDPOINT_TOKEN 設定済み）、かつ printer_status.last_seen_at が更新されている（service_role で printer_poll が成功している）。お客様のブラウザには漏れていない（使用箇所は app/api/print、app/api/daily-report、lib/dailyReport.ts のサーバー側のみで、本番クライアントバンドルを grep しても出てこない）。
- **確認手順**: Vercel ダッシュボード → yorkys-orderly → Settings → Environment Variables で SUPABASE_SERVICE_ROLE_KEY と CRON_SECRET が Sensitive になっているかを見る。付け替えは一度削除して Sensitive で入れ直す必要があり、鍵の値を扱う作業なので天真さんの手作業（CLAUDE.md の方針どおり AI はやらない）。付け替えたあとは vercel redeploy ではなく新しいコミットを push して自動デプロイを走らせること（handoff.md:3019-3037 の罠）。反映確認は上と同じく誤トークンで /api/print が 404（503 でない）ことを見る。

#### [medium] 厨房・レジ用端末の日付がずれていると、厨房画面に当日の注文が1件も出ない。

- **根拠**: app/admin/(protected)/kitchen/page.tsx:110 と app/admin/(protected)/register/page.tsx:101 が .eq("business_date", businessDateToday()) で絞り込む。businessDateToday は lib/dateFormat.ts:29-36 で端末の new Date() を元に UTC+9 で日付を作る。タイムゾーン設定が違っても new Date() は正しい絶対時刻を返すので影響しないが、端末の日付そのものが1日ずれていると DB 側 orderly_business_date（AT TIME ZONE 'Asia/Tokyo'）が付けた business_date と一致せず、条件に合う行がゼロになる。このときエラーは出ず、単に空の厨房画面になる（risk 1 の (b) と同じ見え方）。
- **確認手順**: 開店前に厨房 iPad とレジ端末の設定で『日付と時刻を自動設定』が ON になっていることを確認する。画面側の確認は、テスト注文を1件入れてから /admin/kitchen に出ることを見る（出なければ端末の日付を疑う）。DB 側の実際の値は execute_sql で select business_date, count(*) from orders group by business_date order by 1 desc limit 3; を実行し、当日の日付になっていることを確認する。

#### [medium] 営業中に main へマージすると、開きっぱなしのお客様のスマホが古い JS チャンクを取りに行って画面が壊れる可能性がある（Vercel の Skew Protection 未設定）。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/vercel.json には regions と crons のみで skew protection の設定が無い。CLAUDE.md 8 章の運用では AI が gh pr merge --squash までやるため、営業時間中にデプロイが走りうる。緩和材料はある：カートは zustand persist で localStorage キー orderly-cart に保存される（lib/store.ts:231,470）ので、チャンク読み込み失敗でリロードされてもカートの中身は消えない。Service Worker は存在しない（public/ に sw.js 無し、コード上も serviceWorker の参照なし）ので、古いHTMLがキャッシュに固定される問題は無い。
- **確認手順**: 当日は『営業時間中（11:00-21:00）はマージしない』を運用ルールにするのが確実。どうしても必要なら、デプロイ直後にスマホで /yorkys-shukugawa/order を開いたまま商品をカートに入れ、/cart まで進めて例外が出ないことを DevTools Console（iPhone なら Mac の Safari Web Inspector）で確認する。恒久対策の要否は Vercel → Settings → Advanced → Skew Protection が使えるプランかどうかで判断する。

#### [low] AI日報（Vercel Cron）が動いているか未確認。動いていなくても営業は止まらない。

- **根拠**: vercel.json の cron は path=/yorkys-shukugawa/api/daily-report、schedule='0 13 * * *'（UTC）＝ 22:00 JST で閉店後。パス自体は正しい（本番に無認証 GET すると 404 ではなく 401 が返るのでルートは存在する）。CRON_SECRET が Vercel に無いと app/api/daily-report/route.ts:16-30 の判定が全部 false になり 401 で終わる。送信先も弱く、LINE_NOTIFY_TOKEN 経由の notify-api.line.me は LINE Notify 自体が 2025/3 末で終了済み（.env.local.example にもその旨の注記あり）。失敗しても res.ok が false になるだけで例外にならず、注文・印刷には一切影響しない。
- **確認手順**: Vercel ダッシュボード → yorkys-orderly → Cron Jobs で直近の実行結果のステータスコードを見る（200 なら成功、401 なら CRON_SECRET 未設定）。Slack に届いているかは #（日報用チャンネル）を見る。注意：手元から curl で叩くと本当に Slack へ日報が飛ぶので、検証は Vercel の実行ログを読むだけにとどめること。

#### [low] Supabase の advisors が出している警告は、確認した範囲では明日に影響しない（＝対応不要と判断してよい）。

- **根拠**: security 側の目立つ警告は『anon が SECURITY DEFINER 関数を実行できる』11件だが、中身を全部確認した結果どれも塞がっている：save_table_layout と get_sales_orders は関数本体で auth.jwt()->'app_metadata'->>'role' が 'manager' でなければ 42501 で落とす。save_brand_accent / save_store_media / save_best_sellers も同様にロール判定あり。assign_pickup_no と enqueue_print_job は引数なしの trigger 関数で RPC からは呼べない。place_order / resolve_table / get_order_statuses / get_recent_item_counts は未認証のお客様が使う前提で意図的に開いている。pickup_no_counters の『RLS有効・ポリシー無し』は SECURITY DEFINER 関数からしか触らないので正しい状態。performance 側も、unindexed FK 4件・auth_rls_initplan 2件・unused_index 4件はいずれも orders 25行 / order_items 60行 / menu_items 63行という規模では体感差が出ない。厨房・レジのクエリは orders を1回、order_items を .in(order_id) で1回の計2往復でN+1になっていない。
- **確認手順**: 明日の営業後に get_advisors を security / performance の両方で再実行し、新しい種類の警告（特に rls_disabled_in_public）が増えていないかだけ見る。負荷面は execute_sql で select count(*) from orders where business_date = current_date; を閉店後に叩き、100件前後でも上記のクエリ形状のまま問題ないことを確認する。

**調査時の注意**

- 読み取りのみで作業した。リポジトリのファイルは1つも変更しておらず、コミットもしていない。
- 本番DBへの書き込みは一切していない。Supabase MCP で実行したのは SELECT と pg_catalog / pg_policies / pg_proc の参照のみ。place_order・save_table_layout・requeue_print_job などの RPC は一度も呼んでいない（テスト注文が残る事故を避けるため）。
- 本番への HTTP アクセスは副作用の無いものだけに限定した：トップと /order の GET、無認証での /api/daily-report GET（401 が返るだけで日報は送られない）、誤トークンでの /api/print POST（404 が返るだけ）、Sentry トンネルへの空ボディ POST（Sentry 側で 401 になりイベントは作られない）。CRON_SECRET を使った日報の実行はしていない（実行すると Slack に本物の日報が飛ぶため）。
- 鍵の値は会話に出していない。anon キーは NEXT_PUBLIC_ で公開前提のため JWT の claims（iss/ref/role/exp）だけをデコードして示し、署名部分と service_role キーには触れていない。.env.local と .env.sentry-build-plugin はどちらも .gitignore 済みであることを git check-ignore で確認した。
- Vercel の環境変数の種別（Sensitive / Non-sensitive）は、Vercel コネクタが未認証のためダッシュボードから直接は確認できなかった。handoff.md の記録と、本番エンドポイントの応答（/api/print が 503 でなく 404、printer_status が更新されている）から『値は設定されている』ことまでを確認し、Sensitive かどうかは未確認のまま残している。
- Sentry のアラートルール・通知先も Sentry コネクタが未認証のため確認できていない。取り込み経路が生きていることまでは本番で実証したが、『誰かに通知が届くか』は未検証なので、risks 3 の howToVerify に人が見る手順として書いた。

### 注文がちゃんと通るか（カート → place_order → 保存 → 厨房/レジ）

**重要経路**

- **注文送信の本線（カート → placeOrder → place_order RPC）** — ここが落ちるとお客様は一切注文できない。本番の place_order は supabase/order_stale_table_id.sql と完全一致（prosrc を照合済み、src_md5=b5776fa7…、5701文字）。anon に EXECUTE 権限あり。検証で弾かれる条件は9種あり、画面側はそれを sold_out / unavailable / failed の3つにしか振り分けていない。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/store.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/cart/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/soldOut.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql`
- **金額の確定（小計 → セットドリンク割引 → 消費税）** — 本番は set_drink_enabled=true / tax_mode='included' / 店内10%・テイクアウト8%。金額の正は DB 側（place_order は p_total_amount を無視して v_total を計算）。実データで突き合わせた結果、パンケーキ1340×1＋アメリカーノ550×2 → 小計2440・割引200・合計2240・税203 で JS と SQL は一致した。ただし unit_price だけはクライアントの申告値をそのまま使う。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tax.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/setDrink.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/set_drink_discount.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/tax_mode.sql`
- **注文が厨房に届く経路（print_jobs だけ）** — 本番の stores.kitchen_enabled が false。厨房画面を使わない運用なので、注文が調理場に届く経路はプリンタ1本しかない。orders への AFTER INSERT トリガー trg_orders_enqueue_print_job → print_jobs → プリンタが /api/print/<token> をポーリング。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/print/[token]/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/receipt.ts`
- **受渡番号の採番と営業日** — orders への BEFORE INSERT トリガー assign_pickup_no が pickup_no_counters の行ロックで直列化する。同時注文で番号が重複することは無い。営業日は orderly_business_date = JST の暦日。レジ・厨房はこの business_date で絞っている。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/pickup_no.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dateFormat.ts`
- **卓の特定とレジでの伝票の束ね方** — 本番の tables 11行はすべて legacy_number が NULL。つまり orders.table_number は必ず 0 になり、レジは table_id → table_label の順でしか卓を区別できない。ここが崩れると別のお客様の伝票が合流する。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/top/TopScreen.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx`

**リスク**

#### [critical] オプション（HOT/ICED・トッピング）を営業中に1つでも「非表示」にすると、そのオプションをカートに入れているお客様は永久に注文できない。しかも案内文は「赤く表示された商品を削除してください」と出るのに、カートのどの行も赤くならない。

- **根拠**: place_order は選んだオプションが menu_item_options に存在し is_available=true でないと '選べないオプションが含まれています' で弾く（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql:99-106、本番の prosrc も同一）。lib/soldOut.ts:140 がこれを unavailable と判定するので再送はしない（ここは正しい）。しかし app/cart/page.tsx:193-199 が出す文言は「赤く表示された商品をカートから削除して」。赤くする判定は app/cart/page.tsx:80,88 の soldOutIdsIn / unavailableIdsIn だけで、両方とも menuItems（商品）しか見ない（lib/soldOut.ts:106-118）。カート画面は menuDataStore の menuOptions を一切参照していない（app/cart/page.tsx の grep で menuOptions の import 無し）。本番には menu_item_options が40件以上あり、ドリンクほぼ全品に HOT/ICED が付いている（アメリカーノ・カフェラテ・抹茶ラテ 等）。
- **確認手順**: 1) 本番の管理画面でドリンク1品（例: アメリカーノ / menu_item_id=f5dd1e6c-c3b4-486e-ae85-c05a47a5ca5f）の編集パネルを開き、オプション「ICED」(id=3c7e62d2-4140-44f5-8896-4a467c65cfc8) を非表示にする。2) 別のスマホ幅390pxのブラウザで、非表示にする前にそのドリンクを ICED 付きでカートへ入れておく。3) 「注文を確定する」を押す。4) 期待する不具合: alert が「お取り扱いが終わった商品が含まれていたため…赤く表示された商品を削除して」と出るが、カートのどの行にも SOLD OUT の赤い表示が付かない（何度押しても通らない）。5) 確認後は必ずオプションを元に戻す。6) DB側の裏取り（書き込み無し）: SELECT id,name,is_available FROM public.menu_item_options WHERE menu_item_id='f5dd1e6c-c3b4-486e-ae85-c05a47a5ca5f';

#### [critical] 注文が厨房に届く経路がプリンタ1本しかないのに、印刷ジョブの作成失敗が誰にも見えない。ジョブが積まれなくても注文は「成功」として完了画面に進み、厨房には何も出ない。

- **根拠**: 本番の stores.kitchen_enabled = false（SELECT kitchen_enabled FROM public.stores で確認）。厨房画面は使わない運用。orders への AFTER INSERT トリガー trg_orders_enqueue_print_job が print_jobs を積むが、enqueue_print_job は内側の BEGIN…EXCEPTION WHEN OTHERS で例外を握りつぶし RAISE WARNING するだけ（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql:155-166、本番の関数定義も同一）。print_jobs が pending のまま滞留しても通知する仕組みは無い。本番の print_jobs は25件すべて done で、最新が 2026-09-15 15:18 UTC（＝プリンタは9/15時点では動いていた）。
- **確認手順**: 営業前と営業中に、次の2つを実行して pending が滞留していないことを見る（どちらも SELECT のみ）。
A) SELECT status, count(*), max(created_at) FROM public.print_jobs WHERE created_at > now() - interval '1 day' GROUP BY status;  → pending が2件以上たまっていたらプリンタが取りに来ていない。
B) SELECT o.id, o.created_at, o.pickup_no, p.status FROM public.orders o LEFT JOIN public.print_jobs p ON p.order_id = o.id WHERE o.business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date ORDER BY o.created_at;  → p.status が NULL の行があれば、その注文はジョブすら積まれていない＝厨房に一生届かない。
C) ジョブ作成失敗の握りつぶしを見るには query_logs で source='postgres_logs' を引き、event_message に 'enqueue_print_job' を含む WARNING が無いことを確認する。

#### [high] 営業中に商品の価格を変えても、お客様のスマホのカートに既に入っている商品は古い価格のまま通ってしまう。逆にオプションの価格は変更が即反映されるため、お客様が見た金額と請求額がズレる。

- **根拠**: place_order は menu_items.price を一度も読まない。小計もオプションの値段も、明細の unit_price は全部クライアントが送ってきた (e->>'unit_price')::integer を基点にしている（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql:127 の小計、:184 の order_items への INSERT）。その unit_price は lib/store.ts:78 で ci.item.price＝localStorage の orderly-cart に保存された商品スナップショットの価格。一方オプションだけは :175-177 でサーバーが今の menu_item_options.price を引き直して足す。本番には価格4,620円のオプション（グラススパークリングワインの「ボトルワイン」/ id=6f7ac13c-7ee8-49b8-a5b9-1677dac70aec）があり、金額への影響は小さくない。検証で 22023 が見るのは unit_price >= 0 だけ（:73-75）なので、0円でも通る。
- **確認手順**: 1) 管理画面でテスト用の1品の価格を変更する（例: フレンチフライ プレーン 750→800）。2) 変更前にその商品をカートに入れておいたスマホで、カート画面を再読み込みせずに「注文を確定する」を押す。3) 直後に SELECT oi.unit_price, m.price AS 現在の価格, m.name FROM public.order_items oi JOIN public.menu_items m ON m.id=oi.menu_item_id WHERE oi.order_id='<注文ID>'; を実行し、unit_price が 750 のまま（＝古い価格で通っている）ことを確認する。4) 価格は元に戻す。運用上の当座の対処は「営業中に価格を触らない」で足りる。

#### [high] 3回の自動再送がすべて失敗したあと、お客様がもう一度ボタンを押すと注文IDが振り直されるため、実は1回目がDBに届いていた場合に同じ注文が2件入る（伝票2枚・料理2人前・レジで2件請求）。送信中のタイムアウトが1か所も無いので「送信中…」のまま固まることもある。

- **根拠**: lib/store.ts:386 で orderId を採番し、:424-432 の再送ループはその同一IDを使う（ここは ON CONFLICT (id) DO NOTHING で冪等、正しい）。しかし失敗して戻ったあと画面から再度押すと placeOrder が最初から走り、:386 が新しいUUIDを作る。サーバー側は同じ中身でも別IDなら別注文として受け入れる（:151-161 の一意判定は id だけ）。またタイムアウトの指定が無い: lib/supabase.ts:6 は createClient(url, anon) のみで fetch のタイムアウト設定が無く、saveOrderToDb（lib/store.ts:64-84）にも AbortController が無い。
- **確認手順**: 1) 重複の検知（毎営業日おわりに1回でよい、SELECT のみ）: SELECT table_label, total_amount, count(*), array_agg(id), array_agg(created_at) FROM public.orders WHERE business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date GROUP BY table_label, total_amount HAVING count(*) > 1 AND max(created_at) - min(created_at) < interval '3 minutes'; → 3分以内に同じ卓で同額の注文が2件出ていたら二重注文の可能性。2) 再現確認: Chrome DevTools の Network を Offline にして「注文を確定する」を押し、3回失敗して「通信エラー」が出たらすぐ Online に戻してもう一度押す。上のクエリで2件入っていないか見る。3) 固まりの確認: Network を Slow 3G にし、さらに DevTools で supabase への rpc リクエストを Block せずに遅延させ、「送信中…」のままボタンが戻らないことを確認する。

#### [medium] レジ画面の卓の束ね方と、伝票に刷る「追加(N)」の数え方が別々の規則になっている。2026-09-16 に「SQLとレジは対で入れること」と決めたのに、print_job_seq_for_order だけが古い規則のまま取り残されている。

- **根拠**: レジは table_id → 'l'+table_label → 'n'+table_number の順（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx:73-82）。一方 print_job_seq_for_order は COALESCE(table_id::text, 'n:'||COALESCE(table_number,0)) で、table_label を一切見ない（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql:117-122）。本番の tables は legacy_number が11行すべて NULL なので（SELECT count(legacy_number) FROM public.tables → 0）、orders.table_number は必ず 0 になる。したがって table_id が NULL になった注文はすべて 'n:0' という1つの箱に入り、別の卓の注文を数に含めた「追加(N)」を刷る。
- **確認手順**: 1) SELECT id, table_id, table_label, table_number FROM public.orders WHERE business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date AND order_type='dine_in' AND table_id IS NULL; を実行する。0件なら今日は影響していない（=席設定を触らないかぎり起きない）。2) 1件でも出たら、その卓の伝票の「追加(N)」の N が実際の注文回数と合っているかを紙で確認する。3) 予防: 明日は管理画面の席設定（/admin/tables 系の保存）を一切触らない。触ると tables の行が DELETE され、この経路に入る。

#### [medium] 1日100件に達すると、受渡番号が 99 の次に 01 に戻り、同じ営業日に同じ番号の注文が2つできる。番号を呼んで別のお客様が来る。

- **根拠**: assign_pickup_no は last_no >= 99 のとき 1 に巻き戻す（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/pickup_no.sql:113-116、本番の関数定義も同一）。orders には (store_id, business_date, pickup_no) の一意制約が無く、ただのインデックス idx_orders_business_date_pickup_no があるだけ（pg_constraint を全件照会して確認。orders の制約は pkey / status_check / store_id_fkey / table_id_fkey の4つのみ）。つまり100件目は注文が失敗するのではなく、静かに 01 が重複する。想定件数（1日100件）はちょうどこの境目。
- **確認手順**: 営業終わりに SELECT business_date, pickup_no, count(*), array_agg(id) FROM public.orders WHERE business_date = (now() AT TIME ZONE 'Asia/Tokyo')::date GROUP BY business_date, pickup_no HAVING count(*) > 1; を実行し、0件であることを確認する。1件でも出たらその日は番号が重複している。当日の進行状況は SELECT business_date, last_no FROM public.pickup_no_counters ORDER BY business_date DESC LIMIT 3; で見られる（last_no が 90 を超えたら要注意）。初日30件なら起きない。

#### [medium] 「売り切れ」にしても、お客様のスマホの画面には即座に反映されない。menu_items が Realtime の配信対象に入っていないため、カート画面が張っている購読には何も届かない。

- **根拠**: SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' → public.orders と public.order_items の2つだけ。menu_items は入っていない。それなのに lib/menuDataStore.ts:106-131 は menu_items の INSERT/UPDATE/DELETE を購読しており、app/cart/page.tsx:74-77 がカート画面でその購読を開始している。リポジトリの supabase/*.sql にも ALTER PUBLICATION の記述は1行も無い（grep 済み）。結果としてカートを開いたまま売り切れにされた商品は画面上は普通のまま。押すとサーバーが弾き、SOLD_OUT_ORDER_REJECTED の alert が出て fetchAll(true) でようやく赤くなる（＝回復はする）。
- **確認手順**: 1) スマホでカートに1品入れた状態で開いたままにする。2) 管理画面でその商品を「売り切れ」にする。3) スマホの画面を触らずに30秒待ち、その行に SOLD OUT が出ないことを確認する（出たら直っている）。4) 直すなら本番で ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; が必要だが、これは書き込みなので天真の OK を取ってから。

#### [medium] レジで「会計済みにする」を押した瞬間、同じ卓の別のお客様がカート画面を開いていると、15秒以内にその画面が「THANK YOU ご来店ありがとうございました」に差し替わり、入力途中のカートに戻れなくなる。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/ui/VisitClosedGate.tsx:19 の POLL_MS = 15_000 で、:29-35 が15秒ごとに refreshVisitClosed() を呼ぶ。lib/visitSession.ts:83 は「その端末の注文が1件以上あって全部 paid」で締める。レジの handleCloseOut（app/admin/(protected)/register/page.tsx:285-292）は tableKey で束ねた卓の注文を全部 paid にするので、同じ卓の全員の端末が一斉に締まる。VisitClosedGate は /order と /cart の layout を包んでいる（app/order/layout.tsx:29, app/cart/layout.tsx:14）。
- **確認手順**: 1) スマホAでQRから入って1品注文する。2) 同じスマホAでもう1品カートに入れ、カート画面を開いたままにする。3) レジでその卓を「会計済みにする」。4) 15秒以内にスマホAの画面が「THANK YOU」に変わり、カートに戻れなくなることを確認する。5) 運用の逃げ道は「テーブルのQRをもう一度読んでください」だが、読み直すと beginVisit() が履歴を消す（lib/visitSession.ts:58-63）。当面の対処は『全員が頼み終わってから会計を押す』の徹底。

#### [medium] 注文を送る前にサーバーとの往復が3回、しかも直列に走る。うち2回（セットドリンク設定・税設定）は画面表示用でサーバーが計算し直すため本来は不要。回線が細いと待ち時間がそのまま伸び、どれか1つが応答しないとボタンが「送信中…」のまま戻らない。

- **根拠**: lib/store.ts の placeOrder は :340 await isAcceptingOrders() → :365 await fetchSetDrinkSetting() → :380 await fetchTaxSetting() → :425 await saveOrderToDb() を直列に実行する。fetchSetDrinkSetting と fetchTaxSetting はどちらも同じ stores の1行を読むだけ（lib/setDrink.ts:107-111 / lib/tax.ts:121-125）で、金額の正は DB 側（supabase/order_stale_table_id.sql:138-149）なので注文の成否には関係しない。しかも app/cart/page.tsx:96-129 がカートを開いた時点で同じ2つを既に読んでいる。タイムアウトはどこにも無い（lib/supabase.ts:6）。
- **確認手順**: Chrome DevTools の Network を Fast 3G にして /cart を開き、「注文を確定する」を押してから完了画面が出るまでの時間を測る。Network タブで stores への GET が2回、rpc/place_order の前に直列に並んでいることを確認する（Waterfall が階段状になっていれば直列）。改善するなら placeOrder からこの2回を外し、カート画面が既に持っている state を渡す形にする。

#### [medium] カテゴリー情報が読めていない状態で注文が確定すると、画面には割引が出ないのにDBには200円引きで保存され、完了画面の金額とレジの金額が食い違う。

- **根拠**: lib/servingTiming.ts:86-89 は categories からカテゴリーが引けないとき item.category（lib/api.ts:232 で DRINK_SLUGS から推定した値）にフォールバックする。DRINK_SLUGS は ['coffee','tea','soft','alcohol']（lib/api.ts:9）だが、本番のドリンクのカテゴリー slug は 'drink' と 'alcohol'（SELECT slug,category_type FROM public.categories で確認）。'drink' は DRINK_SLUGS に入っていないので、カテゴリー未読込時はドリンクが全部フードとして数えられ、calcSetDrinkDiscount（lib/setDrink.ts:73）の割引が0になる。一方サーバーは categories.category_type を直接見る（supabase/set_drink_discount.sql:99-102）ので200円引く。本番は set_drink_enabled=true。
- **確認手順**: 1) DevTools の Network で categories への GET リクエストだけを Block して /cart を開く。2) パンケーキ1品＋アメリカーノ1杯をカートに入れ、割引の行（セットドリンク割引 −¥200）が出ないことを確認する。3) その状態で注文し、SELECT total_amount, discount_amount FROM public.orders WHERE id='<注文ID>'; を実行して discount_amount が 200 になっている（＝画面と食い違う）ことを確認する。

#### [low] place_order が弾く検証エラー6種が、画面では全部「通信エラー」として3回再送され、最後に「もう一度押してください」と案内される。押しても永久に通らない種類の失敗が、この経路にまだ残っている。

- **根拠**: place_order の RAISE EXCEPTION は9か所（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql:59-109）。うち画面が正しく仕分けているのは「売り切れ」（:92、DETAIL='sold_out' → lib/soldOut.ts:152）と「選べないオプション」（:105 → lib/soldOut.ts:140）の2つだけ。残り: 不正な order_type(:60) / 不正な total_amount(:63) / 存在しない店舗(:66) / 明細が空です(:69) / 明細の数量・単価・商品IDが不正です(:77) / 提供タイミングの値が不正です(:84) は、lib/store.ts:107-112 で一律 failed に落ち、:424-432 で3回再送したうえで app/cart/page.tsx:205-209 の「通信エラー…もう一度押してください」になる。今のコードではこの6つに到達する経路は塞がっている（数量は hooks/useDraftQuantities.ts:25 と ItemDetailOverlay の Math.max(1,…) で1未満にならない、空カートは lib/store.ts:335 で止まる）が、2026-09-15 と同じ形の落とし穴がそのまま残っている。
- **確認手順**: コードを変えずに確認するには、DevTools の Console で本番の anon クライアントから place_order を呼ばずに、Sentry 側で見る。具体的には: 明日の営業中に Sentry の tags.feature='order-submit' かつ kind が付いていないイベント（＝failed 扱い）が出ていないかを見る。DSN は instrumentation-client.ts:8 に直書きされているのでクライアントからの送信は生きている。1件でも出たら message の中身（日本語の検証メッセージかどうか）を見て、通信エラーではなく検証エラーだった場合は仕分けの追加が要る。

#### [low] orderly-cart に保存される orderHistory（注文ごとのカート中身まるごと）が一度も消えない。同じ端末を使い続けると localStorage が肥大し、いつか保存に失敗してカートが消える。

- **根拠**: lib/store.ts:454 が注文のたび orderHistory に CartItem[] を push し、:483 の partialize で localStorage に保存している。消す処理はリポジトリ全体に1つも無い（grep orderHistory の結果は store.ts の4か所と app/complete/page.tsx:38,52 のみ）。clearCart（:331）は items しか消さない。beginVisit（lib/visitSession.ts:58-63）が消すのは別キーの yorkys_order_history。CartItem には MenuItem 丸ごと（description・images・media）が入るので1行あたり数百バイト〜1KB。
- **確認手順**: スマホのブラウザで DevTools（またはPCで同じ手順）から localStorage.getItem('orderly-cart').length を見る。数十KBを超えていたら蓄積している。明日1日では問題にならない（お客様は各自の端末）。ただし社内のテスト端末は営業前に localStorage を消してから使うこと。

**調査時の注意**

- 本番DB（good-order / ref oiropkuvaenebmlicrac）に対して実行したのは SELECT とカタログ照会のみ。place_order をはじめ RPC は一切呼んでいない。テスト注文は作っていない（orders は調査前後とも25件、print_jobs も25件のまま）。
- リポジトリのファイルは1つも変更していない。コミットもしていない。
- pickup_no_counters に 2026-09-16 / last_no=1 の行があるが orders には9/16の行が無い。これは過去のセッションがトランザクション内で検証してロールバックした欠番（pickup_no.sql の設計どおり）で、自分の操作によるものではない。
- 本番の place_order は supabase/order_stale_table_id.sql と一致していることを prosrc 照合で確認済み。set_drink_discount_for / calc_order_total / assign_pickup_no / enqueue_print_job / resolve_table / get_order_statuses も本番の定義を直接読んで確認した。
- stores.kitchen_enabled が false であることは本番の SELECT で確認した事実であり、推測ではない。ただし『それが明日の意図どおりか』は洋輔さん・天真に確認が必要（9/15 の依頼で意図的に OFF にした記録が docs/handoff.md にある）。
- 未検証で残っているもの: (1) プリンタが実際に /api/print/<token> をポーリングしているか（9/15 15:18 UTC が最後のジョブなので、それ以降のプリンタの生死は不明）。(2) Vercel 側に SUPABASE_SERVICE_ROLE_KEY と PRINT_ENDPOINT_TOKEN が設定されているか（app/api/print/[token]/route.ts はどちらか欠けると印刷が止まる）。どちらも本番の設定を見る作業なので天真の確認が要る。

### 店舗側の画面（厨房 / レジ / 受渡）と orders.status・business_date・picked_up_at まわり

**重要経路**

- **厨房画面：注文の取得 → 卓ごとの束ね → 提供済み** — 注文が「消えない／戻ってくる」の主戦場。抽出条件（status NOT IN (served,picked_up) ＋ business_date=今日）と isFinished()、そして groupOrdersByTable() の卓キーが全部ここに集まっている。「すべて提供済みにする」はグループ単位で一括更新するので、束ね方を間違えると別の客の注文まで提供済みになる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/kitchen/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/kitchenGrouping.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/admin/kitchen/OrderCard.tsx`
- **レジ画面：卓ごとの束ね → 金額 → 会計確定** — お金が動く唯一の経路。tableKey() の束ね方を誤ると別の客の伝票が合流する。会計は updateOrderStatusIfUnchanged による楽観ロックで、失敗・競合がすべて console だけに落ちる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/api.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/admin/register/BillCard.tsx`
- **受渡（テイクアウト）画面：picked_up_at による受渡待ちの抽出** — 2026-09-14 に status の奪い合いを picked_up_at へ逃がした箇所。厨房画面と裏返しの条件（会計済みは全品 done を確認してから出す）になっていて、厨房が使われないと片側の前提が崩れる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/pickup/page.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/pickup_completed.sql`
- **営業日の絞り込み（端末時計 × DBトリガー）** — 厨房・レジは端末側 businessDateToday() で、DB は BEFORE INSERT トリガーで business_date を決めている。定義が2箇所にあり、境界（JST 0時）と端末時計のずれがそのまま「画面から注文が消える」に直結する。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dateFormat.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/pickup_no.sql`
- **厨房伝票の印刷キュー（厨房OFF運用での唯一の通知経路）** — 本番は stores.kitchen_enabled=false（厨房にiPadを置かない）。注文が厨房に届く手段は EPSON の伝票だけで、レジ画面には音もタイトル点滅も無い。印刷が止まると注文が誰にも見えないまま溜まる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/printer_status.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/api/print/[token]/route.ts`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/print/page.tsx`
- **卓の解決（QR）→ place_order の卓救済 → 各画面の卓キー** — 2026-09-16 に place_order 側（消えた卓の救済）とレジ側（ラベル優先の束ね）を対で入れた経路。片方だけ直っている箇所が残っていないかがそのまま会計事故になる。
  - `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/top/TopScreen.tsx`, `/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts`

**リスク**

#### [critical] 会計済みの注文が厨房画面に出続ける。**いま本番でこの状態の注文が実在する**（2026-09-16 の注文 0559ed87、status=paid・2品中0品done）。厨房画面の「終わった注文を下げる」判定 isFinished() は `status='paid' かつ全明細 cooking_status='done'` の両方を求めるが、本番は stores.kitchen_enabled=false で厨房画面を使っていないため、明細が done になることが永久にない。したがって paid になった注文が1件も下がらない。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/kitchen/page.tsx:155-160（isFinished）と :107,:110（抽出条件）。本番 stores: kitchen_enabled=false / staff_call_enabled=false。本番の実測 SELECT（下記 howToVerify のクエリ）で id=0559ed87-a3bd-48ac-a890-a847e47eaccc / status=paid / items=2 / done_items=0 / all_done=false が厨房の条件に合致して返る。さらに orders 全体で status='served' の行は 0 件、picked_up_at が入った行も 0 件。
- **確認手順**: Supabase MCP（project_id=oiropkuvaenebmlicrac）で次の SELECT を流す。1行でも返れば、その注文は /admin/kitchen に「未処理」として出る:
WITH today AS (SELECT o.id,o.status,o.table_id,o.table_number,o.table_label FROM public.orders o WHERE o.status NOT IN ('served','picked_up') AND o.business_date=(now() AT TIME ZONE 'Asia/Tokyo')::date) SELECT t.id,t.status,t.table_label,count(oi.id) AS items,count(*) FILTER (WHERE oi.cooking_status='done') AS done_items FROM today t LEFT JOIN public.order_items oi ON oi.order_id=t.id GROUP BY 1,2,3;
次に、その状態のまま管理画面に manager でログインして `/admin/kitchen` を直接URLで開く（サイドバーには出ないが layout.tsx のガードは manager を通す）。会計済みの卓カードが並ぶことを画面で確認する。

#### [critical] 厨房画面の卓の束ね方が 2026-09-16 の修正（PR #105）から漏れている。table_id が NULL の注文は全部 `table-0` という同じキーに入り、**別のお客様の注文が1枚の厨房カードに合流**する。カードの卓名は先頭の注文のラベルだけが出るので、B-3 の料理が「ソファ席 A-1」として表示される。さらに「すべて提供済みにする」はグループ内の全注文に効くので、まだ出していない別卓の注文まで提供済みになって厨房から消える。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/kitchenGrouping.ts:64-67 `table-${order.table_id ?? order.table_number}`。レジ側だけは同じ問題を修正済み（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx:73-82 の tableKey がラベル優先）で、そのコメント自体が「table_number はどれも 0 なので n0 で束ねると別のお客様の伝票が合流する」と書いている。本番で SELECT DISTINCT table_number FROM orders WHERE order_type='dine_in' → 0 のみ。table_id IS NULL の dine_in 注文が既に1件存在（table_label='ソファ席 A-1'）。同じ壊れ方が厨房伝票の「追加(N)」にもある（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/print_jobs.sql:117,123 の `'n:'||table_number`）。
- **確認手順**: (1) 本番で `SELECT id, table_label, 'table-'||COALESCE(table_id::text, table_number::text) AS kitchen_key FROM public.orders WHERE order_type='dine_in' AND table_id IS NULL;` を流し、複数行が同じ kitchen_key='table-0' になることを確認する。
(2) 再現: ローカル or 本番の取引内（BEGIN…ROLLBACK）で、table_id=NULL・table_label='テーブル席 A-2' と table_id=NULL・table_label='ボックス席 B-3' の dine_in 注文を business_date=今日 で2件作り、/admin/kitchen を開く。カードが2枚ではなく1枚になり、卓名が片方だけになることを目視する。**place_order は呼ばず、INSERT を取引内で行いロールバックすること。**
(3) 修正の当て所は lib/kitchenGrouping.ts:64-67 を register の tableKey と同じ「table_id → table_label → table_number」の順にすること。

#### [high] 卓ラベルすら無い注文（二次元コードの解決に失敗した端末からの注文）は、レジで全部「—」という1つの伝票に合流する。tableKey のラベル優先の救済はラベルが入っている場合だけで、ラベルも NULL なら `n0` に落ちる。table_number は全件 0 なので、該当する注文はお客様が何人いても1枚の伝票になる。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx:81 `return \`n${o.table_number}\`;`。卓名の表示は /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts:189-198 displayTableLabel で、label も number も無いと "—"。ラベル NULL の注文が生まれる経路: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/tables.ts:170-173 で resolveTable は通信エラーでも例外を投げずに null を返し、/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/top/TopScreen.tsx:55-62 は null のとき setTableRef を呼ばない。それでも :62 で setTableResolved(true) するので :240 のボタンは開き、卓なしのまま注文まで進める（:60-61 に「押せないまま詰まるより卓名なしで通す」と明記）。place_order は dine_in の table_label をそのまま入れる（/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/order_stale_table_id.sql:158）。
- **確認手順**: (1) 本番で `SELECT count(*) FROM public.orders WHERE order_type='dine_in' AND table_id IS NULL AND table_label IS NULL;` を流す（現在 0 件のはず＝まだ起きていない）。営業後に 2 以上になっていたら合流が起きている。
(2) 再現: スマホ実機（または DevTools の Network=Offline）で `/?t=<存在する短縮コード>` を開き、読み込み中にオフラインにしてから「メニューを見る」を押す → 商品を1つカートに入れて注文する。そのうえで /admin/register を開き、チップが「—」になること、2台の端末で同じことをすると2件が1枚の伝票にまとまることを確認する。**本番で試すなら注文が残るので、ローカル dev（.env.local を本番以外に向ける）で行うこと。**

#### [high] 会計・提供済み・受渡完了が失敗しても画面に何も出ない。特にレジの「会計済みにする」は、更新が例外で落ちると確認ダイアログが開いたままボタンだけ戻り、理由が一切表示されない（無限に押し続けられる）。競合（0件更新）のときは逆に、会計できていないのにダイアログが閉じて伝票の選択が解除される。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx:285-308。`setSelected(null)` と `setConfirmOpen(false)` は await の**後ろ**にあるため、throw するとどちらも実行されない。catch は console.error のみ。競合時（:295-299）は console.warn だけでそのまま閉じる。同じ形が厨房（同 kitchen/page.tsx:337-367 handleAllServed、:369-421 cycleItemStatus）と受渡（同 pickup/page.tsx:138-159）にもある。throw を起こす現実的な原因は (a) 通信断、(b) セッション切れ、(c) RLS の WITH CHECK 違反（42501）。(c) は本番の pg_policies で確認済み: orders_update_role_scoped は register ロールに status='paid' しか許さず、kitchen ロールには 'served'/'picked_up' しか許さない。いまは auth.users が2件ともロール manager（login@temma.me / yosuke.itakura@gmail.com）なので (c) は起きないが、明日スタッフ用に register や kitchen ロールのアカウントを作った瞬間に、そのアカウントでは相手側の操作が**無音で**失敗する。
- **確認手順**: (1) レジ iPad で /admin/register を開き、伝票を選んで「会計済みにする」を押す直前に Wi-Fi を切る → 確認ダイアログが開いたまま、エラー文言が一切出ないことを目視。console に [RegisterPage] close-out failed が出ていることを確認。
(2) ロール由来の無音失敗: 本番で `SELECT email, raw_app_meta_data->>'role' FROM auth.users;` を流し、register / kitchen / counter のアカウントが増えていないか確認する。増えていたら、そのアカウントでログインして相手側の操作（register アカウントで /admin/kitchen の「すべて提供済みにする」）を押し、カードが一瞬消えて3秒後に戻ってくる＝無音失敗であることを目視する。
(3) 当日の運用上の回避策: スタッフ用アカウントを増やさず manager のまま使う。

#### [high] 厨房をOFFにしている（＝いまの本番設定）と、テイクアウトの受渡画面が永久に空のままになる。受渡画面は status が 'served' か 'paid' の注文しか拾わず、'paid' の場合は全明細が cooking_status='done' であることまで求める。厨房画面を使わないと status は 'pending' のままなので受渡待ちに出ず、先にレジで会計しても全品 done ではないのでやはり出ない。picked_up_at も永久に入らない（渡した記録が残らない）。サイドバーは厨房だけを隠し「テイクアウト」は出したままなので、スタッフは開いて「受渡待ちのテイクアウト注文はありません」を見続ける。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/pickup/page.tsx:62 `.in("status", ["served","paid"])` と :103 `.filter((o) => o.status !== "paid" || allCooked.get(o.id) === true)`。本番 stores.kitchen_enabled=false。本番の実測: orders で status='served' は 0 件、picked_up_at が入った行は 0 件、cooking_status を触った明細は 58 件あるが served まで到達した注文は無い。サイドバーの絞り込みは /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/components/admin/nav/NavContent.tsx:62 で `item.href !== "/admin/kitchen"` の1件だけ。**今日は火を噴かない**：本番の menu_items で is_takeout=true かつ is_available=true は 0 件、takeout の注文も 0 件。テイクアウト商品を1つでも公開した瞬間に発火する。
- **確認手順**: (1) 本番で `SELECT count(*) FROM public.menu_items WHERE is_takeout AND is_available;` を流す。0 のままなら当日は無害。1以上になったら要対応。
(2) 発火の確認: 取引内（BEGIN…ROLLBACK）で takeout の注文を1件 INSERT し（place_order は呼ばない）、`SELECT id FROM public.orders WHERE order_type='takeout' AND picked_up_at IS NULL AND status IN ('served','paid');` が 0 件になること＝受渡画面に出ないことを確認して ROLLBACK。
(3) 運用回避: テイクアウトを使う日は stores.kitchen_enabled を true に戻し、厨房画面で明細を done にしてから受渡画面を使う。

#### [medium] 受渡画面だけ営業日で絞っていない。2026-09-13 に厨房・レジへ入れた business_date の絞り込みが受渡画面には入っていないため、受け渡されなかったテイクアウト注文は翌日以降もカードとして残り続ける（9月2日の注文が11日間レジに出ていたのと同じ壊れ方）。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/pickup/page.tsx:54-63 のクエリに `.eq("business_date", ...)` が無い。厨房は /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/kitchen/page.tsx:110、レジは register/page.tsx:101 で絞っている。
- **確認手順**: 本番で `SELECT id, business_date, status, pickup_no FROM public.orders WHERE order_type='takeout' AND picked_up_at IS NULL AND status IN ('served','paid') ORDER BY business_date;` を流し、今日以外の business_date が混ざっていないことを確認する。混ざっていれば、その件数がそのまま受渡画面に出ている居残りカードの数。

#### [medium] 受渡番号（pickup_no）が1営業日 99 件で一巡する。目標の「1日100件」に達した瞬間、100件目が #01 になり、同じ日に同じ受渡番号の注文が2つ存在する。レジの伝票見出しと厨房伝票（テイクアウト）にこの番号が大きく出るので、呼び出し・受け渡しの取り違えになる。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/pickup_no.sql:112 `SET last_no = CASE WHEN last_no >= 99 THEN 1 ELSE last_no + 1 END`。表示は /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/pickupNo.ts:16-18（2桁ゼロ埋め）、レジの表示は register/page.tsx:366、伝票は supabase/print_jobs.sql の claim_print_job が返す pickupNo。
- **確認手順**: 営業中に本番で `SELECT business_date, last_no FROM public.pickup_no_counters ORDER BY business_date DESC LIMIT 3;` を流し、last_no が 90 を超えていないか見る。超えたら重複が近い。重複の実測は `SELECT business_date, pickup_no, count(*) FROM public.orders WHERE business_date >= (now() AT TIME ZONE 'Asia/Tokyo')::date GROUP BY 1,2 HAVING count(*) > 1;`。

#### [medium] 厨房・レジ・受渡はすべて3秒ポーリングで、取得に失敗しても画面は最後に成功したデータを出し続ける（エラー表示も再接続表示も無い）。Realtime はこの3画面では一切使っていないので「購読が切れる」問題は無いが、代わりに **Wi-Fi断・セッション切れで画面が静かに凍る** 経路がある。さらに、いまの厨房OFF運用ではレジに新規注文の音もタイトル点滅も無く（Figma移行時に削除）、着席済みの卓の追加注文はTopBarの件数も変えないため、レジ画面上は何の変化も起きない。

- **根拠**: ポーリングと無音の catch: kitchen/page.tsx:214-218 と :267-290、register/page.tsx:151-155 と :158-168、pickup/page.tsx:111-115 と :119-135。Realtime の購読はリポジトリ全体で /admin/menu、/admin/menu/categories、lib/menuDataStore.ts の3箇所のみ（`.channel(` の grep 結果）で、厨房・レジ・受渡には無い。レジの通知音・タイトル点滅を消した経緯は register/page.tsx:7-10 のコメント。件数表示は register/page.tsx:310（tableBills.length + takeoutOrders.length）なので、既に出ている卓の2回目の注文では増えない。
- **確認手順**: (1) レジ iPad で /admin/register を開いたまま Wi-Fi を切り、別端末から注文を1件入れる（ローカル dev 推奨）。画面が5分放置しても「会計待ち 0件」等に変わらず、エラーも出ないまま古い一覧のままであることを目視。Safari の Web インスペクタで [RegisterPage] loadOrders failed が積み上がることを確認。
(2) 当日の運用回避: レジ画面は1時間に1回、手で再読み込みする／Wi-Fi の切断時に気づけるよう /admin/print も別タブで開いておく。

#### [medium] 営業日が JST 0時ちょうどで切り替わり、未会計の注文は 0時を跨いだ瞬間に厨房・レジの両方から消える。ブランチ営業なら当たらない想定だが、当たった場合の復旧手段は画面には無く SQL のみ。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dateFormat.ts:29-36 businessDateToday()（JSTの暦日、日またぎ補正なし）と /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/supabase/pickup_no.sql:47-54 orderly_business_date（INTERVAL '0 hours'）。厨房 kitchen/page.tsx:110、レジ register/page.tsx:101 がこの値で等値比較している。実データでも 2026-09-15 15:18 UTC(=09-16 00:18 JST) の注文の business_date が 2026-09-16 になっている。
- **確認手順**: 本番で `SELECT id, created_at AT TIME ZONE 'Asia/Tokyo' AS jst, business_date, status FROM public.orders WHERE status <> 'paid' ORDER BY created_at DESC;` を流し、未会計の注文の business_date が今日と一致しているか確認する。ずれた注文を当日の画面に戻す必要が出た場合は、業務時間外に pickup_no.sql:52 の INTERVAL と lib/dateFormat.ts の定義を**必ず対で**変えること（片方だけ変えると採番系列が食い違う）。

#### [medium] 営業日の判定がレジ/厨房 iPad の端末時計に依存している。iPad の日付が1日ずれていると `business_date = businessDateToday()` が一致せず、注文はDBに入っているのにレジが「会計待ちのテーブルはありません」と表示する。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/dateFormat.ts:30-35 は `new Date()`（端末の絶対時刻）に +9時間して日付を作るので、タイムゾーン設定のずれには強いが、**日付そのもののずれ**には無防備。/Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/register/page.tsx:101 でこの値をそのまま等値比較している。
- **確認手順**: 営業前に、レジ/厨房で使う iPad の Safari で管理画面を開き、Web インスペクタのコンソールに `new Date().toString()` を打って日付と時刻が実際と合っていることを確認する（設定 > 一般 > 日付と時刻 が「自動設定」になっていること）。ずれていた場合の症状は「DBには注文があるのにレジが空」なので、本番で `SELECT count(*) FROM public.orders WHERE status<>'paid' AND business_date=(now() AT TIME ZONE 'Asia/Tokyo')::date;` と画面の件数を突き合わせれば切り分けられる。

#### [medium] 厨房伝票の印刷が止まっても誰にも通知されない。厨房OFF運用では注文が店に届く経路が伝票だけなので、プリンタの紙切れ・電源断・Wi-Fi断がそのまま「注文が誰にも見えない」になる。状態は /admin/print を開けば分かるが、開くのは手動で、鳴らす仕組みは無い。

- **根拠**: 判定は /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/lib/printStatus.ts:37（60秒無応答で offline）と :67-103。表示は /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/print/page.tsx のみで、他画面への通知は無い。ジョブは消えず復帰時に自動で出る設計（supabase/print_jobs.sql の 6 と printer_poll）なので取りこぼしには強い。本番の現状は正常（printer_status.last_seen_at が14秒前、print_jobs は25件すべて done、pending/failed は0件）。
- **確認手順**: 営業中に本番で `SELECT last_seen_at, now()-last_seen_at AS since, status_note FROM public.printer_status;` を流し、since が1分を超えていないこと、status_note が NULL であることを確認する。溜まりの確認は `SELECT status, count(*) FROM public.print_jobs WHERE created_at > (now() - interval '12 hours') GROUP BY 1;`（pending / failed が0であること）。当日の運用回避: /admin/print をレジ iPad の別タブで開きっぱなしにする。

#### [low] 厨房画面のスタッフ呼び出しの取得に営業日の絞り込みが無く、完了されなかった呼び出しが翌日以降も上部に残り続ける（呼び出しが1件でも残っていると通知音とタイトル点滅が鳴り続ける）。

- **根拠**: /Users/temma/Dev/Apps/UTUTU/GOOD_ORDER/app/admin/(protected)/kitchen/page.tsx:224-230 のクエリに business_date も store_id も日付条件も無い。鳴り続ける条件は同 :302 `shouldAlert = hasUnacknowledged || pendingCalls.length > 0`。いまの本番は stores.staff_call_enabled=false、未対応の staff_calls も 0 件なので当日は当たらない。
- **確認手順**: 本番で `SELECT count(*), min(created_at) FROM public.staff_calls WHERE status IN ('waiting','acknowledged');` を流し 0 件であることを確認する。スタッフ呼び出しを ON に戻す日には、営業前に同じクエリで前日の取り残しが無いことを見てから開店すること。

**調査時の注意**

- 読み取りのみで作業した。リポジトリのファイルは1つも変更していない。コミット・PR も作っていない。
- 本番DB（good-order / ref oiropkuvaenebmlicrac）へは SELECT と pg_catalog の参照だけを実行した。INSERT / UPDATE / DELETE は一切していない。place_order・mark_order_picked_up などの RPC も一切呼んでいない（テスト注文は1件も作っていない）。
- 本番ログは query_logs で postgres_logs を読んだだけ。2026-09-15 の orders_table_id_fkey 違反15件はすべて PR #105 の SQL 適用（2026-09-15 15:09 UTC 頃）より前の時刻で、適用後の 15:18 UTC の注文は table_id=NULL・table_label='ソファ席 A-1' で正常に通っている。**卓の救済 SQL は効いている。**
- ただし、その救済が効いた結果として table_id=NULL の注文が本番に実在する。これが上の critical 2件（厨房のカード合流／会計済みが厨房に残る）の実データ上の引き金になっている。消えた卓ID cf37c446-0724-41d2-8b4b-6c4b08754396 を localStorage に抱えた端末が客側に少なくとも1台あり、その端末は二次元コードを読み直すまで table_id=NULL の注文を出し続ける。
- 本番の現在設定（読み取り値）: stores.kitchen_enabled=false / staff_call_enabled=false / tax_mode=included / tax_rate_dine_in=10 / tax_rate_takeout=8 / set_drink_enabled=true / set_drink_discount=200 / is_accepting_orders=true。auth.users は2件ともロール manager。この2つの前提が変わると上の risks の発火条件も変わるので、当日の設定変更（厨房ON／スタッフアカウント追加／テイクアウト商品の公開）の前に該当項目を読み直すこと。
- スクリーンショットは撮っていない（dev サーバーの起動は CLAUDE.md により勝手に行わない方針のため、調査を読み取りとDB照会に限定した）。画面での再現確認が必要な項目は howToVerify に手順を書いてある。
