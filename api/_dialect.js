// 対象地域（ターゲット地域）の設定と、全プロンプト共通のルール文を提供する
// 将来的に他都道府県へ切り替える場合は TARGET_REGION の値だけを差し替える

// ── 対象地域の定義 ─────────────────────────────────────────
const TARGET_REGION = {
  prefecture: '愛媛県',                                        // 対象の都道府県名
  dialect:    '伊予弁',                                        // 対象の方言名
  endings:    '「〜けん」「〜ぞな」「〜よ」「〜やん」など',      // 対象方言に特有の語尾
  // 混同されやすく、絶対に混ぜてはいけない他地域の方言
  forbidden:  '関西弁（「〜やねん」「〜やろ」など）、土佐弁、博多弁、広島弁、岡山弁、香川弁',
};

// ── ルール1：過剰変換の防止（自然さの優先）─────────────────
// 変換系のプロンプト（standard → dialect）でのみ使用する
function naturalnessRule(r = TARGET_REGION) {
  return `【自然さの優先】
標準語のままで自然な部分は、無理に${r.dialect}へ置き換えないでください。
すべての語句を方言にする必要はありません。
「変えるべきところだけ変え、変えなくてよいところは変えない」を徹底し、
${r.prefecture}の話者が実際に口にする自然な文章にしてください。`;
}

// ── ルール1b：方言の濃さ（変換系のみ）────────────────────────
// 利用者が選ぶ濃さ。未知の値は normal に丸める（normalizeLevel）
const CONVERT_LEVELS = ['light', 'normal', 'strong'];

function normalizeLevel(level) {
  return CONVERT_LEVELS.includes(level) ? level : 'normal';
}

function levelRule(level, r = TARGET_REGION) {
  const rules = {
    light: `語尾・助詞・文末表現だけを${r.dialect}にし、語彙（名詞・動詞・形容詞など）は標準語のまま残してください。`,
    normal: `語尾・文末表現に加えて、${r.prefecture}の話者が日常的に言い換える語彙だけを${r.dialect}にしてください。`,
    strong: `語尾・文末表現に加えて、${r.dialect}特有の語彙への言い換えも積極的に行ってください。
ただし、${r.prefecture}で実際に使われていない表現を作ったり、意味が変わる言い換えをしたりはしないでください。`,
  };
  return `【方言の濃さ】
${rules[normalizeLevel(level)]}
「自然さの優先」と食い違う場合は、この「方言の濃さ」の指示で変える範囲を決め、その範囲の中で自然さを優先してください。`;
}

// ── ルール2：他地域の方言の混入禁止（純度管理）──────────────
function purityRule(r = TARGET_REGION) {
  return `【純度管理】
対象地域は${r.prefecture}（${r.dialect}）のみです。
${r.forbidden} など、他地域の方言を絶対に混ぜないでください。
語尾や言い回しは${r.dialect}特有の表現（${r.endings}）に厳格に限定してください。
他地域の方言との比較や、他地域での類似表現の紹介も行わないでください。`;
}

// ── ルール3：出力形式 ──────────────────────────────────────
function jsonOnlyRule() {
  return `【出力形式】
指定されたJSON形式のみを出力してください。
前置き・解説・コードブロック記号（\`\`\`）は一切含めないでください。`;
}

module.exports = {
  TARGET_REGION, CONVERT_LEVELS, normalizeLevel,
  naturalnessRule, levelRule, purityRule, jsonOnlyRule,
};
