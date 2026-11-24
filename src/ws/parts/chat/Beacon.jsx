import { useEffect, useRef } from 'react';
import { useWs } from '../../WsContext.jsx';
import { setChatUnread } from './unread.js';

/* Position en direct : si l'employé l'a ACTIVÉE (jamais par défaut), l'appareil envoie sa position toutes les 30 secondes tant qu'il est connecté
   à l'application (n'importe quel écran), et plus rien quand il ferme l'onglet. Désactivation = arrêt immédiat. Rien n'est envoyé sans activation. */
export default function ChatBeacon() {
  const { oapi, info, orgId } = useWs();
  const watch = useRef(null); const lastSent = useRef(0); const on = useRef(false);
  const has = info && info.modules && info.modules.some((m) => m.id === 'chat');
  useEffect(() => {
    if (!has || !navigator.geolocation) return undefined;
    let stop = false;
    const send = (p) => { const now = Date.now(); if (now - lastSent.current < 30000) return; lastSent.current = now; oapi('POST', '/chat/geo/position', { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }).catch((e) => { if (e.status === 403) { on.current = false; if (watch.current !== null) { navigator.geolocation.clearWatch(watch.current); watch.current = null; } } }); };
    const begin = () => { if (watch.current !== null || stop) return; on.current = true; watch.current = navigator.geolocation.watchPosition(send, () => {}, { enableHighAccuracy: false, maximumAge: 20000, timeout: 30000 }); };
    const end = () => { if (watch.current !== null) { navigator.geolocation.clearWatch(watch.current); watch.current = null; } on.current = false; };
    const check = () => oapi('GET', '/chat/geo/me').then((j) => { if (stop) return; if (j.enabled) begin(); else end(); }, () => {});
    check();
    const i = setInterval(check, 60000); // une désactivation faite sur un autre appareil est prise en compte
    const onEvt = () => check();
    window.addEventListener('chat-geo-changed', onEvt);
    return () => { stop = true; clearInterval(i); end(); window.removeEventListener('chat-geo-changed', onEvt); };
  }, [has, orgId, oapi]);
  useEffect(() => { // pastille « non lus » du menu, même quand le chat n'est pas ouvert
    if (!has) return undefined;
    let stop = false;
    const poll = () => { if (document.hidden) return; oapi('GET', '/chat/unread').then((j) => { if (!stop) setChatUnread(j.total); }, () => {}); };
    poll(); const i = setInterval(poll, 30000);
    return () => { stop = true; clearInterval(i); };
  }, [has, orgId, oapi]);
  return null;
}
