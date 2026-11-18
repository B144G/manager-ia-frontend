import { useMemo, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Badge, Form, Loaded, useLoad } from '../../ui.jsx';
import { saveBlob } from '../sales/util.jsx';
import { day, when } from './util.jsx';
import { AccessEditor } from './Access.jsx';

/* Catalogue : notices (métadonnées) des documents et des ressources physiques, recherche par facettes, import / export CSV, étiquettes.
   Le site n'affiche que ce que le serveur renvoie : la visibilité (confidentialité, blocs ouverts) est décidée côté serveur. */

export const STATUS_TONE = { available: 'ok', loaned: 'warn', reserved: 'info', lost: 'danger', withdrawn: 'neutral' };

/** Un tableau de libellés déjà traduits côté serveur (t() sur les valeurs fixes du catalogue). */
export const useMeta = (L) => useLoad(() => L.lib('GET', '/catalog/meta'), []);
const opts = (list, t) => list.map((x) => [x.value, t(x.label)]);

export function ClassSelect({ classes, value, onChange, label, none }) {
  const t = useT();
  const sorted = useMemo(() => [...classes].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })), [classes]);
  return (
    <label className="fld"><span>{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">{none || t('— Sans classe —')}</option>
        {sorted.map((c) => <option key={c.id} value={c.id}>{`${'· '.repeat(c.path.split('›').length - 1)}${c.code} — ${c.name}`}</option>)}
      </select>
    </label>
  );
}

/** Formulaire d'une notice (création et modification). */
export function RecordForm({ L, rec, meta, classes, onDone }) {
  const t = useT();
  const { toast } = useWs();
  const r = rec || {};
  return (
    <Form key={r.id || 'new'} submitText={rec ? t('Enregistrer') : t('Créer la notice')}
      fields={[
        { k: 'title', label: t('Titre'), required: true, value: r.title || '' },
        { k: 'type', label: t('Type de ressource'), type: 'select', value: r.type || 'document', options: opts(meta.types, t) },
        { k: 'author', label: t('Auteur'), value: r.author || '' },
        { k: 'publisher', label: t('Éditeur'), value: r.publisher || '' },
        { k: 'pubDate', label: t('Date de publication (AAAA-MM-JJ ou AAAA)'), value: r.pubDate || '' },
        { k: 'language', label: t('Langue'), value: r.language || '', placeholder: 'fr' },
        { k: 'summary', label: t('Résumé'), type: 'textarea', rows: 3, value: r.summary || '' },
        { k: 'keywords', label: t('Mots-clés (séparés par des virgules)'), value: (r.keywords || []).join(', '), hint: t('Un synonyme du vocabulaire est remplacé par le terme préféré.') },
        { k: 'callNumber', label: t('Cote'), value: r.callNumber || '' },
        { k: 'inventoryNo', label: t("Numéro d'inventaire"), value: r.inventoryNo || '', hint: t('Laissez vide pour en recevoir un automatiquement.') },
        { k: 'location', label: t('Emplacement'), value: r.location || '' },
        { k: 'condition', label: t('État'), type: 'select', value: r.condition || 'good', options: opts(meta.conditions, t) },
        { k: 'classId', label: t('Classe'), type: 'select', value: r.classId || '', options: [['', t('— Sans classe —')], ...classes.map((c) => [String(c.id), `${c.code} — ${c.name}`])] },
        { k: 'confidentiality', label: t('Confidentialité'), type: 'select', value: r.confidentiality || 'internal', options: opts(meta.confidentialities, t), hint: t('Libre et interne : tous les membres. Restreint : responsables. Secret : administrateurs.') },
        { k: 'loanable', label: t('Se prête ?'), type: 'select', value: r.loanable === false ? 'no' : 'yes', options: [['yes', t('Oui')], ['no', t('Non')]] },
        { k: 'acquiredAt', label: t("Date d'acquisition (AAAA-MM-JJ)"), value: r.acquiredAt || '' },
        { k: 'acquiredPrice', label: t("Prix d'acquisition"), type: 'number', value: r.acquiredPrice || '' },
      ]}
      onSubmit={(v) => {
        const body = { title: v.title, type: v.type, author: v.author, publisher: v.publisher, pubDate: v.pubDate || null, language: v.language, summary: v.summary, keywords: v.keywords, callNumber: v.callNumber, location: v.location, condition: v.condition, classId: v.classId ? Number(v.classId) : null, confidentiality: v.confidentiality, loanable: v.loanable === 'yes', acquiredAt: v.acquiredAt || null, acquiredPrice: v.acquiredPrice === '' ? 0 : Number(v.acquiredPrice) };
        if (v.inventoryNo) body.inventoryNo = v.inventoryNo;
        return L.lib(rec ? 'PUT' : 'POST', rec ? `/records/${rec.id}` : '/records', body).then(() => { toast(rec ? t('Notice enregistrée.') : t('Notice créée.')); onDone(); });
      }} />
  );
}

