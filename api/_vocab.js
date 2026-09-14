// 研修クイズの出題に使う語の一覧。方言の資料で意味を裏付けた語だけを置く
// Supabase の監修済み辞書（ADR 0004）ができるまでの仮置き。語を足すときは sources に裏付けの URL を必ず付ける
// 形は scripts/checks/vocab.test.js が固定している

// 今の使われ方。資料に記述が無いものは unknown（画面には何も出さない）
const USAGE_LABELS = {
  daily:   '今も日常で使う',
  elder:   '主に年配の人が使う',
  old:     '昔の言葉',
  unknown: '',
};

// id: 学習記録と出題済みの管理に使う識別子（変えない） / word: 出題する語 / meaning: 資料による意味
// region: 資料に書かれた地域（無ければ空） / usage: USAGE_LABELS のキー / note: 資料にある補足
// examples: 資料に載っている例文だけ（作らない） / sources: 意味を裏付けた資料の URL
const SRC = {
  wiki:     'https://ja.wikipedia.org/wiki/%E4%BC%8A%E4%BA%88%E5%BC%81',        // Wikipedia「伊予弁」
  iyomemo:  'https://www.iyobank.co.jp/sp/iyomemo/entry/20170124.html',          // 伊予銀行 iyomemo
  kotaro:   'http://www.kotaro-iseki.net/hougen-c.htm',                           // こたろう博物学研究所 伊予方言大辞典
  yanagi:   'https://www.i-manabi.jp/system/regionals/regionals/ecode:3/60/view/14496', // えひめの記憶『柳谷村誌』
  ecatv:    'http://home.e-catv.ne.jp/ja5dlg/hougen/hougen3.htm',                 // 伊予の方言
  take26:   'https://take26.com/iyo_lang',
  hougenme: 'https://hougen.me/list-ehime/',
  towa:     'https://hougentowa.com/380.html',
  bjtp:     'https://bjtp.tokyo/ehime-hogen/',
  cuty:     'https://cuty.jp/53008',
  belcy:    'https://belcy.jp/39036',
  kurashi:  'https://kurashi-no.jp/I0016362',
  okapon:   'https://okapon-info.com/archives/14335',
  dogo:     'https://dogoehime.com/lifestyle/ehimeinformation-iyoben/',
  dogo2:    'https://dogoehime.com/lifestyle/ehime-dialect-2/',
  yatokame: 'https://yatokame.tyanoyu.net/iyoben/iyoben.htm',
  mayonez:  'https://mayonez.jp/topic/1005837',
  osusume:  'https://osusumeshn.com/aichi-hougen/',
  jiji:     'https://ji-jifamily.com/9007/',
};
const dcity = (page) => `https://www.dcity-ehime.com/ho-gen/${page}.asp`;   // デジタルシティえひめ「伊予の方言」

