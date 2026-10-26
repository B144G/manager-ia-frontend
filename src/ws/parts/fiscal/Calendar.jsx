import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { BTN, TAP } from '../finance/util.jsx';
import ObligationForm from './ObligationForm.jsx';

/* Calendrier fiscal paramétrable : vous créez vos échéances (les modèles ne sont que des exemples à confirmer). */
export default function Calendar({ onChange }) {
  const t = useT();
  const { oapi, modal, confirm, toast, fail, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/obligations'), []);
  const done = () => { st.reload(); if (onChange) onChange(); };
  const j = st.data;

  const form = (o, pre) => {
    modal(o ? t("Modifier l'échéance") : t('Nouvelle échéance'), (close) => (
      <ObligationForm o={o} pre={pre} lists={j} onDone={(r) => {
        close(); done();
        if (r && r.next) toast(t('Échéance suivante créée automatiquement pour le {date}.', { date: dateFr(r.next.dueDate) }));
      }} />
    ));
  };
  const next = (o) => oapi('POST', '/fiscal/obligations/' + o.id + '/next', {}).then((r) => { toast(t('Échéance suivante créée pour le {date}.', { date: dateFr(r.dueDate) })); done(); }).catch(fail);

  if (st.loading && !j) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  return (
    <>
      <div className="ws-card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}><h2 className="grow" style={{ minWidth: 0 }}>{t('Échéances')}</h2><button className="btn primary small" type="button" style={BTN} onClick={() => form()}>{t('Ajouter une échéance')}</button></div>
        {j.late.length ? <p className="late small">{t('{n} échéance(s) en retard.', { n: j.late.length })}</p> : null}
        {j.soon.length ? <p className="small"><b>{t('{n} échéance(s) dans les 7 jours.', { n: j.soon.length })}</b></p> : null}
        {!j.items.length ? <Empty text={t("Aucune échéance. Ajoutez la vôtre ou partez d'un modèle ci-dessous.")} /> : null}
        {j.items.map((o) => (
          <div className="line" key={o.id} style={{ flexWrap: 'wrap' }}>
            <span>
              <b>{o.title}</b>{' '}
              {o.repeat ? <><span className="pill good" title={t("L'échéance suivante sera créée automatiquement")}>{t('Répétée')}</span>{' '}</> : null}{o.late ? <span className="pill bad">{t('En retard')}</span> : o.soon ? <span className="pill mid">{t('Sous 7 jours')}</span> : <span className={'pill ' + (o.status === 'todo' ? 'mid' : 'good')}>{t(o.statusLabel)}</span>}
              <br /><small>{t('Avant le {date}', { date: dateFr(o.dueDate) }) + (o.period ? ' · ' + o.period : '') + (o.amount ? ' · ' + money(o.amount) : '') + (o.reference ? ' · ' + t('Justificatif : {ref}', { ref: o.reference }) : '')}</small>
            </span>
            <span className="row" style={{ flexWrap: 'wrap' }}>
              <button className="link" type="button" style={TAP} onClick={() => form(o)}>{t('Modifier')}</button>
              {o.recurrence !== 'none' && !o.repeat ? <button className="link" type="button" style={TAP} onClick={() => next(o)}>{t('Créer la suivante')}</button> : null}
              <button className="link" type="button" style={TAP} onClick={() => confirm(t('Supprimer cette échéance ?'), () => { oapi('DELETE', '/fiscal/obligations/' + o.id).then(done).catch(fail); })}>{t('Supprimer')}</button>
            </span>
          </div>
        ))}
      </div>
      <div className="ws-card">
        <h2>{t("Modèles d'exemple")}</h2>
        <p className="small"><b>{t('À confirmer :')}</b> {t('ces modèles ne sont pas la loi. Les dates et obligations dépendent de votre pays, de votre régime et de votre activité ; vérifiez-les auprès de votre administration ou de votre expert-comptable.')}</p>
        {j.templates.map((m) => (
          <div className="line" key={m.key}>
            <span>{t(m.title)}<br /><small>{t(m.kindLabel) + ' · ' + t(j.recurrences[m.recurrence]) + ' · ' + t('date proposée {date}', { date: dateFr(m.due) })}</small></span>
            <button className="link" type="button" style={TAP} onClick={() => form(null, { title: t(m.title), kind: m.kind, dueDate: m.due, period: t(m.period), recurrence: m.recurrence, repeat: false, note: t('Modèle à confirmer.') })}>{t('Utiliser')}</button>
          </div>
        ))}
      </div>
    </>
  );
}
