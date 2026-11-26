import { useState } from 'react';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { Badge, Button } from '../ws/ui/index.jsx';
import { Empty, Msg, Note, Row, Rows, Section } from './kit.jsx';
import { downloadFile, fmtDate, priv, useData, useFlash } from './util.jsx';

const ROLE = { owner: 'Propriétaire', admin: 'Administrateur' };
const Loading = () => { const t = useT(); return <p className="ws-empty" role="status">{t('Chargement…')}</p>; };
const Failed = ({ e, retry }) => { const t = useT(); return <Note tone="danger">{tsrv(e.message)} <Button size="sm" onClick={retry}>{t('Réessayer')}</Button></Note>; };

/** Écran d'organisation pour les administrateurs : 2FA exigée, durées de conservation, registre des accès, export complet. */
export default function OrgPrivacy({ orgs }) {
  const t = useT();
  const [orgId, setOrgId] = useState(orgs[0].id);
  const org = orgs.find((o) => o.id === Number(orgId)) || orgs[0];
  const owner = org.role === 'owner';
  return (
    <>
      <Section id="po-org" icon="pv-building" title={org.name} desc={t('Confidentialité de cette organisation : protection des administrateurs, conservation des données et accès sensibles.')}>
        {orgs.length > 1 ? (
          <label className="pv-field pv-form" htmlFor="po_org"><span>{t('Organisation')}</span>
            <select id="po_org" className="pv-in" value={orgId} onChange={(e) => setOrgId(Number(e.target.value))}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </label>
        ) : null}
      </Section>
      <Require2fa key={'s' + org.id} orgId={org.id} owner={owner} />
      <Retention key={'r' + org.id} orgId={org.id} owner={owner} />
      <AccessLog key={'a' + org.id} orgId={org.id} />
      {owner ? <OrgExport key={'e' + org.id} orgId={org.id} /> : null}
    </>
  );
}

function Require2fa({ orgId, owner }) {
  const t = useT();
  const st = useData(() => priv('GET', `/orgs/${orgId}/security`), [orgId]);
  const { flash, ok, bad, clear } = useFlash();
  if (st.loading) return <Loading />;
  if (st.error) return <Failed e={st.error} retry={st.reload} />;
  const { require2fa, admins } = st.data;
  const toggle = () => { clear(); priv('PUT', `/orgs/${orgId}/require-2fa`, { enabled: !require2fa }).then(() => { ok(require2fa ? t('Double authentification non exigée.') : t('Double authentification exigée pour les administrateurs.')); st.reload(); }, bad); };
  return (
    <Section id="po-2fa" icon="pv-user-shield" tone={require2fa ? 'ok' : 'warn'} title={t('Double authentification des administrateurs')} desc={t("Quand elle est exigée, un administrateur ou un propriétaire sans double authentification ne peut plus ouvrir cette organisation tant qu'il ne l'a pas activée.")}
      actions={<Badge tone={require2fa ? 'ok' : 'warn'} dot>{require2fa ? t('Exigée') : t('Non exigée')}</Badge>}>
      {owner ? <div className="pv-act"><Button variant={require2fa ? 'secondary' : 'primary'} onClick={toggle}>{require2fa ? t('Ne plus exiger') : t('Exiger la double authentification')}</Button></div> : <p className="muted small">{t('Seul le propriétaire peut modifier ce réglage.')}</p>}
      <Msg f={flash} />
      <Rows>{admins.map((a) => <Row key={a.userId} title={a.name} desc={t(ROLE[a.role] || a.role)}><Badge tone={a.twofa ? 'ok' : 'danger'} dot>{a.twofa ? t('2FA activée') : t('2FA absente')}</Badge></Row>)}</Rows>
    </Section>
  );
}

function Retention({ orgId, owner }) {
  const t = useT();
  const st = useData(() => priv('GET', `/orgs/${orgId}/retention`), [orgId]);
  const { flash, ok, bad, clear } = useFlash();
  const [vals, setVals] = useState({});
  if (st.loading) return <Loading />;
  if (st.error) return <Failed e={st.error} retry={st.reload} />;
  const save = (r) => { clear(); priv('PUT', `/orgs/${orgId}/retention`, { kind: r.kind, days: Number(vals[r.kind] ?? r.days) }).then(() => { ok(t('Durée enregistrée.')); setVals((v) => { const n = { ...v }; delete n[r.kind]; return n; }); st.reload(); }, bad); };
  return (
    <Section id="po-retention" icon="pv-sliders" title={t('Durées de conservation')} desc={t('Au-delà de la durée choisie, les données de ce type sont supprimées automatiquement.')}>
      <Rows>
        {st.data.rules.map((r) => {
          const v = vals[r.kind] ?? r.days;
          const changed = String(v) !== String(r.days);
          return (
            <Row key={r.kind} title={tsrv(r.label)} desc={t('Par défaut {n} jours, minimum {min}.', { n: r.default, min: r.min }) + (r.custom ? ' · ' + t('personnalisée') : '')}>
              {owner ? (
                <>
                  <input type="number" className="pv-in" min={r.min} aria-label={tsrv(r.label)} style={{ width: 96 }} value={v} onChange={(e) => setVals((x) => ({ ...x, [r.kind]: e.target.value }))} />
                  <small>{t('jours')}</small>
                  <Button size="sm" variant="primary" disabled={!changed} onClick={() => save(r)}>{t('Enregistrer')}</Button>
                </>
              ) : <b>{t('{n} jours', { n: r.days })}</b>}
            </Row>
          );
        })}
      </Rows>
      <p className="muted small">{tsrv(st.data.note)}</p>
      {!owner ? <p className="muted small">{t('Seul le propriétaire peut modifier ces durées.')}</p> : null}
      <Msg f={flash} />
    </Section>
  );
}

function AccessLog({ orgId }) {
  const t = useT();
  const st = useData(() => priv('GET', `/orgs/${orgId}/access-log`), [orgId]);
  return (
    <Section id="po-access" icon="pv-history" title={t('Registre des accès aux données sensibles')} desc={t('Qui a consulté ou exporté des données personnelles sensibles (paie, ressources humaines, exports), et quand.')}>
      {st.loading ? <Loading /> : st.error ? <Failed e={st.error} retry={st.reload} /> : st.data.entries.length ? (
        <Rows>{st.data.entries.map((e) => <Row key={e.id} title={e.who + ' · ' + e.action} desc={e.target || ''}><small>{fmtDate(e.at, true)}</small></Row>)}</Rows>
      ) : <Empty icon="pv-eye" title={t('Aucun accès enregistré pour le moment.')} />}
    </Section>
  );
}

function OrgExport({ orgId }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [busy, setBusy] = useState(false);
  const go = async () => { clear(); setBusy(true); try { await downloadFile(`/api/privacy/orgs/${orgId}/export`, `organisation-${orgId}.json`); ok(t("L'export de l'organisation a été téléchargé.")); } catch (e) { bad(e); } setBusy(false); };
  return (
    <Section id="po-export" icon="pv-file" title={t("Exporter toute l'organisation")} desc={t("Fichier JSON avec toutes les données de l'organisation (réservé au propriétaire). Conservez-le en lieu sûr : il contient des données personnelles.")}>
      <div className="pv-act"><Button variant="primary" icon="pv-download" loading={busy} onClick={go}>{busy ? t('Préparation…') : t("Télécharger l'export de l'organisation")}</Button></div>
      <Msg f={flash} />
    </Section>
  );
}
