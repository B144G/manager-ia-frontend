'use strict';
// Lit .env (API_BASE) et écrit config.js, le fichier que le navigateur charge. Lancez : npm run config
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function readEnv() {
  const out = {};
  let txt = '';
  try { txt = fs.readFileSync(path.join(root, '.env'), 'utf8'); } catch { /* pas de .env : valeurs par défaut */ }
  for (const line of txt.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = readEnv();
if (process.env.API_BASE !== undefined) env.API_BASE = process.env.API_BASE; // une variable d'environnement prime sur .env (pratique pour un essai ponctuel)
if (env.API_BASE === undefined) env.API_BASE = 'http://localhost:3000';
let base = env.API_BASE;
let value;
if (base === undefined || base === 'null') value = 'null';
else if (base === '') value = '""';
else {
  if (!/^https?:\/\/[^\s"'<>]+$/.test(base)) { console.error(`API_BASE invalide : « ${base} ». Exemple : http://localhost:3000`); process.exit(1); }
  value = JSON.stringify(base.replace(/\/+$/, ''));
}
const js = `/* Configuration du site MANAGER-IA. Fichier GÉNÉRÉ par « npm run config » à partir de .env : modifiez .env, pas ce fichier.

   API_BASE : adresse du serveur (backend).
     null                           -> mode démonstration (aucun serveur)
     ""                             -> le serveur est sur le MÊME domaine que ce site
     "https://api.votredomaine.com" -> le serveur est sur un AUTRE domaine (voir README, section « Liaison »)
*/
window.MI_CONFIG = {
  API_BASE: ${value}
};
`;
fs.writeFileSync(path.join(root, 'config.js'), js);
console.log(`config.js écrit : API_BASE = ${value}`);
