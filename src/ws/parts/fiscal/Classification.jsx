import { Loading, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

/* Classement des comptes (classes 1 à 8, groupes, sous-comptes usuels) et lignes des soldes intermédiaires de gestion qui les utilisent.
   Les données viennent du serveur (tableau de correspondance modifiable) : rien n'est écrit en dur ici. */
export default function Classification() {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/fiscal/classification'), []);
  const j = st.data;
  if (st.loading && !j) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  return (
    <>
      <div className="ws-card">
        <h2>Classement des comptes (SYSCOHADA)</h2>
        <p className="small" role="note"><b>{j.notice}</b></p>
        {j.classes.map((c) => (
          <details key={c.class} style={{ borderTop: '1px solid var(--line)' }}>
            <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700 }}>{'Classe ' + c.class + ' : ' + c.label}</summary>
            {c.groups.map((g) => (
              <div className="line" key={g.prefix}>
                <span><b>{g.prefix}</b>{' ' + g.label}{g.sig.length ? <><br /><small>{'Soldes de gestion : ' + g.sig.join(', ')}</small></> : null}</span>
              </div>
            ))}
          </details>
        ))}
      </div>
      <div className="ws-card">
        <h2>Comptes usuels</h2>
        {j.usual.map((u) => <div className="line" key={u.code}><span><b>{u.code}</b>{' ' + u.label}</span>{u.sig ? <small>{u.sig}</small> : null}</div>)}
      </div>
    </>
  );
}
