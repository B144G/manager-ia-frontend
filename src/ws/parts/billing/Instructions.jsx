import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Form } from '../../ui.jsx';

/** Fenêtre « Finalisez votre paiement » : attente de la confirmation (push) ou saisie de l'ID de transaction (manuel). */
export default function Instructions({ r, close, onDone, aliveRef }) {
  const { rq, toast, reloadOrg } = useWs();
  const t = useT();
  const [msg, setMsg] = useState('En attente de votre confirmation sur le téléphone…');

  useEffect(() => {
    if (r.mode !== 'push') return undefined;
    let tries = 0;
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped) return;
      if (aliveRef && !aliveRef.current) { clearInterval(timer); return; } // on a quitté l'onglet Abonnement
      tries++;
      rq('GET', '/api/payments/' + r.reference).then((s) => {
        if (stopped) return;
        if (s.status === 'paid') { stopped = true; clearInterval(timer); close(); toast(t('Paiement reçu : votre offre est active.')); onDone(); reloadOrg(); }
        else if (s.status === 'failed') { stopped = true; clearInterval(timer); setMsg('Le paiement a échoué ou a été refusé. Fermez et réessayez.'); }
      }).catch(() => {});
      if (tries > 45) { stopped = true; clearInterval(timer); setMsg("Toujours en attente. Si vous avez confirmé, l'offre s'activera toute seule : revenez sur cette page plus tard."); }
    }, 4000);
    return () => { stopped = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.mode, r.reference]);

  return (
    <>
      <p>{tsrv(r.instructions)}</p>
      {r.mode === 'push' ? (
        <p className="muted" role="status">{t(msg)}</p>
      ) : (
        <Form
          submitText={t("J'ai payé : envoyer l'ID")}
          fields={[{ k: 'transactionId', label: t('ID de transaction reçu par SMS'), required: true }]}
          onSubmit={(v) => rq('POST', '/api/payments/confirm-manual', { reference: r.reference, transactionId: v.transactionId }).then(() => { close(); toast(t('Merci : nous validons votre paiement et activons votre offre.')); onDone(); })}
        />
      )}
    </>
  );
}
