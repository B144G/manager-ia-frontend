import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { FLAGS, fmtDT } from './util.jsx';

const ACTION = {
  exclude: 'IA exclue', partial: 'Exclusion partielle', lift: 'Règle levée', auto_lift: 'Levée automatique (durée écoulée)',
  draft_created: 'Brouillon préparé par l\'IA', draft_approved: 'Brouillon validé et envoyé', draft_edited: 'Brouillon modifié puis envoyé', draft_rejected: 'Brouillon refusé',
};

/** Journal de l'organisation : qui a exclu ou validé quoi, quand, pour combien de temps. */
export function Journal() {
  const t = useT();
  const { oapi } = useWs();
  const [page, setPage] = useState(1);
  const st = useLoad(() => oapi('GET', '/aifollow/journal?page=' + page), [page]);
  const d = st.data;
  const detail = (e) => {
    const i = e.info || {};
    const parts = [];
    if (e.action === 'partial' && i.flags) parts.push(i.flags.map((k) => (FLAGS.find((f) => f[0] === k) || [k, k])[1]).map((x) => t(x)).join(', '));
    if (e.action === 'exclude' || e.action === 'partial') parts.push(e.expiresAt ? t("jusqu'au {date}", { date: fmtDT(e.expiresAt) }) : t('sans limite de durée'));
    if (e.action === 'auto_lift') parts.push(t('échéance : {date}', { date: fmtDT(e.expiresAt) }));
    if (i.reason) parts.push(t('Motif : {reason}', { reason: i.reason }));
    if (i.note) parts.push(t('Note : {note}', { note: i.note }));
    return parts.join(' · ');
  };
  return (
    <div className="ws-card af-journal">
      <h2>{t("Journal des exclusions et des validations")}</h2>
      <p className="muted">{t("Qui a fait quoi, quand et pour combien de temps. Ce journal reste dans votre organisation.")}</p>
      {st.loading && !d ? <Loading /> : st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : d ? (
        !d.entries.length ? <Empty text={t('Rien pour le moment.')} /> : (
          <>
            <div className="af-wrap">
              <table className="af-table">
                <thead><tr><th scope="col">{t('Date')}</th><th scope="col">{t('Contact')}</th><th scope="col">{t('Action')}</th><th scope="col">{t('Par')}</th><th scope="col">{t('Détail')}</th></tr></thead>
                <tbody>
                  {d.entries.map((e) => (
                    <tr key={e.id}>
                      <td data-label={t('Date')} className="nw">{fmtDT(e.at)}</td>
                      <td className="af-name"><b>{e.label || '—'}</b></td>
                      <td data-label={t('Action')}>{t(ACTION[e.action] || e.action)}</td>
                      <td data-label={t('Par')} className="nw">{e.user || t('Automatique')}</td>
                      <td data-label={t('Détail')}>{detail(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="af-pager">
              <span className="muted small">{t('Page {page} sur {pages}', { page: d.page, pages: d.pages })}</span>
              <span className="row">
                <button className="btn small" type="button" disabled={d.page <= 1} onClick={() => setPage(d.page - 1)}>{t('Précédent')}</button>
                <button className="btn small" type="button" disabled={d.page >= d.pages} onClick={() => setPage(d.page + 1)}>{t('Suivant')}</button>
              </span>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
