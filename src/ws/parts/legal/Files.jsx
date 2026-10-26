import { useRef, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { getLocale, tr, useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Act } from './Act.jsx';

/* Pièces jointes d'un contrat, d'une obligation ou d'un litige : PDF ou image de 2 Mo au plus, chiffrées sur le serveur. */

const sizeText = (n) => (n >= 1048576 ? tr('{n} Mo', { n: (n / 1048576).toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) }) : tr('{n} Ko', { n: Math.max(1, Math.round(n / 1024)) }));

export function FilesBox({ type, id, onChange }) {
  const t = useT();
  const { oapi, orgId, confirm, fail, dateFr } = useWs();
  const q = '?parentType=' + type + '&parentId=' + id;
  const st = useLoad(() => oapi('GET', '/legal/files' + q), []);
  const [msg, setMsg] = useState('');
  const input = useRef(null);
  const base = API_BASE + '/api/ws/orgs/' + orgId + '/legal/files';

  async function upload(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setMsg(t('« {name} » dépasse 2 Mo. Réduisez-le ou choisissez un autre fichier.', { name: f.name })); return; }
    setMsg(t('Envoi de « {name} »…', { name: f.name }));
    try {
      const r = await fetch(base + q + '&name=' + encodeURIComponent(f.name.slice(0, 60)), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(t(j.error || 'Envoi impossible.'));
      setMsg(t('Fichier ajouté.'));
      st.reload(); if (onChange) onChange();
    } catch (e) { setMsg(e.message); }
  }
  // Le fichier n'est lu que par un responsable connecté : on le télécharge avec la session puis on l'enregistre sur l'appareil.
  async function download(x) {
    try {
      const r = await fetch(base + '/' + x.id + '/file', { credentials: 'include' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(t(j.error || 'Téléchargement impossible.')); }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = x.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { fail(e); }
  }
  return (
    <div>
      <p className="muted small">{t('PDF, JPEG, PNG ou WebP, 2 Mo au plus, 10 fichiers au plus. Les fichiers sont chiffrés sur le serveur et réservés aux responsables de votre organisation.')}</p>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={upload} aria-label={t("Ajouter un fichier")} style={{ fontSize: 16 }} />
      <p className="muted small" role="status">{msg}</p>
      <Loaded state={st}>{(j) => (
        <>
          {!j.files.length ? <Empty text={t('Aucun fichier pour le moment.')} /> : null}
          {j.files.map((x) => (
            <div className="line" key={x.id} style={{ flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 200px', wordBreak: 'break-word' }}><b>{x.name}</b><br /><small>{sizeText(x.size) + ' · ' + t('ajouté le {date}', { date: dateFr(x.createdAt.slice(0, 10)) })}</small></span>
              <span className="row" style={{ flexWrap: 'wrap' }}>
                <Act onClick={() => download(x)}>{t('Télécharger')}</Act>
                <Act onClick={() => confirm(t('Supprimer ce fichier ?'), () => { oapi('DELETE', '/legal/files/' + x.id).then(() => { st.reload(); if (onChange) onChange(); }).catch(fail); })}>{t('Supprimer')}</Act>
              </span>
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
