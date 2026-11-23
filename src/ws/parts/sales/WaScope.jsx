import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';

/* Portée des réponses automatiques de l'assistant sur WhatsApp : « publicité », « prospects » ou « tout le monde ». */
const MODES = [
  ['all', 'Tout le monde', "L'assistant répond à toute personne qui vous écrit sur WhatsApp. C'est le fonctionnement habituel."],
  ['prospects', 'Uniquement les prospects', "L'assistant répond aux personnes qui ne sont pas encore clientes (contacts nouveaux ou en cours de suivi commercial). Il se tait pour vos clients, fournisseurs, employés et les contacts marqués « ne pas répondre automatiquement »."],
  ['ads', 'Uniquement les contacts venant d\'une publicité', "L'assistant ne répond qu'aux personnes arrivées par une publicité « cliquer pour discuter », par un de vos mots-clés de campagne, ou marquées « publicité » par vous."],
];
const ACTION_LABEL = {
  settings: 'Réglage modifié', exception_add: 'Numéro ajouté à une liste', exception_remove: 'Numéro retiré d\'une liste', origin_set: 'Origine d\'un contact modifiée', import: 'Import de contacts',
  reply_anyway: 'Réponse de l\'assistant demandée à la main', add_to_scope: 'Contact ajouté au périmètre',
};
const SOURCE_LABEL = { ad: 'Publicité', organic: 'Organique (sans publicité)', import: 'Importés', manual: 'Marqués à la main' };

