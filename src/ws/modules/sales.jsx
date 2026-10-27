import { useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import { Appts } from '../parts/sales/Appts.jsx';
import { Campaigns, Catalog } from '../parts/sales/Catalog.jsx';
import { Whatsapp, ShareLink } from '../parts/sales/Channels.jsx';
import { Chats, MineView } from '../parts/sales/Chats.jsx';
import { Negotiation, NegoLog } from '../parts/sales/Negotiation.jsx';
import { Relances } from '../parts/sales/Relances.jsx';
import { Relay } from '../parts/sales/Relay.jsx';
import { OST, Pill } from '../parts/sales/util.jsx';

/* Assistant commercial : l'IA répond aux prospects (web, WhatsApp), les enregistre et prend les commandes. */
export default function Sales() {
  const { can } = useWs();
  return can('manager') ? <SalesAdmin /> : <MineView />;
}

function SalesAdmin() {
  const t = useT();
  const ws = useWs();
  const { oapi, can, money, modal } = ws;
  const admin = can('admin');
  const [tab, setTab] = useState(() => { const q = new URLSearchParams(window.location.search).get('tab'); return ['followup', 'negotiation'].includes(q) ? q : 'orders'; });
  const [chatFilter, setChatFilter] = useState('all');
  const [apptFilter, setApptFilter] = useState('open');
  const [ver, setVer] = useState(0);
  const st = useLoad(() => oapi('GET', '/sales'), []);
  /** Recharge les statistiques et l'onglet courant. */
  const load = () => { st.reload(); setVer((v) => v + 1); };
  const pick = (k) => { setTab(k); load(); };
  const data = st.data;

  const tabs = [['orders', t('Commandes')], ['chats', t('Conversations')], ['catalog', t('Catalogue')], ['appts', t('Rendez-vous') + (data && data.stats && data.stats.appointments ? ' (' + data.stats.appointments + ')' : '')], ['campaigns', t('Campagnes')], ['negotiation', t('Négociation')], ['followup', t('Relances')]].concat(admin ? [['whatsapp', t('Canaux')], ['relay', t('Relais')]] : []);

  let area;
  if (tab === 'orders') area = <Orders onChange={load} />;
  else if (tab === 'chats') area = <Chats filter={chatFilter} setFilter={setChatFilter} onChange={load} />;
  else if (tab === 'catalog') area = <Catalog onChange={load} />;
  else if (tab === 'whatsapp') area = <Whatsapp onChange={load} />;
  else if (tab === 'followup') area = <Relances admin={admin} />;
  else if (tab === 'negotiation') area = <Negotiation admin={admin} />;
  else if (tab === 'relay') area = <Relay />;
  else if (tab === 'appts') area = <Appts admin={admin} filter={apptFilter} setFilter={setApptFilter} onChange={load} />;
  else area = <Campaigns />;

  const s = data && data.stats;
  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Assistant commercial')}</h1><p className="muted">{t("Après une publicité, l'IA répond à vos prospects, les enregistre et prend leurs commandes.")}</p></div>
        <div className="row">
          {admin ? <button className="btn small" type="button" onClick={() => modal(t("Réglages de l'assistant public"), (close) => <Settings s={data.settings} close={close} onChange={load} />)} disabled={!data}>{t('Réglages')}</button> : null}
          {admin ? <button className="btn primary small" type="button" onClick={() => modal(t('Lien à partager dans vos publicités'), () => <ShareLink settings={data.settings} />)} disabled={!data}>{t('Lien à partager')}</button> : null}
        </div>
      </div>
      <div>
        <div className="ws-tabs">
          {tabs.map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => pick(x[0])}>{x[1]}</button>)}
        </div>
        <div>
          {st.loading && !data ? <Loading /> : st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : data ? (
            <>
              <div className="kpis">
                <div className="stat"><b>{String(s.chats7)}</b><span>{t('conversations (7 jours)')}</span></div>
                <div className="stat"><b>{String(s.prospects)}</b><span>{t('prospects à convertir')}</span></div>
                <div className={'stat' + (s.pendingOrders ? ' bad' : '')}><b>{String(s.pendingOrders)}</b><span>{t('commande(s) à valider')}</span></div>
                <div className="stat"><b className="ok">{money(s.ordered)}</b><span>{t('commandé au total')}</span></div>
              </div>
              {!data.settings.chatEnabled ? (
                <div className="ws-card">
                  <h2>{t("L'assistant public est désactivé")}</h2>
                  <p>{s.catalog ? t("Activez-le dans les réglages pour qu'il réponde à vos prospects.") : t("Étape 1 : ajoutez vos articles et leurs prix dans l'onglet Catalogue. Étape 2 : activez l'assistant dans les réglages. Étape 3 : partagez le lien dans votre publicité.")}</p>
                </div>
              ) : null}
              {s.waiting ? <p className="ws-err">{t('{n} conversation(s) attendent un conseiller (voir le Service client).', { n: s.waiting })}</p> : null}
              <div key={tab + ':' + ver}>{area}</div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Orders({ onChange }) {
  const t = useT();
  const { oapi, money, copy, confirm, toast, fail, modal } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/orders'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  const setStatus = (o, status) => oapi('PUT', '/sales/orders/' + o.id + '/status', { status }).then(onChange).catch(fail);
  return (
    <>
      <div className="ws-card">
        <h2>{t('Commandes de vos clients')}</h2>
        {!st.data.orders.length ? <Empty text={t("Aucune commande pour le moment. Elles apparaîtront ici dès qu'un prospect commande avec l'assistant.")} /> : null}
        {st.data.orders.map((o) => (
          <div className="line" key={o.id}>
            <span>
              <b>{o.number + ' · ' + o.customer}</b>{' '}<Pill t={OST[o.status] || ['', '']} />{o.negotiated ? <>{' '}<span className="pill mid">{t('Négociée −{pct} %', { pct: o.discountPct })}</span></> : null}{o.approval === 'needed' ? <>{' '}<Pill t={['À valider par un responsable (Décisions)', 'bad']} /></> : null}{o.approval === 'rejected' ? <>{' '}<Pill t={['Remise refusée', 'bad']} /></> : null}{o.negotiated ? <>{' '}<Pill t={['Négociée −' + o.discountPct + ' %', 'mid']} /></> : null}{o.approval === 'needed' ? <>{' '}<Pill t={['À valider par un responsable (Décisions)', 'bad']} /></> : null}{o.approval === 'rejected' ? <>{' '}<Pill t={['Remise refusée', 'bad']} /></> : null}
              <small>{' ' + o.lines.map((l) => l.label + ' × ' + l.quantity).join(', ') + ' · ' + money(o.total) + (o.phone ? ' · ' + o.phone : '') + (o.note ? ' · ' + o.note : '')}</small>
            </span>
            <span className="row">
              {o.status === 'pending' ? <button className="link" type="button" onClick={() => setStatus(o, 'confirmed')}>{t('Confirmer')}</button> : null}
              {o.status === 'pending' ? <button className="link" type="button" onClick={() => confirm(t('Refuser la commande {number} ?', { number: o.number }), () => setStatus(o, 'cancelled'))}>{t('Refuser')}</button> : null}
              {o.status === 'confirmed' ? <button className="link" type="button" onClick={() => oapi('POST', '/sales/orders/' + o.id + '/invoice', {}).then(() => { toast(t('Facture créée (voir Clients et ventes).')); onChange(); }).catch(fail)}>{t('Créer la facture')}</button> : null}
              {o.phone ? <button className="link" type="button" onClick={() => copy(o.phone, t('Numéro copié.'))}>{t('Copier le numéro')}</button> : null}
              {o.negotiation && o.negotiation.length ? <button className="link" type="button" onClick={() => modal(t('Négociation : {number}', { number: o.number }), () => <NegoLog entries={o.negotiation} />)}>{t('Négociation')}</button> : null}
            </span>
          </div>
        ))}
      </div>
      <p className="muted small">{t("Vérifiez le stock et le paiement, contactez le client, puis confirmez. Les prix viennent toujours de votre catalogue, jamais de l'IA.")}</p>
    </>
  );
}

/** Réglages de l'assistant public (administrateurs). */
function Settings({ s, close, onChange }) {
  const t = useT();
  const { oapi } = useWs();
  const yn = (b, d) => (b === false ? '0' : d);
  return (
    <>
      <Form
        submitText={t('Enregistrer')}
        fields={[
          { k: 'on', label: t('Assistant public'), type: 'select', options: [['1', t('Activé : il répond aux prospects')], ['0', t('Désactivé')]], value: s.chatEnabled ? '1' : '0' },
          { k: 'auto', label: t("Quand l'IA passe la main"), type: 'select', options: [['0', t('Vous attribuez la conversation vous-même')], ['1', t('Attribuer automatiquement au commercial le moins occupé')]], value: s.autoAssign ? '1' : '0', hint: t('Sont commerciaux les membres dont le poste contient « commercial », « vente », « vendeur » ou « sales ». Modifiez le poste dans Équipe et antennes.') },
          { k: 'hOrder', label: t("Après une commande enregistrée par l'IA"), type: 'select', options: [['1', t("Un conseiller prend le relais (et l'IA interne prépare son dossier)")], ['0', t("L'IA continue seule")]], value: yn(s.handoffOrder, '1'), hint: t('La commande reste « à valider » dans tous les cas.') },
          { k: 'hAppt', label: t("Après un rendez-vous pris par l'IA"), type: 'select', options: [['1', t("Un conseiller prend le relais (et l'IA interne prépare son dossier)")], ['0', t("L'IA continue seule")]], value: yn(s.handoffAppt, '1') },
          { k: 'rem', label: t("Rappel automatique la veille d'un rendez-vous confirmé"), type: 'select', options: [['1', t('Oui : le client est rappelé à partir de 16 h')], ['0', t('Non')]], value: yn(s.apptReminder, '1'), hint: t("Dans les 24 h après son dernier message : texte libre. Après, WhatsApp exige un modèle approuvé par Meta de type « Rappel de rendez-vous » (onglet Relances). Messenger et Instagram : seulement dans les 24 h.") },
          { k: 'delay', label: t("Délai avant la réponse de l'IA (WhatsApp)"), type: 'select', options: [['0', t('Tout de suite')], ['30', t('30 secondes')], ['60', t('1 minute')], ['90', t('1 minute 30')], ['120', t('2 minutes')], ['150', t('2 minutes 30')], ['180', t('3 minutes')]], value: String(s.replyDelay || 0), hint: t("L'IA attend ce temps avant de répondre. Si le client écrit plusieurs messages pendant l'attente, elle les lit ensemble et fait une seule réponse. Si un conseiller reprend la conversation, elle ne répond pas.") },
          { k: 'voice', label: t('Réponse en message vocal'), type: 'select', options: [['mirror', t("Quand le client m'envoie un vocal (conseillé)")], ['always', t('Toujours')], ['off', t('Jamais')]], value: s.voiceReply || 'mirror', hint: s.ttsAvailable ? t("La réponse écrite part toujours ; la voix s'y ajoute. Chaque message vocal compte comme un message IA de plus.") : t("Indisponible : le service de voix n'est pas configuré sur le serveur (TTS_API_KEY).") },
          { k: 'info', label: t('Informations pratiques pour répondre aux clients'), type: 'textarea', rows: 8, value: s.salesInfo, placeholder: t('Horaires, adresse, livraison (zones et prix), moyens de paiement, délais, conditions de retour…'), hint: t("L'assistant n'invente rien : il utilise ce texte et votre catalogue. Plus c'est précis, mieux il répond.") },
        ]}
        onSubmit={(v) => oapi('PUT', '/sales/settings', { chatEnabled: v.on === '1', salesInfo: v.info, autoAssign: v.auto === '1', replyDelay: Number(v.delay), voiceReply: v.voice, handoffOrder: v.hOrder === '1', handoffAppt: v.hAppt === '1', apptReminder: v.rem === '1' }).then(() => { close(); onChange(); })}
      />
      <p className="muted small">{t("Chaque message traité par l'IA est compté dans le quota de messages IA de votre organisation.") + ' ' + (s.voice ? t('Messages vocaux : activés (transcrits en texte).') : t("Messages vocaux : dictée du navigateur seulement (la transcription par le serveur n'est pas activée)."))}</p>
    </>
  );
}
