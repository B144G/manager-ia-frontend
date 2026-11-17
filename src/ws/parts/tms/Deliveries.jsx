import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { DeliveryItems } from '../logistics/Fleet.jsx';
import { Fa } from '../../../lib/fa.jsx';
import { PRIORITY, TMS, num } from './kit.jsx';

/* Livraisons : liste, filtres, état et preuve, prévenir le client (WhatsApp), lien de suivi, articles du stock, historique.
   Champs transport : poids, volume, palettes, coordonnées GPS, créneau, priorité, montant à encaisser à la livraison. */

const PILL = { to_prepare: 'mid', shipped: 'mid', on_route: 'mid', delivered: 'good', failed: 'bad', returned: 'bad' };
const STATUSES = [['to_prepare', 'À préparer'], ['shipped', 'Expédiée'], ['on_route', 'En route'], ['delivered', 'Livrée'], ['failed', 'Échec'], ['returned', 'Retournée']];
const FILTERS = [['open', 'En cours'], ['late', 'En retard'], ['today', "Aujourd'hui"], ['done', 'Terminées'], ['all', 'Toutes']];

export default function Deliveries() {
  const t = useT();
  const { oapi, can, money, dateFr, today, modal, confirm, fail, toast, copy } = useWs();
  const [filter, setFilter] = useState('open');
  const st = useLoad(() => oapi('GET', '/logistics'), []);
  const load = st.reload;

  const edit = (d) => Promise.all([oapi('GET', '/logistics/zones'), oapi('GET', '/logistics/carriers'), d ? Promise.resolve({ documents: [] }) : oapi('GET', '/logistics/documents')]).then(([zj, cj, dj]) => modal(d ? t('Modifier la livraison') : t('Nouvelle livraison'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        ...(d ? [] : [{ k: 'docId', label: t('Commande ou facture liée'), type: 'select', options: [['', t('Aucune (livraison libre)')]].concat(dj.documents.map((x) => [String(x.id), (x.kind === 'order' ? t('Commande {number} : {customer}', { number: x.number, customer: x.customer }) : t('Facture {number} : {customer}', { number: x.number, customer: x.customer }))])), hint: t('Le client et le téléphone sont repris automatiquement.') }]),
        { k: 'customerName', label: t('Client'), value: d && d.customerName, hint: d ? '' : t("Obligatoire si aucune commande n'est choisie.") },
        { k: 'phone', label: t('Téléphone (avec indicatif)'), value: d && d.phone, placeholder: '237677112233' },
        { k: 'address', label: t('Adresse'), type: 'textarea', rows: 2, value: d && d.address },
        { k: 'zoneId', label: t('Zone'), type: 'select', options: [['', t('Aucune')]].concat(zj.zones.map((z) => [String(z.id), z.name + ' (' + money(z.fee) + ')'])), value: d && d.zoneId ? String(d.zoneId) : '', hint: t('Les frais et la date prévue sont proposés selon la zone si vous les laissez vides.') },
        { k: 'carrierId', label: t('Transporteur / livreur'), type: 'select', options: [['', t('Non choisi')]].concat(cj.carriers.filter((c) => c.active).map((c) => [String(c.id), c.name])), value: d && d.carrierId ? String(d.carrierId) : '' },
        { k: 'fee', label: t('Frais de livraison'), value: d ? d.fee : '' },
        { k: 'plannedDate', label: t('Date prévue'), type: 'date', value: d && d.plannedDate },
        { k: 'tracking', label: t('Numéro de suivi'), value: d && d.tracking },
        { k: 'note', label: t('Note'), value: d && d.note },
        { k: 'weight', label: t('Poids (kg)'), value: d && d.weight ? d.weight : '' }, { k: 'volume', label: t('Volume (m³)'), value: d && d.volume ? d.volume : '' }, { k: 'pallets', label: t('Palettes'), value: d && d.pallets ? d.pallets : '' },
        { k: 'windowStart', label: t('Créneau : à partir de'), type: 'time', value: d ? d.windowStart : '' }, { k: 'windowEnd', label: t('Créneau : au plus tard'), type: 'time', value: d ? d.windowEnd : '' },
        { k: 'priority', label: t('Priorité'), type: 'select', value: d ? String(d.priority || 0) : '0', options: PRIORITY.map((x) => [x[0], t(x[1])]) },
        { k: 'codAmount', label: t('À encaisser à la livraison'), value: d && d.codAmount ? d.codAmount : '', hint: t('Paiement à la livraison : le chauffeur saisit le montant reçu.') },
        { k: 'lat', label: t('Latitude (GPS, facultatif)'), value: d && d.lat !== null ? d.lat : '' }, { k: 'lng', label: t('Longitude (GPS, facultatif)'), value: d && d.lng !== null ? d.lng : '', hint: t("Avec les coordonnées, l'ordre de passage suit la distance réelle.") },
      ]}
      onSubmit={(v) => oapi(d ? 'PUT' : 'POST', '/logistics/deliveries' + (d ? '/' + d.id : ''), { ...v, lat: v.lat === '' ? null : v.lat, lng: v.lng === '' ? null : v.lng, priority: Number(v.priority) }).then(() => { close(); load(); })}
    />
  ), { wide: true })).catch(fail);

  const setStatus = (d) => modal(t('État de la livraison : {name}', { name: d.customerName }), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'status', label: t('Nouvel état'), type: 'select', options: STATUSES.map((x) => [x[0], t(x[1])]), value: d.status },
        { k: 'receivedBy', label: t('Reçu par (si livrée)'), placeholder: t('Nom de la personne qui a reçu le colis') },
        { k: 'proof', label: t('Preuve de livraison (si livrée)'), placeholder: t('Signature sur le carnet, photo envoyée sur WhatsApp…') },
        { k: 'note', label: t('Note ou motif'), hint: t("Obligatoire en cas d'échec ou de retour (client absent, adresse introuvable, refus…).") },
      ]}
      onSubmit={(v) => oapi('PUT', '/logistics/deliveries/' + d.id + '/status', v).then(() => { close(); load(); })}
    />
  ));

  const history = (d) => oapi('GET', '/logistics/deliveries/' + d.id).then((j) => modal(t('Historique : {name}', { name: d.customerName }), () => (
    <>
      {j.delivery.receivedBy || j.delivery.proof ? <p className="small">{t('Preuve de livraison : {proof}', { proof: [j.delivery.receivedBy ? t('reçu par {name}', { name: j.delivery.receivedBy }) : '', j.delivery.proof].filter(Boolean).join(' · ') })}</p> : null}
      {j.events.map((e) => <div className="line" key={e.id}><span><span className={'pill ' + (PILL[e.status] || '')}>{t(e.statusLabel)}</span><small>{' ' + e.note}</small></span><small>{e.at.slice(0, 16).replace('T', ' ') + (e.who ? ' · ' + e.who : '')}</small></div>)}
    </>
  ))).catch(fail);

  // Lien WhatsApp : s'ouvre dans un nouvel onglet avec le message prérempli ; c'est la personne qui appuie sur « Envoyer ».
  const notify = (d) => oapi('GET', '/logistics/deliveries/' + d.id + '/notify').then((j) => {
    if (!j.url) { toast(t(j.warning), true); return; }
    modal(t('Prévenir le client'), (close) => (
      <>
        <p className="small">{t("Message préparé (aucun envoi automatique : WhatsApp s'ouvre, vous relisez puis vous envoyez) :")}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{j.message}</p>
        {j.warning ? <p className="ws-err">{t(j.warning)}</p> : null}
        <div className="row"><a className="btn primary" href={j.url} target="_blank" rel="noopener noreferrer" onClick={close}>{t('Ouvrir WhatsApp')}</a></div>
      </>
    ));
  }).catch(fail);

  const share = (d) => oapi('GET', TMS + '/deliveries/' + d.id + '/share').then((j) => modal(t('Suivi pour le client'), () => (
    <>
      <p className="small">{t('Lien secret à envoyer au client : il voit l\'état et le créneau d\'arrivée, sans adresse ni montant.')}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{j.message}</p>
      <div className="row">
        {j.whatsapp ? <a className="btn primary" href={j.whatsapp} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" /> {t('Ouvrir WhatsApp')}</a> : null}
        <button className="btn" type="button" onClick={() => copy(j.url, t('Lien copié.'))}>{t('Copier le lien')}</button>
        <a className="btn" href={'mailto:?subject=' + encodeURIComponent(j.email.subject) + '&body=' + encodeURIComponent(j.email.text)}><Fa name="mail" /> {t('E-mail')}</a>
      </div>
    </>
  ))).catch(fail);

  const pick = (list) => list.filter((d) => {
    if (filter === 'late') return d.late;
    if (filter === 'today') return d.plannedDate === today() && ['to_prepare', 'shipped', 'on_route'].includes(d.status);
    if (filter === 'done') return ['delivered', 'failed', 'returned'].includes(d.status);
    if (filter === 'open') return ['to_prepare', 'shipped', 'on_route'].includes(d.status);
    return true;
  });

  return (
    <>
      <div className="row tms-toolbar tms-actions"><button className="btn primary" type="button" onClick={() => edit()}>{t('Nouvelle livraison')}</button></div>
      <Loaded state={st}>{(j) => {
        const s = j.summary;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.today)}</b><span>{t("livraison(s) aujourd'hui")}</span></div>
              <div className={'stat' + (s.late ? ' bad' : '')}><b>{String(s.late)}</b><span>{t('en retard')}</span></div>
              <div className="stat"><b>{s.successRate === null ? '—' : s.successRate + ' %'}</b><span>{t('livraisons réussies')}</span></div>
              <div className="stat"><b>{money(s.monthCost)}</b><span>{t('frais de livraison du mois')}</span></div>
            </div>
            <div className="ws-card">
                <div className="ws-tabs">
                  {FILTERS.map((f) => <button key={f[0]} type="button" className={'tab' + (filter === f[0] ? ' on' : '')} onClick={() => setFilter(f[0])}>{t(f[1])}</button>)}
                </div>
                {!pick(j.deliveries).length ? <Empty text={j.deliveries.length ? t('Aucune livraison dans cette liste.') : t('Aucune livraison. Créez-en une, liée à une commande ou libre.')} /> : null}
                {pick(j.deliveries).map((d) => (
                  <div className="line" key={d.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{d.customerName}</b> <span className={'pill ' + (PILL[d.status] || '')}>{t(d.statusLabel)}</span>{d.late ? <span className="pill bad">{t('En retard')}</span> : null}
                      <br /><small>{[d.docNumber ? t('Commande {number}', { number: d.docNumber }) : '', d.address, d.zone, d.carrier, d.plannedDate ? t('prévue le {date}', { date: dateFr(d.plannedDate) }) : t('sans date'), money(d.fee), d.tracking ? t('suivi {code}', { code: d.tracking }) : '', d.weight ? num(d.weight) + ' kg' : '', d.windowStart || d.windowEnd ? t('créneau {a}-{b}', { a: d.windowStart || '…', b: d.windowEnd || '…' }) : '', d.codAmount ? t('à encaisser {amount}', { amount: money(d.codAmount) }) : '', d.eta && d.roundId ? t('passage vers {h}', { h: d.eta }) : '', d.attempts > 1 ? t('{n} tentatives', { n: d.attempts }) : ''].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => setStatus(d)}>{t('État')}</button>
                      <button className="link" type="button" onClick={() => notify(d)}>{t('Prévenir le client')}</button>
                      <button className="link" type="button" onClick={() => share(d)}>{t('Lien de suivi')}</button>
                      <button className="link" type="button" onClick={() => modal(t('Articles du stock : {name}', { name: d.customerName }), (close) => <DeliveryItems delivery={d} close={close} done={load} />)}>{t('Articles du stock')}</button>
                      <button className="link" type="button" onClick={() => history(d)}>{t('Historique')}</button>
                      <button className="link" type="button" onClick={() => edit(d)}>{t('Modifier')}</button>
                      {can('manager') ? <button className="link" type="button" onClick={() => confirm(t('Supprimer cette livraison pour {name} ?', { name: d.customerName }), () => { oapi('DELETE', '/logistics/deliveries/' + d.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
              </div>
          </>
        );
      }}
      </Loaded>
    </>
  );
}
