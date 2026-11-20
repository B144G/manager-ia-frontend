import { Suspense, lazy, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Form, Icon, Loaded, Loading, Tabs, useLoad } from '../../ui.jsx';
import { AddressSearch, TG } from '../geo/common.jsx';
import { LABEL, PT, STATUS_LABEL, TYPES, Tags, TypeBadge } from './common.jsx';
import { partyFields } from './List.jsx';

const GeoMap = lazy(() => import('../geo/GeoMap.jsx'));
void TG;

/* Fiche d'un client ou d'un fournisseur : coordonnées, adresse géolocalisable, conditions (propres ou du type), historique des changements de type,
   notes datées, liens avec les autres modules (lectures : rien n'est copié). */
const ORIGIN = { own: 'propre à la fiche', type: 'du type', legacy: 'ancien champ' };

function TypeForm({ kind, p, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form submitText={t('Changer le type')}
      fields={[
        { k: 'type', label: t('Nouveau type'), type: 'select', options: TYPES.map((x) => [x, t(LABEL[kind][x])]), value: p.type },
        { k: 'validUntil', label: t('Fin de validité (obligatoire pour un temporaire)'), type: 'date', value: p.validUntil || '' },
        { k: 'reason', label: t('Motif (conservé dans l\'historique)'), type: 'textarea', rows: 2 },
      ]}
      onSubmit={(v) => oapi('POST', PT + '/' + kind + '/' + p.id + '/type', { type: v.type, validUntil: v.validUntil || undefined, reason: v.reason }).then(() => { close(); done(); })} />
  );
}

