import { useEffect, useRef, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Service client (boîte de demandes + réponses, brouillon IA, formulaire public). */

const STAT = { open: 'À traiter', pending: 'En attente', resolved: 'Résolue' };
const PRIO = { low: 'Basse', normal: 'Normale', high: 'Urgente' };
const TABS = [['open', 'À traiter'], ['pending', 'En attente'], ['resolved', 'Résolues'], ['all', 'Toutes']];

export default function Support() {
  const { oapi, can, modal, copy, info, dateFr } = useWs();
  const [filter, setFilter] = useState('open');
  const [sel, setSel] = useState(null);
  const [ver, setVer] = useState(0);
  const [members, setMembers] = useState([]);
  const reload = () => setVer((n) => n + 1);
  const st = useLoad(() => oapi('GET', '/support' + (filter === 'all' ? '' : '?status=' + filter)), [filter, ver]);

  useEffect(() => {
    let off = false;
    oapi('GET', '/members').then((j) => { if (!off) setMembers(j.members); }, () => {});
    return () => { off = true; };
  }, [oapi]);

  const showForm = () => {
    // Le formulaire public est la page /form de ce site.
    const url = window.location.origin + '/form?o=' + info.intakeToken;
    modal('Formulaire pour vos clients', () => (
      <>
        <p>Partagez ce lien (WhatsApp, Facebook, votre site…). Chaque message envoyé devient une demande ici.</p>
        <input value={url} readOnly onFocus={(e) => e.target.select()} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary small" type="button" onClick={() => copy(url, 'Lien copié.')}>Copier le lien</button>
          <a className="btn small" href={url} target="_blank" rel="noopener noreferrer">Voir le formulaire</a>
        </div>
      </>
    ));
  };

  const newTicket = () => {
    modal('Nouvelle demande', (close) => (
      <Form
        fields={[
          { k: 'customerName', label: 'Nom du client', required: true },
          { k: 'customerContact', label: 'Contact du client' },
          { k: 'channel', label: 'Canal', type: 'select', options: [['manuel', 'Saisie manuelle'], ['whatsapp', 'WhatsApp'], ['messenger', 'Messenger'], ['instagram', 'Instagram'], ['email', 'E-mail'], ['telephone', 'Téléphone']] },
          { k: 'subject', label: 'Sujet', required: true },
          { k: 'message', label: 'Message du client', type: 'textarea' },
          { k: 'priority', label: 'Priorité', type: 'select', options: [['normal', 'Normale'], ['high', 'Urgente'], ['low', 'Basse']] },
        ]}
        submitText="Enregistrer"
        onSubmit={(v) => oapi('POST', '/support', v).then((j) => { close(); setFilter('open'); setSel(j.id); reload(); })}
      />
    ));
  };

  const j = st.data;
  return (
    <>
      <div className="ws-head">
        <div><h1>Service client</h1><p className="muted">Toutes les demandes de vos clients au même endroit.</p></div>
        <div className="row">
          {can('admin') ? <button className="btn small" type="button" onClick={showForm}>Formulaire client</button> : null}
          <button className="btn primary small" type="button" onClick={newTicket}>Nouvelle demande</button>
        </div>
      </div>
      <div className="ws-tabs">
        {j ? TABS.map((t) => {
          const n = t[0] === 'all' ? '' : ' (' + (j.counts[t[0]] || 0) + ')';
          return <button type="button" key={t[0]} className={'tab' + (filter === t[0] ? ' on' : '')} onClick={() => { setFilter(t[0]); setSel(null); }}>{t[1] + n}</button>;
        }) : null}
      </div>
      <div className="tk">
        <div className="tk-list">
          {st.loading && !j ? <Loading /> : null}
          {st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
          {j && !j.tickets.length ? <Empty text="Aucune demande ici." /> : null}
          {j ? j.tickets.map((t) => (
            <button type="button" key={t.id} className={'tk-item' + (t.id === sel ? ' on' : '') + (t.priority === 'high' ? ' hot' : '')} onClick={() => { setSel(t.id); reload(); }}>
              <b>{t.customerName}</b><span>{t.subject}</span><small>{STAT[t.status] + ' · ' + t.channel + ' · ' + dateFr(t.updatedAt)}</small>
            </button>
          )) : null}
        </div>
        <div className="tk-detail">
          {sel ? <Detail key={sel} id={sel} ver={ver} members={members} onChange={reload} onDeleted={() => { setSel(null); reload(); }} /> : <Empty text="Choisissez une demande." />}
        </div>
      </div>
    </>
  );
}

/* ----- Une demande ----- */
function Detail({ id, ver, members, onChange, onDeleted }) {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/support/' + id), [id, ver]);
  return (
    <Loaded state={st}>
      {(j) => {
        const t = j.ticket;
        // Quand la demande change sur le serveur, la vue est reconstruite (comme avant) : champs et réponse repartent de l'état enregistré.
        const key = [t.updatedAt, t.status, t.priority, t.assigneeId, j.messages.length].join('|');
        return <Ticket key={key} id={id} j={j} members={members} onChange={onChange} onDeleted={onDeleted} />;
      }}
    </Loaded>
  );
}

function Ticket({ id, j, members, onChange, onDeleted }) {
  const { oapi, can, confirm, propose, toast, fail, dateFr } = useWs();
  const t = j.ticket;
  const [status, setStatus] = useState(t.status);
  const [prio, setPrio] = useState(t.priority);
  const [who, setWho] = useState(t.assigneeId ? String(t.assigneeId) : '');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const replyRef = useRef(null);

  const save = (s, p, w) => {
    oapi('PUT', '/support/' + id, { status: s, priority: p, assigneeId: w || null }).then(() => { toast('Enregistré.'); onChange(); }).catch(fail);
  };
  const send = () => {
    if (!reply.trim()) return;
    setBusy(true);
    oapi('POST', '/support/' + id + '/messages', { content: reply }).then(() => { toast('Réponse enregistrée. Envoyez-la aussi au client sur son canal.'); onChange(); }).catch((e) => { setBusy(false); fail(e); });
  };
  const draft = () => {
    propose('ticket-reply', { ticketId: id }, {
      title: 'Brouillon de réponse',
      apply: false,
      render: (p) => (
        <>
          <p className="ai-out">{p.reply || ''}</p>
          {p.note ? <p className="muted small">{'Note pour l\'équipe : ' + p.note}</p> : null}
        </>
      ),
      after: (p, close) => (
        <button className="btn primary small" type="button" style={{ marginTop: 12 }} onClick={() => { setReply(p.reply || ''); close(); if (replyRef.current) replyRef.current.focus(); }}>Utiliser ce texte</button>
      ),
    });
  };

  return (
    <>
      <div className="tk-top"><h2>{t.subject}</h2><p className="muted small">{t.customerName + (t.customerContact ? ' · ' + t.customerContact : '') + ' · via ' + t.channel}</p></div>
      <div className="row wrap">
        <select aria-label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); save(e.target.value, prio, who); }}>
          {['open', 'pending', 'resolved'].map((s) => <option key={s} value={s}>{STAT[s]}</option>)}
        </select>
        <select aria-label="Priorité" value={prio} onChange={(e) => { setPrio(e.target.value); save(status, e.target.value, who); }}>
          {['low', 'normal', 'high'].map((s) => <option key={s} value={s}>{PRIO[s]}</option>)}
        </select>
        <select aria-label="Responsable" value={who} onChange={(e) => { setWho(e.target.value); save(status, prio, e.target.value); }}>
          <option value="">Non assignée</option>
          {members.map((m) => <option key={m.userId} value={String(m.userId)}>{m.name}</option>)}
        </select>
        {can('manager') ? <button className="btn small" type="button" onClick={() => confirm('Supprimer cette demande ?', () => { oapi('DELETE', '/support/' + id).then(onDeleted).catch(fail); })}>Supprimer</button> : null}
      </div>
      <div className="tk-msgs">
        {j.messages.map((m) => (
          <div className={'msg ' + m.author} key={m.id}>
            <small>{(m.author === 'customer' ? t.customerName : (m.who || 'Équipe')) + ' · ' + dateFr(m.at)}</small>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <textarea rows={4} placeholder="Votre réponse au client…" aria-label="Votre réponse" ref={replyRef} value={reply} onChange={(e) => setReply(e.target.value)} />
      <div className="row">
        <button className="btn primary small" type="button" disabled={busy} onClick={send}>Enregistrer la réponse</button>
        <button className="btn signal small" type="button" onClick={draft}>Brouillon par l'IA</button>
      </div>
    </>
  );
}
