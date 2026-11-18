/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useState } from 'react';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Button, Card, EmptyState, Segmented } from '../../../ui/index.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Pick, Remove, Setup, Sub, nextId, useDoc } from './common.jsx';
import { cut } from './flowCommon.jsx';
import { CircuitNote, ParetoChart, Pbar, TextLines } from './qcCommon.jsx';

/* Production · Six Sigma : projets DMAIC guidés, cartes de contrôle (X-barre/R et p), capabilité et niveau sigma, DPMO, Pareto, Ishikawa.
   Le serveur calcule tout (GET/PUT /production/adv/sixsigma) ; ici on saisit, on dessine et on explique. */

const PH = ['define', 'measure', 'analyze', 'improve', 'control'];
const PHNAME = (t) => ({ define: t('Définir'), measure: t('Mesurer'), analyze: t('Analyser'), improve: t('Améliorer'), control: t('Contrôler') });
const PHHELP = (t) => ({ define: t('Dire clairement le problème, l\'objectif et qui pilote.'), measure: t('Mesurer la situation actuelle avec des données fiables.'), analyze: t('Trouver les causes principales du problème.'), improve: t('Tester puis installer les solutions.'), control: t('Vérifier que le gain dure dans le temps.') });
/** Prochaine étape conseillée : une phrase + le sous-onglet utile (null = on reste dans le projet). */
const NEXT = (t) => ({
  charter: { text: t('Rédigez la fiche du projet : le problème en une phrase, l\'objectif chiffré et un responsable.'), tab: null },
  collect: { text: t('Collectez des mesures : saisissez des sous-groupes de mesures pour tracer les cartes de contrôle.'), tab: 'charts', btn: t('Ouvrir les cartes de contrôle') },
  baseline: { text: t('Fixez la situation de départ : calculez la capabilité et le niveau sigma actuels.'), tab: 'capability', btn: t('Ouvrir la capabilité et sigma') },
  pareto: { text: t('Classez les défauts par fréquence pour voir les quelques causes qui comptent vraiment.'), tab: 'pareto', btn: t('Ouvrir le Pareto') },
  rootcause: { text: t('Cherchez les causes racines avec le diagramme d\'Ishikawa (6M).'), tab: 'ishikawa', btn: t('Ouvrir l\'Ishikawa') },
  pilot: { text: t('Testez la solution à petite échelle, mesurez le gain, puis déployez-la.'), tab: null },
  control: { text: t('Suivez le processus avec une carte de contrôle pour vérifier que le gain tient.'), tab: 'charts', btn: t('Ouvrir les cartes de contrôle') },
});
const SIX = (t) => ({ man: t('Main-d\'œuvre'), machine: t('Machine'), method: t('Méthode'), material: t('Matière'), measure: t('Mesure'), environment: t('Milieu') });
const SIXK = ['man', 'machine', 'method', 'material', 'measure', 'environment'];
const SUBS = (t) => [{ id: 'dmaic', label: t('DMAIC guidé') }, { id: 'charts', label: t('Cartes de contrôle') }, { id: 'capability', label: t('Capabilité et sigma') }, { id: 'pareto', label: t('Pareto') }, { id: 'ishikawa', label: t('Ishikawa') }];

