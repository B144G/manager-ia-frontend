/* Sous-application : Alertes (toutes les alertes calculées par MANAGER-IA, avec l'action associée). */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import Digest from '../parts/alerts/Digest.jsx';

const LV = { high: 'Urgent', medium: 'À surveiller', info: 'Conseil' };

export default function Alerts() {
  const { oapi, orgId, askAI, fail, can } = useWs();
  const t = useT();
  const navigate = useNavigate();
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useLoad(() => oapi('GET', '/dashboard/alerts'), []);

  const briefing = () => {
    setBusy(true); setOut(t("L'IA analyse vos données…"));
    oapi('POST', '/ai/briefing')
      .then((r) => setOut(r.text), (e) => { setOut(t(e.message)); if (e.status === 401) fail(e); })
      .then(() => setBusy(false));
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Alertes')}</h1><p className="muted">{t('Ce que MANAGER-IA a repéré dans votre organisation, de la plus urgente à la moins urgente.')}</p></div>
        <button className="btn signal small" type="button" disabled={busy} onClick={briefing}>{t("Analyse détaillée par l'IA")}</button>
      </div>
      <p className="ai-out dc" style={{ padding: '14px 18px', marginBottom: 14 }}>{out}</p>
      <div>
        <Loaded state={st}>{(j) => (
          !j.alerts.length
            ? <div className="dc"><Empty text={t('Aucune alerte : tout va bien. MANAGER-IA continue de surveiller.')} /></div>
            : j.alerts.map((a, i) => (
              <div className={'alrow ' + a.level} key={i + ':' + a.title}>
                <div className="alt">
                  <span className={'pill ' + (a.level === 'high' ? 'bad' : a.level === 'medium' ? 'mid' : 'good')}>{t(LV[a.level])}</span>
                  <b>{tsrv(a.title)}</b>
                  <p>{tsrv(a.text)}</p>
                </div>
                <div className="row">
                  <button className="btn small" type="button" onClick={() => navigate(`/app/${orgId}/${a.module}`)}>{t('Ouvrir')}</button>
                  <button className="btn signal small" type="button" onClick={() => askAI(t('Alerte : {title} — {text}. Explique-moi pourquoi et que dois-je faire, concrètement ?', { title: tsrv(a.title), text: tsrv(a.text) }))}>{t('Que faire ?')}</button>
                </div>
              </div>
            ))
        )}
        </Loaded>
      </div>
      {can('manager') ? <Digest /> : null}
    </>
  );
}
