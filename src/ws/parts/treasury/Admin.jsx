import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Card, Form, Loaded, Table, useLoad } from '../../ui.jsx';

/* Trésorerie · équipe et droits, réglages (seuil de double validation, fonds de sécurité, paie) et journal de traçabilité. */

export function TeamScreen({ me }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/roles'), []);
  const label = { admin: t('Accès complet'), manager: t('Responsable de trésorerie'), treasurer: t('Trésorier'), '': t('Aucun accès') };
  const set = (m, role) => oapi('PUT', `/treasury/roles/${m.userId}`, { role }).then(() => { toast(t('Rôle mis à jour.')); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Alert tone="info">{t('Le responsable de trésorerie valide les opérations, fixe les seuils et le fonds de sécurité. Les trésoriers préparent les encaissements, décaissements et virements, et consultent les prévisions. Personne ne valide ce qu\'il a préparé.')}</Alert>
        <Card title={t('Qui peut faire quoi')} flush style={{ marginTop: 12 }}>
          <Table caption={t('Équipe')} columns={[
            { key: 'name', label: t('Personne'), render: (m) => <b>{m.name}</b> }, { key: 'org', label: t('Rôle dans l\'organisation'), render: (m) => ({ owner: t('Propriétaire'), admin: t('Administrateur'), manager: t('Responsable'), member: t('Membre') }[m.orgRole]) },
            { key: 'tre', label: t('Rôle de trésorerie'), render: (m) => <Badge tone={m.treRole === 'admin' || m.treRole === 'manager' ? 'brand' : m.treRole ? 'info' : 'outline'}>{label[m.treRole]}</Badge> },
            { key: 'act', label: '', render: (m) => (me.canAssign && m.treRole !== 'admin' ? (
              <select aria-label={t('Rôle de {n}', { n: m.name })} value={m.treRole} onChange={(e) => set(m, e.target.value)} style={{ maxWidth: 240 }}>
                <option value="">{t('Aucun accès')}</option><option value="treasurer">{t('Trésorier')}</option><option value="manager">{t('Responsable de trésorerie')}</option>
              </select>) : null) },
          ]} rows={j.members.map((m) => ({ ...m, id: m.userId }))} />
        </Card>
        {!me.canAssign ? <p className="small muted" style={{ marginTop: 8 }}>{t('Seuls le propriétaire et les administrateurs désignent les rôles.')}</p> : null}
      </>
    )}</Loaded>
  );
}

export function SettingsScreen({ me }) {
  const t = useT();
  const { oapi, toast, can, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/settings'), []);
  return (
    <Loaded state={st}>{({ settings: s }) => (
      <Card title={t('Réglages de la trésorerie')} subtitle={me.canConfigure ? t('Réservés au responsable de trésorerie.') : t('Lecture seule : ces réglages sont fixés par le responsable de trésorerie.')}>
        {me.canConfigure ? (
          <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/settings', { approvalThreshold: v.approvalThreshold, safetyMode: v.safetyMode, safetyDays: v.safetyDays, safetyAmount: v.safetyAmount, minBalance: v.minBalance, payday: v.payday, includeTrend: v.includeTrend === '1', ...(can('admin') ? { strictSeparation: v.strictSeparation === '1' } : {}) }).then(() => { toast(t('Réglages enregistrés.')); st.reload(); }).catch((e) => { fail(e); throw e; })}
            fields={[
              { k: 'approvalThreshold', label: t('Seuil de double validation'), value: String(s.approvalThreshold), hint: t('Au-delà de ce montant, deux personnes différentes doivent valider (0 = toujours).') },
              { k: 'safetyMode', label: t('Fonds de sécurité exprimé en'), type: 'select', value: s.safetyMode, options: [['days', t('Jours de charges')], ['amount', t('Montant fixe')]] },
              { k: 'safetyDays', label: t('Jours de charges à couvrir'), value: String(s.safetyDays) },
              { k: 'safetyAmount', label: t('Montant fixe du fonds de sécurité'), value: String(s.safetyAmount) },
              { k: 'minBalance', label: t('Solde minimal toléré'), value: String(s.minBalance), hint: t('La prévision alerte quand le solde passera dessous.') },
              { k: 'payday', label: t('Jour de paiement des salaires'), value: String(s.payday) },
              { k: 'includeTrend', label: t('Prévision : ajouter la tendance des ventes et des achats'), type: 'select', value: s.includeTrend ? '1' : '0', options: [['1', t('Oui : au-delà des factures connues')], ['0', t('Non : documents connus seulement')]] },
              ...(can('admin') ? [{ k: 'strictSeparation', label: t('Séparation des tâches'), type: 'select', value: s.strictSeparation ? '1' : '0', options: [['1', t('Stricte : jamais de validation de sa propre opération')], ['0', t('Assouplie sous le seuil (petite structure)')]] }] : []),
            ]} />
        ) : (
          <div className="ui-table-wrap"><table className="ui-table"><tbody>
            <tr><td>{t('Seuil de double validation')}</td><td className="r num">{s.approvalThreshold.toLocaleString()}</td></tr>
            <tr><td>{t('Fonds de sécurité')}</td><td className="r">{s.safetyMode === 'days' ? t('{n} jours de charges', { n: s.safetyDays }) : s.safetyAmount.toLocaleString()}</td></tr>
            <tr><td>{t('Solde minimal toléré')}</td><td className="r num">{s.minBalance.toLocaleString()}</td></tr>
          </tbody></table></div>
        )}
      </Card>
    )}</Loaded>
  );
}

export function LogScreen() {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/log'), []);
  const action = (a) => ({ 'op.prepare': t('Opération préparée'), 'op.approve1': t('Première validation'), 'op.post': t('Opération validée et comptabilisée'), 'op.reject': t('Opération refusée'), 'op.cancel': t('Opération retirée'), 'op.reverse': t('Opération annulée par écriture inverse'), role: t('Rôle modifié'), settings: t('Réglages modifiés'), 'account.create': t('Compte créé'), 'account.update': t('Compte modifié'), fx: t('Taux de change modifié'), export: t('Export du plan'), 'plan.create': t('Élément prévu ajouté'), 'plan.update': t('Élément prévu modifié'), 'plan.delete': t('Élément prévu supprimé'), 'scenario.create': t('Scénario créé'), terms: t('Conditions fournisseur modifiées'), 'reminders.scan': t('Relances lancées') }[a] || a);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Alert tone={j.chain.ok ? 'ok' : 'danger'}>{j.chain.ok ? t('Journal intact : {n} lignes chaînées, aucune modification détectée.', { n: j.chain.count }) : t('Attention : la ligne {id} du journal a été modifiée après coup.', { id: j.chain.brokenAt })}</Alert>
        <Card title={t('Journal de traçabilité')} subtitle={t('Qui a fait quoi, et quand. Chaque ligne contient l\'empreinte de la précédente.')} flush style={{ marginTop: 12 }}>
          <Table caption={t('Journal')} empty={t('Aucune action enregistrée.')} columns={[
            { key: 'at', label: t('Date'), render: (l) => dateFr(l.at.slice(0, 10)) + ' ' + l.at.slice(11, 16) }, { key: 'user', label: t('Personne') }, { key: 'action', label: t('Action'), render: (l) => action(l.action) },
            { key: 'detail', label: t('Détail'), render: (l) => <span className="small muted" style={{ wordBreak: 'break-word' }}>{l.detail.slice(0, 140)}</span> }, { key: 'hash', label: t('Empreinte'), render: (l) => <code>{l.hash}</code> },
          ]} rows={j.log} />
        </Card>
      </>
    )}</Loaded>
  );
}
