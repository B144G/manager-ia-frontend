import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Form } from '../../ui.jsx';
import { TestBanner } from './CampayWait.jsx';

/** Numéro Mobile Money camerounais : 9 chiffres commençant par 6 (indicatif +237 accepté). Le serveur refait la même vérification. */
const phoneOk = (v) => /^6\d{8}$/.test(String(v || '').replace(/[\s.\-()]/g, '').replace(/^(\+|00)?237/, ''));

/** Choix du mode de paiement (automatique Campay, ou Mobile Money direct confirmé par l'administrateur) puis opérateur et numéro. Le prix n'est jamais envoyé : le serveur le calcule. */
export default function PayForm({ p, b, close, onStarted }) {
  const { rq } = useWs();
  const t = useT();
  const both = b.automatic && b.manualAvailable;
  const [method, setMethod] = useState(b.automatic ? 'campay' : 'manual');
  const auto = method === 'campay';
  return (
    <>
      {b.automatic && b.testMode ? <TestBanner /> : null}
      <p>{t('{price} pour {days} jours.', { price: p.priceText, days: p.days })}</p>
      {both ? (
        <div className="ws-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={auto} className={'tab' + (auto ? ' on' : '')} onClick={() => setMethod('campay')}>{t('Paiement automatique')}</button>
          <button type="button" role="tab" aria-selected={!auto} className={'tab' + (!auto ? ' on' : '')} onClick={() => setMethod('manual')}>{t('Mobile Money direct (confirmé par nous)')}</button>
        </div>
      ) : null}
      {!auto ? <p className="muted small">{t("Vous payez vous-même depuis votre téléphone, puis vous nous envoyez l'identifiant de la transaction : nous vérifions et activons votre offre.")}</p> : null}
      <Form
        key={method}
        submitText={auto ? t('Payer') : t('Continuer')}
        fields={[
          { k: 'operator', label: t('Opérateur'), type: 'select', options: [['mtn', 'MTN Mobile Money'], ['orange', 'Orange Money']] },
          { k: 'phone', label: auto ? t('Numéro qui paie (ex. 6XXXXXXXX)') : t('Numéro qui paie (facultatif)'), required: auto, hint: auto ? t('Numéro Mobile Money camerounais : 9 chiffres commençant par 6 (MTN ou Orange).') : undefined, type: 'tel' },
        ]}
        onSubmit={(v) => {
          if (auto && !phoneOk(v.phone)) return Promise.reject(new Error(t('Numéro invalide. Exemple : 6XXXXXXXX (9 chiffres, MTN ou Orange).')));
          if (!auto && v.phone && !/^\+?[\d\s.]{8,18}$/.test(v.phone)) return Promise.reject(new Error(t('Numéro de téléphone invalide.')));
          return rq('POST', '/api/payments/initiate', Object.assign({ operator: v.operator, phone: v.phone, method }, p.custom ? { custom: p.custom } : { plan: p.id })).then((r) => { close(); onStarted(r); });
        }}
      />
    </>
  );
}
