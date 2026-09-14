// 2 択クイズと変換の JSON 契約を、3 か所（プロンプト内の JSON 例 / api/_normalize.js / index.html の描画）で突き合わせる。
// これが無いと、プロンプトの JSON 例のキーを変えても正規化ヘルパーは古いキーを読んで例外を投げるだけ、
// 応答のキーを変えても index.html は undefined を描くだけで、モデルを呼ぶまで誰も気づかない。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { CHOICE_MODEL_KEYS, CHOICE_RESPONSE_KEYS, SEGMENT_MODEL_KEYS, CONVERT_RESPONSE_KEYS } = require('../../api/_normalize');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// プロンプトのテンプレート文字列中の JSON 例に "key": として現れるキー
const jsonExampleKeys = (src) => new Set([...src.matchAll(/"(\w+)"\s*:/g)].map((m) => m[1]));

// quiz.js の generate_choice 分岐だけを切り出す（generate / grade の JSON 例と混ぜない）
function choiceBranch() {
  const src = read('api/quiz.js');
  const m = src.match(/action === 'generate_choice'[\s\S]*?(?=\} else if \(action ===|\} else \{)/);
  assert.ok(m, 'api/quiz.js に generate_choice の分岐が見つからない');
  return m[0];
}

test('2択: 正規化ヘルパーが読むキーが、プロンプトの JSON 例にすべてある', () => {
  const keys = jsonExampleKeys(choiceBranch());
  assert.deepStrictEqual(CHOICE_MODEL_KEYS.filter((k) => !keys.has(k)), []);
});

test('変換: 正規化ヘルパーが読むキーが、プロンプトの JSON 例にすべてある', () => {
  const keys = jsonExampleKeys(read('api/convert.js'));
  assert.deepStrictEqual(['segments', ...SEGMENT_MODEL_KEYS].filter((k) => !keys.has(k)), []);
});

test('publicEntry が PUBLIC_ENTRY_KEYS と同じキーを返す', () => {
  const { VOCAB, PUBLIC_ENTRY_KEYS, publicEntry } = require('../../api/_vocab');
  assert.deepStrictEqual(Object.keys(publicEntry(VOCAB[0])).sort(), [...PUBLIC_ENTRY_KEYS].sort());
});

test('応答のキーを index.html が読んでいる', () => {
  const html = read('index.html');
  const { PUBLIC_ENTRY_KEYS } = require('../../api/_vocab');
  const { BROADCAST_EXAMPLE_KEYS } = require('../../api/_dictionary');
  const unread = [...CHOICE_RESPONSE_KEYS, ...CONVERT_RESPONSE_KEYS, ...SEGMENT_MODEL_KEYS, 'vocab', ...PUBLIC_ENTRY_KEYS,
    'broadcastExamples', ...BROADCAST_EXAMPLE_KEYS]
    .filter((k) => !new RegExp(`\\.${k}\\b`).test(html));
  assert.deepStrictEqual(unread, []);
});
