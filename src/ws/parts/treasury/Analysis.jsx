import { useState } from 'react';
import { useLang, useT } from '../../../lib/i18n.jsx';
import { monthShort } from '../../../lib/format.js';
import { useWs } from '../../WsContext.jsx';
import { Alert, Button, Card, ChartFrame, Form, Loaded, Stat, Table, useLoad } from '../../ui.jsx';
import { Combo } from '../../charts/lazy.jsx';
import { Gauge, Lines, Waterfall } from './charts.jsx';
import { Level, useGroups, useInterpret } from './common.jsx';

/* Trésorerie · écarts prévu / réalisé (cascade), tableau des flux, indicateurs (BFR, FRNG, trésorerie nette, jours de crédit), fonds de sécurité. */

const monthLabel = (lang, ym) => `${monthShort(lang, Number(ym.slice(5, 7)) - 1)} ${ym.slice(2, 4)}`;

export function VarianceScreen() {
  const t = useT(); const lang = useLang();
  const { oapi, money } = useWs();
  const groups = useGroups();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); });
  const st = useLoad(() => oapi('GET', '/treasury/variance?month=' + month), [month]);
  const shift = (n) => { const [y, m] = month.split('-').map(Number); setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); };
  const cause = (c) => {
    const p = c.p || {};
    switch (c.code) {
      case 'late_customers': return t('Les clients ont payé moins que prévu ({amount} de moins) : {n} facture(s) échue(s) non réglée(s) pour {open}.', { amount: money(c.amount), n: p.count, open: money(p.amount) });
      case 'suppliers_later': return t('Les fournisseurs ont été payés plus tard que prévu : {amount} de décaissements en moins.', { amount: money(c.amount) });
      case 'suppliers_more': return t('Les fournisseurs ont coûté {amount} de plus que prévu.', { amount: money(c.amount) });
      case 'unplanned': return t('Mouvement non prévu en « {g} » : {amount}.', { g: groups[c.group], amount: money(c.amount) });
      default: return t('Écart sur « {g} » : {amount} {sens}.', { g: groups[c.group] || c.group, amount: money(c.amount), sens: p.sign === 'plus' ? t('de mieux que prévu') : t('de moins que prévu') });
    }
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}><Button iconOnly icon="left" label={t('Mois précédent')} onClick={() => shift(-1)} /><b style={{ minWidth: 90, textAlign: 'center' }}>{monthLabel(lang, month)}</b><Button iconOnly icon="right" label={t('Mois suivant')} onClick={() => shift(1)} /></div>
      <Loaded state={st}>{(v) => {
        const wf = v.waterfall.map((w) => ({ name: w.key === 'planned' ? t('Prévu') : w.key === 'actual' ? t('Réalisé') : groups[w.key] || w.key, value: w.value, kind: w.kind }));
        const trend = v.trend.map((x) => ({ x: monthLabel(lang, x.month), planned: x.planned, actual: x.actual }));
        return (
          <>
            <div className="kpis4">
              <Stat icon="bullseye" label={t('Flux net prévu')} value={money(v.plannedNet)} sub={t('Échéances du mois')} />
              <Stat icon="coins" label={t('Flux net réalisé')} value={money(v.actualNet)} sub={t('Mouvements de trésorerie')} />
              <Stat icon="scale-balanced" tone={v.gap < 0 ? 'warn' : 'ok'} label={t('Écart')} value={money(v.gap)} sub={v.gap < 0 ? t('Moins bien que prévu') : t('Mieux que prévu')} subTone={v.gap < 0 ? 'bad' : undefined} />
            </div>
            <div className="pd-grid two">
              <Card><ChartFrame title={t('De la prévision à la réalité')} subtitle={t('Cascade des écarts par nature de flux')} height={300} summary={wf.map((w) => w.name + ' ' + money(w.value)).join(', ')} legend={[{ label: t('Total'), color: 'var(--c1)' }, { label: t('Mieux que prévu'), color: 'var(--ok)' }, { label: t('Moins bien que prévu'), color: 'var(--danger)' }]}><Waterfall data={wf} fmt={money} height={300} /></ChartFrame></Card>
              <Card><ChartFrame title={t('Prévu et réalisé sur 6 mois')} height={300} summary={trend.map((x) => x.x + ' ' + money(x.actual)).join(', ')} legend={[{ label: t('Prévu'), color: 'var(--c8)' }, { label: t('Réalisé'), color: 'var(--c1)' }]}><Combo data={trend} fmt={money} zeroLine height={300} series={[{ key: 'planned', label: t('Prévu'), type: 'bar', color: 'var(--c8)' }, { key: 'actual', label: t('Réalisé'), type: 'bar', color: 'var(--c1)' }]} /></ChartFrame></Card>
            </div>
            <Card title={t('Écarts par nature de flux')} flush>
              <Table caption={t('Écarts')} empty={t('Aucun mouvement ce mois-ci.')} columns={[
                { key: 'g', label: t('Nature'), render: (r) => groups[r.group] || r.group }, { key: 'p', label: t('Prévu'), align: 'r', render: (r) => money(r.planned) }, { key: 'a', label: t('Réalisé'), align: 'r', render: (r) => money(r.actual) },
                { key: 'gap', label: t('Écart'), align: 'r', render: (r) => <b style={{ color: r.gap < 0 ? 'var(--danger)' : 'var(--ok)' }}>{money(r.gap)}</b> }, { key: 'pct', label: '%', align: 'r', render: (r) => (r.gapPct === null ? '—' : r.gapPct + ' %') },
              ]} rows={v.rows.map((r) => ({ ...r, id: r.group }))} />
            </Card>
            <Card title={t('Causes probables')}>{v.causes.length ? v.causes.map((c, i) => <p key={i} className="small" style={{ margin: '4px 0' }}>• {cause(c)}</p>) : <p className="muted">{t('Aucun écart à expliquer.')}</p>}</Card>
            {!v.hasLedger ? <Alert tone="info">{t('Le réalisé vient de la comptabilité : passez vos encaissements et décaissements pour le voir ici.')}</Alert> : null}
          </>
        );
      }}</Loaded>
    </>
  );
}

