import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rq } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';

// Prix de repli (identiques aux prix par défaut du serveur) ; les vrais prix sont relus depuis /api/plans.
const DEFAULT_PRICES = { week: 40000, month: 150000, quarter: 420000, semester: 800000, year: 1500000 };
const fcfa = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';

export default function Plans() {
  const t = useT();
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [min, setMin] = useState(10000);
  useEffect(() => {
    rq('GET', '/api/plans').then((j) => {
      const p = {}; for (const x of j.plans || []) if (x.period) p[x.period] = x.priceXAF;
      if (Object.keys(p).length === 5) setPrices(p);
      if (j.custom && j.custom.minAmount) setMin(j.custom.minAmount);
    }, () => {});
  }, []);
  const rows = [['week', t('Une semaine')], ['month', t('Un mois')], ['quarter', t('Un trimestre')], ['semester', t('Un semestre')], ['year', t('Un an')]];
  return (
    <>
      <section className="s-sec alt" id="offres"><div className="s-wrap">
        <div className="s-head rv"><span className="s-eyebrow">{t('Tarifs')}</span><h2>{t('Commencez gratuitement, évoluez quand vous êtes prêt')}</h2><p>{t('Paiement par MTN Mobile Money ou Orange Money.')}</p></div>
        <div className="s-plans">
          <div className="s-plan rv"><h3>{t('Gratuit')}</h3><p className="pr">0 FCFA</p><p className="sub">{t('Pour découvrir la plateforme et faire un premier essai.')}</p><ul><li>{t('1 organisation')}</li><li>{t('3 personnes')}</li><li>{t('40 messages IA par mois')}</li></ul><Link to="/inscription" className="s-btn">{t('Commencer')}</Link></div>
          <div className="s-plan hot rv" style={{ '--d': '.06s' }}><span className="flag">{t('Tout inclus')}</span><h3>{t('Illimité')}</h3><p className="sub">{t('Organisations, personnes et antennes sans limite pratique, toutes les fonctions. Plus la durée est longue, plus le prix par mois baisse.')}</p><ul>{rows.map(([k, label]) => <li key={k}>{label + ' : '}<b>{fcfa(prices[k])}</b></li>)}</ul><Link to="/inscription" className="s-btn pri">{t('Choisir Illimité')}</Link></div>
          <div className="s-plan rv" style={{ '--d': '.12s' }}><h3>{t('Sur mesure')}</h3><p className="pr">{t('dès {price}', { price: fcfa(min) })}</p><p className="sub">{t("Vous choisissez la somme et le temps d'utilisation : les accès s'adaptent à ce que vous payez.")}</p><ul><li>{t('Une semaine, un mois, un trimestre, un semestre ou un an')}</li><li>{t('Pour la même somme, une durée plus courte donne plus d\'accès')}</li><li>{t('Aperçu des accès avant de payer')}</li></ul><Link to="/inscription" className="s-btn">{t('Créer mon espace gratuit')}</Link></div>
        </div>
        <p className="s-note rv">{t("Les messages IA sont partagés par toute l'organisation et se renouvellent avec votre abonnement.")}</p>
      </div></section>
    </>
  );
}
