#!/bin/bash
# Playwright MCP のブラウザプロファイルを掃除する。
#
#   ./scripts/clean-playwright-profile.sh          何が消えるか見るだけ（削除しない）
#   ./scripts/clean-playwright-profile.sh --force  実際に消す
#
# ── なぜこのスクリプトがあるのか ────────────────────────────────
#
# Playwright MCP は既定で「永続プロファイル」を使う。ブラウザに入れた
# localStorage / Cookie が ~/Library/Caches/ms-playwright-mcp/ に保存され、
# **次のセッションにも、その次にも残り続ける。**
#
# 2026-08-04 に、この永続プロファイルへ手製の偽ログイントークン
# （署名が "screenshot-only" の JWT）が残っているのが見つかった。
# 過去のセッションが管理画面のログインを迂回するために localStorage へ
# 差し込んだものが、消されないまま居座っていた。
#
# その状態でお客様側のページを開くと、Supabase がこの偽トークンを検証できず
# 401 を返し、ベストセラーなどが欠けた「本来と違う絵」が撮れてしまう。
# AI が自分で画面を確認する仕組みが、間違った絵を返していたことになる。
#
# ── 恒久対策 ────────────────────────────────────────────────
#
# `.mcp.json` の Playwright MCP に `--isolated` を付けた。
# 「プロファイルをメモリ上に置き、ディスクに保存しない」オプションで、
# **毎回まっさらなブラウザで起動する。** 何かを差し込まれても次には残らない。
#
# なのでこのスクリプトは、平常時は不要。使う場面は次の2つ。
#
#   1. `--isolated` を入れる前から残っている古いプロファイルの後片付け
#      （＝今回の1回きりの掃除。他のMacで作業を始めるときにも要る）
#   2. 何らかの事情で `--isolated` を外して作業したあとの後始末
#
# ── 管理画面のスクリーンショットを撮りたいときは ──────────────
#
# `--isolated` により、ログイン状態も毎回消える。偽トークンを差し込むのではなく、
# **`/admin/login` から実際のアカウントでログインしてから撮る**こと。
# 偽トークンは Supabase 側で検証できないので、そもそも管理画面のデータも
# 正しく読めていない（見えていた画面は一部フォールバック表示だった）。

set -u

PROFILE_ROOT="$HOME/Library/Caches/ms-playwright-mcp"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

if [ ! -d "$PROFILE_ROOT" ]; then
  echo "永続プロファイルはありません: $PROFILE_ROOT"
  echo "（--isolated で動いていれば、これが正常な状態です）"
  exit 0
fi

echo "対象: $PROFILE_ROOT"
echo ""

FOUND=0
for profile in "$PROFILE_ROOT"/*/; do
  [ -d "$profile" ] || continue
  name=$(basename "$profile")

  # 保存された状態が入りうる場所だけを狙って消す。
  # プロファイル全体を消さないのは、ブラウザ本体のキャッシュまで巻き込むと
  # 次回起動が無駄に遅くなるため。
  for sub in "Default/Local Storage/leveldb" "Default/Session Storage" "Default/IndexedDB"; do
    dir="$profile$sub"
    [ -d "$dir" ] || continue

    # 中身があるものだけ報告する
    count=$(find "$dir" -type f 2>/dev/null | wc -l | tr -d ' ')
    [ "$count" = "0" ] && continue

    FOUND=1
    echo "  [$name] $sub — ファイル $count 件"

    # 偽トークンが実際に入っているかを目で見えるようにする
    if find "$dir" -type f -exec grep -l "screenshot-only" {} + >/dev/null 2>&1; then
      echo "      ⚠ 偽トークン（screenshot-only）を検出"
    fi

    if [ "$FORCE" = "1" ]; then
      find "$dir" -type f -delete 2>/dev/null
      echo "      → 削除しました"
    fi
  done

  # Cookie は単一ファイル
  for f in "$profile/Default/Cookies" "$profile/Default/Cookies-journal"; do
    [ -f "$f" ] || continue
    FOUND=1
    echo "  [$name] $(basename "$f")"
    if [ "$FORCE" = "1" ]; then
      rm -f "$f"
      echo "      → 削除しました"
    fi
  done
done

echo ""
if [ "$FOUND" = "0" ]; then
  echo "✔ 保存された状態はありません。掃除は不要です。"
  exit 0
fi

if [ "$FORCE" = "1" ]; then
  echo "✔ 掃除しました。次回のブラウザ起動時にまっさらな状態から始まります。"
else
  echo "上は「見つかったもの」の一覧です。まだ何も消していません。"
  echo "実際に消すには --force を付けて実行してください:"
  echo ""
  echo "    ./scripts/clean-playwright-profile.sh --force"
fi
