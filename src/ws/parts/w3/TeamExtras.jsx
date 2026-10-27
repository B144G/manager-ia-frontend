import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN } from './common.jsx';

/* Équipe et organisation · vague 3 : journal d'audit, transfert de propriété, postes vacants. */

const ACTIONS = { create: 'Création', update: 'Modification', delete: 'Suppression', read: 'Consultation', decision: 'Décision', level_approved: 'Niveau validé', transfer: 'Transfert', grant: 'Consentement donné', withdraw: 'Consentement retiré', send: 'Envoi', export: 'Export', import: 'Import', apply: 'Application', plan: 'Planification', seed: 'Ajout d’exemples', done: 'Fait', reviewed: 'Révision', remove: 'Retrait', download: 'Téléchargement' };
const show = (o) => (o ? Object.entries(o).map(([k, v]) => k + ' : ' + (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(' · ') : '—');

export function Audit() {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const [entity, setEntity] = useState('');
  const st = useLoad(() => oapi('GET', '/audit' + (entity ? '?entity=' + encodeURIComponent(entity) : '')), [entity]);
  return (
    <div className="ws-card">
      <h2>{t("Journal d'audit")}</h2>
      <p className="muted small">{t('Qui a changé quoi, avec les valeurs avant et après. Les données sensibles sont masquées.')}</p>
      <Loaded state={st}>{(j) => (
        <>
          <label className="fld"><span>{t('Type')}</span>
            <select style={{ fontSize: 16 }} value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">{t('Tout')}</option>{j.entities.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          </label>
          {!j.items.length ? <Empty text={t('Aucune modification enregistrée.')} /> : null}
          {j.items.map((a) => (
            <details className="proc" key={a.id}>
              <summary>{dateFr(a.at) + ' · ' + (a.who || '—') + ' · ' + a.entity + ' · ' + (ACTIONS[a.action] ? t(ACTIONS[a.action]) : a.action)}</summary>
              <p className="small"><b>{t('Avant')}</b> {show(a.before)}</p>
              <p className="small"><b>{t('Après')}</b> {show(a.after)}</p>
            </details>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}

export function Transfer() {
  const t = useT();
  const { oapi, info, modal, fail, reloadOrg, toast } = useWs();
  const open = () => oapi('GET', '/members').then((j) => modal(t("Transférer la propriété de l'organisation"), (close) => (
    <>
      <p className="muted small">{t("La personne choisie devient propriétaire (et doit pouvoir porter l'organisation avec son offre). Vous devenez administrateur. Écrivez le nom exact de l'organisation pour confirmer.")}</p>
      <Form
        fields={[{ k: 'userId', label: t('Nouveau propriétaire'), type: 'select', options: j.members.filter((m) => m.role !== 'owner').map((m) => [String(m.userId), m.name]) }, { k: 'confirm', label: t("Nom de l'organisation"), required: true, placeholder: info.org.name }]}
        submitText={t('Transférer la propriété')}
        onSubmit={(f) => oapi('POST', '/ownership-transfer', { userId: Number(f.userId), confirm: f.confirm }).then(() => { close(); toast(t('Propriété transférée.')); reloadOrg(); })}
      />
    </>
  ))).catch(fail);
  return (
    <div className="ws-card">
      <h2>{t('Propriété de l’organisation')}</h2>
      <button className="btn small" type="button" style={BTN} onClick={open}>{t('Transférer la propriété')}</button>
    </div>
  );
}

export function Vacancies() {
  const t = useT();
  const { oapi, can, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/structure/vacancies'), []);
  return (
    <div className="ws-card">
      <h2>{t('Postes vacants')}</h2>
      <Loaded state={st}>{(j) => (
        <>
          {!j.items.length ? <Empty text={t('Aucun poste vacant.')} /> : null}
          {j.items.map((v) => (
            <div className="line" key={v.id}>
              <span><b>{v.title}</b>{v.reportsTo ? <><br /><small className="muted">{t('Rend compte à {name}', { name: v.reportsTo })}</small></> : null}</span>
              {v.jobId ? <span className="pill">{t('Offre ouverte')}</span> : can('manager') ? <button className="link" type="button" style={BTN} onClick={() => oapi('POST', '/hr/jobs/from-position/' + v.id, {}).then(() => { toast(t("Offre créée dans Ressources humaines.")); st.reload(); }).catch(fail)}>{t("Créer l'offre")}</button> : null}
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
