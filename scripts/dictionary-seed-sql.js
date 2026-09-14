// リポジトリ内の一覧（api/_vocab.js）から、Supabase の辞書 dialect_entries へ入れる初期データの SQL を出力する
// 使い方: npm run dict:seed-sql > seed.sql  → Supabase の SQL Editor で実行する（人間が適用する）
// 既にある id は上書きしない（管理画面で直した内容を消さないため）

const { VOCAB } = require('../api/_vocab');
const { validateEntry } = require('../api/_dictionary');

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function entryToInsert(e) {
  const sources = `ARRAY[${e.sources.map(lit).join(', ')}]::text[]`;
  const examples = `${lit(JSON.stringify(e.examples))}::jsonb`;
  return `insert into public.dialect_entries (id, word, meaning, region, usage, note, examples, sources, status)\n` +
    `values (${[lit(e.id), lit(e.word), lit(e.meaning), lit(e.region), lit(e.usage), lit(e.note), examples, sources, lit('published')].join(', ')})\n` +
    `on conflict (id) do nothing;`;
}

function buildSeedSql(vocab = VOCAB) {
  const broken = vocab.filter((e) => validateEntry(e).length > 0).map((e) => e.id);
  if (broken.length) throw new Error(`検証を通らない語があります: ${broken.join(', ')}`);
  return ['-- 伊予弁の辞書の初期データ（scripts/dictionary-seed-sql.js が api/_vocab.js から生成）', 'begin;',
    ...vocab.map(entryToInsert), 'commit;', ''].join('\n');
}

if (require.main === module) {
  process.stdout.write(buildSeedSql());
}

module.exports = { buildSeedSql, entryToInsert };
