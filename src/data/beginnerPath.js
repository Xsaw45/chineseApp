import { READINGS } from './reading.js'

const jieshao = READINGS.find(reading => reading.id === 'jieshao')
const fanguan = READINGS.find(reading => reading.id === 'fanguan')

// Choice answers are indices into the visible options; passage questions use the catalog's answer and evidence line.
const comprehension = (reading, index, order) => {
  const { q, a, line } = reading.questions[index]
  return { prompt: q, options: order.map(i => a[i]), answer: order.indexOf(0), line }
}

export const BEGINNER_SESSIONS = [
  {
    title: { fr: 'Se présenter', en: 'Introduce yourself' },
    goal: { fr: 'Écouter les tons et reconnaître le prénom de David.', en: 'Hear the tones and recognize David’s name.' },
    chars: '你好我叫名',
    reading: jieshao,
    lines: [0, 1],
    note: { fr: '你好 veut dire « bonjour ». 我叫… veut dire « je m’appelle… » ; le prénom vient juste après.', en: '你好 means “hello.” 我叫… means “my name is…”; the name comes right after it.' },
    questions: [
      {
        prompt: { fr: 'Dans 我叫大卫, quel est le prénom ?', en: 'In 我叫大卫, what is the person’s name?' },
        options: ['王明 · Wáng Míng', '大卫 · Dàwèi', '你好 · Nǐ hǎo'],
        answer: 1,
        line: 1,
      },
    ],
  },
  {
    title: { fr: 'Répondre par oui ou non', en: 'Answer yes-or-no questions' },
    goal: { fr: 'Poser une question avec 吗 et répondre avec 是 ou 不是.', en: 'Ask a question with 吗 and answer with 是 or 不是.' },
    chars: '是不吗学生',
    reading: jieshao,
    lines: [5, 6],
    note: { fr: '是 veut dire « être », 不是 « ne pas être ». Ajoute 吗 en fin de phrase pour poser une question oui/non. Tu peux répondre 是 ou 不是.', en: '是 means “to be”; 不是 means “not to be.” Add 吗 at the end of a statement to ask a yes-or-no question. You can answer 是 or 不是.' },
    questions: [
      {
        prompt: { fr: 'Remets dans l’ordre : « Tu es étudiant ? »', en: 'Put the words in order: “Are you a student?”' },
        tokens: ['学生', '吗', '你', '是'],
        order: [2, 3, 0, 1],
        line: 5,
      },
      {
        prompt: { fr: 'La réponse commence par 不是. Wang Ming est-il étudiant ?', en: 'The answer starts with 不是. Is Wang Ming a student?' },
        options: [{ fr: 'Oui', en: 'Yes' }, { fr: 'Non', en: 'No' }],
        answer: 1,
        line: 6,
      },
    ],
  },
  {
    title: { fr: 'Parler de son origine', en: 'Say where you’re from' },
    goal: { fr: 'Comprendre d’où viennent David et Wang Ming et ce qu’ils font.', en: 'Understand where David and Wang Ming are from and what they do.' },
    chars: '哪国人老师',
    reading: jieshao,
    note: { fr: '哪国人 demande de quel pays vient quelqu’un. 法国人 veut dire « français » ; 中国人 veut dire « chinois ». 你呢？ renvoie la question : « Et toi ? »', en: '哪国人 asks which country someone is from. 法国人 means “French”; 中国人 means “Chinese.” 你呢？ turns the question back: “And you?”' },
    questions: [
      comprehension(jieshao, 0, [1, 2, 0, 3]),
      {
        prompt: { fr: 'De quelle ville vient Wang Ming ?', en: 'Which city is Wang Ming from?' },
        options: [{ fr: 'Pékin', en: 'Beijing' }, 'Shanghai', 'Paris'],
        answer: 0,
        line: 4,
      },
      comprehension(jieshao, 1, [1, 0, 3, 2]),
      comprehension(jieshao, 2, [2, 3, 0, 1]),
    ],
  },
  {
    title: { fr: 'Commander à manger', en: 'Order food' },
    goal: { fr: 'Reconnaître le riz et les œufs et dire ce que tu veux manger.', en: 'Recognize rice and eggs and say what you want to eat.' },
    chars: '想吃米饭蛋',
    reading: fanguan,
    lines: [0, 1],
    note: { fr: '我想吃… veut dire « je voudrais manger… ». 米饭, c’est le riz cuit, 鸡蛋 les œufs, et 和 veut dire « et ».', en: '我想吃… means “I’d like to eat…” 米饭 is cooked rice, 鸡蛋 means eggs, and 和 means “and.”' },
    questions: [
      comprehension(fanguan, 0, [2, 0, 1, 3]),
      {
        prompt: { fr: 'Remets dans l’ordre : « Je voudrais manger du riz et des œufs. »', en: 'Put the words in order: “I’d like to eat rice and eggs.”' },
        tokens: ['米饭和鸡蛋', '吃', '我', '想'],
        order: [2, 3, 1, 0],
        line: 1,
      },
    ],
  },
  {
    title: { fr: 'Commander à boire et demander le prix', en: 'Order a drink and ask the price' },
    goal: { fr: 'Demander s’il y a du thé, commander une tasse et comprendre le prix.', en: 'Ask if there’s tea, order one cup and understand the price.' },
    chars: '有茶一杯钱',
    reading: fanguan,
    note: { fr: '有 veut dire « avoir » ou « il y a ». 有茶吗？ demande s’il y a du thé. 一杯 veut dire « une tasse » et 多少钱？ demande le prix.', en: '有 means “to have” or “there is.” 有茶吗？ asks if there’s tea. 一杯 means “one cup,” and 多少钱？ asks the price.' },
    questions: [
      comprehension(fanguan, 0, [1, 2, 3, 0]),
      {
        prompt: { fr: 'Remets dans l’ordre : « Vous avez du thé ? »', en: 'Put the words in order: “Do you have tea?”' },
        tokens: ['茶', '吗', '有'],
        order: [2, 0, 1],
        line: 3,
      },
      comprehension(fanguan, 1, [2, 1, 0, 3]),
      {
        prompt: { fr: 'Combien de tasses Ma Li commande-t-elle ?', en: 'How many cups does Ma Li order?' },
        options: [{ fr: 'Une', en: 'One' }, { fr: 'Deux', en: 'Two' }, { fr: 'Trois', en: 'Three' }],
        answer: 0,
        line: 5,
      },
      comprehension(fanguan, 2, [1, 0, 2, 3]),
    ],
  },
]
