// docs/adr/ の各 ADR のヘッダ（ステータス / 実装状況 / 決定）から docs/adr/index.md を生成する。
// 索引は生成物で手で書かない。コミット済みの索引との一致は scripts/checks/adr-index.test.js が見る。
//   node scripts/adr-index.js         索引を書き出す
//   require('./adr-index').buildIndex() 書き出さずに文字列だけ得る

const fs = require('fs');
const path = require('path');

const ADR_DIR = path.resolve(__dirname, '..', 'docs', 'adr');
const INDEX_PATH = path.join(ADR_DIR, 'index.md');
const ADR_FILE = /^(\d{4})-.+\.md$/;

// autocrlf で CRLF になった作業コピーでも同じ結果にする
function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function listAdrs() {
  return fs.readdirSync(ADR_DIR)
    .filter((name) => ADR_FILE.test(name))
    .sort()
    .map((name) => {
      const text = readText(path.join(ADR_DIR, name));
      const header = (key) => (text.match(new RegExp(`^- ${key}: (.+)$`, 'm')) || [])[1];
      const heading = text.match(/^# (\d{4}): (.+)$/m);
      return {
        file: name,
        number: name.match(ADR_FILE)[1],
        headingNumber: heading && heading[1],
        title: heading && heading[2],
        status: header('ステータス'),
        implementation: header('実装状況'),
        decision: header('決定'),
      };
    });
}

// 表のセルに入る値の | を逃がす
const cell = (s) => String(s).replace(/\|/g, '\\|');

function buildIndex() {
  const rows = listAdrs().map((a) => {
    for (const key of ['title', 'status', 'implementation', 'decision']) {
      if (!a[key]) throw new Error(`${a.file}: ヘッダが欠けている（${key}）`);
    }
    return `| ${a.number} | [${cell(a.title)}](<${a.file}>) | ${cell(a.status)} | ${cell(a.implementation)} | ${cell(a.decision)} |`;
  });
  return [
    '# ADR 索引',
    '',
    '<!-- scripts/adr-index.js が生成する。手で編集しない（npm run adr:index） -->',
    '',
    '| 番号 | 題 | ステータス | 実装状況 | 決定 |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

if (require.main === module) {
  fs.writeFileSync(INDEX_PATH, buildIndex());
  console.log(`wrote ${path.relative(process.cwd(), INDEX_PATH)}`);
}

module.exports = { ADR_DIR, INDEX_PATH, listAdrs, buildIndex, readText };
