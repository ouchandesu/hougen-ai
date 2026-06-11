// フロントエンドに渡してよい公開設定値を返す
// SUPABASE_URL と SUPABASE_ANON_KEY は Supabase の設計上公開可能
// これらを直接 HTML に書かずここで返すことで、
// Vercel 環境変数を唯一の設定ソースに保てる

module.exports = function handler(req, res) {
  // GET 以外は拒否する
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl     = process.env.SUPABASE_URL      || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  // どちらかが未設定の場合は Supabase 未設定として空値を返す
  // フロントはこれを受けて「ACCESS_CODE のみモード」にフォールバックする
  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
