// エージェント向けの文書（AGENTS.md / .agents/ / docs/）が名指しするファイル・ADR 番号・台帳 ID の実在を見る。
// これが無いと、ファイルを移したり ADR や台帳の行を消したりしても、
// 文書は存在しない場所を指したまま緑で残り、読んだエージェントは実態と照合できなくなる。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

function walk(dir, pick) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, pick) : pick(p) ? [p] : [];
  });
}

const DOCS = [
  path.join(root, 'AGENTS.md'),
  ...walk(path.join(root, '.agents'), (p) => p.endsWith('.md')),
  ...walk(path.join(root, 'docs'), (p) => p.endsWith('.md')),
];
const read = (p) => fs.readFileSync(p, 'utf8');
const withoutFences = (text) => text.replace(/```[\s\S]*?```/g, '');

// 使い捨ての置き場として名前だけ出てくるもの（spec-plan-and-pr.md）。無いのが正常
const MAY_NOT_EXIST = ['docs/specs'];

const PATH_RE = /(?<![\w./-])((?:api|scripts|docs|\.agents|\.claude)\/[\w./-]*[\w/]|(?:index|admin)\.html|package\.json|AGENTS\.md)(?![\w])/g;

test('文書が名指しするファイルパスが実在する', () => {
  const missing = [];
  for (const doc of DOCS) {
    for (const [, p] of read(doc).matchAll(PATH_RE)) {
      if (MAY_NOT_EXIST.some((m) => p.startsWith(m))) continue;
      if (!fs.existsSync(path.join(root, p))) missing.push(`${rel(doc)}: ${p}`);
    }
  }
  assert.deepStrictEqual(missing, []);
});

test('「ADR NNNN」と綴られた ADR が実在する', () => {
  const numbers = new Set(fs.readdirSync(path.join(root, 'docs', 'adr'))
    .map((n) => (n.match(/^(\d{4})-/) || [])[1]).filter(Boolean));
  const sources = [...DOCS, ...walk(path.join(root, 'api'), (p) => p.endsWith('.js')),
    ...walk(path.join(root, '.claude', 'hooks'), (p) => p.endsWith('.js')),
    ...walk(path.join(root, 'scripts'), (p) => p.endsWith('.js') && !p.endsWith('references.test.js'))];
  const missing = [];
  for (const src of sources) {
    for (const [, n] of read(src).matchAll(/ADR (\d{4})/g)) {
      if (!numbers.has(n)) missing.push(`${rel(src)}: ADR ${n}`);
    }
  }
  assert.deepStrictEqual(missing, []);
});

test('引かれている台帳 ID が台帳に実在する', () => {
  const ledgerDir = path.join(root, 'docs', 'adr', '未対応実装');
  const ledgers = walk(ledgerDir, (p) => p.endsWith('.md') && path.basename(p) !== 'README.md');
  const ID_RE = /\b((?:FE|API|DB)-\d{3})\b/g;
  // 台帳の行として定義されている ID（表の 1 列目）
  const defined = new Set(ledgers.flatMap((l) => [...read(l).matchAll(/^\| ((?:FE|API|DB)-\d{3}) \|/gm)].map((m) => m[1])));

  const sources = [...DOCS, path.join(root, 'index.html'), path.join(root, 'admin.html'),
    ...walk(path.join(root, 'api'), (p) => p.endsWith('.js'))];
  const missing = [];
  for (const src of sources) {
    for (const [, id] of withoutFences(read(src)).matchAll(ID_RE)) {
      if (!defined.has(id)) missing.push(`${rel(src)}: ${id}`);
    }
  }
  assert.deepStrictEqual(missing, []);
});
