import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { BTN, Check, INP } from '../finance/util.jsx';

/* Formulaire d'une échéance fiscale. « Répéter » : à la création, choisissez la périodicité ; quand vous marquerez l'échéance « déposée » ou « payée »,
   la suivante sera créée automatiquement (une seule fois). */
export default function ObligationForm({ o, pre, lists, onDone }) {
  const t = useT();
  const { oapi, info } = useWs();
  const e = o || pre || {};
  const [f, setF] = useState({
    title: e.title || '', kind: e.kind || 'other', dueDate: e.dueDate || e.due || '', period: e.period || '', amount: e.amount ? String(e.amount) : '',
    status: e.status || 'todo', reference: e.reference || '', recurrence: e.recurrence || 'none', note: e.note || '', repeat: Boolean(e.repeat),
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = (ev) => {
    ev.preventDefault();
    if (!f.title.trim()) { setErr(t("Remplissez : le nom de l'échéance.")); return; }
    if (!f.dueDate) { setErr(t('Remplissez : la date limite.')); return; }
    setErr(''); setBusy(true);
    oapi(o ? 'PUT' : 'POST', '/fiscal/obligations' + (o ? '/' + o.id : ''), { ...f, amount: f.amount || 0, repeat: f.repeat && f.recurrence !== 'none' })
      .then((r) => onDone(r)).catch((x) => { setErr(t(x.message || 'Erreur')); setBusy(false); });
  };
  const text = (k, label, props) => <label className="fld"><span>{label}</span><input style={INP} autoComplete="off" value={f[k]} onChange={(ev) => set(k, ev.target.value)} {...(props || {})} /></label>;
  const sel = (k, label, list) => <label className="fld"><span>{label}</span><select style={INP} value={f[k]} onChange={(ev) => set(k, ev.target.value)}>{Object.entries(list).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>;
  return (
    <form className="ws-form" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }} noValidate onSubmit={submit}>
      {text('title', t('Nom'))}
      {sel('kind', t('Type'), lists.kinds)}
      {text('dueDate', t('Date limite'), { type: 'date' })}
      {text('period', t('Période concernée'), { placeholder: t('Ex. septembre 2026') })}
      {text('amount', t('Montant estimé ({cur})', { cur: info.org.currency }), { inputMode: 'numeric' })}
      {sel('status', t('Statut'), lists.statuses)}
      {text('reference', t('Justificatif (référence, numéro de quittance…)'))}
      {sel('recurrence', t('Périodicité'), lists.recurrences)}
      <Check checked={f.repeat && f.recurrence !== 'none'} disabled={f.recurrence === 'none'} onChange={(v) => set('repeat', v)} label={t("Répéter")}
        hint={f.recurrence === 'none' ? t("Choisissez d'abord une périodicité (chaque mois, trimestre ou année).") : t("Quand vous marquerez cette échéance « déposée » ou « payée », la suivante sera créée automatiquement.")} />
      {text('note', t('Remarque'))}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" style={BTN} disabled={busy}>{t('Enregistrer')}</button></div>
    </form>
  );
}
