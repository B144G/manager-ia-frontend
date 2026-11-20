import { useEffect, useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Loaded, useLoad, Icon, Alert } from '../../ui.jsx';
import { gpsHere } from './geocode.js';
import { StatePill, TG, useAge } from './common.jsx';

/* « Ma position » (téléphone du transporteur) : consentement explicite, service en cours (seul moment où la position est suivie),
   envoi périodique tant que cette page reste ouverte, effacement de l'historique, retrait du consentement. Aucun envoi en arrière-plan. */
export default function GeoMe() {
  const t = useT();
  const { oapi, toast, fail, confirm } = useWs();
  const age = useAge();
  const st = useLoad(() => oapi('GET', TG + '/me'), []);
  const [agree, setAgree] = useState(false);
  const [last, setLast] = useState(null); const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const j = st.data;
  const on = Boolean(j && j.driver.shiftOn);
  const ping = Number(j ? j.notice.pingMin : 5);

  const send = () => gpsHere().then((p) => oapi('POST', TG + '/me/position', p).then(() => { setLast({ at: new Date(), accuracy: p.accuracy }); setMsg(''); }))
    .catch((e) => setMsg(e && e.message && !/geolocation|unsupported/i.test(e.message) && e.status ? e.message : t("Impossible d'obtenir votre position (GPS éteint ou autorisation refusée).")));
  useEffect(() => {
    if (!on) return undefined;
    send(); timer.current = setInterval(send, ping * 60000);
    return () => clearInterval(timer.current);
  }, [on, ping]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = (path, body, ok) => oapi('POST', TG + path, body).then(() => { if (ok) toast(ok); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(d) => (
      <div className="geo-me">
        <section className="geo-card">
          <h3>{d.driver.name}</h3>
          <p><StatePill d={d.driver} />{d.driver.vehicle ? <span className="muted"> · {d.driver.vehicle.plate}</span> : null}</p>
          {d.driver.manualState ? <small className="muted">{t("Votre responsable a fixé votre statut à la main.")}</small> : null}
        </section>
        {!d.driver.consent ? (
          <section className="geo-card" aria-label={t('Consentement')}>
            <h3><Icon name="lock" />{t('Partager ma position : votre accord')}</h3>
            <ul className="geo-notice">
              <li>{t("À quoi ça sert : votre responsable voit si vous êtes disponible et proche d'un client, pour vous proposer la bonne livraison.")}</li>
              <li>{t('Quand : seulement pendant que vous êtes « en service » (ou en tournée). Jamais en dehors.')}</li>
              <li>{t('Qui voit : les responsables de votre entreprise, personne d\'autre.')}</li>
              <li>{t('Combien de temps : vos positions sont effacées après {n} jours.', { n: d.notice.retentionDays })}</li>
              <li>{t('Vous pouvez arrêter, effacer votre historique ou retirer votre accord à tout moment.')}</li>
            </ul>
            <label className="geo-chk"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{t("J'ai compris et j'accepte de partager ma position pendant mon service.")}</label>
            <button type="button" className="ui-btn primary" disabled={!agree} onClick={() => call('/me/consent', { granted: true }, t('Merci : votre accord est enregistré.'))}><Icon name="check" />{t("J'accepte")}</button>
          </section>
        ) : (
          <section className="geo-card" aria-label={t('Service')}>
            <h3>{on ? t('Vous êtes en service') : t('Vous êtes hors service')}</h3>
            <p className="muted">{on ? t('Votre position est envoyée toutes les {n} minutes tant que cette page reste ouverte. Le service s\'arrête tout seul après {h} h.', { n: ping, h: d.notice.shiftMaxH }) : t('Aucune position n\'est envoyée. Passez « en service » pour être proposé aux clients proches.')}</p>
            <div className="row">
              {on ? <button type="button" className="ui-btn" onClick={() => call('/me/shift', { on: false }, t('Service terminé : plus aucune position envoyée.'))}><Icon name="stop" />{t('Terminer mon service')}</button>
                : <button type="button" className="ui-btn primary" onClick={() => call('/me/shift', { on: true })}><Icon name="location-dot" />{t('Commencer mon service')}</button>}
            </div>
            {on && last ? <p className="geo-sent"><Icon name="ok" />{t('Dernière position envoyée {age} (précision ±{m} m).', { age: age(Math.round((Date.now() - last.at.getTime()) / 60000)), m: last.accuracy || '?' })}</p> : null}
            {on && !last && !msg ? <p className="muted"><Icon name="spinner" spin />{t('Recherche de votre position…')}</p> : null}
            {msg ? <Alert tone="warn">{msg}</Alert> : null}
            {on && d.driver.position ? <small className="muted">{t('Vue par vos responsables : {age}.', { age: age(d.driver.position.ageMin) })}</small> : null}
          </section>
        )}
        <section className="geo-card" aria-label={t('Mes données')}>
          <h3>{t('Mes données')}</h3>
          <div className="row">
            <button type="button" className="ui-btn" onClick={() => confirm(t('Effacer toutes vos positions enregistrées ?'), () => oapi('DELETE', TG + '/me/history').then(() => { toast(t('Historique effacé.')); st.reload(); }).catch(fail), t('Effacer'))}><Icon name="trash" />{t('Effacer mon historique')}</button>
            {d.driver.consent ? <button type="button" className="ui-btn" onClick={() => confirm(t('Retirer votre accord ? Le service s\'arrête et vos positions sont effacées.'), () => call('/me/consent', { granted: false }, t('Accord retiré, historique effacé.')), t('Retirer'))}><Icon name="ban" />{t('Retirer mon accord')}</button> : null}
          </div>
        </section>
      </div>
    )}</Loaded>
  );
}
