import { useEffect, useRef } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';
import Instructions from '../parts/billing/Instructions.jsx';

/* Abonnement (offre actuelle, quotas, choix d'une offre, paiement MTN / Orange, historique). Réservée au propriétaire. */
const ST = { pending: ['En attente', 'mid'], awaiting_validation: ['À valider', 'mid'], paid: ['Payé', 'good'], failed: ['Échoué', 'bad'] };
const fr = (dateFr, iso) => (iso ? dateFr(String(iso).slice(0, 10)) : '');

export default function Billing() {
  const { rq, money, dateFr, modal } = useWs();
  const t = useT();
  const st = useLoad(() => rq('GET', '/api/billing'), []);
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  function instructions(r) {
    modal(t('Finalisez votre paiement'), (close) => <Instructions r={r} close={close} onDone={st.reload} aliveRef={aliveRef} />, { onclose: st.reload });
  }

  function pay(p, b) {
    modal(p.current ? t('Renouveler {plan}', { plan: t(p.name) }) : t('Passer à {plan}', { plan: t(p.name) }), (close) => (
      <>
        <p>{t('{price} pour {days} jours.', { price: money(p.priceXAF), days: b.durationDays })}</p>
        <Form
          submitText={t('Payer')}
          fields={[
            { k: 'operator', label: t('Opérateur'), type: 'select', options: [['mtn', 'MTN Mobile Money'], ['orange', 'Orange Money']] },
            { k: 'phone', label: t('Numéro qui paie (ex. 6XXXXXXXX)'), required: true },
          ]}
          onSubmit={(v) => rq('POST', '/api/payments/initiate', { plan: p.id, operator: v.operator, phone: v.phone }).then((r) => { close(); instructions(r); })}
        />
      </>
    ));
  }

  function show(b) {
    const paid = b.plan !== 'Gratuit';
    return (
      <>
        <div className="ws-card">
          <h2>{t('Offre actuelle : {plan}', { plan: t(b.plan) })}</h2>
          <p>{paid ? (b.daysLeft > 1 ? t("Active jusqu'au {date} ({n} jours restants).", { date: fr(dateFr, b.expiresAt), n: b.daysLeft }) : t("Active jusqu'au {date} ({n} jour restant).", { date: fr(dateFr, b.expiresAt), n: b.daysLeft })) : t('Offre gratuite : essayez MANAGER-IA, puis passez à une offre payante quand vous êtes prêt.')}</p>
          {paid && b.daysLeft <= 7 ? <p className="pill mid">{t('Votre abonnement se termine bientôt : renouvelez pour ne pas perdre vos quotas.')}</p> : null}
          {paid ? <p className="muted small">{t("Le changement d'offre n'est possible qu'à la fin de l'abonnement. Vous pouvez renouveler votre offre à tout moment : les jours s'ajoutent.")}</p> : null}
        </div>

        {b.orgs.length ? (
          <div className="ws-card">
            <h2>{t('Messages IA du mois')}</h2>
            {b.orgs.map((o, i) => {
              const pct = Math.min(100, Math.round(100 * o.aiUsed / Math.max(1, o.aiMax)));
              return (
                <div className="line" key={o.id !== undefined ? o.id : i}>
                  <span><b>{o.name}</b><small>{' ' + t('{used} sur {max} · se renouvelle le {date}', { used: o.aiUsed, max: o.aiMax, date: fr(dateFr, o.periodEnd) })}</small></span>
                  <span className={'pill ' + (pct >= 90 ? 'bad' : pct >= 70 ? 'mid' : 'good')}>{pct + ' %'}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="ws-card">
          <h2>{t('Choisir ou renouveler une offre')}</h2>
          <div className="kpis">
            {b.plans.map((p) => {
              const l = p.limits;
              return (
                <div className={'stat' + (p.current ? ' good' : '')} key={p.id}>
                  <b>{t(p.name)}</b>
                  <span>{t('{price} / {days} jours', { price: money(p.priceXAF), days: b.durationDays })}</span>
                  <small>{(l.orgs > 1 ? t('{ai} messages IA · {members} personnes · {orgs} organisations', { ai: l.aiMonth, members: l.members, orgs: l.orgs }) : t('{ai} messages IA · {members} personnes · {orgs} organisation', { ai: l.aiMonth, members: l.members, orgs: l.orgs }))}</small>
                  <button className={'btn small' + (p.current ? '' : ' primary')} type="button" disabled={!p.available} title={p.reason ? tsrv(p.reason) : undefined} onClick={() => pay(p, b)}>{p.current ? t('Renouveler') : t('Choisir')}</button>
                  {!p.available ? <small className="muted">{t('Disponible à la fin de votre abonnement.')}</small> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ws-card">
          <h2>{t('Historique des paiements')}</h2>
          {!b.history.length ? <Empty text={t('Aucun paiement pour le moment.')} /> : null}
          {b.history.map((p, i) => {
            const stt = ST[p.status] || [p.status, 'mid'];
            return (
              <div className="line" key={p.reference || i}>
                <span><b>{t(p.plan) + ' · ' + money(p.amountXAF)}</b><small>{' ' + fr(dateFr, p.createdAt) + ' · ' + (p.operator === 'orange' ? 'Orange Money' : 'MTN Mobile Money') + ' · ' + t('réf. {ref}', { ref: p.reference })}</small></span>
                <span className={'pill ' + stt[1]}>{t(stt[0])}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ws-head"><div><h1>{t('Abonnement')}</h1><p className="muted">{t('Votre offre, vos quotas et vos paiements.')}</p></div></div>
      <div><Loaded state={st}>{show}</Loaded></div>
    </>
  );
}
