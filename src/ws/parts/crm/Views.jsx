import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, useLoad } from '../../ui.jsx';
import { DST, Pill } from './common.jsx';

/** Message de relance proposé par l'IA (modifiable, à copier ou envoyer par e-mail). */
export function ReminderView({ p, d, cu, composeMail }) {
  const t = useT();
  const { copy } = useWs();
  const [text, setText] = useState(p.message || '');
  return (
    <>
      <textarea rows={6} aria-label={t("Message de relance")} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary small" type="button" onClick={() => copy(text, t('Message copié : collez-le dans WhatsApp.'))}>{t('Copier le message')}</button>
        {cu && cu.email ? <button className="btn small" type="button" onClick={() => composeMail(cu, { subject: t('Rappel : facture {number}', { number: d.number }), body: text })}>{t('Envoyer par e-mail')}</button> : null}
      </div>
      {p.note ? <p className="muted small">{t('Note pour vous : {note}', { note: p.note })}</p> : null}
    </>
  );
}

/** Proposition commerciale rédigée par l'IA. */
export function SalesProposalView({ p, cu, composeMail }) {
  const t = useT();
  const { copy } = useWs();
  const [subject, setSubject] = useState(p.subject || '');
  const [msg, setMsg] = useState(p.message || '');
  return (
    <>
      <label className="fld"><span>{t('Objet')}</span><input type="text" value={subject} aria-label={t('Objet')} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="fld"><span>{t('Message (modifiable)')}</span><textarea rows={10} aria-label={t("Message")} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
      {p.note ? <p className="muted small">{t("À vérifier avant l'envoi : {note}", { note: p.note })}</p> : null}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary small" type="button" onClick={() => copy(msg, t('Message copié.'))}>{t('Copier le message')}</button>
        {cu && cu.email ? <button className="btn small" type="button" onClick={() => composeMail(cu, { subject, body: msg })}>{t('Envoyer par e-mail')}</button> : null}
      </div>
      {cu && !cu.email ? <p className="muted small">{t("Pour l'envoyer par e-mail, ajoutez l'adresse de {name} sur sa fiche.", { name: cu.name })}</p> : null}
    </>
  );
}

/** Fiche client : coordonnées, notes, historique. */
export function Sheet({ cu }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/crm/customers/' + cu.id), []);
  if (st.loading) return <div><p className="ws-empty">{t('Chargement…')}</p></div>;
  if (st.error) return <div>{t(st.error.message)}</div>;
  const j = st.data;
  return (
    <div>
      <p className="muted small">{[j.customer.phone, j.customer.email].filter(Boolean).join(' · ') || t('Pas de coordonnées.')}</p>
      {j.customer.notes ? <p>{j.customer.notes}</p> : null}
      <h3>{t('Historique')}</h3>
      {!j.documents.length ? <Empty text={t("Aucun devis ni facture.")} /> : null}
      {j.documents.map((d) => (
        <div className="line" key={d.id}>
          <span><b>{d.number}</b>{' '}<Pill t={d.overdue ? ['En retard', 'bad'] : DST[d.status]} /></span>
          <small>{money(d.total) + (d.kind === 'invoice' ? ' · ' + t('reste {amount}', { amount: money(d.balance) }) : '')}</small>
        </div>
      ))}
    </div>
  );
}