/* ---------- DMAIC ---------- */
function Frise({ phase }) {
  const t = useT(); const names = PHNAME(t); const idx = PH.indexOf(phase);
  return (
    <ol aria-label={t('Les 5 phases DMAIC')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: '8px 0' }}>
      {PH.map((p, i) => (
        <li key={p} aria-current={i === idx ? 'step' : undefined} style={{ flex: '1 1 90px', textAlign: 'center', padding: '8px 6px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: '1px solid ' + (i === idx ? 'var(--s1)' : 'var(--line)'), background: i < idx ? 'color-mix(in srgb, var(--ok) 14%, var(--surface))' : i === idx ? 'color-mix(in srgb, var(--s1) 18%, var(--surface))' : 'var(--surface)', color: i > idx ? 'var(--muted)' : 'var(--fg)' }}>
          {i + 1}. {names[p]}{i < idx ? ' ✓' : ''}
        </li>
      ))}
    </ol>
  );
}

function ProjectCard({ d, p, i, rp, open }) {
  const t = useT(); const names = PHNAME(t); const help = PHHELP(t); const nx = NEXT(t);
  const step = rp ? nx[rp.nextStep] : null;
  const addTask = (phase) => d.set((o) => ({ ...o, projects: o.projects.map((x, n) => (n === i ? { ...x, tasks: x.tasks.concat([{ text: '', phase, done: false }]) } : x)) }));
  return (
    <Card flat title={p.title || t('Projet {n}', { n: i + 1 })} actions={<Remove onClick={() => d.set((o) => ({ ...o, projects: o.projects.filter((_, k) => k !== i) }))} />}>
      <EdTable head={[t('Titre'), t('Responsable'), t('Phase actuelle')]} rows={[[
        <Cell type="text" label={t('Titre')} value={p.title} onChange={(v) => d.upd(['projects', i, 'title'], v)} />,
        <Cell type="text" label={t('Responsable')} value={p.owner} onChange={(v) => d.upd(['projects', i, 'owner'], v)} />,
        <Pick label={t('Phase actuelle')} value={p.phase} onChange={(v) => d.upd(['projects', i, 'phase'], v)} options={PH.map((k) => [k, names[k]])} />,
      ]]} />
      <EdTable head={[t('Problème à résoudre'), t('Objectif chiffré')]} rows={[[
        <Cell type="text" label={t('Problème à résoudre')} value={p.problem} onChange={(v) => d.upd(['projects', i, 'problem'], v)} />,
        <Cell type="text" label={t('Objectif chiffré')} value={p.goal} onChange={(v) => d.upd(['projects', i, 'goal'], v)} />,
      ]]} />
      <Frise phase={p.phase} />
      <p className="muted small" style={{ margin: '0 0 8px' }}><b>{names[p.phase]}</b> : {help[p.phase]}</p>
      {rp ? <div style={{ margin: '6px 0 10px' }}><b className="small">{t('Avancement : {p} % des tâches faites', { p: rp.progress })}</b><Pbar value={rp.progress} label={t('Avancement')} /></div> : null}
      {step ? (
        <Alert tone="info" title={t('Prochaine étape conseillée')}>
          <p style={{ margin: '0 0 6px' }}>{step.text}</p>
          {step.tab ? <Button size="sm" variant="primary" onClick={() => open(step.tab)}>{step.btn}</Button> : null}
        </Alert>
      ) : <p className="muted small">{t('Enregistrez pour voir la prochaine étape conseillée.')}</p>}
      {PH.map((ph) => {
        const ts = p.tasks.map((x, k) => ({ x, k })).filter((e) => e.x.phase === ph);
        return (
          <div key={ph}>
            <Sub>{names[ph]}</Sub>
            {ts.map(({ x, k }) => (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                <input type="checkbox" style={{ width: 22, height: 22, flex: 'none' }} aria-label={t('Tâche faite')} checked={Boolean(x.done)} onChange={(e) => d.upd(['projects', i, 'tasks', k, 'done'], e.target.checked)} />
                <div style={{ flex: 1 }}><Cell type="text" label={t('Tâche')} value={x.text} onChange={(v) => d.upd(['projects', i, 'tasks', k, 'text'], v)} /></div>
                <Remove onClick={() => d.set((o) => ({ ...o, projects: o.projects.map((y, n) => (n === i ? { ...y, tasks: y.tasks.filter((_, m) => m !== k) } : y)) }))} />
              </div>
            ))}
            <Button size="sm" icon="plus" onClick={() => addTask(ph)}>{t('Ajouter une tâche')}</Button>
          </div>
        );
      })}
    </Card>
  );
}

function Dmaic({ d, open }) {
  const t = useT();
  return (
    <Setup d={d} title={t('Projets DMAIC')} subtitle={t('DMAIC est la démarche de Six Sigma pour résoudre un problème : Définir, Mesurer, Analyser, Améliorer, Contrôler.')}>
      {d.doc.projects.map((p, i) => <ProjectCard key={p.id} d={d} p={p} i={i} rp={d.result && d.result.projects ? d.result.projects.find((x) => x.id === p.id) : null} open={open} />)}
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, projects: o.projects.concat([{ id: nextId(o.projects, 'dm'), title: '', phase: 'define', problem: '', goal: '', owner: '', tasks: [] }]) }))}>{t('Ajouter un projet')}</Button>
    </Setup>
  );
}

