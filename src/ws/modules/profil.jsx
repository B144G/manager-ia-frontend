import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { Badge, EmptyState, Icon, Loaded, useLoad } from '../ui.jsx';
import { useWs } from '../WsContext.jsx';
import { COMPONENTS, ListBlock, TasksBlock, Tiles } from '../parts/entreprise/ProfileBlocks.jsx';
import { MODULE_TITLES } from '../parts/entreprise/lib.js';
import '../../styles/ws-entreprise.css';

/* Mon espace de travail : le profil de rôle du poste (blocs, actions rapides, mode mobile). Le profil n'ouvre rien de plus que les droits de la personne. */
export default function Profil() {
  const { oapi, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/entreprise/my-profile'), [orgId]);
  return (
    <Loaded state={st}>{(j) => {
      if (!j.profile) return <EmptyState icon="briefcase" title={t("Aucun profil de poste pour l'instant")}>{t("Votre profil apparaît dès que votre administrateur vous affecte à un poste dans l'organigramme.")}</EmptyState>;
      return (
        <div className={'ent-profile layout-' + j.profile.layout}>
          <div className="ws-head">
            <div>
              <h1>{t('Mon espace de travail')}</h1>
              <p className="muted">{j.posts.map((p) => tsrv(p)).join(' · ') || tsrv(j.profile.title)} <Badge tone="brand">{tsrv(j.profile.title)}</Badge></p>
            </div>
          </div>
          {j.quick.length ? (
            <ul className="ent-quick" aria-label={t('Actions rapides')}>
              {j.quick.map((x) => <li key={x.module + x.label}><Link className="ent-qbtn" to={`/app/${orgId}/${x.module}`}><Icon name="chevron-right" /><span>{tsrv(x.label)}</span></Link></li>)}
            </ul>
          ) : null}
          <div className="ent-blocks">
            {j.blocks.map((b, i) => {
              if (b.type === 'tiles') return <Tiles key={i} b={b} />;
              if (b.type === 'list') return <ListBlock key={i} b={b} />;
              if (b.type === 'tasks') return <TasksBlock key={i} b={b} />;
              const C = COMPONENTS[b.name];
              return C ? <C key={i} /> : null;
            })}
          </div>
          {j.modules.length ? (
            <section className="ws-card ent-block">
              <h2>{t('Mes écrans')}</h2>
              <div className="ent-holders">{j.modules.map((m) => <Link className="ent-chip" key={m} to={`/app/${orgId}/${m}`}>{tsrv(MODULE_TITLES[m] || m)}</Link>)}</div>
            </section>
          ) : null}
        </div>
      );
    }}</Loaded>
  );
}
