// 伊予弁の辞書（Supabase の dialect_entries / broadcast_examples）の読み出し・検証・形の変換
// 読み取りは anon key と RLS（公開済みの語だけ）。書き込みは api/dictionary.js が管理者を確かめてから service_role で行う
// Supabase が使えないときは、リポジトリ内の一覧（_vocab.js）に切り替えてクイズ・調べるを止めない（ADR 0004）

const { USAGE_LABELS, VOCAB, entryForPrompt } = require('./_vocab');

const MIN_SOURCES = 2;                 // 監修者の方針：資料で 2 つ以上の裏付けがある語だけを載せる
const CACHE_MS    = 5 * 60 * 1000;     // 関数インスタンス内で辞書を持ち回る時間
const ENTRY_COLUMNS = 'id,word,meaning,region,usage,note,examples,sources';

// 放送の用例として画面に返す項目。キーは scripts/checks/response-contract.test.js が index.html と突き合わせる
const BROADCAST_EXAMPLE_KEYS = ['program', 'airedOn', 'transcript', 'standard', 'clipUrl', 'clipStartSec'];

const isUrl    = (s) => typeof s === 'string' && /^https?:\/\/\S+$/.test(s);
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

// ── 検証 ──────────────────────────────────────────────────
// 語 1 件を検証し、問題を日本語の文で返す（空なら問題なし）。管理 API・一覧のテストで同じ条件を使う
function validateEntry(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['語のデータがありません'];
  if (!(typeof e.id === 'string' && /^[a-z0-9-]+$/.test(e.id))) errors.push('id は半角の英小文字・数字・ハイフンで入力してください');
  if (!nonEmpty(e.word))    errors.push('語を入力してください');
  if (!nonEmpty(e.meaning)) errors.push('意味を入力してください');
  if (typeof e.region !== 'string') errors.push('地域が文字列ではありません');
  if (typeof e.note !== 'string')   errors.push('補足が文字列ではありません');
  if (!Object.prototype.hasOwnProperty.call(USAGE_LABELS, e.usage)) errors.push('使われ方の値が不正です');

  const sources = Array.isArray(e.sources) ? e.sources : [];
  if (sources.length < MIN_SOURCES) errors.push(`出典の URL を ${MIN_SOURCES} つ以上入力してください（資料で意味を裏付けた語だけを載せます）`);
  if (!sources.every(isUrl)) errors.push('出典は http:// か https:// で始まる URL で入力してください');
  if (new Set(sources).size !== sources.length) errors.push('同じ出典が重複しています');

  const examples = Array.isArray(e.examples) ? e.examples : null;
  if (!examples) {
    errors.push('例文の形が不正です');
  } else {
    examples.forEach((x, i) => {
      if (!(x && nonEmpty(x.dialect) && nonEmpty(x.standard))) errors.push(`例文 ${i + 1}：方言と標準語の両方を入力してください`);
      else if (!sources.includes(x.source)) errors.push(`例文 ${i + 1}：出典は、上の出典一覧にある URL を指定してください（資料に載っている例文だけを載せます）`);
    });
  }
  return errors;
}

// ── 形の変換 ───────────────────────────────────────────────
// Supabase の行 → 一覧（_vocab.js）と同じ形
function rowToEntry(row) {
  return {
    id:       row.id,
    word:     row.word,
    meaning:  row.meaning,
    region:   row.region || '',
    usage:    row.usage,
    note:     row.note || '',
    examples: Array.isArray(row.examples) ? row.examples : [],
    sources:  Array.isArray(row.sources) ? row.sources : [],
  };
}

// 一覧と同じ形 → Supabase の行（書き込み用）
function entryToRow(entry, status, userId) {
  return {
    id: entry.id, word: entry.word.trim(), meaning: entry.meaning.trim(), region: entry.region.trim(),
    usage: entry.usage, note: entry.note.trim(), examples: entry.examples, sources: entry.sources,
    status, updated_by: userId || null,
  };
}

function exampleRowToPublic(row) {
  return {
    program:      row.program,
    airedOn:      row.aired_on,
    transcript:   row.transcript,
    standard:     row.standard || '',
    clipUrl:      isUrl(row.clip_url) ? row.clip_url : '',
    clipStartSec: Number.isInteger(row.clip_start_sec) ? row.clip_start_sec : null,
  };
}

