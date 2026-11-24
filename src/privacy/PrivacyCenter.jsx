import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { readConsent, openCookieSettings, saveConsent } from '../lib/consent.js';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { api } from '../lib/api.js';
import OrgPrivacy from './OrgPrivacy.jsx';
import { Flash, downloadFile, fmtDate, priv, useData, useFlash } from './util.jsx';

const KINDS = {
  terms: "Conditions d'utilisation",
  privacy: 'Politique de confidentialité',
  cookies: "Cookies et mesure d'audience",
  marketing: 'Informations et offres de MABAH',
  ai_processing: "Traitement par l'intelligence artificielle",
};
const KIND_HELP = {
  cookies: "Compteur de visites anonyme du site public. Désactivé tant que vous ne l'acceptez pas.",
  marketing: 'Nouveautés et conseils par e-mail. Vous pouvez les retirer à tout moment.',
  ai_processing: "Permet à l'assistant d'envoyer à un fournisseur d'IA les extraits nécessaires pour répondre. Le retirer limite les fonctions d'IA.",
};
const OPTIONAL = ['cookies', 'marketing', 'ai_processing'];
const STATUS = { open: 'En cours', done: 'Traitée', pending: 'En attente', rejected: 'Refusée', cancelled: 'Annulée' };
const REQUEST_KIND = { export: 'Export de mes données', erasure: 'Suppression du compte' };

/** Centre de confidentialité : consentements, export, suppression du compte, droits ; et onglet « Organisation » pour les administrateurs. */
export default function PrivacyCenter() {
  const t = useT();
  const { tab } = useParams();
  const navigate = useNavigate();
  const orgs = useData(() => api('GET', '/orgs').then((j) => j.orgs || []), []);
  const adminOrgs = (orgs.data || []).filter((o) => o.role === 'admin' || o.role === 'owner');
  const orgTab = tab === 'organisation';
  useEffect(() => { document.title = t('Confidentialité et mes données') + ' · MABAH'; }, [t]);
  useEffect(() => { if (tab && tab !== 'organisation') navigate('/app/confidentialite', { replace: true }); }, [tab, navigate]);
  return (
    <div className="ws-center" style={{ alignContent: 'start' }}>
      <Link className="logo" to="/app">MABAH</Link>
      <div className="ws-card">
        <p className="small"><Link to="/app">{t('← Retour à mon espace')}</Link></p>
        <h1>{t('Confidentialité et mes données')}</h1>
        <p className="muted">{t('Ici, vous voyez ce que vous avez accepté, vous récupérez vos données et vous pouvez demander la suppression de votre compte.')}</p>
        {adminOrgs.length ? (
          <div className="row wrap" role="tablist">
            <Link role="tab" aria-selected={!orgTab} className={'tab' + (orgTab ? '' : ' on')} to="/app/confidentialite">{t('Mon compte')}</Link>
            <Link role="tab" aria-selected={orgTab} className={'tab' + (orgTab ? ' on' : '')} to="/app/confidentialite/organisation">{t('Organisation')}</Link>
          </div>
        ) : null}
        {orgTab && adminOrgs.length ? <OrgPrivacy orgs={adminOrgs} /> : <Account />}
      </div>
    </div>
  );
}

function Account() {
  const t = useT();
  const ov = useData(() => priv('GET', '/overview'), []);
  if (ov.loading) return <p className="ws-empty">{t('Chargement…')}</p>;
  if (ov.error) return <p className="ws-err" role="alert">{tsrv(ov.error.message)}</p>;
  const o = ov.data;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Rights days={o.responseDays} />
      <Consents data={o} reload={ov.reload} />
      <ExportBox />
      <Erasure erasure={o.erasure} reload={ov.reload} />
      <Requests list={o.requests} />
    </div>
  );
}