export function WaScope() {
  const t = useT();
  const ws = useWs();
  const { oapi, toast, fail, dateFr } = ws;
  const st = useLoad(() => oapi('GET', '/wa-scope'), []);
  const [mode, setMode] = useState(null);
  const [mMeta, setMMeta] = useState(null);
  const [mQr, setMQr] = useState(null);
  const [kw, setKw] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [exc, setExc] = useState({ phone: '', kind: 'always', label: '' });
  const [mark, setMark] = useState({ phone: '', campaign: '' });
  const [imp, setImp] = useState('');
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  const d = st.data; const s = d.settings;
  const cur = mode === null ? s.mode : mode;
  const curMeta = mMeta === null ? (s.modeMeta || '') : mMeta;
  const curQr = mQr === null ? (s.modeQr || '') : mQr;
  const curKw = kw === null ? s.keywords.join('\n') : kw;
  const dirty = cur !== s.mode || curMeta !== (s.modeMeta || '') || curQr !== (s.modeQr || '') || curKw !== s.keywords.join('\n');
  const done = (msg) => { setMode(null); setMMeta(null); setMQr(null); setKw(null); setErr(''); toast(msg); st.reload(); };

  const save = () => {
    setBusy(true); setErr('');
    oapi('PUT', '/wa-scope', { mode: cur, modeMeta: curMeta, modeQr: curQr, keywords: curKw.split('\n').map((x) => x.trim()).filter(Boolean) })
      .then(() => { setBusy(false); done(t('Réglage enregistré. Il s\'applique dès le prochain message reçu.')); }).catch((e) => { setBusy(false); setErr(t(e.message)); });
  };
  const addExc = (ev) => {
    ev.preventDefault();
    oapi('POST', '/wa-scope/exceptions', exc).then(() => { setExc({ phone: '', kind: exc.kind, label: '' }); toast(t('Numéro ajouté.')); st.reload(); }).catch((e) => setErr(t(e.message)));
  };
  const markAd = (ev) => {
    ev.preventDefault();
    oapi('PUT', '/wa-scope/origin', { phone: mark.phone, ad: true, campaign: mark.campaign }).then(() => { setMark({ phone: '', campaign: '' }); toast(t('Contact marqué « publicité ».')); st.reload(); }).catch((e) => setErr(t(e.message)));
  };
  const doImport = () => {
    const rows = imp.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split(/[;,\t]/).map((x) => x.trim()); return { phone: p[0], ad: !/^(non|no|0|false)$/i.test(p[1] || 'oui'), campaign: p[2] || '' }; });
    oapi('POST', '/wa-scope/import', { rows }).then((r) => { setImp(''); toast(t('{n} contact(s) importé(s), {m} ligne(s) ignorée(s).', { n: r.imported, m: r.skipped })); st.reload(); }).catch((e) => setErr(t(e.message)));
  };
  const rm = (x) => ws.confirm(t('Retirer ce numéro de la liste ?'), () => oapi('DELETE', '/wa-scope/exceptions/' + x.id).then(() => { toast(t('Numéro retiré.')); st.reload(); }).catch(fail));
  const lineName = d.channel === 'qr' ? t('Code QR (WhatsApp Web)') : t('API officielle Meta');
  const inherit = <option value="">{t("Comme le réglage de l'entreprise")}</option>;
  const modeOpts = MODES.map((m) => <option key={m[0]} value={m[0]}>{t(m[1])}</option>);

  return (
    <>
      <div className="ws-card">
        <h2>{t('Qui reçoit les réponses automatiques ?')}</h2>
        <p className="muted">{t("Choisissez à qui l'assistant a le droit de répondre tout seul sur WhatsApp. Pour les autres, le message est enregistré, vous êtes prévenu et vous répondez à la main (ou en un clic avec l'assistant).")}</p>
        <div className="wsc-modes" role="radiogroup" aria-label={t('Portée des réponses automatiques')}>
          {MODES.map((m) => (
            <label key={m[0]} className={'wsc-mode' + (cur === m[0] ? ' on' : '')}>
              <input type="radio" name="wsc-mode" value={m[0]} checked={cur === m[0]} onChange={() => setMode(m[0])} />
              <span><b>{t(m[1])}</b><small>{t(m[2])}</small></span>
            </label>
          ))}
        </div>
        <div className="wsc-grid">
          <label className="fld"><span>{t('Ligne « API officielle Meta »')}</span><select value={curMeta} onChange={(e) => setMMeta(e.target.value)}>{inherit}{modeOpts}</select></label>
          <label className="fld"><span>{t('Ligne « Code QR (WhatsApp Web) »')}</span><select value={curQr} onChange={(e) => setMQr(e.target.value)}>{inherit}{modeOpts}</select></label>
        </div>
        <p className="muted small">{t('Ligne utilisée en ce moment : {line}. Laissez « comme le réglage de l\'entreprise » si vous n\'avez pas besoin de règles différentes par ligne.', { line: lineName })}</p>
        <label className="fld" style={{ display: 'grid', gap: 4, marginTop: 10 }}>
          <span>{t('Mots-clés de campagne (un par ligne)')}</span>
          <textarea rows={4} value={curKw} onChange={(e) => setKw(e.target.value)} placeholder={t('Ex. : PROMO-RENTREE')} style={{ fontSize: 16 }} />
          <small className="muted">{t("Texte pré-rempli dans le lien de votre publicité. Si le premier message d'un contact contient l'un de ces mots (sans tenir compte des majuscules ni des accents), il est classé « publicité ». Utile surtout avec le code QR, où WhatsApp ne donne pas toujours l'origine de la publicité.")}</small>
        </label>
        <p className="ws-err" role="alert">{err}</p>
        <div className="wsc-actions"><button className="btn primary" type="button" disabled={busy || !dirty} onClick={save}>{t('Enregistrer')}</button>{dirty ? <span className="muted small">{t('Modifications non enregistrées')}</span> : null}</div>
        <p className="wsc-note">{t("Ce réglage ne change pas : les demandes « STOP », les contacts exclus dans le Suivi de l'IA, les réponses à valider avant envoi et les limites de sécurité.")}</p>
      </div>

      <div className="ws-card">
        <h2>{t('Ce que veulent dire ces choix')}</h2>
        <dl className="wsc-defs">
          <dt>{t('Contact venant d\'une publicité')}</dt>
          <dd>{t("Son premier message arrive par une publicité « cliquer pour discuter » (Meta le signale), ou contient un de vos mots-clés de campagne ou le marqueur #campagne de votre lien, ou vous l'avez marqué « publicité » à la main ou par import. L'origine est enregistrée avec la date et l'annonce ou la campagne.")}</dd>
          <dt>{t('Prospect')}</dt>
          <dd>{t("Personne qui n'est pas encore cliente : aucune commande, facture ou vente enregistrée. Un contact nouveau ou suivi dans le pipeline commercial est un prospect. Un client, un fournisseur, un employé, un prospect disqualifié ou un contact « ne pas répondre automatiquement » n'en est pas un.")}</dd>
          <dt>{t('Tout le monde')}</dt>
          <dd>{t("Fonctionnement actuel : l'assistant répond à tous.")}</dd>
        </dl>
      </div>

      <div className="ws-card">
        <h2>{t('Exceptions permanentes')}</h2>
        <p className="muted">{t("« Toujours répondre » : le contact reçoit les réponses automatiques même hors du mode choisi. « Jamais répondre » : l'assistant ne lui répond jamais tout seul, quel que soit le mode.")}</p>
        <form className="wsc-add" onSubmit={addExc}>
          <label className="fld"><span>{t('Numéro avec indicatif')}</span><input type="tel" inputMode="tel" placeholder="237677112233" value={exc.phone} onChange={(e) => setExc({ ...exc, phone: e.target.value })} /></label>
          <label className="fld"><span>{t('Liste')}</span><select value={exc.kind} onChange={(e) => setExc({ ...exc, kind: e.target.value })}><option value="always">{t('Toujours répondre')}</option><option value="never">{t('Jamais répondre')}</option></select></label>
          <label className="fld"><span>{t('Nom (facultatif)')}</span><input type="text" maxLength={80} value={exc.label} onChange={(e) => setExc({ ...exc, label: e.target.value })} /></label>
          <button className="btn small" type="submit" disabled={!exc.phone.trim()}>{t('Ajouter')}</button>
        </form>
        {!d.exceptions.length ? <Empty text={t('Aucune exception.')} /> : d.exceptions.map((x) => (
          <div className="line" key={x.id}>
            <span><b>{'+' + x.phone}</b>{x.label ? ' · ' + x.label : ''} <span className={'pill ' + (x.kind === 'always' ? 'good' : 'bad')}>{x.kind === 'always' ? t('Toujours répondre') : t('Jamais répondre')}</span></span>
            <button className="link" type="button" onClick={() => rm(x)}>{t('Retirer')}</button>
          </div>
        ))}
      </div>

      <div className="ws-card">
        <h2>{t("Origine des contacts")}</h2>
        <p className="muted">{t("Servent aux statistiques (la source « publicité » apparaît aussi dans le module Commercial).")}</p>
        <div className="wsc-stats">
          {['ad', 'organic', 'import', 'manual'].map((k) => <div className="stat" key={k}><b>{String(d.stats.bySource[k] || 0)}</b><span>{t(SOURCE_LABEL[k])}</span></div>)}
          <div className="stat"><b>{String(d.stats.held)}</b><span>{t('hors périmètre')}</span></div>
        </div>
        {d.stats.campaigns.length ? d.stats.campaigns.map((c, i) => <div className="line" key={i}><span><b>{c.campaign ? '#' + c.campaign : t('Annonce {id}', { id: c.adId })}</b>{c.adId && c.campaign ? ' · ' + c.adId : ''}{c.detail ? <small>{' · ' + c.detail}</small> : null}</span><span>{t('{n} contact(s)', { n: c.contacts })}</span></div>) : null}
        <form className="wsc-add" onSubmit={markAd}>
          <label className="fld"><span>{t('Marquer un contact « publicité »')}</span><input type="tel" inputMode="tel" placeholder="237677112233" value={mark.phone} onChange={(e) => setMark({ ...mark, phone: e.target.value })} /></label>
          <label className="fld"><span>{t('Campagne (facultatif)')}</span><input type="text" maxLength={40} value={mark.campaign} onChange={(e) => setMark({ ...mark, campaign: e.target.value })} /></label>
          <button className="btn small" type="submit" disabled={!mark.phone.trim()}>{t('Marquer')}</button>
        </form>
        <label className="fld" style={{ display: 'grid', gap: 4 }}>
          <span>{t('Importer une liste (une ligne par contact : numéro ; oui ou non ; campagne)')}</span>
          <textarea rows={3} value={imp} onChange={(e) => setImp(e.target.value)} placeholder={'237677112233;oui;rentree25'} style={{ fontSize: 16 }} />
        </label>
        <div className="wsc-actions" style={{ marginTop: 8 }}><button className="btn small" type="button" disabled={!imp.trim()} onClick={doImport}>{t('Importer')}</button></div>
      </div>

      <div className="ws-card wsc-log">
        <h2>{t('Journal des changements')}</h2>
        {!d.log.length ? <Empty text={t('Aucun changement pour le moment.')} /> : d.log.map((l) => (
          <div className="line" key={l.id}><span><b>{t(ACTION_LABEL[l.action] || l.action)}</b><small>{' · ' + (l.who || '—') + ' · ' + dateFr(l.at)}</small></span></div>
        ))}
      </div>
    </>
  );
}

