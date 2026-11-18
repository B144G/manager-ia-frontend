import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Badge, Form, Loaded, Table, Tabs, useLoad } from '../../ui.jsx';
import { day } from './util.jsx';

/* Prêts et retours : mes prêts, guichet (prêt / retour par numéro d'inventaire ou lecture d'un code), retards, historique, réservations, règles, blocages.
   Les règles (durée, renouvellements, pénalités) sont appliquées par le serveur ; cet écran ne fait que les afficher. */

function LoanTable({ L, rows, st, manager, onChange }) {
  const t = useT();
  const { toast } = useWs();
  const fail = (e) => toast(tsrv(e.message), true);
  const act = (l, what) => L.lib('POST', `/loans/${l.id}/${what}`, {}).then((r) => { toast(what === 'return' ? (r.fine ? t('Retour enregistré — pénalité : {n}.', { n: r.fine }) : t('Retour enregistré.')) : what === 'renew' ? t('Prêt renouvelé.') : t('Pénalité réglée.')); onChange(); }, fail);
  const cols = [
    { key: 'title', label: t('Ressource'), render: (l) => <span><b>{l.title}</b><br /><small className="mono muted">{l.inventoryNo}</small></span> },
    ...(manager ? [{ key: 'user', label: t('Emprunteur'), render: (l) => l.user }] : []),
    { key: 'loanedAt', label: t('Emprunté le'), render: (l) => day(l.loanedAt) },
    { key: 'dueAt', label: t('À rendre le'), render: (l) => <span>{day(l.dueAt)}{l.lateDays ? <> <Badge tone="danger">{t('{n} j de retard', { n: l.lateDays })}</Badge></> : null}</span> },
    { key: 'fine', label: t('Pénalité'), align: 'r', render: (l) => (l.fine ? <span>{l.fine}{l.finePaid >= l.fine ? ` ✓` : ''}</span> : '—') },
    { key: 'act', label: t('Actions'), render: (l) => (
      <span className="row">
        {l.state === 'active' ? <button className="btn small" type="button" onClick={() => act(l, 'return')}>{t('Rendre')}</button> : null}
        {l.state === 'active' && !l.lateDays ? <button className="btn small" type="button" onClick={() => act(l, 'renew')}>{t('Renouveler')}</button> : null}
        {manager && l.state !== 'active' && l.fine > l.finePaid ? <button className="btn small" type="button" onClick={() => act(l, 'pay')}>{t('Pénalité réglée')}</button> : null}
        {l.state === 'lost' ? <Badge tone="danger">{t('Perdu')}</Badge> : null}
      </span>) },
  ];
  return <Table columns={cols} rows={rows} empty={t('Aucun prêt dans cette liste.')} caption={t('Prêts')} />;
}

function Desk({ L, onChange }) {
  const t = useT();
  const people = useLoad(() => L.lib('GET', '/people'), []);
  const [code, setCode] = useState(''); const [user, setUser] = useState(''); const [days, setDays] = useState('');
  const [msg, setMsg] = useState({ text: '', bad: false });
  const say = (text, bad) => setMsg({ text, bad: Boolean(bad) });
  const scan = async () => { if (!code.trim()) throw new Error(t('Saisissez ou lisez un code.')); return (await L.lib('GET', `/scan?code=${encodeURIComponent(code.trim())}`)).record; };
  const lend = async (e) => {
    e.preventDefault();
    try { const r = await scan(); const j = await L.lib('POST', `/records/${r.id}/loan`, { ...(user ? { userId: Number(user) } : {}), ...(days ? { days: Number(days) } : {}) }); say(t('« {title} » prêté jusqu’au {date}.', { title: r.title, date: day(j.dueAt) })); setCode(''); onChange(); } catch (x) { say(tsrv(x.message), true); }
  };
  const back = async () => {
    try {
      const r = await scan(); const d = await L.lib('GET', `/records/${r.id}`); const l = (d.loans || []).find((x) => x.state === 'active');
      if (!l) throw new Error(t("Cette ressource n'est pas en prêt."));
      const j = await L.lib('POST', `/loans/${l.id}/return`, {});
      say(j.fine ? t('« {title} » rendu avec {n} jour(s) de retard — pénalité : {fine}.', { title: r.title, n: j.lateDays, fine: j.fine }) : t('« {title} » rendu.', { title: r.title })); setCode(''); onChange();
    } catch (x) { say(tsrv(x.message), true); }
  };
  return (
    <form className="ws-card lib-desk" onSubmit={lend}>
      <h2>{t('Guichet de prêt')}</h2>
      <p className="muted small">{t("Lisez l'étiquette avec un lecteur de codes-barres (il saisit le numéro puis valide), ou tapez le numéro d'inventaire ou la cote.")}</p>
      <div className="lib-bar">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("Numéro d'inventaire ou cote")} aria-label={t("Numéro d'inventaire ou cote")} autoComplete="off" />
        <select value={user} onChange={(e) => setUser(e.target.value)} aria-label={t('Emprunteur')}><option value="">{t('Moi-même')}</option>{(people.data ? people.data.people : []).map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}</select>
        <input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} placeholder={t('Jours (habituel)')} aria-label={t('Durée du prêt en jours')} />
        <button className="btn primary small" type="submit">{t('Prêter')}</button>
        <button className="btn small" type="button" onClick={back}>{t('Enregistrer le retour')}</button>
      </div>
      <p className={msg.bad ? 'ws-err' : 'muted'} role="status">{msg.text}</p>
    </form>
  );
}

