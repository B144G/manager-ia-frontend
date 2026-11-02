import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BTN, saveFile } from '../w3/common.jsx';

/* Documents PDF : télécharger, partager à une ou plusieurs personnes (par personne, poste, antenne ou rôle), boîte « Documents reçus »,
   envoi des bulletins de paie à chaque salarié. Le PDF est fabriqué par le serveur ; chacun l'ouvre après connexion. */

const ROLE = { member: 'Membres', manager: 'Responsables', admin: 'Administrateurs' };
const KIND = { invoice: 'Facture, devis ou avoir', project: 'Rapport de projet', payslip: 'Bulletin de paie' };
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat([v]));
const slugName = (s) => String(s || 'document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);

function Group({ title, children }) {
  return <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: '8px 12px', margin: '8px 0' }}><legend className="small"><b>{title}</b></legend>{children}</fieldset>;
}
function Check({ checked, onChange, label, hint }) {
  return (
    <label className="row" style={{ minHeight: 40, alignItems: 'center', gap: 8, cursor: 'pointer', flexWrap: 'nowrap' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 20, height: 20, flex: '0 0 20px' }} />
      <span>{label}{hint ? <small className="muted">{' · ' + hint}</small> : null}</span>
    </label>
  );
}

/** Fenêtre de partage d'un document. kind = invoice | project. */
export function ShareDialog({ kind, sourceId, close, canCosts }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const aud = useLoad(() => oapi('GET', '/share/audience'), []);
  const [sel, setSel] = useState({ userIds: [], jobs: [], branchIds: [], roles: [] });
  const [message, setMessage] = useState('');
  const [includeCosts, setIncludeCosts] = useState(false);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const empty = !sel.userIds.length && !sel.jobs.length && !sel.branchIds.length && !sel.roles.length;
  const key = JSON.stringify(sel);
  useEffect(() => {
    if (empty) { setPrev(null); return undefined; }
    let off = false;
    oapi('POST', '/share/preview', sel).then((r) => { if (!off) setPrev(r); }, () => {});
    return () => { off = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (k, v) => setSel((s) => ({ ...s, [k]: toggle(s[k], v) }));
  const send = () => {
    setBusy(true);
    oapi('POST', '/share/send', { kind, sourceId, message, includeCosts, ...sel }).then(setDone).catch((e) => { fail(e); setBusy(false); });
  };
  if (done) {
    return (
      <div>
        <p><b>{t('Envoyé à {n} personne(s).', { n: done.recipients })}</b></p>
        <p className="muted small">{done.names.join(', ')}</p>
        {done.noAccount.length ? <p className="small late">{t("Pas de compte Brij-IA pour : {names}. Téléchargez le PDF pour le leur remettre.", { names: done.noAccount.map((x) => x.name).join(', ') })}</p> : null}
        <p className="muted small">{t("Chacun est prévenu dans l'application (et par e-mail si son contact est une adresse) et ouvre le document après connexion, depuis « Documents reçus » du tableau de bord.")}</p>
        <button className="btn primary small" type="button" onClick={close}>{t('Fermer')}</button>
      </div>
    );
  }
  return (
    <div>
      <p className="muted small">{t("Le document est figé au moment de l'envoi (un instantané chiffré). Il n'y a pas de lien public : il faut être connecté pour l'ouvrir.")}</p>
      <Loaded state={aud}>{(a) => (
        <>
          <Group title={t('Par poste')}>
            {!a.jobs.length ? <small className="muted">{t("Aucun poste renseigné dans Ressources humaines.")}</small> : null}
            {a.jobs.map((j) => <Check key={j.job} checked={sel.jobs.includes(j.job)} onChange={() => flip('jobs', j.job)} label={j.job} hint={t('{n} salarié(s), {m} avec un compte', { n: j.employees, m: j.withAccount })} />)}
          </Group>
          {a.branches.length ? (
            <Group title={t('Par antenne')}>
              {a.branches.map((b) => <Check key={b.id} checked={sel.branchIds.includes(b.id)} onChange={() => flip('branchIds', b.id)} label={b.name} />)}
            </Group>
          ) : null}
          <Group title={t('Par rôle')}>
            {a.roles.map((r) => <Check key={r} checked={sel.roles.includes(r)} onChange={() => flip('roles', r)} label={t(ROLE[r] || r)} />)}
          </Group>
          <Group title={t('Personnes')}>
            {a.members.map((m) => <Check key={m.userId} checked={sel.userIds.includes(m.userId)} onChange={() => flip('userIds', m.userId)} label={m.name} hint={m.title || undefined} />)}
          </Group>
        </>
      )}
      </Loaded>
      {canCosts ? <Check checked={includeCosts} onChange={() => setIncludeCosts((v) => !v)} label={t('Inclure le budget et les coûts')} hint={t('réservé aux responsables : à cocher seulement si les destinataires peuvent les voir')} /> : null}
      <label className="fld"><span>{t('Message (facultatif)')}</span>
        <textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} style={{ fontSize: 16 }} /></label>
      {prev ? <p className="small"><b>{t('{n} personne(s) recevront ce document : {names}', { n: prev.count, names: prev.names.slice(0, 8).join(', ') + (prev.count > 8 ? '…' : '') })}</b></p> : null}
      {prev && prev.noAccount.length ? <p className="small late">{t("Sans compte Brij-IA, ils ne le recevront pas : {names}.", { names: prev.noAccount.map((x) => x.name).join(', ') })}</p> : null}
      <div className="row">
        <button className="btn primary small" type="button" style={BTN} disabled={busy || empty || (prev && !prev.count)} onClick={send}>{t('Envoyer le PDF')}</button>
      </div>
    </div>
  );
}

/** Boutons « Télécharger le PDF » et « Partager » pour une facture, un devis, un avoir ou un projet. */
export function PdfActions({ kind, sourceId, title, canCosts }) {
  const t = useT();
  const { orgId, modal, fail, can } = useWs();
  if (!can('manager')) return null;
  return (
    <>
      <button className="btn small" type="button" style={BTN} onClick={() => saveFile('/orgs/' + orgId + '/share/pdf/' + kind + '/' + sourceId + (canCosts ? '?includeCosts=1' : ''), slugName(title) + '.pdf', fail)}>{t('Télécharger le PDF')}</button>
      <button className="btn small" type="button" style={BTN} onClick={() => modal(t('Partager « {title} »', { title }), (close) => <ShareDialog kind={kind} sourceId={sourceId} close={close} canCosts={canCosts} />, { wide: true })}>{t('Partager à l\'équipe')}</button>
    </>
  );
}

/** Carte du tableau de bord : documents reçus (tout membre) et documents envoyés (responsables). */
export function SharedDocs() {
  const t = useT();
  const { oapi, orgId, can, dateFr, fail, confirm } = useWs();
  const inbox = useLoad(() => oapi('GET', '/share/inbox'), []);
  const sent = useLoad(() => (can('manager') ? oapi('GET', '/share/sent') : Promise.resolve({ items: [] })), []);
  const open = (x) => saveFile('/orgs/' + orgId + '/share/' + x.id + '/file', slugName(x.title) + '.pdf', fail).then(() => { inbox.reload(); sent.reload(); });
  if (inbox.data && !inbox.data.items.length && sent.data && !sent.data.items.length) return null;
  return (
    <div className="ws-card">
      <h2>{t('Documents reçus')}{inbox.data && inbox.data.unread ? <span className="pill bad" style={{ marginLeft: 8 }}>{t('{n} nouveau(x)', { n: inbox.data.unread })}</span> : null}</h2>
      <Loaded state={inbox}>{(j) => (
        <>
          {!j.items.length ? <Empty text={t('Aucun document reçu.')} /> : null}
          {j.items.slice(0, 10).map((x) => (
            <div className="line" key={x.id}>
              <span>{!x.opened ? <b>{'● '}</b> : null}<b>{x.title}</b><br /><small className="muted">{t(KIND[x.kind] || 'Document') + ' · ' + t('de {name}', { name: x.sender || '—' }) + ' · ' + dateFr(x.at.slice(0, 10)) + (x.message ? ' · ' + x.message : '')}</small></span>
              <button className="btn small" type="button" style={BTN} onClick={() => open(x)}>{t('Ouvrir le PDF')}</button>
            </div>
          ))}
        </>
      )}
      </Loaded>
      {can('manager') && sent.data && sent.data.items.length ? (
        <>
          <h3>{t('Documents que vous avez partagés')}</h3>
          {sent.data.items.slice(0, 8).map((x) => {
            const opened = x.recipients.filter((r) => r.opened).length;
            return (
              <div className="line" key={x.id}>
                <span><b>{x.title}</b><br /><small className="muted">{t('{n} destinataire(s), {m} ont ouvert', { n: x.recipients.length, m: opened }) + ' : ' + x.recipients.map((r) => r.name + (r.opened ? ' ✓' : '')).join(', ')}</small></span>
                <button className="link" type="button" style={BTN} onClick={() => confirm(t('Retirer ce partage ? Les destinataires ne pourront plus ouvrir le document.'), () => { oapi('DELETE', '/share/' + x.id).then(() => { sent.reload(); inbox.reload(); }).catch(fail); })}>{t('Retirer')}</button>
              </div>
            );
          })}
        </>
      ) : null}
      {void tsrv}
    </div>
  );
}

/** Paie : envoie à chaque salarié son propre bulletin (administrateur). */
export function SendSlips({ month, onDone }) {
  const t = useT();
  const { oapi, modal, confirm, fail } = useWs();
  const run = () => confirm(t('Envoyer à chaque salarié son bulletin de paie validé de ce mois ? Chacun reçoit seulement le sien, dans son espace Brij-IA.'), () => {
    oapi('POST', '/share/payslips', { month }).then((r) => {
      modal(t('Bulletins envoyés'), (close) => (
        <div>
          <p><b>{t('{n} bulletin(s) envoyé(s).', { n: r.sent })}</b></p>
          {r.skipped.length ? <p className="small"><b>{t('Non envoyés :')}</b></p> : null}
          {r.skipped.map((s, i) => <div className="line" key={i}><span>{s.employee}</span><small className="muted">{tsrv(s.reason)}</small></div>)}
          <button className="btn small" type="button" style={BTN} onClick={() => { close(); if (onDone) onDone(); }}>{t('Fermer')}</button>
        </div>
      ));
    }).catch(fail);
  });
  return <button className="btn small" type="button" style={BTN} onClick={run}>{t('Envoyer les bulletins à chaque salarié')}</button>;
}
