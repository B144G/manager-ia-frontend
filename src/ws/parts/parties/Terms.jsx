import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { LABEL, PT, TYPES, TypeBadge } from './common.jsx';

/* Conditions par type : remise, délais, plafond propres à chaque type (reprises par les fiches qui n'ont pas leurs propres conditions). */
export default function Terms() {
  const t = useT();
  const { oapi, modal, toast, money } = useWs();
  const [kind, setKind] = useState('customers');
  const st = useLoad(() => oapi('GET', PT + '/types'), []);
  const edit = (type, cur) => modal(t(LABEL[kind][type]), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'discountPct', label: t('Remise (%)'), value: cur.discountPct ?? '' }, { k: 'paymentDays', label: t('Délai de paiement (jours)'), value: cur.paymentDays ?? '' },
      { k: 'deliveryDays', label: t('Délai de livraison (jours)'), value: cur.deliveryDays ?? '' }, { k: 'creditLimit', label: t('Plafond de crédit'), value: cur.creditLimit ?? '' }, { k: 'note', label: t('Note'), value: cur.note || '' },
    ]} onSubmit={(v) => oapi('PUT', PT + '/terms/' + kind + '/' + type, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' && k !== 'note' ? null : x]))).then(() => { close(); toast(t('Conditions enregistrées.')); st.reload(); })} />
  ));
  return (
    <Loaded state={st}>{(j) => (
      <div>
        <div className="pty-chips" role="group" aria-label={t('Clients ou fournisseurs')}>
          <button type="button" className="pty-chip" aria-pressed={kind === 'customers'} onClick={() => setKind('customers')}>{t('Clients')}</button>
          <button type="button" className="pty-chip" aria-pressed={kind === 'suppliers'} onClick={() => setKind('suppliers')}>{t('Fournisseurs')}</button>
        </div>
        <div className="pty-grid">
          {TYPES.map((x) => { const c = j.terms[kind][x]; return (
            <div className="pty-term" key={x}>
              <TypeBadge type={x} kind={kind} />
              <small>{t('Remise')} : {c.discountPct === null ? '—' : c.discountPct + ' %'}</small>
              <small>{t('Paiement')} : {c.paymentDays === null ? '—' : t('{n} jours', { n: c.paymentDays })}</small>
              <small>{t('Livraison')} : {c.deliveryDays === null ? '—' : t('{n} jours', { n: c.deliveryDays })}</small>
              <small>{t('Plafond')} : {c.creditLimit === null ? '—' : money(c.creditLimit)}</small>
              {c.note ? <small>{c.note}</small> : null}
              <button type="button" className="ui-btn sm" onClick={() => edit(x, c)}>{t('Modifier')}</button>
            </div>
          ); })}
        </div>
        <p className="muted small">{t("Aucune condition n'est inventée : tant que vous ne les réglez pas, elles restent vides.")}</p>
      </div>
    )}</Loaded>
  );
}
