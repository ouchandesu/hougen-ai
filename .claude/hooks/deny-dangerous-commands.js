// PreToolUse（Bash / PowerShell）: 出荷経路と隣のセッションを壊すコマンドを止める。
// 見るのはツールへ渡された文字列の「コマンド位置」だけ（行頭と ; && || | ( $( ` の直後）。
// 綴りをどこでも拾うと、コミットメッセージや検索の引数に書いただけで作業が止まる。
// 子プロセスやラッパスクリプトの中は追わない。総当たりの防壁ではなく事故止め。
// 仕様は scripts/checks/hooks.test.js が固定している。

const { execFileSync } = require('child_process');
const { readHookInput, deny } = require('./read-hook-input');

// コマンドの前に付きがちな実行ラッパ。読み飛ばして本体を見る
const WRAPPERS = new Set(['sudo', 'env', 'npx', 'command', 'exec', 'nohup', 'time']);

// vercel のうち、本番にも環境変数にも触れないサブコマンド
const VERCEL_SAFE = new Set(['dev', 'whoami', 'ls', 'list', 'logs', 'inspect', 'help', 'login', 'logout']);

function segments(command) {
  return command.split(/\|\||&&|\$\(|[;|&\n(){}`]/);
}

function tokens(segment) {
  return segment.trim().split(/\s+/).filter(Boolean).map((s) => s.replace(/^['"]|['"]$/g, ''));
}

// 先頭の VAR=value とラッパを読み飛ばし、[コマンド名, ...引数] を返す
function commandAt(segment) {
  const toks = tokens(segment);
  while (toks.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[0]) || WRAPPERS.has(toks[0]))) toks.shift();
  if (!toks.length) return null;
  const name = toks[0].split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|ps1)$/, '');
  return [name, ...toks.slice(1)];
}

function checkVercel(args) {
  const sub = args.find((a) => !a.startsWith('-'));
  if (sub && VERCEL_SAFE.has(sub)) return null;
  if (!sub && args.some((a) => ['--version', '-v', '--help', '-h'].includes(a))) return null;
  return 'デプロイと Vercel 環境変数の変更（vercel / vercel deploy / --prod / env / pull など）は人間がやる。' +
    '作業ブランチを push して PR を開き、PR 本文に「デプロイが必要」と書く。手元での動作確認は vercel dev を使う。';
}

function checkGitPush(args, currentBranch) {
  // git -C <path> / -c <k=v> などのグローバルオプションを飛ばして push を探す
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += ['-C', '-c'].includes(args[i]) ? 2 : 1;
  if (args[i] !== 'push') return null;
  const rest = args.slice(i + 1);

  const rewrite = rest.some((a) =>
    /^(-f|--force.*|--mirror|--delete|-d|--prune|--all)$/.test(a) || /^\+/.test(a) || /^:/.test(a));
  if (rewrite) {
    return 'リモートの履歴を書き換える・消す push（--force / +refspec / --delete / --mirror / --all）はしない。' +
      '履歴を直したいなら新しいコミットを積む。どうしても必要なら人間に理由を添えて頼む。';
  }

  const positional = rest.filter((a) => !a.startsWith('-'));
  const refspecs = positional.slice(1);
  const toMain = refspecs.some((r) => /(^|:|refs\/heads\/)main$/.test(r));
  // refspec 省略や HEAD は現在のブランチへ push する。判定できないときは main とみなす
  const onMain = currentBranch === 'main' || currentBranch == null;
  const implicitMain = onMain && (refspecs.length === 0 || refspecs.some((r) => /^HEAD(:|$)/.test(r)));
  if (toMain || implicitMain) {
    return 'main へは push しない（Vercel の本番反映につながりうる）。' +
      '作業ブランチを切って `git push -u origin <ブランチ名>` し、gh pr create で PR を開く。' +
      '現在のブランチが判定できない場合もここで止まる。push 先のブランチ名を明示する。';
  }
  return null;
}

function checkKill(name, args) {
  const byName = args.some((a) => /^-(name|processname)$/i.test(a));
  const byImage = args.some((a) => /^[/-]im$/i.test(a));
  const hasId = args.some((a) => /^-id$/i.test(a) || /^\d+$/.test(a) || /^%\d+$/.test(a));
  const pattern =
    name === 'pkill' || name === 'killall' ||
    (name === 'taskkill' && byImage) ||
    ((name === 'stop-process' || name === 'spps') && (byName || !hasId)) ||
    (name === 'kill' && byName);
  if (!pattern) return null;
  return '名前やパターンでプロセスを止めない（pkill / killall / taskkill /IM / Stop-Process -Name）。' +
    '同じマシンの別セッションのプロセスまで止まる。自分で起動したプロセスの PID を控えて、kill <PID> / Stop-Process -Id <PID> で止める。';
}

// 返り値: 拒否理由（止めないなら null）
function decide(command, { currentBranch } = {}) {
  if (typeof command !== 'string') return null;
  for (const seg of segments(command)) {
    const cmd = commandAt(seg);
    if (!cmd) continue;
    const [name, ...args] = cmd;
    const reason =
      (name === 'vercel' && checkVercel(args)) ||
      (name === 'git' && checkGitPush(args, currentBranch)) ||
      checkKill(name, args);
    if (reason) return reason;
  }
  return null;
}

function currentBranchOf(dir) {
  if (process.env.HOOK_CURRENT_BRANCH) return process.env.HOOK_CURRENT_BRANCH;
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

if (require.main === module) {
  let input;
  try {
    input = readHookInput();
  } catch {
    deny('フック入力を解析できなかったので止めた（.claude/hooks/deny-dangerous-commands.js）。同じ操作をもう一度試す。');
    process.exit(0);
  }
  const command = input && input.tool_input && input.tool_input.command;
  // git push のときだけブランチを調べる（毎回 git を起動しない）
  const needsBranch = typeof command === 'string' && /\bpush\b/.test(command);
  const currentBranch = needsBranch ? currentBranchOf(input.cwd || process.env.CLAUDE_PROJECT_DIR || '.') : undefined;
  const reason = decide(command, { currentBranch });
  if (reason) deny(reason);
}

module.exports = { decide };
