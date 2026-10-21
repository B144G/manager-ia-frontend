import { useEffect, useRef } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';
import Instructions from '../parts/billing/Instructions.jsx';

/* Abonnement (offre actuelle, quotas, choix d'une offre, paiement MTN / Orange, historique). Réservée au propriétaire. */
const ST = { pending: ['En attente', 'mid'], awaiting_validation: ['À valider', 'mid'], paid: ['Payé', 'good'], failed: ['Échoué', 'bad'] };
const fr = (dateFr, iso) => (iso ? dateFr(String(iso).slice(0, 10)) : '');

export default function Billing() {
  const { rq, money, dateFr, modal } = useWs();
  const st = useLoad(() => rq('GET', '/api/billing'), []);
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  function instructions(r) {
    modal('Finalisez votre paiement', (close) => <Instructions r={r} close={close} onDone={st.reload} aliveRef={aliveRef} />, { onclose: st.reload });
  }

  function pay(p, b) {
    modal((p.current ? 'Renouveler ' : 'Passer à ') + p.name, (close) => (
      <>
        <p>{money(p.priceXAF) + ' pour ' + b.durationDays + ' jours.'}</p>
        <Form
          submitText="Payer"
          fields={[
            { k: 'operator', label: 'Opérateur', type: 'select', options: [['mtn', 'MTN Mobile Money'], ['orange', 'Orange Money']] },
            { k: 'phone', label: 'Numéro qui paie (ex. 6XXXXXXXX)', required: true },
          ]}
          onSubmit={(v) => rq('POST', '/api/payments/initiate', { plan: p.id, operator: v.operator, phone: v.phone }).then((r) => { close(); instructions(r); })}
        />
      </>
    ));
  }

  function show(b) {
    const paid = b.plan !== 'Gratuit';
    const s = b.daysLeft > 1 ? 's' : '';
    return (
      <>
        <div className="ws-card">
          <h2>{'Offre actuelle : ' + b.plan}</h2>
          <p>{paid ? "Active jusqu'au " + fr(dateFr, b.expiresAt) + ' (' + b.daysLeft + ' jour' + s + ' restant' + s + ').' : 'Offre gratuite : essayez MANAGER-IA, puis passez à une offre payante quand vous êtes prêt.'}</p>
          {paid && b.daysLeft <= 7 ? <p className="pill mid">Votre abonnement se termine bientôt : renouvelez pour ne pas perdre vos quotas.</p> : null}
          {paid ? <p className="muted small">Le changement d'offre n'est possible qu'à la fin de l'abonnement. Vous pouvez renouveler votre offre à tout moment : les jours s'ajoutent.</p> : null}
        </div>

        {b.orgs.length ? (
          <div className="ws-card">
            <h2>Messages IA du mois</h2>
            {b.orgs.map((o, i) => {
              const pct = Math.min(100, Math.round(100 * o.aiUsed / Math.max(1, o.aiMax)));
              return (
                <div className="line" key={o.id !== undefined ? o.id : i}>
                  <span><b>{o.name}</b><small>{' ' + o.aiUsed + ' sur ' + o.aiMax + ' · se renouvelle le ' + fr(dateFr, o.periodEnd)}</small></span>
                  <span className={'pill ' + (pct >= 90 ? 'bad' : pct >= 70 ? 'mid' : 'good')}>{pct + ' %'}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="ws-card">
          <h2>Choisir ou renouveler une offre</h2>
          <div className="kpis">
            {b.plans.map((p) => {
              const l = p.limits;
              return (
                <div className={'stat' + (p.current ? ' good' : '')} key={p.id}>
                  <b>{p.name}</b>
                  <span>{money(p.priceXAF) + ' / ' + b.durationDays + ' jours'}</span>
                  <small>{l.aiMonth + ' messages IA · ' + l.members + ' personnes · ' + l.orgs + ' organisation' + (l.orgs > 1 ? 's' : '')}</small>
                  <button className={'btn small' + (p.current ? '' : ' primary')} type="button" disabled={!p.available} title={p.reason || undefined} onClick={() => pay(p, b)}>{p.current ? 'Renouveler' : 'Choisir'}</button>
                  {!p.available ? <small className="muted">Disponible à la fin de votre abonnement.</small> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ws-card">
          <h2>Historique des paiements</h2>
          {!b.history.length ? <Empty text="Aucun paiement pour le moment." /> : null}
          {b.history.map((p, i) => {
            const stt = ST[p.status] || [p.status, 'mid'];
            return (
              <div className="line" key={p.reference || i}>
                <span><b>{p.plan + ' · ' + money(p.amountXAF)}</b><small>{' ' + fr(dateFr, p.createdAt) + ' · ' + (p.operator === 'orange' ? 'Orange Money' : 'MTN Mobile Money') + ' · réf. ' + p.reference}</small></span>
                <span className={'pill ' + stt[1]}>{stt[0]}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ws-head"><div><h1>Abonnement</h1><p className="muted">Votre offre, vos quotas et vos paiements.</p></div></div>
      <div><Loaded state={st}>{show}</Loaded></div>
    </>
  );
}
