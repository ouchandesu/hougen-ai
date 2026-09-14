// .agents/rules/ 配下は中身が丸ごと毎ターンのプロンプトに載る。
// ルールを足しても型もテストも何も落ちず、全セッションの全ターンの代金だけが黙って上がるので、上限を置く。
// 落ちたら上限を上げるのではなく、面ごとの詳細を .agents/skills/ の references へ移す。
// あわせて、.claude/ からのリンクが実体へ届いていること（届かないとルールが 1 行も読まれない）を見る。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

// 実測 2,027 bytes（general-rules.md 1 枚）に対して、同じ大きさのもう 1 枚分の余裕
const RULES_BUDGET_BYTES = 4000;

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  });
}

test('.agents/rules/ の合計が予算内', () => {
  // autocrlf の作業コピーでも同じ値になるよう LF に揃えて数える
  const total = filesUnder(path.join(root, '.agents', 'rules'))
    .reduce((sum, f) => sum + Buffer.byteLength(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')), 0);
  assert.ok(total <= RULES_BUDGET_BYTES,
    `ルール合計 ${total} bytes が上限 ${RULES_BUDGET_BYTES} bytes を超えた。詳細を skill の references へ移す`);
});

for (const [link, target] of [['.claude/rules', '.agents/rules'], ['.claude/skills', '.agents/skills']]) {
  test(`${link} が ${target} に届く`, () => {
    const linkPath = path.join(root, link);
    assert.ok(fs.existsSync(linkPath) && fs.statSync(linkPath).isDirectory(),
      `${link} がディレクトリとして解決できない。npm run link を実行する`);
    assert.strictEqual(fs.realpathSync(linkPath), fs.realpathSync(path.join(root, target)));
  });
}
