// Lecture : textes et dialogues (content/readings.js ; les textes payants sont servis par le serveur, voir
// src/content/plus.js), glossaire et fonctions d'affichage.

export { READING_ITEMS as READINGS } from '../content/plus.js'
export { lineText, lineVoice, lineWords } from './readingLines.js'

export const GLOSSARY = {
  王明: { pinyin: 'Wáng Míng', tr: { fr: 'Wang Ming (prénom et nom)', en: 'Wang Ming (name)' } },
  大卫: { pinyin: 'Dàwèi', tr: { fr: 'David', en: 'David' } },
  马丽: { pinyin: 'Mǎ Lì', tr: { fr: 'Ma Li (prénom et nom)', en: 'Ma Li (name)' } },
  小王: { pinyin: 'Xiǎo Wáng', tr: { fr: 'Xiao Wang (« petit Wang », entre amis)', en: 'Xiao Wang ("little Wang", between friends)' } },
  小白: { pinyin: 'Xiǎobái', tr: { fr: 'Xiaobai (nom du chat, « petit blanc »)', en: 'Xiaobai (the cat\'s name, "little white")' } },
  你好: { pinyin: 'nǐ hǎo', tr: { fr: 'bonjour', en: 'hello' } },
  好的: { pinyin: 'hǎo de', tr: { fr: 'd\'accord, très bien', en: 'OK, all right' } },
  法国: { pinyin: 'Fǎguó', tr: { fr: 'France', en: 'France' } },
  上海: { pinyin: 'Shànghǎi', tr: { fr: 'Shanghai', en: 'Shanghai' } },
  火车站: { pinyin: 'huǒchēzhàn', tr: { fr: 'gare', en: 'train station' } },
  每天: { pinyin: 'měitiān', tr: { fr: 'tous les jours', en: 'every day' } },
  星期六: { pinyin: 'xīngqīliù', tr: { fr: 'samedi', en: 'Saturday' } },
  聊天: { pinyin: 'liáotiān', tr: { fr: 'bavarder, discuter', en: 'to chat' } },
  羊肉: { pinyin: 'yángròu', tr: { fr: 'viande de mouton, d\'agneau', en: 'mutton, lamb' } },
  烤鸭: { pinyin: 'kǎoyā', tr: { fr: 'canard laqué', en: 'roast duck' } },
  拍: { pinyin: 'pāi', tr: { fr: 'taper ; prendre (une photo)', en: 'to pat; to take (a photo)' } },
  厨房: { pinyin: 'chúfáng', tr: { fr: 'cuisine', en: 'kitchen' } },
  水电费: { pinyin: 'shuǐdiànfèi', tr: { fr: 'frais d’eau et d’électricité', en: 'water and electricity charges' } },
  签: { pinyin: 'qiān', tr: { fr: 'signer', en: 'to sign' } },
  刮: { pinyin: 'guā', tr: { fr: 'souffler (pour le vent)', en: 'to blow (of wind)' } },
  饮食: { pinyin: 'yǐnshí', tr: { fr: 'alimentation', en: 'diet' } },
  蔬菜: { pinyin: 'shūcài', tr: { fr: 'légumes', en: 'vegetables' } },
  瘦: { pinyin: 'shòu', tr: { fr: 'maigrir ; mince', en: 'to lose weight; thin' } },
}
