// Vercelサーバーレス関数：方言クイズ出題（generate / generate_choice）と採点（grade）
// 認証：Supabaseトークン or ACCESS_CODE
// 出題する語はモデルに選ばせず、資料で裏付けた一覧（_vocab.js）からサーバーが選ぶ

const { verifyAuth } = require('./_auth');
const { logUsage }   = require('./_log');
const { TARGET_REGION, purityRule, jsonOnlyRule } = require('./_dialect'); // 対象地域と共通ルールを読み込む
const { CHOICE_KINDS, normalizeChoiceQuestion } = require('./_normalize');  // 2択の出題を応答の形へ整える
const { publicEntry, findEntry, pickEntry, entryForPrompt } = require('./_vocab'); // 出題に使う語の一覧

// 資料の意味を「正」として扱わせる指示（2択の出題と採点で共通）
function vocabRule(entry, R) {
  return `【出題の語（資料で裏付けた情報。これを正とする）】
${entryForPrompt(entry)}
- この語の意味は上の「意味」だけを正とし、資料に無い別の意味・用法・語源を作らないでください。
- 「今の使われ方」が昔の言葉・年配の人の言葉とされている場合は、そのことを解説で伝えてください。
- 上の情報で足りない点（細かいニュアンスなど）に確信が無ければ、解説で断定せず触れないでください。
- 他の${R.dialect}の表現を足す場合も、意味に確信があるものに限ってください。`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 認証 ──────────────────────────────────────────────────
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'アクセスコードが正しくないか、ログインが必要です' });
  }

  const { action, region, usedIds, vocabId, word, question, userAnswer, kind } = req.body;

  // ── 記述式の出題：一覧から語を選んで返すだけ（モデルは呼ばない） ──────
  if (action === 'generate') {
    const entry = pickEntry(usedIds);
    await logUsage({
      userId:     auth.userId,
      authMethod: auth.method,
      action:     'quiz_generate',
      region:     region || null,
    });
    return res.status(200).json({
      word:     entry.word,
      region:   entry.region,
      question: `「${entry.word}」とはどういう意味でしょうか？`,
      vocab:    publicEntry(entry),
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' });
  }

  // ── アクション分岐 ─────────────────────────────────────────
  const R = TARGET_REGION;   // 対象地域（将来の都道府県切替は _dialect.js 側で行う）
  let prompt;
  let entry = null;          // 出題・採点の対象の語（一覧の項目）

  if (action === 'generate_choice') {
    if (!CHOICE_KINDS.includes(kind)) {
      return res.status(400).json({ error: `不明な出題の種類: ${kind}` });
    }

    // 種類ごとに「何を選ばせるか」だけが違う。正解と誤答は分けて出させ、並べ替えは _normalize.js で行う
    const target = kind === 'meaning'
      ? {
          question: 'この例文の意味として正しいのはどちら？',
          correct:  '例文の自然な標準語訳（1文）',
          wrong:    `標準語話者が${R.dialect}を聞き違えたときにありがちな、もっともらしいが誤った標準語訳（correct と同じくらいの長さ・言い回し）`,
        }
      : {
          question: 'この言い回しが自然に使われる場面はどちら？',
          correct:  `${R.prefecture}でこの例文が自然に使われる場面・話し相手の説明（1文）`,
          wrong:    `この例文を使うと不自然、または意味が通じない場面・話し相手の説明（correct と同じくらいの長さ・言い回し）`,
        };

    entry = pickEntry(usedIds);
    const wrongHint = kind === 'meaning'
      ? '誤りの選択肢は、出題の語の意味を取り違えた訳にする（出題の語を標準語の似た言葉と勘違いした場合など）'
      : '誤りの選択肢は、出題の語の意味からすると不自然な場面にする';
    prompt = `あなたは${R.prefecture}の${R.dialect}の専門家です。
新人アナウンサー向けに、下の「出題の語」を使った${R.dialect}の例文で、2択クイズを1問作成してください。

${vocabRule(entry, R)}

${purityRule()}

例文の条件：
- 出題の語を、資料の意味のとおりに必ず含めた、自然な会話の1文（単語だけにしない）。資料の例文があれば参考にしてよい
- 出題の語以外は、無理に${R.dialect}にしない（標準語のままで自然な部分は標準語でよい）
- 昔の言葉・年配の人の言葉とされている語は、年配の人の会話など、その語が自然に出る場面にする
- アナウンサーが取材や放送で遭遇しうる場面の言い回し

選択肢の条件：
- ${wrongHint}
- correct と wrong のどちらが正解か、文の長さや詳しさで見分けられないようにする
- wrong も${R.prefecture}の話者が聞けば明確に誤りと分かるものにする（どちらとも取れる選択肢にしない）

${jsonOnlyRule()}

{
  "sentence": "出題する${R.dialect}の例文（${R.dialect}のまま・標準語訳なし）",
  "region": "この言い回しが主に使われる${R.prefecture}内の地域名",
  "question": "${target.question}",
  "correct": "${target.correct}",
  "wrong": "${target.wrong}",
  "explanation": "正解の理由と、例文中の出題の語の意味・使われる場面（2〜4文。資料に無い意味を足さない）",
  "announcerTips": "アナウンサーとしての注意点（放送での扱い・取材時の対応など、2〜3文）"
}`;

  } else if (action === 'grade') {
    if (!word || !userAnswer) {
      return res.status(400).json({ error: '採点に必要なパラメータが不足しています（word / userAnswer）' });
    }
    entry = findEntry(vocabId);   // 一覧に無い id（古い画面から来た回答など）は、資料の情報なしで採点する

    // 対象方言の専門家として採点・解説させる。一覧の語なら資料の意味を正として採点する
    prompt = `あなたは${R.prefecture}の${R.dialect}の専門家です。以下のクイズへの回答を採点し、詳しく解説してください。

${entry ? vocabRule(entry, R) : ''}

${purityRule()}

方言：「${word}」
問い：${question || 'この方言の意味は？'}
ユーザーの回答：「${userAnswer}」

採点基準：
- correct（正解）  ：意味の核心を正確に捉えている
- close（惜しい）  ：方向性は合っているが説明が不完全・部分的
- incorrect（不正解）：意味が大きく異なる、または的外れ・空欄に近い

${jsonOnlyRule()}

{
  "result": "correct または close または incorrect のいずれか1語",
  "correctMeaning": "正しい意味（標準語で簡潔に1〜2文）",
  "explanation": "使われる場面・ニュアンス・語源・背景など（2〜4文）",
  "announcerTips": "アナウンサーとしての注意点（放送での扱い・発音・取材時の対応など、2〜3文）"
}`;

  } else {
    return res.status(400).json({ error: `不明なアクション: ${action}` });
  }

  // ── Anthropic API 呼び出し ─────────────────────────────────
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':        apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      return res.status(anthropicRes.status).json({
        error: errData.error?.message || `Anthropic APIエラー: ${anthropicRes.status}`,
      });
    }

    const data    = await anthropicRes.json();
    const rawText = data.content?.[0]?.text || '';

    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      cleaned = match ? match[0] : cleaned;
    }

    let result;
    try {
      result = JSON.parse(cleaned);
      if (action === 'generate_choice') result = normalizeChoiceQuestion(result, kind);
      if (entry) {
        result.vocab = publicEntry(entry);                          // 出題の語と資料の情報は、モデルでなく一覧から返す
        if (entry.region) result.region = entry.region;             // 地域も資料にあればモデルの推測より優先する
        if (action === 'grade') result.correctMeaning = entry.meaning; // 正しい意味は資料の意味で上書きする
      }
    } catch {
      return res.status(500).json({ error: 'AIの応答を解析できませんでした。もう一度お試しください。' });
    }

    // ── 利用ログを記録してからレスポンスを返す ──────────────
    // action 名に 'quiz_' プレフィックスを付けて lookup と区別する
    await logUsage({
      userId:     auth.userId,
      authMethod: auth.method,
      action:     'quiz_' + action,   // 'quiz_generate' / 'quiz_generate_choice' / 'quiz_grade'
      region:     region || null,
    });

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};
