// 管理者専用 API：ダッシュボードデータを返す
// セキュリティ: サーバー側で JWT 検証 → profiles.is_admin チェックの 2段階を経て初めてデータを返す
// フロント側の判定だけに頼らない設計

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 必要な環境変数の存在確認
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'サーバー設定エラー：Supabase 環境変数が未設定です（SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY）' });
  }

  // ── Step 1: JWT 検証でユーザー特定 ─────────────────────────
  // Authorization: Bearer <token> が必須（ACCESS_CODE では管理画面は使えない）
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'ログインが必要です（管理画面はアカウントログインのみ）' });
  }
  const token = authHeader.slice(7);

  let userId;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey':        anonKey,
      },
    });
    if (!r.ok) return res.status(401).json({ error: '認証トークンが無効です' });
    const u = await r.json();
    if (!u?.id) return res.status(401).json({ error: '認証トークンが無効です' });
    userId = u.id;
  } catch {
    return res.status(401).json({ error: '認証エラー：Supabase に接続できません' });
  }

  // ── Step 2: is_admin チェック（service_role でRLSをバイパス） ──
  // anon key ではなく service_role key を使うことで RLS に依存せず確実に取得する
  const svcHeaders = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };

  try {
    const pr = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
      { headers: svcHeaders }
    );
    if (!pr.ok) return res.status(500).json({ error: '権限チェックに失敗しました' });
    const rows = await pr.json();
    // profiles 行が存在しない or is_admin が false の場合は 403
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0].is_admin) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
  } catch {
    return res.status(500).json({ error: '権限チェック中にエラーが発生しました' });
  }

  // ── Step 3: 集計データ取得（SQL 関数 get_admin_stats を呼ぶ） ──
  try {
    const statsRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_admin_stats`, {
      method:  'POST',
      headers: { ...svcHeaders, 'Content-Type': 'application/json' },
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
