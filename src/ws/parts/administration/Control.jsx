import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, ChartFrame, Drawer, EmptyState, Stat, Table } from '../../ui.jsx';
import { HBars } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, memberOptions, toInt, useAdm, useFormModal, useMembers } from './kit.jsx';

/* Contrôle interne : séparation des tâches avec détection automatique des conflits, registre des contrôles, risques, actions correctives, maturité. */

const useSev = () => { const t = useT(); return { high: t('Haute'), medium: t('Moyenne'), low: t('Faible') }; };
const SRC = { direct: 'D', role: 'R', poste: 'P', 'activité': 'A' };

export function Sod() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { toast, fail, dateFr } = useWs();
  const form = useFormModal();
  const SEV = useSev();
  const CAT = { authorize: t('Autoriser'), execute: t('Exécuter'), record: t('Enregistrer'), control: t('Contrôler') };
  const [edit, setEdit] = useState(null);
  const SRCL = { direct: t('Affectée à la personne'), role: t('Par son rôle'), poste: t('Par son poste'), 'activité': t('Constatée dans l’activité') };
  return (
    <View path="/control/sod/matrix">{(m) => (
      <View path="/control/sod/conflicts">{(c) => (
        <>
          {!m.functions.length ? (
            <Alert tone="info" title={t('Séparation des tâches non configurée')}>
              {t('Chargez les fonctions et règles courantes d’une PME (créer un fournisseur, payer, caisse, paie…), puis affectez-les aux personnes.')}
              {perms.control_manage ? <Button variant="primary" onClick={async () => { try { const r = await api('POST', '/control/sod/seed'); toast(t('{n} fonctions et {m} règles ajoutées.', { n: r.functionsAdded, m: r.rulesAdded })); reload(); } catch (e) { fail(e); } }}>{t('Charger les modèles')}</Button> : null}
            </Alert>
          ) : null}
          <Kpis>
            <Stat icon="scale-balanced" label={t('Conflits ouverts')} value={c.summary.open} tone={c.summary.open ? 'danger' : 'ok'} />
            <Stat icon="triangle-exclamation" label={t('Gravité haute')} value={c.summary.high} tone={c.summary.high ? 'danger' : 'ok'} />
            <Stat icon="user-group" label={t('Personnes concernées')} value={c.summary.people} />
            <Stat icon="file-contract" label={t('Dérogations motivées')} value={c.summary.waived} />
          </Kpis>
          <Section title={t('Conflits détectés')} subtitle={t('Une même personne ne doit pas cumuler des fonctions incompatibles. Détection automatique d’après les affectations, les postes et l’activité réelle dans Achats.')}>
            <Table caption={t('Conflits')} rows={c.conflicts.map((x, i) => ({ ...x, id: i }))} empty={t('Aucun conflit : bonne séparation des tâches.')} columns={[
              { key: 'user', label: t('Personne'), render: (x) => <b>{x.user}</b> },
              { key: 'f', label: t('Cumule'), render: (x) => `${x.funcAName} + ${x.funcBName}` },
              { key: 'sev', label: t('Gravité'), render: (x) => <Pill k={x.severity}>{SEV[x.severity]}</Pill> },
              { key: 'src', label: t('Origine'), render: (x) => [...new Set([...x.sourcesA, ...x.sourcesB])].map((s) => SRCL[s]).join(', ') },
              { key: 'why', label: t('Risque'), render: (x) => x.reason },
              { key: 'st', label: t('État'), render: (x) => (x.waived ? <Badge tone="info" title={x.waiver && x.waiver.compensating}>{t('Dérogation')}</Badge> : <Badge tone="danger">{t('À corriger')}</Badge>) },
              { key: 'a', label: '', render: (x) => (perms.control_manage && !x.waived ? <span className="row"><Button size="sm" onClick={() => form(t('Accorder une dérogation'), [{ k: 'reason', label: t('Motif'), required: true }, { k: 'compensating', label: t('Contrôle compensatoire'), required: true, hint: t('Ce qui limite le risque (ex. le dirigeant recompte la caisse chaque semaine).') }, { k: 'untilDate', label: t('Valable jusqu’au'), type: 'date' }], (v) => api('POST', '/control/sod/waivers', { ruleId: x.ruleId, userId: x.userId, reason: v.reason, compensating: v.compensating, untilDate: v.untilDate || null }))}>{t('Déroger')}</Button><Button size="sm" variant="soft" onClick={() => form(t('Action corrective'), [{ k: 'title', label: t('Action'), value: `${t('Séparer les fonctions de')} ${x.user}`, required: true }, { k: 'dueDate', label: t('Échéance'), type: 'date' }], (v) => api('POST', '/control/actions', { title: v.title, dueDate: v.dueDate || null, sourceKind: 'conflict', sourceId: x.ruleId, ownerId: x.userId }))}>{t('Créer une action')}</Button></span> : x.waived && x.waiver && x.waiver.until ? <small>{dateFr(x.waiver.until)}</small> : null) },
            ]} />
          </Section>
          {m.functions.length ? (
            <Section title={t('Matrice des fonctions')} subtitle={t('D = affectée directement · R = par le rôle · P = par le poste · A = constatée dans l’activité. En rouge : conflit.')}
              actions={perms.control_manage ? <Button size="sm" onClick={() => setEdit('roles')}>{t('Fonctions par rôle')}</Button> : null}>
              <div className="ui-table-wrap" tabIndex={0}><table className="ui-table adm-sodm">
                <thead><tr><th>{t('Fonction')}</th>{m.users.map((u) => <th key={u.userId} className="c">{u.name}{perms.control_manage ? <button type="button" className="adm-link" onClick={() => setEdit(u)}>{t('Modifier')}</button> : null}</th>)}</tr></thead>
                <tbody>{['authorize', 'execute', 'record', 'control'].flatMap((cat) => [
                  <tr key={'h' + cat} className="adm-cat"><td colSpan={m.users.length + 1}>{CAT[cat]}</td></tr>,
                  ...m.functions.filter((f) => f.category === cat).map((f) => <tr key={f.id}><td>{f.name}</td>{m.users.map((u) => { const cell = u.cells[f.id]; return <td key={u.userId} className={'c' + (cell && cell.conflict ? ' adm-bad' : cell ? ' adm-has' : '')}>{cell ? cell.sources.map((s) => SRC[s]).join('') : ''}</td>; })}</tr>),
                ])}</tbody>
              </table></div>
              <div className="adm-facts">{m.users.map((u) => <span key={u.userId}><b>{u.name}</b> : {Object.entries(u.byCategory).map(([k, n]) => `${CAT[k]} ${n}`).join(' · ')}</span>)}</div>
            </Section>
          ) : null}
          <Rules />
          {edit ? <AssignDrawer target={edit} funcs={m.functions} onClose={() => setEdit(null)} /> : null}
        </>
      )}
      </View>
    )}
    </View>
  );
}

