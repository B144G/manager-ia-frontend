import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, ChartFrame, Drawer, EmptyState, Stat, Table } from '../../ui.jsx';
import { Donut } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, call, saveBlob, toInt, useAdm, useData, useFormModal, useMembers } from './kit.jsx';

/* GED et archives : classement, métadonnées, versions chiffrées, droits par confidentialité, recherche plein texte, verrou / prêt,
   archivage scellé, durées de conservation, destruction validée, corbeille, journal d'accès. */

const useConf = () => { const t = useT(); return { public: t('Public'), internal: t('Interne'), restricted: t('Restreint'), secret: t('Secret') }; };
const useDocStatus = () => { const t = useT(); return { active: t('En cours'), archived: t('Archivé'), destroyed: t('Détruit') }; };
const bytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : n >= 1024 ? Math.round(n / 1024) + ' Ko' : n + ' o');

export function Docs() {
  const t = useT();
  const { perms } = useAdm();
  const { dateFr } = useWs();
  const form = useFormModal();
  const CONF = useConf(); const ST = useDocStatus();
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [status, setStatus] = useState('live'); const [plan, setPlan] = useState(''); const [type, setType] = useState(''); const [conf, setConf] = useState('');
  const [open, setOpen] = useState(null);
  const { api } = useAdm();
  const plans = useData('/docs/plan'); const types = useData('/docs/types');
  const qs = `?status=${status}${qq ? '&q=' + encodeURIComponent(qq) : ''}${plan ? '&planId=' + plan : ''}${type ? '&typeId=' + type : ''}${conf ? '&confidentiality=' + conf : ''}`;
  const planOpts = (plans.data ? plans.data.plan : []); const typeOpts = (types.data ? types.data.types : []);
  const newDoc = () => form(t('Nouveau document'), [
    { k: 'title', label: t('Titre'), required: true },
    { k: 'planId', label: t('Rubrique du plan de classement'), type: 'select', options: [['', t('— Aucune —')], ...planOpts.map((p) => [String(p.id), (p.code ? p.code + ' ' : '') + p.name])] },
    { k: 'typeId', label: t('Type de document (durée de conservation)'), type: 'select', options: [['', t('— Aucun —')], ...typeOpts.map((x) => [String(x.id), x.name])] },
    { k: 'confidentiality', label: t('Confidentialité'), type: 'select', value: 'internal', options: Object.entries(CONF) },
    { k: 'docDate', label: t('Date du document'), type: 'date' },
    { k: 'author', label: t('Auteur') }, { k: 'tags', label: t('Étiquettes (séparées par des virgules)') },
    { k: 'description', label: t('Description'), type: 'textarea', rows: 3 },
  ], async (v) => { const r = await api('POST', '/docs', { title: v.title, planId: toInt(v.planId), typeId: toInt(v.typeId), confidentiality: v.confidentiality, docDate: v.docDate || null, author: v.author, tags: v.tags.split(',').map((x) => x.trim()).filter(Boolean), description: v.description }); setTimeout(() => setOpen(r.id), 80); }, { wide: true });
  return (
    <>
      <Section title={t('Documents')} subtitle={t('Cherchez par nom, étiquette ou contenu (fichiers texte et PDF).')}
        actions={<Button variant="primary" icon="plus" onClick={newDoc}>{t('Nouveau document')}</Button>}>
        <form className="adm-filters" role="search" onSubmit={(e) => { e.preventDefault(); setQq(q); }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un document…')} aria-label={t('Rechercher un document…')} />
          <select aria-label={t('Rubrique')} value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">{t('Toutes les rubriques')}</option>{planOpts.map((p) => <option key={p.id} value={p.id}>{(p.code ? p.code + ' ' : '') + p.name}</option>)}</select>
          <select aria-label={t('Type')} value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Tous les types')}</option>{typeOpts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select aria-label={t('Confidentialité')} value={conf} onChange={(e) => setConf(e.target.value)}><option value="">{t('Toutes confidentialités')}</option>{Object.entries(CONF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label={t('Statut')} value={status} onChange={(e) => setStatus(e.target.value)}><option value="live">{t('Tous')}</option><option value="active">{ST.active}</option><option value="archived">{ST.archived}</option><option value="destroyed">{ST.destroyed}</option><option value="trash">{t('Corbeille')}</option></select>
          <Button type="submit" icon="magnifying-glass">{t('Chercher')}</Button>
        </form>
        <View path={'/docs' + qs} deps={[qs]}>{(d) => (
          <Table caption={t('Documents')} rows={d.docs} empty={t('Aucun document trouvé.')} onRowClick={(r) => setOpen(r.id)} columns={[
            { key: 'title', label: t('Titre'), render: (r) => <><b>{r.title}</b>{r.snippet ? <small className="adm-snip">{r.snippet}</small> : null}</> },
            { key: 'code', label: t('Code') },
            { key: 'conf', label: t('Confidentialité'), render: (r) => <Pill k={r.confidentiality}>{CONF[r.confidentiality]}</Pill> },
            { key: 'version', label: t('Version'), render: (r) => (r.version ? 'v' + r.version : '—') },
            { key: 'status', label: t('Statut'), render: (r) => <><Pill k={r.status}>{ST[r.status]}</Pill>{r.lock ? <Badge tone="warn">{r.lock.kind === 'loan' ? t('Prêté') : t('Verrouillé')} · {r.lock.user}</Badge> : null}</> },
            { key: 'up', label: t('Mis à jour'), render: (r) => dateFr(r.updatedAt) },
          ]} />
        )}
        </View>
      </Section>
      {open ? <DocDrawer id={open} onClose={() => setOpen(null)} types={typeOpts} plans={planOpts} perms={perms} /> : null}
    </>
  );
}

function DocDrawer({ id, onClose, types, plans, perms }) {
  const t = useT();
  const { api, orgId, tick, reload } = useAdm();
  const { dateFr, toast, fail, confirm } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const CONF = useConf(); const ST = useDocStatus();
  const [d, setD] = useState(null);
  const [verify, setVerify] = useState(null);
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  useEffect(() => { api('GET', `/docs/${id}`).then(setD, (e) => { fail(e); onClose(); }); }, [id, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Drawer title={t('Document')} onClose={onClose} wide><p className="muted">{t('Chargement…')}</p></Drawer>;
  const doc = d.doc;
  const run = (fn, msg) => async () => { try { await fn(); if (msg) toast(msg); reload(); } catch (e) { fail(e); } };
  const upload = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    setBusy(true);
    try { await api('POST', `/docs/${id}/file?name=${encodeURIComponent(f.name)}`, f); toast(t('Version ajoutée.')); reload(); } catch (e) { fail(e); }
    setBusy(false);
  };
  const download = async (n) => { try { saveBlob(await call(orgId, 'GET', `/docs/${id}/download?v=${n}`, undefined, { blob: true }), (d.versions.find((v) => v.n === n) || {}).name || 'document'); } catch (e) { fail(e); } };
  const trashed = Boolean(doc.deletedAt);
  return (
    <Drawer title={doc.title} onClose={onClose} wide>
      <div className="adm-form">
        <p><Pill k={doc.status}>{ST[doc.status]}</Pill> <Pill k={doc.confidentiality}>{CONF[doc.confidentiality]}</Pill> {doc.code ? <Badge tone="outline">{doc.code}</Badge> : null} {doc.sealed ? <Badge tone="info" dot>{t('Scellé')}</Badge> : null}</p>
        {doc.description ? <p>{doc.description}</p> : null}
        <dl className="adm-dl">
          <dt>{t('Auteur')}</dt><dd>{doc.author || doc.creator || '—'}</dd>
          <dt>{t('Date du document')}</dt><dd>{doc.docDate ? dateFr(doc.docDate) : '—'}</dd>
          <dt>{t('À archiver le')}</dt><dd>{doc.archiveDue ? dateFr(doc.archiveDue) : '—'}</dd>
          <dt>{t('Fin de conservation')}</dt><dd>{doc.destroyDue ? dateFr(doc.destroyDue) : t('Conservation permanente ou sans règle')}</dd>
          <dt>{t('Étiquettes')}</dt><dd>{doc.tags.length ? doc.tags.join(', ') : '—'}</dd>
        </dl>
        {doc.lock ? <Alert tone="warn" title={doc.lock.kind === 'loan' ? t('Document prêté') : t('Document verrouillé')}>{doc.lock.user} · {t('jusqu’au')} {dateFr(doc.lock.due)} {doc.lock.note}</Alert> : null}
        {doc.destroyState === 'requested' ? <Alert tone="warn" title={t('Destruction demandée')}>{t('En attente de validation par une autre personne.')}</Alert> : null}
        <div className="row">
          {doc.canEdit && !trashed ? <><input ref={file} type="file" hidden onChange={upload} /><Button icon="upload" loading={busy} onClick={() => file.current && file.current.click()}>{doc.hasFile ? t('Ajouter une version') : t('Joindre un fichier')}</Button></> : null}
          {doc.canEdit && !trashed ? <Button icon="pen" onClick={() => form(t('Modifier le document'), [
            { k: 'title', label: t('Titre'), value: doc.title, required: true }, { k: 'code', label: t('Code'), value: doc.code },
            { k: 'planId', label: t('Rubrique'), type: 'select', value: doc.planId ? String(doc.planId) : '', options: [['', t('— Aucune —')], ...plans.map((p) => [String(p.id), p.name])] },
            { k: 'typeId', label: t('Type de document'), type: 'select', value: doc.typeId ? String(doc.typeId) : '', options: [['', t('— Aucun —')], ...types.map((x) => [String(x.id), x.name])] },
            { k: 'confidentiality', label: t('Confidentialité'), type: 'select', value: doc.confidentiality, options: Object.entries(CONF) },
            { k: 'docDate', label: t('Date du document'), type: 'date', value: doc.docDate || '' }, { k: 'tags', label: t('Étiquettes (séparées par des virgules)'), value: doc.tags.join(', ') },
            { k: 'users', label: t('Personnes autorisées en plus'), type: 'select', value: doc.allowedUsers[0] ? String(doc.allowedUsers[0]) : '', options: [['', t('— Personne —')], ...members.map((m) => [String(m.userId), m.name])] },
            { k: 'description', label: t('Description'), type: 'textarea', value: doc.description },
          ], (v) => api('PUT', `/docs/${id}`, { title: v.title, code: v.code, planId: toInt(v.planId), typeId: toInt(v.typeId), confidentiality: v.confidentiality, docDate: v.docDate || null, tags: v.tags.split(',').map((x) => x.trim()).filter(Boolean), allowedUsers: v.users ? [Number(v.users)] : [], description: v.description }), { wide: true })}>{t('Modifier')}</Button> : null}
          {doc.status === 'active' && !trashed ? (doc.lock ? <Button onClick={run(() => api('POST', `/docs/${id}/unlock`), t('Libéré.'))}>{t('Libérer')}</Button> : <><Button onClick={run(() => api('POST', `/docs/${id}/lock`, { kind: 'edit' }), t('Verrouillé.'))}>{t('Verrouiller')}</Button><Button onClick={run(() => api('POST', `/docs/${id}/lock`, { kind: 'loan' }), t('Prêt enregistré (7 jours).'))}>{t('Prêter')}</Button></>) : null}
          {perms.docs_manage && doc.status === 'active' && !trashed ? <Button variant="soft" icon="lock" onClick={() => confirm(t('Archiver et sceller ce document ? Il ne pourra plus être modifié.'), run(() => api('POST', `/docs/${id}/archive`), t('Document archivé et scellé.')))}>{t('Archiver')}</Button> : null}
          {doc.sealed ? <Button icon="shield-halved" onClick={async () => { try { setVerify(await api('GET', `/docs/${id}/verify`)); } catch (e) { fail(e); } }}>{t('Vérifier l’intégrité')}</Button> : null}
          {perms.docs_manage && doc.status !== 'destroyed' && !trashed && doc.destroyDue && doc.destroyState !== 'requested' ? <Button variant="danger-outline" onClick={() => form(t('Demander la destruction'), [{ k: 'reason', label: t('Motif'), required: true }], (v) => api('POST', `/docs/${id}/destroy-request`, { reason: v.reason }))}>{t('Demander la destruction')}</Button> : null}
          {perms.docs_destroy && doc.destroyState === 'requested' ? <><Button variant="danger" onClick={() => confirm(t('Détruire définitivement le fichier ? L’empreinte sera conservée comme preuve.'), run(() => api('POST', `/docs/${id}/destroy-decision`, { approve: true }), t('Document détruit.')))}>{t('Valider la destruction')}</Button><Button onClick={run(() => api('POST', `/docs/${id}/destroy-decision`, { approve: false }), t('Destruction refusée.'))}>{t('Refuser')}</Button></> : null}
          {doc.canEdit && doc.status === 'active' && !trashed ? <Button variant="ghost" icon="trash" onClick={run(() => api('POST', `/docs/${id}/trash`), t('Mis à la corbeille.'))}>{t('Corbeille')}</Button> : null}
          {trashed ? <Button icon="rotate-right" onClick={run(() => api('POST', `/docs/${id}/restore`), t('Restauré.'))}>{t('Restaurer')}</Button> : null}
        </div>
        {verify ? (verify.ok ? <Alert tone="ok" title={t('Intégrité conforme')}>{t('Les fichiers correspondent à leurs empreintes.')} {verify.sealHash.slice(0, 16)}…</Alert> : <Alert tone="danger" title={t('Intégrité compromise')}><ul>{verify.problems.map((p, i) => <li key={i}>{p}</li>)}</ul></Alert>) : null}
        <h3>{t('Versions')}</h3>
        <Table caption={t('Versions')} rows={d.versions} rowKey="n" empty={t('Aucun fichier joint.')} columns={[
          { key: 'n', label: t('Version'), render: (v) => 'v' + v.n }, { key: 'name', label: t('Fichier') }, { key: 'size', label: t('Taille'), render: (v) => bytes(v.size) },
          { key: 'by', label: t('Par') }, { key: 'at', label: t('Date'), render: (v) => dateFr(v.at) }, { key: 'sha', label: t('Empreinte'), render: (v) => <code>{v.sha256.slice(0, 10)}…</code> },
          { key: 'dl', label: '', render: (v) => (v.hasData ? <Button size="sm" variant="ghost" icon="download" onClick={() => download(v.n)}>{t('Télécharger')}</Button> : <small>{t('Détruit')}</small>) },
        ]} />
        {d.log.length ? <><h3>{t('Journal du document')}</h3><ul className="adm-log">{d.log.slice(0, 15).map((l, i) => <li key={i}><small>{dateFr(l.at)}</small> {l.user} · {l.action} {l.detail}</li>)}</ul></> : null}
      </div>
    </Drawer>
  );
}

// ---------- Archives et échéances ----------
export function Archive() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, toast, fail, confirm } = useWs();
  const CONF = useConf(); const ST = useDocStatus();
  const stats = useData('/docs/stats');
  const form = useFormModal();
  const act = (fn, msg) => async () => { try { await fn(); toast(msg); reload(); } catch (e) { fail(e); } };
  return (
    <>
      {stats.data ? (
        <Kpis>
          <Stat icon="folder" label={t('Documents')} value={stats.data.total} />
          <Stat icon="clock" label={t('À archiver')} value={stats.data.toArchive} tone={stats.data.toArchive ? 'warn' : 'ok'} />
          <Stat icon="trash" label={t('Au terme de leur conservation')} value={stats.data.toDestroy} tone={stats.data.toDestroy ? 'warn' : 'ok'} />
          <Stat icon="gavel" label={t('Destructions à valider')} value={stats.data.awaitingDestruction} tone={stats.data.awaitingDestruction ? 'warn' : 'ok'} />
          <Stat icon="database" label={t('Espace utilisé')} value={bytes(stats.data.bytes)} sub={`/ ${bytes(stats.data.quotaBytes)}`} />
        </Kpis>
      ) : null}
      {stats.data ? (
        <Grid cols={2}>
          <ChartFrame title={t('Documents par statut')} summary={t('Répartition des documents selon leur statut.')} height={200}><Donut data={stats.data.byStatus.map((s) => ({ name: ST[s.key] || s.key, value: s.count }))} center={String(stats.data.total)} sub={t('documents')} /></ChartFrame>
          <ChartFrame title={t('Documents par confidentialité')} summary={t('Répartition des documents selon leur niveau de confidentialité.')} height={200}><Donut data={stats.data.byConfidentiality.map((s) => ({ name: CONF[s.key] || s.key, value: s.count }))} center={String(stats.data.total)} sub={t('documents')} /></ChartFrame>
        </Grid>
      ) : null}
      <View path="/docs/due">{(d) => (
        <>
          <Section title={t('Documents à archiver')} subtitle={t('Fin de la période en archivage courant, d’après la règle de conservation du type.')}>
            <Table caption={t('À archiver')} rows={d.toArchive} empty={t('Rien à archiver.')} columns={[{ key: 'title', label: t('Titre'), render: (r) => <b>{r.title}</b> }, { key: 'typeName', label: t('Type') }, { key: 'archiveDue', label: t('Échéance'), render: (r) => <Pill k={r.archiveOverdue ? 'overdue' : 'pending'}>{dateFr(r.archiveDue)}</Pill> },
              { key: 'a', label: '', render: (r) => (perms.docs_manage ? <Button size="sm" onClick={() => confirm(t('Archiver et sceller ce document ?'), act(() => api('POST', `/docs/${r.id}/archive`), t('Document archivé et scellé.')))}>{t('Archiver')}</Button> : null) }]} />
          </Section>
          <Section title={t('Documents au terme de leur conservation')} subtitle={t('La destruction demande une validation par une seconde personne.')}>
            <Table caption={t('À détruire')} rows={d.toDestroy} empty={t('Rien à détruire.')} columns={[{ key: 'title', label: t('Titre'), render: (r) => <b>{r.title}</b> }, { key: 'typeName', label: t('Type') }, { key: 'destroyDue', label: t('Fin de conservation'), render: (r) => <Pill k={r.destroyOverdue ? 'overdue' : 'pending'}>{dateFr(r.destroyDue)}</Pill> },
              { key: 'a', label: '', render: (r) => (perms.docs_manage && r.destroyOverdue ? <Button size="sm" variant="danger-outline" onClick={() => form(t('Demander la destruction'), [{ k: 'reason', label: t('Motif'), required: true }], (v) => api('POST', `/docs/${r.id}/destroy-request`, { reason: v.reason }))}>{t('Demander la destruction')}</Button> : null) }]} />
          </Section>
          <Section title={t('Destructions à valider')}>
            <Table caption={t('Destructions')} rows={d.awaiting} empty={t('Aucune destruction en attente.')} columns={[{ key: 'title', label: t('Titre'), render: (r) => <b>{r.title}</b> }, { key: 'destroyDue', label: t('Fin de conservation'), render: (r) => dateFr(r.destroyDue) },
              { key: 'a', label: '', render: (r) => (perms.docs_destroy ? <span className="row"><Button size="sm" variant="danger" onClick={() => confirm(t('Détruire définitivement le fichier ? L’empreinte sera conservée comme preuve.'), act(() => api('POST', `/docs/${r.id}/destroy-decision`, { approve: true }), t('Document détruit.')))}>{t('Valider')}</Button><Button size="sm" onClick={act(() => api('POST', `/docs/${r.id}/destroy-decision`, { approve: false }), t('Destruction refusée.'))}>{t('Refuser')}</Button></span> : null) }]} />
          </Section>
        </>
      )}
      </View>
    </>
  );
}

