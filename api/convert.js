// Vercelサーバーレス関数：標準語 → 伊予弁 変換
// 認証：Supabaseトークン or ACCESS_CODE

const { verifyAuth } = require('./_auth');   // 認証ユーティリティを読み込む
const { logUsage }   = require('./_log');    // 利用ログ記録ユーティリティを読み込む
const { TARGET_REGION, normalizeLevel, naturalnessRule, levelRule, purityRule, jsonOnlyRule } = require('./_dialect'); // 対象地域と共通ルールを読み込む
const { normalizeConvert } = require('./_normalize'); // モデル出力を応答の形へ整える

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
  const level = normalizeLevel(req.body.level);                  // 方言の濃さ（未知の値は normal）

  if (!text || !text.trim()) {                                   // 未入力チェック
    return res.status(400).json({ error: '標準語の文章を入力してください' }); // 400を返す
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;                  // サーバー側のAPIキーを取得する
  if (!apiKey) {                                                 // キー未設定の場合
    return res.status(500).json({ error: 'サーバー設定エラー：ANTHROPIC_API_KEY が設定されていません' }); // 500を返す
  }

  // ── プロンプト構築 ─────────────────────────────────────────
  // 標準語→対象方言への変換指示文
  // 共通ルール（自然さの優先・方言の濃さ・純度管理・出力形式）は _dialect.js に集約している
  // segments は利用者が箇所ごとに伊予弁／標準語を選び直すための区切り（index.html が組み立て直す）
  const R = TARGET_REGION;
  const prompt = `あなたは${R.prefecture}の${R.dialect}に精通した方言翻訳アシスタントです。
以下の標準語の文章を${R.dialect}に変換してください。

${naturalnessRule()}

${levelRule(level)}

${purityRule()}

${jsonOnlyRule()}

標準語の文章：「${text.trim()}」

{
  "segments": [
    { "text": "変換しなかった標準語の部分（原文のまま）" },
    { "standard": "変換元の標準語の部分", "iyoben": "対応する${R.dialect}の表現", "alternatives": ["同じ意味の別の${R.dialect}の表現"] }
  ]
}

segments の作り方：
- 原文を先頭から順に区切り、変換しなかった部分は { "text": ... }、変換した部分は { "standard": ..., "iyoben": ... } にしてください。
- すべての区切りの text と standard を順につなげると、原文と1文字も違わず一致するようにしてください（句読点・空白も含む）。
- 変換箇所は語句や文末表現の単位で細かく区切り、1つの区切りに複数の変換をまとめないでください。
- alternatives には、iyoben と同じ意味で今の${R.prefecture}の話者が実際に使う別の表現を、確信があるものだけ最大3つ入れてください。
  候補を増やすために作った形・他地域特有の形は入れず、確信のあるものが無ければ空配列にしてください。
- 無理に変換箇所を増やそうとせず、自然に変わる箇所だけを対象にしてください。`;

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
        max_tokens: 4096,                     // 最大トークン数（segments は区切りごとに出るので長くなる）
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
      result = normalizeConvert(JSON.parse(cleaned), text.trim()); // JSONとしてパースし、応答の形へ整える
    } catch {
      return res.status(500).json({ error: 'AIの応答を解析できませんでした。もう一度お試しください。' });
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
