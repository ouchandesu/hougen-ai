// .claude/hooks/ の判定の仕様を固定する。
// フックは壊れても exit 0・出力なしになり、「危険ではないと判定した」のと見分けがつかない。
// 遮断が丸ごと素通りしていても、誤爆で普通の作業が止まっていても、ほかに気づく仕組みが無い。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const hooks = path.resolve(__dirname, '..', '..', '.claude', 'hooks');
const envHook = require(path.join(hooks, 'deny-env-files.js'));
const cmdHook = require(path.join(hooks, 'deny-dangerous-commands.js'));
const syntaxHook = require(path.join(hooks, 'check-syntax.js'));

const onBranch = (command) => cmdHook.decide(command, { currentBranch: 'feat/x' });
const onMain = (command) => cmdHook.decide(command, { currentBranch: 'main' });

test('env: .env 系ファイルを指すものは止める', () => {
  for (const input of [
    { tool_input: { file_path: 'C:\\dev\\hougen-AI\\.env' } },
    { tool_input: { file_path: '/repo/.env.local' } },
    { tool_input: { command: 'cat .env' } },
    { tool_input: { command: 'Get-Content ./.env.production' } },
    { tool_input: { path: '.env' } },
    { tool_input: { glob: '**/.env*' } },
  ]) assert.ok(envHook.decide(input), JSON.stringify(input));
});

test('env: プロパティ参照・雛形・似た名前は止めない', () => {
  for (const input of [
    { tool_input: { command: 'node -e "console.log(process.env.PATH)"' } },
    { tool_input: { file_path: 'api/_auth.js' } },
    { tool_input: { file_path: '.env.example' } },
    { tool_input: { command: 'cat .envrc.sample' } },
    { tool_input: { command: 'echo $env:PATH' } },
  ]) assert.strictEqual(envHook.decide(input), null, JSON.stringify(input));
});

test('cmd: デプロイと環境変数の変更を止める', () => {
  for (const c of ['vercel', 'vercel --prod', 'vercel deploy', 'npx vercel deploy --prod', 'vercel env add X',
    'vercel pull', 'cd app && vercel --prod', 'vercel.cmd promote abc']) {
    assert.ok(onBranch(c), c);
  }
});

test('cmd: 本番に触れない vercel は止めない', () => {
  for (const c of ['vercel dev', 'vercel whoami', 'vercel --version', 'vercel logs x']) {
    assert.strictEqual(onBranch(c), null, c);
  }
});

test('cmd: 履歴を書き換える push と main への push を止める', () => {
  for (const c of ['git push --force', 'git push -f origin feat/x', 'git push --force-with-lease',
    'git push origin +feat/x', 'git push origin --delete feat/x', 'git push origin :feat/x',
    'git push origin main', 'git push -u origin HEAD:main', 'git -C . push origin main']) {
    assert.ok(onBranch(c), c);
  }
  assert.ok(onMain('git push'), 'main 上の省略 push');
  assert.ok(onMain('git push origin HEAD'), 'main 上の HEAD push');
  assert.ok(cmdHook.decide('git push', { currentBranch: null }), 'ブランチ不明は止める');
});

test('cmd: 作業ブランチの push と push 以外の git は止めない', () => {
  for (const c of ['git push', 'git push -u origin feat/x', 'git push origin HEAD', 'git status', 'git log main']) {
    assert.strictEqual(onBranch(c), null, c);
  }
});

test('cmd: 名前やパターンでのプロセス停止を止める', () => {
  for (const c of ['pkill -f node', 'killall node', 'taskkill /IM node.exe /F', 'Stop-Process -Name node',
    'Get-Process node | Stop-Process', 'sudo pkill vercel']) {
    assert.ok(onBranch(c), c);
  }
});

test('cmd: PID 指定の停止は止めない', () => {
  for (const c of ['kill 1234', 'Stop-Process -Id 1234', 'taskkill /PID 1234']) {
    assert.strictEqual(onBranch(c), null, c);
  }
});

test('cmd: コマンド位置以外に綴りがあるだけでは止めない', () => {
  for (const c of ['git commit -m "vercel --prod と pkill を禁止する"', 'grep -rn "git push --force" .',
    'echo vercel deploy', 'rg "Stop-Process -Name" .claude']) {
    assert.strictEqual(onBranch(c), null, c);
  }
});

function runHook(file, stdin) {
  return spawnSync(process.execPath, [path.join(hooks, file)], { input: stdin, encoding: 'utf8' });
}

test('拒否は exit 0 と permissionDecision: deny の JSON で返す', () => {
  const r = runHook('deny-env-files.js', JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '.env' } }));
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /Vercel 環境変数/);
});

test('入力を解析できなければ拒否側へ倒す', () => {
  for (const file of ['deny-env-files.js', 'deny-dangerous-commands.js']) {
    const r = runHook(file, 'not json');
    assert.strictEqual(r.status, 0, file);
    assert.strictEqual(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny', file);
  }
});

test('許可するときは何も出さない', () => {
  const r = runHook('deny-dangerous-commands.js', JSON.stringify({ tool_input: { command: 'git status' } }));
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('syntax: JS と HTML のインラインスクリプトの構文エラーを見つけ、exit 2 で返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-syntax-'));
  const js = path.join(dir, 'bad.js');
  const html = path.join(dir, 'bad.html');
  fs.writeFileSync(js, 'module.exports = function ( {');
  fs.writeFileSync(html, '<p>x</p>\n<script src="https://example.com/a.js"></script>\n<script>\nconst a = ;\n</script>');
  try {
    assert.ok(syntaxHook.checkFile(js));
    assert.match(syntaxHook.checkFile(html), /:4/);
    const r = runHook('check-syntax.js', JSON.stringify({ tool_input: { file_path: html } }));
    assert.strictEqual(r.status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('syntax: 現行の HTML・API・設定ファイルで誤検知しない', () => {
  const root = path.resolve(hooks, '..', '..');
  const files = ['index.html', 'admin.html', 'package.json', '.claude/settings.json',
    ...fs.readdirSync(path.join(root, 'api')).map((n) => `api/${n}`)];
  for (const f of files) assert.strictEqual(syntaxHook.checkFile(path.join(root, f)), null, f);
});
