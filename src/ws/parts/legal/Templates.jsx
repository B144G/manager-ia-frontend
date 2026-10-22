import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Act, Btn } from './Act.jsx';

/* Juridique : bibliothèque de modèles. Les modèles fournis par MANAGER-IA ne se modifient pas (on les duplique) ; ceux de l'organisation se gèrent librement.
   Informatifs : à faire relire par un professionnel du droit. Texte brut uniquement (jamais de HTML). */

const MENTION = 'Modèle informatif à faire relire par un professionnel du droit.';
const KINDS = [['document', 'Documents'], ['obligation', 'Obligations'], ['privacy', 'Registre des données']];
const OB_KINDS = [['license', 'Licence'], ['authorization', 'Autorisation'], ['insurance', 'Assurance'], ['declaration', 'Déclaration'], ['display', 'Affichage obligatoire'], ['inspection', 'Contrôle'], ['other', 'Autre']];

const fill = (body, vals) => body.replace(/\{\{(\w+)\}\}/g, (_, k) => (vals[k] && vals[k].trim()) || '[à compléter]');
const withMention = (t) => (t.includes(MENTION) ? t : t + '\n\n' + MENTION);

/** Remplir un modèle de document : formulaire généré depuis les champs {{nom}}, aperçu modifiable, copie et impression. */
function Filler({ model }) {
  const { copy, toast, today } = useWs();
  const [vals, setVals] = useState(() => ({ date: today().split('-').reverse().join('/') }));
  const [text, setText] = useState(() => withMention(fill(model.body, { date: today().split('-').reverse().join('/') })));
  const setVal = (k, v) => { const next = { ...vals, [k]: v }; setVals(next); setText(withMention(fill(model.body, next))); };
  // Impression : une page vide reçoit le texte par textContent (jamais de HTML), puis la fenêtre d'impression s'ouvre.
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) { toast("Votre navigateur a bloqué l'ouverture. Autorisez les fenêtres pour imprimer.", true); return; }
    const pre = w.document.createElement('pre');
    pre.textContent = text;
    pre.style.whiteSpace = 'pre-wrap'; pre.style.fontFamily = 'Georgia, serif'; pre.style.fontSize = '14px'; pre.style.margin = '24px';
    w.document.title = model.title;
    w.document.body.appendChild(pre);
    w.focus(); w.print();
  };
  return (
    <div>
      <p className="ws-err">{MENTION}</p>
      {!model.fields.length ? <p className="muted small">Ce modèle n'a aucun champ à compléter : modifiez directement le texte ci-dessous.</p> : null}
      <div className="ws-form">
        {model.fields.map((f) => <label className="fld" key={f.key}><span>{f.label}</span><input style={{ fontSize: 16 }} value={vals[f.key] || ''} autoComplete="off" onChange={(e) => setVal(f.key, e.target.value)} /></label>)}
      </div>
      <label className="fld"><span>Aperçu du document (modifiable)</span><textarea style={{ fontSize: 16 }} rows={14} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Btn className="btn primary" onClick={() => copy(text, 'Texte copié.')}>Copier le texte</Btn>
        <Btn onClick={print}>Imprimer</Btn>
      </div>
    </div>
  );
}

