import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Pill } from './util.jsx';

const KIND = { offer: ['Offre du client', 'mid'], counter: ['Contre-offre', 'mid'], accept: ['Prix accepté', 'good'], final: ['Dernier prix', 'mid'], refused: ['Refusé par le serveur', 'bad'], order: ['Commande', 'good'], approved: ['Remise validée', 'good'], rejected: ['Remise refusée', 'bad'], confirmed: ['Confirmée', 'good'], cancelled: ['Refusée', 'bad'], override: ['Exception sous le plancher', 'bad'] };

/** Journal de négociation (conversation ou commande) : offres, contre-offres, prix accepté, auteur (client, assistant, équipe). */
export function NegoLog({ entries }) {
  const t = useT();
  const { money, dateFr } = useWs();
  if (!entries || !entries.length) return null;
  return (
    <div style={{ margin: '10px 0' }}>
      <h3>{t('Journal de négociation')}</h3>
      {entries.map((e) => (
        <div className="line" key={e.id}>
          <span><b>{t(e.actorLabel)}</b>{' '}<Pill t={KIND[e.kind] || [e.kind, '']} /><small>{' ' + e.item + (e.price != null ? ' · ' + money(e.price) : '') + (e.quantity > 1 ? ' × ' + e.quantity : '') + (e.discountPct ? ' · −' + e.discountPct + ' %' : '') + (e.note ? ' · ' + e.note : '') + (e.user ? ' · ' + e.user : '')}</small></span>
          <small>{dateFr(String(e.at).slice(0, 10))}</small>
        </div>
      ))}
    </div>
  );
}

/** Onglet « Négociation » : règles de l'assistant (administrateurs) et historique. */
export function Negotiation({ admin }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/negotiation'), []);
  return (
    <Loaded state={st}>{(j) => <Body j={j} admin={admin} reload={st.reload} oapi={oapi} toast={toast} fail={fail} t={t} />}</Loaded>
  );
}

function Body({ j, admin, reload, oapi, toast, fail, t }) {
  const [v, setV] = useState({ enabled: j.settings.enabled, maxCounters: String(j.settings.maxCounters), approvalPct: String(j.settings.approvalPct), handoffMessage: j.settings.handoffMessage });
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const save = (ev) => {
    ev.preventDefault();
    oapi('PUT', '/sales/negotiation/settings', { enabled: v.enabled, maxCounters: Number(v.maxCounters), approvalPct: String(v.approvalPct).replace(',', '.'), handoffMessage: v.handoffMessage }).then(() => { toast(t('Règles enregistrées.')); reload(); }).catch(fail);
  };
  const s = j.stats;
  return (
    <>
      <div className="ws-card">
        <h2>{t("Négociation de l'assistant")}</h2>
        <p className="muted small">{t("Le serveur décide, jamais l'IA : chaque prix annoncé est vérifié, jamais en dessous du plancher de l'article. Pour négocier, un article doit avoir un prix plancher ou une remise maximale (onglet Catalogue).")}</p>
        {admin ? (
          <form className="ws-form" onSubmit={save}>
            <label className="row" htmlFor="ng_on" style={{ gap: 8 }}><input id="ng_on" type="checkbox" checked={v.enabled} onChange={(e) => set('enabled', e.target.checked)} /><span>{t("L'assistant peut négocier les prix (dans les limites du catalogue)")}</span></label>
            <label className="fld" htmlFor="ng_max"><span>{t('Nombre maximum de contre-offres par article')}</span><input id="ng_max" type="number" min="1" max="6" value={v.maxCounters} onChange={(e) => set('maxCounters', e.target.value)} /></label>
            <label className="fld" htmlFor="ng_pct"><span>{t('Remise (en % du prix de liste) au-delà de laquelle un responsable doit valider la commande')}</span><input id="ng_pct" type="text" inputMode="decimal" value={v.approvalPct} onChange={(e) => set('approvalPct', e.target.value)} /></label>
            <label className="fld" htmlFor="ng_msg"><span>{t('Message de passage de relais à un conseiller')}</span><textarea id="ng_msg" rows={3} maxLength={400} placeholder={j.defaultHandoff} value={v.handoffMessage} onChange={(e) => set('handoffMessage', e.target.value)} /><small>{t('Envoyé au client quand un prix demandé dépasse ce que le serveur autorise. Vide : message par défaut.')}</small></label>
            <div className="row"><button className="btn primary" type="submit">{t('Enregistrer')}</button></div>
          </form>
        ) : <p>{j.settings.enabled ? t('Négociation activée') : t('Négociation désactivée')} {'· ' + t('{n} contre-offre(s) au plus · validation au-delà de {pct} %', { n: j.settings.maxCounters, pct: j.settings.approvalPct })}</p>}
      </div>
      <div className="ws-card">
        <h2>{t('Sur 30 jours')}</h2>
        <p>{t('{offers} offre(s) de clients · {counters} contre-offre(s) · {accepted} prix accepté(s) · {refused} refus du serveur · {overrides} exception(s) sous le plancher', { offers: s.offers, counters: s.counters, accepted: s.accepted, refused: s.refused, overrides: s.overrides })}</p>
        {!j.log.length ? <Empty text={t('Aucune négociation pour le moment.')} /> : <NegoLog entries={[...j.log].reverse()} />}
      </div>
    </>
  );
}
