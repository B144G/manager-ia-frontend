import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import { Contacts } from '../parts/aifollow/Contacts.jsx';
import { Drafts } from '../parts/aifollow/Drafts.jsx';
import { Journal } from '../parts/aifollow/Journal.jsx';

/* Suivi de l'IA : tous vos clients, ce que l'IA a le droit de faire avec chacun, ses brouillons à valider et le journal des décisions.
   Réservé aux responsables et plus ; l'administration de la plateforme n'a aucun accès à ces conversations. */
export default function AiFollow() {
  const t = useT();
  const { oapi } = useWs();
  const [tab, setTab] = useState('contacts');
  const [pending, setPending] = useState(0);
  const reloadPending = useCallback(() => { oapi('GET', '/aifollow/pulse').then((p) => setPending(p.drafts)).catch(() => {}); }, [oapi]);
  useEffect(() => { reloadPending(); }, [reloadPending]);
  const tabs = [['contacts', t('Clients')], ['drafts', t('Réponses à valider') + (pending ? ' (' + pending + ')' : '')], ['journal', t('Journal')]];
  return (
    <>
      <div className="ws-head"><div><h1>{t("Suivi de l'IA")}</h1><p className="muted">{t("Vos clients, ce que l'IA fait avec chacun, et la main pour reprendre la conversation quand vous le voulez.")}</p></div></div>
      <div className="ws-tabs" role="tablist">
        {tabs.map((x) => <button key={x[0]} type="button" role="tab" aria-selected={tab === x[0]} className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => setTab(x[0])}>{x[1]}</button>)}
      </div>
      {tab === 'contacts' ? <Contacts onPending={setPending} /> : tab === 'drafts' ? <Drafts onChange={reloadPending} /> : <Journal />}
    </>
  );
}
