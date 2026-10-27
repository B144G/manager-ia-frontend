import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { ActionButtons, Schedule } from '../parts/w3/AgentExtras.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';

/* Sous-application : Agents spécialisés (équipe d'agents IA par domaine). Les agents LISENT vos données et conseillent : ils ne modifient jamais rien.
   Chaque réponse d'un agent compte pour un message IA du forfait de l'organisation. */

function Answer({ a }) {
  const t = useT();
  return (
    <div className="ws-card">
      <h2>{t(a.agent.name)}</h2>
      <p className="muted small">{t(a.agent.role)}</p>
      {a.error ? <p className="ws-err" role="alert">{t(a.error)}</p> : <p className="ai-out" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.text}</p>}
      {a.data && a.data.length ? <p className="small muted">{t('Données consultées : {list}', { list: a.data.map((d) => t(d.title)).join(', ') })}</p> : null}
    </div>
  );
}

function Result({ r }) {
  const t = useT();
  const s = r.synthesis;
  return (
    <>
      {r.routedByAI ? <p className="small muted">{t("Aucun mot-clé reconnu : l'IA a choisi les agents les plus utiles (un message IA de plus).")}</p> : null}
      {r.answers.map((a) => <Answer key={a.agent.key} a={a} />)}
      {s ? (
        <div className="ws-card" style={{ borderColor: 'var(--signal)' }}>
          <h2>{t('Synthèse : {name}', { name: t(s.agent.name) })}</h2>
          {s.error ? <p className="ws-err" role="alert">{t(s.error)}</p> : null}
          {s.summary ? <p>{s.summary}</p> : null}
          {s.text ? <p className="ai-out" style={{ whiteSpace: 'pre-wrap' }}>{s.text}</p> : null}
          {s.agreements && s.agreements.length ? <><b>{t("Points d'accord")}</b>{s.agreements.map((x, i) => <p className="small" key={i}>{'• ' + x}</p>)}</> : null}
          {s.disagreements && s.disagreements.length ? <><b>{t('Points de désaccord')}</b>{s.disagreements.map((x, i) => <p className="small" key={i}>{'• ' + x}</p>)}</> : null}
          {s.actions && s.actions.length ? (
            <>
              <b>{t('Les 3 actions à mener, par priorité')}</b>
              {s.actions.map((x) => (
                <div className="line" key={x.rank}>
                  <span><b>{x.rank + '. ' + x.title}</b>{x.why ? <><br /><small>{x.why}</small></> : null}</span>
                  {x.owner ? <small>{x.owner}</small> : null}
                  <ActionButtons x={x} />
                </div>
              ))}
            </>
          ) : null}
          {s.data && s.data.length ? <p className="small muted">{t('Données consultées : {list}', { list: s.data.map((d) => t(d.title)).join(', ') })}</p> : null}
        </div>
      ) : null}
      <p className="small muted">{t("Les agents n'ont rien modifié dans vos données : c'est à vous de décider et d'agir.")}</p>
    </>
  );
}

