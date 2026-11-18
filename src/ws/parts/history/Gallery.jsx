import { useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, EmptyState, Icon } from '../../ui/index.jsx';
import { Pic, useLabels } from './util.jsx';

/* Galerie par année : images et vidéos de l'entreprise. Un média « direction seulement » ou sans consentement n'est montré qu'à la direction (le serveur filtre). */

export default function Gallery({ H }) {
  const t = useT();
  const L = useLabels();
  const [year, setYear] = useState('');
  const years = useMemo(() => [...new Set(H.media.map((m) => m.year))].sort((a, b) => b - a), [H.media]);
  const list = H.media.filter((m) => !year || m.year === Number(year));
  const byYear = useMemo(() => { const m = new Map(); list.forEach((x) => { if (!m.has(x.year)) m.set(x.year, []); m.get(x.year).push(x); }); return [...m.entries()].sort((a, b) => b[0] - a[0]); }, [list]);
  const eventOf = (id) => H.events.find((e) => e.id === id);
  return (
    <>
      <div className="hst-bar">
        <div className="hst-chips" role="group" aria-label={t('Année')}>
          <button type="button" className="hst-chip" aria-pressed={!year} style={!year ? { background: 'var(--accent-soft-2)', fontWeight: 700 } : undefined} onClick={() => setYear('')}>{t('Toutes')}</button>
          {years.map((y) => <button type="button" key={y} className="hst-chip" aria-pressed={String(y) === year} style={String(y) === year ? { background: 'var(--accent-soft-2)', fontWeight: 700 } : undefined} onClick={() => setYear(String(y))}>{y}</button>)}
        </div>
        <span style={{ flex: 1 }} />
        {H.canEdit ? <Button variant="primary" icon="upload" onClick={() => H.addMedia({})}>{t('Ajouter une photo ou une vidéo')}</Button> : null}
      </div>
      {!H.media.length ? <EmptyState icon="image" title={t('La galerie est vide')}>{t("Ajoutez des photos et des vidéos de l'entreprise. Pour celles où l'on reconnaît des personnes, demandez leur accord.")}</EmptyState> : byYear.map(([y, items]) => (
        <section key={y} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-xl)' }}>{y}</h2>
          <div className="hst-gal">
            {items.map((m) => (
              <figure key={m.id}>
                <button type="button" className="open" onClick={() => H.openMedia(m, items)} aria-label={(m.kind === 'video' ? t('Voir la vidéo') : t("Voir l'image")) + ' : ' + (m.caption || m.name)}>
                  {m.kind === 'image' ? <Pic orgId={H.orgId} id={m.id} alt={m.caption || m.name} /> : <><span className="hst-ph"><Icon name="film" /></span><span className="play"><Icon name="play" /></span></>}
                </button>
                <figcaption>
                  {m.caption || (eventOf(m.eventId) ? eventOf(m.eventId).title : m.name)}
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.visibility === 'direction' ? <Badge tone="warn"><Icon name="lock" />{L.vis.direction}</Badge> : null}
                    {m.hasPeople && !m.consent ? <Badge tone="danger">{t('Sans accord')}</Badge> : null}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
