# harness — AI と一緒に作るためのハーネス一式

GOOD ORDER で組み上げた「AI が勝手に壊さない・勝手に止まらない」ための仕組みを、
別のプロジェクトにそのまま持っていける形で切り出したもの。

移植先の第一号は **GOOD LOOP**（新規リポジトリ・Next.js + Supabase・非公開）を想定している。

> **このディレクトリは雛形置き場です。**
> `harness/` に置いてあるファイルは、このリポジトリでは何も実行していません。
> `harness/.github/workflows/check.yml` は GitHub Actions からは見えない場所にあり、
> `harness/.claude/settings.json` も Claude Code からは読まれません。
> 移植先のリポジトリの**ルート**にコピーして初めて動きます。

---

## 0. これは何を解決する仕組みか

AI に開発を任せると、放っておくと次の3つが起きる。

| 起きること | 効く対策 | このハーネスでの実装 |
|---|---|---|
| 「実装しました」と言うが壊れている | 完了の定義を機械が判定する | `npm run check` ＋ Stop hook ＋ GitHub Actions |
| 判断すべきことを勝手に決める | 止まる項目を明示する | `CLAUDE.md` 3章 |
| 止まらなくていいことで止まる | 進んでよい項目も明示する | `CLAUDE.md` 3章の後半 |

設計の芯は1つだけ。

> **お願いは忘れられる。判定できるものは機械の制約に上げる。**

強さには3段ある。同じ指摘を2回受けたら、下から上に**上げる**。

| 段 | 置き場所 | 強さ |
|---|---|---|
| 1 | その場の会話 | 1回きり。忘れられる |
| 2 | `CLAUDE.md` / `docs/specs/*.md` | 毎回読まれる（＝お願いの最上位） |
| 3 | `npm run check` / hooks / ブランチ保護 | **破れない（＝制約）** |

ファイルを置くだけでは 3 段目が立たない。**この README の Step 5 以降が本体**だと思ってほしい。

---

## 1. 何が入っているか

| ファイル | 移植先での置き場所 | 中身 | 書き換え |
|---|---|---|---|
| `CLAUDE.md.template` | `CLAUDE.md` | リポジトリの規約。AI が毎回読む | **必要** |
| `.claude/settings.json` | `.claude/settings.json` | 権限（許可/確認/禁止）と hooks の登録 | 不要 |
| `.claude/hooks/mark-dirty.sh` | 同左 | AI がコードを触ったら印を立てる | 不要 |
| `.claude/hooks/require-check.sh` | 同左 | AI が完了しようとしたら `npm run check` を回す | 不要 |
| `.github/workflows/check.yml` | 同左 | PR と本流ブランチで `npm run check` を回す | **必要** |
| `package.json.snippet` | `package.json` にマージ | `check` / `typecheck` / `lint` / `design` / `design:figma` | 一部 |
| `scripts/check-design-tokens.mjs` | 同左 | 生の色コードを検出する | 一部 |
| `scripts/check-figma.mjs` | 同左 | Figma の構造・パディングを検品する | **必要** |
| `docs/specs/design-rules.md` | 同左 | Figma 作業のルール | **必要** |

Figma を使わないプロジェクトなら、`scripts/check-figma.mjs` と `docs/specs/design-rules.md`、
`check-design-tokens.mjs` の3つは落としてよい（Step 3 に手順あり）。

---

## 2. 手順の全体像

上から順にやる。**Step 1〜4 はファイル作業、Step 5 以降は各サービスの設定作業。**
所要時間はおおよそ、Step 1〜4 で30分、Step 5〜9 で1〜2時間。

```
Step 1  ファイルをコピーする
Step 2  プレースホルダを書き換える
Step 3  package.json / .gitignore を整える
Step 4  ローカルで npm run check を通す      ← ここまでで「壊れているのに完了と言う」が止まる
Step 5  GitHub のブランチ保護を設定する      ← ここで「main が直接壊される」が止まる
Step 6  Vercel の連携を確認する
Step 7  Sentry を入れて Slack に通知する      ← ここで「壊れたのに気づかない」が止まる
Step 8  Figma トークンを作る
Step 9  動作確認する
```