const VOCAB = [
  { id: 'yomoda', word: 'よもだ', meaning: 'いい加減、無責任（な言動・人）、とぼけること', region: '', usage: 'unknown', note: '',
    examples: [
      { dialect: 'ヨモダを言うな', standard: '無責任なことを言うな。とぼけるな', source: dcity('top10_10') },
      { dialect: 'よもだじゃね', standard: 'お調子者だね、ふざけた人だね', source: SRC.iyomemo },
    ],
    sources: [SRC.wiki, SRC.iyomemo, dcity('top10_10'), SRC.kotaro, SRC.hougenme] },
  { id: 'namoshi', word: 'なもし', meaning: '〜ですよ、〜ですね（敬意のこもった念押し。「ぞなもし」とも）', region: '', usage: 'old',
    note: '伊予銀行のコラムは「おいでたなもし」を死語に近いとしている。夏目漱石『坊っちゃん』で知られる',
    examples: [], sources: [SRC.wiki, SRC.iyomemo, dcity('top10_06'), SRC.kotaro, SRC.hougenme, SRC.okapon] },
  { id: 'seraren', word: 'せられん', meaning: 'するな、してはいけない', region: '', usage: 'unknown', note: '',
    examples: [], sources: [SRC.wiki, SRC.kotaro] },
  { id: 'indekouwai', word: 'いんでこうわい', meaning: '帰ります（別れのあいさつ）', region: '', usage: 'unknown',
    note: '「ちょっと帰ってまた来る」ように聞こえるが、戻ってはこない（伊予方言大辞典）',
    examples: [], sources: [SRC.wiki, SRC.iyomemo, dcity('top10_01'), SRC.kotaro] },
  { id: 'inuru', word: 'いぬる', meaning: '帰る（過去形は「いんだ」）', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'イニシナにちょっと買いモンしてイヌるけんな', standard: '帰る途中で少し買い物をしてから帰りますよ', source: dcity('a_07') }],
    sources: [SRC.wiki, SRC.kotaro, dcity('a_07')] },
  { id: 'monta', word: 'もんた', meaning: '帰った、戻った', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'いつもんたん？', standard: 'いつこちらに戻ってきたの？', source: SRC.kotaro }],
    sources: [SRC.wiki, SRC.iyomemo, SRC.kotaro] },
  { id: 'kaku', word: 'かく', meaning: '（物を）運ぶ、持って移動させる、担ぐ', region: '', usage: 'daily',
    note: '学校の掃除で「机をかいて」と言うのが一般的（hougen.me）',
    examples: [{ dialect: 'この机、かいてや', standard: 'この机を持って移動させて', source: SRC.iyomemo }],
    sources: [SRC.wiki, SRC.iyomemo, SRC.hougenme, SRC.towa, SRC.cuty, SRC.kurashi] },
  { id: 'yannahai', word: 'やんなはい', meaning: 'ください', region: '南予', usage: 'unknown', note: '',
    examples: [], sources: [SRC.wiki, SRC.kotaro] },
  { id: 'dandan', word: 'だんだん', meaning: 'ありがとう', region: '', usage: 'unknown',
    note: '資料によって「旧表現」（Wikipedia）とも「日常的に使う」とも書かれており、今の使われ方は一致しない',
    examples: [], sources: [SRC.wiki, SRC.kotaro, SRC.hougenme, SRC.kurashi, SRC.okapon] },
  { id: 'gaina', word: 'がいな', meaning: 'ものすごい、ものすごく（副詞は「がいに」）、非常な', region: '', usage: 'unknown',
    note: '南予では「立派な」の意味でも使う（伊予銀行 iyomemo）',
    examples: [{ dialect: '今年の夏はがいに暑うなろわい。', standard: '今年の夏はとても暑くなりますよ', source: SRC.hougenme }],
    sources: [SRC.wiki, SRC.iyomemo, SRC.kotaro, SRC.hougenme] },
  { id: 'magaru', word: 'まがる', meaning: '触る、邪魔になる', region: '', usage: 'unknown', note: '共通語の「曲がる」とは別の意味',
    examples: [{ dialect: 'それメゲやすいけん、マガラれんいうとったのに', standard: 'それはこわれやすいからさわるなといっておいたのに', source: dcity('top10_09') }],
    sources: [SRC.wiki, dcity('top10_09'), SRC.kotaro, SRC.hougenme] },
  { id: 'irou', word: 'いろう', meaning: '触る、いじる', region: '', usage: 'unknown', note: '「いらう」とも',
    examples: [], sources: [SRC.wiki, SRC.kotaro, SRC.yanagi, SRC.okapon, SRC.belcy, SRC.take26] },
  { id: 'madou', word: 'まどう', meaning: '弁償する、償う', region: '', usage: 'unknown', note: '「まぞう」とも',
    examples: [{ dialect: 'スマンノゥ、マドウキン、コラエテツカァ', standard: '済みませんね、弁償しますから許してくださいね', source: dcity('ma_02') }],
    sources: [SRC.wiki, dcity('ma_02'), SRC.kotaro, SRC.yanagi] },
  { id: 'oshinaya', word: 'おしなや', meaning: '（そんなことを）したら駄目、しないで', region: '', usage: 'unknown',
    note: '「おしや」は「しなさいよ」の意味（伊予方言大辞典）',
    examples: [], sources: [SRC.kotaro, SRC.osusume] },
  { id: 'nanshiyon', word: 'なんしよん', meaning: '何してるの？', region: '', usage: 'daily', note: '「なんしょん」とも',
    examples: [], sources: [SRC.wiki, SRC.take26, SRC.jiji, SRC.okapon] },
  { id: 'inagena', word: 'いなげな', meaning: '変な、妙な、変わった', region: '', usage: 'unknown', note: '広島弁と共通して使われる語とする資料もある',
    examples: [{ dialect: 'イナゲな格好して出歩かれんゼ、風が悪いけん', standard: '変な姿で外へ出てはいけないよ。体裁が悪いから', source: dcity('a_06') }],
    sources: [SRC.wiki, dcity('a_06'), SRC.kotaro, SRC.yanagi, SRC.ecatv] },
  { id: 'tagoru', word: 'たごる', meaning: '咳をする、咳き込む', region: '', usage: 'unknown', note: '',
    examples: [
      { dialect: 'がいなことたごりよんなはるが、どこぞ悪いと違うかな？', standard: 'すごく咳き込んでおられますが、どこか具合が悪いと違いますか？', source: SRC.kotaro },
      { dialect: '風邪ひいてから、夜も眠れんくらいたごるけん、しんどいわい。', standard: '風邪ひいてから、夜も眠れないくらい咳が出るから辛いです。', source: SRC.hougenme },
    ],
    sources: [SRC.wiki, SRC.iyomemo, SRC.kotaro, SRC.yanagi, SRC.hougenme] },
  { id: 'shagu', word: 'しゃぐ', meaning: '（車などで）轢く、押しつぶす、下に敷く', region: '', usage: 'daily', note: '日常会話でよく使う（hougen.me）',
    examples: [
      { dialect: '畑の中をそう踏みシャイだらいかんがナ', standard: '畑をそんなに踏みつぶしたらいけません', source: dcity('sa_05') },
      { dialect: '私の鞄しゃいどるよ', standard: '私の鞄踏んでます', source: SRC.belcy },
    ],
    sources: [SRC.iyomemo, SRC.kotaro, dcity('sa_05'), SRC.hougenme, SRC.dogo2, SRC.take26, SRC.belcy] },
  { id: 'kayaru', word: 'かやる', meaning: 'ひっくり返る、倒れる、こぼれる', region: '', usage: 'unknown',
    note: '東予・中予では角を曲がることもいう（デジタルシティえひめ）',
    examples: [{ dialect: '台風が来よるけん、タテゾエをしゃんとしとかんとカヤッてしまうんぞ', standard: '支柱をしっかりしておかないと台風で倒されてしまうよ', source: dcity('top10_04') }],
    sources: [dcity('top10_04'), SRC.kotaro, SRC.ecatv, SRC.take26] },
  { id: 'haseda', word: 'はせだ', meaning: '仲間はずれ、のけ者', region: '', usage: 'unknown',
    note: 'デジタルシティえひめは「松山に残る固有の言葉」とし、東予の言葉として挙げる資料もある',
    examples: [{ dialect: 'あの子ぎりがハセダにされて泣いとるが。みんな仲ようせいよ', standard: 'あの子ばかりが仲間はずれにされて泣いているではないか。みんなで仲良くしなさいよ', source: dcity('top10_08') }],
    sources: [dcity('top10_08'), SRC.kotaro, SRC.ecatv] },
  { id: 'neya', word: 'ねや', meaning: '〜ね、〜だよね（念押し・同意を求める語尾）', region: '', usage: 'unknown',
    note: '男性が対等の関係で使う（デジタルシティえひめ）',
    examples: [{ dialect: 'そうじゃろがネヤ', standard: 'そうでしょう、あなたもそう思いませんか、思いますよねぇ', source: dcity('na_02') }],
    sources: [SRC.wiki, dcity('na_02'), SRC.kotaro, SRC.yanagi, SRC.ecatv] },
  { id: 'oshimaitaka', word: 'おしまいたか', meaning: 'こんばんは（夜のあいさつ）', region: '中予', usage: 'unknown',
    note: '「今日の仕事の仕舞いがつきましたか」という労いの意味。中予の在郷ことば（デジタルシティえひめ）',
    examples: [{ dialect: 'はいはいそちらさまもオシマイタカナモシ', standard: 'そちらさまもこんばんわ', source: dcity('top10_02') }],
    sources: [dcity('top10_02'), SRC.yanagi] },
  { id: 'mutsukoi', word: 'むつこい', meaning: '味が濃い、脂っこい、しつこい', region: '', usage: 'unknown', note: '「むつごい」とも',
    examples: [{ dialect: 'この料理はムツゴウて、アシの口にはあわんわい', standard: 'この料理は味付けが濃すぎて、私の好みではない', source: dcity('ma_05') }],
    sources: [dcity('ma_05'), SRC.hougenme, SRC.yatokame, SRC.bjtp, SRC.dogo] },
  { id: 'kayasu', word: 'かやす', meaning: 'こぼす、ひっくり返す', region: '', usage: 'unknown', note: '東海地方から西日本でよく使われる（hougen.me）',
    examples: [{ dialect: '買うたばっかりのジュースかやしてしもうた', standard: '買ったばかりのジュースをこぼしてしまった', source: SRC.hougenme }],
    sources: [SRC.dogo, SRC.hougenme, SRC.bjtp, SRC.yatokame] },
  { id: 'hiyai', word: 'ひやい', meaning: '冷たい、寒い', region: '', usage: 'unknown', note: '四国・中国地方で広く使う（bjtp）',
    examples: [{ dialect: '今日は夜ひやいから、着込んでおいてね', standard: '今日は夜寒いから、着込んでおいてね', source: SRC.cuty }],
    sources: [SRC.dogo, SRC.bjtp, SRC.kurashi, SRC.cuty] },
  { id: 'kaman', word: 'かまん', meaning: '構わない、いいよ', region: '', usage: 'unknown', note: '「かんまん」とも',
    examples: [{ dialect: '別にたいしたことないけん、かまんよ', standard: '別にたいしたことないから、いいよ', source: SRC.cuty }],
    sources: [SRC.yatokame, SRC.bjtp, SRC.kurashi, SRC.towa, SRC.cuty] },
  { id: 'yaoi', word: 'やおい', meaning: 'やわらかい', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'あんたのほっぺやおいなぁ', standard: 'あなたのほっぺた柔らかいなぁ', source: SRC.cuty }],
    sources: [SRC.hougenme, SRC.bjtp, SRC.okapon, SRC.cuty] },
  { id: 'karuu', word: 'かるう', meaning: '背負う', region: '', usage: 'unknown', note: '「からう」「かろう」とも。九州や中国地方でも使う（bjtp）',
    examples: [{ dialect: 'このカバンかるうよ', standard: 'このカバン背負うよ', source: SRC.towa }],
    sources: [SRC.hougenme, SRC.towa, SRC.bjtp] },
  { id: 'hecchi', word: 'へっち', meaning: '見当違い（の方向・ところ）', region: '', usage: 'unknown', note: '「へっちょ」とも',
    examples: [{ dialect: 'そがいにヘッチ向かんと、もちいとこっちィ寄らんかな', standard: 'そんなにはずれないで、もう少しこちらへ寄りなさい', source: dcity('ha_10') }],
    sources: [dcity('ha_10'), SRC.hougenme, SRC.towa, SRC.okapon] },
  { id: 'ketsumageru', word: 'けつまげる', meaning: '転ぶ', region: '', usage: 'unknown', note: '「つまずく」とする資料もある',
    examples: [], sources: [SRC.kurashi, SRC.okapon, SRC.hougenme] },
  { id: 'komai', word: 'こまい', meaning: '小さい', region: '', usage: 'unknown', note: '「こんまい」とも',
    examples: [{ dialect: '男がこんまいことぐだぐだ言うなや！', standard: '男が小さな事でごたごた言うな！', source: SRC.yatokame }],
    sources: [SRC.yatokame, SRC.cuty] },
  { id: 'hoyo', word: 'ほーよ', meaning: 'そうだよ、そうです（相づち・賛同）', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'ほーよ、ほーよ、うまくできました', standard: 'そう、そう、うまくできました', source: SRC.towa }],
    sources: [SRC.towa, SRC.belcy] },
  { id: 'orabu', word: 'おらぶ', meaning: '叫ぶ', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'さっきからおらんでから、勉強できん！', standard: 'さっきから叫ぶから、勉強できない！', source: SRC.cuty }],
    sources: [SRC.cuty, dcity('ya_02')] },
  { id: 'juurutanbo', word: 'じゅうるたんぼ', meaning: 'ぬかるみ', region: '', usage: 'unknown', note: '「じるたんぼ」とも',
    examples: [{ dialect: 'そんな端っこ歩きよるけん、じゅうるたんぼにはまるんよ！', standard: 'そんな端っこを歩いているから、ぬかるみにはまるのよ！', source: SRC.hougenme }],
    sources: [SRC.hougenme, SRC.okapon] },
  { id: 'usasu', word: 'うさす', meaning: 'なくす（紛失する）', region: '', usage: 'unknown', note: '',
    examples: [], sources: [SRC.wiki, SRC.okapon] },
  { id: 'inishina', word: 'いにしな', meaning: '帰る途中、帰り道', region: '', usage: 'unknown', note: '行く途中は「いきしな」',
    examples: [{ dialect: 'イニシナにちょっと買いモンしてイヌるけんな', standard: '帰る途中で少し買い物をしてから帰りますよ', source: dcity('a_07') }],
    sources: [dcity('a_07'), SRC.okapon] },
  { id: 'yanekoi', word: 'やねこい', meaning: 'たちが悪い（ずるい、しつこい）', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'あの男はヤネコイけん気ィつけんと差しくられるぞ', standard: 'あの男はたちが悪いから、うまく立ち回られないようにしなさいよ', source: dcity('ya_03') }],
    sources: [dcity('ya_03'), SRC.hougenme] },
  { id: 'kurasu', word: 'くらす', meaning: '叩く、殴る', region: '', usage: 'unknown', note: '',
    examples: [{ dialect: 'こんなことしたら、くらすよ', standard: 'こんな事したら、叩くよ', source: SRC.towa }],
    sources: [SRC.towa, SRC.mayonez] },
  { id: 'kenbiki', word: 'けんびき', meaning: '口内炎', region: '東予', usage: 'unknown', note: '',
    examples: [], sources: [SRC.mayonez, SRC.hougenme] },
  { id: 'torinoko', word: 'とりのこ用紙', meaning: '模造紙', region: '', usage: 'unknown', note: '略して「とりのこ」。学校で使う（bjtp）',
    examples: [], sources: [SRC.wiki, SRC.bjtp, SRC.kurashi] },
];

