// モデルの出力を API の応答へ整える api/_normalize.js の振る舞いを固定する。
// これが無いと、正解の位置がずれた 2 択問題や、組み立てを誤った変換文が、
// エラーにならずそのまま画面に出る（モデルを呼ばないと気づけない）。

const test = require('node:test');
const assert = require('node:assert');
const { normalizeChoiceQuestion, normalizeConvert } = require('../../api/_normalize');

const RAW_CHOICE = {
  sentence: 'はよ来んと、おいていくけんね',
  region: '中予',
  question: 'この例文の意味として正しいのはどちら？',
  correct: '早く来ないと、置いていくからね',
  wrong: '早く来なくても、待っているからね',
  explanation: '解説',
  announcerTips: '注意点',
};

test('2択: 乱数がどちらでも choices[answerIndex] が正解を指す', () => {
  for (const r of [0, 0.49, 0.5, 0.99]) {
    const q = normalizeChoiceQuestion(RAW_CHOICE, 'meaning', () => r);
    assert.strictEqual(q.choices.length, 2);
    assert.strictEqual(q.choices[q.answerIndex], RAW_CHOICE.correct);
    assert.strictEqual(q.choices[1 - q.answerIndex], RAW_CHOICE.wrong);
  }
});

test('2択: 乱数で正解の位置が 0 と 1 の両方になる', () => {
  const positions = [0, 0.99].map((r) => normalizeChoiceQuestion(RAW_CHOICE, 'scene', () => r).answerIndex);
  assert.deepStrictEqual(positions.sort(), [0, 1]);
});

test('2択: 問題文・例文・解説と kind をそのまま返す', () => {
  const q = normalizeChoiceQuestion(RAW_CHOICE, 'scene', () => 0);
  assert.strictEqual(q.kind, 'scene');
  assert.strictEqual(q.sentence, RAW_CHOICE.sentence);
  assert.strictEqual(q.question, RAW_CHOICE.question);
  assert.strictEqual(q.region, RAW_CHOICE.region);
  assert.strictEqual(q.explanation, RAW_CHOICE.explanation);
  assert.strictEqual(q.announcerTips, RAW_CHOICE.announcerTips);
});

test('2択: 必須キーの欠け・空・正誤が同じ文は例外にする', () => {
  for (const key of ['sentence', 'question', 'correct', 'wrong']) {
    assert.throws(() => normalizeChoiceQuestion({ ...RAW_CHOICE, [key]: undefined }, 'meaning'), key);
    assert.throws(() => normalizeChoiceQuestion({ ...RAW_CHOICE, [key]: '  ' }, 'meaning'), key);
  }
  assert.throws(() => normalizeChoiceQuestion({ ...RAW_CHOICE, wrong: RAW_CHOICE.correct }, 'meaning'));
  assert.throws(() => normalizeChoiceQuestion(null, 'meaning'));
});

test('変換: 区切りを順に保ち、標準語側の連結が入力と一致すれば matchesInput', () => {
  const input = '早く来ないと、置いていくからね';
  const r = normalizeConvert({
    segments: [
      { standard: '早く', iyoben: 'はよ', alternatives: [] },
      { standard: '来ないと', iyoben: '来んと' },
      { text: '、置いていく' },
      { standard: 'からね', iyoben: 'けんね', alternatives: ['けんな'] },
    ],
  }, input);
  assert.strictEqual(r.matchesInput, true);
  assert.deepStrictEqual(r.segments.map((s) => s.text ?? s.iyoben), ['はよ', '来んと', '、置いていく', 'けんね']);
  assert.deepStrictEqual(r.segments[3].alternatives, ['けんな']);
  assert.deepStrictEqual(r.segments[1].alternatives, []);
});

test('変換: 標準語側が入力と違えば matchesInput は false（結果は返す）', () => {
  const r = normalizeConvert({ segments: [{ standard: 'だめ', iyoben: 'いかん' }, { text: '。' }] }, 'だめだよ');
  assert.strictEqual(r.matchesInput, false);
  assert.strictEqual(r.segments.length, 2);
});

test('変換: alternatives は文字列だけ・重複と本体と同じものを除き・3 件まで', () => {
  const r = normalizeConvert({
    segments: [{ standard: 'だめ', iyoben: 'いかん', alternatives: ['いかん', 'つまらん', 3, '', 'つまらん', 'あかなん', 'だちかん', 'でけん'] }],
  }, 'だめ');
  assert.deepStrictEqual(r.segments[0].alternatives, ['つまらん', 'あかなん', 'だちかん']);
});

test('変換: 変わっていない区切り・形の崩れた区切りを整え、隣り合う text はまとめる', () => {
  const r = normalizeConvert({
    segments: [
      { text: '今日は' },
      { standard: 'とても', iyoben: 'とても' },
      { standard: '', iyoben: '' },
      null,
      { text: '暑い' },
    ],
  }, '今日はとても暑い');
  assert.deepStrictEqual(r.segments, [{ text: '今日はとても暑い' }]);
  assert.strictEqual(r.matchesInput, true);
});

test('変換: segments が無い・空なら例外にする', () => {
  assert.throws(() => normalizeConvert({}, 'a'));
  assert.throws(() => normalizeConvert({ segments: [] }, 'a'));
  assert.throws(() => normalizeConvert(null, 'a'));
});