function AssignDrawer({ target, funcs, onClose }) {
  const t = useT();
  const { api, reload } = useAdm();
  const { toast, fail } = useWs();
  const isRoles = target === 'roles';
  const [role, setRole] = useState('member');
  const [direct, setDirect] = useState(() => (isRoles ? [] : funcs.filter((f) => (target.cells[f.id] || { sources: [] }).sources.includes('direct')).map((f) => f.id)));
  const save = async () => {
    try { await api('PUT', isRoles ? `/control/sod/assignments/role/${role}` : `/control/sod/assignments/user/${target.userId}`, { functionIds: direct }); toast(t('Affectations enregistrées.')); reload(); onClose(); } catch (e) { fail(e); }
  };
  return (
    <Drawer title={isRoles ? t('Fonctions par rôle') : `${t('Fonctions de')} ${target.name}`} onClose={onClose}>
      <div className="adm-form">
        {isRoles ? <label className="fld"><span>{t('Rôle')}</span><select value={role} onChange={(e) => { setRole(e.target.value); setDirect([]); }}><option value="member">{t('Membre')}</option><option value="manager">{t('Responsable')}</option><option value="admin">{t('Administrateur')}</option><option value="owner">{t('Propriétaire')}</option></select></label> : <p className="muted small">{t('Seules les affectations directes se modifient ici ; celles du rôle ou du poste se règlent à leur source.')}</p>}
        {isRoles ? <Alert tone="warn">{t('Enregistrer remplace toutes les fonctions déjà liées à ce rôle.')}</Alert> : null}
        <fieldset className="adm-checks"><legend>{t('Fonctions exercées')}</legend>
          {funcs.map((f) => <label key={f.id}><input type="checkbox" checked={direct.includes(f.id)} onChange={(e) => setDirect(e.target.checked ? [...direct, f.id] : direct.filter((x) => x !== f.id))} />{f.name}</label>)}
        </fieldset>
        <Button variant="primary" onClick={save}>{t('Enregistrer')}</Button>
      </div>
    </Drawer>
  );
}

