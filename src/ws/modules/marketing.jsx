import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Audience, Broadcasts, Promo } from '../parts/w3/MarketingExtras.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';

/* Sous-application : Marketing (campagnes liées à l'assistant commercial, dépenses, calendrier de contenu, offres, aide à la rédaction). */

const CHANNELS = [['whatsapp', 'WhatsApp'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['poster', 'Affiche'], ['radio', 'Radio'], ['wordofmouth', 'Bouche-à-oreille'], ['other', 'Autre']];
const CAMP_STATUS = { draft: ['Brouillon', 'mid'], active: ['Active', 'good'], ended: ['Terminée', ''] };
const POST_STATUS = { idea: ['Idée', 'mid'], ready: ['Prête', 'good'], published: ['Publiée', ''] };
const opt = (o, t) => o.map((x) => [x[0], t(x[1])]);

export default function Marketing() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, fail, askAI, today } = useWs();
  const [tab, setTab] = useState('campaigns');
  const st = useLoad(() => oapi('GET', '/marketing'), []);
  const load = st.reload;
  const mgr = can('manager');
  const del = (path, text) => confirm(text, () => { oapi('DELETE', path).then(load).catch(fail); });

  const editCampaign = (c) => modal(c ? t('Modifier la campagne') : t('Nouvelle campagne'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'name', label: t('Nom de la campagne'), required: true, value: c && c.name, placeholder: t('Rentrée, Fête des mères…') },
        { k: 'channel', label: t('Canal'), type: 'select', options: opt(CHANNELS, t), value: c ? c.channel : 'whatsapp' },
        { k: 'objective', label: t('Objectif'), value: c && c.objective, placeholder: t('Vendre 50 pagnes, faire connaître la boutique…') },
        ...(mgr ? [{ k: 'budget', label: t('Budget prévu'), value: c && c.budget ? c.budget : '', placeholder: '20000', hint: t('Facultatif. Sert à calculer le coût par prospect et le retour.') }] : []),
        { k: 'startDate', label: t('Début'), type: 'date', value: c && c.startDate }, { k: 'endDate', label: t('Fin'), type: 'date', value: c && c.endDate },
        { k: 'status', label: t('Statut'), type: 'select', options: [['draft', t('Brouillon')], ['active', t('Active')], ['ended', t('Terminée')]], value: c ? c.status : 'draft' },
        { k: 'code', label: t('Code de campagne'), value: c && c.code, placeholder: 'FB-RENTREE', hint: t("Sans espace. Ajoutez-le au lien de l'assistant commercial de cette publicité pour suivre ses résultats.") },
        { k: 'notes', label: t('Notes'), type: 'textarea', rows: 3, value: c && c.notes },
      ]}
      onSubmit={(v) => oapi(c ? 'PUT' : 'POST', '/marketing/campaigns' + (c ? '/' + c.id : ''), v).then(() => { close(); load(); })}
    />
  ), { wide: true });

  const expenses = (c) => modal(t('Dépenses : {name}', { name: c.name }), () => <Expenses c={c} onChange={load} />);

  const editPost = (p) => modal(p ? t('Modifier la publication') : t('Nouvelle publication'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'date', label: t('Date prévue'), type: 'date', required: true, value: p ? p.date : today() },
        { k: 'channel', label: t('Canal'), type: 'select', options: opt(CHANNELS, t), value: p ? p.channel : 'whatsapp' },
        { k: 'text', label: t('Texte'), type: 'textarea', rows: 5, required: true, value: p && p.text },
        { k: 'status', label: t('Statut'), type: 'select', options: [['idea', t('Idée')], ['ready', t('Prête')], ['published', t('Publiée')]], value: p ? p.status : 'idea' },
        { k: 'campaignId', label: t('Campagne'), type: 'select', options: [['', t('Aucune')]].concat(st.data.campaigns.map((c) => [String(c.id), c.name])), value: p && p.campaignId ? String(p.campaignId) : '' },
      ]}
      onSubmit={(v) => oapi(p ? 'PUT' : 'POST', '/marketing/posts' + (p ? '/' + p.id : ''), { ...v, campaignId: v.campaignId || null }).then(() => { close(); load(); })}
    />
  ), { wide: true });

  const editOffer = (o) => modal(o ? t("Modifier l'offre") : t('Nouvelle offre'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'name', label: t("Nom de l'offre"), required: true, value: o && o.name, placeholder: t('Soldes de fin de mois') },
        { k: 'kind', label: t('Type de remise'), type: 'select', options: [['percent', t('Pourcentage (%)')], ['amount', t('Montant fixe')]], value: o ? o.kind : 'percent' },
        { k: 'value', label: t('Remise'), required: true, value: o && o.value, placeholder: '10', hint: t('Un nombre : 10 pour 10 % ou un montant.') },
        { k: 'startDate', label: t('Début'), type: 'date', value: o && o.startDate }, { k: 'endDate', label: t('Fin'), type: 'date', value: o && o.endDate },
        { k: 'description', label: t('Conditions'), type: 'textarea', rows: 3, value: o && o.description },
      ]}
      onSubmit={(v) => oapi(o ? 'PUT' : 'POST', '/marketing/offers' + (o ? '/' + o.id : ''), v).then(() => { close(); load(); })}
    />
  ));

  // Aide à la rédaction : la question part à l'assistant IA du module (conseil seulement : rien n'est enregistré ni publié).
  const writeHelp = () => modal(t('Aide à la rédaction (IA)'), (close) => (
    <Form
      submitText={t("Demander à l'IA")}
      fields={[
        { k: 'kind', label: t('Que voulez-vous ?'), type: 'select', options: [['une publicité courte', t('Une publicité')], ['un message WhatsApp à envoyer à mes clients', t('Un message WhatsApp')], ['une légende de publication avec des idées de hashtags', t('Une légende de publication')], ['un texte pour une affiche ou la radio', t('Un texte affiche / radio')]] },
        { k: 'channel', label: t('Canal'), type: 'select', options: opt(CHANNELS, t), value: 'whatsapp' },
        { k: 'what', label: t('Produit ou offre'), required: true, placeholder: t("Pagnes wax, -10 % jusqu'à samedi") },
        { k: 'who', label: t('Public visé'), placeholder: t('Femmes de Douala, étudiants…') },
        { k: 'tone', label: t('Ton'), type: 'select', options: [['chaleureux', t('Chaleureux')], ['professionnel', t('Professionnel')], ['dynamique', t('Dynamique')], ['humoristique', t('Humoristique')]] },
      ]}
      onSubmit={(v) => {
        const ch = t(CHANNELS.find((x) => x[0] === v.channel)[1]);
        askAI(t('Rédige {kind} pour {channel}. Produit ou offre : {what}.', { kind: t(v.kind), channel: ch, what: v.what }) + (v.who ? ' ' + t('Public visé : {who}.', { who: v.who }) : '') + ' ' + t("Ton {tone}, en français simple, avec un appel à l'action clair. Si une information manque (prix, adresse, délai), écris [à confirmer] au lieu de l'inventer. Donne 2 versions.", { tone: t(v.tone) }));
        close();
      }}
    />
  ));

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Marketing')}</h1><p className="muted">{t('Vos campagnes, leurs résultats, vos publications et vos offres.')}</p></div>
        <div className="row">
          <button className="btn signal small" type="button" onClick={writeHelp}>{t('Aide à la rédaction')}</button>
          {tab === 'campaigns' && mgr ? <button className="btn primary small" type="button" onClick={() => editCampaign()}>{t('Nouvelle campagne')}</button> : null}
          {tab === 'calendar' ? <button className="btn primary small" type="button" onClick={() => editPost()} disabled={!st.data}>{t('Nouvelle publication')}</button> : null}
          {tab === 'offers' && mgr ? <button className="btn primary small" type="button" onClick={() => editOffer()}>{t('Nouvelle offre')}</button> : null}
        </div>
      </div>
      <div className="ws-tabs">
        {[['campaigns', 'Campagnes'], ['calendar', 'Calendrier'], ['offers', 'Offres'], ...(mgr ? [['audience', 'Audience et consentement'], ['broadcasts', 'Envois groupés'], ['promo', 'Codes promo']] : [])].map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => setTab(x[0])}>{t(x[1])}</button>)}
      </div>
      {tab === 'audience' ? <Audience /> : null}
      {tab === 'broadcasts' ? <Broadcasts /> : null}
      {tab === 'promo' ? <Promo /> : null}
      {['audience', 'broadcasts', 'promo'].includes(tab) ? null : <Loaded state={st}>{(j) => {
        const s = j.summary;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.active)}</b><span>{t('campagne(s) active(s)')}</span></div>
              <div className="stat"><b>{s.best ? s.best.name : '—'}</b><span>{s.best ? t('meilleure campagne') : t('meilleure campagne (pas encore de résultats)')}</span></div>
              {mgr ? <div className="stat"><b>{money(s.monthSpend)}</b><span>{t('dépensé ce mois')}</span></div> : null}
              <div className="stat"><b>{String(s.prospectsMonth)}</b><span>{t('prospects générés ce mois')}</span></div>
            </div>
            {tab === 'campaigns' ? (
              <div className="ws-card">
                <h2>{t('Campagnes')}</h2>
                {!j.campaigns.length ? <Empty text={mgr ? t("Aucune campagne. Créez-en une et donnez-lui un code : les conversations, prospects et commandes de l'assistant commercial seront comptés automatiquement.") : t("Aucune campagne pour l'instant. Un responsable peut en créer.")} /> : null}
                {j.campaigns.map((c) => (
                  <div className="line" key={c.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{c.name}</b> <span className={'pill ' + CAMP_STATUS[c.status][1]}>{t(CAMP_STATUS[c.status][0])}</span>
                      <small>{' ' + [t(c.channelLabel), c.code ? t('code {code}', { code: c.code }) : t('sans code (pas de suivi)'), c.startDate ? t('du {date}', { date: dateFr(c.startDate) }) : '', c.endDate ? t('au {date}', { date: dateFr(c.endDate) }) : ''].filter(Boolean).join(' · ')}</small>
                      {c.objective ? <small>{' · ' + t('Objectif : {text}', { text: c.objective })}</small> : null}
                      <br />
                      <small>{t('{chats} conversation(s) · {prospects} prospect(s) · {clients} client(s) · {orders} commande(s)', { chats: c.chats, prospects: c.prospects, clients: c.converted, orders: c.orders })}{mgr ? ' · ' + t('CA {amount}', { amount: money(c.revenue) }) : ''}</small>
                      {mgr && (c.budget || c.spent) ? <small><br />{t('Budget {budget} · dépensé {spent}', { budget: money(c.budget), spent: money(c.spent) }) + (c.costPerProspect !== null ? ' · ' + t('{amount} par prospect', { amount: money(c.costPerProspect) }) : '') + (c.roi !== null ? ' · ' + t('retour {n} %', { n: c.roi }) : '')}</small> : null}
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => editCampaign(c)}>{t('Modifier')}</button>
                      {mgr ? <button className="link" type="button" onClick={() => expenses(c)}>{t('Dépenses')}</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => del('/marketing/campaigns/' + c.id, t('Supprimer la campagne « {name} » et ses dépenses ? Les lignes déjà ajoutées au budget restent.', { name: c.name }))}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
                {j.unknownCodes.length ? <p className="muted small">{t('Codes vus dans les conversations mais sans campagne enregistrée : {list}.', { list: j.unknownCodes.join(', ') })}</p> : null}
                <p className="muted small">{t("Les résultats viennent de l'assistant commercial : une conversation compte pour une campagne quand son lien contient le code. Le chiffre d'affaires compte les commandes confirmées ou facturées. Le coût par prospect et le retour utilisent les dépenses saisies, sinon le budget.")}</p>
              </div>
            ) : null}
            {tab === 'calendar' ? (
              <div className="ws-card">
                <h2>{t('Calendrier de contenu')}</h2>
                {!j.posts.length ? <Empty text={t('Aucune publication prévue. Notez vos idées de publications avec leur date et leur canal.')} /> : null}
                {j.posts.map((p) => (
                  <div className="line" key={p.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{dateFr(p.date)}</b> {t(p.channelLabel)} <span className={'pill ' + POST_STATUS[p.status][1]}>{t(POST_STATUS[p.status][0])}</span>
                      {p.campaign ? <small>{' · ' + p.campaign}</small> : null}
                      <br /><span style={{ whiteSpace: 'pre-wrap' }}>{p.text}</span>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => editPost(p)}>{t('Modifier')}</button>
                      <button className="link" type="button" onClick={() => del('/marketing/posts/' + p.id, t('Supprimer cette publication ?'))}>{t('Supprimer')}</button>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {tab === 'offers' ? (
              <div className="ws-card">
                <h2>{t('Offres et promotions')}</h2>
                {!j.offers.length ? <Empty text={mgr ? t('Aucune offre. Ajoutez vos promotions (nom, remise, dates) pour les retrouver facilement.') : t('Aucune offre pour le moment.')} /> : null}
                {j.offers.map((o) => (
                  <div className="line" key={o.id} style={{ flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 220px' }}>
                      <b>{o.name}</b> {o.expired ? <span className="pill">{t('Terminée')}</span> : <span className="pill good">{t('En cours')}</span>}
                      <small>{' · ' + (o.kind === 'percent' ? o.value + ' %' : money(o.value)) + (o.startDate ? ' · ' + t('du {date}', { date: dateFr(o.startDate) }) : '') + (o.endDate ? ' · ' + t('au {date}', { date: dateFr(o.endDate) }) : '')}</small>
                      {o.description ? <><br /><small>{o.description}</small></> : null}
                    </span>
                    {mgr ? (
                      <span className="row">
                        <button className="link" type="button" onClick={() => editOffer(o)}>{t('Modifier')}</button>
                        <button className="link" type="button" onClick={() => del('/marketing/offers/' + o.id, t("Supprimer l'offre « {name} » ?", { name: o.name }))}>{t('Supprimer')}</button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="muted small">{t("L'aide de l'IA propose des textes : relisez-les avant de publier, rien n'est publié ni envoyé automatiquement.")}</p>
          </>
        );
      }}
      </Loaded>}
    </>
  );
}

/** Dépenses d'une campagne ; une dépense n'est ajoutée au budget (sortie « Marketing ») qu'après confirmation. */
function Expenses({ c, onChange }) {
  const t = useT();
  const { oapi, money, dateFr, today, confirm, fail, toast } = useWs();
  const st = useLoad(() => oapi('GET', '/marketing/campaigns/' + c.id + '/expenses'), []);
  const after = () => { st.reload(); onChange(); };
  const save = (v) => {
    const body = { label: v.label, amount: v.amount, date: v.date, toBudget: v.toBudget === 'yes' };
    const post = () => oapi('POST', '/marketing/campaigns/' + c.id + '/expenses', body).then((r) => { toast(r.inBudget ? t('Dépense enregistrée et ajoutée au budget.') : t('Dépense enregistrée.')); after(); }).catch(fail);
    if (body.toBudget) confirm(t('Ajouter cette dépense au budget (sortie « Marketing ») ?'), post, t('Oui, ajouter au budget'));
    else return post();
    return undefined;
  };
  return (
    <>
      <Loaded state={st}>{(j) => (
        <div>
          {!j.expenses.length ? <Empty text={t('Aucune dépense enregistrée pour cette campagne.')} /> : null}
          {j.expenses.map((e) => (
            <div className="line" key={e.id}>
              <span><b>{money(e.amount)}</b> <small>{dateFr(e.date) + (e.label ? ' · ' + e.label : '')}</small>{e.inBudget ? <span className="pill good">{t('Au budget')}</span> : null}</span>
              <button className="link" type="button" onClick={() => confirm(e.inBudget ? t('Supprimer cette dépense ? Sa ligne du budget sera aussi supprimée.') : t('Supprimer cette dépense ?'), () => { oapi('DELETE', '/marketing/expenses/' + e.id).then(after).catch(fail); })}>{t('Supprimer')}</button>
            </div>
          ))}
        </div>
      )}
      </Loaded>
      <h2 style={{ marginTop: 16 }}>{t('Ajouter une dépense')}</h2>
      <Form
        submitText={t("Enregistrer la dépense")}
        fields={[
          { k: 'label', label: t('Détail'), placeholder: t("Publicité Facebook, impression d'affiches…") },
          { k: 'amount', label: t('Montant'), required: true, placeholder: '5000' },
          { k: 'date', label: t('Date'), type: 'date', value: today() },
          { k: 'toBudget', label: t('Ajouter aussi au budget ?'), type: 'select', options: [['no', t('Non, seulement dans la campagne')], ['yes', t('Oui, comme sortie « Marketing »')]] },
        ]}
        onSubmit={save}
      />
    </>
  );
}
