import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Check, WorkNotice } from '../finance/util.jsx';
import { YearBar } from './common.jsx';

/* Clôture annuelle : contrôles, écriture de résultat au 31/12, à-nouveaux au 01/01, verrouillage de l'exercice. */

function CarryTable({ cf, limit }) {
  const t = useT();
  const { money } = useWs();
  const rows = limit ? cf.lines.slice(0, limit) : cf.lines;
  return (
    <>
      {rows.map((l) => (
        <div className="line" key={l.account}>
          <span><b>{l.account}</b><small>{' ' + tsrv(l.label)}</small></span>
          <span>{l.debit ? t('D {amount}', { amount: money(l.debit) }) : t('C {amount}', { amount: money(l.credit) })}</span>
        </div>
      ))}
      {limit && cf.lines.length > limit ? <p className="muted small">{t('… et {n} autre(s) compte(s).', { n: cf.lines.length - limit })}</p> : null}
      <div className="line"><b>{t('Totaux')}</b><b>{t('Débit {d} · Crédit {c}', { d: money(cf.totalDebit), c: money(cf.totalCredit) })}</b></div>
    </>
  );
}

function CloseBox({ j, cl, onDone }) {
  const t = useT();
  const { oapi, money, can, toast } = useWs();
  const failed = (j.checks || []).filter((c) => !c.ok);
  const [force, setForce] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = failed.length > 0 && !(force && can('owner'));
  const go = () => {
    setErr(''); setBusy(true);
    oapi('POST', '/accounting/year-end/close', force ? { year: Number(j.year), force: true } : { year: Number(j.year) })
      .then(() => { cl(); toast(t('Exercice {year} clôturé.', { year: j.year })); onDone(); }, (e) => { setErr(tsrv(e.message)); setBusy(false); });
  };
  return (
    <div>
      <p>{t("La clôture va enregistrer l'écriture de résultat au 31/12/{year} ({result}), puis les à-nouveaux au 01/01/{next}, et verrouiller l'exercice. Seul le propriétaire pourra le rouvrir.", { year: j.year, result: (j.resultat >= 0 ? t('bénéfice') : t('perte')) + ' ' + money(Math.abs(j.resultat)), next: j.nextYear })}</p>
      <h3>{t('À-nouveaux qui seront reportés')}</h3>
      <CarryTable cf={j.carryForward} limit={12} />
      {failed.length ? (
        <>
          <p className="late" role="alert">{t('{n} contrôle(s) en échec :', { n: failed.length }) + ' ' + failed.map((c) => tsrv(c.label)).join(' ; ')}</p>
          {can('owner') ? <Check checked={force} onChange={setForce} label={t('Clôturer malgré tout (propriétaire)')} hint={t('À ne faire que si vous avez vérifié ces points.')} /> : <p className="muted small">{t('Corrigez ces points avant de clôturer, ou demandez au propriétaire de forcer la clôture.')}</p>}
        </>
      ) : null}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary small" type="button" disabled={busy || blocked} onClick={go}>{t("Clôturer l'exercice {year}", { year: j.year })}</button></div>
    </div>
  );
}

export default function YearEndTab({ year, setYear }) {
  const t = useT();
  const { oapi, money, dateFr, can, modal, toast, refresh } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/year-end?year=' + year), [year]);
  const done = () => { st.reload(); };
  const close = (j) => modal(t("Clôturer l'exercice {year}", { year: j.year }), (cl) => <CloseBox j={j} cl={cl} onDone={done} />, { wide: true });
  const reopen = (j) => modal(t("Rouvrir l'exercice {year}", { year: j.year }), (cl) => (
    <Form
      submitText={t("Rouvrir l'exercice")}
      fields={[{ k: 'reason', label: t('Motif de la réouverture (obligatoire)'), required: true, type: 'textarea', rows: 3, hint: t("Les écritures de résultat et d'à-nouveaux sont annulées par des écritures inverses, le verrou est levé. Le motif est conservé.") }]}
      onSubmit={(v) => oapi('POST', '/accounting/year-end/reopen', { year: Number(j.year), reason: v.reason }).then(() => { cl(); toast(t('Exercice rouvert.')); done(); refresh(); })}
    />
  ));
  return (
    <>
      <WorkNotice>{t("Document de travail : la clôture annuelle est une aide, à faire valider par un expert-comptable avant dépôt des états financiers.")}</WorkNotice>
      <YearBar year={year} setYear={setYear} />
      <Loaded state={st}>
        {(j) => {
          const checks = j.checks || [];
          const failed = checks.filter((c) => !c.ok).length;
          const cf = j.carryForward || { lines: [], totalDebit: 0, totalCredit: 0 };
          return (
            <>
              <div className="ws-card">
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <h2 className="grow">{t('Clôture de l\'exercice {year}', { year: j.year })}{' '}<span className={'pill ' + (j.closed ? 'good' : 'mid')}>{j.closed ? t('Clôturé') : t('Ouvert')}</span></h2>
                  {j.closed
                    ? (can('owner') ? <button className="btn small" type="button" onClick={() => reopen(j)}>{t('Rouvrir')}</button> : null)
                    : <button className="btn primary small" type="button" onClick={() => close(j)}>{t('Clôturer l\'exercice')}</button>}
                </div>
                <p>{(j.resultat >= 0 ? t('Bénéfice de l\'exercice : {amount}', { amount: money(j.resultat) }) : t('Perte de l\'exercice : {amount}', { amount: money(Math.abs(j.resultat)) }))}</p>
                {j.closed ? <p className="muted small">{t('Verrouillé jusqu\'au {date}. Aucune écriture ne peut plus être passée jusque-là.', { date: j.lockedUntil ? dateFr(j.lockedUntil) : '31/12/' + j.year })}{can('owner') ? '' : ' ' + t('Seul le propriétaire peut rouvrir un exercice clôturé.')}</p> : <p className="muted small">{t("Au 31/12, les comptes de charges et de produits sont soldés vers le résultat, et les soldes du bilan sont reportés au 01/01 de l'année suivante (à-nouveaux).")}</p>}
              </div>
              <div className="ws-card">
                <h2>{t('Contrôles avant clôture')}</h2>
                <p className="muted small">{failed ? t('{n} point(s) à régler avant de clôturer.', { n: failed }) : t('Tous les contrôles sont au vert.')}</p>
                {checks.map((c) => (
                  <div className="line" key={c.code} style={{ alignItems: 'flex-start' }}>
                    <span>{tsrv(c.label)}{c.detail ? <><br /><small className="muted">{tsrv(c.detail)}</small></> : null}</span>
                    <span className={'pill ' + (c.ok ? 'good' : 'bad')}>{c.ok ? t('Fait') : t('À régler')}</span>
                  </div>
                ))}
              </div>
              <div className="ws-card">
                <h2>{t('Aperçu des à-nouveaux au 01/01/{year}', { year: j.nextYear })}</h2>
                {!cf.lines.length ? <Empty text={t("Aucun solde de bilan à reporter pour l'instant : l'exercice n'a pas d'écriture.")} /> : <CarryTable cf={cf} />}
                <p className="muted small">{t("Aperçu : rien n'est enregistré tant que vous ne cliquez pas sur « Clôturer l'exercice ».")}</p>
              </div>
            </>
          );
        }}
      </Loaded>
    </>
  );
}
