import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Icon } from '../../ui/index.jsx';
import { Pic, frDate, useLabels } from './util.jsx';

/* Carte d'un événement (frise, moments forts / durs) : nature en couleur ET en icône, personnes cliquables, miniatures de médias. */

export function NatureBadge({ nature }) {
  const L = useLabels();
  return <span className={'ui-badge ' + (nature === 'good' ? 'hst-badge-good' : 'hst-badge-bad')}><Icon name={nature === 'good' ? 'arrow-trend-up' : 'arrow-trend-down'} />{L.nature[nature]}</span>;
}

export function Thumbs({ H, media }) {
  const t = useT();
  if (!media || !media.length) return null;
  return (
    <div className="hst-thumbs">
      {media.map((m) => (
        <button type="button" key={m.id} className="hst-thumb" onClick={() => H.openMedia(m, media)} aria-label={(m.kind === 'video' ? t('Voir la vidéo') : t("Voir l'image")) + (m.caption ? ' : ' + m.caption : '')}>
          {m.kind === 'image' ? <Pic orgId={H.orgId} id={m.id} alt={m.caption || m.name} /> : <><span className="hst-ph"><Icon name="film" /></span><span className="play"><Icon name="play" /></span></>}
        </button>
      ))}
    </div>
  );
}

export function EventCard({ H, e, compact }) {
  const t = useT();
  const L = useLabels();
  return (
    <article className={'hst-ev ' + e.nature} aria-label={e.title}>
      <span className="hst-dot" aria-hidden="true" />
      <div className="meta">
        <NatureBadge nature={e.nature} />
        <Badge tone="outline">{L.cat[e.category] || e.category}</Badge>
        <span><Icon name="calendar" /> {frDate(e.date)}{e.endDate ? ' → ' + frDate(e.endDate) : ''}</span>
        {e.place ? <span><Icon name="location-dot" /> {e.place}</span> : null}
        {e.visibility === 'direction' ? <Badge tone="warn"><Icon name="lock" />{L.vis.direction}</Badge> : null}
      </div>
      <h3>{e.title}</h3>
      {e.description ? <p className="desc">{e.description}</p> : null}
      {e.nature === 'bad' && e.lesson ? <div className="hst-note bad"><b><Icon name="lightbulb" /> {t("Ce qu'on en a retenu")}</b>{e.lesson}</div> : null}
      {e.nature === 'good' && e.successFactors ? <div className="hst-note good"><b><Icon name="star" /> {t('Ce qui a fait le succès')}</b>{e.successFactors}</div> : null}
      {e.category === 'meeting' && (e.minutes || e.guests.length) ? (
        <div className="hst-note plain">
          <b><Icon name="handshake" /> {t('Rencontre')}</b>
          {e.guests.length ? <div>{t('Invités')} : {e.guests.map((g) => g.name + (g.role ? ' (' + g.role + ')' : '') + (g.org ? ', ' + g.org : '')).join(' · ')}</div> : null}
          {e.minutes ? <div style={{ marginTop: 6 }}>{e.minutes}</div> : null}
        </div>
      ) : null}
      {e.people.length ? (
        <div className="hst-chips" aria-label={t('Personnes concernées')}>
          {e.people.map((p) => <button type="button" className="hst-chip" key={p.id} onClick={() => H.openPerson(p.id)}><Icon name="user" /> {p.name}</button>)}
        </div>
      ) : null}
      <Thumbs H={H} media={e.media} />
      {!compact && H.canEdit ? (
        <div className="hst-actions">
          <Button size="sm" icon="edit" onClick={() => H.editEvent(e)}>{t('Modifier')}</Button>
          <Button size="sm" icon="image" onClick={() => H.addMedia({ eventId: e.id })}>{t('Ajouter une photo ou une vidéo')}</Button>
          <Button size="sm" variant="danger-outline" icon="trash" onClick={() => H.delEvent(e)}>{t('Supprimer')}</Button>
        </div>
      ) : null}
    </article>
  );
}