---

## Step 1. ファイルをコピーする

移植先リポジトリのルートで実行する。`<harness>` は、このリポジトリの `harness/` へのパス。

```bash
HARNESS=<harness>   # 例: ~/Dev/Apps/UTUTU/GOOD_ORDER/harness

mkdir -p .claude/hooks .github/workflows scripts docs/specs

cp "$HARNESS/CLAUDE.md.template"              ./CLAUDE.md
cp "$HARNESS/.claude/settings.json"           ./.claude/settings.json
cp "$HARNESS/.claude/hooks/mark-dirty.sh"     ./.claude/hooks/
cp "$HARNESS/.claude/hooks/require-check.sh"  ./.claude/hooks/
cp "$HARNESS/.github/workflows/check.yml"     ./.github/workflows/
cp "$HARNESS/scripts/check-design-tokens.mjs" ./scripts/
cp "$HARNESS/scripts/check-figma.mjs"         ./scripts/
cp "$HARNESS/docs/specs/design-rules.md"      ./docs/specs/

# hooks は実行できないと動かない。ここを忘れると Stop hook が黙って無効になる
chmod +x .claude/hooks/*.sh
```

`docs/handoff.md` は雛形を用意していない。**空のファイルを1つ作っておく**こと。
`CLAUDE.md` が「セッション開始時に読む」と指示しているので、無いと AI が探し回る。

```bash
printf '# %s 引き継ぎメモ\n\n実装の経緯と判断の履歴をここに追記する。\n' "<プロジェクト名>" > docs/handoff.md
```

---

## Step 2. プレースホルダを書き換える

`{{ }}` の形をしたものが全部プレースホルダ。**残っていないことを機械で確認する**（Step 4）。