function Rules() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { fail } = useWs();
  const form = useFormModal();
  const SEV = useSev();
  return (
    <View path="/control/sod/rules">{(r) => (
      <Section title={t('Règles d’incompatibilité')} subtitle={t('Deux fonctions qu’une même personne ne devrait pas cumuler.')}
        actions={perms.control_manage ? <Button size="sm" icon="plus" onClick={async () => { try { const f = await api('GET', '/control/sod/functions'); form(t('Nouvelle règle'), [{ k: 'funcA', label: t('Fonction A'), type: 'select', options: f.functions.map((x) => [String(x.id), x.name]) }, { k: 'funcB', label: t('Fonction B'), type: 'select', options: f.functions.map((x) => [String(x.id), x.name]) }, { k: 'severity', label: t('Gravité'), type: 'select', value: 'high', options: Object.entries(SEV) }, { k: 'reason', label: t('Risque'), type: 'textarea', rows: 2 }], (v) => api('POST', '/control/sod/rules', { funcA: Number(v.funcA), funcB: Number(v.funcB), severity: v.severity, reason: v.reason })); } catch (e) { fail(e); } }}>{t('Règle')}</Button> : null}>
        <Table caption={t('Règles')} rows={r.rules} empty={t('Aucune règle.')} columns={[{ key: 'a', label: t('Fonction A'), render: (x) => x.funcAName }, { key: 'b', label: t('Fonction B'), render: (x) => x.funcBName }, { key: 's', label: t('Gravité'), render: (x) => <Pill k={x.severity}>{SEV[x.severity]}</Pill> }, { key: 'reason', label: t('Risque') },
          { key: 'd', label: '', render: (x) => (perms.control_manage ? <Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={async () => { try { await api('DELETE', `/control/sod/rules/${x.id}`); reload(); } catch (e) { fail(e); } }} /> : null) }]} />
      </Section>
    )}
    </View>
  );
}

