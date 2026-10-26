import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form, Loading } from '../../ui.jsx';

/* « Noter ceci » depuis l'assistant : l'IA propose un résumé de la discussion ; la personne le relit, le corrige et l'enregistre elle-même. */
const KINDS = [['decision', 'Décision'], ['incident', 'Incident'], ['procedure', 'Procédure'], ['meeting', 'Réunion'], ['lesson', 'Leçon apprise'], ['contract', 'Contrat ou accord'], ['history', 'Historique fournisseur ou client'], ['other', 'Autre']];

export default function NoteBox({ mod, fallback, close }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const [st, setSt] = useState({ loading: true, draft: null, note: '' });
  useEffect(() => {
    let off = false;
    oapi('POST', '/memory/summarize', { module: mod }).then(
      (j) => { if (!off) setSt({ loading: false, draft: j, note: '' }); },
      (e) => { if (!off) setSt({ loading: false, draft: { title: '', content: fallback || '', kind: 'other' }, note: t(e.message) + ' ' + t('Vous pouvez écrire la note vous-même.') }); },
    );
    return () => { off = true; };
  }, [mod, fallback, oapi]); // eslint-disable-line react-hooks/exhaustive-deps
  if (st.loading) return <Loading />;
  const d = st.draft;
  return (
    <div>
      <p className="muted small">{st.note || t("Résumé proposé par l'IA. Relisez-le et corrigez-le : rien n'est enregistré tant que vous n'avez pas validé.")}</p>
      <Form
        fields={[
          { k: 'kind', label: t('Type'), type: 'select', options: KINDS.map((x) => [x[0], t(x[1])]), value: d.kind },
          { k: 'title', label: t('Titre'), required: true, value: d.title },
          { k: 'content', label: t('Contenu'), type: 'textarea', rows: 7, required: true, value: d.content },
          { k: 'tags', label: t('Étiquettes (séparées par des virgules)'), value: '' },
        ]}
        submitText={t("Enregistrer dans la mémoire")}
        onSubmit={(v) => oapi('POST', '/memory', { kind: v.kind, title: v.title, content: v.content, tags: v.tags }).then(() => { close(); toast(t("Note ajoutée à la mémoire de l'entreprise.")); })}
        extra={<button className="btn" type="button" onClick={close}>{t('Annuler')}</button>}
      />
    </div>
  );
}
