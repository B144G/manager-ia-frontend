import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState, Field, Icon, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { OppForm, useMoveOpp } from './OppDetail.jsx';
import { Failed, MemberSelect, ZoneSelect, qs, useCp } from './common.jsx';

/* Kanban : une colonne par étape, glisser-déposer (souris) ou liste « Déplacer vers… » (clavier, téléphone). Les règles de passage sont appliquées par le serveur. */

function OppCard({ o, stages, onMove, canMove }) {
  const t = useT();
  const { openOpp } = useCp();
  const { money } = useWs();
  return (
    <article className={'cp-card' + (o.stagnant ? ' stag' : '')} draggable={canMove && o.status === 'open'} onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(o.id)); e.dataTransfer.effectAllowed = 'move'; }}>
      <button type="button" className="cp-link" onClick={() => openOpp(o.id)}><b>{o.name}</b></button>
      {o.customer ? <div className="small muted">{o.customer}</div> : null}
      <div className="cp-card-amt"><b>{money(o.amount)}</b><span className="small muted">{t('pondéré {m}', { m: money(o.weighted) })}</span></div>
      <div className="row">
        <span className="small muted"><Icon name="clock" /> {t('{n} j', { n: o.daysInStage })}</span>
        {o.stagnant ? <Badge tone="warn">{t('Stagnante')}</Badge> : null}
        <Badge tone={o.bantScore >= 60 ? 'ok' : o.bantScore >= 40 ? 'info' : 'neutral'}>{t('BANT {n}', { n: o.bantScore })}</Badge>
      </div>
      {canMove && o.status === 'open' ? (
        <label className="cp-move"><span className="sr-only">{t('Déplacer {nom} vers…', { nom: o.name })}</span>
          <select value="" onChange={(e) => { const s = stages.find((x) => x.id === Number(e.target.value)); if (s) onMove(o.id, s); }}>
            <option value="">{t('Déplacer vers…')}</option>
            {stages.filter((s) => s.id !== o.stageId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
      ) : null}
    </article>
  );
}

export default function Kanban() {
  const t = useT();
  const { api, has, tick, bump, openOpp } = useCp();
  const { money, modal } = useWs();
  const [f, setF] = useState({ ownerId: '', zoneId: '', product: '' });
  const [over, setOver] = useState(null);
  const st = useLoad(() => api('GET', '/pipeline/board' + qs(f)), [f, tick]);
  const move = useMoveOpp(() => { st.reload(); bump(); });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const canMove = has('write');
  if (st.error) return <Failed e={st.error} />;
  const d = st.data;
  const stages = d ? d.columns.map((c) => c.stage) : [];
  const drop = (e, stage) => {
    e.preventDefault(); setOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    const card = d.columns.flatMap((c) => c.cards).find((c) => c.id === id);
    if (card && card.stageId !== stage.id) move(id, stage);
  };
  return (
    <div className="cp-stack">
      <Card title={t('Pipeline')} actions={has('write') ? <Button variant="primary" icon="plus" onClick={() => modal(t('Nouvelle opportunité'), (close) => <OppForm close={close} onSaved={(id) => { bump(); openOpp(id); }} />, { wide: true })}>{t('Nouvelle opportunité')}</Button> : null}>
        <div className="cp-filters">
          <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} value={f.ownerId} onChange={set('ownerId')} none={t('Tous')} />}</Field>
          <Field label={t('Zone')}>{(p) => <ZoneSelect {...p} value={f.zoneId} onChange={set('zoneId')} none={t('Toutes')} />}</Field>
          <Field label={t('Produit')}>{(p) => <input {...p} type="search" value={f.product} onChange={(e) => set('product')(e.target.value)} />}</Field>
        </div>
        {d ? (
          <div className="ui-stats">
            <Stat label={t('Opportunités ouvertes')} value={d.totals.count} icon="bullseye" />
            <Stat label={t('Montant total')} value={money(d.totals.amount)} icon="coins" />
            <Stat label={t('Valeur pondérée')} value={money(d.totals.weighted)} icon="target" tone="ok" />
            <Stat label={t('Stagnantes')} value={d.totals.stagnant} icon="hourglass" tone={d.totals.stagnant ? 'warn' : 'ok'} />
          </div>
        ) : null}
      </Card>
      {!d ? <Loading /> : (
        <div className="cp-board" role="list" aria-label={t('Colonnes du pipeline')}>
          {d.columns.map((c) => (
            <section key={c.stage.id} role="listitem" className={'cp-col' + (over === c.stage.id ? ' over' : '') + ' k-' + c.stage.kind} aria-label={c.stage.name}
              onDragOver={canMove ? (e) => { e.preventDefault(); setOver(c.stage.id); } : undefined} onDragLeave={() => setOver(null)} onDrop={canMove ? (e) => drop(e, c.stage) : undefined}>
              <header><b>{c.stage.name}</b><Badge>{c.count}</Badge></header>
              <div className="small muted">{money(c.amount)}{c.stage.kind === 'open' ? ' · ' + t('pondéré {m}', { m: money(c.weighted) }) : ''}</div>
              <div className="cp-col-body">
                {c.cards.map((o) => <OppCard key={o.id} o={o} stages={stages} onMove={move} canMove={canMove} />)}
                {!c.cards.length ? <p className="small muted cp-col-empty">{t('Aucune opportunité')}</p> : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Opportunités stagnantes : ouvertes depuis plus longtemps que le délai de leur étape. */
export function Stagnant() {
  const t = useT();
  const { api, tick, openOpp } = useCp();
  const { money } = useWs();
  const st = useLoad(() => api('GET', '/pipeline/stagnant'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const d = st.data;
  const cols = [
    { key: 'name', label: t('Opportunité'), render: (o) => <button type="button" className="cp-link" onClick={() => openOpp(o.id)}><b>{o.name}</b></button> },
    { key: 'customer', label: t('Compte') }, { key: 'stage', label: t('Étape') },
    { key: 'daysInStage', label: t('Jours dans l’étape'), align: 'r', render: (o) => <span className="late">{o.daysInStage} / {o.stagnantDays}</span> },
    { key: 'amount', label: t('Montant'), align: 'r', render: (o) => money(o.amount) }, { key: 'owner', label: t('Commercial') },
  ];
  return (
    <Card title={t('Opportunités stagnantes')} subtitle={t('{n} opportunité(s) pour {m}', { n: d.count, m: money(d.amount) })}>
      {!d.opportunities.length ? <EmptyState icon="circle-check" title={t('Aucune opportunité ne stagne.')} /> : <Table caption={t('Opportunités stagnantes')} columns={cols} rows={d.opportunities} />}
    </Card>
  );
}
