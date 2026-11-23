// npm run build, puis node scripts/acquisition-clips.mjs <dossier de sortie> (Chromium Playwright et FFmpeg).
// Les images sont des captures de la vraie démo, pas des écrans reconstitués.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { buildApp } from '../server/app.js'
import { READINGS } from '../content/readings.js'
import { lineText, lineVoice } from '../src/data/readingLines.js'
import { ttsFile } from '../src/data/voices.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(process.argv[2] || '../videos/yidiano-acquisition')
const tmp = mkdtempSync(join(tmpdir(), 'yidiano-clips-'))
const fonts = [process.env.YIDIANO_CLIP_FONT, join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'arial.ttf'), '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf']
const app = buildApp({ dbPath: ':memory:', publicDir: join(root, 'dist'), publicUrl: 'http://127.0.0.1', logger: false })
let browser

function ffmpeg(...args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: tmp, stdio: 'inherit' })
}

function render(name, frames, credit) {
  const segments = []
  for (const [index, [path, title, subtitle, audio, duration]] of frames.entries()) {
    const base = `${name}-${index}`
    copyFileSync(path, join(tmp, `${base}.png`))
    for (const [key, text] of Object.entries({ title, subtitle, credit })) writeFileSync(join(tmp, `${key}.txt`), text)
    const text = (key, size, y, color) => `drawtext=fontfile=clip.ttf:textfile=${key}.txt:fontsize=${size}:fontcolor=${color}:x=(w-tw)/2:y=${y}`
    const filter = ['scale=624:480:force_original_aspect_ratio=decrease', 'pad=720:1280:(ow-iw)/2:300:color=0xfff9ef',
      text('title', 44, 155, '0x22201c'), text('subtitle', 29, 795, '0x9e221f'), text('credit', 22, 856, '0x574e45'), 'format=yuv420p'].join(',')
    const input = audio ? ['-i', audio, '-af', 'adelay=250:all=1,apad'] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=44100']
    ffmpeg('-loop', '1', '-framerate', '30', '-i', `${base}.png`, ...input, '-vf', filter, '-t', String(duration),
      '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-c:a', 'aac', '-ar', '44100', '-ac', '1', `${base}.mp4`)
    segments.push(`file '${base}.mp4'`)
  }
  writeFileSync(join(tmp, 'segments.txt'), segments.join('\n'))
  ffmpeg('-f', 'concat', '-safe', '0', '-i', 'segments.txt', '-c', 'copy', '-movflags', '+faststart', join(out, `${name}.mp4`))
}

// L'empreinte de l'écriture est capturée après des événements pointeur que Hanzi Writer a validés.
async function drawStroke(page, stroke, group) {
  const [first, ...rest] = await group.evaluate((node, points) => {
    const transform = node.getScreenCTM()
    return points.map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(transform)
      return [point.x, point.y]
    })
  }, stroke)
  await page.mouse.move(...first)
  await page.mouse.down()
  for (const point of rest) await page.mouse.move(...point, { steps: 5 })
  await page.mouse.up()
}

try {
  const font = fonts.find(path => path && existsSync(path))
  if (!font) throw new Error('Indique une police TTF avec YIDIANO_CLIP_FONT.')
  copyFileSync(font, join(tmp, 'clip.ttf'))
  mkdirSync(out, { recursive: true })
  const origin = await app.listen({ host: '127.0.0.1', port: 0 })
  browser = await chromium.launch()
  const page = await browser.newPage({ baseURL: origin, viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' })
  const shot = async (locator, name) => {
    const path = join(tmp, `${name}.png`)
    await locator.screenshot({ path, animations: 'disabled' })
    return path
  }
  // Les plans sont figés au moment de chaque action ; pas de manipulation de l'état de l'app.
  await page.goto('/demo/')
  await page.getByRole('button', { name: 'Refuser', exact: true }).click()
  const mystery = page.locator('[data-tone-question]')
  await mystery.click()
  await page.locator('[data-tone-answer="2"]:enabled').waitFor()
  const tone = page.locator('.tone-quiz')
  const toneQuestion = await shot(tone, 'tone-question')
  await page.locator('[data-tone-answer="2"]').click()
  await page.locator('[data-tone-feedback][data-success]').waitFor()
  const toneAnswer = await shot(tone, 'tone-answer')
  await page.locator('[data-go-trace]').click()
  const board = page.locator('[data-trace-board]')
  await page.locator('[data-trace-guide]:enabled').waitFor()
  const group = board.locator('svg > g').first()
  const { medians } = JSON.parse(readFileSync(join(root, 'public/hanzi/人.json'), 'utf8'))
  const traceStart = await shot(board, 'trace-start')
  await drawStroke(page, medians[0], group)
  await page.locator('[data-trace-feedback]').filter({ hasText: 'Premier trait réussi' }).waitFor()
  const traceHalf = await shot(board, 'trace-half')
  await drawStroke(page, medians[1], group)
  await page.locator('[data-trace-feedback][data-success]').waitFor()
  // Le rappel signale la réussite avant la fin de la coloration des deux traits.
  await page.waitForTimeout(650)
  const traceDone = await shot(board, 'trace-done')

  await page.goto('/dialogue-chinois/')
  const second = page.locator('[data-dialogue-lines] > li').nth(1)
  await second.locator('[data-dialogue-play]').click()
  const dialogueBefore = await shot(second, 'dialogue-before')
  await page.locator('[data-dialogue-toggle="translation"]').click()
  await second.locator('[data-translation]:visible').waitFor()
  const dialogueAfter = await shot(second, 'dialogue-after')

  const line = READINGS.find(reading => reading.id === 'jieshao')
  const audioDir = join(root, 'public/audio')
  const dialogueAudio = join(audioDir, 'tts', ttsFile(lineText(line.lines[1]), lineVoice(line, line.lines[1])))
  const toneAudio = join(audioDir, 'syllables/ma2.mp3')
  render('01-ton-mystere', [
    [toneQuestion, 'Quel ton entends-tu ?', 'Écoute et choisis', toneAudio, 4],
    [toneAnswer, 'C’était le ton montant !', 'Joue sur yidiano.com/demo/', toneAudio, 4],
  ], 'Voix : Chen Wang · audio-cmn · CC BY-SA')
  render('02-tracer-ren', [
    [traceStart, 'Deux traits, un caractère', 'Suis le modèle', null, 2.5],
    [traceHalf, 'D’abord vers la gauche', 'Puis vers la droite', null, 2.5],
    [traceDone, 'À toi de tracer !', 'Joue sur yidiano.com/demo/', null, 3],
  ], 'Tracés : Make Me a Hanzi · Arphic')
  render('03-premier-dialogue', [
    [dialogueBefore, 'Que vient-il de dire ?', 'Écoute sans la traduction', dialogueAudio, 4],
    [dialogueAfter, '« Je m’appelle David »', 'Écoute sur yidiano.com/dialogue-chinois/', null, 4],
  ], 'Yidiano · Le chinois, un peu chaque jour')
  console.log(out)
} finally {
  await browser?.close()
  await app.close()
  rmSync(tmp, { recursive: true, force: true })
}
