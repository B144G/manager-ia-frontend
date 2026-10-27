import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Followup } from './Followup.jsx';

/* Centre de relances : prospects silencieux, devis sans réponse, factures échues, commandes à valider qui traînent, factures non payées.
   E-mail par défaut ; WhatsApp si connecté (repli e-mail) ; ou copie du message. Mode « proposer, je valide » (défaut) ou « automatique ». */

const RESULT = { sent: ['Envoyée', 'good'], fallback_email: ['Envoyée par e-mail (repli)', 'mid'], manual: ['Envoi manuel', 'good'], failed: ['Échec', 'bad'], postponed: ['Reportée', 'mid'], ignored: ['Ignorée', ''], stopped: ['Arrêtée', ''] };
const CH = { email: 'E-mail', whatsapp: 'WhatsApp', manual: 'Copier / wa.me', team: 'Équipe' };

export function Relances({ admin }) {
  const t = useT();
  const { oapi } = useWs();
  const [sub, setSub] = useState('queue');
  const st = useLoad(() => oapi('GET', '/sales/followups'), []);
  const tabs = [['queue', t('File')], ['settings', t('Réglages')], ['templates', t('Modèles')], ['log', t('Journal')], ['meta', t('WhatsApp (modèles Meta)')]];
  return (
    <>
      <div className="ws-tabs">{tabs.map((x) => <button key={x[0]} type="button" className={'tab' + (sub === x[0] ? ' on' : '')} onClick={() => setSub(x[0])}>{x[1]}</button>)}</div>
      {sub === 'meta' ? <Followup admin={admin} /> : <Loaded state={st}>{(j) => (
        sub === 'queue' ? <Queue j={j} reload={st.reload} admin={admin} />
          : sub === 'settings' ? <Settings j={j} reload={st.reload} admin={admin} />
            : sub === 'templates' ? <Templates j={j} reload={st.reload} />
              : <Log j={j} />
      )}</Loaded>}
    </>
  );
}

