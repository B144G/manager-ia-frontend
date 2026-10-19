import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { Pill, QrBlock, ReadOnly, hasQr, publicBase } from './util.jsx';

/** Adresse du webhook + jeton de vérification, à coller dans Meta. */
function HookCard({ title, rows, test, disconnect, disconnectLabel }) {
  const { copy } = useWs();
  const [msg, setMsg] = useState('');
  return (
    <div className="ws-card">
      <h2>{title}</h2>
      {rows.map((p) => (
        <div key={p[0]}>
          <label className="fld"><span>{p[0]}</span><ReadOnly value={p[1]} /></label>
          <div className="row"><button className="btn small" type="button" onClick={() => copy(p[1], 'Copié.')}>Copier</button></div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary small" type="button" onClick={() => { setMsg('Test en cours…'); test().then(setMsg, (e) => setMsg(e.message)); }}>Tester la connexion</button>
        <button className="btn small" type="button" onClick={disconnect}>{disconnectLabel}</button>
      </div>
      <p className="muted small">{msg}</p>
    </div>
  );
}

/** Onglet « Canaux » : WhatsApp de l'entreprise (API officielle de Meta), puis Messenger / Instagram. */
export function Whatsapp({ onChange }) {
  const { oapi, toast, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/whatsapp'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  if (!st.data) return null;
  const w = st.data;
  return (
    <>
      <div className="ws-card">
        <h2>WhatsApp de votre entreprise</h2>
        <p>{w.connected ? <Pill t={['Connecté', 'good']} /> : <Pill t={['Non connecté', 'bad']} />}<span>{w.number ? '  +' + w.number : ''}</span></p>
        <p className="muted">Quand un prospect écrit sur votre numéro WhatsApp (par exemple après une publicité « Cliquer pour envoyer un message »), l'assistant lui répond, l'enregistre et prend sa commande, comme sur la page web. Vous pouvez reprendre la conversation à tout moment.</p>
      </div>
      <div className="ws-card">
        <h2>Comment le connecter</h2>
        <ol className="ws-steps">
          <li>Créez un compte Meta Business et une application de type « Entreprise » sur developers.facebook.com, puis ajoutez le produit WhatsApp.</li>
          <li>Ajoutez votre numéro WhatsApp Business. Il ne doit pas rester utilisé dans l'application WhatsApp normale.</li>
          <li>Copiez ci-dessous l'identifiant du numéro (Phone number ID), un jeton d'accès permanent et le secret de l'application.</li>
          <li>Dans Meta (WhatsApp &gt; Configuration), collez l'adresse du webhook et le jeton de vérification affichés plus bas, puis abonnez le champ « messages ».</li>
          <li>Cliquez sur « Tester la connexion », puis écrivez un message à votre numéro pour essayer.</li>
        </ol>
      </div>
      <div className="ws-card">
        <h2>Vos identifiants</h2>
        <Form
          submitText="Enregistrer"
          fields={[
            { k: 'phoneId', label: 'Identifiant du numéro (Phone number ID)', value: w.phoneId, placeholder: '109876543210', hint: 'Chiffres seulement.' },
            { k: 'number', label: "Numéro WhatsApp avec l'indicatif du pays", value: w.number, placeholder: '237677112233', hint: 'Sert au lien et au QR code WhatsApp.' },
            { k: 'token', label: "Jeton d'accès permanent" + (w.tokenSet ? ' (déjà enregistré)' : ''), type: 'password', placeholder: w.tokenSet ? 'Laisser vide pour garder le jeton actuel' : 'EAAG…', hint: 'Il est chiffré et ne s\'affiche plus jamais.' },
            { k: 'appSecret', label: "Secret de l'application" + (w.secretSet ? ' (déjà enregistré)' : ''), type: 'password', placeholder: w.secretSet ? 'Laisser vide pour garder le secret actuel' : '', hint: 'Sert à vérifier que les messages viennent bien de Meta.' },
          ]}
          onSubmit={(v) => oapi('PUT', '/sales/whatsapp', { phoneId: v.phoneId, number: v.number, token: v.token, appSecret: v.appSecret }).then(() => { toast('Réglages enregistrés.'); onChange(); })}
        />
      </div>
      {w.verifyToken ? (
        <HookCard
          title="À coller dans Meta"
          rows={[['Adresse du webhook (URL de rappel)', publicBase() + w.webhookPath], ['Jeton de vérification', w.verifyToken]]}
          test={() => oapi('POST', '/sales/whatsapp/test', {}).then((r) => 'Connexion réussie : ' + r.name + ' (' + r.number + ').')}
          disconnectLabel="Déconnecter WhatsApp"
          disconnect={() => confirm("Déconnecter WhatsApp ? L'assistant cessera de répondre sur ce numéro.", () => oapi('DELETE', '/sales/whatsapp').then(() => { toast('WhatsApp déconnecté.'); onChange(); }).catch(fail), 'Oui, déconnecter')}
        />
      ) : null}
      <div><MetaChannels /></div>
    </>
  );
}

function MetaChannels() {
  const { oapi, toast, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/meta'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  if (!st.data) return null;
  const w = st.data;
  return (
    <>
      <div className="ws-card">
        <h2>Messenger et Instagram</h2>
        <p>{w.connected ? <Pill t={['Connecté', 'good']} /> : <Pill t={['Non connecté', 'bad']} />}</p>
        <p className="muted">Le même assistant répond aux messages privés reçus sur votre Page Facebook (Messenger) et sur votre compte Instagram professionnel lié. Il fait la même chose que sur WhatsApp : il lit les messages vocaux, les photos et les PDF, répond par écrit et en vocal, envoie les photos et vidéos du catalogue, prend les commandes et vous passe la main quand il le faut. Pour envoyer des fichiers et des voix, le serveur doit connaître son adresse publique HTTPS (API_PUBLIC_URL).</p>
        <ol className="ws-steps">
          <li>Dans votre application Meta (developers.facebook.com), ajoutez le produit Messenger et liez votre Page. Pour Instagram, liez le compte professionnel à la Page.</li>
          <li>Générez un jeton d'accès de Page permanent. Copiez-le, avec l'identifiant de la Page, l'identifiant du compte Instagram (facultatif) et le secret de l'application.</li>
          <li>Collez ci-dessous, puis dans Meta (Webhooks) l'adresse et le jeton de vérification affichés. Abonnez les champs « messages » (Page) et « messages » (Instagram).</li>
        </ol>
      </div>
      <div className="ws-card">
        <h2>Identifiants Messenger / Instagram</h2>
        <Form
          submitText="Enregistrer"
          fields={[
            { k: 'pageId', label: 'Identifiant de la Page Facebook', value: w.pageId, hint: 'Chiffres seulement.' },
            { k: 'instagramId', label: 'Identifiant du compte Instagram professionnel (facultatif)', value: w.instagramId },
            { k: 'token', label: "Jeton d'accès de la Page" + (w.tokenSet ? ' (déjà enregistré)' : ''), type: 'password', placeholder: w.tokenSet ? 'Laisser vide pour garder le jeton actuel' : 'EAAG…' },
            { k: 'appSecret', label: "Secret de l'application" + (w.secretSet ? ' (déjà enregistré)' : ''), type: 'password', placeholder: w.secretSet ? 'Laisser vide pour garder le secret actuel' : '' },
          ]}
          onSubmit={(v) => oapi('PUT', '/sales/meta', { pageId: v.pageId, instagramId: v.instagramId, token: v.token, appSecret: v.appSecret }).then(() => { toast('Réglages enregistrés.'); st.reload(); })}
        />
      </div>
      {w.verifyToken ? (
        <HookCard
          title="À coller dans Meta (Webhooks)"
          rows={[['Adresse du webhook (URL de rappel)', publicBase() + w.webhookPath], ['Jeton de vérification', w.verifyToken]]}
          test={() => oapi('POST', '/sales/meta/test', {}).then((r) => 'Connexion réussie' + (r.name ? ' : Page « ' + r.name + ' »' : '') + '.')}
          disconnectLabel="Déconnecter"
          disconnect={() => confirm("Déconnecter Messenger / Instagram ? L'assistant cessera d'y répondre.", () => oapi('DELETE', '/sales/meta').then(st.reload).catch(fail))}
        />
      ) : null}
    </>
  );
}

const cleanCampaign = (s) => s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

/** Fenêtre « Lien à partager dans vos publicités » (réservée aux administrateurs : le jeton n'est fourni qu'à eux). */
export function ShareLink({ settings }) {
  const { copy } = useWs();
  const [camp, setCamp] = useState('');
  const token = settings && settings.token;
  if (!token) return <Empty text="Réservé aux administrateurs." />;
  const cn = cleanCampaign(camp);
  const out = window.location.origin + '/chat?o=' + token + (cn ? '&c=' + cn : '');
  return (
    <>
      <p>Mettez ce lien dans votre publicité (Facebook, Instagram, TikTok, WhatsApp, affiche avec QR code). Chaque personne qui clique discute avec votre assistant.</p>
      <label className="fld"><span>Nom de la campagne (facultatif)</span><input type="text" placeholder="ex : facebook-octobre" aria-label="Nom de la campagne" maxLength={40} value={camp} onChange={(e) => setCamp(e.target.value)} /><small>Lettres, chiffres, tiret. Il apparaît dans les résultats par campagne.</small></label>
      <label className="fld"><span>Lien</span><ReadOnly value={out} label="Lien" /></label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary small" type="button" onClick={() => copy(out, 'Lien copié.')}>Copier le lien</button>
        <a className="btn small" href={out} target="_blank" rel="noopener">Essayer</a>
      </div>
      <div className="ws-qrs">
        <QrBlock label="Page de discussion" text={out} file={'qr-discussion' + (cn ? '-' + cn : '')} />
        {settings.waNumber ? <QrBlock label="Écrire sur WhatsApp" text={'https://wa.me/' + settings.waNumber + '?text=' + encodeURIComponent('Bonjour, je viens de voir votre publicité' + (cn ? ' #' + cn : ''))} file={'qr-whatsapp' + (cn ? '-' + cn : '')} /> : null}
      </div>
      {hasQr() ? <p className="muted small">{settings.waNumber ? 'Imprimez ces QR codes sur vos affiches, cartes et factures : le client scanne et discute tout de suite (WhatsApp ou page web).' : 'Enregistrez votre numéro WhatsApp dans l\'onglet WhatsApp pour obtenir aussi un QR code qui ouvre WhatsApp.'}</p> : null}
    </>
  );
}
