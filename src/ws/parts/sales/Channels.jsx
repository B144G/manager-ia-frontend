import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { WaWizard } from './WaWizard.jsx';
import { OneClickCard } from './OneClick.jsx';
import { WaQrCard } from './WaQr.jsx';
import { Pill, QrBlock, ReadOnly, hasQr, publicBase } from './util.jsx';

/** Adresse du webhook + jeton de vérification, à coller dans Meta. */
function HookCard({ title, rows, test, disconnect, disconnectLabel, subscribe, subscribeNote }) {
  const t = useT();
  const { copy } = useWs();
  const [msg, setMsg] = useState('');
  return (
    <div className="ws-card">
      <h2>{title}</h2>
      {rows.map((p) => (
        <div key={p[0]}>
          <label className="fld"><span>{p[0]}</span><ReadOnly value={p[1]} /></label>
          <div className="row"><button className="btn small" type="button" onClick={() => copy(p[1], t('Copié.'))}>{t('Copier')}</button></div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary small" type="button" onClick={() => { setMsg(t('Test en cours…')); test().then(setMsg, (e) => setMsg(t(e.message))); }}>{t('Tester la connexion')}</button>
        {subscribe ? <button className="btn primary small" type="button" onClick={() => { setMsg(t('Abonnement en cours…')); subscribe().then(setMsg, (e) => setMsg(t(e.message))); }}>{t('Activer la réception des messages')}</button> : null}
        <button className="btn small" type="button" onClick={disconnect}>{disconnectLabel}</button>
      </div>
      {subscribeNote ? <p className="muted small">{subscribeNote}</p> : null}
      <p className="muted small">{msg}</p>
    </div>
  );
}


/** Test de l'IA du serveur : une petite question, avec la durée et la raison exacte d'un éventuel échec. */
function AiTest() {
  const t = useT();
  const { oapi } = useWs();
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true); setOut(null);
    oapi('POST', '/ai/ping', {}).then(setOut, (e) => setOut({ ok: false, error: t(e.message) })).then(() => setBusy(false));
  };
  return (
    <div className="ws-card">
      <h2>{t("Tester l'assistant IA")}</h2>
      <p className="muted">{t("Envoie une très petite question à l'IA du serveur et affiche le résultat. Utile si l'assistant répond « un conseiller va vous répondre ».")}</p>
      <div className="row"><button className="btn primary small" type="button" disabled={busy} onClick={run}>{busy ? t("Test en cours (jusqu'à 2 minutes)…") : t("Tester l'IA")}</button></div>
      {out ? (
        <div role="status" style={{ marginTop: 12, overflowWrap: 'anywhere' }}>
          <p>{out.ok ? <Pill t={["L'IA répond", 'good']} /> : <Pill t={['Échec', 'bad']} />}{out.ms !== undefined ? '  ' + (out.ms / 1000).toFixed(1) + ' s' : ''}</p>
          {out.ok ? <p>{t('Réponse : « {text} »', { text: out.text })}</p> : <p className="ws-err">{out.error}</p>}
          {out.model ? <p className="muted small">{t('Fournisseur : {provider} · modèle : {model} · serveur : {host} · réflexion : {reasoning} · délai maximal : {s} s', { provider: out.provider, model: out.model, host: out.host || '?', reasoning: out.reasoning || t('réglage du service'), s: Math.round((out.timeoutMs || 0) / 1000) })}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Onglet « Canaux » : WhatsApp de l'entreprise (API officielle de Meta), puis Messenger / Instagram. */
export function Whatsapp({ onChange }) {
  const t = useT();
  const { oapi, toast, confirm, fail, info } = useWs();
  // Interrupteurs du serveur : sans eux (ancien serveur), l'interface Meta reste visible comme avant.
  const feat = (info && info.features) || { metaChannels: true, waQr: false };
  const meta = feat.metaChannels !== false;
  const st = useLoad(() => (meta ? oapi('GET', '/sales/whatsapp') : Promise.resolve(null)), [meta]);
  // Connexion en un clic : la carte n'apparaît que si le serveur l'a activée (en cas d'erreur, on considère qu'elle ne l'est pas).
  const em = useLoad(() => (meta ? oapi('GET', '/sales/whatsapp/embedded/config').catch(() => ({ enabled: false })) : Promise.resolve({ enabled: false })), [meta]);
  // Canaux Meta masqués pour le moment (le code reste en place : META_CHANNELS=1 côté serveur les réaffiche).
  if (!meta) {
    return (
      <>
        {feat.waQr ? <WaQrCard onChange={onChange} /> : <div className="ws-card"><h2>{t('WhatsApp de votre entreprise')}</h2><p className="muted">{t("La connexion de WhatsApp n'est pas disponible pour le moment.")}</p></div>}
        <AiTest />
      </>
    );
  }
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  const w = st.data;
  const one = Boolean(em.data && em.data.enabled && em.data.appId && em.data.configId);
  const manual = (
    <>
      <WaWizard w={w} embedded={one} />
      <div className="ws-card">
        <h2>{t('Vos identifiants')}</h2>
        <Form
          submitText={t("Enregistrer")}
          fields={[
            { k: 'phoneId', label: t('Identifiant du numéro (Phone number ID)'), value: w.phoneId, placeholder: '109876543210', hint: t('Chiffres seulement.') },
            { k: 'wabaId', label: t('Identifiant du compte WhatsApp Business (WABA ID)'), value: w.wabaId, placeholder: '1432309911579140', hint: t("Dans Meta, Configuration de l'API : « ID du compte de messagerie ». Sert à activer la réception des messages. Chiffres seulement.") },
            { k: 'number', label: t("Numéro WhatsApp avec l'indicatif du pays"), value: w.number, placeholder: '237677112233', hint: t('Sert au lien et au QR code WhatsApp.') },
            { k: 'token', label: t("Jeton d'accès permanent") + (w.tokenSet ? ' ' + t('(déjà enregistré)') : ''), type: 'password', placeholder: w.tokenSet ? t('Laisser vide pour garder le jeton actuel') : 'EAAG…', hint: t("Il est chiffré et ne s'affiche plus jamais.") },
            { k: 'appSecret', label: t("Secret de l'application") + (w.secretSet ? ' ' + t('(déjà enregistré)') : ''), type: 'password', placeholder: w.secretSet ? t('Laisser vide pour garder le secret actuel') : '', hint: t('Sert à vérifier que les messages viennent bien de Meta.') },
          ]}
          onSubmit={(v) => oapi('PUT', '/sales/whatsapp', { phoneId: v.phoneId, wabaId: v.wabaId, number: v.number, token: v.token, appSecret: v.appSecret }).then(() => { toast(t('Réglages enregistrés.')); onChange(); })}
        />
      </div>
    </>
  );
  return (
    <>
      <div className="ws-card">
        <h2>{t('WhatsApp de votre entreprise')}</h2>
        <p>{w.connected ? <Pill t={['Connecté', 'good']} /> : <Pill t={['Non connecté', 'bad']} />}<span>{w.number ? '  +' + w.number : ''}</span></p>
        <p className="muted">{t("Quand un prospect écrit sur votre numéro WhatsApp (par exemple après une publicité « Cliquer pour envoyer un message »), l'assistant lui répond, l'enregistre et prend sa commande, comme sur la page web. Vous pouvez reprendre la conversation à tout moment.")}</p>
      </div>
      {feat.waQr ? <WaQrCard onChange={() => { st.reload(); onChange(); }} /> : null}
      {one ? <OneClickCard cfg={em.data} connected={w.connected} number={w.number} onDone={() => { st.reload(); onChange(); }} /> : null}
      {one ? <details className="ws-card wa-adv"><summary>{t('Avancé : saisir les identifiants à la main')}</summary>{manual}</details> : manual}
      {w.verifyToken ? (
        <HookCard
          title={t("À coller dans Meta")}
          rows={[[t('Adresse du webhook (URL de rappel)'), publicBase() + w.webhookPath], [t('Jeton de vérification'), w.verifyToken]]}
          test={() => oapi('POST', '/sales/whatsapp/test', {}).then((r) => t('Connexion réussie : {name} ({number}).', { name: r.name, number: r.number }))}
          subscribe={w.wabaId ? () => oapi('POST', '/sales/whatsapp/subscribe', {}).then((r) => t('Application abonnée au compte WhatsApp') + (r.apps && r.apps.length ? ' : ' + r.apps.join(', ') : '') + '. ' + t('Les messages reçus arrivent maintenant ici.')) : null}
          subscribeNote={w.wabaId ? t("Après avoir collé l'adresse et le jeton chez Meta, cliquez sur « Activer la réception des messages » : sans cet abonnement, Meta n'envoie pas les messages des clients.") : t('Renseignez l\'identifiant du compte WhatsApp Business ci-dessus pour pouvoir activer la réception des messages.')}
          disconnectLabel={t('Déconnecter WhatsApp')}
          disconnect={() => confirm(t("Déconnecter WhatsApp ? L'assistant cessera de répondre sur ce numéro."), () => oapi('DELETE', '/sales/whatsapp').then(() => { toast(t('WhatsApp déconnecté.')); onChange(); }).catch(fail), t('Oui, déconnecter'))}
        />
      ) : null}
      <AiTest />
      <div><MetaChannels /></div>
    </>
  );
}

function MetaChannels() {
  const t = useT();
  const { oapi, toast, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/meta'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  const w = st.data;
  return (
    <>
      <div className="ws-card">
        <h2>{t('Messenger et Instagram')}</h2>
        <p>{w.connected ? <Pill t={['Connecté', 'good']} /> : <Pill t={['Non connecté', 'bad']} />}</p>
        <p className="muted">{t('Le même assistant répond aux messages privés reçus sur votre Page Facebook (Messenger) et sur votre compte Instagram professionnel lié. Il fait la même chose que sur WhatsApp : il lit les messages vocaux, les photos et les PDF, répond par écrit et en vocal, envoie les photos et vidéos du catalogue, prend les commandes et vous passe la main quand il le faut. Pour envoyer des fichiers et des voix, le serveur doit connaître son adresse publique HTTPS (API_PUBLIC_URL).')}</p>
        <ol className="ws-steps">
          <li>{t('Dans votre application Meta (developers.facebook.com), ajoutez le produit Messenger et liez votre Page. Pour Instagram, liez le compte professionnel à la Page.')}</li>
          <li>{t("Générez un jeton d'accès de Page permanent. Copiez-le, avec l'identifiant de la Page, l'identifiant du compte Instagram (facultatif) et le secret de l'application.")}</li>
          <li>{t("Collez ci-dessous, puis dans Meta (Webhooks) l'adresse et le jeton de vérification affichés. Abonnez les champs « messages » (Page) et « messages » (Instagram).")}</li>
        </ol>
      </div>
      <div className="ws-card">
        <h2>{t('Identifiants Messenger / Instagram')}</h2>
        <Form
          submitText={t("Enregistrer")}
          fields={[
            { k: 'pageId', label: t('Identifiant de la Page Facebook'), value: w.pageId, hint: t('Chiffres seulement.') },
            { k: 'instagramId', label: t('Identifiant du compte Instagram professionnel (facultatif)'), value: w.instagramId },
            { k: 'token', label: t("Jeton d'accès de la Page") + (w.tokenSet ? ' ' + t('(déjà enregistré)') : ''), type: 'password', placeholder: w.tokenSet ? t('Laisser vide pour garder le jeton actuel') : 'EAAG…' },
            { k: 'appSecret', label: t("Secret de l'application") + (w.secretSet ? ' ' + t('(déjà enregistré)') : ''), type: 'password', placeholder: w.secretSet ? t('Laisser vide pour garder le secret actuel') : '' },
          ]}
          onSubmit={(v) => oapi('PUT', '/sales/meta', { pageId: v.pageId, instagramId: v.instagramId, token: v.token, appSecret: v.appSecret }).then(() => { toast(t('Réglages enregistrés.')); st.reload(); })}
        />
      </div>
      {w.verifyToken ? (
        <HookCard
          title={t("À coller dans Meta (Webhooks)")}
          rows={[[t('Adresse du webhook (URL de rappel)'), publicBase() + w.webhookPath], [t('Jeton de vérification'), w.verifyToken]]}
          test={() => oapi('POST', '/sales/meta/test', {}).then((r) => (r.name ? t('Connexion réussie : Page « {name} ».', { name: r.name }) : t('Connexion réussie.')))}
          disconnectLabel={t('Déconnecter')}
          disconnect={() => confirm(t("Déconnecter Messenger / Instagram ? L'assistant cessera d'y répondre."), () => oapi('DELETE', '/sales/meta').then(st.reload).catch(fail))}
        />
      ) : null}
    </>
  );
}

const cleanCampaign = (s) => s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

/** Fenêtre « Lien à partager dans vos publicités » (réservée aux administrateurs : le jeton n'est fourni qu'à eux). */
export function ShareLink({ settings }) {
  const t = useT();
  const { copy } = useWs();
  const [camp, setCamp] = useState('');
  const token = settings && settings.token;
  if (!token) return <Empty text={t("Réservé aux administrateurs.")} />;
  const cn = cleanCampaign(camp);
  const out = window.location.origin + '/chat?o=' + token + (cn ? '&c=' + cn : '');
  return (
    <>
      <p>{t('Mettez ce lien dans votre publicité (Facebook, Instagram, TikTok, WhatsApp, affiche avec QR code). Chaque personne qui clique discute avec votre assistant.')}</p>
      <label className="fld"><span>{t('Nom de la campagne (facultatif)')}</span><input type="text" placeholder={t("ex : facebook-octobre")} aria-label={t("Nom de la campagne")} maxLength={40} value={camp} onChange={(e) => setCamp(e.target.value)} /><small>{t('Lettres, chiffres, tiret. Il apparaît dans les résultats par campagne.')}</small></label>
      <label className="fld"><span>{t('Lien')}</span><ReadOnly value={out} label={t("Lien")} /></label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary small" type="button" onClick={() => copy(out, t('Lien copié.'))}>{t('Copier le lien')}</button>
        <a className="btn small" href={out} target="_blank" rel="noopener">{t('Essayer')}</a>
      </div>
      <div className="ws-qrs">
        <QrBlock label={t("Page de discussion")} text={out} file={'qr-discussion' + (cn ? '-' + cn : '')} />
        {settings.waNumber ? <QrBlock label={t("Écrire sur WhatsApp")} text={'https://wa.me/' + settings.waNumber + '?text=' + encodeURIComponent(t('Bonjour, je viens de voir votre publicité') + (cn ? ' #' + cn : ''))} file={'qr-whatsapp' + (cn ? '-' + cn : '')} /> : null}
      </div>
      {hasQr() ? <p className="muted small">{settings.waNumber ? t('Imprimez ces QR codes sur vos affiches, cartes et factures : le client scanne et discute tout de suite (WhatsApp ou page web).') : t("Enregistrez votre numéro WhatsApp dans l'onglet WhatsApp pour obtenir aussi un QR code qui ouvre WhatsApp.")}</p> : null}
    </>
  );
}
