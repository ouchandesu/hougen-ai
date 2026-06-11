// Vercelサーバーレス関数：方言クイズの出題生成（generate）と採点（grade）を処理する
// 認証：Supabaseセッショントークン（Authorization: Bearer）または ACCESS_CODE のどちらかを受け付ける

const { verifyAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  // POST 以外のリクエストメソッドは受け付けない
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 認証：Supabaseトークン or ACCESS_CODE ───────────────
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'アクセスコードが正しくないか、ログインが必要です' });
  }

  // リクエストボディからパラメータを取り出す（accessCode は _auth.js が消費済み）
  const { action, region, usedWords, word, question, userAnswer } = req.body;

  // ── APIキーの取得 ────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' });
  }

  // ── アクション分岐 ────────────────────────────────────
  let prompt;

  if (action === 'generate') {
    // ── 出題生成モード ─────────────────────────────────
    const regionStr = region || '日本全国';
    const avoidStr  = Array.isArray(usedWords) && usedWords.length > 0
      ? `\n以下の単語・表現はすでに出題済みなので絶対に使わないでください：${usedWords.join('、')}`
      : '';

    prompt = `あなたは日本の方言の専門家です。${regionStr}の方言から1つ単語または短い例文を選び、新人アナウンサー向けのクイズを1問作成してください。${avoidStr}

選ぶ方言の条件：
- アナウンサーが取材や放送で遭遇しうるリアルな表現
- 標準語話者が意味を推測しにくいもの（やや難しめ）

以下のJSON形式のみで回答してください。前後の説明文・コードブロックは不要です。

{
  "word": "出題する方言の単語または短い例文（方言のまま・標準語訳なし）",
  "region": "この方言が主に使われる地域名",
  "question": "「（その方言）」とはどういう意味でしょうか？"
}`;

  } else if (action === 'grade') {
    // ── 採点・解説モード ───────────────────────────────
    if (!word || !userAnswer) {
      return res.status(400).json({ error: '採点に必要なパラメータが不足しています（word / userAnswer）' });
    }

    prompt = `あなたは日本の方言の専門家です。以下のクイズへの回答を採点し、詳しく解説してください。

方言：「${word}」
問い：${question || 'この方言の意味は？'}
ユーザーの回答：「${userAnswer}」

採点基準：
- correct（正解）  ：意味の核心を正確に捉えている
- close（惜しい）  ：方向性は合っているが説明が不完全・部分的
- incorrect（不正解）：意味が大きく異なる、または的外れ・空欄に近い

以下のJSON形式のみで回答してください。前後の説明文・コードブロックは不要です。

{
  "result": "correct または close または incorrect のいずれか1語",
  "correctMeaning": "正しい意味（標準語で簡潔に1〜2文）",
  "explanation": "使われる場面・ニュアンス・語源・背景など（2〜4文）",
  "announcerTips": "アナウンサーとしての注意点（放送での扱い・発音・取材時の対応など、2〜3文）"
}`;

  } else {
    return res.status(400).json({ error: `不明なアクション: ${action}` });
  }

  // ── Anthropic API 呼び出し ─────────────────────────
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
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

    // ── JSONパース（コードブロック除去＋正規表現フォールバック）──
    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      cleaned = match ? match[0] : cleaned;
    }

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'AIの応答をJSONとして解析できませんでした。もう一度お試しください。' });
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};
