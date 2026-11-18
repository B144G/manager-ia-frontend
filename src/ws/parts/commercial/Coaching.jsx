import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Card, Field, Loading, Stat, useLoad } from '../../ui.jsx';
import { Failed, MemberSelect, pct, useCp } from './common.jsx';
import { useTip } from './labels3.jsx';

/* Coaching : indicateurs d'un commercial comparés à l'équipe, et conseils (le serveur donne un code et des chiffres, la phrase est écrite ici). */

export default function Coaching() {
  const t = useT();
  const tip = useTip();
  const { api, has, me, tick } = useCp();
  const { money } = useWs();
  const [uid, setUid] = useState(String(me.userId));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const st = useLoad(() => api('GET', '/coaching/' + uid + '?month=' + month), [uid, month, tick]);
  const d = st.data;
  return (
    <div className="cp-stack">
      <Card title={t('Coaching commercial')} subtitle={t("Des repères, pas un jugement : comparez les chiffres du mois à ceux de l'équipe.")}>
        <div className="cp-filters">
          {has('coach') ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} onlySales value={uid} onChange={setUid} />}</Field> : null}
          <Field label={t('Mois')}>{(p) => <input {...p} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
        </div>
        {st.error ? <Failed e={st.error} /> : !d ? <Loading /> : (
          <>
            <div className="ui-stats">
              <Stat label={t("Chiffre d'affaires")} value={money(d.metrics.revenue)} sub={d.metrics.target ? t('Objectif : {m}', { m: money(d.metrics.target) }) : t('Pas d’objectif fixé')} icon="coins" />
              <Stat label={t('Atteinte')} value={d.metrics.attainment === null ? '—' : pct(d.metrics.attainment)} icon="gauge" />
              <Stat label={t('Activités')} value={d.metrics.activities.total} sub={d.team.activities === null ? '' : t('Équipe : {n}', { n: d.team.activities })} icon="phone" />
              <Stat label={t('Taux de gain')} value={d.metrics.winRate === null ? '—' : pct(d.metrics.winRate)} sub={d.team.winRate === null ? '' : t('Équipe : {n} %', { n: d.team.winRate })} icon="handshake" />
              <Stat label={t('Pipeline pondéré')} value={money(d.metrics.pipelineWeighted)} icon="target" />
            </div>
            <h3>{t('Conseils pour {nom}', { nom: d.name })}</h3>
            {d.tips.map((x, i) => <Alert key={i} tone={x.code === 'on_track' ? 'ok' : 'info'}>{tip(x)}</Alert>)}
          </>
        )}
      </Card>
    </div>
  );
}
