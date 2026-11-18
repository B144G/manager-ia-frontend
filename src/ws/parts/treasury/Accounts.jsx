import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Badge, Button, Card, EmptyState, Form, Icon, Loaded, Segmented, Stat, Table, useLoad } from '../../ui.jsx';
import { Donut, HBars, compact } from '../../charts/lazy.jsx';

/* Trésorerie · comptes (banque, caisse, mobile money), taux de change, opérations (préparation, double validation) et rapprochement. */

const KIND_ICON = { bank: 'bank', cash: 'coins', mobile: 'mobile' };

export function AccountsScreen({ me }) {
  const t = useT();
  const { oapi, money, modal, toast, fail, info } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/accounts'), []);
  const kindName = { bank: t('Banque'), cash: t('Caisse'), mobile: t('Mobile money') };
  const add = (j) => modal(t('Nouveau compte de trésorerie'), (close) => (
    <Form submitText={t('Créer le compte')} onSubmit={(v) => oapi('POST', '/treasury/accounts', { kind: v.kind, name: v.name, provider: v.provider, currency: v.currency, branchId: v.branchId || undefined, accountNo: v.accountNo, nativeOpen: v.nativeOpen || undefined }).then((r) => { close(); toast(t('Compte créé : compte comptable {gl}.', { gl: r.glAccount })); st.reload(); })}
      fields={[
        { k: 'kind', label: t('Type de compte'), type: 'select', options: j.kinds.map((k) => [k.key, kindName[k.key]]) },
        { k: 'name', label: t('Nom du compte'), required: true, placeholder: t('Afriland, MTN MoMo, Caisse siège…') },
        { k: 'provider', label: t('Opérateur (mobile money)'), type: 'select', options: [['', '—']].concat(j.providers.map((p) => [p, p])) },
        { k: 'currency', label: t('Monnaie'), value: j.currency, hint: t('Un compte en devise étrangère demande un taux de change.') },
        { k: 'accountNo', label: t('Numéro de compte ou de téléphone') },
        ...(info.branches.length ? [{ k: 'branchId', label: t('Antenne'), type: 'select', options: [['', t('Toute l\'organisation')]].concat(info.branches.map((b) => [String(b.id), b.name])) }] : []),
        { k: 'nativeOpen', label: t('Solde d\'ouverture (devise étrangère seulement)'), placeholder: '0' },
      ]} />
  ));
  const rates = (j) => modal(t('Taux de change'), (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/fx/' + String(v.currency).toUpperCase(), { rate: v.rate }).then(() => { close(); st.reload(); })}
      fields={[{ k: 'currency', label: t('Devise'), required: true, placeholder: 'EUR', hint: Object.entries(j.rates).map(([c, r]) => `${c} = ${r}`).join(' · ') }, { k: 'rate', label: t('Valeur d\'une unité en {cur}', { cur: j.currency }), required: true, placeholder: '655.957' }]} />
  ));
  const edit = (a) => modal(a.name, (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/accounts/' + a.id, { name: v.name, active: v.active === '1' }).then(() => { close(); st.reload(); }).catch((e) => { fail(e); throw e; })}
      fields={[{ k: 'name', label: t('Nom du compte'), value: a.name, required: true }, { k: 'active', label: t('État'), type: 'select', value: a.active ? '1' : '0', options: [['1', t('Actif')], ['0', t('Désactivé (solde nul requis)')]] }]} />
  ));
  return (
    <Loaded state={st}>{(j) => {
      const act = j.accounts.filter((a) => a.active);
      const byKind = Object.entries(j.consolidated.byKind).map(([k, v]) => ({ name: kindName[k] || k, value: Math.max(v, 0) })).filter((x) => x.value > 0);
      const byBranch = Object.entries(j.consolidated.byBranch).map(([name, value]) => ({ name: name === '—' ? t('Siège / commun') : name, value })).filter((x) => x.value !== 0);
      const byCur = Object.entries(j.consolidated.byCurrency).map(([c, v]) => ({ name: c, value: v }));
      return (
        <>
          <div className="kpis4">
            <Stat icon="coins" label={t('Trésorerie consolidée')} value={money(j.consolidated.total)} sub={t('{n} compte(s) actif(s)', { n: act.length })} />
            <Stat icon="hourglass" label={t('Mouvements en attente')} value={money(j.consolidated.pending)} sub={t('Préparés, pas encore validés')} />
            {byCur.map((c) => <Stat key={c.name} icon="money-bill" label={t('Solde en {cur}', { cur: c.name })} value={c.value.toLocaleString()} sub={c.name === j.currency ? t('Monnaie de l\'organisation') : t('Converti au taux {rate}', { rate: j.rates[c.name] })} />)}
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            {me.canConfigure ? <Button variant="primary" icon="plus" onClick={() => add(j)}>{t('Nouveau compte')}</Button> : null}
            {me.canConfigure ? <Button icon="arrows-left-right" onClick={() => rates(j)}>{t('Taux de change')}</Button> : null}
            <Button icon="arrows-rotate" onClick={() => modal(t('Virement interne'), (close) => <OpForm preset={{ kind: 'transfer' }} close={close} done={st.reload} />, { wide: true })}>{t('Virement interne')}</Button>
          </div>
          {!j.accounts.length ? <Card><EmptyState icon="bank" title={t('Aucun compte de trésorerie')}>{t('Créez vos banques, caisses et comptes mobile money : chacun est relié à un compte de classe 5 de votre comptabilité.')}</EmptyState></Card> : (
            <Card title={t('Comptes')} subtitle={t('Le solde comptable vient du grand livre ; le solde consolidé convertit les devises au taux courant.')}>
              <Table caption={t('Comptes de trésorerie')} columns={[
                { key: 'name', label: t('Compte'), render: (a) => <span><Icon name={KIND_ICON[a.kind]} /> {a.name}{a.active ? '' : <Badge tone="outline">{t('Désactivé')}</Badge>}</span> },
                { key: 'kind', label: t('Type'), render: (a) => kindName[a.kind] + (a.provider ? ' · ' + a.provider : '') },
                { key: 'gl', label: t('Compte comptable'), render: (a) => a.glAccount },
                { key: 'cur', label: t('Monnaie'), render: (a) => a.currency },
                { key: 'native', label: t('Solde (devise)'), align: 'r', render: (a) => a.nativeBalance.toLocaleString() },
                { key: 'book', label: t('Solde comptable'), align: 'r', render: (a) => money(a.bookBalance) },
                { key: 'cons', label: t('Consolidé'), align: 'r', render: (a) => <b>{money(a.consolidated)}</b> },
                { key: 'pend', label: t('En attente'), align: 'r', render: (a) => (a.pending ? money(a.pending) : '—') },
                ...(me.canConfigure ? [{ key: 'act', label: '', render: (a) => <Button size="sm" iconOnly icon="edit" label={t('Modifier')} onClick={() => edit(a)} /> }] : []),
              ]} rows={j.accounts} />
            </Card>
          )}
          <div className="pd-grid two" style={{ marginTop: 12 }}>
            <Card title={t('Par type de compte')}>{byKind.length ? <div style={{ height: 210 }}><Donut data={byKind} fmt={money} center={compact(j.consolidated.total)} sub={t('au total')} /></div> : <EmptyState title={t('Aucun solde')} />}</Card>
            <Card title={t('Par antenne')}>{byBranch.length ? <div style={{ height: 210 }}><HBars data={byBranch} fmt={money} height={210} valueLabel={t('Solde')} /></div> : <EmptyState title={t('Aucun solde')} />}</Card>
          </div>
        </>
      );
    }}</Loaded>
  );
}

