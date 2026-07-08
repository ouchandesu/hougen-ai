// Vercelサーバーレス関数：標準語 → 伊予弁 変換
// 認証：Supabaseトークン or ACCESS_CODE

const { verifyAuth } = require('./_auth');   // 認証ユーティリティを読み込む
const { logUsage }   = require('./_log');    // 利用ログ記録ユーティリティを読み込む

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {                                    // POST以外は受け付けない
    return res.status(405).json({ error: 'Method not allowed' }); // 405を返す
  }

  // ── 認証 ──────────────────────────────────────────────────
  const auth = await verifyAuth(req);                            // トークン or アクセスコードを検証する
  if (!auth.ok) {                                                 // 認証NGの場合
    return res.status(401).json({ error: 'アクセスコードが正しくないか、ログインが必要です' }); // 401を返す
  }

  const { text } = req.body;                                     // 変換したい標準語の文章を取り出す

  if (!text || !text.trim()) {                                   // 未入力チェック
    return res.status(400).json({ error: '標準語の文章を入力してください' }); // 400を返す
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;                  // サーバー側のAPIキーを取得する
  if (!apiKey) {                                                 // キー未設定の場合
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' }); // 500を返す
  }

  // ── プロンプト構築 ─────────────────────────────────────────
  // 標準語→伊予弁変換の指示文（伊予弁のみ・他地域の方言は使わない）
  const prompt = `以下の標準語の文章を伊予弁に変換してください。
変換した部分が分かるように、
元の標準語と対応する伊予弁を
JSON形式で返してください。
愛媛県の伊予弁のみを使用し、
他の地域の方言は使わないでください。

標準語の文章：「${text.trim()}」

以下のJSON形式のみで回答してください。前後の説明文・コードブロックは不要です。

{
  "converted": "文章全体を伊予弁に変換したもの",
  "mappings": [
    { "standard": "変換元の標準語の部分", "iyoben": "対応する伊予弁の表現" }
  ]
}

mappings には、標準語から伊予弁に変化した箇所のみを列挙してください。変化しなかった部分は含めないでください。`;

  // ── Anthropic API 呼び出し ─────────────────────────────────
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', { // Claude APIへリクエストする
      method: 'POST',
      headers: {
        'x-api-key':        apiKey,           // サーバー側APIキー
        'anthropic-version': '2023-06-01',    // APIバージョン
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',      // 使用モデル（他エンドポイントと統一）
        max_tokens: 2048,                     // 最大トークン数
        messages:   [{ role: 'user', content: prompt }], // プロンプトを送信する
      }),
    });

    if (!anthropicRes.ok) {                                        // API側エラー時
      const errData = await anthropicRes.json().catch(() => ({}));  // エラーJSONを試行取得する
      return res.status(anthropicRes.status).json({
        error: errData.error?.message || `Anthropic APIエラー: ${anthropicRes.status}`,
      });
    }

    const data    = await anthropicRes.json();                    // レスポンスJSONを取得する
    const rawText = data.content?.[0]?.text || '';                // 生成テキストを取り出す

    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim(); // コードブロック記号を除去する
    if (!cleaned.startsWith('{')) {                               // 先頭が { でない場合
      const match = cleaned.match(/\{[\s\S]*\}/);                 // JSON部分を抽出する
      cleaned = match ? match[0] : cleaned;
    }

    let result;
    try {
      result = JSON.parse(cleaned);                               // JSONとしてパースする
    } catch {
      return res.status(500).json({ error: 'AIの応答をJSONとして解析できませんでした。もう一度お試しください。' });
    }

    // ── 利用ログを記録してからレスポンスを返す ──────────────
    await logUsage({
      userId:     auth.userId,      // 認証ユーザーID
      authMethod: auth.method,      // 認証方式
      action:     'convert',        // アクション名（lookup / quiz と区別する）
      region:     null,             // 伊予弁固定のため地域は null
    });

    return res.status(200).json(result);                          // 変換結果を返す

  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message }); // 予期せぬ例外を500で返す
  }
};
