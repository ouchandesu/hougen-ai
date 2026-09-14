// 管理者専用 API：ダッシュボードデータを返す
// セキュリティ: サーバー側で JWT 検証 → profiles.is_admin チェックの 2段階を経て初めてデータを返す（_auth.js の verifyAdmin）
// フロント側の判定だけに頼らない設計

const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Step 1〜2: ログインと is_admin の確認 ─────────────────────
  const admin = await verifyAdmin(req);
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const svcHeaders = {
    'apikey':        admin.serviceKey,
    'Authorization': `Bearer ${admin.serviceKey}`,
    'Content-Type':  'application/json',
  };

  // ── Step 3: 集計データ取得（SQL 関数 get_admin_stats を呼ぶ） ──
  try {
    const statsRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_admin_stats`, {
      method:  'POST',
      headers: svcHeaders,
      body:    '{}', // 引数なし
    });
    if (!statsRes.ok) {
      const err = await statsRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.message || '集計クエリに失敗しました' });
    }
    const stats = await statsRes.json();
    return res.status(200).json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};
