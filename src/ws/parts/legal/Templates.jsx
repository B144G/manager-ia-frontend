import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Act, Btn } from './Act.jsx';

/* Juridique : bibliothèque de modèles. Les modèles fournis par Brij-IA ne se modifient pas (on les duplique) ; ceux de l'organisation se gèrent librement.
   Informatifs : à faire relire par un professionnel du droit. Texte brut uniquement (jamais de HTML). */

const MENTION = 'Modèle informatif à faire relire par un professionnel du droit.';
const KINDS = [['document', 'Documents'], ['obligation', 'Obligations'], ['privacy', 'Registre des données']];
const OB_KINDS = [['license', 'Licence'], ['authorization', 'Autorisation'], ['insurance', 'Assurance'], ['declaration', 'Déclaration'], ['display', 'Affichage obligatoire'], ['inspection', 'Contrôle'], ['other', 'Autre']];

const fill = (body, vals) => body.replace(/\{\{(\w+)\}\}/g, (_, k) => (vals[k] && vals[k].trim()) || '[à compléter]');
const withMention = (t) => (t.includes(MENTION) ? t : t + '\n\n' + MENTION);

/** Remplir un modèle de document : formulaire généré depuis les champs {{nom}}, aperçu modifiable, copie et impression. */
function Filler({ model }) {
  const t = useT();
  const { copy, toast, today } = useWs();
  const [vals, setVals] = useState(() => ({ date: today().split('-').reverse().join('/') }));
  const [text, setText] = useState(() => withMention(fill(model.body, { date: today().split('-').reverse().join('/') })));
  const setVal = (k, v) => { const next = { ...vals, [k]: v }; setVals(next); setText(withMention(fill(model.body, next))); };
  // Impression : une page vide reçoit le texte par textContent (jamais de HTML), puis la fenêtre d'impression s'ouvre.
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) { toast(t("Votre navigateur a bloqué l'ouverture. Autorisez les fenêtres pour imprimer."), true); return; }
    const pre = w.document.createElement('pre');
    pre.textContent = text;
    pre.style.whiteSpace = 'pre-wrap'; pre.style.fontFamily = 'Georgia, serif'; pre.style.fontSize = '14px'; pre.style.margin = '24px';
    w.document.title = model.title;
    w.document.body.appendChild(pre);
    w.focus(); w.print();
  };
  return (
    <div>
      <p className="ws-err">{t('Modèle informatif à faire relire par un professionnel du droit.')}</p>
      {!model.fields.length ? <p className="muted small">{t("Ce modèle n'a aucun champ à compléter : modifiez directement le texte ci-dessous.")}</p> : null}
      <div className="ws-form">
        {model.fields.map((f) => <label className="fld" key={f.key}><span>{f.label}</span><input style={{ fontSize: 16 }} value={vals[f.key] || ''} autoComplete="off" onChange={(e) => setVal(f.key, e.target.value)} /></label>)}
      </div>
      <label className="fld"><span>{t('Aperçu du document (modifiable)')}</span><textarea style={{ fontSize: 16 }} rows={14} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Btn className="btn primary" onClick={() => copy(text, t('Texte copié.'))}>{t('Copier le texte')}</Btn>
        <Btn onClick={print}>{t('Imprimer')}</Btn>
      </div>
    </div>
  );
}

