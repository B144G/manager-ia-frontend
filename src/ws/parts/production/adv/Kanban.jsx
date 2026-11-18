/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useState } from 'react';
import { useWs } from '../../../WsContext.jsx';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Pick, Remove, Setup, Sub, nextId, useDoc } from './common.jsx';
import { cut } from './flowCommon.jsx';

/* Production · kanban : nombre de cartes par article, tableau à cartes (à produire / en production / prêt) et signaux de réapprovisionnement.
   Le serveur calcule (GET/PUT /production/adv/kanban) ; l'import du stock (lecture seule) ne fait que proposer des articles. */

const blank = (id) => ({ id, name: '', source: 'make', demandPerDay: '', leadTimeDays: '', waitDays: '', containerQty: 1, safetyPct: 10, onHand: '', inProd: '', cards: '' });

function Importer({ d, close }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const [list, setList] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); oapi('GET', '/production/adv/import/stock').then((j) => setList(j.stock || [])).catch(fail).finally(() => setBusy(false)); };
  const add = () => {
    d.set((o) => {
      const items = o.items.map((x) => ({ ...x })); const have = new Map(items.map((x) => [x.name.toLowerCase(), x]));
      (list || []).filter((s) => pick[s.id]).forEach((s) => {
        const ex = have.get(String(s.name).toLowerCase());
        if (ex) ex.onHand = s.onHand;
        else items.push({ ...blank(nextId(items, 'k')), name: s.name, source: 'buy', onHand: s.onHand });
      });
      return { ...o, items };
    });
    close();
  };
  return (
    <Card flat title={t('Pré-remplir depuis le stock')} subtitle={t('Choisissez des articles du module Stock : leur quantité en stock est reprise. Rien n\'est modifié dans le stock.')}>
      {list === null ? <Button loading={busy} onClick={load}>{t('Afficher les articles en stock')}</Button> : !list.length ? <p className="muted small">{t('Aucun article en stock.')}</p> : (
        <>
          <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 2 }}>
            {list.map((s) => <label key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 40 }}><input type="checkbox" style={{ width: 22, height: 22 }} checked={Boolean(pick[s.id])} onChange={(e) => setPick((o) => ({ ...o, [s.id]: e.target.checked }))} /><span><b>{s.name}</b> <small className="muted">{t('{q} {u} en stock', { q: num(s.onHand, 2), u: s.unit || '' })}</small></span></label>)}
          </div>
          <div className="row" style={{ marginTop: 8 }}><Button variant="primary" onClick={add} disabled={!Object.values(pick).some(Boolean)}>{t('Ajouter à la liste')}</Button></div>
        </>
      )}
      <div style={{ marginTop: 6 }}><button className="link" type="button" onClick={close}>{t('Fermer')}</button></div>
    </Card>
  );
}

function Editor({ d }) {
  const t = useT();
  const doc = d.doc;
  const [imp, setImp] = useState(false);
  return (
    <>
      <Sub>{t('Articles pilotés par kanban')}</Sub>
      <EdTable empty={t('Aucun article. Ajoutez un article fabriqué ou acheté.')}
        head={[t('Article'), t('Origine'), t('Demande par jour'), t('Délai (jours)'), t('Attente (jours)'), t('Quantité par bac'), t('Sécurité (%)'), t('Stock'), t('Cartes en production'), t('Nombre de cartes imposé (facultatif)'), '']}
        rows={doc.items.map((it, i) => [
          <Cell type="text" label={t('Article')} value={it.name} onChange={(v) => d.upd(['items', i, 'name'], v)} />,
          <Pick label={t('Origine')} value={it.source} onChange={(v) => d.upd(['items', i, 'source'], v)} options={[['make', t('Fabriqué')], ['buy', t('Acheté')]]} />,
          <Cell label={t('Demande par jour')} value={it.demandPerDay} onChange={(v) => d.upd(['items', i, 'demandPerDay'], v)} />,
          <Cell label={t('Délai (jours)')} value={it.leadTimeDays} onChange={(v) => d.upd(['items', i, 'leadTimeDays'], v)} />,
          <Cell label={t('Attente (jours)')} value={it.waitDays} onChange={(v) => d.upd(['items', i, 'waitDays'], v)} />,
          <Cell label={t('Quantité par bac')} value={it.containerQty} onChange={(v) => d.upd(['items', i, 'containerQty'], v)} />,
          <Cell label={t('Sécurité (%)')} value={it.safetyPct} onChange={(v) => d.upd(['items', i, 'safetyPct'], v)} />,
          <Cell label={t('Stock')} value={it.onHand} onChange={(v) => d.upd(['items', i, 'onHand'], v)} />,
          <Cell label={t('Cartes en production')} step="1" value={it.inProd} onChange={(v) => d.upd(['items', i, 'inProd'], v)} />,
          <Cell label={t('Nombre de cartes imposé (facultatif)')} step="1" value={it.cards} onChange={(v) => d.upd(['items', i, 'cards'], v)} />,
          <Remove onClick={() => d.set((o) => ({ ...o, items: o.items.filter((_, k) => k !== i) }))} />,
        ])} />
      <div className="row">
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, items: o.items.concat([blank(nextId(o.items, 'k'))]) }))}>{t('Ajouter un article')}</Button>
        <Button size="sm" onClick={() => setImp(true)}>{t('Pré-remplir depuis le stock')}</Button>
      </div>
      {imp ? <div style={{ marginTop: 10 }}><Importer d={d} close={() => setImp(false)} /></div> : null}
      <p className="muted small">{t('Délai : temps pour refaire un bac (fabrication ou livraison). Attente : temps perdu avant de commencer. Sécurité : marge pour les imprévus. Laissez le nombre de cartes vide pour le faire calculer.')}</p>
    </>
  );
}

