import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Button, ChartFrame, EmptyState, Icon, Stat } from '../../ui.jsx';
import { Bars, Donut, HBars, compact } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, call, saveBlob, useAdm } from './kit.jsx';

/* Tableau de bord administratif : ce qui est à traiter, les indicateurs, les graphiques, et les raccourcis vers Réunions et les objectifs. */

const SCREEN = { flowsLate: 'requests', sodConflicts: 'sod', complianceLate: 'compliance', contractAlerts: 'contracts', docsToDestroy: 'archive', docsToArchive: 'archive', sopsToReview: 'sops', assetDeadlinesLate: 'deadlines', controlsLate: 'controls', actionsLate: 'actions', meansRequests: 'meansreq', awaitingDestruction: 'archive' };

export default function Dashboard() {
  const t = useT();
  const { go, hasMeetings } = useAdm();
  const { orgId, dateFr, money } = useWs();
  const TILES = [
    ['sopsToReview', t('Procédures à réviser'), 'sops', 'doc'], ['docsToArchive', t('Documents à archiver'), 'archive', 'folder'], ['docsToDestroy', t('Documents au terme de leur conservation'), 'archive', 'trash'],
    ['flowsLate', t('Circuits en retard'), 'requests', 'clock'], ['sodConflicts', t('Conflits de séparation des tâches'), 'sod', 'scale-balanced'], ['contractAlerts', t('Contrats à échéance'), 'contracts', 'file-contract'],
    ['complianceLate', t('Obligations en retard'), 'compliance', 'gavel'], ['meansRequests', t('Demandes de moyens'), 'meansreq', 'toolbox'], ['assetDeadlinesLate', t('Échéances de moyens dépassées'), 'deadlines', 'calendar-days'],
    ['controlsLate', t('Contrôles en retard'), 'controls', 'clipboard-check'], ['actionsLate', t('Actions correctives en retard'), 'actions', 'list-check'], ['raciIssues', t('Anomalies de la matrice RACI'), 'raci', 'table-cells'],
  ];
  const TODO = { flowsLate: t('circuit(s) de validation en retard'), sodConflicts: t('conflit(s) de séparation des tâches'), complianceLate: t('obligation(s) de conformité en retard'), contractAlerts: t('contrat(s) à échéance ou préavis'), docsToDestroy: t('document(s) arrivé(s) au terme de leur conservation'), docsToArchive: t('document(s) à archiver'), sopsToReview: t('procédure(s) à réviser'), assetDeadlinesLate: t('échéance(s) de moyens dépassée(s)'), controlsLate: t('contrôle(s) en retard'), actionsLate: t('action(s) corrective(s) en retard'), meansRequests: t('demande(s) de moyens à traiter'), awaitingDestruction: t('destruction(s) à valider') };
  const AL = { expired: t('Contrat expiré'), notice_missed: t('Préavis dépassé : reconduit tacitement'), notice_soon: t('Dernier jour pour résilier proche'), ending_soon: t('Arrive à échéance') };
  const LV = { Initial: t('Initial'), 'Répétable': t('Répétable'), 'Défini': t('Défini'), 'Maîtrisé': t('Maîtrisé'), 'Optimisé': t('Optimisé') };
  const MNAME = { sod: t('Séparation des tâches'), coverage: t('Risques couverts par un contrôle'), execution: t('Contrôles faits à temps'), results: t('Contrôles réussis (6 mois)'), actions: t('Actions correctives tenues'), formal: t('Formalisation (procédures, RACI, circuits)') };
  const sevTone = (s) => (s >= 3 ? 'danger' : s === 2 ? 'warn' : 'info');
  const sevLabel = (s) => (s >= 3 ? t('Urgent') : s === 2 ? t('Important') : t('À prévoir'));
  const STAT = { draft: t('Brouillon'), reviewed: t('Relue'), approved: t('Approuvée'), obsolete: t('Obsolète') };
  const SEV = { high: t('Haute'), medium: t('Moyenne'), low: t('Faible') };
  const KIND = { purchase: t('Achat'), leave: t('Congé'), expense: t('Dépense'), document: t('Document'), contract: t('Contrat'), access: t('Accès'), other: t('Autre') };
  return (
    <View path="/report/dashboard">{(d) => (
      <>
        {d.todo.length === 0 ? <Alert tone="ok" title={t('Tout est à jour')}>{t('Aucune échéance ni retard à traiter.')}</Alert> : (
          <Section title={t('À traiter en priorité')} subtitle={t('Classé par urgence. Cliquez pour ouvrir l’écran concerné.')}>
            <div className="adm-todo">
              {d.todo.map((x) => (
                <button type="button" key={x.key} className="adm-todo-row" onClick={() => go(SCREEN[x.key])}>
                  <span className={'adm-sev ' + sevTone(x.severity)}>{sevLabel(x.severity)}</span>
                  <b>{x.count}</b><span>{TODO[x.key]}</span><Icon name="arrow-right" />
                </button>
              ))}
            </div>
          </Section>
        )}
        <Kpis>
          <Stat icon="gauge" label={t('Maturité du contrôle interne')} value={`${d.maturity.score}/100`} sub={LV[d.maturity.levelLabel]} tone={d.maturity.score >= 60 ? 'ok' : d.maturity.score >= 40 ? 'warn' : 'danger'} onClick={() => go('maturity')} />
          {TILES.map(([k, label, screen, icon]) => <Stat key={k} icon={icon} label={label} value={d.kpis[k]} tone={d.kpis[k] ? 'warn' : 'ok'} onClick={() => go(screen)} />)}
        </Kpis>
        <Grid cols={2}>
          <ChartFrame title={t('Demandes de validation par mois')} summary={t('Demandes déposées, approuvées et refusées chaque mois.')} height={230}>
            <Bars data={d.charts.requestsByMonth} xKey="month" series={[{ key: 'created', label: t('Déposées') }, { key: 'approved', label: t('Approuvées') }, { key: 'rejected', label: t('Refusées') }]} />
          </ChartFrame>
          <ChartFrame title={t('Score de maturité par domaine')} summary={t('Score sur 100 pour chaque domaine du contrôle interne.')} height={230}>
            <HBars data={d.charts.maturity.map((m) => ({ name: MNAME[m.key], value: m.score }))} fmt={(v) => `${v}`} height={230} />
          </ChartFrame>
          <ChartFrame title={t('Procédures par statut')} summary={t('Répartition des procédures selon leur statut.')} height={220}>
            <Donut data={d.charts.sopsByStatus.map((s) => ({ name: STAT[s.key], value: s.count }))} center={String(d.charts.sopsByStatus.reduce((a, s) => a + s.count, 0))} sub={t('procédures')} />
          </ChartFrame>
          <ChartFrame title={t('Conflits ouverts par gravité')} summary={t('Nombre de conflits de séparation des tâches par gravité.')} height={220}>
            <Donut data={d.charts.conflictsBySeverity.map((s) => ({ name: SEV[s.key], value: s.count }))} center={String(d.kpis.sodConflicts)} sub={t('conflits')} />
          </ChartFrame>
          <ChartFrame title={t('Coûts des moyens généraux')} subtitle={t('6 derniers mois')} summary={t('Coûts de maintenance, assurance et achats par mois.')} height={220}>
            <Bars data={d.charts.costsByMonth} xKey="month" series={[{ key: 'amount', label: t('Coût') }]} fmt={compact} />
          </ChartFrame>
          <ChartFrame title={t('Demandes par type')} summary={t('Demandes de validation par type et issue.')} height={220}>
            <Bars data={d.charts.requestsByKind.map((k) => ({ ...k, label: KIND[k.kind] || k.label }))} xKey="label" stacked series={[{ key: 'approved', label: t('Approuvées') }, { key: 'pending', label: t('En attente') }, { key: 'rejected', label: t('Refusées') }]} />
          </ChartFrame>
        </Grid>
        <Grid cols={2}>
          <Section title={t('Procédures à réviser')}>
            {d.lists.sops.length ? d.lists.sops.map((s) => <div className="adm-line" key={s.id}><span><b>{s.title}</b><small>{s.owner || ''}</small></span><Pill k={s.overdue ? 'overdue' : 'pending'}>{dateFr(s.nextReview)}</Pill></div>) : <EmptyState icon="ok" title={t('Rien à réviser')} />}
          </Section>
          <Section title={t('Documents à archiver ou à détruire')}>
            {d.lists.docsToArchive.length + d.lists.docsToDestroy.length ? <>
              {d.lists.docsToArchive.map((x) => <div className="adm-line" key={'a' + x.id}><span><b>{x.title}</b><small>{t('À archiver')}</small></span><Pill k="pending">{dateFr(x.due)}</Pill></div>)}
              {d.lists.docsToDestroy.map((x) => <div className="adm-line" key={'d' + x.id}><span><b>{x.title}</b><small>{t('Terme de la conservation')}</small></span><Pill k="overdue">{dateFr(x.due)}</Pill></div>)}
            </> : <EmptyState icon="ok" title={t('Aucun document à traiter')} />}
          </Section>
          <Section title={t('Circuits en retard')}>
            {d.lists.flows.length ? d.lists.flows.map((f) => <div className="adm-line" key={f.requestId}><span><b>{f.ref} · {f.title}</b><small>{f.step} · {f.requester}</small></span><Pill k="overdue">{dateFr(f.dueAt)}</Pill></div>) : <EmptyState icon="ok" title={t('Aucune demande en retard')} />}
          </Section>
          <Section title={t('Conflits de séparation des tâches')}>
            {d.lists.conflicts.length ? d.lists.conflicts.map((c, i) => <div className="adm-line" key={i}><span><b>{c.user}</b><small>{c.funcA} + {c.funcB}</small></span><Pill k={c.severity}>{SEV[c.severity]}</Pill></div>) : <EmptyState icon="ok" title={t('Aucun conflit ouvert')} />}
          </Section>
          <Section title={t('Contrats à échéance')}>
            {d.lists.contracts.length ? d.lists.contracts.map((c) => <div className="adm-line" key={c.id}><span><b>{c.title}</b><small>{AL[c.alert]}</small></span><Pill k={c.alert}>{dateFr(c.noticeDeadline && c.alert.startsWith('notice') ? c.noticeDeadline : c.effectiveEnd)}</Pill></div>) : <EmptyState icon="ok" title={t('Aucun contrat à échéance')} />}
          </Section>
          <Section title={t('Obligations de conformité en retard')}>
            {d.lists.compliance.length ? d.lists.compliance.map((c) => <div className="adm-line" key={c.id}><span><b>{c.title}</b><small>{c.responsible || ''}</small></span><Pill k="overdue">{dateFr(c.dueDate)}</Pill></div>) : <EmptyState icon="ok" title={t('Aucune obligation en retard')} />}
          </Section>
        </Grid>
        <Grid cols={2}>
          <Section title={t('Réunions')} actions={hasMeetings ? <Button size="sm" to={`/app/${orgId}/meetings`} icon="calendar-days">{t('Ouvrir Réunions')}</Button> : null}>
            {d.links.meetings.available ? (d.links.meetings.upcoming.length ? d.links.meetings.upcoming.map((m) => <div className="adm-line" key={m.id}><span><b>{m.title}</b></span><small>{dateFr(m.date)} {m.time}</small></div>) : <p className="muted">{t('Aucune réunion prévue dans les 30 jours.')}</p>) : <p className="muted">{t('Le module Réunions n’est pas activé pour cette organisation.')}</p>}
          </Section>
          <Section title={t('Objectifs')} subtitle={d.links.objectives.source === 'rh' ? t('Lus depuis RH talents') : t('Suivi des objectifs administratifs')} actions={<Button size="sm" onClick={() => go('goals')} icon="bullseye">{t('Voir les objectifs')}</Button>}>
            {d.links.objectives.count ? <>
              <p><b>{d.links.objectives.avgProgress} %</b> {t('d’avancement moyen')} · {d.links.objectives.count} {t('objectif(s)')}</p>
              {d.links.objectives.items.map((g) => <div className="adm-line" key={g.id}><span><b>{g.title}</b></span><div className="adm-bar" aria-label={`${g.progress} %`}><i style={{ width: g.progress + '%' }} /></div></div>)}
            </> : <p className="muted">{t('Aucun objectif suivi pour le moment.')}</p>}
          </Section>
        </Grid>
        <Section title={t('Chiffres clés')}>
          <div className="adm-facts">
            <span><b>{d.figures.units}</b> {t('services')}</span>
            <span><b>{d.figures.activeDelegations}</b> {t('délégation(s) en cours')}</span>
            <span><b>{d.figures.flow.total}</b> {t('demandes traitées')}</span>
            <span><b>{d.figures.flow.approvalRate == null ? '—' : d.figures.flow.approvalRate + ' %'}</b> {t('taux d’approbation')}</span>
            <span><b>{d.figures.flow.avgCycleHours} h</b> {t('délai moyen')}</span>
            <span><b>{d.figures.contracts.active}</b> {t('contrats actifs')}</span>
            <span><b>{money(d.figures.contracts.annualValue)}</b> {t('par an en contrats')}</span>
            <span><b>{d.figures.means.assets}</b> {t('biens, valeur')} {money(d.figures.means.value)}</span>
          </div>
        </Section>
        <MonthlyExport />
      </>
    )}
    </View>
  );
}

export function MonthlyExport() {
  const t = useT();
  const { orgId, fail } = useWs();
  const month = new Date().toISOString().slice(0, 7);
  const get = async (ext) => { try { saveBlob(await call(orgId, 'GET', `/report/monthly.${ext}?month=${month}`, undefined, { blob: true }), `rapport-administratif-${month}.${ext}`); } catch (e) { fail(e); } };
  return (
    <Section title={t('Rapport mensuel')} subtitle={t('Synthèse du mois à imprimer ou à ouvrir dans un tableur.')}>
      <div className="row"><Button icon="file-pdf" onClick={() => get('pdf')}>{t('Télécharger en PDF')}</Button><Button icon="table" onClick={() => get('xlsx')}>{t('Télécharger en Excel')}</Button></div>
    </Section>
  );
}
