import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api.js';
import { useLang, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { Button, Icon, Loading } from './ui.jsx';
import { useWs } from './WsContext.jsx';

/* Avis et recommandations : bouton discret (pied de page de l'espace de travail) et fenêtre « Votre avis ».
   Ni dans les écrans de connexion, de création d'organisation ou de double authentification : seulement dans l'espace ouvert. */

const KINDS = [['review', 'Avis'], ['suggestion', 'Suggestion'], ['problem', 'Problème'], ['comment', 'Commentaire']];
const SHOT_MAX = 2 * 1024 * 1024;
const BODY_MAX = 2000;

/** Réduit une grosse capture (téléphone) en JPEG léger ; une petite image PNG/JPEG/WebP part telle quelle. */
async function prepareShot(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Image non reconnue : formats acceptés PNG, JPEG ou WebP.');
  if (file.size <= SHOT_MAX * 0.9) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Image non reconnue : formats acceptés PNG, JPEG ou WebP.');
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  if (!blob || blob.size > SHOT_MAX) throw new Error('Image trop lourde (2 Mo au plus).');
  return blob;
}

function Stars({ value, onChange }) {
  const t = useT();
  return (
    <div className="fb-stars" role="radiogroup" aria-label={t('Votre note de 1 à 5 étoiles')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t('{n} sur 5', { n })} className={'fb-star' + (n <= value ? ' on' : '')} onClick={() => onChange(n)}><Icon name={n <= value ? 'star' : 'star-o'} /></button>
      ))}
    </div>
  );
}

function Nps({ value, onChange }) {
  const t = useT();
  return (
    <div>
      <div className="fb-nps" role="radiogroup" aria-label={t('Probabilité de nous recommander, de 0 à 10')}>
        {Array.from({ length: 11 }, (_, n) => <button key={n} type="button" role="radio" aria-checked={value === n} className={'fb-n' + (value === n ? ' on' : '')} onClick={() => onChange(value === n ? null : n)}>{n}</button>)}
      </div>
      <div className="fb-nps-l"><span>{t('Pas du tout')}</span><span>{t('Certainement')}</span></div>
    </div>
  );
}

