import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';

/* Résumé du matin et alertes urgentes sur WhatsApp (responsables et plus). Consentement explicite, désabonnement en un clic.
   Rappel honnête : WhatsApp ne livre un texte libre que si la personne a écrit au numéro de l'entreprise dans les dernières 24 h. */

const PILL = { delivered: 'good', emailed: 'mid', window_closed: 'bad', failed: 'bad', pending: 'mid' };
const LABEL = {
  delivered: 'Livré sur WhatsApp',
  window_closed: 'Non livré (fenêtre WhatsApp fermée)',
  emailed: "Non livré sur WhatsApp, envoyé par e-mail",
  failed: 'Non livré',
  pending: 'En cours',
};

export default function Digest() {
  const { oapi, toast, fail, dateFr } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/mail/digest'), []);
  return (
    <div className="ws-card" style={{ marginTop: 18 }}>
      <h2>{t('Résumé du matin et alertes sur WhatsApp')}</h2>
      <Loaded state={st}>{(j) => <Body j={j} reload={st.reload} oapi={oapi} toast={toast} fail={fail} dateFr={dateFr} />}</Loaded>
    </div>
  );
}

function Body({ j, reload, oapi, toast, fail, dateFr }) {
  const t = useT();
  const [v, setV] = useState({ phone: j.me.phone, morning: j.me.morning, urgent: j.me.urgent, hour: j.me.hour, templateName: j.me.templateName, consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [test, setTest] = useState(null);
  const [s, setS] = useState({ tzOffset: j.settings.tzOffset, urgentMaxPerDay: j.settings.urgentMaxPerDay, handoffHours: j.settings.handoffHours, invoiceLateDays: j.settings.invoiceLateDays });
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const wantsAny = v.morning || v.urgent;
  const samePhone = v.phone.replace(/\D/g, '') === (j.me.phone || '').replace(/\D/g, '');
  const needsConsent = wantsAny && !(j.me.consented && samePhone);

  const save = (ev) => {
    ev.preventDefault(); setBusy(true); setErr(''); setTest(null);
    oapi('PUT', '/mail/digest/me', { phone: v.phone, morning: v.morning, urgent: v.urgent, hour: v.hour, templateName: v.templateName, consent: v.consent }).then(() => { toast(wantsAny ? t('Réglages enregistrés.') : t('Vous êtes désabonné.')); reload(); }, (e) => { setErr(t(e.message)); if (e.status === 401) fail(e); }).then(() => setBusy(false));
  };
  const unsub = () => oapi('POST', '/mail/digest/me/unsubscribe').then(() => { toast(t('Vous êtes désabonné : plus aucun message ne sera envoyé.')); reload(); }, fail);
  const sendTest = () => { setBusy(true); setErr(''); setTest(null); oapi('POST', '/mail/digest/test').then((r) => { setTest(r); reload(); }, (e) => setErr(t(e.message))).then(() => setBusy(false)); };
  const saveSettings = (ev) => {
    ev.preventDefault();
    oapi('PUT', '/mail/digest/settings', s).then(() => { toast(t("Réglages de l'organisation enregistrés.")); reload(); }, (e) => toast(t(e.message), true));
  };
  const last = j.last;

  return (
    <>
      <p className="muted small">{t("Recevez chaque matin un court point (impayés, stock, tâches en retard, échéances, conversations en attente) et, si vous le souhaitez, une alerte quand quelque chose d'urgent arrive. Le message est préparé par MANAGER-IA, sans IA.")}</p>
      {!j.connected ? <p className="ws-err">{t("WhatsApp n'est pas encore connecté pour cette organisation (module « Assistant commercial »). Sans connexion, les messages partiront par e-mail si votre adresse est connue.")}</p> : null}

      <form className="ws-form" onSubmit={save}>
        <label className="fld" htmlFor="dg_phone"><span>{t('Votre numéro WhatsApp')}</span><input id="dg_phone" type="tel" inputMode="tel" placeholder="237 677 11 22 33" value={v.phone} onChange={(e) => set('phone', e.target.value)} /><small>{t("Avec l'indicatif du pays.")}</small></label>
        <label className="row" htmlFor="dg_m" style={{ gap: 8 }}><input id="dg_m" type="checkbox" checked={v.morning} onChange={(e) => set('morning', e.target.checked)} /><span>{t('Recevoir le résumé du matin')}</span></label>
        <label className="fld" htmlFor="dg_h"><span>{t("Heure d'envoi (heure de votre organisation)")}</span><input id="dg_h" type="time" value={v.hour} onChange={(e) => set('hour', e.target.value)} /></label>
        <label className="row" htmlFor="dg_u" style={{ gap: 8 }}><input id="dg_u" type="checkbox" checked={v.urgent} onChange={(e) => set('urgent', e.target.checked)} /><span>{t("Recevoir les alertes urgentes (rupture de stock, facture très en retard, client en attente d'un conseiller)")}</span></label>
        {needsConsent ? (
          <label className="row" htmlFor="dg_c" style={{ gap: 8, alignItems: 'flex-start' }}><input id="dg_c" type="checkbox" checked={v.consent} onChange={(e) => set('consent', e.target.checked)} /><span>{t(j.consentText)}</span></label>
        ) : null}
        {j.me.consented && j.me.consentAt ? <p className="small muted">{t('Consentement enregistré le {date}.', { date: dateFr(j.me.consentAt) })}</p> : null}
        <label className="fld" htmlFor="dg_t"><span>{t('Nom du modèle de message approuvé par Meta (facultatif)')}</span><input id="dg_t" type="text" placeholder="resume_matin" autoComplete="off" value={v.templateName} onChange={(e) => set('templateName', e.target.value)} />
          <small>{t("Utilisé à la place du texte libre quand il est renseigné. Le modèle doit contenir une seule variable {{1}} (le texte du résumé).")}</small></label>
        <p className="ws-err" role="alert">{err}</p>
        <div className="row">
          <button className="btn primary" type="submit" disabled={busy}>{t('Enregistrer')}</button>
          <button className="btn" type="button" disabled={busy || !j.me.consented} onClick={sendTest}>{t('Envoyer un test maintenant')}</button>
          {j.me.consented ? <button className="btn" type="button" onClick={unsub}>{t('Me désabonner')}</button> : null}
        </div>
      </form>

      {test ? <p className={'ai-out dc'} style={{ padding: '10px 14px', marginTop: 10 }}>{t('Test : {result}', { result: (LABEL[test.status] ? t(LABEL[test.status]) : t(test.statusText)) + (test.waError ? ' — ' + test.waError : '') })}</p> : null}

      <h3 style={{ marginTop: 18 }}>{t('Dernier envoi')}</h3>
      {last ? (
        <p><span className={'pill ' + (PILL[last.status] || 'mid')}>{LABEL[last.status] ? t(LABEL[last.status]) : last.status}</span>{' '}<small>{t(last.kindLabel) + ', ' + dateFr(last.at)}</small></p>
      ) : <p className="muted small">{t('Aucun envoi pour le moment.')}</p>}
      <details>
        <summary>{t('Pourquoi un message peut ne pas arriver sur WhatsApp ?')}</summary>
        <p className="small">{t("WhatsApp n'autorise un message libre que si vous avez écrit au numéro WhatsApp de l'entreprise dans les dernières 24 heures. Sinon, Meta refuse le message : il faut alors un modèle de message approuvé par Meta (renseignez son nom ci-dessus). En attendant, MANAGER-IA vous envoie le même message par e-mail si une adresse est enregistrée sur votre compte. Astuce : écrivez « Bonjour » au numéro de l'entreprise chaque matin pour garder la fenêtre ouverte.")}</p>
      </details>

      <h3 style={{ marginTop: 18 }}>{t('Journal des envois')}</h3>
      {!j.log.length ? <Empty text={t('Aucun envoi pour le moment.')} /> : null}
      {j.log.map((l) => (
        <div className="line" key={l.id}>
          <span><b>{t(l.kindLabel)}</b>{l.who ? <small>{' · ' + l.who}</small> : null}{l.waError ? <><br /><small style={{ overflowWrap: 'anywhere' }}>{l.waError}</small></> : null}</span>
          <span className="row"><span className={'pill ' + (PILL[l.status] || 'mid')}>{LABEL[l.status] ? t(LABEL[l.status]) : l.status}</span><small>{dateFr(l.at)}</small></span>
        </div>
      ))}

      {j.settings.canEdit ? (
        <>
          <h3 style={{ marginTop: 18 }}>{t("Réglages de l'organisation")}</h3>
          <form className="ws-form" onSubmit={saveSettings}>
            <label className="fld" htmlFor="ds_tz"><span>{t('Décalage horaire (minutes par rapport à UTC)')}</span><input id="ds_tz" type="number" value={s.tzOffset} onChange={(e) => setS({ ...s, tzOffset: e.target.value })} /><small>{t('60 = UTC+1 (Cameroun).')}</small></label>
            <label className="fld" htmlFor="ds_max"><span>{t('Alertes urgentes : maximum par jour et par personne')}</span><input id="ds_max" type="number" min="1" max="20" value={s.urgentMaxPerDay} onChange={(e) => setS({ ...s, urgentMaxPerDay: e.target.value })} /></label>
            <label className="fld" htmlFor="ds_h"><span>{t('Conversation en attente : alerter après (heures)')}</span><input id="ds_h" type="number" min="1" max="72" value={s.handoffHours} onChange={(e) => setS({ ...s, handoffHours: e.target.value })} /></label>
            <label className="fld" htmlFor="ds_i"><span>{t('Facture « très en retard » : après (jours)')}</span><input id="ds_i" type="number" min="1" max="365" value={s.invoiceLateDays} onChange={(e) => setS({ ...s, invoiceLateDays: e.target.value })} /></label>
            <div className="row"><button className="btn small" type="submit">{t('Enregistrer ces réglages')}</button></div>
          </form>
        </>
      ) : null}
    </>
  );
}
