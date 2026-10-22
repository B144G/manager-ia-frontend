import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';

/* Calendrier fiscal paramétrable : vous créez vos échéances (les modèles ne sont que des exemples à confirmer). */
export default function Calendar({ onChange }) {
  const { oapi, modal, confirm, toast, fail, money, dateFr, info } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/obligations'), []);
  const done = () => { st.reload(); if (onChange) onChange(); };
  const j = st.data;

  const form = (o, pre) => {
    const e = o || pre || {};
    modal(o ? "Modifier l'échéance" : 'Nouvelle échéance', (close) => (
      <Form
        submitText="Enregistrer"
        fields={[
          { k: 'title', label: 'Nom', required: true, value: e.title },
          { k: 'kind', label: 'Type', type: 'select', options: Object.entries(j.kinds), value: e.kind || 'other' },
          { k: 'dueDate', label: 'Date limite', type: 'date', required: true, value: e.dueDate || e.due },
          { k: 'period', label: 'Période concernée', value: e.period, placeholder: 'Ex. septembre 2026' },
          { k: 'amount', label: 'Montant estimé (' + info.org.currency + ')', value: e.amount || '' },
          { k: 'status', label: 'Statut', type: 'select', options: Object.entries(j.statuses), value: e.status || 'todo' },
          { k: 'reference', label: 'Justificatif (référence, numéro de quittance…)', value: e.reference },
          { k: 'recurrence', label: 'Répétition', type: 'select', options: Object.entries(j.recurrences), value: e.recurrence || 'none' },
          { k: 'note', label: 'Remarque', value: e.note },
        ]}
        onSubmit={(v) => oapi(o ? 'PUT' : 'POST', '/fiscal/obligations' + (o ? '/' + o.id : ''), v).then(() => { close(); done(); })}
      />
    ));
  };
  const next = (o) => oapi('POST', '/fiscal/obligations/' + o.id + '/next', {}).then((r) => { toast('Échéance suivante créée pour le ' + dateFr(r.dueDate) + '.'); done(); }).catch(fail);

  if (st.loading && !j) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  return (
    <>
      <div className="ws-card">
        <div className="row"><h2 className="grow">Échéances</h2><button className="btn primary small" type="button" onClick={() => form()}>Ajouter une échéance</button></div>
        {j.late.length ? <p className="late small">{j.late.length + ' échéance(s) en retard.'}</p> : null}
        {j.soon.length ? <p className="small"><b>{j.soon.length + ' échéance(s) dans les 7 jours.'}</b></p> : null}
        {!j.items.length ? <Empty text="Aucune échéance. Ajoutez la vôtre ou partez d'un modèle ci-dessous." /> : null}
        {j.items.map((o) => (
          <div className="line" key={o.id} style={{ flexWrap: 'wrap' }}>
            <span>
              <b>{o.title}</b>{' '}
              {o.late ? <span className="pill bad">En retard</span> : o.soon ? <span className="pill mid">Sous 7 jours</span> : <span className={'pill ' + (o.status === 'todo' ? 'mid' : 'good')}>{o.statusLabel}</span>}
              <br /><small>{'Avant le ' + dateFr(o.dueDate) + (o.period ? ' · ' + o.period : '') + (o.amount ? ' · ' + money(o.amount) : '') + (o.reference ? ' · Justificatif : ' + o.reference : '')}</small>
            </span>
            <span className="row" style={{ flexWrap: 'wrap' }}>
              <button className="link" type="button" onClick={() => form(o)}>Modifier</button>
              {o.recurrence !== 'none' ? <button className="link" type="button" onClick={() => next(o)}>Créer la suivante</button> : null}
              <button className="link" type="button" onClick={() => confirm('Supprimer cette échéance ?', () => { oapi('DELETE', '/fiscal/obligations/' + o.id).then(done).catch(fail); })}>Supprimer</button>
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
            <button className="link" type="button" onClick={() => form(null, { title: t.title, kind: t.kind, dueDate: t.due, period: t.period, recurrence: t.recurrence, note: 'Modèle à confirmer.' })}>Utiliser</button>
          </div>
        ))}
      </div>
    </>
  );
}
