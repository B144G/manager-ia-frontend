import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, ChartFrame, Drawer, EmptyState, Stat, Table } from '../../ui.jsx';
import { Bars } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, num, toInt, useAdm, useData, useFormModal, useMembers } from './kit.jsx';

/* Circuits de validation : éditeur, demandes, boîte « à valider », historique, délais. Les droits (créer / valider un circuit) sont désignés par le propriétaire. */

const useKinds = () => { const t = useT(); return { purchase: t('Achat'), leave: t('Congé'), expense: t('Dépense'), document: t('Document'), contract: t('Contrat'), access: t('Accès'), other: t('Autre') }; };
const useReqStatus = () => { const t = useT(); return { pending: t('En attente'), approved: t('Approuvée'), rejected: t('Refusée'), cancelled: t('Annulée') }; };
const useStepStatus = () => { const t = useT(); return { queued: t('À venir'), active: t('En cours'), done: t('Terminée'), skipped: t('Non applicable') }; };
const ACTION = (t) => ({ submit: t('Dépôt'), approve: t('Approbation'), reject: t('Refus'), escalate: t('Escalade'), comment: t('Commentaire'), cancel: t('Annulation'), auto: t('Automatique') });

// ---------- À valider ----------
export function Inbox() {
  const t = useT();
  const { api, reload } = useAdm();
  const { dateFr, money, toast, fail } = useWs();
  const form = useFormModal();
  const [open, setOpen] = useState(null);
  const KIND = useKinds();
  const approve = async (it) => { try { await api('POST', `/flow/requests/${it.requestId}/approve`, {}); toast(t('Approuvé.')); reload(); } catch (e) { fail(e); } };
  return (
    <View path="/flow/inbox">{(d) => (
      <>
        <Kpis><Stat icon="inbox" label={t('À valider')} value={d.count} tone={d.count ? 'warn' : 'ok'} /><Stat icon="clock" label={t('En retard')} value={d.overdue} tone={d.overdue ? 'danger' : 'ok'} /></Kpis>
        <Section title={t('Boîte « à valider »')} subtitle={t('Les demandes qui attendent votre décision, y compris celles qui vous sont confiées par délégation ou escalade.')}>
          {!d.items.length ? <EmptyState icon="circle-check" title={t('Rien à valider')}>{t('Vous êtes à jour.')}</EmptyState> : (
            <Table caption={t('À valider')} rows={d.items} rowKey="requestId" columns={[
              { key: 'ref', label: t('Réf.') }, { key: 'title', label: t('Objet'), render: (i) => <b>{i.title}</b> }, { key: 'kind', label: t('Type'), render: (i) => KIND[i.kind] },
              { key: 'amount', label: t('Montant'), align: 'r', render: (i) => (i.amount ? money(i.amount) : '—') }, { key: 'requester', label: t('Demandeur') },
              { key: 'step', label: t('Étape'), render: (i) => <>{i.step}{i.escalation ? <Badge tone="warn">{t('Escalade')}</Badge> : null}</> },
              { key: 'due', label: t('Échéance'), render: (i) => (i.dueAt ? <Pill k={i.overdue ? 'overdue' : 'pending'}>{dateFr(i.dueAt)}</Pill> : '—') },
              { key: 'a', label: '', render: (i) => <span className="row"><Button size="sm" variant="primary" onClick={() => approve(i)}>{t('Approuver')}</Button><Button size="sm" variant="danger-outline" onClick={() => form(t('Refuser la demande'), [{ k: 'comment', label: t('Motif du refus'), required: true }], (v) => api('POST', `/flow/requests/${i.requestId}/reject`, { comment: v.comment }))}>{t('Refuser')}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(i.requestId)}>{t('Détails')}</Button></span> },
            ]} />
          )}
        </Section>
        {open ? <RequestDrawer id={open} onClose={() => setOpen(null)} /> : null}
      </>
    )}
    </View>
  );
}

