import { useEffect, useRef, useState } from 'react';
import { rq, SUPPORT_WHATSAPP } from '../lib/api.js';
import { tr, useT } from '../lib/i18n.jsx';

/* Assistant IA intégré au site : bulle flottante (accueil et pages de connexion). Il appelle le serveur (/api/assistant) ;
   si le serveur ne répond pas, il donne des repères simples et oriente vers WhatsApp. */
const WA = `https://wa.me/${SUPPORT_WHATSAPP}`;
const FALLBACK = [
  [/prix|tarif|co[uû]t|abonnement|payer|paiement|price|pricing|cost|plan|subscription|pay|preis|kosten|abo|zahl|precio|coste|plan|suscrip|pago|pagar/, 'Offres : Gratuit pour essayer, Pro à 50 000 FCFA par mois, Pro Max à 75 000 FCFA, Méga Pro à 100 000 FCFA et Illimité à 150 000 FCFA par mois. Paiement par MTN Mobile Money ou Orange Money.'],
  [/compte|inscri|connexion|connecter|mot de passe|commencer|account|sign|log ?in|password|start|fang|beginn|konto|anmeld|registr|passwort|loslegen|cuenta|registr|sesión|contraseña|empez|comenz/, 'Cliquez sur « Commencer gratuitement » : vous arrivez sur la page de connexion. Si vous n\'avez pas de compte, « Créer un compte » est sous le formulaire. Ensuite vous arrivez dans votre tableau de bord.'],
  [/gestion|projet|budget|client|[eé]quipe|organisation|agent|fonction|manage|project|customer|team|feature|verwalt|projekt|kunde|funktion|gesti|proyecto|cliente|equipo|función/, "L'agent IA de gestion d'activité contient : service client, projets et tâches, budget, organisation, fonctionnement, équipe et antennes. Il connaît vos données et vous conseille ; vous validez ses propositions."],
];
function fallback(q) {
  const l = q.toLowerCase();
  for (const [rx, txt] of FALLBACK) if (rx.test(l)) return tr(txt);
  return tr("Je n'ai pas la réponse à cette question pour l'instant. Écrivez à l'équipe sur WhatsApp : {wa}", { wa: WA });
}

export default function SiteAssistant() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'assistant', init: true, content: "Bonjour ! Je suis l'assistant de MANAGER-IA. Je peux vous expliquer le site, vous aider à créer votre compte et à prendre en main votre tableau de bord. Que voulez-vous savoir ?" }]);
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
    const done = (txt) => { setMsgs([...history, { role: 'assistant', content: txt }]); setBusy(false); };
    rq('POST', '/api/assistant', { messages: history.filter((m) => !m.wait && !m.init).slice(-12).map((m) => ({ role: m.role, content: m.content })) }).then((j) => done(j.text), () => done(fallback(q)));
  }

  return (
    <>
      <button id="sa-btn" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{t('Assistant IA')}</button>
      <div id="sa" role="dialog" aria-label={t("Assistant MANAGER-IA")} hidden={!open}>
        <header>
          <div><b>{t('Assistant MANAGER-IA')}</b><small>{t('Je vous guide sur le site')}</small></div>
          <button className="x" type="button" aria-label={t("Fermer l'assistant")} onClick={() => setOpen(false)}>×</button>
        </header>
        <div id="sa-log" aria-live="polite" ref={log}>{msgs.map((m, i) => <div key={i} className={'m ' + (m.role === 'user' ? 'u' : 'a')}>{m.init ? t(m.content) : m.content}</div>)}</div>
        <div id="sa-chips">{['Comment commencer ?', "Que fait l'agent IA ?", 'Quels sont les prix ?'].map((q) => <button key={q} type="button" onClick={() => ask(t(q))}>{t(q)}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input ref={input} type="text" placeholder={t("Posez votre question…")} aria-label={t("Votre question")} autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary small" type="submit">{t('Envoyer')}</button>
        </form>
      </div>
    </>
  );
}