/* ---------- Cartes de contrôle ---------- */
/** Carte de contrôle en SVG : ligne centrale, limites en pointillés, points hors limites en couleur d'alerte, séries de 7 points repérées. ucl/lcl : nombre ou tableau (carte p). */
function ControlChart({ title, values, center, ucl, lcl, signals, fmt }) {
  const t = useT();
  const W = 680; const H = 250; const L = 56; const R = 70; const T = 14; const B = 28;
  const n = values.length;
  const U = (i) => (Array.isArray(ucl) ? ucl[i] : ucl); const Lo = (i) => (Array.isArray(lcl) ? lcl[i] : lcl);
  const all = values.concat(values.map((_, i) => U(i)), values.map((_, i) => Lo(i)), [center]);
  let lo = Math.min(...all); let hi = Math.max(...all); if (hi === lo) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
  const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const step = (f) => values.map((_, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(f(i)).toFixed(1)).join('');
  const out = new Set(signals.filter((s) => s.rule === 'limit').map((s) => s.index));
  const run = new Set(); signals.filter((s) => s.rule === 'run').forEach((s) => { for (let k = s.index - 6; k <= s.index; k++) run.add(k); });
  const f = fmt || ((v) => num(v, 2));
  const lastU = U(n - 1); const lastL = Lo(n - 1);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460 }} role="img" aria-label={title}>
        <title>{title}</title>
        <path d={step(U)} fill="none" stroke="var(--pink)" strokeWidth="1.6" strokeDasharray="6 4" />
        <path d={step(Lo)} fill="none" stroke="var(--pink)" strokeWidth="1.6" strokeDasharray="6 4" />
        <line x1={L} x2={W - R} y1={y(center)} y2={y(center)} stroke="var(--plan)" strokeWidth="1.8" />
        <text x={W - R + 6} y={y(lastU) + 4} style={{ fontSize: 11, fill: 'var(--pink)', fontWeight: 700 }}>{t('Limite haute')} {f(lastU)}</text>
        <text x={W - R + 6} y={y(center) + 4} style={{ fontSize: 11, fill: 'var(--plan)', fontWeight: 700 }}>{t('Centre')} {f(center)}</text>
        <text x={W - R + 6} y={y(lastL) + 4} style={{ fontSize: 11, fill: 'var(--pink)', fontWeight: 700 }}>{t('Limite basse')} {f(lastL)}</text>
        <path d={values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('')} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" />
        {values.map((v, i) => {
          const bad = out.has(i); const warn = run.has(i);
          return (
            <g key={i}>
              {warn && !bad ? <circle cx={x(i)} cy={y(v)} r="8" fill="none" stroke="var(--signal)" strokeWidth="2.4" /> : null}
              <circle cx={x(i)} cy={y(v)} r={bad ? 5.5 : 3.5} fill={bad ? 'var(--pink)' : 'var(--s1)'} stroke="var(--surface)" strokeWidth="1.5"><title>{t('Point {n} : {v}', { n: i + 1, v: f(v) })}</title></circle>
              {n <= 30 || i % 5 === 0 ? <text x={x(i)} y={H - 8} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--muted)' }}>{i + 1}</text> : null}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5 }}>
        <span><i style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px solid var(--plan)', marginRight: 5, verticalAlign: 3 }} aria-hidden="true" />{t('Ligne centrale')}</span>
        <span><i style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed var(--pink)', marginRight: 5, verticalAlign: 3 }} aria-hidden="true" />{t('Limites de contrôle')}</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--pink)', marginRight: 5 }} aria-hidden="true" />{t('Point hors limites')}</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--signal)', marginRight: 5 }} aria-hidden="true" />{t('7 points du même côté')}</span>
      </div>
    </div>
  );
}

