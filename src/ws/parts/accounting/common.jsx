import { useWs } from '../../WsContext.jsx';

/** Sélecteur d'exercice (5 dernières années). */
export function YearBar({ year, setYear }) {
  const y = new Date().getFullYear();
  const years = [];
  for (let i = y; i >= y - 4; i--) years.push(String(i));
  return (
    <div className="row" style={{ marginBottom: 8 }}>
      <span className="muted small">Exercice :</span>
      <select aria-label="Année" value={year} onChange={(e) => setYear(e.target.value)}>
        {years.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

/** Une écriture comptable (carte). */
export function EntryCard({ e, canUndo, JN, onReverse }) {
  const { money, dateFr, confirm } = useWs();
  const tot = e.lines.reduce((a, l) => a + l.debit, 0);
  return (
    <div className="line" style={{ display: 'block' }}>
      <div className="row">
        <b>{e.number}</b>
        <span className="muted small">{dateFr(e.date) + ' · ' + (JN[e.journal] || e.journal)}</span>
        <span className="grow" />
        <b>{money(tot)}</b>
        {canUndo && !e.reversedOf ? (
          <button className="link" type="button" onClick={() => confirm("Annuler l'écriture " + e.number + ' par une écriture inverse ? (Elle reste visible dans le journal.)', () => onReverse(e))}>Annuler</button>
        ) : null}
      </div>
      <div>{e.label}</div>
      {e.lines.map((l, i) => (
        <div className="muted small" style={{ display: 'flex', gap: 12 }} key={i}>
          <span style={{ minWidth: 60 }}>{l.account}</span>
          <span style={{ flex: 1 }}>{l.memo || ''}</span>
          <span style={{ minWidth: 90, textAlign: 'right' }}>{l.debit ? money(l.debit) : ''}</span>
          <span style={{ minWidth: 90, textAlign: 'right' }}>{l.credit ? money(l.credit) : ''}</span>
        </div>
      ))}
    </div>
  );
}

/** Ligne « compte + libellé + montant » des états. */
export function AmountLine({ x }) {
  const { money } = useWs();
  return (
    <div className="line">
      <span><b>{x.account}</b><small>{' ' + x.label}</small></span>
      <span>{money(x.amount)}</span>
    </div>
  );
}
