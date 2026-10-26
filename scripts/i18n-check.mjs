// Contrôle des traductions : liste les textes passés à t('…') qui n'ont pas de traduction dans une langue.
// Usage : node scripts/i18n-check.mjs [dossier ou fichier à contrôler]   (par défaut : src)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const target = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, 'src');
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p]);
const files = walk(target).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.includes('/i18n/'));
const used = new Map();
const re = /\bt(?:r)?\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    const raw = m[1] ?? m[2] ?? m[3];
    const txt = raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
    if (!used.has(txt)) used.set(txt, relative(root, f));
  }
}
const langs = ['en', 'de', 'es'];
let bad = 0;
for (const l of langs) {
  const dir = join(root, 'src/i18n', l);
  const dict = {};
  try { for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) { const code = readFileSync(join(dir, f), 'utf8').replace(/export default/, 'globalThis.__d ='); const fn = new Function(code + ';return globalThis.__d;'); Object.assign(dict, fn()); } } catch (e) { console.log(`[${l}] dictionnaire illisible : ${e.message}`); bad++; }
  const missing = [...used.entries()].filter(([k]) => !dict[k]);
  console.log(`[${l}] ${used.size - missing.length}/${used.size} textes traduits`);
  for (const [k, f] of missing.slice(0, 15)) console.log(`   manque : « ${k.slice(0, 90)} »  (${f})`);
  if (missing.length > 15) console.log(`   … et ${missing.length - 15} autres`);
  bad += missing.length;
}
process.exit(bad ? 1 : 0);
