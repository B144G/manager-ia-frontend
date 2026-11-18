import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, Drawer, Segmented, Stat, Table } from '../../ui.jsx';
import { Kpis, Pill, Section, View, memberOptions, toInt, useAdm, useFormModal, useMembers } from './kit.jsx';

/* Procédures (SOP) : bibliothèque, modèles, statuts, versions avec comparaison, accusés de lecture. */

const useStatus = () => { const t = useT(); return { draft: t('Brouillon'), reviewed: t('Relue'), approved: t('Approuvée'), obsolete: t('Obsolète') }; };
const AUD = (aud) => (aud.all ? 'all' : aud.roles && aud.roles.length ? 'managers' : 'none');
const audOf = (v) => (v === 'all' ? { all: true } : v === 'managers' ? { roles: ['manager', 'admin', 'owner'] } : {});

export default function Sops() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, toast, fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const ST = useStatus();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);
  const sopForm = (s, tpl) => {
    const base = s || {};
    return form(s ? t('Modifier la procédure') : t('Nouvelle procédure'), [
      { k: 'title', label: t('Titre'), required: true, value: base.title || '' },
      { k: 'domain', label: t('Domaine'), value: base.domain || '' },
      { k: 'purpose', label: t('But de la procédure'), type: 'textarea', rows: 3, value: base.purpose || '' },
      { k: 'steps', label: t('Étapes (une par ligne)'), type: 'textarea', rows: 8, value: (base.steps || []).map((x) => x.text).join('\n') },
      { k: 'indicators', label: t('Indicateurs de suivi (un par ligne)'), type: 'textarea', rows: 2, value: (base.indicators || []).join('\n') },
      { k: 'ownerId', label: t('Responsable de la procédure'), type: 'select', options: memberOptions(members, t), value: base.ownerId ? String(base.ownerId) : '' },
      { k: 'reviewMonths', label: t('Révision tous les (mois)'), value: String(base.reviewMonths || 12) },
      { k: 'audience', label: t('Personnes concernées'), type: 'select', value: s ? AUD(base.audience || {}) : 'all', options: [['all', t('Toute l’équipe')], ['managers', t('Responsables et plus')], ['none', t('Personne en particulier')]] },
      { k: 'mandatoryRead', label: t('Lecture obligatoire avec accusé'), type: 'select', value: base.mandatoryRead ? '1' : '0', options: [['0', t('Non')], ['1', t('Oui')]] },
      ...(s ? [{ k: 'note', label: t('Note de version'), hint: t('Une procédure déjà relue ou approuvée repasse en brouillon (nouvelle version).') }] : []),
    ], (v) => {
      const body = { title: v.title, domain: v.domain, purpose: v.purpose, steps: v.steps.split('\n').map((x) => x.trim()).filter(Boolean), indicators: v.indicators.split('\n').map((x) => x.trim()).filter(Boolean), ownerId: toInt(v.ownerId), reviewMonths: Number(v.reviewMonths) || 12, audience: audOf(v.audience), mandatoryRead: v.mandatoryRead === '1', note: v.note };
      return s ? api('PUT', `/sops/${s.id}`, body) : api('POST', '/sops', { ...body, templateKey: tpl || undefined });
    }, { wide: true });
  };
  const pickTemplate = async () => {
    try {
      const j = await api('GET', '/sops/templates');
      form(t('Nouvelle procédure'), [{ k: 'tpl', label: t('Partir d’un modèle'), type: 'select', options: [['', t('Procédure vide')], ...j.templates.map((x) => [x.key, `${x.title} (${x.domain})`])] }], async (v) => {
        if (v.tpl) { const r = await api('POST', '/sops', { templateKey: v.tpl, mandatoryRead: false }); toast(t('Procédure créée à partir du modèle.')); setTimeout(() => setOpen(r.id), 50); } else setTimeout(() => sopForm(null), 50);
      }, { submitText: t('Continuer'), ok: false });
    } catch (e) { fail(e); }
  };
  return (
    <>
      <View path="/sops/my/pending">{(p) => (p.pending.length ? (
        <Alert tone="warn" title={t('À lire et à accuser')}>{p.pending.map((x) => <Button key={x.id} size="sm" variant="soft" onClick={() => setOpen(x.id)}>{x.title} (v{x.version})</Button>)}</Alert>
      ) : null)}
      </View>
      <View path={'/sops' + (filter ? `?status=${filter}` : '')} deps={[filter]}>{(d) => (
        <>
          <Kpis>
            <Stat icon="book-open" label={t('Procédures')} value={d.summary.total} />
            <Stat icon="check" label={t('Approuvées')} value={d.summary.approved} tone="ok" />
            <Stat icon="pen" label={t('Brouillons et relues')} value={d.summary.draft + d.summary.reviewed} />
            <Stat icon="clock" label={t('À réviser')} value={d.summary.reviewDue} tone={d.summary.reviewDue ? 'warn' : 'ok'} />
          </Kpis>
          <Section title={t('Bibliothèque de procédures')} subtitle={t('Qui fait quoi, dans quel ordre, avec quels documents et quels indicateurs.')}
            actions={<>{d.perms.write ? <Segmented label={t('Filtrer')} value={filter} onChange={setFilter} items={[{ id: '', label: t('Toutes') }, { id: 'draft', label: ST.draft }, { id: 'approved', label: ST.approved }, { id: 'obsolete', label: ST.obsolete }]} /> : null}{d.perms.write ? <Button variant="primary" icon="plus" onClick={pickTemplate}>{t('Nouvelle')}</Button> : null}</>}>
            <Table caption={t('Procédures')} rows={d.sops} empty={t('Aucune procédure pour le moment. Partez d’un modèle prêt à l’emploi.')} onRowClick={(r) => setOpen(r.id)} columns={[
              { key: 'code', label: t('Code') }, { key: 'title', label: t('Titre'), render: (r) => <b>{r.title}</b> }, { key: 'domain', label: t('Domaine') },
              { key: 'version', label: t('Version'), render: (r) => 'v' + r.version },
              { key: 'status', label: t('Statut'), render: (r) => <Pill k={r.status}>{ST[r.status]}</Pill> },
              { key: 'review', label: t('Révision'), render: (r) => (r.nextReview ? <Pill k={r.reviewDue ? 'overdue' : 'ok'}>{dateFr(r.nextReview)}</Pill> : '—') },
              { key: 'readers', label: t('Lue par'), render: (r) => (r.mandatoryRead ? `${r.readers.done}/${r.readers.total}` : '—') },
            ]} />
          </Section>
        </>
      )}
      </View>
      {open ? <SopDrawer id={open} onClose={() => setOpen(null)} edit={(s) => sopForm(s)} canWrite={perms.sop_write} canApprove={perms.sop_approve} reload={reload} /> : null}
    </>
  );
}