function Charts({ d }) {
  const t = useT(); const r = d.result || {};
  const subs = d.doc.xr.subgroups; const samples = d.doc.p.samples;
  const setSubs = (lines) => d.upd(['xr', 'subgroups'], lines.map((l) => l.split(/[\s;,]+/).filter(Boolean).map((v) => Number(v.replace(',', '.'))).filter((v) => Number.isFinite(v))).filter((g) => g.length));
  const sigTxt = (s) => s.length ? t('{n} signal(aux) détecté(s).', { n: s.length }) : t('Aucun signal.');
  const hasRun = (c) => c.signals.some((s) => s.rule === 'run');
  return (
    <>
      <Setup d={d} title={t('Mesures à surveiller')} subtitle={t('Une carte de contrôle suit un processus dans le temps : tant que les points restent entre les limites, la variation est normale.')}>
        <Sub>{t('Sous-groupes de mesures (carte X-barre et R)')}</Sub>
        <p className="muted small">{t('Une ligne par sous-groupe (par exemple 5 pièces prises à la suite). Séparez les mesures par des espaces ou des virgules ; tous les sous-groupes ont le même nombre de mesures (2 à 10), au moins 2 sous-groupes.')}</p>
        <TextLines label={t('Sous-groupes de mesures')} rows={6} placeholder={'10.1 10.3 9.9 10.0 10.2\n10.0 10.4 10.1 9.8 10.1'} lines={subs.map((g) => g.join(' '))} onChange={setSubs} />
        <Sub>{t('Échantillons (carte p : proportion de pièces défectueuses)')}</Sub>
        <EdTable empty={t('Aucun échantillon.')} head={[t('Taille de l\'échantillon'), t('Pièces défectueuses'), '']}
          rows={samples.map((s, i) => [
            <Cell label={t('Taille de l\'échantillon')} value={s.n} onChange={(v) => d.upd(['p', 'samples', i, 'n'], v)} />,
            <Cell label={t('Pièces défectueuses')} value={s.d} onChange={(v) => d.upd(['p', 'samples', i, 'd'], v)} />,
            <Remove onClick={() => d.set((o) => ({ ...o, p: { ...o.p, samples: o.p.samples.filter((_, k) => k !== i) } }))} />,
          ])} />
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, p: { ...o.p, samples: o.p.samples.concat([{ n: 100, d: 0 }]) } }))}>{t('Ajouter un échantillon')}</Button>
      </Setup>
      {!r.xr && !r.p ? <EmptyState icon="chart" title={t('Pas encore de carte')}>{t('Saisissez au moins 2 sous-groupes (ou 2 échantillons pour la carte p), puis enregistrez.')}</EmptyState> : null}
      {r.xr ? (
        <Card title={t('Cartes X-barre et R')} subtitle={t('X-barre suit la moyenne de chaque sous-groupe, R suit son étendue (écart entre la plus grande et la plus petite mesure).')}>
          <Conclusion>{r.xr.stable
            ? t('Le processus est sous contrôle : aucun point hors limites ni série suspecte. Sa variation est naturelle, inutile de le régler à chaque écart.')
            : t('Le processus n\'est pas sous contrôle : {a} Cherchez une cause particulière (changement d\'équipe, de matière, de réglage) avant toute autre action.', { a: sigTxt(r.xr.x.signals.concat(r.xr.r.signals)) })}</Conclusion>
          <h3 style={{ fontSize: 15 }}>{t('Carte X-barre (moyennes)')}</h3>
          <ControlChart title={t('Carte X-barre')} values={r.xr.x.values} center={r.xr.x.center} ucl={r.xr.x.ucl} lcl={r.xr.x.lcl} signals={r.xr.x.signals} />
          <h3 style={{ fontSize: 15 }}>{t('Carte R (étendues)')}</h3>
          <ControlChart title={t('Carte R')} values={r.xr.r.values} center={r.xr.r.center} ucl={r.xr.r.ucl} lcl={r.xr.r.lcl} signals={r.xr.r.signals} />
          {hasRun(r.xr.x) || hasRun(r.xr.r) ? <Alert tone="warn" title={t('7 points du même côté')}>{t('Sept points d\'affilée du même côté de la ligne centrale : le processus a probablement glissé, même si aucun point ne sort des limites.')}</Alert> : null}
        </Card>
      ) : null}
      {r.p ? (
        <Card title={t('Carte p (proportion de défectueux)')} subtitle={t('Chaque point est la part de pièces défectueuses d\'un échantillon ; les limites s\'adaptent à sa taille.')}>
          <Conclusion>{r.p.stable
            ? t('La proportion de défectueux est stable autour de {p} % : le processus est sous contrôle.', { p: num(r.p.center * 100, 2) })
            : t('Le processus n\'est pas sous contrôle : {n} échantillon(s) sortent des limites. Cherchez ce qui a changé ces jours-là.', { n: r.p.signals.length })}</Conclusion>
          <ControlChart title={t('Carte p')} values={r.p.points.map((x) => x.p * 100)} center={r.p.center * 100} ucl={r.p.points.map((x) => x.ucl * 100)} lcl={r.p.points.map((x) => x.lcl * 100)} signals={r.p.signals.map((index) => ({ index, rule: 'limit' }))} fmt={(v) => num(v, 2) + ' %'} />
        </Card>
      ) : null}
    </>
  );
}

