import { useT } from '../../../lib/i18n.jsx';

/** Lignes d'écriture (compte, débit, crédit et, s'il existe des sections, la section analytique). Partagé par la saisie et les écritures récurrentes. */
export default function LinesEditor({ accs, lines, setLines, sections }) {
  const t = useT();
  const nameOf = (code) => { const a = accs.find((x) => x.code === code); return a ? t(a.label) : ''; };
  const setLine = (i, k, v) => setLines((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const secs = (sections || []).filter((s) => s.active);
  return (
    <>
      <datalist id="acc-list">{accs.map((a) => <option key={a.code} value={a.code} label={t(a.label)} />)}</datalist>
      <div>
        {lines.map((l, i) => (
          <div className="row" style={{ margin: '4px 0', flexWrap: 'wrap' }} key={i}>
            <input type="text" list="acc-list" placeholder={t('Compte')} value={l.account} aria-label={t('Compte')} style={{ width: 90 }} onChange={(e) => setLine(i, 'account', e.target.value)} />
            <small className="muted" style={{ flex: 1, minWidth: 80 }}>{nameOf(l.account.trim())}</small>
            <input type="number" min="0" step="1" placeholder={t('Débit')} value={l.debit} aria-label={t('Débit')} style={{ width: 110 }} onChange={(e) => setLine(i, 'debit', e.target.value)} />
            <input type="number" min="0" step="1" placeholder={t('Crédit')} value={l.credit} aria-label={t('Crédit')} style={{ width: 110 }} onChange={(e) => setLine(i, 'credit', e.target.value)} />
            {secs.length ? (
              <select aria-label={t('Section analytique')} value={l.section || ''} style={{ maxWidth: 150, fontSize: 16 }} onChange={(e) => setLine(i, 'section', e.target.value)}>
                <option value="">{t('Sans section')}</option>
                {secs.map((s) => <option key={s.code} value={s.code}>{s.code + ' · ' + s.label}</option>)}
              </select>
            ) : null}
          </div>
        ))}
      </div>
      <div className="row"><button className="btn small" type="button" onClick={() => setLines((l) => [...l, { account: '', debit: '', credit: '', section: '' }])}>{t('+ Ajouter une ligne')}</button></div>
    </>
  );
}

/** Lignes saisies → lignes envoyées au serveur (vides ignorées, section seulement si choisie). */
export function cleanLines(lines) {
  return lines.filter((l) => l.account.trim()).map((l) => {
    const o = { account: l.account.trim(), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 };
    if (l.section) o.section = l.section;
    return o;
  });
}
