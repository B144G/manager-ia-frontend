import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import Guided from './Guided.jsx';
import LinesEditor, { cleanLines } from './LinesEditor.jsx';

/** Saisie d'une écriture à la main (ou préremplie par l'IA), ou en mode guidé par modèle. */
export default function EntryForm({ accs, JN, pre, sections, close, onSaved }) {
  const t = useT();
  const { oapi, money, today, toast } = useWs();
  const [guided, setGuided] = useState(false);
  const [journal, setJournal] = useState((pre && pre.journal) || 'OD');
  const [date, setDate] = useState((pre && pre.date) || today());
  const [label, setLabel] = useState((pre && pre.label) || '');
  const [piece, setPiece] = useState('');
  const [lines, setLines] = useState(() => ((pre && pre.lines) || [{}, {}]).map((v) => ({ account: v.account || '', debit: v.debit ? String(v.debit) : '', credit: v.credit ? String(v.credit) : '', section: v.section || '' })));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  let d = 0;
  let cr = 0;
  lines.forEach((l) => { d += Number(l.debit) || 0; cr += Number(l.credit) || 0; });
  const total = t('Débit {d} · Crédit {c}', { d: money(d), c: money(cr) }) + (d === cr && d > 0 ? ' ' + t('✓ équilibrée') : d !== cr ? ' — ' + t('écart {amount}', { amount: money(Math.abs(d - cr)) }) : '');

  function save() {
    setErr(''); setBusy(true);
    oapi('POST', '/accounting/entries', { journal, date, label, piece, lines: cleanLines(lines) })
      .then((r) => { close(); toast(t('Écriture {number} enregistrée.', { number: r.number })); onSaved(); }, (e) => { setErr(t(e.message)); setBusy(false); });
  }

  if (guided) return <Guided sections={sections} close={close} onSaved={onSaved} back={() => setGuided(false)} />;
  return (
    <>
      {!pre ? (
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn small" type="button" onClick={() => setGuided(true)}>{t('Saisie guidée (modèles : loyer, salaire, vente…)')}</button>
        </div>
      ) : null}
      <div className="row">
        <select aria-label={t('Journal')} value={journal} onChange={(e) => setJournal(e.target.value)}>
          {Object.keys(JN).map((k) => <option key={k} value={k}>{t(JN[k])}</option>)}
        </select>
        <input type="date" value={date} aria-label={t('Date')} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ margin: '6px 0' }}>
        <input type="text" value={label} placeholder={t('Libellé')} maxLength={200} aria-label={t('Libellé')} onChange={(e) => setLabel(e.target.value)} />
        <input type="text" value={piece} placeholder={t('Pièce (facultatif)')} maxLength={60} aria-label={t('Pièce')} onChange={(e) => setPiece(e.target.value)} />
      </div>
      <LinesEditor accs={accs} lines={lines} setLines={setLines} sections={sections} />
      <p className="muted" role="status">{total}</p>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={busy} onClick={save}>{t("Enregistrer l'écriture")}</button></div>
      <p className="muted small">{t('Une écriture enregistrée ne se modifie plus : si vous vous trompez, annulez-la par une écriture inverse.')}</p>
    </>
  );
}