/* ---------- Capabilité ---------- */
const VERD = (t) => ({ excellent: t('excellent'), good: t('bon'), marginal: t('limite'), poor: t('insuffisant') });
const VTXT = (t) => ({
  excellent: t('Le processus est très largement capable de respecter la tolérance.'),
  good: t('Le processus respecte la tolérance avec une marge confortable.'),
  marginal: t('Le processus tient la tolérance de justesse : surveillez-le de près et réduisez sa variation.'),
  poor: t('Le processus ne tient pas la tolérance : des pièces hors tolérance sont produites. Réduisez la variation ou recentrez la moyenne.'),
});

/** Échelle colorée de la capabilité (0 à 2) avec repère à la valeur de Cpk. */
function CpkScale({ value }) {
  const t = useT();
  const W = 600; const x = (v) => 10 + (Math.max(0, Math.min(2, v)) / 2) * (W - 20);
  const seg = [[0, 1, 'var(--pink)', t('insuffisant')], [1, 1.33, 'var(--signal)', t('limite')], [1.33, 1.67, 'var(--s2)', t('bon')], [1.67, 2, 'var(--ok)', t('excellent')]];
  return (
    <svg viewBox={`0 0 ${W} 70`} width="100%" style={{ maxWidth: 600 }} role="img" aria-label={t('Échelle de capabilité : Cpk = {v}', { v: num(value, 2) })}>
      {seg.map((s) => <g key={s[3]}><rect x={x(s[0])} y="22" width={x(s[1]) - x(s[0])} height="16" fill={s[2]} opacity="0.85" /><text x={(x(s[0]) + x(s[1])) / 2} y="54" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted)' }}>{s[3]}</text></g>)}
      {[0, 1, 1.33, 1.67, 2].map((v) => <text key={v} x={x(v)} y="16" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg)' }}>{num(v, 2)}</text>)}
      <path d={`M${x(value)} 40 l-7 -9 h14 z`} fill="var(--fg)" />
      <line x1={x(value)} x2={x(value)} y1="22" y2="40" stroke="var(--fg)" strokeWidth="2.5" />
    </svg>
  );
}

/** Histogramme des mesures avec limites de spécification (tracées en couleur d'alerte) et moyenne. */
function Histo({ values, lsl, usl, mean }) {
  const t = useT();
  const W = 680; const H = 240; const L = 36; const R = 14; const T = 20; const B = 34;
  const lo0 = Math.min(...values, ...(lsl !== null ? [lsl] : [])); const hi0 = Math.max(...values, ...(usl !== null ? [usl] : []));
  const span = (hi0 - lo0) || 1; const lo = lo0 - span * 0.05; const hi = hi0 + span * 0.05;
  const nb = Math.max(5, Math.min(20, Math.ceil(Math.log2(values.length) + 1)));
  const bw = (hi - lo) / nb; const bins = Array.from({ length: nb }, () => 0);
  values.forEach((v) => { bins[Math.min(nb - 1, Math.floor((v - lo) / bw))]++; });
  const mx = Math.max(...bins, 1);
  const x = (v) => L + (v - lo) / (hi - lo) * (W - L - R); const y = (c) => T + (H - T - B) * (1 - c / mx);
  const mark = (v, label, col) => <g><line x1={x(v)} x2={x(v)} y1={T - 6} y2={H - B} stroke={col} strokeWidth="2.2" strokeDasharray="6 4" /><text x={x(v)} y={T - 8} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: col }}>{label}</text></g>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420 }} role="img" aria-label={t('Histogramme des mesures')}>
        <title>{t('Histogramme des mesures')}</title>
        {bins.map((c, i) => <rect key={i} x={x(lo + i * bw) + 1} y={y(c)} width={Math.max(1, x(lo + bw) - x(lo) - 2)} height={y(0) - y(c)} fill="var(--s1)" opacity="0.8" rx="2" />)}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {[0, 0.25, 0.5, 0.75, 1].map((k) => { const v = lo + (hi - lo) * k; return <text key={k} x={x(v)} y={H - 12} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted)' }}>{num(v, 2)}</text>; })}
        {lsl !== null ? mark(lsl, t('Limite inf.'), 'var(--pink)') : null}
        {usl !== null ? mark(usl, t('Limite sup.'), 'var(--pink)') : null}
        {mark(mean, t('Moyenne'), 'var(--plan)')}
      </svg>
    </div>
  );
}

