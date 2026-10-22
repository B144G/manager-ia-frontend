import { useWs } from '../../WsContext.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { BTN, TAP } from '../finance/util.jsx';
import ObligationForm from './ObligationForm.jsx';

/* Calendrier fiscal paramétrable : vous créez vos échéances (les modèles ne sont que des exemples à confirmer). */
export default function Calendar({ onChange }) {
  const { oapi, modal, confirm, toast, fail, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/obligations'), []);
  const done = () => { st.reload(); if (onChange) onChange(); };
  const j = st.data;

  const form = (o, pre) => {
    modal(o ? "Modifier l'échéance" : 'Nouvelle échéance', (close) => (
      <ObligationForm o={o} pre={pre} lists={j} onDone={(r) => {
        close(); done();
        if (r && r.next) toast('Échéance suivante créée automatiquement pour le ' + dateFr(r.next.dueDate) + '.');
      }} />
    ));
  };
  const next = (o) => oapi('POST', '/fiscal/obligations/' + o.id + '/next', {}).then((r) => { toast('Échéance suivante créée pour le ' + dateFr(r.dueDate) + '.'); done(); }).catch(fail);

  if (st.loading && !j) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  return (
    <>
      <div className="ws-card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}><h2 className="grow" style={{ minWidth: 0 }}>Échéances</h2><button className="btn primary small" type="button" style={BTN} onClick={() => form()}>Ajouter une échéance</button></div>
        {j.late.length ? <p className="late small">{j.late.length + ' échéance(s) en retard.'}</p> : null}
        {j.soon.length ? <p className="small"><b>{j.soon.length + ' échéance(s) dans les 7 jours.'}</b></p> : null}
        {!j.items.length ? <Empty text="Aucune échéance. Ajoutez la vôtre ou partez d'un modèle ci-dessous." /> : null}
        {j.items.map((o) => (
          <div className="line" key={o.id} style={{ flexWrap: 'wrap' }}>
            <span>
              <b>{o.title}</b>{' '}
              {o.repeat ? <><span className="pill good" title="L'échéance suivante sera créée automatiquement">Répétée</span>{' '}</> : null}{o.late ? <span className="pill bad">En retard</span> : o.soon ? <span className="pill mid">Sous 7 jours</span> : <span className={'pill ' + (o.status === 'todo' ? 'mid' : 'good')}>{o.statusLabel}</span>}
              <br /><small>{'Avant le ' + dateFr(o.dueDate) + (o.period ? ' · ' + o.period : '') + (o.amount ? ' · ' + money(o.amount) : '') + (o.reference ? ' · Justificatif : ' + o.reference : '')}</small>
            </span>
            <span className="row" style={{ flexWrap: 'wrap' }}>
              <button className="link" type="button" style={TAP} onClick={() => form(o)}>Modifier</button>
              {o.recurrence !== 'none' && !o.repeat ? <button className="link" type="button" style={TAP} onClick={() => next(o)}>Créer la suivante</button> : null}
              <button className="link" type="button" style={TAP} onClick={() => confirm('Supprimer cette échéance ?', () => { oapi('DELETE', '/fiscal/obligations/' + o.id).then(done).catch(fail); })}>Supprimer</button>
            </span>
          </div>
        ))}
      </div>
      <div className="ws-card">
        <h2>Modèles d'exemple</h2>
        <p className="small"><b>À confirmer :</b> ces modèles ne sont pas la loi. Les dates et obligations dépendent de votre pays, de votre régime et de votre activité ; vérifiez-les auprès de votre administration ou de votre expert-comptable.</p>
        {j.templates.map((t) => (
          <div className="line" key={t.key}>
            <span>{t.title}<br /><small>{t.kindLabel + ' · ' + j.recurrences[t.recurrence] + ' · date proposée ' + dateFr(t.due)}</small></span>
            <button className="link" type="button" style={TAP} onClick={() => form(null, { title: t.title, kind: t.kind, dueDate: t.due, period: t.period, recurrence: t.recurrence, repeat: false, note: 'Modèle à confirmer.' })}>Utiliser</button>
          </div>
        ))}
      </div>
    </>
  );
}
