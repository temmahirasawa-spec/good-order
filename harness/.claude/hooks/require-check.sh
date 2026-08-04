#!/bin/bash
# Stop hook — AIが「完了しました」と応答を終えようとするたびに走る。
#
# ・マーカーが無い（＝コードを触っていない）ら、何もせず即座に通す
# ・マーカーがあれば npm run check を実行する
#     通った  → マーカーを消して、完了を許可する
#     落ちた  → exit 2 で停止を拒否し、エラー内容をAIに突き返す
#               AIはそれを読んで自分で直し、もう一度完了しようとする
# ・3回連続で落ちた場合は打ち切って通す（無限ループ防止。CLAUDE.md 2章の規定と同じ）

MARKER="$CLAUDE_PROJECT_DIR/.claude/.needs-check"
COUNTER="$CLAUDE_PROJECT_DIR/.claude/.check-attempts"

input=$(cat)

# 未検証の変更が無ければ、会話だけの turn。即座に通す。
[ -f "$MARKER" ] || exit 0

# stop_hook_active が false ＝ この turn で初めての停止。試行回数をリセットする。
if ! printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  echo 0 > "$COUNTER"
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

if OUTPUT=$(npm run check 2>&1); then
  rm -f "$MARKER" "$COUNTER"
  exit 0
fi

ATTEMPTS=$(cat "$COUNTER" 2>/dev/null || echo 0)
ATTEMPTS=$((ATTEMPTS + 1))
echo "$ATTEMPTS" > "$COUNTER"

if [ "$ATTEMPTS" -ge 3 ]; then
  rm -f "$MARKER" "$COUNTER"
  exit 0
fi

{
  echo "=========================================================="
  echo " npm run check が失敗しました（$ATTEMPTS 回目 / 3回まで自動修正）"
  echo " CLAUDE.md 2章のとおり、この作業はまだ完了していません。"
  echo " 下のエラーを読んで自分で修正し、もう一度完了してください。"
  echo "=========================================================="
  echo "$OUTPUT" | tail -60
} >&2

exit 2
