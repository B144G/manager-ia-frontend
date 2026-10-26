import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form, Loading, useLoad } from '../../ui.jsx';
import { TAP } from '../finance/util.jsx';

/* Exercices : clôture (verrou des écritures jusqu'au 31 décembre) et réouverture du dernier exercice clôturé, avec motif. Honnête sur ce que la clôture fait ou non. */
export default function Exercises({ onChange }) {
  const t = useT();
  const { oapi, modal, confirm, toast, fail, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/exercises'), []);
  const j = st.data;
  const done = () => { st.reload(); if (onChange) onChange(); };
  const close = (y) => confirm(t("Clôturer l'exercice {year} ? Plus aucune écriture ne pourra être ajoutée jusqu'au 31 décembre {year}. Aucune écriture d'affectation du résultat n'est créée.", { year: y }), () => {
    oapi('POST', '/fiscal/exercises/' + y + '/close', {}).then(() => { toast(t('Exercice {year} clôturé.', { year: y })); done(); }).catch(fail);
  }, t('Clôturer'));
  const reopen = (y) => modal(t("Rouvrir l'exercice {year}", { year: y }), (closeModal) => (
    <Form
      submitText={t("Rouvrir l'exercice")}
      fields={[{ k: 'reason', label: t('Motif de la réouverture (obligatoire)'), required: true, type: 'textarea', rows: 3, hint: t("Conservé dans l'historique, le journal d'activité et le journal d'audit.") }]}
      onSubmit={(v) => oapi('POST', '/fiscal/exercises/' + y + '/reopen', v).then(() => { closeModal(); toast(t('Exercice {year} rouvert.', { year: y })); done(); })}
    />
  ));
  if (st.loading && !j) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  return (
    <>
      <div className="ws-card">
        <h2>{t('Exercices')}</h2>
        <p className="small">{j.lockedUntil ? t("Écritures verrouillées jusqu'au {date}.", { date: dateFr(j.lockedUntil) }) : t('Aucun exercice clôturé : toutes les écritures sont modifiables par ajout.')}</p>
        {j.years.map((y) => (
          <div className="line" key={y.year}>
            <span><b>{t('Exercice {year}', { year: y.year })}</b>{' '}<span className={'pill ' + (y.closed ? 'good' : 'mid')}>{y.closed ? t('Clôturé') : t('Ouvert')}</span><br /><small>{t('{n} écriture(s)', { n: y.entryCount })}</small></span>
            <span className="row" style={{ flexWrap: 'wrap' }}>
              {y.canClose ? <button className="link" type="button" style={TAP} onClick={() => close(y.year)}>{t('Clôturer')}</button> : null}
              {y.canReopen ? <button className="link" type="button" style={TAP} onClick={() => reopen(y.year)}>{t('Rouvrir')}</button> : null}
              {!y.closed && !y.canClose ? <small className="muted">{t('Pas encore terminé')}</small> : null}
            </span>
          </div>
        ))}
      </div>
      <div className="ws-card">
        <h2>{t('Ce que fait (et ne fait pas) la clôture')}</h2>
        {j.notes.map((n, i) => <p className="small" key={i}>{'• ' + t(n)}</p>)}
      </div>
      <div className="ws-card">
        <h2>{t('Historique')}</h2>
        {!j.history.length ? <p className="ws-empty">{t('Aucune clôture ni réouverture pour le moment.')}</p> : null}
        {j.history.map((h) => <div className="line" key={h.id}><span><b>{h.action === 'close' ? t('Clôture {year}', { year: h.year }) : t('Réouverture {year}', { year: h.year })}</b>{h.reason ? <><br /><small>{t('Motif : {reason}', { reason: h.reason })}</small></> : null}</span><small>{dateFr(String(h.at).slice(0, 10))}</small></div>)}
      </div>
    </>
  );
}
