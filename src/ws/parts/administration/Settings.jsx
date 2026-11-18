import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Button } from '../../ui.jsx';
import { Section, num, useAdm, useFormModal } from './kit.jsx';

/* Réglages : le responsable du compte (propriétaire) désigne qui peut faire quoi ; il règle aussi les délais d'alerte. Le serveur applique ces droits. */

const PERMS = [['flow_design'], ['flow_validate'], ['sop_write'], ['sop_approve'], ['docs_manage'], ['docs_destroy'], ['control_manage'], ['assets_manage'], ['contracts_manage'], ['org_manage']];

export default function Settings() {
  const t = useT();
  const { api, cfg, reload } = useAdm();
  const { toast, fail } = useWs();
  const form = useFormModal();
  const [busy, setBusy] = useState(false);
  const label = (k) => ({ flow_design: t('Créer les circuits de validation'), flow_validate: t('Valider et mettre en service les circuits'), sop_write: t('Écrire et relire les procédures'), sop_approve: t('Approuver les procédures'), docs_manage: t('Gérer les documents (archiver, règles de conservation, journal)'), docs_destroy: t('Valider la destruction de documents'), control_manage: t('Gérer le contrôle interne (risques, contrôles, dérogations)'), assets_manage: t('Gérer les moyens généraux'), contracts_manage: t('Gérer les contrats et la conformité'), org_manage: t('Gérer l’organigramme, le RACI et les objectifs') }[k]);
  const dflt = (k) => ({ flow_design: t('Par défaut : le propriétaire seul.'), flow_validate: t('Par défaut : le propriétaire seul.'), sop_write: t('Par défaut : responsables et plus.'), sop_approve: t('Par défaut : administrateurs et plus.'), docs_manage: t('Par défaut : responsables et plus.'), docs_destroy: t('Par défaut : administrateurs et plus.'), control_manage: t('Par défaut : administrateurs et plus.'), assets_manage: t('Par défaut : responsables et plus.'), contracts_manage: t('Par défaut : responsables et plus.'), org_manage: t('Par défaut : administrateurs et plus.') }[k]);
  if (!cfg.isOwner) return (
    <>
      <Alert tone="info" title={t('Réglages réservés au responsable du compte')}>{t('Le propriétaire de l’organisation désigne qui peut créer et valider les circuits, et gérer chaque partie du module. Vos droits actuels :')}</Alert>
      <Section title={t('Vos droits')}>
        {PERMS.map(([k]) => <div className="adm-line" key={k}><span>{label(k)}</span><b>{cfg.me.perms[k] ? t('Oui') : t('Non')}</b></div>)}
      </Section>
    </>
  );
  const s = cfg.settings;
  const edit = (k) => {
    const cur = s.perms[k];
    form(label(k), [
      { k: 'roles', label: t('Rôles autorisés'), type: 'select', value: cur.roles.join(','), options: [['', t('Aucun rôle (par défaut)')], ['manager,admin', t('Responsables et administrateurs')], ['admin', t('Administrateurs')], ['member,manager,admin', t('Tous les membres')]] },
      ...Array.from({ length: 3 }, (_, i) => ({ k: 'u' + i, label: `${t('Personne désignée')} ${i + 1}`, type: 'select', value: cur.users[i] ? String(cur.users[i]) : '', options: [['', t('— Personne —')], ...cfg.members.map((m) => [String(m.userId), m.name])] })),
    ], (v) => api('PUT', '/settings', { ...s, perms: { ...s.perms, [k]: { roles: v.roles ? v.roles.split(',') : [], users: [v.u0, v.u1, v.u2].filter(Boolean).map(Number) } } }), { done: t('Droit désigné.') });
  };
  const days = (k, labelText) => (
    <div className="adm-line" key={k}><span>{labelText}</span><input type="number" min="1" max="365" defaultValue={s[k]} aria-label={labelText} onBlur={async (e) => { const v = num(e.target.value); if (!v || v === s[k]) return; try { await api('PUT', '/settings', { ...s, [k]: v }); toast(t('Réglage enregistré.')); reload(); } catch (er) { fail(er); } }} /></div>
  );
  return (
    <>
      <Alert tone="info" title={t('Vous désignez qui fait quoi')}>{t('Tant que rien n’est désigné, seul le propriétaire crée et valide les circuits. Une désignation remplace la règle par défaut pour ce droit.')}</Alert>
      <Section title={t('Droits désignés')}>
        {PERMS.map(([k]) => {
          const r = s.perms[k]; const names = r.users.map((u) => (cfg.members.find((m) => m.userId === u) || {}).name).filter(Boolean);
          const who = [...r.roles.map((x) => ({ member: t('Membres'), manager: t('Responsables'), admin: t('Administrateurs') }[x])), ...names].join(', ');
          return <div className="adm-line" key={k}><span><b>{label(k)}</b><small>{who || dflt(k)}</small></span><Button size="sm" onClick={() => edit(k)}>{t('Désigner')}</Button></div>;
        })}
        <div className="adm-line"><span><b>{t('Deux personnes pour valider')}</b><small>{t('Un circuit ou une procédure créé par une personne doit être validé par une autre.')}</small></span>
          <Button size="sm" variant={s.distinct ? 'primary' : 'secondary'} loading={busy} onClick={async () => { setBusy(true); try { await api('PUT', '/settings', { ...s, distinct: !s.distinct }); reload(); } catch (e) { fail(e); } setBusy(false); }}>{s.distinct ? t('Activé') : t('Désactivé')}</Button></div>
      </Section>
      <Section title={t('Délais d’alerte (jours)')}>
        {days('contractAlertDays', t('Contrats : prévenir avant l’échéance ou le préavis'))}
        {days('complianceAlertDays', t('Conformité : prévenir avant l’échéance'))}
        {days('sopReminderDays', t('Procédures : rappeler la révision'))}
        {days('docAlertDays', t('Documents : prévenir avant l’archivage ou la fin de conservation'))}
        {days('assetAlertDays', t('Moyens généraux : prévenir avant l’échéance'))}
      </Section>
    </>
  );
}