const SIG = (t) => ({ refill: ['red', t('À réapprovisionner')], watch: ['amber', t('À surveiller')], ok: ['green', t('Suffisant')] });
const BOX = { display: 'inline-block', width: 22, height: 30, borderRadius: 4, margin: 2, boxSizing: 'border-box' };

/** Rangée de petites cartes : n cartes de style `st`, au plus 24 dessinées puis « +k ». */
function Cards({ n, st, label }) {
  const shown = Math.min(n, 24);
  return (
    <div role="img" aria-label={label} title={label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', minHeight: 34 }}>
      {Array.from({ length: shown }, (_, i) => <span key={i} style={{ ...BOX, ...st }} />)}
      {n > shown ? <b className="muted small">+{n - shown}</b> : null}
      {n === 0 ? <span className="muted small">—</span> : null}
    </div>
  );
}

function Board({ r }) {
  const t = useT();
  const empty = { border: '2px dashed var(--pink)', background: 'color-mix(in srgb, var(--pink) 12%, var(--surface))' };
  const prod = { border: '2px solid var(--signal)', background: 'color-mix(in srgb, var(--signal) 30%, var(--surface))' };
  const full = { border: '2px solid var(--s3)', background: 'color-mix(in srgb, var(--s3) 40%, var(--surface))' };
  const head = (txt, col) => <div style={{ padding: '8px 10px', fontWeight: 800, fontSize: 13, borderBottom: `3px solid ${col}`, background: 'var(--surface2)' }}>{txt}</div>;
  return (
    <div className="ro-scroll"><div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) repeat(3, minmax(150px,2fr))', minWidth: 640, border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }} role="table" aria-label={t('Tableau kanban')}>
      <div style={{ background: 'var(--surface2)', borderBottom: '3px solid var(--line)', padding: '8px 10px', fontWeight: 800, fontSize: 13 }}>{t('Article')}</div>
      {head(t('À produire (cartes vides)'), 'var(--pink)')}
      {head(t('En production'), 'var(--signal)')}
      {head(t('Prêt (cartes pleines)'), 'var(--s3)')}
      {r.items.map((it) => (
        <div key={it.id} style={{ display: 'contents' }}>
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--line)' }}><b>{cut(it.name, 24)}</b><br /><small className="muted">{t('{n} carte(s) de {q}', { n: it.cards, q: num(it.containerQty, 2) })}</small></div>
          <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)', background: it.empty > 0 ? 'color-mix(in srgb, var(--pink) 6%, transparent)' : undefined }}>
            <Cards n={it.empty} st={empty} label={t('{n} carte(s) vide(s) : {name}', { n: it.empty, name: it.name })} />
            {it.empty > 0 ? <b style={{ color: 'var(--pink)', fontSize: 13 }}>{it.source === 'buy' ? t('À commander : {q}', { q: num(it.refillQty, 2) }) : t('À produire : {q}', { q: num(it.refillQty, 2) })}</b> : null}
          </div>
          <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)' }}><Cards n={it.inProd} st={prod} label={t('{n} carte(s) en production : {name}', { n: it.inProd, name: it.name })} /></div>
          <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)' }}><Cards n={it.full} st={full} label={t('{n} carte(s) pleine(s) : {name}', { n: it.full, name: it.name })} /></div>
        </div>
      ))}
    </div></div>
  );
}

