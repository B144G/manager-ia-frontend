import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Failed, Field, useDownload, useFormState, num } from './common.jsx';
import { RequestForm } from './Requests.jsx';

/* Aperçu, tableau de bord, budgets et engagements, réglages (tolérances et seuils d'approbation). */

const YEARS = () => { const y = new Date().getFullYear(); return [y, y - 1, y - 2].map(String); };
function YearPick({ year, setYear }) {
  const t = useT();
  return <label className="fld pur-inline"><span>{t('Année')}</span><select value={year} onChange={(e) => setYear(e.target.value)}>{YEARS().map((y) => <option key={y} value={y}>{y}</option>)}</select></label>;
}
function Bars({ rows, label, value, money }) {
  const max = Math.max(1, ...rows.map((r) => value(r)));
  return <div className="pur-bars">{rows.map((r, i) => <div className="pur-bar" key={i}><span className="pur-bar-l">{label(r)}</span><span className="pur-bar-t"><i style={{ width: Math.max(2, Math.round((value(r) / max) * 100)) + '%' }} /></span><b>{money(value(r))}</b></div>)}</div>;
}

function Reorder({ go }) {
  const t = useT();
  const { oapi, modal } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/reorder'), []);
  const items = (st.data && st.data.items) || [];
  if (!items.length) return null;
  const ask = () => modal(t("Nouvelle demande d'achat"), (close) => <RequestForm close={close} onSaved={() => go('requests')} pre={{ title: t('Réapprovisionnement du stock'), justification: t('Articles sous leur seuil de stock.'), category: '', lines: items.map((i) => ({ itemId: String(i.itemId), description: i.name, unit: i.unit, quantity: String(i.suggested), price: i.supplier ? String(i.supplier.unitPrice) : '' })) }} />, { wide: true });
  return (
    <>
      <h3>{t('Stock à réapprovisionner')}</h3>
      <p className="muted small">{t("Articles sous leur seuil, en tenant compte de ce qui est déjà commandé.")}</p>
      {items.map((i) => <div className="line" key={i.itemId}><span><b>{i.name}</b><br /><small>{t('en stock {q} (seuil {m}), déjà commandé {o}', { q: i.quantity, m: i.minQuantity, o: i.onOrder })}{i.supplier ? ' · ' + t('meilleur prix : {name}', { name: i.supplier.name }) : ''}</small></span><b>{t('à commander : {n} {u}', { n: i.suggested, u: i.unit })}</b></div>)}
      <div className="row"><button className="btn primary" type="button" onClick={ask}>{t('Créer une demande avec ces articles')}</button></div>
    </>
  );
}

export function Home({ go }) {
  const t = useT();
  const { oapi, can } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/summary'), []);
  const j = st.data;
  const mine = (j && j.myRequests) || {};
  const tile = (n, label, to) => <button type="button" className="kpi pur-tile" onClick={() => go(to)}><b>{n}</b><small>{label}</small></button>;
  return (
    <div className="ws-card">
      <h2>{t('Achats')}</h2>
      <p className="muted small">{t("De la demande d'achat au paiement du fournisseur : demandes, appels d'offres, bons de commande, réceptions, factures et budgets.")}</p>
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j ? (
        <>
          <h3>{t('Mes demandes')}</h3>
          <div className="pur-kpis">{tile(mine.draft || 0, t('Brouillons'), 'requests')}{tile(mine.submitted || 0, t("En attente d'approbation"), 'requests')}{tile(mine.approved || 0, t('Approuvées'), 'requests')}{tile(mine.rejected || 0, t('Refusées'), 'requests')}</div>
          {j.pending ? (
            <>
              <h3>{t('À traiter')}</h3>
              <div className="pur-kpis">
                {tile(j.pending.requests, t("Demandes d'achat à approuver"), 'requests')}
                {tile(j.pending.orders, t('Bons de commande à approuver'), 'orders')}
                {tile(j.pending.late, t('Livraisons en retard'), 'orders')}
                {tile(j.pending.invoices, can('admin') ? t('Factures à valider') : t('Factures à examiner'), 'invoices')}
                {tile(j.pending.rfqs, t("Appels d'offres en cours"), 'rfqs')}
              </div>
              <Reorder go={go} />
            </>
          ) : <p className="muted small">{t("Les demandes que vous créez sont approuvées par un responsable. Vous en suivez l'état ici.")}</p>}
        </>
      ) : null}
    </div>
  );
}

