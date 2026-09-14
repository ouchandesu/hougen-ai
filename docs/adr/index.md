# ADR 索引

<!-- scripts/adr-index.js が生成する。手で編集しない（npm run adr:index） -->

| 番号 | 題 | ステータス | 実装状況 | 決定 |
| --- | --- | --- | --- | --- |
| 0001 | [認証をアクセスコードとSupabaseログインの2系統にする](<0001-認証をアクセスコードとSupabaseログインの2系統にする.md>) | Accepted | 実装済み（api/_auth.js, api/admin.js, index.html） | 利用 API はアクセスコードか Supabase ログインのどちらかで通し、管理画面は Supabase ログインとサーバー側の is_admin 確認に限る |
| 0002 | [npm依存とビルド工程を持たない構成にする](<0002-npm依存とビルド工程を持たない構成にする.md>) | Accepted | 実装済み（package.json, index.html, admin.html, api/） | フロントは単一 HTML、サーバーは api/ の CommonJS 関数とし、npm 依存とビルド工程を持たず、外部サービスは fetch で呼ぶ |
| 0003 | [対象方言を1つに絞りapi/_dialect.jsに定義を集める](<0003-対象方言を1つに絞りapi-_dialect.jsに定義を集める.md>) | Accepted | 一部実装（API 側は api/_dialect.js に集約済み。index.html の表記は未対応 — 台帳 FE-417） | 扱う方言は 1 つ（現在は愛媛県の伊予弁）とし、プロンプトに入る方言名・地域名・語尾・混ぜてはいけない方言は api/_dialect.js の TARGET_REGION と共通ルール関数から組み立てる |
