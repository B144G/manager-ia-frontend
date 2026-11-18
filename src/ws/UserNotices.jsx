import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rq } from '../lib/api.js';
import { dateFr } from '../lib/format.js';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/* Messages de l'administration adressés à la personne (paiement validé ou refusé, compte réactivé…) : bandeau en haut de l'espace,
   lu / non lu. Le texte est reconstruit ici à partir du type et des valeurs reçues pour être traduit ; un type inconnu affiche le texte du serveur. */
function noticeText(t, n) {
  const d = n.data || {};
  switch (n.kind) {
    case 'payment_paid': return { title: t('Paiement validé'), text: t("Votre paiement {ref} est validé : votre offre {plan} est active jusqu'au {date}.", { ref: d.reference, plan: tsrv(d.plan || ''), date: dateFr(d.until) }), good: true, link: true };
    case 'payment_rejected': return { title: t('Paiement refusé'), text: t("Votre paiement {ref} n'a pas pu être validé. Motif : {reason}", { ref: d.reference, reason: d.reason }), link: true };
    case 'payment_failed': return { title: t('Paiement non abouti'), text: t("Votre paiement {ref} n'a pas abouti (refusé ou annulé sur le téléphone). Aucune somme n'est due : vous pouvez réessayer depuis « Abonnement ».", { ref: d.reference }), link: true };
    case 'payment_expired': return { title: t('Paiement non abouti'), text: t("Votre demande de paiement {ref} a expiré sans confirmation sur le téléphone. Aucune somme n'est due : vous pouvez réessayer depuis « Abonnement ».", { ref: d.reference }), link: true };
    case 'account_suspended': return { title: t('Compte suspendu'), text: t('Votre compte est suspendu. Motif : {reason}. Contactez le support pour le réactiver.', { reason: d.reason }) };
    case 'account_reactivated': return { title: t('Compte réactivé'), text: t('Votre compte est de nouveau actif.'), good: true };
    default: return { title: tsrv(n.title), text: tsrv(n.text) };
  }
}

/** Bandeau des notices non lues. `orgId` : pour proposer le lien vers « Abonnement ». */
export default function UserNotices({ orgId }) {
  const t = useT();
  const [list, setList] = useState([]);
  const load = useCallback(() => rq('GET', '/api/me/notices?limit=10').then((j) => setList(j.notices.filter((n) => !n.read)), () => {}), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 90000);
    const vis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [load]);
  const read = (ids) => { setList((l) => (ids ? l.filter((n) => !ids.includes(n.id)) : [])); rq('POST', '/api/me/notices/read', ids ? { ids } : {}).catch(() => {}); };
  if (!list.length) return null;
  return (
    <div className="un-bar" role="region" aria-label={t('Messages importants')} aria-live="polite">
      {list.map((n) => {
        const v = noticeText(t, n);
        return (
          <div key={n.id} className={'un-item' + (v.good ? ' good' : '')}>
            <div className="un-t"><b>{v.title}</b><span>{v.text}</span></div>
            <div className="un-a">
              {v.link && orgId ? <Link className="btn" to={`/app/${orgId}/billing`} onClick={() => read([n.id])}>{t('Voir mon abonnement')}</Link> : null}
              <button className="btn" type="button" onClick={() => read([n.id])}>{t("C'est noté")}</button>
            </div>
          </div>
        );
      })}
      {list.length > 1 ? <button className="link un-all" type="button" onClick={() => read(null)}>{t('Tout marquer comme lu')}</button> : null}
    </div>
  );
}