export function DashboardScreen() {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const dl = useDownload();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const st = useLoad(() => oapi('GET', '/purchasing/dashboard?year=' + year), [year]);
  const d = st.data;
  const exp = (kind) => <button key={kind[0]} className="btn small" type="button" onClick={() => dl('/export?kind=' + kind[0] + '&year=' + year, 'achats-' + kind[0] + '-' + year + '.csv')}>{t(kind[1])}</button>;
  return (
    <div>
      <div className="ws-card">
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end' }}><h2 className="grow">{t('Tableau de bord des achats')}</h2><YearPick year={year} setYear={setYear} /></div>
        {st.loading && !d ? <Loading /> : null}
        {st.error ? <Failed e={st.error} /> : null}
        {d ? (
          <>
            <div className="pur-kpis">
              <div className="kpi"><small>{t('Dépenses facturées (TTC)')}</small><b>{money(d.spend.totalTtc)}</b></div>
              <div className="kpi"><small>{t('Commandé (TTC)')}</small><b>{money(d.spend.ordered)}</b></div>
              <div className="kpi"><small>{t('Engagé, pas encore facturé')}</small><b>{money(d.commitments.engaged)}</b></div>
              <div className="kpi"><small>{t('Restant à payer')}</small><b>{money(d.commitments.toPay)}</b></div>
              <div className="kpi"><small>{t('Économies des appels d\'offres')}</small><b className="ok">{money(d.savings.total)}</b></div>
              <div className="kpi"><small>{t('Délai moyen de livraison')}</small><b>{d.deliveries.avgLeadDays === null ? '—' : t('{n} j', { n: d.deliveries.avgLeadDays })}</b></div>
              <div className="kpi"><small>{t('Livraisons à temps')}</small><b>{d.deliveries.onTimeRate === null ? '—' : d.deliveries.onTimeRate + ' %'}</b></div>
            </div>
            <h3>{t('Exports pour Excel')}</h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{[['suppliers', 'Par fournisseur'], ['categories', 'Par catégorie'], ['months', 'Par mois'], ['orders', 'Bons de commande'], ['invoices', 'Factures'], ['late', 'Retards'], ['rfqs', "Appels d'offres"]].map(exp)}</div>
          </>
        ) : null}
      </div>
      {d ? (
        <>
          <div className="ws-card"><h3>{t('Dépenses par fournisseur')}</h3>{d.bySupplier.length ? <Bars rows={d.bySupplier.slice(0, 10)} label={(r) => r.name} value={(r) => r.totalTtc} money={money} /> : <Empty text={t('Aucune facture validée cette année.')} />}</div>
          <div className="ws-card"><h3>{t('Dépenses par catégorie')}</h3>{d.byCategory.length ? <Bars rows={d.byCategory} label={(r) => r.category} value={(r) => r.totalTtc} money={money} /> : <Empty text={t('Aucune facture validée cette année.')} />}</div>
          <div className="ws-card"><h3>{t('Dépenses par mois')}</h3><Bars rows={d.byMonth} label={(r) => r.month.slice(5)} value={(r) => r.invoicedTtc} money={money} /></div>
          <div className="ws-card">
            <h3>{t('Livraisons en retard')}</h3>
            {!d.deliveries.lateOpen.length ? <p className="muted small">{t('Aucune livraison en retard.')}</p> : d.deliveries.lateOpen.map((x) => <div className="line" key={x.id}><span><b>{x.number}</b> · {x.supplier}<br /><small>{t('prévue le {date}', { date: dateFr(x.expectedDate) })}</small></span><span className="late">{t('{n} jour(s) de retard', { n: x.daysLate })}</span></div>)}
          </div>
          <div className="ws-card">
            <h3>{t("Économies obtenues par les appels d'offres")}</h3>
            {!d.savings.items.length ? <p className="muted small">{t("Aucun appel d'offres attribué cette année.")}</p> : d.savings.items.map((x) => <div className="line" key={x.id}><span><b>{x.number}</b> · {x.title}<br /><small>{x.supplier} · {t('référence {a}, attribué {b}', { a: money(x.baseline), b: money(x.awardedTotal) })}</small></span><b className="ok">{money(x.savings)}</b></div>)}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function BudgetScreen() {
  const t = useT();
  const { oapi, money } = useWs();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const st = useLoad(() => oapi('GET', '/purchasing/budget?year=' + year), [year]);
  const j = st.data;
  return (
    <div className="ws-card">
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end' }}><h2 className="grow">{t('Budgets et engagements')}</h2><YearPick year={year} setYear={setYear} /></div>
      <p className="muted small">{t("Les budgets viennent du module Budget. Engagé : bons de commande approuvés pas encore facturés. Facturé : factures fournisseurs validées. Donnez une catégorie de budget à vos demandes et bons de commande pour les suivre ici.")}</p>
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.categories.length ? <Empty text={t("Aucune catégorie de budget pour l'instant.")} /> : null}
      {j ? j.categories.map((c) => (
        <div className="pur-budget" key={c.category}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><b>{c.category}</b>{c.planned === null ? <span className="muted small">{t('Pas de budget prévu')}</span> : c.over ? <span className="pill bad">{t('Budget dépassé')}</span> : c.usedPct >= 90 ? <span className="pill mid">{t('Budget presque atteint')}</span> : <span className="pill good">{t('Dans le budget')}</span>}</div>
          {c.planned !== null ? <div className="pur-bar-t big"><i className={c.over ? 'over' : ''} style={{ width: Math.min(100, c.usedPct) + '%' }} /></div> : null}
          <p className="muted small">{c.planned === null ? t('Engagé {e} · facturé {i}', { e: money(c.engaged), i: money(c.invoiced) }) : t('Prévu {p} · engagé {e} · facturé {i} · disponible {a} ({pct} %)', { p: money(c.planned), e: money(c.engaged), i: money(c.invoiced), a: money(c.available), pct: c.usedPct })}</p>
        </div>
      )) : null}
    </div>
  );
}

export function SettingsScreen() {
  const t = useT();
  const { oapi, can, toast } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/settings'), []);
  const admin = can('admin');
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  return <SettingsForm s={st.data} admin={admin} onSaved={() => { toast(t('Réglages enregistrés.')); st.reload(); }} />;
}
function SettingsForm({ s, admin, onSaved }) {
  const t = useT();
  const { oapi } = useWs();
  const mk = (list) => list.map((r) => ({ minAmount: String(r.minAmount), role: r.role }));
  const f = useFormState({ tolQtyPct: String(s.tolQtyPct), tolPricePct: String(s.tolPricePct), tolAmount: String(s.tolAmount), budgetBlock: s.budgetBlock ? '1' : '0', defaultTermsDays: String(s.defaultTermsDays) });
  const [rules, setRules] = useState({ request: mk(s.thresholds.request), order: mk(s.thresholds.order) });
  const setRule = (kind, i, patch) => setRules({ ...rules, [kind]: rules[kind].map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const block = (kind, title) => (
    <div>
      <h3>{title}</h3>
      <p className="muted small">{t("Sans seuil, un responsable peut approuver n'importe quel montant. Ajoutez des seuils pour exiger un rôle plus élevé au-dessus d'un montant.")}</p>
      {rules[kind].map((r, i) => (
        <div className="pur-rule" key={i}>
          <Field label={t('À partir de (FCFA)')}><input type="text" inputMode="numeric" disabled={!admin} value={r.minAmount} onChange={(e) => setRule(kind, i, { minAmount: e.target.value })} /></Field>
          <Field label={t('Approbation par')}><select disabled={!admin} value={r.role} onChange={(e) => setRule(kind, i, { role: e.target.value })}>{s.roles.map((x) => <option key={x.role} value={x.role}>{t(x.label)}</option>)}</select></Field>
          {admin ? <button type="button" className="btn small" onClick={() => setRules({ ...rules, [kind]: rules[kind].filter((_, k) => k !== i) })}>{t('Retirer')}</button> : null}
        </div>
      ))}
      {admin ? <button type="button" className="btn small" onClick={() => setRules({ ...rules, [kind]: [...rules[kind], { minAmount: '', role: 'admin' }] })}>{t('Ajouter un seuil')}</button> : null}
    </div>
  );
  return (
    <form className="ws-card ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const th = (kind) => rules[kind].filter((r) => r.minAmount !== '').map((r) => ({ minAmount: num(r.minAmount), role: r.role }));
      await oapi('PUT', '/purchasing/settings', { tolQtyPct: num(f.v.tolQtyPct), tolPricePct: num(f.v.tolPricePct), tolAmount: num(f.v.tolAmount), budgetBlock: f.v.budgetBlock === '1', defaultTermsDays: num(f.v.defaultTermsDays), thresholds: { request: th('request'), order: th('order') } });
      onSaved();
    }); }}>
      <h2>{t('Seuils d\'approbation et tolérances')}</h2>
      {!admin ? <p className="muted small">{t("Seul un administrateur modifie ces réglages. Vous les consultez ici.")}</p> : null}
      {block('request', t("Demandes d'achat"))}
      {block('order', t('Bons de commande'))}
      <h3>{t('Tolérances du rapprochement à trois')}</h3>
      <div className="pur-grid">
        <Field label={t('Quantité (%)')} hint={t('Écart accepté entre commandé, reçu et facturé.')}><input type="text" inputMode="decimal" disabled={!admin} value={f.v.tolQtyPct} onChange={f.set('tolQtyPct')} /></Field>
        <Field label={t('Prix unitaire (%)')} hint={t("Écart accepté entre le prix facturé et le prix commandé.")}><input type="text" inputMode="decimal" disabled={!admin} value={f.v.tolPricePct} onChange={f.set('tolPricePct')} /></Field>
        <Field label={t('Total (FCFA)')} hint={t('Écart accepté entre le total annoncé et le total calculé.')}><input type="text" inputMode="numeric" disabled={!admin} value={f.v.tolAmount} onChange={f.set('tolAmount')} /></Field>
        <Field label={t('Délai de paiement par défaut (jours)')}><input type="text" inputMode="numeric" disabled={!admin} value={f.v.defaultTermsDays} onChange={f.set('defaultTermsDays')} /></Field>
        <Field label={t('Budget dépassé')} hint={t("Un administrateur peut toujours passer outre en le confirmant.")}><select disabled={!admin} value={f.v.budgetBlock} onChange={f.set('budgetBlock')}><option value="0">{t("Avertir seulement")}</option><option value="1">{t("Bloquer l'approbation")}</option></select></Field>
      </div>
      <p className="ws-err" role="alert">{f.err}</p>
      {admin ? <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t('Enregistrer les réglages')}</button></div> : null}
    </form>
  );
}
