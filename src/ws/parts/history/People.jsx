import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, EmptyState, Icon } from '../../ui/index.jsx';
import { Pic, frDate, initials, stateIn, useLabels } from './util.jsx';

/* Liste des personnes (fiches simples ou reliées au module Ressources humaines). */

export default function People({ H }) {
  const t = useT();
  const L = useLabels();
  const [q, setQ] = useState('');
  const [onlyNow, setOnlyNow] = useState(false);
  const now = new Date().getFullYear();
  const list = H.people.filter((p) => (!q || (p.name + ' ' + p.title).toLowerCase().includes(q.toLowerCase())) && (!onlyNow || stateIn(p, now) === 'active'));
  const parent = (p) => (H.people.find((x) => x.id === p.parentId) || {}).name || '';
  return (
    <>
      <div className="hst-bar">
        <input type="search" className="grow" aria-label={t('Rechercher une personne')} placeholder={t('Rechercher une personne…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlyNow} onChange={(e) => setOnlyNow(e.target.checked)} />{t("Seulement l'équipe actuelle")}</label>
        {H.canEdit ? <Button variant="primary" icon="plus" onClick={() => H.editPerson(null)}>{t('Ajouter une personne')}</Button> : null}
        {H.canEdit && H.can('manager') ? <Button icon="file-import" onClick={H.importEmployees}>{t('Importer depuis les Ressources humaines')}</Button> : null}
      </div>
      {!H.people.length ? <EmptyState icon="users" title={t('Aucune personne')}>{t("Ajoutez le fondateur, la direction, les responsables et les équipes, ou importez vos employés.")}</EmptyState> : (
        <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('Personnes')}>
          <table className="ui-table">
            <thead><tr><th scope="col">{t('Nom')}</th><th scope="col">{t('Poste')}</th><th scope="col">{t('Niveau')}</th><th scope="col">{t('Supérieur')}</th><th scope="col">{t('Arrivée')}</th><th scope="col">{t('Départ')}</th><th scope="col"><span className="sr-only">{t('Actions')}</span></th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id} style={{ opacity: stateIn(p, now) === 'former' ? 0.6 : 1 }}>
                <td><button type="button" className="link" onClick={() => H.openPerson(p.id)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="hst-av">{p.photoId ? <Pic orgId={H.orgId} id={p.photoId} alt="" fallback={initials(p.name)} /> : initials(p.name)}</span>{p.name}</button>
                  {p.employeeId ? <> <Badge tone="info"><Icon name="hr" />{t('RH')}</Badge></> : null}</td>
                <td>{p.title}</td><td>{L.level[p.level]}</td><td>{parent(p)}</td><td>{frDate(p.startDate)}</td><td>{frDate(p.endDate)}</td>
                <td className="r">{H.canEdit ? <>
                  <Button size="sm" iconOnly icon="edit" label={t('Modifier')} onClick={() => H.editPerson(p)} />{' '}
                  <Button size="sm" iconOnly icon="trash" label={t('Supprimer')} onClick={() => H.delPerson(p)} /></> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
