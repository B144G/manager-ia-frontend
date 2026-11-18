import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Form } from '../../ui.jsx';
import CampayWait from './CampayWait.jsx';

/** Fenêtre « Finalisez votre paiement » : attente de la confirmation sur le téléphone (paiement automatique Campay) ou saisie de l'ID de transaction (manuel). */
export default function Instructions({ r, close, onDone, onRetry, aliveRef }) {
  const { rq, toast, money } = useWs();
  const t = useT();
  if (r.mode === 'push') return <CampayWait r={r} close={close} onDone={onDone} onRetry={onRetry} aliveRef={aliveRef} />;
  const pt = r.payTo || {};
  const row = (label, value, strong) => (value ? <div className="line"><span>{label}</span><span>{strong ? <b>{value}</b> : value}</span></div> : null);
  return (
    <>
      <p>{t('Payez depuis votre téléphone, puis envoyez-nous l\'identifiant de la transaction reçu par SMS.')}</p>
      <div className="ws-card">
        {row(t('Montant exact'), money(r.amountXAF), true)}
        {row(t('Code de référence (à écrire dans le motif)'), r.reference, true)}
        {row('MTN Mobile Money', pt.mtn, pt.operator === 'mtn')}
        {row('Orange Money', pt.orange, pt.operator === 'orange')}
        {row(t('Au nom de'), pt.holder)}
      </div>
      <Form
        submitText={t("J'ai payé")}
        fields={[
          { k: 'payerName', label: t('Nom de la personne qui a payé'), required: true },
          { k: 'transactionId', label: t('ID de transaction reçu par SMS'), required: true },
        ]}
        onSubmit={(v) => rq('POST', '/api/payments/confirm-manual', { reference: r.reference, transactionId: v.transactionId, payerName: v.payerName }).then(() => { close(); toast(t("Merci : votre paiement est à vérifier. Nous activons votre offre dès la confirmation.")); onDone(); })}
      />
      <p className="muted small">{t('La commande est valable {n} heures. Sans identifiant envoyé, elle expire.', { n: r.expiresAt })}</p>
    </>
  );
}
