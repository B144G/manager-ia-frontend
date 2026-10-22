import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Form, Loading } from '../../ui.jsx';

/* « Noter ceci » depuis l'assistant : l'IA propose un résumé de la discussion ; la personne le relit, le corrige et l'enregistre elle-même. */
const KINDS = [['decision', 'Décision'], ['incident', 'Incident'], ['procedure', 'Procédure'], ['meeting', 'Réunion'], ['lesson', 'Leçon apprise'], ['contract', 'Contrat ou accord'], ['history', 'Historique fournisseur ou client'], ['other', 'Autre']];

export default function NoteBox({ mod, fallback, close }) {
  const { oapi, toast } = useWs();
  const [st, setSt] = useState({ loading: true, draft: null, note: '' });
  useEffect(() => {
    let off = false;
    oapi('POST', '/memory/summarize', { module: mod }).then(
      (j) => { if (!off) setSt({ loading: false, draft: j, note: '' }); },
      (e) => { if (!off) setSt({ loading: false, draft: { title: '', content: fallback || '', kind: 'other' }, note: e.message + ' Vous pouvez écrire la note vous-même.' }); },
    );
    return () => { off = true; };
  }, [mod, fallback, oapi]);
  if (st.loading) return <Loading />;
  const d = st.draft;
  return (
    <div>
      <p className="muted small">{st.note || "Résumé proposé par l'IA. Relisez-le et corrigez-le : rien n'est enregistré tant que vous n'avez pas validé."}</p>
      <Form
        fields={[
          { k: 'kind', label: 'Type', type: 'select', options: KINDS, value: d.kind },
          { k: 'title', label: 'Titre', required: true, value: d.title },
          { k: 'content', label: 'Contenu', type: 'textarea', rows: 7, required: true, value: d.content },
          { k: 'tags', label: 'Étiquettes (séparées par des virgules)', value: '' },
        ]}
        submitText="Enregistrer dans la mémoire"
        onSubmit={(v) => oapi('POST', '/memory', { kind: v.kind, title: v.title, content: v.content, tags: v.tags }).then(() => { close(); toast('Note ajoutée à la mémoire de l\'entreprise.'); })}
        extra={<button className="btn" type="button" onClick={close}>Annuler</button>}
      />
    </div>
  );
}
