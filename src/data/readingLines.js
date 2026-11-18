// Lignes d'un texte de lecture (content/readings.js) ; sans dépendance, pour l'app et les scripts.

/** Mots d'une ligne (ponctuation comprise) et la ligne telle qu'elle s'affiche. */
export const lineWords = line => line.zh.split(' ')
export const lineText = line => line.zh.replaceAll(' ', '')
/** Voix d'une ligne : celle du personnage qui parle, sinon celle du narrateur. */
export const lineVoice = (reading, line) => (line.s ? reading.speakers[line.s].voice : reading.voice)
