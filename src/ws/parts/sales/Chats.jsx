import { useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { tr, useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { CHANNELS, Pill, TEMP, useOrgUrl } from './util.jsx';

const APPT_ST = { pending: 'à confirmer', confirmed: 'confirmé', cancelled: 'annulé', done: 'terminé' };
const FILTERS = [['all', 'Toutes'], ['free', 'Non attribuées'], ['mine', 'Les miennes'], ['hot', 'Chaudes']];

const lastTextOf = (x) => (x.lastText ? ' · « ' + x.lastText.slice(0, 70) + (x.lastText.length > 70 ? '…' : '') + ' »' : '');

/** Lecture d'une conversation dans une fenêtre. prefix = "/sales" (équipe) ou "/sales-mine" (mes conversations). */
export function openChat(ws, prefix, x, team, canAssign, after) {
  ws.modal(x.customer ? tr('Conversation avec {name}', { name: x.customer }) : x.contact ? tr('Conversation avec {name}', { name: '+' + x.contact }) : tr('Conversation'),
    (close) => <ChatReader prefix={prefix} x={x} team={team} canAssign={canAssign} after={after} close={close} />, { wide: true });
}

function ChatReader({ prefix, x, team, canAssign, after, close }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', prefix + '/chats/' + x.id), []);
  const done = () => { close(); after(); };
  return (
    <div>
      {st.error ? t(st.error.message) : !st.data ? <Loading /> : <ChatBody j={st.data} prefix={prefix} x={x} team={team} canAssign={canAssign} done={done} />}
    </div>
  );
}

function ChatBody({ j, prefix, x, team, canAssign, done }) {
  const t = useT();
  const ws = useWs();
  const { oapi, toast, fail, dateFr } = ws;
  const urlOf = useOrgUrl();
  const taRef = useRef(null);
  const [reply, setReply] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [assignee, setAssignee] = useState(j.assigneeId ? String(j.assigneeId) : '');
  const bf = j.brief, cu = (bf && bf.customer) || {};
  const cust = [cu.name, cu.phone, cu.email, cu.address].filter(Boolean).join(' · ');

  function send() {
    setSending(true); setErr('');
    oapi('POST', prefix + '/chats/' + x.id + '/reply', { text: reply })
      .then(() => { toast(t("Message envoyé. L'IA ne répond plus à cette personne.")); done(); })
      .catch((e) => { setErr(t(e.message)); setSending(false); });
  }

  return (
    <>
      {j.campaign ? <p className="muted small">{t('Campagne : {name}', { name: j.campaign })}</p> : null}
      {j.summary ? <div className="ws-card" style={{ background: 'var(--pale,#f1f5fd)', margin: '8px 0' }}><b>{t('Fiche prospect')}</b><p style={{ whiteSpace: 'pre-line', margin: '6px 0 0' }}>{j.summary}</p></div> : null}
      {j.appointments && j.appointments.length ? (
        <div className="ws-card" style={{ margin: '8px 0' }}>
          <b>{t('Rendez-vous demandé')}</b>
          {j.appointments.map((a, i) => <p key={a.id || i} style={{ margin: '4px 0 0' }}>{t('{date} à {time}', { date: dateFr(a.date), time: a.time.replace(':', 'h') }) + (a.purpose ? ' · ' + a.purpose : '') + ' · ' + t(APPT_ST[a.status])}</p>)}
        </div>
      ) : null}
      {bf ? (
        <div className="ws-card" style={{ margin: '8px 0', borderColor: 'var(--accent)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{t("Dossier préparé par l'IA interne")}</b><small className="muted">{t("à relire avant d'agir")}</small></div>
          <p style={{ margin: '6px 0' }}>{bf.summary}</p>
          {cust ? <p className="muted small" style={{ margin: '4px 0' }}>{t('Fiche client trouvée : {info}', { info: cust })}</p> : null}
          {bf.nextSteps && bf.nextSteps.length ? <ul style={{ margin: '6px 0 6px 18px', padding: 0 }}>{bf.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul> : null}
          {bf.draftReply ? <p className="small" style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 10px', margin: '6px 0' }}>{t('Réponse proposée : « {text} »', { text: bf.draftReply })}</p> : null}
          <div className="row">
            {bf.draftReply && j.channel !== 'web' ? <button className="btn small" type="button" onClick={() => { setReply(bf.draftReply); if (taRef.current) taRef.current.focus(); }}>{t('Utiliser comme réponse')}</button> : null}
            <button className="btn small" type="button" onClick={() => oapi('POST', prefix + '/chats/' + x.id + '/apply-brief', {}).then((r) => toast(r.done.length ? t('Fiche client complétée : {list}.', { list: r.done.join(', ') }) : t('La fiche client était déjà à jour.'))).catch(fail)}>{t('Appliquer à la fiche client')}</button>
            {prefix === '/sales' ? <button className="btn small" type="button" onClick={() => oapi('POST', '/sales/chats/' + x.id + '/brief', {}).then(() => { toast(t('Dossier mis à jour.')); done(); }).catch(fail)}>{t('Mettre à jour le dossier')}</button> : null}
          </div>
        </div>
      ) : j.status === 'handoff' && prefix === '/sales' ? (
        <div className="row" style={{ margin: '8px 0' }}><button className="btn small" type="button" onClick={() => oapi('POST', '/sales/chats/' + x.id + '/brief', {}).then(() => { toast(t('Dossier prêt.')); done(); }).catch(fail)}>{t("Préparer le dossier avec l'IA")}</button></div>
      ) : null}
      {canAssign ? (
        <div className="row" style={{ margin: '8px 0' }}>
          <span className="muted small">{t('Attribuer à :')}</span>
          <select aria-label={t("Attribuer à")} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{t('Non attribuée')}</option>
            {(team || []).map((m) => <option key={m.userId} value={String(m.userId)}>{m.name + (m.title ? ' (' + m.title + ')' : '')}</option>)}
          </select>
          <button className="btn small" type="button" onClick={() => oapi('PUT', '/sales/chats/' + x.id + '/assign', { userId: assignee ? Number(assignee) : null }).then(() => { toast(assignee ? t('Conversation attribuée : la personne est prévenue.') : t('Conversation libérée.')); done(); }).catch(fail)}>{t('Enregistrer')}</button>
        </div>
      ) : null}
      {j.messages.map((m, i) => {
        const att = /^\[(image|document) #(\d+)\]\s*([\s\S]*)$/.exec(m.content);
        const who = m.role === 'user' ? '' : m.role === 'staff' ? t('Vous : ') : t('Assistant : ');
        const cls = 'bub ' + (m.role === 'user' ? 'user' : 'assistant');
        if (!att) return <div key={i} className={cls}>{who + m.content}</div>;
        const url = urlOf(prefix + '/chats/' + x.id + '/media/' + att[2]);
        return (
          <div key={i} className={cls}>
            {who}
            {att[1] === 'image'
              ? <a href={url} target="_blank" rel="noopener"><img src={url} alt={t("Photo envoyée par le client")} style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 8, margin: '4px 0' }} /></a>
              : <a href={url} target="_blank" rel="noopener">{t('Ouvrir le document (PDF) envoyé par le client')}</a>}
            {att[3] ? <span>{att[3]}</span> : null}
          </div>
        );
      })}
      {j.channel !== 'web' ? (
        <>
          <div style={{ marginTop: 14 }}>
            <textarea ref={taRef} rows={3} placeholder={t("Votre réponse au client…")} aria-label={t("Votre réponse")} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
            <p className="ws-err" role="alert">{err}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary small" type="button" disabled={sending} onClick={send}>{t('Envoyer le message')}</button>
              {j.status === 'handoff' ? <button className="btn small" type="button" onClick={() => oapi('PUT', prefix + '/chats/' + x.id + '/status', { status: 'open' }).then(() => { toast(t("L'IA répondra de nouveau à cette personne.")); done(); }).catch(fail)}>{t("Rendre à l'IA")}</button> : null}
              {prefix === '/sales-mine' ? <button className="btn small" type="button" onClick={() => oapi('POST', prefix + '/chats/' + x.id + '/release', {}).then(() => { toast(t("Conversation rendue à l'équipe.")); done(); }).catch(fail)}>{t("Rendre à l'équipe")}</button> : null}
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {j.channel === 'whatsapp' ? <button className="btn small" type="button" onClick={() => sendTemplateTo(ws, x, done)}>{t('Envoyer un modèle (plus de 24 h)')}</button> : null}
            {j.channel === 'web' || prefix !== '/sales' ? null : <button className="btn small" type="button" onClick={() => sendMediaTo(ws, x, done)}>{t('Envoyer une photo ou une vidéo')}</button>}
          </div>
          <p className="muted small">{t("Quand vous répondez, l'IA se tait pour cette personne. Meta n'autorise l'écriture libre que dans les 24 h qui suivent son dernier message.")}</p>
        </>
      ) : null}
    </>
  );
}

/* Relances WhatsApp : modèle approuvé par Meta envoyé à une conversation. */
function sendTemplateTo(ws, x, done) {
  ws.oapi('GET', '/sales/wa').then((w) => {
    ws.modal(tr('Envoyer un modèle WhatsApp'), (close) => <TemplateSender w={w} x={x} close={close} done={done} />);
  }).catch(ws.fail);
}

function TemplateSender({ w, x, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const [sel, setSel] = useState(w.templates[0] ? String(w.templates[0].id) : '');
  const [vals, setVals] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!w.templates.length) return <Empty text={t("Aucun modèle enregistré. Ajoutez-en dans l'onglet Relances (un modèle doit d'abord être approuvé par Meta).")} />;
  const tpl = w.templates.filter((y) => String(y.id) === sel)[0];
  const go = () => {
    setBusy(true); setErr('');
    oapi('POST', '/sales/wa/chats/' + x.id + '/template', { templateId: Number(sel), params: Array.from({ length: tpl.params }, (_, i) => (vals[i] || '').trim()) })
      .then(() => { toast(t('Modèle envoyé.')); close(); done(); }).catch((e) => { setErr(t(e.message)); setBusy(false); });
  };
  return (
    <>
      <select aria-label={t("Modèle")} value={sel} onChange={(e) => { setSel(e.target.value); setVals([]); }}>
        {w.templates.map((y) => <option key={y.id} value={String(y.id)}>{y.name + ' (' + y.language + ')'}</option>)}
      </select>
      <p className="muted small">{tpl.preview ? t('Texte : {text}', { text: tpl.preview }) : ''}</p>
      <div>
        {Array.from({ length: tpl.params }, (_, i) => (
          <div key={tpl.id + '-' + i} style={{ margin: '6px 0' }}>
            <input type="text" placeholder={t('Variable {{n}}', { n: i + 1 })} aria-label={t('Variable {n}', { n: i + 1 })} maxLength={300} value={vals[i] || ''} onChange={(e) => setVals((v) => { const n = v.slice(); n[i] = e.target.value; return n; })} />
          </div>
        ))}
      </div>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary small" type="button" disabled={busy} onClick={go}>{t('Envoyer')}</button></div>
    </>
  );
}

/* Envoi d'une photo ou d'une vidéo du catalogue à une conversation. */
function sendMediaTo(ws, x, done) {
  ws.oapi('GET', '/sales/catalog').then((j) => {
    const items = j.items.filter((i) => i.active && (i.photos || i.videos));
    ws.modal(tr('Envoyer une photo ou une vidéo'), (close) => <MediaSender items={items} x={x} close={close} done={done} />);
  }).catch(ws.fail);
}

function MediaSender({ items, x, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const [item, setItem] = useState(items[0] ? String(items[0].id) : '');
  const [kind, setKind] = useState('all');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!items.length) return <Empty text={t("Aucun article n'a de photo ou de vidéo. Ajoutez-en dans l'onglet Catalogue.")} />;
  const go = () => {
    setBusy(true); setErr('');
    oapi('POST', '/sales/chats/' + x.id + '/send-media', { itemId: Number(item), kind })
      .then(() => { toast(t('Envoyé au client.')); close(); done(); }).catch((e) => { setErr(t(e.message)); setBusy(false); });
  };
  return (
    <>
      <select aria-label={t("Article")} value={item} onChange={(e) => setItem(e.target.value)}>
        {items.map((i) => <option key={i.id} value={String(i.id)}>{t('{name} ({photos} photo(s), {videos} vidéo(s))', { name: i.name, photos: i.photos, videos: i.videos })}</option>)}
      </select>
      <div style={{ margin: '8px 0' }}>
        <select aria-label={t("Type")} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">{t('Photos et vidéo')}</option>
          <option value="image">{t('Photos seulement')}</option>
          <option value="video">{t('Vidéo seulement')}</option>
        </select>
      </div>
      <p className="ws-err" role="alert">{err}</p>
      <button className="btn primary small" type="button" disabled={busy} onClick={go}>{t('Envoyer')}</button>
    </>
  );
}

/** Onglet « Conversations » (filtre conservé par le parent). */
export function Chats({ filter, setFilter, onChange }) {
  const t = useT();
  const ws = useWs();
  const { oapi, info, dateFr } = ws;
  const st = useLoad(() => Promise.all([oapi('GET', '/sales/chats'), oapi('GET', '/members')]), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!st.data) return null;
  const [j, mem] = st.data, team = mem.members, me = info.me.userId;
  const list = j.chats.filter((x) => filter === 'all' || (filter === 'free' && !x.assigneeId) || (filter === 'mine' && x.assigneeId === me) || (filter === 'hot' && x.temperature === 'chaud'));
  return (
    <div className="ws-card">
      <h2>{t('Conversations avec les prospects')}</h2>
      <div className="ws-tabs">
        {FILTERS.map((f) => <button key={f[0]} type="button" className={'tab' + (filter === f[0] ? ' on' : '')} onClick={() => setFilter(f[0])}>{t(f[1])}</button>)}
      </div>
      {!list.length ? <Empty text={j.chats.length ? t('Aucune conversation dans cette liste.') : t("Aucune conversation. Partagez le lien de l'assistant dans votre publicité.")} /> : null}
      {list.map((x) => (
        <div className="line" key={x.id}>
          <span>
            <b>{x.customer || (x.contact ? '+' + x.contact : t('Visiteur'))}</b>
            {x.temperature && TEMP[x.temperature] ? <Pill t={TEMP[x.temperature]} /> : null}
            {x.stage === 'prospect' ? <Pill t={['Prospect', 'mid']} /> : x.stage === 'client' ? <Pill t={['Client', 'good']} /> : null}
            {x.channel !== 'web' ? <Pill t={[CHANNELS[x.channel] || x.channel, 'good']} /> : null}
            {x.status === 'handoff' && !x.assigneeId ? <Pill t={['À reprendre', 'bad']} /> : null}
            {x.assignee ? <Pill t={['→ ' + x.assignee, '']} /> : null}
            <small>{' ' + (x.campaign ? t('campagne « {name} » · ', { name: x.campaign }) : '') + dateFr(x.at) + ' · ' + t('{n} messages', { n: x.messages }) + lastTextOf(x)}</small>
          </span>
          <button className="link" type="button" onClick={() => openChat(ws, '/sales', x, team, true, onChange)}>{t('Lire')}</button>
        </div>
      ))}
    </div>
  );
}

/** Vue d'un simple membre (commercial) : seulement les conversations qui lui sont attribuées. */
export function MineView() {
  const t = useT();
  const ws = useWs();
  const { oapi, dateFr } = ws;
  const st = useLoad(() => oapi('GET', '/sales-mine/chats'), []);
  return (
    <>
      <div className="ws-head"><div><h1>{t('Mes conversations')}</h1><p className="muted">{t('Les clients que votre responsable vous a attribués. Lisez la fiche du prospect, puis répondez-lui.')}</p></div></div>
      <div>
        {st.loading && !st.data ? <Loading /> : st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : st.data ? (
          <div className="ws-card">
            <h2>{t('À traiter')}</h2>
            {!st.data.chats.length ? <Empty text={t("Aucune conversation ne vous est attribuée pour le moment.")} /> : null}
            {st.data.chats.map((x) => (
              <div className="line" key={x.id}>
                <span>
                  <b>{x.customer || (x.contact ? '+' + x.contact : t('Visiteur'))}</b>
                  {x.temperature && TEMP[x.temperature] ? <Pill t={TEMP[x.temperature]} /> : null}
                  {x.channel !== 'web' ? <Pill t={[CHANNELS[x.channel] || x.channel, 'good']} /> : null}
                  <small>{' ' + (x.campaign ? t('campagne « {name} » · ', { name: x.campaign }) : '') + dateFr(x.at) + lastTextOf(x)}</small>
                </span>
                <button className="link" type="button" onClick={() => openChat(ws, '/sales-mine', x, null, false, st.reload)}>{t('Ouvrir')}</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
