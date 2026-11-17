// Parcours Projets (captures de chaque vue). Usage : node scripts/flow-projects.mjs <dossier> [largeur] [clair|sombre]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/macboockpro/Downloads/MANAGER-IA/video-brij-ia-problemes/node_modules/');
const puppeteer = require('puppeteer-core');
const [out, w = '1280', theme = 'clair'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage();
const mobile = Number(w) < 768;
await p.setViewport({ width: Number(w), height: mobile ? 800 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.evaluateOnNewDocument((th) => { localStorage.setItem('mi_prefs_v1', JSON.stringify({ theme: th === 'sombre' ? 'dark' : 'light' })); localStorage.setItem('brij-guide-seen', 'true'); }, theme);
await p.goto((process.env.BASE || 'http://localhost:5184') + '/connexion', { waitUntil: 'networkidle0' });
if (await p.$('#contact')) { await p.type('#contact', 'proprietaire@exemple.com'); await p.type('#pass', 'Essai-2026-brij'); await Promise.all([p.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 20000 }).catch(() => {}), p.click('#go')]); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1000);
await wait(300); await p.evaluate(() => { const b = [...document.querySelectorAll('#cookie-banner button')].find((x) => /refuser/i.test(x.textContent)); if (b) b.click(); });
await p.goto((process.env.BASE || 'http://localhost:5184') + '/app/1/projects', { waitUntil: 'networkidle0' }); await wait(2500);
await p.screenshot({ path: `${out}/projets-liste-${w}-${theme}.png`, fullPage: true });
await p.evaluate(() => { const b = [...document.querySelectorAll('#cookie-banner button')].find((x) => /refuser/i.test(x.textContent)); if (b) b.click(); });
await p.click('button.pcard'); await wait(2500);
for (const [id, name] of [['dash', 'tableau'], ['gantt', 'gantt'], ['kanban', 'kanban'], ['calendar', 'calendrier'], ['list', 'liste'], ['follow', 'suivi'], ['plan', 'planification'], ['pilot', 'pilotage'], ['risks', 'risques']]) {
  await p.click(`#tab-${id}`); await wait(id === 'dash' || id === 'gantt' ? 2500 : 1200);
  await p.screenshot({ path: `${out}/projet-${name}-${w}-${theme}.png`, fullPage: true });
}
const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('débordement', over, 'erreurs', JSON.stringify(errs.slice(0, 5)));
await b.close();