/** Création et modification d'un modèle de l'organisation. */
function editFields(kind, t) {
  const d = (t && t.data) || {};
  if (kind === 'document') {
    return [
      { k: 'title', label: 'Nom du modèle', required: true, value: t && t.title },
      { k: 'body', label: 'Texte du modèle', type: 'textarea', rows: 12, required: true, value: t && t.body, hint: 'Écrivez {{nom_du_champ}} là où une information doit être remplie : un formulaire est créé automatiquement. Exemple : Bonjour {{client}}.' },
    ];
  }
  if (kind === 'obligation') {
    return [
      { k: 'title', label: 'Nom du modèle', required: true, value: t && t.title },
      { k: 'oTitle', label: "Titre de l'obligation", required: true, value: d.title },
      { k: 'oKind', label: 'Type', type: 'select', options: OB_KINDS, value: d.kind || 'other' },
      { k: 'rec', label: 'Se répète tous les (mois)', value: d.recurrenceMonths || '', hint: 'Ex. 12 pour une fois par an. Laissez vide si ponctuelle.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: d.notes },
    ];
  }
  return [
    { k: 'title', label: 'Nom du modèle', required: true, value: t && t.title },
    { k: 'dataKind', label: 'Donnée collectée', required: true, value: d.dataKind },
    { k: 'people', label: 'Personnes concernées', value: d.people },
    { k: 'purpose', label: 'Pourquoi', value: d.purpose },
    { k: 'retention', label: 'Durée de conservation', value: d.retention },
    { k: 'notes', label: 'Notes', value: d.notes },
  ];
}
function payloadOf(kind, v) {
  if (kind === 'document') return { kind, title: v.title, body: v.body };
  if (kind === 'obligation') return { kind, title: v.title, data: { title: v.oTitle, kind: v.oKind, recurrenceMonths: v.rec, notes: v.notes } };
  return { kind, title: v.title, data: { dataKind: v.dataKind, people: v.people, purpose: v.purpose, retention: v.retention, notes: v.notes } };
}

export default function Templates() {
  const { oapi, modal, confirm, fail, toast } = useWs();
  const [kind, setKind] = useState('document');
  const st = useLoad(() => oapi('GET', '/legal/templates'), []);
  const edit = (t) => modal(t ? 'Modifier le modèle' : 'Nouveau modèle', (close) => (
    <Form
      submitText="Enregistrer"
      fields={editFields(kind, t)}
      onSubmit={(v) => oapi(t ? 'PUT' : 'POST', '/legal/templates' + (t ? '/' + t.id : ''), payloadOf(kind, v)).then(() => { close(); st.reload(); })}
    />
  ), { wide: true });
  const dupe = (t) => oapi('POST', '/legal/templates/' + encodeURIComponent(t.id) + '/duplicate').then(() => { toast('Copie créée : vous pouvez la modifier.'); st.reload(); }).catch(fail);
  const use = (t) => modal(t.title, () => <Filler model={t} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>Modèles</h2><Btn className="btn primary small" onClick={() => edit(null)}>Nouveau modèle</Btn></div>
      <p className="ws-err">{MENTION}</p>
      <p className="muted small">Les modèles « fournis par MANAGER-IA » ne se modifient pas : dupliquez-les pour en faire votre version. Les lois changent d'un pays à l'autre : adaptez chaque texte à votre situation. Les modèles d'obligations et du registre se retrouvent comme exemples dans les onglets Obligations et Données personnelles.</p>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {KINDS.map((k) => <Btn key={k[0]} className={'btn small' + (kind === k[0] ? ' primary' : '')} onClick={() => setKind(k[0])}>{k[1]}</Btn>)}
      </div>
      <Loaded state={st}>{(j) => {
        const list = j.templates.filter((t) => t.kind === kind);
        return (
          <>
            {!list.length ? <Empty text="Aucun modèle." /> : null}
            {list.map((t) => (
              <div className="line" key={t.id} style={{ flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 220px' }}>
                  <b>{t.title}</b> {t.builtin ? <span className="pill">Fourni par MANAGER-IA</span> : <span className="pill good">Le vôtre</span>}
                  {t.kind === 'document' ? <><br /><small>{t.fields.length + ' champ(s) à compléter'}</small></> : null}
                </span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  {t.kind === 'document' ? <Act onClick={() => use(t)}>Utiliser</Act> : null}
                  <Act onClick={() => dupe(t)}>Dupliquer</Act>
                  {!t.builtin ? <Act onClick={() => edit(t)}>Modifier</Act> : null}
                  {!t.builtin ? <Act onClick={() => confirm('Supprimer ce modèle ?', () => { oapi('DELETE', '/legal/templates/' + t.id).then(st.reload).catch(fail); })}>Supprimer</Act> : null}
                </span>
              </div>
            ))}
          </>
        );
      }}
      </Loaded>
    </div>
  );
}
