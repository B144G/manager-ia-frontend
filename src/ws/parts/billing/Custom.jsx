import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';

/* Forfait sur mesure : deux champs (le forfait en FCFA, le temps d'utilisation) et, à côté, le bloc « Accès et disponibilités » qui se met à jour en direct.
   Les contrôles de somme sont refaits ici pour afficher des messages traduits ; le serveur reste seul juge (il recalcule tout au paiement). */
const PRESETS = { week: [10000, 15000, 25000, 40000], month: [10000, 15000, 25000, 50000], quarter: [10000, 50000, 150000, 300000], semester: [10000, 100000, 300000, 600000], year: [10000, 200000, 600000, 1200000] };

export default function CustomPlan({ b, onPay }) {
  const t = useT();
  const { rq, money } = useWs();
  const info = b.custom;
  const [period, setPeriod] = useState('month');
  const [raw, setRaw] = useState('15000');
  const [quote, setQuote] = useState(null);
  const per = info.periods.find((x) => x.id === period);
  const amount = Number(String(raw).replace(/\D/g, ''));
  const names = { week: t('Une semaine'), month: t('Un mois'), quarter: t('Un trimestre'), semester: t('Un semestre'), year: t('Un an') };
  const short = { week: t('semaine'), month: t('mois'), quarter: t('trimestre'), semester: t('semestre'), year: t('an') };

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
  const changePeriod = (id) => { setPeriod(id); const p = info.periods.find((y) => y.id === id); if (amount < p.min || amount > p.max) setRaw(String(p.min)); };
  const row = (label, value) => <div className="line" key={label}><span>{label}</span><b>{value}</b></div>;

  return (
    <div id="custom-plan" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
      <div className="ws-card">
        <h2>{t('Définir votre forfait')}</h2>
        <p className="muted">{t("Choisissez la somme et le temps d'utilisation : les accès s'adaptent à ce que vous payez. Le forfait minimum est de {min}, quelle que soit la durée. À somme égale, une durée plus courte donne plus d'accès.", { min: money(info.minAmount) })}</p>

        <label className="fld" htmlFor="cp_amount"><span>{t('Votre forfait (somme en FCFA)')}</span>
          <input id="cp_amount" inputMode="numeric" autoComplete="off" value={raw} onChange={(e) => setRaw(e.target.value.replace(/[^\d ]/g, ''))} style={{ fontSize: 18 }} />
          <small>{t('De {min} à {max}, par tranches de {step} FCFA.', { min: money(per.min), max: money(per.max), step: info.step })}</small>
        </label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '6px 0 12px' }}>
          {PRESETS[period].filter((v) => v >= per.min && v <= per.max).map((v) => <button key={v} type="button" className={'btn small' + (amount === v ? ' primary' : '')} onClick={() => setRaw(String(v))}>{money(v)}</button>)}
        </div>

        <label className="fld" htmlFor="cp_period"><span>{t("Temps d'utilisation")}</span>
          <select id="cp_period" value={period} onChange={(e) => changePeriod(e.target.value)} style={{ fontSize: 16 }}>
            {info.periods.map((x) => <option key={x.id} value={x.id}>{names[x.id] + ' (' + t('{n} jours', { n: x.days }) + ')'}</option>)}
          </select>
        </label>

        {problem ? <p className="ws-err" role="alert">{problem}</p> : null}
        {blocked ? <p className="muted small">{curCustom ? t("Votre forfait sur mesure est actif : vous pouvez renouveler le même forfait à tout moment. Un autre forfait sera possible à la fin de l'abonnement.") : t("Votre offre actuelle est active : un forfait sur mesure sera possible à la fin de l'abonnement.")}</p> : null}
        <button type="button" className="btn primary" disabled={!quote || blocked} onClick={() => onPay({ custom: { amount: quote.amount, period: quote.period }, name: t('Forfait sur mesure'), priceXAF: quote.amount, days: quote.days, current: same })}>{same ? t('Renouveler ce forfait') : t('Payer ce forfait')}</button>
      </div>

      <div className="ws-card" aria-live="polite">
        <h2>{t('Accès et disponibilités')}</h2>
        {l ? (
          <>
            <p><b>{t('Pour {price} / {duration}', { price: money(quote.amount), duration: short[period] })}</b> · {t('valable {n} jours', { n: quote.days })}</p>
            {row(t('Messages IA'), quote.period === 'week' ? t('{n} sur la semaine', { n: l.aiMonth }) : t('{n} par mois', { n: l.aiMonth }))}
            {row(t('Messages IA par jour (moyenne)'), quote.aiPerDay)}
            {row(t('Personnes'), l.members)}
            {row(t('Organisations'), l.orgs)}
            {row(t('Antennes'), l.branches)}
            {row(t('E-mails par jour'), l.emailDay)}
            <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>{t('Fonctions incluses')}</h3>
            {quote.features.map((f) => (
              <div className="line" key={f.key} style={f.included ? undefined : { opacity: 0.55 }}>
                <span>{f.included ? '✓ ' : '✕ '}{tsrv(f.label)}</span>
                {f.included ? null : <small className="muted">{t('forfait plus élevé')}</small>}
              </div>
            ))}
            <small className="muted">{t("Cette somme représente {pct} % de l'offre Illimité de cette durée ({price}). À somme égale, une durée plus courte donne plus d'accès.", { pct: quote.sharePct, price: money(quote.unlimitedPrice) })}</small>
          </>
        ) : <p className="muted">{t('Renseignez un forfait valide pour voir ici les accès et les disponibilités.')}</p>}
      </div>
    </div>
  );
}
