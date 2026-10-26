import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import { Appts } from '../parts/sales/Appts.jsx';
import { Campaigns, Catalog } from '../parts/sales/Catalog.jsx';
import { Whatsapp, ShareLink } from '../parts/sales/Channels.jsx';
import { Chats, MineView } from '../parts/sales/Chats.jsx';
import { Followup } from '../parts/sales/Followup.jsx';
import { OST, Pill } from '../parts/sales/util.jsx';

/* Assistant commercial : l'IA répond aux prospects (web, WhatsApp), les enregistre et prend les commandes. */
export default function Sales() {
  const { can } = useWs();
  return can('manager') ? <SalesAdmin /> : <MineView />;
}

function SalesAdmin() {
  const ws = useWs();
  const { oapi, can, money, modal } = ws;
  const admin = can('admin');
  const [tab, setTab] = useState('orders');
  const [chatFilter, setChatFilter] = useState('all');
  const [apptFilter, setApptFilter] = useState('open');
  const [ver, setVer] = useState(0);
  const st = useLoad(() => oapi('GET', '/sales'), []);
  /** Recharge les statistiques et l'onglet courant. */
  const load = () => { st.reload(); setVer((v) => v + 1); };
  const pick = (t) => { setTab(t); load(); };
  const data = st.data;

  const tabs = [['orders', 'Commandes'], ['chats', 'Conversations'], ['catalog', 'Catalogue'], ['appts', 'Rendez-vous' + (data && data.stats && data.stats.appointments ? ' (' + data.stats.appointments + ')' : '')], ['campaigns', 'Campagnes'], ['followup', 'Relances']].concat(admin ? [['whatsapp', 'Canaux']] : []);

  let area;
  if (tab === 'orders') area = <Orders onChange={load} />;
  else if (tab === 'chats') area = <Chats filter={chatFilter} setFilter={setChatFilter} onChange={load} />;
  else if (tab === 'catalog') area = <Catalog onChange={load} />;
  else if (tab === 'whatsapp') area = <Whatsapp onChange={load} />;
  else if (tab === 'followup') area = <Followup admin={admin} />;
  else if (tab === 'appts') area = <Appts admin={admin} filter={apptFilter} setFilter={setApptFilter} onChange={load} />;
  else area = <Campaigns />;

  const s = data && data.stats;
  return (
    <>
      <div className="ws-head">
        <div><h1>Assistant commercial</h1><p className="muted">Après une publicité, l'IA répond à vos prospects, les enregistre et prend leurs commandes.</p></div>
        <div className="row">
          {admin ? <button className="btn small" type="button" onClick={() => modal('Réglages de l\'assistant public', (close) => <Settings s={data.settings} close={close} onChange={load} />)} disabled={!data}>Réglages</button> : null}
          {admin ? <button className="btn primary small" type="button" onClick={() => modal('Lien à partager dans vos publicités', () => <ShareLink settings={data.settings} />)} disabled={!data}>Lien à partager</button> : null}
        </div>
      </div>
      <div>
        <div className="ws-tabs">
          {tabs.map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => pick(t[0])}>{t[1]}</button>)}
        </div>
        <div>
          {st.loading && !data ? <Loading /> : st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : data ? (
            <>
              <div className="kpis">
                <div className="stat"><b>{String(s.chats7)}</b><span>conversations (7 jours)</span></div>
                <div className="stat"><b>{String(s.prospects)}</b><span>prospects à convertir</span></div>
                <div className={'stat' + (s.pendingOrders ? ' bad' : '')}><b>{String(s.pendingOrders)}</b><span>commande(s) à valider</span></div>
                <div className="stat"><b className="ok">{money(s.ordered)}</b><span>commandé au total</span></div>
              </div>
              {!data.settings.chatEnabled ? (
                <div className="ws-card">
                  <h2>L'assistant public est désactivé</h2>
                  <p>{s.catalog ? "Activez-le dans les réglages pour qu'il réponde à vos prospects." : "Étape 1 : ajoutez vos articles et leurs prix dans l'onglet Catalogue. Étape 2 : activez l'assistant dans les réglages. Étape 3 : partagez le lien dans votre publicité."}</p>
                </div>
              ) : null}
              {s.waiting ? <p className="ws-err">{s.waiting + ' conversation(s) attendent un conseiller (voir le Service client).'}</p> : null}
              <div key={tab + ':' + ver}>{area}</div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Orders({ onChange }) {
  const { oapi, money, copy, confirm, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/orders'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  if (!st.data) return null;
  const setStatus = (o, status) => oapi('PUT', '/sales/orders/' + o.id + '/status', { status }).then(onChange).catch(fail);
  return (
    <>
      <div className="ws-card">
        <h2>Commandes de vos clients</h2>
        {!st.data.orders.length ? <Empty text="Aucune commande pour le moment. Elles apparaîtront ici dès qu'un prospect commande avec l'assistant." /> : null}
        {st.data.orders.map((o) => (
          <div className="line" key={o.id}>
            <span>
              <b>{o.number + ' · ' + o.customer}</b>{' '}<Pill t={OST[o.status] || ['', '']} />
              <small>{' ' + o.lines.map((l) => l.label + ' × ' + l.quantity).join(', ') + ' · ' + money(o.total) + (o.phone ? ' · ' + o.phone : '') + (o.note ? ' · ' + o.note : '')}</small>
            </span>
            <span className="row">
              {o.status === 'pending' ? <button className="link" type="button" onClick={() => setStatus(o, 'confirmed')}>Confirmer</button> : null}
              {o.status === 'pending' ? <button className="link" type="button" onClick={() => confirm('Refuser la commande ' + o.number + ' ?', () => setStatus(o, 'cancelled'))}>Refuser</button> : null}
              {o.status === 'confirmed' ? <button className="link" type="button" onClick={() => oapi('POST', '/sales/orders/' + o.id + '/invoice', {}).then(() => { toast('Facture créée (voir Clients et ventes).'); onChange(); }).catch(fail)}>Créer la facture</button> : null}
              {o.phone ? <button className="link" type="button" onClick={() => copy(o.phone, 'Numéro copié.')}>Copier le numéro</button> : null}
            </span>
          </div>
        ))}
      </div>
      <p className="muted small">Vérifiez le stock et le paiement, contactez le client, puis confirmez. Les prix viennent toujours de votre catalogue, jamais de l'IA.</p>
    </>
  );
}

/** Réglages de l'assistant public (administrateurs). */
function Settings({ s, close, onChange }) {
  const { oapi } = useWs();
  const yn = (b, d) => (b === false ? '0' : d);
  return (
    <>
      <Form
        submitText="Enregistrer"
        fields={[
          { k: 'on', label: 'Assistant public', type: 'select', options: [['1', 'Activé : il répond aux prospects'], ['0', 'Désactivé']], value: s.chatEnabled ? '1' : '0' },
          { k: 'auto', label: "Quand l'IA passe la main", type: 'select', options: [['0', 'Vous attribuez la conversation vous-même'], ['1', 'Attribuer automatiquement au commercial le moins occupé']], value: s.autoAssign ? '1' : '0', hint: 'Sont commerciaux les membres dont le poste contient « commercial », « vente », « vendeur » ou « sales ». Modifiez le poste dans Équipe et antennes.' },
          { k: 'hOrder', label: "Après une commande enregistrée par l'IA", type: 'select', options: [['1', "Un conseiller prend le relais (et l'IA interne prépare son dossier)"], ['0', "L'IA continue seule"]], value: yn(s.handoffOrder, '1'), hint: 'La commande reste « à valider » dans tous les cas.' },
          { k: 'hAppt', label: "Après un rendez-vous pris par l'IA", type: 'select', options: [['1', "Un conseiller prend le relais (et l'IA interne prépare son dossier)"], ['0', "L'IA continue seule"]], value: yn(s.handoffAppt, '1') },
          { k: 'rem', label: "Rappel automatique la veille d'un rendez-vous confirmé", type: 'select', options: [['1', 'Oui : le client est rappelé à partir de 16 h'], ['0', 'Non']], value: yn(s.apptReminder, '1'), hint: "Dans les 24 h après son dernier message : texte libre. Après, WhatsApp exige un modèle approuvé par Meta de type « Rappel de rendez-vous » (onglet Relances). Messenger et Instagram : seulement dans les 24 h." },
          { k: 'delay', label: "Délai avant la réponse de l'IA (WhatsApp)", type: 'select', options: [['0', 'Tout de suite'], ['30', '30 secondes'], ['60', '1 minute'], ['90', '1 minute 30'], ['120', '2 minutes'], ['150', '2 minutes 30'], ['180', '3 minutes']], value: String(s.replyDelay || 0), hint: "L'IA attend ce temps avant de répondre. Si le client écrit plusieurs messages pendant l'attente, elle les lit ensemble et fait une seule réponse. Si un conseiller reprend la conversation, elle ne répond pas." },
          { k: 'voice', label: 'Réponse en message vocal', type: 'select', options: [['mirror', "Quand le client m'envoie un vocal (conseillé)"], ['always', 'Toujours'], ['off', 'Jamais']], value: s.voiceReply || 'mirror', hint: s.ttsAvailable ? "La réponse écrite part toujours ; la voix s'y ajoute. Chaque message vocal compte comme un message IA de plus." : "Indisponible : le service de voix n'est pas configuré sur le serveur (TTS_API_KEY)." },
          { k: 'info', label: 'Informations pratiques pour répondre aux clients', type: 'textarea', rows: 8, value: s.salesInfo, placeholder: 'Horaires, adresse, livraison (zones et prix), moyens de paiement, délais, conditions de retour…', hint: "L'assistant n'invente rien : il utilise ce texte et votre catalogue. Plus c'est précis, mieux il répond." },
        ]}
        onSubmit={(v) => oapi('PUT', '/sales/settings', { chatEnabled: v.on === '1', salesInfo: v.info, autoAssign: v.auto === '1', replyDelay: Number(v.delay), voiceReply: v.voice, handoffOrder: v.hOrder === '1', handoffAppt: v.hAppt === '1', apptReminder: v.rem === '1' }).then(() => { close(); onChange(); })}
      />
      <p className="muted small">{"Chaque message traité par l'IA est compté dans le quota de messages IA de votre organisation. Messages vocaux : " + (s.voice ? 'activés (transcrits en texte).' : 'dictée du navigateur seulement (la transcription par le serveur n\'est pas activée).')}</p>
    </>
  );
}
