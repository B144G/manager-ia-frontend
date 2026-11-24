import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';

/* Temps réel du chat : flux SSE (EventSource) ; si le flux tombe (réseau mobile, relais qui coupe les flux longs), repli automatique sur une
   interrogation toutes les 5 secondes, avec nouvelle tentative du flux toutes les 40 secondes. Les événements sont les mêmes dans les deux cas. */
export function useChatLive(orgId, epoch, handler) {
  const h = useRef(handler); h.current = handler;
  const [mode, setMode] = useState('connecting'); // connecting | live | poll
  useEffect(() => {
    if (!orgId || !epoch) return undefined;
    let es = null; let poll = null; let dog = null; let retry = null; let stopped = false; let seq = 0; let ep = epoch;
    const base = `${API_BASE}/api/ws/orgs/${orgId}/chat`;
    const emit = (type, data) => { try { h.current(type, data); } catch { /* un écran ne doit jamais arrêter le flux */ } };
    const startPoll = () => {
      if (poll || stopped) return;
      setMode('poll');
      const tick = async () => {
        try {
          const r = await fetch(`${base}/updates?after=${seq}&epoch=${ep}`, { credentials: 'include' });
          if (!r.ok) return;
          const j = await r.json();
          if (j.reset) { ep = j.epoch; seq = j.seq; emit('reset', {}); return; }
          for (const ev of j.events) { seq = Math.max(seq, ev.seq); emit(ev.type, ev.data); }
          seq = Math.max(seq, j.seq);
        } catch { /* réseau coupé : on réessaie au prochain tour */ }
      };
      tick(); poll = setInterval(tick, 5000);
    };
    const stopPoll = () => { if (poll) { clearInterval(poll); poll = null; } };
    const open = () => {
      if (stopped || typeof EventSource === 'undefined') { startPoll(); return; }
      try { es = new EventSource(`${base}/stream`, { withCredentials: true }); } catch { startPoll(); return; }
      const arm = () => { clearTimeout(dog); dog = setTimeout(() => { if (es) { es.close(); es = null; } startPoll(); retry = setTimeout(() => { stopPoll(); open(); }, 40000); }, 65000); }; // silence anormal : repli
      es.addEventListener('hello', (e) => { const d = JSON.parse(e.data); if (d.epoch !== ep) { ep = d.epoch; emit('reset', {}); } seq = Math.max(seq, d.seq || 0); stopPoll(); setMode('live'); arm(); emit('connected', {}); });
      es.addEventListener('ping', arm);
      for (const t of ['message', 'message.update', 'message.delete', 'receipt', 'read', 'typing', 'presence', 'conversation', 'call.incoming', 'call.joined', 'call.left', 'call.ended', 'call.signal', 'call.state', 'call.declined', 'reminder', 'geo', 'scheduled']) {
        es.addEventListener(t, (e) => { arm(); try { emit(t, JSON.parse(e.data)); } catch { /* ignoré */ } });
      }
      es.onerror = () => { // le navigateur retente seul ; sans retour rapide, on bascule sur l'interrogation
        clearTimeout(dog);
        dog = setTimeout(() => { if (es) { es.close(); es = null; } startPoll(); retry = setTimeout(() => { stopPoll(); open(); }, 40000); }, 8000);
      };
    };
    open();
    return () => { stopped = true; if (es) es.close(); clearTimeout(dog); clearTimeout(retry); stopPoll(); };
  }, [orgId, epoch]);
  return mode;
}
