import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { readConsent, openCookieSettings, saveConsent } from '../lib/consent.js';
import { Icon } from '../lib/fa.jsx';
import { PRODUCT } from '../lib/product.js';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { api, rq } from '../lib/api.js';
import { Badge, Button } from '../ws/ui/index.jsx';
import wsStyles from '../ws/wsStyles.js';
import OrgPrivacy from './OrgPrivacy.jsx';
import Security from './Security.jsx';
import { Empty, Msg, Note, PasswordInput, Row, Rows, Section } from './kit.jsx';
import { downloadFile, fmtDate, priv, useData, useFlash } from './util.jsx';

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
const SECTIONS = [
  { id: '', icon: 'pv-gauge', label: 'Aperçu de mes données' },
  { id: 'consentements', icon: 'pv-check', label: 'Consentements' },
  { id: 'export', icon: 'pv-download', label: 'Exporter mes données' },
  { id: 'securite', icon: 'pv-shield', label: 'Sécurité du compte' },
  { id: 'journal', icon: 'pv-history', label: "Journal d'activité" },
  { id: 'organisation', icon: 'pv-building', label: 'Organisation', admin: true },
  { id: 'suppression', icon: 'pv-trash', label: 'Supprimer mon compte', danger: true },
];

/** Centre de confidentialité : une page à sections (navigation latérale, onglets défilants sur téléphone). Les styles de l'espace de travail y sont chargés. */
export default function PrivacyCenter() {
  const t = useT();
  const { tab = '' } = useParams();
  const navigate = useNavigate();
  useLayoutEffect(() => { // mêmes feuilles de style que l'espace de travail : la page est ouverte directement, hors de lui
    const els = wsStyles.map((css) => { const el = document.createElement('style'); el.setAttribute('data-mia', 'ws-app'); el.textContent = css; document.head.appendChild(el); return el; });
    return () => els.forEach((e) => e.remove());
  }, []);
  const orgs = useData(() => api('GET', '/orgs').then((j) => j.orgs || []), []);
  const adminOrgs = (orgs.data || []).filter((o) => o.role === 'admin' || o.role === 'owner');
  const items = SECTIONS.filter((s) => !s.admin || adminOrgs.length);
  const known = SECTIONS.some((s) => s.id === tab);
  useEffect(() => { document.title = t('Confidentialité et mes données') + ' · ' + PRODUCT.name; }, [t]);
  useEffect(() => { if (!known || (tab === 'organisation' && orgs.data && !adminOrgs.length)) navigate('/app/confidentialite', { replace: true }); }, [known, tab, navigate, orgs.data, adminOrgs.length]);
  const cur = SECTIONS.find((s) => s.id === tab) || SECTIONS[0];
  return (
    <div className="pv">
      <div className="pv-top"><Link className="logo" to="/app">{PRODUCT.name}</Link><Button to="/app" size="sm" icon="arrow-left">{t('Retour à mon espace')}</Button></div>
      <div className="pv-head"><h1>{t('Confidentialité et mes données')}</h1><p>{t('Ce que vous avez accepté, vos données, la sécurité de votre compte et vos droits, au même endroit.')}</p></div>
      <div className="pv-grid">
        <nav className="pv-nav" aria-label={t('Sections')}>
          {items.map((s) => (
            <span key={s.id || 'apercu'} style={{ display: 'contents' }}>
              {s.danger ? <span className="pv-sep" aria-hidden="true" /> : null}
              <NavLink to={s.id ? '/app/confidentialite/' + s.id : '/app/confidentialite'} end className={s.danger ? 'danger' : ''}><Icon name={s.icon} />{t(s.label)}</NavLink>
            </span>
          ))}
        </nav>
        <main className="pv-body" id="pv-main" aria-label={t(cur.label)}>
          {tab === '' ? <Overview go={(p) => navigate('/app/confidentialite/' + p)} /> : null}
          {tab === 'consentements' ? <Consents /> : null}
          {tab === 'export' ? <ExportBox /> : null}
          {tab === 'securite' ? <Security orgId={(orgs.data || [])[0] && orgs.data[0].id} /> : null}
          {tab === 'journal' ? <Activity /> : null}
          {tab === 'organisation' && adminOrgs.length ? <OrgPrivacy orgs={adminOrgs} /> : null}
          {tab === 'suppression' ? <Erasure /> : null}
        </main>
      </div>
    </div>
  );
}

