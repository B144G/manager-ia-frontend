import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { fcfa, usePlans } from './plans.js';

const MONTHS = { month: 1, quarter: 3, semester: 6, year: 12 };

/** Trois offres (Illimité recommandée), bascule de durée, tableau comparatif honnête. Les montants viennent du serveur (/api/plans) ;
    « par mois » et l'économie sont calculés à partir de ces mêmes montants. */
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
    <section className="vt-sec" id="tarifs" aria-labelledby="vt-price">
      <div className="vt-wrap">
        <div className="vt-head vt-head--center vt-rv"><span className="vt-eyebrow">{t('Tarifs')}</span><h2 className="vt-h2" id="vt-price">{t('Commencez gratuitement, évoluez quand vous êtes prêt')}</h2><p className="vt-lead">{t('Paiement par MTN Mobile Money ou Orange Money. Pas de carte bancaire pour essayer.')}</p></div>
        <div style={{ textAlign: 'center' }}>
          <div className="vt-seg" role="radiogroup" aria-label={t('Durée')} onKeyDown={onKey}>
            {rows.map(([k, l]) => <button key={k} data-k={k} type="button" role="radio" aria-checked={per === k} tabIndex={per === k ? 0 : -1} onClick={() => setPer(k)}>{l}</button>)}
          </div>
        </div>
        <div className="vt-plans">
          <div className="vt-plan vt-rv">
            <h3 className="vt-h3">{t('Gratuit')}</h3>
            <div className="vt-price"><b>0 FCFA</b></div>
            <p>{t('Pour découvrir la plateforme et faire un premier essai.')}</p>
            <ul><li><Fa name="check" />{t('1 organisation')}</li><li><Fa name="check" />{t('3 personnes')}</li><li><Fa name="check" />{t('40 messages IA par mois')}</li></ul>
            <Link to="/inscription" className="vt-btn vt-btn--secondary">{t('Commencer gratuitement')}</Link>
          </div>
          <div className="vt-plan vt-plan--hot vt-rv">
            <span className="vt-flag">{t('Recommandé')}</span>
            <h3 className="vt-h3">{t('Illimité')}</h3>
            <div className="vt-price" aria-live="polite"><b>{fcfa(prices[per])}</b>{saving(per) > 0 ? <span className="vt-saving">{t('−{n} % par rapport au mois', { n: saving(per) })}</span> : null}</div>
            {perMonth(per) && per !== 'month' ? <p>{t('Soit {price} par mois', { price: fcfa(perMonth(per)) })}</p> : null}
            <ul>
              <li><Fa name="check" />{t('Toutes les fonctions et tous les modules')}</li>
              <li><Fa name="check" />{t('Organisations, personnes et antennes sans limite pratique')}</li>
              <li><Fa name="check" />{t("Messages IA partagés par toute l'organisation, renouvelés avec l'abonnement")}</li>
            </ul>
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
            <caption>{t('Gratuit ou Illimité : ce qui change')}</caption>
            <thead><tr><th scope="col"><span className="sr-only">{t('Critère')}</span></th><th scope="col">{t('Gratuit')}</th><th scope="col" className="hot">{t('Illimité')}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{t('Prix')}</th><td>0 FCFA</td><td className="hot">{fcfa(prices[per])}</td></tr>
              <tr><th scope="row">{t('Organisations')}</th><td>1</td><td className="hot">{t('Sans limite pratique')}</td></tr>
              <tr><th scope="row">{t('Personnes')}</th><td>3</td><td className="hot">{t('Sans limite pratique')}</td></tr>
              <tr><th scope="row">{t('Messages IA')}</th><td>{t('40 par mois')}</td><td className="hot">{t("Renouvelés avec l'abonnement")}</td></tr>
              <tr><th scope="row">{t('Fonctions')}</th><td>{t('Découverte de la plateforme')}</td><td className="hot">{t('Toutes')}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="vt-note">{t("Les messages IA sont partagés par toute l'organisation et se renouvellent avec votre abonnement.")}</p>
      </div>
    </section>
  );
}
