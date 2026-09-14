# 伊予弁ナビ

アナウンサー向けの伊予弁学習ツール。調べる・研修（クイズ）・標準語→伊予弁変換の 3 モードを、
単一 HTML のフロントと Vercel サーバーレス関数（Anthropic API / Supabase を fetch で呼ぶ）で提供する。
npm 依存は持たない（ADR 0002）。

## このレポジトリへの変更を始める前に

`.agents/rules/general/general-rules.md` を読む。

## 構成

```
index.html        メイン画面（HTML/CSS/JS を 1 ファイルに持つ）
admin.html        管理ダッシュボード（/api/admin の集計を表示）
api/              Vercel サーバーレス関数（CommonJS）。_ 始まりは共有ヘルパー
  _auth.js        ACCESS_CODE / Supabase Bearer の 2 系統認証（ADR 0001）
  _dialect.js     対象方言の定義とプロンプト共通ルール（ADR 0003）
  _log.js         usage_logs への利用ログ記録
scripts/          開発用スクリプト（ADR 道具・リンク作成）
scripts/checks/   陳腐化を落とす検査テスト（node --test）
docs/adr/         設計判断（ADR）と、やらなかったことの台帳
.agents/          エージェント向けルールとスキルの実体（.claude/ からリンク）
.claude/          Claude Code の設定とフック
```

## タスクの索引

`package.json` の `scripts` が全部。`npm run` で一覧が出る。

| やりたいこと | コマンド |
| --- | --- |
| 検査テスト | `npm test` |
| ADR を 1 本作る | `npm run adr:new -- "タイトル"` |
| ADR 索引を再生成 | `npm run adr:index` |
| .claude/ のリンクを張る（Windows で clone 直後） | `npm run link` |

## 参照先の地図

- 設計判断: `docs/adr/`（索引は `docs/adr/index.md`、運用ルールは `docs/adr/README.md`）
- 決定済みで未実装・未検証のもの: `docs/adr/未対応実装/`
- 開発フロー: `.agents/skills/development-orchestrator/SKILL.md`
- 環境変数（Vercel に設定、リポジトリには置かない）: `ANTHROPIC_API_KEY` / `ACCESS_CODE` /
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- Supabase のテーブル・RLS・RPC の定義はリポジトリの外（Supabase ダッシュボード）にある
