import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, ChartFrame, Drawer, Stat, Table } from '../../ui.jsx';
import { Bars, Donut } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, memberOptions, num, toInt, useAdm, useData, useFormModal, useMembers } from './kit.jsx';

/* Contrats (échéances, préavis, reconduction tacite) et registre de conformité (obligations récurrentes, preuves).
   Aucun texte de loi n'est fourni : l'entreprise renseigne elle-même l'autorité et la référence. */

const useKinds = () => { const t = useT(); return { client: t('Client'), supplier: t('Fournisseur'), lease: t('Bail'), insurance: t('Assurance'), employment: t('Travail'), partnership: t('Partenariat'), service: t('Prestation'), other: t('Autre') }; };

export function Contracts() {
  const t = useT();
  const { api, reload } = useAdm();
  const { dateFr, money, toast, fail, confirm } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const KIND = useKinds();
  const PER = { once: t('Une fois'), monthly: t('Par mois'), quarterly: t('Par trimestre'), semiannual: t('Par semestre'), yearly: t('Par an') };
  const ST = { draft: t('Brouillon'), active: t('Actif'), terminated: t('Résilié'), expired: t('Expiré') };
  const AL = { expired: t('Contrat expiré'), notice_missed: t('Préavis dépassé : reconduit tacitement'), notice_soon: t('Dernier jour pour résilier proche'), ending_soon: t('Arrive à échéance') };
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState(null);
  const docs = useData('/docs');
  const edit = (c) => form(c ? t('Modifier le contrat') : t('Nouveau contrat'), [
    { k: 'title', label: t('Intitulé'), value: c ? c.title : '', required: true }, { k: 'kind', label: t('Type'), type: 'select', value: c ? c.kind : 'client', options: Object.entries(KIND) },
    { k: 'counterparty', label: t('Partie adverse'), value: c ? c.counterparty : '' }, { k: 'parties', label: t('Parties au contrat'), value: c ? c.parties : '' },
    { k: 'startDate', label: t('Début'), type: 'date', value: c ? c.startDate || '' : '' }, { k: 'endDate', label: t('Fin'), type: 'date', value: c ? c.endDate || '' : '' },
    { k: 'noticeDays', label: t('Préavis de résiliation (jours)'), value: String(c ? c.noticeDays : 0) },
    { k: 'tacitRenewal', label: t('Reconduction tacite'), type: 'select', value: c && c.tacitRenewal ? '1' : '0', options: [['0', t('Non')], ['1', t('Oui')]] }, { k: 'renewalMonths', label: t('Durée de reconduction (mois)'), value: String(c ? c.renewalMonths : 12) },
    { k: 'amount', label: t('Montant'), value: String(c ? c.amount : 0) }, { k: 'periodicity', label: t('Périodicité du montant'), type: 'select', value: c ? c.periodicity : 'once', options: Object.entries(PER) },
    { k: 'ownerId', label: t('Responsable du suivi'), type: 'select', value: c && c.ownerId ? String(c.ownerId) : '', options: memberOptions(members, t) },
    ...(c ? [{ k: 'status', label: t('Statut'), type: 'select', value: c.status, options: Object.entries(ST) }] : []),
    { k: 'docId', label: t('Pièce jointe (document de la GED)'), type: 'select', value: c && c.docIds[0] ? String(c.docIds[0]) : '', options: [['', t('— Aucune —')], ...(docs.data ? docs.data.docs.map((x) => [String(x.id), x.title]) : [])] },
    { k: 'notes', label: t('Notes'), type: 'textarea', rows: 3, value: c ? c.notes : '' },
  ], (v) => api(c ? 'PUT' : 'POST', c ? `/contracts/contracts/${c.id}` : '/contracts/contracts', { title: v.title, kind: v.kind, counterparty: v.counterparty, parties: v.parties, startDate: v.startDate || null, endDate: v.endDate || null, noticeDays: Number(v.noticeDays) || 0, tacitRenewal: v.tacitRenewal === '1', renewalMonths: Number(v.renewalMonths) || 12, amount: num(v.amount) || 0, periodicity: v.periodicity, ownerId: toInt(v.ownerId), ...(v.status ? { status: v.status } : {}), docIds: v.docId ? [Number(v.docId)] : [], notes: v.notes }), { wide: true });
  return (
    <View path={'/contracts/contracts' + (kind ? `?kind=${kind}` : '')} deps={[kind]}>{(d) => (
      <>
        <Kpis>
          <Stat icon="file-contract" label={t('Contrats actifs')} value={d.summary.active} />
          <Stat icon="bell" label={t('Alertes d’échéance')} value={d.summary.alerts} tone={d.summary.alerts ? 'warn' : 'ok'} />
          <Stat icon="coins" label={t('Valeur annuelle')} value={money(d.summary.annualValue)} />
        </Kpis>
        <Grid cols={2}>
          <ChartFrame title={t('Contrats par type')} summary={t('Nombre de contrats actifs par type.')} height={210}><Donut data={d.summary.byKind.map((k) => ({ name: KIND[k.key], value: k.count }))} center={String(d.summary.active)} sub={t('contrats')} /></ChartFrame>
          <ChartFrame title={t('Échéances des 12 prochains mois')} summary={t('Nombre de contrats qui arrivent à échéance chaque mois.')} height={210}><Bars data={d.byMonth} xKey="month" series={[{ key: 'count', label: t('Contrats') }]} /></ChartFrame>
        </Grid>
        {d.summary.alerts ? <Alert tone="warn" title={t('Contrats à surveiller')}>{d.contracts.filter((c) => c.alert).map((c) => <div key={c.id}><b>{c.title}</b> · {AL[c.alert]} · {c.alert.startsWith('notice') ? `${t('résilier avant le')} ${dateFr(c.noticeDeadline)}` : `${t('fin le')} ${dateFr(c.effectiveEnd)}`}</div>)}</Alert> : null}
        <Section title={t('Registre des contrats')} actions={<><select aria-label={t('Type')} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{t('Tous les types')}</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{d.perms.manage ? <><Button onClick={async () => { try { const r = await api('POST', '/contracts/contracts/import-legal'); toast(t('{n} contrat(s) repris du module Juridique.', { n: r.imported })); reload(); } catch (e) { fail(e); } }}>{t('Reprendre ceux du Juridique')}</Button><Button variant="primary" icon="plus" onClick={() => edit(null)}>{t('Contrat')}</Button></> : null}</>}>
          <Table caption={t('Contrats')} rows={d.contracts} empty={t('Aucun contrat.')} onRowClick={(c) => setOpen(c)} columns={[
            { key: 'ref', label: t('Réf.') }, { key: 'title', label: t('Contrat'), render: (c) => <><b>{c.title}</b><small>{c.counterparty}</small></> }, { key: 'kind', label: t('Type'), render: (c) => KIND[c.kind] },
            { key: 'end', label: t('Fin'), render: (c) => (c.effectiveEnd ? dateFr(c.effectiveEnd) : '—') + (c.renewals ? ` (+${c.renewals})` : '') },
            { key: 'notice', label: t('Résilier avant'), render: (c) => (c.noticeDeadline ? dateFr(c.noticeDeadline) : '—') },
            { key: 'tacit', label: t('Tacite'), render: (c) => (c.tacitRenewal ? t('Oui') : t('Non')) },
            { key: 'amount', label: t('Montant'), align: 'r', render: (c) => (c.amount ? money(c.amount) : '—') },
            { key: 'st', label: t('Situation'), render: (c) => (c.alert ? <Pill k={c.alert}>{AL[c.alert]}</Pill> : <Pill k={c.status}>{ST[c.status] || c.status}</Pill>) },
          ]} />
        </Section>
        {open ? (
          <Drawer title={open.title} onClose={() => setOpen(null)}>
            <div className="adm-form">
              <p>{open.ref} · {KIND[open.kind]} · {open.counterparty}</p>
              <dl className="adm-dl"><dt>{t('Début')}</dt><dd>{open.startDate ? dateFr(open.startDate) : '—'}</dd><dt>{t('Fin actuelle')}</dt><dd>{open.effectiveEnd ? dateFr(open.effectiveEnd) : '—'}</dd><dt>{t('Dernier jour pour résilier')}</dt><dd>{open.noticeDeadline ? dateFr(open.noticeDeadline) : '—'}</dd><dt>{t('Montant')}</dt><dd>{open.amount ? `${money(open.amount)} · ${PER[open.periodicity]}` : '—'}</dd><dt>{t('Responsable')}</dt><dd>{open.owner || '—'}</dd></dl>
              {open.notes ? <p>{open.notes}</p> : null}
              {d.perms.manage ? <div className="row">
                <Button icon="pen" onClick={() => { const c = open; setOpen(null); edit(c); }}>{t('Modifier')}</Button>
                <Button onClick={() => form(t('Renouveler le contrat'), [{ k: 'endDate', label: t('Nouvelle date de fin (vide = reconduction standard)'), type: 'date' }, { k: 'amount', label: t('Nouveau montant (vide = inchangé)') }], (v) => api('POST', `/contracts/contracts/${open.id}/renew`, { endDate: v.endDate || undefined, amount: v.amount ? num(v.amount) : undefined }))}>{t('Renouveler')}</Button>
                <Button variant="danger-outline" onClick={() => confirm(t('Marquer ce contrat comme résilié ?'), async () => { try { await api('POST', `/contracts/contracts/${open.id}/terminate`, {}); setOpen(null); reload(); } catch (e) { fail(e); } })}>{t('Résilier')}</Button>
              </div> : null}
            </div>
          </Drawer>
        ) : null}
      </>
    )}
    </View>
  );
}

