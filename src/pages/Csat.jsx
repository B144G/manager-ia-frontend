import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/** Page publique de satisfaction (lien envoyé au client quand sa demande est résolue) : une note de 1 à 5 et un commentaire facultatif. */
export default function Csat() {
  const t = useT();
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { rq('GET', '/api/ws/public/csat/' + encodeURIComponent(token)).then(setInfo, (e) => setErr(e.message)); }, [token]);
  const send = (e) => {
    e.preventDefault();
    if (!score) { setErr(t('Choisissez une note de 1 à 5.')); return; }
    rq('POST', '/api/ws/public/csat/' + encodeURIComponent(token), { score, comment }).then(() => setDone(true), (x) => setErr(x.message));
  };
  return (
    <div className="au-main" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
      <Logo className="au-logo" style={{ display: 'flex' }} />
      <div className="au-card">
        <h1>{t('Votre avis')}</h1>
        {info && !done && !info.answered ? (
          <form noValidate onSubmit={send}>
            <p className="au-sub">{t('Votre demande « {subject} » ({org}) est traitée. Êtes-vous satisfait(e) ?', { subject: info.subject, org: info.organisation })}</p>
            <div className="row" role="radiogroup" aria-label={t('Note')} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={score === n} className={'btn' + (score === n ? ' primary' : '')} style={{ minHeight: 48, minWidth: 48 }} onClick={() => setScore(n)}>{n}</button>)}
            </div>
            <label className="fld"><span>{t('Un commentaire (facultatif)')}</span><textarea rows={3} style={{ fontSize: 16 }} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
            <p className="hm-err" role="alert">{err ? tsrv(err) : ''}</p>
            <button className="s-btn pri big au-go" type="submit">{t('Envoyer mon avis')}</button>
          </form>
        ) : null}
        {done ? <p className="s-ok">{t('Merci, votre avis a bien été enregistré.')}</p> : null}
        {info && info.answered && !done ? <p>{t('Merci, votre avis a déjà été enregistré.')}</p> : null}
        {!info && err ? <p className="hm-err" role="alert">{tsrv(err)}</p> : null}
      </div>
    </div>
  );
}