function Capability({ d }) {
  const t = useT(); const r = d.result || {}; const cap = r.capability; const verd = VERD(t); const vt = VTXT(t);
  const sp = d.doc.spec; const dp = d.doc.dpmo;
  const toN = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  const vals = d.doc.xr.subgroups.flat();
  const tone = cap ? (cap.verdict === 'excellent' || cap.verdict === 'good' ? '' : cap.verdict === 'marginal' ? 'warn' : 'bad') : '';
  return (
    <>
      <Setup d={d} title={t('Limites de spécification')} subtitle={t('La tolérance du client : en dessous de la limite inférieure ou au-dessus de la limite supérieure, la pièce est refusée. Les mesures viennent de l\'onglet « Cartes de contrôle ».')}>
        <EdTable head={[t('Limite inférieure'), t('Limite supérieure'), t('Unité')]} rows={[[
          <Cell label={t('Limite inférieure')} value={sp.lsl} onChange={(v) => d.upd(['spec', 'lsl'], v)} />,
          <Cell label={t('Limite supérieure')} value={sp.usl} onChange={(v) => d.upd(['spec', 'usl'], v)} />,
          <Cell type="text" label={t('Unité')} value={sp.unit} onChange={(v) => d.upd(['spec', 'unit'], v)} />,
        ]]} />
        <Sub>{t('Calculateur DPMO direct')}</Sub>
        <p className="muted small">{t('DPMO = défauts par million d\'occasions. Une occasion est un endroit où un défaut peut apparaître sur une unité.')}</p>
        <EdTable head={[t('Unités contrôlées'), t('Occasions de défaut par unité'), t('Défauts constatés')]} rows={[[
          <Cell label={t('Unités contrôlées')} value={dp.units} onChange={(v) => d.upd(['dpmo', 'units'], v)} />,
          <Cell label={t('Occasions de défaut par unité')} value={dp.opportunities} onChange={(v) => d.upd(['dpmo', 'opportunities'], v)} />,
          <Cell label={t('Défauts constatés')} value={dp.defects} onChange={(v) => d.upd(['dpmo', 'defects'], v)} />,
        ]]} />
      </Setup>
      {r.dpmo ? (
        <Card title={t('Résultat du calculateur DPMO')}>
          <div className="bp-kpis">
            <Kpi label={t('DPMO')} value={num(r.dpmo.dpmo, 0)} sub={t('défauts par million d\'occasions')} tone={r.dpmo.dpmo <= 3.4 ? 'good' : r.dpmo.dpmo <= 66807 ? 'warn' : 'bad'} />
            <Kpi label={t('Rendement')} value={num(r.dpmo.yieldPct, 2) + ' %'} />
            <Kpi label={t('Niveau sigma')} value={r.dpmo.sigmaLevel === null ? '—' : num(r.dpmo.sigmaLevel, 2)} sub={t('avec décalage de 1,5 sigma')} />
          </div>
        </Card>
      ) : null}
      {!cap ? <EmptyState icon="chart" title={t('Capabilité non calculée')}>{t('Saisissez au moins 2 sous-groupes de mesures dans « Cartes de contrôle » et une limite de spécification, puis enregistrez.')}</EmptyState> : (
        <>
          <Card title={t('Capabilité du processus')} subtitle={t('Le processus est-il capable de respecter la tolérance ? Cp et Cpk regardent la variation à court terme, Pp et Ppk la variation totale.')}>
            <Conclusion>{t('Verdict : {v}. Cpk = {c}. {x}', { v: verd[cap.verdict], c: num(cap.cpk, 2), x: vt[cap.verdict] })}{' '}{!cap.centered ? t('Le processus n\'est pas centré : recentrer la moyenne améliorerait le résultat.') : ''}</Conclusion>
            <div className="bp-kpis">
              <Kpi label={t('Cp')} value={cap.cp === null ? '—' : num(cap.cp, 2)} sub={t('capacité si le processus était centré')} />
              <Kpi label={t('Cpk')} value={num(cap.cpk, 2)} sub={t('capacité réelle (court terme)')} tone={tone} />
              <Kpi label={t('Pp')} value={cap.pp === null ? '—' : num(cap.pp, 2)} />
              <Kpi label={t('Ppk')} value={num(cap.ppk, 2)} sub={t('capacité réelle (long terme)')} />
              <Kpi label={t('Niveau sigma')} value={cap.sigmaLevel === null ? '—' : num(cap.sigmaLevel, 2)} />
              <Kpi label={t('DPMO')} value={num(cap.dpmo, 0)} sub={t('pièces hors tolérance par million')} />
            </div>
            <Sub>{t('Où se situe le Cpk')}</Sub>
            <CpkScale value={cap.cpk} />
            <p className="muted small">{t('Repères : insuffisant sous 1, limite de 1 à 1,33, bon de 1,33 à 1,67, excellent à partir de 1,67.')}</p>
          </Card>
          <Card title={t('Histogramme des mesures')} subtitle={t('Les barres montrent la répartition des mesures ; les traits en pointillés sont les limites de spécification.')}>
            <Histo values={vals} lsl={toN(sp.lsl)} usl={toN(sp.usl)} mean={cap.mean} />
            <p className="muted small">{t('Moyenne {m}, écart-type {s} {u}.', { m: num(cap.mean, 3), s: num(cap.sd, 3), u: sp.unit || '' })}</p>
          </Card>
        </>
      )}
    </>
  );
}

