import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT, tr } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { API_BASE } from '../../../lib/api.js';
import { Icon } from '../../../lib/fa.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui.jsx';
import './chatIcons.js';
import { useChatApi } from './api.js';

/* Lien du chat avec tous les modules.
   - <DiscussButton type="task" id={12} /> : ouvre (ou crée) le fil de discussion rattaché à cet enregistrement. À placer sur n'importe quelle fiche.
     « type » est un type du registre serveur (src/workspace/chat-objects.js : tâche, projet, client, article, demande, devis/facture, employé, fournisseur,
     commande / facture d'achat, réunion, document de la Bibliothèque… ; un module futur s'y ajoute en une ligne côté serveur).
   - <ObjectCard> : carte d'un objet dans un message ; le serveur la résout pour CHAQUE lecteur selon SES droits (sinon « objet non accessible »).
   - ObjectPicker : choisir un objet à partager ; SaveToLibrary : enregistrer un fichier du chat dans la Bibliothèque (droits de la Bibliothèque). */
export function DiscussButton({ type, id, label, size = 'sm', variant = 'ghost', invite }) {
  const t = useT();
  const { fail, orgId } = useWs();
  const api = useChatApi();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const j = await api.c('POST', `/objects/${type}/${id}/thread`, invite ? { invite } : {}); navigate(`/app/${orgId}/chat?conv=${j.conversation.id}`); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return <Button size={size} variant={variant} icon="comments" loading={busy} onClick={go} label={label || t('Discuter')}>{label || t('Discuter')}</Button>;
}

export function ObjectCard({ obj, onOpen }) {
  const t = useT();
  if (!obj) return null;
  if (!obj.accessible) return <div className="ci-obj lock"><span className="ci-callico"><Icon name="c-lock" /></span><span><b>{obj.label ? tsrv(obj.label) : t('Objet')}</b><small>{t("Objet non accessible : vous n'avez pas le droit de le voir.")}</small></span></div>;
  return (
    <div className="ci-obj">
      <span className="ci-callico"><Icon name={obj.icon || 'layer-group'} /></span>
      <span className="ci-grow"><small>{tsrv(obj.label)}</small><b>{obj.title}</b>{obj.subtitle && <small>{obj.subtitle}</small>}</span>
      <Button size="sm" onClick={() => onOpen(obj)} label={t('Ouvrir')}>{t('Ouvrir')}</Button>
    </div>
  );
}

export function ObjectPicker({ api, close, onPick }) {
  const t = useT();
  const { fail } = useWs();
  const [types, setTypes] = useState([]); const [type, setType] = useState(''); const [q, setQ] = useState(''); const [res, setRes] = useState(null);
  useEffect(() => { api.c('GET', '/objects/types').then((j) => { const s = j.types.filter((x) => x.searchable); setTypes(s); if (s.length) setType(s[0].type); }, fail); }, [api, fail]);
  useEffect(() => {
    if (!type || q.trim().length < 1) { setRes(null); return undefined; }
    let off = false;
    const h = setTimeout(() => api.c('GET', `/objects/search?type=${type}&q=${encodeURIComponent(q.trim())}`).then((j) => { if (!off) setRes(j.results); }, () => { if (!off) setRes([]); }), 300);
    return () => { off = true; clearTimeout(h); };
  }, [api, type, q]);
  return (
    <div className="ws-form">
      <p className="ci-muted">{t("Seuls les éléments que vous avez le droit de voir apparaissent. Chaque lecteur verra la carte selon ses propres droits.")}</p>
      <label>{t('Type')}<select value={type} onChange={(e) => { setType(e.target.value); setRes(null); }}>{types.map((x) => <option key={x.type} value={x.type}>{tsrv(x.label)}</option>)}</select></label>
      <label>{t('Rechercher')}<input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></label>
      {res && !res.length && <p className="ci-muted">{t('Aucun résultat.')}</p>}
      <ul className="ci-results">{(res || []).map((r) => <li key={r.id}><button type="button" onClick={() => { onPick(type, r.id); close(); }}><b>{r.title}</b><small>{r.subtitle}</small></button></li>)}</ul>
    </div>
  );
}

/** Enregistre un fichier du chat dans la Bibliothèque : l'envoi passe par la route de la Bibliothèque (droits du bloc, contrôles du fichier, journal). */
export function SaveToLibrary({ api, file, close, getBytes }) {
  const t = useT();
  const { oapi, toast, fail, orgId } = useWs();
  const [blocks, setBlocks] = useState(null); const [bid, setBid] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { oapi('GET', '/library/overview').then((j) => setBlocks(j.blocks || []), fail); }, [oapi, fail]);
  const save = async () => {
    setBusy(true);
    try {
      const bytes = await getBytes();
      const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}/library/blocks/${bid}/docs?name=${encodeURIComponent(file.name)}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.code === 'library_locked' ? t("Ce bloc est verrouillé : ouvrez la Bibliothèque pour le déverrouiller.") : tsrv(j.error || tr('Enregistrement impossible.')));
      toast(t('Fichier enregistré dans la Bibliothèque')); close();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  void api;
  return (
    <div className="ws-form">
      <p className="ci-muted">{t("« {name} » sera copié dans la Bibliothèque, dans le bloc choisi (selon vos droits de dépôt). Le fichier reste aussi dans le chat.", { name: file.name })}</p>
      <label>{t('Bloc de la Bibliothèque')}<select value={bid} onChange={(e) => setBid(e.target.value)}><option value="">{t('Choisir un bloc…')}</option>{(blocks || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <Button variant="primary" disabled={!bid} loading={busy} onClick={save} label={t('Enregistrer')}>{t('Enregistrer')}</Button>
    </div>
  );
}
