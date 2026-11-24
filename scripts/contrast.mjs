// Contrôle de contraste (WCAG AA) des textes visibles. Usage : node scripts/contrast.mjs <module[,module…]> [clair|sombre] [largeur]
import { createRequire } from 'node:module';
const require = createRequire('/Users/macboockpro/Downloads/MANAGER-IA/video-brij-ia-problemes/node_modules/');
const puppeteer = require('puppeteer-core');
const [mods = 'dashboard', theme = 'clair', w = '1280'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: Number(w), height: 900 });
await p.evaluateOnNewDocument((th) => { localStorage.setItem('mi_prefs_v1', JSON.stringify({ theme: th === 'sombre' ? 'dark' : 'light' })); localStorage.setItem('mabah-guide-seen', 'true'); }, theme);
await p.goto((process.env.BASE || 'http://localhost:5184') + '/connexion', { waitUntil: 'networkidle0' });
if (await p.$('#contact')) { await p.type('#contact', 'proprietaire@exemple.com'); await p.type('#pass', 'Essai-2026-brij'); await Promise.all([p.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 20000 }).catch(() => {}), p.click('#go')]); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const mod of mods.split(',')) {
  await p.goto(`${process.env.BASE || 'http://localhost:5184'}/app/1/${mod}`, { waitUntil: 'networkidle0' }); await wait(2500);
  const bad = await p.evaluate(() => {
    const parse = (c) => { const m = c.match(/-?[\d.]+(?:e-?\d+)?/g).map(Number); if (c.startsWith('color(')) return { r: m[0] * 255, g: m[1] * 255, b: m[2] * 255, a: m[3] === undefined ? 1 : m[3] }; return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) chain.push(c); if (c.a === 1) break; } let bg = { r: 255, g: 255, b: 255, a: 1 }; if (getComputedStyle(document.documentElement).colorScheme === 'dark') bg = { r: 10, g: 16, b: 30, a: 1 }; for (const c of chain.reverse()) bg = over(c, bg); return bg; };
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || el.closest('.sr-only,[hidden],svg,script,style')) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
      let fg = parse(cs.color); const bg = bgOf(el); fg = over(fg, bg);
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} ${el.tagName}.${(el.className || '').toString().split(' ')[0]} "${n.textContent.trim().slice(0, 30)}"`);
    }
    return [...new Set(out)].slice(0, 25);
  });
  console.log(`${mod} ${theme} ${w}px : ${bad.length} contraste(s) insuffisant(s)`); bad.forEach((x) => console.log('  ' + x));
}
await b.close();
