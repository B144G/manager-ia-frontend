import { useWs } from '../../WsContext.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { PrintFrame, downloadCsv } from '../finance/util.jsx';

/* Liasse de fin d'exercice (document de travail) : contrôles, soldes intermédiaires de gestion, compte de résultat, bilan. */
const LV = { error: ['À corriger', 'bad'], warn: ['À vérifier', 'mid'], info: ['Bon à savoir', 'good'] };

const Row = ({ a, b, tot }) => <tr className={tot ? 'tot' : ''}><td>{a}</td><td className="r">{b}</td></tr>;

function Printable({ l, year }) {
  const { money, info } = useWs();
  return (
    <>
      <h1>{'Document de travail de fin d\'exercice ' + year}</h1>
      <p className="muted">{info.org.name}</p>
      <p className="note" style={{ marginTop: 0 }}><b>{l.notice}</b></p>
      <h2>Soldes intermédiaires de gestion</h2>
      <table><tbody>{l.sig.lines.map((x) => <Row key={x.key} a={x.label} b={money(x.amount)} tot={x.total} />)}</tbody></table>
      <h2>Compte de résultat</h2>
      <table><tbody>
        <tr><th colSpan={2}>Produits</th></tr>
        {l.resultat.produits.map((x) => <Row key={'p' + x.account} a={x.account + ' ' + x.label} b={money(x.amount)} />)}
        <Row tot a="Total des produits" b={money(l.resultat.totalProduits)} />
        <tr><th colSpan={2}>Charges</th></tr>
        {l.resultat.charges.map((x) => <Row key={'c' + x.account} a={x.account + ' ' + x.label} b={money(x.amount)} />)}
        <Row tot a="Total des charges" b={money(l.resultat.totalCharges)} />
        <Row tot a="Résultat de l'exercice" b={money(l.resultat.resultat)} />
      </tbody></table>
      <h2>Bilan</h2>
      <table><tbody>
        <tr><th colSpan={2}>Actif</th></tr>
        {l.bilan.actif.map((x) => <Row key={x.key} a={x.label} b={money(x.amount)} />)}
        <Row tot a="Total actif" b={money(l.bilan.totalActif)} />
        <tr><th colSpan={2}>Passif</th></tr>
        {l.bilan.passif.map((x) => <Row key={x.key} a={x.label} b={money(x.amount)} />)}
        <Row tot a="Total passif" b={money(l.bilan.totalPassif)} />
      </tbody></table>
      <p className="note">{l.notice + " Le format officiel dépend du pays : ce document n'est pas une liasse officielle."}</p>
    </>
  );
}

export default function Liasse({ year, setYear }) {
  const { oapi, money, modal, info } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/liasse?year=' + year), [year]);
  const y = new Date().getFullYear();
  const years = [0, 1, 2, 3, 4].map((i) => String(y - i));
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  const l = st.data;
  const head = [["Document de travail préparé par MANAGER-IA, à faire valider par un expert-comptable avant tout dépôt officiel"], [info.org.name + ' · exercice ' + year], []];
  const csvBilan = () => downloadCsv('bilan-' + year + '.csv', head.concat([['Poste', 'Montant'], ['ACTIF', '']], l.bilan.actif.map((x) => [x.label, x.amount]), [['Total actif', l.bilan.totalActif], ['PASSIF', '']], l.bilan.passif.map((x) => [x.label, x.amount]), [['Total passif', l.bilan.totalPassif]]));
  const csvRes = () => downloadCsv('compte-de-resultat-' + year + '.csv', head.concat([['Compte', 'Libellé', 'Montant'], ['', 'PRODUITS', '']], l.resultat.produits.map((x) => [x.account, x.label, x.amount]), [['', 'Total des produits', l.resultat.totalProduits], ['', 'CHARGES', '']], l.resultat.charges.map((x) => [x.account, x.label, x.amount]), [['', 'Total des charges', l.resultat.totalCharges], ['', "Résultat de l'exercice", l.resultat.resultat]]));
  const csvSig = () => downloadCsv('soldes-intermediaires-' + year + '.csv', head.concat([['Solde', 'Montant']], l.sig.lines.map((x) => [x.label, x.amount])));
  const issues = l.issues.filter((i) => i.level !== 'info'); const infos = l.issues.filter((i) => i.level === 'info');
  return (
    <>
      <div className="ws-card">
        <div className="row">
          <span className="muted small">Exercice :</span>
          <select aria-label="Année" value={year} onChange={(e) => setYear(e.target.value)}>{years.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <span className="grow" />
          <button className="btn small" type="button" onClick={() => modal('Vue imprimable', () => <PrintFrame title="Document de travail" height="68vh"><Printable l={l} year={year} /></PrintFrame>, { wide: true })}>Voir / imprimer</button>
        </div>
        <p className="small" role="note"><b>{l.notice}</b></p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn small" type="button" onClick={csvBilan}>Bilan (CSV)</button>
          <button className="btn small" type="button" onClick={csvRes}>Résultat (CSV)</button>
          <button className="btn small" type="button" onClick={csvSig}>Soldes de gestion (CSV)</button>
        </div>
      </div>
      <div className="ws-card">
        <h2>À corriger avant dépôt</h2>
        {!issues.length && l.entryCount ? <p><span className="pill good">Aucune anomalie bloquante</span> <span className="muted small">Contrôles automatiques passés : relecture par un expert-comptable toujours nécessaire.</span></p> : null}
        {issues.map((i) => (
          <div className="line" key={i.code} style={{ display: 'block' }}>
            <span className={'pill ' + LV[i.level][1]}>{LV[i.level][0]}</span>{' ' + i.text}
            {i.items.length ? <div className="muted small">{i.items.join(', ')}</div> : null}
          </div>
        ))}
        {infos.map((i) => <p className="muted small" key={i.code}>{'• ' + i.text}</p>)}
      </div>
      {!l.entryCount ? <Empty text="Aucune écriture sur cet exercice : les états restent vides." /> : (
        <>
          <div className="ws-card">
            <h2>Soldes intermédiaires de gestion</h2>
            {l.sig.lines.map((x) => <div className="line" key={x.key}><span>{x.total ? <b>{x.label}</b> : x.label}</span>{x.total ? <b>{money(x.amount)}</b> : <span>{money(x.amount)}</span>}</div>)}
            <p className="muted small">Classement simplifié des comptes d'après leur numéro (SYSCOHADA) : à vérifier avec votre expert-comptable.</p>
          </div>
          <div className="ws-card">
            <h2>Compte de résultat</h2>
            <div className="line"><span>Total des produits</span><b>{money(l.resultat.totalProduits)}</b></div>
            <div className="line"><span>Total des charges</span><b>{money(l.resultat.totalCharges)}</b></div>
            <div className="line"><span><b>Résultat de l'exercice</b></span><b className={l.resultat.resultat < 0 ? 'late' : 'ok'}>{money(l.resultat.resultat)}</b></div>
          </div>
          <div className="ws-card">
            <h2>Bilan</h2>
            {l.bilan.actif.map((x) => <div className="line" key={x.key}><span>{x.label}</span><span>{money(x.amount)}</span></div>)}
            <div className="line"><span><b>Total actif</b></span><b>{money(l.bilan.totalActif)}</b></div>
            {l.bilan.passif.map((x) => <div className="line" key={x.key}><span>{x.label}</span><span>{money(x.amount)}</span></div>)}
            <div className="line"><span><b>Total passif</b></span><b className={l.bilan.equilibre ? '' : 'late'}>{money(l.bilan.totalPassif)}</b></div>
          </div>
        </>
      )}
    </>
  );
}