// ── 読み出し ───────────────────────────────────────────────
let cache = null;   // { entries, source, at }

function anonHeaders(env) {
  return { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` };
}

// 公開済みの語を返す。返り値の source は 'supabase' か 'fallback'（一覧に切り替えた）
async function loadPublishedEntries({ fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  if (cache && now() - cache.at < CACHE_MS) return cache;

  const fallback = () => ({ entries: VOCAB, source: 'fallback', at: now() });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return (cache = fallback());

  try {
    const res = await fetchImpl(
      `${env.SUPABASE_URL}/rest/v1/dialect_entries?status=eq.published&select=${ENTRY_COLUMNS}&order=id`,
      { headers: anonHeaders(env) }
    );
    if (!res.ok) throw new Error(`dialect_entries: ${res.status}`);
    const rows = await res.json();
    // 検証を通らない行は出題に使わない（DB の制約をすり抜けた行や、列の変更への備え）
    const entries = (Array.isArray(rows) ? rows : []).map(rowToEntry).filter((e) => validateEntry(e).length === 0);
    if (!entries.length) throw new Error('公開済みの語が 0 件');
    return (cache = { entries, source: 'supabase', at: now() });
  } catch {
    // 切り替えも短く持ち回り、障害中に毎回 Supabase へ問い合わせない
    return (cache = fallback());
  }
}

// 語に付いた放送の用例（放送日の新しい順）。失敗・未設定なら空
async function loadBroadcastExamples(entryId, { fetchImpl = fetch, env = process.env, limit = 5 } = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !entryId) return [];
  try {
    const res = await fetchImpl(
      `${env.SUPABASE_URL}/rest/v1/broadcast_examples?entry_id=eq.${encodeURIComponent(entryId)}` +
      `&select=program,aired_on,transcript,standard,clip_url,clip_start_sec&order=aired_on.desc&limit=${limit}`,
      { headers: anonHeaders(env) }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(exampleRowToPublic) : [];
  } catch {
    return [];
  }
}

function clearCache() {
  cache = null;
}

// ── 語の照合（調べるモード） ─────────────────────────────────
// カタカナ → ひらがな、空白・かぎかっこ・疑問符などを除いて比べる
function normalizeWord(s) {
  return String(s || '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s「」『』？?！!。、・〜~]/g, '');
}

// 入力が語そのもの、または補足にある別形（「〜」とも）と一致すれば、その語を返す
function findByWord(entries, text) {
  const target = normalizeWord(text);
  if (!target) return null;
  return entries.find((e) => {
    const variants = [e.word, ...[...e.note.matchAll(/「([^」]+)」とも/g)].map((m) => m[1])];
    return variants.some((v) => normalizeWord(v) === target);
  }) || null;
}

// ── プロンプト ─────────────────────────────────────────────
// 資料の意味を「正」として扱わせる指示（研修の出題・採点、調べるモードで共通）
function vocabRule(entry, R) {
  return `【辞書の語（資料で裏付けた情報。これを正とする）】
${entryForPrompt(entry)}
- この語の意味は上の「意味」だけを正とし、資料に無い別の意味・用法・語源を作らないでください。
- 「今の使われ方」が昔の言葉・年配の人の言葉とされている場合は、そのことを解説で伝えてください。
- 上の情報で足りない点（細かいニュアンスなど）に確信が無ければ、解説で断定せず触れないでください。
- 他の${R.dialect}の表現を足す場合も、意味に確信があるものに限ってください。
- この語は、資料の表記のまま書いてください（清音・濁音などを変えない）。
- 解説とアナウンサーの注意点は標準語で書いてください（方言の語や例文を引用する部分を除く）。`;
}

module.exports = {
  MIN_SOURCES, BROADCAST_EXAMPLE_KEYS,
  validateEntry, rowToEntry, entryToRow, exampleRowToPublic,
  loadPublishedEntries, loadBroadcastExamples, clearCache,
  normalizeWord, findByWord, vocabRule,
};
