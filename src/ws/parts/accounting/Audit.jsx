import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { ScoreBar, TONE, YearBar } from './common.jsx';

/* Contrôles intelligents : audit permanent de la comptabilité, avec un score de santé et des pistes de correction. */

const SEV = { error: 'Erreur', warning: 'À vérifier', info: 'Information' };
const ORDER = ['error', 'warning', 'info'];

export function scoreText(t, score) {
  return score >= 80 ? t('Comptes en bonne santé') : score >= 50 ? t('Comptes à surveiller') : t('Comptes à corriger');
}

export default function AuditTab({ year, setYear }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/audit?year=' + year), [year]);
  return (
    <>
      <YearBar year={year} setYear={setYear} />
      <Loaded state={st}>
        {(j) => {
          const issues = [...(j.issues || [])].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
          return (
            <>
              <div className="ws-card">
                <h2>{t('Score de santé des comptes : {score} / 100', { score: j.score })}</h2>
                <ScoreBar score={j.score} />
                <p className="muted small">{scoreText(t, j.score) + ' · ' + t('{n} contrôle(s) effectué(s)', { n: (j.checked || []).length })}</p>
              </div>
              {!issues.length ? <div className="ws-card"><Empty text={t("Aucune anomalie détectée sur cet exercice. Cet onglet relit en permanence vos écritures (caisse, banque, clients, TVA, doublons, dates…) et vous prévient ici.")} /></div> : null}
              {issues.map((x, i) => (
                <div className="ws-card" key={x.code + '-' + i}>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <b className="grow">{tsrv(x.title)}</b>
                    <span className={'pill ' + (TONE[x.severity] || '')}>{t(SEV[x.severity] || 'Information')}</span>
                  </div>
                  {x.detail ? <p>{tsrv(x.detail)}</p> : null}
                  {x.accounts && x.accounts.length ? <p className="muted small">{t('Comptes concernés : {list}', { list: x.accounts.join(', ') })}</p> : null}
                  {x.entryIds && x.entryIds.length ? <p className="muted small">{t('{n} écriture(s) concernée(s) : voir le Journal.', { n: x.entryIds.length })}</p> : null}
                  {x.fix ? <p className="small"><b>{t('Comment corriger :') + ' '}</b>{tsrv(x.fix)}</p> : null}
                </div>
              ))}
            </>
          );
        }}
      </Loaded>
    </>
  );
}
