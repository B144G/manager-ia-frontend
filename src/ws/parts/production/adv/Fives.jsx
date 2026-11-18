/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useState } from 'react';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart, Gauge, LineChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Pick, Remove, Setup, Sub, nextId, useDoc } from './common.jsx';
import { cut } from './flowCommon.jsx';

/* Production · 5S : audits par zone (note de 0 à 4 pour chaque S), radar, évolution, plan d'actions.
   Le serveur calcule les scores, la S la plus faible et les actions en retard (GET/PUT /production/adv/fives). */

const S5 = ['sort', 'set', 'shine', 'standardize', 'sustain'];
const SNAME = (t) => ({ sort: t('Trier'), set: t('Ranger'), shine: t('Nettoyer'), standardize: t('Standardiser'), sustain: t('Maintenir') });
/** Aide de lecture : une ligne par S. */
const HINT = (t) => ({
  sort: t('0 = tout est mélangé, 4 = il ne reste que le nécessaire'),
  set: t('0 = on cherche tout, 4 = chaque chose a sa place marquée'),
  shine: t('0 = sale, 4 = propre et la saleté est traitée à la source'),
  standardize: t('0 = aucune règle, 4 = règles visuelles connues de tous'),
  sustain: t('0 = on a abandonné, 4 = audits réguliers et habitude installée'),
});
const SUGGEST = (t) => ({
  sort: t('Poser des étiquettes rouges sur tout ce dont on doute, puis jeter ou ranger ailleurs ce qui est inutile'),
  set: t('Marquer un emplacement pour chaque outil et chaque objet (traçage au sol, silhouettes, étiquettes)'),
  shine: t('Nettoyer la zone chaque jour avant de partir et chercher la source de la saleté'),
  standardize: t('Afficher des standards visuels : photo de la zone « comme elle doit être », codes couleur, consignes'),
  sustain: t('Planifier des audits réguliers (chaque semaine ou chaque mois) et afficher les résultats à tous'),
});
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Réduit une photo choisie par l'utilisateur : ~800 px de large, JPEG qualité 0,7, texte < 400000 caractères. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      try {
        for (const w of [800, 640, 480, 320]) {
          const c = document.createElement('canvas'); const k = Math.min(1, w / img.width);
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const out = c.toDataURL('image/jpeg', 0.7);
          if (out.length < 400000) { URL.revokeObjectURL(url); resolve(out); return; }
        }
        URL.revokeObjectURL(url); reject(new Error('size'));
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

/** Radar à 5 axes : dernier audit (plein), audit précédent (pointillé), cible 4 (gris). */
function Radar({ last, prev, title }) {
  const t = useT();
  const names = SNAME(t);
  const C = 150; const R = 92;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [C + R * v / 4 * Math.cos(a), C + R * v / 4 * Math.sin(a)]; };
  const poly = (sc) => S5.map((k, i) => pt(i, sc[k]).map((n) => n.toFixed(1)).join(',')).join(' ');
  const target = { sort: 4, set: 4, shine: 4, standardize: 4, sustain: 4 };
  return (
    <div style={{ maxWidth: 320 }}>
      <svg viewBox="0 0 300 300" width="100%" role="img" aria-label={title}>
        <title>{title}</title>
        {[1, 2, 3, 4].map((v) => <polygon key={v} points={poly({ sort: v, set: v, shine: v, standardize: v, sustain: v })} fill="none" stroke="var(--line)" strokeWidth="1" />)}
        {S5.map((k, i) => { const [x, y] = pt(i, 4); const [lx, ly] = pt(i, 4.9); return <g key={k}><line x1={C} y1={C} x2={x} y2={y} stroke="var(--line)" /><text x={lx} y={ly + 4} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--fg)' }}>{names[k]}</text></g>; })}
        <polygon points={poly(target)} fill="none" stroke="var(--plan)" strokeWidth="1.6" strokeDasharray="3 3" />
        {prev ? <polygon points={poly(prev)} fill="none" stroke="var(--s2)" strokeWidth="2" strokeDasharray="6 4" /> : null}
        <polygon points={poly(last)} fill="color-mix(in srgb, var(--s1) 22%, transparent)" stroke="var(--s1)" strokeWidth="2.4" />
        {S5.map((k, i) => { const [x, y] = pt(i, last[k]); return <circle key={k} cx={x} cy={y} r="3.5" fill="var(--s1)" stroke="var(--surface)" strokeWidth="1.5" />; })}
      </svg>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
        <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--s1)', marginRight: 5, verticalAlign: -1 }} aria-hidden="true" />{t('Dernier audit')}</span>
        {prev ? <span><i style={{ display: 'inline-block', width: 12, height: 0, borderTop: '2px dashed var(--s2)', marginRight: 5, verticalAlign: 3 }} aria-hidden="true" />{t('Audit précédent')}</span> : null}
        <span><i style={{ display: 'inline-block', width: 12, height: 0, borderTop: '2px dashed var(--plan)', marginRight: 5, verticalAlign: 3 }} aria-hidden="true" />{t('Cible : 4')}</span>
      </div>
    </div>
  );
}

