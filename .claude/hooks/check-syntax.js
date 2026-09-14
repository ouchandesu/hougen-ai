// PostToolUse（Write / Edit）: 編集したファイルの構文を検査する。
// このレポジトリにはビルドも lint も無く（ADR 0002）、index.html のインライン JS の構文エラーは
// ブラウザで開くまで誰も気づかない。壊れていたら exit 2 で理由をエージェントへ返す。
// 仕様は scripts/checks/hooks.test.js が固定している。

const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { readHookInput } = require('./read-hook-input');

// src を持たないインライン <script> の中身と、その開始行（1 始まり）
function inlineScripts(html) {
  const found = [];
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const bodyStart = m.index + m[0].indexOf('>') + 1;
    found.push({ code: m[1], line: html.slice(0, bodyStart).split('\n').length });
  }
  return found;
}

// 返り値: エラー文（問題なし・対象外なら null）
function checkFile(file) {
  if (!file || !fs.existsSync(file)) return null;

  if (/\.(c?js)$/.test(file)) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      return null;
    } catch (err) {
      return String(err.stderr || err.message).trim();
    }
  }

  if (/\.html$/.test(file)) {
    const html = fs.readFileSync(file, 'utf8');
    for (const { code, line } of inlineScripts(html)) {
      try {
        new vm.Script(code, { filename: file, lineOffset: line - 1 });
      } catch (err) {
        const where = (err.stack || '').split('\n')[0];
        return `${where}\n${err.message}（インライン <script> の構文エラー）`;
      }
    }
    return null;
  }

  if (/\.json$/.test(file)) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
      return null;
    } catch (err) {
      return `${file}: JSON として読めない: ${err.message}`;
    }
  }

  return null;
}

if (require.main === module) {
  let input;
  try {
    input = readHookInput();
  } catch {
    process.stderr.write('check-syntax: フック入力を解析できず、構文検査をしていない\n');
    process.exit(1);
  }
  const error = checkFile(input && input.tool_input && input.tool_input.file_path);
  if (error) {
    process.stderr.write(`構文エラー。直してから先へ進む:\n${error}\n`);
    process.exit(2);
  }
}

module.exports = { checkFile, inlineScripts };
