import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Crud, SettingsCard } from './common.jsx';

/* Service client · vague 3 : base de connaissances, rapport (délais, satisfaction), réglages des délais (SLA). */

export function Kb() {
  const t = useT();
  const { can } = useWs();
  return (
    <Crud path="/support/kb" title={t('Base de connaissances et FAQ')} canWrite={can('manager')} addLabel={t('Nouvel article')} empty={t('Aucun article. Les articles publiés sont lus par l’IA et affichés sur votre formulaire public.')}
      intro={t("Les articles publiés servent de réponses de référence à l’IA (brouillons de réponse, conseils) et alimentent les questions fréquentes de votre formulaire public.")}
      fields={[{ k: 'title', label: t('Question ou titre'), required: true }, { k: 'body', label: t('Réponse'), type: 'textarea', rows: 5, required: true }, { k: 'category', label: t('Catégorie') }, { k: 'published', label: t('Publié'), type: 'bool', def: 1 }]}
      row={(a) => ({ main: a.title, sub: [a.category, a.body.slice(0, 120)].filter(Boolean).join(' · '), pill: a.published ? null : [t('Brouillon'), 'mid'] })} />
  );
}

export function Report() {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/support/report'), []);
  return (
    <div className="ws-card">
      <h2>{t('Rapport des 30 derniers jours')}</h2>
      <Loaded state={st}>{(j) => (
        <>
          <div className="kpis">
            <div className="stat"><b>{String(j.total)}</b><span>{t('demandes')}</span></div>
            <div className="stat"><b>{j.avgFirstResponseMinutes === null ? '—' : t('{n} min', { n: j.avgFirstResponseMinutes })}</b><span>{t('première réponse (moyenne)')}</span></div>
            <div className="stat"><b>{j.avgResolutionHours === null ? '—' : t('{n} h', { n: j.avgResolutionHours })}</b><span>{t('résolution (moyenne)')}</span></div>
            <div className="stat"><b>{j.csat.average === null ? '—' : j.csat.average + ' / 5'}</b><span>{t('satisfaction ({n} avis)', { n: j.csat.count })}</span></div>
          </div>
          <div className="line"><span>{t('Délais de première réponse respectés')}</span><b>{j.slaFirstRate === null ? '—' : j.slaFirstRate + ' %'}</b></div>
          <div className="line"><span>{t('Délais de résolution respectés')}</span><b>{j.slaResolveRate === null ? '—' : j.slaResolveRate + ' %'}</b></div>
          <h3>{t('Par canal')}</h3>
          {Object.keys(j.byChannel).length ? Object.entries(j.byChannel).map(([k, n]) => <div className="line" key={k}><span>{k}</span><b>{n}</b></div>) : <Empty text={t('Aucune donnée.')} />}
          <h3>{t('Par personne')}</h3>
          {j.perAssignee.map((p) => <div className="line" key={p.name}><b>{p.name}</b><span>{t('{n} demande(s), {r} résolue(s)', { n: p.total, r: p.resolved }) + (p.csat ? ' · ' + p.csat + ' / 5' : '')}</span></div>)}
        </>
      )}
      </Loaded>
    </div>
  );
}

export function Sla() {
  const t = useT();
  const { can } = useWs();
  return (
    <SettingsCard path="/support" canEdit={can('admin')} title={t('Délais de réponse (SLA)')} intro={t('Heures accordées pour répondre au client et pour résoudre sa demande, selon la priorité.')}
      keys={[['sla_first_high', t('Première réponse · urgente (h)')], ['sla_first_normal', t('Première réponse · normale (h)')], ['sla_first_low', t('Première réponse · basse (h)')], ['sla_resolve_high', t('Résolution · urgente (h)')], ['sla_resolve_normal', t('Résolution · normale (h)')], ['sla_resolve_low', t('Résolution · basse (h)')], ['alert_ticket_hours', t('Alerte « sans réponse » après (h)')]]} />
  );
}
