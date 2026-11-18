import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Drawer, Field, Loading, Stat, Table, Tabs, useLoad } from '../../ui.jsx';
import { SpinPanel } from './Spin.jsx';
import { ActivityForm, ActivityList, BantCard, FilesPanel, NotesPanel, TasksPanel } from './Panels.jsx';
import { Failed, MemberSelect, Tag, ZoneSelect, fmtDT, num, useCp, useForm, useL } from './common.jsx';

/* Opportunité : création, déplacement entre étapes (règles BANT, motifs de gain et de perte) et fiche détaillée. */

export function OppForm({ customerId, close, onSaved }) {
  const t = useT();
  const { api, me } = useCp();
  const { toast } = useWs();
  const accounts = useLoad(() => (customerId ? Promise.resolve(null) : api('GET', '/accounts?limit=500')), []);
  const f = useForm({ name: '', customerId: customerId ? String(customerId) : '', amount: '', closeDate: '', product: '', ownerId: '', nextStep: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t("Nommez l'opportunité."));
      const r = await api('POST', '/opps', { name: f.v.name, customerId: f.v.customerId || undefined, amount: num(f.v.amount), closeDate: f.v.closeDate || undefined, product: f.v.product, ownerId: f.v.ownerId || undefined, nextStep: f.v.nextStep });
      toast(t('Opportunité créée.')); close(); onSaved(r.id);
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={120} value={f.v.name} onChange={f.set('name')} />}</Field>
        {!customerId ? <Field label={t('Compte')}>{(p) => (
          <select {...p} value={f.v.customerId} onChange={f.set('customerId')}><option value="">{t('Aucun')}</option>{accounts.data ? accounts.data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>) : null}</select>)}</Field> : null}
        <Field label={t('Montant')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.amount} onChange={f.set('amount')} />}</Field>
        <Field label={t('Clôture prévue')}>{(p) => <input {...p} type="date" value={f.v.closeDate} onChange={f.set('closeDate')} />}</Field>
        <Field label={t('Produit')}>{(p) => <input {...p} type="text" maxLength={120} value={f.v.product} onChange={f.set('product')} />}</Field>
        {!me.scopeOwn ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} value={f.v.ownerId} onChange={f.set('ownerId')} none={t('Moi')} />}</Field> : null}
      </div>
      <Field label={t('Prochaine étape')}>{(p) => <input {...p} type="text" maxLength={200} value={f.v.nextStep} onChange={f.set('nextStep')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t("Créer l'opportunité")}</Button></div>
    </form>
  );
}

