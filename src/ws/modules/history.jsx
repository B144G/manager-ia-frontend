import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import ModuleShell from '../ModuleShell.jsx';
import { Badge, Button, Icon } from '../ui/index.jsx';
import { Loaded, useLoad } from '../ui.jsx';
import '../parts/history/history.css';
import { EventCard } from '../parts/history/Cards.jsx';
import { EventForm, MediaForm, PersonForm } from '../parts/history/Forms.jsx';
import OrgChart from '../parts/history/OrgChart.jsx';
import Timeline from '../parts/history/Timeline.jsx';
import Moments from '../parts/history/Moments.jsx';
import Stats from '../parts/history/Stats.jsx';
import Book from '../parts/history/Book.jsx';
import Gallery from '../parts/history/Gallery.jsx';
import People from '../parts/history/People.jsx';
import { Exports, Journal, Settings } from '../parts/history/Admin.jsx';
import { Pic, Video, forgetMedia, frDate, initials, stateIn, useLabels } from '../parts/history/util.jsx';

/* Histoire de l'entreprise : organigramme dans le temps, frise, moments forts et durs (séparés), rencontres, galerie, livre d'or.
   Lecture pour tous les membres ; la saisie dépend des droits désignés par le responsable du compte (le serveur décide, cet écran n'affiche que ce qu'il renvoie). */

export default function History() {
  const t = useT();
  const ws = useWs();
  const { oapi, orgId, info, can, modal, confirm, toast, fail } = ws;
  const [screen, setScreen] = useState('book');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  const set = useLoad(() => oapi('GET', '/history/settings'), [tick]);
  const ppl = useLoad(() => oapi('GET', '/history/people'), [tick]);
  const evs = useLoad(() => oapi('GET', '/history/events'), [tick]);
  const med = useLoad(() => oapi('GET', '/history/media'), [tick]);

  const people = ppl.data ? ppl.data.people : [];
  const events = evs.data ? evs.data.events : [];
  const media = med.data ? med.data.media : [];
  const canEdit = Boolean(set.data && set.data.canEdit);
  const direction = Boolean(set.data && set.data.direction);

  const H = useMemo(() => {
    const h = { orgId, orgName: info.org.name, oapi, can, canEdit, direction, people, events, media, tick, reload, toast, fail, employees: [] };
    const done = (close) => () => { close(); reload(); };

    h.editEvent = (e, preset) => modal(e ? t("Modifier l'événement") : t('Nouvel événement'), (close) => <EventForm H={h} event={e} preset={preset} onDone={done(close)} />, { wide: true });
    h.delEvent = (e) => confirm(t('Supprimer « {title} » et ses photos et vidéos ? Cette action est notée dans le journal.', { title: e.title }), () => oapi('DELETE', '/history/events/' + e.id).then(() => { e.media.forEach((m) => forgetMedia(orgId, m.id)); toast(t('Événement supprimé.')); reload(); }, fail), t('Supprimer'));
    h.editPerson = async (p) => {
      let employees = [];
      if (can('manager')) { try { employees = (await oapi('GET', '/history/employees')).employees; } catch { /* liste facultative */ } }
      modal(p ? t('Modifier la personne') : t('Nouvelle personne'), (close) => <PersonForm H={{ ...h, employees }} person={p} onDone={done(close)} />, { wide: true });
    };
    h.delPerson = (p) => confirm(t('Supprimer {name} de l’organigramme ? Ses subordonnés remontent d’un cran.', { name: p.name }), () => oapi('DELETE', '/history/people/' + p.id).then(() => { toast(t('Personne supprimée.')); reload(); }, fail), t('Supprimer'));
    h.importEmployees = () => confirm(t("Créer une fiche pour chaque employé du module Ressources humaines qui n'est pas encore dans l'organigramme ? Vous placerez ensuite chacun sous son supérieur."), () => oapi('POST', '/history/people/import-employees', {}).then((r) => { toast(t('{n} personne(s) importée(s).', { n: r.imported })); reload(); }, fail), t('Importer'));
    h.addMedia = (preset) => modal(t('Ajouter une photo ou une vidéo'), (close) => <MediaForm H={h} preset={preset} onDone={done(close)} />, { wide: true });
    h.openMedia = (m, list) => modal(m.caption || m.name, (close) => <MediaViewer H={h} m={m} list={list || [m]} close={close} />, { wide: true });
    h.openPerson = (id) => {
      const p = people.find((x) => x.id === id);
      if (p) modal(p.name, (close) => <PersonCard H={h} p={p} close={close} />, { wide: true });
    };
    return h;
  }, [orgId, info.org.name, oapi, can, canEdit, direction, people, events, media, tick, reload, toast, fail, modal, confirm, t]);

  const groups = [
    { id: 'story', icon: 'book-open', label: t("L'histoire"), items: [
      { id: 'book', label: t("Livre d'or"), hint: t("L'histoire de l'entreprise à lire, année après année.") },
      { id: 'timeline', label: t('Frise chronologique'), hint: t('Tous les événements depuis la création : moments forts en vert, moments durs en rouge.') },
      { id: 'moments', label: t('Moments forts et durs'), hint: t("Les bons et les mauvais moments séparés : ce qui a fait le succès, et ce qu'on en a retenu.") },
      { id: 'stats', label: t('Statistiques'), hint: t("Nombre de moments par année, trajectoire de l'entreprise, répartition par catégorie.") }] },
    { id: 'people', icon: 'sitemap', label: t('Les personnes'), items: [
      { id: 'chart', label: t('Organigramme'), hint: t("Qui était où, année après année : déplacez le curseur d'année.") },
      { id: 'people', label: t('Liste des personnes'), hint: t('Fondateur, direction, responsables, équipes : fiches, arrivées et départs.') }] },
    { id: 'media', icon: 'images', label: t('Photos et vidéos'), items: [
      { id: 'gallery', label: t('Galerie par année'), hint: t("Images et vidéos de l'entreprise, rangées par année.") }] },
  ];
  if (direction) groups.push({ id: 'admin', icon: 'lock', label: t('Direction'), items: [
    { id: 'journal', label: t('Journal de traçabilité'), hint: t('Qui a ajouté, modifié ou supprimé quoi, et quand.') },
    { id: 'settings', label: t('Droits de saisie'), hint: t('Choisissez qui peut ajouter ou modifier l’histoire.') }] });

  const ready = set.data && ppl.data && evs.data && med.data;
  const err = set.error || ppl.error || evs.error || med.error;
  let body = null;
  if (ready) {
    if (screen === 'book') body = <Book H={H} />;
    else if (screen === 'timeline') body = <Timeline H={H} />;
    else if (screen === 'moments') body = <Moments H={H} />;
    else if (screen === 'stats') body = <Stats H={H} />;
    else if (screen === 'chart') body = <OrgChart H={H} />;
    else if (screen === 'people') body = <People H={H} />;
    else if (screen === 'gallery') body = <Gallery H={H} />;
    else if (screen === 'journal') body = <Journal H={H} />;
    else body = <Settings H={H} />;
  }
  return (
    <ModuleShell title={t("Histoire de l'entreprise")} groups={groups} active={screen} onSelect={setScreen} actions={ready ? <Exports H={H} /> : null}>
      <Loaded state={ready ? { data: true, loading: false } : { data: null, loading: !err, error: err }}>{() => body}</Loaded>
    </ModuleShell>
  );
}

