import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Fa } from '../../../lib/fa.jsx';
import { openRule } from './RuleDialog.jsx';
import { fmtDT, ruleText } from './util.jsx';

/** Brouillon d'une réponse de l'IA à valider : envoyer tel quel, modifier puis envoyer, ou refuser. */
export function DraftCard({ d, canAct, web, after }) {
  const t = useT();
  const { oapi, toast, confirm } = useWs();
  const [text, setText] = useState(d.body);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const send = () => {
    setBusy(true); setErr('');
    oapi('POST', '/aifollow/drafts/' + d.id + '/approve', text.trim() !== d.body.trim() ? { text } : {})
      .then((r) => { toast(r.edited ? t('Message modifié envoyé.') : t('Message envoyé.')); after(); })
      .catch((e) => { setErr(t(e.message)); setBusy(false); });
  };
  const reject = () => confirm(t('Refuser ce brouillon ? Rien ne sera envoyé au client.'), () => oapi('POST', '/aifollow/drafts/' + d.id + '/reject', {}).then(() => { toast(t('Brouillon refusé.')); after(); }).catch((e) => setErr(t(e.message))), t('Refuser'));
  return (
    <div className="af-draft">
      <b>{t("Réponse proposée par l'IA : à valider avant l'envoi")}</b>
      <small className="muted"> · {fmtDT(d.at)}</small>
      {canAct ? (
        <>
          <textarea rows={3} maxLength={1000} aria-label={t('Texte du brouillon (vous pouvez le modifier)')} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="ws-err" role="alert">{err}</p>
          <div className="row">
            {web ? null : <button className="btn primary small" type="button" disabled={busy || !text.trim()} onClick={send}>{text.trim() !== d.body.trim() ? t('Envoyer le texte modifié') : t('Envoyer tel quel')}</button>}
            <button className="btn small" type="button" disabled={busy} onClick={reject}>{t('Refuser')}</button>
          </div>
          {web ? <p className="muted small">{t("Cette personne écrit depuis le site : elle ne peut pas recevoir de message après coup. Refusez le brouillon, ou contactez-la par téléphone.")}</p> : null}
        </>
      ) : <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{d.body}</p>}
    </div>
  );
}

/** Bandeau de l'état de l'IA pour ce contact (exclusion, exclusion partielle) + boutons pour le changer. */
export function AiStateBar({ live, target, label, canAct, onChange }) {
  const t = useT();
  const ws = useWs();
  const { oapi, toast, fail } = ws;
  const rule = live.rule;
  const lift = () => oapi('POST', '/aifollow/rules/lift', target).then(() => { toast(t("L'IA répondra de nouveau à ce contact.")); onChange(); }).catch(fail);
  return (
    <>
      {rule ? (
        <div className={'af-rule ' + (rule.excluded ? 'excluded' : 'partial')} role="status">
          <p><Fa name={rule.excluded ? 'ban' : 'robot'} /> <b>{rule.excluded ? t('IA exclue') : t('Exclusion partielle')}</b></p>
          <p>{ruleText(rule)}</p>
          {rule.reason ? <p className="muted small">{t('Motif : {reason}', { reason: rule.reason })}</p> : null}
        </div>
      ) : <p className="muted small"><Fa name="robot" /> {t("L'IA répond normalement à ce contact.")}</p>}
      {canAct ? (
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn small" type="button" onClick={() => openRule(ws, { mode: 'full', target, label, current: rule, done: onChange })}><Fa name="ban" /> {rule && rule.excluded ? t('Changer la durée') : t('Exclure')}</button>
          <button className="btn small" type="button" onClick={() => openRule(ws, { mode: 'partial', target, label, current: rule, done: onChange })}>{rule && !rule.excluded ? t('Modifier l\'exclusion partielle') : t('Exclusion partielle')}</button>
          {rule ? <button className="btn small" type="button" onClick={lift}>{t('Lever la règle')}</button> : null}
        </div>
      ) : null}
    </>
  );
}
