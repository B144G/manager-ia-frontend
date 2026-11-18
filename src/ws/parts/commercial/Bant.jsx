import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, Loading, Segmented, Table, useLoad } from '../../ui.jsx';
import { BantCard } from './Panels.jsx';
import { Failed, Meter, useCp } from './common.jsx';

/* Qualification BANT : score de chaque opportunité et prospect, règles de passage d'étape, suggestion d'après la conversation WhatsApp (à valider par une personne). */

export default function BantScreen() {
  const t = useT();
  const { api, tick, bump } = useCp();
  const { modal } = useWs();
  const [kind, setKind] = useState('opp');
  const st = useLoad(() => (kind === 'opp' ? api('GET', '/opps?status=open&limit=300') : api('GET', '/leads?limit=300')), [kind, tick]);
  const stages = useLoad(() => api('GET', '/pipeline/stages'), []);
  const open = stages.data ? stages.data.stages.filter((s) => s.kind === 'open') : [];
  const nextReq = (o) => { const i = open.findIndex((s) => s.id === o.stageId); const nx = open[i + 1]; return nx && nx.minBant ? nx : null; };
  const rows = st.data ? (kind === 'opp' ? st.data.opportunities : st.data.leads) : [];
  const score = (r) => (kind === 'opp' ? r.bantScore : r.bantScore);
  const qualify = (r) => modal(t('Qualification BANT : {nom}', { nom: r.name }), () => <BantCard kind={kind} id={r.id} onChange={() => { st.reload(); bump(); }} />, { wide: true });
  const cols = [
    { key: 'name', label: kind === 'opp' ? t('Opportunité') : t('Prospect'), render: (r) => <button type="button" className="cp-link" onClick={() => qualify(r)}><b>{r.name}</b></button> },
    ...(kind === 'opp' ? [{ key: 'stage', label: t('Étape') }] : []),
    { key: 'score', label: t('Score BANT'), render: (r) => <span className="cp-bscore"><Meter value={score(r)} label={t('Score BANT : {n} / 100', { n: score(r) })} /><b>{score(r)}</b></span> },
    ...(kind === 'opp' ? [{ key: 'rule', label: t('Étape suivante'), render: (r) => { const n = nextReq(r); return n ? <Badge tone={score(r) >= n.minBant ? 'ok' : 'warn'}>{t('{s} exige {n}', { s: n.name, n: n.minBant })}</Badge> : <span className="muted">—</span>; } }] : []),
    { key: 'act', label: '', render: (r) => <Button size="sm" onClick={() => qualify(r)}>{t('Qualifier')}</Button> },
  ];
  return (
    <div className="cp-stack">
      <Alert tone="info">{t("BANT = Budget, Autorité, Besoin, Délai. La suggestion tirée de la conversation WhatsApp n'est jamais définitive : seules les notes validées par une personne comptent dans le score.")}</Alert>
      <Card title={t('Qualification BANT')} actions={<Segmented label={t('Fiches')} value={kind} onChange={setKind} items={[{ id: 'opp', label: t('Opportunités') }, { id: 'lead', label: t('Prospects') }]} />}>
        {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : <Table caption={t('Qualification BANT')} columns={cols} rows={rows} empty={t('Aucune fiche à qualifier.')} />}
      </Card>
      <Card title={t("Règles de passage d'étape")} subtitle={t("Une opportunité n'entre dans une étape que si son score BANT atteint le minimum demandé.")}>
        {!stages.data ? <Loading /> : <Table caption={t("Règles de passage d'étape")} columns={[{ key: 'name', label: t('Étape') }, { key: 'minBant', label: t('Score BANT minimal'), align: 'r', render: (s) => (s.minBant ? s.minBant : t('Aucune exigence')) }]} rows={open} />}
      </Card>
    </div>
  );
}
