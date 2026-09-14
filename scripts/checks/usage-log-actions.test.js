// 利用ログの action 名（api/*.js の logUsage 呼び出し）と、管理画面の日本語ラベル表
// （admin.html の actionLabels）を双方向で突き合わせる。
// これが無いと、機能を足してもダッシュボードに生の action 名が出るだけで、
// 逆に機能を消してもラベルが残るだけで、どちらも何も落ちない。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// logUsage({ ..., action: <式>, ... }) の <式> から action 名を得る。
// 文字列リテラルならその値。'prefix' + action の形なら、同じファイルの action === 'x' の分岐ごとに prefix + x
function loggedActions() {
  const actions = new Set();
  const apiDir = path.join(root, 'api');
  for (const name of fs.readdirSync(apiDir).filter((n) => n.endsWith('.js'))) {
    const src = read(`api/${name}`);
    for (const call of src.matchAll(/logUsage\(\{([\s\S]*?)\}\)/g)) {
      const expr = (call[1].match(/action:\s*([^,\n]+)/) || [])[1];
      if (!expr) continue;
      const literal = expr.trim().match(/^'([^']+)'$/);
      const prefixed = expr.trim().match(/^'([^']+)'\s*\+\s*action$/);
      if (literal) {
        actions.add(literal[1]);
      } else if (prefixed) {
        const branches = [...src.matchAll(/action === '([^']+)'/g)].map((m) => m[1]);
        assert.ok(branches.length, `api/${name}: action の分岐が見つからない`);
        branches.forEach((b) => actions.add(prefixed[1] + b));
      } else {
        assert.fail(`api/${name}: action の式を解釈できない（${expr.trim()}）。このテストを式に合わせて広げる`);
      }
    }
  }
  return actions;
}

function labeledActions() {
  const block = read('admin.html').match(/const actionLabels = \{([\s\S]*?)\};/);
  assert.ok(block, 'admin.html に actionLabels が見つからない');
  return new Set([...block[1].matchAll(/'([^']+)'\s*:/g)].map((m) => m[1]));
}

test('記録される action にはすべて管理画面のラベルがある', () => {
  const labeled = labeledActions();
  const missing = [...loggedActions()].filter((a) => !labeled.has(a));
  assert.deepStrictEqual(missing, [], 'admin.html の actionLabels に足す');
});

test('管理画面のラベルはすべて実際に記録される action を指す', () => {
  const logged = loggedActions();
  const stale = [...labeledActions()].filter((a) => !logged.has(a));
  assert.deepStrictEqual(stale, [], 'どの api/*.js も記録しない action のラベルが残っている');
});