function Result({ r, doc }) {
  const t = useT();
  const sig = SIG(t);
  const byId = new Map(doc.items.map((x) => [x.id, x]));
  return (
    <>
      <Conclusion>
        {t('Le système compte {n} carte(s) kanban au total pour {k} article(s).', { n: r.totalCards, k: r.items.length })}{' '}
        {r.refill.length ? t('{k} article(s) ont des cartes vides : il faut produire ou commander maintenant (voir le tableau).', { k: r.refill.length }) : t('Aucune carte vide : rien à réapprovisionner pour le moment.')}
      </Conclusion>
      {r.refill.length ? (
        <Alert tone="danger" title={t('Signaux de réapprovisionnement')}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{r.refill.map((it) => <li key={it.id}><b>{it.name}</b> : {it.source === 'buy' ? t('commander {q} ({n} carte(s) vide(s))', { q: num(it.refillQty, 2), n: it.empty }) : t('produire {q} ({n} carte(s) vide(s))', { q: num(it.refillQty, 2), n: it.empty })}</li>)}</ul>
        </Alert>
      ) : null}
      <div className="bp-kpis">
        <Kpi label={t('Cartes en circulation')} value={String(r.totalCards)} />
        <Kpi label={t('Articles à réapprovisionner')} value={String(r.refill.length)} tone={r.refill.length ? 'bad' : 'good'} />
        <Kpi label={t('Articles à surveiller')} value={String(r.items.filter((x) => x.signal === 'watch').length)} tone={r.items.some((x) => x.signal === 'watch') ? 'warn' : 'good'} />
      </div>
      <Card title={t('Tableau kanban')} subtitle={t('Une carte vide = un bac consommé, à refaire ou à commander. Une carte en production est en cours de refabrication. Une carte pleine = un bac prêt.')}><Board r={r} /></Card>
      <Card title={t('Nombre de cartes et points de commande')} subtitle={t('Nombre de cartes = demande par jour × (délai + attente) × (1 + sécurité) ÷ quantité par bac, arrondi au-dessus.')}>
        <div className="bp-scroll"><table className="bp-table">
          <thead><tr><th>{t('Article')}</th><th>{t('Calcul')}</th><th>{t('Cartes')}</th><th>{t('Point de commande')}</th><th>{t('Stock')}</th><th>{t('Couverture (jours)')}</th><th>{t('Signal')}</th></tr></thead>
          <tbody>{r.items.map((it) => {
            const x = byId.get(it.id) || {}; const s = sig[it.signal];
            return (
              <tr key={it.id}>
                <td><b>{it.name}</b><br /><small className="muted">{it.source === 'buy' ? t('Acheté') : t('Fabriqué')}</small></td>
                <td><small>{t('{d} par jour × ({l} + {w}) jours × {s} ÷ {q} = {c} carte(s)', { d: num(x.demandPerDay, 2), l: num(x.leadTimeDays, 1), w: num(x.waitDays, 1), s: num(1 + (Number(x.safetyPct) || 0) / 100, 2), q: num(it.containerQty, 2), c: it.cardsComputed })}</small>{it.cards !== it.cardsComputed ? <><br /><small className="muted">{t('Nombre imposé : {n}', { n: it.cards })}</small></> : null}</td>
                <td><b>{it.cards}</b></td>
                <td>{t('{q} (quand le stock descend à ce niveau, lancer la commande)', { q: num(it.reorderPoint, 1) })}</td>
                <td>{num(it.onHand, 1)}</td>
                <td>{it.coverDays === null ? '—' : num(it.coverDays, 1)}</td>
                <td><span className={'bp-st ' + s[0]}>{s[1]}</span></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
      <Card title={t('Répartition des cartes')} subtitle={t('Pour chaque article : cartes pleines, en production et vides.')}>
        <BarChart title={t('Cartes pleines, en production et vides par article')} labels={r.items.map((x) => cut(x.name, 12))} fmt={(v) => num(v, 0)} height={230}
          bars={[{ key: 'f', label: t('Pleines'), values: r.items.map((x) => x.full), color: 's3', stack: 'c' }, { key: 'p', label: t('En production'), values: r.items.map((x) => x.inProd), color: 's1', stack: 'c' }, { key: 'e', label: t('Vides'), values: r.items.map((x) => x.empty), color: 's2', stack: 'c' }]} />
      </Card>
      <Badge tone="neutral">{t('Le signal passe en « à surveiller » quand il reste un quart des cartes pleines ou moins.')}</Badge>
    </>
  );
}

export default function Kanban() {
  const t = useT();
  const d = useDoc('kanban');
  return (
    <Doc d={d}>
      <Setup d={d} title={t('Kanban')} subtitle={t('Combien de cartes (bacs) faire circuler pour ne jamais manquer, sans surstocker, et que produire ou commander maintenant.')}>
        <Editor d={d} />
      </Setup>
      {d.result && d.result.items.length ? <Result r={d.result} doc={d.doc} /> : <EmptyState icon="chart" title={t('Pas encore d\'article')}>{t('Ajoutez au moins un article avec sa demande et son délai, puis enregistrez.')}</EmptyState>}
    </Doc>
  );
}
