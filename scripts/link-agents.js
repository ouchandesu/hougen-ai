// .claude/rules と .claude/skills を .agents/ 配下の実体へつなぐ。
// git にはシンボリックリンク（mode 120000）として記録してあるが、Windows では
// 管理者権限なしにシンボリックリンクを作れず、clone するとリンク先パスを書いた
// ただのテキストファイルになる。そこでジャンクションで置き換え、
// git が差分として拾わないよう skip-worktree を立てる。
// macOS / Linux では clone 時点で本物のリンクになるので何もしない。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const LINKS = [
  { link: '.claude/rules', target: '.agents/rules' },
  { link: '.claude/skills', target: '.agents/skills' },
];

for (const { link, target } of LINKS) {
  const linkPath = path.join(root, link);
  const targetPath = path.join(root, target);

  if (!fs.existsSync(targetPath)) {
    console.log(`skip    ${link}（${target} が無い）`);
    continue;
  }
  if (fs.existsSync(linkPath) && fs.statSync(linkPath).isDirectory()) {
    console.log(`ok      ${link} -> ${target}`);
    continue;
  }
  if (process.platform !== 'win32') {
    console.error(`${link} がディレクトリとして解決できない。git checkout -- ${link} を試す`);
    process.exitCode = 1;
    continue;
  }

  // リンク先パスを書いたテキストファイル（Windows の clone 直後の姿）を消してから張る
  if (fs.existsSync(linkPath)) fs.rmSync(linkPath);
  fs.symlinkSync(targetPath, linkPath, 'junction');
  execFileSync('git', ['update-index', '--skip-worktree', link], { cwd: root });
  console.log(`linked  ${link} -> ${target}（junction）`);
}
