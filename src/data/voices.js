// Voix de synthèse (Google Cloud Text-to-Speech, Chirp 3 HD) : scripts/fetch-tts-audio.js enregistre une fois les
// phrases et les mots sans enregistrement humain, l'app lit les fichiers. Sans import : le script Node l'utilise aussi.
// Une voix par personnage des dialogues (data/reading.js : speakers[].voice, voice des textes) ; 'f' ailleurs.

export const VOICES = {
  f: 'cmn-CN-Chirp3-HD-Aoede',
  f2: 'cmn-CN-Chirp3-HD-Kore',
  m: 'cmn-CN-Chirp3-HD-Charon',
  m2: 'cmn-CN-Chirp3-HD-Puck',
}
export const DEFAULT_VOICE = 'f'

function fnv1a(text) {
  let hash = 0x811c9dc5
  for (const ch of text) {
    hash ^= ch.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Nom du fichier d'un texte dit par une voix : empreinte FNV-1a du texte (les phrases ont de la ponctuation). */
export const ttsFile = (text, voice) => `${voice}-${fnv1a(`${voice}|${text}`)}.mp3`

/**
 * Clé d'un texte dans src/data/ttsAudio.json : une empreinte (64 bits), pas le texte, pour que les phrases du contenu
 * Yidiano+ ne soient pas lisibles dans le code de l'app.
 */
export const ttsKey = text => fnv1a(text) + fnv1a(`k|${text}`)
