import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Fa } from '../../../lib/fa.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { openChat } from '../sales/Chats.jsx';
import { openRule } from './RuleDialog.jsx';
import { CHANNEL_LABEL, IaPill, STAGE_LABEL, STATES, STATE_LABEL, fmtDT } from './util.jsx';

const SORT_COLS = [['name', 'Contact'], ['stage', 'Étape'], ['ordered', 'Commandé / facturé'], ['owed', 'Reste à payer'], ['last', 'Dernier message'], ['messages', 'Messages']];
const PULSE_MS = 5000;

/** Tableau de tous les clients de l'entreprise et de l'état de l'IA pour chacun. */
export function Contacts({ onPending }) {
  const t = useT();
  const ws = useWs();
  const { oapi, money, toast, fail } = ws;
  const [q, setQ] = useState('');
  const [qs, setQs] = useState('');
  const [state, setState] = useState('all');
  const [channel, setChannel] = useState('');
  const [stage, setStage] = useState('');
  const [sort, setSort] = useState('last');
  const [dir, setDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const qp = new URLSearchParams({ q: qs, state, channel, stage, sort, dir, page: String(page), pageSize: String(pageSize) }).toString();
  const st = useLoad(() => oapi('GET', '/aifollow/contacts?' + qp), [qp]);
  const stamp = useRef('');

  // Recherche : on attend une courte pause de frappe, et on revient à la page 1.
  useEffect(() => { const id = setTimeout(() => { setQs(q.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);
  // Mise à jour automatique : interrogation légère ; le tableau se recharge seulement si quelque chose a changé. Arrêtée quand l'onglet est caché.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      oapi('GET', '/aifollow/pulse').then((p) => {
        if (onPending) onPending(p.drafts);
        if (stamp.current && stamp.current !== p.stamp) st.reload();
        stamp.current = p.stamp;
      }).catch(() => {});
    };
    const id = setInterval(tick, PULSE_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp]);

  const d = st.data;
  const sortBy = (k) => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir(k === 'name' || k === 'stage' ? 'asc' : 'desc'); } setPage(1); };
  const filt = (set) => (e) => { set(e.target.value); setPage(1); };

  const look = (c) => {
    oapi('GET', '/members').then((m) => openChat(ws, '/sales', { id: c.chatId, customer: c.name, contact: c.channel === 'whatsapp' ? c.phone.replace(/\D/g, '') : '', threads: c.threads }, m.members, true, st.reload)).catch(fail);
  };
  const target = (c) => (c.customerId ? { customerId: c.customerId } : { chatId: c.chatId });
  const lift = (c) => oapi('POST', '/aifollow/rules/lift', target(c)).then(() => { toast(t("L'IA répondra de nouveau à ce contact.")); st.reload(); }).catch(fail);
  const mkCustomer = (c) => ws.confirm(t('Créer la fiche client de {name} ?', { name: c.name }), () => oapi('POST', '/aifollow/customers', { chatId: c.chatId }).then(() => { toast(t('Fiche client créée (étape : prospect).')); st.reload(); }).catch(fail), t('Créer la fiche'));

  return (
    <div className="ws-card">
      <h2>{t('Tous vos clients et contacts')}</h2>
      <p className="muted">{t("Vos fiches clients et les personnes qui vous ont écrit sans avoir de fiche. Pour chacune : ce que l'IA a le droit de faire.")}</p>
      <div className="af-states" role="tablist" aria-label={t("État de l'IA")}>
        <button type="button" role="tab" aria-selected={state === 'all'} className={'tab' + (state === 'all' ? ' on' : '')} onClick={() => { setState('all'); setPage(1); }}>{t('Tous')}{d ? <b> {d.counts.all}</b> : null}</button>
        {STATES.map((s) => <button key={s} type="button" role="tab" aria-selected={state === s} className={'tab' + (state === s ? ' on' : '')} onClick={() => { setState(s); setPage(1); }}>{t(STATE_LABEL[s])}{d ? <b> {d.counts[s]}</b> : null}</button>)}
      </div>
      <div className="af-bar">
        <label className="fld af-search"><span>{t('Rechercher (nom, numéro, e-mail)')}</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Ex. : Awa, 655…')} autoComplete="off" /></label>
        <label className="fld"><span>{t('Canal')}</span>
          <select value={channel} onChange={filt(setChannel)}>
            <option value="">{t('Tous les canaux')}</option>
            {['whatsapp', 'web', 'messenger', 'instagram'].map((c) => <option key={c} value={c}>{t(CHANNEL_LABEL[c])}</option>)}
            <option value="none">{t('Aucune conversation')}</option>
          </select>
        </label>
        <label className="fld"><span>{t('Étape')}</span>
          <select value={stage} onChange={filt(setStage)}>
            <option value="">{t('Toutes les étapes')}</option>
            {['prospect', 'client', 'contact'].map((c) => <option key={c} value={c}>{t(STAGE_LABEL[c])}</option>)}
          </select>
        </label>
        <label className="fld"><span>{t('Trier par')}</span>
          <select value={sort + ':' + dir} onChange={(e) => { const [a, b] = e.target.value.split(':'); setSort(a); setDir(b); setPage(1); }}>
            {SORT_COLS.flatMap(([k, label]) => [<option key={k + 'a'} value={k + ':asc'}>{t(label) + ' ↑'}</option>, <option key={k + 'd'} value={k + ':desc'}>{t(label) + ' ↓'}</option>])}
          </select>
        </label>
      </div>
      {st.loading && !d ? <Loading /> : st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : d ? (
        <>
          <p className="af-count" aria-live="polite">{t('{n} contact(s)', { n: d.total })}</p>
          {!d.contacts.length ? <Empty text={t('Aucun contact ne correspond à cette recherche.')} /> : (
            <div className="af-wrap">
              <table className="af-table">
                <thead>
                  <tr>
                    {SORT_COLS.slice(0, 1).map(([k, label]) => <th key={k} scope="col" aria-sort={sort === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy(k)}>{t(label)}{sort === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>)}
                    <th scope="col">{t('Canal')}</th>
                    <th scope="col" aria-sort={sort === 'stage' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('stage')}>{t('Étape')}{sort === 'stage' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
                    <th scope="col" aria-sort={sort === 'ordered' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('ordered')}>{t('Commandé / facturé')}{sort === 'ordered' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
                    <th scope="col" aria-sort={sort === 'owed' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('owed')}>{t('Reste à payer')}{sort === 'owed' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
                    <th scope="col" aria-sort={sort === 'last' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('last')}>{t('Dernier message')}{sort === 'last' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
                    <th scope="col" aria-sort={sort === 'messages' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('messages')}>{t('Messages')}{sort === 'messages' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
                    <th scope="col">{t('Responsable')}</th>
                    <th scope="col">{t("IA")}</th>
                    <th scope="col">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.contacts.map((c) => (
                    <tr key={c.key}>
                      <td className="af-name"><b>{c.name}</b>{!c.hasCustomer ? <span className="af-tag">{t('Sans fiche')}</span> : null}<small>{[c.phone && c.phone.replace(/\D/g, '') !== c.name.replace(/\D/g, '') ? c.phone : '', c.email].filter(Boolean).join(' · ')}</small></td>
                      <td data-label={t('Canal')} className="nw">{c.channels.length ? c.channels.map((x) => t(CHANNEL_LABEL[x] || x)).join(', ') : '—'}</td>
                      <td data-label={t('Étape')} className="nw">{c.hasCustomer ? t(STAGE_LABEL[c.stage] || c.stage) : t('Sans fiche')}</td>
                      <td data-label={t('Commandé / facturé')} className="num">{c.hasCustomer ? <div className="af-v">{money(c.ordered)}<small>{t('facturé : {amount}', { amount: money(c.invoiced) })}</small></div> : '—'}</td>
                      <td data-label={t('Reste à payer')} className="num">{c.hasCustomer ? <span style={c.owed > 0 ? { color: 'var(--pink)', fontWeight: 700 } : undefined}>{money(c.owed)}</span> : '—'}</td>
                      <td data-label={t('Dernier message')} className="af-last">{c.lastAt ? <div className="af-v">{c.lastText ? <>{c.lastRole === 'user' ? '' : (c.lastRole === 'assistant' ? t('IA') : t('Équipe')) + ' : '}{c.lastText}</> : null}<small>{fmtDT(c.lastAt)}</small></div> : <span className="muted">{t('Aucun message')}</span>}</td>
                      <td data-label={t('Messages')} className="num nw">{c.messages}</td>
                      <td data-label={t('Responsable')} className="nw">{c.assignee || '—'}</td>
                      <td data-label={t("IA")} className="af-iacell"><div className="af-v"><IaPill state={c.state} />{c.rule ? <small>{c.rule.expiresAt ? t("jusqu'au {date}", { date: fmtDT(c.rule.expiresAt) }) : t('sans limite de durée')}</small> : null}{c.drafts ? <small>{t('{n} brouillon(s)', { n: c.drafts })}</small> : null}</div></td>
                      <td className="af-actions-cell">
                        <div className="af-actions">
                          {!c.hasCustomer && c.chatId ? <button className="btn small" type="button" onClick={() => mkCustomer(c)}><Fa name="user-plus" /> {t('Créer la fiche client')}</button> : null}
                          {c.rule && c.rule.mode === 'full'
                            ? <button className="btn small" type="button" onClick={() => lift(c)}>{t('Lever l\'exclusion')}</button>
                            : <button className="btn small" type="button" disabled={!c.customerId && !c.chatId} onClick={() => openRule(ws, { mode: 'full', target: target(c), label: c.name, current: c.rule, done: st.reload })}><Fa name="ban" /> {t('Exclure')}</button>}
                          <button className="btn small" type="button" disabled={!c.customerId && !c.chatId} onClick={() => openRule(ws, { mode: 'partial', target: target(c), label: c.name, current: c.rule && c.rule.mode === 'partial' ? c.rule : null, done: st.reload })}>{t('Exclusion partielle')}</button>
                          {c.rule && c.rule.mode === 'partial' ? <button className="btn small" type="button" onClick={() => lift(c)}>{t('Lever la règle')}</button> : null}
                          <button className="btn small" type="button" disabled={!c.chatId} onClick={() => look(c)}><Fa name="eye" /> {t('Regarder les messages')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="af-pager">
            <span className="muted small">{t('Page {page} sur {pages}', { page: d.page, pages: d.pages })}</span>
            <span className="row">
              <label className="muted small" htmlFor="af_ps">{t('Par page')} </label>
              <select id="af_ps" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              <button className="btn small" type="button" disabled={d.page <= 1} onClick={() => setPage(d.page - 1)}>{t('Précédent')}</button>
              <button className="btn small" type="button" disabled={d.page >= d.pages} onClick={() => setPage(d.page + 1)}>{t('Suivant')}</button>
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