/** Création et modification d'un modèle de l'organisation. */
function editFields(kind, tpl, t) {
  const d = (tpl && tpl.data) || {};
  if (kind === 'document') {
    return [
      { k: 'title', label: t('Nom du modèle'), required: true, value: tpl && tpl.title },
      { k: 'body', label: t('Texte du modèle'), type: 'textarea', rows: 12, required: true, value: tpl && tpl.body, hint: t('Écrivez {{nom_du_champ}} là où une information doit être remplie : un formulaire est créé automatiquement. Exemple : Bonjour {{client}}.') },
    ];
  }
  if (kind === 'obligation') {
    return [
      { k: 'title', label: t('Nom du modèle'), required: true, value: tpl && tpl.title },
      { k: 'oTitle', label: t("Titre de l'obligation"), required: true, value: d.title },
      { k: 'oKind', label: t('Type'), type: 'select', options: OB_KINDS.map((x) => [x[0], t(x[1])]), value: d.kind || 'other' },
      { k: 'rec', label: t('Se répète tous les (mois)'), value: d.recurrenceMonths || '', hint: t('Ex. 12 pour une fois par an. Laissez vide si ponctuelle.') },
      { k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: d.notes },
    ];
  }
  return [
    { k: 'title', label: t('Nom du modèle'), required: true, value: tpl && tpl.title },
    { k: 'dataKind', label: t('Donnée collectée'), required: true, value: d.dataKind },
    { k: 'people', label: t('Personnes concernées'), value: d.people },
    { k: 'purpose', label: t('Pourquoi'), value: d.purpose },
    { k: 'retention', label: t('Durée de conservation'), value: d.retention },
    { k: 'notes', label: t('Notes'), value: d.notes },
  ];
}
function payloadOf(kind, v) {
  if (kind === 'document') return { kind, title: v.title, body: v.body };
  if (kind === 'obligation') return { kind, title: v.title, data: { title: v.oTitle, kind: v.oKind, recurrenceMonths: v.rec, notes: v.notes } };
  return { kind, title: v.title, data: { dataKind: v.dataKind, people: v.people, purpose: v.purpose, retention: v.retention, notes: v.notes } };
}

export default function Templates() {
  const t = useT();
  const { oapi, modal, confirm, fail, toast } = useWs();
  const [kind, setKind] = useState('document');
  const st = useLoad(() => oapi('GET', '/legal/templates'), []);
  const edit = (tpl) => modal(tpl ? t('Modifier le modèle') : t('Nouveau modèle'), (close) => (
    <Form
      submitText={t('Enregistrer')}
      fields={editFields(kind, tpl, t)}
      onSubmit={(v) => oapi(tpl ? 'PUT' : 'POST', '/legal/templates' + (tpl ? '/' + tpl.id : ''), payloadOf(kind, v)).then(() => { close(); st.reload(); })}
    />
  ), { wide: true });
  const dupe = (tpl) => oapi('POST', '/legal/templates/' + encodeURIComponent(tpl.id) + '/duplicate').then(() => { toast(t('Copie créée : vous pouvez la modifier.')); st.reload(); }).catch(fail);
  const use = (tpl) => modal(tpl.title, () => <Filler model={tpl} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>{t('Modèles')}</h2><Btn className="btn primary small" onClick={() => edit(null)}>{t('Nouveau modèle')}</Btn></div>
      <p className="ws-err">{t('Modèle informatif à faire relire par un professionnel du droit.')}</p>
      <p className="muted small">{t("Les modèles « fournis par Brij-IA » ne se modifient pas : dupliquez-les pour en faire votre version. Les lois changent d'un pays à l'autre : adaptez chaque texte à votre situation. Les modèles d'obligations et du registre se retrouvent comme exemples dans les onglets Obligations et Données personnelles.")}</p>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {KINDS.map((k) => <Btn key={k[0]} className={'btn small' + (kind === k[0] ? ' primary' : '')} onClick={() => setKind(k[0])}>{t(k[1])}</Btn>)}
      </div>
      <Loaded state={st}>{(j) => {
        const list = j.templates.filter((x) => x.kind === kind);
        return (
          <>
            {!list.length ? <Empty text={t('Aucun modèle.')} /> : null}
            {list.map((x) => (
              <div className="line" key={x.id} style={{ flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 220px' }}>
                  <b>{x.title}</b> {x.builtin ? <span className="pill">{t('Fourni par Brij-IA')}</span> : <span className="pill good">{t('Le vôtre')}</span>}
                  {x.kind === 'document' ? <><br /><small>{t('{n} champ(s) à compléter', { n: x.fields.length })}</small></> : null}
                </span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  {x.kind === 'document' ? <Act onClick={() => use(x)}>{t('Utiliser')}</Act> : null}
                  <Act onClick={() => dupe(x)}>{t('Dupliquer')}</Act>
                  {!x.builtin ? <Act onClick={() => edit(x)}>{t('Modifier')}</Act> : null}
                  {!x.builtin ? <Act onClick={() => confirm(t('Supprimer ce modèle ?'), () => { oapi('DELETE', '/legal/templates/' + x.id).then(st.reload).catch(fail); })}>{t('Supprimer')}</Act> : null}
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