export function Compliance() {
  const t = useT();
  const { api } = useAdm();
  const { dateFr, toast, fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const CAT = { declaration: t('Déclaration'), license: t('Licence / autorisation'), insurance: t('Assurance'), register: t('Registre obligatoire'), audit: t('Contrôle'), other: t('Autre') };
  const ST = { todo: t('À faire'), in_progress: t('En cours'), done: t('Accomplie'), na: t('Sans objet') };
  const sug = async () => {
    try {
      const j = await api('GET', '/contracts/compliance/suggestions');
      form(t('Suggestions génériques'), j.suggestions.map((s) => ({ k: 's' + s.index, label: s.title, type: 'select', value: '0', options: [['0', t('Ne pas ajouter')], ['1', t('Ajouter')]], hint: s.note })), async (v) => { const r = await api('POST', '/contracts/compliance/suggestions/add', { indexes: j.suggestions.filter((s) => v['s' + s.index] === '1').map((s) => s.index) }); toast(t('{n} obligation(s) ajoutée(s).', { n: r.added })); }, { wide: true, ok: false });
    } catch (e) { fail(e); }
  };
  const edit = (c) => form(c ? t('Modifier l’obligation') : t('Nouvelle obligation'), [
    { k: 'title', label: t('Obligation'), value: c ? c.title : '', required: true }, { k: 'category', label: t('Catégorie'), type: 'select', value: c ? c.category : 'declaration', options: Object.entries(CAT) },
    { k: 'authority', label: t('Autorité ou organisme concerné'), value: c ? c.authority : '' }, { k: 'referenceText', label: t('Référence du texte applicable (à renseigner par l’entreprise)'), value: c ? c.referenceText : '' },
    { k: 'frequencyMonths', label: t('Se répète tous les (mois, 0 = ponctuelle)'), value: String(c ? c.frequencyMonths : 0) }, { k: 'dueDate', label: t('Prochaine échéance'), type: 'date', value: c ? c.dueDate || '' : '' },
    { k: 'responsibleId', label: t('Responsable'), type: 'select', value: c && c.responsibleId ? String(c.responsibleId) : '', options: memberOptions(members, t) },
    ...(c ? [{ k: 'status', label: t('Statut'), type: 'select', value: c.status, options: Object.entries(ST) }] : []), { k: 'notes', label: t('Notes'), type: 'textarea', rows: 3, value: c ? c.notes : '' },
  ], (v) => api(c ? 'PUT' : 'POST', c ? `/contracts/compliance/${c.id}` : '/contracts/compliance', { title: v.title, category: v.category, authority: v.authority, referenceText: v.referenceText, frequencyMonths: Number(v.frequencyMonths) || 0, dueDate: v.dueDate || null, responsibleId: toInt(v.responsibleId), ...(v.status ? { status: v.status } : {}), notes: v.notes }), { wide: true });
  return (
    <View path="/contracts/compliance">{(d) => (
      <>
        <Kpis>
          <Stat icon="gavel" label={t('Obligations suivies')} value={d.summary.total} />
          <Stat icon="clock" label={t('En retard')} value={d.summary.overdue} tone={d.summary.overdue ? 'danger' : 'ok'} />
          <Stat icon="bell" label={t('À venir (30 jours)')} value={d.summary.soon} tone={d.summary.soon ? 'warn' : 'ok'} />
          <Stat icon="calendar-days" label={t('Sans date')} value={d.summary.noDate} tone={d.summary.noDate ? 'warn' : 'ok'} />
        </Kpis>
        <Alert tone="info">{t('Ce registre est un aide-mémoire : renseignez vous-même l’autorité, la référence du texte applicable et les dates propres à votre activité. Il ne remplace pas un conseil juridique.')}</Alert>
        <Section title={t('Registre de conformité')} actions={<>{d.perms.manage ? <><Button onClick={sug} icon="wand-magic-sparkles">{t('Suggestions')}</Button><Button variant="primary" icon="plus" onClick={() => edit(null)}>{t('Obligation')}</Button></> : null}</>}>
          <Table caption={t('Obligations')} rows={d.items} empty={t('Aucune obligation suivie. Ajoutez les suggestions pour commencer.')} columns={[
            { key: 'title', label: t('Obligation'), render: (c) => <><b>{c.title}</b><small>{[c.authority, c.referenceText].filter(Boolean).join(' · ')}</small></> }, { key: 'cat', label: t('Catégorie'), render: (c) => CAT[c.category] },
            { key: 'resp', label: t('Responsable'), render: (c) => c.responsible || '—' },
            { key: 'due', label: t('Échéance'), render: (c) => (c.dueDate ? <Pill k={c.overdue ? 'overdue' : c.soon ? 'pending' : 'ok'}>{dateFr(c.dueDate)}</Pill> : <Badge tone="warn">{t('À renseigner')}</Badge>) },
            { key: 'last', label: t('Dernière fois'), render: (c) => (c.lastDone ? dateFr(c.lastDone) : '—') }, { key: 'proof', label: t('Preuve'), render: (c) => c.proof || '—' },
            { key: 'st', label: t('Statut'), render: (c) => <Pill k={c.status}>{ST[c.status]}</Pill> },
            { key: 'a', label: '', render: (c) => <span className="row">{['todo', 'in_progress'].includes(c.status) ? <Button size="sm" variant="primary" onClick={() => form(t('Marquer comme accomplie'), [{ k: 'proof', label: t('Preuve (référence du récépissé, du paiement…)'), required: true }, { k: 'doneOn', label: t('Date'), type: 'date', value: new Date().toISOString().slice(0, 10) }], async (v) => { const r = await api('POST', `/contracts/compliance/${c.id}/done`, { proof: v.proof, doneOn: v.doneOn }); if (r.next) toast(t('Prochaine échéance : {d}', { d: dateFr(r.next) })); })}>{t('Accomplie')}</Button> : null}{d.perms.manage ? <Button size="sm" variant="ghost" iconOnly icon="pen" label={t('Modifier')} onClick={() => edit(c)} /> : null}</span> },
          ]} />
        </Section>
      </>
    )}
    </View>
  );
}
