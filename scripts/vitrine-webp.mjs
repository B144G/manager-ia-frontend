// Convertit les captures PNG de scripts/vitrine-captures.mjs en WebP pour la page de présentation (via Google Chrome : aucun outil à installer).
// Usage : node scripts/vitrine-webp.mjs <dossier des PNG> [dossier de sortie = public/vitrine]
// Produit app-<module>-1280|720|480.webp (16:10) et mobile-<module>.webp (240 px de large) ; mêmes noms et mêmes tailles que les fichiers d'origine.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PUPPETEER || '/Users/macboockpro/Downloads/MANAGER-IA/video-brij-ia-problemes/node_modules') + '/');
const puppeteer = require('puppeteer-core');
const IN = process.argv[2]; const OUT = process.argv[3] || 'public/vitrine';
if (!IN) { console.error('Usage : node scripts/vitrine-webp.mjs <dossier des PNG> [sortie]'); process.exit(2); }
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('about:blank');
const conv = (buf, w, h, q) => p.evaluate(async (b64, W, H, Q) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', Q));
  const ab = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < ab.length; i += 0x8000) s += String.fromCharCode.apply(null, ab.subarray(i, i + 0x8000)); return btoa(s);
}, buf.toString('base64'), w, h, q);
let n = 0;
for (const f of fs.readdirSync(IN).filter((x) => x.endsWith('.png'))) {
  const buf = fs.readFileSync(path.join(IN, f)); const id = f.replace(/\.png$/, '');
  const sizes = id.startsWith('m-') ? [[`mobile-${id.slice(2)}.webp`, 240, 519]] : [[`app-${id}-1280.webp`, 1280, 800], [`app-${id}-720.webp`, 720, 450], [`app-${id}-480.webp`, 480, 300]];
  for (const [name, w, h] of sizes) { fs.writeFileSync(path.join(OUT, name), Buffer.from(await conv(buf, w, h, 0.82), 'base64')); n++; }
}
await b.close();
console.log(`${n} fichiers WebP écrits dans ${OUT}`);