/** Fiche d'une personne : parcours, supérieur et équipe directe, événements où elle apparaît, photos. */
function PersonCard({ H, p, close }) {
  const t = useT();
  const L = useLabels();
  const now = new Date().getFullYear();
  const st = stateIn(p, now);
  const boss = H.people.find((x) => x.id === p.parentId);
  const team = H.people.filter((x) => x.parentId === p.id);
  const evs = H.events.filter((e) => e.people.some((q) => q.id === p.id));
  const pics = H.media.filter((m) => m.personId === p.id && m.id !== p.photoId);
  return (
    <div>
      <div className="hst-person">
        <span className="hst-av big">{p.photoId ? <Pic orgId={H.orgId} id={p.photoId} alt={p.name} fallback={initials(p.name)} /> : initials(p.name)}</span>
        <div>
          <h3>{p.name}</h3>
          <p className="muted" style={{ margin: 0 }}>{p.title || L.level[p.level]}</p>
          <p style={{ margin: '6px 0 0' }}>
            <Badge tone={st === 'former' ? 'neutral' : 'ok'}>{st === 'former' ? t('Ancien') : t('En poste')}</Badge>{' '}
            {p.employeeId ? <Badge tone="info"><Icon name="hr" />{t('Fiche RH reliée')}</Badge> : null}
          </p>
        </div>
      </div>
      <p className="small">
        {p.startDate ? t('Arrivée : {d}', { d: frDate(p.startDate) }) : t("Date d'arrivée inconnue")}{p.endDate ? ' · ' + t('Départ : {d}', { d: frDate(p.endDate) }) : ''}
        {p.departureReason ? ' · ' + p.departureReason : ''}
      </p>
      {boss ? <p className="small">{t('Supérieur')} : <button type="button" className="link" onClick={() => { close(); H.openPerson(boss.id); }}>{boss.name}</button></p> : null}
      {team.length ? <div className="hst-chips" aria-label={t('Équipe directe')}>{team.map((x) => <button type="button" className="hst-chip" key={x.id} onClick={() => { close(); H.openPerson(x.id); }}><Icon name="user" /> {x.name}</button>)}</div> : null}
      {p.bio ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.bio}</p> : null}
      {pics.length ? <div className="hst-thumbs">{pics.map((m) => <button type="button" className="hst-thumb" key={m.id} onClick={() => H.openMedia(m, pics)} aria-label={m.caption || m.name}>{m.kind === 'image' ? <Pic orgId={H.orgId} id={m.id} alt={m.caption || m.name} /> : <span className="hst-ph"><Icon name="film" /></span>}</button>)}</div> : null}
      {evs.length ? <><h4>{t('Dans l’histoire de l’entreprise')}</h4>{evs.map((e) => <EventCard key={e.id} H={H} e={e} compact />)}</> : null}
      {H.canEdit ? (
        <div className="hst-actions">
          <Button icon="edit" onClick={() => { close(); H.editPerson(p); }}>{t('Modifier')}</Button>
          <Button variant="danger-outline" icon="trash" onClick={() => { close(); H.delPerson(p); }}>{t('Supprimer')}</Button>
        </div>
      ) : null}
    </div>
  );
}

