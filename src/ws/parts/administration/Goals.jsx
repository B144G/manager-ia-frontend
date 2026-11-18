import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Button, Table } from '../../ui.jsx';
import { Section, View, num, toInt, useAdm, useFormModal, useMembers, memberOptions } from './kit.jsx';

/* Objectifs administratifs. Si RH talents est présent, le management par objectifs s'y fait (lu seulement depuis le tableau de bord) ;
   sinon ce petit tableau suffit à suivre quelques objectifs d'administration. */
export default function Goals() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, orgId, fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const edit = (g) => form(g ? t('Modifier l’objectif') : t('Nouvel objectif'), [
    { k: 'title', label: t('Objectif'), value: g ? g.title : '', required: true }, { k: 'area', label: t('Domaine'), value: g ? g.area : '' },
    { k: 'target', label: t('Cible'), value: g ? String(g.target) : '100' }, { k: 'current', label: t('Valeur actuelle'), value: g ? String(g.current) : '0' }, { k: 'unit', label: t('Unité'), value: g ? g.unit : '%' },
    { k: 'dueDate', label: t('Échéance'), type: 'date', value: g ? g.dueDate || '' : '' }, { k: 'ownerId', label: t('Responsable'), type: 'select', value: g && g.ownerId ? String(g.ownerId) : '', options: memberOptions(members, t) },
    ...(g ? [{ k: 'status', label: t('Statut'), type: 'select', value: g.status, options: [['open', t('En cours')], ['achieved', t('Atteint')], ['cancelled', t('Abandonné')]] }] : []),
  ], (v) => api(g ? 'PUT' : 'POST', g ? `/report/goals/${g.id}` : '/report/goals', { title: v.title, area: v.area, target: num(v.target), current: num(v.current), unit: v.unit, dueDate: v.dueDate || null, ownerId: toInt(v.ownerId), ...(v.status ? { status: v.status } : {}) }), { wide: true });
  return (
    <View path="/report/goals">{(d) => (
      <>
        {d.managedByRh ? <Alert tone="info" title={t('Objectifs gérés dans RH talents')}>{t('Le management par objectifs se fait dans le module Ressources humaines. Le tableau de bord de l’Administration en lit les objectifs d’entreprise et de service.')} <Button size="sm" to={`/app/${orgId}/hr`}>{t('Ouvrir Ressources humaines')}</Button></Alert> : (
          <Section title={t('Objectifs administratifs')} subtitle={t('Quelques objectifs simples : documents archivés, procédures à jour, délais de validation…')} actions={perms.org_manage ? <Button variant="primary" icon="plus" onClick={() => edit(null)}>{t('Objectif')}</Button> : null}>
            <Table caption={t('Objectifs')} rows={d.goals} empty={t('Aucun objectif.')} columns={[
              { key: 'title', label: t('Objectif'), render: (g) => <><b>{g.title}</b><small>{g.area}</small></> }, { key: 'p', label: t('Avancement'), render: (g) => <div className="adm-bar" aria-label={`${g.progress} %`}><i style={{ width: g.progress + '%' }} /></div> },
              { key: 'v', label: t('Valeur'), align: 'r', render: (g) => `${g.current} / ${g.target} ${g.unit}` }, { key: 'due', label: t('Échéance'), render: (g) => (g.dueDate ? dateFr(g.dueDate) : '—') },
              { key: 'a', label: '', render: (g) => (perms.org_manage ? <span className="row"><Button size="sm" variant="ghost" iconOnly icon="pen" label={t('Modifier')} onClick={() => edit(g)} /><Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={async () => { try { await api('DELETE', `/report/goals/${g.id}`); reload(); } catch (e) { fail(e); } }} /></span> : null) },
            ]} />
          </Section>
        )}
      </>
    )}
    </View>
  );
}
