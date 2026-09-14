// モデルの出力（JSON 例どおりとは限らない）を、フロントへ返す応答の形へ整える
// キーの一覧は scripts/checks/response-contract.test.js がプロンプトの JSON 例・index.html と突き合わせる

// ── 2択クイズ ─────────────────────────────────────────────
const CHOICE_KINDS         = ['meaning', 'scene'];                                  // 意味を当てる / 使う場面を当てる
const CHOICE_MODEL_KEYS    = ['sentence', 'region', 'question', 'correct', 'wrong', 'explanation', 'announcerTips'];
const CHOICE_RESPONSE_KEYS = ['kind', 'sentence', 'region', 'question', 'choices', 'answerIndex', 'explanation', 'announcerTips'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// correct / wrong を 2 つの選択肢に並べる。並べ替えをモデルに任せると正解の位置が偏るので、ここで乱数で決める
function normalizeChoiceQuestion(raw, kind, random = Math.random) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const q = {};
  for (const key of CHOICE_MODEL_KEYS) q[key] = str(src[key]);

  const missing = ['sentence', 'question', 'correct', 'wrong'].filter((k) => !q[k]);
  if (missing.length) throw new Error(`2択の出題に必要な項目がありません: ${missing.join(', ')}`);
  if (q.correct === q.wrong) throw new Error('2択の選択肢が同じ文になっています');

  const answerIndex = random() < 0.5 ? 0 : 1;
  return {
    kind,
    sentence:      q.sentence,
    region:        q.region,
    question:      q.question,
    choices:       answerIndex === 0 ? [q.correct, q.wrong] : [q.wrong, q.correct],
    answerIndex,
    explanation:   q.explanation,
    announcerTips: q.announcerTips,
  };
}

// ── 変換 ──────────────────────────────────────────────────
// 区切りは 2 種類: { text }（変わらない部分） / { standard, iyoben, alternatives }（変わった部分）
const SEGMENT_MODEL_KEYS    = ['text', 'standard', 'iyoben', 'alternatives'];
// 変換後の本文は返さない。利用者の選択で変わるので、index.html が segments から組み立てる
const CONVERT_RESPONSE_KEYS = ['segments', 'matchesInput'];
const MAX_ALTERNATIVES      = 3;

// 空白の違いだけなら一致とみなす（モデルが全角・半角スペースを足し引きすることがある）
const squash = (s) => String(s).replace(/\s+/g, '');

function normalizeSegment(s) {
  if (!s || typeof s !== 'object') return null;
  const standard = typeof s.standard === 'string' ? s.standard : '';
  const iyoben   = typeof s.iyoben === 'string' ? s.iyoben : '';

  if (iyoben.trim() && standard && iyoben !== standard) {
    const seen = new Set([iyoben]);
    const alternatives = (Array.isArray(s.alternatives) ? s.alternatives : [])
      .filter((a) => typeof a === 'string' && a.trim() && !seen.has(a) && seen.add(a))
      .slice(0, MAX_ALTERNATIVES);
    return { standard, iyoben, alternatives };
  }
  // 変わっていない・伊予弁側が空の区切りは、標準語のままの部分として扱う
  const text = typeof s.text === 'string' ? s.text : standard;
  return text ? { text } : null;
}

function normalizeConvert(raw, input) {
  if (!raw || !Array.isArray(raw.segments)) throw new Error('変換結果に segments がありません');

  const segments = [];
  for (const seg of raw.segments.map(normalizeSegment)) {
    if (!seg) continue;
    const last = segments[segments.length - 1];
    if (seg.text !== undefined && last && last.text !== undefined) last.text += seg.text; // 隣り合う text はまとめる
    else segments.push(seg);
  }
  if (!segments.length) throw new Error('変換結果が空です');

  const standard = segments.map((s) => (s.text !== undefined ? s.text : s.standard)).join('');
  return { segments, matchesInput: squash(standard) === squash(input) };
}

module.exports = {
  CHOICE_KINDS, CHOICE_MODEL_KEYS, CHOICE_RESPONSE_KEYS, SEGMENT_MODEL_KEYS, CONVERT_RESPONSE_KEYS,
  normalizeChoiceQuestion, normalizeConvert,
};
