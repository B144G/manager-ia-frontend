import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { CsvButton, Kpis, Seg, Tag, WMS, qty, useDate } from './kit.jsx';

/* États du stock : valorisation par emplacement, rotation, ruptures, vieillissement, journal des mouvements. Chacun s'exporte en CSV. */
function Valuation() {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/reports/valuation'), []);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Kpis list={[{ label: t('valeur du stock (celle de la comptabilité)'), value: money(j.totalValue) }, ...j.warehouses.map((w) => ({ label: w.name, value: money(w.value) }))]} />
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Par emplacement')}</h2><CsvButton path="/reports/valuation" name="valorisation-stock" /></div>
          {!j.locations.length ? <Empty text={t('Aucun stock.')} /> : null}
          {j.locations.map((l) => <div className="line" key={l.id}><span><b>{l.name}</b><small>{' ' + qty(l.quantity)}</small></span><b>{money(l.value)}</b></div>)}
        </div>
        <div className="ws-card">
          <h2>{t('Par article et emplacement')}</h2>
          {j.lines.slice(0, 200).map((l, i) => <div className="line" key={i}><span><b>{l.item}</b><small>{' ' + l.location + ' · ' + qty(l.quantity) + ' ' + l.unit + ' × ' + money(l.unitValue)}</small></span><b>{money(l.value)}</b></div>)}
        </div>
      </>
    )}
    </Loaded>
  );
}
function Rotation() {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/reports/rotation'), []);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Kpis list={[{ label: t('articles dormants (sans sortie)'), value: String(j.dormant), bad: j.dormant > 0 }, { label: t('valeur immobilisée'), value: money(j.dormantValue) }]} />
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Rotation sur {n} jours', { n: j.days })}</h2><CsvButton path="/reports/rotation" name="rotation-stock" /></div>
          {j.items.map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b> {x.status === 'dormant' ? <Tag tone="bad">{t('dormant')}</Tag> : x.status === 'slow' ? <Tag tone="mid">{t('lent')}</Tag> : null}<small>{' ' + t('{n} sortis', { n: qty(x.consumedQty) }) + (x.coverDays !== null ? ' · ' + t('couverture {d} j', { d: qty(x.coverDays) }) : '')}</small></span><span><b>{x.turnover === null ? '—' : t('{n} tours/an', { n: qty(x.turnover) })}</b><small>{' ' + money(x.stockValue)}</small></span></div>)}
        </div>
      </>
    )}
    </Loaded>
  );
}
function Stockouts() {
  const t = useT();
  const { oapi, money } = useWs();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/reports/stockouts'), []);
  const TONE = { out: 'bad', short: 'bad', unavailable: 'mid', low: 'mid' };
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Kpis list={[{ label: t('en rupture'), value: String(j.counts.out), bad: j.counts.out > 0 }, { label: t('réservations non couvertes'), value: String(j.counts.short), bad: j.counts.short > 0 }, { label: t('sous le seuil'), value: String(j.counts.low) }]} />
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Ruptures et alertes')}</h2><CsvButton path="/reports/stockouts" name="ruptures-stock" /></div>
          {!j.items.length ? <Empty text={t('Aucune rupture.')} /> : null}
          {j.items.map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b> <Tag tone={TONE[x.kind]}>{t(x.kindLabel)}</Tag><small>{' ' + t('en stock {a}, réservé {b}, disponible {c}', { a: qty(x.quantity), b: qty(x.reserved), c: qty(x.available) }) + (x.lastMovement ? ' · ' + t('dernier mouvement {d}', { d: date(x.lastMovement) }) : '')}</small></span>{x.value !== undefined ? <small>{money(x.value)}</small> : null}</div>)}
        </div>
      </>
    )}
    </Loaded>
  );
}
function Aging() {
  const t = useT();
  const { oapi, money } = useWs();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/reports/aging'), []);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Kpis list={j.buckets.map((b) => ({ label: t(b.label), value: money(b.value) }))} />
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Âge du stock')}</h2><CsvButton path="/reports/aging" name="vieillissement-stock" /></div>
          <p className="muted small">{t("Les entrées les plus récentes couvrent le stock d'abord : ce qui reste est le plus ancien.")}</p>
          {j.items.map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b><small>{' ' + qty(x.quantity) + (x.oldestEntry ? ' · ' + t('plus ancienne entrée {d}', { d: date(x.oldestEntry) }) : '')}</small></span><span><small>{x.buckets.filter((b) => b.quantity > 0).map((b) => t(b.label) + ' : ' + qty(b.quantity)).join(' · ') + ' '}</small><b>{money(x.stockValue)}</b></span></div>)}
        </div>
      </>
    )}
    </Loaded>
  );
}
function Moves() {
  const t = useT();
  const { oapi, money } = useWs();
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const q = '?limit=200' + (kind ? '&kind=' + kind : '') + (from ? '&from=' + from : '');
  const st = useLoad(() => oapi('GET', WMS + '/reports/moves' + q), [kind, from]);
  return (
    <>
      <div className="row wms-toolbar">
        <label className="fld" style={{ maxWidth: 200 }}><span>{t('Depuis le')}</span><input type="date" style={{ fontSize: 16 }} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <CsvButton path={'/reports/moves' + q} name="journal-mouvements" />
      </div>
      <Seg tabs={[['', t('Tout')], ['in', t('Entrées')], ['out', t('Sorties')], ['internal', t('Déplacements')]]} value={kind} onChange={setKind} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.moves.length ? <Empty text={t('Aucun mouvement.')} /> : null}
          {j.moves.map((m) => (
            <div className="line" key={m.key}>
              <span><b>{m.item}</b> <Tag tone={m.type === 'in' ? 'good' : m.type === 'out' ? 'bad' : 'mid'}>{t(m.label)}</Tag>
                <small>{' ' + m.at.replace('T', ' ').slice(0, 16) + (m.from || m.to ? ' · ' + (m.from || '') + (m.from && m.to ? ' → ' : '') + (m.to || '') : '') + (m.document ? ' · ' + t(m.document) : '') + (m.reason ? ' · ' + m.reason : '') + (m.by ? ' · ' + m.by : '')}</small></span>
              <span><b>{(m.type === 'out' ? '−' : m.type === 'in' ? '+' : '') + qty(Math.abs(m.quantity))}</b>{m.value !== undefined ? <small>{' ' + money(m.value)}</small> : null}</span>
            </div>
          ))}
        </div>
      )}
      </Loaded>
    </>
  );
}

export default function Reports({ part = 'valuation' }) {
  const C = { valuation: Valuation, rotation: Rotation, stockouts: Stockouts, aging: Aging, moves: Moves }[part] || Valuation;
  return <C />;
}
