// 管理者専用 API：伊予弁の辞書（dialect_entries）と放送の用例（broadcast_examples）の一覧・登録・削除
// 認証: _auth.js の verifyAdmin（ログイン必須、サーバー側で profiles.is_admin）を通ったあとだけ service_role で読み書きする
// 書き込む前に _dictionary.js の validateEntry / validateExample で検証する（出典 2 つ以上などの決まりを画面任せにしない）
//
// GET                                  → { entries: [...（下書き含む、用例つき）] }
// POST   { type: 'entry', entry, status } → 語の追加・更新（status: 'draft' | 'published'）
// POST   { type: 'example', example }    → 放送の用例の追加
// DELETE ?exampleId=123                  → 放送の用例の削除

const { verifyAdmin } = require('./_auth');
const { validateEntry, rowToEntry, entryToRow, clearCache } = require('./_dictionary');

const STATUSES = ['draft', 'published'];

// 放送の用例 1 件を検証し、問題を日本語の文で返す（空なら問題なし）
function validateExample(x) {
  const errors = [];
  if (!x || typeof x !== 'object') return ['用例のデータがありません'];
  if (!(typeof x.entryId === 'string' && /^[a-z0-9-]+$/.test(x.entryId))) errors.push('どの語の用例かを指定してください');
  if (!(typeof x.program === 'string' && x.program.trim())) errors.push('番組名を入力してください');
  if (!(typeof x.airedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.airedOn) && !Number.isNaN(Date.parse(x.airedOn)))) errors.push('放送日を YYYY-MM-DD で入力してください');
  if (!(typeof x.transcript === 'string' && x.transcript.trim())) errors.push('発言（文字起こし）を入力してください');
  if (x.clipUrl && !/^https?:\/\/\S+$/.test(x.clipUrl)) errors.push('切り抜きは http:// か https:// で始まる URL で入力してください');
  if (x.clipStartSec !== undefined && x.clipStartSec !== null && x.clipStartSec !== '' &&
      !(Number.isInteger(Number(x.clipStartSec)) && Number(x.clipStartSec) >= 0)) errors.push('切り抜きの開始秒は 0 以上の整数で入力してください');
  return errors;
}

function exampleToRow(x, userId) {
  const sec = x.clipStartSec === undefined || x.clipStartSec === null || x.clipStartSec === '' ? null : Number(x.clipStartSec);
  return {
    entry_id: x.entryId, program: x.program.trim(), aired_on: x.airedOn, transcript: x.transcript.trim(),
    standard: (x.standard || '').trim(), clip_url: (x.clipUrl || '').trim() || null, clip_start_sec: sec,
    created_by: userId || null,
  };
}

// Supabase REST の失敗を、画面に出せる文にする（制約違反などの原因を隠さない）
async function restError(r, fallback) {
  const body = await r.json().catch(() => ({}));
  return body.message ? `${fallback}：${body.message}` : `${fallback}（${r.status}）`;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await verifyAdmin(req);
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const base = `${process.env.SUPABASE_URL}/rest/v1`;
  const svc = {
    'apikey':        admin.serviceKey,
    'Authorization': `Bearer ${admin.serviceKey}`,
    'Content-Type':  'application/json',
  };

  try {
    // ── 一覧（下書きも含む） ───────────────────────────────
    if (req.method === 'GET') {
      const r = await fetch(
        `${base}/dialect_entries?select=*,broadcast_examples(id,program,aired_on,transcript,standard,clip_url,clip_start_sec)&order=word`,
        { headers: svc }
      );
      if (!r.ok) return res.status(500).json({ error: await restError(r, '辞書の読み込みに失敗しました') });
      const rows = await r.json();
      return res.status(200).json({
        entries: rows.map((row) => ({
          ...rowToEntry(row),
          status:    row.status,
          updatedAt: row.updated_at,
          broadcastExamples: (row.broadcast_examples || [])
            .map((x) => ({ id: x.id, program: x.program, airedOn: x.aired_on, transcript: x.transcript,
              standard: x.standard || '', clipUrl: x.clip_url || '', clipStartSec: x.clip_start_sec }))
            .sort((a, b) => String(b.airedOn).localeCompare(String(a.airedOn))),
        })),
      });
    }

    // ── 放送の用例の削除 ───────────────────────────────────
    if (req.method === 'DELETE') {
      const id = Number(req.query?.exampleId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '削除する用例を指定してください' });
      const r = await fetch(`${base}/broadcast_examples?id=eq.${id}`, { method: 'DELETE', headers: svc });
      if (!r.ok) return res.status(500).json({ error: await restError(r, '用例の削除に失敗しました') });
      clearCache();
      return res.status(200).json({ ok: true });
    }

    // ── 追加・更新 ─────────────────────────────────────────
    const { type } = req.body || {};

    if (type === 'entry') {
      const { entry, status } = req.body;
      if (!STATUSES.includes(status)) return res.status(400).json({ error: '公開状態の値が不正です' });
      const errors = validateEntry(entry);
      if (errors.length) return res.status(400).json({ error: '入力を確認してください', details: errors });

      const r = await fetch(`${base}/dialect_entries?on_conflict=id`, {
        method:  'POST',
        headers: { ...svc, 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body:    JSON.stringify(entryToRow(entry, status, admin.userId)),
      });
      if (!r.ok) return res.status(400).json({ error: await restError(r, '語の保存に失敗しました') });
      clearCache();   // この関数インスタンスの持ち回りを捨てる（他のインスタンスは最大 5 分で入れ替わる）
      const [row] = await r.json();
      return res.status(200).json({ entry: { ...rowToEntry(row), status: row.status } });
    }

    if (type === 'example') {
      const { example } = req.body;
      const errors = validateExample(example);
      if (errors.length) return res.status(400).json({ error: '入力を確認してください', details: errors });

      const r = await fetch(`${base}/broadcast_examples`, {
        method:  'POST',
        headers: { ...svc, 'Prefer': 'return=representation' },
        body:    JSON.stringify(exampleToRow(example, admin.userId)),
      });
      if (!r.ok) return res.status(400).json({ error: await restError(r, '用例の保存に失敗しました') });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `不明な操作: ${type}` });
  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー：' + err.message });
  }
};

module.exports.validateExample = validateExample;