/* ---------- Pareto ---------- */
function Pareto({ d }) {
  const t = useT(); const r = d.result || {}; const rows = d.doc.defects;
  return (
    <>
      <Setup d={d} title={t('Défauts par cause')} subtitle={t('Listez les causes de défauts et leur nombre : le diagramme de Pareto montre les quelques causes qui expliquent l\'essentiel.')}>
        <EdTable empty={t('Aucune cause.')} head={[t('Cause du défaut'), t('Nombre'), '']}
          rows={rows.map((x, i) => [
            <Cell type="text" label={t('Cause du défaut')} value={x.cause} onChange={(v) => d.upd(['defects', i, 'cause'], v)} />,
            <Cell label={t('Nombre')} value={x.count} onChange={(v) => d.upd(['defects', i, 'count'], v)} />,
            <Remove onClick={() => d.set((o) => ({ ...o, defects: o.defects.filter((_, k) => k !== i) }))} />,
          ])} />
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, defects: o.defects.concat([{ cause: '', count: '' }]) }))}>{t('Ajouter une cause')}</Button>
      </Setup>
      {r.pareto ? (
        <Card title={t('Diagramme de Pareto')} subtitle={t('Règle des 80/20 : peu de causes produisent la plupart des défauts.')}>
          <Conclusion>{t('{k} cause(s) sur {n} expliquent environ 80 % des défauts : {c}. Ce sont les « quelques causes vitales » à traiter en premier.', { k: r.vitalFew.length, n: r.pareto.length, c: r.vitalFew.join(', ') })}</Conclusion>
          <ParetoChart title={t('Diagramme de Pareto des défauts')} valueLabel={t('Nombre')} items={r.pareto.map((x) => ({ label: x.cause, value: x.count, cum: x.cumPct }))} />
        </Card>
      ) : <EmptyState icon="chart" title={t('Pas encore de Pareto')}>{t('Ajoutez des causes avec leur nombre, puis enregistrez.')}</EmptyState>}
    </>
  );
}

