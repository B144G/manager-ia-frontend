/* Profil de l'entreprise : une question à la fois, à réponse par bouton. L'ERP apprend l'entreprise pour mieux automatiser.
   Visible des responsables et plus tant qu'il reste une question ; ensuite, une ligne discrète avec le pourcentage. */
import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';

/** Une question : gros boutons ; plusieurs réponses = cocher puis « Valider ». onSkip absent = pas de bouton « Passer ». */
function Ask({ q, busy, onAnswer, onSkip, t }) {
  const [pick, setPick] = useState([]);
  const toggle = (v) => setPick(pick.includes(v) ? pick.filter((x) => x !== v) : [...pick, v]);
  return (
    <>
      <p className="pq">{tsrv(q.ask)}</p>
      {q.hint ? <p className="muted small">{tsrv(q.hint)}</p> : null}
      <div className="popts">
        {q.options.map((o) => (
          <button type="button" key={o.value} disabled={busy} className={'pbtn' + (pick.includes(o.value) ? ' on' : '')}
            onClick={() => (q.multi ? toggle(o.value) : onAnswer(o.value))}>{tsrv(o.label)}</button>
        ))}
      </div>
      <div className="row">
        {q.multi ? <button type="button" className="btn primary" disabled={busy || !pick.length} onClick={() => onAnswer(pick)}>{t('Valider')}</button> : null}
        {onSkip ? <button type="button" className="link" disabled={busy} onClick={onSkip}>{t('Passer')}</button> : null}
      </div>
    </>
  );
}

export default function Profile() {
  const { oapi, can, fail } = useWs();
  const t = useT();
  const [p, setP] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { oapi('GET', '/profile').then(setP).catch(() => {}); }, [oapi]);
  if (!p || !can('manager')) return null;

  const send = (path, body) => {
    setBusy(true);
    oapi('POST', '/profile/' + path, body).then(setP).catch(fail).finally(() => setBusy(false));
  };
  const q = p.next;
  const bar = <div className="pbar" aria-hidden="true"><i style={{ width: p.score + '%' }} /></div>;

  if (!q) {
    const s = p.skipped[0];
    return (
      <section className="dc pfcard done">
        <div className="ch"><h2>{t('Brij-IA connaît votre entreprise à {n} %', { n: p.score })}</h2>
          <button className="link" type="button" onClick={() => setOpen(!open)}>{open ? t('Masquer') : t('Voir ce que cela débloque')}</button></div>
        {bar}
        {s ? <><p className="muted small">{t('{n} question(s) passée(s) : répondez-y pour que Brij-IA automatise mieux.', { n: p.skipped.length })}</p>
          <Ask key={s.id} q={s} busy={busy} t={t} onAnswer={(value) => send('answer', { id: s.id, value })} /></> : null}
        {open ? <Unlocks p={p} t={t} /> : null}
      </section>
    );
  }
  return (
    <section className="dc pfcard">
      <div className="ch"><h2>{t('Faisons connaissance')}</h2><small className="muted">{t('{n} % connu', { n: p.score })}</small></div>
      {bar}
      <Ask key={q.id} q={q} busy={busy} t={t} onAnswer={(value) => send('answer', { id: q.id, value })} onSkip={() => send('skip', { id: q.id })} />
      <p className="muted small">{t('Une seule question à la fois. Vous pouvez changer vos réponses plus tard.')}</p>
    </section>
  );
}

function Unlocks({ p, t }) {
  return (
    <ul className="punl">
      {p.features.map((f) => (
        <li key={f.key} className={f.included ? 'ok' : ''}>
          <b>{tsrv(f.label)}</b>
          <span>{f.included ? t('Inclus dans votre offre ({plan})', { plan: p.plan }) : t('À partir de l\'offre {plan}', { plan: f.plan })}</span>
          {f.included && f.missing.length ? <small>{t('Pour mieux fonctionner : {q}', { q: tsrv(f.missing[0]) })}</small> : null}
        </li>
      ))}
    </ul>
  );
}
