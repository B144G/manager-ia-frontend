import { useMemo, useState } from 'react';
import { rq } from '../../../lib/api.js';
import { Icon } from '../../../lib/fa.jsx';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, EmptyState } from '../../ui/index.jsx';
import { Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { useOrgActions } from './OrgActions.jsx';
import '../../../privacy/icons.js';

/* Organisations : le tableau de toutes les organisations de la personne et de son entreprise. Chaque action n'apparaît que si la personne y a droit (le serveur la contrôle aussi). */
const ROLE = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Responsable', member: 'Membre' };
const day = (iso, loc) => { try { return new Date(iso).toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };
const pct = (u, m) => (m ? Math.min(100, Math.round((u / m) * 100)) : 0);

function Use({ used, max, label }) {
  const p = pct(used, max);
  if (max >= 999) return <div className="og-use"><span>{used.toLocaleString()} <small className="muted">/ ∞</small></span></div>;
  return <div className="og-use"><span>{used.toLocaleString()} / {max.toLocaleString()}</span><div className="og-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={used}><i className={p >= 100 ? 'full' : p >= 80 ? 'warn' : ''} style={{ width: p + '%' }} /></div></div>;
}

export default function Orgs() {
  const t = useT();
  const { orgId, loadOrg } = useWs();
  const lang = getLocale();
  const st = useLoad(() => rq('GET', '/api/ws/organisations'), []);
  const { transfer, remove } = useOrgActions(() => st.reload());
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const [role, setRole] = useState('');
  const [sort, setSort] = useState({ key: 'created', dir: 'asc' });
  const rows = useMemo(() => {
    const all = (st.data && st.data.orgs) || [];
    const n = q.trim().toLowerCase();
    const f = all.filter((o) => (!n || (o.name + ' ' + o.sector + ' ' + (o.company ? o.company.name : '')).toLowerCase().includes(n)) && (!type || o.type === type) && (!role || (role === 'none' ? !o.myRole : o.myRole === role)));
    const val = { name: (o) => o.name.toLowerCase(), sector: (o) => o.sector.toLowerCase(), type: (o) => o.type, role: (o) => o.myRole || '', members: (o) => o.members, branches: (o) => o.branches, plan: (o) => o.planLabel, created: (o) => o.createdAt, state: (o) => o.state }[sort.key];
    return [...f].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1));
  }, [st.data, q, type, role, sort]);
  const open = (o) => { if (o.canOpen && o.id !== orgId) loadOrg(o.id, 'entreprise'); };
  const th = (key, label) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>{label}<Icon name={sort.key === key ? (sort.dir === 'asc' ? 'pv-sort-up' : 'pv-sort-down') : 'pv-sort'} /></button>
    </th>
  );
  const actions = (o) => (o.canTransfer || o.canDelete) ? (
    <div className="og-act" onClick={(e) => e.stopPropagation()}>
      {o.canTransfer ? <Button size="sm" icon="pv-swap" onClick={() => transfer(o)} aria-label={t('Transférer la propriété de {name}', { name: o.name })}>{t('Transférer')}</Button> : null}
      {o.canDelete ? <Button size="sm" variant="danger-outline" icon="pv-trash" onClick={() => remove(o)} aria-label={t('Supprimer {name}', { name: o.name })}>{t('Supprimer')}</Button> : null}
    </div>
  ) : null;
  return (
    <Card title={t('Organisations')} subtitle={t('Toutes les organisations de votre entreprise et celles dont vous faites partie. Cliquez sur une ligne pour l’ouvrir.')}>
      <Loaded state={st}>{(j) => (
        <div className="og">
          <div className="og-bar">
            <label className="og-search"><span className="sr-only">{t('Rechercher une organisation')}</span><Icon name="pv-search" /><input type="search" value={q} placeholder={t('Rechercher par nom ou secteur')} onChange={(e) => setQ(e.target.value)} /></label>
            <select aria-label={t('Filtrer par type')} value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Tous les types')}</option><option value="main">{t('Principale')}</option><option value="linked">{t('Liée')}</option></select>
            <select aria-label={t('Filtrer par rôle')} value={role} onChange={(e) => setRole(e.target.value)}><option value="">{t('Tous mes rôles')}</option>{Object.keys(ROLE).map((r) => <option key={r} value={r}>{t(ROLE[r])}</option>)}<option value="none">{t('Non membre')}</option></select>
            <span className="og-count" role="status">{t('{n} organisation(s)', { n: rows.length })}</span>
          </div>
          {!rows.length ? <EmptyState icon="inbox" title={j.orgs.length ? t('Aucune organisation ne correspond') : t('Aucune organisation')}>{j.orgs.length ? t('Changez la recherche ou les filtres.') : t('Créez ou rejoignez une organisation pour la voir ici.')}</EmptyState> : (
            <>
              <div className="og-wrap">
                <table className="og-t">
                  <caption className="sr-only">{t('Organisations')}</caption>
                  <thead><tr>{th('name', t('Organisation'))}{th('type', t('Type'))}{th('role', t('Mon rôle'))}{th('members', t('Personnes'))}{th('branches', t('Antennes'))}{th('plan', t('Offre'))}{th('created', t('Créée le'))}{th('state', t('État'))}<th scope="col"><span className="sr-only">{t('Actions')}</span></th></tr></thead>
                  <tbody>{rows.map((o) => (
                    <tr key={o.id} className={(o.canOpen ? 'go ' : '') + (o.id === orgId ? 'cur' : '')} onClick={() => open(o)}>
                      <td><div className="og-name">{o.canOpen ? <a href={'/app/' + o.id + '/entreprise'} onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(o); }} aria-current={o.id === orgId ? 'true' : undefined}>{o.name}</a> : <b>{o.name}</b>}{o.sector ? <small>{o.sector}</small> : null}</div></td>
                      <td><Badge tone={o.type === 'main' ? 'brand' : 'info'}>{o.type === 'main' ? t('Principale') : t('Liée')}</Badge></td>
                      <td>{o.myRole ? t(ROLE[o.myRole]) : <span className="muted">{t('Non membre')}</span>}</td>
                      <td><Use used={o.members} max={o.membersMax} label={t('Personnes')} /></td>
                      <td><Use used={o.branches} max={o.branchesMax} label={t('Antennes')} /></td>
                      <td>{tsrv(o.planLabel)}</td>
                      <td>{day(o.createdAt, lang)}</td>
                      <td><Badge tone={o.state === 'limit' ? 'warn' : 'ok'} dot>{o.state === 'limit' ? t('Limite atteinte') : t('Active')}</Badge></td>
                      <td>{actions(o)}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              <div className="og-cards">
                {rows.map((o) => (
                  <article className="og-card" key={o.id}>
                    <div className="og-name">{o.canOpen ? <a href={'/app/' + o.id + '/entreprise'} onClick={(e) => { e.preventDefault(); open(o); }}>{o.name}</a> : <b>{o.name}</b>}{o.sector ? <small>{o.sector}</small> : null}</div>
                    <div><Badge tone={o.type === 'main' ? 'brand' : 'info'}>{o.type === 'main' ? t('Principale') : t('Liée')}</Badge> <Badge tone={o.state === 'limit' ? 'warn' : 'ok'} dot>{o.state === 'limit' ? t('Limite atteinte') : t('Active')}</Badge></div>
                    <dl>
                      <dt>{t('Mon rôle')}</dt><dd>{o.myRole ? t(ROLE[o.myRole]) : t('Non membre')}</dd>
                      <dt>{t('Personnes')}</dt><dd>{o.members}{o.membersMax >= 999 ? ' / ∞' : ' / ' + o.membersMax}</dd>
                      <dt>{t('Antennes')}</dt><dd>{o.branches}{o.branchesMax >= 999 ? ' / ∞' : ' / ' + o.branchesMax}</dd>
                      <dt>{t('Offre')}</dt><dd>{tsrv(o.planLabel)}</dd>
                      <dt>{t('Créée le')}</dt><dd>{day(o.createdAt, lang)}</dd>
                    </dl>
                    {actions(o)}
                  </article>))}
              </div>
            </>
          )}
          <p className="muted small">{t('Les actions de transfert et de suppression ne sont proposées qu’au propriétaire de chaque organisation.')}</p>
        </div>
      )}</Loaded>
    </Card>
  );
}
