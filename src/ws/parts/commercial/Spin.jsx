import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, EmptyState, Field, Loading, Segmented, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, Meter, fmtDT, inputDT, isoOf, qs, useCp, useForm } from './common.jsx';
import { useL2 } from './labels2.jsx';

/* Fiche SPIN guidée (Situation, Problème, Implication, Besoin-bénéfice) rattachée à une opportunité, un prospect ou un compte, et synthèse du besoin. */

const KEYS = ['situation', 'problem', 'implication', 'payoff'];

function SpinForm({ refs, pre, close, onSaved }) {
  const t = useT();
  const L2 = useL2();
  const { api } = useCp();
  const { toast } = useWs();
  const f = useForm({ kind: pre ? pre.kind : 'call', heldAt: inputDT(pre ? pre.heldAt : new Date().toISOString()), notes: pre ? pre.notes : '', nextStep: pre ? pre.nextStep : '' });
  const [sec, setSec] = useState(() => Object.fromEntries(KEYS.map((k) => [k, pre && pre[k].length ? pre[k].map((x) => ({ ...x })) : L2.questions[k].slice(0, 2).map((q) => ({ q, a: '', key: false }))])));
  const patch = (k, i, p) => setSec((s) => ({ ...s, [k]: s[k].map((x, n) => (n === i ? { ...x, ...p } : x)) }));
  const add = (k, q) => setSec((s) => ({ ...s, [k]: [...s[k], { q, a: '', key: false }] }));
  const submit = (e) => {
    e.preventDefault();
    f.run(async () => {
      const body = { ...Object.fromEntries(KEYS.map((k) => [k, sec[k]])), notes: f.v.notes, nextStep: f.v.nextStep };
      if (pre) await api('PUT', '/spin/' + pre.id, body); else await api('POST', '/spin', { ...refs, ...body, kind: f.v.kind, heldAt: isoOf(f.v.heldAt) || undefined });
      toast(t('Fiche SPIN enregistrée.')); close(); onSaved();
    });
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      {!pre ? (
        <div className="cp-grid">
          <Field label={t('Type')}>{(p) => <MapSelect {...p} map={L2.spinKind} value={f.v.kind} onChange={f.set('kind')} />}</Field>
          <Field label={t('Date et heure')}>{(p) => <input {...p} type="datetime-local" value={f.v.heldAt} onChange={f.set('heldAt')} />}</Field>
        </div>
      ) : null}
      {KEYS.map((k) => (
        <fieldset className="cp-spin-sec" key={k}>
          <legend>{L2.spin[k]}</legend>
          <p className="small muted">{L2.spinHelp[k]}</p>
          {sec[k].map((x, i) => (
            <div className="cp-spin-q" key={i}>
              <Field label={t('Question')}>{(p) => <input {...p} type="text" maxLength={200} value={x.q} onChange={(e) => patch(k, i, { q: e.target.value })} />}</Field>
              <Field label={t('Réponse du client')}>{(p) => <textarea {...p} rows={2} maxLength={600} value={x.a} onChange={(e) => patch(k, i, { a: e.target.value })} />}</Field>
              <div className="row">
                <label className="cp-check small"><input type="checkbox" checked={x.key} onChange={(e) => patch(k, i, { key: e.target.checked })} /> {t('Point clé')}</label>
                <Button size="sm" variant="ghost" onClick={() => setSec((s) => ({ ...s, [k]: s[k].filter((_, n) => n !== i) }))}>{t('Retirer')}</Button>
              </div>
            </div>
          ))}
          {sec[k].length < 12 ? (
            <div className="row">
              <select aria-label={t('Ajouter une question suggérée')} value="" onChange={(e) => { if (e.target.value !== '') add(k, L2.questions[k][Number(e.target.value)]); }}>
                <option value="">{t('Ajouter une question suggérée')}</option>
                {L2.questions[k].map((q, i) => <option key={i} value={i}>{q}</option>)}
              </select>
              <Button size="sm" onClick={() => add(k, '')}>{t('Question libre')}</Button>
            </div>
          ) : null}
        </fieldset>
      ))}
      <Field label={t('Notes')}>{(p) => <textarea {...p} rows={2} maxLength={1500} value={f.v.notes} onChange={f.set('notes')} />}</Field>
      <Field label={t('Prochaine étape')}>{(p) => <input {...p} type="text" maxLength={200} value={f.v.nextStep} onChange={f.set('nextStep')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function Synthesis({ refs, tick, onNote }) {
  const t = useT();
  const L2 = useL2();
  const { api, has, fail } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/spin-synthesis' + qs(refs)), [JSON.stringify(refs), tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const d = st.data;
  return (
    <Card flat title={t('Synthèse du besoin')} subtitle={t('{n} fiche(s)', { n: d.sheets })}>
      <div className="cp-part"><span>{t('Complétude')}</span><Meter value={d.completeness} label={t('Complétude : {n} / 100', { n: d.completeness })} /><b>{d.completeness} / 100</b></div>
      <div className="row"><Badge tone={d.maturity === 'explicit' ? 'ok' : d.maturity === 'implicit' ? 'warn' : 'neutral'}>{L2.maturity[d.maturity]}</Badge>
        {d.missing.map((k) => <Badge key={k} tone="warn">{t('Manque : {r}', { r: L2.spin[k] })}</Badge>)}</div>
      {d.text ? <pre className="cp-body cp-pre">{d.text}</pre> : <p className="muted">{t('Aucune réponse notée pour le moment.')}</p>}
      {has('write') && d.sheets ? <Button size="sm" icon="pen" onClick={() => api('POST', '/spin-synthesis/note', refs).then(() => { toast(t('Synthèse reportée dans les notes.')); if (onNote) onNote(); }, fail)}>{t('Reporter dans les notes')}</Button> : null}
    </Card>
  );
}

/** Fiches SPIN d'une fiche (opportunité, prospect ou compte) et leur synthèse. */
export function SpinPanel({ refs }) {
  const t = useT();
  const L2 = useL2();
  const { api, has, fail, me } = useCp();
  const { modal, confirm } = useWs();
  const st = useLoad(() => api('GET', '/spin' + qs(refs)), [JSON.stringify(refs)]);
  const form = (pre) => modal(pre ? t('Modifier la fiche SPIN') : t('Nouvelle fiche SPIN'), (close) => <SpinForm refs={refs} pre={pre} close={close} onSaved={st.reload} />, { wide: true });
  return (
    <div className="cp-stack">
      {has('activity') ? <div className="row"><Button size="sm" icon="plus" variant="primary" onClick={() => form(null)}>{t('Nouvelle fiche SPIN')}</Button></div> : null}
      <Synthesis refs={refs} tick={st.data ? st.data.sheets.length + ':' + st.data.sheets.map((s) => s.id).join() : 0} />
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : !st.data.sheets.length ? <EmptyState icon="comments" title={t("Aucune fiche SPIN pour l'instant.")} /> : (
        <ul className="cp-list">
          {st.data.sheets.map((s) => (
            <li key={s.id} className="cp-item cp-item-col">
              <div className="row"><b className="grow">{L2.spinKind[s.kind] || s.kind} · {fmtDT(s.heldAt)}</b><span className="small muted">{s.by}</span></div>
              {KEYS.map((k) => (s[k].length ? (
                <div key={k}><b>{L2.spin[k]}</b><ul className="cp-q">{s[k].map((x, i) => <li key={i}>{x.key ? '★ ' : ''}<span className="muted">{x.q}</span> {x.a}</li>)}</ul></div>
              ) : null))}
              {s.nextStep ? <p className="small">{t('Prochaine étape : {s}', { s: s.nextStep })}</p> : null}
              {has('activity') && (s.userId === me.userId || has('approve')) ? (
                <div className="row"><Button size="sm" onClick={() => form(s)}>{t('Modifier')}</Button>
                  <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => confirm(t('Supprimer cette fiche SPIN ?'), () => api('DELETE', '/spin/' + s.id).then(st.reload, fail))} /></div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Écran « Fiche SPIN » : choisir une opportunité ou un prospect, puis remplir sa fiche. */
export default function SpinScreen() {
  const t = useT();
  const { api, tick } = useCp();
  const [kind, setKind] = useState('opp');
  const [id, setId] = useState('');
  const st = useLoad(() => (kind === 'opp' ? api('GET', '/opps?status=open&limit=300') : api('GET', '/leads?limit=300')), [kind, tick]);
  const rows = st.data ? (kind === 'opp' ? st.data.opportunities : st.data.leads) : [];
  return (
    <div className="cp-stack">
      <Card title={t('Fiche SPIN')} subtitle={t("Guide d'entretien : posez des questions de situation, de problème, d'implication puis de besoin-bénéfice.")}>
        <div className="row cp-bar">
          <Segmented label={t('Rattacher à')} value={kind} onChange={(v) => { setKind(v); setId(''); }} items={[{ id: 'opp', label: t('Une opportunité') }, { id: 'lead', label: t('Un prospect') }]} />
        </div>
        <Field label={kind === 'opp' ? t('Opportunité') : t('Prospect')}>{(p) => (
          <select {...p} value={id} onChange={(e) => setId(e.target.value)}><option value="">{t('Choisir…')}</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}{r.customer ? ' — ' + r.customer : ''}</option>)}</select>)}</Field>
        {st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
      </Card>
      {id ? <SpinPanel key={kind + id} refs={kind === 'opp' ? { oppId: id } : { leadId: id }} /> : null}
    </div>
  );
}
