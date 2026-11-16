// Captures des pages publiques (accueil, connexion). Usage : node scripts/shot-public.mjs <dossier> <largeur> [clair|sombre]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/macboockpro/Downloads/MANAGER-IA/video-brij-ia-problemes/node_modules/');
const puppeteer = require('puppeteer-core');
const [out, w = '1280', theme = 'clair'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); const mobile = Number(w) < 768;
await p.setViewport({ width: Number(w), height: 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
await p.evaluateOnNewDocument((th) => { localStorage.setItem('mi_prefs_v1', JSON.stringify({ theme: th === 'sombre' ? 'dark' : 'light' })); }, theme);
for (const [name, path] of [['accueil', '/'], ['connexion', '/connexion']]) {
  await p.goto('http://localhost:5184' + path, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.screenshot({ path: `${out}/${name}-${w}-${theme}.png` });
  console.log(name, w, theme, 'débordement', over);
}
await b.close();
