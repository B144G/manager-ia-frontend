import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty, useLoad } from '../../ui.jsx';
import { DST, Pill } from './common.jsx';

/** Message de relance proposé par l'IA (modifiable, à copier ou envoyer par e-mail). */
export function ReminderView({ p, d, cu, composeMail }) {
  const { copy } = useWs();
  const [text, setText] = useState(p.message || '');
  return (
    <>
      <textarea rows={6} aria-label="Message de relance" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary small" type="button" onClick={() => copy(text, 'Message copié : collez-le dans WhatsApp.')}>Copier le message</button>
        {cu && cu.email ? <button className="btn small" type="button" onClick={() => composeMail(cu, { subject: 'Rappel : facture ' + d.number, body: text })}>Envoyer par e-mail</button> : null}
      </div>
      {p.note ? <p className="muted small">{'Note pour vous : ' + p.note}</p> : null}
    </>
  );
}

/** Proposition commerciale rédigée par l'IA. */
export function SalesProposalView({ p, cu, composeMail }) {
  const { copy } = useWs();
  const [subject, setSubject] = useState(p.subject || '');
  const [msg, setMsg] = useState(p.message || '');
  return (
    <>
      <label className="fld"><span>Objet</span><input type="text" value={subject} aria-label="Objet" onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="fld"><span>Message (modifiable)</span><textarea rows={10} aria-label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
      {p.note ? <p className="muted small">{'À vérifier avant l\'envoi : ' + p.note}</p> : null}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary small" type="button" onClick={() => copy(msg, 'Message copié.')}>Copier le message</button>
        {cu && cu.email ? <button className="btn small" type="button" onClick={() => composeMail(cu, { subject, body: msg })}>Envoyer par e-mail</button> : null}
      </div>
      {cu && !cu.email ? <p className="muted small">{'Pour l\'envoyer par e-mail, ajoutez l\'adresse de ' + cu.name + ' sur sa fiche.'}</p> : null}
    </>
  );
}

/** Fiche client : coordonnées, notes, historique. */
export function Sheet({ cu }) {
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/crm/customers/' + cu.id), []);
  if (st.loading) return <div><p className="ws-empty">Chargement…</p></div>;
  if (st.error) return <div>{st.error.message}</div>;
  const j = st.data;
  return (
    <div>
      <p className="muted small">{[j.customer.phone, j.customer.email].filter(Boolean).join(' · ') || 'Pas de coordonnées.'}</p>
      {j.customer.notes ? <p>{j.customer.notes}</p> : null}
      <h3>Historique</h3>
      {!j.documents.length ? <Empty text="Aucun devis ni facture." /> : null}
      {j.documents.map((d) => (
        <div className="line" key={d.id}>
          <span><b>{d.number}</b>{' '}<Pill t={d.overdue ? ['En retard', 'bad'] : DST[d.status]} /></span>
          <small>{money(d.total) + (d.kind === 'invoice' ? ' · reste ' + money(d.balance) : '')}</small>
        </div>
      ))}
    </div>
  );
}
