import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Loaded, Table, useLoad } from '../../ui.jsx';
import { Locked, Panel, useAct, useTl } from './common.jsx';

/* Droits RH : le propriétaire désigne qui tient quel rôle RH ; journal de traçabilité des écritures et des consultations de données confidentielles. */
export default function Rights() {
  const t = useT();
  const { dateFr } = useWs();
  const { tp, has, me, reloadMe } = useTl();
  const act = useAct();
  const roles = useLoad(() => (has('rh') ? tp('GET', '/roles') : Promise.resolve(null)), []);
  const audit = useLoad(() => (has('rh') ? tp('GET', '/audit') : Promise.resolve(null)), []);
  if (!has('rh')) return <Locked />;
  const NAME = { rh: t('RH (tout le module)'), recrut: t('Recrutement'), talent: t('Talents, GPEC, 360°, formation'), remun: t('Rémunération et effectifs') };
  const toggle = (m, role) => {
    const cur = new Set(m.rhRoles); if (cur.has(role)) cur.delete(role); else cur.add(role);
    act(tp('PUT', '/roles/' + m.userId, { roles: [...cur] }), () => { roles.reload(); audit.reload(); reloadMe(); });
  };
  const ACTION = { read: t('Consultation'), create: t('Création'), update: t('Modification'), delete: t('Suppression'), status: t('Changement d’état'), hire: t('Embauche'), set: t('Saisie'), close: t('Clôture'), progress: t('Avancement'), exit: t('Sortie') };
  return (
    <div className="tl-grid">
      <Alert tone="info">{t("Les évaluations, les objectifs individuels et les rémunérations sont confidentiels : seuls les rôles ci-dessous et la personne concernée y accèdent. Un administrateur non désigné n'y a pas accès.")}</Alert>
      <Panel title={t('Rôles RH')} note={me && me.isOwner ? '' : t('Seul le propriétaire de l’organisation désigne les rôles RH.')}>
        <Loaded state={roles}>{(r) => (
          <Table rows={r.members} rowKey="userId" columns={[{ key: 'name', label: t('Personne'), render: (m) => <b>{m.name}</b> }, { key: 'orgRole', label: t('Rôle dans l’organisation'), render: (m) => <Badge>{m.orgRole}</Badge> },
            ...r.roles.map((role) => ({ key: role, label: NAME[role], render: (m) => <input type="checkbox" aria-label={NAME[role] + ' — ' + m.name} checked={m.rhRoles.includes(role) || m.orgRole === 'owner'} disabled={!(me && me.isOwner) || m.orgRole === 'owner'} onChange={() => toggle(m, role)} /> }))]} />
        )}
        </Loaded>
      </Panel>
      <Panel title={t('Journal de traçabilité')} note={t("Chaque écriture et chaque consultation de données confidentielles est enregistrée (qui, quoi, quand). Les montants et les notes n'y figurent pas.")}>
        <Loaded state={audit}>{(a) => (
          <Table rows={a.items} empty={t('Journal vide.')} columns={[{ key: 'at', label: t('Quand'), render: (x) => dateFr(x.at.slice(0, 10)) + ' ' + x.at.slice(11, 16) }, { key: 'who', label: t('Qui') }, { key: 'entity', label: t('Élément'), render: (x) => x.entity.replace(/^rh_/, '') }, { key: 'action', label: t('Action'), render: (x) => ACTION[x.action] || x.action }]} />
        )}
        </Loaded>
      </Panel>
    </div>
  );
}
