import { useState } from 'react';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { Flash, downloadFile, fmtDate, priv, useData, useFlash } from './util.jsx';

const ROLE = { owner: 'Propriétaire', admin: 'Administrateur' };

/** Écran d'organisation pour les administrateurs : 2FA exigée, durées de conservation, registre des accès, export complet. */
export default function OrgPrivacy({ orgs }) {
  const t = useT();
  const [orgId, setOrgId] = useState(orgs[0].id);
  const org = orgs.find((o) => o.id === Number(orgId)) || orgs[0];
  const owner = org.role === 'owner';
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {orgs.length > 1 ? (
        <label className="fld" htmlFor="po_org"><span>{t('Organisation')}</span>
          <select id="po_org" style={{ fontSize: 16 }} value={orgId} onChange={(e) => setOrgId(Number(e.target.value))}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </label>
      ) : <p><b>{org.name}</b></p>}
      <Require2fa key={'s' + org.id} orgId={org.id} owner={owner} />
      <Retention key={'r' + org.id} orgId={org.id} owner={owner} />
      <AccessLog key={'a' + org.id} orgId={org.id} />
      {owner ? <OrgExport key={'e' + org.id} orgId={org.id} /> : null}
    </div>
  );
}

function Require2fa({ orgId, owner }) {
  const t = useT();
  const st = useData(() => priv('GET', `/orgs/${orgId}/security`), [orgId]);
  const { flash, ok, bad, clear } = useFlash();
  if (st.loading) return <p className="ws-empty">{t('Chargement…')}</p>;
  if (st.error) return <p className="ws-err" role="alert">{tsrv(st.error.message)}</p>;
  const { require2fa, admins } = st.data;
  const toggle = () => { clear(); priv('PUT', `/orgs/${orgId}/require-2fa`, { enabled: !require2fa }).then(() => { ok(require2fa ? t('Double authentification non exigée.') : t('Double authentification exigée pour les administrateurs.')); st.reload(); }, bad); };
  return (
    <section className="ws-sub">
      <h2>{t('Double authentification des administrateurs')}</h2>
      <p className="muted small">{t("Quand elle est exigée, un administrateur ou un propriétaire sans double authentification ne peut plus ouvrir cette organisation tant qu'il ne l'a pas activée.")}</p>
      <p><b className={require2fa ? 'ok' : 'late'}>{require2fa ? t('Exigée') : t('Non exigée')}</b>{owner ? <> <button type="button" className="btn small" onClick={toggle}>{require2fa ? t('Ne plus exiger') : t('Exiger la double authentification')}</button></> : null}</p>
      {!owner ? <p className="small muted">{t('Seul le propriétaire peut modifier ce réglage.')}</p> : null}
      <Flash f={flash} />
      {admins.map((a) => (
        <div className="line" key={a.userId}><span><b>{a.name}</b> <small>{t(ROLE[a.role] || a.role)}</small></span><span className={'pill ' + (a.twofa ? 'good' : 'bad')}>{a.twofa ? t('2FA activée') : t('2FA absente')}</span></div>
      ))}
    </section>
  );
}

function Retention({ orgId, owner }) {
  const t = useT();
  const st = useData(() => priv('GET', `/orgs/${orgId}/retention`), [orgId]);
  const { flash, ok, bad, clear } = useFlash();
  const [vals, setVals] = useState({});
  if (st.loading) return <p className="ws-empty">{t('Chargement…')}</p>;
  if (st.error) return <p className="ws-err" role="alert">{tsrv(st.error.message)}</p>;
  const save = (r) => { clear(); priv('PUT', `/orgs/${orgId}/retention`, { kind: r.kind, days: Number(vals[r.kind] ?? r.days) }).then(() => { ok(t('Durée enregistrée.')); setVals((v) => { const n = { ...v }; delete n[r.kind]; return n; }); st.reload(); }, bad); };
  return (
    <section className="ws-sub">
      <h2>{t('Durées de conservation')}</h2>
      <p className="muted small">{t('Au-delà de la durée choisie, les données de ce type sont supprimées automatiquement.')}</p>
      {st.data.rules.map((r) => {
        const v = vals[r.kind] ?? r.days;
        const changed = String(v) !== String(r.days);
        return (
          <div className="line" key={r.kind}>
            <span><b>{tsrv(r.label)}</b><br /><small>{t('Par défaut {n} jours, minimum {min}.', { n: r.default, min: r.min })}{r.custom ? ' · ' + t('personnalisée') : ''}</small></span>
            {owner ? (
              <span className="row">
                <input type="number" min={r.min} aria-label={tsrv(r.label)} style={{ width: 96, fontSize: 16 }} value={v} onChange={(e) => setVals((x) => ({ ...x, [r.kind]: e.target.value }))} />
                <small>{t('jours')}</small>
                <button type="button" className="btn small" disabled={!changed} onClick={() => save(r)}>{t('Enregistrer')}</button>
              </span>
            ) : <b>{t('{n} jours', { n: r.days })}</b>}
          </div>
        );
      })}
      <p className="small muted">{tsrv(st.data.note)}</p>
      {!owner ? <p className="small muted">{t('Seul le propriétaire peut modifier ces durées.')}</p> : null}
      <Flash f={flash} />
    </section>
  );
}

function AccessLog({ orgId }) {
  const t = useT();
  const st = useData(() => priv('GET', `/orgs/${orgId}/access-log`), [orgId]);
  return (
    <section className="ws-sub">
      <h2>{t("Registre des accès aux données sensibles")}</h2>
      <p className="muted small">{t('Qui a consulté ou exporté des données personnelles sensibles (paie, ressources humaines, exports), et quand.')}</p>
      {st.loading ? <p className="ws-empty">{t('Chargement…')}</p> : st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : st.data.entries.length ? (
        st.data.entries.map((e) => <div className="line" key={e.id}><span><b>{e.who}</b> · {e.action}<br /><small>{e.target || ''}</small></span><small>{fmtDate(e.at, true)}</small></div>)
      ) : <p className="ws-empty">{t('Aucun accès enregistré pour le moment.')}</p>}
    </section>
  );
}

function OrgExport({ orgId }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [busy, setBusy] = useState(false);
  const go = async () => { clear(); setBusy(true); try { await downloadFile(`/api/privacy/orgs/${orgId}/export`, `organisation-${orgId}.json`); ok(t("L'export de l'organisation a été téléchargé.")); } catch (e) { bad(e); } setBusy(false); };
  return (
    <section className="ws-sub">
      <h2>{t("Exporter toute l'organisation")}</h2>
      <p className="muted small">{t("Fichier JSON avec toutes les données de l'organisation (réservé au propriétaire). Conservez-le en lieu sûr : il contient des données personnelles.")}</p>
      <p><button type="button" className="btn primary small" disabled={busy} onClick={go}>{busy ? t('Préparation…') : t("Télécharger l'export de l'organisation")}</button></p>
      <Flash f={flash} />
    </section>
  );
}
