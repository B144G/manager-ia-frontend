import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, ChartFrame, EmptyState, Skeleton, Stat } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { Bars, Donut, SERIES } from '../../charts/lazy.jsx';
import { DateTile, RespondForm, TypeDot, fmtShort, useLabels, useMtg } from './common.jsx';

/* Tableau de bord des réunions : réunions du mois, actions ouvertes et en retard, taux de présence, comptes rendus à valider. */

const monthShift = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthName = (m, locale) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }); };

export default function Home({ go, openMeeting }) {
  const t = useT();
  const L = useLabels();
  const { oapi, dateFr, modal } = useMtg();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/meetings/dashboard?month=' + month), [month]);
  const d = st.data;
  const locale = document.documentElement.lang || 'fr';
  const answer = (m) => modal(t('Répondre à la convocation'), (close) => <RespondForm close={close} meetingId={m.id} title={m.title} onDone={st.reload} />);
  if (st.error) return <Failed e={st.error} />;
  if (!d) return <Skeleton lines={6} />;
  const mt = d.trend.map((x) => ({ x: x.month.slice(5), [t('Réunions')]: x.meetings }));
  return (
    <div className="mtg">
      <div className="mtg-row between">
        <div className="mtg-row">
          <Button size="sm" iconOnly label={t('Mois précédent')} icon="chevron-left" onClick={() => setMonth(monthShift(month, -1))} />
          <b className="mtg-cal-title">{monthName(month, locale)}</b>
          <Button size="sm" iconOnly label={t('Mois suivant')} icon="chevron-right" onClick={() => setMonth(monthShift(month, 1))} />
        </div>
        {d.canConvene ? <Button variant="primary" icon="plus" onClick={() => go('new')}>{t('Nouvelle réunion')}</Button> : null}
      </div>

      <div className="mtg-stats">
        <Stat icon="calendar-check" label={t('Réunions du mois')} value={d.meetings.total} sub={t('{n} tenue(s), {m} à venir', { n: d.meetings.held, m: d.meetings.planned })} onClick={() => go('calendar')} />
        <Stat icon="user-group" tone="ok" label={t('Taux de présence')} value={d.attendanceRate === null ? '—' : d.attendanceRate + ' %'} sub={t('présence réelle des convoqués')} />
        <Stat icon="list-check" tone="warn" label={t('Actions ouvertes')} value={d.actions.open} sub={t('{n} faite(s)', { n: d.actions.done })} onClick={() => go('actions')} />
        <Stat icon="triangle-exclamation" tone={d.actions.late ? 'danger' : 'ok'} label={t('Actions en retard')} value={d.actions.late} onClick={() => go('actions')} />
        {d.canValidate ? <Stat icon="clipboard-check" tone={d.pending.length ? 'warn' : 'ok'} label={t('Comptes rendus à valider')} value={d.pending.length} /> : null}
      </div>

      {d.toAnswer ? <Alert tone="info" title={t('{n} réunion(s) attendent votre réponse', { n: d.toAnswer })}>{t('Indiquez si vous serez présent, absent ou excusé.')}</Alert> : null}

      {d.pending.length ? (
        <Card title={t('Comptes rendus à valider')} subtitle={t('Relisez puis validez, ou renvoyez avec un motif.')}>
          <ul className="mtg-list">{d.pending.map((p) => (
            <li key={p.id}><button type="button" className="mtg-item" onClick={() => openMeeting(p.id)}><DateTile date={p.date} /><span><b>{p.title}</b><small>{L.types[p.type]}{p.submittedBy ? ' · ' + t('rédigé par {name}', { name: p.submittedBy }) : ''}</small></span><Badge tone="info">{t('À valider')}</Badge></button></li>
          ))}</ul>
        </Card>
      ) : null}

      <div className="mtg-grid2">
        <Card title={t('Mes prochaines réunions')}>
          {d.upcoming.length ? <ul className="mtg-list">{d.upcoming.map((u) => (
            <li key={u.id}>
              <button type="button" className="mtg-item" onClick={() => openMeeting(u.id)}><DateTile date={u.date} /><span><b>{u.title}</b><small><TypeDot type={u.type} /> {fmtShort(u.date)} · {u.time}</small></span><Badge tone={u.response === 'present' ? 'ok' : u.response === 'pending' ? 'warn' : 'neutral'}>{L.resp[u.response]}</Badge></button>
              {u.response === 'pending' ? <div className="mtg-row" style={{ marginTop: 6 }}><Button size="sm" onClick={() => answer(u)}>{t('Répondre')}</Button></div> : null}
            </li>
          ))}</ul> : <EmptyState icon="calendar" title={t('Aucune réunion à venir')}>{t('Les réunions auxquelles vous êtes convoqué apparaîtront ici.')}</EmptyState>}
        </Card>
        <Card title={t('Mes actions')}>
          {d.myActions.length ? <ul className="mtg-list">{d.myActions.map((a) => (
            <li key={a.id}><button type="button" className="mtg-item" onClick={() => openMeeting(a.meetingId)}><span className={'mtg-dot'} style={{ background: a.overdue ? 'var(--danger)' : 'var(--accent)' }} aria-hidden="true" /><span><b>{a.text}</b><small>{a.meetingTitle}{a.due ? ' · ' + t('pour le {date}', { date: dateFr(a.due) }) : ''}</small></span>{a.overdue ? <Badge tone="danger">{t('En retard')}</Badge> : <span />}</button></li>
          ))}</ul> : <EmptyState icon="circle-check" title={t('Aucune action en cours')}>{t('Les actions décidées en réunion et qui vous sont confiées apparaîtront ici.')}</EmptyState>}
        </Card>
      </div>

      <div className="mtg-grid2">
        <Card>
          <ChartFrame title={t('Réunions sur 6 mois')} summary={t('Nombre de réunions par mois sur les six derniers mois : {list}', { list: d.trend.map((x) => `${x.month} : ${x.meetings}`).join(', ') })} height={220}>
            <Bars data={mt} xKey="x" series={[{ key: t('Réunions'), label: t('Réunions'), color: SERIES[0] }]} />
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame title={t('Répartition par type')} summary={d.byType.map((x) => `${L.types[x.type]} : ${x.count}`).join(', ')} height={220}
            legend={d.byType.map((x, i) => ({ label: `${L.types[x.type]} (${x.count})`, color: SERIES[i % SERIES.length] }))}>
            {d.byType.length ? <Donut data={d.byType.map((x) => ({ name: L.types[x.type], value: x.count }))} center={d.meetings.total - d.meetings.cancelled} sub={t('réunions')} /> : <EmptyState icon="chart-pie" title={t('Aucune réunion ce mois-ci')} />}
          </ChartFrame>
        </Card>
      </div>
    </div>
  );
}