一覧は末尾の「[プレースホルダ一覧](#プレースホルダ一覧)」にある。

書き換えのコツは3つ。

1. **使わない節は空欄で残さず、丸ごと消す。** 空の決まりは、AI が「守ろうとして迷う」だけで害になる
2. **3章（止まって確認すること）は5〜6項目に絞る。** 多いと全部が形骸化する
3. **7章（やってはいけないこと）には、実際に一度やらかしたことだけ書く。** 予防的に書き足すと読まれなくなる

---

## Step 3. package.json / .gitignore を整える

### 3-1. scripts を足す

`package.json.snippet` の `"scripts"` の中身を、移植先の `package.json` にマージする。
肝は `check` の中身と順番。

```json
"check": "npm run typecheck && npm run lint && npm run design && npm run build"
```

`&&` でつないでいるので前が落ちたらそこで止まる。遅い `build` を最後に置くことで、
型エラーのときに数分待たされずに済む。

**この1コマンドが、以下3か所すべての共通の合格ラインになる。**

1. AI の Stop hook（`.claude/hooks/require-check.sh`）
2. GitHub Actions（`.github/workflows/check.yml`）
3. 人間が手で叩くとき

3つが同じコマンドを見ているから「ローカルでは通るのに CI で落ちる」が起きにくい。

### 3-2. Figma / デザイントークンを使わない場合

以下を全部落とす。中途半端に残すと `npm run check` が落ち続ける。

- `scripts/check-design-tokens.mjs` と `scripts/check-figma.mjs`
- `package.json` の `design` と `design:figma`
- `docs/specs/design-rules.md`
- `CLAUDE.md` の「デザイントークン」節と、4章冒頭の design-rules.md への言及

`check` はこうなる。

```json
"check": "npm run typecheck && npm run lint && npm run build"
```

### 3-3. .gitignore に足す

hooks が使う一時ファイルと、Claude Code の個人設定を除外する。**これを忘れると、
検証待ちフラグがコミットに混ざって他の環境の hook が誤作動する。**

```gitignore
# Claude Code の個人設定（hooks を書く settings.json は共有するが、こちらは各自の環境依存）
.claude/settings.local.json

# Claude Code hooks が使う一時ファイル（検証待ちフラグ・試行回数）
.claude/.needs-check
.claude/.check-attempts

# Playwright MCP がスクリーンショット等を吐く場所
.playwright-mcp/

# ローカル環境変数（絶対にコミットしない）
.env*.local

# Sentry のビルド用トークン
.env.sentry-build-plugin
```

---

## Step 4. ローカルで npm run check を通す

```bash
npm ci
npm run check
```

通ったら、プレースホルダの消し残しを確認する。

```bash
grep -rn "{{" CLAUDE.md .claude .github scripts docs/specs 2>/dev/null
```

**何も出なければ完了。** 出たら書き換え漏れ。

hooks が効いているかも確認する。

```bash
ls -l .claude/hooks/          # 実行権限（x）が付いているか
```

---

## Step 5. GitHub のブランチ保護を設定する

**ここが一番大事。** ファイルを置いただけでは `main` は守られない。

### 5-1. 先に確認すること

> **private リポジトリでブランチ保護を使うには、GitHub の有料プラン（Pro / Team / Enterprise）が要る。**
> GOOD ORDER が public だったのはこれが理由の一つでもある。GOOD LOOP は非公開の予定なので、
> **着手前にプランを確認すること。** Free プランの private リポジトリでは、下のコマンドは
> 権限エラーで弾かれる。

Free の private で進める場合の代替は Step 5-4 に書いた。

### 5-2. 実際に使ったコマンド

GOOD ORDER の `main` に今かかっている保護は、以下のコマンドで再現できる。
`OWNER/REPO` を移植先のものに変える。

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["check"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

各項目が何をしているか。

| 設定 | 値 | 何が起きるか |
|---|---|---|
| `required_status_checks.contexts` | `["check"]` | `check.yml` の job 名。**これが通らないとマージできない** |
| `required_status_checks.strict` | `true` | main が進んでいたら、追いついてから再テストさせる |
| `enforce_admins` | `true` | **管理者も例外にしない。** ここを false にすると全部が骨抜きになる |
| `required_approving_review_count` | `0` | 1人開発なのでレビュー承認は要求しない。人が増えたら 1 に上げる |
| `required_linear_history` | `true` | squash / rebase のみ。マージコミットを禁止＝履歴が一直線 |
| `allow_force_pushes` | `false` | 履歴の書き換えを禁止 |
| `allow_deletions` | `false` | ブランチごと消すのを禁止 |

`contexts` の `"check"` は、`.github/workflows/check.yml` の `jobs:` 直下のキー名と一致させる。
**ここがずれていると、保護は掛かっているのに何もチェックされない状態になる**（一番気づきにくい失敗）。

### 5-3. 設定できたか確認する

```bash
gh api repos/OWNER/REPO/branches/main/protection | python3 -m json.tool
```

`enforce_admins.enabled` が `true`、`required_status_checks.contexts` に `check` が
入っていることを目で見る。

さらに、実際に直接 push が弾かれることを確かめる。

```bash
git checkout main && git commit --allow-empty -m "test" && git push
# → remote: error: GH006: Protected branch update failed  が出れば成功
git reset --hard HEAD~1   # 確認できたら取り消す
```

### 5-4. Free プランの private でやる場合

ブランチ保護が使えないので、機構的な強制はあきらめて次の2つで代替する。

1. `.claude/settings.json` の `deny` に `Bash(git push*origin*main*)` を足して、AI からの直接 push を塞ぐ
2. `check.yml` の `on.push.branches` に本流ブランチを入れておき、壊れたらすぐ赤くなるようにする

**人間の直接 push は止められない。** これは仕組みではなく規律に頼る状態なので、
プランを上げるまでの暫定と考えること。

---

## Step 6. Vercel の連携を確認する

Vercel は「デプロイする」だけなら GitHub リポジトリを繋げば終わりだが、
ハーネスとして噛み合わせるには以下を確認する。

### 6-1. 確認する項目

| 場所 | 確認すること | なぜ |
|---|---|---|
| Settings → Git → Production Branch | `main` になっているか | ここがずれると本番が別ブランチから出る |
| Settings → Git → GitHub 連携 | PR にプレビューURLのコメントが付くか | 付かないと依頼者が確認できず、マージ判断ができない |
| Settings → Environment Variables | Production / Preview / Development の3つに値が入っているか | Preview が空だとプレビューが動かず、確認できない |
| Settings → Deployment Protection | 非公開プロジェクトなら Vercel Authentication を有効に | プレビューURLは推測されにくいだけで、公開されている |
| `vercel.json` の `regions` | DB と同じリージョンか | 別リージョンだと往復のたびに遅延が乗る |

### 6-2. リージョンを合わせる

GOOD ORDER は Supabase を東京に置いているので、Vercel の関数も東京 `hnd1` に固定している。

```json
{ "regions": ["hnd1"] }
```

移植先でも **DB のリージョンを先に決めて、それに合わせる**こと。逆はやらない。

### 6-3. 見落としやすいこと

- **Vercel のビルドが通ることは、CI が通ることではない。**
  マージのゲートは GitHub Actions の `check` であって、Vercel のビルドではない。
  Vercel は lint も typecheck も回さない設定が既定なので、`check` を別に持つ意味がある
- **`vercel.json` の cron は本番デプロイでしか動かない。** プレビューでは走らない
- **`NEXT_PUBLIC_` が付いた環境変数はブラウザに出る。** 秘密の値に付けない
- 環境変数を追加・変更したら、**再デプロイしないと反映されない**（ビルド時に埋め込まれるため）

---

## Step 7. Sentry を入れて Slack に通知する

「壊れたのに誰も気づかない」を止めるための段。

### 7-1. 導入

Sentry の公式ウィザードを使う。GOOD ORDER のファイル（`sentry.server.config.ts` /
`sentry.edge.config.ts` / `instrumentation.ts` / `instrumentation-client.ts` /
`next.config.mjs` の `withSentryConfig` ラップ）は、これが生成したものに手を入れたもの。

```bash
npx @sentry/wizard@latest -i nextjs
```

対話で聞かれるので答える。

- Sentry にログイン（ブラウザが開く）
- 組織とプロジェクトを選ぶ（無ければその場で作る）
- **Tracing … 不要なら無効でよい**（後から有効にできる）
- **Session Replay … 不要なら無効でよい**
- ソースマップのアップロード … **有効にする**（これが無いと、本番のエラーが
  圧縮されたコードの行番号で届いて読めない）

ウィザードが作るもの。

| ファイル | 役割 |
|---|---|
| `sentry.server.config.ts` | サーバー側の初期化 |
| `sentry.edge.config.ts` | middleware / edge 側の初期化 |
| `instrumentation-client.ts` | ブラウザ側の初期化 |
| `instrumentation.ts` | 上2つを Next.js の実行環境に応じて読み分ける |
| `next.config.*` | `withSentryConfig()` でラップされる |
| `.env.sentry-build-plugin` | ソースマップ送信用トークン。**gitignore 必須** |

### 7-2. 秘密情報の扱い

- **DSN**（`https://xxxx@oNNN.ingest.sentry.io/NNN`）は、設計上ブラウザのJSに載る公開値。
  コードに書いてよい。ただし「公開値だから雑に扱ってよい」わけではないので、
  資料や Issue に貼らない
- **`SENTRY_AUTH_TOKEN`** は本物の秘密。これが漏れると他人がプロジェクトを操作できる。
  - ローカル … `.env.sentry-build-plugin`（gitignore 済み）
  - Vercel … Settings → Environment Variables に登録
  - GitHub Actions … ソースマップを CI から送るなら Secrets に登録。
    **送らないなら不要。** `check.yml` は build するだけなので、トークンが無くても
    「ソースマップをスキップした」という警告が出るだけで通る

### 7-3. バンドルを軽くする

GOOD ORDER では `next.config.mjs` の `withSentryConfig` 側で、使っていない機能の
コードを落としている。**お客さんのスマホで開くアプリは、共通JSの重さが体感に直結する。**

```js
bundleSizeOptimizations: {
  excludeDebugStatements: true,
  excludeTracing: true,          // Tracing を無効にしただけではコードは残るので明示的に除去
  excludeReplayCanvas: true,
  excludeReplayShadowDom: true,
  excludeReplayIframe: true,
  excludeReplayWorker: true,
},
```

ウィザードで Tracing / Replay を無効にした場合は、この指定も併せて入れること。

### 7-4. Slack に通知する

Sentry 側の設定作業（コードは触らない）。

1. Sentry → **Settings → Integrations → Slack** を開く
2. **Add Workspace**（または Install）を押して、Slack ワークスペースを認可する
   - Slack 側で「Sentry がチャンネルに参加してよいか」を聞かれるので許可する
   - **通知先にしたいチャンネルには、先に Sentry アプリを招待しておく**
     （プライベートチャンネルは招待しないと選べない）
3. Sentry → **Alerts → Create Alert Rule** で通知の条件を作る
   - 対象プロジェクトを選ぶ
   - 条件は最初は **「新しい種類のエラーが出たとき（A new issue is created）」** の1本でよい
   - アクションに **Send a Slack notification** を選び、ワークスペースとチャンネルを指定する
4. ルールの編集画面にある**テスト送信**でSlackに届くことを確かめる

> 画面の文言は Sentry 側の更新でよく変わる。上のとおりのラベルが無くても、
> 「Integrations で Slack を繋ぐ → Alert Rule のアクションに Slack を選ぶ」
> という順序は変わらない。その順序で画面の案内に従うこと。

**最初の1本は「新しい種類のエラー」だけにする。** 全部のエラーを流すと通知が多すぎて
すぐ見なくなり、通知が無いのと同じになる。

---

## Step 8. Figma トークンを作る

`npm run design:figma` は Figma API を叩くのでトークンが要る。
**リポジトリには絶対に置かない。** 各自の Mac の環境変数に入れる。

### 8-1. トークンを作る

1. figma.com にログインし、右上のアカウントアイコン → **Settings**
2. **Security** タブを開く
3. **Personal access tokens** の **Generate new token**
4. 名前は用途がわかるもの（例: `design-qa-local`）
5. スコープは **File content に read** を付ける（このスクリプトはファイル構造を読むだけ）
6. 有効期限を選ぶ。**期限を付けた場合、切れた日に `npm run design:figma` が 403 で落ちる**
   （スクリプトはその旨をメッセージで出す）
7. **生成直後の画面でしかトークン全体は見られない。** その場でコピーする

### 8-2. ~/.zshrc に入れる

```bash
# 追記する
echo 'export FIGMA_TOKEN="figd_ここに貼る"' >> ~/.zshrc

# 今開いているターミナルにも反映する
source ~/.zshrc

# 入ったか確認する（トークン本体は出さず、長さだけ見る）
echo "${#FIGMA_TOKEN}"
```

`0` と出たら入っていない。数十文字の数字が出れば入っている。

### 8-3. fileKey を入れる

`scripts/check-figma.mjs` の先頭にある `FILE_KEY` を書き換える。
fileKey は Figma ファイルのURLの中にある。

```
https://www.figma.com/design/XXXXXXXXXXXXXXXXXXXXXX/ファイル名
                             ^^^^^^^^^^^^^^^^^^^^^^ ここ（22文字前後の英数字）
```

環境変数 `FIGMA_FILE_KEY` を入れておけばそちらが優先されるので、
ファイルを書き換えたくない場合はそれでもよい。

### 8-3b. 「生フレームのボタン」判定の考え方

`check-figma.mjs` は「ボタンなのにコンポーネントを使わず生の Frame で作っている」箇所を拾う。
このとき**名前だけで決めない。中身と大きさも見る。**

名前が `button|btn|chip|cta|tab` にあたり、末尾が入れ物の語（`Row` `Nav` `Bar` など）でない
Frame を候補にしたうえで、次の2つは**候補から外す**。

1. **子孫に INSTANCE / COMPONENT があるもの** — その中でコンポーネントを使っている証拠なので、
   それ自体は「ボタン」ではなく**ボタンを包む入れ物**である
2. **高さが 120px を超えるもの** — ボタンにその高さはない。セクション帯や大きなカードである

この2つが無いと、`CTA Block`（中身は Button インスタンス＋説明文）や
`Final CTA`（セクション帯そのもの）のような**入れ物まで落ちる。**
GOOD LOOP では24件中21件がこの種の誤検知だった。

**`CONTAINERISH` の語リストに語を足す方向で解こうとしないこと。**
末尾が容器の語でない入れ物（`CTA Block` `Hero CTAs`）はいくらでも作れるので、語は永久に足り続ける。

**幅では判定しない。** PC管理画面には横幅864pxの全幅ボタンが実在するため、
幅を条件に入れると本物の生フレームボタンを見逃す。

### 8-4. ベースライン（負債台帳）を取る

**キットにベースラインは同梱していない。初回に自分で作る。**

既存の Figma ファイルを引き継ぐ場合、最初は違反が大量に出る。
台帳がまだ無い状態で `npm run design:figma` を回すと、**全部が「新しい種類の違反」として
出て落ちる**（それが正しい。まだ基準線が引かれていないため）。
一度だけ「今ある分は既存分」として記録する。

```bash
npm run design:figma -- --update-baseline
```

`scripts/figma-check-baseline.json` が作られる。**これはコミットする。**
以降は**それより増えた違反だけ**が落ちる。

新規に Figma をゼロから作る場合は、この手順は不要（負債ゼロから始まる）。

#### ベースラインは「件数つき」の形式

```json
{
  "total": 74,
  "keys": 40,
  "counts": {
    "MobileOrder / Dashboard / SP :: 「Admin Chip」の高さが 38px です（SPのタップ領域は44px以上）": 8
  }
}
```

**キーごとに件数を持つ。** キーだけを覚える形式だと、同じセクションに同じ名前のノードを
いくつ足してもキーが同じで緑のまま通ってしまう（＝畳んだ分だけ検出力が失われる）。

| 状況 | 結果 |
|---|---|
| キーが台帳に無い | **落とす**（新しい種類の違反） |
| キーがあり、今回の件数 ≤ 台帳の件数 | 通す |
| キーがあり、今回の件数 > 台帳の件数 | **落とす**。「8件で登録されていたものが9件に増えています（+1）」と出す |
| キーがあり、今回の件数 < 台帳の件数 | 通す。「返済が進んだもの」として報告する |

**件数が減っても台帳は自動では書き換わらない。** 書き換わるのは `--update-baseline` を
明示的に叩いたときだけ。勝手に基準線が下がると、返済したことに気づけなくなる。

#### ⚠ 旧形式の台帳が置かれているとエラーで落ちる

`{ "count": N, "allowed": [...] }` というキーの配列の形式（2026-08-04 以前）を見つけると、
**黙って読み替えずにエラーで終了する。**

```
scripts/figma-check-baseline.json が旧形式（キーの配列）です。
件数つきの形式に作り直してください:  npm run design:figma -- --update-baseline
※ 作り直す前に、構造・パディングの違反が0件であることを必ず確認すること。
```

件数を持たない台帳を「全部1件ずつ」と読み替えると、いきなり大量に落ちて原因が分からなくなるため。
**作り直す前に、構造・パディングの違反が0件であることを必ず確認すること。**
構造違反を抱えたまま作り直すと、その穴が台帳に載って永久に見えなくなる。

なお「台帳がまだ無い」と「旧形式の台帳がある」は**別の経路**になっている。
台帳が無いだけなら上のエラーには入らないので、新規プロジェクトの初回が
このエラーで詰まることはない。

#### 台帳は「返済が終わった」という意味ではない

記録した件数は、**1件も直していない未返済の負債**である。
台帳は「ここから増えたら落とす」ための基準線であって、返済の完了を意味しない。
件数を `docs/specs/design-rules.md` の「既知の負債」の表に転記し、
**返済するときの作業リストとして使う**こと。

---

## Step 9. 動作確認する

上から順に。1つでも×なら、その Step に戻る。

| # | 確認 | やり方 | 期待 |
|---|---|---|---|
| 1 | プレースホルダの消し残し | `grep -rn "{{" CLAUDE.md .claude .github scripts docs/specs` | 何も出ない |
| 2 | ローカルの check | `npm run check` | 通る |
| 3 | hooks の実行権限 | `ls -l .claude/hooks/` | `x` が付いている |
| 4 | Stop hook | AI にわざと型エラーを書かせて完了させようとする | AI が自分で気づいて直す |
| 5 | GitHub Actions | 適当な PR を1本出す | `check` が走って緑になる |
| 6 | ブランチ保護 | `git push` を main に直接試す | `GH006` で弾かれる |
| 7 | 必須チェック | CI を落とす PR を出す | マージボタンが押せない |
| 8 | Vercel | PR を出す | プレビューURLのコメントが付く |
| 9 | Sentry | 本番でわざとエラーを出す | Slack に通知が来る |
| 10 | Figma | `npm run design:figma` | 実行できる（違反が出るのは可） |

**4 と 7 は必ずやること。** ここが効いていないと、他が全部揃っていても
「壊れているのに完了と言う」が素通りする。

---

## プレースホルダ一覧

`{{ }}` の形で雛形に埋めてあるもの。**Step 4 の grep で消し残しを機械的に確認できる。**

### 全ファイル共通

| プレースホルダ | 意味 | GOOD ORDER での値 | 出てくるファイル |
|---|---|---|---|
| `{{PROJECT_NAME}}` | プロダクト名 | `GOOD ORDER` | CLAUDE.md / design-rules.md |
| `{{USER_NAME}}` | 依頼者の呼び方 | `天真` | CLAUDE.md / design-rules.md / check.yml / check-design-tokens.mjs / この README |
| `{{LANGUAGE}}` | 応答とコミットの言語 | `日本語` | CLAUDE.md |
| `{{DEFAULT_BRANCH}}` | 本流ブランチ | `main` | CLAUDE.md / check.yml |
| `{{DATE}}` | 記入日 | — | design-rules.md |

### CLAUDE.md.template

| プレースホルダ | 意味 | GOOD ORDER での値 |
|---|---|---|
| `{{PROJECT_TAGLINE}}` | 1行の説明 | `飲食店向けモバイルオーダー` |
| `{{OWNER_ORG}}` | 作っている組織 | `UTUTU（洋輔 × 天真）` |
| `{{PROJECT_KIND}}` | 位置づけ | `自社プロダクト` |
| `{{FIRST_MILESTONE}}` | 最初の実戦投入 | `最初の実戦投入は YORKYS BRUNCH の9月リオープン。` |
| `{{AUDIENCE_A_LABEL}}` / `{{AUDIENCE_A_ROUTES}}` | 利用者Aと担当ルート | `お客様側` / `/order 配下、/cart、/complete、/history（スマホ・未認証）` |
| `{{AUDIENCE_B_LABEL}}` / `{{AUDIENCE_B_ROUTES}}` | 利用者Bと担当ルート | `店舗側` / `/admin 配下（PC/タブレット・Supabase Auth ＋ ロール別 RLS）` |
| `{{STACK}}` | 技術スタック | `Next.js 14 App Router / TypeScript (strict) / Tailwind / Supabase / Vercel` |
| `{{UI_GALLERY_PATH}}` / `{{UI_GALLERY_PATH_FS}}` | ギャラリーのURL / パス | `/dev/ui` / `app/dev/ui/` |
| `{{PC_WIDTH}}` / `{{SP_WIDTH}}` | スクショの幅 | `1400` / `390` |
| `{{CRITICAL_DOMAIN}}` | 触ると危ない領域 | `注文・決済まわり` |
| `{{CRITICAL_DOMAIN_EXAMPLES}}` | その具体例 | `カート、注文確定、会計、受渡番号の採番` |
| `{{DESIGN_TOKENS_PATH}}` | トークンの実装側 | `app/design-tokens.css` |
| `{{FIGMA_FILE_KEY}}` | Figma の fileKey | — |
| `{{TOKEN_USAGE_SCOPE}}` | 任意値記法を使う範囲 | `/order 配下の新規JSX` |
| `{{BRAND_SWITCH_NOTE}}` | 色を直書きしない理由 | `ブランド切り替え（YORKYS / Izakaya 等）はアクセント4色の差し替えだけで済む構造を壊さない` |
| `{{COLOR_SCHEME}}` / `{{COLOR_SCHEME_EXCLUDED}}` | 配色方針 | `白ベース（ライトモード）` / `ダークモード` |
| `{{VERCEL_REGION}}` / `{{VERCEL_REGION_LABEL}}` / `{{VERCEL_REGION_REASON}}` | リージョン | `hnd1` / `東京` / `Supabase と同じリージョンに置くため` |
| `{{REPO_VISIBILITY}}` | 公開設定 | `public`（GOOD LOOP は `private`） |
| `{{DATABASE_NAME}}` / `{{SQL_DIR}}` | DBと SQL 置き場 | `Supabase` / `supabase/` |
| `{{SENSITIVE_PERMISSION_NOTE}}` | 緩めてはいけない権限 | `金額・会計に関わる権限（paid）は register / manager のみ` |
| `{{LEGACY_NAMES_REASON}}` / `{{LEGACY_NAMES_LIST}}` | 互換で残す名前 | 旧称 Orderly のキー3つ |
| `{{BRAND_CANONICAL_NAME}}` / `{{BRAND_DEPRECATED_NAMES}}` / `{{BRAND_SPELLINGS}}` | 表記 | `GOODシリーズ` / `旧称 NOREN / Orderly は破棄` / `YORKYS BRUNCH / YORKYS Creative` |
| `{{NAME_ORDER_RULE}}` | 並び順の決まり | `資料では洋輔を先に表記する（「洋輔 × 天真」の順）` |
| `{{ASSETS_DIR}}` | 配信対象外の素材置き場 | `assets/` |
| `{{PROJECT_SPECIFIC_DONT_1}}` / `{{..._2}}` | 実際にやらかしたこと | `Dropbox の同期競合コピーをコミットする` など |

### .github/workflows/check.yml

| プレースホルダ | 意味 | GOOD ORDER での値 |
|---|---|---|
| `{{NODE_VERSION}}` | CI の Node | `22` |
| `{{PUBLIC_ENV_VAR_1}}` / `{{..._DUMMY}}` | ビルドに要る環境変数とダミー値 | `NEXT_PUBLIC_SUPABASE_URL` / `https://placeholder.supabase.co` |
| `{{PUBLIC_ENV_VAR_2}}` / `{{..._DUMMY}}` | 同上 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `placeholder-anon-key-for-ci` |

必要な変数の洗い出し方は `check.yml` のコメントに書いてある。

### scripts/check-figma.mjs

| プレースホルダ | 意味 | GOOD ORDER での値 |
|---|---|---|
| `{{FIGMA_FILE_KEY}}` | fileKey（環境変数 `FIGMA_FILE_KEY` でも可） | — |
| `{{FIGMA_SKIP_PAGE}}` | 検品しないページ名 | `"---", "_Archive", "参考サイト"` |
| `{{FIGMA_SCREEN_PAGE}}` | PC/SP の対を要求するページ名 | `"MobileOrder"` |
| `{{FIGMA_PAIR_EXEMPT_SECTION}}` | 対を要求しないセクション名 | `"注文"` |

該当が無い場合は、その配列を空 `[]` にする。

### docs/specs/design-rules.md

| プレースホルダ | 意味 | GOOD ORDER での値 |
|---|---|---|
| `{{FIGMA_FILE_NAME}}` | Figma ファイル名 | `UTUTU` |
| `{{PRIMARY_VIEWPORT_NOTE}}` | どちらの幅が主か | `GOOD ORDER はモバイルオーダーなので、お客様側は SP が主。` |
| `{{N}}` | 既知の負債の件数 | ベースライン取得後に転記 |

---

## 付録: 移植で一番失敗しやすい3つ

1. **`chmod +x` を忘れる。**
   hooks が実行できないと、Claude Code は黙って無視する。エラーは出ない。
   「完了の定義」が効いていないことに数日気づかない、という失敗の仕方をする

2. **`required_status_checks.contexts` の名前がずれる。**
   `check.yml` の job 名（`jobs:` 直下のキー）と一致していないと、
   保護は掛かっているのに何も検査されない。緑のチェックマークが付かないまま
   マージできてしまう

3. **`CLAUDE.md` の3章に項目を詰め込みすぎる。**
   止まる項目が10個を超えると、AI は全部で確認を取るようになり、
   結果として何も進まなくなる。**止まることは安全ではない。**
   5〜6項目に絞り、それ以外は「自分で判断してよい」側に明示的に書くこと
