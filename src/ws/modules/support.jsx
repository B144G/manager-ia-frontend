import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Service client (boîte de demandes + réponses, brouillon IA, formulaire public). */

const STAT = { open: 'À traiter', pending: 'En attente', resolved: 'Résolue' };
const PRIO = { low: 'Basse', normal: 'Normale', high: 'Urgente' };
const TABS = [['open', 'À traiter'], ['pending', 'En attente'], ['resolved', 'Résolues'], ['all', 'Toutes']];
const CHAN = { manuel: 'Saisie manuelle', whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', email: 'E-mail', telephone: 'Téléphone' };

export default function Support() {
  const { oapi, can, modal, copy, info, dateFr } = useWs();
  const t = useT();
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
    modal(t('Formulaire pour vos clients'), () => (
      <>
        <p>{t('Partagez ce lien (WhatsApp, Facebook, votre site…). Chaque message envoyé devient une demande ici.')}</p>
        <input value={url} readOnly onFocus={(e) => e.target.select()} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary small" type="button" onClick={() => copy(url, t('Lien copié.'))}>{t('Copier le lien')}</button>
          <a className="btn small" href={url} target="_blank" rel="noopener noreferrer">{t('Voir le formulaire')}</a>
        </div>
      </>
    ));
  };

  const newTicket = () => {
    modal(t('Nouvelle demande'), (close) => (
      <Form
        fields={[
          { k: 'customerName', label: t('Nom du client'), required: true },
          { k: 'customerContact', label: t('Contact du client') },
          { k: 'channel', label: t('Canal'), type: 'select', options: Object.keys(CHAN).map((k) => [k, t(CHAN[k])]) },
          { k: 'subject', label: t('Sujet'), required: true },
          { k: 'message', label: t('Message du client'), type: 'textarea' },
          { k: 'priority', label: t('Priorité'), type: 'select', options: [['normal', t('Normale')], ['high', t('Urgente')], ['low', t('Basse')]] },
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => oapi('POST', '/support', v).then((j) => { close(); setFilter('open'); setSel(j.id); reload(); })}
      />
    ));
  };

  const j = st.data;
  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Service client')}</h1><p className="muted">{t('Toutes les demandes de vos clients au même endroit.')}</p></div>
        <div className="row">
          {can('admin') ? <button className="btn small" type="button" onClick={showForm}>{t('Formulaire client')}</button> : null}
          <button className="btn primary small" type="button" onClick={newTicket}>{t('Nouvelle demande')}</button>
        </div>
      </div>
      <div className="ws-tabs">
        {j ? TABS.map((tab) => {
          const n = tab[0] === 'all' ? '' : ' (' + (j.counts[tab[0]] || 0) + ')';
          return <button type="button" key={tab[0]} className={'tab' + (filter === tab[0] ? ' on' : '')} onClick={() => { setFilter(tab[0]); setSel(null); }}>{t(tab[1]) + n}</button>;
        }) : null}
      </div>
      <div className="tk">
        <div className="tk-list">
          {st.loading && !j ? <Loading /> : null}
          {st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
          {j && !j.tickets.length ? <Empty text={t('Aucune demande ici.')} /> : null}
          {j ? j.tickets.map((tk) => (
            <button type="button" key={tk.id} className={'tk-item' + (tk.id === sel ? ' on' : '') + (tk.priority === 'high' ? ' hot' : '')} onClick={() => { setSel(tk.id); reload(); }}>
              <b>{tk.customerName}</b><span>{tk.subject}</span><small>{t(STAT[tk.status]) + ' · ' + (CHAN[tk.channel] ? t(CHAN[tk.channel]) : tk.channel) + ' · ' + dateFr(tk.updatedAt)}</small>
            </button>
          )) : null}
        </div>
        <div className="tk-detail">
          {sel ? <Detail key={sel} id={sel} ver={ver} members={members} onChange={reload} onDeleted={() => { setSel(null); reload(); }} /> : <Empty text={t('Choisissez une demande.')} />}
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
        const tk = j.ticket;
        // Quand la demande change sur le serveur, la vue est reconstruite (comme avant) : champs et réponse repartent de l'état enregistré.
        const key = [tk.updatedAt, tk.status, tk.priority, tk.assigneeId, j.messages.length].join('|');
        return <Ticket key={key} id={id} j={j} members={members} onChange={onChange} onDeleted={onDeleted} />;
      }}
    </Loaded>
  );
}

