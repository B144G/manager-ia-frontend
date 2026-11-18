import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, Meter, pct, useCp } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Rétention : réachat, valeur vie client (CLV), satisfaction, réclamations et clients à risque de départ avec relance de réactivation. */

export default function Retention() {
  const t = useT();
  const L3 = useL3();
  const { api, has, fail, tick, openAccount, bump } = useCp();
  const { money, toast } = useWs();
  const ov = useLoad(() => api('GET', '/retention/overview'), [tick]);
  const risk = useLoad(() => api('GET', '/retention/at-risk'), [tick]);
  const [sel, setSel] = useState(() => new Set());
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const react = () => api('POST', '/retention/reactivate', { customerIds: [...sel] }).then((r) => {
    toast(t('{n} relance(s) démarrée(s), {m} ignorée(s).', { n: r.started.length, m: r.skipped.length })); setSel(new Set()); risk.reload(); bump();
  }, fail);
  const d = ov.data;
  const cols = [
    { key: 'sel', label: '', render: (c) => (has('activity') ? <input type="checkbox" aria-label={t('Choisir {nom}', { nom: c.name })} checked={sel.has(c.id)} disabled={c.optout} onChange={() => toggle(c.id)} /> : null) },
    { key: 'name', label: t('Client'), render: (c) => <button type="button" className="cp-link" onClick={() => openAccount(c.id)}><b>{c.name}</b>{c.optout ? <span className="muted"> · {t('refuse les relances')}</span> : null}</button> },
    { key: 'churn', label: t('Risque'), render: (c) => <span className="cp-bscore"><Meter value={c.churn} label={t('Risque de départ : {n} / 100', { n: c.churn })} /><Badge tone={c.churnLevel === 'high' ? 'danger' : 'warn'}>{L3.churn[c.churnLevel]}</Badge></span> },
    { key: 'daysSinceLast', label: t('Sans achat depuis'), align: 'r', render: (c) => t('{n} j', { n: c.daysSinceLast }) }, { key: 'intervalDays', label: t('Rythme habituel'), align: 'r', render: (c) => t('{n} j', { n: c.intervalDays }) },
    { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (c) => money(c.revenue) }, { key: 'owner', label: t('Commercial') },
  ];
  return (
    <div className="cp-stack">
      <Card title={t('Rétention et valeur client')} subtitle={t('Calculs sur les factures émises, nettes des avoirs.')}>
        {ov.error ? <Failed e={ov.error} /> : !d ? <Loading /> : (
          <div className="ui-stats">
            <Stat label={t('Taux de rétention')} value={d.retentionRate === null ? '—' : pct(d.retentionRate)} sub={t('{a} clients sur {b} de la période précédente', { a: d.retained, b: d.basePrevious })} icon="heart" tone="ok" />
            <Stat label={t('Taux de réachat')} value={d.repurchaseRate === null ? '—' : pct(d.repurchaseRate)} sub={t('{n} client(s) fidèles', { n: d.repeatCustomers })} icon="arrows-rotate" />
            <Stat label={t('Valeur vie client moyenne')} value={money(d.avgClv)} sub={t('Total : {m}', { m: money(d.totalClv) })} icon="coins" />
            <Stat label="NPS" value={d.nps.nps === null ? '—' : d.nps.nps} sub={t('{n} réponse(s)', { n: d.nps.total })} icon="star" />
            <Stat label={t('Réclamations ouvertes')} value={d.complaints.open} sub={t('Résolues en {n} j en moyenne', { n: d.complaints.avgResolutionDays })} icon="triangle-exclamation" tone={d.complaints.open ? 'warn' : 'ok'} />
            <Stat label={t('Chiffre d’affaires à risque')} value={money(d.atRiskRevenue)} sub={t('{h} à risque élevé · {m} moyen', { h: d.churnLevels.high, m: d.churnLevels.medium })} icon="hourglass" tone={d.churnLevels.high ? 'danger' : 'warn'} />
          </div>
        )}
        {d && d.topClv.length ? <><h3>{t('Meilleurs clients par valeur vie')}</h3><Table caption={t('Meilleurs clients par valeur vie')} columns={[{ key: 'name', label: t('Client'), render: (c) => <button type="button" className="cp-link" onClick={() => openAccount(c.id)}><b>{c.name}</b></button> }, { key: 'orders', label: t('Commandes'), align: 'r' }, { key: 'avgBasket', label: t('Panier moyen'), align: 'r', render: (c) => money(c.avgBasket) }, { key: 'clv', label: t('Valeur vie'), align: 'r', render: (c) => money(c.clv) }]} rows={d.topClv} /></> : null}
      </Card>
      <Card title={t('Clients à risque de départ')} subtitle={t("Le risque tient compte du retard sur le rythme d'achat, des réclamations, du NPS et de la baisse récente.")}
        actions={has('activity') ? <Button variant="primary" icon="paper-plane" disabled={!sel.size} onClick={react}>{t('Réactiver ({n})', { n: sel.size })}</Button> : null}>
        <Alert tone="info">{t("« Réactiver » démarre une suite de relances WhatsApp que vous relisez avant l'envoi (écran Relances).")}</Alert>
        {risk.error ? <Failed e={risk.error} /> : !risk.data ? <Loading /> : <Table caption={t('Clients à risque de départ')} columns={cols} rows={risk.data.customers} empty={t('Aucun client à risque.')} />}
      </Card>
    </div>
  );
}
