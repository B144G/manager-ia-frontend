import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLang, getLocale, useT } from '../../../lib/i18n.jsx';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';

/** Zone tactile d'au moins 44 px (boutons-liens) et champs à 16 px minimum : styles en ligne communs à la Paie et à la Fiscalité. */
export const TAP = { minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 10px' };
export const BTN = { minHeight: 44 };
export const INP = { fontSize: 16 };
/** Ligne de champs qui passe à la ligne et reste alignée à gauche (les .row du site alignent à droite quand ils s'enroulent). */
export const WRAP = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', justifyContent: 'flex-start' };

/** Case à cocher accessible (zone de 44 px). */
export function Check({ checked, onChange, label, hint, disabled }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, padding: '6px 0', cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 24, height: 24, minHeight: 24, flex: '0 0 24px', marginTop: 2 }} />
      <span><b style={{ fontSize: 15 }}>{label}</b>{hint ? <><br /><small className="muted">{hint}</small></> : null}</span>
    </label>
  );
}

/* Outils communs à la Paie et à la Fiscalité : export CSV côté navigateur et page imprimable rendue par React (aucun HTML brut). */

/** Télécharge un tableau de lignes en CSV (séparateur « ; », ouvre bien dans Excel). Les cellules qui ressemblent à une formule sont neutralisées. */
export function downloadCsv(name, rows) {
  const cell = (v) => {
    let t = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  };
  const text = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const PRINT_CSS = 'body{font:14px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:18px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}'
  + 'table{width:100%;border-collapse:collapse;margin:6px 0}td,th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{font-size:12px;color:#444}.r{text-align:right;white-space:nowrap}'
  + '.tot td{font-weight:700;border-top:2px solid #333}.note{margin-top:16px;padding:8px 10px;border:1px solid #999;font-size:12px}.muted{color:#555;font-size:12px}@media print{body{margin:0}}';

/** Aperçu imprimable : le contenu React est affiché dans un cadre isolé ; « Imprimer » n'imprime que ce cadre. */
export function PrintFrame({ title, children, height = '60vh' }) {
  const t = useT();
  const ref = useRef(null);
  const [doc, setDoc] = useState(null);
  const sync = () => { const d = ref.current && ref.current.contentDocument; if (d && d.body) setDoc(d); };
  useEffect(() => { sync(); }, []);
  const print = () => { const w = ref.current && ref.current.contentWindow; if (w) { w.focus(); w.print(); } };
  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}><button className="btn primary small" type="button" onClick={print}>{t('Imprimer')}</button></div>
      <iframe ref={ref} title={title} onLoad={sync} srcDoc={'<!doctype html><html lang="' + getLang() + '"><head><meta charset="utf-8"></head><body></body></html>'} style={{ width: '100%', height, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
      {doc ? createPortal(<><style>{PRINT_CSS}</style>{children}</>, doc.body) : null}
    </>
  );
}

/** Texte de l'exercice ou du mois en toutes lettres : « septembre 2026 ». */
export const monthLabel = (m) => { const d = new Date(m + '-01T00:00:00'); return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' }); };

/** Texte « à compléter » renvoyé par le serveur (français) : les messages à variables sont retraduits ici. */
export const incompleteText = (t, x) => {
  const m = /^(\d+) rubrique\(s\) sans taux/.exec(x || '');
  if (m) return t('{n} rubrique(s) sans taux (« à compléter »).', { n: m[1] });
  const c = /^Barème Cameroun : (\d+) taux à renseigner/.exec(x || '');
  return c ? t('Barème Cameroun : {n} taux à renseigner (par exemple le taux accidents du travail).', { n: c[1] }) : t(x);
};

/** Bouton de téléchargement d'un fichier du serveur (CSV…) avec le cookie de connexion : path = '/payroll/cm/export/cnps.csv?month=…' (relatif à l'organisation). */
export function DownloadBtn({ path, name, children, className = 'btn small' }) {
  const t = useT();
  const { orgId, fail } = useWs();
  const go = () => {
    fetch(API_BASE + '/api/ws/orgs/' + orgId + path, { credentials: 'include' })
      .then(async (r) => { if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || t('Export impossible.')); } return r.blob(); })
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }).catch(fail);
  };
  return <button className={className} type="button" style={BTN} onClick={go}>{children}</button>;
}

/** Bandeau d'avertissement « document de travail » (rouge discret, toujours visible sur les écrans de paie, compta et budget prévisionnels). */
export function WorkNotice({ children }) {
  return <p className="ws-card small late" role="note" style={{ margin: '8px 0' }}>{children}</p>;
}
