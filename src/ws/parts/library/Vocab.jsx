import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, Table, useLoad } from '../../ui.jsx';

/* Vocabulaire contrôlé (thésaurus) : un terme préféré, ses synonymes et son terme générique. À l'enregistrement d'une notice,
   un synonyme est remplacé par le terme préféré ; la recherche retrouve une ressource par n'importe lequel de ses synonymes. */

function TermForm({ L, term, all, onDone }) {
  const t = useT();
  const { toast } = useWs();
  const x = term || {};
  return (
    <Form submitText={term ? t('Enregistrer') : t('Ajouter le terme')}
      fields={[
        { k: 'term', label: t('Terme préféré'), required: true, value: x.term || '' },
        { k: 'synonyms', label: t('Synonymes (séparés par des virgules)'), value: (x.synonyms || []).join(', '), placeholder: t('accord, convention') },
        { k: 'broaderId', label: t('Terme générique'), type: 'select', value: x.broaderId || '', options: [['', t('— Aucun —')], ...all.filter((a) => !term || a.id !== term.id).map((a) => [String(a.id), a.term])] },
        { k: 'note', label: t("Note d'usage"), value: x.note || '' },
      ]}
      onSubmit={(v) => L.lib(term ? 'PUT' : 'POST', term ? `/thesaurus/${term.id}` : '/thesaurus', { term: v.term, synonyms: v.synonyms, broaderId: v.broaderId ? Number(v.broaderId) : null, note: v.note }).then(() => { toast(t('Vocabulaire enregistré.')); onDone(); })} />
  );
}

export default function Vocab({ L }) {
  const t = useT();
  const { modal, toast, confirm, can } = useWs();
  const st = useLoad(() => L.lib('GET', '/thesaurus'), [L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  return (
    <>
      <div className="ws-head"><div><h1>{t('Vocabulaire contrôlé')}</h1><p className="muted">{t('Une liste de mots-clés reconnus, avec leurs synonymes : « accord » et « convention » retrouvent les contrats. Cela évite les mots-clés écrits de dix façons différentes.')}</p></div>
        {can('manager') ? <div className="row"><button className="btn primary small" type="button" onClick={() => st.data && modal(t('Nouveau terme'), (close) => <TermForm L={L} all={st.data.terms} onDone={() => { close(); st.reload(); }} />)}>{t('Nouveau terme')}</button></div> : null}</div>
      <Loaded state={st}>{(j) => (
        <>
          {j.strict ? <p className="muted small">{t('Mode strict : une notice ne peut recevoir que des mots-clés de cette liste.')}</p> : null}
          <Table caption={t('Vocabulaire')} empty={t('Aucun terme pour le moment.')} rows={j.terms}
            columns={[
              { key: 'term', label: t('Terme'), render: (x) => <b>{x.term}</b> },
              { key: 'synonyms', label: t('Synonymes'), render: (x) => (x.synonyms.length ? x.synonyms.join(', ') : '—') },
              { key: 'broader', label: t('Terme générique'), render: (x) => (x.broaderId ? (j.terms.find((a) => a.id === x.broaderId) || {}).term || '—' : '—') },
              { key: 'uses', label: t('Notices'), align: 'r' },
              ...(can('manager') ? [{ key: 'act', label: '', render: (x) => (
                <span className="row">
                  <button className="btn small" type="button" onClick={() => modal(t('Modifier le terme'), (close) => <TermForm L={L} term={x} all={j.terms} onDone={() => { close(); st.reload(); }} />)}>{t('Modifier')}</button>
                  <button className="btn small" type="button" onClick={() => confirm(t('Retirer ce terme du vocabulaire ? Les notices gardent leurs mots-clés.'), () => L.lib('DELETE', `/thesaurus/${x.id}`).then(() => st.reload(), fail), t('Retirer'))}>{t('Retirer')}</button>
                </span>) }] : []),
            ]} />
        </>
      )}
      </Loaded>
    </>
  );
}