function Rules({ L }) {
  const t = useT();
  const { toast } = useWs();
  const st = useLoad(() => L.lib('GET', '/catalog/settings'), []);
  return (
    <Loaded state={st}>{({ settings: s }) => (
      <div className="ws-card">
        <h2>{t('Règles de prêt')}</h2>
        <Form submitText={t('Enregistrer')}
          fields={[
            { k: 'loanDays', label: t('Durée habituelle du prêt (jours)'), type: 'number', value: s.loanDays },
            { k: 'maxRenewals', label: t('Renouvellements autorisés'), type: 'number', value: s.maxRenewals },
            { k: 'maxLoans', label: t('Prêts simultanés par personne'), type: 'number', value: s.maxLoans },
            { k: 'finePerDay', label: t('Pénalité par jour de retard'), type: 'number', value: s.finePerDay, hint: t('0 = aucune pénalité.') },
            { k: 'blockAfterDays', label: t('Blocage automatique après (jours de retard)'), type: 'number', value: s.blockAfterDays, hint: t('0 = pas de blocage automatique.') },
            { k: 'blockDays', label: t('Durée du blocage (jours)'), type: 'number', value: s.blockDays },
            { k: 'holdDays', label: t('Réservation gardée (jours)'), type: 'number', value: s.holdDays, hint: t('Passé ce délai, la ressource passe à la personne suivante.') },
            { k: 'remindBeforeDays', label: t("Rappel avant l'échéance (jours)"), type: 'number', value: s.remindBeforeDays },
            { k: 'remindEveryDays', label: t('Rappel de retard tous les (jours)'), type: 'number', value: s.remindEveryDays },
            { k: 'strictVocab', label: t('Mots-clés'), type: 'select', value: s.strictVocab ? 'yes' : 'no', options: [['no', t('Libres (le vocabulaire aide)')], ['yes', t('Limités au vocabulaire contrôlé')]] },
          ]}
          onSubmit={(v) => L.lib('PUT', '/catalog/settings', { ...Object.fromEntries(['loanDays', 'maxRenewals', 'maxLoans', 'finePerDay', 'blockAfterDays', 'blockDays', 'holdDays', 'remindBeforeDays', 'remindEveryDays'].map((k) => [k, Number(v[k])])), strictVocab: v.strictVocab === 'yes' }).then(() => { toast(t('Enregistré.')); st.reload(); })} />
      </div>
    )}
    </Loaded>
  );
}

function Blocks({ L }) {
  const t = useT();
  const { toast } = useWs();
  const st = useLoad(() => L.lib('GET', '/borrowers/blocks'), [L.tick]);
  const people = useLoad(() => L.lib('GET', '/people'), []);
  const fail = (e) => toast(tsrv(e.message), true);
  return (
    <div className="ws-cols">
      <div className="ws-card"><h2>{t('Emprunteurs bloqués')}</h2>
        <Loaded state={st}>{(j) => (j.blocks.length ? <ul className="lib-audit">{j.blocks.map((b) => (
          <li key={b.id}><b>{b.user}</b><span>{b.reason || t('Sans motif')} · {t("jusqu'au {date}", { date: day(b.until) })}{b.auto ? ` · ${t('automatique')}` : ''}</span>
            <button className="btn small" type="button" onClick={() => L.lib('DELETE', `/borrowers/blocks/${b.id}`).then(() => { toast(t('Blocage levé.')); st.reload(); }, fail)}>{t('Lever le blocage')}</button></li>))}</ul> : <p className="ws-empty">{t('Personne n’est bloqué.')}</p>)}
        </Loaded></div>
      <div className="ws-card"><h2>{t('Bloquer un emprunteur')}</h2>
        <Form submitText={t('Bloquer')} fields={[{ k: 'user', label: t('Personne'), type: 'select', required: true, value: '', options: [['', t('— Choisir —')], ...(people.data ? people.data.people.map((p) => [String(p.userId), p.name]) : [])] }, { k: 'days', label: t('Durée (jours)'), type: 'number', value: 30 }, { k: 'reason', label: t('Motif'), value: '' }]}
          onSubmit={(v) => L.lib('POST', `/borrowers/${v.user}/block`, { days: Number(v.days), reason: v.reason }).then(() => { toast(t('Emprunteur bloqué.')); st.reload(); })} /></div>
    </div>
  );
}

