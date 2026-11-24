import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui.jsx';
import './chatIcons.js';
import { useChatApi } from './api.js';

/* Bouton réutilisable « Envoyer par le chat » pour N'IMPORTE QUEL module (Bibliothèque, Réunions, Commercial, Achats…) :
     <ShareToChat name="devis-123.pdf" getBlob={async () => blob} />
   Le fichier passe par le MÊME circuit sécurisé que les fichiers du chat : type réel contrôlé, extension, macros, virus de test, taille et formats
   choisis par l'entreprise, limitation de débit, et seuls les participants de la conversation choisie y accèdent. Le module qui l'utilise ne fait
   que fournir le fichier : il doit avoir déjà vérifié que la personne a le droit de le lire (le chat ne contourne aucun droit du module). */
export default function ShareToChat({ name, getBlob, size = 'sm', variant = 'ghost' }) {
  const t = useT();
  const { modal, toast, fail } = useWs();
  const api = useChatApi();
  const open = async () => {
    try {
      const list = (await api.c('GET', '/conversations')).conversations.filter((c) => !c.e2ee);
      if (!list.length) { toast(t('Aucune conversation ouverte : commencez par écrire à un collègue dans le chat.')); return; }
      modal(t('Envoyer par le chat'), (close) => <Pick t={t} list={list} name={name} onPick={async (c, caption) => { try { const blob = await getBlob(); await api.upload(`conv=${c.id}&name=${encodeURIComponent(name)}${caption ? `&caption=${encodeURIComponent(caption)}` : ''}`, await blob.arrayBuffer()); toast(t('Fichier envoyé dans « {name} »', { name: c.name })); close(); } catch (e) { fail(e); } }} />);
    } catch (e) { fail(e); }
  };
  return <Button size={size} variant={variant} icon="send" onClick={open} label={t('Envoyer par le chat')}>{t('Envoyer par le chat')}</Button>;
}
function Pick({ t, list, name, onPick }) {
  const [id, setId] = useState(list[0].id); const [cap, setCap] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onPick(list.find((c) => c.id === Number(id)), cap); } finally { setBusy(false); } }}>
      <p className="ci-muted">{t('« {name} » sera envoyé dans la conversation choisie : seuls ses participants pourront le lire.', { name })}</p>
      <label>{t('Conversation')}<select value={id} onChange={(e) => setId(e.target.value)}>{list.map((c) => <option key={c.id} value={c.id}>{c.kind === 'group' ? '👥 ' : ''}{c.name}</option>)}</select></label>
      <label>{t('Message (facultatif)')}<input value={cap} onChange={(e) => setCap(e.target.value)} maxLength={300} /></label>
      <Button type="submit" variant="primary" loading={busy} label={t('Envoyer')}>{t('Envoyer')}</Button>
    </form>
  );
}
