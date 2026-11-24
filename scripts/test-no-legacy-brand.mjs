/* Renommage MABAH (site) : plus d'ancien nom hors liste blanche, clés i18n cohérentes, SEO (titre, JSON-LD, alias de transition, Search Console), logo, migration douce des clés de stockage.
   Lancement : node scripts/test-no-legacy-brand.mjs  (ou npm run test:brand) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RB = await import(pathToFileURL(path.join(root, 'scripts/rename-brand.mjs')).href);
let passed = 0; let failed = 0;
const check = (name, cond, extra) => { if (cond) { passed++; console.log('  OK   ' + name); } else { failed++; console.log('  ECHEC ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); } };
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

console.log('Renommage MABAH (site)');
const bad = []; const changed = [];
for (const f of RB.listFiles(root)) {
  if (RB.skipped(f)) continue;
  const b = fs.readFileSync(path.join(root, f)); if (b.includes(0)) continue;
  const t = b.toString('utf8');
  for (const l of RB.leftovers(t)) bad.push(`${f}:${l.line} ${l.text.slice(0, 80)}`);
  if (RB.transform(f, t).out !== t) changed.push(f);
}
check('aucune occurrence de « Brij » hors liste blanche', bad.length === 0, bad.slice(0, 5));
check('le script de renommage est idempotent (le rejouer ne change plus rien)', changed.length === 0, changed.slice(0, 5));

// Dictionnaires : chaque dictionnaire EN/DE/ES a les mêmes clés françaises ; aucune clé ou valeur ne garde l'ancien nom
const dicts = {};
for (const lang of ['en', 'de', 'es']) {
  const dir = path.join(root, 'src/i18n', lang);
  for (const f of fs.readdirSync(dir)) { dicts[`${lang}/${f}`] = (await import(pathToFileURL(path.join(dir, f)).href)).default; }
}
const keysOf = (lang) => Object.entries(dicts).filter(([k]) => k.startsWith(lang + '/')).flatMap(([, d]) => Object.keys(d));
const en = new Set(keysOf('en'));
check('dictionnaires : mêmes clés françaises en EN, DE et ES', keysOf('de').every((k) => en.has(k)) && keysOf('es').every((k) => en.has(k)) && en.size === new Set(keysOf('de')).size, [en.size, new Set(keysOf('de')).size, new Set(keysOf('es')).size]);
check('dictionnaires : aucune clé ni valeur ne contient l\'ancien nom', Object.values(dicts).every((d) => Object.entries(d).every(([k, v]) => !/brij/i.test(k) && !/brij/i.test(String(v)))));
check('dictionnaires : le nom de l\'assistant est « MABAH IA » dans les 4 langues', ['en', 'de', 'es'].every((l) => Object.entries(dicts).filter(([k]) => k.startsWith(l + '/')).some(([, d]) => Object.entries(d).some(([k, v]) => k === 'Demandez à MABAH IA' && /MABAH IA/.test(v)))));
// Source : chaque texte français du code qui parle de MABAH a sa traduction (le contrôle complet est scripts/i18n-check.mjs)
const srcFiles = RB.listFiles(root).filter((f) => /^src\/.*\.jsx?$/.test(f) && !/^src\/i18n\//.test(f));
const miss = [];
for (const f of srcFiles) {
  const t = read(f);
  for (const m of t.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*MABAH(?:[^'\\]|\\.)*)'/g)) { const k = m[1].replace(/\\'/g, "'"); if (!en.has(k)) miss.push(f + ' : ' + k.slice(0, 70)); }
}
check('chaque texte t(\'… MABAH …\') du code a sa traduction (clé identique dans les dictionnaires)', miss.length === 0, miss.slice(0, 5));

// SEO
const idx = read('index.html');
check('index.html : titre, og:title, og:site_name = MABAH ; slogan « Pilotez votre entreprise avec le meilleur outil »', /<title>MABAH · Pilotez votre entreprise avec le meilleur outil<\/title>/.test(idx) && /og:site_name" content="MABAH"/.test(idx));
check('index.html : code de vérification Google Search Console conservé tel quel', idx.includes('<meta name="google-site-verification" content="uOEcJIaqn6TPh1hx0ZlpL8xp8rRZH8nXmoUsFfNIxbc">'));
check('JSON-LD : WebSite et application MABAH avec le nom alternatif « Brij-IA » (transition)', /"@type":"WebSite"[^<]*"name":"MABAH","alternateName":\["Brij-IA","BRIJ-IA"\]/.test(idx) && /"@type":"SoftwareApplication"[^<]*"name":"MABAH","alternateName":\["Brij-IA","BRIJ-IA"\]/.test(idx));
check('index.html : les URL passent toutes par %SITE_URL% (aucune adresse en dur)', !/brij-ia\.vercel\.app/.test(idx) && /rel="canonical" href="%SITE_URL%\//.test(idx));
check('index.html : description et aperçu de partage (og:image) à jour', /og:image" content="%SITE_URL%\/assets\/og-mabah\.png"/.test(idx) && /name="description" content="MABAH réunit/.test(idx) && !/Gérez votre entreprise avec une IA/.test(idx));
const man = JSON.parse(read('public/manifest.webmanifest'));
check('manifeste : nom MABAH, description ERP + MABAH IA, icônes présentes', man.name === 'MABAH' && man.short_name === 'MABAH' && /MABAH IA/.test(man.description) && man.icons.every((i) => fs.existsSync(path.join(root, 'public', i.src))));
check('manifeste : start_url, scope et id inchangés (l\'application déjà installée reste la même)', man.start_url === '/app' && man.scope === '/' && man.id === '/app');
check('service worker : nouvelle version de cache (les anciens logos en cache sont purgés)', Number((/CACHE_VERSION = (\d+)/.exec(read('public/sw.js')) || [])[1]) >= 6);
check('profil du fondateur : adresses sur mabah.vercel.app, nom du produit MABAH', /<title>Steve Brandon Tenda[^<]*créateur de MABAH/.test(read('public/steve-brandon-tenda/index.html')) && /mabah\.vercel\.app\/steve-brandon-tenda\//.test(read('public/steve-brandon-tenda/index.html')));

// Logo
for (const f of ['public/favicon.svg', 'public/logo.svg', 'public/assets/icons/icon-192.png', 'public/assets/icons/icon-512.png', 'public/assets/icons/icon-maskable-512.png', 'public/assets/icons/apple-touch-icon.png', 'public/assets/og-mabah.png']) check('logo : ' + f + ' présent', fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).size > 500);
check('logo : favicon.svg et logo.svg intègrent le PNG MABAH', /<image[^>]+data:image\/png;base64,/.test(read('public/favicon.svg')) && /aria-label="MABAH"/.test(read('public/logo.svg')));

// Migration douce des clés de stockage
const store = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const ls = store(); const ss = store();
ls.setItem('brij-cookies', '{"analytics":false}'); ls.setItem('brij-guide-seen', 'true'); ls.setItem('brij-seen:/app', '1'); ls.setItem('mabah-guide-done', 'deja');
globalThis.window = { localStorage: ls, sessionStorage: ss };
const LK = await import(pathToFileURL(path.join(root, 'src/lib/legacy-keys.js')).href + '?t=' + Date.now());
LK.migrateLegacyKeys();
check('migration douce : choix des cookies, guide vu et pages vues repris sous les nouvelles clés', ls.getItem('mabah-cookies') === '{"analytics":false}' && ls.getItem('mabah-guide-seen') === 'true' && ls.getItem('mabah-seen:/app') === '1');
check('migration douce : une valeur déjà présente sous la nouvelle clé n\'est pas écrasée ; les anciennes clés restent (retour arrière sûr)', ls.getItem('mabah-guide-done') === 'deja' && ls.getItem('brij-cookies') !== null);
LK.migrateLegacyKeys();
check('migration douce : idempotente', ls.getItem('mabah-cookies') === '{"analytics":false}');
check('main.jsx charge la migration avant tout le reste', /^import '\.\/lib\/legacy-keys\.js'/.test(read('src/main.jsx')));
// Couleurs : un seul fichier
const css = read('src/styles/tokens.css');
check('palette : un seul bloc de jetons de marque dans tokens.css (variante « logo » prête : scripts/apply-palette.mjs)', /\/\*PALETTE:\w+\*\/[\s\S]*--brand-base:#[0-9a-f]{6}[\s\S]*\/\*FIN-PALETTE\*\//.test(css));
const hard = RB.listFiles(root).filter((f) => /^src\/.*\.(css|jsx?)$/.test(f) && f !== 'src/styles/tokens.css' && f !== 'src/styles/ws-geo.css' /* pastilles de carte : couleur de catégorie, pas la marque */ && !/^src\/i18n\//.test(f)).filter((f) => /#(4f46e5|7c3aed|4338ca|3730a3|2e1a8a)\b/i.test(read(f)) && !/FALLBACK|--brand/.test(read(f).split('\n').filter((l) => /#(4f46e5|7c3aed|4338ca|3730a3|2e1a8a)\b/i.test(l)).join('\n')));
check('palette : plus de violet de marque écrit en dur hors tokens.css (sauf valeurs de repli)', hard.length === 0, hard);
// Adresse publique et transition d'adresse
const vj = JSON.parse(read('vercel.json'));
const red = vj.redirects[0];
check('vercel.json : redirection permanente basée sur l\'hôte brij-ia.vercel.app vers https://mabah.vercel.app en gardant le chemin (et les paramètres)', red.permanent === true && red.has[0].type === 'host' && red.has[0].value === 'brij-ia.vercel.app' && red.destination === 'https://mabah.vercel.app/:path', red);
check('vercel.json : l\'ancien hôte garde /api (pas de redirection des appels au serveur)', new RegExp('^' + red.source.replace(':path', '')).test('/api/health') === false || !new RegExp('^/(' + red.source.slice(red.source.indexOf('(') + 1, -1) + ')$').test('/api/health'));
check('vercel.json : les réécritures /api vers le serveur Render sont intactes', vj.rewrites.some((r) => r.source === '/api/:path*' && /onrender\.com\/api\/:path\*$/.test(r.destination)));
const red2 = vj.redirects.find((r) => (r.has || []).some((h) => h.value === 'manager-ia-frontend.vercel.app'));
check('vercel.json : l\'adresse technique manager-ia-frontend.vercel.app est aussi redirigée (permanent, /api exclu) vers mabah.vercel.app', Boolean(red2) && red2.permanent === true && red2.destination === 'https://mabah.vercel.app/:path' && red2.source === red.source);
check('vite.config.js : adresse par défaut https://mabah.vercel.app', /DEFAULT_SITE_URL = 'https:\/\/mabah\.vercel\.app'/.test(read('vite.config.js')));
check('index.html : ancien code Search Console conservé ET emplacement du nouveau code (propriété mabah.vercel.app)', /NOUVELLE propriété \(mabah\.vercel\.app\)/.test(idx) && idx.indexOf('google-site-verification') < idx.indexOf('NOUVELLE propriété'));
check('product.js (site) : publicUrl mabah.vercel.app, legacyUrls brij-ia.vercel.app', /publicUrl: 'https:\/\/mabah\.vercel\.app'/.test(read('src/lib/product.js')) && /legacyUrls: \['https:\/\/brij-ia\.vercel\.app'\]/.test(read('src/lib/product.js')));
console.log(`\n${passed} OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
