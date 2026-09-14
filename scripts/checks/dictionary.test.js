// 伊予弁の辞書（api/_dictionary.js）の検証・形の変換・読み出しの切り替え、管理 API の用例の検証、初期データの SQL を固定する。
// これが無いと、出典 1 つの語が管理画面から公開されても、Supabase が落ちてクイズが空になっても、
// 初期データの SQL が引用符で壊れても、画面は何事もなく動き続けて誰も気づかない。

const test = require('node:test');
const assert = require('node:assert');
const dict = require('../../api/_dictionary');
const { VOCAB } = require('../../api/_vocab');
const { validateExample } = require('../../api/dictionary');
const { buildSeedSql } = require('../dictionary-seed-sql');

const GOOD = {
  id: 'yomoda', word: 'よもだ', meaning: 'いい加減', region: '', usage: 'unknown', note: '「ヨモダ」とも',
  examples: [{ dialect: 'ヨモダを言うな', standard: '無責任なことを言うな', source: 'https://a.example/1' }],
  sources: ['https://a.example/1', 'https://b.example/2'],
};

test('検証: 正しい語は通る', () => {
  assert.deepStrictEqual(dict.validateEntry(GOOD), []);
});

test('検証: 出典が 1 つ・URL でない・重複なら通さない', () => {
  assert.ok(dict.validateEntry({ ...GOOD, sources: ['https://a.example/1'], examples: [] }).length);
  assert.ok(dict.validateEntry({ ...GOOD, sources: ['https://a.example/1', 'Wikipedia'], examples: [] }).length);
  assert.ok(dict.validateEntry({ ...GOOD, sources: ['https://a.example/1', 'https://a.example/1'], examples: [] }).length);
});

test('検証: 例文の出典が出典一覧に無ければ通さない', () => {
  const e = { ...GOOD, examples: [{ dialect: 'x', standard: 'y', source: 'https://other.example/' }] };
  assert.ok(dict.validateEntry(e).some((m) => m.includes('例文 1')));
});

test('検証: id・語・意味・使われ方が不正なら通さない', () => {
  for (const patch of [{ id: 'Yomoda' }, { id: '' }, { word: ' ' }, { meaning: '' }, { usage: 'often' }, { region: null }]) {
    assert.ok(dict.validateEntry({ ...GOOD, ...patch }).length, JSON.stringify(patch));
  }
  assert.ok(dict.validateEntry(null).length);
});

test('形の変換: Supabase の行を一覧と同じ形に直し、書き込み用の行に戻せる', () => {
  const row = { ...GOOD, region: null, note: null, examples: null, status: 'published', updated_at: 'x' };
  const e = dict.rowToEntry(row);
  assert.deepStrictEqual(Object.keys(e).sort(), Object.keys(GOOD).sort());
  assert.strictEqual(e.region, '');
  assert.deepStrictEqual(e.examples, []);
  const back = dict.entryToRow({ ...GOOD, word: ' よもだ ' }, 'draft', 'user-1');
  assert.strictEqual(back.word, 'よもだ');
  assert.strictEqual(back.status, 'draft');
  assert.strictEqual(back.updated_by, 'user-1');
});

const ENV = { SUPABASE_URL: 'https://sb.example', SUPABASE_ANON_KEY: 'anon' };
const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });

test('読み出し: 公開済みの語を Supabase から読み、検証を通らない行は除く', async () => {
  dict.clearCache();
  let url = '';
  const r = await dict.loadPublishedEntries({
    env: ENV, now: () => 0,
    fetchImpl: async (u) => { url = u; return okResponse([GOOD, { ...GOOD, id: 'bad', word: 'x', sources: ['https://only.example/'] }]); },
  });
  assert.strictEqual(r.source, 'supabase');
  assert.deepStrictEqual(r.entries.map((e) => e.id), ['yomoda']);
  assert.ok(url.includes('status=eq.published'), '公開済みで絞っていない');
});

