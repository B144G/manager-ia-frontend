import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';

/* Sous-application : Agents spécialisés (équipe d'agents IA par domaine). Les agents LISENT vos données et conseillent : ils ne modifient jamais rien.
   Chaque réponse d'un agent compte pour un message IA du forfait de l'organisation. */

function Answer({ a }) {
  return (
    <div className="ws-card">
      <h2>{a.agent.name}</h2>
      <p className="muted small">{a.agent.role}</p>
      {a.error ? <p className="ws-err" role="alert">{a.error}</p> : <p className="ai-out" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.text}</p>}
      {a.data && a.data.length ? <p className="small muted">{'Données consultées : ' + a.data.map((d) => d.title).join(', ')}</p> : null}
    </div>
  );
}

function Result({ r }) {
  const s = r.synthesis;
  return (
    <>
      {r.routedByAI ? <p className="small muted">Aucun mot-clé reconnu : l'IA a choisi les agents les plus utiles (un message IA de plus).</p> : null}
      {r.answers.map((a) => <Answer key={a.agent.key} a={a} />)}
      {s ? (
        <div className="ws-card" style={{ borderColor: 'var(--signal)' }}>
          <h2>{'Synthèse : ' + s.agent.name}</h2>
          {s.error ? <p className="ws-err" role="alert">{s.error}</p> : null}
          {s.summary ? <p>{s.summary}</p> : null}
          {s.text ? <p className="ai-out" style={{ whiteSpace: 'pre-wrap' }}>{s.text}</p> : null}
          {s.agreements && s.agreements.length ? <><b>Points d'accord</b>{s.agreements.map((x, i) => <p className="small" key={i}>{'• ' + x}</p>)}</> : null}
          {s.disagreements && s.disagreements.length ? <><b>Points de désaccord</b>{s.disagreements.map((x, i) => <p className="small" key={i}>{'• ' + x}</p>)}</> : null}
          {s.actions && s.actions.length ? (
            <>
              <b>Les 3 actions à mener, par priorité</b>
              {s.actions.map((x) => (
                <div className="line" key={x.rank}>
                  <span><b>{x.rank + '. ' + x.title}</b>{x.why ? <><br /><small>{x.why}</small></> : null}</span>
                  {x.owner ? <small>{x.owner}</small> : null}
                </div>
              ))}
            </>
          ) : null}
          {s.data && s.data.length ? <p className="small muted">{'Données consultées : ' + s.data.map((d) => d.title).join(', ')}</p> : null}
        </div>
      ) : null}
      <p className="small muted">{"Les agents n'ont rien modifié dans vos données : c'est à vous de décider et d'agir."}</p>
    </>
  );
}

export default function Agents() {
  const { oapi, can, modal, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/agents'), []);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = (path, body) => {
    setBusy(true); setErr(''); setRes(null);
    oapi('POST', path, body).then((r) => { setRes(r); st.reload(); }, (e) => { setErr(e.message); if (e.status === 401) fail(e); }).then(() => setBusy(false));
  };
  const meeting = (ev) => { ev.preventDefault(); if (q.trim() && !busy) run('/agents/meeting', { question: q }); };

  const askOne = (a) => {
    modal('Poser une question : ' + a.name, (close) => (
      <Form
        fields={[{ k: 'question', label: 'Votre question', type: 'textarea', rows: 4, required: true, placeholder: 'Que dois-je surveiller cette semaine ?', hint: a.name + ' lit : ' + a.modules.map((m) => m.title).join(', ') + '.' }]}
        submitText="Envoyer"
        onSubmit={(v) => { close(); run('/agents/ask', { agent: a.key, question: v.question }); return Promise.resolve(); }}
      />
    ));
  };

  const settings = (a) => {
    modal('Réglages : ' + a.name, (close) => (
      <Form
        fields={[
          { k: 'enabled', label: 'Agent', type: 'select', options: [['1', 'Activé'], ['0', 'Désactivé']], value: a.enabled ? '1' : '0' },
          { k: 'extraPrompt', label: 'Consignes propres à votre entreprise', type: 'textarea', rows: 4, value: a.extraPrompt || '', hint: 'Facultatif (600 caractères). Exemple : « Parler de nos clients en gros avant les autres. » L\'agent reste en lecture seule.' },
        ]}
        submitText="Enregistrer"
        onSubmit={(v) => oapi('PUT', '/agents/' + a.key, { enabled: v.enabled === '1', extraPrompt: v.extraPrompt }).then(() => { close(); st.reload(); toast('Réglages enregistrés.'); })}
      />
    ));
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>Mon équipe d'agents</h1><p className="muted">Des agents IA spécialisés par domaine. Ils lisent vos données, donnent leur avis et proposent des actions : ils ne modifient jamais rien.</p></div>
      </div>
      <Loaded state={st}>{(j) => (
        <>
          <div className="kpis">
            <div className="stat"><b>{j.agents.filter((a) => a.available && a.enabled).length}</b><span>agents à votre service</span></div>
            <div className="stat"><b>{j.remaining}</b><span>messages IA restants</span></div>
          </div>
          {!j.enabled ? <p className="ws-err">{"L'IA n'est pas encore activée sur ce serveur : les agents ne peuvent pas répondre."}</p> : null}
          <div className="ws-card">
            <h2>Réunion d'agents</h2>
            <p className="muted small">{'Posez une question : les agents concernés répondent, puis l\'agent Direction fait la synthèse (accords, désaccords, 3 actions). Au plus ' + j.maxAgents + ' agents sont sollicités par question, chacun compte pour un message IA.'}</p>
            <form className="ws-form" onSubmit={meeting}>
              <label className="fld" htmlFor="ag_q"><span>Votre question</span>
                <textarea id="ag_q" rows={3} maxLength={1000} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Comment gérer mon stock de savon et les factures impayées ?" />
              </label>
              <div className="row"><button className="btn primary" type="submit" disabled={busy || !q.trim()}>{busy ? 'Les agents réfléchissent…' : 'Lancer la réunion'}</button></div>
            </form>
          </div>
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {res ? <Result r={res} /> : null}
          <h2 style={{ margin: '18px 0 10px' }}>Les agents</h2>
          <div className="kpis4">
            {j.agents.map((a) => (
              <div className="ws-card" key={a.key} style={{ opacity: a.available && a.enabled ? 1 : 0.65 }}>
                <h2>{a.name}</h2>
                <p className="muted small">{a.role}</p>
                <p className="small"><b>Ce qu'il surveille</b></p>
                {a.watches.map((w) => <p className="small" key={w}>{'• ' + w}</p>)}
                <p className="small muted">{'Lit : ' + a.modules.map((m) => m.title).join(', ')}</p>
                {!a.available ? <p className="small muted">{'Réservé : ' + a.minRoleLabel.toLowerCase() + ' et plus.'}</p> : null}
                {!a.enabled ? <p className="small muted">Désactivé par un administrateur.</p> : null}
                <div className="row">
                  <button className="btn signal small" type="button" disabled={!a.available || !a.enabled || busy} onClick={() => askOne(a)}>Poser une question</button>
                  {can('admin') ? <button className="btn small" type="button" onClick={() => settings(a)}>Réglages</button> : null}
                </div>
              </div>
            ))}
          </div>
          {!j.agents.length ? <Empty text="Aucun agent disponible." /> : null}
        </>
      )}
      </Loaded>
    </>
  );
}
