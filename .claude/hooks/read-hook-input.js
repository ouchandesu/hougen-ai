// フック共通: 標準入力の JSON を読む。拒否フックの結果の書き出しもここに置く。

function readHookInput() {
  const chunks = [];
  const fd = 0;
  const buf = Buffer.alloc(65536);
  for (;;) {
    let n;
    try {
      n = require('fs').readSync(fd, buf, 0, buf.length, null);
    } catch (err) {
      if (err.code === 'EAGAIN') continue;
      if (err.code === 'EOF') break;
      throw err;
    }
    if (n === 0) break;
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// 拒否は exit 0 + この JSON。exit code で拒否すると理由の文面がエージェントへ届かない場合がある
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

module.exports = { readHookInput, deny };
