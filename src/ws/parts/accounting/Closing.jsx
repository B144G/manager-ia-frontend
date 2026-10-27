import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, Check, WorkNotice, monthLabel } from '../finance/util.jsx';

/* Clôture mensuelle guidée (liste de contrôle, provisions, charges constatées d'avance) et écarts de caisse. Documents de travail. */

const ITEM = {
  auto: 'Factures, paiements et achats comptabilisés', bank: 'Relevés bancaires rapprochés', assets: 'Dotations aux amortissements comptabilisées', payroll: 'Paie du mois validée et comptabilisée',
  payables: 'Dettes fournisseurs échues examinées', receivables: 'Créances clients échues relancées', cash: 'Caisse comptée',
  adjustments: "Provisions et charges constatées d'avance passées (ou rien à passer)", vat: 'TVA du mois vérifiée', review: 'Journal relu (écritures inhabituelles, montants anormaux)',
};
const PILL = { ok: ['good', 'Fait'], warn: ['mid', 'À examiner'], todo: ['bad', 'À faire'] };
const ADJ = { prepaid: "Charge constatée d'avance", accrued: 'Charge à payer (facture non parvenue)', provision: 'Provision pour risques' };

function Cash() {
  const t = useT();
  const { oapi, money, dateFr, today, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/cash-counts'), []);
  return (
    <Loaded state={st}>
      {(j) => (
        <div className="ws-card">
          <h2>{t('Écarts de caisse')}</h2>
          <p className="muted small">{t('Solde de caisse selon la comptabilité : {amount}. Comptez l\'argent présent, saisissez le montant : l\'écart est calculé.', { amount: money(j.glBalance) })}</p>
          <Form submitText={t('Enregistrer le comptage')} fields={[
            { k: 'date', label: t('Date'), type: 'date', value: today() }, { k: 'counted', label: t('Montant compté'), required: true },
            { k: 'note', label: t("Explication de l'écart") },
            { k: 'post', label: t("Comptabiliser l'écart (manque en charge, excédent en produit)"), type: 'select', options: [['', t('Non, seulement noter')], ['yes', t('Oui')]] }]}
          onSubmit={(v) => oapi('POST', '/accounting/cash-counts', { date: v.date, counted: v.counted, note: v.note, post: v.post === 'yes' }).then((r) => { toast(r.diff === 0 ? t('Caisse juste.') : t('Écart de {amount}.', { amount: money(r.diff) })); st.reload(); }).catch(fail)} />
          {!j.counts.length ? <Empty text={t('Aucun comptage.')} /> : null}
          {j.counts.map((c) => <div className="line" key={c.id}><span>{dateFr(c.date)}{c.note ? <small className="muted">{' · ' + c.note}</small> : null}</span><span>{t('attendu {e}, compté {c}', { e: money(c.expected), c: money(c.counted) }) + ' · '}<b className={c.diff < 0 ? 'late' : ''}>{money(c.diff)}</b>{c.entryId ? <>{' '}<span className="pill good">{t('Comptabilisé')}</span></> : null}</span></div>)}
        </div>
      )}
    </Loaded>
  );
}

export default function ClosingTab() {
  const t = useT();
  const { oapi, modal, toast, fail, today, money } = useWs();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); });
  const st = useLoad(() => oapi('GET', '/accounting/closing?month=' + month), [month]);
  const reload = st.reload;
  const check = (key, checked) => oapi('PUT', '/accounting/closing/check', { month, key, checked }).then(reload).catch(fail);
  const adjust = () => modal(t('Provision ou charge à répartir'), (close) => (
    <Form submitText={t('Passer l\'écriture')} fields={[
      { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(ADJ).map(([k, v]) => [k, t(v)]) },
      { k: 'label', label: t('Libellé'), required: true, placeholder: t("Assurance payée d'avance") }, { k: 'amount', label: t('Montant'), required: true },
      { k: 'account', label: t('Compte de charge concerné'), placeholder: '625', hint: t("Pas nécessaire pour une provision. Les charges constatées d'avance et à payer sont annulées automatiquement le 1er du mois suivant.") }]}
    onSubmit={(v) => oapi('POST', '/accounting/closing/adjustments', { month, ...v }).then((r) => { close(); toast(t('Écriture {number} passée.', { number: r.entry })); reload(); })} />
  ));
  const close = (j) => modal(t('Clôturer {month}', { month: monthLabel(month) }), (cl) => (
    <Form submitText={t('Clôturer le mois')} fields={[{ k: 'note', label: j.blockers ? t('Motif (obligatoire : des points restent ouverts)') : t('Remarque'), required: j.blockers > 0, type: 'textarea', rows: 3 }]}
      onSubmit={(v) => oapi('POST', '/accounting/closing/close', { month, note: v.note, force: j.blockers > 0 }).then(() => { cl(); toast(t('Mois clôturé.')); reload(); })} />
  ));
  const reopen = () => modal(t('Rouvrir {month}', { month: monthLabel(month) }), (cl) => (
    <Form submitText={t('Rouvrir le mois')} fields={[{ k: 'reason', label: t('Motif de la réouverture (obligatoire)'), required: true, type: 'textarea', rows: 3, hint: t("Le motif est conservé dans le journal d'activité et le journal d'audit.") }]}
      onSubmit={(v) => oapi('POST', '/accounting/closing/reopen', { month, reason: v.reason }).then(() => { cl(); toast(t('Mois rouvert.')); reload(); })} />
  ));
  return (
    <>
      <WorkNotice>{t("Document de travail : la clôture mensuelle est une aide au contrôle, à faire valider par un expert-comptable.")}</WorkNotice>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <input type="month" style={{ fontSize: 16, minHeight: 44 }} value={month} max={today().slice(0, 7)} aria-label={t('Mois')} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
      </div>
      <Loaded state={st}>
        {(j) => (
          <>
            <div className="ws-card">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <h2 className="grow">{t('Clôture de {month}', { month: monthLabel(j.month) })}{' '}<span className={'pill ' + (j.status === 'closed' ? 'good' : 'mid')}>{j.status === 'closed' ? t('Clôturé') : t('Ouvert')}</span></h2>
                {j.status === 'closed' ? <button className="btn small" type="button" style={BTN} onClick={reopen}>{t('Rouvrir')}</button> : <button className="btn primary small" type="button" style={BTN} onClick={() => close(j)}>{t('Clôturer')}</button>}
              </div>
              {j.status === 'closed' ? <p className="muted small">{t('Aucune écriture ne peut plus être passée dans ce mois tant qu\'il n\'est pas rouvert.')}</p> : <p className="muted small">{t('{b} point(s) à faire, {w} à examiner.', { b: j.blockers, w: j.warnings })}</p>}
              {j.items.map((i) => (
                <div className="line" key={i.key} style={{ flexWrap: 'wrap' }}>
                  {i.manual ? <Check checked={i.checked} disabled={j.status === 'closed'} onChange={(v) => check(i.key, v)} label={t(ITEM[i.key])} /> : <span>{t(ITEM[i.key])}{i.count ? <small className="muted">{' · ' + t('{n} à traiter', { n: i.count })}</small> : null}</span>}
                  <span className={'pill ' + PILL[i.status][0]}>{t(PILL[i.status][1])}</span>
                </div>
              ))}
            </div>
            <div className="ws-card">
              <div className="row"><h2 className="grow">{t('Provisions et charges constatées d\'avance')}</h2>{j.status === 'closed' ? null : <button className="btn small" type="button" style={BTN} onClick={adjust}>{t('Ajouter')}</button>}</div>
              {!j.adjustments.length ? <Empty text={t('Aucune écriture de fin de mois.')} /> : null}
              {j.adjustments.map((a) => <div className="line" key={a.id}><span>{t(ADJ[a.kind])}<br /><small className="muted">{a.label}</small></span><b>{money(a.amount)}</b></div>)}
            </div>
            <Cash />
          </>
        )}
      </Loaded>
    </>
  );
}