function Mine({ orgId, onNew }) {
  const t = useT();
  const { api, toast, fail, confirm } = useWs();
  const [items, setItems] = useState(null);
  const load = useCallback(() => api('GET', `/orgs/${orgId}/feedback/mine`).then((j) => setItems(j.items), (e) => { fail(e); setItems([]); }), [api, orgId, fail]);
  useEffect(() => { load(); }, [load]);
  if (!items) return <Loading />;
  if (!items.length) return <p className="muted">{t("Vous n'avez pas encore envoyé d'avis.")} <button className="link" type="button" onClick={onNew}>{t('Donner mon avis')}</button></p>;
  const statusLabel = { new: 'Reçu', read: 'Lu', in_progress: 'En cours de traitement', done: 'Traité', archived: 'Archivé' };
  const consent = (it, on) => api('PUT', `/orgs/${orgId}/feedback/mine/${it.id}/consent`, { publicConsent: on }).then(() => { toast(on ? t('Merci : votre avis pourra être publié après relecture.') : t('Consentement retiré : votre avis n\'est plus affiché.')); load(); }, fail);
  const del = (it) => confirm(t('Supprimer définitivement cet avis ?'), () => api('DELETE', `/orgs/${orgId}/feedback/mine/${it.id}`).then(() => { toast(t('Avis supprimé.')); load(); }, fail), t('Supprimer'));
  return (
    <ul className="fb-list">
      {items.map((it) => (
        <li key={it.id} className="fb-item">
          <div className="fb-item-h"><span className="fb-stars-r" aria-label={t('{n} sur 5', { n: it.stars })}>{'★'.repeat(it.stars)}{'☆'.repeat(5 - it.stars)}</span><span className="muted small">{t(KINDS.find((k) => k[0] === it.kind)[1])} · {tsrv(it.moduleTitle)} · {new Date(it.createdAt).toLocaleDateString()}</span></div>
          {it.body ? <p className="fb-body">{it.body}</p> : null}
          <p className="small muted">{t(statusLabel[it.status])}{it.anonymous ? ' · ' + t('Anonyme') : ''}{it.published ? ' · ' + t('Publié comme témoignage') : it.publicConsent ? ' · ' + t('Consentement donné, en attente de relecture') : ''}</p>
          <div className="row">
            {it.publicConsent ? <Button size="sm" onClick={() => consent(it, false)}>{t('Retirer mon consentement public')}</Button> : (it.kind === 'review' && it.body.length >= 10 ? <Button size="sm" onClick={() => consent(it, true)}>{t('Autoriser l\'affichage public')}</Button> : null)}
            <Button size="sm" onClick={() => del(it)}>{t('Supprimer')}</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FeedbackForm({ orgId, onDone }) {
  const t = useT();
  const lang = useLang();
  const { api, info, toast } = useWs();
  const [v, setV] = useState({ kind: 'review', module: 'general', stars: 0, nps: null, body: '', anonymous: false, publicConsent: false });
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const mods = (info.modules || []).map((m) => [m.id, t(m.title)]);
  const canPublic = v.kind === 'review' && v.body.trim().length >= 10;
  useEffect(() => { if (!canPublic && v.publicConsent) set('publicConsent', false); }, [canPublic]); // eslint-disable-line react-hooks/exhaustive-deps
  async function pick(e) {
    const f = e.target.files && e.target.files[0]; setErr('');
    if (!f) { setShot(null); return; }
    try { setShot(await prepareShot(f)); } catch (x) { setShot(null); setErr(tsrv(x.message)); if (file.current) file.current.value = ''; }
  }
  async function submit(ev) {
    ev.preventDefault(); setErr('');
    if (!v.stars) { setErr(t('Donnez une note de 1 à 5 étoiles.')); return; }
    if (v.kind !== 'review' && v.body.trim().length < 5) { setErr(t('Décrivez votre suggestion, problème ou commentaire (5 caractères au moins).')); return; }
    setBusy(true);
    try {
      const j = await api('POST', `/orgs/${orgId}/feedback`, { ...v, lang, page: window.location.pathname });
      if (shot) {
        try {
          const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}/feedback/${j.id}/screenshot`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: shot });
          if (!r.ok) toast(t("Votre avis est envoyé, mais l'image n'a pas pu être jointe."), true);
        } catch { toast(t("Votre avis est envoyé, mais l'image n'a pas pu être jointe."), true); }
      }
      onDone();
    } catch (e) { setErr(tsrv(e.message)); }
    setBusy(false);
  }
  return (
    <form className="ws-form fb-form" noValidate onSubmit={submit}>
      <p className="muted">{t("Votre avis aide à améliorer Brij-IA. Il est lu par le fondateur ; il n'est jamais publié sans votre accord.")}</p>
      <div className="fld"><span id="fb-s">{t('Votre note')}</span><Stars value={v.stars} onChange={(n) => set('stars', n)} /></div>
      <div className="fld"><span>{t('Recommanderiez-vous Brij-IA à un ami ou un collègue ?')}</span><Nps value={v.nps} onChange={(n) => set('nps', n)} /></div>
      <div className="fb-two">
        <label className="fld" htmlFor="fb-kind"><span>{t('Type de message')}</span><select id="fb-kind" value={v.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></label>
        <label className="fld" htmlFor="fb-mod"><span>{t('Module concerné')}</span><select id="fb-mod" value={v.module} onChange={(e) => set('module', e.target.value)}><option value="general">{t('Ensemble du logiciel')}</option>{mods.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>
      </div>
      <label className="fld" htmlFor="fb-body"><span>{t('Votre message')}</span>
        <textarea id="fb-body" rows={5} maxLength={BODY_MAX} value={v.body} placeholder={v.kind === 'problem' ? t("Que s'est-il passé ? Que vouliez-vous faire ?") : v.kind === 'suggestion' ? t('Que pourrions-nous ajouter ou améliorer ?') : t('Ce que vous aimez, ce qui manque…')} onChange={(e) => set('body', e.target.value)} />
        <small>{v.body.length} / {BODY_MAX}</small></label>
      <label className="fld" htmlFor="fb-shot"><span>{t("Capture d'écran (facultatif)")}</span>
        <input id="fb-shot" ref={file} type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
        <small>{t("PNG, JPEG ou WebP, 2 Mo au plus. Vérifiez qu'elle ne montre pas d'informations privées.")}</small></label>
      <label className="fb-chk"><input type="checkbox" checked={v.anonymous} onChange={(e) => set('anonymous', e.target.checked)} /><span>{t('Envoyer en anonyme : mon nom et mon entreprise ne seront pas montrés au fondateur.')}</span></label>
      <label className={'fb-chk' + (canPublic ? '' : ' off')}><input type="checkbox" disabled={!canPublic} checked={v.publicConsent} onChange={(e) => set('publicConsent', e.target.checked)} /><span>{v.anonymous ? t("J'accepte que mon avis soit affiché publiquement (sans nom) après relecture.") : t("J'accepte que mon avis soit affiché publiquement avec mon prénom et l'initiale de mon nom, après relecture.")}<small>{canPublic ? t('Vous pourrez retirer ce consentement à tout moment dans « Mes avis ».') : t("Réservé aux avis rédigés (10 caractères au moins), pas aux suggestions ni aux problèmes.")}</small></span></label>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Envoyer mon avis')}</Button></div>
    </form>
  );
}

/** Contenu de la fenêtre : deux onglets, « Donner mon avis » et « Mes avis ». */
export function FeedbackPanel({ orgId }) {
  const t = useT();
  const [tab, setTab] = useState('new');
  const [done, setDone] = useState(false);
  return (
    <div className="fb">
      <div className="fb-tabs" role="tablist">
        <button role="tab" type="button" aria-selected={tab === 'new'} className={tab === 'new' ? 'on' : ''} onClick={() => { setTab('new'); setDone(false); }}>{t('Donner mon avis')}</button>
        <button role="tab" type="button" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>{t('Mes avis')}</button>
      </div>
      {tab === 'mine' ? <Mine orgId={orgId} onNew={() => setTab('new')} /> : done
        ? <div className="fb-thanks" role="status"><Icon name="circle-check" /><h3>{t('Merci pour votre avis !')}</h3><p className="muted">{t('Il a été transmis au fondateur de Brij-IA. Vous pouvez le retrouver, le retirer ou le supprimer dans « Mes avis ».')}</p><Button onClick={() => setTab('mine')}>{t('Voir mes avis')}</Button></div>
        : <FeedbackForm orgId={orgId} onDone={() => setDone(true)} />}
    </div>
  );
}

/** Bouton discret du pied de page. */
export function FeedbackLink({ onClick }) {
  const t = useT();
  return <button type="button" className="app-foot-fb link" onClick={onClick}><Icon name="star-o" /> {t('Donner mon avis')}</button>;
}
