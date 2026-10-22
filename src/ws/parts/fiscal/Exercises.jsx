import { useWs } from '../../WsContext.jsx';
import { Form, Loading, useLoad } from '../../ui.jsx';
import { TAP } from '../finance/util.jsx';

/* Exercices : clôture (verrou des écritures jusqu'au 31 décembre) et réouverture du dernier exercice clôturé, avec motif. Honnête sur ce que la clôture fait ou non. */
export default function Exercises({ onChange }) {
  const { oapi, modal, confirm, toast, fail, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/exercises'), []);
  const j = st.data;
  const done = () => { st.reload(); if (onChange) onChange(); };
  const close = (y) => confirm("Clôturer l'exercice " + y + " ? Plus aucune écriture ne pourra être ajoutée jusqu'au 31 décembre " + y + ". Aucune écriture d'affectation du résultat n'est créée.", () => {
    oapi('POST', '/fiscal/exercises/' + y + '/close', {}).then(() => { toast('Exercice ' + y + ' clôturé.'); done(); }).catch(fail);
  }, 'Clôturer');
  const reopen = (y) => modal("Rouvrir l'exercice " + y, (closeModal) => (
    <Form
      submitText="Rouvrir l'exercice"
      fields={[{ k: 'reason', label: 'Motif de la réouverture (obligatoire)', required: true, type: 'textarea', rows: 3, hint: "Conservé dans l'historique, le journal d'activité et le journal d'audit." }]}
      onSubmit={(v) => oapi('POST', '/fiscal/exercises/' + y + '/reopen', v).then(() => { closeModal(); toast('Exercice ' + y + ' rouvert.'); done(); })}
    />
  ));
  if (st.loading && !j) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  return (
    <>
      <div className="ws-card">
        <h2>Exercices</h2>
        <p className="small">{j.lockedUntil ? 'Écritures verrouillées jusqu\'au ' + dateFr(j.lockedUntil) + '.' : 'Aucun exercice clôturé : toutes les écritures sont modifiables par ajout.'}</p>
        {j.years.map((y) => (
          <div className="line" key={y.year}>
            <span><b>{'Exercice ' + y.year}</b>{' '}<span className={'pill ' + (y.closed ? 'good' : 'mid')}>{y.closed ? 'Clôturé' : 'Ouvert'}</span><br /><small>{y.entryCount + ' écriture(s)'}</small></span>
            <span className="row" style={{ flexWrap: 'wrap' }}>
              {y.canClose ? <button className="link" type="button" style={TAP} onClick={() => close(y.year)}>Clôturer</button> : null}
              {y.canReopen ? <button className="link" type="button" style={TAP} onClick={() => reopen(y.year)}>Rouvrir</button> : null}
              {!y.closed && !y.canClose ? <small className="muted">Pas encore terminé</small> : null}
            </span>
          </div>
        ))}
      </div>
      <div className="ws-card">
        <h2>Ce que fait (et ne fait pas) la clôture</h2>
        {j.notes.map((n, i) => <p className="small" key={i}>{'• ' + n}</p>)}
      </div>
      <div className="ws-card">
        <h2>Historique</h2>
        {!j.history.length ? <p className="ws-empty">Aucune clôture ni réouverture pour le moment.</p> : null}
        {j.history.map((h) => <div className="line" key={h.id}><span><b>{(h.action === 'close' ? 'Clôture ' : 'Réouverture ') + h.year}</b>{h.reason ? <><br /><small>{'Motif : ' + h.reason}</small></> : null}</span><small>{dateFr(String(h.at).slice(0, 10))}</small></div>)}
      </div>
    </>
  );
}