/** Fiche d'une notice : métadonnées, état de prêt, actions, historique. */
export function RecordModal({ L, id, close, onChange }) {
  const t = useT();
  const { toast, can, confirm } = useWs();
  const st = useLoad(() => L.lib('GET', `/records/${id}`), [id]);
  const meta = useMeta(L);
  const cls = useLoad(() => L.lib('GET', '/classes'), []);
  const [edit, setEdit] = useState(false);
  const [acc, setAcc] = useState(false);
  const sim = useLoad(() => L.lib('GET', `/records/${id}/similar`), [id]);
  const { modal } = useWs();
  const fail = (e) => toast(tsrv(e.message), true);
  const done = () => { st.reload(); onChange(); };
  const act = (p, body, msg) => L.lib('POST', p, body || {}).then(() => { if (msg) toast(msg); done(); }, fail);
  return (
    <Loaded state={st}>{(j) => {
      const r = j.record; const loan = r.loan;
      const myResa = (j.reservations || []).find((x) => x.mine);
      const myLoan = loan && loan.mine;
      return (
        <div className="lib-docmodal">
          <p className="lib-tags"><Badge tone={STATUS_TONE[r.status]}>{t(statusLabel(r.status))}</Badge>
            <span className="lib-tag">{t(typeLabel(r.type))}</span><span className="lib-tag">{t(confLabel(r.confidentiality))}</span>
            {r.classCode ? <span className="lib-tag">{r.classPath}</span> : null}</p>
          {r.summary ? <p>{r.summary}</p> : null}
          <dl className="lib-meta">
            <div><dt>{t('Auteur')}</dt><dd>{r.author || '—'}</dd></div>
            <div><dt>{t('Éditeur')}</dt><dd>{r.publisher || '—'}</dd></div>
            <div><dt>{t('Date')}</dt><dd>{r.pubDate ? day(r.pubDate) : '—'}</dd></div>
            <div><dt>{t('Langue')}</dt><dd>{r.language || '—'}</dd></div>
            <div><dt>{t('Cote')}</dt><dd className="mono">{r.callNumber || '—'}</dd></div>
            <div><dt>{t("Numéro d'inventaire")}</dt><dd className="mono">{r.inventoryNo}</dd></div>
            <div><dt>{t('Emplacement')}</dt><dd>{r.location || '—'}</dd></div>
            <div><dt>{t('État')}</dt><dd>{t(condLabel(r.condition))}</dd></div>
            {r.docName ? <div><dt>{t('Document numérique')}</dt><dd>{r.docName}</dd></div> : null}
            {r.acquiredAt ? <div><dt>{t('Acquisition')}</dt><dd>{day(r.acquiredAt)}</dd></div> : null}
          </dl>
          {r.keywords.length ? <p className="lib-tags">{r.keywords.map((k) => <span key={k} className="lib-tag">{k}</span>)}</p> : null}

          {loan ? <p className={loan.overdue ? 'ws-err' : 'muted'}>{loan.overdue ? t('En retard — à rendre depuis le {date}.', { date: day(loan.due) }) : t('Empruntée jusqu’au {date}.', { date: day(loan.due) })}{loan.by ? ` ${loan.by}` : ''}{r.queue ? ` · ${t('{n} réservation(s) en attente', { n: r.queue })}` : ''}</p> : null}
          <div className="row lib-actions">
            {r.loanable && r.status === 'available' ? <button className="btn primary small" type="button" onClick={() => act(`/records/${r.id}/loan`, {}, t('Prêt enregistré.'))}>{t('Emprunter')}</button> : null}
            {r.loanable && r.status === 'reserved' && myResa && myResa.state === 'ready' ? <button className="btn primary small" type="button" onClick={() => act(`/records/${r.id}/loan`, {}, t('Prêt enregistré.'))}>{t('Retirer ma réservation')}</button> : null}
            {r.loanable && ['loaned', 'reserved'].includes(r.status) && !myLoan && !myResa ? <button className="btn small" type="button" onClick={() => act(`/records/${r.id}/reserve`, {}, t('Réservation enregistrée.'))}>{t('Réserver')}</button> : null}
            {myResa ? <button className="btn small" type="button" onClick={() => L.lib('DELETE', `/reservations/${myResa.id}`).then(() => { toast(t('Réservation annulée.')); done(); }, fail)}>{t('Annuler ma réservation')}</button> : null}
            {myLoan ? <button className="btn small" type="button" onClick={() => { const l = (j.loans || []).find((x) => x.state === 'active'); if (l) act(`/loans/${l.id}/return`, {}, t('Retour enregistré.')); }}>{t('Rendre')}</button> : null}
            {myLoan ? <button className="btn small" type="button" onClick={() => { const l = (j.loans || []).find((x) => x.state === 'active'); if (l) act(`/loans/${l.id}/renew`, {}, t('Prêt renouvelé.')); }}>{t('Renouveler')}</button> : null}
            {can('manager') ? <button className="btn small" type="button" onClick={() => setEdit(!edit)}>{edit ? t('Fermer le formulaire') : t('Modifier')}</button> : null}
            {can('manager') ? <button className="btn small" type="button" onClick={() => confirm(t('Supprimer cette notice du catalogue ?'), () => L.lib('DELETE', `/records/${r.id}`).then(() => { close(); onChange(); toast(t('Notice supprimée.')); }, fail), t('Supprimer'))}>{t('Supprimer')}</button> : null}
          </div>
          {edit && meta.data && cls.data ? <RecordForm L={L} rec={r} meta={meta.data} classes={cls.data.classes} onDone={() => { setEdit(false); done(); }} /> : null}

          {can('admin') ? <div className="row lib-actions"><button className="btn small" type="button" onClick={() => setAcc(!acc)}>{acc ? t('Fermer les droits') : t("Droits d'accès")}</button>
            {j.archive && !j.archive.sealed ? <button className="btn small" type="button" onClick={() => act(`/records/${r.id}/seal`, {}, t('Notice mise sous scellé.'))}>{t('Mettre sous scellé')}</button> : null}</div> : null}
          {acc ? <AccessEditor L={L} scope="records" id={r.id} close={() => setAcc(false)} /> : null}
          {j.access ? <p className="muted small">{t('Vos droits sur cette ressource :')} {[j.access.read && t('lire'), j.access.download && t('télécharger'), j.access.edit && t('modifier'), j.access.loan && t('emprunter')].filter(Boolean).join(', ') || '—'}</p> : null}
          {j.archive ? (
            <p className="muted small">{t('Cycle de vie :')} <Badge tone={j.archive.lifecycle === 'destroy_due' ? 'warn' : 'neutral'}>{t(j.archive.lifecycleLabel)}</Badge>{j.archive.until ? ` · ${t('conservation jusqu’au {date}', { date: day(j.archive.until) })}` : ` · ${t('durée de conservation non fixée')}`}
              {j.archive.holds.length ? <> <Badge tone="danger">{t('Gel légal : {name}', { name: j.archive.holds.map((x) => x.name).join(', ') })}</Badge></> : null}
              {j.archive.sealed ? <> <Badge tone="info">{t('Scellée le {date}', { date: when(j.archive.sealed.at) })}</Badge> {can('manager') ? <button className="btn small" type="button" onClick={() => L.lib('GET', `/records/${r.id}/verify`).then((v) => toast(v.intact ? t('Intégrité vérifiée : rien n’a changé depuis le scellé.') : t('ATTENTION : le contenu ne correspond plus au scellé.'), !v.intact), fail)}>{t("Vérifier l'intégrité")}</button> : null}</> : null}</p>
          ) : null}
          <h3>{t('Historique des prêts')}</h3>
          {(j.loans || []).length ? (
            <ul className="lib-versions">{j.loans.map((l) => (
              <li key={l.id}><span>{l.user ? <b>{l.user} · </b> : null}{day(l.loanedAt)} → {l.returnedAt ? day(l.returnedAt) : t('en cours (échéance {date})', { date: day(l.dueAt) })}{l.renewals ? ` · ${t('{n} renouvellement(s)', { n: l.renewals })}` : ''}</span>
                <span className="row">{l.state === 'lost' ? <Badge tone="danger">{t('Perdu')}</Badge> : null}{l.lateDays ? <Badge tone="warn">{t('{n} j de retard', { n: l.lateDays })}</Badge> : null}{l.fine ? <Badge tone="danger">{l.fine}{l.finePaid >= l.fine ? ` · ${t('réglée')}` : ''}</Badge> : null}</span></li>
            ))}</ul>
          ) : <p className="muted small">{t('Aucun prêt.')}</p>}
          {sim.data && sim.data.similar.length ? <><h3>{t('Documents similaires')}</h3><ul className="lib-versions">{sim.data.similar.map((x) => <li key={x.id}><span>{x.title} <small className="muted">{[x.classCode, x.year].filter(Boolean).join(' · ')}</small></span><button className="btn small" type="button" onClick={() => { close(); modal(x.title, (c2) => <RecordModal L={L} id={x.id} close={c2} onChange={onChange} />, { wide: true }); }}>{t('Ouvrir')}</button></li>)}</ul></> : null}
          {(j.reservations || []).length ? <p className="muted small">{t('File d’attente')} : {j.reservations.map((x) => `${x.position}. ${x.user || t('quelqu’un')}${x.state === 'ready' ? ` (${t('à retirer')})` : ''}`).join(' · ')}</p> : null}
        </div>
      );
    }}
    </Loaded>
  );
}