export default function Agents() {
  const t = useT();
  const { oapi, can, modal, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/agents'), []);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = (path, body) => {
    setBusy(true); setErr(''); setRes(null);
    oapi('POST', path, body).then((r) => { setRes(r); st.reload(); }, (e) => { setErr(t(e.message)); if (e.status === 401) fail(e); }).then(() => setBusy(false));
  };
  const meeting = (ev) => { ev.preventDefault(); if (q.trim() && !busy) run('/agents/meeting', { question: q }); };

  const askOne = (a) => {
    modal(t('Poser une question : {name}', { name: t(a.name) }), (close) => (
      <Form
        fields={[{ k: 'question', label: t('Votre question'), type: 'textarea', rows: 4, required: true, placeholder: t('Que dois-je surveiller cette semaine ?'), hint: t('{name} lit : {list}.', { name: t(a.name), list: a.modules.map((m) => t(m.title)).join(', ') }) }]}
        submitText={t("Envoyer")}
        onSubmit={(v) => { close(); run('/agents/ask', { agent: a.key, question: v.question }); return Promise.resolve(); }}
      />
    ));
  };

  const settings = (a) => {
    modal(t('Réglages : {name}', { name: t(a.name) }), (close) => (
      <Form
        fields={[
          { k: 'enabled', label: t('Agent'), type: 'select', options: [['1', t('Activé')], ['0', t('Désactivé')]], value: a.enabled ? '1' : '0' },
          { k: 'extraPrompt', label: t('Consignes propres à votre entreprise'), type: 'textarea', rows: 4, value: a.extraPrompt || '', hint: t("Facultatif (600 caractères). Exemple : « Parler de nos clients en gros avant les autres. » L'agent reste en lecture seule.") },
        ]}
        submitText={t("Enregistrer")}
        onSubmit={(v) => oapi('PUT', '/agents/' + a.key, { enabled: v.enabled === '1', extraPrompt: v.extraPrompt }).then(() => { close(); st.reload(); toast(t('Réglages enregistrés.')); })}
      />
    ));
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>{t("Mon équipe d'agents")}</h1><p className="muted">{t('Des agents IA spécialisés par domaine. Ils lisent vos données, donnent leur avis et proposent des actions : ils ne modifient jamais rien.')}</p></div>
      </div>
      <Loaded state={st}>{(j) => (
        <>
          <div className="kpis">
            <div className="stat"><b>{j.agents.filter((a) => a.available && a.enabled).length}</b><span>{t('agents à votre service')}</span></div>
            <div className="stat"><b>{j.remaining}</b><span>{t('messages IA restants')}</span></div>
          </div>
          <Schedule />
          {!j.enabled ? <p className="ws-err">{t("L'IA n'est pas encore activée sur ce serveur : les agents ne peuvent pas répondre.")}</p> : null}
          <div className="ws-card">
            <h2>{t("Réunion d'agents")}</h2>
            <p className="muted small">{t("Posez une question : les agents concernés répondent, puis l'agent Direction fait la synthèse (accords, désaccords, 3 actions). Au plus {n} agents sont sollicités par question, chacun compte pour un message IA.", { n: j.maxAgents })}</p>
            <form className="ws-form" onSubmit={meeting}>
              <label className="fld" htmlFor="ag_q"><span>{t('Votre question')}</span>
                <textarea id="ag_q" rows={3} maxLength={1000} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Comment gérer mon stock de savon et les factures impayées ?')} />
              </label>
              <div className="row"><button className="btn primary" type="submit" disabled={busy || !q.trim()}>{busy ? t('Les agents réfléchissent…') : t('Lancer la réunion')}</button></div>
            </form>
          </div>
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {res ? <Result r={res} /> : null}
          <h2 style={{ margin: '18px 0 10px' }}>{t('Les agents')}</h2>
          <div className="kpis4">
            {j.agents.map((a) => (
              <div className="ws-card" key={a.key} style={{ opacity: a.available && a.enabled ? 1 : 0.65 }}>
                <h2>{t(a.name)}</h2>
                <p className="muted small">{t(a.role)}</p>
                <p className="small"><b>{t("Ce qu'il surveille")}</b></p>
                {a.watches.map((w) => <p className="small" key={w}>{'• ' + t(w)}</p>)}
                <p className="small muted">{t('Lit : {list}', { list: a.modules.map((m) => t(m.title)).join(', ') })}</p>
                {!a.available ? <p className="small muted">{t('Réservé : {role} et plus.', { role: t(a.minRoleLabel) })}</p> : null}
                {!a.enabled ? <p className="small muted">{t('Désactivé par un administrateur.')}</p> : null}
                <div className="row">
                  <button className="btn signal small" type="button" disabled={!a.available || !a.enabled || busy} onClick={() => askOne(a)}>{t('Poser une question')}</button>
                  {can('admin') ? <button className="btn small" type="button" onClick={() => settings(a)}>{t('Réglages')}</button> : null}
                </div>
              </div>
            ))}
          </div>
          {!j.agents.length ? <Empty text={t('Aucun agent disponible.')} /> : null}
        </>
      )}
      </Loaded>
    </>
  );
}
