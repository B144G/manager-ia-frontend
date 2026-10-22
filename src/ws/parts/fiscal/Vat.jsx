import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Loading, useLoad } from '../../ui.jsx';

/* Estimation de la TVA du mois : TVA collectée (comptes 443) moins TVA déductible (comptes 445), d'après les écritures. */
export default function Vat() {
  const { oapi, money } = useWs();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/fiscal/vat?month=' + month), [month]);
  const v = st.data;
  return (
    <div className="ws-card">
      <div className="row">
        <h2 className="grow">TVA du mois</h2>
        <input type="month" value={month} aria-label="Mois" onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
      </div>
      {st.loading && !v ? <Loading /> : null}
      {st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
      {v ? (
        <>
          <div className="line"><span>TVA collectée (sur vos ventes)</span><b>{money(v.collected)}</b></div>
          <div className="line"><span>TVA déductible (sur vos achats)</span><b>{money(v.deductible)}</b></div>
          <div className="line"><span><b>{v.credit > 0 ? 'Crédit de TVA' : 'TVA à payer (estimation)'}</b></span><b className={v.credit > 0 ? 'ok' : ''}>{money(v.credit > 0 ? v.credit : v.due)}</b></div>
          {v.missing.length ? (
            <div style={{ marginTop: 10 }}>
              <p className="small"><b>Ce qui manque pour une estimation complète :</b></p>
              {v.missing.map((m, i) => <p className="small muted" key={i}>{'• ' + m}</p>)}
            </div>
          ) : null}
          <p className="muted small">{v.notice + ' Document de travail préparé par MANAGER-IA, à faire valider par un expert-comptable avant tout dépôt officiel.'}</p>
        </>
      ) : null}
    </div>
  );
}
