import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BTN, TAP, WorkNotice } from '../finance/util.jsx';

/* Budget annuel : prévu par catégorie et par mois, réalisé lu dans la comptabilité (une seule source de vérité), écarts et engagements. */

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

function Editor({ year, lines, close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const [rows, setRows] = useState(() => lines.map((l) => ({ kind: l.kind, category: l.category, amounts: l.planned.map(String) })));
  const [busy, setBusy] = useState(false);
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = () => {
    setBusy(true);
    oapi('PUT', '/budget/annual', { year, lines: rows.filter((r) => r.category.trim()).map((r) => ({ kind: r.kind, category: r.category, amounts: r.amounts })) })
      .then(() => { close(); done(); }).catch(fail).finally(() => setBusy(false));
  };
  return (
    <div>
      <p className="muted small">{t("Saisissez le prévu de chaque mois. « Répéter » recopie le mois de janvier sur toute l'année.")}</p>
      <div style={{ overflowX: 'auto' }}>
        {rows.map((r, i) => (
          <div key={i} className="ws-card" style={{ minWidth: 640 }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <select aria-label={t('Type')} style={{ fontSize: 16 }} value={r.kind} onChange={(e) => set(i, { kind: e.target.value })}><option value="expense">{t('Sortie (dépense)')}</option><option value="income">{t('Entrée (recette)')}</option></select>
              <input aria-label={t('Catégorie')} style={{ fontSize: 16 }} value={r.category} placeholder={t('Catégorie')} onChange={(e) => set(i, { category: e.target.value })} />
              <button className="link" type="button" style={TAP} onClick={() => set(i, { amounts: r.amounts.map(() => r.amounts[0]) })}>{t('Répéter janvier')}</button>
              <button className="link" type="button" style={TAP} onClick={() => setRows((l) => l.filter((_, j) => j !== i))}>{t('Retirer')}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(48px, 1fr))', gap: 4 }}>
              {r.amounts.map((a, k) => <input key={k} aria-label={MONTHS[k]} style={{ fontSize: 16, minWidth: 0 }} inputMode="numeric" value={a} onChange={(e) => set(i, { amounts: r.amounts.map((x, m) => (m === k ? e.target.value : x)) })} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn small" type="button" style={BTN} onClick={() => setRows((r) => [...r, { kind: 'expense', category: '', amounts: Array(12).fill('0') }])}>{t('Ajouter une ligne')}</button>
        <button className="btn primary small" type="button" style={BTN} disabled={busy} onClick={save}>{t('Enregistrer le budget')}</button>
      </div>
    </div>
  );
}

function Duplicates({ year, onLinked }) {
  const t = useT();
  const { oapi, money, dateFr, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/budget/duplicates?year=' + year), [year]);
  if (!st.data || !st.data.duplicates.length) return null;
  const link = () => oapi('POST', '/budget/duplicates/link', { pairs: st.data.duplicates.map((d) => ({ budgetEntryId: d.budgetEntryId, accEntryId: d.accEntryId })) }).then((r) => { toast(t('{n} ligne(s) liée(s) à la comptabilité.', { n: r.linked })); st.reload(); onLinked(); }).catch(fail);
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{t('Doublons probables avec la comptabilité')}</h2><button className="btn primary small" type="button" style={BTN} onClick={link}>{t('Tout lier')}</button></div>
      <p className="muted small">{t('Ces lignes du budget ressemblent à des écritures déjà passées (même montant, dates proches). Les lier évite de les compter deux fois.')}</p>
      {st.data.duplicates.map((d) => <div className="line" key={d.budgetEntryId}><span>{d.budgetLabel + ' · ' + dateFr(d.date)}<br /><small className="muted">{d.number + ' · ' + d.accLabel}</small></span><b>{money(d.amount)}</b></div>)}
    </div>
  );
}

export default function AnnualTab() {
  const t = useT();
  const { oapi, money, modal, fail, toast, today } = useWs();
  const [year, setYear] = useState(() => today().slice(0, 4));
  const st = useLoad(() => oapi('GET', '/budget/annual?year=' + year), [year]);
  const reload = st.reload;
  const init = () => oapi('POST', '/budget/annual/init', { year }).then(() => { toast(t('Budget initialisé depuis vos limites mensuelles.')); reload(); }).catch(fail);
  return (
    <>
      <WorkNotice>{t("Estimation de gestion à partir de vos données : ce n'est pas un conseil financier. Le réalisé vient de la comptabilité.")}</WorkNotice>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <input type="number" min="2000" max="2100" style={{ fontSize: 16, minHeight: 44, width: 110 }} aria-label={t('Année')} value={year} onChange={(e) => { if (/^\d{4}$/.test(e.target.value)) setYear(e.target.value); }} />
        <Loaded state={st}>{(j) => <>
          <button className="btn primary small" type="button" style={BTN} onClick={() => modal(t('Budget {year}', { year }), (close) => <Editor year={year} lines={j.lines} close={close} done={reload} />, { wide: true })}>{t('Modifier le budget')}</button>
          {!j.hasPlan ? <button className="btn small" type="button" style={BTN} onClick={init}>{t('Reprendre mes limites mensuelles')}</button> : null}</>}</Loaded>
      </div>
      <Loaded state={st}>
        {(j) => (
          <>
            <div className="kpis">
              <div className="stat"><b>{money(j.totals.incomeRealized)}</b><span>{t('recettes réalisées (prévu {amount})', { amount: money(j.totals.incomePlanned) })}</span></div>
              <div className={'stat' + (j.totals.expensePlanned && j.totals.expenseRealized > j.totals.expensePlanned ? ' bad' : '')}><b>{money(j.totals.expenseRealized)}</b><span>{t('dépenses réalisées (prévu {amount})', { amount: money(j.totals.expensePlanned) })}</span></div>
              <div className="stat"><b>{money(j.commitments.total)}</b><span>{t('engagé (commandes, factures à payer)')}</span></div>
            </div>
            {j.totals.manual ? <p className="small late">{t('{amount} saisis au budget ne sont pas encore dans la comptabilité (« hors compta »).', { amount: money(j.totals.manual) })}</p> : null}
            {!j.lines.length ? <Empty text={t("Aucune ligne. Cliquez sur « Modifier le budget » pour saisir le prévu de chaque catégorie.")} /> : null}
            {['income', 'expense'].map((kind) => j.lines.some((l) => l.kind === kind) ? (
              <div className="ws-card" key={kind} style={{ overflowX: 'auto' }}>
                <h2>{kind === 'income' ? t('Recettes') : t('Dépenses')}</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead><tr><th style={{ textAlign: 'left' }}>{t('Catégorie')}</th><th style={{ textAlign: 'right' }}>{t('Prévu')}</th><th style={{ textAlign: 'right' }}>{t('Réalisé')}</th><th style={{ textAlign: 'right' }}>{t('Écart')}</th><th style={{ textAlign: 'right' }}>{t('Engagé')}</th></tr></thead>
                  <tbody>
                    {j.lines.filter((l) => l.kind === kind).map((l) => (
                      <tr key={l.category}>
                        <td>{l.category}{l.manualTotal ? <small className="muted">{' · ' + t('dont {amount} hors compta', { amount: money(l.manualTotal) })}</small> : null}{l.overBudget ? <>{' '}<span className="pill bad">{t('Dépassement prévu')}</span></> : null}</td>
                        <td style={{ textAlign: 'right' }}>{money(l.plannedTotal)}</td>
                        <td style={{ textAlign: 'right' }}>{money(l.realizedTotal)}</td>
                        <td style={{ textAlign: 'right' }} className={l.favorable ? 'ok' : 'late'}>{(l.gap > 0 ? '+' : '') + money(l.gap) + (l.gapPct === null ? '' : ' (' + l.gapPct + ' %)')}</td>
                        <td style={{ textAlign: 'right' }}>{l.committed ? money(l.committed) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null)}
            {j.lines.length ? (
              <div className="ws-card" style={{ overflowX: 'auto' }}>
                <h2>{t('Mois par mois (dépenses : prévu / réalisé)')}</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead><tr><th style={{ textAlign: 'left' }}>{t('Catégorie')}</th>{MONTHS.map((m) => <th key={m} style={{ textAlign: 'right' }}>{m}</th>)}</tr></thead>
                  <tbody>
                    {j.lines.filter((l) => l.kind === 'expense').map((l) => <tr key={l.category}><td>{l.category}</td>{MONTHS.map((m, i) => <td key={m} style={{ textAlign: 'right', fontSize: 12 }} className={l.realized[i] > l.planned[i] && l.planned[i] ? 'late' : ''}>{money(l.planned[i]).replace(/\s?[A-Za-z]+$/, '') + ' / ' + money(l.realized[i]).replace(/\s?[A-Za-z]+$/, '')}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            ) : null}
            <Duplicates year={year} onLinked={reload} />
            <p className="muted small">{t(j.source.note)}</p>
          </>
        )}
      </Loaded>
    </>
  );
}
