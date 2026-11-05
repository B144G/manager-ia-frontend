import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';

/* Forfait sur mesure : l'utilisateur choisit une durée (semaine, mois ou an) et une somme ; le serveur calcule ce que cette somme donne.
   Les contrôles de somme sont refaits ici pour afficher des messages traduits ; le serveur reste seul juge (il recalcule tout au paiement). */
const PRESETS = { week: [2500, 5000, 10000, 20000], month: [10000, 15000, 25000, 50000], year: [120000, 200000, 400000, 600000] };

export default function CustomPlan({ b, onPay }) {
  const t = useT();
  const { rq, money } = useWs();
  const info = b.custom;
  const [period, setPeriod] = useState('month');
  const [raw, setRaw] = useState('15000');
  const [quote, setQuote] = useState(null);
  const per = info.periods.find((x) => x.id === period);
  const amount = Number(String(raw).replace(/\D/g, ''));
  const names = { week: t('Une semaine'), month: t('Un mois'), year: t('Un an') };
  const short = { week: t('semaine'), month: t('mois'), year: t('an') };

  let problem = '';
  if (!amount) problem = t('Indiquez une somme en FCFA.');
  else if (amount % info.step) problem = t('La somme doit être un multiple de {n} FCFA.', { n: info.step });
  else if (amount < per.min) problem = t('Le forfait minimum pour {duration} est de {min}.', { duration: names[period].toLowerCase(), min: money(per.min) });
  else if (amount > per.max) problem = t("Au-delà de {max}, le forfait n'apporte rien de plus : il est déjà illimité.", { max: money(per.max) });

  useEffect(() => {
    if (problem) { setQuote(null); return undefined; }
    let live = true;
    const id = setTimeout(() => { rq('GET', `/api/plans/custom/quote?amount=${amount}&period=${period}`).then((j) => { if (live) setQuote(j.quote); }, () => { if (live) setQuote(null); }); }, 250);
    return () => { live = false; clearTimeout(id); };
  }, [amount, period, problem]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = b.plan !== 'Gratuit';
  const curCustom = cur && String(b.plan || '').startsWith('Sur mesure|');
  const same = quote && b.plan === quote.plan;
  const blocked = cur && !same; // une offre payante ne change qu'à la fin de l'abonnement (le même forfait peut être renouvelé)
  const l = quote && quote.limits;

  return (
    <div className="ws-card" id="custom-plan">
      <h2>{t('Forfait sur mesure')}</h2>
      <p className="muted">{t("Vous choisissez la durée et la somme : le forfait s'adapte à ce que vous payez. Le minimum est de {min} par mois.", { min: money(info.minMonth) })}</p>

      <div className="ws-tabs" role="group" aria-label={t('Durée du forfait')}>
        {info.periods.map((x) => <button key={x.id} type="button" className={'tab' + (period === x.id ? ' on' : '')} aria-pressed={period === x.id} onClick={() => { setPeriod(x.id); const p = info.periods.find((y) => y.id === x.id); if (Number(String(raw).replace(/\D/g, '')) < p.min) setRaw(String(p.min)); }}>{names[x.id]}</button>)}
      </div>

      <label className="fld" htmlFor="cp_amount"><span>{t('Votre somme (FCFA) pour {duration}', { duration: names[period].toLowerCase() })}</span>
        <input id="cp_amount" inputMode="numeric" autoComplete="off" value={raw} onChange={(e) => setRaw(e.target.value.replace(/[^\d ]/g, ''))} style={{ fontSize: 18 }} />
        <small>{t('De {min} à {max}, par tranches de {step} FCFA.', { min: money(per.min), max: money(per.max), step: info.step })}</small>
      </label>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '6px 0 12px' }}>
        {PRESETS[period].filter((v) => v >= per.min && v <= per.max).map((v) => <button key={v} type="button" className={'btn small' + (amount === v ? ' primary' : '')} onClick={() => setRaw(String(v))}>{money(v)}</button>)}
      </div>

      {problem ? <p className="ws-err" role="alert">{problem}</p> : null}

      {l ? (
        <div className="stat good" aria-live="polite" style={{ marginBottom: 12 }}>
          <b>{t('Votre forfait : {price} / {duration}', { price: money(quote.amount), duration: short[period] })}</b>
          <span>{t('Valable {n} jours', { n: quote.days })}</span>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>{quote.period === 'week' ? t('{n} messages IA sur la semaine', { n: l.aiMonth }) : t('{n} messages IA par mois', { n: l.aiMonth })}</li>
            <li>{l.members > 1 ? t('{n} personnes', { n: l.members }) : t('{n} personne', { n: l.members })}</li>
            <li>{l.orgs > 1 ? t('{n} organisations', { n: l.orgs }) : t('{n} organisation', { n: l.orgs })} · {l.branches > 1 ? t('{n} antennes', { n: l.branches }) : t('{n} antenne', { n: l.branches })}</li>
            <li>{t("{n} e-mails par jour", { n: l.emailDay })}</li>
          </ul>
          <small className="muted">{t("Ce que donne la somme : elle est ramenée à un équivalent de {eq} par mois, puis comparée à nos offres.", { eq: money(quote.equivalentMonth) })}</small>
        </div>
      ) : null}

      {blocked ? <p className="muted small">{curCustom ? t("Votre forfait sur mesure est actif : vous pouvez renouveler le même forfait à tout moment. Un autre forfait sera possible à la fin de l'abonnement.") : t("Votre offre actuelle est active : un forfait sur mesure sera possible à la fin de l'abonnement.")}</p> : null}
      <button type="button" className="btn primary" disabled={!quote || blocked} onClick={() => onPay({ custom: { amount: quote.amount, period: quote.period }, name: t('Forfait sur mesure'), priceXAF: quote.amount, days: quote.days, current: same })}>{same ? t('Renouveler ce forfait') : t('Payer ce forfait')}</button>
    </div>
  );
}
