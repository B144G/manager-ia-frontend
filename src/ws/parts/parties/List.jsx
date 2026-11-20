import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Drawer, Form, Icon, Loaded, useLoad } from '../../ui.jsx';
import { useFile } from '../tms/kit.jsx';
import { LABEL, PT, STATUSES, STATUS_LABEL, SHORT, TYPES, Tags, TypeBadge } from './common.jsx';
import Fiche from './Fiche.jsx';
import ImportDialog from './ImportDialog.jsx';

/* Liste des clients ou des fournisseurs : recherche, filtres par type / statut / étiquette, fiches, création, import et export CSV. */
export function partyFields(t, kind, p, { create = false } = {}) {
  const sup = kind === 'suppliers';
  return [
    { k: 'name', label: sup ? t('Nom du fournisseur') : t('Nom du client'), value: p ? p.name : '', required: true },
    ...(create ? [
      { k: 'type', label: t('Type'), type: 'select', options: TYPES.map((x) => [x, t(LABEL[kind][x])]), value: 'simple' },
      { k: 'validUntil', label: t('Fin de validité (obligatoire pour un temporaire)'), type: 'date', value: '' }] : []),
    ...(sup ? [{ k: 'contactPerson', label: t('Personne à contacter'), value: p ? p.contactPerson : '' }] : []),
    { k: 'phone', label: t('Téléphone'), value: p ? p.phone : '' }, { k: 'email', label: t('E-mail'), value: p ? p.email : '' },
    { k: 'address', label: t('Adresse'), type: 'textarea', rows: 2, value: p ? p.address : '' }, { k: 'city', label: t('Ville'), value: p ? p.city : '' },
    { k: 'taxId', label: t('N° contribuable (NIU)'), value: p ? p.taxId : '' }, { k: 'category', label: sup ? t('Catégorie') : t('Secteur'), value: p ? p.category : '' },
    { k: 'tags', label: t('Étiquettes (séparées par des virgules)'), value: p ? p.tags.join(', ') : '' },
    { k: 'status', label: t('Statut'), type: 'select', options: STATUSES.concat(sup ? ['blocked'] : []).map((x) => [x, t(STATUS_LABEL[x])]), value: p ? p.status : 'active' },
    { k: 'notes', label: t('Notes'), type: 'textarea', rows: 3, value: p ? p.notes : '' },
  ];
}