function Queue({ j, reload, admin }) {
  const t = useT();
  const { oapi, money, dateFr, toast, fail, copy, confirm } = useWs();
  const [busy, setBusy] = useState(0);
  const [edit, setEdit] = useState(null);
  const st = j.settings;
  const chLabel = (c) => t(CH[c] || c);
  const act = (p) => { setBusy(1); return p.then((r) => { reload(); return r; }).catch(fail).then((r) => { setBusy(0); return r; }); };
  const send = (it, body) => act(oapi('POST', '/sales/followups/items/' + it.id + '/send', body || {})).then((r) => {
    if (!r) return;
    if (r.channel === 'manual') return showManual(r);
    toast(r.fallback ? t("WhatsApp n'a pas livré : envoyé par e-mail.") : t('Relance envoyée.'));
    return undefined;
  });
  const { modal } = useWs();
  const showManual = (r) => modal(t('Message à envoyer vous-même'), () => (
    <>
      <textarea rows={8} readOnly aria-label={t('Message')} value={r.text} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary small" type="button" onClick={() => copy(r.text, t('Message copié.'))}>{t('Copier le message')}</button>
        {r.waLink ? <a className="btn small" href={r.waLink} target="_blank" rel="noopener noreferrer">{t('Ouvrir WhatsApp (wa.me)')}</a> : null}
      </div>
      <p className="muted small">{t("La relance est notée comme envoyée : c'est à vous de l'envoyer.")}</p>
    </>
  ));
  const draft = (it) => act(oapi('POST', '/sales/followups/items/' + it.id + '/draft', {})).then((r) => { if (r) setEdit({ id: it.id, subject: r.subject || it.subject, body: r.body }); });
  const [open, setOpen] = useState(null);
  return (
    <>
      {!j.channels.emailEnabled ? <p className="ws-err" role="alert">{t("L'envoi d'e-mails n'est pas activé sur ce serveur : les relances par e-mail ne partiront pas (vous pouvez copier le message).")}</p> : null}
      <div className="ws-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('Relances à traiter ({n})', { n: j.queue.length })}</h2>
          {admin ? <button className="btn small" type="button" disabled={busy > 0} onClick={() => act(oapi('POST', '/sales/followups/run', {})).then((r) => { if (r) toast(t('Passage effectué : {n} relance(s) envoyée(s).', { n: r.sent })); })}>{t('Lancer le passage maintenant')}</button> : null}
        </div>
        <p className="muted small">{st.mode === 'auto' ? t('Mode automatique : les relances partent seules pendant les heures d\'envoi, dans la limite du quota. Vous pouvez aussi les traiter ici.') : t('Mode « proposer, je valide » : rien ne part sans votre accord.')}{' ' + t('Quota du jour : {sent} sur {cap}.', { sent: j.quota.sentToday, cap: j.quota.dayQuota })}</p>
        {!j.queue.length ? <Empty text={t('Aucune relance à traiter pour le moment.')} /> : null}
        {j.queue.map((it) => (
          <div className="line" key={it.id} style={{ display: 'block' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                <b>{t(it.kindLabel) + ' · ' + t('relance {n}', { n: it.step })}</b>
                <small>{' ' + it.customer + (it.number ? ' · ' + it.number : '') + (it.amount != null ? ' · ' + money(it.amount) : '') + (it.due ? ' · ' + t('échue le {date}', { date: dateFr(it.due) }) : '') + ' · ' + t('{n} jour(s)', { n: it.days })}</small>
                {it.state === 'postponed' ? <small>{' · ' + t('reportée')}</small> : null}
                {it.lastError ? <small className="ws-err">{' · ' + t(it.lastError)}</small> : null}
              </span>
              <span className="row">
                <select aria-label={t('Canal')} value={it.channel} disabled={it.internal} onChange={(e) => act(oapi('PUT', '/sales/followups/items/' + it.id + '/channel', { channel: e.target.value }))}>
                  <option value="">{t('Canal par défaut') + ' (' + chLabel(st.channel) + ')'}</option>
                  {['email', 'whatsapp', 'manual'].map((c) => <option key={c} value={c}>{chLabel(c)}</option>)}
                </select>
                <button className="btn primary small" type="button" disabled={busy > 0} onClick={() => send(it)}>{it.internal ? t('Prévenir les responsables') : t('Envoyer')}</button>
                <button className="link" type="button" onClick={() => setOpen(open === it.id ? null : it.id)}>{t('Aperçu')}</button>
                <button className="link" type="button" onClick={() => act(oapi('POST', '/sales/followups/items/' + it.id + '/postpone', { days: 3 })).then(() => toast(t('Reportée de 3 jours.')))}>{t('Reporter')}</button>
                <button className="link" type="button" onClick={() => confirm(t('Ignorer cette relance ?'), () => act(oapi('POST', '/sales/followups/items/' + it.id + '/ignore', {})))}>{t('Ignorer')}</button>
                {!it.internal ? <button className="link" type="button" onClick={() => act(oapi('POST', '/sales/followups/items/' + it.id + '/replied', {})).then(() => toast(t('Relances arrêtées pour ce dossier.')))}>{t('Le client a répondu')}</button> : null}
              </span>
            </div>
            {!it.internal && !it.hasEmail && it.effectiveChannel === 'email' ? <small className="muted">{t("Ce client n'a pas d'adresse e-mail : choisissez un autre canal ou ajoutez-la sur sa fiche.")}</small> : null}
            {open === it.id ? (
              <div style={{ margin: '8px 0' }}>
                <p><b>{it.subject}</b></p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{it.body}</p>
                {!it.internal ? <button className="btn small" type="button" onClick={() => setEdit({ id: it.id, subject: it.subject, body: it.body })}>{t('Modifier avant envoi')}</button> : null}{' '}
                {!it.internal ? <button className="btn small" type="button" disabled={busy > 0} onClick={() => draft(it)}>{t('Brouillon avec l\'IA')}</button> : null}
              </div>
            ) : null}
            {edit && edit.id === it.id ? (
              <div style={{ margin: '8px 0' }}>
                <label className="fld"><span>{t('Objet')}</span><input type="text" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} aria-label={t('Objet')} /></label>
                <label className="fld"><span>{t('Message')}</span><textarea rows={7} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} aria-label={t('Message')} /></label>
                <p className="muted small">{t("Un brouillon de l'IA n'est jamais envoyé sans votre validation.")}</p>
                <div className="row"><button className="btn primary small" type="button" disabled={busy > 0} onClick={() => send(it, { subject: edit.subject, body: edit.body }).then(() => setEdit(null))}>{t('Envoyer ce texte')}</button><button className="btn small" type="button" onClick={() => setEdit(null)}>{t('Annuler')}</button></div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className="muted small">{t('{n} client(s) opposé(s) aux relances : ils ne sont jamais relancés. Chaque e-mail contient un lien pour ne plus en recevoir.', { n: j.optouts })}</p>
    </>
  );
}

function Settings({ j, reload, admin }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const s = j.settings;
  const [v, setV] = useState({ mode: s.mode, channel: s.channel, cad: { ...s.cadences }, maxPerItem: String(s.maxPerItem), dayQuota: String(s.dayQuota), hourFrom: String(s.hourFrom), hourTo: String(s.hourTo), tzOffset: String(s.tzOffset) });
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const save = (ev) => {
    ev.preventDefault();
    oapi('PUT', '/sales/followups/settings', { mode: v.mode, channel: v.channel, cadences: v.cad, maxPerItem: Number(v.maxPerItem), dayQuota: Number(v.dayQuota), hourFrom: Number(v.hourFrom), hourTo: Number(v.hourTo), tzOffset: Number(v.tzOffset) }).then(() => { toast(t('Réglages enregistrés.')); reload(); }).catch(fail);
  };
  const dis = !admin;
  return (
    <div className="ws-card">
      <h2>{t('Réglages des relances')}</h2>
      {!admin ? <p className="muted small">{t('Seul un administrateur peut modifier ces réglages.')}</p> : null}
      <form className="ws-form" onSubmit={save}>
        <label className="fld" htmlFor="fu_mode"><span>{t('Mode')}</span>
          <select id="fu_mode" disabled={dis} value={v.mode} onChange={(e) => set('mode', e.target.value)}>
            <option value="propose">{t('Proposer, je valide (conseillé)')}</option>
            <option value="auto">{t('Automatique (pendant les heures d\'envoi)')}</option>
          </select></label>
        <label className="fld" htmlFor="fu_ch"><span>{t('Canal par défaut')}</span>
          <select id="fu_ch" disabled={dis} value={v.channel} onChange={(e) => set('channel', e.target.value)}>
            <option value="email">{t('E-mail (recommandé)')}</option>
            <option value="whatsapp">{t('WhatsApp (repli e-mail si non livré)')}</option>
            <option value="manual">{t('Copier le message / lien wa.me')}</option>
          </select>
          <small>{j.channels.whatsappConnected ? t('WhatsApp est connecté ({mode}).', { mode: j.channels.whatsappMode === 'qr' ? t('QR code : texte libre') : t('Meta : modèle approuvé hors fenêtre de 24 h') }) : t("WhatsApp n'est pas connecté : l'e-mail est utilisé.")}</small></label>
        {Object.keys(j.kinds).map((k) => (
          <label className="fld" htmlFor={'fu_c_' + k} key={k}><span>{t('Cadence : {kind} (jours, séparés par des virgules)', { kind: t(j.kinds[k].label) })}</span><input id={'fu_c_' + k} disabled={dis} type="text" value={v.cad[k]} onChange={(e) => setV((o) => ({ ...o, cad: { ...o.cad, [k]: e.target.value } }))} />
            {k === 'invoice' ? <small>{t('Jours après l\'échéance. Par défaut : 3, 10, 20.')}</small> : null}</label>
        ))}
        <label className="fld" htmlFor="fu_max"><span>{t('Nombre maximum de relances par dossier')}</span><input id="fu_max" disabled={dis} type="number" min="1" max="6" value={v.maxPerItem} onChange={(e) => set('maxPerItem', e.target.value)} /></label>
        <label className="fld" htmlFor="fu_q"><span>{t('Quota de relances par jour')}</span><input id="fu_q" disabled={dis} type="number" min="1" max="500" value={v.dayQuota} onChange={(e) => set('dayQuota', e.target.value)} /><small>{t("Le quota d'e-mails de votre offre s'applique aussi.")}</small></label>
        <div className="row">
          <label className="fld" htmlFor="fu_hf"><span>{t("Heures d'envoi : de")}</span><input id="fu_hf" disabled={dis} type="number" min="0" max="23" value={v.hourFrom} onChange={(e) => set('hourFrom', e.target.value)} /></label>
          <label className="fld" htmlFor="fu_ht"><span>{t('à')}</span><input id="fu_ht" disabled={dis} type="number" min="1" max="24" value={v.hourTo} onChange={(e) => set('hourTo', e.target.value)} /></label>
          <label className="fld" htmlFor="fu_tz"><span>{t('Décalage horaire (minutes par rapport à UTC)')}</span><input id="fu_tz" disabled={dis} type="number" value={v.tzOffset} onChange={(e) => set('tzOffset', e.target.value)} /></label>
        </div>
        {admin ? <div className="row"><button className="btn primary" type="submit">{t('Enregistrer')}</button></div> : null}
      </form>
      <p className="muted small">{t("Une relance s'arrête toute seule dès que le client répond ou paie. Chaque étape n'est créée qu'une fois ; un verrou empêche tout envoi en double.")}</p>
    </div>
  );
}

function Templates({ j, reload }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const [kind, setKind] = useState('invoice');
  const tp = j.templates.find((x) => x.kind === kind);
  const [v, setV] = useState({ subject: tp.subject, body: tp.body });
  const [prev, setPrev] = useState(null);
  const pick = (k) => { const x = j.templates.find((y) => y.kind === k); setKind(k); setV({ subject: x.subject, body: x.body }); setPrev(null); };
  return (
    <div className="ws-card">
      <h2>{t('Modèles de messages')}</h2>
      <p className="muted small">{t('Variables : {vars}. Le message est rédigé en français ; vous pouvez le modifier librement.', { vars: j.variables.map((x) => '{' + x + '}').join(' ') })}</p>
      <label className="fld" htmlFor="tp_k"><span>{t('Type de relance')}</span><select id="tp_k" value={kind} onChange={(e) => pick(e.target.value)}>{j.templates.map((x) => <option key={x.kind} value={x.kind}>{t(x.label)}</option>)}</select></label>
      <label className="fld" htmlFor="tp_s"><span>{t('Objet')}</span><input id="tp_s" type="text" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} /></label>
      <label className="fld" htmlFor="tp_b"><span>{t('Message')}</span><textarea id="tp_b" rows={9} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></label>
      <div className="row">
        <button className="btn primary small" type="button" onClick={() => oapi('PUT', '/sales/followups/templates/' + kind, v).then(() => { toast(t('Modèle enregistré.')); reload(); }).catch(fail)}>{t('Enregistrer')}</button>
        <button className="btn small" type="button" onClick={() => oapi('POST', '/sales/followups/templates/preview', v).then(setPrev).catch(fail)}>{t('Aperçu')}</button>
        <button className="btn small" type="button" onClick={() => oapi('DELETE', '/sales/followups/templates/' + kind).then(() => { toast(t('Modèle d\'origine rétabli.')); reload(); setV({ subject: tp.default.subject, body: tp.default.body }); }).catch(fail)}>{t("Rétablir le modèle d'origine")}</button>
      </div>
      {prev ? <div className="ai-out" style={{ padding: '10px 14px', marginTop: 10 }}><p className="muted small">{t("Aperçu avec des données d'exemple")}</p><p><b>{prev.subject}</b></p><p style={{ whiteSpace: 'pre-wrap' }}>{prev.body}</p></div> : null}
    </div>
  );
}

function Log({ j }) {
  const t = useT();
  const { dateFr } = useWs();
  return (
    <div className="ws-card">
      <h2>{t('Journal des relances')}</h2>
      {!j.log.length ? <Empty text={t('Aucune relance pour le moment.')} /> : null}
      {j.log.map((l) => (
        <div className="line" key={l.id}>
          <span><b>{t(l.kindLabel) + ' · ' + t('relance {n}', { n: l.step })}</b><small>{' ' + (l.customer || '') + ' · ' + (l.channel ? t(CH[l.channel] || l.channel) + ' · ' : '') + (l.auto ? t('automatique') : l.who || '') + (l.detail ? ' · ' + l.detail : '')}</small></span>
          <span className="row"><span className={'pill ' + ((RESULT[l.result] || [])[1] || '')}>{t((RESULT[l.result] || [l.result])[0])}</span><small>{dateFr(String(l.at).slice(0, 10))}</small></span>
        </div>
      ))}
    </div>
  );
}
