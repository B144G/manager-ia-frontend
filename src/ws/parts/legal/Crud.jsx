import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Act, Btn } from './Act.jsx';

/**
 * Liste modifiable générique du module Juridique : charge `path`, affiche `data[listKey]` (ligne : `line(item, data)`),
 * bouton d'ajout, modification et suppression avec confirmation. `fields(item, data)` décrit le formulaire.
 */
export default function Crud({ path, listKey, title, intro, addLabel, formTitle, empty, fields, line, extra, presets, deleteText, onChange, payload }) {
  const { oapi, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', path), []);
  const reload = () => { st.reload(); if (onChange) onChange(); };
  const edit = (item, data, preset) => modal(item ? 'Modifier' : formTitle, (close) => (
    <Form
      submitText="Enregistrer"
      fields={fields(item || preset || null, data)}
      onSubmit={(v) => oapi(item ? 'PUT' : 'POST', path + (item ? '/' + item.id : ''), payload ? payload(v) : v).then(() => { close(); reload(); })}
    />
  ), { wide: true });
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>{title}</h2><Btn className="btn primary small" onClick={() => edit(null, st.data)} disabled={!st.data}>{addLabel}</Btn></div>
      {intro ? <p className="muted small">{intro}</p> : null}
      <Loaded state={st}>{(j) => (
        <>
          {presets ? (
            <div className="row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
              <small className="muted">{'Exemples à adapter à votre pays et votre activité : '}</small>
              {presets.map((p) => <Btn key={p.label} className="btn small" onClick={() => edit(null, j, p.values)}>{p.label}</Btn>)}
            </div>
          ) : null}
          {!j[listKey].length ? <Empty text={empty} /> : null}
          {j[listKey].map((it) => (
            <div className="line" key={it.id} style={{ flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 240px' }}>{line(it, j)}</span>
              <span className="row" style={{ flexWrap: 'wrap' }}>
                {extra ? extra(it, reload) : null}
                <Act onClick={() => edit(it, j)}>Modifier</Act>
                <Act onClick={() => confirm(deleteText, () => { oapi('DELETE', path + '/' + it.id).then(reload).catch(fail); })}>Supprimer</Act>
              </span>
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