/* ---------- Ishikawa ---------- */
/** Diagramme en arêtes de poisson : le problème à la tête, 6 familles de causes (3 en haut, 3 en bas). */
function Fish({ problem, causes }) {
  const t = useT(); const names = SIX(t);
  const W = 780; const H = 400; const midY = 200; const headX = 640;
  const bones = SIXK.map((k, i) => {
    const top = i < 3; const col = i % 3; const bx = 110 + col * 190;
    return { k, top, bx, y0: top ? 40 : H - 40, items: causes[k] || [] };
  });
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560 }} role="img" aria-label={t('Diagramme d\'Ishikawa : {p}', { p: problem || t('problème à définir') })}>
        <title>{t('Diagramme d\'Ishikawa')}</title>
        <line x1="20" x2={headX} y1={midY} y2={midY} stroke="var(--fg)" strokeWidth="3" />
        <rect x={headX} y={midY - 36} width="136" height="72" rx="12" fill="color-mix(in srgb, var(--pink) 12%, var(--surface))" stroke="var(--pink)" strokeWidth="2" />
        <foreignObject x={headX + 4} y={midY - 34} width="128" height="68"><div xmlns="http://www.w3.org/1999/xhtml" style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: 68, overflow: 'hidden' }}>{cut(problem || t('Problème à définir'), 60)}</div></foreignObject>
        {bones.map((b) => {
          const jx = b.bx + 60; const dir = b.top ? 1 : -1;
          return (
            <g key={b.k}>
              <line x1={b.bx} y1={b.y0} x2={jx} y2={midY} stroke="var(--s1)" strokeWidth="2.4" />
              <text x={b.bx - 4} y={b.top ? b.y0 - 8 : b.y0 + 16} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: 'var(--s1)' }}>{names[b.k]}</text>
              {b.items.slice(0, 6).map((c, j) => {
                const f = (j + 1) / (Math.min(b.items.length, 6) + 1); const yy = b.y0 + (midY - b.y0) * f; const xx = b.bx + (jx - b.bx) * f;
                return <g key={j}><line x1={xx - 34} x2={xx} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1.5" /><text x={xx - 36} y={yy - 3 * dir + (b.top ? 0 : 0)} textAnchor="end" style={{ fontSize: 10.5, fill: 'var(--fg)' }}>{cut(c, 22)}</text></g>;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Ishikawa({ d }) {
  const t = useT(); const r = d.result || {}; const names = SIX(t); const I = d.doc.ishikawa;
  const total = SIXK.reduce((a, k) => a + (I.causes[k] || []).length, 0);
  return (
    <>
      <Setup d={d} title={t('Causes possibles du problème')} subtitle={t('Le diagramme d\'Ishikawa (arête de poisson) classe les causes possibles en 6 familles : les 6M. Une cause par ligne.')}>
        <EdTable head={[t('Problème (la tête du poisson)')]} rows={[[<Cell type="text" label={t('Problème (la tête du poisson)')} value={I.problem} onChange={(v) => d.upd(['ishikawa', 'problem'], v)} />]]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 10, marginTop: 10 }}>
          {SIXK.map((k) => (
            <div key={k}><label className="small" style={{ display: 'block', fontWeight: 700 }}>{names[k]}</label><TextLines label={t('Causes : {c}', { c: names[k] })} rows={4} lines={I.causes[k] || []} onChange={(l) => d.upd(['ishikawa', 'causes', k], l)} /></div>
          ))}
        </div>
      </Setup>
      <Card title={t('Diagramme d\'Ishikawa')} subtitle={t('Le problème est à la tête ; chaque arête porte une famille de causes.')}>
        {total ? <Fish problem={I.problem} causes={I.causes} /> : <EmptyState icon="chart" title={t('Pas encore de causes')}>{t('Écrivez le problème puis au moins une cause dans une famille.')}</EmptyState>}
        {r.ishikawa && r.ishikawa.main ? <Conclusion>{t('La famille « {c} » compte le plus de causes ({n}) : c\'est une bonne piste pour commencer les vérifications.', { c: names[r.ishikawa.main], n: (r.ishikawa.counts.find((x) => x.category === r.ishikawa.main) || {}).n })}</Conclusion> : null}
      </Card>
    </>
  );
}

export default function SixSigma() {
  const t = useT();
  const d = useDoc('sixsigma');
  const [sub, setSub] = useState('dmaic');
  const r = d.result;
  return (
    <Doc d={d}>
      <Card title={t('Six Sigma')} subtitle={t('Réduire la variation et les défauts avec des faits : démarche DMAIC, cartes de contrôle, capabilité, Pareto et Ishikawa.')}>
        <Segmented label={t('Outils Six Sigma')} value={sub} onChange={setSub} items={SUBS(t)} />
        {r && r.projects && r.projects.length ? <div className="bp-kpis" style={{ marginTop: 10 }}><Kpi label={t('Projets DMAIC')} value={String(r.projects.length)} /><Kpi label={t('Avancement moyen')} value={Math.round(r.projects.reduce((a, p) => a + p.progress, 0) / r.projects.length) + ' %'} /></div> : null}
      </Card>
      <div style={{ margin: '12px 0' }}><CircuitNote>{t('Les défauts analysés ici (Pareto, causes) éclairent l\'avis « défauts » de l\'analyse du circuit : traitez d\'abord les causes vitales.')}</CircuitNote></div>
      {sub === 'dmaic' ? <Dmaic d={d} open={setSub} /> : null}
      {sub === 'charts' ? <Charts d={d} /> : null}
      {sub === 'capability' ? <Capability d={d} /> : null}
      {sub === 'pareto' ? <Pareto d={d} /> : null}
      {sub === 'ishikawa' ? <Ishikawa d={d} /> : null}
    </Doc>
  );
}
