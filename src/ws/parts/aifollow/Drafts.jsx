import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { openChat } from '../sales/Chats.jsx';
import { DraftCard } from './AiState.jsx';
import { CHANNEL_LABEL } from './util.jsx';

/** Réponses préparées par l'IA et en attente de validation (contacts en « Réponse à valider »). */
export function Drafts({ onChange }) {
  const t = useT();
  const ws = useWs();
  const { oapi, fail } = ws;
  const st = useLoad(() => oapi('GET', '/aifollow/drafts'), []);
  const after = () => { st.reload(); if (onChange) onChange(); };
  const look = (d) => oapi('GET', '/members').then((m) => openChat(ws, '/sales', { id: d.chatId, customer: d.label }, m.members, true, after)).catch(fail);
  return (
    <div className="ws-card">
      <h2>{t('Réponses de l\'IA à valider')}</h2>
      <p className="muted">{t("Pour ces contacts, l'IA prépare sa réponse mais ne l'envoie pas : vous la validez, la modifiez ou la refusez.")}</p>
      {st.loading && !st.data ? <Loading /> : st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : st.data ? (
        !st.data.drafts.length ? <Empty text={t("Aucune réponse à valider. Pour en recevoir, ouvrez « Exclusion partielle » sur un contact et décochez « Répondre seule ».")} /> : st.data.drafts.map((d) => (
          <div key={d.id} style={{ margin: '12px 0' }}>
            <p style={{ margin: '0 0 4px' }}><b>{d.label}</b> <small className="muted">· {t(CHANNEL_LABEL[d.channel] || d.channel)}</small></p>
            {d.lastText ? <p className="muted small" style={{ margin: '0 0 4px' }}>{t('Le client a écrit : « {text} »', { text: d.lastText })}</p> : null}
            <DraftCard d={d} canAct web={d.channel === 'web'} after={after} />
            <button className="link" type="button" onClick={() => look(d)}>{t('Regarder la conversation')}</button>
          </div>
        ))
      ) : null}
    </div>
  );
}