/** Formulaire d'opération : encaissement, décaissement ou virement interne. `preset` peut fixer le type, le compte, la catégorie, la facture ou la dette. */
export function OpForm({ preset = {}, close, done }) {
  const t = useT();
  const { oapi, money, today, toast, fail } = useWs();
  const [kind, setKind] = useState(preset.kind || 'receipt');
  const accs = useLoad(() => oapi('GET', '/treasury/accounts'), []);
  const sets = useLoad(() => oapi('GET', '/treasury/settings'), []);
  const docs = useLoad(() => (kind === 'receipt' ? oapi('GET', '/treasury/receivables') : kind === 'payment' ? oapi('GET', '/treasury/payables') : Promise.resolve(null)), [kind]);
  const [ref, setRef] = useState(preset.ref || '');
  if (accs.loading || sets.loading) return <p className="muted">{t('Chargement…')}</p>;
  if (!accs.data || !sets.data) return <p className="ws-err">{t('Impossible de charger les comptes.')}</p>;
  const act = accs.data.accounts.filter((a) => a.active);
  const cats = sets.data.categories.filter((c) => c.dir === (kind === 'receipt' ? 'in' : 'out'));
  const refs = kind === 'receipt' ? (docs.data ? docs.data.items : []).map((i) => ['invoice:' + i.id, `${i.number} · ${i.customer} · ${money(i.left)}`]) : kind === 'payment' ? (docs.data ? docs.data.bills : []).map((b) => ['bill:' + b.id, `${b.number || '—'} · ${b.supplier} · ${money(b.left)}`]) : [];
  const selected = (kind === 'receipt' ? (docs.data ? docs.data.items : []) : kind === 'payment' ? (docs.data ? docs.data.bills : []) : []).find((x) => (kind === 'receipt' ? 'invoice:' : 'bill:') + x.id === ref);
  const catLabel = (k) => ({ customer: t('Clients'), advance_in: t('Acompte client'), other_income: t('Autre encaissement'), interest_in: t('Intérêts reçus'), loan_in: t('Emprunt reçu'), capital_in: t('Apport en capital'), asset_sale: t('Cession d\'immobilisation'), supplier: t('Fournisseurs'), advance_out: t('Acompte fournisseur'), salary: t('Salaires'), social: t('Cotisations sociales'), tax: t('Impôts et taxes'), vat: t('TVA reversée'), rent: t('Loyers'), fees: t('Frais bancaires'), other_expense: t('Autre décaissement'), loan_repay: t('Remboursement d\'emprunt'), interest_out: t('Intérêts payés'), dividends: t('Dividendes'), capex: t('Investissement') }[k]);
  const fields = [
    { k: 'accountId', label: kind === 'transfer' ? t('Compte débité') : t('Compte'), type: 'select', required: true, value: preset.accountId ? String(preset.accountId) : '', options: [['', '—']].concat(act.map((a) => [String(a.id), `${a.name} (${a.currency})`])) },
    ...(kind === 'transfer' ? [{ k: 'toAccountId', label: t('Compte crédité'), type: 'select', required: true, options: [['', '—']].concat(act.map((a) => [String(a.id), `${a.name} (${a.currency})`])) }, { k: 'amountTo', label: t('Montant reçu (si la monnaie diffère)'), hint: t('Laissez vide pour une conversion au taux courant.') }]
      : [{ k: 'category', label: t('Catégorie'), type: 'select', value: preset.category || (kind === 'receipt' ? 'customer' : 'supplier'), options: cats.map((c) => [c.key, catLabel(c.key)]) }]),
    { k: 'amount', label: t('Montant'), required: true, value: preset.amount || (selected ? String(selected.left) : ''), placeholder: '250000' },
    { k: 'date', label: t('Date'), type: 'date', value: today() },
    { k: 'label', label: t('Libellé'), value: preset.label || '' },
    { k: 'counterparty', label: kind === 'receipt' ? t('Payeur') : kind === 'payment' ? t('Bénéficiaire') : t('Remarque') },
    { k: 'reference', label: t('Référence (n° de virement, de chèque, de transaction)') },
  ];
  return (
    <>
      <Segmented label={t('Type d\'opération')} value={kind} onChange={(k) => { setKind(k); setRef(''); }} items={[{ id: 'receipt', label: t('Encaissement'), icon: 'arrow-down' }, { id: 'payment', label: t('Décaissement'), icon: 'arrow-up' }, { id: 'transfer', label: t('Virement interne'), icon: 'arrows-left-right' }]} />
      {kind !== 'transfer' ? <label className="fld" style={{ marginTop: 10 }}><span>{kind === 'receipt' ? t('Facture à solder (facultatif)') : t('Dette à régler (facultatif)')}</span>
        <select value={ref} onChange={(e) => setRef(e.target.value)}><option value="">{t('Aucune : opération libre')}</option>{refs.map((r) => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></label> : null}
      <Form key={kind + ref} fields={fields} submitText={t('Préparer l\'opération')} onSubmit={(v) => {
        const body = { kind, accountId: v.accountId, amount: v.amount, date: v.date, label: v.label, counterparty: v.counterparty, reference: v.reference };
        if (kind === 'transfer') { body.toAccountId = v.toAccountId; if (v.amountTo) body.amountTo = v.amountTo; } else { body.category = ref ? (kind === 'receipt' ? 'customer' : 'supplier') : v.category; if (ref) { const [rk, ri] = ref.split(':'); body.refKind = rk; body.refId = ri; } }
        return oapi('POST', '/treasury/ops', body).then((r) => { close(); toast(r.needDouble ? t('Opération préparée : elle demandera deux validations.') : t('Opération préparée : elle attend la validation du responsable.')); if (done) done(); }).catch((e) => { fail(e); throw e; });
      }} />
    </>
  );
}

export function OpsScreen({ me }) {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail, confirm } = useWs();
  const [filter, setFilter] = useState('pending');
  const st = useLoad(() => oapi('GET', '/treasury/ops' + (filter === 'all' ? '' : '?status=' + filter)), [filter]);
  const accs = useLoad(() => oapi('GET', '/treasury/accounts'), []);
  const name = (id) => (accs.data ? (accs.data.accounts.find((a) => a.id === id) || {}).name : '') || '';
  const status = { prepared: [t('À valider'), 'warn'], half: [t('1re validation faite'), 'info'], posted: [t('Comptabilisée'), 'ok'], rejected: [t('Refusée'), 'danger'], cancelled: [t('Annulée'), 'outline'] };
  const kindName = { receipt: t('Encaissement'), payment: t('Décaissement'), transfer: t('Virement') };
  const approve = (o) => oapi('POST', `/treasury/ops/${o.id}/approve`, {}).then((r) => { toast(r.status === 'half' ? t('Première validation enregistrée : une seconde personne doit valider.') : t('Opération validée et comptabilisée ({entry}).', { entry: r.entry })); st.reload(); accs.reload(); }).catch(fail);
  const reject = (o) => modal(t('Refuser l\'opération'), (close) => <Form submitText={t('Refuser')} fields={[{ k: 'reason', label: t('Motif du refus'), required: true }]} onSubmit={(v) => oapi('POST', `/treasury/ops/${o.id}/reject`, { reason: v.reason }).then(() => { close(); st.reload(); })} />);
  const cancel = (o) => (o.status === 'posted'
    ? modal(t('Annuler l\'opération comptabilisée'), (close) => <Form submitText={t('Annuler par écriture inverse')} fields={[{ k: 'reason', label: t('Motif de l\'annulation'), required: true }]} onSubmit={(v) => oapi('POST', `/treasury/ops/${o.id}/cancel`, { reason: v.reason }).then(() => { close(); st.reload(); accs.reload(); })} />)
    : confirm(t('Retirer cette opération ?'), () => oapi('POST', `/treasury/ops/${o.id}/cancel`, {}).then(() => st.reload()).catch(fail)));
  return (
    <>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <Segmented label={t('Afficher')} value={filter} onChange={setFilter} items={[{ id: 'pending', label: t('À valider') }, { id: 'posted', label: t('Comptabilisées') }, { id: 'all', label: t('Toutes') }]} />
        <Button variant="primary" icon="plus" onClick={() => modal(t('Nouvelle opération'), (close) => <OpForm close={close} done={st.reload} />, { wide: true })}>{t('Nouvelle opération')}</Button>
      </div>
      <Loaded state={st}>{(j) => (
        <Card title={t('Opérations de trésorerie')} subtitle={t('Le trésorier prépare ; le responsable valide. Au-delà du seuil, deux validations par deux personnes différentes.')}>
          <Table caption={t('Opérations')} empty={t('Aucune opération.')} columns={[
            { key: 'date', label: t('Date'), render: (o) => dateFr(o.date) },
            { key: 'kind', label: t('Type'), render: (o) => kindName[o.kind] },
            { key: 'label', label: t('Libellé'), render: (o) => <span>{o.label}{o.needDouble ? <Badge tone="info">{t('Double validation')}</Badge> : null}</span> },
            { key: 'acc', label: t('Compte'), render: (o) => name(o.accountId) + (o.toAccountId ? ' → ' + name(o.toAccountId) : '') },
            { key: 'amount', label: t('Montant'), align: 'r', render: (o) => <b style={{ color: o.kind === 'payment' ? 'var(--danger)' : undefined }}>{money(o.amountBase)}</b> },
            { key: 'who', label: t('Préparé par'), render: (o) => o.preparedByName + (o.approval1ByName ? ' · ' + t('validé par {n}', { n: o.approval1ByName }) : '') + (o.approval2ByName ? ' + ' + o.approval2ByName : '') },
            { key: 'status', label: t('État'), render: (o) => <Badge tone={status[o.status][1]}>{status[o.status][0]}</Badge> },
            { key: 'act', label: '', render: (o) => (
              <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                {me.canApprove && ['prepared', 'half'].includes(o.status) ? <Button size="sm" variant="primary" onClick={() => approve(o)}>{o.status === 'half' ? t('Seconde validation') : t('Valider')}</Button> : null}
                {me.canApprove && ['prepared', 'half'].includes(o.status) ? <Button size="sm" onClick={() => reject(o)}>{t('Refuser')}</Button> : null}
                {(o.status === 'prepared' || o.status === 'half') && (o.preparedBy === me.userId || me.canApprove) ? <Button size="sm" iconOnly icon="trash" label={t('Retirer')} onClick={() => cancel(o)} /> : null}
                {o.status === 'posted' && me.canApprove ? <Button size="sm" onClick={() => cancel(o)}>{t('Annuler')}</Button> : null}
              </span>) },
          ]} rows={j.ops} />
        </Card>
      )}</Loaded>
    </>
  );
}

export function ReconcileScreen({ openAccounting }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/reconcile'), []);
  return (
    <Loaded state={st}>{(j) => (
      <Card title={t('Rapprochement avec la comptabilité')} subtitle={t('Pour chaque compte : solde du grand livre, solde du dernier relevé importé et écart restant à expliquer.')} actions={<Button size="sm" onClick={openAccounting}>{t('Importer et pointer les relevés')}</Button>}>
        <Table caption={t('Rapprochement')} empty={t('Aucun compte.')} columns={[
          { key: 'name', label: t('Compte') }, { key: 'gl', label: t('Compte comptable'), render: (a) => a.glAccount },
          { key: 'book', label: t('Solde comptable'), align: 'r', render: (a) => money(a.bookBalance) },
          { key: 'stm', label: t('Solde du relevé'), align: 'r', render: (a) => (a.bank && a.bank.statementBalance !== null ? money(a.bank.statementBalance) : '—') },
          { key: 'un', label: t('Lignes non pointées'), align: 'r', render: (a) => (a.bank ? a.bank.unmatched : 0) },
          { key: 'gap', label: t('Écart à expliquer'), align: 'r', render: (a) => (a.bank && a.bank.gap !== null ? <Badge tone={a.bank.gap === 0 ? 'ok' : 'warn'}>{money(a.bank.gap)}</Badge> : <span className="muted">{t('Pas de relevé')}</span>) },
        ]} rows={j.accounts.map((a) => ({ ...a, id: a.accountId }))} />
      </Card>
    )}</Loaded>
  );
}