// ---------- Demandes ----------
export function Requests() {
  const t = useT();
  const { api } = useAdm();
  const { dateFr, money } = useWs();
  const form = useFormModal();
  const KIND = useKinds(); const ST = useReqStatus();
  const [mine, setMine] = useState(false); const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const flows = useData('/flow/flows');
  const create = () => form(t('Nouvelle demande'), [
    { k: 'kind', label: t('Type de demande'), type: 'select', options: Object.entries(KIND) },
    { k: 'title', label: t('Objet'), required: true }, { k: 'amount', label: t('Montant (0 si aucun)'), value: '0' },
    { k: 'detail', label: t('Détail'), type: 'textarea', rows: 4 },
  ], async (v) => { const r = await api('POST', '/flow/requests', { kind: v.kind, title: v.title, amount: num(v.amount) || 0, detail: v.detail }); setTimeout(() => setOpen(r.id), 80); }, { done: t('Demande envoyée.') });
  const noFlow = flows.data && !flows.data.flows.some((f) => f.status === 'active');
  return (
    <>
      {noFlow ? <Alert tone="warn" title={t('Aucun circuit en service')}>{t('Le responsable du compte doit mettre un circuit en service avant que des demandes puissent être déposées.')}</Alert> : null}
      <Section title={t('Demandes')} subtitle={t('Achat, congé, dépense, document, contrat, accès…')}
        actions={<><label className="adm-chk"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('Mes demandes')}</label><select aria-label={t('Statut')} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('Tous les statuts')}</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><Button variant="primary" icon="plus" onClick={create}>{t('Nouvelle demande')}</Button></>}>
        <View path={`/flow/requests?${mine ? 'mine=1&' : ''}${status ? 'status=' + status : ''}`} deps={[mine, status]}>{(d) => (
          <Table caption={t('Demandes')} rows={d.requests} empty={t('Aucune demande.')} onRowClick={(r) => setOpen(r.id)} columns={[
            { key: 'ref', label: t('Réf.') }, { key: 'title', label: t('Objet'), render: (r) => <b>{r.title}</b> }, { key: 'kind', label: t('Type'), render: (r) => KIND[r.kind] },
            { key: 'amount', label: t('Montant'), align: 'r', render: (r) => (r.amount ? money(r.amount) : '—') }, { key: 'requester', label: t('Demandeur') },
            { key: 'status', label: t('Statut'), render: (r) => <Pill k={r.status}>{ST[r.status]}</Pill> }, { key: 'at', label: t('Déposée le'), render: (r) => dateFr(r.createdAt) },
          ]} />
        )}
        </View>
      </Section>
      {open ? <RequestDrawer id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function RequestDrawer({ id, onClose }) {
  const t = useT();
  const { api, tick, reload } = useAdm();
  const { dateFr, money, toast, fail } = useWs();
  const form = useFormModal();
  const KIND = useKinds(); const ST = useReqStatus(); const SS = useStepStatus(); const AC = ACTION(t);
  const [d, setD] = useState(null);
  const [inbox, setInbox] = useState([]);
  useEffect(() => { api('GET', `/flow/requests/${id}`).then(setD, (e) => { fail(e); onClose(); }); api('GET', '/flow/inbox').then((j) => setInbox(j.items), () => {}); }, [id, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Drawer title={t('Demande')} onClose={onClose} wide><p className="muted">{t('Chargement…')}</p></Drawer>;
  const r = d.request; const canAct = inbox.some((i) => i.requestId === id);
  const post = (p, body, msg) => async () => { try { await api('POST', `/flow/requests/${id}/${p}`, body); toast(msg); reload(); } catch (e) { fail(e); } };
  return (
    <Drawer title={`${r.ref} · ${r.title}`} onClose={onClose} wide>
      <div className="adm-form">
        <p><Pill k={r.status}>{ST[r.status]}</Pill> <Badge tone="outline">{KIND[r.kind]}</Badge> {r.amount ? <b>{money(r.amount)}</b> : null} · {t('Demandeur')} : {r.requester} · {dateFr(r.createdAt)}</p>
        {r.detail ? <p>{r.detail}</p> : null}
        <h3>{t('Circuit')}{r.flowName ? ` · ${r.flowName}` : ''}</h3>
        <ol className="adm-timeline">
          {r.steps.map((s) => (
            <li key={s.idx} className={'st-' + s.status}>
              <b>{s.name}</b> <Pill k={s.status === 'done' ? 'done' : s.status === 'active' ? 'pending' : 'draft'}>{SS[s.status]}</Pill> {s.escalated ? <Badge tone="warn">{t('Escaladée')}</Badge> : null}
              {s.status !== 'skipped' ? <div className="adm-groups">{s.groups.map((g, i) => <span key={i}>{g.escalation ? t('Escalade') : s.mode === 'all' ? t('Chacun doit valider') : t('Un seul suffit')} : {g.approvers.join(', ') || '—'}{g.approvedBy ? <Badge tone="ok">✔ {g.approvedBy}</Badge> : null}</span>)}</div> : null}
              {s.dueAt && s.status === 'active' ? <small>{t('Échéance')} : {dateFr(s.dueAt)}</small> : null}
            </li>
          ))}
        </ol>
        {r.status === 'pending' ? (
          <div className="row">
            {canAct ? <><Button variant="primary" onClick={post('approve', {}, t('Approuvé.'))}>{t('Approuver')}</Button><Button variant="danger-outline" onClick={() => form(t('Refuser la demande'), [{ k: 'comment', label: t('Motif du refus'), required: true }], (v) => api('POST', `/flow/requests/${id}/reject`, { comment: v.comment }))}>{t('Refuser')}</Button></> : null}
            <Button onClick={() => form(t('Commenter'), [{ k: 'comment', label: t('Commentaire'), type: 'textarea', required: true }], (v) => api('POST', `/flow/requests/${id}/comment`, { comment: v.comment }))}>{t('Commenter')}</Button>
            <Button variant="ghost" onClick={post('cancel', {}, t('Demande annulée.'))}>{t('Annuler la demande')}</Button>
          </div>
        ) : null}
        <h3>{t('Historique')}</h3>
        <ul className="adm-log">{d.actions.map((a, i) => <li key={i}><small>{dateFr(a.at)}</small> <b>{AC[a.action] || a.action}</b> {a.user || ''} {a.via ? `(${a.via})` : ''} {a.comment}</li>)}</ul>
      </div>
    </Drawer>
  );
}

// ---------- Éditeur de circuits ----------
const blankStep = () => ({ name: '', mode: 'any', approvers: [{ kind: 'role', role: 'manager' }], minAmount: '', maxAmount: '', delayHours: '', escalateTo: null, deputy: null });
const encode = (a) => (a ? (a.kind === 'role' ? 'role:' + a.role : `${a.kind}:${a.id}`) : '');
const decode = (s) => { if (!s) return null; const [k, v] = s.split(':'); return k === 'role' ? { kind: 'role', role: v } : { kind: k, id: Number(v) }; };

function FlowEditor({ flow, close, positions }) {
  const t = useT();
  const { api, reload } = useAdm();
  const { toast, fail } = useWs();
  const members = useMembers();
  const KIND = useKinds();
  const [f, setF] = useState(() => ({ name: flow ? flow.name : '', kind: flow ? flow.kind : 'purchase', description: flow ? flow.description : '', steps: flow ? flow.steps.map((s) => ({ ...s, minAmount: s.minAmount || '', maxAmount: s.maxAmount || '', delayHours: s.delayHours || '' })) : [blankStep()] }));
  const [busy, setBusy] = useState(false);
  const setStep = (i, p) => setF((s) => ({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const move = (i, d) => setF((s) => { const a = [...s.steps]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, steps: a }; });
  const who = (value, onChange, none) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {none ? <option value="">{none}</option> : null}
      <optgroup label={t('Rôle')}>{[['member', t('Membre')], ['manager', t('Responsable')], ['admin', t('Administrateur')], ['owner', t('Propriétaire')]].map(([k, l]) => <option key={k} value={'role:' + k}>{l}</option>)}</optgroup>
      <optgroup label={t('Personne')}>{members.map((m) => <option key={m.userId} value={'user:' + m.userId}>{m.name}</option>)}</optgroup>
      {positions.length ? <optgroup label={t('Poste')}>{positions.map((p) => <option key={p.id} value={'position:' + p.id}>{p.title}</option>)}</optgroup> : null}
    </select>
  );
  const save = async () => {
    setBusy(true);
    try {
      const steps = f.steps.map((s) => ({ name: s.name, mode: s.mode, approvers: s.approvers, minAmount: num(s.minAmount) || 0, maxAmount: num(s.maxAmount) || 0, delayHours: num(s.delayHours) || 0, escalateTo: s.escalateTo, deputy: s.deputy && s.deputy.id ? { id: s.deputy.id } : null }));
      if (flow) await api('PUT', `/flow/flows/${flow.id}`, { name: f.name, kind: f.kind, description: f.description, steps }); else await api('POST', '/flow/flows', { name: f.name, kind: f.kind, description: f.description, steps });
      toast(t('Circuit enregistré.')); reload(); close();
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <div className="adm-form">
      <label className="fld"><span>{t('Nom du circuit')}</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="fld"><span>{t('Type de demande')}</span><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="fld"><span>{t('Description')}</span><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      {f.steps.map((s, i) => (
        <fieldset className="adm-step" key={i}>
          <legend>{t('Étape')} {i + 1}</legend>
          <div className="adm-step-grid">
            <label className="fld"><span>{t('Nom de l’étape')}</span><input value={s.name} onChange={(e) => setStep(i, { name: e.target.value })} /></label>
            <label className="fld"><span>{t('Si plusieurs approbateurs')}</span><select value={s.mode} onChange={(e) => setStep(i, { mode: e.target.value })}><option value="any">{t('Un seul suffit')}</option><option value="all">{t('Tous doivent valider')}</option></select></label>
            <label className="fld"><span>{t('S’applique à partir de (montant)')}</span><input inputMode="numeric" value={s.minAmount} onChange={(e) => setStep(i, { minAmount: e.target.value })} /></label>
            <label className="fld"><span>{t('Jusqu’à (0 = sans limite)')}</span><input inputMode="numeric" value={s.maxAmount} onChange={(e) => setStep(i, { maxAmount: e.target.value })} /></label>
            <label className="fld"><span>{t('Délai avant escalade (heures)')}</span><input inputMode="decimal" value={s.delayHours} onChange={(e) => setStep(i, { delayHours: e.target.value })} /></label>
            <label className="fld"><span>{t('Escalade vers')}</span>{who(encode(s.escalateTo), (v) => setStep(i, { escalateTo: decode(v) }), t('— Dirigeants —'))}</label>
            <label className="fld"><span>{t('Suppléant en cas d’absence')}</span><select value={s.deputy && s.deputy.id ? String(s.deputy.id) : ''} onChange={(e) => setStep(i, { deputy: e.target.value ? { kind: 'user', id: Number(e.target.value) } : null })}><option value="">{t('— Aucun —')}</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>
          </div>
          <div className="adm-approvers"><b>{t('Approbateurs')}</b>
            {s.approvers.map((a, k) => (
              <span className="row" key={k}>{who(encode(a), (v) => setStep(i, { approvers: s.approvers.map((x, j) => (j === k ? decode(v) : x)) }))}
                {s.approvers.length > 1 ? <Button size="sm" variant="ghost" iconOnly icon="xmark" label={t('Retirer')} onClick={() => setStep(i, { approvers: s.approvers.filter((_, j) => j !== k) })} /> : null}</span>
            ))}
            <Button size="sm" icon="plus" onClick={() => setStep(i, { approvers: [...s.approvers, { kind: 'role', role: 'manager' }] })}>{t('Approbateur')}</Button>
          </div>
          <div className="row"><Button size="sm" iconOnly icon="arrow-up" label={t('Monter')} onClick={() => move(i, -1)} /><Button size="sm" iconOnly icon="chevron-down" label={t('Descendre')} onClick={() => move(i, 1)} />{f.steps.length > 1 ? <Button size="sm" variant="danger-outline" onClick={() => setF({ ...f, steps: f.steps.filter((_, j) => j !== i) })}>{t('Retirer l’étape')}</Button> : null}</div>
        </fieldset>
      ))}
      <div className="row"><Button icon="plus" onClick={() => setF({ ...f, steps: [...f.steps, blankStep()] })}>{t('Ajouter une étape')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer le circuit')}</Button></div>
    </div>
  );
}

export function Flows() {
  const t = useT();
  const { api, reload } = useAdm();
  const { modal, toast, fail, confirm, money } = useWs();
  const KIND = useKinds();
  const chart = useData('/org/chart');
  const positions = chart.data ? chart.data.positions : [];
  const open = (flow) => modal(flow ? t('Modifier le circuit') : t('Nouveau circuit'), (close) => <FlowEditor flow={flow} close={close} positions={positions} />, { wide: true });
  const run = (p, msg) => async () => { try { await api(p[0], p[1]); toast(msg); reload(); } catch (e) { fail(e); } };
  const SS = { draft: t('Brouillon'), active: t('En service'), archived: t('Archivé') };
  const who = (a) => (a.kind === 'role' ? { member: t('Membre'), manager: t('Responsable'), admin: t('Administrateur'), owner: t('Propriétaire') }[a.role] : a.kind === 'user' ? t('Personne') : t('Poste'));
  return (
    <View path="/flow/flows">{(d) => (
      <>
        {!d.perms.design && !d.perms.validate ? <Alert tone="info">{t('Le responsable du compte désigne qui crée et qui valide les circuits (Administration > Réglages).')}</Alert> : null}
        <Section title={t('Circuits de validation')} subtitle={t('Étapes en séquence ; dans une étape, plusieurs approbateurs en parallèle. Un circuit créé reste en brouillon jusqu’à sa validation.')}
          actions={d.perms.design ? <Button variant="primary" icon="plus" onClick={() => open(null)}>{t('Nouveau circuit')}</Button> : null}>
          {!d.flows.length ? <EmptyState icon="diagram-project" title={t('Aucun circuit')} /> : d.flows.map((f) => (
            <div className="adm-flow" key={f.id}>
              <div className="adm-flow-h"><b>{f.name}</b> <Badge tone="outline">{KIND[f.kind]}</Badge> <Pill k={f.status === 'active' ? 'active' : f.status === 'draft' ? 'draft' : 'cancelled'}>{SS[f.status]}</Pill> <small>v{f.version}</small>
                <span className="row">
                  {d.perms.validate && f.status === 'draft' ? <Button size="sm" variant="primary" onClick={run(['POST', `/flow/flows/${f.id}/publish`], t('Circuit mis en service.'))}>{t('Valider et mettre en service')}</Button> : null}
                  {d.perms.design && f.status !== 'archived' && (f.status === 'draft' || d.perms.validate) ? <Button size="sm" icon="pen" onClick={() => open(f)}>{t('Modifier')}</Button> : null}
                  {d.perms.design ? <Button size="sm" onClick={async () => { try { await api('POST', `/flow/flows/${f.id}/duplicate`); toast(t('Copie créée en brouillon.')); reload(); } catch (e) { fail(e); } }}>{t('Dupliquer')}</Button> : null}
                  {d.perms.validate && f.status !== 'archived' ? <Button size="sm" variant="ghost" onClick={() => confirm(t('Archiver ce circuit ?'), run(['POST', `/flow/flows/${f.id}/archive`], t('Circuit archivé.')))}>{t('Archiver')}</Button> : null}
                  {d.perms.design && f.status !== 'active' ? <Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={() => confirm(t('Supprimer ce circuit ?'), run(['DELETE', `/flow/flows/${f.id}`], t('Supprimé.')))} /> : null}
                </span>
              </div>
              <ol className="adm-flow-steps">{f.steps.map((s, i) => <li key={i}><b>{s.name}</b> · {s.approvers.map(who).join(s.mode === 'all' ? ' + ' : ' / ')}{s.minAmount ? ` · ≥ ${money(s.minAmount)}` : ''}{s.maxAmount ? ` · ≤ ${money(s.maxAmount)}` : ''}{s.delayHours ? ` · ${s.delayHours} h` : ''}</li>)}</ol>
            </div>
          ))}
        </Section>
      </>
    )}
    </View>
  );
}

// ---------- Indicateurs de délai ----------
export function FlowStats() {
  const t = useT();
  const KIND = useKinds();
  return (
    <View path="/flow/stats">{(d) => (
      <>
        <Kpis>
          <Stat icon="list-check" label={t('Demandes')} value={d.total} />
          <Stat icon="clock" label={t('En attente')} value={d.pending} tone={d.pending ? 'warn' : 'ok'} />
          <Stat icon="check" label={t('Taux d’approbation')} value={d.approvalRate == null ? '—' : d.approvalRate + ' %'} tone="ok" />
          <Stat icon="stopwatch" label={t('Délai moyen (heures)')} value={d.avgCycleHours} />
          <Stat icon="hourglass" label={t('Durée moyenne d’une étape (h)')} value={d.avgStepHours} />
          <Stat icon="triangle-exclamation" label={t('En retard')} value={d.overdue} tone={d.overdue ? 'danger' : 'ok'} />
          <Stat icon="bolt" label={t('Escalades')} value={d.escalatedTotal} tone={d.escalatedTotal ? 'warn' : 'ok'} />
        </Kpis>
        <Grid cols={2}>
          <ChartFrame title={t('Demandes par mois')} summary={t('Demandes déposées, approuvées et refusées chaque mois.')} height={240}>
            <Bars data={d.byMonth} xKey="month" series={[{ key: 'created', label: t('Déposées') }, { key: 'approved', label: t('Approuvées') }, { key: 'rejected', label: t('Refusées') }]} />
          </ChartFrame>
          <ChartFrame title={t('Délai moyen par type (heures)')} summary={t('Durée moyenne de traitement selon le type de demande.')} height={240}>
            <Bars data={d.byKind.map((k) => ({ ...k, label: KIND[k.kind] || k.label }))} xKey="label" series={[{ key: 'avgHours', label: t('Heures') }]} />
          </ChartFrame>
        </Grid>
        <Section title={t('Par type de demande')}>
          <Table caption={t('Par type')} rows={d.byKind} rowKey="kind" empty={t('Aucune donnée.')} columns={[{ key: 'label', label: t('Type'), render: (k) => KIND[k.kind] }, { key: 'total', label: t('Total'), align: 'r' }, { key: 'approved', label: t('Approuvées'), align: 'r' }, { key: 'rejected', label: t('Refusées'), align: 'r' }, { key: 'pending', label: t('En attente'), align: 'r' }, { key: 'avgHours', label: t('Délai moyen (h)'), align: 'r' }]} />
        </Section>
      </>
    )}
    </View>
  );
}
export { toInt };