function AuditForm({ onAdd }) {
  const t = useT();
  const names = SNAME(t); const hints = HINT(t);
  const [f, setF] = useState(() => ({ date: todayIso(), scores: { sort: '2', set: '2', shine: '2', standardize: '2', sustain: '2' }, note: '', photos: [] }));
  const [err, setErr] = useState('');
  const addPhoto = (file) => {
    if (!file) return;
    setErr('');
    shrink(file).then((url) => setF((o) => ({ ...o, photos: o.photos.concat([url]).slice(0, 2) }))).catch(() => setErr(t('Cette photo ne peut pas être utilisée. Essayez une autre image.')));
  };
  const submit = () => {
    if (!f.date) { setErr(t('Choisissez la date de l\'audit.')); return; }
    onAdd({ date: f.date, note: f.note, scores: Object.fromEntries(S5.map((k) => [k, Number(f.scores[k])])), photos: f.photos });
    setF({ date: todayIso(), scores: { sort: '2', set: '2', shine: '2', standardize: '2', sustain: '2' }, note: '', photos: [] }); setErr('');
  };
  return (
    <details style={{ margin: '8px 0' }}>
      <summary style={{ cursor: 'pointer', minHeight: 36, fontWeight: 700 }}>{t('Nouvel audit')}</summary>
      <div className="ro-scroll"><table className="ro-ed" style={{ maxWidth: 560 }}>
        <thead><tr><th>{t('Date de l\'audit')}</th></tr></thead>
        <tbody><tr><td><Cell type="date" label={t('Date de l\'audit')} value={f.date} onChange={(v) => setF((o) => ({ ...o, date: v }))} /></td></tr></tbody>
      </table></div>
      <div style={{ display: 'grid', gap: 6, margin: '8px 0' }}>
        {S5.map((k) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,160px) 80px 1fr', gap: 8, alignItems: 'center' }}>
            <b>{names[k]}</b>
            <Pick label={names[k]} value={f.scores[k]} onChange={(v) => setF((o) => ({ ...o, scores: { ...o.scores, [k]: v } }))} options={[0, 1, 2, 3, 4].map((n) => [String(n), String(n)])} />
            <small className="muted">{hints[k]}</small>
          </div>
        ))}
      </div>
      <div className="ro-scroll"><table className="ro-ed"><thead><tr><th>{t('Remarque')}</th></tr></thead><tbody><tr><td><Cell type="text" label={t('Remarque')} value={f.note} onChange={(v) => setF((o) => ({ ...o, note: v }))} /></td></tr></tbody></table></div>
      <div style={{ margin: '8px 0' }}>
        <label className="muted small" style={{ display: 'block' }}>{t('Photos (facultatif, 2 au maximum)')}</label>
        {f.photos.length < 2 ? <input type="file" accept="image/*" aria-label={t('Ajouter une photo')} onChange={(e) => { addPhoto(e.target.files && e.target.files[0]); e.target.value = ''; }} /> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {f.photos.map((p, i) => <span key={i}><img src={p} alt={t('Photo {n} de l\'audit', { n: i + 1 })} style={{ height: 70, borderRadius: 8, display: 'block' }} /><button className="link" type="button" onClick={() => setF((o) => ({ ...o, photos: o.photos.filter((_, k) => k !== i) }))}>{t('Retirer')}</button></span>)}
        </div>
      </div>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <Button size="sm" variant="primary" icon="plus" onClick={submit}>{t('Ajouter cet audit')}</Button>
      <p className="muted small">{t('L\'audit est ajouté à la zone : cliquez ensuite sur « Enregistrer et calculer » en bas de cette carte.')}</p>
    </details>
  );
}

