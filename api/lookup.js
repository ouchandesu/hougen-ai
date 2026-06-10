// Vercelサーバーレス関数：Anthropic APIをサーバーサイドで安全に呼び出す
// APIキーはこのファイルに書かず、Vercel環境変数 ANTHROPIC_API_KEY から読む
// アクセスコードは環境変数 ACCESS_CODE と照合して認証する

module.exports = async function handler(req, res) {
  // POST以外のリクエストメソッドは受け付けない
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // リクエストボディから各パラメータを取り出す
  const { dialect, region, accessCode } = req.body;

  // ── アクセスコード認証 ──────────────────────────────
  // 環境変数から正規アクセスコードを取得する
  const validCode = process.env.ACCESS_CODE;
  // ACCESS_CODE が未設定の場合はサーバー設定不備としてエラーを返す
  if (!validCode) {
    return res.status(500).json({ error: 'サーバー設定エラー：ACCESS_CODE が設定されていません' });
  }
  // 送られてきたコードが一致しない場合は 401 を返す
  if (accessCode !== validCode) {
    return res.status(401).json({ error: 'アクセスコードが正しくありません' });
  }

  // ── 入力バリデーション ────────────────────────────
  // 方言が空文字・未入力の場合は 400 を返す
  if (!dialect || !dialect.trim()) {
    return res.status(400).json({ error: '方言または単語を入力してください' });
  }

  // ── APIキーの取得 ────────────────────────────────
  // 環境変数 ANTHROPIC_API_KEY を読む（フロントには一切渡さない）
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' });
  }

  // ── プロンプト構築 ───────────────────────────────
  // 地域が指定されている場合はプロンプトに地域ヒントを追加する
  const regionHint = region
    ? `\nこの単語・表現は「${region}」に関連している可能性があります。その地域の方言として優先的に解釈してください。`
    : '';

  // Claudeに送るプロンプト本文を組み立てる
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

  // ── Anthropic API呼び出し ─────────────────────
  try {
    // fetch はNode.js 18以降でネイティブ利用可能（package.json で明示）
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        // サーバー側でAPIキーをセットするため危険なブラウザ直接アクセスヘッダーは不要
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        // 使用するClaudeモデル
        model: 'claude-sonnet-4-6',
        // レスポンスの最大トークン数
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    // Anthropic API がエラーを返した場合はそのステータスとメッセージを転送する
    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      return res.status(anthropicRes.status).json({
        error: errData.error?.message || `Anthropic APIエラー: ${anthropicRes.status}`,
      });
    }

    // 正常レスポンスをJSONとして取得する
    const data = await anthropicRes.json();
    // レスポンス本文のテキスト部分を取り出す
    const rawText = data.content?.[0]?.text || '';

    // ── JSONパース ──────────────────────────────
    // コードブロック記号（```json...```）を除去する
    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // 波括弧で始まらない場合は正規表現でJSONブロックを抽出する（前後に説明文が混入した場合の対策）
    if (!cleaned.startsWith('{')) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      cleaned = match ? match[0] : cleaned;
    }
    // 抽出したテキストをJSONとしてパースする
    const result = JSON.parse(cleaned);

    // パース済みオブジェクトをフロントエンドに返す
    return res.status(200).json(result);

  } catch (err) {
    // 通信エラー・パースエラーを 500 として返す
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};
