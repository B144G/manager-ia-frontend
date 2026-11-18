import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, Field, Icon, Table } from '../../ui.jsx';
import { useCp, useForm, useL } from './common.jsx';

/* Rôles commerciaux : le responsable du compte désigne le responsable commercial ; celui-ci désigne assistants et commerciaux terrain.
   Le tableau des droits reprend les règles du serveur (qui reste seul juge) pour les rendre lisibles. */

const ALL = ['view', 'write', 'quote', 'activity', 'approve', 'targets', 'rules', 'pricing', 'commissions', 'merge', 'delete', 'export', 'coach', 'roles_light', 'roles'];
const RIGHTS = {
  sales_manager: ALL.filter((p) => p !== 'roles'),
  sales_assistant: ['view', 'write', 'quote', 'activity'],
  sales_field: ['view', 'write', 'quote', 'activity'],
  viewer: ['view'],
};

function RoleForm({ m, close }) {
  const t = useT();
  const L = useL();
  const { api, has, zones, teams, reloadTeam } = useCp();
  const { toast } = useWs();
  const f = useForm({ role: m.crole || 'none', teamId: m.teamId ? String(m.teamId) : '' });
  const zs = useForm({ zoneIds: m.zoneIds });
  const toggleZone = (id) => zs.setV((s) => ({ zoneIds: s.zoneIds.includes(id) ? s.zoneIds.filter((x) => x !== id) : [...s.zoneIds, id] }));
  const roles = ['none', 'sales_assistant', 'sales_field', ...(has('roles') ? ['sales_manager'] : [])];
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      await api('PUT', '/roles/' + m.userId, { role: f.v.role, teamId: f.v.teamId || null, zoneIds: zs.v.zoneIds });
      toast(t('Rôle enregistré.')); close(); reloadTeam();
    }); }}>
      <Field label={t('Rôle commercial')}>{(p) => <select {...p} value={f.v.role} onChange={f.set('role')}>{roles.map((r) => <option key={r} value={r}>{L.cRole[r]}</option>)}</select>}</Field>
      {f.v.role !== 'none' ? (
        <>
          <Field label={t('Équipe')}>{(p) => <select {...p} value={f.v.teamId} onChange={f.set('teamId')}><option value="">{t('Aucune')}</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
          <fieldset className="cp-fs cp-pick"><legend>{t('Zones')}</legend>
            {zones.length ? zones.map((z) => <label className="cp-check" key={z.id}><input type="checkbox" checked={zs.v.zoneIds.includes(z.id)} onChange={() => toggleZone(z.id)} /> {z.name}</label>) : <p className="small muted">{t('Aucune zone définie.')}</p>}
          </fieldset>
        </>
      ) : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export default function TeamRoles() {
  const t = useT();
  const L = useL();
  const { members, teams, zones, has, me } = useCp();
  const { modal } = useWs();
  const canEdit = (m) => (has('roles') || has('roles_light')) && !m.implicit && (m.userId !== me.userId || me.boss) && (has('roles') || m.crole !== 'sales_manager');
  const cols = [
    { key: 'name', label: t('Personne'), render: (m) => <><b>{m.name}</b>{m.title ? <span className="muted small"> · {m.title}</span> : null}</> },
    { key: 'org', label: t("Rôle dans l'organisation"), render: (m) => L.orgRole[m.orgRole] || m.orgRole },
    { key: 'role', label: t('Rôle commercial'), render: (m) => (m.crole ? <Badge tone={m.crole === 'sales_manager' ? 'brand' : 'info'}>{L.cRole[m.crole]}</Badge> : <span className="muted">{L.cRole.none}</span>) },
    { key: 'team', label: t('Équipe'), render: (m) => (teams.find((x) => x.id === m.teamId) || {}).name || '—' },
    { key: 'zones', label: t('Zones'), render: (m) => m.zoneIds.map((id) => (zones.find((z) => z.id === id) || {}).name).filter(Boolean).join(', ') || '—' },
    { key: 'act', label: '', render: (m) => (canEdit(m) ? <Button size="sm" onClick={() => modal(t('Rôle de {nom}', { nom: m.name }), (close) => <RoleForm m={m} close={close} />)}>{t('Modifier')}</Button> : m.implicit ? <span className="small muted">{t('Tous les droits')}</span> : null) },
  ];
  const roleCols = ['sales_manager', 'sales_assistant', 'sales_field', 'viewer'];
  const rightsRows = ALL.map((p) => ({ id: p, perm: p }));
  return (
    <div className="cp-stack">
      <Card title={t('Rôles commerciaux')} subtitle={t("Le propriétaire et les administrateurs ont tous les droits et désignent le responsable commercial. Celui-ci désigne les assistants et les commerciaux terrain.")}>
        <Table caption={t('Rôles commerciaux')} rowKey="userId" columns={cols} rows={members} empty={t('Aucun membre.')} />
      </Card>
      <Card title={t('Ce que chaque rôle peut faire')} subtitle={t('Un commercial terrain ne voit et ne modifie que ses propres comptes, prospects et opportunités. Sans rôle, un responsable de l’organisation consulte seulement.')}>
        <Table caption={t('Droits par rôle')} columns={[
          { key: 'perm', label: t('Droit'), render: (r) => L.perm[r.perm] },
          ...roleCols.map((rc) => ({ key: rc, label: L.cRole[rc], align: 'r', render: (r) => (RIGHTS[rc].includes(r.perm) ? <span className="ok"><Icon name="ok" title={t('Oui')} /><span className="sr-only">{t('Oui')}</span></span> : <span className="muted" aria-label={t('Non')}>—</span>) })),
        ]} rows={rightsRows} />
      </Card>
    </div>
  );
}
