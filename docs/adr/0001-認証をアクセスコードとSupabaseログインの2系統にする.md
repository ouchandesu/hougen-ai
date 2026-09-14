# 0001: 認証をアクセスコードとSupabaseログインの2系統にする

- ステータス: Accepted
- 実装状況: 実装済み（api/_auth.js, api/admin.js, index.html）
- 決定: 利用 API はアクセスコードか Supabase ログインのどちらかで通し、管理画面は Supabase ログインとサーバー側の is_admin 確認に限る

## コンテキスト

Anthropic API の鍵はサーバー側（Vercel 環境変数）に置いているので、API を叩ける人を絞らないと課金が誰にでも開く。
一方で、企業デモや研修の場ではアカウント作成なしにすぐ使わせたい。
個人の学習記録を端末をまたいで残すには、利用者を識別する必要がある。

## 決定

1. `api/lookup.js` / `api/convert.js` / `api/quiz.js` は `verifyAuth` を通す。
   リクエスト本文の `accessCode` が環境変数 `ACCESS_CODE` と一致するか、
   `Authorization: Bearer` のトークンを Supabase の `/auth/v1/user` が受け付ければ通す。
2. アクセスコードで入った利用者は匿名扱い（利用ログの `user_id` は null）で、学習記録はブラウザの localStorage に置く。
   Supabase でログインした利用者の学習記録は `training_records` に置き、初回ログイン時に localStorage の記録を移す。
3. 管理画面の API（`api/admin.js`）はアクセスコードを受け付けない。
   トークンからユーザーを特定し、`profiles.is_admin` を service_role key でサーバー側から確かめてからデータを返す。
   フロント側の判定には頼らない。

## 帰結

- アクセスコードは全員で共有する 1 つの秘密で、漏れたら API の課金が開く。変えるには Vercel 環境変数を変えて再デプロイする。
- アクセスコード利用者は利用ログで個人を区別できない。
- 認証の判定に npm の SDK を使わず fetch で済ませている（ADR 0002）。
- Supabase が未設定でもアクセスコードだけで動く（`api/config.js` が空値を返し、フロントがアクセスコードのみのモードになる）。

## 却下案

- アクセスコードのみ: 端末をまたいだ個人の学習記録が残せない。
- Supabase ログインのみ: デモや研修の場で、その場で使い始められない。
