import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Bars } from '../../charts/lazy.jsx';
import { Alert, Card, ChartFrame, Field, Stat, useLoad } from '../../ui.jsx';
import { Failed, num, pct, useCp } from './common.jsx';

/* Simulateur de prix : que deviennent le volume, le chiffre d'affaires et la marge si l'on change le prix (selon l'élasticité) ? */

export default function Simulator() {
  const t = useT();
  const { api } = useCp();
  const { money } = useWs();
  const items = useLoad(() => api('GET', '/pricing/items'), []);
  const [id, setId] = useState('');
  const [price, setPrice] = useState('');
  const [elast, setElast] = useState('');
  const [days, setDays] = useState('90');
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!id || num(price) <= 0) return undefined;
    const h = setTimeout(() => {
      api('POST', '/pricing/simulate', { itemId: Number(id), newPrice: num(price), elasticity: elast === '' ? undefined : num(elast), days: num(days) }).then((j) => { setR(j); setErr(''); }, (e) => setErr(e.message));
    }, 350);
    return () => clearTimeout(h);
  }, [id, price, elast, days, api]);
  const pick = (v) => { setId(v); setR(null); const it = items.data && items.data.items.find((x) => String(x.id) === v); setPrice(it ? String(it.price) : ''); };
  const base = r ? r.basePrice : num(price);
  const min = base ? Math.round(base * 0.5) : 0; const max = base ? Math.round(base * 1.5) : 0;
  return (
    <div className="cp-stack">
      <Card title={t('Simulateur de prix')} subtitle={t("Estimation d'après les ventes passées : le volume varie avec le prix selon l'élasticité. Ce n'est pas une promesse.")}>
        {items.error ? <Failed e={items.error} /> : null}
        <div className="cp-grid">
          <Field label={t('Article')}>{(p) => <select {...p} value={id} onChange={(e) => pick(e.target.value)}><option value="">{t('Choisir…')}</option>{items.data ? items.data.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>) : null}</select>}</Field>
          <Field label={t('Nouveau prix')}>{(p) => <input {...p} type="text" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
          <Field label={t('Élasticité')} hint={t('Vide : valeur de la politique tarifaire.')}>{(p) => <input {...p} type="text" inputMode="decimal" value={elast} onChange={(e) => setElast(e.target.value)} />}</Field>
          <Field label={t('Ventes observées (jours)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />}</Field>
        </div>
        {base ? <Field label={t('Faire varier le prix')}>{(p) => <input {...p} type="range" min={min} max={max} step={Math.max(1, Math.round(base / 100))} value={num(price) || base} onChange={(e) => setPrice(e.target.value)} />}</Field> : null}
        {err ? <p className="ws-err" role="alert">{err}</p> : null}
      </Card>
      {r ? (
        <Card title={t('Résultat de la simulation')}>
          {r.belowFloor ? <Alert tone="danger">{t('Ce prix est sous le plancher de l’article ({f}).', { f: money(r.floor) })}</Alert> : null}
          {!r.costKnown ? <Alert tone="warn">{t("Le coût de cet article est inconnu : la marge est calculée comme si le coût était nul.")}</Alert> : null}
          <div className="ui-stats">
            <Stat label={t('Variation du prix')} value={pct(r.priceChangePct)} icon="percent" />
            <Stat label={t('Variation du volume')} value={pct(r.volumeChangePct)} sub={t('Élasticité : {e}', { e: r.elasticity })} icon="boxes-stacked" tone={r.volumeChangePct < 0 ? 'warn' : 'ok'} />
            <Stat label={t("Écart de chiffre d'affaires")} value={money(r.deltaRevenue)} icon="coins" tone={r.deltaRevenue >= 0 ? 'ok' : 'danger'} />
            <Stat label={t('Écart de marge')} value={money(r.deltaMargin)} icon="arrow-trend-up" tone={r.deltaMargin >= 0 ? 'ok' : 'danger'} />
            <Stat label={t('Point mort')} value={r.breakEvenQty === null ? '—' : r.breakEvenQty} sub={r.breakEvenVolumePct === null ? t('Marge unitaire nulle ou négative') : t('Volume à tenir : {p} par rapport à aujourd’hui', { p: pct(r.breakEvenVolumePct) })} icon="bullseye" />
          </div>
          <ChartFrame title={t('Avant / après')} summary={t('Chiffre d’affaires : {a} puis {b}. Marge : {c} puis {d}.', { a: money(r.base.revenue), b: money(r.simulated.revenue), c: money(r.base.margin), d: money(r.simulated.margin) })} height={240}
            legend={[{ label: t('Aujourd’hui'), color: 'var(--c8)' }, { label: t('Simulé'), color: 'var(--c1)' }]}>
            <Bars data={[{ x: t("Chiffre d'affaires"), now: r.base.revenue, sim: r.simulated.revenue }, { x: t('Marge'), now: r.base.margin, sim: r.simulated.margin }]} series={[{ key: 'now', label: t('Aujourd’hui'), color: 'var(--c8)' }, { key: 'sim', label: t('Simulé'), color: 'var(--c1)' }]} fmt={money} height={240} /></ChartFrame>
          <p className="small muted">{t('Base : {q} unités vendues à {p} sur {n} jours.', { q: r.base.qty, p: money(r.basePrice), n: r.days })}</p>
        </Card>
      ) : null}
    </div>
  );
}
