import { useMemo, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, Drawer, EmptyState, Segmented, Stat, Table } from '../../ui.jsx';
import { HBars } from '../../charts/lazy.jsx';
import { Grid, Kpis, Pill, Section, View, call, memberOptions, num, saveBlob, toInt, useAdm, useFormModal, useMembers } from './kit.jsx';

/* Organigramme fonctionnel, fiches de poste, matrice RACI, délégations et intérim. */

// ---------- Organigramme en SVG (exportable en image) ----------
function layout(positions) {
  const kids = new Map(); const ids = new Set(positions.map((p) => p.id));
  for (const p of positions) { const k = p.parentId && ids.has(p.parentId) ? p.parentId : 0; (kids.get(k) || kids.set(k, []).get(k)).push(p); }
  const W = 168, H = 56, GX = 18, GY = 40; const nodes = []; const links = []; let x = 0; let maxD = 0;
  const place = (p, d) => {
    maxD = Math.max(maxD, d);
    const ch = kids.get(p.id) || [];
    if (!ch.length) { const n = { p, x, d }; x += W + GX; nodes.push(n); return n; }
    const cn = ch.map((c) => place(c, d + 1));
    const n = { p, x: (cn[0].x + cn[cn.length - 1].x) / 2, d };
    nodes.push(n); for (const c of cn) links.push([n, c]); return n;
  };
  for (const r of kids.get(0) || []) place(r, 0);
  return { nodes, links, W, H, GY, width: Math.max(x, W), height: (maxD + 1) * (H + GY) };
}
function ChartSvg({ positions, unitName, svgRef }) {
  const t = useT();
  const L = useMemo(() => layout(positions), [positions]);
  const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
  return (
    <div className="adm-chart-wrap">
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${L.width} ${L.height}`} width={L.width} height={L.height} role="img" aria-label={t('Organigramme fonctionnel')} fontFamily="system-ui, sans-serif">
        <rect width={L.width} height={L.height} fill="#ffffff" />
        {L.links.map(([a, b], i) => <path key={i} d={`M${a.x + L.W / 2} ${a.d * (L.H + L.GY) + L.H} V${a.d * (L.H + L.GY) + L.H + L.GY / 2} H${b.x + L.W / 2} V${b.d * (L.H + L.GY)}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" />)}
        {L.nodes.map(({ p, x, d }) => (
          <g key={p.id} transform={`translate(${x},${d * (L.H + L.GY)})`}>
            <rect width={L.W} height={L.H} rx="8" fill={p.holder ? '#eef2ff' : '#fff7ed'} stroke={p.holder ? '#6366f1' : '#fb923c'} />
            <text x="10" y="21" fontSize="12" fontWeight="700" fill="#111827">{cut(p.title, 24)}</text>
            <text x="10" y="37" fontSize="11" fill="#374151">{cut(p.holder || t('(vacant)'), 26)}</text>
            <text x="10" y="50" fontSize="9" fill="#6b7280">{cut(unitName(p.unitId), 30)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function exportPng(svg, name) {
  const src = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const w = svg.viewBox.baseVal.width; const h = svg.viewBox.baseVal.height;
  img.onload = () => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.scale(2, 2); g.drawImage(img, 0, 0); c.toBlob((b) => b && saveBlob(b, name), 'image/png'); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
}

export function Chart() {
  const t = useT();
  const { orgId, fail, confirm, toast } = useWs();
  const { api, perms, reload } = useAdm();
  const [mode, setMode] = useState('posts');
  const [sheet, setSheet] = useState(null);
  const svg = useRef(null);
  const form = useFormModal();
  const members = useMembers();
  const pdf = async () => { try { saveBlob(await call(orgId, 'GET', '/org/export.pdf', undefined, { blob: true }), 'organigramme.pdf'); } catch (e) { fail(e); } };
  return (
    <View path="/org/chart">{(d) => {
      const unitName = (id) => (d.units.find((u) => u.id === id) || {}).name || t('Sans service');
      const addUnit = (u) => form(u ? t('Modifier le service') : t('Nouveau service'), [
        { k: 'name', label: t('Nom du service'), value: u ? u.name : '', required: true },
        { k: 'parentId', label: t('Service parent'), type: 'select', value: u && u.parentId ? String(u.parentId) : '', options: [['', t('— Aucun —')], ...d.units.filter((x) => !u || x.id !== u.id).map((x) => [String(x.id), x.name])] },
        { k: 'headUserId', label: t('Responsable du service'), type: 'select', value: u && u.headUserId ? String(u.headUserId) : '', options: memberOptions(members, t) },
        { k: 'mission', label: t('Mission'), type: 'textarea', rows: 3, value: u ? u.mission : '' },
      ], (v) => api(u ? 'PUT' : 'POST', u ? `/org/units/${u.id}` : '/org/units', { name: v.name, parentId: toInt(v.parentId), headUserId: toInt(v.headUserId), mission: v.mission }));
      return (
        <>
          <Kpis>
            <Stat icon="sitemap" label={t('Services')} value={d.stats.units} />
            <Stat icon="user-tie" label={t('Postes')} value={d.stats.positions} />
            <Stat icon="check" label={t('Postes pourvus')} value={d.stats.filled} tone="ok" />
            <Stat icon="triangle-exclamation" label={t('Postes vacants')} value={d.stats.vacant} tone={d.stats.vacant ? 'warn' : 'ok'} />
            <Stat icon="file-lines" label={t('Postes sans fiche')} value={d.stats.withoutSheet} tone={d.stats.withoutSheet ? 'warn' : 'ok'} />
          </Kpis>
          <Section title={t('Organigramme fonctionnel')} subtitle={t('Les postes viennent de l’écran Organisation ; ici vous les rattachez aux services et décrivez leurs responsabilités.')}
            actions={<><Segmented label={t('Affichage')} value={mode} onChange={setMode} items={[{ id: 'posts', label: t('Par poste') }, { id: 'units', label: t('Par service') }]} /><Button size="sm" icon="download" onClick={() => svg.current && exportPng(svg.current, 'organigramme.png')} disabled={mode !== 'posts'}>{t('Image')}</Button><Button size="sm" icon="file-pdf" onClick={pdf}>{t('PDF')}</Button>{perms.org_manage ? <Button size="sm" variant="primary" icon="plus" onClick={() => addUnit(null)}>{t('Service')}</Button> : null}</>}>
            {!d.positions.length ? <EmptyState icon="sitemap" title={t('Aucun poste')}>{t('Créez d’abord vos postes dans l’écran Organisation.')}</EmptyState> : null}
            {mode === 'posts' && d.positions.length ? <ChartSvg positions={d.positions} unitName={unitName} svgRef={svg} /> : null}
            {mode === 'units' ? (
              <div className="adm-units">
                {[...d.units, { id: null, name: t('Sans service'), mission: '' }].map((u) => {
                  const ps = d.positions.filter((p) => (p.unitId || null) === (u.id || null));
                  if (u.id === null && !ps.length) return null;
                  return (
                    <div className="adm-unit" key={u.id || 'none'}>
                      <div className="adm-unit-h"><b>{u.name}</b>{u.head ? <small>{t('Responsable')} : {u.head}</small> : null}{u.id && perms.org_manage ? <span className="row"><Button size="sm" variant="ghost" icon="pen" iconOnly label={t('Modifier')} onClick={() => addUnit(u)} /><Button size="sm" variant="ghost" icon="trash" iconOnly label={t('Supprimer')} onClick={() => confirm(t('Supprimer ce service ? Les postes restent, sans service.'), async () => { try { await api('DELETE', `/org/units/${u.id}`); toast(t('Supprimé.')); reload(); } catch (e) { fail(e); } })} /></span> : null}</div>
                      {u.mission ? <p className="muted small">{u.mission}</p> : null}
                      {ps.map((p) => <button type="button" key={p.id} className="adm-post" onClick={() => setSheet(p)}><span>{p.title}</span><Badge tone={p.holder ? 'ok' : 'warn'}>{p.holder || t('(vacant)')}</Badge></button>)}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {mode === 'posts' && d.positions.length ? <div className="adm-posts-list">{d.positions.map((p) => <button type="button" key={p.id} className="adm-post" onClick={() => setSheet(p)}><span>{p.title}<small>{unitName(p.unitId)}</small></span><Badge tone={p.holder ? 'ok' : 'warn'}>{p.holder || t('(vacant)')}</Badge></button>)}</div> : null}
          </Section>
          {sheet ? <PostSheet p={sheet} units={d.units} onClose={() => setSheet(null)} /> : null}
        </>
      );
    }}
    </View>
  );
}

function PostSheet({ p, units, onClose }) {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { toast, fail } = useWs();
  const [data, setData] = useState(null);
  const [funcs, setFuncs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(null);
  useMemo(() => {
    api('GET', `/org/posts/${p.id}`).then((j) => { setData(j.sheet); setF({ unitId: j.sheet.unitId ? String(j.sheet.unitId) : '', mission: j.sheet.mission, responsibilities: j.sheet.responsibilities.join('\n'), skills: j.sheet.skills, kpis: j.sheet.kpis, functions: j.sheet.functions }); }, fail);
    api('GET', '/control/sod/functions').then((j) => setFuncs(j.functions), () => {});
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true);
    try { await api('PUT', `/org/posts/${p.id}`, { unitId: toInt(f.unitId), mission: f.mission, responsibilities: f.responsibilities.split('\n').map((x) => x.trim()).filter(Boolean), skills: f.skills, kpis: f.kpis, functions: f.functions }); toast(t('Fiche enregistrée.')); reload(); onClose(); } catch (e) { fail(e); }
    setBusy(false);
  };
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const ro = !perms.org_manage;
  return (
    <Drawer title={p.title} onClose={onClose} wide>
      {!data || !f ? <p className="muted">{t('Chargement…')}</p> : (
        <div className="adm-form">
          <p><b>{t('Titulaire')}</b> : {data.holder || t('(vacant)')} · <b>{t('Supérieur')}</b> : {data.reportsTo || '—'}</p>
          {data.directReports.length ? <p><b>{t('Équipe directe')}</b> : {data.directReports.map((r) => r.title + (r.holder ? ' (' + r.holder + ')' : '')).join(', ')}</p> : null}
          <label className="fld"><span>{t('Service')}</span><select disabled={ro} value={f.unitId} onChange={(e) => set('unitId', e.target.value)}><option value="">{t('— Aucun —')}</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="fld"><span>{t('Mission du poste')}</span><textarea disabled={ro} rows={3} value={f.mission} onChange={(e) => set('mission', e.target.value)} /></label>
          <label className="fld"><span>{t('Responsabilités (une par ligne)')}</span><textarea disabled={ro} rows={5} value={f.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} /></label>
          <label className="fld"><span>{t('Compétences attendues')}</span><textarea disabled={ro} rows={2} value={f.skills} onChange={(e) => set('skills', e.target.value)} /></label>
          <label className="fld"><span>{t('Indicateurs de performance')}</span><textarea disabled={ro} rows={2} value={f.kpis} onChange={(e) => set('kpis', e.target.value)} /></label>
          {funcs.length ? (
            <fieldset className="adm-checks"><legend>{t('Fonctions exercées (séparation des tâches)')}</legend>
              {funcs.map((fn) => <label key={fn.id}><input type="checkbox" disabled={ro} checked={f.functions.includes(fn.id)} onChange={(e) => set('functions', e.target.checked ? [...f.functions, fn.id] : f.functions.filter((x) => x !== fn.id))} />{fn.name}</label>)}
            </fieldset>
          ) : null}
          {data.raci.length ? <div><b>{t('Rôle dans les processus (RACI)')}</b><ul>{data.raci.map((r, i) => <li key={i}>{r.process} · {r.activity} : <Badge>{r.letter}</Badge></li>)}</ul></div> : null}
          {!ro ? <Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer la fiche')}</Button> : <p className="muted small">{t('Seules les personnes désignées modifient les fiches.')}</p>}
        </div>
      )}
    </Drawer>
  );
}

// ---------- Matrice RACI ----------
export function Raci() {
  const t = useT();
  const { api, perms, reload } = useAdm();
  const { confirm, toast, fail } = useWs();
  const form = useFormModal();
  const LET = { R: t('Réalise'), A: t('Dirige et valide'), S: t('Supervise'), C: t('Consulté'), I: t('Informé') };
  const PROB = { no_accountable: t('Personne ne dirige cette activité'), many_accountable: t('Plusieurs personnes dirigent : une seule doit valider'), no_responsible: t('Personne ne réalise cette activité') };
  return (
    <View path="/org/raci">{(d) => (
      <>
        <Kpis>
          <Stat icon="diagram-project" label={t('Processus')} value={d.stats.processes} />
          <Stat icon="list-check" label={t('Activités')} value={d.stats.activities} />
          <Stat icon="table-cells" label={t('Rôles attribués')} value={d.stats.assignments} />
          <Stat icon="triangle-exclamation" label={t('Anomalies')} value={d.stats.issues} tone={d.stats.issues ? 'warn' : 'ok'} />
        </Kpis>
        <Alert tone="info" title={t('Comment lire la matrice')}>{(['R', 'A', 'S', 'C', 'I']).map((l) => `${l} = ${LET[l]}`).join(' · ')}. {t('Une activité a un seul A (celui qui dirige et valide) et au moins un R.')}</Alert>
        {perms.org_manage ? <div className="row"><Button variant="primary" icon="plus" onClick={() => form(t('Nouveau processus'), [{ k: 'name', label: t('Nom du processus'), required: true }, { k: 'domain', label: t('Domaine') }, { k: 'activities', label: t('Activités (une par ligne)'), type: 'textarea', rows: 5 }], (v) => api('POST', '/org/processes', { name: v.name, domain: v.domain, activities: v.activities.split('\n').map((x) => x.trim()).filter(Boolean) }))}>{t('Processus')}</Button></div> : null}
        {!d.processes.length ? <EmptyState icon="table-cells" title={t('Aucun processus décrit')}>{t('Décrivez un processus (ex. Achats) et ses activités, puis attribuez les rôles.')}</EmptyState> : null}
        {d.processes.map((p) => {
          const actors = []; const seen = new Set();
          for (const a of p.activities) for (const x of a.assignments) { const k = x.kind + x.id; if (!seen.has(k)) { seen.add(k); actors.push(x); } }
          return (
            <Section key={p.id} title={p.name} subtitle={p.domain}
              actions={perms.org_manage ? <><Button size="sm" icon="plus" onClick={() => form(t('Nouvelle activité'), [{ k: 'name', label: t('Activité'), required: true }], (v) => api('POST', `/org/processes/${p.id}/activities`, { name: v.name }))}>{t('Activité')}</Button><Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Supprimer')} onClick={() => confirm(t('Supprimer ce processus et ses activités ?'), async () => { try { await api('DELETE', `/org/processes/${p.id}`); toast(t('Supprimé.')); reload(); } catch (e) { fail(e); } })} /></> : null}>
              <div className="ui-table-wrap" tabIndex={0}><table className="ui-table adm-raci">
                <thead><tr><th>{t('Activité')}</th>{actors.map((a) => <th key={a.kind + a.id} className="c">{a.name}</th>)}<th /></tr></thead>
                <tbody>{p.activities.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}{a.problems.map((x) => <div key={x}><Badge tone="warn">{PROB[x]}</Badge></div>)}</td>
                    {actors.map((ac) => { const c = a.assignments.find((x) => x.kind === ac.kind && x.id === ac.id); return <td key={ac.kind + ac.id} className="c">{c ? <span className={'adm-l l' + c.letter} title={LET[c.letter]}>{c.letter}</span> : ''}</td>; })}
                    <td className="r">{perms.org_manage ? <Button size="sm" variant="soft" onClick={() => editRaci(a, form, api, t, LET)}>{t('Rôles')}</Button> : null}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Section>
          );
        })}
        {d.load.length ? <Section title={t('Charge par personne ou poste')} subtitle={t('Nombre d’activités réalisées ou dirigées')}>
          <HBars data={d.load.map((l) => ({ name: l.name, value: l.R + l.A }))} fmt={(v) => `${v}`} height={Math.max(160, d.load.length * 34)} />
        </Section> : null}
      </>
    )}
    </View>
  );
}
function editRaci(a, form, api, t, LET) { // eslint-disable-line max-params
  // Un champ par ligne « type:identifiant:lettre » serait peu clair : on propose la saisie guidée, personne par personne.
  api('GET', '/org/chart').then(async (c) => {
    const cfg = await api('GET', '/settings');
    const opts = [['', t('— Choisir —')], ...c.positions.map((p) => ['position:' + p.id, t('Poste') + ' · ' + p.title]), ...cfg.members.map((m) => ['user:' + m.userId, t('Personne') + ' · ' + m.name])];
    const cur = new Map(a.assignments.map((x) => [x.kind + ':' + x.id, x.letter]));
    const rows = Array.from({ length: 6 }, (_, i) => { const e = [...cur.entries()][i]; return e ? { who: e[0], letter: e[1] } : { who: '', letter: 'R' }; });
    const fields = rows.flatMap((r, i) => [
      { k: 'w' + i, label: `${t('Qui')} ${i + 1}`, type: 'select', options: opts, value: r.who },
      { k: 'l' + i, label: `${t('Lettre')} ${i + 1}`, type: 'select', options: Object.entries(LET).map(([k, v]) => [k, `${k} · ${v}`]), value: r.letter },
    ]);
    form(`${t('Rôles')} · ${a.name}`, fields, (v) => api('PUT', `/org/activities/${a.id}/raci`, { assignments: rows.map((_, i) => v['w' + i] && { kind: v['w' + i].split(':')[0], id: Number(v['w' + i].split(':')[1]), letter: v['l' + i] }).filter(Boolean) }), { wide: true });
  }, () => {});
}

// ---------- Délégations et intérim ----------
export function Delegations() {
  const t = useT();
  const { api, reload } = useAdm();
  const { dateFr, money, toast, fail, confirm } = useWs();
  const members = useMembers();
  const form = useFormModal();
  const SCOPE = { all: t('Tout'), purchase: t('Achat'), leave: t('Congé'), expense: t('Dépense'), document: t('Document'), contract: t('Contrat'), access: t('Accès'), other: t('Autre') };
  return (
    <View path="/org/delegations">{(d) => (
      <>
        <Kpis>
          <Stat icon="check" label={t('En cours')} value={d.summary.active} tone="ok" />
          <Stat icon="calendar-days" label={t('À venir')} value={d.summary.upcoming} />
          <Stat icon="clock" label={t('Terminées')} value={d.summary.expired} />
          <Stat icon="ban" label={t('Retirées')} value={d.summary.revoked} />
        </Kpis>
        <Section title={t('Délégations et intérim')} subtitle={t('Pendant une absence, le remplaçant valide à votre place dans les circuits, dans la limite du plafond.')}
          actions={<Button variant="primary" icon="plus" onClick={() => form(t('Nouvelle délégation'), [
            { k: 'kind', label: t('Type'), type: 'select', options: [['delegation', t('Délégation (les deux peuvent valider)')], ['interim', t('Intérim (le remplaçant décide seul)')]] },
            { k: 'delegateId', label: t('Remplaçant'), type: 'select', options: memberOptions(members, t), required: true },
            { k: 'startDate', label: t('Début'), type: 'date', value: new Date().toISOString().slice(0, 10) },
            { k: 'endDate', label: t('Fin'), type: 'date', required: true },
            { k: 'scopeKey', label: t('Périmètre'), type: 'select', options: Object.entries(SCOPE) },
            { k: 'scope', label: t('Précisions sur le périmètre') },
            { k: 'ceiling', label: t('Plafond de montant (0 = sans plafond)'), value: '0' },
            { k: 'reason', label: t('Motif') },
          ], (v) => api('POST', '/org/delegations', { ...v, delegateId: Number(v.delegateId), ceiling: num(v.ceiling) || 0 }))}>{t('Déléguer')}</Button>}>
          <Table caption={t('Délégations')} rows={d.delegations} empty={t('Aucune délégation.')} columns={[
            { key: 'delegator', label: t('De') }, { key: 'delegate', label: t('À') },
            { key: 'kind', label: t('Type'), render: (x) => (x.kind === 'interim' ? t('Intérim') : t('Délégation')) },
            { key: 'scopeKey', label: t('Périmètre'), render: (x) => SCOPE[x.scopeKey] + (x.scope ? ' · ' + x.scope : '') },
            { key: 'period', label: t('Période'), render: (x) => `${dateFr(x.startDate)} → ${dateFr(x.endDate)}` },
            { key: 'ceiling', label: t('Plafond'), align: 'r', render: (x) => (x.ceiling ? money(x.ceiling) : '—') },
            { key: 'state', label: t('État'), render: (x) => <Pill k={x.status === 'revoked' ? 'cancelled' : x.active ? 'active' : x.startDate > new Date().toISOString().slice(0, 10) ? 'pending' : 'expired'}>{x.status === 'revoked' ? t('Retirée') : x.active ? t('En cours') : x.startDate > new Date().toISOString().slice(0, 10) ? t('À venir') : t('Terminée')}</Pill> },
            { key: 'act', label: '', render: (x) => (x.status === 'active' && x.endDate >= new Date().toISOString().slice(0, 10) ? <Button size="sm" variant="ghost" onClick={() => confirm(t('Retirer cette délégation ?'), async () => { try { await api('POST', `/org/delegations/${x.id}/revoke`); toast(t('Délégation retirée.')); reload(); } catch (e) { fail(e); } })}>{t('Retirer')}</Button> : null) },
          ]} />
        </Section>
      </>
    )}
    </View>
  );
}
export { Grid };
