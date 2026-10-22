import { useWs } from '../../WsContext.jsx';
import { PrintFrame, monthLabel } from '../finance/util.jsx';

/* Bulletin de paie imprimable (page propre rendue par React). Les montants viennent du serveur : rien n'est recalculé ici. */
const R = ({ a, b, c, d, cls }) => <tr className={cls}><td>{a}</td><td className="r">{b}</td><td className="r">{c}</td><td className="r">{d}</td></tr>;

function Bulletin({ s, orgName }) {
  const { money, dateFr } = useWs();
  const emp = s.lines.filter((l) => l.kind === 'employee');
  const boss = s.lines.filter((l) => l.kind === 'employer');
  return (
    <>
      <h1>{'Bulletin de paie : ' + monthLabel(s.month)}</h1>
      <p className="muted">{orgName}</p>
      <p><b>{s.employee}</b>{s.job ? ' · ' + s.job : ''}</p>
      <table>
        <thead><tr><th>Désignation</th><th className="r">Base</th><th className="r">Taux</th><th className="r">Montant</th></tr></thead>
        <tbody>
          <R a="Salaire de base" d={money(s.base)} />
          {s.bonuses ? <R a="Primes" d={money(s.bonuses)} /> : null}
          {s.overtime ? <R a="Heures supplémentaires" d={money(s.overtime)} /> : null}
          <R cls="tot" a="Salaire brut" d={money(s.gross)} />
          {emp.map((l, i) => <R key={'e' + i} a={l.label} b={money(l.basis)} c={l.rate + ' %'} d={'− ' + money(l.amount)} />)}
          {s.otherDeductions ? <R a="Autres retenues" d={'− ' + money(s.otherDeductions)} /> : null}
          {s.advances ? <R a="Avances et acomptes déjà versés" d={'− ' + money(s.advances)} /> : null}
          <R cls="tot" a="Net à payer" d={money(s.net)} />
        </tbody>
      </table>
      <h2>Charges de l'employeur</h2>
      <table>
        <tbody>
          {boss.length ? boss.map((l, i) => <R key={'b' + i} a={l.label} b={money(l.basis)} c={l.rate + ' %'} d={money(l.amount)} />) : <tr><td>Aucune charge patronale paramétrée</td></tr>}
          <R cls="tot" a="Coût total employeur" d={money(s.employerCost)} />
        </tbody>
      </table>
      <p>{s.status === 'paid' ? 'Payé le ' + dateFr(s.paidDate) + ' (' + s.payMethodLabel + ').' : s.status === 'validated' ? 'Bulletin validé, paiement à venir.' : 'Brouillon : non validé.'}</p>
      <p className="note">Document de travail préparé avec MANAGER-IA. Les taux de retenues et de charges sont ceux paramétrés par votre entreprise : à vérifier auprès de votre administration ou d'un expert avant toute utilisation officielle.</p>
    </>
  );
}

export function SlipModal({ s }) {
  const { info } = useWs();
  return <PrintFrame title={'Bulletin de ' + s.employee} height="65vh"><Bulletin s={s} orgName={info.org.name} /></PrintFrame>;
}
