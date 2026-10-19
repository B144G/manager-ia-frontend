import { useEffect, useRef, useState } from 'react';
import { rq, SUPPORT_WHATSAPP } from '../lib/api.js';

/* Assistant IA intégré au site : bulle flottante (accueil et pages de connexion). Il appelle le serveur (/api/assistant) ;
   si le serveur ne répond pas, il donne des repères simples et oriente vers WhatsApp. */
const WA = `https://wa.me/${SUPPORT_WHATSAPP}`;
const FALLBACK = [
  [/prix|tarif|co[uû]t|abonnement|payer|paiement/, 'Offres : Gratuit pour essayer, Pro à 50 000 FCFA par mois, Pro Max à 75 000 FCFA, Méga Pro à 100 000 FCFA et Illimité à 150 000 FCFA par mois. Paiement par MTN Mobile Money ou Orange Money.'],
  [/compte|inscri|connexion|connecter|mot de passe|commencer/, 'Cliquez sur « Commencer gratuitement » : vous arrivez sur la page de connexion. Si vous n\'avez pas de compte, « Créer un compte » est sous le formulaire. Ensuite vous arrivez dans votre tableau de bord.'],
  [/gestion|projet|budget|client|[eé]quipe|organisation|agent|fonction/, "L'agent IA de gestion d'activité contient : service client, projets et tâches, budget, organisation, fonctionnement, équipe et antennes. Il connaît vos données et vous conseille ; vous validez ses propositions."],
];
function fallback(q) {
  const l = q.toLowerCase();
  for (const [rx, t] of FALLBACK) if (rx.test(l)) return t;
  return "Je n'ai pas la réponse à cette question pour l'instant. Écrivez à l'équipe sur WhatsApp : " + WA;
}

export default function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: "Bonjour ! Je suis l'assistant de MANAGER-IA. Je peux vous expliquer le site, vous aider à créer votre compte et à prendre en main votre tableau de bord. Que voulez-vous savoir ?" }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const log = useRef(null);
  const input = useRef(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [msgs]);
  useEffect(() => { if (open && input.current) input.current.focus(); }, [open]);

  function ask(q0) {
    const q = (q0 ?? text).trim();
    if (!q || busy) return;
    setText(''); setBusy(true);
    const history = [...msgs, { role: 'user', content: q }];
    setMsgs([...history, { role: 'assistant', content: '…', wait: true }]);
    const done = (t) => { setMsgs([...history, { role: 'assistant', content: t }]); setBusy(false); };
    rq('POST', '/api/assistant', { messages: history.filter((m) => !m.wait).slice(-12).map((m) => ({ role: m.role, content: m.content })) }).then((j) => done(j.text), () => done(fallback(q)));
  }

  return (
    <>
      <button id="sa-btn" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Assistant IA</button>
      <div id="sa" role="dialog" aria-label="Assistant MANAGER-IA" hidden={!open}>
        <header>
          <div><b>Assistant MANAGER-IA</b><small>Je vous guide sur le site</small></div>
          <button className="x" type="button" aria-label="Fermer l'assistant" onClick={() => setOpen(false)}>×</button>
        </header>
        <div id="sa-log" aria-live="polite" ref={log}>{msgs.map((m, i) => <div key={i} className={'m ' + (m.role === 'user' ? 'u' : 'a')}>{m.content}</div>)}</div>
        <div id="sa-chips">{['Comment commencer ?', "Que fait l'agent IA ?", 'Quels sont les prix ?'].map((t) => <button key={t} type="button" onClick={() => ask(t)}>{t}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input ref={input} type="text" placeholder="Posez votre question…" aria-label="Votre question" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary small" type="submit">Envoyer</button>
        </form>
      </div>
    </>
  );
}
