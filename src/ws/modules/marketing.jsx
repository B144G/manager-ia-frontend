import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';

/* Sous-application : Marketing (campagnes liées à l'assistant commercial, dépenses, calendrier de contenu, offres, aide à la rédaction). */

const CHANNELS = [['whatsapp', 'WhatsApp'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['poster', 'Affiche'], ['radio', 'Radio'], ['wordofmouth', 'Bouche-à-oreille'], ['other', 'Autre']];
const CAMP_STATUS = { draft: ['Brouillon', 'mid'], active: ['Active', 'good'], ended: ['Terminée', ''] };
const POST_STATUS = { idea: ['Idée', 'mid'], ready: ['Prête', 'good'], published: ['Publiée', ''] };
const opt = (o) => o.map((x) => [x[0], x[1]]);

export default function Marketing() {
  const { oapi, can, money, dateFr, modal, confirm, fail, askAI, today } = useWs();
  const [tab, setTab] = useState('campaigns');
  const st = useLoad(() => oapi('GET', '/marketing'), []);
  const load = st.reload;
  const mgr = can('manager');
  const del = (path, text) => confirm(text, () => { oapi('DELETE', path).then(load).catch(fail); });

  const editCampaign = (c) => modal(c ? 'Modifier la campagne' : 'Nouvelle campagne', (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'name', label: 'Nom de la campagne', required: true, value: c && c.name, placeholder: 'Rentrée, Fête des mères…' },
        { k: 'channel', label: 'Canal', type: 'select', options: opt(CHANNELS), value: c ? c.channel : 'whatsapp' },
        { k: 'objective', label: 'Objectif', value: c && c.objective, placeholder: 'Vendre 50 pagnes, faire connaître la boutique…' },
        ...(mgr ? [{ k: 'budget', label: 'Budget prévu', value: c && c.budget ? c.budget : '', placeholder: '20000', hint: 'Facultatif. Sert à calculer le coût par prospect et le retour.' }] : []),
        { k: 'startDate', label: 'Début', type: 'date', value: c && c.startDate }, { k: 'endDate', label: 'Fin', type: 'date', value: c && c.endDate },
        { k: 'status', label: 'Statut', type: 'select', options: [['draft', 'Brouillon'], ['active', 'Active'], ['ended', 'Terminée']], value: c ? c.status : 'draft' },
        { k: 'code', label: 'Code de campagne', value: c && c.code, placeholder: 'FB-RENTREE', hint: "Sans espace. Ajoutez-le au lien de l'assistant commercial de cette publicité pour suivre ses résultats." },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, value: c && c.notes },
      ]}
      onSubmit={(v) => oapi(c ? 'PUT' : 'POST', '/marketing/campaigns' + (c ? '/' + c.id : ''), v).then(() => { close(); load(); })}
    />
  ), { wide: true });

  const expenses = (c) => modal('Dépenses : ' + c.name, () => <Expenses c={c} onChange={load} />);

  const editPost = (p) => modal(p ? 'Modifier la publication' : 'Nouvelle publication', (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'date', label: 'Date prévue', type: 'date', required: true, value: p ? p.date : today() },
        { k: 'channel', label: 'Canal', type: 'select', options: opt(CHANNELS), value: p ? p.channel : 'whatsapp' },
        { k: 'text', label: 'Texte', type: 'textarea', rows: 5, required: true, value: p && p.text },
        { k: 'status', label: 'Statut', type: 'select', options: [['idea', 'Idée'], ['ready', 'Prête'], ['published', 'Publiée']], value: p ? p.status : 'idea' },
        { k: 'campaignId', label: 'Campagne', type: 'select', options: [['', 'Aucune']].concat(st.data.campaigns.map((c) => [String(c.id), c.name])), value: p && p.campaignId ? String(p.campaignId) : '' },
      ]}
      onSubmit={(v) => oapi(p ? 'PUT' : 'POST', '/marketing/posts' + (p ? '/' + p.id : ''), { ...v, campaignId: v.campaignId || null }).then(() => { close(); load(); })}
    />
  ), { wide: true });

  const editOffer = (o) => modal(o ? "Modifier l'offre" : 'Nouvelle offre', (close) => (
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'name', label: "Nom de l'offre", required: true, value: o && o.name, placeholder: 'Soldes de fin de mois' },
        { k: 'kind', label: 'Type de remise', type: 'select', options: [['percent', 'Pourcentage (%)'], ['amount', 'Montant fixe']], value: o ? o.kind : 'percent' },
        { k: 'value', label: 'Remise', required: true, value: o && o.value, placeholder: '10', hint: 'Un nombre : 10 pour 10 % ou un montant.' },
        { k: 'startDate', label: 'Début', type: 'date', value: o && o.startDate }, { k: 'endDate', label: 'Fin', type: 'date', value: o && o.endDate },
        { k: 'description', label: 'Conditions', type: 'textarea', rows: 3, value: o && o.description },
      ]}
      onSubmit={(v) => oapi(o ? 'PUT' : 'POST', '/marketing/offers' + (o ? '/' + o.id : ''), v).then(() => { close(); load(); })}
    />
  ));

  // Aide à la rédaction : la question part à l'assistant IA du module (conseil seulement : rien n'est enregistré ni publié).
  const writeHelp = () => modal("Aide à la rédaction (IA)", (close) => (
    <Form
      submitText="Demander à l'IA"
      fields={[
        { k: 'kind', label: 'Que voulez-vous ?', type: 'select', options: [['une publicité courte', 'Une publicité'], ['un message WhatsApp à envoyer à mes clients', 'Un message WhatsApp'], ['une légende de publication avec des idées de hashtags', 'Une légende de publication'], ['un texte pour une affiche ou la radio', 'Un texte affiche / radio']] },
        { k: 'channel', label: 'Canal', type: 'select', options: opt(CHANNELS), value: 'whatsapp' },
        { k: 'what', label: 'Produit ou offre', required: true, placeholder: 'Pagnes wax, -10 % jusqu\'à samedi' },
        { k: 'who', label: 'Public visé', placeholder: 'Femmes de Douala, étudiants…' },
        { k: 'tone', label: 'Ton', type: 'select', options: [['chaleureux', 'Chaleureux'], ['professionnel', 'Professionnel'], ['dynamique', 'Dynamique'], ['humoristique', 'Humoristique']] },
      ]}
      onSubmit={(v) => {
        const ch = CHANNELS.find((x) => x[0] === v.channel)[1];
        askAI('Rédige ' + v.kind + ' pour ' + ch + '. Produit ou offre : ' + v.what + '.' + (v.who ? ' Public visé : ' + v.who + '.' : '') + ' Ton ' + v.tone + ', en français simple, avec un appel à l\'action clair. Si une information manque (prix, adresse, délai), écris [à confirmer] au lieu de l\'inventer. Donne 2 versions.');
        close();
      }}
    />
  ));

  return (
    <>
      <div className="ws-head">
        <div><h1>Marketing</h1><p className="muted">Vos campagnes, leurs résultats, vos publications et vos offres.</p></div>
        <div className="row">
          <button className="btn signal small" type="button" onClick={writeHelp}>Aide à la rédaction</button>
          {tab === 'campaigns' && mgr ? <button className="btn primary small" type="button" onClick={() => editCampaign()}>Nouvelle campagne</button> : null}
          {tab === 'calendar' ? <button className="btn primary small" type="button" onClick={() => editPost()} disabled={!st.data}>Nouvelle publication</button> : null}
          {tab === 'offers' && mgr ? <button className="btn primary small" type="button" onClick={() => editOffer()}>Nouvelle offre</button> : null}
        </div>
      </div>
      <div className="ws-tabs">
        {[['campaigns', 'Campagnes'], ['calendar', 'Calendrier'], ['offers', 'Offres']].map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => setTab(t[0])}>{t[1]}</button>)}
      </div>
      <Loaded state={st}>{(j) => {
        const s = j.summary;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.active)}</b><span>campagne(s) active(s)</span></div>
              <div className="stat"><b>{s.best ? s.best.name : '—'}</b><span>{s.best ? 'meilleure campagne' : 'meilleure campagne (pas encore de résultats)'}</span></div>
              {mgr ? <div className="stat"><b>{money(s.monthSpend)}</b><span>dépensé ce mois</span></div> : null}
              <div className="stat"><b>{String(s.prospectsMonth)}</b><span>prospects générés ce mois</span></div>
            </div>
            {tab === 'campaigns' ? (
              <div className="ws-card">
                <h2>Campagnes</h2>
                {!j.campaigns.length ? <Empty text={mgr ? 'Aucune campagne. Créez-en une et donnez-lui un code : les conversations, prospects et commandes de l\'assistant commercial seront comptés automatiquement.' : "Aucune campagne pour l'instant. Un responsable peut en créer."} /> : null}
                {j.campaigns.map((c) => (
                  <div className="line" key={c.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{c.name}</b> <span className={'pill ' + CAMP_STATUS[c.status][1]}>{CAMP_STATUS[c.status][0]}</span>
                      <small>{' ' + [c.channelLabel, c.code ? 'code ' + c.code : 'sans code (pas de suivi)', c.startDate ? 'du ' + dateFr(c.startDate) : '', c.endDate ? 'au ' + dateFr(c.endDate) : ''].filter(Boolean).join(' · ')}</small>
                      {c.objective ? <small>{' · Objectif : ' + c.objective}</small> : null}
                      <br />
                      <small>{c.chats + ' conversation(s) · ' + c.prospects + ' prospect(s) · ' + c.converted + ' client(s) · ' + c.orders + ' commande(s)'}{mgr ? ' · CA ' + money(c.revenue) : ''}</small>
                      {mgr && (c.budget || c.spent) ? <small><br />{'Budget ' + money(c.budget) + ' · dépensé ' + money(c.spent) + (c.costPerProspect !== null ? ' · ' + money(c.costPerProspect) + ' par prospect' : '') + (c.roi !== null ? ' · retour ' + c.roi + ' %' : '')}</small> : null}
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => editCampaign(c)}>Modifier</button>
                      {mgr ? <button className="link" type="button" onClick={() => expenses(c)}>Dépenses</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => del('/marketing/campaigns/' + c.id, 'Supprimer la campagne « ' + c.name + ' » et ses dépenses ? Les lignes déjà ajoutées au budget restent.')}>Supprimer</button> : null}
                    </span>
                  </div>
                ))}
                {j.unknownCodes.length ? <p className="muted small">{'Codes vus dans les conversations mais sans campagne enregistrée : ' + j.unknownCodes.join(', ') + '.'}</p> : null}
                <p className="muted small">Les résultats viennent de l'assistant commercial : une conversation compte pour une campagne quand son lien contient le code. Le chiffre d'affaires compte les commandes confirmées ou facturées. Le coût par prospect et le retour utilisent les dépenses saisies, sinon le budget.</p>
              </div>
            ) : null}
            {tab === 'calendar' ? (
              <div className="ws-card">
                <h2>Calendrier de contenu</h2>
                {!j.posts.length ? <Empty text="Aucune publication prévue. Notez vos idées de publications avec leur date et leur canal." /> : null}
                {j.posts.map((p) => (
                  <div className="line" key={p.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{dateFr(p.date)}</b> {p.channelLabel} <span className={'pill ' + POST_STATUS[p.status][1]}>{POST_STATUS[p.status][0]}</span>
                      {p.campaign ? <small>{' · ' + p.campaign}</small> : null}
                      <br /><span style={{ whiteSpace: 'pre-wrap' }}>{p.text}</span>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => editPost(p)}>Modifier</button>
                      <button className="link" type="button" onClick={() => del('/marketing/posts/' + p.id, 'Supprimer cette publication ?')}>Supprimer</button>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {tab === 'offers' ? (
              <div className="ws-card">
                <h2>Offres et promotions</h2>
                {!j.offers.length ? <Empty text={mgr ? 'Aucune offre. Ajoutez vos promotions (nom, remise, dates) pour les retrouver facilement.' : 'Aucune offre pour le moment.'} /> : null}
                {j.offers.map((o) => (
                  <div className="line" key={o.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{o.name}</b> {o.expired ? <span className="pill">Terminée</span> : <span className="pill good">En cours</span>}
                      <small>{' · ' + (o.kind === 'percent' ? o.value + ' %' : money(o.value)) + (o.startDate ? ' · du ' + dateFr(o.startDate) : '') + (o.endDate ? ' · au ' + dateFr(o.endDate) : '')}</small>
                      {o.description ? <><br /><small>{o.description}</small></> : null}
                    </span>
                    {mgr ? (
                      <span className="row">
                        <button className="link" type="button" onClick={() => editOffer(o)}>Modifier</button>
                        <button className="link" type="button" onClick={() => del('/marketing/offers/' + o.id, "Supprimer l'offre « " + o.name + ' » ?')}>Supprimer</button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="muted small">L'aide de l'IA propose des textes : relisez-les avant de publier, rien n'est publié ni envoyé automatiquement.</p>
          </>
        );
      }}
      </Loaded>
    </>
  );
}

/** Dépenses d'une campagne ; une dépense n'est ajoutée au budget (sortie « Marketing ») qu'après confirmation. */
function Expenses({ c, onChange }) {
  const { oapi, money, dateFr, today, confirm, fail, toast } = useWs();
  const st = useLoad(() => oapi('GET', '/marketing/campaigns/' + c.id + '/expenses'), []);
  const after = () => { st.reload(); onChange(); };
  const save = (v) => {
    const body = { label: v.label, amount: v.amount, date: v.date, toBudget: v.toBudget === 'yes' };
    const post = () => oapi('POST', '/marketing/campaigns/' + c.id + '/expenses', body).then((r) => { toast(r.inBudget ? 'Dépense enregistrée et ajoutée au budget.' : 'Dépense enregistrée.'); after(); }).catch(fail);
    if (body.toBudget) confirm('Ajouter cette dépense au budget (sortie « Marketing ») ?', post, 'Oui, ajouter au budget');
    else return post();
    return undefined;
  };
  return (
    <>
      <Loaded state={st}>{(j) => (
        <div>
          {!j.expenses.length ? <Empty text="Aucune dépense enregistrée pour cette campagne." /> : null}
          {j.expenses.map((e) => (
            <div className="line" key={e.id}>
              <span><b>{money(e.amount)}</b> <small>{dateFr(e.date) + (e.label ? ' · ' + e.label : '')}</small>{e.inBudget ? <span className="pill good">Au budget</span> : null}</span>
              <button className="link" type="button" onClick={() => confirm('Supprimer cette dépense ?' + (e.inBudget ? ' Sa ligne du budget sera aussi supprimée.' : ''), () => { oapi('DELETE', '/marketing/expenses/' + e.id).then(after).catch(fail); })}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
      </Loaded>
      <h2 style={{ marginTop: 16 }}>Ajouter une dépense</h2>
      <Form
        submitText="Enregistrer la dépense"
        fields={[
          { k: 'label', label: 'Détail', placeholder: 'Publicité Facebook, impression d\'affiches…' },
          { k: 'amount', label: 'Montant', required: true, placeholder: '5000' },
          { k: 'date', label: 'Date', type: 'date', value: today() },
          { k: 'toBudget', label: 'Ajouter aussi au budget ?', type: 'select', options: [['no', 'Non, seulement dans la campagne'], ['yes', 'Oui, comme sortie « Marketing »']] },
        ]}
        onSubmit={save}
      />
    </>
  );
}
