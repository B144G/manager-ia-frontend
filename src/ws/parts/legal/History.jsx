import { useWs } from '../../WsContext.jsx';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';

/* Historique d'un contrat : qui a changé quoi et quand. */
export function HistoryBox({ id }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/legal/contracts/' + id + '/history'), []);
  return (
    <Loaded state={st}>{(j) => (
      <>
        {!j.history.length ? <Empty text={t('Aucune modification enregistrée.')} /> : null}
        {j.history.map((h) => (
          <div className="line" key={h.id} style={{ display: 'block' }}>
            <b>{t(h.action)}</b> <small>{t('par {name}', { name: h.userName || t('inconnu') }) + ' · ' + new Date(h.at).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' })}</small>
            {h.changes.map((c) => <div key={c.field}><small>{t(c.label) + ' : '}<s>{t(c.from)}</s>{' → '}<b>{t(c.to)}</b></small></div>)}
          </div>
        ))}
      </>
    )}
    </Loaded>
  );
}
