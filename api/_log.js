// 利用ログを Supabase の usage_logs テーブルに記録するヘルパー
// SUPABASE_SERVICE_ROLE_KEY で RLS をバイパスしてサーバー側から直接 INSERT する
// 失敗してもメイン機能に影響しないようにエラーは黙殺する

async function logUsage({ userId, authMethod, action, region }) {
  const url        = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // 環境変数が未設定の場合は記録しない（ログなし運用を許容する）
  if (!url || !serviceKey) return;

  try {
    await fetch(`${url}/rest/v1/usage_logs`, {
      method: 'POST',
      headers: {
        // service_role_key は RLS をバイパスするため管理者相当の書き込みが可能
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        // レスポンスボディ不要（最小応答で高速化）
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        user_id:     userId     || null,  // Supabase ログイン時のみ設定
        auth_method: authMethod || 'unknown',
        action,
        region:      region     || null,
      }),
    });
  } catch {
    // ネットワークエラー等は無視してメイン処理を優先する
  }
}

module.exports = { logUsage };