/** Visionneuse : grande image ou lecteur vidéo, image précédente / suivante, réglages du média pour ceux qui peuvent saisir. */
function MediaViewer({ H, m: m0, list, close }) {
  const t = useT();
  const L = useLabels();
  const [i, setI] = useState(Math.max(0, list.findIndex((x) => x.id === m0.id)));
  const m = list[i] || m0;
  const full = H.media.find((x) => x.id === m.id) || m;
  const ev = H.events.find((e) => e.id === full.eventId);
  const patch = (body) => H.oapi('PUT', '/history/media/' + m.id, body).then(() => { H.toast(t('Enregistré.')); H.reload(); close(); }, H.fail);
  const del = () => H.oapi('DELETE', '/history/media/' + m.id).then(() => { forgetMedia(H.orgId, m.id); H.toast(t('Fichier supprimé.')); H.reload(); close(); }, H.fail);
  return (
    <div>
      {m.kind === 'video' ? <Video orgId={H.orgId} id={m.id} label={m.caption || m.name} /> : <Pic orgId={H.orgId} id={m.id} alt={m.caption || m.name} className="hst-big" />}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <Button size="sm" icon="left" disabled={i === 0} onClick={() => setI(i - 1)}>{t('Précédent')}</Button>
        <span className="muted small">{i + 1} / {list.length}</span>
        <Button size="sm" iconRight="right" disabled={i >= list.length - 1} onClick={() => setI(i + 1)}>{t('Suivant')}</Button>
      </div>
      <p style={{ marginBottom: 4 }}><b>{full.caption || full.name}</b></p>
      <p className="muted small">
        {ev ? ev.title + ' · ' : ''}{full.takenOn ? frDate(full.takenOn) + ' · ' : ''}{full.visibility === 'direction' ? L.vis.direction : L.vis.internal}
        {full.hasPeople ? ' · ' + (full.consent ? t('accord des personnes recueilli') : t("sans l'accord des personnes : visible de la direction seulement")) : ''}
      </p>
      {H.canEdit ? (
        <div className="hst-actions">
          {full.hasPeople ? <Button size="sm" onClick={() => patch({ consent: !full.consent })}>{full.consent ? t("Retirer l'accord") : t("L'accord est recueilli")}</Button> : null}
          <Button size="sm" icon={full.visibility === 'direction' ? 'eye' : 'lock'} onClick={() => patch({ visibility: full.visibility === 'direction' ? 'internal' : 'direction' })}>{full.visibility === 'direction' ? t("Ouvrir à toute l'entreprise") : t('Réserver à la direction')}</Button>
          <Button size="sm" variant="danger-outline" icon="trash" onClick={del}>{t('Supprimer')}</Button>
        </div>
      ) : null}
    </div>
  );
}
