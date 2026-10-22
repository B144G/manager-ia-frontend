// Plugin PostCSS maison : ajoute des replis pour les navigateurs qui ignoreraient une déclaration récente.
//  - color-mix(in srgb, …)  (Safari < 16.2, Chrome < 111, Firefox < 113) : on calcule une couleur rgba() équivalente au moment de la compilation
//    (les couleurs sont lues dans les variables --xxx du thème clair des feuilles de style) et on la place AVANT la déclaration moderne ;
//    un navigateur récent garde la version color-mix (la dernière déclaration valide gagne), un ancien garde la couleur calculée.
//  - overflow-x:clip (Safari < 16) : repli overflow-x:hidden.
//  - requêtes de conteneur @container ws-main (Safari < 16, Chrome < 105) : voir responsive.css (repli par requêtes de média).
import fs from 'node:fs';
import path from 'node:path';

const STYLES = path.resolve(process.cwd(), 'src', 'styles');
const globalVars = {};
function collect(file) {
  const vars = {};
  const css = fs.readFileSync(file, 'utf8');
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|var\(--[\w-]+\))\s*[;}]/g)) { if (!(m[1] in vars)) vars[m[1]] = m[2]; }
  return vars;
}
const perFile = {};
for (const f of fs.readdirSync(STYLES).filter((n) => n.endsWith('.css'))) {
  perFile[f] = collect(path.join(STYLES, f));
  for (const k in perFile[f]) if (!(k in globalVars)) globalVars[k] = perFile[f][k];
}

function parseColor(str, vars, local, depth = 0) {
  str = str.trim();
  if (depth > 6) return null;
  if (str === 'transparent') return [0, 0, 0, 0];
  let m = str.match(/^#([0-9a-fA-F]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  m = str.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) { let a = 1; if (m[4]) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return [+m[1], +m[2], +m[3], a]; }
  m = str.match(/^var\((--[\w-]+)\)$/);
  if (m) { const v = local[m[1]] || vars[m[1]] || globalVars[m[1]]; return v ? parseColor(v, vars, local, depth + 1) : null; }
  return null;
}
// color-mix(in srgb, A p%, B [q%]) avec mélange pré-multiplié par la transparence (comme le navigateur)
function mix(inner, vars, local) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of inner) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur);
  if (parts.length !== 3 || !/^\s*in\s+srgb\s*$/.test(parts[0])) return null;
  const read = (s) => { const m = s.trim().match(/^(.*?)(?:\s+([\d.]+)%)?$/); const c = parseColor(m[1], vars, local); return c ? { c, p: m[2] === undefined ? null : parseFloat(m[2]) } : null; };
  const A = read(parts[1]); const B = read(parts[2]);
  if (!A || !B) return null;
  let pa = A.p, pb = B.p;
  if (pa === null && pb === null) { pa = 50; pb = 50; } else if (pa === null) pa = 100 - pb; else if (pb === null) pb = 100 - pa;
  const sum = pa + pb; if (sum <= 0) return null;
  const wa = pa / sum, wb = pb / sum; const alpha = (sum < 100 ? sum / 100 : 1);
  const aa = A.c[3] * wa, ab = B.c[3] * wb; const at = aa + ab;
  if (at === 0) return 'transparent';
  const ch = (i) => Math.round((A.c[i] * aa + B.c[i] * ab) / at);
  const out = at * alpha;
  return 'rgba(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ',' + (Math.round(out * 1000) / 1000) + ')';
}
function replaceMixes(value, vars, local) {
  let out = '', i = 0, ok = true;
  while (i < value.length) {
    const j = value.indexOf('color-mix(', i);
    if (j < 0) { out += value.slice(i); break; }
    out += value.slice(i, j);
    let k = j + 10, depth = 1;
    while (k < value.length && depth > 0) { if (value[k] === '(') depth++; else if (value[k] === ')') depth--; k++; }
    const r = mix(value.slice(j + 10, k - 1), vars, local);
    if (r === null) { ok = false; break; }
    out += r; i = k;
  }
  return ok ? out : null;
}

export default () => ({
  postcssPlugin: 'mia-fallbacks',
  Once(root, { atRule, rule }) {
    const file = path.basename((root.source && root.source.input && root.source.input.file) || '');
    const vars = perFile[file] || {};
    const customFallbacks = [];
    root.walkDecls((decl) => {
      if (decl.prop === 'overflow-x' && decl.value === 'clip') { decl.cloneBefore({ value: 'hidden' }); return; }
      if (!decl.value.includes('color-mix(')) return;
      const parent = decl.parent;
      const local = {};
      if (parent && parent.nodes) parent.nodes.forEach((n) => { if (n.type === 'decl' && n.prop.startsWith('--') && !n.value.includes('color-mix(')) local[n.prop] = n.value; });
      const fb = replaceMixes(decl.value, vars, local);
      if (fb === null) return;
      if (decl.prop.startsWith('--')) {
        // propriété personnalisée : repli placé dans un bloc @supports « non », sinon l'ancien navigateur garderait la valeur color-mix invalide
        if (parent.type === 'rule') customFallbacks.push({ ruleNode: parent, prop: decl.prop, value: fb });
      } else decl.cloneBefore({ value: fb });
    });
    for (const { ruleNode, prop, value } of customFallbacks) {
      const wrap = atRule({ name: 'supports', params: 'not (color: color-mix(in srgb, red 50%, blue))' });
      const r = rule({ selector: ruleNode.selector }); r.append({ prop, value }); wrap.append(r);
      // à l'intérieur du même @media éventuel
      ruleNode.parent.insertAfter(ruleNode, wrap);
    }
  },
});
