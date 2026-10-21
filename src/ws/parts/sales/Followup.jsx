import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Form2, Pill } from './util.jsx';

/** Onglet « Relances » : modèles WhatsApp approuvés par Meta, prospects silencieux, factures impayées. */
export function Followup({ admin }) {
  const ws = useWs();
  const { oapi, money, dateFr, confirm, toast, fail } = ws;
  const st = useLoad(() => oapi('GET', '/sales/wa'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  if (!st.data) return null;
  const w = st.data;
  const reload = st.reload;
  const runSend = (kind) => oapi('POST', '/sales/wa/send', { kind }).then((r) => { toast(r.sent + ' message(s) envoyé(s)' + (r.failed ? ', ' + r.failed + ' en échec : ' + r.error : '') + '.'); reload(); }).catch(fail);
  return (
    <>
      {!w.connected ? <div className="ws-card"><h2>WhatsApp n'est pas connecté</h2><p>Connectez d'abord le numéro de l'entreprise (onglet Canaux) : les relances partent de ce numéro.</p></div> : null}
      <div className="ws-card">
        <h2>Modèles de messages (approuvés par Meta)</h2>
        <p className="muted small">WhatsApp interdit d'écrire librement à quelqu'un plus de 24 h après son dernier message : il faut un modèle, créé et approuvé dans le gestionnaire WhatsApp de Meta (en général quelques minutes à quelques heures). Enregistrez ici son nom exact.</p>
        {!w.templates.length ? <Empty text="Aucun modèle enregistré." /> : null}
        {w.templates.map((t) => (
          <div className="line" key={t.id}>
            <span><b>{t.name}</b><small>{' ' + (w.purposes[t.purpose] ? w.purposes[t.purpose].label : t.purpose) + ' · ' + t.language + ' · ' + t.params + ' variable(s)' + (t.preview ? ' · ' + t.preview : '')}</small></span>
            {admin ? <button className="link" type="button" onClick={() => confirm('Supprimer le modèle « ' + t.name + ' » de MANAGER-IA ? (Il reste dans Meta.)', () => oapi('DELETE', '/sales/wa/templates/' + t.id).then(reload).catch(fail))}>Supprimer</button> : null}
          </div>
        ))}
        {admin ? <div className="row" style={{ marginTop: 8 }}><button className="btn small" type="button" onClick={() => ws.modal('Ajouter un modèle WhatsApp', (close) => <AddTemplate w={w} close={close} done={reload} />)}>Ajouter un modèle</button></div> : null}
      </div>

      <div className="ws-card">
        <h2>{'Prospects à relancer (' + w.silent.length + ')'}</h2>
        <p className="muted small">Des prospects qui vous ont écrit il y a plus de 24 h (et moins de 7 jours) sans commander. Chacun n'est relancé qu'une fois. Ceux qui ont répondu STOP sont exclus.</p>
        {w.silent.slice(0, 8).map((l, i) => <div className="line" key={l.contact || i}><span><b>{l.name || '+' + l.contact}</b><small>{' dernier message le ' + dateFr(String(l.lastAt).slice(0, 10))}</small></span></div>)}
        {admin ? <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={!w.silent.length || !w.connected} onClick={() => runSend('relance')}>Relancer maintenant</button></div> : null}
      </div>

      <div className="ws-card">
        <h2>{'Factures impayées (' + w.overdue.length + ')'}</h2>
        <p className="muted small">Factures échues avec un numéro de téléphone. Un rappel au plus par semaine et par facture.</p>
        {w.overdue.slice(0, 8).map((i) => <div className="line" key={i.number}><span><b>{i.number + ' · ' + i.customer}</b><small>{' reste ' + money(i.left) + ' · échue le ' + dateFr(i.due)}</small></span></div>)}
        {admin ? <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={!w.overdue.length || !w.connected} onClick={() => runSend('impaye')}>Envoyer les rappels</button></div> : null}
      </div>

      {admin ? (
        <div className="ws-card">
          <h2>Relances automatiques</h2>
          <p>{w.autoFollowup ? 'Activées : chaque heure, MANAGER-IA relance les prospects silencieux et rappelle les factures échues (20 messages au plus par passage).' : 'Désactivées : vous envoyez les relances vous-même avec les boutons ci-dessus.'}</p>
          <button className="btn small" type="button" onClick={() => oapi('PUT', '/sales/wa/auto', { enabled: !w.autoFollowup }).then(reload).catch(fail)}>{w.autoFollowup ? 'Désactiver' : 'Activer'}</button>
          <p className="muted small">{'Envoyés sur 24 h : ' + w.sentToday + ' sur ' + w.dayCap + ' autorisés. Personnes désabonnées (STOP) : ' + w.optouts + '. Les messages par modèle sont facturés par Meta selon son tarif.'}</p>
        </div>
      ) : null}

      {w.log.length ? (
        <div className="ws-card">
          <h2>Derniers envois</h2>
          {w.log.slice(0, 10).map((l, i) => (
            <div className="line" key={i}>
              <span><b>{'+' + l.phone}</b><small>{' ' + l.template + ' · ' + dateFr(String(l.at).slice(0, 10)) + (l.error ? ' · ' + l.error : '')}</small></span>
              <Pill t={[l.status === 'sent' ? 'Envoyé' : 'Échec', l.status === 'sent' ? 'good' : 'bad']} />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function AddTemplate({ w, close, done }) {
  const { oapi } = useWs();
  const [purpose, setPurpose] = useState('relance');
  const p = w.purposes[purpose] || {};
  return (
    <>
      <Form2
        submitText="Enregistrer"
        onValues={(v) => setPurpose(v.purpose)}
        fields={[
          { k: 'purpose', label: 'Usage', type: 'select', options: Object.keys(w.purposes).map((k) => [k, w.purposes[k].label]), value: 'relance' },
          { k: 'name', label: 'Nom exact dans Meta (minuscules, chiffres, _)', required: true, hint: 'Exemple : relance_prospect' },
          { k: 'language', label: 'Langue', value: 'fr', hint: 'Exactement comme dans Meta (fr, fr_FR, en…)' },
          { k: 'preview', label: "Texte du modèle (pour l'affichage)", hint: 'Recopiez le texte approuvé, avec {{1}}, {{2}}…' },
        ]}
        onSubmit={(v) => oapi('POST', '/sales/wa/templates', v).then(() => { close(); done(); })}
      />
      <p className="muted small">{(p.hint ? 'Variables : ' + p.hint + '. ' : '') + (p.example ? 'Texte conseillé à créer dans Meta : « ' + p.example + ' »' : '')}</p>
    </>
  );
}
