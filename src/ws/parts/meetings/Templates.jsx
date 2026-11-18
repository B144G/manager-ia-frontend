import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Failed } from './Failed.jsx';
import { Badge, Button, Card, EmptyState, Field, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { TYPE_IDS, useLabels, useMtg } from './common.jsx';

/* Modèles d'ordre du jour : modèles intégrés (traduits) et modèles propres à l'organisation. */

export function useBuiltinTemplates() {
  const t = useT();
  return [
    { id: 'b-team', builtin: true, name: t("Réunion d'équipe hebdomadaire"), type: 'team', durationMin: 60, items: [
      { title: t('Tour de table et nouvelles'), durationMin: 10 }, { title: t('Suivi des actions de la dernière réunion'), durationMin: 15 }, { title: t('Sujets du jour'), durationMin: 25 }, { title: t('Questions diverses et prochaine réunion'), durationMin: 10 }] },
    { id: 'b-direction', builtin: true, name: t('Réunion de direction'), type: 'direction', durationMin: 90, items: [
      { title: t('Indicateurs clés du mois'), durationMin: 20 }, { title: t('Trésorerie et finances'), durationMin: 20 }, { title: t('Décisions stratégiques'), durationMin: 35 }, { title: t('Plan d\'actions et responsables'), durationMin: 15 }] },
    { id: 'b-site', builtin: true, name: t('Point de chantier'), type: 'site', durationMin: 45, items: [
      { title: t('Avancement des travaux'), durationMin: 15 }, { title: t('Sécurité et incidents'), durationMin: 10 }, { title: t('Approvisionnement et matériel'), durationMin: 10 }, { title: t('Planning de la semaine'), durationMin: 10 }] },
    { id: 'b-client', builtin: true, name: t('Réunion client'), type: 'client', durationMin: 60, items: [
      { title: t('Présentation et objectifs'), durationMin: 10 }, { title: t('Point sur le projet ou la commande'), durationMin: 25 }, { title: t('Demandes et réclamations du client'), durationMin: 15 }, { title: t('Prochaines étapes'), durationMin: 10 }] },
    { id: 'b-committee', builtin: true, name: t('Comité de suivi'), type: 'committee', durationMin: 60, items: [
      { title: t('Approbation du compte rendu précédent'), durationMin: 5 }, { title: t('Rapport des responsables'), durationMin: 30 }, { title: t('Décisions à prendre'), durationMin: 20 }, { title: t('Date de la prochaine réunion'), durationMin: 5 }] },
  ];
}

function TemplateForm({ close, onSaved, tpl }) {
  const t = useT();
  const L = useLabels();
  const { oapi, fail, toast } = useMtg();
  const [name, setName] = useState(tpl ? tpl.name : '');
  const [type, setType] = useState(tpl ? tpl.type : 'team');
  const [dur, setDur] = useState(tpl ? tpl.durationMin : 60);
  const [items, setItems] = useState(tpl ? tpl.items : [{ title: '', durationMin: 10 }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (i, k, v) => setItems((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = (ev) => {
    ev.preventDefault(); setErr('');
    const body = { name, type, durationMin: Number(dur), items: items.filter((x) => x.title.trim()).map((x) => ({ title: x.title.trim(), durationMin: Number(x.durationMin) || 0 })) };
    setBusy(true);
    oapi(tpl ? 'PUT' : 'POST', '/meetings/templates' + (tpl ? '/' + tpl.id : ''), body).then(() => { toast(t('Modèle enregistré.')); close(); onSaved(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={save} noValidate>
      <Field label={t('Nom du modèle')} required>{(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}</Field>
      <div className="mtg-grid2">
        <Field label={t('Type de réunion')}>{(p) => <select {...p} value={type} onChange={(e) => setType(e.target.value)}>{TYPE_IDS.map((x) => <option key={x} value={x}>{L.types[x]}</option>)}</select>}</Field>
        <Field label={t('Durée (minutes)')}>{(p) => <input {...p} type="number" min="5" max="1440" value={dur} onChange={(e) => setDur(e.target.value)} />}</Field>
      </div>
      <b>{t("Points de l'ordre du jour")}</b>
      {items.map((it, i) => (
        <div className="mtg-row" key={i}>
          <input className="mtg-grow" aria-label={t('Titre du point')} placeholder={t('Titre du point')} value={it.title} onChange={(e) => set(i, 'title', e.target.value)} maxLength={200} />
          <input aria-label={t('Durée (minutes)')} type="number" min="0" max="600" value={it.durationMin} onChange={(e) => set(i, 'durationMin', e.target.value)} style={{ width: 84 }} />
          <Button type="button" iconOnly label={t('Retirer ce point')} icon="trash" variant="ghost" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div><Button type="button" size="sm" icon="plus" onClick={() => setItems((l) => [...l, { title: '', durationMin: 10 }])}>{t('Ajouter un point')}</Button></div>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

export default function TemplatesScreen({ canConvene }) {
  const t = useT();
  const L = useLabels();
  const { oapi, modal, confirm, toast, fail } = useMtg();
  const builtin = useBuiltinTemplates();
  const st = useLoad(() => oapi('GET', '/meetings/templates'), []);
  const mine = (st.data && st.data.templates) || [];
  const edit = (tpl) => modal(tpl ? t('Modifier le modèle') : t('Nouveau modèle'), (close) => <TemplateForm close={close} onSaved={st.reload} tpl={tpl} />, { wide: true });
  const del = (tpl) => confirm(t('Supprimer le modèle « {name} » ?', { name: tpl.name }), () => oapi('DELETE', '/meetings/templates/' + tpl.id).then(() => { toast(t('Modèle supprimé.')); st.reload(); }).catch(fail));
  const show = (tpl) => (
    <Card key={tpl.id} title={tpl.name} subtitle={`${L.types[tpl.type]} · ${t('{n} min', { n: tpl.durationMin })}`}
      actions={tpl.builtin ? <Badge tone="outline">{t('Intégré')}</Badge> : canConvene ? <><Button size="sm" variant="ghost" iconOnly label={t('Modifier')} icon="pen" onClick={() => edit(tpl)} /><Button size="sm" variant="ghost" iconOnly label={t('Supprimer')} icon="trash" onClick={() => del(tpl)} /></> : null}>
      <ol className="mtg-pre" style={{ paddingLeft: 20, margin: 0 }}>{tpl.items.map((x, i) => <li key={i}>{x.title}{x.durationMin ? <span className="mtg-muted"> · {t('{n} min', { n: x.durationMin })}</span> : null}</li>)}</ol>
    </Card>
  );
  return (
    <div className="mtg">
      <p className="mtg-muted">{t("Un modèle remplit l'ordre du jour d'une nouvelle réunion en un clic. Vous pouvez le modifier ensuite.")}</p>
      {canConvene ? <div><Button variant="primary" icon="plus" onClick={() => edit(null)}>{t('Nouveau modèle')}</Button></div> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {st.loading && !st.data ? <Skeleton lines={4} /> : null}
      <h3>{t("Modèles de l'organisation")}</h3>
      {st.data && !mine.length ? <EmptyState icon="clipboard-list" title={t("Aucun modèle propre à l'organisation")}>{t('Créez un modèle pour les réunions que vous répétez.')}</EmptyState> : null}
      <div className="mtg-grid2">{mine.map(show)}</div>
      <h3>{t('Modèles intégrés')}</h3>
      <div className="mtg-grid2">{builtin.map(show)}</div>
    </div>
  );
}
