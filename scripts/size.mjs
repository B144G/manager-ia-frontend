// Taille du site construit : premier chargement (index + CSS) et total, en Ko gzip. Usage : node scripts/size.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const d = 'dist/assets'; let tot = 0, first = 0; const rows = [];
for (const f of readdirSync(d).filter((x) => /\.(js|css)$/.test(x))) { const g = gzipSync(readFileSync(`${d}/${f}`)).length; tot += g; if (/^(index|vendor)-.*\.(js|css)$/.test(f)) first += g; rows.push([f, g]); }
rows.sort((a, b) => b[1] - a[1]);
console.log(`Total gzip : ${(tot / 1024).toFixed(0)} Ko ; premier chargement (index + css) : ${(first / 1024).toFixed(0)} Ko ; fichiers : ${rows.length}`);
console.log(rows.slice(0, 6).map(([f, g]) => `  ${f} ${(g / 1024).toFixed(1)} Ko`).join('\n'));
