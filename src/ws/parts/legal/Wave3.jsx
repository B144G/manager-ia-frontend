import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BTN, Crud } from '../w3/common.jsx';
import { WorkNotice } from '../finance/util.jsx';

/* Juridique · vague 3 : registres (statuts, AG, procès-verbaux, associés, RCCM) et calendrier de conformité Cameroun (exemples « à vérifier »). */

const KINDS = { statuts: 'Statuts', ag: 'Assemblée générale', pv: 'Procès-verbal', associe: 'Associé', rccm: 'RCCM', other: 'Autre' };
const REC = { once: 'Une fois', monthly: 'Chaque mois', quarterly: 'Chaque trimestre', annual: 'Chaque année' };

export function Registers() {
  const t = useT();
  const { oapi, can, dateFr } = useWs();
  const sum = useLoad(() => oapi('GET', '/legal/registers-summary'), []);
  return (
    <>
      <WorkNotice>{t('Registre de travail : la tenue légale des registres (formes, signatures, dépôts) est à faire valider par un juriste ou le greffe.')}</WorkNotice>
      <Loaded state={sum}>{(j) => (
        <div className="ws-card">
          <h2>{t('Répartition du capital')}</h2>
          {!j.partners.length ? <Empty text={t("Aucun associé enregistré.")} /> : null}
          {j.partners.map((p) => <div className="line" key={p.holder}><b>{p.holder}</b><span>{t('{n} part(s) · {p} %', { n: p.shares, p: p.percent })}</span></div>)}
          <p className="muted small">{[j.lastAg && t('Dernière AG : {t} ({d})', { t: j.lastAg.title, d: j.lastAg.date ? dateFr(j.lastAg.date) : '—' }), j.rccm && t('RCCM : {t}', { t: j.rccm.title })].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      </Loaded>
      <Crud path="/legal/registers" title={t('Registres de l’entreprise')} canWrite={can('admin')} addLabel={t('Ajouter une inscription')} empty={t('Aucune inscription.')}
        fields={[{ k: 'kind', label: t('Registre'), type: 'select', options: Object.keys(KINDS).map((k) => [k, t(KINDS[k])]), required: true }, { k: 'title', label: t('Titre'), required: true }, { k: 'date', label: t('Date'), type: 'date' }, { k: 'ref', label: t('Référence (n° de PV, RCCM…)') },
          { k: 'holder', label: t('Associé / titulaire') }, { k: 'shares', label: t('Nombre de parts'), type: 'number' }, { k: 'detail', label: t('Détail'), type: 'textarea', rows: 3 }]}
        row={(r) => ({ main: r.title, sub: [r.date && dateFr(r.date), r.ref, r.holder, r.shares ? t('{n} part(s)', { n: r.shares }) : ''].filter(Boolean).join(' · '), pill: [t(KINDS[r.kind]), ''] })} />
    </>
  );
}

export function Compliance() {
  const t = useT();
  const { oapi, can, dateFr, toast, fail } = useWs();
  return (
    <>
      <WorkNotice>{t('Calendrier de travail pour le Cameroun : toutes les dates sont des exemples « à vérifier » auprès de votre expert ou de l’administration. Modifiez-les librement.')}</WorkNotice>
      {can('admin') ? <button className="btn small" type="button" style={BTN} onClick={() => oapi('POST', '/legal/compliance/seed', {}).then((r) => { toast(t('{n} échéance(s) ajoutée(s).', { n: r.added })); window.dispatchEvent(new Event('focus')); }).catch(fail)}>{t('Ajouter les exemples du Cameroun')}</button> : null}
      <Crud path="/legal/compliance" title={t('Calendrier de conformité')} canWrite={can('admin')} addLabel={t('Ajouter une obligation')} empty={t('Aucune obligation. Ajoutez les exemples du Cameroun pour commencer.')}
        fields={[{ k: 'title', label: t('Obligation'), required: true }, { k: 'category', label: t('Catégorie') }, { k: 'dueDate', label: t('Prochaine échéance'), type: 'date' }, { k: 'recurrence', label: t('Répétition'), type: 'select', options: Object.keys(REC).map((k) => [k, t(REC[k])]) },
          { k: 'status', label: t('Statut'), type: 'select', options: [['todo', t('À faire')], ['done', t('Fait')]] }, { k: 'verify', label: t('À vérifier'), type: 'bool', def: 0 }, { k: 'note', label: t('Note'), type: 'textarea', rows: 2 }]}
        row={(c) => ({ main: c.title, sub: [c.category, c.dueDate && dateFr(c.dueDate), t(REC[c.recurrence]), c.note].filter(Boolean).join(' · '), pill: c.status === 'done' ? [t('Fait'), ''] : c.late ? [t('En retard'), 'bad'] : c.verify ? [t('à vérifier'), 'mid'] : null })}
        extraRow={(c, reload) => (can('admin') && c.status === 'todo' ? <button className="link" type="button" style={BTN} onClick={() => oapi('POST', '/legal/compliance/' + c.id + '/done', {}).then(reload).catch(fail)}>{t('Marquer fait')}</button> : null)} />
    </>
  );
}