const TYPES = { book: 'Livre', document: 'Document', report: 'Rapport', contract: 'Contrat', standard: 'Norme', digital: 'Support numérique', equipment: 'Matériel' };
const STATUS = { available: 'Disponible', loaned: 'Emprunté', reserved: 'Réservé', lost: 'Perdu', withdrawn: 'Retiré' };
const CONF = { public: 'Libre', internal: 'Interne', restricted: 'Restreint', secret: 'Secret' };
const COND = { new: 'Neuf', good: 'Bon', fair: 'Correct', worn: 'Usé', damaged: 'Abîmé', lost: 'Perdu' };
export const typeLabel = (v) => TYPES[v] || v;
export const statusLabel = (v) => STATUS[v] || v;
export const confLabel = (v) => CONF[v] || v;
export const condLabel = (v) => COND[v] || v;

function Facet({ title, items, value, onPick, t, raw }) {
  if (!items || !items.length) return null;
  return (
    <fieldset className="lib-facet">
      <legend>{title}</legend>
      <ul>{items.slice(0, 12).map((it) => (
        <li key={it.value}><button type="button" aria-pressed={String(value) === String(it.value)} onClick={() => onPick(String(value) === String(it.value) ? '' : it.value)}>
          <span>{raw ? it.label : t(it.label)}</span><small>{it.count}</small></button></li>
      ))}</ul>
    </fieldset>
  );
}

