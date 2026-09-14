# spec・plan・PR（ステップ 2〜4）

## 置き場

- spec と plan は `docs/specs/<YYYY-MM-DD>-<題>.md` の 1 ファイルにまとめる。
- ここは使い捨て。実装が終わったら、残すべきものをコード・テスト・ルール・ADR・台帳へ移して**消す**。

## spec に書くこと

- 目的（誰の何が変わるか。利用者はアナウンサー、管理者はダッシュボードを見る人）
- 変更の範囲と **Non Goals**（やらないこと。仕上げで台帳へ収穫する）
- 触る境界: 認証 / JSON 契約 / Supabase / 対象方言 のどれに当たるか（task-sizing.md の Large 領域）
- 自分で判断した箇所と、その理由。訊かずに書いて先へ進む

## plan に書くこと

- 変更するファイルごとの作業（`api/*.js` / `index.html` / `admin.html` など）
- どの検査で確かめるか（implementation-and-verification.md の表から選ぶ）
- 手元で検証できないもの（鍵が要る呼び出しなど）と、その扱い

## PR（設計チェックポイント）

- 作業ブランチを切る（`main` で作業しない）。spec/plan をコミットして push し、`gh pr create --draft` で PR を開く。
- `main` への push はしない。PR の push は作業ブランチだけ。
- PR 本文には spec/plan の要点と「実装を始めていい?」を書き、会話でも同じことを訊く。**ここで止まる。**
- Small は spec/plan を省き、実装まで済ませてから PR を開いてよい。