const Loading = () => { const t = useT(); return <p className="ws-empty" role="status">{t('Chargement…')}</p>; };
const Failed = ({ e, retry }) => { const t = useT(); return <Note tone="danger">{tsrv(e.message)} <Button size="sm" onClick={retry}>{t('Réessayer')}</Button></Note>; };

function Overview({ go }) {
  const t = useT();
  const ov = useData(() => priv('GET', '/overview'), []);
  const se = useData(() => rq('GET', '/api/security/overview'), []);
  if (ov.loading || se.loading) return <Loading />;
  if (ov.error) return <Failed e={ov.error} retry={ov.reload} />;
  const o = ov.data; const s = se.data;
  const accepted = o.consents.filter((c) => c.accepted).length;
  const lastExport = o.requests.find((r) => r.kind === 'export');
  const tile = (to, icon, tone, big, label) => <Link className="pv-tile" to={'/app/confidentialite/' + to}><span className={'pv-ico ' + tone}><Icon name={icon} /></span><b>{big}</b><span>{label}</span></Link>;
  return (
    <>
      <div className="pv-tiles">
        {tile('consentements', 'pv-check', '', `${accepted} / ${o.consents.length}`, t('consentements accordés'))}
        {s ? tile('securite', 'pv-user-shield', s.twofa.enabled ? 'ok' : 'warn', s.twofa.enabled ? t('Activée') : t('Désactivée'), t('double authentification')) : null}
        {s ? tile('securite', 'pv-laptop', '', String(s.sessions.length), t('appareil(s) connecté(s)')) : null}
        {tile('export', 'pv-download', '', lastExport ? fmtDate(lastExport.requestedAt) : t('Jamais'), t('dernier export de mes données'))}
        {tile('suppression', 'pv-trash', o.erasure.pending ? 'danger' : '', o.erasure.pending ? fmtDate(o.erasure.eraseAfter) : t('Aucune'), o.erasure.pending ? t('suppression programmée') : t('suppression en cours'))}
      </div>
      {o.erasure.pending ? <Note tone="danger">{t('Suppression de votre compte programmée le {date}. Vous pouvez encore l’annuler.', { date: fmtDate(o.erasure.eraseAfter) })} <Button size="sm" onClick={() => go('suppression')}>{t('Voir')}</Button></Note> : null}
      <Section id="pv-rights" icon="pv-shield" title={t('Vos droits')} desc={t('Les boutons de cette page agissent tout de suite. Pour toute autre demande, écrivez-nous : nous répondons dans un délai maximum de {n} jours.', { n: o.responseDays })}>
        <ul className="pv-rights">
          <li><b>{t('Accès')}</b><span>{t('savoir quelles données nous avons sur vous et en recevoir une copie.')}</span></li>
          <li><b>{t('Rectification')}</b><span>{t('corriger une information inexacte (votre profil se modifie dans l\'application).')}</span></li>
          <li><b>{t('Suppression')}</b><span>{t('demander que votre compte et vos données personnelles soient effacés.')}</span></li>
          <li><b>{t('Portabilité')}</b><span>{t('récupérer vos données dans un format ouvert (JSON) pour les réutiliser ailleurs.')}</span></li>
          <li><b>{t('Opposition')}</b><span>{t('refuser certains usages, par exemple les informations commerciales ou la mesure d\'audience.')}</span></li>
        </ul>
      </Section>
      <Requests list={o.requests} />
    </>
  );
}

