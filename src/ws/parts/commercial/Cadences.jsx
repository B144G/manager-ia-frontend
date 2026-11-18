import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Loading, Segmented, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, Tag, fmtDT, num, qs, useCp, useForm, useL } from './common.jsx';

/* Relances (cadences) : file des messages à envoyer (WhatsApp par code QR), définition des séquences, démarrage sur des fiches, journal. */

function QueueItem({ q, reload }) {
  const t = useT();
  const L = useL();
  const { raw, api, fail, has } = useCp();
  const { toast, confirm } = useWs();
  const [text, setText] = useState(q.step.text);
  const [busy, setBusy] = useState(false);
  const [wa, setWa] = useState(null);
  const [msg, setMsg] = useState('');
  const act = async (action) => {
    setBusy(true); setMsg('');
    try {
      const r = await raw('POST', '/cadences-runs/' + q.id + '/' + action, action === 'send' ? { text } : {});
      if (r.ok) { toast(action === 'skip' ? t('Étape sautée.') : action === 'manual' ? t('Marquée comme envoyée.') : q.step.channel === 'task' ? t('Tâche créée.') : t('Message envoyé.')); reload(); return; }
      if (r.status === 409) { toast(tsrv(r.data.error), true); reload(); return; }
      if (r.data.waLink) setWa(r.data.waLink);
      setMsg(tsrv(r.data.error || t('Erreur')));
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const stop = () => confirm(t('Arrêter cette relance ?'), () => api('POST', '/cadences-runs/' + q.id + '/stop', {}).then(reload, fail), t('Arrêter'));
  const isTask = q.step.channel === 'task';
  return (
    <li className="cp-queue">
      <div className="row"><b className="grow">{q.subject}</b><Badge tone={q.due ? 'warn' : 'neutral'}>{q.due ? t('À faire maintenant') : fmtDT(q.nextAt)}</Badge></div>
      <div className="small muted">{q.cadence} · {t('étape {i} / {n}', { i: q.stepIdx + 1, n: q.steps })} · <Icon name={isTask ? 'list-check' : 'whatsapp'} /> {L.channel[q.step.channel]}{q.phone ? ' · ' + q.phone : ''}</div>
      <Field label={isTask ? t('Tâche à créer') : t('Message (modifiable avant envoi)')}>{(p) => <textarea {...p} rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
      {msg ? <Alert tone="warn">{msg}{wa ? <> <a href={wa} target="_blank" rel="noopener noreferrer">{t('Ouvrir WhatsApp (lien wa.me)')}</a></> : null}</Alert> : null}
      {has('activity') ? (
        <div className="row">
          <Button variant="primary" size="sm" icon={isTask ? 'plus' : 'paper-plane'} loading={busy} onClick={() => act('send')}>{isTask ? t('Créer la tâche') : t('Envoyer')}</Button>
          {wa || !isTask ? <Button size="sm" loading={busy} onClick={() => act('manual')}>{t('Marquer comme envoyé à la main')}</Button> : null}
          <Button size="sm" loading={busy} onClick={() => act('skip')}>{t('Sauter')}</Button>
          <Button size="sm" variant="danger-outline" onClick={stop}>{t('Arrêter')}</Button>
        </div>
      ) : null}
    </li>
  );
}

function Queue() {
  const t = useT();
  const { api, tick, bump } = useCp();
  const [all, setAll] = useState(false);
  const st = useLoad(() => api('GET', '/cadences-queue' + qs({ all })), [all, tick]);
  return (
    <Card title={t('Relances à traiter')} subtitle={t("Relisez le message, puis envoyez-le. Il part par WhatsApp (code QR) si l'appareil est connecté.")}
      actions={<label className="cp-check small"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('Voir aussi les relances à venir')}</label>}>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : !st.data.queue.length ? <EmptyState icon="circle-check" title={t('Aucune relance à traiter.')} /> : (
        <ul className="cp-list">{st.data.queue.map((q) => <QueueItem key={q.id + '-' + q.stepIdx} q={q} reload={() => { st.reload(); bump(); }} />)}</ul>
      )}
    </Card>
  );
}

function StepsEditor({ steps, setSteps }) {
  const t = useT();
  const L = useL();
  const set = (i, patch) => setSteps(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <div className="cp-steps">
      {steps.map((s, i) => (
        <div className="cp-step" key={i}>
          <b>{t('Étape {n}', { n: i + 1 })}</b>
          <div className="cp-grid">
            <Field label={t('Jour')} hint={t('Jours après le début (0 à 90)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={s.day} onChange={(e) => set(i, { day: e.target.value })} />}</Field>
            <Field label={t('Canal')}>{(p) => <MapSelect {...p} map={L.channel} value={s.channel} onChange={(v) => set(i, { channel: v })} />}</Field>
          </div>
          <Field label={s.channel === 'task' ? t('Tâche à créer') : t('Message')}>{(p) => <textarea {...p} rows={2} maxLength={600} value={s.text} onChange={(e) => set(i, { text: e.target.value })} />}</Field>
          {steps.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setSteps(steps.filter((_, k) => k !== i))}>{t('Retirer cette étape')}</Button> : null}
        </div>
      ))}
      {steps.length < 10 ? <Button size="sm" icon="plus" onClick={() => setSteps([...steps, { day: String((num(steps[steps.length - 1].day) || 0) + 2), channel: 'whatsapp', text: '' }])}>{t('Ajouter une étape')}</Button> : null}
      <p className="small muted">{t('Variables : {prenom}, {nom}, {entreprise}, {produit}, {organisation}.')}</p>
    </div>
  );
}

function CadenceForm({ pre, defaults, close, onSaved }) {
  const t = useT();
  const L = useL();
  const { api } = useCp();
  const f = useForm({ name: pre ? pre.name : '', target: pre ? pre.target : 'lead', autoSend: pre ? pre.autoSend : false, active: pre ? pre.active : true });
  const [steps, setSteps] = useState((pre ? pre.steps : defaults).map((s) => ({ ...s, day: String(s.day) })));
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t('Nommez la cadence.'));
      const body = { name: f.v.name, autoSend: f.v.autoSend, steps: steps.map((s) => ({ day: num(s.day), channel: s.channel, text: s.text })) };
      if (pre) await api('PUT', '/cadences/' + pre.id, { ...body, active: f.v.active }); else await api('POST', '/cadences', { ...body, target: f.v.target });
      close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
        {!pre ? <Field label={t('Pour')}>{(p) => <MapSelect {...p} map={L.target} value={f.v.target} onChange={f.set('target')} />}</Field> : null}
      </div>
      <label className="cp-check"><input type="checkbox" checked={f.v.autoSend} onChange={f.set('autoSend')} /> {t('Envoyer automatiquement sans relecture (déconseillé)')}</label>
      {pre ? <label className="cp-check"><input type="checkbox" checked={f.v.active} onChange={f.set('active')} /> {t('Cadence active')}</label> : null}
      <StepsEditor steps={steps} setSteps={setSteps} />
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function StartForm({ cadence, close, onDone }) {
  const t = useT();
  const { api } = useCp();
  const { toast } = useWs();
  const kind = cadence.target;
  const st = useLoad(() => (kind === 'lead' ? api('GET', '/leads?limit=300') : kind === 'customer' ? api('GET', '/accounts?limit=300') : Promise.resolve(null)), []);
  const [sel, setSel] = useState(() => new Set());
  const f = useForm({ docId: '' });
  const rows = st.data ? (kind === 'lead' ? st.data.leads : st.data.accounts) : [];
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const body = kind === 'lead' ? { leadIds: [...sel] } : kind === 'customer' ? { customerIds: [...sel] } : { docId: num(f.v.docId) };
      if ((kind !== 'quote' && !sel.size) || (kind === 'quote' && !body.docId)) throw new Error(t('Indiquez la fiche à relancer.'));
      const r = await api('POST', '/cadences/' + cadence.id + '/start', body);
      toast(t('{n} relance(s) démarrée(s), {m} ignorée(s).', { n: r.started.length, m: r.skipped.length })); close(); onDone();
    }); }}>
      {kind === 'quote' ? <Field label={t('Numéro interne du devis')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.docId} onChange={f.set('docId')} />}</Field>
        : !st.data ? <Loading /> : (
          <fieldset className="cp-fs cp-pick"><legend>{t('Fiches à relancer')}</legend>
            {rows.map((r) => <label className="cp-check" key={r.id}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /> {r.name}</label>)}
          </fieldset>)}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Démarrer')}</Button></div>
    </form>
  );
}

