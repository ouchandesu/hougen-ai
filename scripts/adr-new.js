// docs/adr/template.md から次の番号の ADR を 1 本作り、索引を再生成する。
//   npm run adr:new -- "タイトル"
// 並行して ADR を足すブランチが無い前提で、番号は最大値 + 1（docs/adr/README.md「番号と並び」）。

const fs = require('fs');
const path = require('path');
const { ADR_DIR, INDEX_PATH, listAdrs, buildIndex, readText } = require('./adr-index');

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('使い方: npm run adr:new -- "タイトル"');
  process.exit(1);
}

const numbers = listAdrs().map((a) => Number(a.number));
const number = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(4, '0');

// ファイル名に使えない文字と空白をハイフンへ
const slug = title.replace(/[\\/:*?"<>|\s]+/g, '-');
const file = path.join(ADR_DIR, `${number}-${slug}.md`);

const body = readText(path.join(ADR_DIR, 'template.md'))
  .replace('# NNNN: タイトル', `# ${number}: ${title}`);
fs.writeFileSync(file, body);
fs.writeFileSync(INDEX_PATH, buildIndex());

console.log(`created ${path.relative(process.cwd(), file)}`);