function Consents() {
  const t = useT();
  const ov = useData(() => priv('GET', '/overview'), []);
  const { flash, ok, bad, clear } = useFlash();
  const [showHist, setShowHist] = useState(false);
  const hist = useData(() => (showHist ? priv('GET', '/consents') : Promise.resolve(null)), [showHist, ov.data]);
  if (ov.loading) return <Loading />;
  if (ov.error) return <Failed e={ov.error} retry={ov.reload} />;
  const data = ov.data;
  const set = async (kind, accepted) => {
    clear();
    try {
      if (kind === 'cookies') saveConsent({ analytics: accepted });
      else await priv('POST', '/consents', { kind, accepted });
      ok(accepted ? t('Consentement enregistré.') : t('Consentement retiré.'));
      setTimeout(ov.reload, kind === 'cookies' ? 400 : 0);
    } catch (e) { bad(e); }
  };
  const local = readConsent();
  return (
    <Section id="pv-consents" icon="pv-check" title={t('Mes consentements')} desc={t('Ce que vous avez accepté ou refusé, avec la date et la version du texte.')}>
      <Rows>
        {data.consents.map((c) => {
          const optional = OPTIONAL.includes(c.kind);
          const sub = (c.at ? t('{etat} le {date} (texte du {version})', { etat: c.accepted ? t('Accepté') : t('Refusé'), date: fmtDate(c.at, true), version: c.version }) : t('Pas encore de choix enregistré')) + (c.at && !c.upToDate ? ' · ' + t('texte mis à jour depuis : à relire') : '');
          return (
            <Row key={c.kind} title={t(KINDS[c.kind] || c.kind)} desc={<>{sub}{KIND_HELP[c.kind] ? <><br />{t(KIND_HELP[c.kind])}</> : null}</>}>
              {optional ? <Button size="sm" variant={c.accepted ? 'secondary' : 'primary'} onClick={() => set(c.kind, !c.accepted)}>{c.accepted ? t('Retirer') : t('Accepter')}</Button>
                : <Badge tone={c.accepted ? 'ok' : 'warn'} dot>{c.accepted ? t('Accepté') : t('Non accepté')}</Badge>}
            </Row>
          );
        })}
      </Rows>
      <div className="pv-act"><Button size="sm" onClick={openCookieSettings}>{t('Gérer mes cookies')}</Button><Button size="sm" variant="ghost" aria-expanded={showHist} onClick={() => setShowHist(!showHist)}>{showHist ? t("Masquer l'historique") : t("Voir l'historique")}</Button></div>
      {local ? <p className="muted small">{t('Choix de cookies sur cet appareil : mesure d\'audience {etat}.', { etat: local.analytics ? t('acceptée') : t('refusée') })}</p> : null}
      <Msg f={flash} />
      {showHist ? (hist.loading ? <Loading /> : hist.data && hist.data.history.length ? (
        <Rows>{hist.data.history.map((h, i) => <Row key={i} title={<>{t(KINDS[h.kind] || h.kind)} · {h.accepted ? t('Accepté') : t('Refusé')}</>} desc={fmtDate(h.at, true) + ' · ' + h.version} />)}</Rows>
      ) : <Empty icon="pv-history" title={t('Aucun historique.')} />) : null}
    </Section>
  );
}

function ExportBox() {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [busy, setBusy] = useState(false);
  const go = async () => { clear(); setBusy(true); try { await downloadFile('/api/privacy/export', 'mes-donnees-mabah.json'); ok(t('Votre export a été téléchargé.')); } catch (e) { bad(e); } setBusy(false); };
  return (
    <Section id="pv-export" icon="pv-file" title={t('Exporter toutes mes données')} desc={t('Un fichier JSON avec votre profil, vos consentements, vos connexions et les données personnelles liées à votre compte.')}>
      <Note>{t('Le fichier contient des données personnelles : conservez-le en lieu sûr. Vous pouvez refaire cette demande aussi souvent que vous le voulez.')}</Note>
      <div className="pv-act"><Button variant="primary" icon="pv-download" loading={busy} onClick={go}>{busy ? t('Préparation…') : t('Télécharger mes données')}</Button></div>
      <Msg f={flash} />
    </Section>
  );
}

function Erasure() {
  const t = useT();
  const ov = useData(() => priv('GET', '/overview'), []);
  const { flash, ok, bad, clear } = useFlash();
  const [pass, setPass] = useState(''); const [word, setWord] = useState(''); const [busy, setBusy] = useState(false);
  if (ov.loading) return <Loading />;
  if (ov.error) return <Failed e={ov.error} retry={ov.reload} />;
  const erasure = ov.data.erasure;
  const run = async (fn, done) => { clear(); setBusy(true); try { await fn(); ok(done); setPass(''); setWord(''); ov.reload(); } catch (e) { bad(new Error(tsrv(e.message))); } setBusy(false); };
  return (
    <Section id="pv-erase" icon="pv-trash" danger title={t('Supprimer mon compte')} desc={t('Votre compte est supprimé après un délai de réflexion de {n} jours, pendant lequel vous pouvez annuler.', { n: erasure.graceDays })}>
      {erasure.pending ? (
        <>
          <Note tone="danger" icon="pv-warn"><b>{t('Suppression programmée le {date}.', { date: fmtDate(erasure.eraseAfter) })}</b><p>{t("Jusqu'à cette date, rien n'est effacé : vous pouvez changer d'avis et annuler. Après, vos données personnelles sont anonymisées et ne peuvent plus être récupérées.")}</p></Note>
          <div className="pv-act"><Button variant="primary" loading={busy} onClick={() => run(() => priv('DELETE', '/erasure'), t('Suppression annulée. Votre compte est conservé.'))}>{t('Annuler la suppression')}</Button></div>
        </>
      ) : (
        <>
          <Note tone="warn">{t("Ensuite, vos données personnelles sont anonymisées. Si vous êtes propriétaire d'une organisation, transférez-la ou supprimez-la d'abord.")}</Note>
          <form className="pv-form" noValidate onSubmit={(e) => { e.preventDefault(); run(() => priv('POST', '/erasure', { password: pass, confirm: word }), t('Suppression programmée.')); }}>
            <PasswordInput label={t('Votre mot de passe')} value={pass} onChange={setPass} id="er_pass" />
            <label className="pv-field" htmlFor="er_word"><span>{t('Pour confirmer, écrivez SUPPRIMER')}</span><input id="er_word" className="pv-in" type="text" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} /></label>
            <div className="pv-act"><Button variant="danger" type="submit" loading={busy} disabled={!pass || word !== 'SUPPRIMER'}>{t('Demander la suppression de mon compte')}</Button></div>
          </form>
        </>
      )}
      <Msg f={flash} />
    </Section>
  );
}

