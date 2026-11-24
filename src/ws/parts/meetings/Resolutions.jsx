import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { MAJORITY_IDS, VOTE_MODE_IDS, useLabels, useMtg } from './common.jsx';
import { NoQuorumAlert, QuorumCard } from './Quorum.jsx';
import { DiscussButton } from '../chat/ObjectUI.jsx';

/* Résolutions et vote électronique : décision soumise au vote (numéro, texte, porteur, échéance), vote à main levée saisi par le secrétaire, nominatif
   ou secret, majorité simple / qualifiée / unanimité, pondération facultative. En vote secret, le résultat agrégé est visible mais jamais le détail. */

const TONE = { pending: 'neutral', adopted: 'ok', rejected: 'danger', postponed: 'warn', no_quorum: 'danger' };

function ResForm({ close, onSaved, meeting, agenda, members, res }) {
  const t = useT();
  const L = useLabels();
  const { oapi, fail } = useMtg();
  const [f, setF] = useState(() => ({
    title: res ? res.title : '', text: res ? res.text : '', carrierId: res && res.carrierId ? String(res.carrierId) : '', carrierName: res && !res.carrierId ? res.carrier : '', due: res && res.due ? res.due : '',
    majority: res ? res.majority : 'simple', threshold: res ? res.threshold : 67, voteMode: res ? res.voteMode : 'named', weighted: res ? res.weighted : false, agendaId: res && res.agendaId ? String(res.agendaId) : '',
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const frozen = res && res.voteState !== 'none';
  const save = (ev) => {
    ev.preventDefault(); setErr('');
    if (!f.text.trim()) { setErr(t('Écrivez le texte de la résolution.')); return; }
    const body = { carrierId: f.carrierId || null, carrierName: f.carrierId ? '' : f.carrierName, due: f.due || null };
    if (!frozen) Object.assign(body, { title: f.title, text: f.text, majority: f.majority, threshold: Number(f.threshold), voteMode: f.voteMode, weighted: f.weighted, agendaId: f.agendaId || null });
    setBusy(true);
    oapi(res ? 'PUT' : 'POST', `/meetings/${meeting.id}/resolutions${res ? '/' + res.id : ''}`, body).then(() => { close(); onSaved(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={save} noValidate>
      {frozen ? <Alert tone="info">{t('Le vote est ouvert ou clos : seuls le porteur et l’échéance peuvent encore changer.')}</Alert> : null}
      <Field label={t('Intitulé (facultatif)')}>{(p) => <input {...p} value={f.title} disabled={frozen} onChange={(e) => set('title', e.target.value)} maxLength={200} />}</Field>
      <Field label={t('Texte de la résolution')} required hint={t('Par exemple : « Il est décidé de… ».')}>{(p) => <textarea {...p} rows={4} value={f.text} disabled={frozen} onChange={(e) => set('text', e.target.value)} maxLength={2000} />}</Field>
      <div className="mtg-grid2">
        <Field label={t('Porteur de la résolution')}>{(p) => <select {...p} value={f.carrierId} onChange={(e) => set('carrierId', e.target.value)}><option value="">{t('— Personne extérieure ou à définir —')}</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>}</Field>
        {!f.carrierId ? <Field label={t('Nom du porteur (facultatif)')}>{(p) => <input {...p} value={f.carrierName} onChange={(e) => set('carrierName', e.target.value)} maxLength={100} />}</Field> : null}
        <Field label={t('Échéance de mise en œuvre')}>{(p) => <input {...p} type="date" min={meeting.date} value={f.due} onChange={(e) => set('due', e.target.value)} />}</Field>
        <Field label={t("Point de l'ordre du jour")}>{(p) => <select {...p} value={f.agendaId} disabled={frozen} onChange={(e) => set('agendaId', e.target.value)}><option value="">{t('— Aucun —')}</option>{agenda.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>}</Field>
      </div>
      <div className="mtg-grid2">
        <Field label={t('Majorité requise')}>{(p) => <select {...p} value={f.majority} disabled={frozen} onChange={(e) => set('majority', e.target.value)}>{MAJORITY_IDS.map((x) => <option key={x} value={x}>{L.majority[x]}</option>)}</select>}</Field>
        {f.majority === 'qualified' ? <Field label={t('Seuil (% des suffrages exprimés)')} hint={t('Entre 51 et 100. Les abstentions ne comptent pas.')}>{(p) => <input {...p} type="number" min="51" max="100" value={f.threshold} disabled={frozen} onChange={(e) => set('threshold', e.target.value)} />}</Field> : null}
        <Field label={t('Mode de vote')}>{(p) => <select {...p} value={f.voteMode} disabled={frozen} onChange={(e) => set('voteMode', e.target.value)}>{VOTE_MODE_IDS.map((x) => <option key={x} value={x}>{L.voteMode[x]}</option>)}</select>}</Field>
      </div>
      <label className="mtg-check"><input type="checkbox" checked={f.weighted} disabled={frozen} onChange={(e) => set('weighted', e.target.checked)} />{t('Vote pondéré (chaque personne compte selon son poids de vote)')}</label>
      <p className="mtg-muted">{f.voteMode === 'secret' ? t("Vote secret : le résultat agrégé est visible, mais jamais qui a voté quoi.") : f.voteMode === 'hand' ? t('À main levée : le secrétaire saisit le vote de chaque personne présente.') : t('Nominatif : chaque présent vote lui-même ; le détail est visible une fois le vote clos.')}</p>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

function AiReview({ close, meeting, proposal, onSaved }) {
  const t = useT();
  const { oapi, fail, toast, dateFr } = useMtg();
  const [sel, setSel] = useState(() => new Set(proposal.resolutions.map((_, i) => i)));
  const [busy, setBusy] = useState(false);
  const save = () => {
    setBusy(true);
    const items = proposal.resolutions.filter((_, i) => sel.has(i)).map((r) => ({ title: r.title, text: r.text, carrierId: r.carrierId, carrierName: r.carrierName, due: r.due }));
    oapi('POST', `/meetings/${meeting.id}/resolutions`, { items }).then(() => { toast(t('{n} résolution(s) ajoutée(s).', { n: items.length })); close(); onSaved(); }).catch((e) => { setBusy(false); fail(e); });
  };
  return (
    <div className="ws-form">
      <Alert tone="info">{t("Proposition de l'IA à relire : cochez ce que vous gardez. Elles sont ajoutées « en attente », sans vote, et vous pouvez les corriger ensuite.")}</Alert>
      {proposal.resolutions.length ? proposal.resolutions.map((r, i) => (
        <label className="mtg-check mtg-block" key={i}><input type="checkbox" checked={sel.has(i)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
          <span><b>{r.title || t('Résolution')}</b><br />{r.text}{r.carrierName || r.carrierId ? <small className="mtg-muted"> — {r.carrierName || t('porteur reconnu')}</small> : null}{r.due ? <small className="mtg-muted"> — {dateFr(r.due)}</small> : null}</span></label>
      )) : <p className="mtg-muted">{t('Aucune résolution trouvée.')}</p>}
      <div className="mtg-row"><Button variant="primary" loading={busy} disabled={!sel.size} onClick={save}>{t('Ajouter la sélection')}</Button><Button variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </div>
  );
}

function HandEntry({ close, meeting, res, participants, onSaved }) {
  const t = useT();
  const L = useLabels();
  const { oapi, fail, toast } = useMtg();
  const voters = participants.filter((p) => p.attended === 'yes' && p.voteWeight > 0);
  const [v, setV] = useState({});
  const [busy, setBusy] = useState(false);
  const all = (choice) => setV(Object.fromEntries(voters.map((p) => [p.id, choice])));
  const save = () => {
    const items = voters.filter((p) => v[p.id]).map((p) => ({ participantId: p.id, choice: v[p.id] }));
    if (!items.length) return;
    setBusy(true);
    oapi('POST', `/meetings/${meeting.id}/resolutions/${res.id}/vote`, { items }).then(() => { toast(t('{n} vote(s) saisi(s).', { n: items.length })); close(); onSaved(); }).catch((e) => { setBusy(false); fail(e); });
  };
  return (
    <div className="ws-form">
      <p className="mtg-muted">{t('Saisissez le vote de chaque personne présente (main levée). Vous pouvez corriger tant que le vote n’est pas clos.')}</p>
      <div className="mtg-row"><Button size="sm" onClick={() => all('for')}>{t('Tous pour')}</Button><Button size="sm" onClick={() => all('against')}>{t('Tous contre')}</Button><Button size="sm" variant="ghost" onClick={() => setV({})}>{t('Effacer')}</Button></div>
      <ul className="mtg-list">{voters.map((p) => (
        <li className="mtg-person" key={p.id}>
          <span><b>{p.name}</b>{p.voteWeight !== 1 ? <small>{t('Poids de vote : {n}', { n: p.voteWeight })}</small> : null}</span>
          <span className="ui-seg" role="group" aria-label={t('Vote de {name}', { name: p.name })}>{['for', 'against', 'abstain'].map((c) => <button key={c} type="button" aria-pressed={v[p.id] === c} onClick={() => setV((s) => ({ ...s, [p.id]: s[p.id] === c ? undefined : c }))}>{L.choice[c]}</button>)}</span>
        </li>
      ))}</ul>
      {!voters.length ? <Alert tone="warn">{t('Aucun participant présent ayant droit de vote : cochez les présences dans le déroulé.')}</Alert> : null}
      <div className="mtg-row"><Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer les votes')}</Button><Button variant="ghost" onClick={close}>{t('Fermer')}</Button></div>
    </div>
  );
}

function ResultBar({ r }) {
  const t = useT();
  const L = useLabels();
  const tot = r.for + r.against + r.abstain;
  if (!tot) return <p className="mtg-muted">{t('Aucun suffrage.')}</p>;
  const w = (n) => (n / tot) * 100 + '%';
  return (
    <div>
      <div className="mtg-bar" role="img" aria-label={`${L.choice.for} ${r.for}, ${L.choice.against} ${r.against}, ${L.choice.abstain} ${r.abstain}`}>
        <i className="for" style={{ width: w(r.for) }} /><i className="against" style={{ width: w(r.against) }} /><i className="abstain" style={{ width: w(r.abstain) }} />
      </div>
      <div className="mtg-row"><Badge tone="ok">{L.choice.for} : {r.for}</Badge><Badge tone="danger">{L.choice.against} : {r.against}</Badge><Badge tone="neutral">{L.choice.abstain} : {r.abstain}</Badge></div>
    </div>
  );
}

function ResCard({ r, j, members, reload }) {
  const t = useT();
  const L = useLabels();
  const { oapi, modal, confirm, toast, fail, dateFr } = useMtg();
  const m = j.meeting;
  const base = `/meetings/${m.id}/resolutions/${r.id}`;
  const act = (path, okMsg) => oapi('POST', base + path, {}).then((x) => { if (okMsg) toast(okMsg(x)); reload(); }).catch(fail);
  const edit = () => modal(t('Modifier la résolution'), (close) => <ResForm close={close} onSaved={reload} meeting={m} agenda={j.agenda} members={members} res={r} />, { wide: true });
  const del = () => confirm(t('Supprimer cette résolution ?'), () => oapi('DELETE', base).then(reload).catch(fail));
  const open = () => confirm(t('Ouvrir le vote de {n} ? Seuls les participants marqués présents pourront voter.', { n: r.number }), () => act('/open-vote', () => t('Vote ouvert.')), t('Ouvrir le vote'));
  const close = () => confirm(t('Clôturer le vote ? Le résultat sera consigné et verrouillé.'), () => act('/close-vote', (x) => (x.status === 'adopted' ? t('Résolution adoptée.') : x.status === 'rejected' ? t('Résolution rejetée.') : t('Vote nul : le quorum n’est plus atteint.'))), t('Clôturer'));
  const vote = (choice) => oapi('POST', base + '/vote', { choice }).then(() => { toast(r.myVote ? t('Vote modifié.') : t('Vote enregistré.')); reload(); }).catch(fail);
  const hand = () => modal(t('Vote à main levée — {n}', { n: r.number }), (cl) => <HandEntry close={cl} meeting={m} res={r} participants={j.participants} onSaved={reload} />, { wide: true });
  const postpone = () => modal(t('Reporter la résolution'), (cl) => <PostponeForm close={cl} meeting={m} res={r} onDone={reload} />);
  const mgr = j.rights.vote && ['none', 'draft'].includes(m.minutesStatus);
  const mode = r.voteMode === 'secret' ? 'secret' : r.voteMode;
  return (
    <Card title={<span className="mtg-row"><Badge tone="outline">{r.number}</Badge><span>{r.title || t('Résolution')}</span></span>} actions={<Badge tone={TONE[r.status]}>{L.resStatus[r.status]}</Badge>}>
      <div className="mtg-sec">
        <p className="mtg-pre">{r.text}</p>
        <div className="mtg-row">
          <Badge tone="outline">{L.majority[r.majority]}{r.majority === 'qualified' ? ' ' + r.threshold + ' %' : ''}</Badge>
          <Badge tone="outline"><Icon name={mode === 'secret' ? 'lock' : 'user-group'} />{L.voteMode[r.voteMode]}</Badge>
          {r.weighted ? <Badge tone="outline">{t('Pondéré')}</Badge> : null}
          {r.carrier ? <Badge tone="neutral">{t('Porteur : {name}', { name: r.carrier })}</Badge> : null}
          {r.due ? <Badge tone="neutral">{t('pour le {date}', { date: dateFr(r.due) })}</Badge> : null}
        </div>

        {r.voteState === 'open' ? (
          <div className="mtg-voting">
            <b><Icon name="circle-play" /> {t('Vote ouvert')} — {t('{n} sur {m} ont voté', { n: r.voted, m: r.eligible })}</b>
            {r.rights.vote ? (
              <>
                <div className="mtg-votebtns" role="group" aria-label={t('Votre vote')}>
                  {['for', 'against', 'abstain'].map((c) => <Button key={c} variant={r.myVote === c ? 'primary' : 'secondary'} aria-pressed={r.myVote === c} onClick={() => vote(c)}>{L.choice[c]}</Button>)}
                </div>
                <small className="mtg-muted">{r.myVote ? t('Vous avez voté « {c} ». Vous pouvez changer avant la clôture.', { c: L.choice[r.myVote] }) : t("Vous n'avez pas encore voté.")}{r.voteMode === 'secret' ? ' ' + t('Votre vote est secret.') : ''}</small>
              </>
            ) : r.rights.hand ? <div><Button icon="user-group" onClick={hand}>{t('Saisir le vote à main levée')}</Button></div>
              : <p className="mtg-muted">{r.voteMode === 'hand' ? t('Vote à main levée : le secrétaire saisit les votes.') : t('Vous ne pouvez pas voter (non convoqué, non présent ou sans droit de vote).')}</p>}
            {r.live ? <div><b>{t('Décompte en direct (visible de vous seulement)')}</b><ResultBar r={r.live} /></div> : null}
            {r.roll ? <div className="mtg-row">{r.roll.map((x) => <Badge key={x.participantId} tone={x.voted ? 'ok' : 'warn'}>{x.name} {x.voted ? '✓' : '…'}</Badge>)}</div> : null}
            {mgr ? <div className="mtg-row">{r.voteMode === 'hand' ? <Button icon="user-group" onClick={hand}>{t('Saisir le vote à main levée')}</Button> : null}<Button variant="primary" icon="check" onClick={close}>{t('Clôturer le vote')}</Button></div> : null}
          </div>
        ) : null}

        {r.voteState === 'closed' && r.result && r.result.for !== undefined ? (
          <div className="mtg-sec">
            <ResultBar r={r.result} />
            {r.result.void ? <Alert tone="warn">{t("Vote nul : le quorum n'était plus atteint à la clôture.")}</Alert> : null}
            {r.voteMode === 'secret' ? <p className="mtg-muted"><Icon name="lock" /> {t('Vote secret : seul le résultat est consigné, jamais qui a voté quoi.')}</p>
              : r.details ? <ul className="mtg-list">{r.details.map((d) => <li className="mtg-person" key={d.participantId}><span><b>{d.name}</b>{d.weight !== 1 ? <small>{t('Poids de vote : {n}', { n: d.weight })}</small> : null}</span><Badge tone={d.choice === 'for' ? 'ok' : d.choice === 'against' ? 'danger' : 'neutral'}>{L.choice[d.choice]}</Badge></li>)}</ul> : null}
            <small className="mtg-muted">{t('Empreinte du résultat')} : {r.resultHash.slice(0, 16)}…</small>
          </div>
        ) : null}
        {r.status === 'postponed' ? <Alert tone="warn" title={t('Reportée')}>{r.postponedReason}</Alert> : null}
        {r.status === 'no_quorum' && r.voteState === 'closed' && !(r.result && r.result.for !== undefined) ? <Alert tone="danger">{t("Sans quorum : cette résolution n'a pas pu être votée, elle n'est pas valable.")}</Alert> : null}

        <div className="mtg-row">
          {r.rights.edit || (mgr && r.voteState !== 'closed') ? <Button size="sm" icon="pen" onClick={edit}>{t('Modifier')}</Button> : null}
          {r.voteState === 'none' && r.rights.manage ? <Button size="sm" variant="primary" icon="circle-play" onClick={open}>{t('Ouvrir le vote')}</Button> : null}
          {r.voteState !== 'closed' && j.rights.write ? <Button size="sm" onClick={postpone}>{t('Reporter')}</Button> : null}
          {r.voteState === 'none' && r.rights.edit ? <Button size="sm" variant="ghost" iconOnly label={t('Supprimer')} icon="trash" onClick={del} /> : null}
        </div>
      </div>
    </Card>
  );
}

function PostponeForm({ close, meeting, res, onDone }) {
  const t = useT();
  const { oapi, fail, toast } = useMtg();
  const st = useLoad(() => oapi('GET', '/meetings?status=planned'), []);
  const [reason, setReason] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const send = (ev) => {
    ev.preventDefault();
    if (!reason.trim()) { setErr(t('Indiquez le motif du report.')); return; }
    setBusy(true);
    oapi('POST', `/meetings/${meeting.id}/resolutions/${res.id}/postpone`, { reason, toMeetingId: to || undefined }).then(() => { toast(t('Résolution reportée.')); close(); onDone(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  const list = ((st.data && st.data.meetings) || []).filter((x) => x.id !== meeting.id && x.date >= meeting.date);
  return (
    <form className="ws-form" onSubmit={send} noValidate>
      <Field label={t('Motif du report')} required error={err}>{(p) => <textarea {...p} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field>
      <Field label={t('Reporter à une autre réunion (facultatif)')} hint={t('Une copie en attente, avec un nouveau numéro, sera ajoutée à cette réunion.')}>{(p) => <select {...p} value={to} onChange={(e) => setTo(e.target.value)}><option value="">{t('— Aucune pour le moment —')}</option>{list.map((x) => <option key={x.id} value={x.id}>{x.date} · {x.title}</option>)}</select>}</Field>
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Reporter')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

export default function Resolutions({ j, reload, members }) {
  const t = useT();
  const { oapi, modal, fail } = useMtg();
  const m = j.meeting;
  const st = useLoad(() => oapi('GET', `/meetings/${m.id}/resolutions`), [m.id, m.minutesStatus]);
  const [aiBusy, setAiBusy] = useState(false);
  const both = () => { st.reload(); reload(); };
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={5} />;
  const list = st.data.resolutions;
  const canCreate = j.rights.write && m.status !== 'no_quorum';
  const add = () => modal(t('Nouvelle résolution'), (close) => <ResForm close={close} onSaved={both} meeting={m} agenda={j.agenda} members={members} res={null} />, { wide: true });
  const ai = () => { setAiBusy(true); oapi('POST', `/meetings/${m.id}/ai/resolutions`, {}).then((p) => modal(t("Résolutions proposées par l'IA"), (close) => <AiReview close={close} meeting={m} proposal={p} onSaved={both} />, { wide: true })).catch(fail).finally(() => setAiBusy(false)); };
  return (
    <div className="mtg">
      <NoQuorumAlert j={j} />
      <Card title={t('Quorum en direct')}><QuorumCard q={j.quorum} /></Card>
      <div className="mtg-row"><DiscussButton type="meeting" id={m.id} /></div>
      <div className="mtg-row between">
        <p className="mtg-muted" style={{ margin: 0 }}>{t("Une résolution adoptée devient une décision du compte rendu ; avec un porteur ou une échéance, elle crée aussi l'action correspondante.")}</p>
        {canCreate ? <div className="mtg-row"><Button size="sm" icon="wand-magic-sparkles" loading={aiBusy} onClick={ai}>{t("Proposer avec l'IA")}</Button><Button size="sm" variant="primary" icon="plus" onClick={add}>{t('Nouvelle résolution')}</Button></div> : null}
      </div>
      {!list.length ? <EmptyState icon="gavel" title={t('Aucune résolution')}>{t("Ajoutez les résolutions à soumettre au vote : numéro, texte, porteur, échéance et règle de majorité.")}</EmptyState> : null}
      {list.map((r) => <ResCard key={r.id} r={r} j={j} members={members} reload={both} />)}
    </div>
  );
}
