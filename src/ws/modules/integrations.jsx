import { useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Intégrations (clés d'API et webhooks) pour relier MANAGER-IA à Zapier, Make, n8n ou votre site. Administrateurs. */

const base = API_BASE || window.location.origin;

function SecretBox({ title, intro, value }) {
  const { copy } = useWs();
  return (
    <>
      <p>{intro}</p>
      <input type="text" readOnly value={value} aria-label={title} onFocus={(e) => e.target.select()} />
      <div className="row" style={{ marginTop: 10 }}><button className="btn primary small" type="button" onClick={() => copy(value, 'Copié.')}>Copier</button></div>
    </>
  );
}

function HookForm({ d, close, onDone }) {
  const { oapi, modal } = useWs();
  const keys = Object.keys(d.events).filter((k) => k !== 'test');
  const [checked, setChecked] = useState(() => Object.fromEntries(keys.map((k) => [k, true])));
  return (
    <>
      <p className="muted small">Événements à envoyer :</p>
      <div>
        {keys.map((k) => (
          <label className="row" htmlFor={'ev_' + k} key={k} style={{ margin: '4px 0' }}>
            <input type="checkbox" id={'ev_' + k} checked={checked[k]} onChange={(e) => setChecked((s) => ({ ...s, [k]: e.target.checked }))} />
            <span>{d.events[k]}</span>
          </label>
        ))}
      </div>
      <Form
        fields={[{ k: 'url', label: 'Adresse (https://…)', required: true, placeholder: 'https://hooks.zapier.com/hooks/catch/…' }]}
        submitText="Ajouter"
        onSubmit={(v) => {
          const events = keys.filter((k) => checked[k]);
          return oapi('POST', '/integrations/webhooks', { url: v.url, events }).then((r) => {
            close(); onDone();
            modal('Secret de signature', () => <SecretBox title="Secret de signature" intro={r.note} value={r.secret} />);
          });
        }}
      />
    </>
  );
}

export default function Integrations() {
  const { oapi, modal, confirm, toast, fail, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/integrations'), []);
  const load = st.reload;
  const d = st.data;
  const fr = (i) => (i ? dateFr(String(i).slice(0, 10)) : 'jamais');
  const secretModal = (title, intro, value) => modal(title, () => <SecretBox title={title} intro={intro} value={value} />);

  const createKey = () => {
    modal('Nouvelle clé d\'API', (close) => (
      <Form
        fields={[{ k: 'name', label: 'Nom (ex. Zapier)', required: true }, { k: 'scope', label: 'Droits', type: 'select', options: [['read', 'Lecture seule'], ['write', 'Lecture et écriture (ajouter des clients)']] }]}
        submitText="Créer"
        onSubmit={(v) => oapi('POST', '/integrations/keys', v).then((r) => { close(); load(); secretModal('Votre clé d\'API', r.note, r.key); })}
      />
    ));
  };
  const addHook = () => { modal('Ajouter un webhook', (close) => <HookForm d={d} close={close} onDone={load} />); };

  return (
    <>
      <div className="ws-head"><div><h1>Intégrations</h1><p className="muted">Reliez MANAGER-IA à vos autres outils : Zapier, Make, n8n, votre site web…</p></div></div>
      <div>
        {st.loading ? <Loading /> : null}
        {!st.loading && st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
        {!st.loading && d ? (
          <>
            <div className="ws-card">
              <h2>Clés d'API</h2>
              <p className="muted small">Une clé permet à un outil externe de lire (et, si vous l'autorisez, d'ajouter) des clients dans votre organisation. Ne la partagez avec personne ; supprimez-la si vous la perdez.</p>
              {!d.keys.length ? <Empty text="Aucune clé." /> : null}
              {d.keys.map((k) => (
                <div className="line" key={k.id}>
                  <span><b>{k.name}</b><small>{' ' + k.prefix + '… · ' + (k.scope === 'write' ? 'lecture et écriture' : 'lecture seule') + ' · utilisée : ' + fr(k.lastUsed)}</small></span>
                  <button className="link" type="button" onClick={() => confirm('Supprimer la clé « ' + k.name + ' » ? Les outils qui l\'utilisent cesseront de fonctionner.', () => { oapi('DELETE', '/integrations/keys/' + k.id).then(load).catch(fail); })}>Supprimer</button>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}><button className="btn small" type="button" onClick={createKey}>Créer une clé</button></div>
            </div>

            <div className="ws-card">
              <h2>Webhooks (MANAGER-IA vous prévient)</h2>
              <p className="muted small">Quand un événement arrive, MANAGER-IA envoie un message à l'adresse que vous indiquez. Avec Zapier ou Make, choisissez le déclencheur « Webhook » (Catch Hook) et collez son adresse ici.</p>
              {!d.webhooks.length ? <Empty text="Aucun webhook." /> : null}
              {d.webhooks.map((w) => (
                <div className="line" style={{ display: 'block' }} key={w.id}>
                  <div className="row">
                    <b>{w.url.replace(/^(https?:\/\/[^/]+).*$/, '$1/…')}</b>
                    <span className={'pill ' + (w.active ? 'good' : 'bad')}>{w.active ? 'Actif' : 'Désactivé'}</span>
                    <span className="grow" />
                    <button className="link" type="button" onClick={() => { oapi('POST', '/integrations/webhooks/' + w.id + '/test', {}).then((r) => { toast(r.ok ? 'Test reçu (réponse ' + r.status + ').' : 'Échec : ' + r.status, !r.ok); load(); }).catch(fail); }}>Tester</button>
                    {!w.active ? <button className="link" type="button" onClick={() => { oapi('PUT', '/integrations/webhooks/' + w.id, { active: true }).then(load).catch(fail); }}>Réactiver</button> : null}
                    <button className="link" type="button" onClick={() => confirm('Supprimer ce webhook ?', () => { oapi('DELETE', '/integrations/webhooks/' + w.id).then(load).catch(fail); })}>Supprimer</button>
                  </div>
                  <small className="muted">{w.events.map((e) => d.events[e] || e).join(' · ') + (w.lastStatus ? ' · dernier envoi : ' + w.lastStatus : '')}</small>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}><button className="btn small" type="button" onClick={addHook}>Ajouter un webhook</button></div>
            </div>

            <div className="ws-card">
              <h2>Pour les développeurs</h2>
              <p className="muted small">API à utiliser avec une clé : GET /api/v1/customers, POST /api/v1/customers (nom + téléphone ou e-mail), GET /api/v1/orders, GET /api/v1/invoices?status=sent. 120 requêtes par minute et par clé. Chaque webhook est signé : vérifiez l'en-tête X-MIA-Signature (HMAC-SHA256 du corps avec votre secret).</p>
              <input type="text" readOnly aria-label="Exemple" value={'curl -H "Authorization: Bearer mia_…" ' + base + '/api/v1/customers'} onFocus={(e) => e.target.select()} />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
