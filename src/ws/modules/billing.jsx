import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';
import Instructions from '../parts/billing/Instructions.jsx';
import CustomPlan from '../parts/billing/Custom.jsx';

/* Abonnement (offre actuelle, quotas, choix d'une offre, paiement MTN / Orange, historique). Réservée au propriétaire. */
const ST = { pending: ['En attente', 'mid'], awaiting_validation: ['À valider', 'mid'], paid: ['Payé', 'good'], failed: ['Échoué', 'bad'] };
const fr = (dateFr, iso) => (iso ? dateFr(String(iso).slice(0, 10)) : '');

export default function Billing() {
  const { rq, money, dateFr, modal } = useWs();
  const t = useT();
  // Nom d'une offre : « Sur mesure|15000|7 » devient « Sur mesure (15 000 FCFA / semaine) » dans la langue affichée
  const planName = (key, label) => {
    const m = /^Sur mesure\|(\d+)\|(\d+)$/.exec(String(key || ''));
    return m ? t('Sur mesure ({price} / {duration})', { price: money(Number(m[1])), duration: ({ 7: t('semaine'), 91: t('trimestre'), 183: t('semestre'), 365: t('an') })[Number(m[2])] || t('mois') }) : t(label || key);
  };
  const st = useLoad(() => rq('GET', '/api/billing'), []);
  const [tab, setTab] = useState('plans');
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  function instructions(r) {
    modal(t('Finalisez votre paiement'), (close) => <Instructions r={r} close={close} onDone={st.reload} aliveRef={aliveRef} />, { onclose: st.reload });
  }

  // p = une offre habituelle { id, name, priceXAF, current } ou un forfait sur mesure { custom: { amount, period }, name, priceXAF, days, current }
  function pay(p, b) {
    modal(p.current ? t('Renouveler {plan}', { plan: t(p.name) }) : t('Passer à {plan}', { plan: t(p.name) }), (close) => (
      <>
        <p>{t('{price} pour {days} jours.', { price: money(p.priceXAF), days: p.days || b.durationDays })}</p>
        <Form
          submitText={t('Payer')}
          fields={[
            { k: 'operator', label: t('Opérateur'), type: 'select', options: [['mtn', 'MTN Mobile Money'], ['orange', 'Orange Money']] },
            { k: 'phone', label: t('Numéro qui paie (ex. 6XXXXXXXX)'), required: true },
          ]}
          onSubmit={(v) => rq('POST', '/api/payments/initiate', Object.assign({ operator: v.operator, phone: v.phone }, p.custom ? { custom: p.custom } : { plan: p.id })).then((r) => { close(); instructions(r); })}
        />
      </>
    ));
  }

  function show(b) {
    const paid = b.plan !== 'Gratuit';
    return (
      <>
        <div className="ws-card">
          <h2>{t('Offre actuelle : {plan}', { plan: planName(b.plan, b.plan) })}</h2>
          <p>{paid ? (b.daysLeft > 1 ? t("Active jusqu'au {date} ({n} jours restants).", { date: fr(dateFr, b.expiresAt), n: b.daysLeft }) : t("Active jusqu'au {date} ({n} jour restant).", { date: fr(dateFr, b.expiresAt), n: b.daysLeft })) : t('Offre gratuite : essayez Brij-IA, puis passez à une offre payante quand vous êtes prêt.')}</p>
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

        <div className="ws-tabs">
          <button type="button" className={'tab' + (tab === 'plans' ? ' on' : '')} onClick={() => setTab('plans')}>{t('Nos offres')}</button>
          <button type="button" className={'tab' + (tab === 'custom' ? ' on' : '')} onClick={() => setTab('custom')}>{t('Sur mesure')}</button>
        </div>

        {tab === 'custom' ? <CustomPlan b={b} onPay={(p) => pay(p, b)} /> : null}

        {tab === 'plans' ? (
        <div className="ws-card">
          <h2>{t('Offre Illimité : choisissez la durée')}</h2>
          <p className="muted">{t("Organisations, personnes et antennes sans limite pratique, toutes les fonctions. Plus la durée est longue, plus le prix par mois baisse. Vous pouvez prolonger à tout moment : les jours s'ajoutent.")}</p>
          <div className="kpis">
            {b.plans.map((p) => {
              const l = p.limits;
              const months = p.days / 30;
              const names = { week: t('Une semaine'), month: t('Un mois'), quarter: t('Un trimestre'), semester: t('Un semestre'), year: t('Un an') };
              const perMonth = Math.round(p.priceXAF / months / 500) * 500;
              return (
                <div className={'stat' + (p.current ? ' good' : '')} key={p.id}>
                  <b>{t('Illimité') + ' · ' + (names[p.period] || p.period)}</b>
                  <span>{money(p.priceXAF) + ' / ' + t('{n} jours', { n: p.days })}</span>
                  {p.period === 'week' || p.period === 'month' ? null : <small>{t('soit {price} par mois', { price: money(perMonth) })}</small>}
                  <small>{t('{ai} messages IA par mois', { ai: l.aiMonth })}</small>
                  <button className={'btn small' + (p.current ? '' : ' primary')} type="button" disabled={!p.available} title={p.reason ? tsrv(p.reason) : undefined} onClick={() => pay({ id: p.id, name: t('Illimité') + ' · ' + (names[p.period] || p.period), priceXAF: p.priceXAF, days: p.days, current: p.current }, b)}>{p.current ? t('Prolonger') : t('Choisir')}</button>
                  {!p.available ? <small className="muted">{t('Disponible à la fin de votre abonnement.')}</small> : null}
                </div>
              );
            })}
          </div>
        </div>
        ) : null}

        <div className="ws-card">
          <h2>{t('Historique des paiements')}</h2>
          {!b.history.length ? <Empty text={t('Aucun paiement pour le moment.')} /> : null}
          {b.history.map((p, i) => {
            const stt = ST[p.status] || [p.status, 'mid'];
            return (
              <div className="line" key={p.reference || i}>
                <span><b>{planName(p.planKey, p.plan) + ' · ' + money(p.amountXAF)}</b><small>{' ' + fr(dateFr, p.createdAt) + ' · ' + (p.operator === 'orange' ? 'Orange Money' : 'MTN Mobile Money') + ' · ' + t('réf. {ref}', { ref: p.reference })}</small></span>
                <span className="row">{p.status === 'paid' ? <a className="link" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }} href={'/recu/' + encodeURIComponent(p.reference)} target="_blank" rel="noopener noreferrer">{t('Reçu à imprimer')}</a> : null}<span className={'pill ' + stt[1]}>{t(stt[0])}</span></span>
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