function Definitions() {
  const t = useT();
  const L = useL();
  const { api, fail, has, tick } = useCp();
  const { modal, confirm } = useWs();
  const st = useLoad(() => api('GET', '/cadences'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const form = (pre) => modal(pre ? t('Modifier la cadence') : t('Nouvelle cadence'), (close) => <CadenceForm pre={pre} defaults={st.data.defaults} close={close} onSaved={st.reload} />, { wide: true });
  return (
    <Card title={t('Cadences')} subtitle={t('Une cadence est une suite de relances espacées dans le temps.')} actions={has('rules') ? <Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouvelle cadence')}</Button> : null}>
      {!st.data.cadences.length ? <EmptyState icon="paper-plane" title={t('Aucune cadence.')} /> : st.data.cadences.map((c) => (
        <div className="cp-cad" key={c.id}>
          <div className="row"><b className="grow">{c.name}</b><Badge>{L.target[c.target]}</Badge>{c.active ? <Badge tone="ok">{t('Active')}</Badge> : <Badge>{t('Désactivée')}</Badge>}{c.autoSend ? <Badge tone="warn">{t('Envoi automatique')}</Badge> : null}</div>
          <ol className="small">{c.steps.map((s, i) => <li key={i}>{t('Jour {d}', { d: s.day })} · {L.channel[s.channel]} — {s.text}</li>)}</ol>
          <div className="row">
            <span className="small muted">{t('{n} en cours', { n: c.running })}</span>
            {has('activity') && c.active ? <Button size="sm" icon="paper-plane" onClick={() => modal(t('Démarrer « {nom} »', { nom: c.name }), (close) => <StartForm cadence={c} close={close} onDone={st.reload} />, { wide: true })}>{t('Démarrer')}</Button> : null}
            {has('rules') ? <><Button size="sm" onClick={() => form(c)}>{t('Modifier')}</Button>
              <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: c.name })} onClick={() => confirm(t('Supprimer cette cadence ?'), () => api('DELETE', '/cadences/' + c.id).then(st.reload, fail))} /></> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}

function RunLog({ id }) {
  const t = useT();
  const L = useL();
  const { api } = useCp();
  const st = useLoad(() => api('GET', '/cadences-runs/' + id + '/log'), [id]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  return <Table caption={t('Journal de la relance')} columns={[
    { key: 'at', label: t('Date'), render: (x) => fmtDT(x.at) }, { key: 'stepIdx', label: t('Étape'), render: (x) => x.stepIdx + 1 }, { key: 'channel', label: t('Canal'), render: (x) => L.channel[x.channel] || x.channel },
    { key: 'result', label: t('Résultat'), render: (x) => L.logResult[x.result] || x.result }, { key: 'body', label: t('Message') },
  ]} rows={st.data.log} empty={t("Rien d'envoyé pour l'instant.")} />;
}

function Runs() {
  const t = useT();
  const L = useL();
  const { api, tick } = useCp();
  const { modal } = useWs();
  const st = useLoad(() => api('GET', '/cadences-runs'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const cols = [
    { key: 'cadence', label: t('Cadence') },
    { key: 'subject', label: t('Fiche'), render: (r) => (r.leadId ? t('Prospect n° {n}', { n: r.leadId }) : r.customerId ? t('Compte n° {n}', { n: r.customerId }) : t('Devis n° {n}', { n: r.docId })) },
    { key: 'step', label: t('Étape'), render: (r) => Math.min(r.stepIdx + 1, r.steps) + ' / ' + r.steps },
    { key: 'state', label: t('État'), render: (r) => <><Tag map={L.runState} k={r.state} />{r.stopReason ? ' ' + (L.stopReason[r.stopReason] || r.stopReason) : ''}</> },
    { key: 'next', label: t('Prochaine étape'), render: (r) => (r.state === 'active' ? fmtDT(r.nextAt) : '—') },
    { key: 'log', label: t('Journal'), render: (r) => <Button size="sm" onClick={() => modal(t('Journal de la relance'), () => <RunLog id={r.id} />, { wide: true })}>{t('Voir')}</Button> },
  ];
  return <Card title={t('Suivi des relances')}><Table caption={t('Suivi des relances')} columns={cols} rows={st.data.runs} empty={t('Aucune relance démarrée.')} /></Card>;
}

export default function Cadences() {
  const t = useT();
  const [view, setView] = useState('queue');
  return (
    <div className="cp-stack">
      <Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'queue', label: t('À traiter') }, { id: 'defs', label: t('Cadences') }, { id: 'runs', label: t('Suivi et journal') }]} />
      {view === 'queue' ? <Queue /> : view === 'defs' ? <Definitions /> : <Runs />}
    </div>
  );
}
