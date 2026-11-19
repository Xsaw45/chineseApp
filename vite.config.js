import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { splitContent } from './content/split.js'

// Grammaire et lectures (content/) : seul le contenu gratuit et le résumé des éléments Yidiano+ entrent dans l'app
// (module virtual:yidiano-content, lu par src/content/plus.js). Après une modification de content/, relancer le
// serveur de développement.
function yidianoContent() {
  const id = 'virtual:yidiano-content'
  return {
    name: 'yidiano-content',
    resolveId: source => (source === id ? `\0${id}` : null),
    load(resolved) {
      if (resolved !== `\0${id}`) return null
      const { version, client } = splitContent()
      return `export const PLUS_VERSION = ${JSON.stringify(version)}\nexport const CLIENT_CONTENT = ${JSON.stringify(client)}\n`
    },
  }
}

// App servie a la racine de yidiano.com par server/ ; le manifeste PWA est genere ici.
// landing.html : page de presentation servie a la place de l'app aux visiteurs sans session (server/app.js).
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
        legalNotices: fileURLToPath(new URL('./legal/mentions-legales.html', import.meta.url)),
        legalTerms: fileURLToPath(new URL('./legal/conditions.html', import.meta.url)),
        legalPrivacy: fileURLToPath(new URL('./legal/confidentialite.html', import.meta.url)),
        legalRefunds: fileURLToPath(new URL('./legal/remboursement.html', import.meta.url)),
      },
    },
  },
  plugins: [
    yidianoContent(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Yidiano',
        short_name: 'Yidiano',
        lang: 'fr',
        description: 'Le chinois, un peu chaque jour : pinyin, vocabulaire HSK, caractères, grammaire, lecture',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#141415',
        theme_color: '#141415',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La page (index.html) n'est pas pre-cachee : reseau d'abord, donc chaque ouverture charge la derniere
        // version deployee ; le cache ne sert que hors ligne. Les assets ont un nom hashe, ils restent pre-caches.
        // Police : seuls les sous-ensembles latins (français + pinyin) sont utiles, les autres ne sont jamais chargés.
        globPatterns: ['**/*.{js,css,ico,png,svg,json}', '**/*latin*.woff2'],
        globIgnores: ['hanzi/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: null,
        importScripts: ['sw-reload.js'],
        runtimeCaching: [{
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: { cacheName: 'zh-pages', networkTimeoutSeconds: 4 },
        }, {
          // Enregistrements (36 Mo au total) : gardés une fois écoutés, pas téléchargés d'avance.
          urlPattern: ({ url }) => url.pathname.startsWith('/audio/'),
          handler: 'CacheFirst',
          options: { cacheName: 'zh-audio', expiration: { maxEntries: 5000 } },
        }, {
          // Tracés des caractères (3 000 fichiers, 8 Mo) : gardés une fois ouverts, comme les enregistrements.
          urlPattern: ({ url }) => url.pathname.startsWith('/hanzi/'),
          handler: 'CacheFirst',
          options: { cacheName: 'zh-hanzi', expiration: { maxEntries: 5000 } },
        }],
      }
    })
  ],
})
