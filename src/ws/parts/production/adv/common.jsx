import { useEffect, useState } from 'react';
import { useWs } from '../../../WsContext.jsx';
import { useT } from '../../../../lib/i18n.jsx';
import { tsrv } from '../../../../lib/srv.js';
import { Alert, Button, Card } from '../../../ui/index.jsx';
import { Loading } from '../../../ui.jsx';
import { Cell, num } from '../../projects/ro-common.jsx';
import '../../../../styles/ws-ro.css';

/* Production · techniques avancées : briques communes à toutes les techniques (MPS, MRP, capacités, ordonnancement, puis lean, kanban,
   5S, TOC, JIT, Six Sigma, TPM, qualité…). Le serveur calcule TOUT (routes /production/adv/:kind) ; le site saisit et dessine.
   - useDoc(kind) : charge le document + le résultat, garde un brouillon local, save() enregistre (responsables) et met le résultat à jour.
   - Doc / SaveBar / Editable : cadre d'une technique (chargement, erreur, bouton d'enregistrement, lecture seule pour un simple membre).
   - PeriodGrid (saisie par période), PeriodTable (résultat par période), Conclusion, Check, Field, Issues, Remove : petits éléments de formulaire. */

const clone = (o) => JSON.parse(JSON.stringify(o));
export const at = (a, i) => (Array.isArray(a) && a[i] !== undefined && a[i] !== null ? a[i] : '');
/** Remplace la valeur d'un chemin ['products', 0, 'name'] dans une copie du document. */
export function setPath(o, path, v) {
  const c = clone(o); let ref = c;
  for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
  ref[path[path.length - 1]] = v;
  return c;
}
/** Prochain numéro libre pour un identifiant « p1, p2… » (ids déjà utilisés dans `list`). */
export function nextId(list, prefix = 'p', key = 'id') {
  const used = new Set(list.map((x) => String(x[key])));
  let n = list.length + 1;
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

/** Étiquettes de périodes « S1 … SN » (semaines). */
export function usePeriodLabels(n) {
  const t = useT();
  return Array.from({ length: n }, (_, i) => t('S{n}', { n: i + 1 }));
}

/**
 * Document d'une technique : { doc, result, set(fn), upd(path, v), save(), reload, dirty, saving, saved, updatedAt, loading, error, mgr }.
 * set(fn) : fn(doc) renvoie le nouveau document (copie) ; upd(['a', 0, 'b'], v) : raccourci pour un chemin.
 */
export function useDoc(kind) {
  const { oapi, can, toast, fail } = useWs();
  const t = useT();
  const [s, setS] = useState({ doc: null, result: null, saved: false, updatedAt: null, loading: true, error: null });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    let cancel = false;
    setS((o) => ({ ...o, loading: true, error: null }));
    oapi('GET', '/production/adv/' + kind).then(
      (j) => { if (!cancel) { setS({ doc: clone(j.doc), result: j.result, saved: Boolean(j.saved), updatedAt: j.updatedAt || null, loading: false, error: null }); setDirty(false); setErr(''); } },
      (e) => { if (cancel) return; if (e && e.status === 401) fail(e); setS((o) => ({ ...o, loading: false, error: e })); },
    );
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, n]);
  const set = (fn) => { setS((o) => (o.doc ? { ...o, doc: fn(o.doc) } : o)); setDirty(true); };
  const upd = (path, v) => set((d) => setPath(d, path, v));
  const mgr = can('manager');
  const save = () => {
    if (!mgr || !s.doc) return Promise.resolve();
    setSaving(true); setErr('');
    return oapi('PUT', '/production/adv/' + kind, s.doc).then((j) => {
      setS((o) => ({ ...o, doc: clone(j.doc), result: j.result, saved: true, updatedAt: new Date().toISOString() }));
      setDirty(false); toast(t('Enregistré.'));
    }).catch((e) => { setErr(tsrv(e.message)); }).finally(() => setSaving(false));
  };
  return { ...s, set, upd, save, mgr, dirty, saving, err, reload: () => setN((x) => x + 1) };
}

/** Cadre d'une technique : chargement, erreur, puis le contenu quand le document est là. */
export function Doc({ d, children }) {
  if (d.loading && !d.doc) return <Loading />;
  if (d.error) return <p className="ws-err" role="alert">{tsrv(d.error.message)}</p>;
  if (!d.doc) return null;
  return children;
}

/** Zone de saisie : pour un simple membre, tous les champs sont désactivés (consultation seule). */
export function Editable({ d, children }) {
  return <fieldset disabled={!d.mgr} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>;
}