// ---------- Plan de classement et règles de conservation ----------
export function Retention() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { toast, fail, confirm } = useWs();
  const form = useFormModal();
  const BASIS = { doc_date: t('Date du document'), created: t('Date d’enregistrement') };
  const END = { destroy: t('Détruire'), review: t('Revoir'), keep: t('Conserver') };
  const typeForm = (x) => form(x ? t('Modifier la règle') : t('Nouvelle règle de conservation'), [
    { k: 'name', label: t('Type de document'), value: x ? x.name : '', required: true },
    { k: 'activeYears', label: t('Années en archivage courant (avant l’archive)'), value: x ? String(x.activeYears) : '1' },
    { k: 'retentionYears', label: t('Durée totale de conservation en années (0 = permanente)'), value: x ? String(x.retentionYears) : '5' },
    { k: 'basis', label: t('Calculée à partir de'), type: 'select', value: x ? x.basis : 'doc_date', options: Object.entries(BASIS) },
    { k: 'endAction', label: t('À la fin'), type: 'select', value: x ? x.endAction : 'review', options: Object.entries(END) },
    { k: 'note', label: t('Remarque'), value: x ? x.note : '' },
  ], (v) => api(x ? 'PUT' : 'POST', x ? `/docs/types/${x.id}` : '/docs/types', { ...v, activeYears: Number(String(v.activeYears).replace(',', '.')), retentionYears: Number(String(v.retentionYears).replace(',', '.')) }), { wide: true });
  return (
    <>
      <View path="/docs/types">{(d) => (
        <Section title={t('Durées de conservation')} subtitle={t('Règles indicatives et réglables : confirmez-les avec votre conseil juridique ou comptable. Changer une règle recalcule les échéances des documents.')}
          actions={perms.docs_manage ? <><Button icon="wand-magic-sparkles" onClick={async () => { try { const r = await api('POST', '/docs/types/seed'); toast(t('{n} règle(s) ajoutée(s).', { n: r.added })); reload(); } catch (e) { fail(e); } }}>{t('Ajouter les règles suggérées')}</Button><Button variant="primary" icon="plus" onClick={() => typeForm(null)}>{t('Règle')}</Button></> : null}>
          <Table caption={t('Règles')} rows={d.types} empty={t('Aucune règle. Ajoutez les règles suggérées pour commencer.')} columns={[
            { key: 'name', label: t('Type'), render: (x) => <b>{x.name}</b> },
            { key: 'a', label: t('Courant'), align: 'r', render: (x) => `${x.activeYears} ${t('an(s)')}` },
            { key: 'r', label: t('Total'), align: 'r', render: (x) => (x.retentionYears ? `${x.retentionYears} ${t('an(s)')}` : t('Permanente')) },
            { key: 'basis', label: t('À partir de'), render: (x) => BASIS[x.basis] }, { key: 'end', label: t('À la fin'), render: (x) => END[x.endAction] }, { key: 'documents', label: t('Documents'), align: 'r' },
            { key: 'act', label: '', render: (x) => (perms.docs_manage ? <span className="row"><Button size="sm" variant="ghost" icon="pen" iconOnly label={t('Modifier')} onClick={() => typeForm(x)} /><Button size="sm" variant="ghost" icon="trash" iconOnly label={t('Supprimer')} onClick={() => confirm(t('Supprimer cette règle ? Les documents n’auront plus d’échéance.'), async () => { try { await api('DELETE', `/docs/types/${x.id}`); reload(); } catch (e) { fail(e); } })} /></span> : null) },
          ]} />
        </Section>
      )}
      </View>
      <View path="/docs/plan">{(d) => {
        const depth = (p) => { let n = 0; let c = p; const by = new Map(d.plan.map((x) => [x.id, x])); while (c && c.parentId && n < 10) { c = by.get(c.parentId); n++; } return n; };
        return (
          <Section title={t('Plan de classement')} subtitle={t('Les rubriques où vous rangez vos documents.')}
            actions={perms.docs_manage ? <Button variant="primary" icon="plus" onClick={() => form(t('Nouvelle rubrique'), [{ k: 'code', label: t('Code') }, { k: 'name', label: t('Nom'), required: true }, { k: 'parentId', label: t('Rubrique parente'), type: 'select', options: [['', t('— Racine —')], ...d.plan.map((p) => [String(p.id), p.name])] }], (v) => api('POST', '/docs/plan', { code: v.code, name: v.name, parentId: toInt(v.parentId) }))}>{t('Rubrique')}</Button> : null}>
            {!d.plan.length ? <EmptyState icon="folder-tree" title={t('Plan vide')}>{t('Ajoutez des rubriques, par exemple Comptabilité, Ressources humaines, Contrats.')}</EmptyState> : d.plan.map((p) => (
              <div className="adm-line" key={p.id} style={{ paddingLeft: depth(p) * 20 }}><span><b>{p.code} {p.name}</b></span>{perms.docs_manage ? <Button size="sm" variant="ghost" icon="trash" iconOnly label={t('Supprimer')} onClick={() => confirm(t('Supprimer cette rubrique ? Les documents restent, sans rubrique.'), async () => { try { await api('DELETE', `/docs/plan/${p.id}`); reload(); } catch (e) { fail(e); } })} /> : null}</div>
            ))}
          </Section>
        );
      }}
      </View>
    </>
  );
}

export function DocLog() {
  const t = useT();
  const { dateFr } = useWs();
  return (
    <View path="/docs/log">{(d) => (
      <Section title={t('Journal d’accès aux documents')} subtitle={t('Qui a ouvert, téléchargé, modifié, archivé ou détruit quel document.')}>
        <Table caption={t('Journal')} rows={d.log} empty={t('Journal vide.')} columns={[{ key: 'at', label: t('Date'), render: (l) => dateFr(l.at) }, { key: 'user', label: t('Personne') }, { key: 'action', label: t('Action') }, { key: 'title', label: t('Document') }, { key: 'detail', label: t('Détail') }]} />
      </Section>
    )}
    </View>
  );
}
