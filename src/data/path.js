import { getWordsForLevel } from './index.js'
import { getChar } from './hanzi.js'

/*
 * Parcours guidé, affiché dans la page Aujourd'hui (utils/path.js) : des unités dans l'ordre d'apprentissage, chacune
 * menant à un texte de lecture. Une étape est faite quand sa leçon, son point ou son texte est réussi, ou quand ses mots
 * ou ses caractères sont maîtrisés ; une étape faite autrement (module, test de niveau) compte aussi.
 *
 * Étape : { kind, … }
 *   pinyin   lesson   id d'une leçon de pinyin (data/pinyinLessons.js)
 *   hanzi    chars    caractères à écrire (HSK 1), quelques-uns à la fois
 *   words    words    mots du HSK 1 (écrits en caractères) appris avant le point ou le texte qui les emploie
 *   grammar  point    id d'un point de grammaire (content/grammar.js)
 *   reading  reading  id d'un texte (content/readings.js)
 * plus : unité Yidiano+. Les unités gratuites sont entièrement gratuites : leurs caractères sont ceux de la formule
 * gratuite (access/rules.js) et leur vocabulaire appartient au HSK 1.
 */

const UNITS = [
  {
    id: 'sons',
    title: { fr: 'Les sons du chinois', en: 'The sounds of Chinese' },
    steps: ['tons', 'accents', 'consonnes-faciles', 'consonnes-difficiles', 'voyelles', 'changements', 'mots']
      .map(lesson => ({ kind: 'pinyin', lesson })),
  },
  {
    id: 'presenter',
    title: { fr: 'Se présenter', en: 'Introducing yourself' },
    steps: [
      { kind: 'hanzi', chars: '你好我是人' },
      { kind: 'words', words: ['你', '好', '我', '是', '人', '你们', '我们', '他', '她'] },
      { kind: 'grammar', point: 'shi' },
      { kind: 'grammar', point: 'ma' },
      { kind: 'hanzi', chars: '中国叫什么' },
      { kind: 'words', words: ['叫', '什么', '名字', '哪', '国', '中国', '北京', '学生', '老师', '不', '呢', '谁'] },
      { kind: 'grammar', point: 'bu' },
      { kind: 'grammar', point: 'interrogatifs' },
      { kind: 'grammar', point: 'ne' },
      { kind: 'words', words: ['在', '学习', '汉语', '认识', '很', '高兴'] },
      { kind: 'grammar', point: 'hen-adjectif' },
      { kind: 'reading', reading: 'jieshao' },
    ],
  },
  {
    id: 'restaurant',
    title: { fr: 'Au restaurant', en: 'At the restaurant' },
    steps: [
      { kind: 'hanzi', chars: '想吃喝有钱' },
      { kind: 'words', words: ['想', '吃', '喝', '米饭', '鸡蛋', '茶', '水', '和', '饭店'] },
      { kind: 'grammar', point: 'xiang-yao' },
      { kind: 'grammar', point: 'you' },
      { kind: 'words', words: ['有', '没有', '要', '几', '杯', '一', '两', '三', '五', '十', '多少', '钱', '块', '谢谢', '不客气'] },
      { kind: 'reading', reading: 'fanguan' },
    ],
  },
  {
    id: 'chemin',
    plus: true,
    title: { fr: 'Demander son chemin', en: 'Asking the way' },
    steps: [
      { kind: 'hanzi', chars: '在去坐车站' },
      { kind: 'words', words: ['请问', '哪儿', '火车', '车', '前边', '远', '走路', '分', '坐', '去', '先生', '能', '会'] },
      { kind: 'grammar', point: 'zai' },
      { kind: 'grammar', point: 'hui-neng' },
      { kind: 'reading', reading: 'wenlu' },
    ],
  },
  {
    id: 'famille',
    plus: true,
    title: { fr: 'Ma famille', en: 'My family' },
    steps: [
      { kind: 'hanzi', chars: '家爸妈哥工' },
      { kind: 'words', words: ['家', '口', '爸爸', '妈妈', '哥哥', '医生', '医院', '工作', '岁', '今年', '喜欢', '大学生', '二'] },
      { kind: 'grammar', point: 'de-possession' },
      { kind: 'grammar', point: 'ye-dou' },
      { kind: 'reading', reading: 'jiating' },
    ],
  },
  {
    id: 'journee',
    plus: true,
    title: { fr: 'Ma journée', en: 'My day' },
    steps: [
      { kind: 'hanzi', chars: '天早点上午' },
      {
        kind: 'words',
        words: ['天', '早上', '点', '起床', '牛奶', '面包', '学校', '上午', '中午', '下午', '晚上', '同学', '一起', '商店',
          '买', '东西', '看', '电视', '睡觉', '一点儿'],
      },
      { kind: 'grammar', point: 'ordre' },
      { kind: 'grammar', point: 'le' },
      { kind: 'grammar', point: 'mei' },
      { kind: 'grammar', point: 'tai-le' },
      { kind: 'reading', reading: 'yitian' },
    ],
  },
]

const WORD_IDS = new Map(getWordsForLevel(1).map(word => [word.simplified, word.id]))
const missing = item => {
  throw new Error(`Parcours (src/data/path.js) : « ${item} » n'est pas dans le HSK 1`)
}

/** Mots → ids du HSK 1 (wordIds), caractères → fiches (data/hanzi.js) ; id d'étape : <unité>-<rang>. */
function resolve(step) {
  if (step.kind === 'words') return { ...step, wordIds: step.words.map(word => WORD_IDS.get(word) ?? missing(word)) }
  if (step.kind === 'hanzi') {
    return { ...step, chars: [...step.chars].map(c => (getChar(c)?.level === 1 ? getChar(c) : missing(c))) }
  }
  return step
}

export const PATH = UNITS.map(unit => ({
  ...unit,
  plus: Boolean(unit.plus),
  steps: unit.steps.map((step, index) => ({ ...resolve(step), id: `${unit.id}-${index + 1}` })),
}))

/** Caractères des unités gratuites : ceux de la formule gratuite (access/rules.js). */
export const FREE_PATH_CHARS = new Set(PATH.filter(unit => !unit.plus)
  .flatMap(unit => unit.steps.filter(step => step.kind === 'hanzi').flatMap(step => step.chars.map(ch => ch.c))))
