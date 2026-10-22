import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Loading, useLoad } from '../../ui.jsx';

/* Paramètres de paie : lignes de retenues salariales et de charges patronales (taux en %, plafond mensuel facultatif). */
export default function Settings({ onSaved }) {
  const { oapi, toast, fail, info } = useWs();
  const [rules, setRules] = useState([]);
  const [busy, setBusy] = useState(false);
  const st = useLoad(() => oapi('GET', '/payroll/settings').then((j) => { setRules(j.rules.map((r) => ({ ...r, rate: String(r.rate), ceiling: r.ceiling ? String(r.ceiling) : '' }))); return j; }), []);
  const set = (i, k, v) => setRules((l) => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = () => {
    setBusy(true);
    oapi('PUT', '/payroll/settings', { rules: rules.map((r) => ({ kind: r.kind, label: r.label, rate: r.rate, ceiling: r.ceiling })) })
      .then(() => { toast('Paramètres enregistrés.'); st.reload(); if (onSaved) onSaved(); }).catch(fail).finally(() => setBusy(false));
  };
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  return (
    <div className="ws-card">
      <h2>Retenues et charges</h2>
      <p className="small" role="note"><b>{st.data.disclaimer}</b></p>
      {st.data.isDefault ? <p className="small late">Ces lignes sont un exemple de départ : modifiez-les puis enregistrez pour les adopter.</p> : null}
      {!rules.length ? <p className="ws-empty">Aucune ligne : les bulletins n'auront aucune retenue ni charge.</p> : null}
      {rules.map((r, i) => (
        <div className="ws-form" key={i} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 10 }}>
          <label className="fld"><span>Nom de la ligne</span><input value={r.label} maxLength={80} onChange={(e) => set(i, 'label', e.target.value)} /></label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="fld"><span>Type</span>
              <select value={r.kind} onChange={(e) => set(i, 'kind', e.target.value)}><option value="employee">Retenue sur le salaire</option><option value="employer">Charge patronale</option></select>
            </label>
            <label className="fld"><span>Taux (%)</span><input inputMode="decimal" style={{ width: 90 }} value={r.rate} onChange={(e) => set(i, 'rate', e.target.value)} /></label>
            <label className="fld"><span>{'Plafond mensuel (' + info.org.currency + ')'}</span><input inputMode="numeric" style={{ width: 130 }} placeholder="Aucun" value={r.ceiling} onChange={(e) => set(i, 'ceiling', e.target.value)} /></label>
            <button className="link" type="button" onClick={() => setRules((l) => l.filter((_, j) => j !== i))}>Retirer</button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn small" type="button" disabled={rules.length >= 20} onClick={() => setRules((l) => l.concat([{ kind: 'employee', label: '', rate: '0', ceiling: '' }]))}>Ajouter une ligne</button>
        <button className="btn primary small" type="button" disabled={busy} onClick={save}>Enregistrer</button>
      </div>
      <p className="muted small">Le taux s'applique au salaire brut (base + primes + heures supplémentaires), limité au plafond s'il est indiqué. Les bulletins validés ne changent jamais ; les brouillons utilisent les paramètres au moment où vous les modifiez.</p>
    </div>
  );
}
