#!/usr/bin/env bash
set -euo pipefail

BASE="https://v2.xivapi.com/api/sheet/ContentFinderCondition"
after=0

TMP_NDJSON="duties_all.tmp.ndjson"
OUT_JSON="duties_all.json"

# 一旦 tmp を消す
rm -f "$TMP_NDJSON"

echo "Fetching duties from XIVAPI..."

while :; do
  echo "  - after=${after} で取得中..."
  res=$(curl -s "${BASE}?fields=Name&language=ja&limit=200&after=${after}")

  # このページの rows を NDJSON 形式で追記
  echo "$res" \
    | jq -c '.rows[] | select(.fields.Name != "") | {duty_id: .row_id, duty_name: .fields.Name}' \
    >> "$TMP_NDJSON"

  # 取れた件数確認
  count=$(echo "$res" | jq '.rows | length')

  # 200件未満になったら最後のページ
  if [ "$count" -lt 200 ]; then
    break
  fi

  # 次ページ用の after を最後の row_id に更新
  after=$(echo "$res" | jq '.rows[-1].row_id')
done

echo "Building pretty JSON..."

# NDJSON を配列にまとめて、キーを duty_id 順にソートして整形出力
jq -s 'sort_by(.duty_id)' "$TMP_NDJSON" > "$OUT_JSON"

# tmp は削除
rm -f "$TMP_NDJSON"

echo "✅ Done: ${OUT_JSON}"