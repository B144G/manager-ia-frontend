import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Badge, Button, Card, EmptyState, Field, Icon, Segmented, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { DateTile, TYPE_IDS, TypeDot, fmtShort, useDownload, useLabels, useMtg } from './common.jsx';
import '../../../styles/ws-meetings-adv-a.css';

/* Registre des résolutions (adoptées, rejetées, reportées, sans quorum, en attente) et archives des réunions (compte rendu validé, PV signé). */

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => thisYear + 1 - i);
const STATUS_TONE = { pending: 'info', adopted: 'ok', rejected: 'danger', postponed: 'warn', no_quorum: 'neutral' };

export function Registry({ openMeeting }) {
  const t = useT();
  const { oapi, dateFr } = useMtg();
  const dl = useDownload();
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [mine, setMine] = useState(false);
  const [qIn, setQIn] = useState('');
  const [q, setQ] = useState('');
  const STATUS = { pending: t('En attente'), adopted: t('Adoptée'), rejected: t('Rejetée'), postponed: t('Reportée'), no_quorum: t('Sans quorum') };
  const p = new URLSearchParams();
  if (status) p.set('status', status);
  if (year) p.set('year', year);
  if (mine) p.set('mine', '1');
  if (q) p.set('q', q);
  const st = useLoad(() => oapi('GET', '/meetings/resolutions?' + p.toString()), [status, year, mine, q]);
  const list = (st.data && st.data.resolutions) || [];
  const submit = (ev) => { ev.preventDefault(); setQ(qIn.trim()); };
  const csv = () => {
    const x = new URLSearchParams(p);
    dl('/resolutions.csv' + (x.toString() ? '?' + x : ''), 'resolutions.csv');
  };
  return (
    <div className="mtg">
      <Card title={t('Registre des résolutions')} subtitle={t('Toutes les résolutions des réunions, avec leur numéro, leur porteur et le résultat du vote.')}
        actions={<Button size="sm" icon="download" onClick={csv}>{t('Exporter en CSV')}</Button>}>
        <form className="mtg-adv-filters" onSubmit={submit} role="search">
          <Segmented label={t('Statut')} value={status} onChange={setStatus} items={[{ id: '', label: t('Toutes') }, ...Object.keys(STATUS).map((k) => ({ id: k, label: STATUS[k] }))]} />
          <div className="mtg-grid2">
            <Field label={t('Rechercher')}>{(f) => <input {...f} type="search" value={qIn} placeholder={t('Numéro, titre ou texte')} maxLength={100} onChange={(e) => setQIn(e.target.value)} />}</Field>
            <Field label={t('Année')}>{(f) => <select {...f} value={year} onChange={(e) => setYear(e.target.value)}><option value="">{t('Toutes les années')}</option>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select>}</Field>
          </div>
          <div className="mtg-row">
            <label className="mtg-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('Seulement les résolutions que je porte')}</label>
            <Button variant="primary" type="submit" icon="magnifying-glass">{t('Rechercher')}</Button>
          </div>
        </form>
      </Card>
      {st.error ? <Failed e={st.error} /> : null}
      {st.loading && !st.data ? <Skeleton lines={5} /> : null}
      {st.data && !list.length ? <EmptyState icon="gavel" title={t('Aucune résolution')}>{t("Aucune résolution ne correspond à ces filtres. Les résolutions apparaissent ici une fois le compte rendu validé ou le vote ouvert.")}</EmptyState> : null}
      <ul className="mtg-list">{list.map((r) => (
        <li key={r.id} className="mtg-adv-res">
          <div className="mtg-adv-res-h">
            <b className="mtg-adv-num">{r.number}</b>
            <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{STATUS[r.status] || r.status}</Badge>
          </div>
          <p className="mtg-adv-res-t"><b>{r.title || r.text}</b></p>
          {r.title && r.text && r.text !== r.title ? <p className="mtg-muted mtg-adv-clamp">{r.text}</p> : null}
          <dl className="mtg-adv-facts">
            <div><dt>{t('Porteur')}</dt><dd>{r.carrier || t('Non désigné')}</dd></div>
            <div><dt>{t('Échéance')}</dt><dd>{r.due ? dateFr(r.due) : '—'}</dd></div>
            <div><dt>{t('Résultat')}</dt><dd>{r.result ? t('{a} pour · {b} contre · {c} abst.', { a: r.result.for, b: r.result.against, c: r.result.abstain }) : '—'}</dd></div>
          </dl>
          <button type="button" className="mtg-adv-link" onClick={() => openMeeting(r.meetingId)}><Icon name="calendar" /> {r.meetingTitle}{r.meetingDate ? ' (' + fmtShort(r.meetingDate) + ')' : ''}</button>
        </li>
      ))}</ul>
    </div>
  );
}

export function Archives({ openMeeting }) {
  const t = useT();
  const L = useLabels();
  const { oapi } = useMtg();
  const [qIn, setQIn] = useState('');
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState('');
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (year) p.set('year', year);
  if (type) p.set('type', type);
  const st = useLoad(() => oapi('GET', '/meetings/archives?' + p.toString()), [q, year, type]);
  const list = (st.data && st.data.meetings) || [];
  const submit = (ev) => { ev.preventDefault(); setQ(qIn.trim()); };
  return (
    <div className="mtg">
      <Card title={t('Archives')} subtitle={t('Réunions archivées : compte rendu validé, procès-verbal signé, documents et résolutions.')}>
        <form className="mtg-adv-filters" onSubmit={submit} role="search">
          <div className="mtg-grid2">
            <Field label={t('Rechercher')}>{(f) => <input {...f} type="search" value={qIn} placeholder={t('Titre ou objet de la réunion')} maxLength={100} onChange={(e) => setQIn(e.target.value)} />}</Field>
            <Field label={t('Année')}>{(f) => <select {...f} value={year} onChange={(e) => setYear(e.target.value)}><option value="">{t('Toutes les années')}</option>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select>}</Field>
            <Field label={t('Type de réunion')}>{(f) => <select {...f} value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Tous les types')}</option>{TYPE_IDS.map((x) => <option key={x} value={x}>{L.types[x]}</option>)}</select>}</Field>
          </div>
          <div className="mtg-row"><Button variant="primary" type="submit" icon="magnifying-glass">{t('Rechercher')}</Button></div>
        </form>
      </Card>
      {st.error ? <Failed e={st.error} /> : null}
      {st.loading && !st.data ? <Skeleton lines={5} /> : null}
      {st.data && !list.length ? <EmptyState icon="box-archive" title={t('Aucune réunion archivée')}>{t("Archivez une réunion dont le compte rendu est validé depuis sa fiche : elle apparaîtra ici.")}</EmptyState> : null}
      <ul className="mtg-list">{list.map((m) => (
        <li key={m.id}>
          <button type="button" className="mtg-item" onClick={() => openMeeting(m.id)}>
            <DateTile date={m.date} />
            <span>
              <b>{m.title}</b>
              <small><TypeDot type={m.type} /> {L.types[m.type] || m.type} · {fmtShort(m.date)} · {t('{n} document(s)', { n: m.documents })} · {t('{n} résolution(s)', { n: m.resolutions })}</small>
            </span>
            <span className="mtg-row">
              {m.pvNumber ? <Badge tone="ok">{t('PV {n}', { n: m.pvNumber })}</Badge> : <Badge tone="neutral">{t('Pas de PV signé')}</Badge>}
              {m.confidential ? <Badge tone="outline"><Icon name="lock" />{t('Confidentielle')}</Badge> : null}
            </span>
          </button>
        </li>
      ))}</ul>
    </div>
  );
}

export default Registry;