export default function Catalog({ L }) {
  const t = useT();
  const { modal, toast, can } = useWs();
  const [q, setQ] = useState(''); const [applied, setApplied] = useState('');
  const [f, setF] = useState({ type: '', class: '', year: '', language: '', status: '', conf: '' });
  const [page, setPage] = useState(1); const [sort, setSort] = useState('title'); const [avail, setAvail] = useState(false);
  const [sel, setSel] = useState([]);
  const csvIn = useRef(null);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (applied) p.set('q', applied);
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    p.set('page', String(page)); p.set('sort', sort); if (avail) p.set('available', '1');
    return p.toString();
  }, [applied, f, page, sort, avail]);
  const st = useLoad(() => L.lib('GET', `/catalog?${qs}`), [qs, L.tick]);
  const meta = useMeta(L);
  const cls = useLoad(() => L.lib('GET', '/classes'), [L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  const pick = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setPage(1); setSel([]); };
  const open = (r) => modal(r.title, (close) => <RecordModal L={L} id={r.id} close={close} onChange={() => { L.reload(); st.reload(); }} />, { wide: true });
  const create = () => meta.data && cls.data && modal(t('Nouvelle notice'), (close) => <RecordForm L={L} meta={meta.data} classes={cls.data.classes} onDone={() => { close(); L.reload(); st.reload(); }} />, { wide: true });
  const exportCsv = () => L.lib('GET', '/catalog/export.csv', undefined, { blob: true }).then((b) => saveBlob(b, 'catalogue-bibliotheque.csv'), fail);
  const importCsv = (file) => {
    if (!file) return;
    file.text().then((csv) => L.lib('POST', '/catalog/import', { csv, dryRun: true }).then((sim) => modal(t('Import du catalogue'), (close) => (
      <div>
        <p>{t('{c} notice(s) à créer, {u} à mettre à jour, {e} ligne(s) en erreur.', { c: sim.created, u: sim.updated, e: sim.errors.length })}</p>
        {sim.errors.length ? <ul className="lib-audit">{sim.errors.map((e) => <li key={e.line} className="bad"><b>{t('Ligne {n}', { n: e.line })}</b><span>{tsrv(e.message)}</span></li>)}</ul> : null}
        <div className="row"><button className="btn primary" type="button" disabled={!sim.created && !sim.updated} onClick={() => L.lib('POST', '/catalog/import', { csv }).then((r) => { toast(t('{c} créée(s), {u} mise(s) à jour.', { c: r.created, u: r.updated })); close(); L.reload(); st.reload(); }, fail)}>{t('Importer les lignes valides')}</button>
          <button className="btn" type="button" onClick={close}>{t('Annuler')}</button></div>
      </div>
    )), fail), fail);
  };
  const labels = () => L.lib('GET', `/labels?ids=${sel.join(',')}`).then((j) => modal(t('Étiquettes'), () => <Labels labels={j.labels} />, { wide: true }), fail);
  const moveSel = () => cls.data && modal(t('Déplacer {n} notice(s)', { n: sel.length }), (close) => (
    <Form submitText={t('Déplacer')} fields={[{ k: 'classId', label: t('Classe de destination'), type: 'select', value: '', options: [['', t('— Sans classe —')], ...cls.data.classes.map((c) => [String(c.id), `${c.code} — ${c.name}`])] }, { k: 'location', label: t('Nouvel emplacement (facultatif)'), value: '' }]}
      onSubmit={(v) => L.lib('POST', '/records/bulk', { ids: sel, classId: v.classId ? Number(v.classId) : null, ...(v.location ? { location: v.location } : {}) }).then((r) => { toast(t('{n} notice(s) modifiée(s).', { n: r.updated })); close(); setSel([]); L.reload(); st.reload(); })} />
  ));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <div className="ws-head"><div><h1>{t('Catalogue')}</h1><p className="muted">{t("Cherchez une ressource par titre, auteur, mot-clé, cote ou numéro d'inventaire. Les documents d'un bloc protégé n'apparaissent que si le bloc est ouvert.")}</p></div>
        {can('manager') ? <div className="row"><button className="btn primary small" type="button" onClick={create}>{t('Nouvelle notice')}</button><button className="btn small" type="button" onClick={exportCsv}>{t('Exporter en CSV')}</button><button className="btn small" type="button" onClick={() => csvIn.current && csvIn.current.click()}>{t('Importer un CSV')}</button><input ref={csvIn} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => { const x = e.target.files && e.target.files[0]; e.target.value = ''; importCsv(x); }} /></div> : null}</div>
      <form className="lib-bar" role="search" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); setPage(1); setSel([]); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Titre, auteur, mot-clé, cote…')} aria-label={t('Titre, auteur, mot-clé, cote…')} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Trier par')}><option value="title">{t('Titre')}</option><option value="recent">{t('Plus récentes')}</option><option value="year">{t('Année')}</option><option value="call">{t('Cote')}</option></select>
        <label className="lib-check"><input type="checkbox" checked={avail} onChange={(e) => { setAvail(e.target.checked); setPage(1); }} /> {t('Disponibles')}</label>
        <button className="btn primary small" type="submit">{t('Chercher')}</button>
      </form>
      <Loaded state={st}>{(j) => (
        <div className="lib-cat">
          <aside className="lib-facets" aria-label={t('Filtres')}>
            <Facet t={t} title={t('Type')} items={j.facets.type} value={f.type} onPick={pick('type')} />
            <Facet t={t} title={t('Classe')} items={j.facets.class} value={f.class} onPick={pick('class')} raw />
            <Facet t={t} title={t('Année')} items={j.facets.year} value={f.year} onPick={pick('year')} raw />
            <Facet t={t} title={t('Langue')} items={j.facets.language} value={f.language} onPick={pick('language')} raw />
            <Facet t={t} title={t('Statut')} items={j.facets.status} value={f.status} onPick={pick('status')} />
            {can('manager') ? <Facet t={t} title={t('Confidentialité')} items={j.facets.conf} value={f.conf} onPick={pick('conf')} /> : null}
          </aside>
          <div className="lib-cat-main">
            <p className="muted small" role="status">{t('{n} résultat(s)', { n: j.total })}</p>
            {can('manager') && sel.length ? <div className="row lib-actions"><b>{t('{n} sélectionnée(s)', { n: sel.length })}</b><button className="btn small" type="button" onClick={moveSel}>{t('Déplacer vers une classe')}</button><button className="btn small" type="button" onClick={labels}>{t('Étiquettes')}</button><button className="btn small" type="button" onClick={() => setSel([])}>{t('Tout désélectionner')}</button></div> : null}
            {j.records.length ? (
              <ul className="lib-docs">{j.records.map((r) => (
                <li key={r.id} className="lib-doc">
                  {can('manager') ? <input type="checkbox" className="lib-sel" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} aria-label={t('Sélectionner « {name} »', { name: r.title })} /> : null}
                  <span className="lib-kind" title={t(typeLabel(r.type))}>{t(typeLabel(r.type)).slice(0, 3).toUpperCase()}</span>
                  <div className="lib-doc-main">
                    <button type="button" className="lib-doc-name" onClick={() => open(r)}>{r.title}</button>
                    <small className="muted">{[r.author, r.year, r.classCode, r.callNumber, r.location].filter(Boolean).join(' · ')}</small>
                    {r.keywords.length ? <span className="lib-tags">{r.keywords.slice(0, 5).map((k) => <span key={k} className="lib-tag">{k}</span>)}</span> : null}
                  </div>
                  <Badge tone={r.loan && r.loan.overdue ? 'danger' : STATUS_TONE[r.status]}>{t(statusLabel(r.status))}{r.queue ? ` · ${r.queue}` : ''}</Badge>
                </li>
              ))}</ul>
            ) : <p className="ws-empty">{t('Aucune ressource ne correspond. Élargissez la recherche ou retirez un filtre.')}</p>}
            {j.total > j.size ? <div className="row"><button className="btn small" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Précédent')}</button><span className="muted small">{t('Page {p} sur {n}', { p: page, n: Math.ceil(j.total / j.size) })}</span><button className="btn small" type="button" disabled={page >= Math.ceil(j.total / j.size)} onClick={() => setPage(page + 1)}>{t('Suivant')}</button></div> : null}
          </div>
        </div>
      )}
      </Loaded>
    </>
  );
}

/** Étiquettes imprimables : code-barres Code 128 et QR du numéro d'inventaire (le SVG vient du serveur). */
export function Labels({ labels }) {
  const t = useT();
  return (
    <div>
      <div className="row lib-noprint"><button className="btn primary small" type="button" onClick={() => window.print()}>{t('Imprimer')}</button></div>
      <div className="lib-labels">{labels.map((l) => (
        <figure key={l.id} className="lib-label">
          <figcaption><b>{l.title}</b><small>{[l.callNumber, l.location].filter(Boolean).join(' · ')}</small></figcaption>
          <div className="lib-label-codes"><span dangerouslySetInnerHTML={{ __html: l.barcodeSvg }} /><span className="lib-qr" dangerouslySetInnerHTML={{ __html: l.qrSvg }} /></div>
          <small className="mono">{l.inventoryNo}</small>
        </figure>
      ))}</div>
    </div>
  );
}
