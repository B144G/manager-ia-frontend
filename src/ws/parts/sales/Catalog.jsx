import { useEffect, useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { tr, useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { Pill, useOrgUrl } from './util.jsx';

/** Onglet « Catalogue ». onChange = recharger tout le module (statistiques comprises). */
export function Catalog({ onChange }) {
  const t = useT();
  const ws = useWs();
  const { oapi, money, confirm, fail } = ws;
  const st = useLoad(() => oapi('GET', '/sales/catalog'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  return (
    <div className="ws-card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{t('Catalogue')}</h2>
        <button className="btn primary small" type="button" onClick={() => editItem(ws, null, onChange)}>{t('Ajouter un article')}</button>
      </div>
      <p className="muted small">{t("L'assistant ne donne que ces prix. Plus vos noms sont clairs, mieux il comprend les clients.")}</p>
      {!st.data.items.length ? <Empty text={t("Aucun article. Ajoutez vos produits ou services avec leur prix.")} /> : null}
      {st.data.items.map((it) => (
        <div className="line" key={it.id}>
          <span>
            <b>{it.name}</b>
            {it.active ? null : <Pill t={['Masqué', '']} />}
            <small>{' ' + money(it.price) + (it.unit ? ' / ' + it.unit : '') + (it.description ? ' · ' + it.description : '')}</small>
          </span>
          <span className="row">
            <button className="link" type="button" onClick={() => oapi('PUT', '/sales/catalog/' + it.id, { active: !it.active }).then(onChange).catch(fail)}>{it.active ? t('Masquer') : t('Afficher')}</button>
            <button className="link" type="button" onClick={() => ws.modal(t('Photos et vidéos : {name}', { name: it.name }), () => <ItemMedia it={it} onChange={onChange} />, { wide: true, onclose: onChange })}>{t('Photos et vidéos') + (it.photos || it.videos ? ' (' + (it.photos + it.videos) + ')' : '')}</button>
            <button className="link" type="button" onClick={() => editItem(ws, it, onChange)}>{t('Modifier')}</button>
            <button className="link" type="button" onClick={() => confirm(t('Supprimer « {name} » ?', { name: it.name }), () => oapi('DELETE', '/sales/catalog/' + it.id).then(onChange).catch(fail))}>{t('Supprimer')}</button>
          </span>
        </div>
      ))}
    </div>
  );
}

function editItem(ws, it, onChange) {
  const t = tr;
  const cur = it || {};
  ws.modal(cur.id ? t("Modifier l'article") : t('Nouvel article'), (close) => (
    <Form
      submitText={t("Enregistrer")}
      fields={[
        { k: 'name', label: t('Nom'), required: true, value: cur.name, placeholder: t('Robe wax Aïcha') },
        { k: 'price', label: t('Prix ({currency})', { currency: ws.info.org.currency }), required: true, value: cur.price },
        { k: 'unit', label: t('Unité (facultatif)'), value: cur.unit, placeholder: t('pièce, kg, heure…') },
        { k: 'description', label: t('Description courte'), value: cur.description, placeholder: t('Tailles, couleurs, délai…') },
      ]}
      onSubmit={(v) => ws.oapi(cur.id ? 'PUT' : 'POST', '/sales/catalog' + (cur.id ? '/' + cur.id : ''), v).then(() => { close(); onChange(); })}
    />
  ));
}

/* Photos et vidéos d'un article : l'IA les envoie sur WhatsApp quand un client en demande. */
function ItemMedia({ it, onChange }) {
  const t = useT();
  const { oapi, confirm, fail } = useWs();
  const urlOf = useOrgUrl();
  const url = (path) => urlOf('/sales/catalog/' + it.id + path);
  const st = useLoad(() => oapi('GET', '/sales/catalog/' + it.id + '/media'), []);
  const [msg, setMsg] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function upload(ev) {
    const files = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (alive.current) setMsg(t('Envoi de « {name} » ({i}/{n})…', { name: f.name, i: i + 1, n: files.length }));
      try {
        const r = await fetch(url('/media?name=' + encodeURIComponent(f.name.slice(0, 60))), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(t(j.error || 'Envoi impossible.'));
      } catch (e) {
        if (alive.current) { setMsg(f.name + ' : ' + e.message); st.reload(); }
        return;
      }
    }
    if (alive.current) { setMsg(t('Terminé.')); st.reload(); }
    onChange();
  }

  const media = st.data ? st.data.media : null;
  return (
    <>
      <p className="muted small">{t("Photos JPEG, PNG ou WebP (3 Mo au plus) et vidéos MP4 (16 Mo au plus, limite de WhatsApp). Jusqu'à 8 fichiers par article. Quand un client demande à voir l'article sur WhatsApp, l'IA envoie jusqu'à 3 photos et 1 vidéo, avec le nom et le prix en légende.")}</p>
      <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple aria-label={t("Ajouter des photos ou des vidéos")} onChange={upload} />
      <p className="muted small" role="status">{msg}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, margin: '10px 0' }}>
        {st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
        {media && !media.length ? <Empty text={t("Aucun fichier pour le moment.")} /> : null}
        {(media || []).map((m) => (
          <div key={m.id} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)' }}>
            {m.kind === 'image'
              ? <img src={url('/media/' + m.id + '/file')} alt={t('Photo de {name}', { name: it.name })} style={{ display: 'block', width: '100%', height: 110, objectFit: 'cover' }} />
              : <video src={url('/media/' + m.id + '/file')} controls preload="metadata" style={{ display: 'block', width: '100%', height: 110, objectFit: 'cover', background: '#000' }} />}
            <button type="button" className="link" aria-label={t("Supprimer ce fichier")} style={{ display: 'block', margin: '4px auto' }}
              onClick={() => confirm(t('Supprimer ce fichier ?'), () => oapi('DELETE', '/sales/catalog/' + it.id + '/media/' + m.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button>
          </div>
        ))}
      </div>
    </>
  );
}

/** Onglet « Campagnes ». */
export function Campaigns() {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/campaigns'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  return (
    <div className="ws-card">
      <h2>{t('Résultats par campagne')}</h2>
      <p className="muted small">{t('Ajoutez un nom de campagne au lien (bouton « Lien à partager ») pour savoir quelle publicité rapporte des clients.')}</p>
      {!st.data.campaigns.length ? <Empty text={t("Pas encore de conversation.")} /> : null}
      {st.data.campaigns.map((x) => (
        <div className="line" key={x.campaign}>
          <b>{x.campaign}</b>
          <small>{t('{chats} conversation(s) · {prospects} prospect(s) enregistré(s) · {orders} commande(s) · {amount}', { chats: x.chats, prospects: x.prospects, orders: x.ordered, amount: money(x.amount) })}</small>
        </div>
      ))}
    </div>
  );
}
