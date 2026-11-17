// Captures d'écran de l'espace de travail (puppeteer-core). Usage :
//   node scripts/shots.mjs <dossier> <largeur[,largeur…]> <module[,module…]> [clair|sombre] [--land]
// Se connecte au serveur de démonstration (compte d'essai), vérifie débordement horizontal, cibles tactiles < 44 px, contrastes.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/macboockpro/Downloads/MANAGER-IA/video-brij-ia-problemes/node_modules/');
const puppeteer = require('puppeteer-core');
const [out, widths = '1280', mods = 'dashboard', theme = 'clair', ...flags] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:5184';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const report = [];
for (const w of widths.split(',').map(Number)) {
  const land = flags.includes('--land');
  const page = await browser.newPage();
  const mobile = w < 768;
  await page.setViewport({ width: land ? 812 : w, height: land ? 375 : (mobile ? 800 : 900), deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await page.evaluateOnNewDocument((th) => { try { localStorage.setItem('mi_prefs_v1', JSON.stringify({ theme: th === 'sombre' ? 'dark' : 'light' })); localStorage.setItem('brij-guide-seen', 'true'); } catch (e) { /* */ } }, theme);
  await page.goto(BASE + '/connexion', { waitUntil: 'networkidle0' });
  if (await page.$('#contact')) { await page.type('#contact', 'proprietaire@exemple.com');
  await page.type('#pass', 'Essai-2026-brij');
  await Promise.all([page.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 20000 }).catch(() => {}), page.click('#go')]); }
  await new Promise((r) => setTimeout(r, 1200));
  const m = page.url().match(/\/app\/(\d+)/); const org = m ? m[1] : '1';
  for (const mod of mods.split(',')) {
    await page.goto(`${BASE}/app/${org}/${mod}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1400));
    const res = await page.evaluate(() => {
      const de = document.documentElement; const over = de.scrollWidth - de.clientWidth;
      const mobile = innerWidth < 1024; const small = [...document.querySelectorAll('button,a,input,select,[role=button],[role=tab]')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && (mobile ? (r.height < 43.5 || r.width < 43.5) : false) && e.type !== 'checkbox' && e.type !== 'radio' && !e.closest('.sr-only') && e.type !== 'hidden'; }).map((e) => (e.tagName + '.' + (e.className || '').toString().split(' ')[0] + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) + '"'));
      return { over, small: small.slice(0, 12), smallCount: small.length };
    });
    const file = `${out}/${mod}-${w}${land ? 'L' : ''}-${theme}.png`;
    await page.screenshot({ path: file, fullPage: flags.includes('--full') });
    report.push(`${mod} ${w}${land ? 'L' : ''} ${theme}: débordement ${res.over}px ; cibles <44px : ${res.smallCount}${res.smallCount ? ' ' + JSON.stringify(res.small.slice(0, 5)) : ''}`);
  }
  await page.close();
}
console.log(report.join('\n'));
await browser.close();
