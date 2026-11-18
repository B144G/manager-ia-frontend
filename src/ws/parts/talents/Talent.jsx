import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Legend, Locked, Panel, RadarView, num1, pct, useAct, useTl } from './common.jsx';

/* Gestion des talents : matrice 9-box (performance × potentiel), hauts potentiels, viviers de talents, plans de développement individuels (PDI). */

export function useBox() {
  const t = useT();
  return { star: t('Étoile'), future_leader: t('Futur leader'), enigma: t('Énigme'), high_performer: t('Haute performance'), core: t('Pilier'), dilemma: t('Dilemme'), trusted_expert: t('Expert fiable'), effective: t('Contributeur efficace'), risk: t('À risque') };
}

export function NineBox() {
  const t = useT();
  const { modal } = useWs();
  const { tp, has } = useTl();
  const BOX = useBox();
  const [period, setPeriod] = useState('');
  const st = useLoad(() => (has('talent') ? tp('GET', '/talent/ninebox' + (period ? '?period=' + encodeURIComponent(period) : '')) : Promise.resolve(null)), [period]);
  if (!has('talent')) return <Locked />;
  const rate = (e, p) => modal(t('Évaluer {name}', { name: e.name }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'period', label: t('Période'), value: period || String(new Date().getFullYear()), required: true },
      { k: 'performance', label: t('Performance (1 à 5)'), type: 'number', value: p && p.performance ? String(p.performance) : e.suggestedPerformance ? String(e.suggestedPerformance) : '', hint: e.suggestedPerformance ? t('Proposition d’après les objectifs : {n}', { n: num1(e.suggestedPerformance) }) : '' },
      { k: 'potential', label: t('Potentiel (1 à 5)'), type: 'number', value: p && p.potential ? String(p.potential) : '', required: true }, { k: 'note', label: t('Note'), type: 'textarea', rows: 2 }]}
    onSubmit={async (v) => { await tp('PUT', '/talent/reviews', { employeeId: e.employeeId, period: v.period, performance: v.performance || undefined, potential: Number(v.potential), note: v.note }); close(); st.reload(); }} />));
  return (
    <Loaded state={st}>{(n) => (
      <div className="tl-grid">
        <div className="tl-kpis"><Panel title={t('Évalués')}><b>{n.counts.rated}</b></Panel><Panel title={t('Hauts potentiels')}><b>{n.counts.highPotential}</b></Panel><Panel title={t('À évaluer')}><b>{n.counts.unrated}</b></Panel>
          <Panel title={t('Période')}><input aria-label={t('Période')} placeholder={t('Dernière évaluation')} value={period} onChange={(e) => setPeriod(e.target.value)} /></Panel></div>
        <Panel title={t('Matrice 9-box')} note={t('Performance (horizontal) × potentiel (vertical). Notes de 1 à 5 : moins de 2,5 faible, jusqu’à 3,75 moyen, au-delà élevé.')}>
          <div className="tl-9">
            {[2, 1, 0].map((row) => [
              <div key={'y' + row} className="ax y">{row === 1 ? t('Potentiel') : ''}</div>,
              ...[0, 1, 2].map((col) => { const c = n.cells[row * 3 + col]; return (
                <div key={c.box} className={'cell' + (row === 2 && col >= 1 ? ' hot' : row === 0 && col === 0 ? ' cold' : '')}>
                  <small>{BOX[c.key]}</small>{c.employees.map((e) => <div key={e.employeeId}>{e.name}</div>)}</div>); })])}
            <div className="ax" />{[t('Performance faible'), t('Performance moyenne'), t('Performance élevée')].map((x) => <div key={x} className="ax">{x}</div>)}
          </div>
          <Legend items={[['var(--ok-soft)', t('Hauts potentiels')], ['var(--danger-soft)', t('À risque')]]} />
        </Panel>
        <Panel title={t('Évaluations')}>
          <Table rows={[...n.rated.map((r) => ({ ...r, id: r.employeeId })), ...n.unrated.map((r) => ({ ...r, id: r.employeeId, unrated: true }))]} columns={[
            { key: 'name', label: t('Nom'), render: (r) => <b>{r.name}</b> },
            { key: 'perf', label: t('Performance'), align: 'r', render: (r) => (r.unrated ? <small className="tl-note">{t('Proposée {n}', { n: num1(r.suggestedPerformance) })}</small> : num1(r.performance)) },
            { key: 'pot', label: t('Potentiel'), align: 'r', render: (r) => (r.unrated ? '—' : num1(r.potential)) },
            { key: 'box', label: t('Case'), render: (r) => (r.unrated ? <Badge tone="warn">{t('À évaluer')}</Badge> : <Badge tone={r.highPotential ? 'ok' : 'neutral'}>{r.box} · {BOX[r.key]}</Badge>) },
            { key: 'a', label: '', render: (r) => <button className="link" type="button" onClick={() => rate(r, r.unrated ? null : r)}>{t('Évaluer')}</button> }]} />
        </Panel>
      </div>
    )}
    </Loaded>
  );
}

