import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';

/** Saisie d'une écriture à la main (ou préremplie par l'IA). */
export default function EntryForm({ accs, JN, pre, close, onSaved }) {
  const { oapi, money, today, toast } = useWs();
  const [journal, setJournal] = useState((pre && pre.journal) || 'OD');
  const [date, setDate] = useState((pre && pre.date) || today());
  const [label, setLabel] = useState((pre && pre.label) || '');
  const [piece, setPiece] = useState('');
  const [lines, setLines] = useState(() => ((pre && pre.lines) || [{}, {}]).map((v) => ({ account: v.account || '', debit: v.debit ? String(v.debit) : '', credit: v.credit ? String(v.credit) : '' })));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const nameOf = (code) => { const a = accs.find((x) => x.code === code); return a ? a.label : ''; };
  const setLine = (i, k, v) => setLines((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  let d = 0;
  let cr = 0;
  lines.forEach((l) => { d += Number(l.debit) || 0; cr += Number(l.credit) || 0; });
  const total = 'Débit ' + money(d) + ' · Crédit ' + money(cr) + (d === cr && d > 0 ? ' ✓ équilibrée' : d !== cr ? ' — écart ' + money(Math.abs(d - cr)) : '');

  function save() {
    setErr(''); setBusy(true);
    oapi('POST', '/accounting/entries', {
      journal, date, label, piece,
      lines: lines.filter((l) => l.account.trim()).map((l) => ({ account: l.account.trim(), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    }).then((r) => { close(); toast('Écriture ' + r.number + ' enregistrée.'); onSaved(); }, (e) => { setErr(e.message); setBusy(false); });
  }

  return (
    <>
      <datalist id="acc-list">{accs.map((a) => <option key={a.code} value={a.code} label={a.label} />)}</datalist>
      <div className="row">
        <select aria-label="Journal" value={journal} onChange={(e) => setJournal(e.target.value)}>
          {Object.keys(JN).map((k) => <option key={k} value={k}>{JN[k]}</option>)}
        </select>
        <input type="date" value={date} aria-label="Date" onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ margin: '6px 0' }}>
        <input type="text" value={label} placeholder="Libellé" maxLength={200} aria-label="Libellé" onChange={(e) => setLabel(e.target.value)} />
        <input type="text" value={piece} placeholder="Pièce (facultatif)" maxLength={60} aria-label="Pièce" onChange={(e) => setPiece(e.target.value)} />
      </div>
      <div>
        {lines.map((l, i) => (
          <div className="row" style={{ margin: '4px 0' }} key={i}>
            <input type="text" list="acc-list" placeholder="Compte" value={l.account} aria-label="Compte" style={{ width: 90 }} onChange={(e) => setLine(i, 'account', e.target.value)} />
            <small className="muted" style={{ flex: 1 }}>{nameOf(l.account.trim())}</small>
            <input type="number" min="0" step="1" placeholder="Débit" value={l.debit} aria-label="Débit" style={{ width: 110 }} onChange={(e) => setLine(i, 'debit', e.target.value)} />
            <input type="number" min="0" step="1" placeholder="Crédit" value={l.credit} aria-label="Crédit" style={{ width: 110 }} onChange={(e) => setLine(i, 'credit', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="row"><button className="btn small" type="button" onClick={() => setLines((l) => [...l, { account: '', debit: '', credit: '' }])}>+ Ajouter une ligne</button></div>
      <p className="muted" role="status">{total}</p>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={busy} onClick={save}>Enregistrer l'écriture</button></div>
      <p className="muted small">Une écriture enregistrée ne se modifie plus : si vous vous trompez, annulez-la par une écriture inverse.</p>
    </>
  );
}
