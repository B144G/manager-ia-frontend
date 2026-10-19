import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { LEAVE } from './Forms.jsx';

const LST = { pending: ['À traiter', 'mid'], approved: ['Accepté', 'good'], refused: ['Refusé', 'bad'] };

/** Onglet « Congés » : demandes à accepter, refuser ou supprimer. `ver` change → rechargement. */
export default function Leaves({ ver, load }) {
  const { oapi, dateFr, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/hr/leaves'), [ver]);
  const decide = (l, decision) => { oapi('PUT', '/hr/leaves/' + l.id + '/decision', { decision }).then(load).catch(fail); };
  return (
    <Loaded state={st}>{(j) => (
      <>
        <div className="ws-card">
          <h2>Demandes de congé</h2>
          {!j.leaves.length ? <Empty text="Aucune demande de congé." /> : null}
          {j.leaves.map((l) => (
            <div className="line" key={l.id}>
              <span>
                <b>{l.employee}</b>{' '}<span className={'pill ' + LST[l.status][1]}>{LST[l.status][0]}</span>
                <small>{' ' + LEAVE[l.kind] + ' · du ' + dateFr(l.start) + ' au ' + dateFr(l.end) + ' (' + l.days + ' j)' + (l.note ? ' · ' + l.note : '')}</small>
              </span>
              <span className="row">
                {l.status === 'pending' ? <button className="link" type="button" onClick={() => decide(l, 'approved')}>Accepter</button> : null}
                {l.status === 'pending' ? <button className="link" type="button" onClick={() => decide(l, 'refused')}>Refuser</button> : null}
                <button className="link" type="button" onClick={() => confirm('Supprimer cette demande ?', () => { oapi('DELETE', '/hr/leaves/' + l.id).then(load).catch(fail); })}>Supprimer</button>
              </span>
            </div>
          ))}
        </div>
        <p className="muted small">Avant d'accepter, regardez le planning : l'IA peut vous dire qui d'autre sera absent.</p>
      </>
    )}
    </Loaded>
  );
}
