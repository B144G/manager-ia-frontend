// Captures d'écran de l'application pour la page de présentation (données d'exemple uniquement).
// Prérequis : serveur de démonstration (node scripts/demo-local.js, PORT=3123) et le site (DEV_API_TARGET=http://127.0.0.1:3123 npx vite --port 5193 --strictPort).
// Usage : PUPPETEER=<dossier node_modules de puppeteer-core> CHROME=<chemin de Chrome> node scripts/vitrine-captures.mjs <dossier de sortie>
// Les PNG obtenus sont ensuite convertis en WebP (voir docs/vitrine/README.md).
import { createRequire } from 'node:module';
const require = createRequire((process.env.PUPPETEER || '/Users/macboockpro/Downloads/MANAGER-IA/video-brij-ia-problemes/node_modules') + '/');
const puppeteer = require('puppeteer-core');
const OUT = process.argv[2] || 'captures';
const BASE = process.env.BASE || 'http://localhost:5193';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// [identifiant du module, onglet à ouvrir (texte du bouton) ou '']
const SHOTS = [['crm', 'Factures'], ['stock', ''], ['accounting', ''], ['payroll', ''], ['budget', ''], ['hr', ''], ['logistics', ''], ['legal', ''], ['projects', ''], ['sales', ''], ['production', ''], ['construction', '']];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean); // ex. ONLY=production,construction
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function clean(p) {
  await p.evaluate(() => {
    document.querySelectorAll('button').forEach((b) => { if (/^C.est noté$/.test(b.textContent.trim())) b.click(); });
    document.querySelectorAll('button').forEach((b) => { if (/^(Plus tard|Fermer|Passer)$/.test(b.textContent.trim()) && b.closest('[role=dialog],[class*=tour],[class*=toast],[class*=install],[class*=guide],[class*=notice]')) b.click(); });
    document.querySelectorAll('body *').forEach((e) => { const s = getComputedStyle(e); if (s.position === 'fixed' && !e.querySelector('nav') && e.offsetWidth < 520 && e.offsetHeight < 260 && e.getBoundingClientRect().top > innerHeight * 0.4) e.style.display = 'none'; });
  });
}
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
// Pas de bandeau de cookies, de guide ni de rappel de sécurité sur les captures (choix « refuser » déjà enregistré).
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('mabah-cookies', JSON.stringify({ v: '2026-11-16', at: new Date().toISOString(), analytics: false })); localStorage.setItem('mabah-guide-seen', 'true'); localStorage.setItem('mabah-guide-done', 'true'); sessionStorage.setItem('mabah-2fa-nudge', '1'); } catch (e) { /* ignoré */ } });
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto(BASE + '/connexion?stay=1', { waitUntil: 'networkidle0' });
await p.evaluate(() => fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contact: 'proprietaire@exemple.com', pass: 'Essai-2026-brij' }) }));
await p.goto(BASE + '/app', { waitUntil: 'networkidle0' }); await wait(1200);
const org = p.url().split('/app/')[1].split('/')[0];
for (const [m, tab] of SHOTS) {
  if (ONLY.length && !ONLY.includes(m)) continue;
  await p.goto(`${BASE}/app/${org}/${m}`, { waitUntil: 'networkidle0' }); await wait(1500);
  if (tab) { await p.evaluate((t) => { [...document.querySelectorAll('[role=tab],button')].find((x) => x.textContent.trim() === t)?.click(); }, tab); await wait(900); }
  await clean(p); await wait(400);
  await p.screenshot({ path: `${OUT}/${m}.png` }); console.log('ok', m);
}
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const m of ONLY.length ? [] : ['crm', 'stock']) { await p.goto(`${BASE}/app/${org}/${m}`, { waitUntil: 'networkidle0' }); await wait(1500); await clean(p); await wait(300); await p.screenshot({ path: `${OUT}/m-${m}.png` }); console.log('ok mobile', m); }
await b.close();
