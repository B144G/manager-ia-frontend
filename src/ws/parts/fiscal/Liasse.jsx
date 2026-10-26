import { useWs } from '../../WsContext.jsx';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { BTN, INP, PrintFrame, downloadCsv } from '../finance/util.jsx';

/* Liasse de fin d'exercice (document de travail) : contrôles, soldes intermédiaires de gestion, compte de résultat, bilan. */
const LV = { error: ['À corriger', 'bad'], warn: ['À vérifier', 'mid'], info: ['Bon à savoir', 'good'] };

/** Anomalies renvoyées par le serveur en français : les messages qui contiennent des nombres sont reconstruits avec des variables. */
const num = (x) => Number(String(x).replace(/[\s\u202f\u00a0]/g, '').replace(',', '.')).toLocaleString(getLocale());
function issueText(t, i) {
  const x = i.text; let m;
  if (i.code === 'no-entries' && (m = /l'exercice (\d+)/.exec(x))) return t("Aucune écriture comptable sur l'exercice {year} : les états sont vides. Enregistrez vos écritures dans le module Comptabilité.", { year: m[1] });
  if (i.code === 'balance' && (m = /\(([^)]*)\).*\(([^)]*)\)/.exec(x))) return t('Le total des débits ({debit}) ne correspond pas au total des crédits ({credit}).', { debit: num(m[1]), credit: num(m[2]) });
  if (i.code === 'entry-unbalanced' && (m = /^(\d+) /.exec(x))) return t('{n} écriture(s) déséquilibrée(s) : corrigez-les par une écriture inverse puis une nouvelle écriture.', { n: m[1] });
  if (i.code === 'no-account' && (m = /: (\d+) compte/.exec(x))) return t("Des lignes d'écriture utilisent un compte absent du plan comptable (ou vide) : {n} compte(s).", { n: m[1] });
  if (i.code === 'bilan' && (m = /actif ([^ ]+(?: [^ ]+)*?) contre passif ([^)]*)\)/.exec(x))) return t("Le bilan n'est pas équilibré (actif {assets} contre passif {liabilities}).", { assets: num(m[1]), liabilities: num(m[2]) });
  if (i.code === 'carry-result' && (m = /affiche ([^ ]+) de résultat/.exec(x))) return t("Le bilan cumule les écritures depuis l'ouverture et affiche {amount} de résultat des exercices précédents non affecté. MANAGER-IA ne passe pas l'écriture d'affectation du résultat (réserves, report à nouveau, dividendes) : elle se décide en assemblée et se saisit en écriture diverse dans la Comptabilité.", { amount: num(m[1]) });
  return t(x);
}

const Row = ({ a, b, tot }) => <tr className={tot ? 'tot' : ''}><td>{a}</td><td className="r">{b}</td></tr>;

function Printable({ l, year }) {
  const t = useT();
  const { money, info } = useWs();
  return (
    <>
      <h1>{t("Document de travail de fin d'exercice {year}", { year })}</h1>
      <p className="muted">{info.org.name}</p>
      <p className="note" style={{ marginTop: 0 }}><b>{t(l.notice)}</b></p>
      <h2>{t('Soldes intermédiaires de gestion')}</h2>
      <table><tbody>{l.sig.lines.map((x) => <Row key={x.key} a={t(x.label)} b={money(x.amount)} tot={x.total} />)}</tbody></table>
      <h2>{t('Compte de résultat')}</h2>
      <table><tbody>
        <tr><th colSpan={2}>{t('Produits')}</th></tr>
        {l.resultat.produits.map((x) => <Row key={'p' + x.account} a={x.account + ' ' + t(x.label)} b={money(x.amount)} />)}
        <Row tot a={t("Total des produits")} b={money(l.resultat.totalProduits)} />
        <tr><th colSpan={2}>{t('Charges')}</th></tr>
        {l.resultat.charges.map((x) => <Row key={'c' + x.account} a={x.account + ' ' + t(x.label)} b={money(x.amount)} />)}
        <Row tot a={t("Total des charges")} b={money(l.resultat.totalCharges)} />
        <Row tot a={t("Résultat de l'exercice")} b={money(l.resultat.resultat)} />
      </tbody></table>
      <h2>{t('Bilan')}</h2>
      <table><tbody>
        <tr><th colSpan={2}>{t('Actif')}</th></tr>
        {l.bilan.actif.map((x) => <Row key={x.key} a={t(x.label)} b={money(x.amount)} />)}
        <Row tot a={t("Total actif")} b={money(l.bilan.totalActif)} />
        <tr><th colSpan={2}>{t('Passif')}</th></tr>
        {l.bilan.passif.map((x) => <Row key={x.key} a={t(x.label)} b={money(x.amount)} />)}
        <Row tot a={t("Total passif")} b={money(l.bilan.totalPassif)} />
      </tbody></table>
      <p className="note">{t(l.notice) + ' ' + t("Le format officiel dépend du pays : ce document n'est pas une liasse officielle.")}</p>
    </>
  );
}