function SopDrawer({ id, onClose, edit, canWrite, canApprove, reload }) {
  const t = useT();
  const { api, tick } = useAdm();
  const { dateFr, toast, fail, confirm } = useWs();
  const ST = useStatus();
  const [s, setS] = useState(null);
  const [acks, setAcks] = useState(null);
  const [cmp, setCmp] = useState(null);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  useEffect(() => { api('GET', `/sops/${id}`).then((j) => { setS(j.sop); setFrom(String(Math.max(1, j.sop.version - 1))); setTo(String(j.sop.version)); }, (e) => { fail(e); onClose(); }); }, [id, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canWrite && s && s.mandatoryRead) api('GET', `/sops/${id}/acks`).then(setAcks, () => {}); }, [s && s.version, s && s.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = (path, msg, body) => async () => { try { await api('POST', `/sops/${id}/${path}`, body); toast(msg); reload(); } catch (e) { fail(e); } };
  if (!s) return <Drawer title={t('Procédure')} onClose={onClose} wide><p className="muted">{t('Chargement…')}</p></Drawer>;
  return (
    <Drawer title={`${s.code} · ${s.title}`} onClose={onClose} wide>
      <div className="adm-form">
        <p><Pill k={s.status}>{ST[s.status]}</Pill> <Badge>v{s.version}</Badge> {s.domain ? <Badge tone="outline">{s.domain}</Badge> : null} {s.owner ? <small>{t('Responsable')} : {s.owner}</small> : null}</p>
        {s.iMustRead ? <Alert tone="warn" title={t('Lecture obligatoire')}><Button size="sm" variant="primary" icon="check" onClick={act('ack', t('Accusé de lecture enregistré.'))}>{t('J’ai lu cette procédure')}</Button></Alert> : null}
        {s.purpose ? <><h3>{t('But')}</h3><p>{s.purpose}</p></> : null}
        <h3>{t('Étapes')}</h3>
        <ol className="adm-steps">{s.steps.map((x, i) => <li key={i}>{x.text}</li>)}</ol>
        {s.indicators.length ? <><h3>{t('Indicateurs')}</h3><ul>{s.indicators.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
        {s.nextReview ? <p className="muted">{t('Prochaine révision')} : {dateFr(s.nextReview)}</p> : null}
        <div className="row">
          {canWrite && s.status !== 'obsolete' ? <Button icon="pen" onClick={() => edit(s)}>{t('Modifier')}</Button> : null}
          {canWrite && s.status === 'draft' ? <Button onClick={act('review', t('Marquée comme relue.'))}>{t('Marquer comme relue')}</Button> : null}
          {canApprove && s.status === 'reviewed' ? <Button variant="primary" onClick={act('approve', t('Procédure approuvée.'))}>{t('Approuver')}</Button> : null}
          {canApprove && s.status === 'approved' ? <Button onClick={act('revalidate', t('Révision enregistrée.'))}>{t('Revalider sans changement')}</Button> : null}
          {canApprove && s.status !== 'obsolete' ? <Button variant="danger-outline" onClick={() => confirm(t('Rendre cette procédure obsolète ?'), act('obsolete', t('Procédure obsolète.')))}>{t('Rendre obsolète')}</Button> : null}
          {canWrite && s.mandatoryRead && s.status === 'approved' ? <Button onClick={act('remind', t('Rappel envoyé.'))}>{t('Relancer les lecteurs')}</Button> : null}
        </div>
        {acks ? <><h3>{t('Accusés de lecture')} ({acks.done}/{acks.total})</h3><ul className="adm-acks">{acks.people.map((p) => <li key={p.userId}>{p.readAt ? <Icon2 ok /> : <Icon2 />} {p.name} {p.readAt ? <small>{dateFr(p.readAt)}</small> : null}</li>)}</ul></> : null}
        {s.versions && s.versions.length > 1 ? (
          <>
            <h3>{t('Historique des versions')}</h3>
            <Table caption={t('Versions')} rows={s.versions} rowKey="version" columns={[{ key: 'version', label: t('Version'), render: (v) => 'v' + v.version }, { key: 'status', label: t('Statut'), render: (v) => ST[v.status] }, { key: 'by', label: t('Par') }, { key: 'at', label: t('Date'), render: (v) => dateFr(v.at) }, { key: 'note', label: t('Note') }]} />
            {canWrite ? <div className="row adm-cmp">
              <select aria-label={t('De la version')} value={from} onChange={(e) => setFrom(e.target.value)}>{s.versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}</select>
              <span>→</span>
              <select aria-label={t('À la version')} value={to} onChange={(e) => setTo(e.target.value)}>{s.versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}</select>
              <Button onClick={async () => { try { setCmp(await api('GET', `/sops/${id}/compare?from=${from}&to=${to}`)); } catch (e) { fail(e); } }}>{t('Comparer')}</Button>
            </div> : null}
            {cmp ? <Diff c={cmp} /> : null}
          </>
        ) : null}
      </div>
    </Drawer>
  );
}
const Icon2 = ({ ok }) => <span aria-hidden="true">{ok ? '✔' : '○'}</span>;
function Diff({ c }) {
  const t = useT();
  const LBL = { title: t('Titre'), purpose: t('But'), domain: t('Domaine'), ownerId: t('Responsable'), reviewMonths: t('Révision (mois)'), mandatoryRead: t('Lecture obligatoire') };
  if (c.identical) return <Alert tone="ok">{t('Les deux versions sont identiques.')}</Alert>;
  return (
    <div className="adm-diff">
      {c.changes.map((x) => <p key={x.field}><b>{LBL[x.field] || x.label}</b> : <del>{String(x.before ?? '—')}</del> → <ins>{String(x.after ?? '—')}</ins></p>)}
      {c.steps.removed.map((x, i) => <p key={'r' + i}><del>− {x.text}</del></p>)}
      {c.steps.added.map((x, i) => <p key={'a' + i}><ins>+ {x.text}</ins></p>)}
      {c.indicators.removed.map((x, i) => <p key={'ir' + i}><del>− {x}</del></p>)}
      {c.indicators.added.map((x, i) => <p key={'ia' + i}><ins>+ {x}</ins></p>)}
      {c.audienceChanged ? <p>{t('Les personnes concernées ont changé.')}</p> : null}
    </div>
  );
}
