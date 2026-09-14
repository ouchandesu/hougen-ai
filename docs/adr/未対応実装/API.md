# API（API-）

| ID | 種別 | 内容 | 根拠 |
| --- | --- | --- | --- |
| API-718 | 負債 | 予備の一覧 `api/_vocab.js` と Supabase の辞書が二重にあり、管理画面で直した語は一覧に反映されない。Supabase が使えないときだけ古い内容で出題される。辞書の運用が安定したら、予備を「辞書から書き出したもの」にするか消す | `api/_vocab.js`, `api/_dictionary.js` |
| API-293 | 負債 | Anthropic のモデル ID が 3 ファイルに同じ値で直書きされていて、1 か所だけ変わっても何も落ちない | `api/lookup.js`, `api/convert.js`, `api/quiz.js` |
