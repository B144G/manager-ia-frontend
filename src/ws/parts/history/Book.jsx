import { useMemo } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Button, EmptyState, Icon } from '../../ui/index.jsx';
import { Thumbs } from './Cards.jsx';
import { downloadFile, frDate, useLabels } from './util.jsx';

/* Page de lecture « livre d'or » : l'histoire racontée année après année, agréable à parcourir et à imprimer. */

export default function Book({ H }) {
  const t = useT();
  const L = useLabels();
  const years = useMemo(() => {
    const m = new Map();
    for (const e of H.events) { if (!m.has(e.year)) m.set(e.year, []); m.get(e.year).push(e); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [H.events]);
  if (!H.events.length) return <EmptyState icon="book-open" title={t("Le livre d'or est encore vide")}>{t("Ajoutez des événements dans la frise : ils s'écriront ici, année après année.")}</EmptyState>;
  const good = H.events.filter((e) => e.nature === 'good').length;
  const first = years[0][0];
  const go = (y) => { const el = document.getElementById('hst-ch-' + y); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="hst-book">
      <header className="hst-hero">
        <h2>{H.orgName}</h2>
        <p>{t('Notre histoire depuis {y}', { y: first })}</p>
        <div className="nums">
          <div><b>{Math.max(new Date().getFullYear() - first, 0)}</b>{t("ans d'histoire")}</div>
          <div><b style={{ color: 'var(--ok-text)' }}>{good}</b>{t('moments forts')}</div>
          <div><b style={{ color: 'var(--danger-text)' }}>{H.events.length - good}</b>{t('moments durs')}</div>
          <div><b>{H.people.length}</b>{t('personnes')}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Button icon="file-pdf" onClick={() => downloadFile(H.orgId, '/export.pdf', 'histoire-entreprise.pdf').catch(H.fail)}>{t('Télécharger en PDF')}</Button>
          <Button icon="print" onClick={() => window.print()}>{t('Imprimer')}</Button>
        </div>
      </header>
      <nav className="hst-index" aria-label={t('Aller à une année')}>{years.map(([y]) => <button type="button" key={y} className="hst-chip" onClick={() => go(y)}>{y}</button>)}</nav>
      {years.map(([y, evs]) => (
        <section className="hst-chapter" id={'hst-ch-' + y} key={y}>
          <h2>{y}</h2>
          {evs.map((e) => (
            <article className={'hst-page ' + e.nature} key={e.id}>
              <h3><span className="mark" aria-hidden="true" /><span className="sr-only">{L.nature[e.nature]} — </span>{e.title}</h3>
              <p className="when">{frDate(e.date)} · {L.cat[e.category]}{e.place ? ' · ' + e.place : ''}{e.people.length ? ' · ' + e.people.map((p) => p.name).join(', ') : ''}</p>
              {e.description ? <p className="story">{e.description}</p> : null}
              {e.nature === 'good' && e.successFactors ? <blockquote className="hst-quote"><Icon name="star" /> {t('Ce qui a fait le succès')} : {e.successFactors}</blockquote> : null}
              {e.nature === 'bad' && e.lesson ? <blockquote className="hst-quote"><Icon name="lightbulb" /> {t("Ce qu'on en a retenu")} : {e.lesson}</blockquote> : null}
              {e.category === 'meeting' && e.minutes ? <blockquote className="hst-quote">{e.minutes}</blockquote> : null}
              <Thumbs H={H} media={e.media} />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
