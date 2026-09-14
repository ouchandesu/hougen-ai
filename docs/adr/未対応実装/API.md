# API（API-）

| ID | 種別 | 内容 | 根拠 |
| --- | --- | --- | --- |
| API-641 | 未検証 | 2択出題（`generate_choice`）と変換の `segments` は、Anthropic をスタブにして画面まで通しただけ。実モデルが原文どおりに区切るか（`matchesInput` が false になる頻度）、誤答の選択肢がもっともらしいか、濃さ 3 段階で出力が変わるかは、プレビュー環境で試すまで分からない | `api/quiz.js`, `api/convert.js`, `api/_normalize.js` |
| API-293 | 負債 | Anthropic のモデル ID が 3 ファイルに同じ値で直書きされていて、1 か所だけ変わっても何も落ちない | `api/lookup.js`, `api/convert.js`, `api/quiz.js` |
