import { useEffect, useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';

const SDK = 'https://connect.facebook.net/fr_FR/sdk.js';
// Seules ces origines sont crues : tout autre message est ignoré.
const ORIGINS = ['https://www.facebook.com', 'https://web.facebook.com'];

let sdkPromise = null;
/** Charge le kit JavaScript de Meta, une seule fois, et seulement quand la personne clique. */
function loadSdk(cfg) {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => { window.FB.init({ appId: cfg.appId, version: cfg.graphVersion, cookie: false, xfbml: false }); resolve(window.FB); };
      const s = document.createElement('script');
      s.src = SDK; s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
      s.onerror = () => { sdkPromise = null; reject(new Error("Le module de connexion de Meta n'a pas pu être chargé. Vérifiez votre connexion ou désactivez le bloqueur de publicités, puis réessayez.")); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

/** État attendu : 'idle' | 'running' | 'done' | 'cancel' | 'error'. */
export function OneClickCard({ cfg, connected, number, onDone }) {
  const { oapi } = useWs();
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const [shown, setShown] = useState('');
  const live = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (live.current) window.removeEventListener('message', live.current); }, []);

  const stop = () => { if (live.current) { window.removeEventListener('message', live.current); live.current = null; } };
  const set = (s, m = '') => { if (alive.current) { setState(s); setMsg(m); } };

  const start = async () => {
    stop(); set('running');
    const got = { code: '', phoneNumberId: '', wabaId: '', finished: false, sent: false };
    const finish = () => {
      if (got.sent || !got.code || !got.phoneNumberId || !got.wabaId) return;
      got.sent = true;
      oapi('POST', '/sales/whatsapp/embedded/complete', { code: got.code, phoneNumberId: got.phoneNumberId, wabaId: got.wabaId }).then((r) => {
        stop(); if (alive.current) setShown(r.number ? '+' + r.number : ''); set('done'); onDone();
      }, (e) => { stop(); set('error', e.message || 'La connexion a échoué.'); });
    };
    const onMsg = (ev) => {
      if (!ORIGINS.includes(ev.origin)) return;
      let d = ev.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
      if (!d || d.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (d.event === 'FINISH' && d.data) {
        got.phoneNumberId = String(d.data.phone_number_id || ''); got.wabaId = String(d.data.waba_id || ''); got.finished = true; finish();
      } else if (d.event === 'CANCEL') { stop(); set('cancel', 'Connexion annulée. Vous pouvez recommencer quand vous voulez.'); }
      else if (d.event === 'ERROR') { stop(); set('error', 'Meta a signalé un problème' + (d.data && d.data.error_message ? ' : ' + String(d.data.error_message).slice(0, 160) : '') + '. Réessayez.'); }
    };
    live.current = onMsg;
    window.addEventListener('message', onMsg);
    try {
      const FB = await loadSdk(cfg);
      FB.login((response) => {
        if (response && response.authResponse && response.authResponse.code) { got.code = String(response.authResponse.code); finish(); }
        else if (!got.finished) { stop(); set('cancel', "La connexion a été annulée ou fermée avant la fin. Vous pouvez recommencer."); }
      }, { config_id: cfg.configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: '', sessionInfoVersion: '3' } });
    } catch (e) { stop(); set('error', e.message); }
  };

  const busy = state === 'running';
  return (
    <div className="ws-card wa-oneclick">
      <h2>Connecter WhatsApp en un clic</h2>
      <p className="muted">Meta vous guide : vous choisissez votre compte et votre numéro WhatsApp Business, sans copier aucun identifiant. Le service est gratuit chez Meta (les conversations restent facturées selon leurs tarifs).</p>
      {state === 'done' ? <p className="ws-ok" role="status">WhatsApp est connecté{shown ? ' : ' + shown : ''}. L'assistant répond maintenant sur ce numéro.</p> : null}
      {state === 'cancel' ? <p className="muted" role="status">{msg}</p> : null}
      {state === 'error' ? <p className="ws-err" role="alert">{msg}</p> : null}
      {busy ? <p className="muted" role="status">Connexion en cours… terminez dans la fenêtre de Meta.</p> : null}
      <div className="row">
        <button type="button" className="btn primary" disabled={busy} onClick={start}>{busy ? 'Connexion en cours…' : connected ? 'Reconnecter avec Meta' : 'Connecter WhatsApp'}</button>
      </div>
      {connected && state !== 'done' && number ? <p className="muted small">Numéro actuellement connecté : +{number}</p> : null}
    </div>
  );
}
