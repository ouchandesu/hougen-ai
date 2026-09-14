// ADR の索引（docs/adr/index.md）は各 ADR のヘッダから生成する生成物。
// これが無いと、ADR のステータスや決定を書き換えても索引が古いまま残り、
// 索引だけを読んだ人が覆された決定を現行だと思い込む。
// ファイル名と本文 1 行目の番号の食い違いも、外から「ADR 0001」と綴りで引く運用を黙って壊す。

const test = require('node:test');
const assert = require('node:assert');
const { INDEX_PATH, listAdrs, buildIndex, readText } = require('../adr-index');

test('docs/adr/index.md が再生成結果と一致する', () => {
  assert.strictEqual(readText(INDEX_PATH), buildIndex(), 'npm run adr:index で再生成してコミットする');
});

test('ADR のファイル名の番号と本文 1 行目の番号が一致する', () => {
  const adrs = listAdrs();
  assert.ok(adrs.length > 0, 'ADR が 1 本も見つからない');
  for (const a of adrs) assert.strictEqual(a.headingNumber, a.number, `${a.file} の見出し`);
});

test('ADR の番号が重複しない', () => {
  const numbers = listAdrs().map((a) => a.number);
  assert.deepStrictEqual(numbers, [...new Set(numbers)]);
});
