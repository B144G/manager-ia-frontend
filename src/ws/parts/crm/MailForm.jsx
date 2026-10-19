import { useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';

/** E-mail à un client (l'IA rédige, vous relisez et vous envoyez). */
export default function MailForm({ cu, init, close, onSent }) {
  const { oapi, toast, fail } = useWs();
  const [subject, setSubject] = useState(init.subject || '');
  const [message, setMessage] = useState(init.body || '');
  const [files, setFiles] = useState([]); // { id, name }
  const filesRef = useRef([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setAll = (l) => { filesRef.current = l; setFiles(l); };

  function pick(ev) {
    setErr('');
    const chosen = Array.from(ev.target.files || []);
    ev.target.value = '';
    chosen.forEach((file) => {
      if (filesRef.current.length >= 3) { setErr('3 pièces jointes au maximum.'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        const data = String(rd.result).split(',')[1] || '';
        oapi('POST', '/mail/files', { name: file.name, data: data }).then((r) => { if (filesRef.current.length < 3) setAll([...filesRef.current, { id: r.id, name: r.name }]); }).catch((e) => setErr(e.message));
      };
      rd.readAsDataURL(file);
    });
  }
  function send() {
    setErr(''); setBusy(true);
    oapi('POST', '/mail/send', { customerId: cu.id, subject, body: message, fileIds: files.map((f) => f.id) })
      .then((r) => { close(); toast('E-mail envoyé (' + r.sentToday + ' sur ' + r.limitPerDay + " aujourd'hui)."); onSent(); })
      .catch((e) => { setErr(e.message); setBusy(false); if (e.status === 401) fail(e); });
  }
  return (
    <>
      <label className="fld"><span>Objet</span><input type="text" value={subject} placeholder="Objet du message" aria-label="Objet" onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="fld"><span>Message</span><textarea rows={9} aria-label="Message" placeholder="Votre message…" value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      <label className="fld">
        <span>Images ou PDF à joindre (3 au maximum, 2 Mo chacun)</span>
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" multiple aria-label="Ajouter des images ou un PDF" onChange={pick} />
        <small>Pour une vidéo, collez plutôt un lien (YouTube, Drive…) dans le message.</small>
      </label>
      <div className="row">
        {files.map((f, i) => (
          <span className="pill good" key={f.id}>{f.name + ' '}<button className="link" type="button" aria-label={'Retirer ' + f.name} onClick={() => setAll(filesRef.current.filter((_, j) => j !== i))}>×</button></span>
        ))}
      </div>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" type="button" disabled={busy} onClick={send}>{'Envoyer à ' + cu.email}</button>
        <button className="btn" type="button" onClick={close}>Annuler</button>
      </div>
      <p className="muted small">Rien ne part sans votre clic. Le message est envoyé avec le nom de votre organisation ; le client peut vous répondre directement.</p>
    </>
  );
}
