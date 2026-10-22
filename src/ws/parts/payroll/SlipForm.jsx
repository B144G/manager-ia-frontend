import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { BTN, Check, INP, WRAP } from '../finance/util.jsx';

/* Formulaire d'un bulletin en brouillon : salaire, primes, heures supplémentaires calculées depuis les heures (taux horaire x majoration par palier),
   13e mois ou prime annuelle (option), avances et retenues. Le net et les charges sont recalculés par le serveur avec vos paramètres. */
export default function SlipForm({ s, tiers, monthlyHours, onDone }) {
  const { oapi, info } = useWs();
  const [f, setF] = useState({
    base: String(s.base || ''), bonuses: String(s.bonuses || ''), overtime: String(s.overtime || ''), advances: String(s.advances || ''), otherDeductions: String(s.otherDeductions || ''),
    hourlyRate: s.hourlyRate ? String(s.hourlyRate) : '', annualBonus: s.annualBonus ? String(s.annualBonus) : '', annualBonusLabel: s.annualBonusLabel || '', note: s.note || '',
  });
  const [rows, setRows] = useState((s.overtimeHours || []).map((h) => ({ rate: String(h.rate), hours: String(h.hours) })));
  const [annual, setAnnual] = useState(s.annualBonus > 0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setRow = (i, k, v) => setRows((l) => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const rates = [...new Set([...(tiers || []).map((t) => t.rate), ...rows.map((r) => Number(r.rate))])].sort((a, b) => a - b);
  const label = (rate) => { const t = (tiers || []).find((x) => x.rate === rate); return '+' + rate + ' % · ' + (t ? t.label : 'Majoration'); };
  const auto = Math.round((Number(String(f.base).replace(/\s/g, '').replace(',', '.')) || 0) / (monthlyHours || 173.33));

  const submit = (ev) => {
    ev.preventDefault();
    setErr(''); setBusy(true);
    const body = {
      base: f.base, bonuses: f.bonuses || 0, advances: f.advances || 0, otherDeductions: f.otherDeductions || 0, note: f.note,
      overtimeHours: rows.filter((r) => r.hours !== '').map((r) => ({ rate: r.rate, hours: r.hours })), hourlyRate: f.hourlyRate || 0,
      annualBonus: annual ? (f.annualBonus || 0) : 0, annualBonusLabel: annual ? f.annualBonusLabel : '',
    };
    if (!rows.some((r) => r.hours !== '')) body.overtime = f.overtime || 0;
    oapi('PUT', '/payroll/slips/' + s.id, body).then(() => onDone()).catch((e) => { setErr(e.message || 'Erreur'); setBusy(false); });
  };
  const fld = (k, text, extra) => (
    <label className="fld" key={k}><span>{text}</span><input style={INP} inputMode="decimal" autoComplete="off" value={f[k]} onChange={(e) => set(k, e.target.value)} {...(extra || {})} /></label>
  );
  const cur = info.org.currency;
  return (
    <form className="ws-form" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }} noValidate onSubmit={submit}>
      {fld('base', 'Salaire de base (' + cur + ')')}
      {fld('bonuses', 'Primes (' + cur + ')')}
      <div className="ws-card" style={{ margin: 0, minWidth: 0 }}>
        <h3 style={{ margin: '0 0 6px' }}>Heures supplémentaires</h3>
        <p className="muted small">{'Indiquez les heures par palier : montant = heures × taux horaire × (1 + majoration). Sans taux horaire saisi, il est calculé : salaire de base ÷ ' + (monthlyHours || 173.33) + ' h (soit ' + auto.toLocaleString('fr-FR') + ' ' + cur + ' de l\'heure).'}</p>
        {rows.map((r, i) => (
          <div key={i} style={WRAP}>
            <label className="fld" style={{ flex: '1 1 150px', minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}><span>Palier</span>
              <select style={{ ...INP, minWidth: 0, textOverflow: 'ellipsis' }} value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)}>{rates.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
            </label>
            <label className="fld" style={{ flex: '0 1 110px', minWidth: 0 }}><span>Heures</span><input style={INP} inputMode="decimal" value={r.hours} onChange={(e) => setRow(i, 'hours', e.target.value)} /></label>
            <button className="btn small" type="button" style={BTN} aria-label={'Retirer la ligne ' + (i + 1)} onClick={() => setRows((l) => l.filter((_, j) => j !== i))}>Retirer</button>
          </div>
        ))}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn small" type="button" style={BTN} disabled={rows.length >= 10 || !rates.length} onClick={() => setRows((l) => l.concat([{ rate: String(rates[0]), hours: '' }]))}>Ajouter des heures</button>
        </div>
        {rows.length ? fld('hourlyRate', 'Taux horaire (facultatif, ' + cur + ')', { placeholder: 'Calculé : ' + auto }) : fld('overtime', 'Heures supplémentaires : montant (' + cur + ')')}
        {!rates.length ? <p className="muted small">Aucun palier : ajoutez-en dans Paramètres, ou saisissez le montant.</p> : null}
      </div>
      <div className="ws-card" style={{ margin: 0, minWidth: 0 }}>
        <Check checked={annual} onChange={setAnnual} label="13e mois ou prime annuelle" hint="Ajouté au salaire brut de ce bulletin (les retenues s'appliquent selon vos paramètres)." />
        {annual ? (
          <>
            <button className="btn small" type="button" style={BTN} onClick={() => { set('annualBonus', f.base); set('annualBonusLabel', '13e mois'); }}>Un mois de salaire de base (13e mois)</button>
            {fld('annualBonus', 'Montant (' + cur + ')')}
            <label className="fld"><span>Intitulé</span><input style={INP} maxLength={60} placeholder="13e mois, prime de fin d'année…" value={f.annualBonusLabel} onChange={(e) => set('annualBonusLabel', e.target.value)} /></label>
          </>
        ) : null}
      </div>
      {fld('advances', 'Avances et acomptes à déduire (' + cur + ')')}
      {fld('otherDeductions', 'Autres retenues (' + cur + ')')}
      <label className="fld"><span>Remarque</span><input style={INP} maxLength={200} value={f.note} onChange={(e) => set('note', e.target.value)} /></label>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" style={BTN} disabled={busy}>Enregistrer</button></div>
    </form>
  );
}