export default function Fiche({ kind, id, money, onChanged, navigate }) {
  const t = useT();
  const { oapi, modal, confirm, can, toast, fail, dateFr, orgId } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('info');
  const [pick, setPick] = useState(false);
  const st = useLoad(() => oapi('GET', PT + '/' + kind + '/' + id), [kind, id]);
  const done = () => { st.reload(); onChanged(); };
  const sup = kind === 'suppliers';
  return (
    <Loaded state={st}>{({ party: p }) => {
      const setLoc = (q) => oapi('POST', PT + '/' + kind + '/' + p.id + '/location', { lat: q.lat, lng: q.lng, source: q.source === 'address' ? 'address' : 'pin', ...(q.label ? { address: q.label.slice(0, 280) } : {}) }).then(() => { setPick(false); toast(t('Position enregistrée.')); done(); }).catch(fail);
      const term = (k, label, fmt) => { const x = p.terms[k]; return <div className="pty-term" key={k}><span>{label}</span><b>{x.value === null ? '—' : fmt(x.value)}</b><small>{x.from ? t(ORIGIN[x.from]) : t('non renseigné')}</small></div>; };
      return (
        <div className="pty-fiche">
          <header>
            <h3 style={{ margin: 0 }}>{p.name} <TypeBadge type={p.type} kind={kind} /></h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>{t(LABEL[kind][p.type])}{p.type === 'temporary' && p.validUntil ? ' · ' + (p.expired ? t('Expiré le {d}', { d: dateFr(p.validUntil) }) : t("jusqu'au {d}", { d: dateFr(p.validUntil) })) : ''} · <span className={'pill ' + (p.status === 'active' ? 'good' : p.status === 'blocked' ? 'bad' : '')}>{t(STATUS_LABEL[p.status] || p.status)}</span></p>
            {p.expired ? <Alert tone="warn">{t('La date de fin est dépassée : changez le type ou prolongez la validité.')}</Alert> : null}
          </header>
          <Tabs value={tab} onChange={setTab} label={t('Sections de la fiche')} items={[{ id: 'info', label: t('Fiche') }, { id: 'terms', label: t('Conditions') }, { id: 'history', label: t('Historique'), count: p.history.length }, { id: 'notes', label: t('Notes'), count: p.notes.length }, { id: 'links', label: t('Liens') }]} />
          {tab === 'info' ? (
            <>
              <div className="pty-grid">
                {[[t('Téléphone'), p.phone], [t('E-mail'), p.email], ...(sup ? [[t('Contact'), p.contactPerson]] : []), [t('Adresse'), p.address], [t('Ville'), p.city], [t('N° contribuable (NIU)'), p.taxId], [sup ? t('Catégorie') : t('Secteur'), p.category]].map(([l, v]) => <div className="pty-term" key={l}><span>{l}</span><b style={{ fontSize: 'var(--fs-base)' }}>{v || '—'}</b></div>)}
              </div>
              <div className="row"><Tags tags={p.tags} /></div>
              {p.notes ? <p>{p.notes.length ? '' : ''}</p> : null}
              <div className="row">
                <button type="button" className="ui-btn primary" onClick={() => modal(t('Modifier la fiche'), (close) => <Form submitText={t('Enregistrer')} fields={partyFields(t, kind, p)} onSubmit={(v) => oapi('PUT', PT + '/' + kind + '/' + p.id, v).then(() => { close(); done(); })} />, { wide: true })}><Icon name="pen" />{t('Modifier')}</button>
                {mgr ? <button type="button" className="ui-btn" onClick={() => modal(t('Changer le type'), (close) => <TypeForm kind={kind} p={p} close={close} done={done} />)}><Icon name="shuffle" />{t('Changer le type')}</button> : null}
              </div>
              <h4 style={{ margin: 'var(--sp-3) 0 0' }}>{t('Adresse géolocalisable')}</h4>
              <Suspense fallback={<Loading />}><GeoMap client={p.location} onPick={pick ? (la, ln) => setLoc({ lat: la, lng: ln, source: 'pin' }) : null} height={260} ariaLabel={t('Carte : position de la fiche')} /></Suspense>
              <div className="row">
                <button type="button" className={'ui-btn' + (pick ? ' primary' : '')} aria-pressed={pick} onClick={() => setPick(!pick)}><Icon name="map" />{pick ? t('Cliquez sur la carte…') : t('Poser le point sur la carte')}</button>
                {p.location ? <button type="button" className="ui-btn" onClick={() => confirm(t('Retirer la position de cette fiche ?'), () => oapi('POST', PT + '/' + kind + '/' + p.id + '/location', { lat: null, lng: null }).then(done).catch(fail), t('Retirer'))}>{t('Retirer la position')}</button> : null}
              </div>
              <AddressSearch initial={p.address} onPick={setLoc} gps />
            </>
          ) : null}
          {tab === 'terms' ? (
            <>
              <p className="muted">{t('Conditions appliquées : celles de la fiche, sinon celles du type « {type} » (réglées dans Conditions par type).', { type: t(LABEL[kind][p.type]) })}</p>
              <div className="pty-grid">
                {term('discountPct', t('Remise'), (v) => v + ' %')}{term('paymentDays', t('Délai de paiement'), (v) => t('{n} jours', { n: v }))}{term('deliveryDays', t('Délai de livraison'), (v) => t('{n} jours', { n: v }))}{term('creditLimit', t('Plafond de crédit'), (v) => money(v))}
              </div>
              <div className="row">
                <button type="button" className="ui-btn" onClick={() => modal(t('Conditions propres à cette fiche'), (close) => (
                  <Form submitText={t('Enregistrer')} fields={[
                    { k: 'discountPct', label: t('Remise (%)'), value: p.own.discountPct ?? '', hint: t('Vide : on reprend la condition du type.') },
                    { k: 'paymentDays', label: t('Délai de paiement (jours)'), value: p.own.paymentDays ?? '' }, { k: 'deliveryDays', label: t('Délai de livraison (jours)'), value: p.own.deliveryDays ?? '' }, { k: 'creditLimit', label: t('Plafond de crédit'), value: p.own.creditLimit ?? '' },
                  ]} onSubmit={(v) => oapi('PUT', PT + '/' + kind + '/' + p.id, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : x]))).then(() => { close(); done(); })} />
                ))}><Icon name="pen" />{t('Modifier les conditions')}</button>
                {mgr ? <button type="button" className="ui-btn" onClick={() => oapi('POST', PT + '/' + kind + '/' + p.id + '/apply-terms', {}).then((j) => { toast(j.applied.defaultDiscount !== undefined ? t('Remise par défaut de la facturation : {n} %.', { n: j.applied.defaultDiscount }) : t('Délai de paiement des achats : {n} jours.', { n: j.applied.paymentDays })); done(); }).catch(fail)}><Icon name="check" />{sup ? t('Appliquer le délai aux achats') : t('Appliquer la remise à la facturation')}</button> : null}
              </div>
              <small className="muted">{sup ? t("Le bouton reporte le délai de paiement dans la fiche fournisseur utilisée par les Achats.") : t('Le bouton reporte la remise dans la remise par défaut du client, utilisée pour les devis et factures.')}</small>
            </>
          ) : null}
          {tab === 'history' ? (
            <ul className="pty-hist" aria-label={t('Historique des changements de type')}>
              {p.history.map((h) => <li key={h.id}><b>{h.from ? t(LABEL[kind][h.from]) + ' → ' : ''}{t(LABEL[kind][h.to])}</b>{h.validUntil ? ' · ' + t("jusqu'au {d}", { d: dateFr(h.validUntil) }) : ''}<div className="muted small">{dateFr(h.at.slice(0, 10))} · {h.author || '—'}{h.reason ? ' · ' + h.reason : ''}</div></li>)}
            </ul>
          ) : null}
          {tab === 'notes' ? (
            <>
              <Form submitText={t('Ajouter la note')} fields={[{ k: 'body', label: t('Nouvelle note'), type: 'textarea', rows: 3, required: true }]} onSubmit={(v) => oapi('POST', PT + '/' + kind + '/' + p.id + '/notes', v).then(() => { done(); })} />
              <ul className="pty-hist">{p.notes.map((n) => <li key={n.id}>{n.body}<div className="muted small">{dateFr(n.at.slice(0, 10))} · {n.author}</div></li>)}</ul>
            </>
          ) : null}
          {tab === 'links' ? (
            <div className="pty-grid">
              {kind === 'customers' ? (
                <>
                  <div className="pty-term"><span>{t('Factures')}</span><b>{p.links.crm.invoices}</b><small>{t('{n} devis · reste dû {m}', { n: p.links.crm.quotes, m: money(p.links.crm.owed) })}</small><button type="button" className="ui-btn sm" onClick={() => navigate('/app/' + orgId + '/crm')}>{t('Ouvrir Clients et ventes')}</button></div>
                  <div className="pty-term"><span>{t('Commercial')}</span><b>{p.links.commercial.opportunities}</b><small>{t('{n} opportunité(s) · {c} contact(s)', { n: p.links.commercial.opportunities, c: p.links.commercial.contacts })}</small><button type="button" className="ui-btn sm" onClick={() => navigate('/app/' + orgId + '/commercial')}>{t('Ouvrir Commercial')}</button></div>
                  <div className="pty-term"><span>{t('Livraisons')}</span><b>{p.links.transport.deliveries}</b><small>{t('au nom de ce client')}</small><button type="button" className="ui-btn sm" onClick={() => navigate('/app/' + orgId + '/logistics')}>{t('Ouvrir Transport')}</button></div>
                </>
              ) : (
                <>
                  <div className="pty-term"><span>{t('Commandes d\'achat')}</span><b>{p.links.purchasing.orders}</b><small>{t('{n} facture(s) fournisseur', { n: p.links.purchasing.invoices })}</small><button type="button" className="ui-btn sm" onClick={() => navigate('/app/' + orgId + '/purchasing')}>{t('Ouvrir Achats')}</button></div>
                  <div className="pty-term"><span>{t('Trésorerie')}</span><b>{p.links.treasury ? p.links.treasury.discountPct + ' %' : '—'}</b><small>{p.links.treasury ? t('escompte si payé en {n} jours', { n: p.links.treasury.discountDays }) : t('aucune condition d\'escompte')}</small><button type="button" className="ui-btn sm" onClick={() => navigate('/app/' + orgId + '/treasury')}>{t('Ouvrir Trésorerie')}</button></div>
                </>
              )}
            </div>
          ) : null}
        </div>
      );
    }}</Loaded>
  );
}
