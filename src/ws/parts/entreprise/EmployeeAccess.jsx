import { useState } from 'react';
import { rq } from '../../../lib/api.js';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { Button, Card, Form, Loading, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

const when = (iso) => { try { return new Date(iso).toLocaleString(getLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const day = (iso) => { try { return new Date(iso).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };

/** Sécurité du compte : connexion avec le code de l'entreprise, secret personnel, appareils de confiance de la personne. */
export function MyAccess() {
  const { orgId, toast, fail } = useWs();
  const t = useT();
  const st = useLoad(() => rq('GET', '/api/entreprise-auth/devices'), []);
  if (st.loading && !st.data) return <Loading />;
  if (!st.data) return null;
  const d = st.data;
  const del = (id) => rq('DELETE', '/api/entreprise-auth/devices/' + id).then(() => { toast(t('Appareil retiré.')); st.reload(); }, fail);
  return (
    <section className="ws-sub" style={{ marginBottom: 18 }}>
      <h2>{t("Connexion avec le code de l'entreprise")}</h2>
      <p className="muted small">{d.hasCompanyLogin ? t('Active : vous pouvez vous connecter avec le code de l\'entreprise, votre e-mail et votre secret.') : t("Pas encore activée : choisissez un secret (mot de passe ou code PIN) pour vous connecter avec le code de l'entreprise.")}</p>
      <Form submitText={d.hasCompanyLogin ? t('Changer mon secret') : t('Activer ma connexion employé')} onSubmit={(v) => rq('PUT', '/api/entreprise-auth/secret', { orgId, current: v.current, method: v.method, secret: v.secret }).then(() => { toast(t('Secret enregistré. Vos appareils de confiance ont été retirés.')); st.reload(); })}
        fields={[
          { k: 'current', label: d.hasCompanyLogin ? t('Secret actuel') : t('Mot de passe actuel'), type: 'password', required: true },
          { k: 'method', label: t('Type de secret'), type: 'select', options: [['pin', t('Code PIN (6 à 8 chiffres)')], ['password', t('Mot de passe')]], value: d.method || 'pin' },
          { k: 'secret', label: t('Nouveau secret'), type: 'password', required: true },
        ]} />
      <h3>{t('Appareils de confiance')}</h3>
      {d.devices.length === 0 ? <p className="muted small">{t('Aucun appareil de confiance.')}</p> : d.devices.map((x) => (
        <div className="line" key={x.id}><span><b>{x.label}</b>{x.current ? <small> · {t('cet appareil')}</small> : null}<small> · {t('dernière activité {date}', { date: when(x.lastSeen) })} · {t("valable jusqu'au {date}", { date: day(x.expiresAt) })}</small></span>
          <button className="link" type="button" onClick={() => del(x.id)}>{t('Retirer')}</button></div>
      ))}
      {d.devices.length > 1 ? <p><button className="btn small" type="button" onClick={() => rq('DELETE', '/api/entreprise-auth/devices').then(() => { toast(t('Appareils retirés.')); st.reload(); }, fail)}>{t('Retirer tous mes appareils')}</button></p> : null}
    </section>
  );
}

/** Entreprise › onglet Entreprise : code de l'entreprise, double authentification des profils sensibles, appareils de confiance de l'équipe. */
export function CompanyAccess({ ov, reload }) {
  const { oapi, can, toast, fail, confirm, copy } = useWs();
  const t = useT();
  const dev = useLoad(() => oapi('GET', '/entreprise/devices'), []);
  const [busy, setBusy] = useState(false);
  const owner = can('owner');
  const regen = () => confirm(t("Renouveler le code de l'entreprise ? L'ancien code ne fonctionnera plus pour se connecter."), () => oapi('POST', '/entreprise/company-code').then((j) => { toast(t('Nouveau code : {code}', { code: j.companyCode })); reload(); }).catch(fail), t('Renouveler'));
  const setTfa = (v) => { setBusy(true); oapi('PUT', '/entreprise/settings', { sensitive2fa: v }).then(() => { toast(t('Réglage enregistré.')); reload(); }).catch(fail).finally(() => setBusy(false)); };
  return (
    <Card title={t('Connexion des employés')}>
      <p className="muted">{t("Les employés se connectent sur la page « Connexion avec le code de l'entreprise » avec ce code, leur e-mail et leur secret personnel. Le code n'est pas un secret : il identifie l'entreprise.")}</p>
      <div className="line"><span><b className="ent-bigcode">{ov.companyCode}</b></span>
        <span className="ent-actions"><Button size="sm" icon="copy" onClick={() => copy(ov.companyCode, t("Code de l'entreprise copié."))}>{t('Copier')}</Button>
          {owner ? <Button size="sm" icon="refresh" onClick={regen}>{t('Renouveler')}</Button> : null}</span></div>
      <div className="line"><span><b>{ov.sensitive2fa ? t('Double authentification exigée pour les postes sensibles') : t('Double authentification non exigée')}</b>
        <small> {t("Direction générale, directeurs, finance et trésorerie : ceux qui utilisent la connexion employé doivent activer la double authentification pour accéder aux données.")}</small></span>
        {owner ? <Button size="sm" variant={ov.sensitive2fa ? 'secondary' : 'primary'} loading={busy} onClick={() => (ov.sensitive2fa ? confirm(t("Ne plus exiger la double authentification pour les postes sensibles ?"), () => setTfa(false), t('Ne plus exiger')) : setTfa(true))}>{ov.sensitive2fa ? t('Assouplir') : t('Exiger')}</Button> : null}</div>
      <h3>{t('Appareils de confiance de l\'équipe')}</h3>
      {dev.loading && !dev.data ? <Loading /> : null}
      {dev.data && dev.data.devices.length === 0 ? <p className="muted small">{t('Aucun appareil de confiance.')}</p> : null}
      {dev.data ? dev.data.devices.map((x) => (
        <div className="line" key={x.id}><span><b>{x.person}</b><small> · {x.label} · {t('dernière activité {date}', { date: when(x.lastSeen) })} · {t("valable jusqu'au {date}", { date: day(x.expiresAt) })}</small></span>
          <button className="link" type="button" onClick={() => confirm(t('Retirer cet appareil ? La personne devra se reconnecter.'), () => oapi('DELETE', '/entreprise/devices/' + x.id).then(() => { toast(t('Appareil retiré.')); dev.reload(); }).catch(fail), t('Retirer'))}>{t('Retirer')}</button></div>
      )) : null}
    </Card>
  );
}
