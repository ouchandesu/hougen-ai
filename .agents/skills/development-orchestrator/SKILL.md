---
name: development-orchestrator
description: Use whenever the user asks for any change to this repository — development, implementation planning, bug investigation, feature delivery, architecture changes, broad refactors, wording and copy changes, renaming a term across the repo, README / rule / skill edits, and ADR authoring or updates. It applies even when the change is text-only, mechanical, or a one-line fix.
---

# development-orchestrator

このレポジトリへの変更はすべてこの流れに乗せる。本文はルート地図だけで、各ステップの拘束は
`references/` にある。**表のファイルは、そのステップを始める前に開く。**あとで読むのではない。

## 何を読まなくても守る 3 つ

- **人間の確認は段階 4 の 1 回だけ。** それ以前（spec・plan・PR 作成）は訊かずに走り、やったことを報告する。
  それ以降も、破壊的・外部に出る操作でない限り訊かずに走る。
- **出力なしに「通った」と言わない。** 貼ったコマンド出力だけが検査に通った根拠。
- **設計メモの置き場（`docs/specs/`）は定期的に手で消す。** 残すべきものはコード・テスト・ルール・ADR へ移す。
  「spec に書いてある」は残ったことにならない。

## フロー

```
1. タスクサイズ判定
2. spec と plan
3. PR を開く（設計チェックポイント）   ← 1〜3 は一続きで自律実行
4. 実装開始の承認（人間の確認は 1 回だけここ）
5. TDD + 実装
6. 検証
7. レビュー
8. ルール / スキル / ADR の更新
9. PR の仕上げ
```

## 読む順

| ステップ | 始める前に開くファイル |
| --- | --- |
| 全ステップ（最初に 1 回） | `references/autonomy-and-checkpoints.md` |
| 1 | `references/task-sizing.md` |
| 2〜4 | `references/spec-plan-and-pr.md` |
| 5〜6 | `references/implementation-and-verification.md` |
| 7 | `references/review.md` |
| 8〜9 | `references/knowledge-capture.md` |

## サイズ別の経路（詳細は task-sizing.md）

- **Small**: PR → TDD → 検証 → レビュー → 仕上げ
- **Medium**: spec → plan → PR → `[人間の確認]` → TDD → 検証 → レビュー → 更新 → 仕上げ
- **Large**: 調査 → spec → ADR（残るなら）→ plan → PR → `[人間の確認]` → 反復実装 → 検証 → レビュー → 更新 → 仕上げ