function Rights({ days }) {
  const t = useT();
  return (
    <section className="ws-sub">
      <h2>{t('Vos droits')}</h2>
      <ul style={{ paddingLeft: 20, display: 'grid', gap: 6, marginBottom: 10 }}>
        <li><b>{t('Accès')}</b> : {t('savoir quelles données nous avons sur vous et en recevoir une copie.')}</li>
        <li><b>{t('Rectification')}</b> : {t("corriger une information inexacte (votre profil se modifie dans l'application).")}</li>
        <li><b>{t('Suppression')}</b> : {t('demander que votre compte et vos données personnelles soient effacés.')}</li>
        <li><b>{t('Portabilité')}</b> : {t('récupérer vos données dans un format ouvert (JSON) pour les réutiliser ailleurs.')}</li>
        <li><b>{t('Opposition')}</b> : {t('refuser certains usages, par exemple les informations commerciales ou la mesure d\'audience.')}</li>
      </ul>
      <p className="small muted">{t("Les boutons ci-dessous agissent tout de suite. Pour toute autre demande, écrivez-nous : nous répondons dans un délai maximum de {n} jours.", { n: days })}</p>
    </section>
  );
}

function Consents({ data, reload }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [showHist, setShowHist] = useState(false);
  const hist = useData(() => (showHist ? priv('GET', '/consents') : Promise.resolve(null)), [showHist, data]);
  const set = async (kind, accepted) => {
    clear();
    try {
      if (kind === 'cookies') saveConsent({ analytics: accepted });
      else await priv('POST', '/consents', { kind, accepted });
      ok(accepted ? t('Consentement enregistré.') : t('Consentement retiré.'));
      setTimeout(reload, kind === 'cookies' ? 400 : 0);
    } catch (e) { bad(e); }
  };
  const local = readConsent();
  return (
    <section className="ws-sub">
      <h2>{t('Mes consentements')}</h2>
      {data.consents.map((c) => {
        const optional = OPTIONAL.includes(c.kind);
        return (
          <div className="line" key={c.kind}>
            <span><b>{t(KINDS[c.kind] || c.kind)}</b><br />
              <small>{c.at ? t('{etat} le {date} (texte du {version})', { etat: c.accepted ? t('Accepté') : t('Refusé'), date: fmtDate(c.at, true), version: c.version }) : t("Pas encore de choix enregistré")}{c.at && !c.upToDate ? ' · ' + t('texte mis à jour depuis : à relire') : ''}</small>
              {KIND_HELP[c.kind] ? <><br /><small>{t(KIND_HELP[c.kind])}</small></> : null}
            </span>
            {optional ? (
              <button type="button" className="btn small" onClick={() => set(c.kind, !c.accepted)}>{c.accepted ? t('Retirer') : t('Accepter')}</button>
            ) : <span className={'pill ' + (c.accepted ? 'good' : 'mid')}>{c.accepted ? t('Accepté') : t('Non accepté')}</span>}
          </div>
        );
      })}
      <p className="row wrap">
        <button type="button" className="btn small" onClick={openCookieSettings}>{t('Gérer mes cookies')}</button>
        <button type="button" className="link" onClick={() => setShowHist(!showHist)}>{showHist ? t("Masquer l'historique") : t("Voir l'historique")}</button>
      </p>
      {local ? <p className="small muted">{t('Choix de cookies sur cet appareil : mesure d\'audience {etat}.', { etat: local.analytics ? t('acceptée') : t('refusée') })}</p> : null}
      <Flash f={flash} />
      {showHist ? (
        hist.loading ? <p className="ws-empty">{t('Chargement…')}</p> : hist.data && hist.data.history.length ? (
          <div style={{ marginTop: 8 }}>{hist.data.history.map((h, i) => (
            <div className="line" key={i}><span>{t(KINDS[h.kind] || h.kind)} · <b>{h.accepted ? t('Accepté') : t('Refusé')}</b></span><small>{fmtDate(h.at, true)} · {h.version}</small></div>
          ))}</div>
        ) : <p className="ws-empty">{t('Aucun historique.')}</p>
      ) : null}
    </section>
  );
}