export default function Liasse({ year, setYear }) {
  const t = useT();
  const { oapi, money, modal, info, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/liasse?year=' + year), [year]);
  const y = new Date().getFullYear();
  const years = [0, 1, 2, 3, 4].map((i) => String(y - i));
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  const l = st.data;
  const head = [[t('Document de travail préparé par MANAGER-IA, à faire valider par un expert-comptable avant tout dépôt officiel')], [info.org.name + ' · ' + t('exercice {year}', { year })], []];
  const csvBilan = () => downloadCsv('bilan-' + year + '.csv', head.concat([[t('Poste'), t('Montant')], [t('ACTIF'), '']], l.bilan.actif.map((x) => [t(x.label), x.amount]), [[t('Total actif'), l.bilan.totalActif], [t('PASSIF'), '']], l.bilan.passif.map((x) => [t(x.label), x.amount]), [[t('Total passif'), l.bilan.totalPassif]]));
  const csvRes = () => downloadCsv('compte-de-resultat-' + year + '.csv', head.concat([[t('Compte'), t('Libellé'), t('Montant')], ['', t('PRODUITS'), '']], l.resultat.produits.map((x) => [x.account, t(x.label), x.amount]), [['', t('Total des produits'), l.resultat.totalProduits], ['', t('CHARGES'), '']], l.resultat.charges.map((x) => [x.account, t(x.label), x.amount]), [['', t('Total des charges'), l.resultat.totalCharges], ['', t("Résultat de l'exercice"), l.resultat.resultat]]));
  const csvSig = () => downloadCsv('soldes-intermediaires-' + year + '.csv', head.concat([[t('Solde'), t('Montant')]], l.sig.lines.map((x) => [t(x.label), x.amount])));
  const issues = l.issues.filter((i) => i.level !== 'info'); const infos = l.issues.filter((i) => i.level === 'info');
  return (
    <>
      <div className="ws-card">
        <div className="row">
          <span className="muted small">{t('Exercice :')}</span>
          <select aria-label={t("Année")} style={INP} value={year} onChange={(e) => setYear(e.target.value)}>{years.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <span className="grow" />
          <button className="btn small" type="button" style={BTN} onClick={() => modal(t('Vue imprimable'), () => <PrintFrame title={t('Document de travail')} height="68vh"><Printable l={l} year={year} /></PrintFrame>, { wide: true })}>{t('Voir / imprimer')}</button>
        </div>
        <p className="small" role="note"><b>{t(l.notice)}</b></p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn small" type="button" style={BTN} onClick={csvBilan}>{t('Bilan (CSV)')}</button>
          <button className="btn small" type="button" style={BTN} onClick={csvRes}>{t('Résultat (CSV)')}</button>
          <button className="btn small" type="button" style={BTN} onClick={csvSig}>{t('Soldes de gestion (CSV)')}</button>
        </div>
      </div>
      <div className="ws-card">
        <h2>{t('À corriger avant dépôt')}</h2>
        {!issues.length && l.entryCount ? <p><span className="pill good">{t('Aucune anomalie bloquante')}</span> <span className="muted small">{t('Contrôles automatiques passés : relecture par un expert-comptable toujours nécessaire.')}</span></p> : null}
        {issues.map((i) => (
          <div className="line" key={i.code} style={{ display: 'block' }}>
            <span className={'pill ' + LV[i.level][1]}>{t(LV[i.level][0])}</span>{' ' + issueText(t, i)}
            {i.items.length ? <div className="muted small">{i.items.map((x) => t(x)).join(', ')}</div> : null}
          </div>
        ))}
        {infos.map((i) => <p className="muted small" key={i.code}>{'• ' + issueText(t, i)}</p>)}
      </div>
      {!l.entryCount ? <Empty text={t('Aucune écriture sur cet exercice : les états restent vides.')} /> : (
        <>
          <div className="ws-card">
            <h2>{t('Soldes intermédiaires de gestion')}</h2>
            {l.sig.lines.map((x) => <div className="line" key={x.key}><span>{x.total ? <b>{t(x.label)}</b> : t(x.label)}</span>{x.total ? <b>{money(x.amount)}</b> : <span>{money(x.amount)}</span>}</div>)}
            <p className="muted small">{t("Classement des comptes d'après leur numéro (SYSCOHADA, tableau dans l'onglet « Classement ») : à vérifier avec votre expert-comptable.")}</p>
          </div>
          <div className="ws-card">
            <h2>{t('Compte de résultat')}</h2>
            <div className="line"><span>{t('Total des produits')}</span><b>{money(l.resultat.totalProduits)}</b></div>
            <div className="line"><span>{t('Total des charges')}</span><b>{money(l.resultat.totalCharges)}</b></div>
            <div className="line"><span><b>{t("Résultat de l'exercice")}</b></span><b className={l.resultat.resultat < 0 ? 'late' : 'ok'}>{money(l.resultat.resultat)}</b></div>
          </div>
          <div className="ws-card">
            <h2>{t("Bilan (soldes cumulés depuis l'ouverture)")}</h2>
            <p className="muted small">{(l.exercise.closed ? t('Exercice {year} clôturé (verrou au {date})', { year, date: dateFr(l.exercise.lockedUntil) }) : t('Exercice {year} ouvert', { year })) + (l.carry.priorResult ? ' · ' + t('résultat des exercices précédents non affecté : {amount}', { amount: money(l.carry.priorResult) }) : '') + '.'}</p>
            {l.bilan.actif.map((x) => <div className="line" key={x.key}><span>{t(x.label)}</span><span>{money(x.amount)}</span></div>)}
            <div className="line"><span><b>{t('Total actif')}</b></span><b>{money(l.bilan.totalActif)}</b></div>
            {l.bilan.passif.map((x) => <div className="line" key={x.key}><span>{t(x.label)}</span><span>{money(x.amount)}</span></div>)}
            <div className="line"><span><b>{t('Total passif')}</b></span><b className={l.bilan.equilibre ? '' : 'late'}>{money(l.bilan.totalPassif)}</b></div>
          </div>
        </>
      )}
    </>
  );
}