export default function PartyList({ kind }) {
  const t = useT();
  const { oapi, modal, can, money, dateFr, fail, toast } = useWs();
  const mgr = can('manager');
  const file = useFile();
  const navigate = useNavigate();
  const [f, setF] = useState({ q: '', type: '', status: '', tag: '', expired: false, located: false });
  const [open, setOpen] = useState(null);
  const qs = new URLSearchParams(Object.entries({ q: f.q, type: f.type, status: f.status, tag: f.tag, expired: f.expired ? '1' : '', located: f.located ? '1' : '' }).filter(([, v]) => v)).toString();
  const st = useLoad(async () => ({ list: await oapi('GET', PT + '/' + kind + '?' + qs), types: await oapi('GET', PT + '/types') }), [kind, qs]);
  const reloadRef = useRef(null); reloadRef.current = st.reload;
  const closeFiche = useCallback(() => { setOpen(null); reloadRef.current(); }, []);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const create = () => modal(kind === 'customers' ? t('Nouveau client') : t('Nouveau fournisseur'), (close) => (
    <Form submitText={t('Enregistrer')} fields={partyFields(t, kind, null, { create: true })}
      onSubmit={(v) => oapi('POST', PT + '/' + kind, { ...v, validUntil: v.validUntil || undefined }).then((j) => { close(); st.reload(); setOpen(j.id); })} />
  ), { wide: true });
  const sup = kind === 'suppliers';
  const terms = (p) => [p.terms.discountPct.value !== null ? p.terms.discountPct.value + ' %' : null, p.terms.paymentDays.value !== null ? t('{n} j', { n: p.terms.paymentDays.value }) : null].filter(Boolean).join(' · ') || '—';
  return (
    <div className="pty">
      <div className="pty-bar">
        <label className="sr-only" htmlFor="pty-q">{t('Rechercher')}</label>
        <input id="pty-q" className="grow" type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder={sup ? t('Rechercher un fournisseur (nom, contact, téléphone, ville…)') : t('Rechercher un client (nom, téléphone, adresse, ville…)')} />
        <button type="button" className="ui-btn primary" onClick={create}><Icon name="plus" />{sup ? t('Nouveau fournisseur') : t('Nouveau client')}</button>
        {mgr ? <button type="button" className="ui-btn" onClick={() => file(`${PT}/${kind}/export.csv`, `${kind}.csv`, { download: true })}><Icon name="download" />{t('Exporter (CSV)')}</button> : null}
        {mgr ? <button type="button" className="ui-btn" onClick={() => modal(t('Importer un fichier CSV'), (close) => <ImportDialog kind={kind} close={close} done={st.reload} />, { wide: true })}><Icon name="upload" />{t('Importer (CSV)')}</button> : null}
      </div>
      <Loaded state={st}>{({ list, types }) => {
        const counts = (types.counts[kind]) || {};
        const total = TYPES.reduce((a, x) => a + (counts[x] || 0), 0);
        return (
          <>
            <div className="pty-chips" role="group" aria-label={t('Filtrer par type')}>
              <button type="button" className="pty-chip" aria-pressed={!f.type} onClick={() => set('type', '')}>{t('Tous')} <b>{total}</b></button>
              {TYPES.map((x) => <button key={x} type="button" className="pty-chip" aria-pressed={f.type === x} onClick={() => set('type', f.type === x ? '' : x)}><Icon name={x === 'vip' ? 'star' : x === 'temporary' ? 'clock' : x === 'permanent' ? 'shield' : 'user'} />{t(SHORT[x])} <b>{counts[x] || 0}</b></button>)}
            </div>
            <div className="pty-bar">
              <label className="sr-only" htmlFor="pty-st">{t('Statut')}</label>
              <select id="pty-st" value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="">{t('Actifs et inactifs')}</option>
                {STATUSES.map((x) => <option key={x} value={x}>{t(STATUS_LABEL[x])}</option>)}{sup ? <option value="blocked">{t(STATUS_LABEL.blocked)}</option> : null}
              </select>
              <label className="sr-only" htmlFor="pty-tag">{t('Étiquette')}</label>
              <input id="pty-tag" type="text" value={f.tag} onChange={(e) => set('tag', e.target.value.trim())} placeholder={t('Étiquette')} style={{ maxWidth: 160 }} />
              <label className="geo-chk"><input type="checkbox" checked={f.expired} onChange={(e) => set('expired', e.target.checked)} />{t('Temporaires expirés')}</label>
              <label className="geo-chk"><input type="checkbox" checked={f.located} onChange={(e) => set('located', e.target.checked)} />{t('Localisés sur la carte')}</label>
              {f.expired && mgr && list.total ? <button type="button" className="ui-btn" onClick={() => oapi('POST', PT + '/' + kind + '/revert-expired', {}).then((j) => { toast(t('{n} fiche(s) ramenée(s) à « simple ».', { n: j.reverted })); st.reload(); }).catch(fail)}>{t('Ramener à « simple »')}</button> : null}
            </div>
            <p className="muted small" role="status">{t('{n} résultat(s)', { n: list.total })}</p>
            {!list.items.length ? <p className="ws-empty">{sup ? t("Aucun fournisseur ne correspond. Créez-en un ou importez un fichier CSV.") : t("Aucun client ne correspond. Créez-en un ou importez un fichier CSV.")}</p> : (
              <>
                <div className="ui-table-wrap pty-table" tabIndex={0} role="region" aria-label={sup ? t('Liste des fournisseurs') : t('Liste des clients')}>
                  <table className="ui-table">
                    <thead><tr><th scope="col">{t('Nom')}</th><th scope="col">{t('Type')}</th><th scope="col">{t('Contact')}</th><th scope="col">{t('Ville')}</th><th scope="col">{t('Conditions')}</th><th scope="col">{t('Étiquettes')}</th><th scope="col">{t('Statut')}</th></tr></thead>
                    <tbody>{list.items.map((p) => (
                      <tr key={p.id}>
                        <td><button type="button" className="linkish" onClick={() => setOpen(p.id)}><b>{p.name}</b></button>{p.location ? <Icon name="location-dot" title={t('Adresse géolocalisée')} /> : null}</td>
                        <td><TypeBadge type={p.type} kind={kind} />{p.type === 'temporary' && p.validUntil ? <div className={'small ' + (p.expired ? 'geo-old' : 'muted')}>{p.expired ? t('Expiré le {d}', { d: dateFr(p.validUntil) }) : t("jusqu'au {d}", { d: dateFr(p.validUntil) })}</div> : null}</td>
                        <td>{p.contactPerson ? <div>{p.contactPerson}</div> : null}<div className="muted small">{p.phone}{p.phone && p.email ? ' · ' : ''}{p.email}</div></td>
                        <td>{p.city || '—'}</td><td>{terms(p)}</td><td><Tags tags={p.tags} /></td>
                        <td><span className={'pill ' + (p.status === 'active' ? 'good' : p.status === 'blocked' ? 'bad' : '')}>{t(STATUS_LABEL[p.status] || p.status)}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="pty-cards">{list.items.map((p) => (
                  <button key={p.id} type="button" className="pty-card" onClick={() => setOpen(p.id)}>
                    <header><b>{p.name}</b><TypeBadge type={p.type} kind={kind} /></header>
                    <span className="muted small">{[p.phone, p.city].filter(Boolean).join(' · ') || '—'}</span>
                    <span className="small">{terms(p)}{p.type === 'temporary' && p.validUntil ? ' · ' + (p.expired ? t('Expiré le {d}', { d: dateFr(p.validUntil) }) : t("jusqu'au {d}", { d: dateFr(p.validUntil) })) : ''}</span>
                    <Tags tags={p.tags} />
                  </button>
                ))}</div>
              </>
            )}
          </>
        );
      }}</Loaded>
      {open ? <Drawer title={sup ? t('Fiche fournisseur') : t('Fiche client')} onClose={closeFiche} wide><Fiche kind={kind} id={open} money={money} onChanged={st.reload} navigate={navigate} /></Drawer> : null}
    </div>
  );
}
