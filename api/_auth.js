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

module.exports = { verifyAuth };
