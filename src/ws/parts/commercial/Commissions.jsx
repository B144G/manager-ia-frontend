import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Loading, Segmented, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, num, pct, useCp, useForm, useL } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Commissions : règles par tranches et primes, calcul du mois, relevés (clôturer, valider, payer). */

function RuleForm({ pre, close, onSaved }) {
  const t = useT();
  const L = useL();
  const L3 = useL3();
  const { api } = useCp();
  const f = useForm({ name: pre ? pre.name : '', basis: pre ? pre.basis : 'revenue', active: pre ? pre.active : true });
  const [tiers, setTiers] = useState((pre ? pre.tiers : [{ upTo: null, rate: 2 }]).map((x) => ({ upTo: x.upTo === null ? '' : String(x.upTo), rate: String(x.rate) })));
  const [bonuses, setBonuses] = useState((pre ? pre.bonuses : []).map((x) => ({ attainmentPct: String(x.attainmentPct), bonus: String(x.bonus) })));
  const [roles, setRoles] = useState(() => new Set(pre ? pre.roles : []));
  const toggleRole = (r) => setRoles((s) => { const n = new Set(s); if (n.has(r)) n.delete(r); else n.add(r); return n; });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t('Nommez la règle.'));
      const body = { name: f.v.name, basis: f.v.basis, active: f.v.active, roles: [...roles], tiers: tiers.map((x) => ({ upTo: x.upTo === '' ? null : num(x.upTo), rate: num(x.rate) })), bonuses: bonuses.map((x) => ({ attainmentPct: num(x.attainmentPct), bonus: num(x.bonus) })) };
      if (pre) await api('PUT', '/commissions/rules/' + pre.id, body); else await api('POST', '/commissions/rules', body);
      close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Base de calcul')}>{(p) => <MapSelect {...p} map={L3.basis} value={f.v.basis} onChange={f.set('basis')} />}</Field>
      </div>
      <fieldset className="cp-fs cp-pick"><legend>{t('Rôles concernés (aucun = tous)')}</legend>
        {['sales_manager', 'sales_field'].map((r) => <label className="cp-check" key={r}><input type="checkbox" checked={roles.has(r)} onChange={() => toggleRole(r)} /> {L.cRole[r]}</label>)}
      </fieldset>
      <fieldset className="cp-fs"><legend>{t('Tranches (taux appliqué à chaque tranche)')}</legend>
        {tiers.map((x, i) => (
          <div className="cp-rule" key={i}>
            <Field label={t("Jusqu'à (vide = sans limite)")}>{(p) => <input {...p} type="text" inputMode="numeric" value={x.upTo} onChange={(e) => setTiers(tiers.map((y, k) => (k === i ? { ...y, upTo: e.target.value } : y)))} />}</Field>
            <Field label={t('Taux (%)')}>{(p) => <input {...p} type="text" inputMode="decimal" value={x.rate} onChange={(e) => setTiers(tiers.map((y, k) => (k === i ? { ...y, rate: e.target.value } : y)))} />}</Field>
            {tiers.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setTiers(tiers.filter((_, k) => k !== i))}>{t('Retirer')}</Button> : null}
          </div>
        ))}
        {tiers.length < 8 ? <Button size="sm" icon="plus" onClick={() => setTiers([...tiers, { upTo: '', rate: '' }])}>{t('Ajouter une tranche')}</Button> : null}
      </fieldset>
      <fieldset className="cp-fs"><legend>{t("Primes selon l'atteinte de l'objectif")}</legend>
        {bonuses.map((x, i) => (
          <div className="cp-rule" key={i}>
            <Field label={t('Atteinte minimale (%)')}>{(p) => <input {...p} type="text" inputMode="decimal" value={x.attainmentPct} onChange={(e) => setBonuses(bonuses.map((y, k) => (k === i ? { ...y, attainmentPct: e.target.value } : y)))} />}</Field>
            <Field label={t('Prime')}>{(p) => <input {...p} type="text" inputMode="numeric" value={x.bonus} onChange={(e) => setBonuses(bonuses.map((y, k) => (k === i ? { ...y, bonus: e.target.value } : y)))} />}</Field>
            <Button size="sm" variant="ghost" onClick={() => setBonuses(bonuses.filter((_, k) => k !== i))}>{t('Retirer')}</Button>
          </div>
        ))}
        {bonuses.length < 6 ? <Button size="sm" icon="plus" onClick={() => setBonuses([...bonuses, { attainmentPct: '100', bonus: '' }])}>{t('Ajouter une prime')}</Button> : null}
      </fieldset>
      <label className="cp-check"><input type="checkbox" checked={f.v.active} onChange={f.set('active')} /> {t('Règle active')}</label>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function Rules() {
  const t = useT();
  const L3 = useL3();
  const { api, fail, tick } = useCp();
  const { modal, confirm, money } = useWs();
  const st = useLoad(() => api('GET', '/commissions/rules'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const form = (pre) => modal(pre ? t('Modifier la règle') : t('Nouvelle règle'), (close) => <RuleForm pre={pre} close={close} onSaved={st.reload} />, { wide: true });
  return (
    <Card title={t('Règles de commission')} actions={<Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouvelle règle')}</Button>}>
      {!st.data.rules.length ? <EmptyState icon="percent" title={t('Aucune règle de commission.')} /> : st.data.rules.map((r) => (
        <div className="cp-cad" key={r.id}>
          <div className="row"><b className="grow">{r.name}</b><Badge>{L3.basis[r.basis]}</Badge><Badge tone={r.active ? 'ok' : 'neutral'}>{r.active ? t('Active') : t('Inactive')}</Badge></div>
          <ul className="small">{r.tiers.map((x, i) => <li key={i}>{x.upTo === null ? t('Au-delà') : t("Jusqu'à {n}", { n: money(x.upTo) })} : {x.rate} %</li>)}{r.bonuses.map((x, i) => <li key={'b' + i}>{t('Prime de {b} à partir de {p} % d’atteinte', { b: money(x.bonus), p: x.attainmentPct })}</li>)}</ul>
          <div className="row"><Button size="sm" onClick={() => form(r)}>{t('Modifier')}</Button><Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: r.name })} onClick={() => confirm(t('Supprimer cette règle ?'), () => api('DELETE', '/commissions/rules/' + r.id).then(st.reload, fail))} /></div>
        </div>
      ))}
    </Card>
  );
}

