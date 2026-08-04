# 検証スクリーンショット置き場

PR 本文に貼るための証跡。**アプリの成果物ではない。**

GitHub の PR 本文に画像を貼るには、どこかにホストされている必要がある。
このリポジトリは public なので、ここに置いたものを
`https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` で参照できる。

日付つきのフォルダを PR ごとに1つ作り、その PR の検証に使った画像だけを入れる。
**普段のスクリーンショットはここに置かない**（`.playwright-mcp/` は gitignore 済み）。

| フォルダ | 何の検証か |
|---|---|
| `2026-08-04-playwright-clean-session/` | Playwright MCP の偽ログイントークン除去（`fix/playwright-clean-session`） |
| `2026-08-04-separate-build-dir/` | `npm run check` のビルド出力先を分離し dev を壊さなくした（`fix/separate-build-dir`） |
| `2026-08-04-admin-login-redesign/` | ログイン画面を現行の管理画面トンマナに合わせ直した（`feat/admin-login-redesign`） |
| `2026-08-04-display-settings/` | 店舗設定を「表示設定」に作り替え、着地画面の背景を色/画像/動画から選べるようにした（`feat/display-settings`） |
