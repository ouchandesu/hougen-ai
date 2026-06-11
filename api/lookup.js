// Vercelサーバーレス関数：Anthropic APIをサーバーサイドで安全に呼び出す
// 認証：Supabaseセッショントークン（Authorization: Bearer）または ACCESS_CODE のどちらかを受け付ける

const { verifyAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  // POST以外のリクエストメソッドは受け付けない
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 認証：Supabaseトークン or ACCESS_CODE ───────────────
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'アクセスコードが正しくないか、ログインが必要です' });
  }

  // リクエストボディから方言・地域を取得する（accessCode は _auth.js が消費済み）
  const { dialect, region } = req.body;

  // ── 入力バリデーション ────────────────────────────────
  if (!dialect || !dialect.trim()) {
    return res.status(400).json({ error: '方言または単語を入力してください' });
  }

  // ── APIキーの取得 ────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' });
  }

  // ── プロンプト構築 ───────────────────────────────────
  const regionHint = region
    ? `\nこの単語・表現は「${region}」に関連している可能性があります。その地域の方言として優先的に解釈してください。`
    : '';

  const prompt = `あなたは日本の方言の専門家です。以下の方言または単語について、アナウンサーが学習するために必要な情報を教えてください。${regionHint}

方言・単語：「${dialect.trim()}」

以下のJSON形式で回答してください。JSONのみを返し、余分なテキストは含めないでください。

{
  "region": "使われる主な地域（都道府県名や地域名）",
  "reading": "単語・表現のひらがなでの読み方（ふりがな）",
  "meaning": "標準語での意味（わかりやすく説明）",
  "nuance": "使われる場面やニュアンス（感情、丁寧さ、使用シーンなど）",
  "examples": [
    {
      "dialect": "方言を使った例文",
      "standard": "標準語訳"
    },
    {
      "dialect": "方言を使った別の例文",
      "standard": "標準語訳"
    }
  ],
  "announcer_points": {
    "broadcast_use": "放送での使用可否（使える場面・使えない場面・使う際の注意事項を含めて説明）",
    "interview_response": "取材先でこの言葉を聞いた時の対応（意味の確認方法・視聴者への伝え方など）",
    "pronunciation": "発音の注意点（アクセント・イントネーション・標準語との違いなど）"
  }
}

もし有名な方言でない、または意味が不明な場合は、region に「不明」、meaning に「この言葉は一般的な方言として確認できませんでした」と入力してください。`;

  // ── Anthropic API呼び出し ─────────────────────────────
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
        max_tokens: 2048,
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

    const result = JSON.parse(cleaned);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};
