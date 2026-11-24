import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Icon } from '../../ui/index.jsx';
import { useMtg } from './common.jsx';

/* Conflits d'agenda : participants déjà pris, lieu occupé, congés approuvés (RH), jour férié, et créneaux alternatifs proposés.
   Une réunion confidentielle que la personne ne peut pas voir est signalée « occupé(e) » sans son titre. */

export function ConflictList({ c, dateFr, onPick }) {
  const t = useT();
  return (
    <div className="mtg-sec">
      {c.participants.length ? <ul className="mtg-conf">{c.participants.map((p, i) => <li key={'p' + i}><Icon name="user-group" /> <b>{p.name}</b> — {p.busy ? t('occupé(e)') : t('déjà convoqué(e) à « {title} »', { title: p.title })} ({p.time}–{p.endTime})</li>)}</ul> : null}
      {c.place.length ? <ul className="mtg-conf">{c.place.map((p, i) => <li key={'l' + i}><Icon name="location-dot" /> {t('Lieu déjà occupé')}{p.title ? ` — « ${p.title} »` : ''} ({p.time}–{p.endTime})</li>)}</ul> : null}
      {c.leaves.length ? <ul className="mtg-conf">{c.leaves.map((l, i) => <li key={'c' + i}><Icon name="calendar-days" /> <b>{l.name}</b> — {t('en congé du {a} au {b}', { a: dateFr(l.from), b: dateFr(l.to) })}</li>)}</ul> : null}
      {c.holiday ? <ul className="mtg-conf"><li><Icon name="flag" /> {t('Jour férié : {name}', { name: c.holiday })}</li></ul> : null}
      {c.alternatives && c.alternatives.length ? (
        <div>
          <b>{t('Créneaux libres proposés')}</b>
          <div className="mtg-row" style={{ marginTop: 6 }}>{c.alternatives.map((a, i) => (onPick
            ? <button key={i} type="button" className="mtg-slot" onClick={() => onPick(a)}>{dateFr(a.date)} · {a.time}–{a.endTime}</button>
            : <Badge key={i} tone="outline">{dateFr(a.date)} · {a.time}–{a.endTime}</Badge>))}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Vérification en direct pendant la saisie de la convocation (après une courte pause). */
export function ConflictCheck({ f, userIds, excludeId, onPick }) {
  const t = useT();
  const { oapi, dateFr } = useMtg();
  const [c, setC] = useState(null);
  const key = JSON.stringify([f.date, f.time, f.durationMin, f.place, userIds, f.organizerId, f.secretaryId, f.urgency]);
  useEffect(() => {
    let off = false;
    if (!f.date || !f.time) return undefined;
    const h = setTimeout(() => {
      oapi('POST', '/meetings/conflicts', { date: f.date, time: f.time, durationMin: Number(f.durationMin) || 60, place: f.place, urgency: f.urgency, organizerId: f.organizerId || undefined, secretaryId: f.secretaryId || undefined, excludeId, participants: userIds.map((userId) => ({ userId })) })
        .then((j) => { if (!off) setC(j); }).catch(() => { if (!off) setC(null); });
    }, 500);
    return () => { off = true; clearTimeout(h); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  return (
    <div className="mtg-sec">
      {c.notice && c.notice.short ? <Alert tone="warn" title={t('Préavis trop court')}>{t('Cette réunion est dans {h} h ; le préavis minimal est de {n} h pour une réunion {u}.', { h: Math.max(c.notice.hours, 0), n: c.notice.requiredHours, u: { normal: t('normale'), urgent: t('urgente'), critical: t('critique') }[c.notice.urgency] })} {c.notice.urgency === 'normal' ? t('Passez-la en « urgente » pour réduire le préavis et prévenir en priorité.') : ''}</Alert> : null}
      {c.count ? <Alert tone="warn" title={t("{n} conflit(s) d'agenda", { n: c.count })}><ConflictList c={c} dateFr={dateFr} onPick={onPick} /></Alert> : <Badge tone="ok"><Icon name="circle-check" />{t("Aucun conflit d'agenda")}</Badge>}
    </div>
  );
}
