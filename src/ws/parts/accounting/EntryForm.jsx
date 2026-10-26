import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';

/** Saisie d'une écriture à la main (ou préremplie par l'IA). */
export default function EntryForm({ accs, JN, pre, close, onSaved }) {
  const t = useT();
  const { oapi, money, today, toast } = useWs();
  const [journal, setJournal] = useState((pre && pre.journal) || 'OD');
  const [date, setDate] = useState((pre && pre.date) || today());
  const [label, setLabel] = useState((pre && pre.label) || '');
  const [piece, setPiece] = useState('');
  const [lines, setLines] = useState(() => ((pre && pre.lines) || [{}, {}]).map((v) => ({ account: v.account || '', debit: v.debit ? String(v.debit) : '', credit: v.credit ? String(v.credit) : '' })));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const nameOf = (code) => { const a = accs.find((x) => x.code === code); return a ? t(a.label) : ''; };
  const setLine = (i, k, v) => setLines((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  let d = 0;
  let cr = 0;
  lines.forEach((l) => { d += Number(l.debit) || 0; cr += Number(l.credit) || 0; });
  const total = t('Débit {d} · Crédit {c}', { d: money(d), c: money(cr) }) + (d === cr && d > 0 ? ' ' + t('✓ équilibrée') : d !== cr ? ' — ' + t('écart {amount}', { amount: money(Math.abs(d - cr)) }) : '');

  function save() {
    setErr(''); setBusy(true);
    oapi('POST', '/accounting/entries', {
      journal, date, label, piece,
      lines: lines.filter((l) => l.account.trim()).map((l) => ({ account: l.account.trim(), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    }).then((r) => { close(); toast(t('Écriture {number} enregistrée.', { number: r.number })); onSaved(); }, (e) => { setErr(t(e.message)); setBusy(false); });
  }

  return (
    <>
      <datalist id="acc-list">{accs.map((a) => <option key={a.code} value={a.code} label={t(a.label)} />)}</datalist>
      <div className="row">
        <select aria-label={t("Journal")} value={journal} onChange={(e) => setJournal(e.target.value)}>
          {Object.keys(JN).map((k) => <option key={k} value={k}>{t(JN[k])}</option>)}
        </select>
        <input type="date" value={date} aria-label={t("Date")} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ margin: '6px 0' }}>
        <input type="text" value={label} placeholder={t("Libellé")} maxLength={200} aria-label={t("Libellé")} onChange={(e) => setLabel(e.target.value)} />
        <input type="text" value={piece} placeholder={t("Pièce (facultatif)")} maxLength={60} aria-label={t("Pièce")} onChange={(e) => setPiece(e.target.value)} />
      </div>
      <div>
        {lines.map((l, i) => (
          <div className="row" style={{ margin: '4px 0' }} key={i}>
            <input type="text" list="acc-list" placeholder={t("Compte")} value={l.account} aria-label={t("Compte")} style={{ width: 90 }} onChange={(e) => setLine(i, 'account', e.target.value)} />
            <small className="muted" style={{ flex: 1 }}>{nameOf(l.account.trim())}</small>
            <input type="number" min="0" step="1" placeholder={t("Débit")} value={l.debit} aria-label={t("Débit")} style={{ width: 110 }} onChange={(e) => setLine(i, 'debit', e.target.value)} />
            <input type="number" min="0" step="1" placeholder={t("Crédit")} value={l.credit} aria-label={t("Crédit")} style={{ width: 110 }} onChange={(e) => setLine(i, 'credit', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="row"><button className="btn small" type="button" onClick={() => setLines((l) => [...l, { account: '', debit: '', credit: '' }])}>{t('+ Ajouter une ligne')}</button></div>
      <p className="muted" role="status">{total}</p>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={busy} onClick={save}>{t("Enregistrer l'écriture")}</button></div>
      <p className="muted small">{t('Une écriture enregistrée ne se modifie plus : si vous vous trompez, annulez-la par une écriture inverse.')}</p>
    </>
  );
}
