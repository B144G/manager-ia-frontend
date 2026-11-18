import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Button, EmptyState, Icon, Segmented } from '../../ui/index.jsx';
import { EventCard } from './Cards.jsx';
import { Filters, useFiltered } from './Timeline.jsx';

/* Bons et mauvais moments, séparés : deux colonnes côte à côte (une sous l'autre sur téléphone), ou un seul des deux. */

export default function Moments({ H }) {
  const t = useT();
  const [view, setView] = useState('cols');
  const { f, setF, years, list } = useFiltered(H.events, null);
  const good = list.filter((e) => e.nature === 'good');
  const bad = list.filter((e) => e.nature === 'bad');
  const col = (nature, items) => (
    <div className={nature}>
      <h2><Icon name={nature === 'good' ? 'arrow-trend-up' : 'arrow-trend-down'} />{nature === 'good' ? t('Moments forts') : t('Moments durs')} <span className={'ui-badge ' + (nature === 'good' ? 'hst-badge-good' : 'hst-badge-bad')}>{items.length}</span></h2>
      {items.length ? items.map((e) => <EventCard key={e.id} H={H} e={e} />) : <p className="muted">{nature === 'good' ? t('Aucun moment fort pour ces filtres.') : t('Aucun moment dur pour ces filtres.')}</p>}
      {H.canEdit ? <Button size="sm" icon="plus" onClick={() => H.editEvent(null, { nature })}>{nature === 'good' ? t('Ajouter un moment fort') : t('Ajouter un moment dur')}</Button> : null}
    </div>
  );
  if (!H.events.length) return <EmptyState icon="star" title={t('Aucun moment enregistré')}>{t("Les moments forts racontent ce qui a fait le succès ; les moments durs, ce qu'on en a retenu.")}</EmptyState>;
  return (
    <>
      <Filters f={f} setF={setF} years={years} />
      <div className="hst-bar">
        <Segmented label={t('Affichage')} value={view} onChange={setView}
          items={[{ id: 'cols', label: t('Les deux côte à côte'), icon: 'table-columns' }, { id: 'good', label: t('Moments forts'), icon: 'arrow-trend-up' }, { id: 'bad', label: t('Moments durs'), icon: 'arrow-trend-down' }]} />
      </div>
      {view === 'cols' ? <div className="hst-cols">{col('good', good)}{col('bad', bad)}</div> : col(view, view === 'good' ? good : bad)}
    </>
  );
}
