import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { n: 1, title: 'Un prospect vous écrit', text: "Sur WhatsApp, Messenger, Instagram ou depuis votre lien et votre QR code. Vous partagez un seul lien dans votre publicité.", points: ['Réponse immédiate, à toute heure', 'Messages vocaux et photos compris'], img: 'canaux', alt: 'Une seule IA pour WhatsApp, Messenger, Instagram, le site web, les e-mails et les intégrations' },
  { n: 2, title: "L'IA répond et prend la commande", text: 'Elle renseigne avec vos prix du catalogue, pose une question à la fois, enregistre le nom et le téléphone, puis récapitule la commande.', points: ['Aucun prix inventé, aucune remise', "Elle passe la main à un conseiller si besoin"], img: 'ventes-ligne', alt: "Un prospect discute avec l'assistant et passe une commande à valider" },
  { n: 3, title: 'Vous validez, la facture part', text: "La commande arrive « à valider ». Un clic pour confirmer, un autre pour la transformer en facture. L'IA rédige les relances en cas d'impayé.", points: ["Rien ne se fait sans votre accord", 'Relances en un clic, par WhatsApp ou e-mail'], img: 'clients', alt: 'Clients, factures, impayés et message de relance' },
  { n: 4, title: 'Stock et comptabilité suivent', text: "Le stock baisse, l'IA propose le réapprovisionnement, et la facture devient une écriture comptable. Vous voyez votre résultat en direct.", points: ['Alerte avant la rupture de stock', 'Résultat, bilan simplifié et TVA estimée'], img: 'comptabilite', alt: "Comptabilité : journal d'écritures et compte de résultat" },
];

/** « De la publicité à la facture » : l'aperçu de droite change quand l'étape visible change (écran large). */
export default function Story() {
  const [step, setStep] = useState(0);
  const box = useRef(null);
  useEffect(() => {
    const els = box.current ? box.current.querySelectorAll('.s-step') : [];
    if (!els.length || !('IntersectionObserver' in window)) { setStep(-1); return undefined; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setStep(Number(e.target.getAttribute('data-i'))); }), { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    els.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return (
    <section className="s-sec alt" id="histoire"><div className="s-wrap">
      <div className="s-head rv"><span className="s-eyebrow">Comment ça marche</span><h2>De la publicité à la facture, sans effort</h2><p>Un exemple concret : une boutique lance une publicité, et l'IA fait le reste. Vous gardez la main sur chaque décision.</p></div>
      <div className="s-story" ref={box}>
        <div className="s-steps">
          {STEPS.map((s, i) => (
            <article key={s.n} className={'s-step' + (step === i || step === -1 ? ' on' : '')} data-i={i}>
              <span className="n">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p>
              <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
              <div className="m"><img src={`/assets/img/${s.img}.svg`} alt={s.alt} width="640" height="420" loading="lazy" /></div>
            </article>
          ))}
        </div>
        <div className="s-view" aria-hidden="true"><div className="s-frame">
          {STEPS.map((s, i) => <img key={s.n} className={step === i ? 'on' : undefined} src={`/assets/img/${s.img}.svg`} alt="" width="640" height="420" loading="lazy" />)}
        </div></div>
      </div>
    </div></section>
  );
}
