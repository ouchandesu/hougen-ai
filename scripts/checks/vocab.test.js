// 出題に使う語の一覧（api/_vocab.js）の形と、出題する語の選び方を固定する。
// これが無いと、裏付けの URL が無い語や id の重複が紛れ込んでも、クイズは何事もなく出題を続ける
// （資料で裏付けた語だけを出す、という前提が黙って崩れる）。

const test = require('node:test');
const assert = require('node:assert');
const { USAGE_LABELS, VOCAB, publicEntry, pickEntry, entryForPrompt, findEntry } = require('../../api/_vocab');
const { validateEntry } = require('../../api/_dictionary');

test('一覧が空でない', () => {
  assert.ok(VOCAB.length >= 20, `語が ${VOCAB.length} 件しかない`);
});

test('各語が辞書の検証（出典 2 つ以上など）を通る', () => {
  // 管理 API と同じ validateEntry を使う。一覧は辞書の初期データの元なので、同じ決まりを満たす
  const broken = VOCAB.map((e) => [e.id || e.word, validateEntry(e)]).filter(([, errors]) => errors.length);
  assert.deepStrictEqual(broken, []);
});

test('id と語が重複しない', () => {
  const dup = (key) => VOCAB.map((e) => e[key]).filter((v, i, a) => a.indexOf(v) !== i);
  assert.deepStrictEqual(dup('id'), []);
  assert.deepStrictEqual(dup('word'), []);
});

test('例文の出典は、その語の裏付けの URL に含まれる', () => {
  const stray = VOCAB.flatMap((e) => e.examples.filter((x) => !e.sources.includes(x.source)).map(() => e.id));
  assert.deepStrictEqual(stray, []);
});

const SAMPLE = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('出題済みの語は選ばない', () => {
  for (const r of [0, 0.5, 0.99]) {
    assert.strictEqual(pickEntry(['a', 'c'], () => r, SAMPLE).id, 'b');
  }
});

test('全部出題済みなら一覧全体から選び直す', () => {
  assert.ok(SAMPLE.includes(pickEntry(['a', 'b', 'c'], () => 0.99, SAMPLE)));
  assert.ok(SAMPLE.includes(pickEntry(undefined, () => 0, SAMPLE)));
});

test('プロンプトに渡す情報と画面に返す情報に、資料の意味が入る', () => {
  const e = VOCAB[0];
  assert.ok(entryForPrompt(e).includes(e.meaning));
  assert.strictEqual(publicEntry(e).meaning, e.meaning);
  assert.strictEqual(publicEntry(e).usageLabel, USAGE_LABELS[e.usage]);
  assert.strictEqual(findEntry(e.id), e);
  assert.strictEqual(findEntry('no-such-id'), null);
});
