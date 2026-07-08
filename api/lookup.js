// Vercelサーバーレス関数：方言調査
// 認証：Supabaseトークン or ACCESS_CODE

const { verifyAuth } = require('./_auth');
const { logUsage }   = require('./_log');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 認証 ──────────────────────────────────────────────────
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'アクセスコードが正しくないか、ログインが必要です' });
  }

  const { dialect, region } = req.body;

  if (!dialect || !dialect.trim()) {
    return res.status(400).json({ error: '方言または単語を入力してください' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' });
  }

  // ── プロンプト構築 ─────────────────────────────────────────
  // 伊予弁に完全特化した指示文（他地域の方言は扱わない）
  const prompt = `入力された言葉について、愛媛県の伊予弁として
回答してください。他の地域の方言は含めないでください。
もし伊予弁ではない言葉が入力された場合は、
伊予弁での類似表現を提案してください。

回答の中で他の地域の方言との比較や
類似表現の紹介をしないでください。
愛媛県の伊予弁としての情報のみを返してください。
使われる地域の欄には愛媛県内の地域名のみを
記載してください。

あなたは愛媛県の伊予弁の専門家です。以下の言葉について、アナウンサーが学習するために必要な情報を教えてください。

言葉：「${dialect.trim()}」

以下のJSON形式で回答してください。JSONのみを返し、余分なテキストは含めないでください。

{
  "region": "使われる主な地域（愛媛県内の地域名など）",
  "reading": "単語・表現のひらがなでの読み方（ふりがな）",
  "meaning": "標準語での意味（わかりやすく説明）",
  "nuance": "使われる場面やニュアンス（感情、丁寧さ、使用シーンなど）",
  "examples": [
    { "dialect": "伊予弁を使った例文", "standard": "標準語訳" },
    { "dialect": "伊予弁を使った別の例文", "standard": "標準語訳" }
  ],
  "announcer_points": {
    "broadcast_use": "放送での使用可否（使える場面・使えない場面・使う際の注意事項を含めて説明）",
    "interview_response": "取材先でこの言葉を聞いた時の対応（意味の確認方法・視聴者への伝え方など）",
    "pronunciation": "発音の注意点（アクセント・イントネーション・標準語との違いなど）"
  }
}

もし入力された言葉が伊予弁ではない場合は、meaning に伊予弁での類似表現の提案を入力してください。`;

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
        max_tokens: 2048,
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
    const result = JSON.parse(cleaned);

    // ── 利用ログを記録してからレスポンスを返す ──────────────
    // logUsage は失敗しても例外を外に出さないため安全に await できる
    await logUsage({
      userId:     auth.userId,
      authMethod: auth.method,
      action:     'lookup',
      region:     region || null,
    });

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};
