// PreToolUse: .env 系ファイルへの読み書きを止める（事故止め。子プロセスの中までは追わない）。
// このレポジトリの秘密は Vercel 環境変数だけに置く（.agents/rules/general/general-rules.md）。
// 仕様は scripts/checks/hooks.test.js が固定している。

const { readHookInput, deny } = require('./read-hook-input');

const REASON =
  '.env 系ファイルには触れない。秘密は Vercel 環境変数だけに置く。' +
  '必要な変数名は AGENTS.md の「参照先の地図」とコードの process.env 参照を見る。' +
  '値が要る検証は、鍵が無い前提でスタブで経路を通し、未検証として PR に書く。';

// 直前が英数字・_・$ なら、パスではなくプロパティ参照（process.env / import.meta.env）。
// 直後に英数字が続くもの（.envrc など）も別物として扱う
const ENV_PATH = /(^|[^A-Za-z0-9_$])\.env(\.[A-Za-z0-9_-]+)*(?![A-Za-z0-9_])/;

function mentionsEnvFile(text) {
  if (typeof text !== 'string') return false;
  // 値を持たない雛形は許す。先に消してから判定する
  return ENV_PATH.test(text.replace(/\.env\.example(?![A-Za-z0-9_])/g, ''));
}

// 返り値: 拒否理由（止めないなら null）
function decide(input) {
  const t = (input && input.tool_input) || {};
  const targets = [t.file_path, t.notebook_path, t.path, t.glob, t.command];
  return targets.some(mentionsEnvFile) ? REASON : null;
}

if (require.main === module) {
  let input;
  try {
    input = readHookInput();
  } catch {
    // 判定不能を「安全」と混ぜない
    deny('フック入力を解析できなかったので止めた（.claude/hooks/deny-env-files.js）。同じ操作をもう一度試す。');
    process.exit(0);
  }
  const reason = decide(input);
  if (reason) deny(reason);
}

module.exports = { decide, mentionsEnvFile };
