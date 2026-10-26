import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { tr, useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { API_BASE } from '../../../lib/api.js';
import { Pill, ReadOnly, publicBase, saveBlob } from './util.jsx';

const ST = { pending: ['À confirmer', 'mid'], confirmed: ['Confirmé', 'good'], cancelled: ['Annulé', 'bad'], done: ['Terminé', ''] };
const CH = { whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', web: 'Page web' };
const FILTERS = [['open', 'À venir'], ['done', 'Terminés'], ['cancelled', 'Annulés']];

/** Onglet « Rendez-vous » : pris par l'assistant (ou ajoutés par l'équipe). onChange = recharger tout le module. */
export function Appts({ admin, filter, setFilter, onChange }) {
  const t = useT();
  const ws = useWs();
  const { oapi, toast, confirm, fail, orgId } = ws;
  const st = useLoad(() => oapi('GET', '/sales/appointments' + (filter === 'open' ? '' : '?status=' + filter)), [filter]);

  function upd(a, body, msg) {
    oapi('PUT', '/sales/appointments/' + a.id, body)
      .then((r) => { toast(msg + (body.notify && !r.notified && a.channel ? ' ' + t('(le client n\'a pas pu être prévenu : plus de 24 h ou canal déconnecté)') : '')); st.reload(); onChange(); })
      .catch(fail);
  }
  function ics(a) {
    fetch(API_BASE + '/api/ws/orgs/' + orgId + '/sales/appointments/' + a.id + '/ics', { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(t('Téléchargement impossible.')); return r.blob(); })
      .then((bl) => saveBlob(bl, 'rendez-vous-' + a.date + '.ics', 2000))
      .catch(fail);
  }
  const edit = (a) => editAppt(ws, a, st.reload);
  const list = st.data ? st.data.appointments : null;
  return (
    <>
      <div className="ws-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('Rendez-vous')}</h2>
          <button className="btn primary small" type="button" onClick={() => edit(null)}>{t('Ajouter un rendez-vous')}</button>
        </div>
        <p className="muted small">{t("Les rendez-vous pris par l'assistant arrivent ici « à confirmer ». Un créneau déjà pris ne peut pas être réservé deux fois (60 minutes par rendez-vous, de 6 h à 21 h).")}</p>
        <div className="ws-tabs">
          {FILTERS.map((f) => <button key={f[0]} type="button" className={'tab' + (filter === f[0] ? ' on' : '')} onClick={() => setFilter(f[0])}>{t(f[1])}</button>)}
        </div>
        <div>
          {st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
          {st.loading && !list ? <Loading /> : null}
          {list && !list.length ? <Empty text={filter === 'open' ? t('Aucun rendez-vous à venir.') : t('Rien à afficher.')} /> : null}
          {(list || []).map((a) => {
            const open = a.status === 'pending' || a.status === 'confirmed';
            return (
              <div className="line" style={{ display: 'block' }} key={a.id}>
                <div className="row">
                  <b>{a.label}</b>
                  <Pill t={ST[a.status] || ['', '']} />
                  {a.channel ? <Pill t={[CH[a.channel] || a.channel, '']} /> : null}
                  <span className="grow" />
                  {a.status === 'pending' ? <button className="link" type="button" onClick={() => upd(a, { status: 'confirmed', notify: true }, a.channel ? t('Rendez-vous confirmé : le client est prévenu.') : t('Rendez-vous confirmé.'))}>{t('Confirmer')}</button> : null}
                  {a.status === 'confirmed' ? <button className="link" type="button" onClick={() => upd(a, { status: 'done' }, t('Rendez-vous terminé.'))}>{t('Terminé')}</button> : null}
                  <button className="link" type="button" title={t("Télécharger ce rendez-vous pour l'ajouter à Google Agenda, Outlook ou Apple Calendrier")} onClick={() => ics(a)}>Agenda (.ics)</button>
                  {open ? <button className="link" type="button" onClick={() => edit(a)}>{t('Déplacer')}</button> : null}
                  {open ? <button className="link" type="button" onClick={() => confirm(t("Annuler ce rendez-vous ? Le client sera prévenu s'il vous a écrit il y a moins de 24 h."), () => upd(a, { status: 'cancelled', notify: true }, t('Rendez-vous annulé.')))}>{t('Annuler')}</button> : null}
                </div>
                <small className="muted">{[a.customer, a.phone, a.purpose, a.place].filter(Boolean).join(' · ')}</small>
              </div>
            );
          })}
        </div>
      </div>
      {admin ? <CalendarCard /> : null}
    </>
  );
}

/* Lien d'abonnement à l'agenda (Google Agenda, Outlook, Apple Calendrier) */
function CalendarCard() {
  const t = useT();
  const { oapi, copy, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/calendar'), []);
  const [fresh, setFresh] = useState(null);
  const j = fresh || st.data;
  if (st.error) return <div className="ws-card"><h2>{t('Agenda sur votre téléphone ou votre ordinateur')}</h2><p className="ws-err" role="alert">{t(st.error.message)}</p></div>;
  if (!j) return <div className="ws-card"><h2>{t('Agenda sur votre téléphone ou votre ordinateur')}</h2></div>;
  const url = j.configured ? publicBase() + j.path : '';
  return (
    <div className="ws-card">
      <h2>{t('Agenda sur votre téléphone ou votre ordinateur')}</h2>
      {!j.configured ? <p className="muted">{t("Obtenez un lien secret : en l'ajoutant à Google Agenda (Autres agendas > À partir de l'URL), Outlook ou Apple Calendrier, vos rendez-vous s'y affichent tout seuls, avec un rappel une heure avant.")}</p> : (
        <>
          <p className="muted small">{t("Ajoutez ce lien dans votre agenda (Google Agenda : Autres agendas > À partir de l'URL). Lecture seule : un rendez-vous modifié ici apparaît dans votre agenda après quelques heures (Google actualise lui-même, parfois jusqu'à 24 h). Ne partagez pas ce lien : toute personne qui l'a peut voir les rendez-vous.")}</p>
          <ReadOnly value={url} label={t("Lien de l'agenda")} />
          {!/^https:\/\/|^http:\/\/localhost/.test(url) ? <p className="ws-err">{t('Pour que Google puisse lire ce lien, le serveur doit être en ligne en HTTPS (API_PUBLIC_URL).')}</p> : null}
        </>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        {j.configured ? <button className="btn small" type="button" onClick={() => copy(url, t('Lien copié.'))}>{t('Copier le lien')}</button> : null}
        <button className="btn small" type="button" onClick={() => oapi('POST', '/sales/calendar/regenerate', {}).then((r) => setFresh({ configured: true, path: r.path })).catch(fail)}>{j.configured ? t("Créer un nouveau lien (l'ancien s'arrête)") : t("Créer mon lien d'agenda")}</button>
      </div>
    </div>
  );
}

function editAppt(ws, a, done) {
  const t = tr;
  ws.modal(a ? t('Déplacer le rendez-vous') : t('Nouveau rendez-vous'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'date', label: t('Jour'), type: 'date', required: true, value: a ? a.date : '' },
        { k: 'time', label: t('Heure'), type: 'time', required: true, value: a ? a.time : '10:00' },
        { k: 'purpose', label: t('Objet'), value: a ? a.purpose : '' },
        { k: 'place', label: t('Lieu'), value: a ? a.place : '' },
      ]}
      onSubmit={(v) => ws.oapi(a ? 'PUT' : 'POST', '/sales/appointments' + (a ? '/' + a.id : ''), { date: v.date, time: v.time, purpose: v.purpose, place: v.place }).then(() => { close(); done(); })}
    />
  ));
}