function Statements({ month }) {
  const t = useT();
  const L3 = useL3();
  const { api, has, fail, tick, bump } = useCp();
  const { money, toast } = useWs();
  const calc = useLoad(() => api('GET', '/commissions/compute?month=' + month), [month, tick]);
  const stm = useLoad(() => api('GET', '/commissions/statements?month=' + month), [month, tick]);
  const act = (id, a) => api('POST', '/commissions/statements/' + id + '/' + a, {}).then(() => { toast(a === 'approve' ? t('Relevé validé.') : t('Relevé payé.')); stm.reload(); bump(); }, fail);
  const close = () => api('POST', '/commissions/close', { month }).then((r) => { toast(t('{n} relevé(s) établi(s).', { n: r.statements })); stm.reload(); bump(); }, fail);
  const mgr = has('commissions');
  return (
    <div className="cp-stack">
      <Card title={t('Calcul du mois')} subtitle={t('Estimation selon les règles actives ; elle devient un relevé quand on clôture le mois.')} actions={mgr ? <Button variant="primary" onClick={close}>{t('Clôturer le mois')}</Button> : null}>
        {calc.error ? <Failed e={calc.error} /> : !calc.data ? <Loading /> : (
          <Table caption={t('Calcul du mois')} rowKey="userId" columns={[
            { key: 'name', label: t('Commercial'), render: (r) => <b>{r.name}</b> }, { key: 'rule', label: t('Règle') }, { key: 'basis', label: t('Base'), align: 'r', render: (r) => money(r.basis) },
            { key: 'attainment', label: t('Atteinte'), align: 'r', render: (r) => (r.attainment === null ? '—' : pct(r.attainment)) }, { key: 'commission', label: t('Commission'), align: 'r', render: (r) => money(r.commission) },
            { key: 'bonus', label: t('Prime'), align: 'r', render: (r) => money(r.bonus) }, { key: 'total', label: t('Total'), align: 'r', render: (r) => <b>{money(r.total)}</b> },
          ]} rows={calc.data.rows} empty={t('Aucune commission à calculer (règle ou commercial manquant).')} />
        )}
      </Card>
      <Card title={t('Relevés')}>
        {stm.error ? <Failed e={stm.error} /> : !stm.data ? <Loading /> : (
          <Table caption={t('Relevés')} columns={[
            { key: 'user', label: t('Commercial'), render: (r) => <b>{r.user}</b> }, { key: 'basis', label: t('Base'), align: 'r', render: (r) => money(r.basis) }, { key: 'total', label: t('Total'), align: 'r', render: (r) => <b>{money(r.total)}</b> },
            { key: 'status', label: t('État'), render: (r) => <Badge tone={r.status === 'paid' ? 'ok' : r.status === 'approved' ? 'info' : 'neutral'}>{L3.statement[r.status]}</Badge> },
            { key: 'act', label: '', render: (r) => (mgr ? (r.status === 'draft' ? <Button size="sm" onClick={() => act(r.id, 'approve')}>{t('Valider')}</Button> : r.status === 'approved' ? <Button size="sm" variant="primary" onClick={() => act(r.id, 'pay')}>{t('Marquer payé')}</Button> : null) : null) },
          ]} rows={stm.data.statements} empty={t('Aucun relevé pour ce mois.')} />
        )}
      </Card>
    </div>
  );
}

export default function Commissions() {
  const t = useT();
  const { has } = useCp();
  const [view, setView] = useState('statements');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  return (
    <div className="cp-stack">
      <div className="row cp-bar">
        <Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'statements', label: t('Calcul et relevés') }, ...(has('commissions') ? [{ id: 'rules', label: t('Règles') }] : [])]} />
        {view === 'statements' ? <Field label={t('Mois')}>{(p) => <input {...p} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field> : null}
      </div>
      {!has('commissions') ? <Alert tone="info">{t('Vous ne voyez que vos propres commissions.')}</Alert> : null}
      {view === 'rules' ? <Rules /> : <Statements month={month} />}
    </div>
  );
}
