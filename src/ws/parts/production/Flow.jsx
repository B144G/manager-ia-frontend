import { useEffect, useMemo, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Alert, Badge, Button, Card, EmptyState } from '../../ui/index.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { BarChart, Gauge } from '../bp/Charts.jsx';
import { Cell, Kpi, num } from '../projects/ro-common.jsx';
import '../../../styles/ws-ro.css';

/* Production · circuit de production : modèle proposé par secteur, circuit personnalisé (étapes, ordre, responsables, durées, validations),
   analyse automatique des failles et risques avec solutions applicables en un clic, score global. Calculs faits par le serveur. */

const KIND = (t) => ({ supply: t('Approvisionnement'), prep: t('Préparation'), make: t('Fabrication'), qc: t('Contrôle qualité'), pack: t('Conditionnement'), store: t('Stockage'), ship: t('Expédition'), other: t('Autre') });
const SECTOR = (t) => ({ general: t('Général'), btp: t('BTP'), food: t('Alimentaire'), cosmetics: t('Cosmétique'), trade: t('Commerce') });
const LEVEL = (t) => ({ solid: t('Circuit solide'), correct: t('Circuit correct, à consolider'), fragile: t('Circuit fragile'), critical: t('Circuit critique') });

/** Titre et explication de chaque faille (le serveur envoie un code et des valeurs). */
function findingText(f, t) {
  const p = f.params;
  switch (f.code) {
    case 'empty': return [t('Le circuit est vide'), t('Aucune étape : partez du modèle de votre secteur.')];
    case 'loop': return [t('Boucle infinie'), t('Le circuit tourne en rond : {chain}. Un lot ne pourrait jamais en sortir.', { chain: p.chain })];
    case 'unresolved': return [t('Dépendance non résolue'), t('L\'étape « {step} » attend une étape qui n\'existe plus.', { step: p.step })];
    case 'isolated': return [t('Étape isolée'), t('« {step} » n\'est reliée à aucune autre étape : elle ne fait pas partie du flux.', { step: p.step })];
    case 'noOwner': return [t('Étapes sans responsable'), t('{n} étape(s) n\'ont personne de désigné : {steps}. Sans responsable, personne ne répond d\'un retard ou d\'un défaut.', { n: p.n, steps: p.steps })];
    case 'noDuration': return [t('Durée manquante'), t('{n} étape(s) sans durée : {steps}. Impossible de mesurer la capacité.', { n: p.n, steps: p.steps })];
    case 'noQc': return [t('Aucun contrôle qualité'), t('Rien ne vérifie le produit avant qu\'il parte : les défauts arriveront chez le client.')];
    case 'noShipCheck': return [t('Pas de validation avant expédition'), t('« {step} » peut partir sans qu\'une personne ait validé le lot.', { step: p.step })];
    case 'overload': return [t('Charge au-dessus de la capacité'), t('« {step} » doit traiter {target} lots par jour mais ne peut en faire que {cap} (charge {load} %). Il en faudrait {need} poste(s).', { step: p.step, target: num(p.target, 1), cap: num(p.cap, 1), load: num(p.load, 0), need: p.need })];
    case 'bottleneck': return [t('Goulot d\'étranglement'), t('« {step} » limite tout le circuit : {cap} lots par jour, alors que l\'étape suivante la plus lente peut en faire {next}. Charge actuelle : {load} %.', { step: p.step, cap: num(p.cap, 1), next: num(p.next, 1), load: num(p.load, 0) })];
    case 'spofStep': return [t('Point unique de défaillance'), t('Tout le flux passe par « {step} », sans doublure ni second poste : si elle s\'arrête, tout s\'arrête.', { step: p.step })];
    case 'spofPerson': return [t('Une personne porte trop d\'étapes'), t('{person} est responsable de {n} étapes ({steps}) : son absence bloquerait une grande partie du circuit.', { person: p.person, n: p.n, steps: p.steps })];
    default: return [f.code, ''];
  }
}
function solutionText(f, s, t) {
  const p = s.params || {};
  switch (`${f.code}/${s.id}`) {
    case 'empty/template': return t('Créer les 7 étapes du modèle');
    case 'loop/breakLoop': return t('Supprimer le lien « {from} → {to} »', p);
    case 'unresolved/dropRef': return t('Retirer la référence cassée');
    case 'isolated/linkPrev': return t('Relier après « {prev} »', p);
    case 'isolated/removeStep': return t('Supprimer l\'étape');
    case 'noOwner/spreadOwners': return t('Répartir les responsables entre les {n} membres', p);
    case 'noOwner/inviteMembers': return t('Invitez des collègues dans l\'équipe, puis désignez-les');
    case 'noDuration/defaultHours': return t('Mettre 1 heure par défaut');
    case 'noQc/insertQc': return p.after ? t('Ajouter un contrôle qualité après « {after} »', p) : t('Ajouter un contrôle qualité');
    case 'noShipCheck/validateQc': return t('Exiger le visa du contrôle « {qc} »', p);
    case 'noShipCheck/insertValidation': return t('Ajouter une validation avant « {before} »', p);
    case 'overload/addSlot': return t('Ajouter des postes en parallèle (total : {to})', p);
    case 'overload/lowerTarget': return t('Baisser l\'objectif à {to} lots par jour', p);
    case 'bottleneck/addSlot': return t('Ajouter un poste en parallèle (total : {to})', p);
    case 'bottleneck/manualShorten': return t('Raccourcir la durée : mieux outiller, former ou découper l\'étape');
    case 'spofStep/setBackup': return t('Désigner {name} comme doublure', p);
    case 'spofStep/addSlot': return t('Ajouter un second poste');
    case 'spofPerson/reassign': return t('Confier « {step} » à {name}', p);
    case 'spofPerson/inviteMembers': return t('Invitez un collègue pour répartir les étapes');
    default: return s.id;
  }
}