// 画面に返す項目。キーは scripts/checks/response-contract.test.js が index.html の読み出しと突き合わせる
const PUBLIC_ENTRY_KEYS = ['id', 'word', 'meaning', 'region', 'usageLabel', 'note', 'sources'];

function publicEntry(entry) {
  return {
    id:         entry.id,
    word:       entry.word,
    meaning:    entry.meaning,
    region:     entry.region,
    usageLabel: USAGE_LABELS[entry.usage],
    note:       entry.note,
    sources:    entry.sources,
  };
}

function findEntry(id) {
  return VOCAB.find((e) => e.id === id) || null;
}

// 出題済みでない語から 1 つ選ぶ。全部出題済みなら一覧全体から選び直す
function pickEntry(usedIds, random = Math.random, vocab = VOCAB) {
  const used = new Set(Array.isArray(usedIds) ? usedIds : []);
  const fresh = vocab.filter((e) => !used.has(e.id));
  const pool = fresh.length ? fresh : vocab;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

// プロンプトに渡す「正」の情報。モデルがこれと違う意味を作らないよう、資料の内容だけを並べる
function entryForPrompt(entry) {
  const lines = [
    `語：「${entry.word}」`,
    `意味（資料による）：${entry.meaning}`,
  ];
  if (entry.region) lines.push(`使われる地域（資料による）：${entry.region}`);
  if (USAGE_LABELS[entry.usage]) lines.push(`今の使われ方（資料による）：${USAGE_LABELS[entry.usage]}`);
  if (entry.note) lines.push(`補足（資料による）：${entry.note}`);
  entry.examples.forEach((ex) => lines.push(`資料の例文：「${ex.dialect}」＝「${ex.standard}」`));
  return lines.join('\n');
}

module.exports = { USAGE_LABELS, VOCAB, PUBLIC_ENTRY_KEYS, publicEntry, findEntry, pickEntry, entryForPrompt };
