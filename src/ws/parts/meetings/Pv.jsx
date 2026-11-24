import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { QuorumCard } from './Quorum.jsx';
import { ReasonForm, useDownload, useLabels, useMtg } from './common.jsx';

/* Procès-verbal : document formel numéroté (PV-AAAA-NNN), distinct du compte rendu libre. Présences, quorum constaté, résolutions et votes ; verrouillé puis signé
   électroniquement (horodatage + empreinte du contenu, ordre facultatif). La signature est une signature électronique simple, pas une signature qualifiée. */

const ST_TONE = { draft: 'warn', signing: 'info', signed: 'ok', superseded: 'neutral' };

function SignersForm({ close, meeting, members, ordered0, onDone }) {
  const t = useT();
  const { oapi, fail, toast, info } = useMtg();
  const def = [meeting.chairId, meeting.secretaryId, meeting.organizerId].filter(Boolean);
  const [sel, setSel] = useState(() => new Set(def.length ? [...new Set(def)] : [info.me.userId]));
  const [ordered, setOrdered] = useState(Boolean(ordered0));
  const [busy, setBusy] = useState(false);
  const roleOf = (id) => (id === meeting.chairId ? t('Président de séance') : id === meeting.secretaryId ? t('Secrétaire de séance') : id === meeting.organizerId ? t('Organisateur') : '');
  const send = () => {
    setBusy(true);
    const signers = [...sel].map((userId) => ({ userId, role: roleOf(userId) }));
    oapi('POST', `/meetings/${meeting.id}/pv/request-signatures`, { signers, ordered }).then(() => { toast(t('Procès-verbal verrouillé : signatures demandées.')); close(); onDone(); }).catch((e) => { setBusy(false); fail(e); });
  };
  return (
    <div className="ws-form">
      <Alert tone="info">{t("Le procès-verbal sera verrouillé : son contenu ne pourra plus changer, et chaque signataire signera ce contenu exact (empreinte).")}</Alert>
      <div className="mtg-picks" role="group" aria-label={t('Signataires')}>
        {members.map((m) => <label key={m.userId}><input type="checkbox" checked={sel.has(m.userId)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(m.userId)) n.delete(m.userId); else n.add(m.userId); return n; })} /><span>{m.name}{roleOf(m.userId) ? <small className="mtg-muted"> · {roleOf(m.userId)}</small> : null}</span></label>)}
      </div>
      <label className="mtg-check"><input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} />{t('Signatures dans l’ordre de la liste (la personne suivante ne signe qu’après la précédente)')}</label>
      <div className="mtg-row"><Button variant="primary" loading={busy} disabled={!sel.size} onClick={send}>{t('Verrouiller et demander les signatures')}</Button><Button variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </div>
  );
}

function NarrativeForm({ close, meeting, text0, onDone }) {
  const t = useT();
  const { oapi, fail, toast } = useMtg();
  const [v, setV] = useState(text0 || '');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const save = () => { setBusy(true); oapi('PUT', `/meetings/${meeting.id}/pv`, { narrative: v }).then(() => { toast(t('Procès-verbal mis à jour.')); close(); onDone(); }).catch((e) => { setBusy(false); fail(e); }); };
  const suggest = () => { setAi(true); oapi('POST', `/meetings/${meeting.id}/ai/pv`, {}).then((r) => setV(r.narrative)).catch(fail).finally(() => setAi(false)); };
  return (
    <div className="ws-form">
      <Field label={t('Exposé du procès-verbal')} hint={t("Ouverture de la séance, constat du quorum, déroulement. L'IA peut proposer un texte à partir des faits consignés ; relisez-le.")}>{(p) => <textarea {...p} rows={8} value={v} onChange={(e) => setV(e.target.value)} maxLength={8000} />}</Field>
      <div className="mtg-row"><Button variant="primary" loading={busy} onClick={save}>{t('Enregistrer')}</Button><Button icon="wand-magic-sparkles" loading={ai} onClick={suggest}>{t("Proposer avec l'IA")}</Button><Button variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </div>
  );
}

