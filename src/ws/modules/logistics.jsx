import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';
import { Carriers, Rounds, Zones } from '../parts/logistics/Lists.jsx';

/* Sous-application : Logistique (livraisons, suivi, preuves, transporteurs, zones, tournées, retards, prévenir le client par WhatsApp). */

const PILL = { to_prepare: 'mid', shipped: 'mid', on_route: 'mid', delivered: 'good', failed: 'bad', returned: 'bad' };
const STATUSES = [['to_prepare', 'À préparer'], ['shipped', 'Expédiée'], ['on_route', 'En route'], ['delivered', 'Livrée'], ['failed', 'Échec'], ['returned', 'Retournée']];
const FILTERS = [['open', 'En cours'], ['late', 'En retard'], ['today', "Aujourd'hui"], ['done', 'Terminées'], ['all', 'Toutes']];

export default function Logistics() {
  const { oapi, can, money, dateFr, today, modal, confirm, fail, toast } = useWs();
  const [tab, setTab] = useState('deliveries');
  const [filter, setFilter] = useState('open');
  const st = useLoad(() => oapi('GET', '/logistics'), []);
  const load = st.reload;

  const edit = (d) => Promise.all([oapi('GET', '/logistics/zones'), oapi('GET', '/logistics/carriers'), d ? Promise.resolve({ documents: [] }) : oapi('GET', '/logistics/documents')]).then(([zj, cj, dj]) => modal(d ? 'Modifier la livraison' : 'Nouvelle livraison', (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        ...(d ? [] : [{ k: 'docId', label: 'Commande ou facture liée', type: 'select', options: [['', 'Aucune (livraison libre)']].concat(dj.documents.map((x) => [String(x.id), (x.kind === 'order' ? 'Commande ' : 'Facture ') + x.number + ' : ' + x.customer])), hint: 'Le client et le téléphone sont repris automatiquement.' }]),
        { k: 'customerName', label: 'Client', value: d && d.customerName, hint: d ? '' : 'Obligatoire si aucune commande n\'est choisie.' },
        { k: 'phone', label: 'Téléphone (avec indicatif)', value: d && d.phone, placeholder: '237677112233' },
        { k: 'address', label: 'Adresse', type: 'textarea', rows: 2, value: d && d.address },
        { k: 'zoneId', label: 'Zone', type: 'select', options: [['', 'Aucune']].concat(zj.zones.map((z) => [String(z.id), z.name + ' (' + money(z.fee) + ')'])), value: d && d.zoneId ? String(d.zoneId) : '', hint: 'Les frais et la date prévue sont proposés selon la zone si vous les laissez vides.' },
        { k: 'carrierId', label: 'Transporteur / livreur', type: 'select', options: [['', 'Non choisi']].concat(cj.carriers.filter((c) => c.active).map((c) => [String(c.id), c.name])), value: d && d.carrierId ? String(d.carrierId) : '' },
        { k: 'fee', label: 'Frais de livraison', value: d ? d.fee : '' },
        { k: 'plannedDate', label: 'Date prévue', type: 'date', value: d && d.plannedDate },
        { k: 'tracking', label: 'Numéro de suivi', value: d && d.tracking },
        { k: 'note', label: 'Note', value: d && d.note },
      ]}
      onSubmit={(v) => oapi(d ? 'PUT' : 'POST', '/logistics/deliveries' + (d ? '/' + d.id : ''), v).then(() => { close(); load(); })}
    />
  ), { wide: true })).catch(fail);

  const setStatus = (d) => modal('État de la livraison : ' + d.customerName, (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'status', label: 'Nouvel état', type: 'select', options: STATUSES, value: d.status },
        { k: 'receivedBy', label: 'Reçu par (si livrée)', placeholder: 'Nom de la personne qui a reçu le colis' },
        { k: 'proof', label: 'Preuve de livraison (si livrée)', placeholder: 'Signature sur le carnet, photo envoyée sur WhatsApp…' },
        { k: 'note', label: 'Note ou motif', hint: "Obligatoire en cas d'échec ou de retour (client absent, adresse introuvable, refus…)." },
      ]}
      onSubmit={(v) => oapi('PUT', '/logistics/deliveries/' + d.id + '/status', v).then(() => { close(); load(); })}
    />
  ));

  const history = (d) => oapi('GET', '/logistics/deliveries/' + d.id).then((j) => modal('Historique : ' + d.customerName, () => (
    <>
      {j.delivery.receivedBy || j.delivery.proof ? <p className="small">{'Preuve de livraison : ' + [j.delivery.receivedBy ? 'reçu par ' + j.delivery.receivedBy : '', j.delivery.proof].filter(Boolean).join(' · ')}</p> : null}
      {j.events.map((e) => <div className="line" key={e.id}><span><span className={'pill ' + (PILL[e.status] || '')}>{e.statusLabel}</span><small>{' ' + e.note}</small></span><small>{e.at.slice(0, 16).replace('T', ' ') + (e.who ? ' · ' + e.who : '')}</small></div>)}
    </>
  ))).catch(fail);

  // Lien WhatsApp : s'ouvre dans un nouvel onglet avec le message prérempli ; c'est la personne qui appuie sur « Envoyer ».
  const notify = (d) => oapi('GET', '/logistics/deliveries/' + d.id + '/notify').then((j) => {
    if (!j.url) { toast(j.warning, true); return; }
    modal('Prévenir le client', (close) => (
      <>
        <p className="small">Message préparé (aucun envoi automatique : WhatsApp s'ouvre, vous relisez puis vous envoyez) :</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{j.message}</p>
        {j.warning ? <p className="ws-err">{j.warning}</p> : null}
        <div className="row"><a className="btn primary" href={j.url} target="_blank" rel="noopener noreferrer" onClick={close}>Ouvrir WhatsApp</a></div>
      </>
    ));
  }).catch(fail);

  const pick = (list) => list.filter((d) => {
    if (filter === 'late') return d.late;
    if (filter === 'today') return d.plannedDate === today() && ['to_prepare', 'shipped', 'on_route'].includes(d.status);
    if (filter === 'done') return ['delivered', 'failed', 'returned'].includes(d.status);
    if (filter === 'open') return ['to_prepare', 'shipped', 'on_route'].includes(d.status);
    return true;
  });

  return (
    <>
      <div className="ws-head">
        <div><h1>Logistique</h1><p className="muted">Vos livraisons, vos livreurs et vos tournées.</p></div>
        <div className="row">{tab === 'deliveries' ? <button className="btn primary small" type="button" onClick={() => edit()}>Nouvelle livraison</button> : null}</div>
      </div>
      <div className="ws-tabs">
        {[['deliveries', 'Livraisons'], ['rounds', 'Tournées'], ['carriers', 'Transporteurs'], ['zones', 'Zones']].map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => setTab(t[0])}>{t[1]}</button>)}
      </div>
      <Loaded state={st}>{(j) => {
        const s = j.summary;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.today)}</b><span>livraison(s) aujourd'hui</span></div>
              <div className={'stat' + (s.late ? ' bad' : '')}><b>{String(s.late)}</b><span>en retard</span></div>
              <div className="stat"><b>{s.successRate === null ? '—' : s.successRate + ' %'}</b><span>livraisons réussies</span></div>
              <div className="stat"><b>{money(s.monthCost)}</b><span>frais de livraison du mois</span></div>
            </div>
            {tab === 'rounds' ? <Rounds deliveries={j.deliveries} onChange={load} /> : null}
            {tab === 'carriers' ? <Carriers /> : null}
            {tab === 'zones' ? <Zones /> : null}
            {tab === 'deliveries' ? (
              <div className="ws-card">
                <div className="ws-tabs">
                  {FILTERS.map((f) => <button key={f[0]} type="button" className={'tab' + (filter === f[0] ? ' on' : '')} onClick={() => setFilter(f[0])}>{f[1]}</button>)}
                </div>
                {!pick(j.deliveries).length ? <Empty text={j.deliveries.length ? 'Aucune livraison dans cette liste.' : 'Aucune livraison. Créez-en une, liée à une commande ou libre.'} /> : null}
                {pick(j.deliveries).map((d) => (
                  <div className="line" key={d.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{d.customerName}</b> <span className={'pill ' + (PILL[d.status] || '')}>{d.statusLabel}</span>{d.late ? <span className="pill bad">En retard</span> : null}
                      <br /><small>{[d.docNumber ? 'Commande ' + d.docNumber : '', d.address, d.zone, d.carrier, d.plannedDate ? 'prévue le ' + dateFr(d.plannedDate) : 'sans date', money(d.fee), d.tracking ? 'suivi ' + d.tracking : ''].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => setStatus(d)}>État</button>
                      <button className="link" type="button" onClick={() => notify(d)}>Prévenir le client</button>
                      <button className="link" type="button" onClick={() => history(d)}>Historique</button>
                      <button className="link" type="button" onClick={() => edit(d)}>Modifier</button>
                      {can('manager') ? <button className="link" type="button" onClick={() => confirm('Supprimer cette livraison pour ' + d.customerName + ' ?', () => { oapi('DELETE', '/logistics/deliveries/' + d.id).then(load).catch(fail); })}>Supprimer</button> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        );
      }}
      </Loaded>
    </>
  );
}
