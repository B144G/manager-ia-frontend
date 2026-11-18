import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, fmtDT, num, useCp, useForm } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Programme de fidélité : points gagnés sur les factures soldées, paliers, soldes, utilisation et ajustement de points. */

function Program() {
  const t = useT();
  const { api, has, tick, bump } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/loyalty/program'), [tick]);
  const f = useForm({});
  const [v, setV] = useState(null);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const cur = v || { pts: st.data.pointsPer1000, ...st.data.tiers };
  const edit = has('pricing');
  const save = (e) => { e.preventDefault(); f.run(async () => { await api('PUT', '/loyalty/program', { pointsPer1000: num(cur.pts), tiers: { silver: num(cur.silver), gold: num(cur.gold), platinum: num(cur.platinum) } }); toast(t('Programme enregistré.')); setV(null); st.reload(); bump(); }); };
  const set = (k) => (e) => setV({ ...cur, [k]: e.target.value });
  return (
    <Card title={t('Programme de fidélité')} subtitle={t('Les paliers dépendent du total de points gagnés depuis le début.')}>
      <form className="ws-form" noValidate onSubmit={save}>
        <fieldset className="cp-fs" disabled={!edit}>
          <div className="cp-grid">
            <Field label={t('Points pour 1 000 dépensés')}>{(p) => <input {...p} type="text" inputMode="decimal" value={cur.pts} onChange={set('pts')} />}</Field>
            <Field label={t('Palier Argent (points)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={cur.silver} onChange={set('silver')} />}</Field>
            <Field label={t('Palier Or (points)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={cur.gold} onChange={set('gold')} />}</Field>
            <Field label={t('Palier Platine (points)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={cur.platinum} onChange={set('platinum')} />}</Field>
          </div>
        </fieldset>
        <p className="ws-err" role="alert">{f.err}</p>
        {edit ? <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div> : null}
      </form>
    </Card>
  );
}

function PointsForm({ c, mode, close, onDone }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ points: '', note: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const points = num(f.v.points);
      if (!points) throw new Error(t('Indiquez un nombre de points.'));
      if (mode === 'redeem') await api('POST', '/loyalty/redeem', { customerId: c.customerId, points, note: f.v.note }); else await api('POST', '/loyalty/adjust', { customerId: c.customerId, points, note: f.v.note });
      close(); onDone();
    }); }}>
      <p>{t('{nom} : solde de {n} point(s).', { nom: c.name, n: c.balance })}</p>
      <Field label={mode === 'redeem' ? t('Points à utiliser') : t('Points (positif ou négatif)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.points} onChange={f.set('points')} />}</Field>
      <Field label={mode === 'redeem' ? t('Remarque') : t("Motif de l'ajustement")}>{(p) => <input {...p} type="text" maxLength={200} value={f.v.note} onChange={f.set('note')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Valider')}</Button></div>
    </form>
  );
}

function Ledger({ id }) {
  const t = useT();
  const L3 = useL3();
  const { api } = useCp();
  const st = useLoad(() => api('GET', '/loyalty/customers/' + id), [id]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  return (
    <div>
      <p><Badge tone="brand">{L3.tier[st.data.tier]}</Badge> {t('Solde : {n} point(s) · gagnés : {e}', { n: st.data.balance, e: st.data.earned })}</p>
      <Table caption={t('Mouvements de points')} columns={[{ key: 'at', label: t('Date'), render: (l) => fmtDT(l.at) }, { key: 'kind', label: t('Type'), render: (l) => L3.ledger[l.kind] || l.kind }, { key: 'points', label: t('Points'), align: 'r' }, { key: 'note', label: t('Remarque') }]} rows={st.data.ledger} empty={t('Aucun mouvement.')} />
    </div>
  );
}

export default function Loyalty() {
  const t = useT();
  const L3 = useL3();
  const { api, has, fail, tick, bump } = useCp();
  const { modal, toast } = useWs();
  const st = useLoad(() => api('GET', '/loyalty/customers'), [tick]);
  const sync = () => api('POST', '/loyalty/sync', {}).then((r) => { toast(t('{n} facture(s) créditée(s), {p} point(s).', { n: r.invoices, p: r.points })); st.reload(); bump(); }, fail);
  const cols = [
    { key: 'name', label: t('Client'), render: (c) => <button type="button" className="cp-link" onClick={() => modal(c.name, () => <Ledger id={c.customerId} />, { wide: true })}><b>{c.name}</b></button> },
    { key: 'tier', label: t('Palier'), render: (c) => <Badge tone={c.tier === 'base' ? 'neutral' : 'brand'}>{L3.tier[c.tier]}</Badge> }, { key: 'earned', label: t('Points gagnés'), align: 'r' }, { key: 'balance', label: t('Solde'), align: 'r' },
    { key: 'act', label: '', render: (c) => <span className="row">{has('write') ? <Button size="sm" disabled={c.balance <= 0} onClick={() => modal(t('Utiliser des points'), (close) => <PointsForm c={c} mode="redeem" close={close} onDone={() => { st.reload(); bump(); }} />)}>{t('Utiliser')}</Button> : null}
      {has('approve') ? <Button size="sm" onClick={() => modal(t('Ajuster les points'), (close) => <PointsForm c={c} mode="adjust" close={close} onDone={() => { st.reload(); bump(); }} />)}>{t('Ajuster')}</Button> : null}</span> },
  ];
  return (
    <div className="cp-stack">
      <Program />
      <Card title={t('Soldes et paliers')} actions={has('write') ? <Button icon="refresh" onClick={sync}>{t('Créditer les factures soldées')}</Button> : null}>
        {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : (
          <>
            <div className="ui-stats">
              {['platinum', 'gold', 'silver', 'base'].map((k) => <Stat key={k} label={L3.tier[k]} value={st.data.byTier[k] || 0} icon="star" />)}
              <Stat label={t('Points en circulation')} value={st.data.totalBalance} icon="coins" />
            </div>
            {!st.data.customers.length ? <EmptyState icon="star" title={t('Aucun point gagné pour le moment.')}>{t('Les points se gagnent sur les factures soldées : cliquez sur « Créditer les factures soldées ».')}</EmptyState> : <Table caption={t('Soldes et paliers')} rowKey="customerId" columns={cols} rows={st.data.customers} />}
          </>
        )}
      </Card>
      <Alert tone="info">{t('Un point est gagné une seule fois par facture soldée. Les ajustements manuels sont réservés au responsable commercial et tracés.')}</Alert>
    </div>
  );
}
