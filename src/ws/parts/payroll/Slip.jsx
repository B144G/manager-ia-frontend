import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { PrintFrame, monthLabel } from '../finance/util.jsx';

/* Bulletin de paie imprimable (page propre rendue par React). Les montants viennent du serveur : rien n'est recalculé ici. */
const R = ({ a, b, c, d, cls }) => <tr className={cls}><td>{a}</td><td className="r">{b}</td><td className="r">{c}</td><td className="r">{d}</td></tr>;

function Bulletin({ s, orgName }) {
  const t = useT();
  const { money, dateFr } = useWs();
  const emp = s.lines.filter((l) => l.kind === 'employee');
  const boss = s.lines.filter((l) => l.kind === 'employer');
  return (
    <>
      <h1>{t('Bulletin de paie : {month}', { month: monthLabel(s.month) })}</h1>
      <p className="muted">{orgName}</p>
      <p><b>{s.employee}</b>{s.job ? ' · ' + s.job : ''}</p>
      <table>
        <thead><tr><th>{t('Désignation')}</th><th className="r">{t('Base')}</th><th className="r">{t('Taux')}</th><th className="r">{t('Montant')}</th></tr></thead>
        <tbody>
          <R a={t("Salaire de base")} d={money(s.base)} />
          {s.bonuses ? <R a={t("Primes")} d={money(s.bonuses)} /> : null}
          {s.overtimeHours && s.overtimeHours.length
            ? s.overtimeHours.map((h, i) => <R key={'h' + i} a={t('Heures supplémentaires ({hours} h, +{rate} %)', { hours: h.hours, rate: h.rate })} b={money(h.hourly)} c={t('/ heure')} d={money(h.amount)} />)
            : (s.overtime ? <R a={t("Heures supplémentaires")} d={money(s.overtime)} /> : null)}
          {s.annualBonus ? <R a={s.annualBonusLabel || t('Prime annuelle')} d={money(s.annualBonus)} /> : null}
          <R cls="tot" a={t("Salaire brut")} d={money(s.gross)} />
          {emp.map((l, i) => <R key={'e' + i} a={l.label} b={money(l.basis)} c={l.rate + ' %'} d={'− ' + money(l.amount)} />)}
          {s.otherDeductions ? <R a={t("Autres retenues")} d={'− ' + money(s.otherDeductions)} /> : null}
          {s.advances ? <R a={t("Avances et acomptes déjà versés")} d={'− ' + money(s.advances)} /> : null}
          <R cls="tot" a={t("Net à payer")} d={money(s.net)} />
        </tbody>
      </table>
      <h2>{t("Charges de l'employeur")}</h2>
      <table>
        <tbody>
          {boss.length ? boss.map((l, i) => <R key={'b' + i} a={l.label} b={money(l.basis)} c={l.rate + ' %'} d={money(l.amount)} />) : <tr><td>{t('Aucune charge patronale paramétrée')}</td></tr>}
          <R cls="tot" a={t("Coût total employeur")} d={money(s.employerCost)} />
        </tbody>
      </table>
      <p>{s.status === 'paid' ? t('Payé le {date} ({method}).', { date: dateFr(s.paidDate), method: t(s.payMethodLabel || '') }) : s.status === 'validated' ? t('Bulletin validé, paiement à venir.') : t('Brouillon : non validé.')}</p>
      {s.reopenedCount ? <p className="muted">{t('Bulletin rouvert {n} fois. Dernier motif : {reason}', { n: s.reopenedCount, reason: s.reopenReason })}</p> : null}
      <p className="note">{t("Document de travail préparé avec MANAGER-IA. Les taux de retenues et de charges sont ceux paramétrés par votre entreprise : à vérifier auprès de votre administration ou d'un expert avant toute utilisation officielle.")}</p>
    </>
  );
}

export function SlipModal({ s }) {
  const t = useT();
  const { info } = useWs();
  return <PrintFrame title={t('Bulletin de {name}', { name: s.employee })} height="65vh"><Bulletin s={s} orgName={info.org.name} /></PrintFrame>;
}