// ---------- Registre des contrôles ----------
export function Controls() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const FREQ = { daily: t('Quotidien'), weekly: t('Hebdomadaire'), monthly: t('Mensuel'), quarterly: t('Trimestriel'), semiannual: t('Semestriel'), yearly: t('Annuel') };
  const RES = { ok: t('Conforme'), partial: t('Partiel'), ko: t('Non conforme') };
  const [hist, setHist] = useState(null);
  const run = (c) => form(`${t('Exécution du contrôle')} · ${c.title}`, [
    { k: 'result', label: t('Résultat'), type: 'select', options: Object.entries(RES) }, { k: 'doneOn', label: t('Date du contrôle'), type: 'date', value: new Date().toISOString().slice(0, 10) },
    { k: 'evidence', label: t('Preuve (référence, lieu du document…)') }, { k: 'notes', label: t('Observations'), type: 'textarea', rows: 3, hint: t('Obligatoire si le résultat n’est pas conforme.') },
  ], async (v) => { const r = await api('POST', `/control/controls/${c.id}/runs`, { result: v.result, doneOn: v.doneOn || undefined, evidence: v.evidence, notes: v.notes }); return r; }, { done: t('Contrôle enregistré.') });
  return (
    <View path="/control/controls">{(d) => (
      <>
        <Kpis>
          <Stat icon="clipboard-check" label={t('Contrôles actifs')} value={d.summary.active} /><Stat icon="clock" label={t('En retard')} value={d.summary.overdue} tone={d.summary.overdue ? 'danger' : 'ok'} /><Stat icon="triangle-exclamation" label={t('Dernier résultat non conforme')} value={d.summary.failing} tone={d.summary.failing ? 'danger' : 'ok'} />
        </Kpis>
        <Section title={t('Registre des contrôles')} subtitle={t('Chaque contrôle a une fréquence, un responsable, une preuve et un résultat.')}
          actions={perms.control_manage ? <Button variant="primary" icon="plus" onClick={async () => { try { const rk = await api('GET', '/control/risks'); form(t('Nouveau contrôle'), [
            { k: 'title', label: t('Intitulé'), required: true }, { k: 'objective', label: t('Objectif'), type: 'textarea', rows: 2 }, { k: 'process', label: t('Processus') },
            { k: 'riskId', label: t('Risque couvert'), type: 'select', options: [['', t('— Aucun —')], ...rk.risks.map((x) => [String(x.id), x.title])] },
            { k: 'kind', label: t('Type'), type: 'select', options: [['preventive', t('Préventif')], ['detective', t('Détectif')]] }, { k: 'frequency', label: t('Fréquence'), type: 'select', value: 'monthly', options: Object.entries(FREQ) },
            { k: 'ownerId', label: t('Responsable'), type: 'select', options: memberOptions(members, t) }, { k: 'startDate', label: t('À faire dès le'), type: 'date' },
          ], (v) => api('POST', '/control/controls', { title: v.title, objective: v.objective, process: v.process, riskId: toInt(v.riskId), kind: v.kind, frequency: v.frequency, ownerId: toInt(v.ownerId), startDate: v.startDate || undefined }), { wide: true }); } catch (e) { fail(e); } }}>{t('Contrôle')}</Button> : null}>
          <Table caption={t('Contrôles')} rows={d.controls} empty={t('Aucun contrôle enregistré.')} columns={[
            { key: 'title', label: t('Contrôle'), render: (c) => <><b>{c.title}</b>{c.risk ? <small>{t('Risque')} : {c.risk}</small> : null}</> },
            { key: 'f', label: t('Fréquence'), render: (c) => FREQ[c.frequency] }, { key: 'owner', label: t('Responsable') },
            { key: 'last', label: t('Dernier'), render: (c) => (c.lastDone ? <>{dateFr(c.lastDone)} <Pill k={c.lastResult}>{RES[c.lastResult]}</Pill></> : '—') },
            { key: 'next', label: t('Prochain'), render: (c) => <Pill k={c.overdue ? 'overdue' : 'pending'}>{dateFr(c.nextDue)}</Pill> },
            { key: 'rate', label: t('Réussite'), align: 'r', render: (c) => (c.okRate == null ? '—' : c.okRate + ' %') },
            { key: 'a', label: '', render: (c) => <span className="row"><Button size="sm" variant="primary" onClick={() => run(c)}>{t('Enregistrer')}</Button><Button size="sm" variant="ghost" onClick={async () => { try { setHist({ c, runs: (await api('GET', `/control/controls/${c.id}/runs`)).runs }); } catch (e) { fail(e); } }}>{t('Historique')}</Button>{perms.control_manage ? <Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={async () => { try { await api('DELETE', `/control/controls/${c.id}`); reload(); } catch (e) { fail(e); } }} /> : null}</span> },
          ]} />
        </Section>
        {hist ? <Drawer title={hist.c.title} onClose={() => setHist(null)}><Table caption={t('Historique')} rows={hist.runs} empty={t('Jamais exécuté.')} columns={[{ key: 'doneOn', label: t('Date'), render: (r) => dateFr(r.doneOn) }, { key: 'result', label: t('Résultat'), render: (r) => <Pill k={r.result}>{RES[r.result]}</Pill> }, { key: 'doneBy', label: t('Par') }, { key: 'evidence', label: t('Preuve') }, { key: 'notes', label: t('Observations') }]} /></Drawer> : null}
      </>
    )}
    </View>
  );
}

