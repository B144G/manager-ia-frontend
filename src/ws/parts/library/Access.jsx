import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Badge, Form, Loaded, Table, Tabs, useLoad } from '../../ui.jsx';
import { day, when } from './util.jsx';

/* Droits d'accès d'une notice ou d'une classe (règles « autoriser / refuser » par rôle, personne ou service), délégations temporaires, journal de consultation.
   Ces règles s'ajoutent aux droits du bloc protégé : elles ne contournent jamais le mot de passe. */

const OPS = [['read', 'Lire'], ['download', 'Télécharger'], ['edit', 'Modifier'], ['loan', 'Emprunter']];
const ROLE_FR = { member: 'Membre', manager: 'Responsable', admin: 'Administrateur' };

/** Éditeur de règles : scope = 'records' ou 'classes'. */
export function AccessEditor({ L, scope, id, close }) {
  const t = useT();
  const { toast } = useWs();
  const st = useLoad(() => L.lib('GET', `/${scope}/${id}/access`), [scope, id]);
  const subj = useLoad(() => L.lib('GET', '/access/subjects'), []);
  const [rules, setRules] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState({ type: 'role', who: 'member', effect: 'deny' });
  return (
    <Loaded state={st}>{(j) => {
      const cur = rules || j.rules;
      const people = subj.data ? subj.data.people : []; const branches = subj.data ? subj.data.branches : [];
      const options = sel.type === 'role' ? ['member', 'manager', 'admin'].map((r) => [r, t(ROLE_FR[r])]) : sel.type === 'user' ? people.map((p) => [String(p.userId), p.name]) : branches.map((b) => [String(b.id), b.name]);
      const add = () => { const who = sel.who || (options[0] && options[0][0]); if (!who) return; setRules([...cur, { subjectType: sel.type, subject: who, label: (options.find((o) => o[0] === who) || [])[1] || who, effect: sel.effect, read: true, download: false, edit: false, loan: false }]); };
      const upd = (i, k, v) => setRules(cur.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
      const save = () => L.lib('PUT', `/${scope}/${id}/access`, { rules: cur.map((x) => ({ subjectType: x.subjectType, subject: x.subject, effect: x.effect, read: x.read, download: x.download, edit: x.edit, loan: x.loan })) }).then(() => { toast(t('Droits enregistrés.')); if (close) close(); else { setRules(null); st.reload(); } }, (e) => setErr(tsrv(e.message)));
      return (
        <div>
          <p className="muted small">{t("Ces règles s'ajoutent aux droits du bloc : un document d'un bloc protégé reste verrouillé tant que la personne n'a pas ressaisi son mot de passe. « Refuser » retire un droit ; « Autoriser » le donne sur la notice. Le propriétaire n'est jamais bloqué.")}</p>
          {scope === 'records' && j.inherited && j.inherited.length ? <p className="muted small">{t('Règles héritées de la classe : {list}', { list: j.inherited.map((x) => `${x.classCode} ${x.effect === 'deny' ? t('refuser') : t('autoriser')} ${x.label}`).join(' · ') })}</p> : null}
          {cur.length ? (
            <ul className="lib-rules">{cur.map((x, i) => (
              <li key={i}>
                <b>{x.subjectType === 'role' ? t(ROLE_FR[x.subject] || x.subject) : x.label}</b> <small className="muted">({x.subjectType === 'role' ? t('rôle') : x.subjectType === 'user' ? t('personne') : t('service')})</small>
                <select value={x.effect} onChange={(e) => upd(i, 'effect', e.target.value)} aria-label={t('Effet')}><option value="allow">{t('Autoriser')}</option><option value="deny">{t('Refuser')}</option></select>
                {OPS.map(([k, l]) => <label key={k} className="lib-check"><input type="checkbox" checked={x[k]} onChange={(e) => upd(i, k, e.target.checked)} /> {t(l)}</label>)}
                <button className="btn small" type="button" onClick={() => setRules(cur.filter((_, n) => n !== i))}>{t('Retirer')}</button>
              </li>))}</ul>
          ) : <p className="ws-empty">{t('Aucune règle : les droits de base s’appliquent.')}</p>}
          <div className="lib-bar">
            <select value={sel.type} onChange={(e) => setSel({ ...sel, type: e.target.value, who: '' })} aria-label={t('Destinataire')}><option value="role">{t('Rôle')}</option><option value="user">{t('Personne')}</option><option value="branch">{t('Service')}</option></select>
            <select value={sel.who} onChange={(e) => setSel({ ...sel, who: e.target.value })} aria-label={t('Qui')}>{options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
            <select value={sel.effect} onChange={(e) => setSel({ ...sel, effect: e.target.value })} aria-label={t('Effet')}><option value="deny">{t('Refuser')}</option><option value="allow">{t('Autoriser')}</option></select>
            <button className="btn small" type="button" onClick={add}>{t('Ajouter la règle')}</button>
          </div>
          <p className="ws-err" role="alert">{err}</p>
          <button className="btn primary" type="button" onClick={save}>{t('Enregistrer les droits')}</button>
        </div>
      );
    }}
    </Loaded>
  );
}

function DelegateForm({ L, onDone }) {
  const t = useT();
  const { toast } = useWs();
  const people = useLoad(() => L.lib('GET', '/people'), []);
  return (
    <Form submitText={t('Déléguer')}
      fields={[
        { k: 'to', label: t('Déléguer à'), type: 'select', required: true, value: '', options: [['', t('— Choisir —')], ...(people.data ? people.data.people.map((p) => [String(p.userId), p.name]) : [])] },
        { k: 'scope', label: t('Portée'), type: 'select', value: 'record', options: [['record', t('Une notice')], ['class', t('Une classe')], ['all', t('Tout le catalogue (administrateur)')]] },
        { k: 'scopeId', label: t('Numéro de la notice ou de la classe'), type: 'number', value: '' },
        { k: 'perms', label: t('Droits'), type: 'select', value: 'read', options: [['read', t('Lire')], ['read,download', t('Lire et télécharger')], ['read,loan', t('Lire et emprunter')], ['read,download,edit,loan', t('Tous les droits')]] },
        { k: 'days', label: t('Durée (jours, 90 au plus)'), type: 'number', value: 7 },
        { k: 'reason', label: t('Motif'), value: '' },
      ]}
      onSubmit={(v) => L.lib('POST', '/delegations', { toUserId: Number(v.to), scope: v.scope, ...(v.scope === 'all' ? {} : { scopeId: Number(v.scopeId) }), perms: Object.fromEntries(v.perms.split(',').map((k) => [k, true])), days: Number(v.days), reason: v.reason }).then(() => { toast(t('Délégation accordée.')); onDone(); })} />
  );
}

/** Écran « Accès et délégations » : mes délégations, journal de consultation (administrateurs). */
export default function Access({ L }) {
  const t = useT();
  const { can, toast } = useWs();
  const [tab, setTab] = useState('deleg');
  const st = useLoad(() => L.lib('GET', `/delegations?scope=${can('admin') ? 'all' : 'mine'}`), [L.tick]);
  const cs = useLoad(() => (tab === 'journal' ? L.lib('GET', '/consultations?days=30') : Promise.resolve(null)), [tab, L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  return (
    <>
      <div className="ws-head"><div><h1>{t('Accès et délégations')}</h1><p className="muted">{t("Donnez un accès temporaire à une personne (remplacement, mission) et suivez qui a consulté quoi.")}</p></div></div>
      <Tabs items={[{ id: 'deleg', label: t('Délégations') }, ...(can('admin') ? [{ id: 'journal', label: t('Journal de consultation') }] : [])]} value={tab} onChange={setTab} label={t('Accès')} />
      {tab === 'journal' ? (
        <Loaded state={cs}>{(j) => (j ? <Table caption={t('Journal de consultation')} empty={t('Aucune consultation.')} rows={j.consultations}
          columns={[{ key: 'at', label: t('Date'), render: (x) => when(x.at) }, { key: 'user', label: t('Personne') }, { key: 'action', label: t('Action'), render: (x) => ({ view: t('Fiche'), download: t('Téléchargement'), preview: t('Aperçu'), loan: t('Prêt') }[x.action] || x.action) }, { key: 'title', label: t('Ressource'), render: (x) => x.title || '—' }]} /> : null)}</Loaded>
      ) : (
        <div className="ws-cols">
          <div className="ws-card"><h2>{t('Déléguer un accès')}</h2><DelegateForm L={L} onDone={st.reload} /></div>
          <div className="ws-card"><h2>{t('Délégations')}</h2>
            <Loaded state={st}>{(j) => (j.delegations.length ? <ul className="lib-audit">{j.delegations.map((d) => (
              <li key={d.id} className={d.active ? '' : 'bad'}><b>{d.from} → {d.to}</b>
                <span>{[d.read && t('Lire'), d.download && t('Télécharger'), d.edit && t('Modifier'), d.loan && t('Emprunter')].filter(Boolean).join(', ')} · {d.scope === 'all' ? t('Tout le catalogue') : d.scope === 'class' ? t('Classe {n}', { n: d.scopeId }) : t('Notice {n}', { n: d.scopeId })} · {d.active ? t("jusqu'au {date}", { date: day(d.until) }) : <Badge tone="neutral">{d.revokedAt ? t('retirée') : t('expirée')}</Badge>}</span>
                {d.active && (d.mine || can('admin')) ? <button className="btn small" type="button" onClick={() => L.lib('DELETE', `/delegations/${d.id}`).then(() => { toast(t('Délégation retirée.')); st.reload(); }, fail)}>{t('Retirer')}</button> : null}</li>))}</ul> : <p className="ws-empty">{t('Aucune délégation.')}</p>)}</Loaded></div>
        </div>
      )}
    </>
  );
}
