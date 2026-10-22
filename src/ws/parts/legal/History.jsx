import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';

/* Historique d'un contrat : qui a changé quoi et quand. */
export function HistoryBox({ id }) {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/legal/contracts/' + id + '/history'), []);
  return (
    <Loaded state={st}>{(j) => (
      <>
        {!j.history.length ? <Empty text="Aucune modification enregistrée." /> : null}
        {j.history.map((h) => (
          <div className="line" key={h.id} style={{ display: 'block' }}>
            <b>{h.action}</b> <small>{'par ' + (h.userName || 'inconnu') + ' · ' + new Date(h.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small>
            {h.changes.map((c) => <div key={c.field}><small>{c.label + ' : '}<s>{c.from}</s>{' → '}<b>{c.to}</b></small></div>)}
          </div>
        ))}
      </>
    )}
    </Loaded>
  );
}