/** Fenêtre de déplacement : motif de perte (obligatoire), motif de gain (facultatif) ou dépassement de la règle BANT (motif obligatoire). */
function MoveDialog({ mode, stage, message, reasons, canOverride, onSubmit, close }) {
  const t = useT();
  const f = useForm({ reasonId: '', reasonText: '', overrideReason: '' });
  const list = reasons.filter((r) => r.kind === (mode === 'loss' ? 'loss' : 'win'));
  const submit = (e) => {
    e.preventDefault();
    f.run(async () => {
      if (mode === 'loss' && !f.v.reasonId && !f.v.reasonText.trim()) throw new Error(t('Indiquez le motif de la perte.'));
      if (mode === 'bant' && !f.v.overrideReason.trim()) throw new Error(t('Indiquez le motif pour passer outre.'));
      const extra = mode === 'bant' ? { overrideReason: f.v.overrideReason } : { reasonId: f.v.reasonId || undefined, reasonText: f.v.reasonText || undefined };
      await onSubmit(extra); close();
    });
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      {mode === 'bant' ? <Alert tone="warn" title={t('Règle de passage')}>{message}</Alert> : <p>{mode === 'loss' ? t('Pourquoi cette affaire est-elle perdue ?') : t('Pourquoi cette affaire est-elle gagnée ? (facultatif)')}</p>}
      {mode !== 'bant' ? (
        <>
          <Field label={mode === 'loss' ? t('Motif de perte') : t('Motif de gain')}>{(p) => <select {...p} value={f.v.reasonId} onChange={f.set('reasonId')}><option value="">{mode === 'loss' ? t('Autre (à écrire)') : t('Aucun')}</option>{list.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>}</Field>
          {!f.v.reasonId ? <Field label={t('Précisions')}>{(p) => <input {...p} type="text" maxLength={200} value={f.v.reasonText} onChange={f.set('reasonText')} />}</Field> : null}
        </>
      ) : canOverride ? <Field label={t('Motif pour passer outre')} required>{(p) => <textarea {...p} rows={3} maxLength={200} value={f.v.overrideReason} onChange={f.set('overrideReason')} />}</Field> : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row">
        {mode === 'bant' && !canOverride ? <Button type="button" onClick={close}>{t('Fermer')}</Button> : <Button variant={mode === 'loss' ? 'danger' : 'primary'} type="submit" loading={f.busy}>{mode === 'bant' ? t('Passer outre') : t('Confirmer')} — {stage.name}</Button>}
      </div>
    </form>
  );
}

/** Déplace une opportunité vers une étape : move(opp, stage). `onDone` est appelé après un déplacement réussi. */
export function useMoveOpp(onDone) {
  const t = useT();
  const { api, raw, has, fail } = useCp();
  const { modal, toast } = useWs();
  return async function move(oppId, stage) {
    const post = async (extra) => {
      const r = await raw('POST', '/opps/' + oppId + '/move', { stageId: stage.id, ...extra });
      if (r.ok) { toast(t('Opportunité déplacée.')); onDone(); return; }
      if (r.status === 422 && r.data.code === 'bant_required') return Promise.reject(Object.assign(new Error(r.data.error), { bant: true }));
      throw new Error(r.data.error || t('Erreur'));
    };
    const dialog = (mode, message, reasons) => modal(stage.name, (close) => <MoveDialog mode={mode} stage={stage} message={message} reasons={reasons} canOverride={has('approve')} onSubmit={post} close={close} />);
    try {
      if (stage.kind === 'open') {
        try { await post({}); } catch (e) { if (!e.bant) throw e; dialog('bant', e.message, []); }
        return;
      }
      const reasons = (await api('GET', '/pipeline/reasons')).reasons;
      dialog(stage.kind === 'lost' ? 'loss' : 'win', '', reasons);
    } catch (e) { fail(e); }
  };
}

function Summary({ o, reload }) {
  const t = useT();
  const { api, has, fail, bump } = useCp();
  const { toast } = useWs();
  const f = useForm({ name: o.name, amount: String(o.amount), closeDate: o.closeDate || '', product: o.product || '', nextStep: o.nextStep || '', probability: o.probabilityOverride ? String(o.probability) : '', ownerId: o.ownerId ? String(o.ownerId) : '', zoneId: o.zoneId ? String(o.zoneId) : '' });
  const open = o.status === 'open';
  const save = (e) => {
    e.preventDefault();
    f.run(async () => {
      const body = { name: f.v.name, amount: num(f.v.amount), closeDate: f.v.closeDate || null, product: f.v.product, nextStep: f.v.nextStep, probability: f.v.probability === '' ? null : num(f.v.probability), zoneId: f.v.zoneId || null };
      if (has('rules')) body.ownerId = f.v.ownerId || null;
      await api('PUT', '/opps/' + o.id, body);
      toast(t('Opportunité enregistrée.')); reload(); bump();
    });
  };
  return (
    <form className="ws-form" noValidate onSubmit={save}>
      <fieldset disabled={!open || !has('write')} className="cp-fs">
        <div className="cp-grid">
          <Field label={t('Nom')}>{(p) => <input {...p} type="text" maxLength={120} value={f.v.name} onChange={f.set('name')} />}</Field>
          <Field label={t('Montant')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.amount} onChange={f.set('amount')} />}</Field>
          <Field label={t('Probabilité (%)')} hint={t("Laissez vide pour reprendre la probabilité de l'étape.")}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.probability} onChange={f.set('probability')} />}</Field>
          <Field label={t('Clôture prévue')}>{(p) => <input {...p} type="date" value={f.v.closeDate} onChange={f.set('closeDate')} />}</Field>
          <Field label={t('Produit')}>{(p) => <input {...p} type="text" maxLength={120} value={f.v.product} onChange={f.set('product')} />}</Field>
          <Field label={t('Zone')}>{(p) => <ZoneSelect {...p} value={f.v.zoneId} onChange={f.set('zoneId')} none={t('Aucune')} />}</Field>
          {has('rules') ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} value={f.v.ownerId} onChange={f.set('ownerId')} none={t('Aucun')} />}</Field> : null}
        </div>
        <Field label={t('Prochaine étape')}>{(p) => <input {...p} type="text" maxLength={200} value={f.v.nextStep} onChange={f.set('nextStep')} />}</Field>
      </fieldset>
      <p className="ws-err" role="alert">{f.err}</p>
      {open && has('write') ? <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div> : null}
      {!open && has('approve') ? <div className="row"><Button onClick={() => api('POST', '/opps/' + o.id + '/reopen', {}).then(() => { toast(t('Opportunité rouverte.')); reload(); bump(); }, fail)}>{t('Rouvrir')}</Button></div> : null}
    </form>
  );
}

