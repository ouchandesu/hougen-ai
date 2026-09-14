# 全変更に効くルール

- 着手前に `.agents/skills/development-orchestrator/SKILL.md` を読む。文言だけ・1 行だけの変更でも同じ。

## git

- ステージは明示パスだけ。`git add -A` / `git add .` / `git commit -a` を使わない
  （他のセッションが触った無関係な変更が混ざる。`git commit` は混入を表示しない）。
  コミット後に必ず `git show --stat HEAD` を見て、意図したファイルだけか確かめる。
- コミット件名は日本語で、何をしたかを 1 行で書く（既存の履歴に合わせる。Conventional Commits は使わない）。
- `main` へ直接 push しない。`main` への push は Vercel の本番反映につながりうる。

## 出荷と外部

- デプロイ（`vercel` / `vercel deploy` / `vercel --prod`）と、Vercel 環境変数の変更（`vercel env`）は人間がやる。
- `.env*` を読まない・作らない。秘密は Vercel 環境変数だけに置く。
- Supabase のスキーマ・RLS・RPC はリポジトリの外にある。変更が必要なら SQL を提示して人間に適用してもらう。

## プロセス

- パターンでプロセスを止めない（`pkill -f` / `killall` / `taskkill /IM` / `Stop-Process -Name`）。
  同じマシンの別セッションまで止まる。自分で起動したものを PID で止める。

## このレポジトリ固有の地雷

- ビルド・lint・型チェックが無い。`index.html` のインライン JS の構文エラーは、ブラウザで開くまで誰も気づかない。
  フック（`.claude/hooks/check-syntax.js`）が編集直後に検査するので、その出力を無視しない。
- API のレスポンス JSON のキーは、プロンプト内の JSON 例（`api/*.js`）と `index.html` の描画側に別々に書かれている。
  片方だけ変えない。
- 利用ログの `action` 名を足したら `admin.html` の `actionLabels` にも足す（検査テストが落とす）。
