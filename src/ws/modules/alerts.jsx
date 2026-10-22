/* Sous-application : Alertes (toutes les alertes calculées par MANAGER-IA, avec l'action associée). */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWs } from '../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import Digest from '../parts/alerts/Digest.jsx';

const LV = { high: 'Urgent', medium: 'À surveiller', info: 'Conseil' };

export default function Alerts() {
  const { oapi, orgId, askAI, fail, can } = useWs();
  const navigate = useNavigate();
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useLoad(() => oapi('GET', '/dashboard/alerts'), []);

  const briefing = () => {
    setBusy(true); setOut("L'IA analyse vos données…");
    oapi('POST', '/ai/briefing')
      .then((r) => setOut(r.text), (e) => { setOut(e.message); if (e.status === 401) fail(e); })
      .then(() => setBusy(false));
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>Alertes</h1><p className="muted">Ce que MANAGER-IA a repéré dans votre organisation, de la plus urgente à la moins urgente.</p></div>
        <button className="btn signal small" type="button" disabled={busy} onClick={briefing}>Analyse détaillée par l'IA</button>
      </div>
      <p className="ai-out dc" style={{ padding: '14px 18px', marginBottom: 14 }}>{out}</p>
      <div>
        <Loaded state={st}>{(j) => (
          !j.alerts.length
            ? <div className="dc"><Empty text="Aucune alerte : tout va bien. MANAGER-IA continue de surveiller." /></div>
            : j.alerts.map((a, i) => (
              <div className={'alrow ' + a.level} key={i + ':' + a.title}>
                <div className="alt">
                  <span className={'pill ' + (a.level === 'high' ? 'bad' : a.level === 'medium' ? 'mid' : 'good')}>{LV[a.level]}</span>
                  <b>{a.title}</b>
                  <p>{a.text}</p>
                </div>
                <div className="row">
                  <button className="btn small" type="button" onClick={() => navigate(`/app/${orgId}/${a.module}`)}>Ouvrir</button>
                  <button className="btn signal small" type="button" onClick={() => askAI('Alerte : ' + a.title + ' — ' + a.text + '. Explique-moi pourquoi et que dois-je faire, concrètement ?')}>Que faire ?</button>
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