export default function Loans({ L }) {
  const t = useT();
  const { can, toast } = useWs();
  const [tab, setTab] = useState('mine');
  const mgr = can('manager');
  const scope = { mine: 'mine', all: 'all', overdue: 'overdue', history: 'history', resa: 'all' }[tab];
  const st = useLoad(() => (scope ? L.lib('GET', `/loans?scope=${scope}`) : Promise.resolve(null)), [scope, L.tick]);
  const items = [{ id: 'mine', label: t('Mes prêts') }, ...(mgr ? [{ id: 'all', label: t('En cours') }, { id: 'overdue', label: t('En retard') }, { id: 'resa', label: t('Réservations') }, { id: 'history', label: t('Historique') }, { id: 'blocks', label: t('Blocages') }] : []), ...(can('admin') ? [{ id: 'rules', label: t('Règles') }] : [])];
  const reload = () => { st.reload(); L.reload(); };
  return (
    <>
      <div className="ws-head"><div><h1>{t('Prêts et retours')}</h1><p className="muted">{t("Empruntez une ressource physique ou réservez un document sensible. Le retard déclenche des rappels, une pénalité et, si les règles le prévoient, un blocage.")}</p></div>
        {mgr ? <div className="row"><button className="btn small" type="button" onClick={() => L.lib('POST', '/loans/remind', {}).then((r) => toast(t('{n} rappel(s) envoyé(s).', { n: r.before + r.late })), (e) => toast(tsrv(e.message), true))}>{t('Envoyer les rappels maintenant')}</button></div> : null}</div>
      {mgr ? <Desk L={L} onChange={reload} /> : null}
      <Tabs items={items} value={tab} onChange={setTab} label={t('Prêts')} />
      {tab === 'rules' ? <Rules L={L} /> : tab === 'blocks' ? <Blocks L={L} /> : (
        <Loaded state={st}>{(j) => (j ? (
          tab === 'resa' ? (
            <Table columns={[{ key: 'title', label: t('Ressource') }, { key: 'user', label: t('Personne') }, { key: 'state', label: t('État'), render: (r) => (r.state === 'ready' ? <Badge tone="info">{t('À retirer jusqu’au {date}', { date: day(r.readyUntil) })}</Badge> : <Badge>{t('En attente')}</Badge>) }, { key: 'createdAt', label: t('Demandée le'), render: (r) => day(r.createdAt) },
              { key: 'x', label: '', render: (r) => <button className="btn small" type="button" onClick={() => L.lib('DELETE', `/reservations/${r.id}`).then(reload, (e) => toast(tsrv(e.message), true))}>{t('Annuler')}</button> }]} rows={j.reservations} empty={t('Aucune réservation.')} caption={t('Réservations')} />
          ) : (
            <>
              <LoanTable L={L} rows={j.loans} manager={mgr && tab !== 'mine'} onChange={reload} />
              {tab === 'mine' && j.reservations.length ? <><h3>{t('Mes réservations')}</h3><ul className="lib-audit">{j.reservations.map((r) => <li key={r.id}><b>{r.title}</b><span>{r.state === 'ready' ? t('À retirer jusqu’au {date}', { date: day(r.readyUntil) }) : t('En attente')}</span><button className="btn small" type="button" onClick={() => L.lib('DELETE', `/reservations/${r.id}`).then(reload, (e) => toast(tsrv(e.message), true))}>{t('Annuler')}</button></li>)}</ul></> : null}
            </>
          )) : null)}
        </Loaded>
      )}
    </>
  );
}