// ---------- Risques ----------
export function Risks() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const LV = { critical: t('Critique'), high: t('Élevé'), medium: t('Moyen'), low: t('Faible') };
  const ST = { open: t('Ouvert'), mitigated: t('Maîtrisé'), accepted: t('Accepté'), closed: t('Clos') };
  const lvl = (n) => [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']].map(([k]) => [k, `${k} / 5`]);
  const edit = (x) => form(x ? t('Modifier le risque') : t('Nouveau risque'), [
    { k: 'title', label: t('Risque'), value: x ? x.title : '', required: true }, { k: 'process', label: t('Processus'), value: x ? x.process : '' },
    { k: 'description', label: t('Description'), type: 'textarea', rows: 2, value: x ? x.description : '' },
    { k: 'likelihood', label: t('Probabilité'), type: 'select', value: String(x ? x.likelihood : 3), options: lvl() }, { k: 'impact', label: t('Impact'), type: 'select', value: String(x ? x.impact : 3), options: lvl() },
    { k: 'ownerId', label: t('Responsable'), type: 'select', value: x && x.ownerId ? String(x.ownerId) : '', options: memberOptions(members, t) },
    { k: 'status', label: t('Statut'), type: 'select', value: x ? x.status : 'open', options: Object.entries(ST) },
  ], (v) => api(x ? 'PUT' : 'POST', x ? `/control/risks/${x.id}` : '/control/risks', { title: v.title, process: v.process, description: v.description, likelihood: Number(v.likelihood), impact: Number(v.impact), ownerId: toInt(v.ownerId), status: v.status }), { wide: true });
  return (
    <View path="/control/risks">{(d) => (
      <>
        <Kpis><Stat icon="triangle-exclamation" label={t('Risques ouverts')} value={d.summary.open} /><Stat icon="fire" label={t('Critiques')} value={d.summary.critical} tone={d.summary.critical ? 'danger' : 'ok'} /><Stat icon="shield-halved" label={t('Sans contrôle')} value={d.summary.uncovered} tone={d.summary.uncovered ? 'warn' : 'ok'} /></Kpis>
        <Grid cols={2}>
          <Section title={t('Carte des risques')} subtitle={t('Probabilité (haut = fréquent) × impact (droite = grave)')}>
            <div className="adm-heat" role="img" aria-label={t('Carte des risques')}>
              {d.heatmap.map((row, i) => row.map((n, j) => { const sc = (5 - i) * (j + 1); return <span key={`${i}-${j}`} className={'cell ' + (sc >= 15 ? 'c' : sc >= 8 ? 'h' : sc >= 4 ? 'm' : 'l')}>{n || ''}</span>; }))}
            </div>
          </Section>
          <Section title={t('Registre des risques')} actions={perms.control_manage ? <Button variant="primary" icon="plus" onClick={() => edit(null)}>{t('Risque')}</Button> : null}>
            <Table caption={t('Risques')} rows={d.risks} empty={t('Aucun risque enregistré.')} columns={[
              { key: 'title', label: t('Risque'), render: (x) => <><b>{x.title}</b><small>{x.process}</small></> }, { key: 'score', label: t('Score'), align: 'r', render: (x) => <Pill k={x.level === 'critical' ? 'critical' : x.level === 'high' ? 'high' : x.level === 'medium' ? 'medium' : 'low'}>{x.score} · {LV[x.level]}</Pill> },
              { key: 'controls', label: t('Contrôles'), align: 'r', render: (x) => (x.controls ? x.controls : <Badge tone="warn">0</Badge>) }, { key: 'st', label: t('Statut'), render: (x) => ST[x.status] },
              { key: 'a', label: '', render: (x) => (perms.control_manage ? <span className="row"><Button size="sm" variant="ghost" iconOnly icon="pen" label={t('Modifier')} onClick={() => edit(x)} /><Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={async () => { try { await api('DELETE', `/control/risks/${x.id}`); reload(); } catch (e) { fail(e); } }} /></span> : null) },
            ]} />
          </Section>
        </Grid>
      </>
    )}
    </View>
  );
}

