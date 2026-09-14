// 共有認証ヘルパー
// Supabaseセッショントークン（Authorization: Bearer）とACCESS_CODEの両方を検証する
// どちらか一方が有効なら認証成功。どちらも不正なら { ok: false } を返す。

async function verifyAuth(req) {
  const accessCode = req.body?.accessCode;
  const authHeader  = (req.headers?.authorization || req.headers?.Authorization || '');

  // ── 1. ACCESS_CODE認証（企業デモ・共有アクセス用） ──────────
  const validCode = process.env.ACCESS_CODE;
  // ACCESS_CODE 環境変数が設定されており、送信値と一致する場合は認証成功
  if (validCode && accessCode === validCode) {
    return { ok: true, userId: null, method: 'access_code' };
  }

  // ── 2. Supabaseセッショントークン認証 ────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  // 必要な環境変数が揃っており、Bearerトークンが送られている場合のみ試みる
  if (supabaseUrl && supabaseKey && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7); // "Bearer " の7文字を除去
    try {
      // Supabase の /auth/v1/user エンドポイントでトークンを検証する
      // SDKは使わず fetch のみで完結させるため npm 依存不要
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
      });
      if (res.ok) {
        const user = await res.json();
        // user.id が存在すれば正規ユーザーと判断する
        if (user?.id) {
          return { ok: true, userId: user.id, method: 'supabase' };
        }
      }
    } catch {
      // ネットワークエラー等は黙殺してフォールスルーする
    }
  }

  // どちらの認証も通らなかった場合
  return { ok: false };
}

// 管理者の確認（管理画面の API 用。ADR 0001 決定 3）
// アクセスコードは受け付けない。Bearer トークンからユーザーを特定し、profiles.is_admin を service_role でサーバー側から確かめる
// 返り値: { ok: true, userId, serviceKey } / { ok: false, status, error }
async function verifyAdmin(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { ok: false, status: 500, error: 'サーバー設定エラー：Supabase 環境変数が未設定です（SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY）' };
  }

  // ── Step 1: JWT 検証でユーザー特定 ─────────────────────────
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'ログインが必要です（管理画面はアカウントログインのみ）' };
  }
  const token = authHeader.slice(7);

  let userId;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey },
    });
    if (!r.ok) return { ok: false, status: 401, error: '認証トークンが無効です' };
    const u = await r.json();
    if (!u?.id) return { ok: false, status: 401, error: '認証トークンが無効です' };
    userId = u.id;
  } catch {
    return { ok: false, status: 401, error: '認証エラー：Supabase に接続できません' };
  }

  // ── Step 2: is_admin チェック（service_role でRLSをバイパス） ──
  // anon key ではなく service_role key を使うことで RLS に依存せず確実に取得する
  try {
    const pr = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!pr.ok) return { ok: false, status: 500, error: '権限チェックに失敗しました' };
    const rows = await pr.json();
    // profiles 行が存在しない or is_admin が false の場合は 403
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0].is_admin) {
      return { ok: false, status: 403, error: '管理者権限が必要です' };
    }
  } catch {
    return { ok: false, status: 500, error: '権限チェック中にエラーが発生しました' };
  }

  return { ok: true, userId, serviceKey };
}

module.exports = { verifyAuth, verifyAdmin };