/** Étiquette « hors périmètre » d'une conversation (liste et fenêtre de lecture). */
export function HeldPill({ reasonText }) {
  const t = useT();
  return <span className="wsc-held" title={reasonText || ''}>{t('Hors périmètre — pas de réponse automatique')}</span>;
}

/** Boutons d'une conversation hors périmètre : réponse manuelle de l'assistant, ajout au périmètre. */
export function HeldActions({ chatId, after, className = 'wsc-actions' }) {
  const t = useT();
  const { oapi, toast, fail, confirm } = useWs();
  const reply = () => confirm(t("L'assistant va répondre maintenant au dernier message de ce contact. Continuer ?"), () => oapi('POST', '/wa-scope/chats/' + chatId + '/reply-anyway', {}).then(() => { toast(t("L'assistant a répondu.")); after(); }).catch(fail), t('Répondre'));
  const add = () => oapi('POST', '/wa-scope/chats/' + chatId + '/add-to-scope', {}).then(() => { toast(t('Contact ajouté au périmètre : il recevra les réponses automatiques.')); after(); }).catch(fail);
  return (
    <span className={className}>
      <button className="link" type="button" onClick={reply}>{t("Répondre avec l'assistant quand même")}</button>
      <button className="link" type="button" onClick={add}>{t('Ajouter ce contact au périmètre')}</button>
    </span>
  );
}
