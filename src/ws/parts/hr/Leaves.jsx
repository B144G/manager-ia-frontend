import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { LEAVE } from './Forms.jsx';

const LST = { pending: ['À traiter', 'mid'], approved: ['Accepté', 'good'], refused: ['Refusé', 'bad'] };

/** Onglet « Congés » : demandes à accepter, refuser ou supprimer. `ver` change → rechargement. */
export default function Leaves({ ver, load }) {
  const t = useT();
  const { oapi, dateFr, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/hr/leaves'), [ver]);
  const decide = (l, decision) => { oapi('PUT', '/hr/leaves/' + l.id + '/decision', { decision }).then(load).catch(fail); };
  return (
    <Loaded state={st}>{(j) => (
      <>
        <div className="ws-card">
          <h2>{t('Demandes de congé')}</h2>
          {!j.leaves.length ? <Empty text={t("Aucune demande de congé.")} /> : null}
          {j.leaves.map((l) => (
            <div className="line" key={l.id}>
              <span>
                <b>{l.employee}</b>{' '}<span className={'pill ' + LST[l.status][1]}>{t(LST[l.status][0])}</span>
                <small>{' ' + t(LEAVE[l.kind]) + ' · ' + t('du {start} au {end} ({n} j)', { start: dateFr(l.start), end: dateFr(l.end), n: l.days }) + (l.note ? ' · ' + l.note : '')}</small>
              </span>
              <span className="row">
                {l.status === 'pending' ? <button className="link" type="button" onClick={() => decide(l, 'approved')}>{t('Accepter')}</button> : null}
                {l.status === 'pending' ? <button className="link" type="button" onClick={() => decide(l, 'refused')}>{t('Refuser')}</button> : null}
                <button className="link" type="button" onClick={() => confirm(t('Supprimer cette demande ?'), () => { oapi('DELETE', '/hr/leaves/' + l.id).then(load).catch(fail); })}>{t('Supprimer')}</button>
              </span>
            </div>
          ))}
        </div>
        <p className="muted small">{t("Avant d'accepter, regardez le planning : l'IA peut vous dire qui d'autre sera absent.")}</p>
      </>
    )}
    </Loaded>
  );
}
