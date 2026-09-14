# タスクサイズ判定

## 3 段階

- **Small**: バグ / typo / 設定 / 2 ファイルまで、**またはファイル数に関係なく機械的な編集**
  （文言の置換、用語の一括リネーム、リンクやパスの修正）。
  Small にする条件は**全ハンクが同じ置換であること**で、ファイル数ではない。
  → PR → TDD → 検証 → レビュー → 仕上げ（PR 説明は短い散文でいい）
- **Medium**: 機能 / API / 複数ファイル
  → spec → plan → PR → `[人間の確認]` → TDD → 検証 → レビュー → 更新 → 仕上げ
- **Large**: アーキテクチャ / 新サブシステム / 横断変更
  → 調査 → spec → ADR（残るなら）→ plan → PR → `[人間の確認]` → 反復実装 → …

## 差分サイズに関係なく Large 扱いにする領域

1 行の変更でもここに触れたら Large。

- **認証と権限** — `api/_auth.js`（ACCESS_CODE / Bearer の判定）、`api/admin.js` の is_admin チェック。
  間違えると、認証を通らない利用者に Anthropic API の課金を開放するか、管理データを漏らす。
- **service_role key の使い道** — `api/_log.js` と `api/admin.js`。RLS をバイパスする鍵なので、
  使う箇所を増やす・渡す値を変えるのは Large。フロントへ出る経路（`api/config.js`）に混ぜない。
- **Supabase のスキーマ・RLS・RPC**（`profiles` / `usage_logs` / `training_records` / `get_admin_stats`）。
  定義がリポジトリの外にあり、テストで照合できない。
- **API とフロントの JSON 契約** — プロンプト内の JSON 例（`api/lookup.js` / `api/convert.js` / `api/quiz.js`）と
  `index.html` の描画側。キーの追加・改名・型の変更は Large。
- **対象方言の切り替え** — `api/_dialect.js` の `TARGET_REGION` と、`index.html` のハードコード表記。

## 文書だけの作業

差分ではなく「その文章が何を決めるか」でサイズを決める。

- 既存 ADR の本文を現状へ合わせる書き換え、ルール / AGENTS.md / スキルの編集は Small。
- どこにも書かれていない決定を初めて記録するのは Large で、ADR から始まる。
