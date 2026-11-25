import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Card, Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

const LABEL = { orgs: 'Organisations', members: 'Personnes', branches: 'Antennes', ai: 'Messages IA du mois', directions: 'Directions', departments: 'Départements', posts: 'Postes', people: "Personnes de l'entreprise", partners: 'Partenaires', sharedSpaces: 'Espaces partagés' };
const TIER = { free: 'Offre de base', pro: 'Offre Pro', unlimited: 'Offre illimitée' };

/* Abonnement et usage : ce que l'abonnement de l'entreprise permet, et ce qui est utilisé (organisations liées comprises). */
export default function Usage() {
  const { oapi, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/entreprise/usage'), [orgId]);
  return (
    <Loaded state={st}>{(j) => (
      <Card title={t('Abonnement et usage')} subtitle={t("L'abonnement est celui du titulaire de l'entreprise : les organisations liées en bénéficient. Au-delà d'une limite, la création est refusée avec un message clair.")} actions={<Badge tone="brand">{tsrv(TIER[j.tier])} · {tsrv(j.plan)}</Badge>}>
        {j.linked ? <p className="muted small">{t("Cette organisation est liée : elle utilise l'abonnement de l'entreprise principale.")}</p> : null}
        <ul className="ent-list">{j.items.map((x) => {
          const pct = x.max ? Math.min(100, Math.round((x.used / x.max) * 100)) : 0;
          return (
            <li className="ent-usage" key={x.key}>
              <div className="ent-usage-h"><b>{tsrv(LABEL[x.key])}</b><span className={pct >= 100 ? 'ent-over' : ''}>{x.used.toLocaleString()} / {x.max.toLocaleString()}</span></div>
              <div className="ent-bar" role="progressbar" aria-valuemin={0} aria-valuemax={x.max} aria-valuenow={x.used} aria-label={tsrv(LABEL[x.key])}><span className={pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''} style={{ width: pct + '%' }} /></div>
              {x.perOrg ? <small className="muted">{t('{n} par organisation', { n: x.perOrg })}</small> : x.scope === 'org' ? <small className="muted">{t('pour cette organisation')}</small> : null}
            </li>
          );
        })}</ul>
        <p className="muted small">{t('Fichiers déposés : {mb} Mo au plus · profils personnalisés : {used} sur {max} · objets partagés par espace : {o}', { mb: j.extra.fileMb, used: j.extra.profilesUsed, max: j.extra.profiles, o: j.extra.objectsPerSpace })}</p>
      </Card>
    )}</Loaded>
  );
}
