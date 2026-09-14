// Vercelサーバーレス関数：方言クイズ出題（generate）と採点（grade）
// 認証：Supabaseトークン or ACCESS_CODE

const { verifyAuth } = require('./_auth');
const { logUsage }   = require('./_log');
const { TARGET_REGION, purityRule, jsonOnlyRule } = require('./_dialect'); // 対象地域と共通ルールを読み込む
const { CHOICE_KINDS, normalizeChoiceQuestion } = require('./_normalize');  // 2択の出題を応答の形へ整える

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 認証 ──────────────────────────────────────────────────
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'アクセスコードが正しくないか、ログインが必要です' });
  }

  const { action, region, usedWords, word, question, userAnswer, kind } = req.body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' });
  }

  // ── アクション分岐 ─────────────────────────────────────────
  const R = TARGET_REGION;   // 対象地域（将来の都道府県切替は _dialect.js 側で行う）
  let prompt;

  // 出題済みの単語・例文は再出題しないように除外指示を組み立てる
  const avoidStr  = Array.isArray(usedWords) && usedWords.length > 0
    ? `\n以下の単語・表現はすでに出題済みなので絶対に使わないでください：${usedWords.join('、')}`
    : '';

  if (action === 'generate') {
    // 対象方言のみに限定した出題プロンプト（共通ルールは _dialect.js に集約）
    prompt = `あなたは${R.prefecture}の${R.dialect}の専門家です。
${R.dialect}から1つ単語または短い例文を選び、新人アナウンサー向けのクイズを1問作成してください。${avoidStr}

${purityRule()}

出題する表現は${R.prefecture}で実際に使われている${R.dialect}だけに限定してください。

選ぶ方言の条件：
- アナウンサーが取材や放送で遭遇しうるリアルな${R.dialect}の表現
- 標準語話者が意味を推測しにくいもの（やや難しめ）

${jsonOnlyRule()}

{
  "word": "出題する${R.dialect}の単語または短い例文（${R.dialect}のまま・標準語訳なし）",
  "region": "この${R.dialect}が主に使われる${R.prefecture}内の地域名",
  "question": "「（その${R.dialect}）」とはどういう意味でしょうか？"
}`;

  } else if (action === 'generate_choice') {
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

    prompt = `あなたは${R.prefecture}の${R.dialect}の専門家です。
新人アナウンサー向けに、${R.dialect}の例文を使った2択クイズを1問作成してください。${avoidStr}

${purityRule()}

例文の条件：
- ${R.prefecture}で実際に使われている${R.dialect}を含む、自然な会話の1文（単語だけにしない）
- アナウンサーが取材や放送で遭遇しうる場面の言い回し
- 標準語話者が${kind === 'meaning' ? '意味' : '使う場面'}を取り違えやすいもの（やや難しめ）

選択肢の条件：
- correct と wrong のどちらが正解か、文の長さや詳しさで見分けられないようにする
- wrong も${R.prefecture}の話者が聞けば明確に誤りと分かるものにする（どちらとも取れる選択肢にしない）

${jsonOnlyRule()}

{
  "sentence": "出題する${R.dialect}の例文（${R.dialect}のまま・標準語訳なし）",
  "region": "この言い回しが主に使われる${R.prefecture}内の地域名",
  "question": "${target.question}",
  "correct": "${target.correct}",
  "wrong": "${target.wrong}",
  "explanation": "正解の理由と、例文中の${R.dialect}の意味・ニュアンス・使われる場面（2〜4文）",
  "announcerTips": "アナウンサーとしての注意点（放送での扱い・発音・取材時の対応など、2〜3文）"
}`;

  } else if (action === 'grade') {
    if (!word || !userAnswer) {
      return res.status(400).json({ error: '採点に必要なパラメータが不足しています（word / userAnswer）' });
    }

    // 対象方言の専門家として採点・解説させる
    prompt = `あなたは${R.prefecture}の${R.dialect}の専門家です。以下のクイズへの回答を採点し、詳しく解説してください。

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
