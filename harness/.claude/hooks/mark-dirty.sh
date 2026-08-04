#!/bin/bash
# PostToolUse hook — AIがファイルを編集したときに走る。
#
# 編集されたファイルが npm run check の対象（TS/JS/CSS/JSON）だったときだけ、
# 「まだ検証していない変更がある」という印（マーカーファイル）を立てる。
# この印を Stop hook が見て、check を走らせるかどうかを決める。
#
# 何も出力せず、常に exit 0 で終わる（このhookはAIの動作を止めない）。

input=$(cat)

# stdin に来る JSON から、編集されたファイルのパスを取り出す。
# macOS に jq が入っていない環境でも動くよう、node で読む。
FILE=$(printf '%s' "$input" | node -e "
let s='';
process.stdin.on('data', d => s += d);
process.stdin.on('end', () => {
  try { console.log(JSON.parse(s).tool_input?.file_path || ''); }
  catch (e) { console.log(''); }
});
" 2>/dev/null)

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.css|*.json)
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude"
    touch "$CLAUDE_PROJECT_DIR/.claude/.needs-check"
    ;;
esac

exit 0
