import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { REMINDERS, TYPE_IDS, useLabels, useReminderLabel, useMtg } from './common.jsx';

/* Types de réunions : les six catégories portent les droits (qui convoque, qui valide) ; chaque organisation peut ajouter ses propres types (nom, couleur,
   durée, confidentialité, rappel, modèle d'ordre du jour, quorum). Un type personnalisé suit les droits de sa catégorie. */

function TypeForm({ close, onSaved, type, templates }) {
  const t = useT();
  const L = useLabels();
  const rem = useReminderLabel();
  const { oapi, fail } = useMtg();
  const [f, setF] = useState(() => ({
    name: type ? type.name : '', base: type ? type.base : 'team', color: type && type.color ? type.color : '#2f6fed', durationMin: type ? type.durationMin : 60, confidential: type ? type.confidential : false, reminderMin: type ? type.reminderMin : 0,
    templateId: type && type.templateId ? String(type.templateId) : '', quorumOn: Boolean(type && type.quorum), minCount: type && type.quorum ? type.quorum.minCount : 2, minPercent: type && type.quorum ? type.quorum.minPercent : 0, active: type ? type.active : true,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = (ev) => {
    ev.preventDefault(); setErr('');
    if (!f.name.trim()) { setErr(t('Indiquez le nom du type de réunion.')); return; }
    const body = { name: f.name, base: f.base, color: f.color, durationMin: Number(f.durationMin), confidential: f.confidential, reminderMin: Number(f.reminderMin), templateId: f.templateId || null, active: f.active,
      quorum: f.quorumOn ? { minCount: Number(f.minCount) || 0, minPercent: Number(f.minPercent) || 0 } : null };
    setBusy(true);
    oapi(type ? 'PUT' : 'POST', '/meetings/types' + (type ? '/' + type.id : ''), body).then(() => { close(); onSaved(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={save} noValidate>
      <Field label={t('Nom du type')} required error={err}>{(p) => <input {...p} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />}</Field>
      <div className="mtg-grid2">
        <Field label={t('Catégorie (détermine les droits)')} hint={t('Qui convoque et qui valide : règles de cette catégorie.')}>{(p) => <select {...p} value={f.base} onChange={(e) => set('base', e.target.value)}>{TYPE_IDS.map((x) => <option key={x} value={x}>{L.types[x]}</option>)}</select>}</Field>
        <Field label={t('Couleur')}>{(p) => <input {...p} type="color" value={f.color} onChange={(e) => set('color', e.target.value)} />}</Field>
        <Field label={t('Durée par défaut (minutes)')}>{(p) => <input {...p} type="number" min="5" max="1440" value={f.durationMin} onChange={(e) => set('durationMin', e.target.value)} />}</Field>
        <Field label={t('Rappel par défaut')}>{(p) => <select {...p} value={f.reminderMin} onChange={(e) => set('reminderMin', e.target.value)}>{REMINDERS.map((m) => <option key={m} value={m}>{rem(m)}</option>)}</select>}</Field>
        <Field label={t("Modèle d'ordre du jour")}>{(p) => <select {...p} value={f.templateId} onChange={(e) => set('templateId', e.target.value)}><option value="">{t('— Aucun —')}</option>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
      </div>
      <label className="mtg-check"><input type="checkbox" checked={f.confidential} onChange={(e) => set('confidential', e.target.checked)} />{t('Confidentielle par défaut')}</label>
      <label className="mtg-check"><input type="checkbox" checked={f.quorumOn} onChange={(e) => set('quorumOn', e.target.checked)} />{t('Règle de quorum propre à ce type (remplace celle de la catégorie)')}</label>
      {f.quorumOn ? <div className="mtg-grid2"><Field label={t('Nombre minimal de présents')}>{(p) => <input {...p} type="number" min="0" max="100" value={f.minCount} onChange={(e) => set('minCount', e.target.value)} />}</Field><Field label={t('Pourcentage minimal (%)')}>{(p) => <input {...p} type="number" min="0" max="100" value={f.minPercent} onChange={(e) => set('minPercent', e.target.value)} />}</Field></div> : null}
      {type ? <label className="mtg-check"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />{t('Type actif (proposé à la convocation)')}</label> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

export default function TypesScreen() {
  const t = useT();
  const L = useLabels();
  const { oapi, modal, confirm, toast, fail, info } = useMtg();
  const st = useLoad(() => Promise.all([oapi('GET', '/meetings/types'), oapi('GET', '/meetings/templates')]), []);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={6} />;
  const [ty, tp] = st.data;
  const canEdit = ['owner', 'admin'].includes(info.me.role);
  const edit = (x) => modal(x ? t('Modifier le type') : t('Nouveau type de réunion'), (close) => <TypeForm close={close} onSaved={st.reload} type={x} templates={tp.templates} />, { wide: true });
  const del = (x) => confirm(t('Supprimer ce type ? S’il a déjà servi, il sera seulement désactivé.'), () => oapi('DELETE', '/meetings/types/' + x.id).then((r) => { toast(r.deactivated ? t('Type désactivé (il a déjà servi).') : t('Type supprimé.')); st.reload(); }).catch(fail));
  return (
    <div className="mtg">
      <Alert tone="info" title={t('Les droits suivent la catégorie')}>{t("Un type de votre organisation reprend les droits de sa catégorie : le propriétaire garde la main sur qui convoque et qui valide, dans les réglages des réunions.")}</Alert>
      <Card title={t('Catégories de réunion')}>
        <ul className="mtg-list">{ty.builtin.map((x) => <li className="mtg-person" key={x.id}><span><b>{L.types[x.id]}</b><small>{x.quorum ? t('Quorum : {n} présent(s) / {p} %', { n: x.quorum.minCount, p: x.quorum.minPercent }) : t('Quorum non exigé')}</small></span><Badge tone="outline">{t('Catégorie')}</Badge></li>)}</ul>
      </Card>
      <Card title={t('Types de votre organisation')} actions={canEdit ? <Button size="sm" variant="primary" icon="plus" onClick={() => edit(null)}>{t('Nouveau type')}</Button> : null}>
        {ty.custom.length ? <ul className="mtg-list">{ty.custom.map((x) => (
          <li className="mtg-person" key={x.id}>
            <span><b><span className="mtg-dot" style={{ background: x.color || 'var(--accent)' }} aria-hidden="true" /> {x.name}</b><small>{L.types[x.base]} · {t('{n} min', { n: x.durationMin })}{x.confidential ? ' · ' + t('confidentielle') : ''}{x.quorum ? ' · ' + t('quorum propre') : ''} · {t('{n} réunion(s)', { n: x.meetings })}</small></span>
            <span className="mtg-row">{x.active ? null : <Badge tone="neutral">{t('Désactivé')}</Badge>}{canEdit ? <><Button size="sm" variant="ghost" iconOnly label={t('Modifier')} icon="pen" onClick={() => edit(x)} /><Button size="sm" variant="ghost" iconOnly label={t('Supprimer')} icon="trash" onClick={() => del(x)} /></> : null}</span>
          </li>
        ))}</ul> : <EmptyState icon="tags" title={t('Aucun type personnalisé')}>{t('Créez par exemple « Comité de pilotage » ou « Revue qualité » avec leur durée, leur rappel et leur modèle d\'ordre du jour.')}</EmptyState>}
      </Card>
    </div>
  );
}
