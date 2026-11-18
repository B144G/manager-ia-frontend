import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Badge, Button, Card, EmptyState, Field, Segmented, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { DateTile, TYPE_IDS, TypeDot, fmtShort, todayLocal, useDownload, useLabels, StatusBadges, useMtg } from './common.jsx';

/* Suivi des actions de toutes les réunions, et recherche dans l'historique avec exports. */

export function ActionsScreen({ openMeeting }) {
  const t = useT();
  const L = useLabels();
  const { oapi, dateFr } = useMtg();
  const dl = useDownload();
  const [status, setStatus] = useState('open');
  const [mine, setMine] = useState(false);
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (mine) q.set('mine', '1');
  const st = useLoad(() => oapi('GET', '/meetings/actions?' + q.toString()), [status, mine]);
  const list = (st.data && st.data.actions) || [];
  return (
    <div className="mtg">
      <div className="mtg-row between">
        <Segmented label={t('Statut')} value={status} onChange={setStatus} items={[{ id: 'open', label: t('À faire') }, { id: 'overdue', label: t('En retard') }, { id: 'done', label: t('Faites') }, { id: '', label: t('Toutes') }]} />
        <div className="mtg-row">
          <label className="mtg-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('Seulement mes actions')}</label>
          <Button size="sm" icon="download" onClick={() => dl('/actions.csv', 'actions-reunions.csv')}>{t('Exporter en CSV')}</Button>
        </div>
      </div>
      <p className="mtg-muted">{t("Les actions décidées en réunion et validées sont des tâches de Projets : leur avancement se met à jour dans les deux sens.")}</p>
      {st.error ? <Failed e={st.error} /> : null}
      {st.loading && !st.data ? <Skeleton lines={5} /> : null}
      {st.data && !list.length ? <EmptyState icon="circle-check" title={t('Aucune action ici')}>{t('Rien à suivre avec ce filtre.')}</EmptyState> : null}
      <ul className="mtg-list">{list.map((a) => (
        <li key={a.id}>
          <button type="button" className="mtg-item" onClick={() => openMeeting(a.meetingId)}>
            <span className="mtg-dot" style={{ background: a.overdue ? 'var(--danger)' : a.status === 'done' ? 'var(--ok)' : 'var(--accent)' }} aria-hidden="true" />
            <span><b>{a.text}</b><small>{a.assignee || t('Responsable à définir')} · {a.meetingTitle} ({dateFr(a.meetingDate)}){a.due ? ' · ' + t('pour le {date}', { date: dateFr(a.due) }) : ''}</small></span>
            <Badge tone={a.status === 'done' ? 'ok' : a.status === 'cancelled' ? 'neutral' : a.overdue ? 'danger' : 'brand'}>{a.overdue ? t('En retard') : L.action[a.status]}</Badge>
          </button>
        </li>
      ))}</ul>
    </div>
  );
}

export function SearchScreen({ openMeeting }) {
  const t = useT();
  const L = useLabels();
  const { oapi, fail } = useMtg();
  const dl = useDownload();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const go = (ev) => {
    ev.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    oapi('GET', '/meetings/search?q=' + encodeURIComponent(q.trim())).then((j) => setRes(j.results)).catch(fail).finally(() => setBusy(false));
  };
  const exp = () => { const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); if (type) p.set('type', type); dl('/export.csv' + (p.toString() ? '?' + p : ''), 'reunions.csv'); };
  return (
    <div className="mtg">
      <Card title={t("Rechercher dans l'historique")} subtitle={t('Titres, objets, notes, décisions et actions des comptes rendus validés.')}>
        <form className="mtg-row" onSubmit={go} role="search">
          <input className="mtg-grow" type="search" aria-label={t('Rechercher')} placeholder={t('Un mot, un nom, un chantier…')} value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} style={{ flex: '1 1 220px' }} />
          <Button variant="primary" type="submit" icon="magnifying-glass" loading={busy}>{t('Rechercher')}</Button>
        </form>
        {res ? (res.length ? <ul className="mtg-list" style={{ marginTop: 12 }}>{res.map((x) => (
          <li key={x.id}><button type="button" className="mtg-item" onClick={() => openMeeting(x.id)}><DateTile date={x.date} /><span><b>{x.title}</b><small><TypeDot type={x.type} /> {L.types[x.type]} · {fmtShort(x.date)}{x.snippet ? ' — « ' + x.snippet + ' »' : ''}</small></span><span className="mtg-row"><StatusBadges m={{ ...x, confidential: false }} /></span></button></li>
        ))}</ul> : <EmptyState icon="magnifying-glass" title={t('Aucun résultat')}>{t('Essayez un autre mot.')}</EmptyState>) : null}
      </Card>
      <Card title={t('Exporter les réunions')} subtitle={t('Fichier CSV lisible dans Excel : date, titre, type, lieu, statut, présences.')}>
        <div className="mtg-grid2">
          <Field label={t('Du')}>{(p) => <input {...p} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label={t('Au')}>{(p) => <input {...p} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />}</Field>
          <Field label={t('Type de réunion')}>{(p) => <select {...p} value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Tous les types')}</option>{TYPE_IDS.map((x) => <option key={x} value={x}>{L.types[x]}</option>)}</select>}</Field>
        </div>
        <div className="mtg-row" style={{ marginTop: 12 }}><Button icon="download" onClick={exp}>{t('Exporter les réunions en CSV')}</Button><Button icon="download" onClick={() => dl('/actions.csv', 'actions-reunions.csv')}>{t('Exporter les actions en CSV')}</Button></div>
        <p className="mtg-muted" style={{ marginTop: 8 }}>{t('Le compte rendu d\'une réunion s\'exporte en PDF depuis sa fiche.')} {todayLocal() ? '' : ''}</p>
      </Card>
    </div>
  );
}