test('読み出し: 5 分以内は Supabase に問い合わせ直さない', async () => {
  dict.clearCache();
  let calls = 0;
  const fetchImpl = async () => { calls++; return okResponse([GOOD]); };
  await dict.loadPublishedEntries({ env: ENV, now: () => 0, fetchImpl });
  await dict.loadPublishedEntries({ env: ENV, now: () => 4 * 60 * 1000, fetchImpl });
  assert.strictEqual(calls, 1);
  await dict.loadPublishedEntries({ env: ENV, now: () => 6 * 60 * 1000, fetchImpl });
  assert.strictEqual(calls, 2);
});

test('読み出し: 失敗・0 件・未設定なら一覧（予備）に切り替える', async () => {
  const cases = [
    { env: ENV, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) },
    { env: ENV, fetchImpl: async () => { throw new Error('network'); } },
    { env: ENV, fetchImpl: async () => okResponse([]) },
    { env: {}, fetchImpl: async () => { throw new Error('呼ばれてはいけない'); } },
  ];
  for (const c of cases) {
    dict.clearCache();
    const r = await dict.loadPublishedEntries({ ...c, now: () => 0 });
    assert.strictEqual(r.source, 'fallback');
    assert.strictEqual(r.entries, VOCAB);
  }
});

test('放送の用例: 画面に返す形に直し、失敗・未設定なら空', async () => {
  const rows = [{ program: 'news', aired_on: '2026-09-01', transcript: 'よもだ言うな', standard: '', clip_url: 'javascript:alert(1)', clip_start_sec: 12 }];
  const got = await dict.loadBroadcastExamples('yomoda', { env: ENV, fetchImpl: async () => okResponse(rows) });
  assert.deepStrictEqual(Object.keys(got[0]).sort(), [...dict.BROADCAST_EXAMPLE_KEYS].sort());
  assert.strictEqual(got[0].airedOn, '2026-09-01');
  assert.strictEqual(got[0].clipUrl, '', 'http(s) 以外の URL を画面に返している');
  assert.deepStrictEqual(await dict.loadBroadcastExamples('yomoda', { env: ENV, fetchImpl: async () => { throw new Error('x'); } }), []);
  assert.deepStrictEqual(await dict.loadBroadcastExamples('yomoda', { env: {}, fetchImpl: async () => okResponse(rows) }), []);
});

test('語の照合: カタカナ・かぎかっこ・補足の別形でも一致する', () => {
  const entries = [GOOD, { ...GOOD, id: 'madou', word: 'まどう', note: '「まぞう」とも' }];
  assert.strictEqual(dict.findByWord(entries, 'よもだ').id, 'yomoda');
  assert.strictEqual(dict.findByWord(entries, '「ヨモダ」').id, 'yomoda');
  assert.strictEqual(dict.findByWord(entries, 'マゾウ').id, 'madou');
  assert.strictEqual(dict.findByWord(entries, 'よも'), null);
  assert.strictEqual(dict.findByWord(entries, ''), null);
});

test('管理 API の用例の検証: 必須項目・日付・URL・開始秒', () => {
  const ok = { entryId: 'yomoda', program: '夕方ニュース', airedOn: '2026-09-01', transcript: 'よもだ言うな' };
  assert.deepStrictEqual(validateExample(ok), []);
  assert.deepStrictEqual(validateExample({ ...ok, clipUrl: 'https://v.example/1', clipStartSec: '30' }), []);
  for (const patch of [{ entryId: '' }, { program: '' }, { airedOn: '2026/09/01' }, { transcript: ' ' }, { clipUrl: 'ftp://x' }, { clipStartSec: '-1' }, { clipStartSec: '1.5' }]) {
    assert.ok(validateExample({ ...ok, ...patch }).length, JSON.stringify(patch));
  }
});

test('初期データの SQL: 一覧の全語を入れ、引用符を壊さず、既存の語を上書きしない', () => {
  const sql = buildSeedSql();
  assert.strictEqual((sql.match(/^insert into public\.dialect_entries/gm) || []).length, VOCAB.length);
  assert.strictEqual((sql.match(/on conflict \(id\) do nothing;/g) || []).length, VOCAB.length);
  const quoted = buildSeedSql([{ ...GOOD, meaning: "it's" }]);
  assert.ok(quoted.includes("'it''s'"));
  assert.throws(() => buildSeedSql([{ ...GOOD, sources: ['https://a.example/1'], examples: [] }]));
});
