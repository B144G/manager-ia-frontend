import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useLoad } from '../../ui.jsx';
import { scoreText } from './Audit.jsx';
import { ScoreBar, TONE } from './common.jsx';

/* Bandeau en haut de l'Aperçu : score de santé des comptes et « Synthèse en clair ». Si le serveur ne répond pas, le bandeau se tait. */

export default function InsightsBand({ year }) {
  const t = useT();
  const { oapi, confirm, fail } = useWs();
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const st = useLoad(() => Promise.all([
    oapi('GET', '/accounting/audit?year=' + year).catch(() => null),
    oapi('GET', '/accounting/insights?year=' + year).catch(() => null),
  ]), [year]);
  if (!st.data) return null;
  const [audit, ins0] = st.data;
  const ins = ai || ins0;
  if (!audit && !ins) return null;
  const askAi = () => confirm(t("Demander à l'IA de reformuler cette synthèse ? Cela compte comme un message IA. Elle ne modifie rien dans votre comptabilité."), () => {
    setBusy(true);
    oapi('GET', '/accounting/insights?year=' + year + '&ai=1').then((r) => { setAi(r); setBusy(false); }).catch((e) => { setBusy(false); fail(e); });
  }, t('Reformuler'));
  return (
    <div className="ws-card">
      {audit ? (
        <>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h2 className="grow">{t('Santé des comptes : {score} / 100', { score: audit.score })}</h2>
            <span className={'pill ' + (audit.score >= 80 ? 'good' : audit.score >= 50 ? 'mid' : 'bad')}>{scoreText(t, audit.score)}</span>
          </div>
          <ScoreBar score={audit.score} />
        </>
      ) : null}
      {ins && ins.points && ins.points.length ? (
        <>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
            <h3 className="grow">{t('Synthèse en clair')}</h3>
            <small className="muted">{ins.source === 'ai' ? t('Reformulée par l\'IA') : t('Calculée à partir de vos chiffres')}</small>
          </div>
          {ins.points.map((p, i) => (
            <div className="line" key={i} style={{ alignItems: 'flex-start' }}>
              <span><span className={'pill ' + (TONE[p.tone] || '')}>{tsrv(p.title)}</span><br /><small>{tsrv(p.text)}</small></span>
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn small" type="button" disabled={busy || (ins.source === 'ai')} onClick={askAi}>{busy ? t('Chargement…') : t("Reformuler avec l'IA")}</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
