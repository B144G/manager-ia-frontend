import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { fcfa, usePlans } from './plans.js';

const MONTHS = { month: 1, quarter: 3, semester: 6, year: 12 };

/** Trois offres + tableau des durées. Les montants viennent du serveur (/api/plans) ; les « équivalents par mois » et les réductions sont calculés à partir de ces mêmes montants. */
export default function Pricing() {
  const t = useT();
  const { prices, min } = usePlans();
  const [per, setPer] = useState('month');
  const rows = [['week', t('Une semaine')], ['month', t('Un mois')], ['quarter', t('Un trimestre')], ['semester', t('Un semestre')], ['year', t('Un an')]];
  const perMonth = (k) => (MONTHS[k] ? prices[k] / MONTHS[k] : null);
  const saving = (k) => (MONTHS[k] && k !== 'month' ? Math.round((1 - perMonth(k) / prices.month) * 100) : 0);
  const onKey = (e) => {
    const keys = rows.map(([k]) => k); const idx = keys.indexOf(per);
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return; e.preventDefault(); const nk = keys[(idx + d + keys.length) % keys.length]; setPer(nk);
    const b = e.currentTarget.querySelector(`[data-k="${nk}"]`); if (b) b.focus();
  };
  return (
    <section className="vt-sec vt-sec--soft" id="tarifs" aria-labelledby="vt-price">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Tarifs')}</span><h2 className="vt-h2" id="vt-price">{t('Commencez gratuitement, évoluez quand vous êtes prêt')}</h2><p>{t('Paiement par MTN Mobile Money ou Orange Money. Pas de carte bancaire pour essayer.')}</p></div>
        <div className="vt-plans">
          <div className="vt-plan vt-rv">
            <h3 className="vt-h3">{t('Gratuit')}</h3>
            <div className="vt-price"><b>0 FCFA</b></div>
            <p>{t('Pour découvrir la plateforme et faire un premier essai.')}</p>
            <ul><li><Fa name="check" />{t('1 organisation')}</li><li><Fa name="check" />{t('3 personnes')}</li><li><Fa name="check" />{t('40 messages IA par mois')}</li></ul>
            <Link to="/inscription" className="vt-btn vt-btn--secondary">{t('Commencer gratuitement')}</Link>
          </div>
          <div className="vt-plan vt-plan--hot vt-rv">
            <span className="vt-flag">{t('Tout inclus')}</span>
            <h3 className="vt-h3">{t('Illimité')}</h3>
            <div className="vt-seg" role="radiogroup" aria-label={t('Durée')} onKeyDown={onKey}>
              {rows.map(([k, l]) => <button key={k} data-k={k} type="button" role="radio" aria-checked={per === k} tabIndex={per === k ? 0 : -1} onClick={() => setPer(k)}>{l}</button>)}
            </div>
            <div className="vt-price" aria-live="polite"><b>{fcfa(prices[per])}</b>{saving(per) > 0 ? <span className="vt-saving">{t('−{n} % par rapport au mois', { n: saving(per) })}</span> : null}</div>
            {perMonth(per) && per !== 'month' ? <p>{t('Soit {price} par mois', { price: fcfa(perMonth(per)) })}</p> : null}
            <p>{t('Organisations, personnes et antennes sans limite pratique, toutes les fonctions.')}</p>
            <Link to="/inscription" className="vt-btn vt-btn--primary">{t('Choisir Illimité')}</Link>
          </div>
          <div className="vt-plan vt-rv">
            <h3 className="vt-h3">{t('Sur mesure')}</h3>
            <div className="vt-price"><span>{t('dès')}</span><b>{fcfa(min)}</b></div>
            <p>{t("Vous choisissez la somme et le temps d'utilisation : les accès s'adaptent à ce que vous payez.")}</p>
            <ul><li><Fa name="check" />{t("Une semaine, un mois, un trimestre, un semestre ou un an")}</li><li><Fa name="check" />{t('Aperçu des accès avant de payer')}</li></ul>
            <Link to="/inscription" className="vt-btn vt-btn--secondary">{t('Créer mon espace gratuit')}</Link>
          </div>
        </div>
        <div className="vt-tablewrap vt-rv">
          <table className="vt-table">
            <caption>{t("Offre Illimité : prix selon la durée")}</caption>
            <thead><tr><th scope="col">{t('Durée')}</th><th scope="col">{t('Prix')}</th><th scope="col">{t('Par mois')}</th></tr></thead>
            <tbody>{rows.map(([k, l]) => <tr key={k}><th scope="row">{l}</th><td>{fcfa(prices[k])}</td><td>{perMonth(k) ? fcfa(perMonth(k)) : '—'}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="vt-note">{t("Les messages IA sont partagés par toute l'organisation et se renouvellent avec votre abonnement.")}</p>
      </div>
    </section>
  );
}
