import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui/index.jsx';

/** Bandeau très visible : le paiement automatique tourne en démonstration (aucun argent réel). */
export function TestBanner() {
  const t = useT();
  return (
    <p role="status" style={{ background: '#b91c1c', color: '#fff', padding: '10px 14px', borderRadius: 8, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>
      {t('MODE TEST : aucun argent réel')}
      <small style={{ display: 'block', fontWeight: 400 }}>{t("Les paiements Mobile Money sont en démonstration : votre offre s'active, mais rien n'est débité.")}</small>
    </p>
  );
}

/** Écran d'attente d'un paiement automatique (MTN / Orange) : suivi toutes les 3 secondes, succès, échec, expiration, nouvelle tentative. */
export default function CampayWait({ r, close, onDone, onRetry, aliveRef }) {
  const { rq, toast, reloadOrg, money } = useWs();
  const t = useT();
  const [s, setS] = useState({ status: 'pending', review: false });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let stopped = false;
    const poll = () => {
      if (stopped) return;
      if (aliveRef && !aliveRef.current) { stopped = true; return; } // on a quitté l'onglet Abonnement
      rq('GET', '/api/payments/' + encodeURIComponent(r.reference)).then((x) => {
        if (stopped) return;
        setS(x);
        if (x.status === 'paid') { stopped = true; toast(t('Paiement reçu : votre offre est active.')); onDone(); reloadOrg(); }
        else if (x.status !== 'pending') stopped = true;
      }).catch(() => {});
    };
    const timer = setInterval(poll, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    poll();
    return () => { stopped = true; clearInterval(timer); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.reference]);

  const left = Math.max(0, Math.round(((s.expiresAt || r.expiresAt ? Date.parse(s.expiresAt || r.expiresAt) : now) - now) / 1000));
  const mmss = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
  const test = s.testMode !== undefined ? s.testMode : r.testMode;

  return (
    <div aria-live="polite">
      {test ? <TestBanner /> : null}
      {s.status === 'pending' && !s.review ? (
        <>
          <h3>{t('Confirmez le paiement sur votre téléphone')}</h3>
          <p>{t('Une demande de {amount} a été envoyée à votre téléphone. Saisissez votre code secret Mobile Money pour confirmer.', { amount: money(r.amountXAF) })}</p>
          {r.ussdCode ? <p className="muted">{t("Si rien n'apparaît, composez {code} puis suivez les instructions.", { code: r.ussdCode })}</p> : null}
          <p role="status"><b>{t('En attente de votre confirmation…')}</b> <span className="muted">{t('Temps restant : {time}', { time: mmss })}</span></p>
          <p className="muted small">{t("Cette fenêtre se met à jour toute seule. Vous pouvez la fermer : votre offre s'activera dès la confirmation. Référence : {ref}", { ref: r.reference })}</p>
        </>
      ) : null}
      {s.status === 'pending' && s.review ? <p className="pill mid">{t("Votre paiement est bien reçu. L'activation de votre offre demande une vérification : nous revenons vers vous très vite. Référence : {ref}", { ref: r.reference })}</p> : null}
      {s.status === 'paid' ? (
        <>
          <p className="pill good">{t('Paiement reçu : votre offre est active.')}</p>
          <p><a className="link" href={'/recu/' + encodeURIComponent(r.reference)} target="_blank" rel="noopener noreferrer">{t('Reçu à imprimer')}</a></p>
        </>
      ) : null}
      {s.status === 'failed' ? <p className="pill bad" role="alert">{t("Le paiement n'a pas abouti (refusé ou annulé sur le téléphone). Aucune somme n'est due.")}</p> : null}
      {s.status === 'expired' ? <p className="pill bad" role="alert">{t("La demande a expiré sans confirmation sur le téléphone. Aucune somme n'est due.")}</p> : null}
      <div className="row">
        {s.status === 'failed' || s.status === 'expired' ? <Button variant="primary" type="button" onClick={() => { close(); onRetry(); }}>{t('Nouvelle tentative')}</Button> : null}
        <Button variant="ghost" type="button" onClick={close}>{s.status === 'pending' && !s.review ? t('Fermer') : t('Terminer')}</Button>
      </div>
    </div>
  );
}
