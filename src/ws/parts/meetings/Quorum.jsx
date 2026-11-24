import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Icon } from '../../ui/index.jsx';
import { useLabels } from './common.jsx';

/* Quorum en direct : présences réelles cochées pendant la séance, comparées à la règle du type de réunion (nombre, pourcentage, présences minimales par rôle). */

export function QuorumCard({ q, compact }) {
  const t = useT();
  const L = useLabels();
  if (!q) return null;
  if (!q.required) return compact ? null : <p className="mtg-muted"><Icon name="user-group" /> {t("Aucune règle de quorum n'est définie pour ce type de réunion.")}</p>;
  const pct = q.need ? Math.min(100, Math.round((q.present / q.need) * 100)) : 100;
  return (
    <div className={'mtg-quorum' + (q.ok ? ' ok' : ' bad')} role="status">
      <div className="mtg-row between">
        <b><Icon name={q.ok ? 'circle-check' : 'triangle-exclamation'} /> {q.ok ? t('Quorum atteint') : t('Quorum non atteint')}{q.mode === 'reduced' ? ' · ' + t('2ᵉ convocation (quorum réduit)') : ''}</b>
        <Badge tone={q.ok ? 'ok' : 'danger'}>{t('{n} présent(s) sur {m} requis', { n: q.present, m: q.need })}</Badge>
      </div>
      <div className="mtg-meter" role="img" aria-label={t('{n} présent(s) sur {m} requis', { n: q.present, m: q.need })}><i style={{ width: pct + '%' }} /></div>
      <small className="mtg-muted">
        {t('{n} convoqué(s) ayant voix', { n: q.base })}
        {q.needPercent ? ' · ' + t('{n} % au minimum', { n: q.needPercent }) : ''}
        {q.needCount ? ' · ' + t('{n} personne(s) au minimum', { n: q.needCount }) : ''}
      </small>
      {q.roles.length ? <div className="mtg-row">{q.roles.map((r) => <Badge key={r.role} tone={r.present >= r.need ? 'ok' : 'warn'}>{L.roles4[r.role]} : {r.present}/{r.need}</Badge>)}</div> : null}
    </div>
  );
}

export function NoQuorumAlert({ j }) {
  const t = useT();
  const m = j.meeting;
  if (m.status !== 'no_quorum') return null;
  return (
    <Alert tone="danger" title={t('Réunion sans quorum : les décisions prises ne sont pas valables')}>
      {m.noQuorumReason}
      {j.child ? <> {t('Nouvelle convocation à quorum réduit prévue le {date}.', { date: j.child.date })}</> : null}
    </Alert>
  );
}