/** Barre d'enregistrement : bouton (responsables), avertissement « résultats pas à jour », erreur du serveur, mention lecture seule. */
export function SaveBar({ d, label }) {
  const t = useT();
  return (
    <div style={{ marginTop: 12 }}>
      {d.err ? <p className="ws-err" role="alert">{d.err}</p> : null}
      {d.dirty ? <Alert tone="warn" title={t('Modifications non enregistrées')}>{d.mgr ? t('Enregistrez pour recalculer les résultats ci-dessous.') : t('Seuls les responsables peuvent enregistrer.')}</Alert> : null}
      {d.mgr ? (
        <div className="row" style={{ marginTop: 8 }}>
          <Button variant="primary" icon="check" loading={d.saving} disabled={!d.dirty && d.saved} onClick={d.save}>{label || t('Enregistrer et calculer')}</Button>
        </div>
      ) : <p className="muted small">{t('Consultation seule : seuls les responsables modifient ces hypothèses.')}</p>}
    </div>
  );
}

/** Carte de saisie d'une technique (titre, explication, contenu, barre d'enregistrement). */
export function Setup({ d, title, subtitle, children, saveLabel }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <Editable d={d}>{children}</Editable>
      <SaveBar d={d} label={saveLabel} />
    </Card>
  );
}

/** Phrase de conclusion (même rendu que la recherche opérationnelle). */
export function Conclusion({ children }) {
  return <div className="ro-concl" role="status">{children}</div>;
}

export function Check({ checked, onChange, children }) {
  return <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="checkbox" style={{ width: 22, height: 22 }} checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} /><b>{children}</b></label>;
}

/** Titre de sous-section dans une carte. */
export function Sub({ children }) {
  return <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>{children}</h3>;
}

/** Tableau modifiable : head = libellés, rows = lignes de <td> déjà construites (tableau de tableaux de nœuds). */
export function EdTable({ head, rows, empty }) {
  if (!rows.length) return empty ? <p className="muted small">{empty}</p> : null;
  return (
    <div className="ro-scroll"><table className="ro-ed">
      <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

export function Remove({ onClick }) {
  const t = useT();
  return <button className="link" type="button" onClick={onClick}>{t('Retirer')}</button>;
}

/** Liste déroulante simple. options : [[valeur, libellé]]. */
export function Pick({ value, onChange, options, label }) {
  return <select value={value ?? ''} aria-label={label} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>;
}

/** Nombre de périodes (1 à 26 semaines) + texte d'aide. */
export function PeriodsField({ value, onChange }) {
  const t = useT();
  return (
    <div className="ro-scroll"><table className="ro-ed" style={{ maxWidth: 360 }}>
      <thead><tr><th>{t('Nombre de périodes (semaines)')}</th></tr></thead>
      <tbody><tr><td><Cell label={t('Nombre de périodes (semaines)')} step="1" value={value} onChange={(v) => onChange(Math.min(26, Math.max(1, Math.round(Number(v) || 1))))} /></td></tr></tbody>
    </table></div>
  );
}

/**
 * Saisie d'une série par période : une ligne par série, une colonne par période.
 * rows : [{ key, label (texte ou nœud), values }] ; onChange(indexLigne, indexPériode, valeur) ; head : titre de la 1re colonne.
 */
export function PeriodGrid({ rows, periods, onChange, head }) {
  const labels = usePeriodLabels(periods);
  return (
    <div className="ro-scroll"><table className="ro-ed">
      <thead><tr><th>{head || ''}</th>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={r.key}>
          <td style={{ minWidth: 150 }}>{r.label}</td>
          {labels.map((l, p) => <td key={l}><Cell label={(typeof r.label === 'string' ? r.label + ' ' : '') + l} step="any" value={at(r.values, p)} onChange={(v) => onChange(i, p, v)} /></td>)}
        </tr>
      ))}</tbody>
    </table></div>
  );
}

/**
 * Résultat par période (lecture seule). rows : [{ key, label, values, tone?: (v, i) => '' | 'bad' | 'warn' | 'good', fmt?, strong? }].
 * Les valeurs null s'affichent « — ».
 */
export function PeriodTable({ rows, periods, head, fmt }) {
  const labels = usePeriodLabels(periods);
  const f0 = fmt || ((v) => num(v, 1));
  return (
    <div className="bp-scroll"><table className="bp-table">
      <thead><tr><th>{head || ''}</th>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.key}>
          <td>{r.strong ? <b>{r.label}</b> : r.label}</td>
          {labels.map((l, i) => {
            const v = r.values[i]; const tone = r.tone ? r.tone(v, i) : '';
            return <td key={l} className={tone === 'bad' ? 'ro-neg' : tone === 'good' ? 'ro-pos' : ''} style={tone === 'warn' ? { color: 'var(--signal)', fontWeight: 700 } : undefined}>{v === null || v === undefined ? '—' : (r.fmt || f0)(v)}</td>;
          })}
        </tr>
      ))}</tbody>
    </table></div>
  );
}

/** Liste d'avis (alertes) : items = [{ tone: 'danger' | 'warn' | 'info', title, text }]. */
export function Issues({ items }) {
  if (!items.length) return null;
  return <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>{items.map((x, i) => <Alert key={i} tone={x.tone || 'warn'} title={x.title}>{x.text}</Alert>)}</div>;
}