export function CashflowScreen() {
  const t = useT(); const lang = useLang();
  const { oapi, money } = useWs();
  const groups = useGroups();
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const st = useLoad(() => oapi('GET', '/treasury/cashflow?year=' + year), [year]);
  const sec = { operating: t('Flux d\'exploitation'), investing: t('Flux d\'investissement'), financing: t('Flux de financement') };
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}><Button iconOnly icon="left" label={t('Année précédente')} onClick={() => setYear(String(Number(year) - 1))} /><b className="num" style={{ minWidth: 48, textAlign: 'center' }}>{year}</b><Button iconOnly icon="right" label={t('Année suivante')} onClick={() => setYear(String(Number(year) + 1))} /></div>
      <Loaded state={st}>{(c) => {
        const months = c.months.map((m) => ({ x: monthLabel(lang, m.month), operating: m.operating, investing: m.investing, financing: m.financing }));
        return (
          <>
            <div className="kpis4">
              <Stat icon="coins" label={t('Trésorerie d\'ouverture')} value={money(c.opening)} />
              {Object.keys(sec).map((k) => <Stat key={k} icon={k === 'operating' ? 'gears' : k === 'investing' ? 'building' : 'landmark'} label={sec[k]} value={money(c.sections[k].total)} />)}
              <Stat icon="shield" tone={c.check.ok ? 'ok' : 'warn'} label={t('Trésorerie de clôture')} value={money(c.closing)} sub={c.check.ok ? t('Ouverture + flux = clôture : vérifié') : t('Écart à expliquer : {amount}', { amount: money(c.check.gap) })} />
            </div>
            <Card><ChartFrame title={t('Flux de trésorerie par mois')} subtitle={t('Exploitation, investissement et financement (12 derniers mois)')} height={280} summary={months.map((m) => m.x + ' ' + money(m.operating + m.investing + m.financing)).join(', ')} legend={[{ label: sec.operating, color: 'var(--c1)' }, { label: sec.investing, color: 'var(--c3)' }, { label: sec.financing, color: 'var(--c5)' }]}>
              <Combo data={months} fmt={money} zeroLine stacked height={280} series={[{ key: 'operating', label: sec.operating, type: 'bar', color: 'var(--c1)' }, { key: 'investing', label: sec.investing, type: 'bar', color: 'var(--c3)' }, { key: 'financing', label: sec.financing, type: 'bar', color: 'var(--c5)' }]} /></ChartFrame></Card>
            <Card title={t('Tableau des flux de trésorerie')} subtitle={t('Construit à partir de vos écritures de banque, caisse et mobile money, classées par nature.')} flush>
              <div className="ui-table-wrap"><table className="ui-table"><thead><tr><th>{t('Nature')}</th><th className="r">{t('Encaissements')}</th><th className="r">{t('Décaissements')}</th><th className="r">{t('Flux net')}</th></tr></thead><tbody>
                <tr><td><b>{t('Trésorerie d\'ouverture')}</b></td><td /><td /><td className="r num"><b>{money(c.opening)}</b></td></tr>
                {Object.keys(sec).map((k) => [
                  <tr key={k}><td colSpan={4}><b>{sec[k]}</b></td></tr>,
                  ...c.sections[k].rows.map((r) => <tr key={k + r.group}><td style={{ paddingLeft: 24 }}>{groups[r.group] || r.group}</td><td className="r num">{money(r.in)}</td><td className="r num">{money(-r.out)}</td><td className="r num">{money(r.amount)}</td></tr>),
                  <tr key={k + 't'}><td style={{ paddingLeft: 24 }}><b>{t('Total')}</b></td><td /><td /><td className="r num"><b>{money(c.sections[k].total)}</b></td></tr>,
                ])}
                <tr><td><b>{t('Variation nette de la trésorerie')}</b></td><td /><td /><td className="r num"><b>{money(c.net)}</b></td></tr>
                <tr><td><b>{t('Trésorerie de clôture')}</b></td><td /><td /><td className="r num"><b>{money(c.closing)}</b></td></tr>
              </tbody></table></div>
            </Card>
          </>
        );
      }}</Loaded>
    </>
  );
}

