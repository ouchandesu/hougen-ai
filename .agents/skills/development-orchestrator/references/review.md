# レビュー（ステップ 7）

差分を自分で読み直す。見るのは、検査が落とさない壊れ方。

## 観点

- **認証の抜け** — 新しい `api/*.js` が `verifyAuth` を通っているか。`api/admin.js` 相当の処理が
  フロント側の判定だけに頼っていないか。
- **秘密の露出** — `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` がレスポンス・エラーメッセージ・
  `api/config.js`・HTML に出ていないか。
- **JSON 契約の片側だけの変更** — プロンプト内の JSON 例のキーと `index.html` の読み出しが一致しているか。
- **XSS** — モデルの出力や利用者の入力を `innerHTML` に入れる箇所が `escapeHtml` を通っているか。
- **プロンプトの純度** — 対象方言の語や地域名を直書きせず `api/_dialect.js` の `TARGET_REGION` / 共通ルールを使っているか。
- **利用ログ** — 新しい機能が `logUsage` を呼び、その `action` が `admin.html` の `actionLabels` にあるか。
- **コメント密度** — 周囲に合わせる（日本語、処理の意図を書く）。

## 仕上げ前に

- `git show --stat` でコミットに無関係なファイルが混ざっていないか見る。
- 検証の出力を PR に貼る。
