import { getLocale, useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { useState } from 'react';

const day = (iso) => { try { return new Date(iso).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };

/* Organisations liées (filiales, sites) : la direction générale crée un lien d'association à usage unique ; la personne qui crée l'organisation colle le code. */
export default function Links() {
  const { oapi, modal, fail, toast, confirm, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/entreprise/links'), [orgId]);
  return (
    <Loaded state={st}>{(j) => {
      if (!j.canManage) {
        return (
          <Card title={t('Organisations liées')}>
            <p className="muted">{j.main ? t("Seules la direction générale et le propriétaire de l'organisation principale gèrent les liens d'association.") : t("Cette organisation est liée à l'entreprise : sa direction générale est commune, son abonnement est celui de l'entreprise principale, et ses affectations lui sont propres.")}</p>
          </Card>
        );
      }
      const create = () => modal(t("Nouveau lien d'association"), (close) => <NewLink done={(r) => { close(); st.reload(); modal(t("Lien d'association créé"), () => <Created r={r} />); }} />);
      const revoke = (l) => confirm(t("Révoquer ce lien ? Il ne pourra plus être utilisé."), () => oapi('DELETE', '/entreprise/links/' + l.id).then(() => { toast(t('Lien révoqué.')); st.reload(); }).catch(fail), t('Révoquer'));
      const stl = { pending: t('En attente'), used: t('Utilisé'), expired: t('Expiré'), revoked: t('Révoqué') };
      return (
        <>
          <Card title={t('Organisations de l\'entreprise')} subtitle={t("{n} organisation(s) sur {max} permises par l'abonnement de l'entreprise principale.", { n: j.limits.orgsUsed, max: j.limits.orgs })}>
            <ul className="ent-list">{j.orgs.map((o) => (
              <li className="ent-row" key={o.id}><div className="ent-row-b"><b>{o.name}</b> {o.main ? <Badge tone="brand">{t('Principale')}</Badge> : <Badge>{t('Liée')}</Badge>}<small className="muted"> · {t('{n} personne(s)', { n: o.members })}</small></div></li>
            ))}</ul>
          </Card>
          <Card title={t("Liens d'association")} subtitle={t("Un lien est à usage unique et expire. La personne qui crée l'organisation (filiale, site) le colle dans « Code d'association » : l'organisation rejoint l'entreprise, la structure est copiée, vous restez directeur général.")} actions={<Button variant="primary" icon="plus" onClick={create}>{t('Créer un lien')}</Button>}>
            {j.links.length === 0 ? <p className="muted">{t("Aucun lien pour l'instant.")}</p> : j.links.map((l) => (
              <div className="line" key={l.id}><span><b>{l.label || t('Sans nom')}</b> <small>· …{l.hint} · {t("expire le {date}", { date: day(l.expiresAt) })}{l.copyStructure ? ' · ' + t('structure copiée') : ''}</small></span>
                <span className="ent-actions"><Badge tone={l.status === 'pending' ? 'warn' : l.status === 'used' ? 'ok' : 'neutral'}>{stl[l.status]}</Badge>{l.status === 'pending' ? <Button size="sm" variant="ghost" icon="trash" onClick={() => revoke(l)}>{t('Révoquer')}</Button> : null}</span></div>
            ))}
          </Card>
          {j.log.length ? <Card title={t('Journal des rattachements')}><ul className="ent-log">{j.log.map((l, i) => <li key={i}><b>{l.action === 'org_linked' ? t('Organisation rattachée') : l.action === 'link_created' ? t('Lien créé') : l.action === 'link_revoked' ? t('Lien révoqué') : t('Personne ajoutée')}</b> <span className="muted">{l.detail} · {l.name || ''} · {day(l.at)}</span></li>)}</ul></Card> : null}
        </>
      );
    }}</Loaded>
  );
}

function NewLink({ done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [v, setV] = useState({ label: '', days: '7', copyStructure: true });
  const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setBusy(true); oapi('POST', '/entreprise/links', { label: v.label, days: Number(v.days), copyStructure: v.copyStructure }).then(done).catch(fail).finally(() => setBusy(false)); }}>
      <label className="fld"><span>{t('Pour quelle organisation ?')} <small>({t('facultatif')})</small></span><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder={t('Filiale de Douala, site de Yaoundé…')} /></label>
      <label className="fld"><span>{t('Validité')}</span>
        <select value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })}><option value="3">{t('3 jours')}</option><option value="7">{t('7 jours')}</option><option value="14">{t('14 jours')}</option><option value="30">{t('30 jours')}</option></select></label>
      <label className="sp-check"><input type="checkbox" checked={v.copyStructure} onChange={(e) => setV({ ...v, copyStructure: e.target.checked })} /> {t("Copier la structure de l'entreprise (directions, départements, postes, profils), sans les personnes")}</label>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Créer le lien')}</Button></div>
    </form>
  );
}

function Created({ r }) {
  const { copy } = useWs();
  const t = useT();
  return (
    <div className="ws-form">
      <p><b>{t("Copiez ce code maintenant : il ne sera plus affiché.")}</b></p>
      <div className="ent-code"><code>{r.code}</code><Button size="sm" icon="copy" onClick={() => copy(r.code, t("Code d'association copié."))}>{t('Copier le code')}</Button></div>
      <p className="muted">{t("Donnez-le à la personne qui crée l'organisation : elle le colle dans « Code d'association » lors de la création. Il expire le {date} et ne sert qu'une fois.", { date: day(r.expiresAt) })}</p>
    </div>
  );
}
