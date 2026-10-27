import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import miaFallbacks from './tools/postcss-fallbacks.js';

// Navigateurs visés : Chrome / Edge / Firefox / Safari des 3-4 dernières années, iOS 13+, Android 7+ (Chrome 51+ en théorie, WebView mis à jour en pratique).
// Le JavaScript est abaissé à ES2019 (optional chaining, ??, etc. sont transformés, y compris dans les dépendances) ; le CSS reçoit des replis (voir tools/postcss-fallbacks.js).
const TARGETS = ['es2019', 'chrome64', 'edge88', 'firefox78', 'safari13', 'ios13'];

// Adresse publique du site : UNE seule source. Variable SITE_URL (ou VITE_SITE_URL) à la construction ; sinon la valeur par défaut ci-dessous.
// Elle remplace %SITE_URL% dans index.html (canonical, og, JSON-LD) et dans seo/sitemap.xml et seo/robots.txt (publiés à la racine du site).
const DEFAULT_SITE_URL = 'https://manager-ia-frontend.vercel.app';
function siteUrlPlugin(raw) {
  const url = String(raw || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  const fill = (s) => s.replace(/%SITE_URL%/g, url);
  return {
    name: 'brij-site-url',
    transformIndexHtml: { order: 'pre', handler: fill },
    generateBundle() {
      for (const f of ['sitemap.xml', 'robots.txt']) this.emitFile({ type: 'asset', fileName: f, source: fill(fs.readFileSync(new URL('./seo/' + f, import.meta.url), 'utf8')) });
    },
  };
}

// En développement, les appels /api et /webhooks sont renvoyés vers le serveur (par défaut http://localhost:3000) :
// le navigateur croit parler à un seul site, les cookies de connexion fonctionnent sans réglage particulier.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEV_API_TARGET || 'http://localhost:3000';
  return {
    plugins: [react(), siteUrlPlugin(env.SITE_URL || env.VITE_SITE_URL || process.env.SITE_URL)],
    css: { postcss: { plugins: [miaFallbacks()] } },
    server: { port: 5173, proxy: { '/api': { target, changeOrigin: false }, '/webhooks': { target, changeOrigin: false } } },
    preview: { port: 5173, proxy: { '/api': { target, changeOrigin: false } } },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 700, target: TARGETS, cssTarget: ['chrome64', 'edge88', 'firefox78', 'safari13', 'ios13'] },
    esbuild: { target: 'es2019' },
  };
});