export default function OppDetail({ id, onClose }) {
  const t = useT();
  const L = useL();
  const { api, has, fail, bump, tick, openAccount, closeDrawer } = useCp();
  const { money, dateFr, confirm } = useWs();
  const st = useLoad(() => api('GET', '/opps/' + id), [id, tick]);
  const stages = useLoad(() => api('GET', '/pipeline/stages'), []);
  const [tab, setTab] = useState('sum');
  const reload = () => { st.reload(); bump(); };
  const move = useMoveOpp(reload);
  const o = st.data && st.data.opportunity;
  const refs = { oppId: id };
  const tabs = [{ id: 'sum', label: t('Résumé') }, { id: 'hist', label: t('Historique') }, { id: 'tasks', label: t('Tâches') }, { id: 'acts', label: t('Activités') }, { id: 'bant', label: t('BANT') }, { id: 'spin', label: t('SPIN') }, { id: 'files', label: t('Pièces jointes') }, { id: 'notes', label: t('Notes') }];
  const histCols = [
    { key: 'stage', label: t('Étape') }, { key: 'at', label: t('Entrée'), render: (h) => fmtDT(h.at) },
    { key: 'days', label: t('Jours dans l’étape'), align: 'r' }, { key: 'by', label: t('Par') }, { key: 'note', label: t('Remarque') },
  ];
  return (
    <Drawer title={o ? o.name : t('Opportunité')} onClose={onClose} wide>
      {st.loading && !o ? <Loading /> : st.error ? <Failed e={st.error} /> : (
        <>
          <div className="row">
            <Tag map={L.oppStatus} k={o.status} /><Badge tone="brand">{o.stage}</Badge>{o.stagnant ? <Badge tone="warn">{t('Stagnante')}</Badge> : null}
            {o.customerId ? <Button size="sm" onClick={() => openAccount(o.customerId)}>{o.customer || t('Compte')}</Button> : null}
          </div>
          <div className="ui-stats">
            <Stat label={t('Montant')} value={money(o.amount)} icon="coins" />
            <Stat label={t('Valeur pondérée')} value={money(o.weighted)} sub={o.probability + ' %'} icon="target" />
            <Stat label={t("Jours dans l'étape")} value={o.daysInStage} icon="clock" tone={o.stagnant ? 'warn' : 'brand'} />
            <Stat label={t('Score BANT')} value={o.bantScore + ' / 100'} icon="clipboard-check" />
          </div>
          {o.status === 'open' && has('write') && stages.data ? (
            <Field label={t('Déplacer vers…')}>{(p) => (
              <select {...p} value="" onChange={(e) => { const s = stages.data.stages.find((x) => x.id === Number(e.target.value)); if (s) move(o.id, s); }}>
                <option value="">{t('Choisir une étape')}</option>{stages.data.stages.filter((s) => s.id !== o.stageId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>)}</Field>
          ) : null}
          {o.status !== 'open' ? <p className="small muted">{o.reasonText ? t('Motif : {m}', { m: o.reasonText }) : ''}{o.closedAt ? ' · ' + dateFr(o.closedAt) : ''}</p> : null}
          <Tabs items={tabs} value={tab} onChange={setTab} label={t("Fiche de l'opportunité")} />
          {tab === 'sum' ? <Summary key={o.amount + o.name + o.probability} o={o} reload={reload} /> : null}
          {tab === 'hist' ? <Table caption={t('Historique des étapes')} columns={histCols} rows={st.data.history.map((h, i) => ({ ...h, id: i }))} empty={t('Aucun historique.')} /> : null}
          {tab === 'tasks' ? <TasksPanel refs={refs} /> : null}
          {tab === 'acts' ? <div><ActivityForm refs={refs} onSaved={reload} /><ActivityList items={st.data.activities} /></div> : null}
          {tab === 'bant' ? <BantCard kind="opp" id={id} onChange={reload} /> : null}
          {tab === 'spin' ? <SpinPanel refs={refs} /> : null}
          {tab === 'files' ? <FilesPanel refs={refs} /> : null}
          {tab === 'notes' ? <NotesPanel refs={refs} /> : null}
          {has('delete') ? <div className="row cp-danger"><Button variant="danger-outline" size="sm" icon="delete" onClick={() => confirm(t('Supprimer cette opportunité ?'), () => api('DELETE', '/opps/' + id).then(() => { bump(); closeDrawer(); }, fail))}>{t('Supprimer')}</Button></div> : null}
        </>
      )}
    </Drawer>
  );
}
