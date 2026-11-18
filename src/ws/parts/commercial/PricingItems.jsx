import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Combo } from '../../charts/lazy.jsx';
import { Alert, Badge, Button, Card, ChartFrame, Field, Loading, Table, useLoad } from '../../ui.jsx';
import { Failed, fmtDT, num, pct, qs, useCp, useForm } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Articles et coûts, prix proposé (liste de prix, palier, prix négocié, plancher) et historique des prix. */

function CostForm({ it, close, onSaved }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ cost: it.cost !== null && it.costSource === 'catalog' ? String(it.cost) : '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { await api('PUT', '/pricing/costs/' + it.id, { cost: f.v.cost === '' ? 0 : num(f.v.cost) }); close(); onSaved(); }); }}>
      <p>{t("Coût de revient unitaire de « {nom} ». Vide : le coût du stock et des achats sera utilisé s'il existe.", { nom: it.name })}</p>
      <Field label={t('Coût unitaire')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.cost} onChange={f.set('cost')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function Resolver({ items }) {
  const t = useT();
  const L3 = useL3();
  const { api, fail } = useCp();
  const { money } = useWs();
  const accounts = useLoad(() => api('GET', '/accounts?limit=500'), []);
  const f = useForm({ itemId: '', customerId: '', quantity: '1', channel: 'all' });
  const [r, setR] = useState(null);
  const go = (e) => { e.preventDefault(); if (!f.v.itemId) { f.setErr(t('Choisissez un article.')); return; } f.setErr(''); api('GET', '/pricing/resolve' + qs({ itemId: f.v.itemId, customerId: f.v.customerId, quantity: num(f.v.quantity) || 1, channel: f.v.channel })).then(setR, fail); };
  return (
    <Card title={t('Prix proposé')} subtitle={t('Le meilleur prix selon la liste, le palier de quantité, le prix négocié et les listes de prix, sans descendre sous le plancher.')}>
      <form className="ws-form" noValidate onSubmit={go}>
        <div className="cp-grid">
          <Field label={t('Article')}>{(p) => <select {...p} value={f.v.itemId} onChange={f.set('itemId')}><option value="">{t('Choisir…')}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
          <Field label={t('Client')}>{(p) => <select {...p} value={f.v.customerId} onChange={f.set('customerId')}><option value="">{t('Aucun')}</option>{accounts.data ? accounts.data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>) : null}</select>}</Field>
          <Field label={t('Quantité')}>{(p) => <input {...p} type="text" inputMode="decimal" value={f.v.quantity} onChange={f.set('quantity')} />}</Field>
          <Field label={t('Canal')}>{(p) => <select {...p} value={f.v.channel} onChange={f.set('channel')}>{Object.entries(L3.channel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>
        </div>
        <p className="ws-err" role="alert">{f.err}</p>
        <div className="row"><Button variant="primary" type="submit">{t('Calculer le prix')}</Button></div>
      </form>
      {r ? (
        <Alert tone="ok" title={t('Prix proposé : {p}', { p: money(r.suggested) })}>
          {t('Raison : {r}.', { r: L3.reason[r.reason] || r.reason })} {t('Prix de liste {l}', { l: money(r.list) })}{r.floor ? ' · ' + t('plancher {f}', { f: money(r.floor) }) : ''}{r.cost !== null ? ' · ' + t('coût {c}', { c: money(r.cost) }) : ''}{r.marginPct !== null ? ' · ' + t('marge {m}', { m: pct(r.marginPct) }) : ''}
          {r.priceLists.length ? <div className="small">{t('Listes applicables : {l}', { l: r.priceLists.map((x) => `${x.name} (${money(x.price)})`).join(', ') })}</div> : null}
        </Alert>
      ) : null}
    </Card>
  );
}

function History({ items }) {
  const t = useT();
  const { api } = useCp();
  const { money } = useWs();
  const [id, setId] = useState('');
  const st = useLoad(() => (id ? api('GET', '/pricing/history?itemId=' + id) : Promise.resolve(null)), [id]);
  return (
    <Card title={t('Historique des prix')}>
      <Field label={t('Article')}>{(p) => <select {...p} value={id} onChange={(e) => setId(e.target.value)}><option value="">{t('Choisir…')}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
      {st.error ? <Failed e={st.error} /> : st.data ? (
        <>
          <p>{t('Prix actuel : {p}', { p: money(st.data.current) })}</p>
          {st.data.sold.length ? (
            <ChartFrame title={t('Prix moyen vendu par mois')} summary={st.data.sold.map((s) => `${s.month} : ${money(s.avgPrice)}`).join(' ; ')} height={240}>
              <Combo data={st.data.sold.map((s) => ({ x: s.month, avg: s.avgPrice, qty: s.quantity }))} series={[{ key: 'avg', label: t('Prix moyen vendu'), type: 'line' }]} fmt={money} height={240} /></ChartFrame>
          ) : <p className="muted">{t('Aucune vente de cet article.')}</p>}
          <Table caption={t('Changements de prix')} rowKey="at" columns={[{ key: 'at', label: t('Date'), render: (c) => fmtDT(c.at) }, { key: 'from', label: t('Ancien prix'), align: 'r', render: (c) => money(c.from) }, { key: 'to', label: t('Nouveau prix'), align: 'r', render: (c) => money(c.to) }, { key: 'by', label: t('Par') }, { key: 'reason', label: t('Motif') }]} rows={st.data.changes} empty={t('Aucun changement de prix enregistré.')} />
        </>
      ) : null}
    </Card>
  );
}

export default function PricingItems() {
  const t = useT();
  const L3 = useL3();
  const { api, has, tick } = useCp();
  const { money, modal } = useWs();
  const st = useLoad(() => api('GET', '/pricing/items'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const items = st.data.items;
  const cols = [
    { key: 'name', label: t('Article'), render: (i) => <b>{i.name}</b> }, { key: 'price', label: t('Prix de liste'), align: 'r', render: (i) => money(i.price) },
    { key: 'floor', label: t('Plancher'), align: 'r', render: (i) => (i.floor ? money(i.floor) : '—') },
    { key: 'cost', label: t('Coût'), align: 'r', render: (i) => (i.cost === null ? <span className="muted">{t('Inconnu')}</span> : <>{money(i.cost)} <span className="small muted">({L3.costSource[i.costSource]})</span></>) },
    { key: 'marginPct', label: t('Marge'), align: 'r', render: (i) => (i.marginPct === null ? '—' : <Badge tone={i.marginPct < 10 ? 'danger' : 'ok'}>{pct(i.marginPct)}</Badge>) },
    { key: 'act', label: '', render: (i) => (has('pricing') ? <Button size="sm" onClick={() => modal(t('Coût de {nom}', { nom: i.name }), (close) => <CostForm it={i} close={close} onSaved={st.reload} />)}>{t('Coût')}</Button> : null) },
  ];
  return (
    <div className="cp-stack">
      <Card title={t('Articles et coûts')} subtitle={t('Sans coût connu, la marge ne peut pas être calculée.')}><Table caption={t('Articles et coûts')} columns={cols} rows={items} empty={t('Aucun article au catalogue.')} /></Card>
      <Resolver items={items} />
      <History items={items} />
    </div>
  );
}
