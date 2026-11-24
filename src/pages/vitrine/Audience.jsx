import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import Ic from './Ic.jsx';
import { shot } from './shared.js';

/** « Pour qui ? » : onglets par métier (tablist accessible : flèches, Début, Fin). Chaque bénéfice correspond à un module qui existe. */
export default function Audience() {
  const t = useT();
  const [k, setK] = useState(0);
  const list = useRef(null);
  const jobs = [
    { icon: 'store', fa: false, tab: t('Commerce'), title: t('Vendre plus, sans courir après les clients'), img: 'crm', alt: t("Écran « Clients et ventes » de MABAH (données d'exemple)"),
      pts: [t("Réponses WhatsApp à toute heure, avec vos vrais prix"), t('Devis, factures et relances des impayés'), t('Stock à jour et alertes de rupture')] },
    { icon: 'industry', fa: true, tab: t('Atelier et fabrication'), title: t('Savoir ce que coûte vraiment ce que vous fabriquez'), img: 'production', alt: t("Écran « Production » de MABAH (données d'exemple)"),
      pts: [t('Nomenclatures et coût de revient'), t('Ordres de fabrication suivis'), t('Matières premières reliées au stock et aux achats')] },
    { icon: 'school', fa: false, tab: t('École et formation'), title: t("Moins d'administratif, plus de temps pour enseigner"), img: 'hr', alt: t("Écran « Ressources humaines » de MABAH (données d'exemple)"),
      pts: [t('Frais et impayés suivis, avec des relances déjà rédigées'), t('Personnel, congés et planning de la semaine'), t('Budget et paie du personnel au même endroit')] },
    { icon: 'food', fa: false, tab: t('Restaurant'), title: t('Ne plus tomber en rupture au mauvais moment'), img: 'stock', alt: t("Écran « Stock et entrepôt » de MABAH (données d'exemple)"),
      pts: [t('Stock et alertes de rupture'), t('Fournisseurs comparés et bons de commande'), t("Planning de l'équipe et paie")] },
    { icon: 'truck', fa: true, tab: t('Transport et logistique'), title: t('Des livraisons suivies, des clients prévenus'), img: 'logistics', alt: t("Écran « Logistique et transport » de MABAH (données d'exemple)"),
      pts: [t('Livraisons, retards et tournées'), t('Lien de suivi pour le client'), t('Zones, transporteurs et coûts de transport')] },
    { icon: 'helmet', fa: true, tab: t('BTP'), title: t('Des chantiers qui respectent le budget'), img: 'construction', alt: t("Écran « Chantiers (BTP) » de MABAH (données d'exemple)"),
      pts: [t('Phases, budget et pointages'), t('Rapports et situations de travaux'), t('Achats de matériaux et maintenance du matériel')] },
  ];
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
    if (!d) return; e.preventDefault();
    const n = Math.abs(d) === 99 ? (d < 0 ? 0 : jobs.length - 1) : (k + d + jobs.length) % jobs.length;
    setK(n); const b = list.current.querySelector(`#vt-tab${n}`); if (b) b.focus();
  };
  return (
    <section className="vt-sec" id="metiers" aria-labelledby="vt-who">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Pour qui ?')}</span><h2 className="vt-h2" id="vt-who">{t('Pensé pour les métiers que vous exercez')}</h2></div>
        <div className="vt-tabs" role="tablist" aria-label={t('Choisissez votre métier')} ref={list} onKeyDown={onKey}>
          {jobs.map((j, i) => (
            <button key={j.tab} type="button" role="tab" id={'vt-tab' + i} aria-selected={k === i} aria-controls={'vt-pan' + i} tabIndex={k === i ? 0 : -1} className="vt-tab" onClick={() => setK(i)}>
              {j.fa ? <Fa name={j.icon} /> : <Ic name={j.icon} />}{j.tab}
            </button>
          ))}
        </div>
        {jobs.map((j, i) => (
          <div key={j.tab} role="tabpanel" id={'vt-pan' + i} aria-labelledby={'vt-tab' + i} hidden={k !== i} className="vt-panel2">
            <div className="txt">
              <h3 className="vt-h2" style={{ fontSize: 'clamp(1.75rem,3.2vw,2.5rem)' }}>{j.title}</h3>
              <ul className="vt-benefits">{j.pts.map((p) => <li key={p}><span><Fa name="check" /></span>{p}</li>)}</ul>
              <Link to="/inscription" className="vt-btn vt-btn--primary">{t('Essai gratuit')}<Fa name="arrow-right" /></Link>
            </div>
            <div className="vt-shot"><img src={shot(j.img, 720)} srcSet={`${shot(j.img, 480)} 480w, ${shot(j.img, 720)} 720w, ${shot(j.img, 1280)} 1280w`} sizes="(min-width:980px) 640px, 92vw" width="1280" height="800" loading="lazy" decoding="async" alt={j.alt} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