function Ticket({ id, j, members, onChange, onDeleted }) {
  const { oapi, can, confirm, propose, toast, fail, dateFr } = useWs();
  const t = useT();
  const tk = j.ticket;
  const [status, setStatus] = useState(tk.status);
  const [prio, setPrio] = useState(tk.priority);
  const [who, setWho] = useState(tk.assigneeId ? String(tk.assigneeId) : '');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const replyRef = useRef(null);

  const save = (s, p, w) => {
    oapi('PUT', '/support/' + id, { status: s, priority: p, assigneeId: w || null }).then(() => { toast(t('Enregistré.')); onChange(); }).catch(fail);
  };
  const send = () => {
    if (!reply.trim()) return;
    setBusy(true);
    oapi('POST', '/support/' + id + '/messages', { content: reply }).then(() => { toast(t('Réponse enregistrée. Envoyez-la aussi au client sur son canal.')); onChange(); }).catch((e) => { setBusy(false); fail(e); });
  };
  const draft = () => {
    propose('ticket-reply', { ticketId: id }, {
      title: t('Brouillon de réponse'),
      apply: false,
      render: (p) => (
        <>
          <p className="ai-out">{p.reply || ''}</p>
          {p.note ? <p className="muted small">{t("Note pour l'équipe : {note}", { note: p.note })}</p> : null}
        </>
      ),
      after: (p, close) => (
        <button className="btn primary small" type="button" style={{ marginTop: 12 }} onClick={() => { setReply(p.reply || ''); close(); if (replyRef.current) replyRef.current.focus(); }}>{t('Utiliser ce texte')}</button>
      ),
    });
  };

  return (
    <>
      <div className="tk-top"><h2>{tk.subject}</h2><p className="muted small">{tk.customerName + (tk.customerContact ? ' · ' + tk.customerContact : '') + ' · ' + t('via {canal}', { canal: CHAN[tk.channel] ? t(CHAN[tk.channel]) : tk.channel })}</p></div>
      <div className="row wrap">
        <select aria-label={t('Statut')} value={status} onChange={(e) => { setStatus(e.target.value); save(e.target.value, prio, who); }}>
          {['open', 'pending', 'resolved'].map((s) => <option key={s} value={s}>{t(STAT[s])}</option>)}
        </select>
        <select aria-label={t('Priorité')} value={prio} onChange={(e) => { setPrio(e.target.value); save(status, e.target.value, who); }}>
          {['low', 'normal', 'high'].map((s) => <option key={s} value={s}>{t(PRIO[s])}</option>)}
        </select>
        <select aria-label={t('Responsable')} value={who} onChange={(e) => { setWho(e.target.value); save(status, prio, e.target.value); }}>
          <option value="">{t('Non assignée')}</option>
          {members.map((m) => <option key={m.userId} value={String(m.userId)}>{m.name}</option>)}
        </select>
        {can('manager') ? <button className="btn small" type="button" onClick={() => confirm(t('Supprimer cette demande ?'), () => { oapi('DELETE', '/support/' + id).then(onDeleted).catch(fail); })}>{t('Supprimer')}</button> : null}
      </div>
      <div className="tk-msgs">
        {j.messages.map((m) => (
          <div className={'msg ' + m.author} key={m.id}>
            <small>{(m.author === 'customer' ? tk.customerName : (m.who || t('Équipe'))) + ' · ' + dateFr(m.at)}</small>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <textarea rows={4} placeholder={t('Votre réponse au client…')} aria-label={t('Votre réponse')} ref={replyRef} value={reply} onChange={(e) => setReply(e.target.value)} />
      <div className="row">
        <button className="btn primary small" type="button" disabled={busy} onClick={send}>{t('Enregistrer la réponse')}</button>
        <button className="btn signal small" type="button" onClick={draft}>{t("Brouillon par l'IA")}</button>
      </div>
    </>
  );
}