function Diagram({ steps, findings }) {
  const t = useT();
  const level = useMemo(() => {
    const by = new Map(steps.map((s) => [s.id, s])); const memo = new Map();
    const lv = (id, depth = 0) => { if (memo.has(id)) return memo.get(id); if (depth > 50) return 0; memo.set(id, 0); const s = by.get(id); const v = Math.max(-1, ...(s.after.filter((a) => by.has(a) && a !== id).map((a) => lv(a, depth + 1)))) + 1; memo.set(id, v); return v; };
    return new Map(steps.map((s) => [s.id, lv(s.id)]));
  }, [steps]);
  const BW = 168; const BH = 64; const GX = 46; const GY = 16;
  const cols = new Map(); const pos = new Map();
  for (const s of steps) { const l = level.get(s.id); const k = cols.get(l) || 0; cols.set(l, k + 1); pos.set(s.id, { x: 8 + l * (BW + GX), y: 8 + k * (BH + GY) }); }
  const W = 16 + (Math.max(0, ...cols.keys()) + 1) * (BW + GX) - GX; const H = 16 + Math.max(1, ...cols.values()) * (BH + GY) - GY;
  const bad = new Set(findings.filter((f) => f.state === 'open' && f.severity === 'high').flatMap((f) => f.stepIds));
  const warn = new Set(findings.filter((f) => f.state === 'open' && f.severity !== 'high').flatMap((f) => f.stepIds));
  const kinds = KIND(t);
  return (
    <div className="ro-net ro-flow" role="figure" aria-label={t('Schéma du circuit de production')}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><marker id="ro-arrow2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--plan)" /></marker></defs>
        {steps.flatMap((s) => s.after.filter((a) => pos.has(a) && a !== s.id).map((a) => {
          const A = pos.get(a); const B = pos.get(s.id); const x1 = A.x + BW; const y1 = A.y + BH / 2; const x2 = B.x; const y2 = B.y + BH / 2; const mx = (x1 + x2) / 2;
          return <path key={a + s.id} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2 - 2} ${y2}`} className="ro-edge" markerEnd="url(#ro-arrow2)" />;
        }))}
        {steps.map((s) => {
          const p = pos.get(s.id);
          return (
            <g key={s.id} className={'ro-node ' + (bad.has(s.id) ? 'bad' : warn.has(s.id) ? 'warn' : '')} transform={`translate(${p.x} ${p.y})`}>
              <rect className="box" width={BW} height={BH} rx="10" />
              <text x="8" y="17" className="ttl">{(tsrv(s.name).length > 22 ? tsrv(s.name).slice(0, 21) + '…' : tsrv(s.name))}</text>
              <text x="8" y="33" className="mut">{kinds[s.kind]}{s.validation ? ' · ' + t('visa') : ''}</text>
              <text x="8" y="48" className="mut">{s.owner || t('sans responsable')}</text>
              <text x="8" y="60" className="mut">{t('{h} h · {n} poste(s) · {load} %', { h: num(s.hours, 1), n: s.slots, load: num(s.load, 0) })}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Editor({ flow, members, reload }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const [steps, setSteps] = useState(() => JSON.parse(JSON.stringify(flow.steps)));
  const [target, setTarget] = useState(flow.targetPerDay); const [hpd, setHpd] = useState(flow.hoursPerDay); const [name, setName] = useState(flow.name);
  useEffect(() => { setSteps(JSON.parse(JSON.stringify(flow.steps))); setTarget(flow.targetPerDay); setHpd(flow.hoursPerDay); setName(flow.name); }, [flow]);
  const set = (i, k, v) => setSteps((l) => l.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const move = (i, d) => setSteps((l) => { const a = l.slice(); const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const add = () => setSteps((l) => { let n = l.length + 1; while (l.some((s) => s.id === 's' + n)) n++; return l.concat([{ id: 's' + n, name: '', kind: 'other', after: l.length ? [l[l.length - 1].id] : [], ownerId: null, backupId: null, hours: 1, slots: 1, validation: false }]); });
  const del = (i) => setSteps((l) => { const id = l[i].id; return l.filter((_, j) => j !== i).map((s) => ({ ...s, after: s.after.filter((a) => a !== id) })); });
  const toggleAfter = (i, id) => setSteps((l) => l.map((s, j) => (j === i ? { ...s, after: s.after.includes(id) ? s.after.filter((a) => a !== id) : s.after.concat([id]) } : s)));
  const save = () => oapi('PUT', `/production/flows/${flow.id}`, { name, targetPerDay: target, hoursPerDay: hpd, steps: steps.map((s) => ({ id: s.id, name: s.name, kind: s.kind, after: s.after, ownerId: s.ownerId, backupId: s.backupId, hours: s.hours, slots: s.slots, validation: s.validation })) }).then(() => { toast(t('Circuit enregistré.')); reload(); }).catch(fail);
  const kinds = KIND(t);
  const mem = [['', t('Personne')]].concat(members.map((m) => [String(m.userId), m.name]));
  return (
    <Card title={t('Étapes du circuit')} subtitle={t('Définissez vos étapes, leur ordre (« après quelle étape »), qui en répond, leur durée et si un visa est nécessaire.')} actions={<Button variant="primary" size="sm" onClick={save}>{t('Enregistrer et analyser')}</Button>}>
      <div className="ro-scroll"><table className="ro-ed"><thead><tr><th>{t('Nom du circuit')}</th><th>{t('Objectif (lots par jour)')}</th><th>{t('Heures de travail par jour')}</th></tr></thead>
        <tbody><tr><td><Cell type="text" label={t('Nom du circuit')} value={name} onChange={setName} /></td><td><Cell label={t('Objectif (lots par jour)')} value={target} onChange={setTarget} /></td><td><Cell label={t('Heures de travail par jour')} value={hpd} onChange={setHpd} /></td></tr></tbody></table></div>
      <div className="ro-scroll" style={{ marginTop: 10 }}><table className="ro-ed">
        <thead><tr><th>#</th><th>{t('Étape')}</th><th>{t('Type')}</th><th>{t('Après')}</th><th>{t('Responsable')}</th><th>{t('Doublure')}</th><th>{t('Heures par lot')}</th><th>{t('Postes')}</th><th>{t('Visa')}</th><th /></tr></thead>
        <tbody>{steps.map((s, i) => (
          <tr key={s.id}>
            <td>{i + 1}</td>
            <td><Cell type="text" label={t('Étape')} value={s.name} onChange={(v) => set(i, 'name', v)} /></td>
            <td><select aria-label={t('Type')} value={s.kind} onChange={(e) => set(i, 'kind', e.target.value)}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><details><summary>{s.after.length ? s.after.map((a) => (steps.findIndex((x) => x.id === a) + 1) || '?').join(', ') : t('début')}</summary>
              {steps.filter((x) => x.id !== s.id).map((x) => <label key={x.id} style={{ display: 'flex', gap: 6, minHeight: 32, alignItems: 'center' }}><input type="checkbox" checked={s.after.includes(x.id)} onChange={() => toggleAfter(i, x.id)} />{steps.indexOf(x) + 1}. {x.name}</label>)}
            </details></td>
            <td><select aria-label={t('Responsable')} value={s.ownerId === null ? '' : String(s.ownerId)} onChange={(e) => set(i, 'ownerId', e.target.value ? Number(e.target.value) : null)}>{mem.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></td>
            <td><select aria-label={t('Doublure')} value={s.backupId === null ? '' : String(s.backupId)} onChange={(e) => set(i, 'backupId', e.target.value ? Number(e.target.value) : null)}>{mem.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></td>
            <td><Cell label={t('Heures par lot')} value={s.hours} onChange={(v) => set(i, 'hours', v)} /></td>
            <td><Cell label={t('Postes')} value={s.slots} onChange={(v) => set(i, 'slots', v)} step="1" /></td>
            <td><input type="checkbox" aria-label={t('Visa')} checked={s.validation} onChange={(e) => set(i, 'validation', e.target.checked)} /></td>
            <td style={{ whiteSpace: 'nowrap' }}><button className="link" type="button" aria-label={t('Monter')} onClick={() => move(i, -1)}>↑</button> <button className="link" type="button" aria-label={t('Descendre')} onClick={() => move(i, 1)}>↓</button> <button className="link" type="button" onClick={() => del(i)}>{t('Retirer')}</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <Button size="sm" icon="plus" onClick={add}>{t('Ajouter une étape')}</Button>
    </Card>
  );
}

function Detail({ id, members, onDeleted, reloadList }) {
  const t = useT();
  const { oapi, can, confirm, fail, toast } = useWs();
  const st = useLoad(() => oapi('GET', `/production/flows/${id}`), [id]);
  const [showOff, setShowOff] = useState(false);
  const act = (path, body, msg) => oapi('POST', `/production/flows/${id}/${path}`, body).then((f) => { st.setData(f); reloadList(); if (msg) toast(msg); }).catch(fail);
  return (
    <Loaded state={st}>{(f) => {
      const A = f.analysis; const open = A.findings.filter((x) => x.state === 'open'); const off = A.findings.filter((x) => x.state === 'dismissed');
      const tone = A.level === 'solid' ? 'ok' : A.level === 'correct' ? 'warn' : 'bad';
      const m = A.metrics; const mgr = can('manager');
      return (
        <>
          <Card title={f.name} subtitle={t('Secteur : {s}', { s: SECTOR(t)[f.sector] })} actions={mgr ? <Button size="sm" variant="danger-outline" onClick={() => confirm(t('Supprimer ce circuit ?'), () => oapi('DELETE', `/production/flows/${id}`).then(onDeleted).catch(fail))}>{t('Supprimer')}</Button> : null}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: 220 }}><Gauge value={A.score} label={t('Score du circuit')} sub={LEVEL(t)[A.level]} tone={tone} /></div>
              <div className="bp-kpis" style={{ flex: 1, minWidth: 260, marginBottom: 0 }}>
                <Kpi label={t('Délai d\'un lot')} value={m.leadTimeHours === null ? '—' : t('{n} h', { n: num(m.leadTimeHours, 1) })} sub={t('de l\'approvisionnement à la sortie')} />
                <Kpi label={t('Capacité du circuit')} value={m.capacityPerDay === null ? '—' : t('{n} lots/jour', { n: num(m.capacityPerDay, 1) })} sub={t('objectif : {n} lots/jour', { n: num(m.targetPerDay, 1) })} tone={m.capacityPerDay !== null && m.capacityPerDay < m.targetPerDay ? 'bad' : 'good'} />
                <Kpi label={t('Failles à traiter')} value={String(m.openFindings)} sub={t('dont {n} majeure(s)', { n: m.high })} tone={m.high ? 'bad' : m.openFindings ? 'warn' : 'good'} />
              </div>
            </div>
          </Card>
          <Card title={t('Schéma du circuit')} subtitle={t('Rouge : faille majeure. Orange : point de vigilance.')}>
            {f.steps.length ? <Diagram steps={f.steps} findings={A.findings} /> : <EmptyState icon="gear" title={t('Circuit vide')}>{t('Ajoutez des étapes ci-dessous.')}</EmptyState>}
            {f.steps.length ? <BarChart title={t('Charge de chaque étape par rapport à sa capacité (%)')} labels={f.steps.map((s) => (tsrv(s.name).length > 12 ? tsrv(s.name).slice(0, 11) + '…' : tsrv(s.name)))} fmt={(v) => num(v, 0) + ' %'} height={200}
              bars={[{ key: 'l', label: t('Charge (100 % = capacité atteinte)'), values: f.steps.map((s) => s.load), color: 's1' }]} /> : null}
          </Card>
          <Card title={t('Failles et risques détectés')} subtitle={t('Pour chacune : appliquez une solution proposée, ou écartez-la si vous l\'assumez.')}>
            {!open.length ? <Alert tone="ok" title={t('Aucune faille ouverte')}>{t('Le circuit tient la route. Relancez l\'analyse après chaque modification.')}</Alert> : null}
            {open.map((x) => {
              const [title, text] = findingText(x, t);
              return (
                <div key={x.key} className={'ro-find ' + x.severity}>
                  <h3>{title} <Badge tone={x.severity === 'high' ? 'danger' : x.severity === 'medium' ? 'warn' : 'info'}>{x.severity === 'high' ? t('majeur') : x.severity === 'medium' ? t('moyen') : t('mineur')}</Badge></h3>
                  <p className="muted" style={{ margin: 0 }}>{text}</p>
                  {mgr ? (
                    <div className="sol">
                      {x.solutions.map((s) => (s.apply
                        ? <Button key={s.id} size="sm" variant="primary" onClick={() => act('apply', { key: x.key, solution: s.id }, t('Solution appliquée.'))}>{solutionText(x, s, t)}</Button>
                        : <span key={s.id} className="muted small">💡 {solutionText(x, s, t)}</span>))}
                      <Button size="sm" variant="ghost" onClick={() => act('dismiss', { key: x.key })}>{t('Écarter')}</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {off.length ? <p><button className="link" type="button" onClick={() => setShowOff(!showOff)}>{showOff ? t('Masquer') : t('Voir')} {t('les {n} faille(s) écartée(s)', { n: off.length })}</button></p> : null}
            {showOff ? off.map((x) => <div key={x.key} className={'ro-find off ' + x.severity}><h3>{findingText(x, t)[0]}</h3>{mgr ? <Button size="sm" onClick={() => act('dismiss', { key: x.key, restore: true })}>{t('Rétablir')}</Button> : null}</div>) : null}
          </Card>
          {mgr ? <Editor flow={f} members={members} reload={() => { st.reload(); reloadList(); }} /> : null}
        </>
      );
    }}
    </Loaded>
  );
}

export default function Flow({ members }) {
  const t = useT();
  const { oapi, can, modal } = useWs();
  const list = useLoad(() => oapi('GET', '/production/flows'), []);
  const [sel, setSel] = useState(null);
  useEffect(() => { if (sel === null && list.data && list.data.items.length) setSel(list.data.items[0].id); }, [list.data, sel]);
  const create = () => modal(t('Nouveau circuit de production'), (close) => (
    <Form
      fields={[
        { k: 'name', label: t('Nom du circuit'), required: true, placeholder: t('Ex : Jus de gingembre, Briques, Savons') },
        { k: 'sector', label: t('Secteur (modèle proposé)'), type: 'select', options: Object.entries(SECTOR(t)) },
        { k: 'mode', label: t('Point de départ'), type: 'select', options: [['template', t('Le circuit type du secteur (7 étapes), à adapter')], ['blank', t('Un circuit vide que je construis moi-même')]] },
        { k: 'target', label: t('Objectif (lots par jour)'), type: 'number', value: '1' },
      ]}
      submitText={t('Créer')}
      onSubmit={(v) => oapi('POST', '/production/flows', { name: v.name, sector: v.sector, targetPerDay: v.target, ...(v.mode === 'blank' ? { steps: [{ id: 's1', name: t('Première étape'), kind: 'supply', after: [], hours: 1, slots: 1 }] } : {}) }).then((f) => { close(); setSel(f.id); list.reload(); })}
    />
  ));
  return (
    <div className="bp">
      <Card title={t('Circuits de production')} subtitle={t('Le système propose un circuit type par secteur ; vous pouvez le modifier ou définir le vôtre. Il en cherche ensuite les failles.')} actions={can('manager') ? <Button variant="primary" size="sm" icon="plus" onClick={create}>{t('Nouveau circuit')}</Button> : null}>
        <Loaded state={list}>{(d) => (!d.items.length
          ? <EmptyState icon="gear" title={t('Aucun circuit')}>{can('manager') ? t('Créez un circuit à partir du modèle de votre secteur : approvisionnement, préparation, fabrication, contrôle qualité, conditionnement, stockage, expédition.') : t('Aucun circuit pour le moment.')}</EmptyState>
          : (
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Circuit')}</th><th>{t('Étapes')}</th><th>{t('Score')}</th><th>{t('Failles')}</th><th /></tr></thead>
              <tbody>{d.items.map((c) => (
                <tr key={c.id} style={{ background: c.id === sel ? 'var(--surface2)' : undefined }}>
                  <td><b>{c.name}</b><br /><small className="muted">{SECTOR(t)[c.sector]} · {c.source === 'template' ? t('modèle') : t('personnalisé')}</small></td><td>{c.steps}</td>
                  <td><span className={'bp-st ' + (c.level === 'solid' ? 'green' : c.level === 'correct' ? 'amber' : 'red')}>{c.score} / 100</span></td><td>{c.open}{c.high ? ` (${t('{n} majeure(s)', { n: c.high })})` : ''}</td>
                  <td><button className="link" type="button" onClick={() => setSel(c.id)}>{t('Ouvrir')}</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          ))}
        </Loaded>
      </Card>
      {sel ? <Detail key={sel} id={sel} members={members || []} onDeleted={() => { setSel(null); list.reload(); }} reloadList={list.reload} /> : null}
    </div>
  );
}