function ZoneEditor({ d, z, i, rz }) {
  const t = useT();
  const names = SNAME(t); const sug = SUGGEST(t); const today = todayIso();
  const sOpts = S5.map((k) => [k, names[k]]);
  const addAction = (a) => d.set((o) => ({ ...o, zones: o.zones.map((x, n) => (n === i ? { ...x, actions: x.actions.concat([{ id: nextId(x.actions, 'a'), s: 'sort', text: '', owner: '', due: '', status: 'todo', ...a }]) } : x)) }));
  return (
    <Card flat title={z.name || t('Zone {n}', { n: i + 1 })} actions={<Remove onClick={() => d.set((o) => ({ ...o, zones: o.zones.filter((_, k) => k !== i) }))} />}>
      <EdTable head={[t('Nom de la zone')]} rows={[[<Cell type="text" label={t('Nom de la zone')} value={z.name} onChange={(v) => d.upd(['zones', i, 'name'], v)} />]]} />
      <p className="muted small">{t('{n} audit(s) enregistré(s) pour cette zone.', { n: z.audits.length })}</p>
      <AuditForm onAdd={(a) => d.set((o) => ({ ...o, zones: o.zones.map((x, n) => (n === i ? { ...x, audits: x.audits.concat([a]) } : x)) }))} />
      <Sub>{t('Plan d\'actions')}</Sub>
      <EdTable empty={t('Aucune action pour cette zone.')} head={[t('Action'), t('Pilier'), t('Responsable'), t('Échéance'), t('Statut'), '']}
        rows={z.actions.map((a, k) => {
          const late = a.status !== 'done' && a.due && a.due < today;
          return [
            <Cell type="text" label={t('Action')} value={a.text} onChange={(v) => d.upd(['zones', i, 'actions', k, 'text'], v)} />,
            <Pick label={t('Pilier')} value={a.s} onChange={(v) => d.upd(['zones', i, 'actions', k, 's'], v)} options={sOpts} />,
            <Cell type="text" label={t('Responsable')} value={a.owner} onChange={(v) => d.upd(['zones', i, 'actions', k, 'owner'], v)} />,
            <div><Cell type="date" label={t('Échéance')} value={a.due} onChange={(v) => d.upd(['zones', i, 'actions', k, 'due'], v)} />{late ? <Badge tone="danger">{t('en retard')}</Badge> : null}</div>,
            <Pick label={t('Statut')} value={a.status} onChange={(v) => d.upd(['zones', i, 'actions', k, 'status'], v)} options={[['todo', t('À faire')], ['doing', t('En cours')], ['done', t('Fait')]]} />,
            <Remove onClick={() => d.set((o) => ({ ...o, zones: o.zones.map((x, n) => (n === i ? { ...x, actions: x.actions.filter((_, m) => m !== k) } : x)) }))} />,
          ];
        })} />
      <Button size="sm" icon="plus" onClick={() => addAction({})}>{t('Ajouter une action')}</Button>
      {rz && rz.weakest ? (
        <div style={{ marginTop: 10 }}>
          <b className="small">{t('Action suggérée pour le pilier le plus faible ({s}) :', { s: names[rz.weakest] })}</b>
          <p style={{ margin: '4px 0' }}>{sug[rz.weakest]}</p>
          <Button size="sm" onClick={() => addAction({ s: rz.weakest, text: sug[rz.weakest] })}>{t('Ajouter cette action au plan')}</Button>
        </div>
      ) : null}
    </Card>
  );
}

function Editor({ d }) {
  const t = useT();
  return (
    <>
      <Sub>{t('Zones à auditer (atelier, magasin, bureau…)')}</Sub>
      {d.doc.zones.map((z, i) => <ZoneEditor key={z.id} d={d} z={z} i={i} rz={d.result ? d.result.zones.find((x) => x.id === z.id) : null} />)}
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, zones: o.zones.concat([{ id: nextId(o.zones, 'z'), name: '', audits: [], actions: [] }]) }))}>{t('Ajouter une zone')}</Button>
      <p className="muted small">{t('Les 5S : Trier, Ranger, Nettoyer, Standardiser, Maintenir. Chaque S est notée de 0 (très mauvais) à 4 (exemplaire).')}</p>
    </>
  );
}