function ExportBox() {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    clear(); setBusy(true);
    try { await downloadFile('/api/privacy/export', 'mes-donnees-mabah.json'); ok(t('Votre export a été téléchargé.')); } catch (e) { bad(e); }
    setBusy(false);
  };
  return (
    <section className="ws-sub">
      <h2>{t('Exporter toutes mes données')}</h2>
      <p className="muted small">{t("Vous recevez un fichier JSON avec votre profil, vos consentements, vos connexions et les données personnelles liées à votre compte. Vous pouvez en faire une demande tant que vous le voulez.")}</p>
      <p><button type="button" className="btn primary small" disabled={busy} onClick={go}>{busy ? t('Préparation…') : t('Télécharger mes données')}</button></p>
      <Flash f={flash} />
    </section>
  );
}

function Erasure({ erasure, reload }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [pass, setPass] = useState('');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn, done) => { clear(); setBusy(true); try { await fn(); ok(done); setPass(''); setWord(''); reload(); } catch (e) { bad(e); } setBusy(false); };
  return (
    <section className="ws-sub">
      <h2>{t('Supprimer mon compte')}</h2>
      {erasure.pending ? (
        <>
          <p><b className="late">{t('Suppression programmée le {date}.', { date: fmtDate(erasure.eraseAfter) })}</b></p>
          <p className="muted small">{t("Jusqu'à cette date, rien n'est effacé : vous pouvez changer d'avis et annuler. Après, vos données personnelles sont anonymisées et ne peuvent plus être récupérées.")}</p>
          <p><button type="button" className="btn primary small" disabled={busy} onClick={() => run(() => priv('DELETE', '/erasure'), t('Suppression annulée. Votre compte est conservé.'))}>{t('Annuler la suppression')}</button></p>
        </>
      ) : (
        <>
          <p className="muted small">{t("Votre compte sera supprimé après un délai de réflexion de {n} jours, pendant lequel vous pouvez annuler. Ensuite, vos données personnelles sont anonymisées. Si vous êtes propriétaire d'une organisation, transférez-la ou supprimez-la d'abord.", { n: erasure.graceDays })}</p>
          <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); run(() => priv('POST', '/erasure', { password: pass, confirm: word }).then((j) => ok(t('Suppression programmée le {date}.', { date: fmtDate(j.eraseAfter) }))), t('Suppression programmée.')); }}>
            <label className="fld" htmlFor="er_pass"><span>{t('Votre mot de passe')}</span><input id="er_pass" type="password" autoComplete="current-password" style={{ fontSize: 16 }} value={pass} onChange={(e) => setPass(e.target.value)} /></label>
            <label className="fld" htmlFor="er_word"><span>{t('Pour confirmer, écrivez SUPPRIMER')}</span><input id="er_word" type="text" autoComplete="off" style={{ fontSize: 16 }} value={word} onChange={(e) => setWord(e.target.value)} /></label>
            <div className="row"><button className="btn primary small" type="submit" disabled={busy || !pass || word !== 'SUPPRIMER'}>{t('Demander la suppression de mon compte')}</button></div>
          </form>
        </>
      )}
      <Flash f={flash} />
    </section>
  );
}

function Requests({ list }) {
  const t = useT();
  if (!list || !list.length) return null;
  return (
    <section className="ws-sub">
      <h2>{t('Mes demandes')}</h2>
      {list.map((r) => (
        <div className="line" key={r.id}>
          <span><b>{t(REQUEST_KIND[r.kind] || r.kind)}</b><br /><small>{t('Demandée le {date}', { date: fmtDate(r.requestedAt, true) })}{r.doneAt ? ' · ' + t('traitée le {date}', { date: fmtDate(r.doneAt) }) : r.dueAt ? ' · ' + t('réponse avant le {date}', { date: fmtDate(r.dueAt) }) : ''}</small></span>
          <span className={'pill ' + (r.status === 'done' ? 'good' : 'mid')}>{t(STATUS[r.status] || r.status)}</span>
        </div>
      ))}
    </section>
  );
}
