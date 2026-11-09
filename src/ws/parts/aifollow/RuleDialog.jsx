import { useState } from 'react';
import { useT, tr } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { FLAGS } from './util.jsx';

/* Fenêtre « Exclure » (mode full) et « Exclusion partielle » (mode partial). target = { customerId } ou { chatId }. */
export function openRule(ws, { mode, target, label, current, done }) {
  ws.modal(mode === 'full' ? tr('Exclure l\'IA pour {name}', { name: label }) : tr('Exclusion partielle pour {name}', { name: label }),
    (close) => <RuleForm mode={mode} target={target} current={current} close={close} done={done} />);
}

function RuleForm({ mode, target, current, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const [duration, setDuration] = useState('24h');
  const [reason, setReason] = useState(current && current.reason ? current.reason : '');
  const [flags, setFlags] = useState(() => Object.fromEntries(FLAGS.map(([k]) => [k, Boolean(current && current[k])])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const full = mode === 'full';
  function submit(ev) {
    ev.preventDefault();
    setErr('');
    if (!full && !Object.values(flags).some(Boolean)) { setErr(t("Cochez au moins une chose que l'IA n'a pas le droit de faire.")); return; }
    setBusy(true);
    oapi('POST', '/aifollow/rules', { ...target, mode, duration, reason, flags })
      .then(() => { toast(full ? t("L'IA ne répondra plus à ce contact.") : t('Exclusion partielle enregistrée.')); close(); if (done) done(); })
      .catch((e) => { setErr(t(e.message)); setBusy(false); });
  }
  return (
    <form className="ws-form" onSubmit={submit} noValidate>
      {full
        ? <p>{t("L'IA ne répondra plus du tout à ce contact, sur aucun canal. Ses messages continuent d'arriver et de s'afficher ; l'équipe est prévenue et répond à la main.")}</p>
        : (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="muted small">{t("Cochez ce que l'IA n'a PAS le droit de faire avec ce contact :")}</legend>
            <div className="af-checks">
              {FLAGS.map(([k, label, hint]) => (
                <label key={k}>
                  <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} />
                  <span><b>{t(label)}</b><small>{t(hint)}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      <label className="fld" htmlFor="af_dur">
        <span>{t('Pendant combien de temps ?')}</span>
        <select id="af_dur" style={{ fontSize: 16 }} value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="24h">{t('24 heures')}</option>
          <option value="7d">{t('7 jours')}</option>
          <option value="none">{t('Sans limite (jusqu\'à ce que vous leviez la règle)')}</option>
        </select>
      </label>
      <label className="fld" htmlFor="af_reason">
        <span>{t('Motif (facultatif)')}</span>
        <input id="af_reason" style={{ fontSize: 16 }} type="text" maxLength={300} autoComplete="off" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Ex. : litige en cours, client important…')} />
      </label>
      <p className="muted small">{t('Vous pouvez lever la règle à tout moment. À la fin de la durée choisie, elle se lève toute seule.')}</p>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={busy}>{full ? t('Exclure l\'IA') : t('Enregistrer')}</button></div>
    </form>
  );
}
