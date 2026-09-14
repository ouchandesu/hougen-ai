// 管理者専用の API（service_role key を使うもの）が、Supabase へ問い合わせる前に verifyAdmin を通っていることを見る。
// これが無いと、新しい管理 API で確認を書き忘れても、正しいトークンで試す限り動いてしまい、
// 誰でも辞書を書き換えられる状態が緑のまま出荷される（ADR 0001 決定 3）。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const apiDir = path.join(root, 'api');

// service_role を使う公開 API（_ 始まりの共有ヘルパーは除く）
const adminApis = fs.readdirSync(apiDir)
  .filter((n) => n.endsWith('.js') && !n.startsWith('_'))
  .filter((n) => /serviceKey|SUPABASE_SERVICE_ROLE_KEY/.test(fs.readFileSync(path.join(apiDir, n), 'utf8')));

test('service_role を使う公開 API がある（検査対象が空で素通りしていない）', () => {
  assert.ok(adminApis.includes('admin.js') && adminApis.includes('dictionary.js'), adminApis.join(', '));
});

test('service_role を使う API は、最初の fetch より前に verifyAdmin の結果で打ち切る', () => {
  const bad = [];
  for (const name of adminApis) {
    const src = fs.readFileSync(path.join(apiDir, name), 'utf8');
    const guard = src.search(/await verifyAdmin\(req\)[\s\S]*?if \(!\w+\.ok\)/);
    const firstFetch = src.search(/await fetch\(/);
    if (guard === -1 || (firstFetch !== -1 && firstFetch < guard)) bad.push(name);
    if (/process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(src)) bad.push(`${name}（service_role key を直接読んでいる。verifyAdmin の結果から受け取る）`);
  }
  assert.deepStrictEqual(bad, []);
});
