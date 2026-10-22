import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { BTN, Check, INP } from '../finance/util.jsx';

/* Formulaire d'une échéance fiscale. « Répéter » : à la création, choisissez la périodicité ; quand vous marquerez l'échéance « déposée » ou « payée »,
   la suivante sera créée automatiquement (une seule fois). */
export default function ObligationForm({ o, pre, lists, onDone }) {
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
    if (!f.title.trim()) { setErr("Remplissez : le nom de l'échéance."); return; }
    if (!f.dueDate) { setErr('Remplissez : la date limite.'); return; }
    setErr(''); setBusy(true);
    oapi(o ? 'PUT' : 'POST', '/fiscal/obligations' + (o ? '/' + o.id : ''), { ...f, amount: f.amount || 0, repeat: f.repeat && f.recurrence !== 'none' })
      .then((r) => onDone(r)).catch((x) => { setErr(x.message || 'Erreur'); setBusy(false); });
  };
  const text = (k, label, props) => <label className="fld"><span>{label}</span><input style={INP} autoComplete="off" value={f[k]} onChange={(ev) => set(k, ev.target.value)} {...(props || {})} /></label>;
  const sel = (k, label, list) => <label className="fld"><span>{label}</span><select style={INP} value={f[k]} onChange={(ev) => set(k, ev.target.value)}>{Object.entries(list).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  return (
    <form className="ws-form" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }} noValidate onSubmit={submit}>
      {text('title', 'Nom')}
      {sel('kind', 'Type', lists.kinds)}
      {text('dueDate', 'Date limite', { type: 'date' })}
      {text('period', 'Période concernée', { placeholder: 'Ex. septembre 2026' })}
      {text('amount', 'Montant estimé (' + info.org.currency + ')', { inputMode: 'numeric' })}
      {sel('status', 'Statut', lists.statuses)}
      {text('reference', 'Justificatif (référence, numéro de quittance…)')}
      {sel('recurrence', 'Périodicité', lists.recurrences)}
      <Check checked={f.repeat && f.recurrence !== 'none'} disabled={f.recurrence === 'none'} onChange={(v) => set('repeat', v)} label="Répéter"
        hint={f.recurrence === 'none' ? 'Choisissez d\'abord une périodicité (chaque mois, trimestre ou année).' : "Quand vous marquerez cette échéance « déposée » ou « payée », la suivante sera créée automatiquement."} />
      {text('note', 'Remarque')}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" style={BTN} disabled={busy}>Enregistrer</button></div>
    </form>
  );
}