export default function Pv({ j, reload, members }) {
  const t = useT();
  const L = useLabels();
  const { oapi, modal, confirm, toast, fail, dateFr } = useMtg();
  const dl = useDownload();
  const m = j.meeting;
  const st = useLoad(() => oapi('GET', `/meetings/${m.id}/pv`), [m.id, m.minutesStatus]);
  const [busy, setBusy] = useState(false);
  const both = () => { st.reload(); reload(); };
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={6} />;
  const d = st.data;
  if (!d.pv) {
    return (
      <div className="mtg">
        <EmptyState icon="file-contract" title={t("Pas encore de procès-verbal")}
          action={d.canCreate ? <Button variant="primary" icon="plus" loading={busy} onClick={() => { setBusy(true); oapi('POST', `/meetings/${m.id}/pv`, {}).then(() => { toast(t('Procès-verbal créé (projet).')); both(); }).catch(fail).finally(() => setBusy(false)); }}>{t('Créer le procès-verbal')}</Button> : null}>
          {t("Le procès-verbal est le document formel de la séance : présences, quorum constaté, résolutions et votes, signé électroniquement. Le compte rendu, lui, reste un texte libre.")}
          {!d.canCreate && m.status === 'planned' ? ' ' + t("Il se rédige une fois la séance ouverte ou tenue.") : ''}
        </EmptyState>
      </div>
    );
  }
  const pv = d.pv; const c = pv.content; const r = d.rights;
  const call = (path, body, okMsg) => oapi('POST', `/meetings/${m.id}/pv${path}`, body || {}).then((x) => { if (okMsg) toast(okMsg(x)); both(); }).catch(fail);
  const sign = () => confirm(t('Signer le procès-verbal {n} ? Vous attestez avoir lu ce contenu exact (empreinte {h}…).', { n: pv.number, h: pv.hash.slice(0, 12) }), () => call('/sign', {}, (x) => (x.complete ? t('Signé : le procès-verbal est signé par tous.') : t('Signature enregistrée.'))), t('Signer'));
  const refresh = () => oapi('PUT', `/meetings/${m.id}/pv`, {}).then(() => { toast(t('Procès-verbal actualisé avec les données de la réunion.')); both(); }).catch(fail);
  const newVersion = () => modal(t('Nouvelle version du procès-verbal'), (close) => <ReasonForm close={close} label={t('Pourquoi rouvrir le procès-verbal ?')} submit={(reason) => oapi('POST', `/meetings/${m.id}/pv/new-version`, { reason })} onDone={() => { toast(t('Nouvelle version créée (projet).')); both(); }} />);
  const edit = () => modal(t('Exposé du procès-verbal'), (close) => <NarrativeForm close={close} meeting={m} text0={pv.narrative} onDone={both} />, { wide: true });
  const request = () => modal(t('Demander les signatures'), (close) => <SignersForm close={close} meeting={m} members={members} ordered0={pv.ordered} onDone={both} />, { wide: true });
  const next = pv.ordered ? d.signatures.find((s) => !s.signed) : null;
  return (
    <div className="mtg">
      <Alert tone={pv.status === 'signed' ? 'ok' : pv.status === 'signing' ? 'info' : 'warn'} title={`${pv.number} — ${{ draft: t('Projet : modifiable'), signing: t('Verrouillé : signatures en cours'), signed: t('Signé par tous'), superseded: t('Remplacé') }[pv.status]}`}>
        {pv.status === 'signed' ? t("Le procès-verbal est verrouillé. Pour le corriger, une personne autorisée à valider crée une nouvelle version : l'ancienne reste consignée.") : null}
        {pv.status === 'signing' ? (r.sign ? t("C'est à vous de signer.") : next ? t('En attente de la signature de {name}.', { name: next.name }) : t('En attente des signatures.')) : null}
        {pv.status === 'draft' ? t("Complétez l'exposé, actualisez le contenu depuis la réunion, puis demandez les signatures : le contenu sera alors verrouillé.") : null}
        {pv.intact === false ? <b> {t("Attention : le contenu ne correspond plus à son empreinte.")}</b> : null}
      </Alert>
      <div className="mtg-row">
        {r.edit ? <><Button icon="pen" onClick={edit}>{t("Modifier l'exposé")}</Button><Button icon="arrows-rotate" onClick={refresh}>{t('Actualiser depuis la réunion')}</Button></> : null}
        {r.request ? <Button variant="primary" icon="file-contract" onClick={request}>{t('Demander les signatures')}</Button> : null}
        {r.sign ? <Button variant="primary" icon="pen" onClick={sign}>{t('Signer')}</Button> : null}
        {r.newVersion ? <Button icon="rotate-right" onClick={newVersion}>{t('Créer une nouvelle version')}</Button> : null}
        <Button icon="file-pdf" onClick={() => dl(`/${m.id}/pv.pdf?version=${pv.version}`, `proces-verbal-${pv.number}.pdf`)}>{t('Exporter en PDF')}</Button>
      </div>

      <Card title={t('Présences et quorum')}>
        <div className="mtg-sec">
          <QuorumCard q={{ ...c.quorum, roles: [], needCount: 0, needPercent: 0, base: c.quorum.base }} />
          {c.quorum.noQuorum ? <Alert tone="danger" title={t('Séance déclarée sans quorum')}>{c.quorum.reason}{c.quorum.reconvened ? ' ' + t('Nouvelle convocation à quorum réduit le {date}.', { date: dateFr(c.quorum.reconvened.date) }) : ''}</Alert> : null}
          {c.quorum.followsMeeting ? <p className="mtg-muted">{t("Cette séance fait suite à la réunion du {date}, qui n'avait pas atteint le quorum.", { date: dateFr(c.quorum.followsMeeting.date) })}</p> : null}
          <ul className="mtg-list">{c.attendance.map((p, i) => <li className="mtg-person" key={i}><span><b>{p.name}</b><small>{L.resp[p.response]}{p.lateMin ? ' · ' + t('retard {n} min', { n: p.lateMin }) : ''}</small></span><Badge tone={p.attended === 'yes' ? 'ok' : p.attended === 'no' ? 'danger' : 'neutral'}>{p.attended === 'yes' ? t('Présent') : p.attended === 'no' ? t('Absent') : '—'}</Badge></li>)}</ul>
        </div>
      </Card>
      {pv.narrative ? <Card title={t('Exposé')}><p className="mtg-pre">{pv.narrative}</p></Card> : null}
      <Card title={t('Résolutions et votes ({n})', { n: c.resolutions.length })}>
        {c.resolutions.length ? <ul className="mtg-list">{c.resolutions.map((x) => (
          <li className="mtg-act" key={x.number}>
            <span><b>{x.number}{x.title ? ' — ' + x.title : ''}</b><small>{x.text}</small>
              <small>{L.majority[x.majority]}{x.majority === 'qualified' ? ' ' + x.threshold + ' %' : ''} · {L.voteMode[x.mode]}{x.result && x.result.for !== undefined ? ` · ${L.choice.for} ${x.result.for} / ${L.choice.against} ${x.result.against} / ${L.choice.abstain} ${x.result.abstain}` : ''}{x.carrier ? ' · ' + x.carrier : ''}</small></span>
            <Badge tone={{ adopted: 'ok', rejected: 'danger', postponed: 'warn', no_quorum: 'danger', pending: 'neutral' }[x.status]}>{L.resStatus[x.status]}</Badge>
          </li>
        ))}</ul> : <p className="mtg-muted">{t('Aucune résolution.')}</p>}
      </Card>
      <Card title={t('Signatures électroniques')} subtitle={t('Horodatage et empreinte SHA-256 du contenu signé.')}>
        {d.signatures.length ? <ul className="mtg-list">{d.signatures.map((s) => (
          <li className="mtg-person" key={s.id}>
            <span><b>{s.name}</b><small>{s.role}{s.signedAt ? ' · ' + new Date(s.signedAt).toLocaleString(document.documentElement.lang || 'fr') : ''}{s.comment ? ' · ' + s.comment : ''}</small></span>
            {s.signed ? <Badge tone="ok"><Icon name="circle-check" />{t('Signé')} · {s.hash.slice(0, 8)}…</Badge> : <Badge tone="warn">{pv.ordered && next && next.id === s.id ? t('À son tour') : t('En attente')}</Badge>}
          </li>
        ))}</ul> : <p className="mtg-muted">{t("Les signatures n'ont pas encore été demandées.")}</p>}
        {pv.hash ? <p className="mtg-muted">{t('Empreinte du contenu')} : <code>{pv.hash}</code></p> : null}
      </Card>
      {d.versions.length > 1 ? (
        <Card title={t('Versions')}>
          <ul className="mtg-list">{d.versions.map((v) => <li className="mtg-act" key={v.version}><span><b>{v.number}</b><small>{v.reason || ''}</small></span><span className="mtg-row"><Badge tone={ST_TONE[v.status]}>{{ draft: t('Projet'), signing: t('En signature'), signed: t('Signé'), superseded: t('Remplacé') }[v.status]}</Badge><Button size="sm" icon="file-pdf" onClick={() => dl(`/${m.id}/pv.pdf?version=${v.version}`, `proces-verbal-${v.number}.pdf`)}>PDF</Button></span></li>)}</ul>
        </Card>
      ) : null}
    </div>
  );
}
