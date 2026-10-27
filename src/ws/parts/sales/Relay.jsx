import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';

/* Passage de relais : quand l'assistant passe la main à un humain, un message WhatsApp d'alerte part vers le responsable prioritaire
   (depuis le WhatsApp connecté à l'IA). Repli : notice dans l'application et e-mail. */

const STATUS = { sent: ['Envoyée sur WhatsApp', 'good'], grouped: ['Message groupé', 'good'], fallback_email: ['Repli : notice et e-mail', 'mid'], quiet: ['Heures calmes : notice et e-mail', 'mid'], rate: ['Plafond atteint : regroupée', 'mid'], failed: ['Échec', 'bad'], test_sent: ['Test envoyé', 'good'], test_failed: ['Test en échec', 'bad'] };

export function Relay() {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/relay'), []);
  return <Loaded state={st}>{(j) => <Body j={j} reload={st.reload} t={t} oapi={oapi} toast={toast} fail={fail} />}</Loaded>;
}

function Body({ j, reload, t, oapi, toast, fail }) {
  const { dateFr } = useWs();
  const real = j.contacts.filter((c) => !c.isDefault);
  const [rows, setRows] = useState(real.length ? real.map((c) => ({ userId: String(c.userId), phone: c.phone })) : []);
  const [s, setS] = useState({ enabled: j.settings.enabled, maxPerHour: String(j.settings.maxPerHour), quietFrom: String(j.settings.quietFrom), quietTo: String(j.settings.quietTo), tzOffset: String(j.settings.tzOffset) });
  const [res, setRes] = useState(null);
  const setRow = (i, k, x) => setRows((r) => r.map((y, n) => (n === i ? { ...y, [k]: x } : y)));
  const saveContacts = () => oapi('PUT', '/sales/relay/contacts', { contacts: rows.filter((r) => r.userId && r.phone).map((r) => ({ userId: Number(r.userId), phone: r.phone })) }).then(() => { toast(t('Responsables enregistrés.')); reload(); }).catch(fail);
  const saveSettings = (ev) => { ev.preventDefault(); oapi('PUT', '/sales/relay/settings', { enabled: s.enabled, maxPerHour: Number(s.maxPerHour), quietFrom: Number(s.quietFrom), quietTo: Number(s.quietTo), tzOffset: Number(s.tzOffset) }).then(() => { toast(t('Réglages enregistrés.')); reload(); }).catch(fail); };
  return (
    <>
      <div className="ws-card">
        <h2>{t('Passage de relais par WhatsApp')}</h2>
        <p className="muted small">{t("Quand l'assistant passe la main (client qui veut un humain, prix hors règles, réclamation…), un message WhatsApp part vers le responsable prioritaire : client, motif, dernier message, négociation en cours et lien vers la conversation. Il part du WhatsApp connecté à l'IA.")}</p>
        {!j.connected ? <p className="ws-err" role="alert">{t("WhatsApp n'est pas connecté (onglet Canaux) : le relais passera par une notice dans l'application et un e-mail.")}</p> : <p className="muted small">{t('WhatsApp connecté : {number} ({mode}).', { number: '+' + j.connectedNumber, mode: j.mode === 'qr' ? t('QR code') : t('Meta') })}</p>}
        <form className="ws-form" onSubmit={saveSettings}>
          <label className="row" htmlFor="rl_on" style={{ gap: 8 }}><input id="rl_on" type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /><span>{t('Activer les alertes de passage de relais')}</span></label>
          <label className="fld" htmlFor="rl_max"><span>{t("Maximum d'alertes WhatsApp par heure")}</span><input id="rl_max" type="number" min="1" max="60" value={s.maxPerHour} onChange={(e) => setS({ ...s, maxPerHour: e.target.value })} /><small>{t('Au-delà : un seul message groupé, le reste en notice.')}</small></label>
          <div className="row">
            <label className="fld" htmlFor="rl_qf"><span>{t('Heures calmes : de (0 à 23, -1 = aucune)')}</span><input id="rl_qf" type="number" min="-1" max="23" value={s.quietFrom} onChange={(e) => setS({ ...s, quietFrom: e.target.value })} /></label>
            <label className="fld" htmlFor="rl_qt"><span>{t('à')}</span><input id="rl_qt" type="number" min="-1" max="23" value={s.quietTo} onChange={(e) => setS({ ...s, quietTo: e.target.value })} /></label>
            <label className="fld" htmlFor="rl_tz"><span>{t('Décalage horaire (minutes par rapport à UTC)')}</span><input id="rl_tz" type="number" value={s.tzOffset} onChange={(e) => setS({ ...s, tzOffset: e.target.value })} /></label>
          </div>
          <div className="row"><button className="btn primary" type="submit">{t('Enregistrer')}</button></div>
        </form>
      </div>
      <div className="ws-card">
        <h2>{t('Responsables prioritaires')}</h2>
        <p className="muted small">{t("De 1 à 3 responsables, par ordre de priorité : le premier est prévenu ; s'il est injoignable, le suivant. Jamais un numéro de client. Sans réglage : le propriétaire, sur le numéro connecté (message à soi-même, possible en mode QR).")}</p>
        {j.contacts.some((c) => c.isDefault) ? <p>{t('Par défaut : {name} sur le numéro connecté.', { name: j.contacts[0].name })}</p> : null}
        {rows.map((r, i) => (
          <div className="row" key={i} style={{ marginBottom: 6 }}>
            <span>{i + 1}.</span>
            <select aria-label={t('Responsable')} value={r.userId} onChange={(e) => setRow(i, 'userId', e.target.value)}>
              <option value="">{t('Choisir…')}</option>
              {j.members.map((m) => <option key={m.userId} value={String(m.userId)}>{m.name}</option>)}
            </select>
            <input type="tel" aria-label={t('Numéro WhatsApp')} placeholder="237 677 11 22 33" value={r.phone} onChange={(e) => setRow(i, 'phone', e.target.value)} />
            <button className="link" type="button" onClick={() => setRows((x) => x.filter((_, n) => n !== i))}>{t('Retirer')}</button>
          </div>
        ))}
        <div className="row">
          {rows.length < 3 ? <button className="btn small" type="button" onClick={() => setRows((x) => [...x, { userId: '', phone: '' }])}>{t('Ajouter un responsable')}</button> : null}
          <button className="btn primary small" type="button" onClick={saveContacts}>{t('Enregistrer les responsables')}</button>
          <button className="btn small" type="button" onClick={() => oapi('POST', '/sales/relay/test', {}).then((r) => { setRes(r); reload(); }).catch((e) => setRes({ ok: false, error: e.message }))}>{t('Envoyer un test')}</button>
        </div>
        {res ? <p className={res.ok ? '' : 'ws-err'} role="status">{res.ok ? t('Message de test envoyé.') + (res.self ? ' ' + t('(message à soi-même)') : '') : t('Le test a échoué : {error}', { error: res.error })}</p> : null}
      </div>
      <div className="ws-card">
        <h2>{t('Journal des alertes de relais')}</h2>
        {!j.log.length ? <Empty text={t('Aucune alerte pour le moment.')} /> : null}
        {j.log.map((l) => (
          <div className="line" key={l.id}>
            <span><b>{l.chatId ? t('Conversation n° {id}', { id: l.chatId }) : t('Message système')}</b><small>{(l.to ? ' · ' + l.to : '') + (l.detail ? ' · ' + l.detail : '')}</small></span>
            <span className="row"><span className={'pill ' + ((STATUS[l.status] || [])[1] || '')}>{t((STATUS[l.status] || [l.status])[0])}</span><small>{dateFr(String(l.at).slice(0, 10))}</small></span>
          </div>
        ))}
      </div>
    </>
  );
}