export function KpisScreen({ me }) {
  const t = useT(); const lang = useLang();
  const { oapi, money, modal, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/kpis?months=12'), []);
  const interp = useInterpret();
  const targetsForm = (j) => modal(t('Objectifs en jours'), (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/settings', { targets: { dso: v.dso, dpo: v.dpo, dio: v.dio, ccc: v.ccc } }).then(() => { close(); st.reload(); }).catch((e) => { fail(e); throw e; })}
      fields={[{ k: 'dso', label: t('Délai de paiement des clients (DSO)'), value: String(j.targets.dso) }, { k: 'dpo', label: t('Délai de paiement des fournisseurs (DPO)'), value: String(j.targets.dpo) }, { k: 'dio', label: t('Rotation du stock (DIO)'), value: String(j.targets.dio) }, { k: 'ccc', label: t('Cycle de conversion de trésorerie (CCC)'), value: String(j.targets.ccc) }]} />
  ));
  return (
    <Loaded state={st}>{(j) => {
      const c = j.current; const w = j.workingCapital;
      const series = j.series.map((s) => ({ x: monthLabel(lang, s.month), dso: s.dso, dpo: s.dpo, dio: s.dio, ccc: s.ccc, bfr: s.bfr, frng: s.frng, tn: s.treasuryNet }));
      const dash = (v) => (v === null || v === undefined ? '—' : t('{n} jours', { n: v }));
      const tile = (k, label, v, target, formula) => <div className="kpi" key={k}><span className="muted small">{k} · {label}</span><b>{dash(v)}</b><small className="muted">{formula}{target ? ' · ' + t('objectif {n} j', { n: target }) : ''}</small></div>;
      return (
        <>
          {j.alerts.map((a) => <Alert key={a.code} tone={a.level === 'alert' ? 'danger' : a.level === 'warn' ? 'warn' : 'info'}>{interp({ code: a.code === 'dpo' ? 'dpo_short' : a.code === 'dso' ? (a.level === 'alert' ? 'dso_high' : 'dso_above') : a.code === 'dio' ? 'dio_high' : 'ccc_high', p: { days: a.value, target: a.target } })}</Alert>)}
          <Card title={t('Jours de crédit et cycle de trésorerie')} subtitle={t('Sur les 90 derniers jours')} actions={me.canConfigure ? <Button size="sm" onClick={() => targetsForm(j)}>{t('Objectifs')}</Button> : null}>
            <div className="kpis4">
              {tile('DSO', t('Clients'), c.dso, j.targets.dso, t('créances ÷ ventes TTC × 90'))}
              {tile('DPO', t('Fournisseurs'), c.dpo, j.targets.dpo, t('dettes ÷ achats TTC × 90'))}
              {tile('DIO', t('Stock'), c.dio, j.targets.dio, t('stock ÷ coût des achats × 90'))}
              {tile('CCC', t('Cycle'), c.ccc, j.targets.ccc, t('DSO + DIO − DPO'))}
            </div>
            {j.interpretation.map((x) => <p key={x.code} className="small" style={{ margin: '4px 0' }}>• {interp(x)}</p>)}
          </Card>
          {j.fromLedger ? (
            <div className="pd-grid two">
              <Card><ChartFrame title={t('Évolution mensuelle des jours de crédit')} height={280} summary={series.map((s) => s.x + ' CCC ' + s.ccc).join(', ')} legend={[{ label: 'DSO', color: 'var(--c1)' }, { label: 'DPO', color: 'var(--c3)' }, { label: 'DIO', color: 'var(--c5)' }, { label: 'CCC', color: 'var(--danger)' }]}>
                <Lines data={series} height={280} fmt={(v) => t('{n} jours', { n: v })} series={[{ key: 'dso', label: 'DSO', color: 'var(--c1)' }, { key: 'dpo', label: 'DPO', color: 'var(--c3)' }, { key: 'dio', label: 'DIO', color: 'var(--c5)' }, { key: 'ccc', label: 'CCC', color: 'var(--danger)', dashed: true }]} refs={[{ y: j.targets.ccc, label: t('Objectif CCC') }]} /></ChartFrame></Card>
              <Card><ChartFrame title={t('BFR, fonds de roulement et trésorerie nette')} subtitle={t('Fin de chaque mois')} height={280} summary={series.map((s) => s.x + ' TN ' + money(s.tn)).join(', ')} legend={[{ label: 'FRNG', color: 'var(--c1)' }, { label: 'BFR', color: 'var(--c4)' }, { label: t('Trésorerie nette'), color: 'var(--ok)' }]}>
                <Lines data={series} height={280} fmt={money} series={[{ key: 'frng', label: 'FRNG', color: 'var(--c1)' }, { key: 'bfr', label: 'BFR', color: 'var(--c4)' }, { key: 'tn', label: t('Trésorerie nette'), color: 'var(--ok)' }]} /></ChartFrame></Card>
            </div>
          ) : null}
          {w ? (
            <Card title={t('Équilibre financier')} subtitle={t('Trésorerie nette = fonds de roulement (FRNG) − besoin en fonds de roulement (BFR)')}>
              <div className="kpis4">
                <Stat icon="landmark" label={t('FRNG')} value={money(w.frng)} sub={t('Ressources stables − emplois stables')} />
                <Stat icon="boxes-stacked" label={t('BFR')} value={money(w.bfr)} sub={t('Stocks + créances − dettes d\'exploitation')} />
                <Stat icon="coins" tone={w.treasuryNet < 0 ? 'danger' : 'ok'} label={t('Trésorerie nette')} value={money(w.treasuryNet)} sub={w.check.ok ? t('FRNG − BFR = comptes de trésorerie : vérifié') : t('Écart : {amount}', { amount: money(w.check.gap) })} />
              </div>
              <div className="ui-table-wrap"><table className="ui-table"><tbody>
                <tr><td>{t('Capitaux propres (comptes 10 à 15)')}</td><td className="r num">{money(w.equity)}</td></tr>
                <tr><td>{t('Résultat de l\'exercice en cours')}</td><td className="r num">{money(w.result)}</td></tr>
                <tr><td>{t('Dettes financières et provisions durables')}</td><td className="r num">{money(w.financialDebts + w.provisions)}</td></tr>
                <tr><td>{t('− Immobilisations nettes')}</td><td className="r num">{money(-w.fixedAssets)}</td></tr>
                <tr><td><b>{t('= Fonds de roulement net global')}</b></td><td className="r num"><b>{money(w.frng)}</b></td></tr>
                <tr><td>{t('Stocks')}</td><td className="r num">{money(w.stocks)}</td></tr>
                <tr><td>{t('Créances clients et avances versées')}</td><td className="r num">{money(w.receivables)}</td></tr>
                <tr><td>{t('− Dettes fournisseurs')}</td><td className="r num">{money(w.payables)}</td></tr>
                <tr><td>{t('Autres créances et dettes d\'exploitation, hors exploitation')}</td><td className="r num">{money(w.other + w.nonOperating)}</td></tr>
                <tr><td><b>{t('= Besoin en fonds de roulement')}</b></td><td className="r num"><b>{money(w.bfr)}</b></td></tr>
                <tr><td><b>{t('Trésorerie nette (FRNG − BFR)')}</b></td><td className="r num"><b>{money(w.treasuryNet)}</b></td></tr>
              </tbody></table></div>
            </Card>
          ) : <Alert tone="info">{t('Les indicateurs sont calculés sur vos factures et dettes. Passez vos écritures comptables pour obtenir le BFR, le FRNG et la trésorerie nette.')}</Alert>}
          <Card title={t('Évolution mensuelle')} flush>
            <Table caption={t('Indicateurs par mois')} empty={t('Pas encore d\'historique.')} columns={[
              { key: 'month', label: t('Mois'), render: (s) => monthLabel(lang, s.month) }, { key: 'dso', label: 'DSO', align: 'r', render: (s) => (s.dso === null ? '—' : s.dso) }, { key: 'dpo', label: 'DPO', align: 'r', render: (s) => (s.dpo === null ? '—' : s.dpo) },
              { key: 'dio', label: 'DIO', align: 'r', render: (s) => (s.dio === null ? '—' : s.dio) }, { key: 'ccc', label: 'CCC', align: 'r', render: (s) => (s.ccc === null ? '—' : s.ccc) },
              { key: 'bfr', label: 'BFR', align: 'r', render: (s) => money(s.bfr) }, { key: 'frng', label: 'FRNG', align: 'r', render: (s) => money(s.frng) }, { key: 'tn', label: t('Trésorerie nette'), align: 'r', render: (s) => money(s.treasuryNet) },
            ]} rows={j.series.map((s) => ({ ...s, id: s.month }))} />
          </Card>
        </>
      );
    }}</Loaded>
  );
}

export function SafetyScreen({ me }) {
  const t = useT();
  const { oapi, money, modal, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/safety'), []);
  const form = (j) => modal(t('Fonds de sécurité'), (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/settings', { safetyMode: v.safetyMode, safetyDays: v.safetyDays, safetyAmount: v.safetyAmount, minBalance: v.minBalance }).then(() => { close(); st.reload(); }).catch((e) => { fail(e); throw e; })}
      fields={[{ k: 'safetyMode', label: t('Cible exprimée en'), type: 'select', value: j.mode, options: [['days', t('Jours de charges')], ['amount', t('Montant fixe')]] }, { k: 'safetyDays', label: t('Jours de charges à couvrir'), value: String(j.days) }, { k: 'safetyAmount', label: t('Montant fixe'), value: String(j.amount) }, { k: 'minBalance', label: t('Solde minimal toléré (alerte)'), value: '0' }]} />
  ));
  return (
    <Loaded state={st}>{(j) => {
      const advice = j.level === 'unset' ? t('Définissez une cible : en général 1 à 3 mois de charges d\'exploitation.')
        : j.level === 'ok' ? t('Votre fonds de sécurité est atteint : {amount} au-dessus de la cible.', { amount: money(j.surplus) })
          : t('Il manque {gap}. Mettez de côté {weekly} par semaine pendant 12 semaines pour le reconstituer.', { gap: money(j.gap), weekly: money(j.recommendedWeekly) });
      return (
        <>
          <div className="kpis4">
            <Stat icon="shield" label={t('Cible')} value={money(j.target)} sub={j.mode === 'days' ? t('{n} jours de charges', { n: j.days }) : t('Montant fixe')} />
            <Stat icon="coins" label={t('Trésorerie disponible')} value={money(j.available)} sub={j.coverageDays === null ? '' : t('{n} jours de charges couverts', { n: j.coverageDays })} />
            <Stat icon="scale-balanced" tone={j.gap ? 'warn' : 'ok'} label={j.gap ? t('Il manque') : t('Au-dessus de la cible')} value={money(j.gap || j.surplus)} />
            <Stat icon="clock" label={t('Charges par jour')} value={money(j.dailyOut)} sub={t('Moyenne des 90 derniers jours')} />
          </div>
          <Card title={t('Niveau du fonds de sécurité')} actions={<><Level level={j.level} />{me.canConfigure ? <Button size="sm" onClick={() => form(j)}>{t('Modifier la cible')}</Button> : null}</>}>
            <Gauge ratio={j.ratio} level={j.level} label={t('Fonds de sécurité')} />
            <p style={{ marginTop: 10 }}>{advice}</p>
            {j.weeksBelowTarget ? <Alert tone="warn">{t('Selon la prévision, le solde passe sous la cible pendant {n} semaine(s) sur 13.', { n: j.weeksBelowTarget })}</Alert> : null}
          </Card>
          <Card><ChartFrame title={t('Solde prévu face à la cible')} subtitle={t('13 semaines glissantes')} height={260} summary={j.projection.map((p) => p.label + ' ' + money(p.closing)).join(', ')} legend={[{ label: t('Solde prévu'), color: 'var(--c1)' }, { label: t('Cible'), color: 'var(--c8)' }]}>
            <Lines data={j.projection.map((p) => ({ x: p.label, closing: p.closing, target: p.target }))} height={260} fmt={money} series={[{ key: 'closing', label: t('Solde prévu'), color: 'var(--c1)' }, { key: 'target', label: t('Cible'), color: 'var(--c8)', dashed: true }]} /></ChartFrame></Card>
        </>
      );
    }}</Loaded>
  );
}
