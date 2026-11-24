#!/usr/bin/env node
/* Change la palette de marque de MABAH : node scripts/apply-palette.mjs violet|logo [--dry-run]
   - violet : la palette actuelle de l'interface (indigo).  - logo : les couleurs du logo (bleu, avec le bleu nuit des bandeaux).
   Le seul fichier de design touché est src/styles/tokens.css (bloc délimité par les repères PALETTE et FIN-PALETTE) ; pour que la barre du navigateur
   et l'icône à l'installation suivent, la couleur du thème est aussi reportée dans index.html, public/manifest.webmanifest et public/offline.html.
   Idempotent : relancé avec la même palette, aucun changement. */
import fs from 'node:fs';
const PAL = {
  violet: { base: '#4f46e5', dk: '#8b93ff', two: '#7c3aed', deep: '#2e1a8a', mid: '#4338ca', ink: '#3730a3', rgb: '79,70,229' },
  logo:   { base: '#0b5fd6', dk: '#5da4ff', two: '#0a8bf0', deep: '#0a1f5c', mid: '#0a4fbf', ink: '#0a3f9e', rgb: '11,95,214' },
};
const name = process.argv[2]; const dry = process.argv.includes('--dry-run');
if (!PAL[name]) { console.error('Palette inconnue. Choix : ' + Object.keys(PAL).join(', ')); process.exit(2); }
const P = PAL[name];
const css = 'src/styles/tokens.css';
let t = fs.readFileSync(css, 'utf8');
const m = /\/\*PALETTE:\w+\*\/([\s\S]*?)--brand-base:[^\n]*\n\s*--theme-color:[^\n]*\n\s*\/\*FIN-PALETTE\*\//.exec(t);
if (!m) { console.error('Bloc PALETTE introuvable dans ' + css); process.exit(1); }
const head = m[1];
const block = `/*PALETTE:${name}*/${head}--brand-base:${P.base}; --brand-dk-base:${P.dk}; --brand-2:${P.two}; --brand-deep:${P.deep}; --brand-mid:${P.mid}; --brand-ink:${P.ink}; --brand-rgb:${P.rgb};\n  --theme-color:${P.base}; --theme-color-dark:#0a101e;\n  /*FIN-PALETTE*/`;
const out = t.replace(m[0], block);
const files = [['index.html', /(<meta name="theme-color" content=")#[0-9a-f]{6}(" media="\(prefers-color-scheme: light\)">)/, `$1${P.base}$2`], ['public/manifest.webmanifest', /("theme_color": ")#[0-9a-f]{6}(")/, `$1${P.base}$2`], ['public/offline.html', /(background:)#(?:4f46e5|0b5fd6)(;color:#fff)/g, `$1${P.base}$2`]];
let changed = out !== t; if (!dry && out !== t) fs.writeFileSync(css, out);
for (const [f, re, to] of files) { if (!fs.existsSync(f)) continue; const a = fs.readFileSync(f, 'utf8'); const b = a.replace(re, to); if (a !== b) { changed = true; if (!dry) fs.writeFileSync(f, b); console.log('~ ' + f); } }
console.log(changed ? (dry ? 'Simulation : changements à faire pour la palette « ' : 'Palette « ') + name + ' » ' + (dry ? '' : 'appliquée.') : 'Aucun changement : palette « ' + name + ' » déjà active.');