function Result({ r, doc }) {
  const t = useT();
  const names = SNAME(t); const today = todayIso();
  const scored = r.zones.filter((z) => z.last);
  const docZone = new Map(doc.zones.map((z) => [z.id, z]));
  if (!scored.length) return <EmptyState icon="chart" title={t('Pas encore d\'audit')}>{t('Ajoutez un audit à une zone (note de 0 à 4 pour chaque S), puis enregistrez.')}</EmptyState>;
  return (
    <>
      <Conclusion>
        {t('Le score 5S moyen est de {p} %.', { p: r.average })}{' '}
        {r.weakestS ? t('Le pilier le plus faible est « {s} » (moyenne {n} sur 4) : c\'est là qu\'il faut agir en premier.', { s: names[r.weakestS.s], n: num(r.weakestS.avg, 1) }) : null}{' '}
        {r.lateActions ? t('{k} action(s) sont en retard.', { k: r.lateActions }) : null}
      </Conclusion>
      {r.unaudited.length ? <Alert tone="info" title={t('Zones sans audit')}>{r.unaudited.join(', ')}</Alert> : null}
      {r.lateActions ? <Alert tone="danger" title={t('Actions en retard')}>{r.zones.filter((z) => z.lateActions).map((z) => t('{z} : {k} action(s) en retard', { z: z.name, k: z.lateActions })).join(' · ')}</Alert> : null}
      <div className="bp-kpis">
        <Kpi label={t('Score 5S moyen')} value={r.average + ' %'} tone={r.average >= 80 ? 'good' : r.average >= 55 ? 'warn' : 'bad'} />
        <Kpi label={t('Zones auditées')} value={String(scored.length)} sub={t('sur {n}', { n: r.zones.length })} />
        <Kpi label={t('Pilier le plus faible')} value={r.weakestS ? names[r.weakestS.s] : '—'} sub={r.weakestS ? t('moyenne {n} sur 4', { n: num(r.weakestS.avg, 1) }) : undefined} tone="warn" />
        <Kpi label={t('Actions en retard')} value={String(r.lateActions)} tone={r.lateActions ? 'bad' : 'good'} />
      </div>
      <Card title={t('Comparaison des zones')} subtitle={t('Score 5S du dernier audit de chaque zone (100 % = note 4 partout).')}>
        <BarChart title={t('Score 5S par zone (%)')} labels={scored.map((z) => cut(z.name, 14))} fmt={(v) => num(v, 0) + ' %'} height={220} bars={[{ key: 'p', label: t('Score 5S'), values: scored.map((z) => z.last.pct), color: 's1' }]} />
      </Card>
      <div className="bp-grid2 bp-sec">
        {scored.map((z) => {
          const dz = docZone.get(z.id); const la = dz && dz.audits.length ? dz.audits[dz.audits.length - 1] : null;
          const late = z.actions.filter((a) => a.status !== 'done' && a.due && a.due < today);
          return (
            <Card key={z.id} title={z.name} subtitle={t('Dernier audit : {d}', { d: z.last.date })} actions={<Badge tone={z.level === 'good' ? 'ok' : z.level === 'fair' ? 'warn' : 'danger'}>{z.level === 'good' ? t('bon') : z.level === 'fair' ? t('moyen') : t('à redresser')}</Badge>}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <Radar last={z.last.scores} prev={z.previous ? z.previous.scores : null} title={t('Radar 5S : {name}', { name: z.name })} />
                <div style={{ width: 200 }}><Gauge value={z.last.pct} label={t('Score 5S')} sub={z.delta === null ? undefined : (z.delta >= 0 ? '+' : '') + z.delta + ' ' + t('points depuis l\'audit précédent')} tone={z.level === 'good' ? '' : z.level === 'fair' ? 'warn' : 'bad'} /></div>
              </div>
              <p>{z.weakest ? t('Pilier le plus faible : {s} ({n} sur 4).', { s: names[z.weakest], n: z.last.scores[z.weakest] }) : null}</p>
              {z.last.note ? <p className="muted">{z.last.note}</p> : null}
              {la && la.photos.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{la.photos.map((p, i) => <img key={i} src={p} alt={t('Photo {n} de l\'audit', { n: i + 1 })} style={{ height: 90, borderRadius: 8 }} />)}</div> : null}
              {z.trend.length > 1 ? <LineChart title={t('Évolution du score 5S : {name}', { name: z.name })} labels={z.trend.map((x) => x.date)} fmt={(v) => num(v, 0) + ' %'} height={190} series={[{ key: 'p', label: t('Score 5S'), values: z.trend.map((x) => x.pct), color: 's1' }]} /> : <p className="muted small">{t('Faites un deuxième audit pour voir l\'évolution dans le temps.')}</p>}
              <p className="small"><b>{t('Actions : {o} ouverte(s)', { o: z.openActions })}</b>{late.length ? <> · <span className="ro-neg">{t('{k} en retard', { k: late.length })}</span></> : null}</p>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default function Fives() {
  const t = useT();
  const d = useDoc('fives');
  return (
    <Doc d={d}>
      <Setup d={d} title={t('5S')} subtitle={t('Un atelier propre, rangé et discipliné : auditez chaque zone, voyez où se trouve le point faible et suivez les actions.')}>
        <Editor d={d} />
      </Setup>
      {d.result ? <Result r={d.result} doc={d.doc} /> : null}
    </Doc>
  );
}