// ---------- Plans d'actions ----------
export function Actions() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { dateFr, fail } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const ST = { todo: t('À faire'), doing: t('En cours'), done: t('Terminée'), cancelled: t('Annulée') };
  return (
    <View path="/control/actions">{(d) => (
      <>
        <Kpis><Stat icon="list-check" label={t('Ouvertes')} value={d.summary.open} /><Stat icon="clock" label={t('En retard')} value={d.summary.overdue} tone={d.summary.overdue ? 'danger' : 'ok'} /><Stat icon="check" label={t('Terminées')} value={d.summary.done} tone="ok" /></Kpis>
        <Section title={t('Plans d’actions correctifs')} subtitle={t('Chaque écart (contrôle raté, conflit, risque) mène à une action avec un responsable et une échéance.')}
          actions={perms.control_manage ? <Button variant="primary" icon="plus" onClick={() => form(t('Nouvelle action'), [{ k: 'title', label: t('Action'), required: true }, { k: 'detail', label: t('Détail'), type: 'textarea', rows: 3 }, { k: 'ownerId', label: t('Responsable'), type: 'select', options: memberOptions(members, t) }, { k: 'dueDate', label: t('Échéance'), type: 'date' }], (v) => api('POST', '/control/actions', { title: v.title, detail: v.detail, ownerId: toInt(v.ownerId), dueDate: v.dueDate || null }))}>{t('Action')}</Button> : null}>
          <Table caption={t('Actions')} rows={d.actions} empty={t('Aucune action.')} columns={[
            { key: 'title', label: t('Action'), render: (a) => <><b>{a.title}</b><small>{a.detail}</small></> }, { key: 'owner', label: t('Responsable') },
            { key: 'due', label: t('Échéance'), render: (a) => (a.dueDate ? <Pill k={a.overdue ? 'overdue' : 'pending'}>{dateFr(a.dueDate)}</Pill> : '—') },
            { key: 'status', label: t('Statut'), render: (a) => <Pill k={a.status}>{ST[a.status]}</Pill> }, { key: 'progress', label: t('Avancement'), render: (a) => <div className="adm-bar"><i style={{ width: a.progress + '%' }} /></div> },
            { key: 'a', label: '', render: (a) => (['todo', 'doing'].includes(a.status) ? <span className="row">{a.status === 'todo' ? <Button size="sm" onClick={async () => { try { await api('PUT', `/control/actions/${a.id}`, { status: 'doing', progress: 30 }); reload(); } catch (e) { fail(e); } }}>{t('Démarrer')}</Button> : null}<Button size="sm" variant="primary" onClick={async () => { try { await api('PUT', `/control/actions/${a.id}`, { status: 'done' }); reload(); } catch (e) { fail(e); } }}>{t('Terminer')}</Button></span> : null) },
          ]} />
        </Section>
      </>
    )}
    </View>
  );
}

// ---------- Maturité ----------
export function Maturity() {
  const t = useT();
  const LV = { Initial: t('Initial'), 'Répétable': t('Répétable'), 'Défini': t('Défini'), 'Maîtrisé': t('Maîtrisé'), 'Optimisé': t('Optimisé') };
  const NAME = { sod: t('Séparation des tâches'), coverage: t('Risques couverts par un contrôle'), execution: t('Contrôles faits à temps'), results: t('Contrôles réussis (6 mois)'), actions: t('Actions correctives tenues'), formal: t('Formalisation (procédures, RACI, circuits)') };
  const TIP = { sod: t('Définissez les fonctions et règles, affectez-les, puis résolvez ou motivez chaque conflit.'), coverage: t('Rattachez au moins un contrôle à chaque risque ouvert.'), execution: t('Enregistrez chaque exécution avec sa preuve.'), results: t('Traitez les échecs par une action corrective.'), actions: t('Fixez un responsable et une échéance à chaque action.'), formal: t('Approuvez vos procédures clés, complétez la matrice RACI et mettez des circuits en service.') };
  return (
    <View path="/control/maturity">{(d) => (
      <>
        <Kpis><Stat icon="gauge" label={t('Score de maturité')} value={`${d.score}/100`} tone={d.score >= 60 ? 'ok' : d.score >= 40 ? 'warn' : 'danger'} sub={`${t('Niveau')} ${d.level}/5 · ${LV[d.levelLabel]}`} /></Kpis>
        <ChartFrame title={t('Score par domaine')} subtitle={t('Chaque domaine pèse un certain poids dans le score global.')} summary={t('Score sur 100 pour chaque domaine du contrôle interne.')} height={Math.max(220, d.components.length * 44)}>
          <HBars data={d.components.map((c) => ({ name: `${NAME[c.key]} (${c.weight} %)`, value: c.score }))} fmt={(v) => `${v}`} height={d.components.length * 44} />
        </ChartFrame>
        <Section title={t('Comment progresser')}>
          {d.components.filter((c) => c.score < 100).sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight).map((c) => <div className="adm-line" key={c.key}><span><b>{NAME[c.key]}</b><small>{c.detail}</small></span><span className="adm-tip">{TIP[c.key]}</span></div>)}
          {d.components.every((c) => c.score >= 100) ? <EmptyState icon="circle-check" title={t('Maturité maximale')} /> : null}
        </Section>
      </>
    )}
    </View>
  );
}
