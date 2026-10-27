import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Loading, useLoad } from '../../ui.jsx';
import { INP } from '../finance/util.jsx';

/** Messages « ce qui manque » du serveur (français) : ceux qui contiennent le mois sont reconstruits avec une variable. */
function missingText(t, x) {
  let m;
  if ((m = /^Aucune TVA collectée \(comptes 443\) enregistrée en (\S+) :/.exec(x))) return t('Aucune TVA collectée (comptes 443) enregistrée en {month} : vos factures du mois ne sont peut-être pas encore comptabilisées (Comptabilité, écritures automatiques).', { month: m[1] });
  if ((m = /^Aucune TVA déductible \(comptes 445\) enregistrée en (\S+?)( : la TVA sur les achats.*)?\.$/.exec(x))) return m[2] ? t("Aucune TVA déductible (comptes 445) enregistrée en {month} : la TVA sur les achats n'est pas activée dans les réglages de la Comptabilité.", { month: m[1] }) : t('Aucune TVA déductible (comptes 445) enregistrée en {month}.', { month: m[1] });
  return t(x);
}

/* Estimation de la TVA du mois : TVA collectée (comptes 443) moins TVA déductible (comptes 445), d'après les écritures. */
export default function Vat() {
  const t = useT();
  const { oapi, money } = useWs();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/fiscal/vat?month=' + month), [month]);
  const v = st.data;
  return (
    <div className="ws-card">
      <div className="row">
        <h2 className="grow">{t('TVA du mois')}</h2>
        <input type="month" style={INP} value={month} aria-label={t("Mois")} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
      </div>
      {st.loading && !v ? <Loading /> : null}
      {st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
      {v ? (
        <>
          <div className="line"><span>{t('TVA collectée (sur vos ventes)')}</span><b>{money(v.collected)}</b></div>
          <div className="line"><span>{t('TVA déductible (sur vos achats)')}</span><b>{money(v.deductible)}</b></div>
          <div className="line"><span><b>{v.credit > 0 ? t('Crédit de TVA') : t('TVA à payer (estimation)')}</b></span><b className={v.credit > 0 ? 'ok' : ''}>{money(v.credit > 0 ? v.credit : v.due)}</b></div>
          {v.byAccount.collected.length || v.byAccount.deductible.length ? (
            <div style={{ marginTop: 10 }}>
              <p className="small"><b>{t('Détail par compte de TVA')}</b></p>
              {v.byAccount.collected.map((x) => <div className="line" key={'c' + x.account}><span>{t('Collectée') + ' · ' + x.account + ' ' + t(x.label)}{x.rate !== null ? ' (' + x.rate + ' %)' : ''}</span><span>{money(x.amount)}</span></div>)}
              {v.byAccount.deductible.map((x) => <div className="line" key={'d' + x.account}><span>{t('Déductible') + ' · ' + x.account + ' ' + t(x.label)}{x.rate !== null ? ' (' + x.rate + ' %)' : ''}</span><span>{money(x.amount)}</span></div>)}
            </div>
          ) : null}
          <p className="muted small">{t(v.rateNote)}</p>
          {v.missing.length ? (
            <div style={{ marginTop: 10 }}>
              <p className="small"><b>{t('Ce qui manque pour une estimation complète :')}</b></p>
              {v.missing.map((m, i) => <p className="small muted" key={i}>{'• ' + missingText(t, m)}</p>)}
            </div>
          ) : null}
          <p className="muted small">{t(v.notice) + ' ' + t('Document de travail préparé par Brij-IA, à faire valider par un expert-comptable avant tout dépôt officiel.')}</p>
        </>
      ) : null}
    </div>
  );
}
