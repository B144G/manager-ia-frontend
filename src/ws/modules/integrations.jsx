import { useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Intégrations (clés d'API et webhooks) pour relier MANAGER-IA à Zapier, Make, n8n ou votre site. Administrateurs. */

const base = API_BASE || window.location.origin;

function SecretBox({ title, intro, value }) {
  const { copy } = useWs();
  const t = useT();
  return (
    <>
      <p>{tsrv(intro)}</p>
      <input type="text" readOnly value={value} aria-label={t(title)} onFocus={(e) => e.target.select()} />
      <div className="row" style={{ marginTop: 10 }}><button className="btn primary small" type="button" onClick={() => copy(value, t('Copié.'))}>{t('Copier')}</button></div>
    </>
  );
}

function HookForm({ d, close, onDone }) {
  const { oapi, modal } = useWs();
  const t = useT();
  const keys = Object.keys(d.events).filter((k) => k !== 'test');
  const [checked, setChecked] = useState(() => Object.fromEntries(keys.map((k) => [k, true])));
  return (
    <>
      <p className="muted small">{t('Événements à envoyer :')}</p>
      <div>
        {keys.map((k) => (
          <label className="row" htmlFor={'ev_' + k} key={k} style={{ margin: '4px 0' }}>
            <input type="checkbox" id={'ev_' + k} checked={checked[k]} onChange={(e) => setChecked((s) => ({ ...s, [k]: e.target.checked }))} />
            <span>{t(d.events[k])}</span>
          </label>
        ))}
      </div>
      <Form
        fields={[{ k: 'url', label: t('Adresse (https://…)'), required: true, placeholder: 'https://hooks.zapier.com/hooks/catch/…' }]}
        submitText={t('Ajouter')}
        onSubmit={(v) => {
          const events = keys.filter((k) => checked[k]);
          return oapi('POST', '/integrations/webhooks', { url: v.url, events }).then((r) => {
            close(); onDone();
            modal(t('Secret de signature'), () => <SecretBox title={t('Secret de signature')} intro={r.note} value={r.secret} />);
          });
        }}
      />
    </>
  );
}

export default function Integrations() {
  const { oapi, modal, confirm, toast, fail, dateFr } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/integrations'), []);
  const load = st.reload;
  const d = st.data;
  const fr = (i) => (i ? dateFr(String(i).slice(0, 10)) : t('jamais'));
  const secretModal = (title, intro, value) => modal(title, () => <SecretBox title={title} intro={intro} value={value} />);

  const createKey = () => {
    modal(t("Nouvelle clé d'API"), (close) => (
      <Form
        fields={[{ k: 'name', label: t('Nom (ex. Zapier)'), required: true }, { k: 'scope', label: t('Droits'), type: 'select', options: [['read', t('Lecture seule')], ['write', t('Lecture et écriture (ajouter des clients)')]] }]}
        submitText={t('Créer')}
        onSubmit={(v) => oapi('POST', '/integrations/keys', v).then((r) => { close(); load(); secretModal(t("Votre clé d'API"), r.note, r.key); })}
      />
    ));
  };
  const addHook = () => { modal(t('Ajouter un webhook'), (close) => <HookForm d={d} close={close} onDone={load} />); };

  return (
    <>
      <div className="ws-head"><div><h1>{t('Intégrations')}</h1><p className="muted">{t('Reliez MANAGER-IA à vos autres outils : Zapier, Make, n8n, votre site web…')}</p></div></div>
      <div>
        {st.loading ? <Loading /> : null}
        {!st.loading && st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
        {!st.loading && d ? (
          <>
            <div className="ws-card">
              <h2>{t("Clés d'API")}</h2>
              <p className="muted small">{t("Une clé permet à un outil externe de lire (et, si vous l'autorisez, d'ajouter) des clients dans votre organisation. Ne la partagez avec personne ; supprimez-la si vous la perdez.")}</p>
              {!d.keys.length ? <Empty text={t('Aucune clé.')} /> : null}
              {d.keys.map((k) => (
                <div className="line" key={k.id}>
                  <span><b>{k.name}</b><small>{' ' + k.prefix + '… · ' + (k.scope === 'write' ? t('lecture et écriture') : t('lecture seule')) + ' · ' + t('utilisée : {date}', { date: fr(k.lastUsed) })}</small></span>
                  <button className="link" type="button" onClick={() => confirm(t("Supprimer la clé « {name} » ? Les outils qui l'utilisent cesseront de fonctionner.", { name: k.name }), () => { oapi('DELETE', '/integrations/keys/' + k.id).then(load).catch(fail); })}>{t('Supprimer')}</button>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}><button className="btn small" type="button" onClick={createKey}>{t('Créer une clé')}</button></div>
            </div>

            <div className="ws-card">
              <h2>{t('Webhooks (MANAGER-IA vous prévient)')}</h2>
              <p className="muted small">{t("Quand un événement arrive, MANAGER-IA envoie un message à l'adresse que vous indiquez. Avec Zapier ou Make, choisissez le déclencheur « Webhook » (Catch Hook) et collez son adresse ici.")}</p>
              {!d.webhooks.length ? <Empty text={t('Aucun webhook.')} /> : null}
              {d.webhooks.map((w) => (
                <div className="line" style={{ display: 'block' }} key={w.id}>
                  <div className="row">
                    <b>{w.url.replace(/^(https?:\/\/[^/]+).*$/, '$1/…')}</b>
                    <span className={'pill ' + (w.active ? 'good' : 'bad')}>{w.active ? t('Actif') : t('Désactivé')}</span>
                    <span className="grow" />
                    <button className="link" type="button" onClick={() => { oapi('POST', '/integrations/webhooks/' + w.id + '/test', {}).then((r) => { toast(r.ok ? t('Test reçu (réponse {status}).', { status: r.status }) : t('Échec : {status}', { status: r.status }), !r.ok); load(); }).catch(fail); }}>{t('Tester')}</button>
                    {!w.active ? <button className="link" type="button" onClick={() => { oapi('PUT', '/integrations/webhooks/' + w.id, { active: true }).then(load).catch(fail); }}>{t('Réactiver')}</button> : null}
                    <button className="link" type="button" onClick={() => confirm(t('Supprimer ce webhook ?'), () => { oapi('DELETE', '/integrations/webhooks/' + w.id).then(load).catch(fail); })}>{t('Supprimer')}</button>
                  </div>
                  <small className="muted">{w.events.map((e) => (d.events[e] ? t(d.events[e]) : e)).join(' · ') + (w.lastStatus ? ' · ' + t('dernier envoi : {status}', { status: w.lastStatus }) : '')}</small>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}><button className="btn small" type="button" onClick={addHook}>{t('Ajouter un webhook')}</button></div>
            </div>

            <div className="ws-card">
              <h2>{t('Pour les développeurs')}</h2>
              <p className="muted small">{t("API à utiliser avec une clé : GET /api/v1/customers, POST /api/v1/customers (nom + téléphone ou e-mail), GET /api/v1/orders, GET /api/v1/invoices?status=sent. 120 requêtes par minute et par clé. Chaque webhook est signé : vérifiez l'en-tête X-MIA-Signature (HMAC-SHA256 du corps avec votre secret).")}</p>
              <input type="text" readOnly aria-label={t('Exemple')} value={'curl -H "Authorization: Bearer mia_…" ' + base + '/api/v1/customers'} onFocus={(e) => e.target.select()} />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