export function Pools() {
  const t = useT();
  const { modal, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const pools = useLoad(() => (has('talent') ? tp('GET', '/talent/pools') : Promise.resolve(null)), []);
  const emps = useLoad(() => (has('talent') ? tp('GET', '/profiles') : Promise.resolve({ items: [] })), []);
  const idps = useLoad(() => tp('GET', '/talent/idp'), []);
  const jobs = useLoad(() => (has('talent') ? tp('GET', '/job-profiles') : Promise.resolve({ items: [] })), []);
  const [gapOf, setGapOf] = useState(null);
  const gaps = useLoad(() => (gapOf ? tp('GET', '/talent/idp/' + gapOf + '/gaps') : Promise.resolve(null)), [gapOf]);
  const active = (emps.data ? emps.data.items : []).filter((e) => e.status === 'active');
  const addPool = () => modal(t('Nouveau vivier'), (close) => <Form submitText={t('Créer')} fields={[{ k: 'name', label: t('Nom'), required: true }, { k: 'description', label: t('Description') }]} onSubmit={async (v) => { await tp('POST', '/talent/pools', v); close(); pools.reload(); }} />);
  const addMember = (p) => modal(p.name, (close) => <Form submitText={t('Ajouter')} fields={[{ k: 'employeeId', label: t('Personne'), type: 'select', options: active.map((e) => [String(e.employeeId), e.name]) }]} onSubmit={async (v) => { await tp('POST', '/talent/pools/' + p.id + '/members', { employeeId: Number(v.employeeId) }); close(); pools.reload(); }} />);
  const addIdp = () => modal(t('Nouveau plan de développement'), (close) => (
    <Form submitText={t('Créer')} fields={[{ k: 'employeeId', label: t('Personne'), type: 'select', options: active.map((e) => [String(e.employeeId), e.name]) }, { k: 'title', label: t('Objectif de développement'), required: true }, { k: 'targetJobProfileId', label: t('Emploi visé'), type: 'select', options: [['', t('Aucun')], ...(jobs.data ? jobs.data.items.map((j) => [String(j.id), j.title]) : [])] }, { k: 'horizon', label: t('Horizon'), placeholder: t('Ex. 2 ans') }]}
    onSubmit={async (v) => { await tp('POST', '/talent/idp', { employeeId: Number(v.employeeId), title: v.title, targetJobProfileId: v.targetJobProfileId || null, horizon: v.horizon }); close(); idps.reload(); }} />));
  const addAction = (i) => modal(t('Action de développement'), (close) => <Form submitText={t('Ajouter')} fields={[{ k: 'title', label: t('Action (formation, mission, mentorat…)'), required: true }, { k: 'dueDate', label: t('Échéance'), type: 'date' }]} onSubmit={async (v) => { await tp('POST', '/actions', { kind: 'pdi', refId: i.id, employeeId: i.employeeId, title: v.title, dueDate: v.dueDate || null }); close(); idps.reload(); }} />);
  return (
    <div className="tl-grid">
      {has('talent') ? (
        <Panel title={t('Viviers de talents')} actions={<Button size="sm" onClick={addPool}>{t('Nouveau vivier')}</Button>}>
          <Loaded state={pools}>{(p) => (!p.items.length ? <p className="ws-empty">{t('Aucun vivier. Regroupez par exemple vos hauts potentiels ou vos futurs managers.')}</p> : p.items.map((x) => (
            <div className="tl-row" key={x.id}><span><b>{x.name}</b> <small className="tl-note">{x.description}</small><br />{x.members.map((m) => <Badge key={m.employeeId} tone="brand">{m.name} <button className="link" type="button" aria-label={t('Retirer')} onClick={() => act(tp('DELETE', '/talent/pools/' + x.id + '/members/' + m.employeeId), pools.reload)}>×</button></Badge>)}</span>
              <span className="row"><button className="link" type="button" onClick={() => addMember(x)}>{t('Ajouter une personne')}</button><button className="link" type="button" onClick={() => confirm(t('Supprimer le vivier « {name} » ?', { name: x.name }), () => act(tp('DELETE', '/talent/pools/' + x.id), pools.reload))}>{t('Supprimer')}</button></span></div>
          )))}
          </Loaded>
        </Panel>
      ) : null}
      <Panel title={t('Plans de développement individuels (PDI)')} actions={has('talent') ? <Button size="sm" variant="primary" onClick={addIdp}>{t('Nouveau PDI')}</Button> : null}>
        <Loaded state={idps}>{(p) => (
          <Table rows={p.items} empty={t('Aucun plan de développement.')} columns={[
            { key: 'employee', label: t('Personne'), render: (r) => <b>{r.employee}</b> }, { key: 'title', label: t('Objectif') }, { key: 'targetJob', label: t('Emploi visé') }, { key: 'horizon', label: t('Horizon') },
            { key: 'actions', label: t('Actions'), align: 'r', render: (r) => `${r.actionsDone}/${r.actions}` },
            { key: 'a', label: '', render: (r) => <span className="row">{r.targetJobProfileId ? <button className="link" type="button" onClick={() => setGapOf(r.id)}>{t('Écarts')}</button> : null}{has('talent') ? <button className="link" type="button" onClick={() => addAction(r)}>{t('Ajouter une action')}</button> : null}</span> }]} />
        )}
        </Loaded>
        {gapOf ? <Loaded state={gaps}>{(g) => (
          <Panel title={t("Écarts vers l'emploi visé")} subtitle={t('Couverture {n}', { n: pct(g.coverage) })}>
            {g.items.length >= 3 ? <RadarView data={g.items.map((x) => ({ name: x.name, req: x.required, held: x.held }))} series={[{ key: 'req', label: t('Requis') }, { key: 'held', label: t('Détenu') }]} /> : g.items.map((x) => <div className="tl-row" key={x.competencyId}><span>{x.name}</span><span>{x.held} / {x.required}</span></div>)}
          </Panel>
        )}</Loaded> : null}
      </Panel>
    </div>
  );
}