function Requests({ list }) {
  const t = useT();
  return (
    <Section id="pv-requests" icon="pv-history" title={t('Mes demandes')} desc={t('Exports et suppressions demandés depuis votre compte.')}>
      {!list || !list.length ? <Empty icon="pv-file" title={t('Aucune demande pour le moment')}>{t('Vos exports et demandes de suppression apparaîtront ici.')}</Empty> : (
        <Rows>{list.map((r) => (
          <Row key={r.id} title={t(REQUEST_KIND[r.kind] || r.kind)} desc={t('Demandée le {date}', { date: fmtDate(r.requestedAt, true) }) + (r.doneAt ? ' · ' + t('traitée le {date}', { date: fmtDate(r.doneAt) }) : r.dueAt ? ' · ' + t('réponse avant le {date}', { date: fmtDate(r.dueAt) }) : '')}>
            <Badge tone={r.status === 'done' ? 'ok' : 'warn'} dot>{t(STATUS[r.status] || r.status)}</Badge>
          </Row>))}
        </Rows>
      )}
    </Section>
  );
}

const EVENT = {
  'twofa.enable': ['pv-user-shield', 'Double authentification activée'], 'twofa.disable': ['pv-user-shield', 'Double authentification désactivée'], 'twofa.recovery_regenerate': ['pv-key', 'Nouveaux codes de secours'], 'twofa.recovery_used': ['pv-key', 'Code de secours utilisé'],
  'session.revoke': ['pv-laptop', 'Appareil déconnecté'], 'session.revoke_others': ['pv-laptop', 'Autres appareils déconnectés'], 'security.password_check_fail': ['pv-warn', 'Mot de passe incorrect saisi'],
  'login.new_device': ['pv-laptop', 'Connexion depuis un nouvel appareil'], 'privacy.export': ['pv-download', 'Export de mes données'], 'privacy.erasure_requested': ['pv-trash', 'Suppression du compte demandée'], 'privacy.erasure_cancelled': ['pv-trash', 'Suppression du compte annulée'],
  'privacy.org_export': ['pv-download', "Export d'une organisation"], 'privacy.retention_change': ['pv-sliders', 'Durée de conservation modifiée'], 'org.ownership_transfer': ['pv-swap', 'Propriété d’une organisation transférée'],
};
function Activity() {
  const t = useT();
  const st = useData(() => rq('GET', '/api/security/activity'), []);
  return (
    <Section id="pv-activity" icon="pv-history" title={t("Journal d'activité")} desc={t('Les événements de sécurité de votre compte : connexions inhabituelles, changements de protection, exports.')}>
      {st.loading ? <Loading /> : st.error ? <Failed e={st.error} retry={st.reload} /> : !st.data.events.length ? <Empty icon="pv-history" title={t('Rien à signaler')}>{t('Les événements de sécurité de votre compte apparaîtront ici.')}</Empty> : (
        <ul className="pv-time">{st.data.events.map((e) => {
          const [icon, label] = EVENT[e.action] || ['pv-info', e.action];
          return <li key={e.id}><span className={'pv-ico ' + (e.severity === 'warn' || e.severity === 'high' ? 'warn' : '')}><Icon name={icon} /></span><div><b>{EVENT[e.action] ? t(label) : label}</b><small>{[tsrv(e.device), e.ip].filter(Boolean).join(' · ')}</small></div><time dateTime={e.at}>{fmtDate(e.at, true)}</time></li>;
        })}</ul>
      )}
    </Section>
  );
}
